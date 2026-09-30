import { useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Boxes,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Download,
  Fish,
  FlaskConical,
  FolderOpen,
  Gamepad2,
  HardDrive,
  House,
  Info,
  Layers,
  Menu,
  Monitor,
  Package,
  Play,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sprout,
  TreePine,
  UserRound,
  Wheat,
  X,
  Zap,
} from 'lucide-react';

type PageId = 'home' | 'builds' | 'automation' | 'settings';
type FieldOption = { value: string; label: string };
type ConfigField = { id: string; label: string; value: string; options: FieldOption[] };
type AutomationModule = {
  id: string;
  title: string;
  description: string;
  group: string;
  icon: LucideIcon;
  enabled: boolean;
  tint: string;
  fields: ConfigField[];
};
type GameProfile = {
  id: string;
  name: string;
  description: string;
  version: string;
  loader: string;
  mods: number;
  ram: number;
  accent: string;
  icon: LucideIcon;
};
type LauncherSettings = {
  memory: number;
  gameDirectory: string;
  javaPath: string;
};
type ModalState = null | { type: 'launch' } | { type: 'auth' } | { type: 'module'; moduleId: string };

const PAGE_TITLES: Record<PageId, string> = {
  home: 'Главная',
  builds: 'Сборки',
  automation: 'Автоматизация',
  settings: 'Настройки',
};

const NAV_ITEMS: { id: PageId; label: string; icon: LucideIcon }[] = [
  { id: 'home', label: 'Главная', icon: House },
  { id: 'builds', label: 'Сборки', icon: Layers },
  { id: 'automation', label: 'Автоматизация', icon: Zap },
  { id: 'settings', label: 'Настройки', icon: Settings2 },
];

const PROFILES: GameProfile[] = [
  {
    id: 'survival',
    name: 'Survival Plus',
    description: 'Уютное выживание без лишнего шума',
    version: '1.21.4',
    loader: 'Fabric',
    mods: 18,
    ram: 6,
    accent: 'mint',
    icon: Sprout,
  },
  {
    id: 'vanilla',
    name: 'Чистая игра',
    description: 'Оригинальный Minecraft, без модов',
    version: '1.21.4',
    loader: 'Vanilla',
    mods: 0,
    ram: 4,
    accent: 'sand',
    icon: Gamepad2,
  },
  {
    id: 'adventure',
    name: 'Большое приключение',
    description: 'Новые измерения и исследование мира',
    version: '1.20.1',
    loader: 'NeoForge',
    mods: 46,
    ram: 8,
    accent: 'violet',
    icon: Boxes,
  },
];

const DEFAULT_MODULES: AutomationModule[] = [
  {
    id: 'auto-mine',
    title: 'Автошахта',
    description: 'План добычи ресурсов с ограничением по времени и радиусу.',
    group: 'Добыча',
    icon: Activity,
    enabled: false,
    tint: 'lime',
    fields: [
      { id: 'route', label: 'Шаблон маршрута', value: 'Туннель 2 × 1', options: [{ value: 'Туннель 2 × 1', label: 'Туннель 2 × 1' }, { value: 'Ветвистая шахта', label: 'Ветвистая шахта' }, { value: 'Своя схема', label: 'Своя схема' }] },
      { id: 'limit', label: 'Лимит сессии', value: '20 минут', options: [{ value: '10 минут', label: '10 минут' }, { value: '20 минут', label: '20 минут' }, { value: 'Без лимита', label: 'Без лимита' }] },
    ],
  },
  {
    id: 'potion-brewer',
    title: 'Автоварка зелий',
    description: 'Очередь рецептов и удобные паузы между варками.',
    group: 'Алхимия',
    icon: FlaskConical,
    enabled: true,
    tint: 'violet',
    fields: [
      { id: 'recipe', label: 'Избранный рецепт', value: 'Лечение II', options: [{ value: 'Лечение II', label: 'Лечение II' }, { value: 'Скорость', label: 'Скорость' }, { value: 'Огнестойкость', label: 'Огнестойкость' }] },
      { id: 'batch', label: 'Размер партии', value: '3 зелья', options: [{ value: '1 зелье', label: '1 зелье' }, { value: '3 зелья', label: '3 зелья' }, { value: '6 зелий', label: '6 зелий' }] },
    ],
  },
  {
    id: 'auto-harvest',
    title: 'Сбор урожая',
    description: 'Параметры аккуратного сбора и повторной посадки.',
    group: 'Ферма',
    icon: Wheat,
    enabled: false,
    tint: 'gold',
    fields: [
      { id: 'crop', label: 'Культура', value: 'Пшеница', options: [{ value: 'Пшеница', label: 'Пшеница' }, { value: 'Морковь', label: 'Морковь' }, { value: 'Картофель', label: 'Картофель' }] },
      { id: 'replant', label: 'Повторная посадка', value: 'Включена', options: [{ value: 'Включена', label: 'Включена' }, { value: 'Выключена', label: 'Выключена' }] },
    ],
  },
  {
    id: 'tree-feller',
    title: 'Рубка деревьев',
    description: 'Настройки сбора древесины для собственной базы.',
    group: 'Сбор ресурсов',
    icon: TreePine,
    enabled: false,
    tint: 'green',
    fields: [
      { id: 'tree', label: 'Тип дерева', value: 'Любое', options: [{ value: 'Любое', label: 'Любое' }, { value: 'Дуб', label: 'Дуб' }, { value: 'Ель', label: 'Ель' }] },
      { id: 'replant', label: 'Сажать саженцы', value: 'Да', options: [{ value: 'Да', label: 'Да' }, { value: 'Нет', label: 'Нет' }] },
    ],
  },
  {
    id: 'inventory-sort',
    title: 'Умный инвентарь',
    description: 'Схема сортировки предметов и горячей панели.',
    group: 'Комфорт',
    icon: Package,
    enabled: true,
    tint: 'blue',
    fields: [
      { id: 'sort', label: 'Сортировать по', value: 'Типу предмета', options: [{ value: 'Типу предмета', label: 'Типу предмета' }, { value: 'Редкости', label: 'Редкости' }, { value: 'Количеству', label: 'Количеству' }] },
      { id: 'hotbar', label: 'Порядок хотбара', value: 'Инструменты слева', options: [{ value: 'Инструменты слева', label: 'Инструменты слева' }, { value: 'Еда слева', label: 'Еда слева' }] },
    ],
  },
  {
    id: 'auto-fishing',
    title: 'Рыбалка',
    description: 'Комфортный режим рыбалки с лимитом длительности.',
    group: 'Сбор ресурсов',
    icon: Fish,
    enabled: false,
    tint: 'cyan',
    fields: [
      { id: 'session', label: 'Длительность', value: '15 минут', options: [{ value: '5 минут', label: '5 минут' }, { value: '15 минут', label: '15 минут' }, { value: '30 минут', label: '30 минут' }] },
      { id: 'notify', label: 'Уведомление', value: 'При улове', options: [{ value: 'При улове', label: 'При улове' }, { value: 'В конце сессии', label: 'В конце сессии' }] },
    ],
  },
];

