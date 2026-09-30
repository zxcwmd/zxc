const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const crypto = require('node:crypto');
const { app, BrowserWindow, dialog, ipcMain, safeStorage, shell } = require('electron');

const DEV_SERVER_URL = 'http://localhost:5173';
const MINECRAFT_MANIFEST_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';
const MODRINTH_API = 'https://api.modrinth.com/v2';
const ELY_AUTH_URL = 'https://authserver.ely.by';
const ELY_AUTH_API_URL = `${ELY_AUTH_URL}/auth`;
const GAME_ROOT_ID = 'bloom-client';
const ALLOWED_LOADERS = new Set(['vanilla', 'fabric', 'quilt', 'forge', 'neoforge']);
const MAX_CONTENT_SIZE = 250 * 1024 * 1024;

let mainWindow;
let activeLaunch = null;
let manifestCache = { expiresAt: 0, manifest: null };
let accounts = [];
let activeAccountId = null;
let memoryOnlyAccountStore = false;

const jsonPath = (name) => path.join(app.getPath('userData'), name);
const instancesPath = () => jsonPath('instances.json');
const settingsPath = () => jsonPath('launcher-settings.json');
const accountsPath = () => jsonPath('accounts.secure');

function readJson(filePath, fallback) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return fallback; }
}

async function writeJsonAtomic(filePath, value) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  await fsp.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fsp.rename(temporaryPath, filePath);
}

function sanitizeText(value, maxLength = 80) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, maxLength);
}

function sanitizeSlug(value) {
  return String(value ?? '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 64);
}

function normalizeVersionType(type) {
  return ['release', 'snapshot', 'old_beta', 'old_alpha'].includes(type) ? type : 'release';
}

function validateInstanceId(id) {
  const safeId = String(id ?? '');
  if (!/^[a-z0-9][a-z0-9-]{2,63}$/.test(safeId)) throw new Error('Некорректный идентификатор игрового профиля.');
  return safeId;
}

function validateLoader(loader) {
  const safeLoader = String(loader ?? '');
  if (!ALLOWED_LOADERS.has(safeLoader)) throw new Error('Выбран неизвестный загрузчик Minecraft.');
  return safeLoader;
}

function getInstances() {
  const saved = readJson(instancesPath(), []);
  if (!Array.isArray(saved)) return [];
  return saved.filter((item) => item && typeof item.id === 'string' && typeof item.name === 'string');
}

async function saveInstances(instances) {
  await writeJsonAtomic(instancesPath(), instances);
}

function getLauncherSettings() {
  const saved = readJson(settingsPath(), {});
  return {
    activeInstanceId: typeof saved.activeInstanceId === 'string' ? saved.activeInstanceId : null,
    javaPath: typeof saved.javaPath === 'string' ? saved.javaPath : '',
    memoryGb: Number.isFinite(saved.memoryGb) ? saved.memoryGb : 6,
  };
}

async function updateLauncherSettings(patch) {
  const current = getLauncherSettings();
  const next = { ...current, ...patch };
  await writeJsonAtomic(settingsPath(), next);
  return next;
}

function isSecureStorageAvailable() {
  try {
    if (!safeStorage.isEncryptionAvailable()) return false;
    if (process.platform === 'linux' && safeStorage.getSelectedStorageBackend?.() === 'basic_text') return false;
    return true;
  } catch {
    return false;
  }
}

function getMinecraftBaseDirectory() {
  if (process.platform === 'win32') return app.getPath('appData');
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support');
  return os.homedir();
}

function getMinecraftRoot(instanceId) {
  const cleanId = validateInstanceId(instanceId);
  const gameRoot = sanitizeSlug(GAME_ROOT_ID).replace(/-/g, '_');
  const rootDirectory = process.platform === 'darwin' ? gameRoot : `.${gameRoot}`;
  return path.join(getMinecraftBaseDirectory(), rootDirectory, cleanId);
}

function getContentDirectory(instanceId, type) {
  const instanceRoot = getMinecraftRoot(instanceId);
  if (type === 'mod') return path.join(instanceRoot, 'mods');
  if (type === 'resourcepack') return path.join(instanceRoot, 'resourcepacks');
  throw new Error('Неизвестный тип контента.');
}

function hydrateAccounts() {
  if (accounts.length || !fs.existsSync(accountsPath())) return;
  if (!isSecureStorageAvailable()) {
    memoryOnlyAccountStore = true;
    return;
  }
  try {
    const encrypted = fs.readFileSync(accountsPath());
    const saved = JSON.parse(safeStorage.decryptString(encrypted));
    accounts = Array.isArray(saved.accounts) ? saved.accounts.filter((item) => item && item.account) : [];
    activeAccountId = typeof saved.activeAccountId === 'string' ? saved.activeAccountId : null;
  } catch {
    accounts = [];
    activeAccountId = null;
  }
}

function persistAccounts() {
  if (!isSecureStorageAvailable()) {
    memoryOnlyAccountStore = true;
    return false;
  }
  try {
    const encrypted = safeStorage.encryptString(JSON.stringify({ accounts, activeAccountId }));
    fs.mkdirSync(path.dirname(accountsPath()), { recursive: true });
    fs.writeFileSync(accountsPath(), encrypted, { mode: 0o600 });
    memoryOnlyAccountStore = false;
    return true;
  } catch {
    memoryOnlyAccountStore = true;
    return false;
  }
}

function publicAccount(saved) {
  const account = saved.account;
  const uuid = String(account.uuid ?? '').replace(/-/g, '');
  return {
    id: saved.id,
    name: account.name,
    uuid: account.uuid,
    provider: account.meta.type === 'msa' ? 'microsoft' : 'ely',
    avatarUrl: uuid ? `https://crafatar.com/avatars/${encodeURIComponent(uuid)}?size=80&overlay` : '',
  };
}

function getActiveAccount() {
  hydrateAccounts();
  return accounts.find((entry) => entry.id === activeAccountId) ?? null;
}

function sendLauncherEvent(event) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('launcher:event', event);
}

