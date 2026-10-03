import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import type { SkinViewer } from 'skinview3d';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Blocks,
  Box,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  CloudDownload,
  Cpu,
  Download,
  ExternalLink,
  Eye,
  FileArchive,
  FileCode2,
  Gamepad2,
  Gauge,
  HardDriveDownload,
  Layers3,
  LockKeyhole,
  Menu,
  MonitorPlay,
  Package,
  Paintbrush2,
  Play,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Shirt,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  UsersRound,
  X,
  Zap,
} from 'lucide-react';
import type {
  AccountSummary,
  BootstrapState,
  ContentType,
  GameInstance,
  GameVersion,
  HudSettings,
  LauncherEvent,
  LoaderType,
  ModrinthProject,
  PerformanceSettings,
  SkinState,
  VersionType,
} from './types';

const NAV_ITEMS = [
  { id: 'mods', label: 'Моды', icon: Blocks, group: 'КОНТЕНТ', page: 'catalog', contentType: 'mod' },
  { id: 'resourcepacks', label: 'Ресурспаки', icon: Paintbrush2, group: 'КОНТЕНТ', page: 'catalog', contentType: 'resourcepack' },
  { id: 'builds', label: 'Сборки', icon: Layers3, group: 'ИГРА', page: 'builds' },
  { id: 'settings', label: 'Настройки', icon: Settings2, group: 'СИСТЕМА', page: 'settings' },
] as const;

type PageId = 'home' | 'catalog' | 'builds' | 'playSetup' | 'hud' | 'skins' | 'settings';
type ModalId = 'auth' | 'instance' | 'launch' | null;
type VersionFilter = 'all' | VersionType;
type BuildsTab = 'profiles' | 'modrinth';

const LOADER_LABELS: Record<LoaderType, string> = {
  vanilla: 'Vanilla',
  fabric: 'Fabric',
  quilt: 'Quilt',
  forge: 'Forge',
  neoforge: 'NeoForge',
};

const VERSION_LABELS: Record<VersionType, string> = {
  release: 'Релизы',
  snapshot: 'Снапшоты',
  old_beta: 'Бета',
  old_alpha: 'Альфа',
};

const DEFAULT_PERFORMANCE: PerformanceSettings = {
  maxFps: 144,
  renderDistance: 12,
  simulationDistance: 8,
  graphics: 'fast',
  clouds: 'off',
  particles: 'decreased',
  entityShadows: false,
  vsync: false,
  mipmapLevels: 2,
};

const DEFAULT_HUD: HudSettings = {
  keystrokes: true,
  cps: true,
  armor: true,
  potions: true,
  coordinates: false,
  ping: true,
  clock: false,
  crosshair: true,
  scale: 1,
  opacity: 0.85,
  accent: 'mint',
};

function readStorage<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function formatDownloads(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

function compactDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function displayVersion(version: string, versions: GameVersion[]): string {
  if (version === 'latest_release') return versions.find((item) => item.type === 'release')?.id ?? 'Последний релиз';
  if (version === 'latest_snapshot') return versions.find((item) => item.type === 'snapshot')?.id ?? 'Последний снапшот';
  return version;
}

function makeDemoSkin(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (!context) return canvas;
  context.imageSmoothingEnabled = false;
  context.fillStyle = '#315a48';
  context.fillRect(0, 0, 64, 64);
  const block = (x: number, y: number, width: number, height: number, color: string) => {
    context.fillStyle = color;
    context.fillRect(x, y, width, height);
  };
  // A tiny Bloom-inspired skin, mapped to the standard Minecraft skin UV layout.
  block(0, 0, 32, 16, '#284438');
  block(8, 8, 8, 8, '#d5b18b');
  block(8, 8, 8, 3, '#49372f');
  block(9, 12, 2, 1, '#28362f');
  block(13, 12, 2, 1, '#28362f');
  block(11, 14, 2, 1, '#9a655d');
  block(32, 0, 32, 16, 'rgba(44, 82, 64, .75)');
  block(40, 8, 8, 3, '#183c30');
  block(16, 16, 24, 16, '#38745a');
  block(20, 20, 8, 12, '#5db488');
  block(20, 20, 8, 2, '#d4f288');
  block(23, 23, 2, 6, '#f0f5e7');
  block(16, 32, 24, 16, '#315743');
  block(0, 16, 16, 16, '#d3ad87');
  block(0, 16, 16, 4, '#49372f');
  block(40, 16, 16, 16, '#38745a');
  block(40, 16, 16, 4, '#d4f288');
  block(0, 32, 16, 16, '#29483a');
  block(0, 48, 16, 16, '#38624c');
  block(16, 48, 16, 16, '#315743');
  block(32, 48, 16, 16, '#315743');
  block(48, 48, 16, 16, '#38624c');
  return canvas;
}

function SkinPreview({ skin, cape, name, className = '', pose = 'standing' }: { skin: string | null; cape?: string | null; name?: string; className?: string; pose?: 'standing' | 'seated' }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const frame = canvas?.parentElement;
    if (!canvas || !frame) return;
    let cancelled = false;
    let observer: ResizeObserver | null = null;
    let viewer: SkinViewer | null = null;
    const seated = pose === 'seated';

    void import('skinview3d').then(({ SkinViewer, FunctionAnimation }) => {
      if (cancelled) return;
      const contextAttributes: WebGLContextAttributes = { alpha: true, premultipliedAlpha: true, antialias: true };
      const context = canvas.getContext('webgl2', contextAttributes) ?? canvas.getContext('webgl', contextAttributes);
      if (!context) return;

      const demo = skin ? null : makeDemoSkin();
      const bounds = frame.getBoundingClientRect();
      const seatedAnimation = seated
        ? new FunctionAnimation((player, progress) => {
            const breath = Math.sin(progress * Math.PI * 0.8) * 0.018;
            const joints = player.skin;
            joints.body.rotation.set(-0.035 + breath, 0, 0);
            joints.head.rotation.set(breath * 0.5, -0.1, 0);
            joints.leftLeg.rotation.set(-Math.PI / 2 + breath * 0.12, 0, -0.035);
            joints.rightLeg.rotation.set(-Math.PI / 2 - breath * 0.12, 0, 0.035);
            joints.leftArm.rotation.set(-0.94 + breath, 0, 0.15);
            joints.rightArm.rotation.set(-0.94 + breath, 0, -0.15);
            player.rotation.y = -0.24;
          })
        : undefined;

      viewer = new SkinViewer({
        canvas,
        width: Math.max(160, Math.floor(bounds.width)),
        height: Math.max(200, Math.floor(bounds.height)),
        skin: skin ?? demo ?? undefined,
        cape: cape ?? undefined,
        enableControls: true,
        fov: seated ? 34 : 36,
        zoom: seated ? 1.02 : 0.76,
        pixelRatio: 1,
        nameTag: seated ? undefined : name ?? undefined,
        animation: seatedAnimation,
      });
      viewer.autoRotate = !seated;
      viewer.autoRotateSpeed = 0.62;
      if (seated) viewer.playerWrapper.position.y = -5;
      observer = new ResizeObserver(() => {
        const next = frame.getBoundingClientRect();
        viewer?.setSize(Math.max(160, Math.floor(next.width)), Math.max(200, Math.floor(next.height)));
      });
      observer.observe(frame);
    }).catch(() => undefined);
    return () => {
      cancelled = true;
      observer?.disconnect();
      viewer?.dispose();
    };
  }, [skin, cape, name, pose]);

  return <div className={`skin-preview ${className}`}><canvas ref={canvasRef} aria-label={name ? `3D модель игрока ${name}` : '3D модель скина Minecraft'} /></div>;
}

function BrandGlyph() {
  return (
    <div className="brand-glyph" aria-hidden="true">
      <span className="glyph-leaf glyph-one" />
      <span className="glyph-leaf glyph-two" />
      <span className="glyph-leaf glyph-three" />
      <span className="glyph-core" />
    </div>
  );
}

