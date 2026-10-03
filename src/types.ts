export type LoaderType = 'vanilla' | 'fabric' | 'quilt' | 'forge' | 'neoforge';
export type ContentType = 'mod' | 'resourcepack';
export type ModrinthProjectType = ContentType | 'modpack';
export type VersionType = 'release' | 'snapshot' | 'old_beta' | 'old_alpha';

export interface GameVersion {
  id: string;
  type: VersionType;
  releaseTime: string;
  url?: string;
}

export interface GameInstance {
  id: string;
  name: string;
  version: string;
  loader: LoaderType;
  loaderVersion?: string;
  createdAt: string;
  installed?: boolean;
  contentCount?: number;
  source?: 'profile' | 'modrinth';
  modpackProjectId?: string;
  modpackProjectTitle?: string;
  modpackVersionId?: string;
  missingPackFiles?: number;
}

export interface AccountSummary {
  id: string;
  name: string;
  uuid: string;
  provider: 'microsoft' | 'ely';
  avatarUrl: string;
}

export interface BootstrapState {
  desktop: true;
  appVersion: string;
  platform: string;
  dataDirectory: string;
  javaPath: string;
  accounts: AccountSummary[];
  activeAccountId: string | null;
  instances: GameInstance[];
  activeInstanceId: string | null;
  secureStorageAvailable: boolean;
  totalMemoryMb: number;
}

export interface LauncherEvent {
  kind: 'phase' | 'progress' | 'log' | 'started' | 'closed' | 'error';
  message: string;
  progress?: number;
  exitCode?: number;
}

export interface ModrinthProject {
  project_id: string;
  slug: string;
  title: string;
  description: string;
  icon_url: string | null;
  downloads: number;
  follows: number;
  categories: string[];
  latest_version: string;
  project_type: ModrinthProjectType | string;
}

export interface InstalledFile {
  name: string;
  size: number;
  modifiedAt: string;
}

export interface SkinState {
  skinDataUrl: string | null;
  capeDataUrl: string | null;
  source: 'microsoft' | 'ely' | 'preview' | 'default' | null;
}

export interface BloomBridge {
  getBootstrap(): Promise<BootstrapState>;
  getMinecraftVersions(): Promise<GameVersion[]>;
  createInstance(input: { name: string; version: string; loader: LoaderType }): Promise<GameInstance>;
  updateInstance(instanceId: string, patch: Partial<Pick<GameInstance, 'name' | 'version' | 'loader'>>): Promise<GameInstance>;
  deleteInstance(instanceId: string): Promise<void>;
  setActiveInstance(instanceId: string): Promise<void>;
  setActiveAccount(accountId: string | null): Promise<void>;
  loginMicrosoft(): Promise<AccountSummary>;
  loginEly(input: { username: string; password: string; totp?: string }): Promise<AccountSummary>;
  removeAccount(accountId: string): Promise<void>;
  launchGame(input: { instanceId: string; memoryGb: number; javaPath?: string }): Promise<{ accepted: true }>;
  onLauncherEvent(callback: (event: LauncherEvent) => void): () => void;
  searchModrinth(input: {
    query: string;
    type: ModrinthProjectType;
    version?: string;
    loader?: LoaderType | 'all';
    category?: string;
  }): Promise<ModrinthProject[]>;
  installModrinth(input: { projectId: string; instanceId: string; type: ContentType }): Promise<{ installed: string[] }>;
  installModrinthPack(input: { projectId: string; name?: string; gameVersion?: string; loader?: LoaderType }): Promise<GameInstance>;
  getInstalledContent(input: { instanceId: string; type: ContentType }): Promise<InstalledFile[]>;
  importLocalContent(input: { instanceId: string; type: ContentType }): Promise<{ imported: string[] }>;
  removeInstalledContent(input: { instanceId: string; type: ContentType; fileName: string }): Promise<void>;
  savePerformanceSettings(input: { instanceId: string; settings: PerformanceSettings }): Promise<void>;
  saveHudSettings(input: { instanceId: string; settings: HudSettings }): Promise<void>;
  chooseJavaExecutable(): Promise<string | null>;
  clearJavaExecutable(): Promise<void>;
  getSkin(accountId: string): Promise<SkinState>;
  uploadMicrosoftSkin(variant: 'classic' | 'slim'): Promise<SkinState | null>;
  openExternal(url: string): Promise<void>;
}

export interface PerformanceSettings {
  maxFps: number;
  renderDistance: number;
  simulationDistance: number;
  graphics: 'fast' | 'fancy';
  clouds: 'off' | 'fast' | 'fancy';
  particles: 'all' | 'decreased' | 'minimal';
  entityShadows: boolean;
  vsync: boolean;
  mipmapLevels: number;
}

export interface HudSettings {
  keystrokes: boolean;
  cps: boolean;
  armor: boolean;
  potions: boolean;
  coordinates: boolean;
  ping: boolean;
  clock: boolean;
  crosshair: boolean;
  scale: number;
  opacity: number;
  accent: 'mint' | 'violet' | 'ice';
}

declare global {
  interface Window {
    bloom?: BloomBridge;
  }
}