function scrubSecrets(text, account) {
  let result = String(text ?? '');
  for (const secret of [account?.accessToken, account?.clientToken, account?.refreshToken]) {
    if (typeof secret === 'string' && secret.length > 8) result = result.split(secret).join('[token hidden]');
  }
  return result.slice(0, 600);
}

async function getVersionManifest(forceRefresh = false) {
  if (!forceRefresh && manifestCache.manifest && manifestCache.expiresAt > Date.now()) return manifestCache.manifest;
  const response = await fetch(MINECRAFT_MANIFEST_URL, { headers: { 'User-Agent': 'BloomClient/0.5 (+https://github.com/zxcwmd/zxc)' } });
  if (!response.ok) throw new Error(`Не удалось получить официальный список Minecraft (HTTP ${response.status}).`);
  const manifest = await response.json();
  if (!Array.isArray(manifest.versions)) throw new Error('Официальный список Minecraft имеет неожиданный формат.');
  manifestCache = { manifest, expiresAt: Date.now() + 30 * 60 * 1000 };
  return manifest;
}

async function resolveGameVersion(version) {
  const manifest = await getVersionManifest();
  if (version === 'latest_release') return manifest.latest.release;
  if (version === 'latest_snapshot') return manifest.latest.snapshot;
  if (!manifest.versions.some((entry) => entry.id === version)) throw new Error(`Версия Minecraft ${version} отсутствует в официальном манифесте.`);
  return version;
}

async function getLoaderVersion(gameVersion, loader) {
  if (loader === 'vanilla') return gameVersion;
  const encodedVersion = encodeURIComponent(gameVersion);
  let versions = [];
  try {
    if (loader === 'fabric') {
      const response = await fetch(`https://meta.fabricmc.net/v2/versions/loader/${encodedVersion}`);
      if (response.ok) {
        const data = await response.json();
        versions = data.map((entry) => ({ version: entry.loader?.version, stable: entry.loader?.stable })).filter((entry) => entry.version);
      }
    } else if (loader === 'quilt') {
      const response = await fetch(`https://meta.quiltmc.org/v3/versions/loader/${encodedVersion}`);
      if (response.ok) {
        const data = await response.json();
        versions = data.map((entry) => ({ version: entry.loader?.version, stable: entry.loader?.stable })).filter((entry) => entry.version);
      }
    } else if (loader === 'forge') {
      const response = await fetch('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json');
      if (response.ok) {
        const promos = (await response.json()).promos ?? {};
        const forgeBuild = promos[`${gameVersion}-recommended`] || promos[`${gameVersion}-latest`];
        if (forgeBuild) return `${gameVersion}-${forgeBuild}`;
      }
      const metadata = await fetch('https://maven.minecraftforge.net/net/minecraftforge/forge/maven-metadata.xml');
      if (metadata.ok) {
        const xml = await metadata.text();
        const matches = [...xml.matchAll(/<version>([^<]+)<\/version>/g)].map((entry) => entry[1]).filter((entry) => entry.startsWith(`${gameVersion}-`));
        if (matches.length) return matches[matches.length - 1];
      }
    } else if (loader === 'neoforge') {
      const metadata = await fetch('https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml');
      if (metadata.ok) {
        const parts = gameVersion.split('.');
        const majorMinor = parts.length >= 2 ? `${parts[1]}.${parts[2] ?? 0}.` : '';
        const matches = [...xmlVersions(await metadata.text())].filter((value) => majorMinor && value.startsWith(majorMinor));
        if (matches.length) return matches[matches.length - 1];
      }
    }
  } catch (error) {
    throw new Error(`Не удалось получить совместимую версию ${loader}: ${error instanceof Error ? error.message : 'ошибка сети'}`);
  }
  if (versions.length) return (versions.find((entry) => entry.stable) ?? versions[0]).version;
  throw new Error(`Для Minecraft ${gameVersion} не найден доступный ${loader}. Выберите другой загрузчик или версию игры.`);
}

function xmlVersions(xml) {
  return [...String(xml).matchAll(/<version>([^<]+)<\/version>/g)].map((entry) => entry[1]);
}

function validateInstancePatch(patch) {
  const safe = {};
  if (Object.prototype.hasOwnProperty.call(patch, 'name')) {
    const name = sanitizeText(patch.name, 36);
    if (!name) throw new Error('У профиля должно быть имя.');
    safe.name = name;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'version')) {
    const version = sanitizeText(patch.version, 40);
    if (!/^(latest_release|latest_snapshot|[0-9][0-9a-zA-Z._-]*)$/.test(version)) throw new Error('Некорректный номер версии Minecraft.');
    safe.version = version;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'loader')) safe.loader = validateLoader(patch.loader);
  return safe;
}

function instanceSummary(instance) {
  const root = getMinecraftRoot(instance.id);
  const versionsDirectory = path.join(root, 'versions');
  const modsDirectory = path.join(root, 'mods');
  let contentCount = 0;
  try { contentCount = fs.readdirSync(modsDirectory).filter((name) => name.toLowerCase().endsWith('.jar')).length; } catch { /* not installed yet */ }
  let installed = false;
  try { installed = fs.readdirSync(versionsDirectory).length > 0; } catch { /* not installed yet */ }
  return { ...instance, installed, contentCount };
}