function App() {
  const [activePage, setActivePage] = useState<PageId>('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [catalogType, setCatalogType] = useState<ContentType>('mod');
  const [buildsTab, setBuildsTab] = useState<BuildsTab>('profiles');
  const [launchInstanceOverride, setLaunchInstanceOverride] = useState<GameInstance | null>(null);
  const [bootstrap, setBootstrap] = useState<BootstrapState | null>(null);
  const [versions, setVersions] = useState<GameVersion[]>([]);
  const [loadingApp, setLoadingApp] = useState(true);
  const [versionsError, setVersionsError] = useState('');
  const [bootstrapError, setBootstrapError] = useState('');
  const [modal, setModal] = useState<ModalId>(null);
  const [toast, setToast] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [launcherEvent, setLauncherEvent] = useState<LauncherEvent | null>(null);
  const [performance, setPerformance] = useState<PerformanceSettings>(() => readStorage('bloom-performance', DEFAULT_PERFORMANCE));
  const [hud, setHud] = useState<HudSettings>(() => readStorage('bloom-hud', DEFAULT_HUD));
  const [memoryGb, setMemoryGb] = useState<number>(() => readStorage('bloom-memory-gb', 6));
  const [javaPath, setJavaPath] = useState<string>(() => readStorage('bloom-java-path', ''));
  const [skin, setSkin] = useState<SkinState>({ skinDataUrl: null, capeDataUrl: null, source: null });
  const [previewSkin, setPreviewSkin] = useState<string | null>(null);
  const notify = useCallback((message: string) => setToast(message), []);

  const desktop = Boolean(window.bloom && bootstrap?.desktop);
  const accounts = bootstrap?.accounts ?? [];
  const activeAccount = accounts.find((account) => account.id === bootstrap?.activeAccountId) ?? null;
  const instances = bootstrap?.instances ?? [];
  const activeInstance = instances.find((instance) => instance.id === bootstrap?.activeInstanceId) ?? instances[0] ?? null;
  const title = activePage === 'home' ? 'Главная' : activePage === 'catalog' ? (catalogType === 'mod' ? 'Моды' : 'Ресурспаки') : activePage === 'builds' ? 'Сборки' : activePage === 'playSetup' ? 'Играть' : activePage === 'hud' ? 'Визуал и производительность' : activePage === 'skins' ? 'Скин' : 'Настройки';
  const maxMemoryGb = Math.max(2, Math.min(32, Math.floor((bootstrap?.totalMemoryMb ?? 16384) / 1024) - 2));

  const refreshBootstrap = useCallback(async () => {
    if (!window.bloom) return null;
    try {
      const next = await window.bloom.getBootstrap();
      setBootstrap(next);
      setBootstrapError('');
      setJavaPath(next.javaPath);
      setMemoryGb((current) => Math.min(Math.max(2, current), Math.max(2, Math.floor(next.totalMemoryMb / 1024) - 2)));
      return next;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось подключить системные функции лаунчера.';
      setBootstrapError(message);
      throw error;
    }
  }, []);

  const loadVersions = useCallback(async () => {
    setVersionsError('');
    try {
      let next: GameVersion[];
      if (window.bloom) {
        next = await window.bloom.getMinecraftVersions();
      } else {
        const response = await fetch('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json');
        if (!response.ok) throw new Error(`Minecraft versions HTTP ${response.status}`);
        const manifest = await response.json();
        next = (manifest.versions ?? []).map((version: { id: string; type: VersionType; releaseTime: string }) => ({
          id: version.id,
          type: version.type,
          releaseTime: version.releaseTime,
        }));
      }
      setVersions(next);
    } catch (error) {
      setVersionsError(error instanceof Error ? error.message : 'Не удалось получить список версий Minecraft.');
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const start = async () => {
      const actions: Promise<unknown>[] = [loadVersions()];
      if (window.bloom) actions.push(refreshBootstrap());
      await Promise.allSettled(actions);
      if (mounted) setLoadingApp(false);
    };
    void start();
    const unsubscribe = window.bloom?.onLauncherEvent((event) => {
      setLauncherEvent(event);
      if (event.kind === 'error') notify(event.message);
      if (event.kind === 'closed') notify(event.exitCode === 0 ? 'Minecraft закрыт' : `Игра завершилась с кодом ${event.exitCode}`);
    });
    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [loadVersions, notify, refreshBootstrap]);

  useEffect(() => {
    localStorage.setItem('bloom-performance', JSON.stringify(performance));
  }, [performance]);
  useEffect(() => {
    localStorage.setItem('bloom-hud', JSON.stringify(hud));
  }, [hud]);
  useEffect(() => {
    localStorage.setItem('bloom-memory-gb', JSON.stringify(memoryGb));
  }, [memoryGb]);
  useEffect(() => {
    localStorage.setItem('bloom-java-path', JSON.stringify(javaPath));
  }, [javaPath]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3800);
    return () => window.clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!desktop || !activeAccount) {
      setSkin({ skinDataUrl: null, capeDataUrl: null, source: null });
      return;
    }
    let alive = true;
    window.bloom?.getSkin(activeAccount.id)
      .then((result) => { if (alive) setSkin(result); })
      .catch(() => { if (alive) setSkin({ skinDataUrl: null, capeDataUrl: null, source: null }); });
    return () => { alive = false; };
  }, [desktop, activeAccount?.id]);

  const changePage = (page: PageId) => {
    setActivePage(page);
    setMobileMenuOpen(false);
  };

  const openCatalog = (type: ContentType = 'mod') => {
    setCatalogType(type);
    changePage('catalog');
  };

  const openBuilds = (tab: BuildsTab = 'profiles') => {
    setBuildsTab(tab);
    changePage('builds');
  };

  const setActiveInstance = async (instanceId: string) => {
    if (!window.bloom) return;
    try {
      await window.bloom.setActiveInstance(instanceId);
      await refreshBootstrap();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Не удалось переключить профиль.');
    }
  };

  const handleCreateInstance = async (input: { name: string; version: string; loader: LoaderType }) => {
    if (!window.bloom) {
      notify('Создание профилей доступно в desktop-версии Bloom Client.');
      return;
    }
    setIsBusy(true);
    try {
      const instance = await window.bloom.createInstance(input);
      await window.bloom.setActiveInstance(instance.id);
      await refreshBootstrap();
      setModal(null);
      notify(`Профиль «${instance.name}» создан`);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Не удалось создать профиль.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleInstallModrinthPack = async (project: ModrinthProject, version: string, loader: LoaderType) => {
    if (!window.bloom) {
      notify('Установка Modrinth-сборок доступна в установленном desktop-приложении.');
      return;
    }
    setIsBusy(true);
    try {
      const instance = await window.bloom.installModrinthPack({ projectId: project.project_id, name: project.title, gameVersion: version, loader });
      await refreshBootstrap();
      setBuildsTab('profiles');
      notify(instance.missingPackFiles ? `Сборка «${instance.name}» установлена. ${instance.missingPackFiles} файл(а) нужно добавить вручную.` : `Сборка «${instance.name}» установлена в отдельный профиль.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Не удалось установить Modrinth-сборку.');
    } finally {
      setIsBusy(false);
    }
  };

  const createAndLaunch = async (input: { name: string; version: string; loader: LoaderType }) => {
    if (!window.bloom) {
      notify('Создание профилей доступно в desktop-версии Bloom Client.');
      return;
    }
    setIsBusy(true);
    try {
      const instance = await window.bloom.createInstance(input);
      await window.bloom.setActiveInstance(instance.id);
      await refreshBootstrap();
      setLaunchInstanceOverride(instance);
      if (!activeAccount) {
        setModal('auth');
        notify(`Профиль «${instance.name}» создан. Войди, чтобы запустить Minecraft.`);
        return;
      }
      setLauncherEvent({ kind: 'phase', message: `Готовим запуск профиля «${instance.name}»…` });
      setModal('launch');
      await window.bloom.launchGame({ instanceId: instance.id, memoryGb });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось создать профиль или запустить Minecraft.';
      setLauncherEvent({ kind: 'error', message });
      setModal('launch');
      notify(message);
    } finally {
      setIsBusy(false);
    }
  };

  const beginLaunch = async (requestedInstanceId?: string) => {
    if (!desktop || !window.bloom) {
      notify('Запуск и установка Minecraft работают в установленной desktop-версии.');
      return;
    }
    const targetInstance = requestedInstanceId
      ? instances.find((item) => item.id === requestedInstanceId) ?? null
      : activeInstance;
    if (!targetInstance) {
      changePage('playSetup');
      return;
    }
    setLaunchInstanceOverride(targetInstance);
    if (!activeAccount) {
      setModal('auth');
      return;
    }
    setLauncherEvent({ kind: 'phase', message: `Готовим запуск профиля «${targetInstance.name}»…` });
    setModal('launch');
    try {
      if (targetInstance.id !== activeInstance?.id) {
        await window.bloom.setActiveInstance(targetInstance.id);
        await refreshBootstrap();
      }
      await window.bloom.launchGame({ instanceId: targetInstance.id, memoryGb });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось запустить Minecraft.';
      setLauncherEvent({ kind: 'error', message });
      notify(message);
    }
  };

  const handleAccountChange = async (account: AccountSummary) => {
    if (!window.bloom) return;
    try {
      await window.bloom.setActiveAccount(account.id);
      await refreshBootstrap();
      setModal(null);
      setActivePage('home');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Не удалось выбрать аккаунт.');
      throw error;
    }
  };

  const updatePerformance = (patch: Partial<PerformanceSettings>) => setPerformance((current) => ({ ...current, ...patch }));
  const updateHud = (patch: Partial<HudSettings>) => setHud((current) => ({ ...current, ...patch }));

  const applyClientSettings = async () => {
    if (!activeInstance) {
      notify('Сначала создайте игровой профиль.');
      return;
    }
    if (!window.bloom) {
      notify('Настройки записаны только в этом preview. Применение доступно в desktop-версии.');
      return;
    }
    setIsBusy(true);
    try {
      await Promise.all([
        window.bloom.savePerformanceSettings({ instanceId: activeInstance.id, settings: performance }),
        window.bloom.saveHudSettings({ instanceId: activeInstance.id, settings: hud }),
      ]);
      notify('Производительность сохранена в options.txt, параметры HUD — в Bloom config.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Не удалось сохранить игровые настройки.');
    } finally {
      setIsBusy(false);
    }
  };

  const renderPage = () => {
    switch (activePage) {
      case 'home':
        return (
          <HomePage
            account={activeAccount}
            instance={activeInstance}
            versions={versions}
            skin={previewSkin ?? skin.skinDataUrl}
            cape={skin.capeDataUrl}
            desktop={desktop}
            onPlay={() => changePage('playSetup')}
            onOpenAuth={() => setModal('auth')}
            onOpenInstances={() => openBuilds('profiles')}
            onOpenCatalog={openCatalog}
            onOpenSettings={() => changePage('settings')}
          />
        );
      case 'builds':
        return (
          <div className="builds-route">
            <div className="builds-page-tabs"><button className={buildsTab === 'profiles' ? 'selected' : ''} type="button" onClick={() => setBuildsTab('profiles')}><Layers3 size={15} />Профили Bloom <span>{instances.length}</span></button><button className={buildsTab === 'modrinth' ? 'selected' : ''} type="button" onClick={() => setBuildsTab('modrinth')}><Blocks size={15} />Modrinth-сборки</button></div>
            {buildsTab === 'profiles' ? <InstancesPage instances={instances} activeInstance={activeInstance} versions={versions} desktop={desktop} isBusy={isBusy} onCreate={() => setModal('instance')} onSelect={setActiveInstance} onPlay={(instanceId) => void beginLaunch(instanceId)} onRefresh={refreshBootstrap} onNotify={notify} /> : <ModrinthBuildsPage versions={versions} activeInstance={activeInstance} desktop={desktop} onCreateProfile={() => setModal('instance')} onInstallPack={handleInstallModrinthPack} />}
          </div>
        );
      case 'playSetup':
        return <PlaySetupPage instances={instances} activeInstance={activeInstance} versions={versions} account={activeAccount} desktop={desktop} isBusy={isBusy} onPlay={(instanceId) => void beginLaunch(instanceId)} onCreateAndPlay={(input) => void createAndLaunch(input)} onOpenBuilds={() => openBuilds('modrinth')} onOpenSettings={() => changePage('settings')} onBack={() => changePage('home')} />;
      case 'catalog':
        return (
          <CatalogPage
            activeInstance={activeInstance}
            versions={versions}
            desktop={desktop}
            initialType={catalogType}
            onTypeChange={setCatalogType}
            onNotify={notify}
            onRefresh={refreshBootstrap}
            onCreateInstance={() => setModal('instance')}
          />
        );
      case 'hud':
        return (
          <HudPerformancePage
            activeInstance={activeInstance}
            versions={versions}
            performance={performance}
            hud={hud}
            isBusy={isBusy}
            onPerformanceChange={updatePerformance}
            onHudChange={updateHud}
            onApply={() => void applyClientSettings()}
            onOpenCatalog={() => openCatalog('mod')}
          />
        );
      case 'skins':
        return (
          <SkinsPage
            account={activeAccount}
            skin={previewSkin ?? skin.skinDataUrl}
            cape={skin.capeDataUrl}
            desktop={desktop}
            onPreview={setPreviewSkin}
            onNotify={notify}
            onSkinUploaded={(nextSkin) => { setSkin(nextSkin); setPreviewSkin(null); notify('Скин обновлён в Microsoft-профиле.'); }}
            onOpenAuth={() => setModal('auth')}
          />
        );
      case 'settings':
        return (
          <SettingsPage
            versions={versions}
            bootstrap={bootstrap}
            onOpenHud={() => changePage('hud')}
            onOpenSkins={() => changePage('skins')}
            accounts={accounts}
            activeAccount={activeAccount}
            desktop={desktop}
            memoryGb={memoryGb}
            maxMemoryGb={maxMemoryGb}
            javaPath={javaPath}
            onMemoryChange={setMemoryGb}
            onChooseJava={() => { void window.bloom?.chooseJavaExecutable().then((value) => { if (value) setJavaPath(value); }).catch((error: unknown) => notify(error instanceof Error ? error.message : 'Не удалось выбрать Java.')); }}
            onResetJava={() => { setJavaPath(''); void window.bloom?.clearJavaExecutable().catch((error: unknown) => notify(error instanceof Error ? error.message : 'Не удалось сбросить путь Java.')); }}
            onOpenAuth={() => setModal('auth')}
            onSwitchAccount={handleAccountChange}
            onRemoveAccount={async (id) => {
              if (!window.bloom) return;
              await window.bloom.removeAccount(id);
              await refreshBootstrap();
              notify('Аккаунт удалён с этого устройства.');
            }}
            onNotify={notify}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className={`client-shell ${activePage === 'home' ? 'home-shell' : ''}`}>
      <aside className={`sidebar ${mobileMenuOpen ? 'sidebar-open' : ''}`}>
        <button className="brand" type="button" onClick={() => changePage('home')} aria-label="Bloom Client, на главную">
          <BrandGlyph />
          <span className="brand-copy"><strong>bloom<span>.</span></strong><small>MINECRAFT CLIENT</small></span>
          <span className="brand-version">0.5</span>
        </button>

        <div className="nav-scroll">
          {['ИГРА', 'КОНТЕНТ', 'СИСТЕМА'].map((group) => (
            <div className="nav-group" key={group}>
              <div className="nav-label">{group}</div>
              {NAV_ITEMS.filter((item) => item.group === group).map((item) => {
                const Icon = item.icon;
                const selected = item.id === 'mods' ? activePage === 'catalog' && catalogType === 'mod'
                  : item.id === 'resourcepacks' ? activePage === 'catalog' && catalogType === 'resourcepack'
                    : item.id === 'settings' ? ['settings', 'hud', 'skins'].includes(activePage)
                      : activePage === item.id;
                const activate = () => {
                  if (item.id === 'mods') openCatalog('mod');
                  else if (item.id === 'resourcepacks') openCatalog('resourcepack');
                  else if (item.id === 'builds') openBuilds('profiles');
                  else changePage('settings');
                };
                return (
                  <button className={`nav-link ${selected ? 'nav-link-active' : ''}`} type="button" key={item.id} onClick={activate}>
                    <Icon size={17} strokeWidth={1.75} />
                    <span>{item.label}</span>
                    {(item.id === 'mods' || item.id === 'resourcepacks') && <span className="nav-live-dot" />}
                    {selected && <span className="nav-active-bar" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="sidebar-grow" />
        <div className="sidebar-tip">
          <div className="tip-icon"><Sparkles size={16} /></div>
          <div><strong>Мир — твой.</strong><span>Подбирай сборку под себя.</span></div>
          <button type="button" aria-label="О Modrinth" onClick={() => openExternal('https://modrinth.com')}><ArrowUpRight size={15} /></button>
        </div>
        <button className="sidebar-profile" type="button" onClick={() => activeAccount ? changePage('settings') : setModal('auth')}>
          <Avatar account={activeAccount} size="small" />
          <span className="sidebar-profile-copy"><strong>{activeAccount?.name ?? 'Играть как…'}</strong><small>{activeAccount ? providerLabel(activeAccount.provider) : 'Аккаунт не подключён'}</small></span>
          <ChevronDown size={15} />
        </button>
        <div className="sidebar-foot"><span className={desktop ? 'online-dot' : 'preview-dot'} />{desktop ? 'DESKTOP CLIENT' : 'BROWSER PREVIEW'}<span className="foot-divider" />{bootstrap?.platform ?? 'web'}</div>
      </aside>

      {mobileMenuOpen && <button className="mobile-backdrop" type="button" aria-label="Закрыть меню" onClick={() => setMobileMenuOpen(false)} />}
      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu-toggle" type="button" aria-label="Открыть меню" onClick={() => setMobileMenuOpen((value) => !value)}>
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <div className="crumb"><span>Bloom Client</span><ChevronRight size={14} /><strong>{title}</strong></div>
          <div className="topbar-right">
            {desktop ? (
              <span className="connection-pill"><span className="online-dot" /> BLOOM DESKTOP</span>
            ) : (
              <span className="connection-pill connection-preview"><span /> WEB PREVIEW</span>
            )}
            {activeAccount ? (
              <button className="top-account" type="button" onClick={() => changePage('settings')}>
                <Avatar account={activeAccount} size="tiny" /><span>{activeAccount.name}</span><ChevronDown size={14} />
              </button>
            ) : (
              <button className="top-login" type="button" onClick={() => setModal('auth')}><UserRound size={15} /> Войти</button>
            )}
          </div>
        </header>

        {!desktop && <div className="preview-banner"><MonitorPlay size={15} /><span>Это интерактивный preview. Авторизация, запись файлов и запуск доступны в установленном приложении.</span><button type="button" onClick={() => void openExternal('https://github.com/zxcwmd/zxc/releases/tag/v0.5.3-preview.1')}>Скачать приложение</button></div>}
        <div className="content-scroll">
          {loadingApp && <div className="loading-line"><span />Подготавливаем библиотеку Bloom…</div>}
          {versionsError && <div className="inline-warning"><CircleHelp size={16} /><span>Список версий Minecraft временно недоступен. Проверьте подключение к интернету и повторите попытку.</span><button type="button" onClick={() => void loadVersions()}>Повторить</button></div>}
          {bootstrapError && <div className="inline-warning bootstrap-warning"><CircleHelp size={16} /><span>Не удалось подключить функции лаунчера: {bootstrapError}</span><button type="button" onClick={() => void refreshBootstrap().catch(() => {})}>Повторить</button></div>}
          {renderPage()}
        </div>
      </main>

      {toast && <div className="toast"><span className="toast-check"><Check size={14} /></span>{toast}</div>}
      {modal === 'auth' && <AuthModal onClose={() => setModal(null)} onSuccess={handleAccountChange} />}
      {modal === 'instance' && <InstanceModal versions={versions} isBusy={isBusy} onClose={() => setModal(null)} onCreate={handleCreateInstance} />}
      {modal === 'launch' && <LaunchModal event={launcherEvent} instance={launchInstanceOverride ?? activeInstance} versions={versions} onClose={() => { setModal(null); setLaunchInstanceOverride(null); }} />}
    </div>
  );
}

function providerLabel(provider: AccountSummary['provider']): string {
  return provider === 'microsoft' ? 'Microsoft · Java Edition' : 'Ely.by · совместимые серверы';
}

function Avatar({ account, size = 'normal' }: { account: AccountSummary | null; size?: 'tiny' | 'small' | 'normal' }) {
  return (
    <span className={`avatar avatar-${size}`}>
      {account?.avatarUrl ? <img src={account.avatarUrl} alt="" onError={(event) => { event.currentTarget.style.display = 'none'; }} /> : <UserRound size={size === 'tiny' ? 14 : 17} />}
      {account && <i className="avatar-presence" />}
    </span>
  );
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="page-heading">
      <div><div className="eyebrow"><span />{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>
      {action && <div className="page-heading-action">{action}</div>}
    </div>
  );
}

function HomePage({
  account,
  instance,
  versions,
  skin,
  cape,
  desktop,
  onPlay,
  onOpenAuth,
  onOpenInstances,
  onOpenCatalog,
  onOpenSettings,
}: {
  account: AccountSummary | null;
  instance: GameInstance | null;
  versions: GameVersion[];
  skin: string | null;
  cape: string | null;
  desktop: boolean;
  onPlay: () => void;
  onOpenAuth: () => void;
  onOpenInstances: () => void;
  onOpenCatalog: (type: ContentType) => void;
  onOpenSettings: () => void;
}) {
  const latestRelease = versions.find((version) => version.type === 'release')?.id ?? '—';
  return (
    <div className="home-scene-page">
      <section className="home-scene-card">
        <div className="home-scene-shade" aria-hidden="true" />
        <div className="home-scene-petals" aria-hidden="true" />
        <header className="home-scene-header">
          <div className="home-scene-brand">
            <BrandGlyph /><span><strong>Bloom Client</strong><small>CHERRY GROVE EDITION</small></span>
          </div>
          <div className="home-scene-location"><span className="hero-live" /> CHERRY GROVE <i /> MAIN MENU</div>
          <button className="home-scene-account" type="button" onClick={account ? onOpenSettings : onOpenAuth}>
            <Avatar account={account} size="small" /><span><strong>{account?.name ?? 'Подключить аккаунт'}</strong><small>{account ? providerLabel(account.provider) : 'Microsoft · Ely.by'}</small></span><ChevronDown size={15} />
          </button>
        </header>

        <div className="home-scene-title"><span className="scene-overline"><Sparkles size={13} /> ТВОЁ МЕСТО В МИРЕ MINECRAFT</span><h1>Bloom <em>Client</em></h1><p>Собери своё приключение.</p></div>

        <div className="home-scene-world-chip"><span className="pulse-point" />ВИШНЁВАЯ ОПУШКА <i /> v{latestRelease}</div>
        <div className="home-scene-player"><div className="scene-player-glow" /><SkinPreview skin={skin} cape={cape} name={account?.name ?? 'Bloom Explorer'} className="home-scene-skin" pose="seated" /><div className="scene-player-caption"><span>{account ? 'ИГРОК У КОСТРА' : 'DEMO PLAYER'}</span><strong>{account?.name ?? 'Bloom Explorer'}</strong></div></div>
        <div className="home-scene-caption"><span>ТИШИНА. ТЁПЛЫЙ СВЕТ. И ЦЕЛЫЙ МИР ВПЕРЕДИ.</span><span>JAVA EDITION · {desktop ? 'DESKTOP CLIENT' : 'WEB PREVIEW'}</span></div>

        <nav className="home-round-nav" aria-label="Разделы Bloom Client">
          <button type="button" onClick={() => onOpenCatalog('mod')}><span className="round-nav-icon"><Blocks size={21} /></span><strong>Моды</strong><small>MODS</small></button>
          <button type="button" onClick={() => onOpenCatalog('resourcepack')}><span className="round-nav-icon"><Paintbrush2 size={21} /></span><strong>Ресурспаки</strong><small>TEXTURES</small></button>
          <button type="button" onClick={onOpenInstances}><span className="round-nav-icon"><Layers3 size={21} /></span><strong>Сборки</strong><small>BUILDS</small></button>
          <button type="button" onClick={onOpenSettings}><span className="round-nav-icon"><Settings2 size={21} /></span><strong>Настройки</strong><small>SETTINGS</small></button>
        </nav>

        <footer className="home-scene-footer">
          <button className="home-selected-build" type="button" onClick={onOpenInstances}><span className="selected-build-glyph"><Layers3 size={17} /></span><span><small>АКТИВНАЯ СБОРКА</small><strong>{instance?.name ?? 'Сначала выбери сборку'}</strong><em>{instance ? `${displayVersion(instance.version, versions)} · ${LOADER_LABELS[instance.loader]} · ${instance.source === 'modrinth' ? instance.missingPackFiles ? `${instance.missingPackFiles} файлов вручную` : 'Modrinth-пакет загружен' : instance.installed ? 'готова к игре' : 'установится при запуске'}` : 'Профиль Bloom или Modrinth-пакет'}</em></span><ChevronRight size={16} /></button>
          <button className="button button-primary home-play-button" type="button" onClick={onPlay}><Play size={16} fill="currentColor" /><span>Играть</span><ArrowRight size={16} /></button>
        </footer>
        {!account && <button className="home-account-hint" type="button" onClick={onOpenAuth}><LockKeyhole size={13} />Подключи Microsoft или Ely.by для запуска игры</button>}
      </section>
    </div>
  );
}

function InstancesPage({
  instances,
  activeInstance,
  versions,
  desktop,
  isBusy,
  onCreate,
  onSelect,
  onPlay,
  onRefresh,
  onNotify,
}: {
  instances: GameInstance[];
  activeInstance: GameInstance | null;
  versions: GameVersion[];
  desktop: boolean;
  isBusy: boolean;
  onCreate: () => void;
  onSelect: (id: string) => void;
  onPlay: (id: string) => void;
  onRefresh: () => Promise<BootstrapState | null>;
  onNotify: (message: string) => void;
}) {
  const [filter, setFilter] = useState('all');
  const [deletingId, setDeletingId] = useState('');
  const visibleInstances = instances.filter((instance) => filter === 'all' || instance.loader === filter);
  const removeInstance = async (instance: GameInstance) => {
    if (!window.bloom) return;
    const confirmed = window.confirm(`Удалить профиль «${instance.name}» из Bloom? Миры и игровые файлы останутся на диске.`);
    if (!confirmed) return;
    setDeletingId(instance.id);
    try {
      await window.bloom.deleteInstance(instance.id);
      await onRefresh();
      onNotify('Профиль удалён. Игровые файлы и сохранения не удалялись.');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Не удалось удалить профиль.');
    } finally {
      setDeletingId('');
    }
  };

  return (
    <div className="page">
      <PageHeading eyebrow="ТВОИ СБОРКИ" title="Мои игровые сборки" description="Профили Bloom и установленные Modrinth-сборки. У каждого — своя версия, загрузчик, контент и сохранения." action={<button className="button button-primary" type="button" onClick={onCreate} disabled={!desktop}><Plus size={16} />Новый профиль</button>} />
      <div className="instance-summary-strip"><div><span className="summary-icon"><Layers3 size={17} /></span><span><small>ПРОФИЛЕЙ</small><strong>{instances.length}</strong></span></div><div><span className="summary-icon summary-mint"><Package size={17} /></span><span><small>ИГРОВЫЕ ВЕРСИИ</small><strong>{versions.length ? `${versions.length}+` : '—'}</strong></span></div><div><span className="summary-icon summary-violet"><HardDriveDownload size={17} /></span><span><small>УСТАНОВЛЕНО</small><strong>{instances.filter((instance) => instance.installed).length}</strong></span></div><div className="versions-footnote"><Clock3 size={14} /> В каталоге доступны релизы, снапшоты, Beta и Alpha.</div></div>
      <div className="toolbar-row"><div className="filter-pills"><button className={filter === 'all' ? 'filter-active' : ''} type="button" onClick={() => setFilter('all')}>Все <span>{instances.length}</span></button>{Object.entries(LOADER_LABELS).map(([value, label]) => <button className={filter === value ? 'filter-active' : ''} key={value} type="button" onClick={() => setFilter(value)}>{label}</button>)}</div><span className="toolbar-note"><ShieldCheck size={14} /> Профили изолированы друг от друга</span></div>
      {visibleInstances.length ? (
        <div className="instance-grid">
          {visibleInstances.map((instance) => (
            <article className={`profile-card ${instance.id === activeInstance?.id ? 'profile-card-active' : ''}`} key={instance.id}>
              <div className="profile-card-art"><div className={`profile-art-orb art-${instance.loader}`} /><span className="profile-art-stamp">{instance.source === 'modrinth' ? 'MODRINTH / PACK' : `BLOOM / ${LOADER_LABELS[instance.loader].toUpperCase()}`}</span><div className="profile-art-block"><Box size={38} strokeWidth={1.15} /></div><span className={`profile-installed ${instance.installed || instance.source === 'modrinth' && !instance.missingPackFiles ? 'installed' : ''}`}><i />{instance.source === 'modrinth' ? instance.missingPackFiles ? 'Needs manual files' : 'Pack imported' : instance.installed ? 'Installed' : 'Not installed'}</span></div>
              <div className="profile-card-body"><div className="profile-card-title"><div><h3>{instance.name}</h3><p>{displayVersion(instance.version, versions)} <span>·</span> {LOADER_LABELS[instance.loader]}</p></div><button className="icon-button" aria-label={`Удалить профиль ${instance.name}`} type="button" onClick={() => void removeInstance(instance)} disabled={!desktop || deletingId === instance.id}><Trash2 size={15} /></button></div><div className="profile-card-stats"><span><Package size={14} />{instance.contentCount ?? 0} модов</span><span><Clock3 size={14} />Создан {compactDate(instance.createdAt)}</span>{Boolean(instance.missingPackFiles) && <span className="manual-files-note"><CircleHelp size={13} />Нужно добавить файлов: {instance.missingPackFiles}</span>}</div><div className="profile-card-actions"><button className={instance.id === activeInstance?.id ? 'button button-primary' : 'button button-outline'} type="button" onClick={() => onSelect(instance.id)} disabled={!desktop}>{instance.id === activeInstance?.id ? <><Check size={15} />Активный профиль</> : <>Выбрать <ArrowRight size={15} /></>}</button><button className="profile-play" type="button" aria-label={`Запустить ${instance.name}`} title={`Запустить ${instance.name}`} disabled={!desktop} onClick={() => onPlay(instance.id)}><Play size={15} fill="currentColor" /></button></div></div>
            </article>
          ))}
          <button className="profile-add-card" type="button" onClick={onCreate} disabled={!desktop}><span className="add-card-icon"><Plus size={21} /></span><strong>Новая сборка</strong><small>Любая версия. Любой путь.</small></button>
        </div>
      ) : (
        <div className="empty-library"><div className="empty-library-icon"><Layers3 size={24} /></div><h3>Сначала соберём твой профиль</h3><p>Создай изолированную установку и выбери версию из полного официального каталога Minecraft.</p><button className="button button-primary" type="button" onClick={onCreate} disabled={!desktop || isBusy}><Plus size={16} />Создать первый профиль</button></div>
      )}
      <div className="safe-data-note"><ShieldCheck size={16} /><span><strong>Сохранения в безопасности.</strong> Удаление профиля убирает только запись в лаунчере, игровые файлы автоматически не удаляются.</span></div>
      {!desktop && <div className="inline-warning"><MonitorPlay size={16} />Создание и переключение профилей записывает файлы только из установленного Electron-приложения.</div>}
    </div>
  );
}

function ModrinthBuildsPage({
  versions,
  activeInstance,
  desktop,
  onCreateProfile,
  onInstallPack,
}: {
  versions: GameVersion[];
  activeInstance: GameInstance | null;
  desktop: boolean;
  onCreateProfile: () => void;
  onInstallPack: (project: ModrinthProject, version: string, loader: LoaderType) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [version, setVersion] = useState(activeInstance?.version ?? '');
  const [loader, setLoader] = useState<LoaderType>(activeInstance?.loader ?? 'fabric');
  const [projects, setProjects] = useState<ModrinthProject[]>([]);
  const [busy, setBusy] = useState(false);
  const [installingId, setInstallingId] = useState('');
  const [error, setError] = useState('');
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    if (!version && versions.length) setVersion(activeInstance?.version ?? versions.find((item) => item.type === 'release')?.id ?? '');
  }, [activeInstance?.version, version, versions]);

  useEffect(() => {
    let alive = true;
    if (!window.bloom) {
      setProjects([]);
      setBusy(false);
      setError('');
      return () => { alive = false; };
    }
    const timer = window.setTimeout(() => {
      setBusy(true);
      setError('');
      void window.bloom?.searchModrinth({ query, type: 'modpack', version: version || undefined, loader })
        .then((next) => { if (alive) setProjects(next); })
        .catch((reason: unknown) => { if (alive) setError(reason instanceof Error ? reason.message : 'Не удалось найти сборки Modrinth.'); })
        .finally(() => { if (alive) setBusy(false); });
    }, 220);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [loader, query, refreshCount, version]);

  const install = async (project: ModrinthProject) => {
    setInstallingId(project.project_id);
    try { await onInstallPack(project, version, loader); }
    finally { setInstallingId(''); }
  };

  return (
    <div className="page modrinth-builds-page">
      <PageHeading eyebrow="MODRINTH · ГОТОВЫЕ СБОРКИ" title="Найди свой мир" description="Установи совместимую Modrinth-сборку в отдельный игровой профиль. Bloom проверит хеши файлов перед установкой." action={<button className="button button-outline" type="button" onClick={onCreateProfile} disabled={!desktop}><Plus size={15} />Пустой профиль</button>} />
      <div className="modpack-filter-panel">
        <label className="catalog-search modpack-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Название сборки или ключевые слова" /></label>
        <label className="select-filter"><span>ВЕРСИЯ</span><select value={version} onChange={(event) => setVersion(event.target.value)}><option value="">Выбери версию</option>{versions.map((item) => <option key={item.id} value={item.id}>{item.id} · {VERSION_LABELS[item.type]}</option>)}</select><ChevronDown size={13} /></label>
        <label className="select-filter"><span>ЗАГРУЗЧИК</span><select value={loader} onChange={(event) => setLoader(event.target.value as LoaderType)}>{Object.entries(LOADER_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><ChevronDown size={13} /></label>
      </div>
      {activeInstance && <div className="catalog-target"><span className="target-status" /><span>Сейчас выбран профиль <strong>{activeInstance.name}</strong></span><span className="target-version">Новая сборка создаст отдельный профиль и не изменит этот.</span></div>}
      {error && <div className="catalog-error"><CircleHelp size={17} /><span>{error}</span><button type="button" onClick={() => setRefreshCount((current) => current + 1)}>Повторить</button></div>}
      {!window.bloom ? <div className="empty-library modpack-preview-note"><div className="empty-library-icon"><Package size={22} /></div><h3>Modrinth-сборки</h3><p>Поиск и установка полного Modrinth-пакета доступны в приложении Bloom Client.</p></div> : busy ? <div className="loading-line"><span />Ищем совместимые сборки…</div> : projects.length ? (
        <div className="modpack-grid">
          {projects.map((project) => <article className="modpack-card" key={project.project_id}>
            <div className="modpack-card-heading">{project.icon_url ? <img src={project.icon_url} alt="" loading="lazy" /> : <span className="modpack-placeholder"><Layers3 size={21} /></span>}<div><strong>{project.title}</strong><small>Modrinth · {project.categories.slice(0, 2).join(' · ') || 'Сборка Minecraft'}</small></div><button className="project-external" type="button" aria-label={`Открыть ${project.title} на Modrinth`} onClick={() => void openExternal(`https://modrinth.com/modpack/${project.slug}`)}><ArrowUpRight size={15} /></button></div>
            <p>{project.description}</p>
            <div className="modpack-card-footer"><span><Download size={13} />{formatDownloads(project.downloads)} загрузок</span><button className="button button-primary small-button" type="button" disabled={!desktop || !version || Boolean(installingId)} onClick={() => void install(project)}>{installingId === project.project_id ? <><span className="button-spinner" />Собираем…</> : <><Download size={13} />Установить</>}</button></div>
          </article>)}
        </div>
      ) : <div className="empty-installed modpack-empty"><span><Layers3 size={22} /></span><strong>Сборок не найдено</strong><small>{version ? 'Попробуй другой загрузчик или поисковый запрос.' : 'Выбери версию Minecraft, чтобы увидеть совместимые сборки.'}</small></div>}
      <div className="modpack-footnote"><ShieldCheck size={14} />Сборка устанавливается в изолированный профиль. Существующие миры и профили не меняются.</div>
    </div>
  );
}

