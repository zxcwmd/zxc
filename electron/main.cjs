const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const DEV_SERVER_URL = 'http://localhost:5173';

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 900,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#090d0c',
    title: 'Bloom Client',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
    },
  });

  window.once('ready-to-show', () => window.show());

  if (app.isPackaged) {
    window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  } else {
    window.loadURL(DEV_SERVER_URL);
  }
}

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.bloomclient.desktop');
  }

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
