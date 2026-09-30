import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';
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
  Globe2,
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
  WandSparkles,
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
  { id: 'home', label: 'Главная', icon: Gamepad2, group: 'ИГРА' },
  { id: 'instances', label: 'Профили', icon: Layers3, group: 'ИГРА' },
  { id: 'catalog', label: 'Каталог', icon: Globe2, group: 'КОНТЕНТ' },
  { id: 'hud', label: 'HUD и FPS', icon: SlidersHorizontal, group: 'НАСТРОЙКА' },
  { id: 'skins', label: 'Скины', icon: Shirt, group: 'НАСТРОЙКА' },
  { id: 'settings', label: 'Параметры', icon: Settings2, group: 'СИСТЕМА' },
] as const;

type PageId = (typeof NAV_ITEMS)[number]['id'];
type ModalId = 'auth' | 'instance' | 'launch' | null;
type VersionFilter = 'all' | VersionType;

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

function SkinPreview({ skin, cape, name, className = '' }: { skin: string | null; cape?: string | null; name?: string; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<{ setSize: (width: number, height: number) => void; dispose: () => void; autoRotate: boolean; autoRotateSpeed: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const frame = canvas?.parentElement;
    if (!canvas || !frame) return;
    let cancelled = false;
    let observer: ResizeObserver | null = null;
    let viewer: { setSize: (width: number, height: number) => void; dispose: () => void; autoRotate: boolean; autoRotateSpeed: number } | null = null;
    void import('skinview3d').then(({ SkinViewer }) => {
      if (cancelled) return;
      const demo = skin ? null : makeDemoSkin();
      const bounds = frame.getBoundingClientRect();
      viewer = new SkinViewer({
        canvas,
        width: Math.max(160, Math.floor(bounds.width)),
        height: Math.max(200, Math.floor(bounds.height)),
        skin: skin ?? demo ?? undefined,
        cape: cape ?? undefined,
        background: 0x101815,
        enableControls: true,
        fov: 36,
        zoom: 0.76,
        pixelRatio: 1,
        nameTag: name ?? undefined,
      });
      viewer.autoRotate = true;
      viewer.autoRotateSpeed = 0.62;
      viewerRef.current = viewer;
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
      viewerRef.current = null;
    };
  }, [skin, cape, name]);

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
  const [bootstrap, setBootstrap] = useState<BootstrapState | null>(null);
  const [versions, setVersions] = useState<GameVersion[]>([]);
  const [loadingApp, setLoadingApp] = useState(true);
  const [versionsError, setVersionsError] = useState('');
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
  const title = NAV_ITEMS.find((item) => item.id === activePage)?.label ?? 'Главная';
  const maxMemoryGb = Math.max(2, Math.min(32, Math.floor((bootstrap?.totalMemoryMb ?? 16384) / 1024) - 2));

  const refreshBootstrap = useCallback(async () => {
    if (!window.bloom) return null;
    const next = await window.bloom.getBootstrap();
    setBootstrap(next);
    setJavaPath(next.javaPath);
    setMemoryGb((current) => Math.min(Math.max(2, current), Math.max(2, Math.floor(next.totalMemoryMb / 1024) - 2)));
    return next;
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

  const beginLaunch = async () => {
    if (!desktop || !window.bloom) {
      notify('Запуск и установка Minecraft работают в установленной desktop-версии.');
      return;
    }
    if (!activeInstance) {
      setModal('instance');
      return;
    }
    if (!activeAccount) {
      setModal('auth');
      return;
    }
    setLauncherEvent({ kind: 'phase', message: 'Проверяем аккаунт и готовим запуск…' });
    setModal('launch');
    try {
      await window.bloom.launchGame({ instanceId: activeInstance.id, memoryGb });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось запустить Minecraft.';
      setLauncherEvent({ kind: 'error', message });
      notify(message);
    }
  };

  const handleAccountChange = async (account: AccountSummary) => {
    if (!window.bloom) return;
    await window.bloom.setActiveAccount(account.id);
    await refreshBootstrap();
    setModal(null);
    setActivePage('home');
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
      notify('Параметры производительности записаны в options.txt профиля.');
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
            instances={instances}
            versions={versions}
            skin={previewSkin ?? skin.skinDataUrl}
            cape={skin.capeDataUrl}
            desktop={desktop}
            onPlay={() => void beginLaunch()}
            onOpenAuth={() => setModal('auth')}
            onCreate={() => setModal('instance')}
            onOpenInstances={() => changePage('instances')}
            onOpenCatalog={() => changePage('catalog')}
            onSelectInstance={setActiveInstance}
          />
        );
      case 'instances':
        return (
          <InstancesPage
            instances={instances}
            activeInstance={activeInstance}
            versions={versions}
            desktop={desktop}
            isBusy={isBusy}
            onCreate={() => setModal('instance')}
            onSelect={setActiveInstance}
            onRefresh={refreshBootstrap}
            onNotify={notify}
          />
        );
      case 'catalog':
        return (
          <CatalogPage
            activeInstance={activeInstance}
            versions={versions}
            desktop={desktop}
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
            onOpenCatalog={() => changePage('catalog')}
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
    <div className="client-shell">
      <aside className={`sidebar ${mobileMenuOpen ? 'sidebar-open' : ''}`}>
        <button className="brand" type="button" onClick={() => changePage('home')} aria-label="Bloom Client, на главную">
          <BrandGlyph />
          <span className="brand-copy"><strong>bloom<span>.</span></strong><small>MINECRAFT CLIENT</small></span>
          <span className="brand-version">0.5</span>
        </button>

        <div className="nav-scroll">
          {['ИГРА', 'КОНТЕНТ', 'НАСТРОЙКА', 'СИСТЕМА'].map((group) => (
            <div className="nav-group" key={group}>
              <div className="nav-label">{group}</div>
              {NAV_ITEMS.filter((item) => item.group === group).map((item) => {
                const Icon = item.icon;
                return (
                  <button className={`nav-link ${activePage === item.id ? 'nav-link-active' : ''}`} type="button" key={item.id} onClick={() => changePage(item.id)}>
                    <Icon size={17} strokeWidth={1.75} />
                    <span>{item.label}</span>
                    {item.id === 'catalog' && <span className="nav-live-dot" />}
                    {activePage === item.id && <span className="nav-active-bar" />}
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
              <span className="connection-pill"><span className="online-dot" /> GAME SERVICES READY</span>
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

        {!desktop && <div className="preview-banner"><MonitorPlay size={15} /><span>Это интерактивный preview. Авторизация, запись файлов и запуск доступны в установленном приложении.</span><button type="button" onClick={() => notify('Windows x64 installer собирается в GitHub Actions.')}>Подробнее</button></div>}
        <div className="content-scroll">
          {loadingApp && <div className="loading-line"><span />Подготавливаем библиотеку Bloom…</div>}
          {versionsError && <div className="inline-warning"><CircleHelp size={16} /><span>Список версий Minecraft временно недоступен. Проверьте подключение к интернету и обновите экран.</span></div>}
          {renderPage()}
        </div>
      </main>

      {toast && <div className="toast"><span className="toast-check"><Check size={14} /></span>{toast}</div>}
      {modal === 'auth' && <AuthModal onClose={() => setModal(null)} onSuccess={handleAccountChange} />}
      {modal === 'instance' && <InstanceModal versions={versions} isBusy={isBusy} onClose={() => setModal(null)} onCreate={handleCreateInstance} />}
      {modal === 'launch' && <LaunchModal event={launcherEvent} instance={activeInstance} versions={versions} onClose={() => setModal(null)} />}
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
  instances,
  versions,
  skin,
  cape,
  desktop,
  onPlay,
  onOpenAuth,
  onCreate,
  onOpenInstances,
  onOpenCatalog,
  onSelectInstance,
}: {
  account: AccountSummary | null;
  instance: GameInstance | null;
  instances: GameInstance[];
  versions: GameVersion[];
  skin: string | null;
  cape: string | null;
  desktop: boolean;
  onPlay: () => void;
  onOpenAuth: () => void;
  onCreate: () => void;
  onOpenInstances: () => void;
  onOpenCatalog: () => void;
  onSelectInstance: (id: string) => void;
}) {
  const latestRelease = versions.find((version) => version.type === 'release')?.id ?? '—';
  return (
    <div className="page page-home">
      <section className="hero-card">
        <div className="hero-grain" />
        <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" />
        <div className="hero-copy">
          <div className="hero-overline"><span className="hero-live" /> YOUR NEXT WORLD STARTS HERE</div>
          <h1>Играй.<br /><em>По-своему.</em></h1>
          <p>Твои версии, моды и настройки — в одном красивом месте. Без лишних экранов и сложных сборок.</p>
          <div className="hero-actions">
            <button className="button button-primary play-button" type="button" onClick={onPlay} disabled={!instance && !desktop}>
              <Play size={17} fill="currentColor" />{instance ? 'Запустить Minecraft' : 'Создать игровой профиль'}<ArrowRight size={16} />
            </button>
            {!account && <button className="button button-subtle" type="button" onClick={onOpenAuth}><UserRound size={16} /> Подключить аккаунт</button>}
          </div>
          <div className="hero-trust"><ShieldCheck size={15} /><span>Официальные файлы игры</span><span className="hero-separator">·</span><span>Без offline-режима</span></div>
        </div>
        <div className="hero-avatar-area">
          <div className="hero-world-chip"><span className="pulse-point" />{instance ? 'ПРОФИЛЬ ВЫБРАН' : 'ГОТОВ К НАСТРОЙКЕ'}</div>
          <div className="hero-character-frame"><div className="hero-glow" /><SkinPreview skin={skin} cape={cape} name={account?.name ?? 'Bloom'} className="hero-skin" /></div>
          <div className="hero-avatar-caption"><span className="caption-label">{account ? 'СЕЙЧАС В ИГРЕ' : '3D SKIN PREVIEW'}</span><strong>{account?.name ?? 'Bloom Explorer'}</strong><span className="avatar-caption-dot"><i />{account ? providerLabel(account.provider) : 'Пример модели'}</span></div>
          <div className="floating-chip chip-spark"><Sparkles size={14} />Bloom ready</div>
        </div>
        <div className="hero-bottom-line"><span>v0.5.0</span><span>WINDOWS · JAVA EDITION</span><span>CRAFTED FOR YOUR NEXT WORLD <span className="hero-line-dot">✳</span></span></div>
      </section>

      <div className="home-section-heading">
        <div><div className="eyebrow"><span />ТВОЯ ИГРА</div><h2>Продолжим?</h2></div>
        <button className="text-link" type="button" onClick={onOpenInstances}>Все профили <ArrowRight size={15} /></button>
      </div>

      <div className="home-grid">
        <section className="active-instance-card">
          <div className="card-topline"><span className="section-label">АКТИВНЫЙ ПРОФИЛЬ</span><span className={`install-status ${instance?.installed ? 'is-installed' : ''}`}><i />{instance?.installed ? 'УСТАНОВЛЕН' : 'ЕЩЁ НЕ УСТАНОВЛЕН'}</span></div>
          {instance ? (
            <>
              <div className="instance-title-row"><div className="instance-game-icon"><Box size={21} /></div><div><h3>{instance.name}</h3><p>Изолированная папка · сохранения в безопасности</p></div><button className="icon-button" type="button" aria-label="Все профили" onClick={onOpenInstances}><ArrowUpRight size={17} /></button></div>
              <div className="instance-specs"><div><small>ВЕРСИЯ ИГРЫ</small><strong>{displayVersion(instance.version, versions)}</strong></div><span className="spec-divider" /><div><small>ЗАГРУЗЧИК</small><strong>{LOADER_LABELS[instance.loader]}</strong></div><span className="spec-divider" /><div><small>ДОБАВЛЕНО МОДОВ</small><strong>{instance.contentCount ?? 0}</strong></div></div>
              <div className="instance-card-footer"><span><HardDriveDownload size={14} />{instance.installed ? 'Файлы готовы' : 'Подготовится при первом запуске'}</span><button type="button" onClick={onPlay}><Play size={14} fill="currentColor" />Играть</button></div>
            </>
          ) : (
            <div className="empty-instance"><div className="empty-icon"><Layers3 size={21} /></div><h3>Здесь начинается твоя сборка</h3><p>Создай профиль: выбери любую версию Minecraft, загрузчик и память для игры.</p><button className="button button-outline" type="button" onClick={onCreate}><Plus size={16} />Создать профиль</button></div>
          )}
        </section>

        <section className="quick-panel">
          <div className="card-topline"><span className="section-label">БЫСТРЫЙ СТАРТ</span><span className="quick-badge"><Sparkles size={12} /> BLOOM</span></div>
          <button className="quick-row" type="button" onClick={onOpenCatalog}><span className="quick-row-icon quick-purple"><Package size={17} /></span><span><strong>Найти моды</strong><small>Каталог Modrinth</small></span><ChevronRight size={16} /></button>
          <button className="quick-row" type="button" onClick={onOpenCatalog}><span className="quick-row-icon quick-green"><Paintbrush2 size={17} /></span><span><strong>Обновить текстуры</strong><small>Ресурспаки и атмосфера</small></span><ChevronRight size={16} /></button>
          <button className="quick-row" type="button" onClick={onOpenAuth}><span className="quick-row-icon quick-blue"><LockKeyhole size={17} /></span><span><strong>{account ? 'Аккаунт подключён' : 'Безопасный вход'}</strong><small>{account ? providerLabel(account.provider) : 'Microsoft или Ely.by'}</small></span><ChevronRight size={16} /></button>
          <div className="quick-foot"><span><ShieldCheck size={14} />Без никнейм-входа и обходов</span><span>Последний релиз {latestRelease}</span></div>
        </section>
      </div>

      <div className="home-footer-note"><div className="note-mark"><WandSparkles size={16} /></div><span><strong>Всё готово для твоего мира.</strong> {instances.length ? 'Выбери профиль и запускай — Java устанавливается автоматически.' : 'Выбери версию и собери профиль так, как нравится тебе.'}</span>{!account && <button type="button" onClick={onOpenAuth}>Подключить вход <ArrowRight size={14} /></button>}{!desktop && <small>browser preview</small>}</div>
      {instances.length > 1 && <div className="home-instance-switcher"><span>ПРОФИЛЬ</span>{instances.slice(0, 3).map((item) => <button key={item.id} className={item.id === instance?.id ? 'switcher-current' : ''} type="button" onClick={() => onSelectInstance(item.id)}>{item.name}</button>)}</div>}
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
      <PageHeading eyebrow="ТВОИ МИРЫ" title="Игровые профили" description="Каждый профиль — отдельная версия Minecraft со своими модами, ресурсами и сохранениями." action={<button className="button button-primary" type="button" onClick={onCreate} disabled={!desktop}><Plus size={16} />Новый профиль</button>} />
      <div className="instance-summary-strip"><div><span className="summary-icon"><Layers3 size={17} /></span><span><small>ПРОФИЛЕЙ</small><strong>{instances.length}</strong></span></div><div><span className="summary-icon summary-mint"><Package size={17} /></span><span><small>ИГРОВЫЕ ВЕРСИИ</small><strong>{versions.length ? `${versions.length}+` : '—'}</strong></span></div><div><span className="summary-icon summary-violet"><HardDriveDownload size={17} /></span><span><small>УСТАНОВЛЕНО</small><strong>{instances.filter((instance) => instance.installed).length}</strong></span></div><div className="versions-footnote"><Clock3 size={14} /> В каталоге доступны релизы, снапшоты, Beta и Alpha.</div></div>
      <div className="toolbar-row"><div className="filter-pills"><button className={filter === 'all' ? 'filter-active' : ''} type="button" onClick={() => setFilter('all')}>Все <span>{instances.length}</span></button>{Object.entries(LOADER_LABELS).map(([value, label]) => <button className={filter === value ? 'filter-active' : ''} key={value} type="button" onClick={() => setFilter(value)}>{label}</button>)}</div><span className="toolbar-note"><ShieldCheck size={14} /> Профили изолированы друг от друга</span></div>
      {visibleInstances.length ? (
        <div className="instance-grid">
          {visibleInstances.map((instance) => (
            <article className={`profile-card ${instance.id === activeInstance?.id ? 'profile-card-active' : ''}`} key={instance.id}>
              <div className="profile-card-art"><div className={`profile-art-orb art-${instance.loader}`} /><span className="profile-art-stamp">BLOOM / {LOADER_LABELS[instance.loader].toUpperCase()}</span><div className="profile-art-block"><Box size={38} strokeWidth={1.15} /></div><span className={`profile-installed ${instance.installed ? 'installed' : ''}`}><i />{instance.installed ? 'Installed' : 'Not installed'}</span></div>
              <div className="profile-card-body"><div className="profile-card-title"><div><h3>{instance.name}</h3><p>{displayVersion(instance.version, versions)} <span>·</span> {LOADER_LABELS[instance.loader]}</p></div><button className="icon-button" aria-label={`Удалить профиль ${instance.name}`} type="button" onClick={() => void removeInstance(instance)} disabled={!desktop || deletingId === instance.id}><Trash2 size={15} /></button></div><div className="profile-card-stats"><span><Package size={14} />{instance.contentCount ?? 0} модов</span><span><Clock3 size={14} />Создан {compactDate(instance.createdAt)}</span></div><div className="profile-card-actions"><button className={instance.id === activeInstance?.id ? 'button button-primary' : 'button button-outline'} type="button" onClick={() => onSelect(instance.id)} disabled={!desktop}>{instance.id === activeInstance?.id ? <><Check size={15} />Активный профиль</> : <>Выбрать <ArrowRight size={15} /></>}</button><button className="profile-play" type="button" aria-label="Запустить профиль" onClick={() => onSelect(instance.id)}><Play size={15} fill="currentColor" /></button></div></div>
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
  onNotify,
  onRefresh,
  onCreateInstance,
}: {
  activeInstance: GameInstance | null;
  versions: GameVersion[];
  desktop: boolean;
  onNotify: (message: string) => void;
  onRefresh: () => Promise<BootstrapState | null>;
  onCreateInstance: () => void;
}) {
  const [type, setType] = useState<ContentType>('mod');
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
        <div className="catalog-tabs"><button className={type === 'mod' ? 'catalog-tab active' : 'catalog-tab'} type="button" onClick={() => { setType('mod'); setTab('discover'); }}><Blocks size={15} />Моды</button><button className={type === 'resourcepack' ? 'catalog-tab active' : 'catalog-tab'} type="button" onClick={() => { setType('resourcepack'); setTab('discover'); }}><Paintbrush2 size={15} />Ресурспаки</button></div>
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
      <div className="settings-layout">
        <section className="settings-card"><div className="settings-card-heading"><div><span className="section-label">АККАУНТЫ</span><h2>Подключённые аккаунты</h2><p>Сессии отделены от каталогов игры; режим хранения зависит от доступной защиты ОС.</p></div><span className="settings-heading-icon account-icon"><UsersRound size={18} /></span></div>{accounts.length ? <div className="account-list">{accounts.map((account) => <div className={`account-list-row ${activeAccount?.id === account.id ? 'account-row-current' : ''}`} key={account.id}><Avatar account={account} /><span className="account-list-name"><strong>{account.name}</strong><small>{providerLabel(account.provider)}</small></span>{activeAccount?.id === account.id ? <span className="current-account-tag"><Check size={12} />Активен</span> : <button className="button button-outline account-switch" type="button" onClick={() => onSwitchAccount(account)}>Выбрать</button>}<button className="icon-button icon-danger" type="button" aria-label={`Удалить аккаунт ${account.name}`} onClick={() => { if (window.confirm(`Удалить ${account.name} с этого устройства?`)) void onRemoveAccount(account.id).catch((error) => onNotify(error instanceof Error ? error.message : 'Не удалось удалить аккаунт.')); }}><Trash2 size={14} /></button></div>)}</div> : <div className="empty-account"><UserRound size={18} /><span>Нет сохранённых игровых аккаунтов.</span></div>}<button className="button button-outline add-account-button" type="button" onClick={onOpenAuth}><Plus size={15} />Добавить аккаунт</button>{desktop && <div className="encrypted-note"><LockKeyhole size={14} />{bootstrap?.secureStorageAvailable ? 'Токены зашифрованы через системный safeStorage.' : 'Системное шифрование недоступно. Вход останется только до закрытия приложения.'}</div>}</section>
        <section className="settings-card"><div className="settings-card-heading"><div><span className="section-label">GAME RUNTIME</span><h2>Java и память</h2><p>Bloom скачает подходящую Java автоматически, если не выбран свой путь.</p></div><span className="settings-heading-icon runtime-icon"><Cpu size={18} /></span></div><div className="runtime-row"><span className="runtime-status"><Check size={15} /></span><div><strong>Java Runtime</strong><small>{javaPath ? javaPath.split(/[\\/]/).pop() : 'Автоматическая установка подходящей версии'}</small></div><button className="button button-outline small-button" type="button" onClick={onChooseJava} disabled={!desktop}>Выбрать файл</button></div><button className="reset-java" type="button" onClick={() => { onResetJava(); onNotify('Будет использоваться автоматическая Java.'); }}>Вернуть автоустановку</button><div className="memory-setting"><div className="memory-label"><span><strong>Память для Minecraft</strong><small>Система: {bootstrap?.totalMemoryMb ? `${(bootstrap.totalMemoryMb / 1024).toFixed(1)} ГБ` : 'определяется при запуске'}</small></span><strong className="memory-value">{memoryGb} ГБ</strong></div><input type="range" min="2" max={Math.max(2, maxMemoryGb)} step="1" value={Math.min(memoryGb, maxMemoryGb)} onChange={(event) => onMemoryChange(Number(event.target.value))} /><div className="memory-range-labels"><span>2 ГБ</span><span>Оставляем системе минимум 2 ГБ</span><span>{Math.max(2, maxMemoryGb)} ГБ</span></div></div></section>
        <section className="settings-card settings-data-card"><div className="settings-card-heading"><div><span className="section-label">LOCAL STORAGE</span><h2>Данные и файлы</h2><p>Игровые каталоги хранятся раздельно от токенов входа.</p></div><span className="settings-heading-icon data-icon"><HardDriveDownload size={18} /></span></div><div className="path-row"><span className="path-type">APP DATA</span><code>{bootstrap?.dataDirectory ?? 'Работает только в установленном приложении'}</code><button className="copy-path" type="button" onClick={() => { if (bootstrap?.dataDirectory) void navigator.clipboard?.writeText(bootstrap.dataDirectory); onNotify('Путь скопирован.'); }} disabled={!desktop}>Копировать</button></div><div className="settings-bullet"><ShieldCheck size={15} /><span>Пароль Ely.by не записывается на диск. Сохраняется только сессионный токен, если ОС предоставляет безопасное хранилище.</span></div><div className="settings-bullet"><Box size={15} /><span>Удаление профиля в Bloom сохраняет игровые файлы и миры. Очистку можно сделать вручную.</span></div></section>
        <section className="settings-card settings-versions-card"><div className="settings-card-heading"><div><span className="section-label">SUPPORTED VERSIONS</span><h2>Полная история Minecraft</h2><p>Релизы, снапшоты, Beta и Alpha из официального version manifest.</p></div><span className="settings-heading-icon versions-icon"><Clock3 size={18} /></span></div><div className="version-count-line"><strong>{versions.length ? versions.length.toLocaleString('ru-RU') : '—'}</strong><span>официальных версий доступно</span></div><div className="version-channel-tags"><span>Release</span><span>Snapshot</span><span>Old Beta</span><span>Old Alpha</span></div><div className="catalog-mini-link"><span>Фильтры Modrinth используют версию профиля и загрузчик.</span><BadgeCheck size={15} /></div></section>
      </div>
      <div className="settings-footer"><span>Bloom Client · desktop {bootstrap?.appVersion ?? '0.5.0'}</span><button type="button" onClick={() => openExternal('https://github.com/zxcwmd/zxc')}>О проекте <ArrowUpRight size={13} /></button></div>
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