function PlaySetupPage({
  instances,
  activeInstance,
  versions,
  account,
  desktop,
  isBusy,
  onPlay,
  onCreateAndPlay,
  onOpenBuilds,
  onOpenSettings,
  onBack,
}: {
  instances: GameInstance[];
  activeInstance: GameInstance | null;
  versions: GameVersion[];
  account: AccountSummary | null;
  desktop: boolean;
  isBusy: boolean;
  onPlay: (instanceId: string) => void;
  onCreateAndPlay: (input: { name: string; version: string; loader: LoaderType }) => void;
  onOpenBuilds: () => void;
  onOpenSettings: () => void;
  onBack: () => void;
}) {
  const [mode, setMode] = useState<'saved' | 'new'>(instances.length ? 'saved' : 'new');
  const [selectedId, setSelectedId] = useState(activeInstance?.id ?? instances[0]?.id ?? '');
  const [name, setName] = useState('Моя сборка');
  const [version, setVersion] = useState(activeInstance?.version ?? '');
  const [loader, setLoader] = useState<LoaderType>(activeInstance?.loader ?? 'fabric');
  const selectedInstance = instances.find((item) => item.id === selectedId) ?? null;

  useEffect(() => {
    if (!version && versions.length) setVersion(versions.find((item) => item.type === 'release')?.id ?? versions[0].id);
  }, [version, versions]);

  const selectInstance = (instance: GameInstance) => {
    setSelectedId(instance.id);
    setVersion(instance.version);
    setLoader(instance.loader);
  };

  return (
    <div className="page play-setup-page">
      <div className="play-setup-heading"><button className="button button-quiet" type="button" onClick={onBack}><ArrowLeft size={15} />На главную</button><PageHeading eyebrow="BLOOM LAUNCH DECK" title="Что запускаем сегодня?" description="Выбери готовую сборку или создай новый профиль — версия и загрузчик будут настроены до запуска." /></div>
      <div className="play-mode-switch"><button className={mode === 'saved' ? 'selected' : ''} type="button" onClick={() => setMode('saved')}><Layers3 size={15} />Мои сборки <span>{instances.length}</span></button><button className={mode === 'new' ? 'selected' : ''} type="button" onClick={() => setMode('new')}><Plus size={15} />Новая сборка</button><button className="play-mode-modrinth" type="button" onClick={onOpenBuilds}><Blocks size={15} />Modrinth <ArrowUpRight size={13} /></button></div>
      <div className="play-setup-layout">
        <section className="play-setup-main">
          {mode === 'saved' && instances.length ? (
            <>
              <div className="setup-section-heading"><span className="setup-step-number">01</span><div><h2>Выбери сборку</h2><p>У каждого профиля своя версия, загрузчик, контент и сохранения.</p></div></div>
              <div className="setup-build-list">{instances.map((instance) => <button key={instance.id} type="button" className={`setup-build-option ${instance.id === selectedId ? 'selected' : ''}`} onClick={() => selectInstance(instance)}><span className="setup-build-icon">{instance.source === 'modrinth' ? <Blocks size={18} /> : <Layers3 size={18} />}</span><span className="setup-build-copy"><strong>{instance.name}</strong><small>{instance.source === 'modrinth' ? 'Modrinth-сборка' : 'Профиль Bloom'} · {displayVersion(instance.version, versions)} · {LOADER_LABELS[instance.loader]}</small></span><span className={`setup-build-state ${instance.installed || instance.source === 'modrinth' && !instance.missingPackFiles ? 'ready' : ''}`}><i />{instance.source === 'modrinth' ? instance.missingPackFiles ? `${instance.missingPackFiles} файлов вручную` : 'Пакет загружен' : instance.installed ? 'Готова' : 'Установит при первом запуске'}</span><span className={`setup-radio ${instance.id === selectedId ? 'checked' : ''}`} /></button>)}</div>
              {selectedInstance && <div className="setup-version-summary"><span><small>ВЕРСИЯ</small><strong>{displayVersion(selectedInstance.version, versions)}</strong></span><span><small>ЗАГРУЗЧИК</small><strong>{LOADER_LABELS[selectedInstance.loader]}{selectedInstance.loaderVersion ? ` · ${selectedInstance.loaderVersion}` : ''}</strong></span><span><small>ТИП СБОРКИ</small><strong>{selectedInstance.source === 'modrinth' ? 'Modrinth' : 'Профиль Bloom'}</strong></span></div>}
            </>
          ) : (
            <>
              <div className="setup-section-heading"><span className="setup-step-number">01</span><div><h2>Версия Minecraft</h2><p>Доступны релизы, снапшоты, Beta и Alpha из официального манифеста.</p></div></div>
              <div className="setup-version-picker"><VersionPicker versions={versions} value={version} onChange={setVersion} /></div>
              <div className="setup-section-heading setup-loader-heading"><span className="setup-step-number">02</span><div><h2>Загрузчик</h2><p>Выбирай подходящий для модов или оставь чистую Vanilla.</p></div></div>
              <div className="setup-loader-grid">{Object.entries(LOADER_LABELS).map(([key, label]) => <button className={`setup-loader-option ${loader === key ? 'selected' : ''}`} type="button" key={key} onClick={() => setLoader(key as LoaderType)}><span className={`loader-mark loader-${key}`}>{key === 'vanilla' ? 'V' : key.slice(0, 1).toUpperCase()}</span><span><strong>{label}</strong><small>{key === 'vanilla' ? 'Без мод-загрузчика' : 'Совместимые моды'}</small></span>{loader === key && <Check size={15} />}</button>)}</div>
              <label className="setup-name-label">03 · Название новой сборки<input className="text-input" value={name} maxLength={36} onChange={(event) => setName(event.target.value)} placeholder="Например, Cherry SMP" /></label>
            </>
          )}
          {!instances.length && mode === 'saved' && <div className="empty-installed modpack-empty"><span><Layers3 size={22} /></span><strong>Пока нет готовых сборок</strong><small>Создай профиль или выбери готовый Modrinth-пакет.</small><button className="button button-outline" type="button" onClick={() => setMode('new')}><Plus size={14} />Создать первую</button></div>}
        </section>
        <aside className="play-setup-aside">
          <div className="setup-campfire-mark"><span>✦</span><i /><i /><i /></div>
          <span className="section-label">ПЕРЕД СТАРТОМ</span>
          <h2>{mode === 'new' ? 'Собери новый мир' : selectedInstance?.name ?? 'Выбери профиль'}</h2>
          <p>{mode === 'new' ? 'Bloom создаст изолированный профиль с выбранными параметрами, не затрагивая другие миры.' : selectedInstance ? 'Версия и загрузчик закреплены за выбранной сборкой.' : 'Выбери профиль слева или создай новый.'}</p>
          <div className="setup-summary-lines"><div><span>Версия</span><strong>{mode === 'new' ? displayVersion(version, versions) : selectedInstance ? displayVersion(selectedInstance.version, versions) : '—'}</strong></div><div><span>Загрузчик</span><strong>{mode === 'new' ? LOADER_LABELS[loader] : selectedInstance ? LOADER_LABELS[selectedInstance.loader] : '—'}</strong></div><div><span>Аккаунт</span><strong>{account ? account.name : 'Нужно войти'}</strong></div></div>
          {!account && <button className="setup-account-link" type="button" onClick={onOpenSettings}><LockKeyhole size={14} />Войти через Microsoft / Ely.by</button>}
          {mode === 'new' ? <button className="button button-primary setup-launch-button" type="button" disabled={!desktop || isBusy || !version || !name.trim()} onClick={() => onCreateAndPlay({ name: name.trim(), version, loader })}>{isBusy ? <><span className="button-spinner" />Создаём профиль…</> : <><Play size={16} fill="currentColor" />Создать и играть<ArrowRight size={15} /></>}</button> : <button className="button button-primary setup-launch-button" type="button" disabled={!desktop || !selectedInstance || isBusy} onClick={() => selectedInstance && onPlay(selectedInstance.id)}>{isBusy ? <><span className="button-spinner" />Готовим запуск…</> : <><Play size={16} fill="currentColor" />Играть<ArrowRight size={15} /></>}</button>}
          {!desktop && <small className="setup-desktop-note">Создание и запуск доступны в установленной Windows-версии Bloom.</small>}
          <button className="setup-browse-packs" type="button" onClick={onOpenBuilds}><Blocks size={15} /><span><strong>Хочешь готовую сборку?</strong><small>Открыть каталог Modrinth</small></span><ChevronRight size={15} /></button>
        </aside>
      </div>
    </div>
  );
}