const DEFAULT_SETTINGS: LauncherSettings = {
  memory: 6,
  gameDirectory: '',
  javaPath: '',
};

function readStorage<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function IconMark() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <span className="brand-cube brand-cube-top" />
      <span className="brand-cube brand-cube-left" />
      <span className="brand-cube brand-cube-right" />
      <span className="brand-cube brand-cube-bottom" />
      <span className="brand-cube brand-cube-center" />
    </div>
  );
}

function Switch({ checked, label, onChange }: { checked: boolean; label: string; onChange: () => void }) {
  return (
    <button
      className={`switch ${checked ? 'switch-on' : ''}`}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onChange();
      }}
    >
      <span className="switch-knob" />
    </button>
  );
}

function App() {
  const [activePage, setActivePage] = useState<PageId>('home');
  const [selectedProfileId, setSelectedProfileId] = useState(() => readStorage('bloom-profile-id', 'survival'));
  const [modules, setModules] = useState<AutomationModule[]>(() => readStorage('bloom-modules', DEFAULT_MODULES));
  const [settings, setSettings] = useState<LauncherSettings>(() => readStorage('bloom-settings', DEFAULT_SETTINGS));
  const [moduleConfigs, setModuleConfigs] = useState<Record<string, Record<string, string>>>(() => readStorage('bloom-module-configs', {}));
  const [modal, setModal] = useState<ModalState>(null);
  const [toast, setToast] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const selectedProfile = PROFILES.find((profile) => profile.id === selectedProfileId) ?? PROFILES[0];
  const enabledCount = modules.filter((module) => module.enabled).length;

  useEffect(() => localStorage.setItem('bloom-profile-id', selectedProfileId), [selectedProfileId]);
  useEffect(() => localStorage.setItem('bloom-modules', JSON.stringify(modules)), [modules]);
  useEffect(() => localStorage.setItem('bloom-settings', JSON.stringify(settings)), [settings]);
  useEffect(() => localStorage.setItem('bloom-module-configs', JSON.stringify(moduleConfigs)), [moduleConfigs]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!modal) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setModal(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [modal]);

  const showToast = (message: string) => setToast(message);
  const changePage = (page: PageId) => {
    setActivePage(page);
    setMobileNavOpen(false);
  };

  const toggleModule = (moduleId: string) => {
    const target = modules.find((module) => module.id === moduleId);
    setModules((current) => current.map((module) => (module.id === moduleId ? { ...module, enabled: !module.enabled } : module)));
    if (target) {
      showToast(`${target.title}: ${target.enabled ? 'выключено' : 'включено'} в профиле`);
    }
  };

  const changeModuleField = (moduleId: string, fieldId: string, value: string) => {
    setModuleConfigs((current) => ({
      ...current,
      [moduleId]: { ...current[moduleId], [fieldId]: value },
    }));
  };

  const exportProfile = () => {
    const automationConfig = Object.fromEntries(
      modules.map((module) => [
        module.id,
        {
          enabled: module.enabled,
          settings: Object.fromEntries(module.fields.map((field) => [field.id, moduleConfigs[module.id]?.[field.id] ?? field.value])),
        },
      ]),
    );
    const payload = {
      schemaVersion: 1,
      launcher: 'Bloom Client',
      profile: selectedProfile,
      launcherSettings: settings,
      automationScope: 'singleplayer-or-explicitly-authorized-servers',
      notice: 'Конфигурация для совместимых модов. Сам лаунчер не внедряет и не исполняет игровые автоматизации.',
      generatedAt: new Date().toISOString(),
      automations: automationConfig,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bloom-${selectedProfile.id}-profile.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('JSON-профиль скачан');
  };

  const chooseProfile = (profileId: string) => {
    const profile = PROFILES.find((item) => item.id === profileId);
    setSelectedProfileId(profileId);
    if (profile) showToast(`Выбран профиль «${profile.name}»`);
  };

  const updateSettings = (patch: Partial<LauncherSettings>) => setSettings((current) => ({ ...current, ...patch }));

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? 'sidebar-open' : ''}`}>
        <button className="brand-lockup" type="button" onClick={() => changePage('home')} aria-label="Bloom Client — на главную">
          <IconMark />
          <span className="brand-wordmark">
            <span>BLOOM</span>
            <small>MINECRAFT CLIENT</small>
          </span>
        </button>

        <div className="sidebar-section-label">РАБОЧЕЕ ПРОСТРАНСТВО</div>
        <nav className="sidebar-nav" aria-label="Основная навигация">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                type="button"
                key={item.id}
                className={`nav-item ${activePage === item.id ? 'nav-item-active' : ''}`}
                onClick={() => changePage(item.id)}
              >
                <Icon size={18} strokeWidth={1.8} />
                <span>{item.label}</span>
                {item.id === 'automation' && <span className="nav-count">{enabledCount}</span>}
                {activePage === item.id && <span className="nav-active-mark" />}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-spacer" />
        <div className="sidebar-help-card">
          <div className="help-icon"><CircleHelp size={17} /></div>
          <div>
            <strong>Нужна помощь?</strong>
            <span>Посмотри, как работает лаунчер</span>
          </div>
          <ArrowUpRight size={15} className="help-arrow" />
        </div>
        <div className="sidebar-account">
          <div className="account-avatar"><UserRound size={19} /></div>
          <div className="account-label">
            <strong>Гость</strong>
            <span>Аккаунт не подключён</span>
          </div>
          <button className="account-add" type="button" aria-label="Подключить аккаунт" onClick={() => setModal({ type: 'auth' })}>
            <ArrowUpRight size={16} />
          </button>
        </div>
        <div className="sidebar-version"><span className="version-dot" /> UI · DEMO <span>v0.2</span></div>
      </aside>

      <main className="main-shell">
        <header className="topbar">
          <button className="mobile-menu-button" type="button" aria-label="Открыть меню" onClick={() => setMobileNavOpen((open) => !open)}>
            {mobileNavOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
          <div className="breadcrumbs">
            <span>РАБОЧЕЕ ПРОСТРАНСТВО</span>
            <ChevronRight size={14} />
            <strong>{PAGE_TITLES[activePage]}</strong>
          </div>
          <div className="topbar-actions">
            <div className="preview-badge"><span /> ДЕМО-РЕЖИМ</div>
            <button className="top-account-button" type="button" onClick={() => setModal({ type: 'auth' })}>
              <span className="top-avatar"><UserRound size={15} /></span>
              <span>Войти</span>
              <ChevronDown size={14} />
            </button>
          </div>
        </header>

        <div className="page-content">
          {activePage === 'home' && (
            <HomePage
              profile={selectedProfile}
              modules={modules}
              enabledCount={enabledCount}
              onOpenLaunch={() => setModal({ type: 'launch' })}
              onOpenAutomation={() => changePage('automation')}
              onOpenBuilds={() => changePage('builds')}
              onToggleModule={toggleModule}
              onOpenSettings={() => changePage('settings')}
            />
          )}
          {activePage === 'automation' && (
            <AutomationPage
              modules={modules}
              enabledCount={enabledCount}
              onToggleModule={toggleModule}
              onConfigure={(moduleId) => setModal({ type: 'module', moduleId })}
              onExport={exportProfile}
            />
          )}
          {activePage === 'builds' && (
            <BuildsPage
              profiles={PROFILES}
              selectedProfile={selectedProfile}
              onChoose={chooseProfile}
            />
          )}
          {activePage === 'settings' && (
            <SettingsPage settings={settings} onUpdate={updateSettings} onSave={() => showToast('Настройки сохранены на этом устройстве')} />
          )}
        </div>
      </main>

      {mobileNavOpen && <button className="mobile-nav-backdrop" type="button" aria-label="Закрыть меню" onClick={() => setMobileNavOpen(false)} />}
      {toast && <div className="toast"><span className="toast-check"><Check size={14} /></span>{toast}</div>}
      {modal && (
        <ModalFrame onClose={() => setModal(null)}>
          {modal.type === 'launch' && <LaunchDialog onClose={() => setModal(null)} onOpenSettings={() => { setModal(null); changePage('settings'); }} />}
          {modal.type === 'auth' && <AuthDialog onClose={() => setModal(null)} />}
          {modal.type === 'module' && (
            <ModuleDialog
              module={modules.find((item) => item.id === modal.moduleId) ?? modules[0]}
              values={moduleConfigs[modal.moduleId] ?? {}}
              onChange={(fieldId, value) => changeModuleField(modal.moduleId, fieldId, value)}
              onClose={() => setModal(null)}
              onSave={() => { setModal(null); showToast('Параметры автоматизации сохранены'); }}
            />
          )}
        </ModalFrame>
      )}
    </div>
  );
}

function HomePage({
  profile,
  modules,
  enabledCount,
  onOpenLaunch,
  onOpenAutomation,
  onOpenBuilds,
  onToggleModule,
  onOpenSettings,
}: {
  profile: GameProfile;
  modules: AutomationModule[];
  enabledCount: number;
  onOpenLaunch: () => void;
  onOpenAutomation: () => void;
  onOpenBuilds: () => void;
  onToggleModule: (moduleId: string) => void;
  onOpenSettings: () => void;
}) {
  const shortcuts = modules.slice(0, 4);
  const ProfileIcon = profile.icon;

  return (
    <>
      <section className="hero-card">
        <div className="hero-art" />
        <div className="hero-shade" />
        <div className="hero-content">
          <div className="hero-eyebrow"><span className="hero-eyebrow-dot" /> МИР НАЧИНАЕТСЯ ЗДЕСЬ</div>
          <h1>Твой мир.<br /><span>Твои правила.</span></h1>
          <p>Собери игру под себя: профили, комфортные настройки и всё нужное для следующего приключения.</p>
          <div className="hero-actions">
            <button className="button button-primary hero-play-button" type="button" onClick={onOpenLaunch}>
              <Play size={16} fill="currentColor" />
              <span>Запустить игру</span>
              <ArrowUpRight size={16} className="button-trailing" />
            </button>
            <button className="button button-glass" type="button" onClick={onOpenBuilds}>Мои сборки <ArrowRight size={15} /></button>
          </div>
        </div>
        <div className="hero-side-meta">
          <div className="hero-chip"><span className="chip-mark"><ProfileIcon size={14} /></span><span><small>АКТИВНЫЙ ПРОФИЛЬ</small><strong>{profile.name}</strong></span><ChevronDown size={15} /></div>
          <div className="hero-meta-grid">
            <div><span>ВЕРСИЯ</span><strong>{profile.version}</strong></div>
            <div><span>ЗАГРУЗЧИК</span><strong>{profile.loader}</strong></div>
            <div><span>МОДЫ</span><strong>{profile.mods === 0 ? 'Без модов' : `${profile.mods} модов`}</strong></div>
          </div>
        </div>
        <div className="hero-decoration" aria-hidden="true"><span>01</span><i /><i /><i /></div>
      </section>

      <div className="section-heading home-section-heading">
        <div>
          <div className="section-kicker">ПАНЕЛЬ УПРАВЛЕНИЯ</div>
          <h2>Всё под контролем</h2>
        </div>
        <button type="button" className="text-button" onClick={onOpenSettings}>Настроить лаунчер <ArrowRight size={15} /></button>
      </div>

      <div className="dashboard-grid">
        <section className="surface-card automation-summary">
          <div className="card-heading-row">
            <div className="card-title-group">
              <div className="card-icon card-icon-lime"><Zap size={17} fill="currentColor" /></div>
              <div><h3>Автоматизация</h3><p>Настройки игровых сценариев</p></div>
            </div>
            <button type="button" className="icon-button subtle-icon-button" aria-label="Все автоматизации" onClick={onOpenAutomation}><ArrowUpRight size={17} /></button>
          </div>
          <div className="automation-summary-content">
            <div className="automation-counter"><strong>{String(enabledCount).padStart(2, '0')}</strong><span>/ {String(modules.length).padStart(2, '0')} включено</span><div className="counter-track"><span style={{ width: `${(enabledCount / modules.length) * 100}%` }} /></div></div>
            <div className="quick-module-list">
              {shortcuts.slice(0, 3).map((module) => {
                const Icon = module.icon;
                return (
                  <div className="quick-module-row" key={module.id}>
                    <div className={`quick-module-icon tint-${module.tint}`}><Icon size={15} /></div>
                    <span className="quick-module-name">{module.title}</span>
                    <Switch checked={module.enabled} label={`${module.enabled ? 'Выключить' : 'Включить'}: ${module.title}`} onChange={() => onToggleModule(module.id)} />
                  </div>
                );
              })}
            </div>
          </div>
          <div className="card-footnote"><ShieldCheck size={14} /> Переключатели сохраняют профиль, не исполняют моды</div>
        </section>

        <section className="surface-card profile-summary">
          <div className="card-heading-row">
            <div className="card-title-group">
              <div className="card-icon card-icon-violet"><Layers size={17} /></div>
              <div><h3>Твоя сборка</h3><p>Выбранный игровой профиль</p></div>
            </div>
            <button type="button" className="icon-button subtle-icon-button" aria-label="Открыть сборки" onClick={onOpenBuilds}><ArrowUpRight size={17} /></button>
          </div>
          <div className="profile-preview">
            <div className={`profile-art profile-art-${profile.accent}`}><ProfileIcon size={26} strokeWidth={1.5} /><span className="profile-art-stamp">{profile.loader}</span></div>
            <div className="profile-name-block"><div className="profile-name-row"><h4>{profile.name}</h4><span className="profile-status-dot" /></div><p>{profile.description}</p></div>
          </div>
          <div className="profile-specs">
            <div><span>ВЕРСИЯ ИГРЫ</span><strong>{profile.version}</strong></div>
            <div><span>ПАМЯТЬ</span><strong>{profile.ram} GB</strong></div>
            <div><span>МОДЫ</span><strong>{profile.mods}</strong></div>
          </div>
          <button type="button" className="wide-quiet-button" onClick={onOpenBuilds}>Управление профилями <ArrowRight size={15} /></button>
        </section>
      </div>

      <div className="lower-grid">
        <section className="surface-card runtime-card">
          <div className="card-heading-row runtime-heading">
            <div className="card-title-group">
              <div className="card-icon card-icon-blue"><Monitor size={17} /></div>
              <div><h3>Среда запуска</h3><p>Проверка перед подключением игры</p></div>
            </div>
            <span className="status-tag status-tag-muted"><span /> Не подключена</span>
          </div>
          <div className="runtime-check-list">
            <div className="runtime-check-row"><span className="runtime-check-icon runtime-icon-ok"><Check size={13} /></span><span><strong>Интерфейс лаунчера</strong><small>Интерфейс лаунчера активен</small></span><span className="runtime-row-state">ГОТОВО</span></div>
            <div className="runtime-check-row"><span className="runtime-check-icon runtime-icon-pending"><HardDrive size={13} /></span><span><strong>Java Runtime</strong><small>Проверка Java пока не подключена</small></span><span className="runtime-row-state runtime-state-pending">НЕ ПРОВЕРЕНА</span></div>
            <div className="runtime-check-row"><span className="runtime-check-icon runtime-icon-pending"><UserRound size={13} /></span><span><strong>Аккаунт Microsoft</strong><small>Без авторизации запуск недоступен</small></span><span className="runtime-row-state runtime-state-pending">НЕ ПОДКЛЮЧЁН</span></div>
          </div>
          <button type="button" className="text-button runtime-settings-link" onClick={onOpenSettings}>Параметры запуска <ArrowRight size={15} /></button>
        </section>

        <section className="surface-card note-card">
          <div className="note-topline"><span className="note-icon"><Info size={15} /></span><span>ВАЖНО</span><span className="note-line" /></div>
          <h3>Игра честнее,<br />когда правила ясны.</h3>
          <p>Автоматизации — это только конфигурации для совместимых модов. Используй их в одиночной игре или там, где сервер разрешает такие инструменты.</p>
          <button type="button" className="note-link" onClick={onOpenAutomation}>Настроить автоматизации <ArrowUpRight size={14} /></button>
          <div className="note-orb note-orb-one" /><div className="note-orb note-orb-two" />
        </section>
      </div>
    </>
  );
}

function AutomationPage({
  modules,
  enabledCount,
  onToggleModule,
  onConfigure,
  onExport,
}: {
  modules: AutomationModule[];
  enabledCount: number;
  onToggleModule: (moduleId: string) => void;
  onConfigure: (moduleId: string) => void;
  onExport: () => void;
}) {
  const [filter, setFilter] = useState<'all' | 'enabled'>('all');
  const [search, setSearch] = useState('');
  const visibleModules = useMemo(
    () => modules.filter((module) => (filter === 'all' || module.enabled) && `${module.title} ${module.group} ${module.description}`.toLowerCase().includes(search.toLowerCase())),
    [filter, modules, search],
  );

  return (
    <div className="subpage automation-page">
      <div className="page-heading-row">
        <div>
          <div className="section-kicker">КОНТРОЛЬ ИГРОВЫХ ЦИКЛОВ</div>
          <h1>Автоматизация</h1>
          <p>Собери удобный профиль и экспортируй настройки для совместимых модов.</p>
        </div>
        <button type="button" className="button button-primary export-button" onClick={onExport}><Download size={16} /> Экспортировать профиль</button>
      </div>

      <div className="safety-banner">
        <div className="safety-banner-icon"><ShieldCheck size={18} /></div>
        <div><strong>Только настройки — без внедрения в игру</strong><p>Эти переключатели сохраняют предпочтения и экспортируют JSON. Подключай исполняющие моды отдельно, только в одиночной игре или на серверах, где они разрешены.</p></div>
        <span className="safety-badge">ЛОКАЛЬНЫЙ ПРОФИЛЬ</span>
      </div>

      <div className="automation-toolbar">
        <div className="filter-tabs" role="tablist" aria-label="Фильтр автоматизаций">
          <button type="button" role="tab" aria-selected={filter === 'all'} className={filter === 'all' ? 'filter-tab filter-tab-active' : 'filter-tab'} onClick={() => setFilter('all')}>Все <span>{modules.length}</span></button>
          <button type="button" role="tab" aria-selected={filter === 'enabled'} className={filter === 'enabled' ? 'filter-tab filter-tab-active' : 'filter-tab'} onClick={() => setFilter('enabled')}>Включено <span>{enabledCount}</span></button>
        </div>
        <label className="search-field"><span className="sr-only">Поиск автоматизаций</span><SearchIcon /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Найти настройку…" /></label>
      </div>

      {visibleModules.length > 0 ? (
        <div className="module-grid">
          {visibleModules.map((module) => <AutomationCard key={module.id} module={module} onToggle={() => onToggleModule(module.id)} onConfigure={() => onConfigure(module.id)} />)}
        </div>
      ) : (
        <div className="empty-state"><div className="empty-state-icon"><SearchIcon /></div><h3>Ничего не найдено</h3><p>Попробуй изменить запрос или фильтр.</p><button type="button" className="text-button" onClick={() => { setSearch(''); setFilter('all'); }}>Сбросить фильтр</button></div>
      )}
      <div className="automation-footer"><Info size={15} /><span>Профиль хранится в этом браузере. JSON — это схема настроек, а не исполняемый мод или чит-клиент.</span></div>
    </div>
  );
}

function SearchIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.6" stroke="currentColor" strokeWidth="1.7" /><path d="m16 16 4.2 4.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>;
}

function AutomationCard({ module, onToggle, onConfigure }: { module: AutomationModule; onToggle: () => void; onConfigure: () => void }) {
  const Icon = module.icon;
  return (
    <article className={`module-card ${module.enabled ? 'module-card-enabled' : ''}`}>
      <div className="module-card-top">
        <div className={`module-icon tint-${module.tint}`}><Icon size={19} strokeWidth={1.8} /></div>
        <Switch checked={module.enabled} label={`${module.enabled ? 'Выключить' : 'Включить'}: ${module.title}`} onChange={onToggle} />
      </div>
      <div className="module-meta"><span className={`module-group group-${module.tint}`}>{module.group}</span><span className={`module-state ${module.enabled ? 'module-state-on' : ''}`}><i />{module.enabled ? 'Включено' : 'Выключено'}</span></div>
      <h3>{module.title}</h3>
      <p className="module-description">{module.description}</p>
      <div className="module-card-bottom"><span><SlidersHorizontal size={13} /> {module.fields.length} параметра</span><button type="button" onClick={onConfigure}>Настроить <ChevronRight size={15} /></button></div>
    </article>
  );
}

function BuildsPage({ profiles, selectedProfile, onChoose }: { profiles: GameProfile[]; selectedProfile: GameProfile; onChoose: (profileId: string) => void }) {
  return (
    <div className="subpage builds-page">
      <div className="page-heading-row">
        <div><div className="section-kicker">ТВОИ ВАРИАНТЫ ИГРЫ</div><h1>Сборки</h1><p>Выбери профиль, с которого начнётся следующая сессия.</p></div>
        <button type="button" className="button button-quiet" onClick={() => onChoose('vanilla')}><Gamepad2 size={16} /> Чистый профиль</button>
      </div>
      <div className="builds-notice"><div className="builds-notice-icon"><FolderOpen size={17} /></div><span>Это демонстрационные конфигурации. Установка игровых файлов и модов в браузерном прототипе не выполняется.</span></div>
      <div className="build-grid">
        {profiles.map((profile, index) => {
          const Icon = profile.icon;
          const selected = selectedProfile.id === profile.id;
          return (
            <article className={`build-card ${selected ? 'build-card-selected' : ''}`} key={profile.id}>
              <div className={`build-art build-art-${profile.accent}`}>
                <div className="build-art-grid" />
                <div className="build-art-symbol"><Icon size={34} strokeWidth={1.45} /></div>
                <span className="build-art-index">0{index + 1}</span>
                <span className="build-loader-chip">{profile.loader}</span>
              </div>
              <div className="build-card-body">
                <div className="build-card-title"><div><h3>{profile.name}</h3><p>{profile.description}</p></div>{selected && <span className="selected-check"><Check size={14} /></span>}</div>
                <div className="build-stats"><span><Monitor size={13} /> {profile.version}</span><span><Package size={13} /> {profile.mods} модов</span><span><HardDrive size={13} /> {profile.ram} GB RAM</span></div>
                <button type="button" className={selected ? 'button build-select-button build-select-active' : 'button build-select-button'} onClick={() => onChoose(profile.id)}>{selected ? <><Check size={15} /> Выбран</> : <>Выбрать профиль <ArrowRight size={15} /></>}</button>
              </div>
            </article>
          );
        })}
        <button type="button" className="build-card build-add-card" onClick={() => onChoose('survival')}>
          <span className="build-add-icon"><span>+</span></span><strong>Добавить сборку</strong><small>Импорт ZIP позже</small><span className="build-add-preview">СКОРО</span>
        </button>
      </div>
      <div className="builds-bottom-note"><Sparkles size={15} /><span>Профиль хранит загрузчик, версию игры и параметры памяти. Выбор сохраняется локально.</span></div>
    </div>
  );
}

function SettingsPage({ settings, onUpdate, onSave }: { settings: LauncherSettings; onUpdate: (patch: Partial<LauncherSettings>) => void; onSave: () => void }) {
  return (
    <div className="subpage settings-page">
      <div className="page-heading-row"><div><div className="section-kicker">ПЕРСОНАЛИЗАЦИЯ</div><h1>Настройки</h1><p>Настрой профиль запуска и локальные параметры.</p></div><button type="button" className="button button-primary" onClick={onSave}><Check size={16} /> Сохранить</button></div>
      <div className="settings-layout">
        <section className="surface-card settings-card">
          <div className="settings-card-heading"><div className="settings-card-icon"><Monitor size={17} /></div><div><h2>Игровая среда</h2><p>Пути и ресурсы для будущего запуска</p></div><span className="settings-coming-soon">DESKTOP</span></div>
          <label className="form-label" htmlFor="game-directory">Папка игры</label>
          <div className="input-with-icon"><FolderOpen size={16} /><input id="game-directory" value={settings.gameDirectory} onChange={(event) => onUpdate({ gameDirectory: event.target.value })} placeholder="Например, ~/games/minecraft" /></div>
          <span className="field-hint">Сейчас путь только сохраняется. Нативный выбор папки появится позже.</span>
          <label className="form-label java-label" htmlFor="java-path">Путь к Java</label>
          <div className="input-with-icon"><Activity size={16} /><input id="java-path" value={settings.javaPath} onChange={(event) => onUpdate({ javaPath: event.target.value })} placeholder="Автоматический поиск появится позже" /></div>
          <span className="field-hint">Для современных версий Minecraft обычно нужна совместимая Java 21.</span>
          <div className="form-divider" />
          <div className="memory-heading"><div><strong>Оперативная память</strong><span>Выделено для игрового профиля</span></div><div className="memory-value">{settings.memory}<small> GB</small></div></div>
          <input className="memory-slider" type="range" min="2" max="16" step="1" value={settings.memory} onChange={(event) => onUpdate({ memory: Number(event.target.value) })} aria-label="Оперативная память в гигабайтах" style={{ '--range-progress': `${((settings.memory - 2) / 14) * 100}%` } as React.CSSProperties} />
          <div className="slider-labels"><span>2 GB</span><span>8 GB</span><span>16 GB</span></div>
          <div className="memory-tip"><Info size={14} /> Не выделяй игре всю память компьютера — оставь запас системе.</div>
        </section>

        <aside className="settings-side-column">
          <section className="surface-card account-settings-card">
            <div className="settings-card-heading"><div className="settings-card-icon settings-account-icon"><UserRound size={17} /></div><div><h2>Аккаунт</h2><p>Авторизация Minecraft</p></div></div>
            <div className="account-connect-panel"><div className="account-connect-avatar"><UserRound size={20} /></div><div><strong>Вход не подключён</strong><span>Microsoft OAuth / Ely.by</span></div><span className="account-offline-dot" /></div>
            <div className="account-hint"><ShieldCheck size={15} /><span>Microsoft — только через официальный OAuth. Ely.by — лишь для серверов, где он явно разрешён. Интеграции пока не подключены.</span></div>
            <button type="button" className="button button-quiet account-connect-button" disabled><UserRound size={15} /> Подключить аккаунт <span>СКОРО</span></button>
          </section>
          <section className="surface-card settings-info-card">
            <div className="settings-info-symbol"><Zap size={18} /></div><h3>Всё останется<br />на твоём устройстве.</h3><p>Профили и переключатели хранятся локально. Пароли и токены не запрашиваются.</p><div className="settings-info-foot"><span className="local-dot" /> ЛОКАЛЬНОЕ ХРАНЕНИЕ</div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function ModalFrame({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="modal-panel" role="dialog" aria-modal="true">{children}</div>
    </div>
  );
}

function LaunchDialog({ onClose, onOpenSettings }: { onClose: () => void; onOpenSettings: () => void }) {
  return (
    <>
      <div className="dialog-top"><div className="dialog-icon dialog-icon-green"><Play size={18} fill="currentColor" /></div><button className="modal-close" type="button" onClick={onClose} aria-label="Закрыть"><X size={18} /></button></div>
      <div className="dialog-eyebrow">ПОДГОТОВКА К СЕССИИ</div><h2>Почти готово</h2>
      <p className="dialog-copy">Эта версия настраивает интерфейс и профили, но пока не запускает игровой процесс.</p>
      <div className="launch-checklist">
        <div className="launch-check-row"><span className="launch-check-ready"><Check size={13} /></span><span><strong>Профиль игры</strong><small>Можно выбрать и настроить</small></span><b>ГОТОВО</b></div>
        <div className="launch-check-row"><span className="launch-check-pending"><HardDrive size={13} /></span><span><strong>Java и файлы игры</strong><small>Java и файлы игры пока не подключены</small></span><b className="check-state-pending">ОЖИДАЕТ</b></div>
        <div className="launch-check-row"><span className="launch-check-pending"><UserRound size={13} /></span><span><strong>Провайдер аккаунта</strong><small>Microsoft OAuth или разрешённый Ely.by</small></span><b className="check-state-pending">ОЖИДАЕТ</b></div>
      </div>
      <div className="dialog-note"><Info size={15} /><span>Electron-оболочка готова; запуск игры, Java Runtime и официальный Microsoft OAuth пока не подключены.</span></div>
      <div className="dialog-actions"><button type="button" className="button button-quiet" onClick={onClose}>Понятно</button><button type="button" className="button button-primary" onClick={onOpenSettings}>Параметры запуска <ArrowRight size={15} /></button></div>
    </>
  );
}

function AuthDialog({ onClose }: { onClose: () => void }) {
  const [provider, setProvider] = useState<'microsoft' | 'elyby'>('microsoft');

  return (
    <>
      <div className="dialog-top"><div className="dialog-icon dialog-icon-blue"><UserRound size={18} /></div><button className="modal-close" type="button" onClick={onClose} aria-label="Закрыть"><X size={18} /></button></div>
      <div className="dialog-eyebrow">BLOOM ID · АККАУНТЫ</div><h2>Выбери способ входа</h2>
      <p className="dialog-copy">Поддерживаются только реальные аккаунты. Microsoft нужен для официальной игры; Ely.by подходит только серверам и сборкам, которые явно используют эту систему авторизации.</p>
      <div className="login-provider-list">
        <button type="button" className={`login-provider-option ${provider === 'microsoft' ? 'login-provider-selected' : ''}`} onClick={() => setProvider('microsoft')}>
          <div className="provider-mark provider-mark-microsoft">M</div>
          <span className="login-provider-copy"><strong>Microsoft</strong><small>Официальная учётная запись Minecraft</small></span>
          <span className="provider-status">СКОРО</span>
          {provider === 'microsoft' && <span className="provider-selected-check"><Check size={13} /></span>}
        </button>
        <button type="button" className={`login-provider-option ${provider === 'elyby' ? 'login-provider-selected' : ''}`} onClick={() => setProvider('elyby')}>
          <div className="provider-mark provider-mark-ely">E</div>
          <span className="login-provider-copy"><strong>Ely.by</strong><small>Только для совместимых серверов</small></span>
          <span className="provider-status">СКОРО</span>
          {provider === 'elyby' && <span className="provider-selected-check"><Check size={13} /></span>}
        </button>
      </div>
      <div className="dialog-note"><ShieldCheck size={15} /><span>{provider === 'elyby' ? 'Интеграция Ely.by не подключена. Она может использоваться только с серверами, где этот провайдер разрешён.' : 'Microsoft OAuth не подключён. Не вводи пароль в сторонние формы: вход должен идти через официальный процесс Microsoft.'} Вход только по нику недоступен.</span></div>
      <div className="dialog-actions"><button type="button" className="button button-quiet" onClick={onClose}>Закрыть</button><button type="button" className="button button-primary" disabled>Авторизация пока недоступна</button></div>
    </>
  );
}

function ModuleDialog({
  module,
  values,
  onChange,
  onClose,
  onSave,
}: {
  module: AutomationModule;
  values: Record<string, string>;
  onChange: (fieldId: string, value: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const Icon = module.icon;
  return (
    <>
      <div className="dialog-top"><div className={`dialog-icon tint-${module.tint}`}><Icon size={18} /></div><button className="modal-close" type="button" onClick={onClose} aria-label="Закрыть"><X size={18} /></button></div>
      <div className="dialog-eyebrow">{module.group.toUpperCase()} · ПАРАМЕТРЫ ПРОФИЛЯ</div><h2>{module.title}</h2><p className="dialog-copy">{module.description} Настройки сохраняются локально и попадут в экспортируемый JSON.</p>
      <div className="module-fields">
        {module.fields.map((field) => (
          <label className="form-label" key={field.id}>{field.label}<span className="select-wrap"><select value={values[field.id] ?? field.value} onChange={(event) => onChange(field.id, event.target.value)}>{field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><ChevronDown size={15} /></span></label>
        ))}
      </div>
      <div className="dialog-note"><ShieldCheck size={15} /><span>Конфигурация не исполняет действия в игре. Используй только там, где это разрешено.</span></div>
      <div className="dialog-actions"><button type="button" className="button button-quiet" onClick={onClose}>Отмена</button><button type="button" className="button button-primary" onClick={onSave}>Сохранить <Check size={15} /></button></div>
    </>
  );
}

export default App;