async function fetchModrinthProjectVersions(projectId, gameVersion, loader, type) {
  const params = new URLSearchParams();
  params.set('game_versions', JSON.stringify([gameVersion]));
  if (type === 'mod' && loader !== 'vanilla') params.set('loaders', JSON.stringify([loader]));
  const response = await fetch(`${MODRINTH_API}/project/${encodeURIComponent(projectId)}/version?${params.toString()}`, {
    headers: { 'User-Agent': 'BloomClient/0.5 (+https://github.com/zxcwmd/zxc)' },
  });
  if (!response.ok) throw new Error(`Modrinth не вернул совместимые версии (HTTP ${response.status}).`);
  const data = await response.json();
  const selected = data.find((entry) => entry.status !== 'archived' && entry.game_versions?.includes(gameVersion) && (type !== 'mod' || loader === 'vanilla' || entry.loaders?.includes(loader)));
  if (!selected) throw new Error(`Для выбранной версии Minecraft ${gameVersion} не найден совместимый файл.`);
  return selected;
}

function selectModrinthFile(version, type) {
  const expectedExtension = type === 'mod' ? '.jar' : '.zip';
  const file = (version.files ?? []).find((item) => item.primary && item.filename?.toLowerCase().endsWith(expectedExtension))
    ?? (version.files ?? []).find((item) => item.filename?.toLowerCase().endsWith(expectedExtension));
  if (!file?.url) throw new Error('В версии проекта нет поддерживаемого файла для Minecraft.');
  return file;
}