function VersionPicker({ versions, value, onChange }: { versions: GameVersion[]; value: string; onChange: (version: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [type, setType] = useState<VersionFilter>('release');
  const filtered = useMemo(() => versions.filter((version) => {
    const matchesType = type === 'all' || version.type === type;
    const matchesQuery = version.id.toLowerCase().includes(query.toLowerCase());
    return matchesType && matchesQuery;
  }).slice(0, 120), [versions, type, query]);
  const selected = versions.find((version) => version.id === value);
  return (
    <div className="version-picker">
      <button className="version-picker-trigger" type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open}><span><small>ВЕРСИЯ MINECRAFT</small><strong>{value || 'Выберите версию'}</strong></span><ChevronDown size={17} /></button>
      {open && <div className="version-picker-popover"><label className="version-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти 1.8.9, 1.21.4…" autoFocus /></label><div className="version-filters">{(['release', 'snapshot', 'old_beta', 'old_alpha', 'all'] as VersionFilter[]).map((item) => <button key={item} className={type === item ? 'selected' : ''} type="button" onClick={() => setType(item)}>{item === 'all' ? 'Все' : VERSION_LABELS[item]}</button>)}</div><div className="version-picker-list">{filtered.map((version) => <button type="button" key={version.id} className={version.id === value ? 'selected-version' : ''} onClick={() => { onChange(version.id); setOpen(false); setQuery(''); }}><span>{version.id}</span><small>{VERSION_LABELS[version.type]} · {compactDate(version.releaseTime)}</small>{version.id === value && <Check size={14} />}</button>)}{!filtered.length && <div className="empty-search">Нет совпадений по фильтру.</div>}</div><div className="version-picker-footer"><span>{versions.length.toLocaleString('ru-RU')} версий в официальном манифесте</span>{selected && <span>Выбрано {VERSION_LABELS[selected.type]}</span>}</div></div>}
    </div>
  );
}

function InstanceModal({ versions, isBusy, onClose, onCreate }: { versions: GameVersion[]; isBusy: boolean; onClose: () => void; onCreate: (input: { name: string; version: string; loader: LoaderType }) => Promise<void> }) {
  const firstRelease = versions.find((version) => version.type === 'release')?.id ?? '';
  const [name, setName] = useState('Мой мир');
  const [version, setVersion] = useState(firstRelease);
  const [loader, setLoader] = useState<LoaderType>('fabric');
  useEffect(() => { if (!version && firstRelease) setVersion(firstRelease); }, [firstRelease, version]);
  const create = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !version) return;
    void onCreate({ name: name.trim(), version, loader });
  };
  return (
    <Modal onClose={onClose} size="large">
      <form onSubmit={create}>
        <div className="modal-heading"><div className="modal-icon mint-icon"><Layers3 size={18} /></div><div><span className="eyebrow"><span />НОВЫЙ ПРОФИЛЬ</span><h2>Собери свою игру</h2><p>Чистая отдельная установка — настройки и миры не смешиваются.</p></div><button className="modal-close" type="button" aria-label="Закрыть" onClick={onClose}><X size={18} /></button></div>
        <label className="field-label">Название профиля<input className="text-input" maxLength={36} value={name} onChange={(event) => setName(event.target.value)} placeholder="Например, Fabric PvP" autoFocus /></label>
        <div className="field-label">Версия игры<VersionPicker versions={versions} value={version} onChange={setVersion} />{!versions.length && <small className="field-hint">Загружаем официальный каталог Minecraft…</small>}</div>
        <div className="field-label">Загрузчик модов<span className="field-hint">Можно менять отдельно для каждого профиля.</span></div>
        <div className="loader-choices">{(['vanilla', 'fabric', 'quilt', 'forge', 'neoforge'] as LoaderType[]).map((item) => <button className={loader === item ? 'loader-choice selected' : 'loader-choice'} key={item} type="button" onClick={() => setLoader(item)}><span className={`loader-gem gem-${item}`}><Blocks size={17} /></span><span><strong>{LOADER_LABELS[item]}</strong><small>{item === 'vanilla' ? 'Оригинальная игра' : item === 'fabric' ? 'Быстрый и лёгкий' : item === 'quilt' ? 'Гибкий community loader' : item === 'forge' ? 'Большая экосистема модов' : 'Современный Forge fork'}</small></span>{loader === item && <Check size={16} />}</button>)}</div>
        <div className="modal-info"><ShieldCheck size={16} /><span>Игру, подходящую Java Runtime и загрузчик Bloom установит автоматически при первом запуске.</span></div>
        <div className="modal-actions"><button className="button button-quiet" type="button" onClick={onClose}>Отмена</button><button className="button button-primary" type="submit" disabled={isBusy || !version || !name.trim()}>{isBusy ? <><span className="button-spinner" />Создаём…</> : <><Plus size={16} />Создать профиль</>}</button></div>
      </form>
    </Modal>
  );
}

