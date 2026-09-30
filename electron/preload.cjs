const { contextBridge, ipcRenderer } = require('electron');

const api = {
  getBootstrap: () => ipcRenderer.invoke('app:get-bootstrap'),
  getMinecraftVersions: () => ipcRenderer.invoke('game:get-versions'),
  createInstance: (input) => ipcRenderer.invoke('instance:create', input),
  updateInstance: (instanceId, patch) => ipcRenderer.invoke('instance:update', instanceId, patch),
  deleteInstance: (instanceId) => ipcRenderer.invoke('instance:delete', instanceId),
  setActiveInstance: (instanceId) => ipcRenderer.invoke('instance:set-active', instanceId),
  setActiveAccount: (accountId) => ipcRenderer.invoke('account:set-active', accountId),
  loginMicrosoft: () => ipcRenderer.invoke('account:login-microsoft'),
  loginEly: (input) => ipcRenderer.invoke('account:login-ely', input),
  removeAccount: (accountId) => ipcRenderer.invoke('account:remove', accountId),
  launchGame: (input) => ipcRenderer.invoke('game:launch', input),
  onLauncherEvent: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('launcher:event', listener);
    return () => ipcRenderer.removeListener('launcher:event', listener);
  },
  searchModrinth: (input) => ipcRenderer.invoke('modrinth:search', input),
  installModrinth: (input) => ipcRenderer.invoke('modrinth:install', input),
  getInstalledContent: (input) => ipcRenderer.invoke('content:list', input),
  importLocalContent: (input) => ipcRenderer.invoke('content:import', input),
  removeInstalledContent: (input) => ipcRenderer.invoke('content:remove', input),
  savePerformanceSettings: (input) => ipcRenderer.invoke('settings:performance', input),
  saveHudSettings: (input) => ipcRenderer.invoke('settings:hud', input),
  chooseJavaExecutable: () => ipcRenderer.invoke('settings:choose-java'),
  clearJavaExecutable: () => ipcRenderer.invoke('settings:clear-java'),
  getSkin: (accountId) => ipcRenderer.invoke('skin:get', accountId),
  uploadMicrosoftSkin: (variant) => ipcRenderer.invoke('skin:upload-microsoft', variant),
  openExternal: (url) => ipcRenderer.invoke('app:open-external', url),
};

contextBridge.exposeInMainWorld('bloom', api);