async function installVersionFile(version, type, instanceId, installedNames) {
  const file = selectModrinthFile(version, type);
  if (Number(file.size) > MAX_CONTENT_SIZE) throw new Error(`${file.filename} превышает допустимый размер 250 МБ.`);
  const url = new URL(file.url);
  if (url.protocol !== 'https:' || !(url.hostname === 'modrinth.com' || url.hostname.endsWith('.modrinth.com'))) throw new Error('Источник файла не прошёл проверку безопасности Modrinth.');
  const fileName = path.basename(String(file.filename).replace(/\\/g, '/')).replace(/[<>:"|?*\u0000-\u001f]/g, '_');
  if (!fileName || fileName === '.' || fileName === '..') throw new Error('Некорректное имя файла в Modrinth.');
  const directory = getContentDirectory(instanceId, type);
  await fsp.mkdir(directory, { recursive: true });
  const destination = path.join(directory, fileName);
  const response = await fetch(url, { headers: { 'User-Agent': 'BloomClient/0.5 (+https://github.com/zxcwmd/zxc)' } });
  if (!response.ok) throw new Error(`Не удалось загрузить ${fileName} (HTTP ${response.status}).`);
  const finalUrl = new URL(response.url || url.href);
  if (finalUrl.protocol !== 'https:' || !(finalUrl.hostname === 'modrinth.com' || finalUrl.hostname.endsWith('.modrinth.com'))) throw new Error('Загрузка перенаправлена на неподдерживаемый домен.');
  const contentLength = Number(response.headers.get('content-length'));
  if (contentLength > MAX_CONTENT_SIZE) throw new Error(`${fileName} превышает допустимый размер 250 МБ.`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.length > MAX_CONTENT_SIZE) throw new Error(`${fileName} превышает допустимый размер 250 МБ или пуст.`);
  if (file.size && buffer.length !== file.size) throw new Error(`Размер ${fileName} не совпал с описанием Modrinth.`);
  const hashes = file.hashes ?? {};
  if (hashes.sha512 && crypto.createHash('sha512').update(buffer).digest('hex').toLowerCase() !== String(hashes.sha512).toLowerCase()) throw new Error(`Проверка SHA-512 не пройдена для ${fileName}.`);
  if (!hashes.sha512 && hashes.sha1 && crypto.createHash('sha1').update(buffer).digest('hex').toLowerCase() !== String(hashes.sha1).toLowerCase()) throw new Error(`Проверка SHA-1 не пройдена для ${fileName}.`);
  await fsp.writeFile(destination, buffer);
  installedNames.push({ destination, name: fileName });
}

async function collectRequiredDependencies(version, gameVersion, loader, collected, depth = 0) {
  if (depth > 6) return;
  for (const dependency of version.dependencies ?? []) {
    if (dependency.dependency_type !== 'required') continue;
    let resolved = null;
    if (dependency.version_id) {
      const response = await fetch(`${MODRINTH_API}/version/${encodeURIComponent(dependency.version_id)}`);
      if (response.ok) resolved = await response.json();
    } else if (dependency.project_id) {
      resolved = await fetchModrinthProjectVersions(dependency.project_id, gameVersion, loader, 'mod').catch(() => null);
    }
    if (!resolved) throw new Error('Не удалось получить обязательную зависимость мода из Modrinth.');
    if (collected.some((item) => item.id === resolved.id)) continue;
    if (!resolved.game_versions?.includes(gameVersion) || !resolved.loaders?.includes(loader)) {
      throw new Error(`Обязательная зависимость ${resolved.name ?? resolved.id} несовместима с ${gameVersion} / ${loader}.`);
    }
    collected.push(resolved);
    await collectRequiredDependencies(resolved, gameVersion, loader, collected, depth + 1);
  }
}

function performanceOptions(settings, gameVersion) {
  const maxFps = Math.max(10, Math.min(260, Math.round(Number(settings.maxFps) || 120)));
  const renderDistance = Math.max(2, Math.min(64, Math.round(Number(settings.renderDistance) || 12)));
  const simulationDistance = Math.max(5, Math.min(32, Math.round(Number(settings.simulationDistance) || 8)));
  const mipmapLevels = Math.max(0, Math.min(4, Math.round(Number(settings.mipmapLevels) || 0)));
  const graphics = settings.graphics === 'fancy' ? 'fancy' : 'fast';
  const cloudSetting = ['off', 'fast', 'fancy'].includes(settings.clouds) ? settings.clouds : 'off';
  const particleSetting = ['all', 'decreased', 'minimal'].includes(settings.particles) ? settings.particles : 'decreased';
  const versionMatch = String(gameVersion ?? '').match(/(?:^|[^0-9])(\d+)\.(\d+)/);
  const versionMajor = versionMatch ? Number(versionMatch[1]) : 1;
  const versionMinor = versionMatch ? Number(versionMatch[2]) : 21;
  const modernGraphics = versionMajor > 1 || (versionMajor === 1 && versionMinor >= 21);
  const options = {
    maxFps,
    renderDistance,
    particles: particleSetting === 'all' ? 0 : particleSetting === 'minimal' ? 2 : 1,
    entityShadows: Boolean(settings.entityShadows),
    enableVsync: Boolean(settings.vsync),
    mipmapLevels,
  };
  if (versionMajor > 1 || (versionMajor === 1 && versionMinor >= 18)) options.simulationDistance = simulationDistance;
  if (modernGraphics) {
    options.graphicsMode = graphics === 'fast' ? 0 : 1;
    options.renderClouds = JSON.stringify(cloudSetting === 'off' ? 'false' : cloudSetting);
    options.fancyGraphics = graphics === 'fancy';
    options.clouds = cloudSetting !== 'off';
  } else {
    options.fancyGraphics = graphics === 'fancy';
    options.clouds = cloudSetting !== 'off';
  }
  return options;
}

function validateHudSettings(settings) {
  const accents = new Set(['mint', 'violet', 'ice']);
  return {
    schemaVersion: 1,
    keystrokes: Boolean(settings.keystrokes),
    cps: Boolean(settings.cps),
    armor: Boolean(settings.armor),
    potions: Boolean(settings.potions),
    coordinates: Boolean(settings.coordinates),
    ping: Boolean(settings.ping),
    clock: Boolean(settings.clock),
    crosshair: Boolean(settings.crosshair),
    scale: Math.max(0.65, Math.min(1.5, Number(settings.scale) || 1)),
    opacity: Math.max(0.25, Math.min(1, Number(settings.opacity) || 0.85)),
    accent: accents.has(settings.accent) ? settings.accent : 'mint',
    updatedAt: new Date().toISOString(),
  };
}

function validatePng(buffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(signature)) throw new Error('Выберите PNG-скин Minecraft.');
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (!(width === 64 && (height === 64 || height === 32))) throw new Error('Размер скина должен быть 64×64 или 64×32 пикселя.');
}

function skinDataUrl(buffer) {
  return `data:image/png;base64,${buffer.toString('base64')}`;
}

async function readSkinForAccount(account) {
  if (account.meta.type === 'msa') {
    const uuid = String(account.uuid).replace(/-/g, '');
    const profileResponse = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${encodeURIComponent(uuid)}?unsigned=false`);
    if (!profileResponse.ok) return { skinDataUrl: null, capeDataUrl: null, source: 'microsoft' };
    const profile = await profileResponse.json();
    const texturesProperty = (profile.properties ?? []).find((entry) => entry.name === 'textures')?.value;
    if (!texturesProperty) return { skinDataUrl: null, capeDataUrl: null, source: 'microsoft' };
    const textureData = JSON.parse(Buffer.from(texturesProperty, 'base64').toString('utf8'));
    const fetchTexture = async (rawUrl) => {
      if (!rawUrl) return null;
      const url = new URL(rawUrl);
      if (url.protocol !== 'https:' || url.hostname !== 'textures.minecraft.net') return null;
      const response = await fetch(url);
      if (!response.ok) return null;
      const length = Number(response.headers.get('content-length'));
      if (length > 2 * 1024 * 1024) return null;
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length > 2 * 1024 * 1024 || !buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return null;
      return skinDataUrl(buffer);
    };
    return {
      skinDataUrl: await fetchTexture(textureData.textures?.SKIN?.url),
      capeDataUrl: await fetchTexture(textureData.textures?.CAPE?.url),
      source: 'microsoft',
    };
  }
  const response = await fetch(`https://skinsystem.ely.by/skins/${encodeURIComponent(account.name)}.png`);
  if (!response.ok) return { skinDataUrl: null, capeDataUrl: null, source: 'ely' };
  const length = Number(response.headers.get('content-length'));
  if (length > 2 * 1024 * 1024) return { skinDataUrl: null, capeDataUrl: null, source: 'ely' };
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > 2 * 1024 * 1024 || !buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { skinDataUrl: null, capeDataUrl: null, source: 'ely' };
  return { skinDataUrl: skinDataUrl(buffer), capeDataUrl: null, source: 'ely' };
}

async function ensureFreshAccount(saved) {
  const { MicrosoftAuth, YggdrasilAuth } = await import('eml-lib');
  const auth = saved.account.meta.type === 'msa' ? new MicrosoftAuth(mainWindow) : new YggdrasilAuth(ELY_AUTH_API_URL);
  let account = saved.account;
  const valid = await auth.validate(account).catch(() => false);
  if (!valid) account = await auth.refresh(account);
  if (account.meta.type === 'yggdrasil') account.meta.url = ELY_AUTH_URL;
  saved.account = account;
  persistAccounts();
  return account;
}

function safeAccountError(error) {
  const message = String(error instanceof Error ? error.message : error ?? 'Неизвестная ошибка');
  if (/not owned|minecraft not owned/i.test(message)) return 'Этот Microsoft-аккаунт не имеет лицензии Minecraft: Java Edition.';
  if (/invalid username|invalid credentials|unauthorized|invalid token/i.test(message)) return 'Провайдер не принял данные входа. Проверьте их и попробуйте ещё раз.';
  if (/totp|two.factor|2fa/i.test(message)) return 'Не удалось подтвердить Ely.by. Проверьте пароль и одноразовый код TOTP.';
  return message.replace(/https?:\/\/\S+/g, '[адрес провайдера]').slice(0, 360);
}

function readJsonLikeOptions(filePath) {
  const values = new Map();
  try {
    for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
      const delimiter = line.indexOf(':');
      if (delimiter > 0) values.set(line.slice(0, delimiter), line.slice(delimiter + 1));
    }
  } catch { /* a new game directory has no options file */ }
  return values;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1460,
    height: 980,
    minWidth: 960,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#090d0c',
    title: 'Bloom Client',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://login.live.com/') || url.startsWith('https://login.microsoftonline.com/')) return { action: 'allow' };
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
    const allowed = app.isPackaged ? targetUrl.startsWith('file://') : targetUrl.startsWith(DEV_SERVER_URL);
    if (!allowed) event.preventDefault();
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  if (app.isPackaged) mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  else mainWindow.loadURL(DEV_SERVER_URL);
}

function registerIpcHandlers() {
  ipcMain.handle('app:get-bootstrap', async () => {
    hydrateAccounts();
    const savedSettings = getLauncherSettings();
    const instances = getInstances().map(instanceSummary);
    let activeInstanceId = savedSettings.activeInstanceId;
    if (!instances.some((instance) => instance.id === activeInstanceId)) activeInstanceId = instances[0]?.id ?? null;
    if (activeInstanceId !== savedSettings.activeInstanceId) await updateLauncherSettings({ activeInstanceId });
    return {
      desktop: true,
      appVersion: app.getVersion(),
      platform: process.platform,
      dataDirectory: app.getPath('userData'),
      javaPath: savedSettings.javaPath,
      accounts: accounts.map(publicAccount),
      activeAccountId,
      instances,
      activeInstanceId,
      secureStorageAvailable: isSecureStorageAvailable() && !memoryOnlyAccountStore,
      totalMemoryMb: Math.round(os.totalmem() / 1024 / 1024),
    };
  });

  ipcMain.handle('game:get-versions', async () => {
    const manifest = await getVersionManifest();
    return manifest.versions.map((entry) => ({ id: entry.id, type: normalizeVersionType(entry.type), releaseTime: entry.releaseTime, url: entry.url }));
  });

  ipcMain.handle('instance:create', async (_event, input) => {
    const name = sanitizeText(input?.name, 36);
    if (!name) throw new Error('Введите название профиля.');
    const version = sanitizeText(input?.version, 40);
    const loader = validateLoader(input?.loader);
    await resolveGameVersion(version);
    const instances = getInstances();
    const id = `bloom-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
    const instance = { id, name, version, loader, loaderVersion: '', createdAt: new Date().toISOString() };
    instances.unshift(instance);
    await saveInstances(instances);
    if (!getLauncherSettings().activeInstanceId) await updateLauncherSettings({ activeInstanceId: id });
    return instanceSummary(instance);
  });

  ipcMain.handle('instance:update', async (_event, instanceId, patch) => {
    const id = validateInstanceId(instanceId);
    const safePatch = validateInstancePatch(patch ?? {});
    if (safePatch.version) await resolveGameVersion(safePatch.version);
    const instances = getInstances();
    const index = instances.findIndex((instance) => instance.id === id);
    if (index < 0) throw new Error('Игровой профиль не найден.');
    instances[index] = { ...instances[index], ...safePatch };
    await saveInstances(instances);
    return instanceSummary(instances[index]);
  });

  ipcMain.handle('instance:delete', async (_event, instanceId) => {
    const id = validateInstanceId(instanceId);
    const instances = getInstances();
    if (!instances.some((instance) => instance.id === id)) throw new Error('Игровой профиль не найден.');
    await saveInstances(instances.filter((instance) => instance.id !== id));
    if (getLauncherSettings().activeInstanceId === id) await updateLauncherSettings({ activeInstanceId: null });
    // Keep game files and worlds on disk when the profile is removed from Bloom.
  });

  ipcMain.handle('instance:set-active', async (_event, instanceId) => {
    const id = validateInstanceId(instanceId);
    if (!getInstances().some((instance) => instance.id === id)) throw new Error('Игровой профиль не найден.');
    await updateLauncherSettings({ activeInstanceId: id });
  });

  ipcMain.handle('account:set-active', async (_event, accountId) => {
    hydrateAccounts();
    if (accountId !== null && !accounts.some((entry) => entry.id === accountId)) throw new Error('Аккаунт не найден.');
    activeAccountId = accountId;
    persistAccounts();
  });

  ipcMain.handle('account:login-microsoft', async () => {
    if (!mainWindow || mainWindow.isDestroyed()) throw new Error('Окно Bloom Client не готово.');
    hydrateAccounts();
    try {
      const { MicrosoftAuth } = await import('eml-lib');
      const account = await new MicrosoftAuth(mainWindow).auth();
      const id = `microsoft-${String(account.uuid).replace(/-/g, '')}`;
      const existing = accounts.find((entry) => entry.id === id);
      if (existing) existing.account = account;
      else accounts.push({ id, account });
      activeAccountId = id;
      const persisted = persistAccounts();
      return { ...publicAccount({ id, account }), persisted };
    } catch (error) {
      throw new Error(safeAccountError(error));
    }
  });

  ipcMain.handle('account:login-ely', async (_event, input) => {
    hydrateAccounts();
    let username = sanitizeText(input?.username, 120);
    let password = typeof input?.password === 'string' ? input.password : '';
    let totp = typeof input?.totp === 'string' ? input.totp.replace(/\D/g, '').slice(0, 8) : '';
    if (!username || !password || password.length > 512) throw new Error('Укажите имя пользователя и пароль Ely.by.');
    try {
      const { YggdrasilAuth } = await import('eml-lib');
      const auth = new YggdrasilAuth(ELY_AUTH_API_URL);
      const account = await auth.auth(username, totp ? `${password}:${totp}` : password);
      if (account?.needsProfileSelection) throw new Error('В Ely.by найдено несколько игровых профилей. Сначала выберите профиль в аккаунте Ely.by и повторите вход.');
      if (account?.meta?.type !== 'yggdrasil' || account.meta.url !== ELY_AUTH_API_URL) throw new Error('Ответ Ely.by не прошёл проверку провайдера.');
      account.meta.url = ELY_AUTH_URL;
      const id = `ely-${String(account.uuid).replace(/-/g, '')}`;
      const existing = accounts.find((entry) => entry.id === id);
      if (existing) existing.account = account;
      else accounts.push({ id, account });
      activeAccountId = id;
      const persisted = persistAccounts();
      return { ...publicAccount({ id, account }), persisted };
    } catch (error) {
      throw new Error(safeAccountError(error));
    } finally {
      username = '';
      password = '';
      totp = '';
    }
  });

  ipcMain.handle('account:remove', async (_event, accountId) => {
    hydrateAccounts();
    const entry = accounts.find((item) => item.id === accountId);
    if (!entry) return;
    if (entry.account.meta.type === 'yggdrasil') {
      try {
        const { YggdrasilAuth } = await import('eml-lib');
        await new YggdrasilAuth(ELY_AUTH_API_URL).logout(entry.account);
      } catch { /* local removal should still work when Ely.by is unavailable */ }
    }
    accounts = accounts.filter((item) => item.id !== accountId);
    if (activeAccountId === accountId) activeAccountId = accounts[0]?.id ?? null;
    persistAccounts();
  });

  ipcMain.handle('game:launch', async (_event, input) => {
    hydrateAccounts();
    if (activeLaunch) throw new Error('Minecraft уже запускается или работает.');
    const instanceId = validateInstanceId(input?.instanceId);
    const instance = getInstances().find((entry) => entry.id === instanceId);
    if (!instance) throw new Error('Сначала создайте игровой профиль.');
    const savedAccount = getActiveAccount();
    if (!savedAccount) throw new Error('Для запуска войдите в Microsoft или Ely.by.');
    if (savedAccount.account.meta.type === 'yggdrasil' && savedAccount.account.meta.url !== ELY_AUTH_URL) throw new Error('Разрешён только официальный Ely.by authserver.');

    activeLaunch = { instanceId, preparing: true };
    try {
      const memoryGb = Math.max(2, Math.min(32, Math.round(Number(input?.memoryGb) || 6)));
      const javaPath = getLauncherSettings().javaPath;
      if (javaPath && !fs.existsSync(javaPath)) throw new Error('Выбранный файл Java не найден. Укажите путь заново или включите автоустановку.');
      const gameVersion = await resolveGameVersion(instance.version);
      const loader = validateLoader(instance.loader);
      const loaderVersion = await getLoaderVersion(gameVersion, loader);
      const account = await ensureFreshAccount(savedAccount);
      const { Launcher } = await import('eml-lib');
      const launcher = new Launcher({
        root: GAME_ROOT_ID,
        profile: { slug: instance.id, name: instance.name, isDefault: false },
        storage: 'isolated',
        cleaning: { enabled: false },
        account,
        minecraft: { version: gameVersion, loader: { loader, version: loaderVersion } },
        java: javaPath ? { install: 'manual', absolutePath: javaPath } : { install: 'auto' },
        memory: { min: 1024, max: memoryGb * 1024 },
        window: { width: 1280, height: 720, fullscreen: false },
      });

      let lastProgressAt = 0;
      activeLaunch = { instanceId, launcher };
      const phases = {
        launch_compute_download: 'Проверяем файлы игры и готовим загрузку…',
        launch_copy_assets: 'Подготавливаем игровые ресурсы…',
        launch_extract_natives: 'Распаковываем игровые библиотеки…',
        launch_patch_loader: 'Устанавливаем мод-загрузчик…',
        launch_check_java: 'Проверяем Java Runtime…',
        launch_clean: 'Завершаем подготовку профиля…',
      };
      for (const [eventName, message] of Object.entries(phases)) launcher.on(eventName, () => sendLauncherEvent({ kind: 'phase', message }));
      launcher.on('launch_download', ({ total }) => sendLauncherEvent({ kind: 'phase', message: `Загрузка файлов Minecraft (${total?.amount ?? 0} файлов)…` }));
      launcher.on('download_progress', (data) => {
        const now = Date.now();
        if (now - lastProgressAt < 160) return;
        lastProgressAt = now;
        const total = Number(data?.total?.size) || 0;
        const downloaded = Number(data?.downloaded?.size) || 0;
        const progress = total > 0 ? Math.max(0, Math.min(100, Math.round(downloaded / total * 100))) : undefined;
        sendLauncherEvent({ kind: 'progress', message: progress === undefined ? 'Загружаем игровые файлы…' : `Загружено ${progress}%`, progress });
      });
      launcher.on('launch_launch', () => sendLauncherEvent({ kind: 'started', message: 'Minecraft запущен.' }));
      launcher.on('launch_data', (line) => sendLauncherEvent({ kind: 'log', message: scrubSecrets(line, account) }));
      launcher.on('launch_close', (exitCode) => {
        sendLauncherEvent({ kind: 'closed', message: 'Игровая сессия завершена.', exitCode: exitCode ?? -1 });
        activeLaunch = null;
      });
      const result = launcher.launch();
      if (result && typeof result.catch === 'function') result.catch((error) => {
        const message = scrubSecrets(error instanceof Error ? error.message : error, account);
        sendLauncherEvent({ kind: 'error', message: message || 'Не удалось запустить Minecraft.' });
        activeLaunch = null;
      });
      return { accepted: true };
    } catch (error) {
      activeLaunch = null;
      throw error;
    }
  });

  ipcMain.handle('modrinth:search', async (_event, input) => {
    const type = input?.type === 'resourcepack' ? 'resourcepack' : 'mod';
    const query = sanitizeText(input?.query, 100);
    const facets = [[`project_type:${type}`]];
    if (input?.version) facets.push([`versions:${sanitizeText(input.version, 40)}`]);
    const loader = String(input?.loader ?? 'all');
    if (type === 'mod' && loader !== 'all' && loader !== 'vanilla' && ALLOWED_LOADERS.has(loader)) facets.push([`categories:${loader}`]);
    const category = sanitizeText(input?.category, 40);
    if (category && /^[a-z0-9_-]+$/.test(category)) facets.push([`categories:${category}`]);
    const params = new URLSearchParams({ query, facets: JSON.stringify(facets), limit: '30', index: 'downloads' });
    const response = await fetch(`${MODRINTH_API}/search?${params}`, { headers: { 'User-Agent': 'BloomClient/0.5 (+https://github.com/zxcwmd/zxc)' } });
    if (!response.ok) throw new Error(`Не удалось выполнить поиск Modrinth (HTTP ${response.status}).`);
    const data = await response.json();
    return (data.hits ?? []).map((hit) => ({
      project_id: hit.project_id,
      slug: hit.slug,
      title: hit.title,
      description: hit.description,
      icon_url: hit.icon_url ?? null,
      downloads: Number(hit.downloads) || 0,
      follows: Number(hit.follows) || 0,
      categories: Array.isArray(hit.categories) ? hit.categories : [],
      latest_version: hit.latest_version ?? '',
      project_type: hit.project_type,
    }));
  });

  ipcMain.handle('modrinth:install', async (_event, input) => {
    const projectId = sanitizeText(input?.projectId, 128);
    if (!/^[a-zA-Z0-9_-]+$/.test(projectId)) throw new Error('Некорректный идентификатор Modrinth.');
    const instanceId = validateInstanceId(input?.instanceId);
    const type = input?.type === 'resourcepack' ? 'resourcepack' : 'mod';
    const instance = getInstances().find((entry) => entry.id === instanceId);
    if (!instance) throw new Error('Игровой профиль не найден.');
    if (type === 'mod' && (!instance.loader || instance.loader === 'vanilla')) throw new Error('Для модов сначала создайте профиль с Fabric, Quilt, Forge или NeoForge. Ресурспаки работают и на Vanilla.');
    const gameVersion = await resolveGameVersion(instance.version);
    const mainVersion = await fetchModrinthProjectVersions(projectId, gameVersion, instance.loader, type);
    const versions = [mainVersion];
    if (type === 'mod') await collectRequiredDependencies(mainVersion, gameVersion, instance.loader, versions);
    const installed = [];
    try {
      for (const version of versions) await installVersionFile(version, type, instanceId, installed);
    } catch (error) {
      await Promise.all(installed.map((item) => fsp.unlink(item.destination).catch(() => {})));
      throw error;
    }
    return { installed: installed.map((item) => item.name) };
  });

  ipcMain.handle('content:list', async (_event, input) => {
    const instanceId = validateInstanceId(input?.instanceId);
    const type = input?.type === 'resourcepack' ? 'resourcepack' : 'mod';
    const directory = getContentDirectory(instanceId, type);
    await fsp.mkdir(directory, { recursive: true });
    const names = await fsp.readdir(directory);
    const entries = await Promise.all(names.filter((name) => type === 'mod' ? name.toLowerCase().endsWith('.jar') : name.toLowerCase().endsWith('.zip')).map(async (name) => {
      const filePath = path.join(directory, name);
      const stat = await fsp.stat(filePath);
      return { name, size: stat.size, modifiedAt: stat.mtime.toISOString() };
    }));
    return entries.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
  });

  ipcMain.handle('content:import', async (_event, input) => {
    const instanceId = validateInstanceId(input?.instanceId);
    const type = input?.type === 'resourcepack' ? 'resourcepack' : 'mod';
    const instance = getInstances().find((entry) => entry.id === instanceId);
    if (!instance) throw new Error('Игровой профиль не найден.');
    if (type === 'mod' && (!instance.loader || instance.loader === 'vanilla')) throw new Error('Для модов сначала создайте профиль с Fabric, Quilt, Forge или NeoForge.');
    const extension = type === 'mod' ? 'jar' : 'zip';
    const result = await dialog.showOpenDialog(mainWindow, {
      title: type === 'mod' ? 'Импортировать моды' : 'Импортировать ресурспаки',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: type === 'mod' ? 'Minecraft mods (.jar)' : 'Resource packs (.zip)', extensions: [extension] }],
    });
    if (result.canceled || !result.filePaths.length) return { imported: [] };
    const directory = getContentDirectory(instanceId, type);
    await fsp.mkdir(directory, { recursive: true });
    const imported = [];
    for (const sourcePath of result.filePaths) {
      const stat = await fsp.stat(sourcePath);
      if (!stat.isFile() || stat.size > MAX_CONTENT_SIZE) throw new Error('Файл должен быть меньше 250 МБ.');
      if (path.extname(sourcePath).toLowerCase() !== `.${extension}`) throw new Error(`Для этого раздела поддерживаются только .${extension} файлы.`);
      const name = path.basename(sourcePath).replace(/[<>:"|?*\u0000-\u001f]/g, '_');
      await fsp.copyFile(sourcePath, path.join(directory, name));
      imported.push(name);
    }
    return { imported };
  });

  ipcMain.handle('content:remove', async (_event, input) => {
    const instanceId = validateInstanceId(input?.instanceId);
    const type = input?.type === 'resourcepack' ? 'resourcepack' : 'mod';
    const fileName = String(input?.fileName ?? '');
    if (!fileName || path.basename(fileName) !== fileName || fileName.includes('..')) throw new Error('Некорректное имя файла.');
    const allowed = type === 'mod' ? fileName.toLowerCase().endsWith('.jar') : fileName.toLowerCase().endsWith('.zip');
    if (!allowed) throw new Error('Тип файла не соответствует разделу.');
    const directory = getContentDirectory(instanceId, type);
    const filePath = path.join(directory, fileName);
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(`${path.resolve(directory)}${path.sep}`)) throw new Error('Путь файла вне игрового профиля.');
    await fsp.unlink(filePath);
  });

  ipcMain.handle('settings:performance', async (_event, input) => {
    const instanceId = validateInstanceId(input?.instanceId);
    const instance = getInstances().find((entry) => entry.id === instanceId);
    if (!instance) throw new Error('Игровой профиль не найден.');
    const gameVersion = await resolveGameVersion(instance.version);
    const root = getMinecraftRoot(instanceId);
    await fsp.mkdir(root, { recursive: true });
    const optionsPath = path.join(root, 'options.txt');
    const existing = readJsonLikeOptions(optionsPath);
    const options = performanceOptions(input?.settings ?? {}, gameVersion);
    for (const [key, value] of Object.entries(options)) existing.set(key, String(value));
    await fsp.writeFile(optionsPath, `${[...existing.entries()].map(([key, value]) => `${key}:${value}`).join('\n')}\n`, 'utf8');
  });

  ipcMain.handle('settings:hud', async (_event, input) => {
    const instanceId = validateInstanceId(input?.instanceId);
    const directory = path.join(getMinecraftRoot(instanceId), 'config');
    await fsp.mkdir(directory, { recursive: true });
    await writeJsonAtomic(path.join(directory, 'bloom-client-hud.json'), validateHudSettings(input?.settings ?? {}));
  });

  ipcMain.handle('settings:choose-java', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Выберите исполняемый файл Java',
      properties: ['openFile'],
      filters: process.platform === 'win32' ? [{ name: 'Java executable', extensions: ['exe'] }, { name: 'All files', extensions: ['*'] }] : [{ name: 'Java executable', extensions: ['*'] }],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const javaPath = result.filePaths[0];
    await updateLauncherSettings({ javaPath });
    return javaPath;
  });

  ipcMain.handle('settings:clear-java', async () => {
    await updateLauncherSettings({ javaPath: '' });
  });

  ipcMain.handle('skin:get', async (_event, accountId) => {
    hydrateAccounts();
    const saved = accounts.find((entry) => entry.id === accountId);
    if (!saved) throw new Error('Аккаунт не найден.');
    return readSkinForAccount(saved.account);
  });

  ipcMain.handle('skin:upload-microsoft', async (_event, variant) => {
    hydrateAccounts();
    const saved = getActiveAccount();
    if (!saved || saved.account.meta.type !== 'msa') throw new Error('Загрузка скина доступна только для вошедшего Microsoft-аккаунта.');
    const model = variant === 'slim' ? 'slim' : 'classic';
    const currentAccount = await ensureFreshAccount(saved);
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Выберите PNG-скин Minecraft',
      properties: ['openFile'],
      filters: [{ name: 'Minecraft skin PNG', extensions: ['png'] }],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const buffer = await fsp.readFile(result.filePaths[0]);
    if (buffer.length > 2 * 1024 * 1024) throw new Error('Файл скина должен быть меньше 2 МБ.');
    validatePng(buffer);
    const form = new FormData();
    form.append('variant', model);
    form.append('file', new Blob([buffer], { type: 'image/png' }), path.basename(result.filePaths[0]));
    const response = await fetch('https://api.minecraftservices.com/minecraft/profile/skins', {
      method: 'POST',
      headers: { Authorization: `Bearer ${currentAccount.accessToken}` },
      body: form,
    });
    if (!response.ok) {
      const body = await response.text();
      if (response.status === 401) throw new Error('Сессия Microsoft истекла. Войдите снова и повторите загрузку скина.');
      throw new Error(`Minecraft не принял скин (HTTP ${response.status}): ${body.slice(0, 160)}`);
    }
    return readSkinForAccount(currentAccount);
  });

  ipcMain.handle('app:open-external', async (_event, rawUrl) => {
    let url;
    try { url = new URL(String(rawUrl)); } catch { throw new Error('Некорректная ссылка.'); }
    const allowedHosts = new Set(['modrinth.com', 'www.modrinth.com', 'ely.by', 'www.ely.by', 'account.ely.by', 'minecraft.net', 'www.minecraft.net', 'docs.ely.by', 'github.com', 'www.github.com']);
    if (url.protocol !== 'https:' || !allowedHosts.has(url.hostname)) throw new Error('Ссылка не входит в список доверенных сайтов.');
    await shell.openExternal(url.href);
  });
}

app.whenReady().then(() => {
  if (process.platform === 'win32') app.setAppUserModelId('com.bloomclient.desktop');
  hydrateAccounts();
  registerIpcHandlers();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