function CatalogPage({
  activeInstance,
  versions,
  desktop,
  initialType,
  onTypeChange,
  onNotify,
  onRefresh,
  onCreateInstance,
}: {
  activeInstance: GameInstance | null;
  versions: GameVersion[];
  desktop: boolean;
  initialType: ContentType;
  onTypeChange: (type: ContentType) => void;
  onNotify: (message: string) => void;
  onRefresh: () => Promise<BootstrapState | null>;
  onCreateInstance: () => void;
}) {
  const [type, setType] = useState<ContentType>(initialType);
  const [tab, setTab] = useState<'discover' | 'installed'>('discover');
  const [query, setQuery] = useState('');
  const [version, setVersion] = useState(activeInstance?.version ?? versions.find((item) => item.type === 'release')?.id ?? '');
  const [loader, setLoader] = useState<LoaderType | 'all'>(activeInstance?.loader ?? 'all');
  const [category, setCategory] = useState('all');
  const [projects, setProjects] = useState<ModrinthProject[]>([]);
  const [installed, setInstalled] = useState<Awaited<ReturnType<NonNullable<typeof window.bloom>['getInstalledContent']>>>([]);
  const [busy, setBusy] = useState(false);
  const [installingId, setInstallingId] = useState('');
  const [searchError, setSearchError] = useState('');

  useEffect(() => {
    if (!version) setVersion(activeInstance?.version ?? versions.find((item) => item.type === 'release')?.id ?? '');
    if (activeInstance) setLoader(activeInstance.loader);
  }, [activeInstance?.id, activeInstance?.version, activeInstance?.loader, versions, version]);

  const performSearch = useCallback(async () => {
    setBusy(true);
    setSearchError('');
    try {
      if (window.bloom) {
        const result = await window.bloom.searchModrinth({ query, type, version, loader, category });
        setProjects(result);
      } else {
        const facets = [[`project_type:${type}`]];
        if (version) facets.push([`versions:${version}`]);
        if (type === 'mod' && loader !== 'all' && loader !== 'vanilla') facets.push([`categories:${loader}`]);
        if (category !== 'all') facets.push([`categories:${category}`]);
        const params = new URLSearchParams({ query, facets: JSON.stringify(facets), index: 'relevance', limit: '24' });
        const response = await fetch(`https://api.modrinth.com/v2/search?${params}`);
        if (!response.ok) throw new Error(`Modrinth HTTP ${response.status}`);
        const data = await response.json();
        setProjects((data.hits ?? []).map((entry: Record<string, unknown>) => ({
          project_id: String(entry.project_id), slug: String(entry.slug), title: String(entry.title), description: String(entry.description),
          icon_url: typeof entry.icon_url === 'string' ? entry.icon_url : null, downloads: Number(entry.downloads), follows: Number(entry.follows),
          categories: Array.isArray(entry.categories) ? entry.categories.map(String) : [], latest_version: String(entry.latest_version), project_type: String(entry.project_type),
        })));
      }
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : 'Не удалось загрузить Modrinth.');
    } finally {
      setBusy(false);
    }
  }, [query, type, version, loader, category]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void performSearch(); }, 250);
    return () => window.clearTimeout(timer);
  }, [performSearch]);

  const loadInstalled = useCallback(async () => {
    if (!window.bloom || !activeInstance) { setInstalled([]); return; }
    try { setInstalled(await window.bloom.getInstalledContent({ instanceId: activeInstance.id, type })); }
    catch (error) { onNotify(error instanceof Error ? error.message : 'Не удалось прочитать файлы профиля.'); }
  }, [activeInstance?.id, type, onNotify]);
  useEffect(() => { void loadInstalled(); }, [loadInstalled]);

  const installProject = async (project: ModrinthProject) => {
    if (!window.bloom || !activeInstance) {
      onNotify(!activeInstance ? 'Сначала создайте профиль Minecraft.' : 'Установка доступна в desktop-версии.');
      return;
    }
    if (type === 'mod' && activeInstance.loader === 'vanilla') {
      onNotify('Профиль Vanilla не поддерживает моды. Выберите или создайте профиль с Fabric, Quilt, Forge либо NeoForge.');
      return;
    }
    setInstallingId(project.project_id);
    try {
      const result = await window.bloom.installModrinth({ projectId: project.project_id, instanceId: activeInstance.id, type });
      await loadInstalled();
      await onRefresh();
      onNotify(`Добавлено файлов: ${result.installed.length} · ${project.title}`);
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Не удалось установить проект.');
    } finally {
      setInstallingId('');
    }
  };

  const importLocal = async () => {
    if (!window.bloom || !activeInstance) { onNotify('Сначала создайте профиль в desktop-приложении.'); return; }
    try {
      const result = await window.bloom.importLocalContent({ instanceId: activeInstance.id, type });
      if (result.imported.length) {
        await loadInstalled();
        await onRefresh();
        onNotify(`Импортировано: ${result.imported.length}`);
      }
    } catch (error) { onNotify(error instanceof Error ? error.message : 'Не удалось импортировать файл.'); }
  };

  const removeFile = async (fileName: string) => {
    if (!window.bloom || !activeInstance) return;
    try {
      await window.bloom.removeInstalledContent({ instanceId: activeInstance.id, type, fileName });
      await loadInstalled();
      await onRefresh();
      onNotify(`${fileName} удалён из профиля`);
    } catch (error) { onNotify(error instanceof Error ? error.message : 'Не удалось удалить файл.'); }
  };

  return (
    <div className="page page-catalog">
      <PageHeading eyebrow="DISCOVER / MODRINTH" title="Каталог контента" description="Находи моды и ресурспаки по версии игры. Установка идёт сразу в выбранный профиль." action={<button className="button button-outline" type="button" onClick={() => void importLocal()} disabled={!desktop || !activeInstance}><Upload size={15} />Импорт файла</button>} />
      <div className="catalog-source"><div className="source-logo">M</div><div><strong>Modrinth</strong><span>Открытый каталог · более 30 000 проектов</span></div><div className="source-secure"><ShieldCheck size={15} />Проверка хеша при загрузке</div><button type="button" aria-label="Открыть Modrinth" onClick={() => openExternal('https://modrinth.com')}><ExternalLink size={15} /></button></div>
      <div className="catalog-controls">
        <div className="catalog-tabs"><button className={type === 'mod' ? 'catalog-tab active' : 'catalog-tab'} type="button" onClick={() => { setType('mod'); onTypeChange('mod'); setTab('discover'); }}><Blocks size={15} />Моды</button><button className={type === 'resourcepack' ? 'catalog-tab active' : 'catalog-tab'} type="button" onClick={() => { setType('resourcepack'); onTypeChange('resourcepack'); setTab('discover'); }}><Paintbrush2 size={15} />Ресурспаки</button></div>
        <div className="catalog-tab-right"><button className={tab === 'discover' ? 'text-tab selected' : 'text-tab'} type="button" onClick={() => setTab('discover')}>Открыть каталог</button><button className={tab === 'installed' ? 'text-tab selected' : 'text-tab'} type="button" onClick={() => setTab('installed')}>Установлено <span>{installed.length}</span></button></div>
      </div>
      {tab === 'discover' ? (
        <>
          <div className="catalog-filter-bar">
            <label className="catalog-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={type === 'mod' ? 'Поиск модов и функций…' : 'Поиск ресурс-паков…'} /><kbd>↵</kbd></label>
            <label className="select-filter"><span>ВЕРСИЯ</span><select value={version} onChange={(event) => setVersion(event.target.value)}><option value="">Все версии</option>{versions.map((item) => <option key={item.id} value={item.id}>{item.id} · {VERSION_LABELS[item.type]}</option>)}</select><ChevronDown size={13} /></label>
            {type === 'mod' && <label className="select-filter"><span>ЗАГРУЗЧИК</span><select value={loader} onChange={(event) => setLoader(event.target.value as LoaderType | 'all')}><option value="all">Любой</option>{Object.entries(LOADER_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><ChevronDown size={13} /></label>}
            <label className="select-filter category-filter"><span>КАТЕГОРИЯ</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">Все категории</option><option value="performance">Производительность</option><option value="optimization">Оптимизация</option><option value="utility">Утилиты</option><option value="decoration">Декор</option><option value="adventure">Приключения</option><option value="technology">Технологии</option></select><ChevronDown size={13} /></label>
          </div>
          {activeInstance ? <div className="catalog-target"><span className="target-status" /><span>Установка в профиль <strong>{activeInstance.name}</strong></span><span className="target-version">{displayVersion(activeInstance.version, versions)} · {LOADER_LABELS[activeInstance.loader]}</span></div> : <div className="catalog-target catalog-target-empty"><span className="target-status" /><span>Сначала создай профиль — затем можно будет устанавливать файлы в игру.</span><button type="button" onClick={onCreateInstance}>Создать профиль <ArrowRight size={13} /></button></div>}
          {searchError && <div className="catalog-error"><CircleHelp size={17} /><span>{searchError}</span><button type="button" onClick={() => void performSearch()}>Повторить</button></div>}
          {busy && <div className="catalog-loading"><span className="loading-spinner" />Ищем подходящие проекты…</div>}
          {!busy && !searchError && projects.length === 0 && <div className="empty-search-panel"><Search size={23} /><strong>Ничего не нашлось</strong><span>Проверь запрос или попробуй снять фильтр по категории.</span></div>}
          <div className="project-grid">
            {projects.map((project) => (
              <article className="project-card" key={project.project_id}>
                <div className="project-card-top"><button className="project-icon" type="button" onClick={() => openExternal(`https://modrinth.com/${type === 'mod' ? 'mod' : 'resourcepack'}/${project.slug}`)}>{project.icon_url ? <img src={project.icon_url} alt="" loading="lazy" /> : <Package size={21} />}</button><div className="project-meta"><strong>{project.title}</strong><span>Modrinth <i>·</i> {project.categories[0] ?? (type === 'mod' ? 'Мод' : 'Ресурспак')}</span></div><button className="project-external" type="button" aria-label={`Открыть ${project.title} на Modrinth`} onClick={() => openExternal(`https://modrinth.com/${type === 'mod' ? 'mod' : 'resourcepack'}/${project.slug}`)}><ArrowUpRight size={15} /></button></div>
                <p>{project.description}</p>
                <div className="project-tags">{project.categories.slice(0, 3).map((tag) => <span key={tag}>{tag.replace(/-/g, ' ')}</span>)}</div>
                <div className="project-card-bottom"><span><Download size={14} />{formatDownloads(project.downloads)} загрузок</span><button className="install-project-button" type="button" disabled={!desktop || installingId === project.project_id || busy} onClick={() => void installProject(project)}>{installingId === project.project_id ? <><span className="button-spinner" />Ставим…</> : <><Plus size={14} />Добавить</>}</button></div>
              </article>
            ))}
          </div>
          <div className="catalog-attribution"><ShieldCheck size={14} />Проекты загружаются из Modrinth. Bloom не меняет файлы, кроме выбранной установки.</div>
        </>
      ) : (
        <div className="installed-panel">
          <div className="installed-panel-heading"><div><h2>{type === 'mod' ? 'Файлы модов' : 'Ресурспаки'} в профиле</h2><p>{activeInstance ? `Папка профиля «${activeInstance.name}»` : 'Выбери или создай профиль Minecraft.'}</p></div><button className="button button-outline" type="button" disabled={!desktop || !activeInstance} onClick={() => void importLocal()}><Upload size={15} />Импортировать локально</button></div>
          {!installed.length ? <div className="empty-installed"><div><FileArchive size={22} /></div><strong>Пока пусто</strong><span>Добавь проекты из каталога или импортируй локальный {type === 'mod' ? '.jar' : '.zip'} файл.</span></div> : <div className="installed-list">{installed.map((file) => <div className="installed-row" key={file.name}><span className="installed-file-icon">{type === 'mod' ? <FileCode2 size={17} /> : <FileArchive size={17} />}</span><span className="installed-file-name"><strong>{file.name}</strong><small>{formatSize(file.size)} · добавлен {compactDate(file.modifiedAt)}</small></span><span className="installed-type">{type === 'mod' ? '.JAR' : '.ZIP'}</span><button className="icon-button icon-danger" type="button" disabled={!desktop} onClick={() => void removeFile(file.name)} aria-label={`Удалить ${file.name}`}><Trash2 size={15} /></button></div>)}</div>}
        </div>
      )}
    </div>
  );
}

function HudPerformancePage({
  activeInstance,
  versions,
  performance,
  hud,
  isBusy,
  onPerformanceChange,
  onHudChange,
  onApply,
  onOpenCatalog,
}: {
  activeInstance: GameInstance | null;
  versions: GameVersion[];
  performance: PerformanceSettings;
  hud: HudSettings;
  isBusy: boolean;
  onPerformanceChange: (patch: Partial<PerformanceSettings>) => void;
  onHudChange: (patch: Partial<HudSettings>) => void;
  onApply: () => void;
  onOpenCatalog: () => void;
}) {
  const [tab, setTab] = useState<'hud' | 'performance'>('hud');
  return (
    <div className="page">
      <PageHeading eyebrow="PERSONAL SETUP" title="Визуал и производительность" description="Собери чистый HUD для PvP и настроь игровой профиль под свой компьютер." action={<button className="button button-primary" type="button" onClick={onApply} disabled={isBusy}><Check size={15} />{isBusy ? 'Сохраняем…' : 'Применить к профилю'}</button>} />
      <div className="settings-target-bar"><div className="target-profile-glyph"><Gauge size={18} /></div><div><small>ПАРАМЕТРЫ ПРИМЕНЯЮТСЯ К</small><strong>{activeInstance ? `${activeInstance.name} · ${displayVersion(activeInstance.version, versions)}` : 'Игровой профиль не выбран'}</strong></div><span className="target-loader">{activeInstance ? LOADER_LABELS[activeInstance.loader] : 'Создай профиль'}</span></div>
      <div className="settings-tabs"><button type="button" className={tab === 'hud' ? 'active' : ''} onClick={() => setTab('hud')}><Eye size={16} />HUD / PvP</button><button type="button" className={tab === 'performance' ? 'active' : ''} onClick={() => setTab('performance')}><Zap size={16} />Производительность</button></div>
      {tab === 'hud' ? (
        <div className="hud-layout">
          <section className="settings-card hud-options-card"><div className="settings-card-heading"><div><span className="section-label">ИНФОРМАЦИЯ НА ЭКРАНЕ</span><h2>Твой игровой HUD</h2><p>Только полезные оверлеи — без подсветки игроков сквозь стены и чит-функций.</p></div><span className="settings-heading-icon hud-icon"><Eye size={18} /></span></div><div className="hud-option-grid">{[
            ['keystrokes', 'Клавиши', 'Показывать WASD и нажатия'], ['cps', 'CPS', 'Счётчик кликов мыши'], ['armor', 'Броня', 'Индикатор прочности'], ['potions', 'Эффекты', 'Активные зелья и таймеры'], ['coordinates', 'Координаты', 'XYZ игрока'], ['ping', 'Пинг', 'Задержка соединения'], ['clock', 'Игровое время', 'Время мира'], ['crosshair', 'Прицел', 'Настройка размера и цвета'],
          ].map(([key, label, description]) => <SettingToggle key={key} title={label} description={description} checked={hud[key as keyof HudSettings] as boolean} onChange={(checked) => onHudChange({ [key]: checked } as Partial<HudSettings>)} />)}</div><div className="hud-config-controls"><label>МАСШТАБ HUD <strong>{hud.scale.toFixed(2)}×</strong><input type="range" min="0.65" max="1.5" step="0.05" value={hud.scale} onChange={(event) => onHudChange({ scale: Number(event.target.value) })} /></label><label>ПРОЗРАЧНОСТЬ <strong>{Math.round(hud.opacity * 100)}%</strong><input type="range" min="0.25" max="1" step="0.05" value={hud.opacity} onChange={(event) => onHudChange({ opacity: Number(event.target.value) })} /></label><div className="color-setting"><span>ЦВЕТ АКЦЕНТА</span><div>{(['mint', 'violet', 'ice'] as HudSettings['accent'][]).map((accent) => <button key={accent} className={`accent-swatch accent-${accent} ${hud.accent === accent ? 'swatch-selected' : ''}`} type="button" aria-label={accent} onClick={() => onHudChange({ accent })} />)}</div></div></div></section>
          <aside className="hud-preview-card"><div className="preview-card-top"><span>HUD PREVIEW</span><span className="preview-live"><i />LIVE</span></div><div className="hud-game-screen"><div className="fake-sky"><div className="pixel-sun" /><div className="pixel-cloud cloud-a" /><div className="pixel-cloud cloud-b" /><div className="pixel-hill hill-back" /><div className="pixel-hill hill-front" /></div><div className="mock-keystrokes"><span className="key-spacer" /><kbd>W</kbd><kbd>{hud.cps ? `L ${hud.cps ? 8 : 0}` : 'A'}</kbd><kbd>S</kbd><kbd>D</kbd></div>{hud.coordinates && <span className="mock-coords">XYZ 128 · 64 · -240</span>}{hud.ping && <span className="mock-ping">32 ms</span>}{hud.crosshair && <span className="mock-crosshair">+</span>}<div className="mock-hotbar"><span>⛏</span><span>▧</span><span>▧</span><span className="hotbar-active">▣</span><span>◌</span><span>◌</span><span>◌</span><span>◌</span><span>▧</span></div></div><div className="preview-card-foot"><span><SlidersHorizontal size={13} />Макет интерфейса</span><span>1.8 — 1.21+</span></div><div className="hud-preview-disclaimer"><ShieldCheck size={14} />Настройки сохраняются в Bloom config. Для показа HUD в игре нужен совместимый клиентский мод.</div></aside>
        </div>
      ) : (
        <div className="performance-layout">
          <section className="settings-card performance-controls"><div className="settings-card-heading"><div><span className="section-label">FPS TUNING</span><h2>Лёгкая и плавная игра</h2><p>Значения записываются в options.txt выбранного профиля и читаются Minecraft при запуске.</p></div><span className="settings-heading-icon performance-icon"><Zap size={18} /></span></div><div className="slider-setting"><div><span>Дальность прорисовки</span><strong>{performance.renderDistance} чанков</strong></div><input type="range" min="2" max="32" value={performance.renderDistance} onChange={(event) => onPerformanceChange({ renderDistance: Number(event.target.value) })} /><small>Меньше чанков — выше частота кадров.</small></div><div className="slider-setting"><div><span>Дальность симуляции</span><strong>{performance.simulationDistance} чанков</strong></div><input type="range" min="5" max="16" value={performance.simulationDistance} onChange={(event) => onPerformanceChange({ simulationDistance: Number(event.target.value) })} /><small>Влияет на активность мобов и механизмов.</small></div><div className="slider-setting"><div><span>Лимит FPS</span><strong>{performance.maxFps >= 260 ? 'Без лимита' : `${performance.maxFps} FPS`}</strong></div><input type="range" min="30" max="260" step="10" value={performance.maxFps} onChange={(event) => onPerformanceChange({ maxFps: Number(event.target.value) })} /><small>Плавность против энергопотребления.</small></div><div className="performance-select-grid"><label className="field-label">Графика<select className="text-input" value={performance.graphics} onChange={(event) => onPerformanceChange({ graphics: event.target.value as PerformanceSettings['graphics'] })}><option value="fast">Быстрая</option><option value="fancy">Красивая</option></select></label><label className="field-label">Облака<select className="text-input" value={performance.clouds} onChange={(event) => onPerformanceChange({ clouds: event.target.value as PerformanceSettings['clouds'] })}><option value="off">Выключены</option><option value="fast">Быстрые</option><option value="fancy">Детальные</option></select></label><label className="field-label">Частицы<select className="text-input" value={performance.particles} onChange={(event) => onPerformanceChange({ particles: event.target.value as PerformanceSettings['particles'] })}><option value="minimal">Минимум</option><option value="decreased">Уменьшены</option><option value="all">Все</option></select></label><label className="field-label">Mipmap<select className="text-input" value={performance.mipmapLevels} onChange={(event) => onPerformanceChange({ mipmapLevels: Number(event.target.value) })}><option value="0">0 · чёткая картинка</option><option value="2">2</option><option value="4">4 · сглаживание</option></select></label></div><div className="hud-option-grid performance-toggles"><SettingToggle title="Вертикальная синхронизация" description="Синхронизировать FPS с монитором" checked={performance.vsync} onChange={(checked) => onPerformanceChange({ vsync: checked })} /><SettingToggle title="Тени сущностей" description="Упростить обработку теней" checked={performance.entityShadows} onChange={(checked) => onPerformanceChange({ entityShadows: checked })} /></div></section>
          <aside className="performance-aside"><div className="performance-score"><div className="score-orbit"><Gauge size={25} /></div><span>ПРОФИЛЬ ПРОИЗВОДИТЕЛЬНОСТИ</span><strong>Bloom <em>Light</em></strong><p>Настройка игры без замены оригинальных файлов и вмешательства в онлайн-сессии.</p><div className="score-stats"><div><small>RENDER</small><strong>{performance.renderDistance} chunks</strong></div><div><small>FPS CAP</small><strong>{performance.maxFps}</strong></div></div></div><div className="mod-recommendation"><div className="recommend-icon"><Cpu size={17} /></div><strong>Больше FPS с Sodium</strong><p>Найди совместимые оптимизационные моды в Modrinth и добавь их к Fabric-профилю.</p><button type="button" onClick={onOpenCatalog}>Открыть каталог <ArrowRight size={14} /></button></div><div className="performance-safe"><ShieldCheck size={15} />Настройки применятся при следующем запуске Minecraft.</div></aside>
        </div>
      )}
      <div className="bottom-callout"><div className="callout-icon"><Activity size={16} /></div><span><strong>{tab === 'hud' ? 'Честный HUD.' : 'Чистые настройки.'}</strong> Bloom не меняет механики боя, не подсвечивает игроков через блоки и не вмешивается в правила серверов.</span></div>
    </div>
  );
}

function SettingToggle({ title, description, checked, onChange }: { title: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className="setting-toggle-row"><div><strong>{title}</strong><small>{description}</small></div><button className={`toggle ${checked ? 'toggle-on' : ''}`} type="button" role="switch" aria-checked={checked} aria-label={title} onClick={() => onChange(!checked)}><span /></button></div>
  );
}

function SkinsPage({
  account,
  skin,
  cape,
  desktop,
  onPreview,
  onNotify,
  onSkinUploaded,
  onOpenAuth,
}: {
  account: AccountSummary | null;
  skin: string | null;
  cape: string | null;
  desktop: boolean;
  onPreview: (skin: string | null) => void;
  onNotify: (message: string) => void;
  onSkinUploaded: (skin: SkinState) => void;
  onOpenAuth: () => void;
}) {
  const [variant, setVariant] = useState<'classic' | 'slim'>('classic');
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const onLocalSkin = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';
    if (!file.type.includes('png') || file.size > 2 * 1024 * 1024) { onNotify('Выберите PNG-файл размером до 2 МБ.'); return; }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Файл не прочитан'));
      reader.onerror = () => reject(new Error('Не удалось прочитать скин.'));
      reader.readAsDataURL(file);
    }).catch((error: unknown) => { onNotify(error instanceof Error ? error.message : 'Не удалось прочитать файл.'); return ''; });
    if (!dataUrl) return;
    const image = new Image();
    image.onload = () => {
      if (!(image.width === 64 && (image.height === 64 || image.height === 32))) {
        onNotify('Размер скина должен быть 64×64 или 64×32 пикселя.');
      } else {
        onPreview(dataUrl);
        onNotify('Локальный скин открыт в 3D preview.');
      }
    };
    image.onerror = () => onNotify('PNG-файл скина повреждён.');
    image.src = dataUrl;
  };

  const upload = async () => {
    if (!window.bloom || !account || account.provider !== 'microsoft') return;
    setUploading(true);
    try {
      const result = await window.bloom.uploadMicrosoftSkin(variant);
      if (result) onSkinUploaded(result);
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Не удалось загрузить скин в Microsoft-профиль.');
    } finally { setUploading(false); }
  };

  return (
    <div className="page">
      <PageHeading eyebrow="APPEARANCE / PLAYER" title="Твой образ" description="Посмотри на скин в 3D, проверь плащ и загрузи выбранный образ в Microsoft-профиль." action={<label className="button button-outline upload-label"><Upload size={15} />Загрузить PNG в preview<input ref={fileInput} type="file" accept="image/png,.png" onChange={(event) => void onLocalSkin(event)} /></label>} />
      <div className="skin-layout">
        <section className="skin-stage-card"><div className="skin-stage-top"><span><span className="skin-stage-dot" />{account ? 'PLAYER MODEL' : 'BLOOM MODEL'}</span><div>{skin ? <BadgeCheck size={14} /> : <Sparkles size={14} />}<small>{account ? providerLabel(account.provider) : 'Демо-образ'}</small></div></div><div className="skin-stage"><div className="skin-stage-grid" /><div className="skin-stage-ring ring-big" /><div className="skin-stage-ring ring-small" /><SkinPreview skin={skin} cape={cape} name={account?.name ?? 'Bloom'} className="large-skin-preview" /><div className="skin-stage-id"><span>SKIN / 01</span><strong>{account?.name ?? 'Bloom Explorer'}</strong><small>{variant === 'slim' ? 'SLIM MODEL' : 'CLASSIC MODEL'} · JAVA EDITION</small></div></div><div className="skin-stage-bottom"><span><span className="skin-dot-mint" />Зажми мышь, чтобы вращать</span><button type="button" onClick={() => onPreview(null)}><ArrowLeft size={13} />Сбросить preview</button></div></section>
        <aside className="skin-tools"><div className="settings-card skin-account-card"><span className="section-label">MINECRAFT ACCOUNT</span>{account ? <><div className="skin-account"><Avatar account={account} /><div><strong>{account.name}</strong><small>{providerLabel(account.provider)}</small></div><span className="account-verified"><Check size={13} /></span></div><div className="skin-auth-note"><ShieldCheck size={15} />Аккаунт авторизован. Bloom не сохраняет пароль Ely.by и шифрует игровые токены средствами ОС.</div></> : <><div className="skin-account-empty"><UserRound size={19} /><strong>Подключи аккаунт</strong><span>Скин связан с твоим профилем игры.</span></div><button className="button button-outline full-button" type="button" onClick={onOpenAuth}><UserRound size={15} />Войти в аккаунт</button></>}</div>
          <div className="settings-card skin-upload-card"><span className="section-label">SKIN OPTIONS</span><h3>Загрузить новый скин</h3><p>Java Edition PNG · 64×64 или 64×32. Выбери модель рук и отправь в Microsoft-профиль.</p><div className="variant-toggle"><button className={variant === 'classic' ? 'selected' : ''} type="button" onClick={() => setVariant('classic')}><span className="tiny-player classic-player" />Classic</button><button className={variant === 'slim' ? 'selected' : ''} type="button" onClick={() => setVariant('slim')}><span className="tiny-player slim-player" />Slim</button></div>{account?.provider === 'microsoft' ? <button className="button button-primary full-button" type="button" onClick={() => void upload()} disabled={!desktop || uploading}>{uploading ? <><span className="button-spinner" />Отправляем…</> : <><CloudDownload size={15} />Выбрать PNG и загрузить</>}</button> : account?.provider === 'ely' ? <><div className="provider-limit"><InfoIcon />Загрузка скинов в Ely.by управляется самим провайдером. Игровая авторизация здесь предназначена только для совместимых серверов.</div><button className="button button-outline full-button" type="button" onClick={() => openExternal('https://ely.by/skins')}><ExternalLink size={14} />Открыть Ely.by skins</button></> : <button className="button button-primary full-button" type="button" onClick={onOpenAuth}><UserRound size={15} />Войди через Microsoft</button>}</div>
          <div className="skin-format-note"><FileArchive size={15} /><span><strong>Локальный preview</strong><small>Выбранный PNG остаётся только для предпросмотра, пока не загружен в аккаунт.</small></span></div>
        </aside>
      </div>
      <div className="bottom-callout"><div className="callout-icon"><ShieldCheck size={16} /></div><span><strong>Твой аккаунт — твой образ.</strong> Скин меняется официальным Minecraft Services API; Bloom не подменяет сессию и не меняет лицензионный статус.</span></div>
    </div>
  );
}

