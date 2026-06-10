import { join } from 'node:path';
import { BrowserWindow, Menu, app, ipcMain } from 'electron';
import { getAppStore } from './app-store';
import { registerIpc } from './ipc';
import {
  appHasOpenWindows,
  focusOrOpenProjectWindow,
  showWelcomeWindow,
} from './project-windows';
import { setWorkerScriptPath, shutdownAll } from './workerMgr';

function registerWindowControls(): void {
  ipcMain.on('relay:window:minimize', (e) => {
    BrowserWindow.fromWebContents(e.sender)?.minimize();
  });
  ipcMain.on('relay:window:maximize', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win) return;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  ipcMain.on('relay:window:close', (e) => {
    BrowserWindow.fromWebContents(e.sender)?.close();
  });
}

function buildMenu(): Menu {
  const isMac = process.platform === 'darwin';
  const store = getAppStore();

  const recents = store.recentProjects();
  const recentsSubmenu: Electron.MenuItemConstructorOptions[] = recents.length
    ? recents.map((r) => ({
        label: `${r.name}  —  ${r.path}`,
        click: () => focusOrOpenProjectWindow(r.path).catch((err) => console.error(err)),
      }))
    : [{ label: 'No recent projects', enabled: false }];

  const fileMenu: Electron.MenuItemConstructorOptions = {
    label: 'File',
    submenu: [
      {
        label: 'New Project…',
        accelerator: 'CmdOrCtrl+Shift+N',
        click: () => showWelcomeWindow(),
      },
      {
        label: 'Open Project…',
        accelerator: 'CmdOrCtrl+O',
        click: () => showWelcomeWindow(),
      },
      { type: 'separator' },
      {
        label: 'Open Recent',
        submenu: recentsSubmenu,
      },
      { type: 'separator' },
      {
        label: 'Close Window',
        accelerator: 'CmdOrCtrl+W',
        role: 'close',
      },
    ],
  };

  const template: Electron.MenuItemConstructorOptions[] = [];
  if (isMac) {
    template.push({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    });
  }
  template.push(fileMenu);
  template.push({ role: 'editMenu' });
  template.push({ role: 'viewMenu' });
  template.push({ role: 'windowMenu' });

  return Menu.buildFromTemplate(template);
}

function refreshMenu(): void {
  Menu.setApplicationMenu(buildMenu());
}

app.whenReady().then(async () => {
  setWorkerScriptPath(join(__dirname, 'worker.cjs'));

  await getAppStore().load();
  registerIpc();
  registerWindowControls();
  refreshMenu();

  // Refresh menu when recents change (every 5 seconds is sufficient; could be event-driven later).
  setInterval(refreshMenu, 5000);

  showWelcomeWindow();

  app.on('activate', () => {
    if (!appHasOpenWindows()) showWelcomeWindow();
  });
});

app.on('window-all-closed', async () => {
  await shutdownAll();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', async () => {
  await shutdownAll();
});