function InfoIcon() { return <CircleHelp size={14} />; }

function SettingsPage({
  versions,
  bootstrap,
  onOpenHud,
  onOpenSkins,
  accounts,
  activeAccount,
  desktop,
  memoryGb,
  maxMemoryGb,
  javaPath,
  onMemoryChange,
  onChooseJava,
  onResetJava,
  onOpenAuth,
  onSwitchAccount,
  onRemoveAccount,
  onNotify,
}: {
  versions: GameVersion[];
  bootstrap: BootstrapState | null;
  onOpenHud: () => void;
  onOpenSkins: () => void;
  accounts: AccountSummary[];
  activeAccount: AccountSummary | null;
  desktop: boolean;
  memoryGb: number;
  maxMemoryGb: number;
  javaPath: string;
  onMemoryChange: (value: number) => void;
  onChooseJava: () => void;
  onResetJava: () => void;
  onOpenAuth: () => void;
  onSwitchAccount: (account: AccountSummary) => void;
  onRemoveAccount: (id: string) => Promise<void>;
  onNotify: (message: string) => void;
}) {
  return (
    <div className="page">
      <PageHeading eyebrow="CLIENT SETTINGS" title="Параметры лаунчера" description="Управляй входом, Java и памятью, выделяемой выбранному игровому профилю." />
      <div className="settings-feature-links"><button type="button" onClick={onOpenHud}><span className="settings-feature-icon"><Gamepad2 size={17} /></span><span><strong>HUD и производительность</strong><small>Кейстроки, CPS, дальность прорисовки, FPS</small></span><ArrowRight size={15} /></button><button type="button" onClick={onOpenSkins}><span className="settings-feature-icon settings-skin-icon"><Shirt size={17} /></span><span><strong>3D-скин игрока</strong><small>Preview с вращением и управление образом</small></span><ArrowRight size={15} /></button></div>
      <div className="settings-layout">
        <section className="settings-card"><div className="settings-card-heading"><div><span className="section-label">АККАУНТЫ</span><h2>Подключённые аккаунты</h2><p>Сессии отделены от каталогов игры; режим хранения зависит от доступной защиты ОС.</p></div><span className="settings-heading-icon account-icon"><UsersRound size={18} /></span></div>{accounts.length ? <div className="account-list">{accounts.map((account) => <div className={`account-list-row ${activeAccount?.id === account.id ? 'account-row-current' : ''}`} key={account.id}><Avatar account={account} /><span className="account-list-name"><strong>{account.name}</strong><small>{providerLabel(account.provider)}</small></span>{activeAccount?.id === account.id ? <span className="current-account-tag"><Check size={12} />Активен</span> : <button className="button button-outline account-switch" type="button" onClick={() => onSwitchAccount(account)}>Выбрать</button>}<button className="icon-button icon-danger" type="button" aria-label={`Удалить аккаунт ${account.name}`} onClick={() => { if (window.confirm(`Удалить ${account.name} с этого устройства?`)) void onRemoveAccount(account.id).catch((error) => onNotify(error instanceof Error ? error.message : 'Не удалось удалить аккаунт.')); }}><Trash2 size={14} /></button></div>)}</div> : <div className="empty-account"><UserRound size={18} /><span>Нет сохранённых игровых аккаунтов.</span></div>}<button className="button button-outline add-account-button" type="button" onClick={onOpenAuth}><Plus size={15} />Добавить аккаунт</button>{desktop && <div className="encrypted-note"><LockKeyhole size={14} />{bootstrap?.secureStorageAvailable ? 'Токены зашифрованы через системный safeStorage.' : 'Системное шифрование недоступно. Вход останется только до закрытия приложения.'}</div>}</section>
        <section className="settings-card"><div className="settings-card-heading"><div><span className="section-label">GAME RUNTIME</span><h2>Java и память</h2><p>Bloom скачает подходящую Java автоматически, если не выбран свой путь.</p></div><span className="settings-heading-icon runtime-icon"><Cpu size={18} /></span></div><div className="runtime-row"><span className="runtime-status"><Check size={15} /></span><div><strong>Java Runtime</strong><small>{javaPath ? javaPath.split(/[\\/]/).pop() : 'Автоматическая установка подходящей версии'}</small></div><button className="button button-outline small-button" type="button" onClick={onChooseJava} disabled={!desktop}>Выбрать файл</button></div><button className="reset-java" type="button" disabled={!desktop || !javaPath} onClick={() => { onResetJava(); onNotify('Будет использоваться автоматическая Java.'); }}>Вернуть автоустановку</button><div className="memory-setting"><div className="memory-label"><span><strong>Память для Minecraft</strong><small>Система: {bootstrap?.totalMemoryMb ? `${(bootstrap.totalMemoryMb / 1024).toFixed(1)} ГБ` : 'определяется при запуске'}</small></span><strong className="memory-value">{memoryGb} ГБ</strong></div><input type="range" min="2" max={Math.max(2, maxMemoryGb)} step="1" value={Math.min(memoryGb, maxMemoryGb)} onChange={(event) => onMemoryChange(Number(event.target.value))} /><div className="memory-range-labels"><span>2 ГБ</span><span>Оставляем системе минимум 2 ГБ</span><span>{Math.max(2, maxMemoryGb)} ГБ</span></div></div></section>
        <section className="settings-card settings-data-card"><div className="settings-card-heading"><div><span className="section-label">LOCAL STORAGE</span><h2>Данные и файлы</h2><p>Игровые каталоги хранятся раздельно от токенов входа.</p></div><span className="settings-heading-icon data-icon"><HardDriveDownload size={18} /></span></div><div className="path-row"><span className="path-type">APP DATA</span><code>{bootstrap?.dataDirectory ?? 'Работает только в установленном приложении'}</code><button className="copy-path" type="button" onClick={() => { if (bootstrap?.dataDirectory) void navigator.clipboard?.writeText(bootstrap.dataDirectory); onNotify('Путь скопирован.'); }} disabled={!desktop}>Копировать</button></div><div className="settings-bullet"><ShieldCheck size={15} /><span>Пароль Ely.by не записывается на диск. Сохраняется только сессионный токен, если ОС предоставляет безопасное хранилище.</span></div><div className="settings-bullet"><Box size={15} /><span>Удаление профиля в Bloom сохраняет игровые файлы и миры. Очистку можно сделать вручную.</span></div></section>
        <section className="settings-card settings-versions-card"><div className="settings-card-heading"><div><span className="section-label">SUPPORTED VERSIONS</span><h2>Полная история Minecraft</h2><p>Релизы, снапшоты, Beta и Alpha из официального version manifest.</p></div><span className="settings-heading-icon versions-icon"><Clock3 size={18} /></span></div><div className="version-count-line"><strong>{versions.length ? versions.length.toLocaleString('ru-RU') : '—'}</strong><span>официальных версий доступно</span></div><div className="version-channel-tags"><span>Release</span><span>Snapshot</span><span>Old Beta</span><span>Old Alpha</span></div><div className="catalog-mini-link"><span>Фильтры Modrinth используют версию профиля и загрузчик.</span><BadgeCheck size={15} /></div></section>
      </div>
      <div className="settings-footer"><span>Bloom Client · desktop {bootstrap?.appVersion ?? '0.5.3'}</span><button type="button" onClick={() => openExternal('https://github.com/zxcwmd/zxc')}>О проекте <ArrowUpRight size={13} /></button></div>
    </div>
  );
}

function LaunchModal({ event, instance, versions, onClose }: { event: LauncherEvent | null; instance: GameInstance | null; versions: GameVersion[]; onClose: () => void }) {
  const running = event?.kind === 'started';
  const error = event?.kind === 'error';
  const finished = event?.kind === 'closed';
  const progress = event?.progress;
  return (
    <Modal onClose={onClose} size="small">
      <div className="launch-dialog"><div className={`launch-dialog-icon ${running ? 'launch-success' : error ? 'launch-error' : ''}`}>{running ? <Check size={22} /> : error ? <CircleHelp size={22} /> : <span className="launch-orbit"><span /></span>}</div><span className="eyebrow"><span />{running ? 'GAME SESSION' : error ? 'LAUNCH ERROR' : finished ? 'SESSION ENDED' : 'BLOOM LAUNCHER'}</span><h2>{running ? 'Minecraft запущен' : error ? 'Не получилось запустить' : finished ? 'Игра закрыта' : 'Готовим твой мир'}</h2><p>{event?.message ?? 'Проверяем файлы профиля и готовим подходящую Java Runtime.'}</p><div className="launch-profile-chip"><span className="quick-row-icon quick-green"><Box size={16} /></span><span><strong>{instance?.name ?? 'Игровой профиль'}</strong><small>{instance ? `${displayVersion(instance.version, versions)} · ${LOADER_LABELS[instance.loader]}` : 'Профиль не выбран'}</small></span></div>{progress !== undefined && !running && <div className="launch-progress"><span><i style={{ width: `${progress}%` }} /></span><small>{progress}%</small></div>}<div className={`launch-step-message ${error ? 'text-danger' : ''}`}><span className={running || finished || error ? 'step-check' : 'step-spinner'}>{running || finished ? <Check size={12} /> : error ? <X size={12} /> : <span />}</span>{error ? 'Проверь подключение и аккаунт, затем попробуй ещё раз.' : finished ? `Код завершения: ${event?.exitCode ?? 0}` : running ? 'Лаунчер остаётся открытым, можно продолжать.' : 'Первый запуск может скачать несколько гигабайт игровых файлов.'}</div><div className="modal-actions"><button className="button button-primary full-button" type="button" onClick={onClose}>{running || finished || error ? 'Готово' : 'Скрыть окно'}</button></div></div>
    </Modal>
  );
}

function AuthModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (account: AccountSummary) => Promise<void> }) {
  const [provider, setProvider] = useState<'microsoft' | 'ely' | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [elyConfirmed, setElyConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const loginMicrosoft = async () => {
    if (!window.bloom) { setError('Вход откроется в установленном Electron-приложении.'); return; }
    setBusy(true); setError('');
    try { await onSuccess(await window.bloom.loginMicrosoft()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось войти через Microsoft.'); }
    finally { setBusy(false); }
  };
  const loginEly = async (event: FormEvent) => {
    event.preventDefault();
    if (!window.bloom) { setError('Ely.by-вход доступен в установленном приложении.'); return; }
    if (!elyConfirmed) { setError('Подтверди, что используешь Ely.by только на совместимом сервере.'); return; }
    if (!username.trim() || !password) { setError('Укажи имя пользователя и пароль Ely.by.'); return; }
    setBusy(true); setError('');
    let currentPassword = password;
    let currentTotp = totp;
    setPassword('');
    setTotp('');
    try { await onSuccess(await window.bloom.loginEly({ username: username.trim(), password: currentPassword, totp: currentTotp })); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Ely.by не принял данные.'); }
    finally { currentPassword = ''; currentTotp = ''; setBusy(false); }
  };
  return (
    <Modal onClose={onClose} size="medium">
      <div className="modal-heading"><div className="modal-icon auth-icon"><LockKeyhole size={18} /></div><div><span className="eyebrow"><span />АККАУНТЫ</span><h2>Войди в Bloom</h2><p>Только официальная авторизация. Offline-входа по нику нет.</p></div><button className="modal-close" type="button" aria-label="Закрыть" onClick={onClose}><X size={18} /></button></div>
      {provider !== 'ely' ? <><button className="auth-provider-card" type="button" onClick={() => void loginMicrosoft()} disabled={busy}><span className="provider-symbol microsoft-symbol">M</span><span><strong>Microsoft</strong><small>Официальная Minecraft: Java Edition</small></span><span className="auth-card-arrow">{busy ? <span className="button-spinner" /> : <ArrowRight size={16} />}</span></button><button className="auth-provider-card" type="button" onClick={() => setProvider('ely')} disabled={busy}><span className="provider-symbol ely-symbol">e</span><span><strong>Ely.by</strong><small>Только для серверов с поддержкой Ely.by</small></span><span className="auth-card-arrow"><ArrowRight size={16} /></span></button></> : <form className="ely-form" onSubmit={(event) => void loginEly(event)}><button className="back-to-providers" type="button" onClick={() => setProvider(null)}><ArrowLeft size={14} />Другие способы входа</button><label className="field-label">Имя пользователя или email<input className="text-input" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Ely.by username" /></label><label className="field-label">Пароль Ely.by<input className="text-input" autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Не сохраняется Bloom Client" /></label><label className="field-label">Код 2FA (если включён)<input className="text-input" inputMode="numeric" autoComplete="one-time-code" value={totp} onChange={(event) => setTotp(event.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="6-значный код" /></label><label className="ely-confirm"><input type="checkbox" checked={elyConfirmed} onChange={(event) => setElyConfirmed(event.target.checked)} /><span>Я подключаю Ely.by только к серверам, которые явно поддерживают этот провайдер.</span></label><button className="button button-primary full-button" type="submit" disabled={busy}>{busy ? <><span className="button-spinner" />Проверяем Ely.by…</> : <><LockKeyhole size={15} />Войти через Ely.by</>}</button><div className="ely-privacy"><LockKeyhole size={13} />Пароль используется один раз для authserver.ely.by и не сохраняется. Сессионный токен шифруется ОС.</div></form>}
      {error && <div className="auth-error"><CircleHelp size={15} />{error}</div>}
      <div className="auth-footnote"><ShieldCheck size={15} /><span>{provider === 'ely' ? 'Ely.by совместим не со всеми серверами. Официальный Microsoft-вход нужен для большинства premium-серверов.' : 'Microsoft проверяет владение Java Edition. Ely.by — отдельный провайдер для совместимых серверов.'}</span></div>
      {!window.bloom && <div className="auth-preview-hint"><MonitorPlay size={14} />Для авторизации открой Bloom Client как desktop-приложение.</div>}
    </Modal>
  );
}

function Modal({ children, onClose, size = 'medium' }: { children: ReactNode; onClose: () => void; size?: 'small' | 'medium' | 'large' }) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className={`modal modal-${size}`} role="dialog" aria-modal="true">{children}</div></div>;
}

async function openExternal(url: string) {
  if (window.bloom) {
    try { await window.bloom.openExternal(url); } catch { /* valid in-app links are optional */ }
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

export default App;
