import { BrowserWindow, dialog, ipcMain } from 'electron';
import { type RpcEndpoint, getAppStore } from './app-store';
import {
  closeWindowForProject,
  createProjectFolder,
  focusOrOpenProjectWindow,
} from './project-windows';
import { getClientForWindow } from './workerMgr';

const RPC_CHANNEL = 'relay:rpc';

export function registerIpc(): void {
  ipcMain.handle(RPC_CHANNEL, async (evt, method: string, params: unknown) => {
    try {
      if (method.startsWith('app.')) {
        const result = await handleAppMethod(evt.sender, method, params);
        return { ok: true, result };
      }
      const senderWin = BrowserWindow.fromWebContents(evt.sender);
      const client = senderWin ? getClientForWindow(senderWin.id) : null;
      if (!client) {
        return {
          ok: false,
          error: { code: 'NO_PROJECT', message: 'no project open in this window' },
        };
      }
      const result = await client.call(method, params);
      return { ok: true, result };
    } catch (err) {
      const e = err as Error & { code?: string };
      return { ok: false, error: { code: e.code ?? 'INTERNAL', message: e.message } };
    }
  });
}

async function handleAppMethod(
  sender: Electron.WebContents,
  method: string,
  params: unknown,
): Promise<unknown> {
  const store = getAppStore();
  const p = (params ?? {}) as Record<string, unknown>;
  switch (method) {
    case 'app.recentProjects':
      return store.recentProjects();

    case 'app.removeRecent':
      await store.removeRecent(String(p.path));
      return { ok: true };

    case 'app.openProjectPicker': {
      const win = BrowserWindow.fromWebContents(sender);
      const r = await dialog.showOpenDialog(win!, {
        properties: ['openDirectory'],
        title: 'Open Relay Project',
      });
      if (r.canceled || r.filePaths.length === 0) return { canceled: true };
      const path = r.filePaths[0];
      await focusOrOpenProjectWindow(path);
      return { path };
    }

    case 'app.newProjectPicker': {
      const win = BrowserWindow.fromWebContents(sender);
      const r = await dialog.showOpenDialog(win!, {
        properties: ['openDirectory', 'createDirectory'],
        title: 'Choose folder for new Relay project',
      });
      if (r.canceled || r.filePaths.length === 0) return { canceled: true };
      const path = r.filePaths[0];
      const name = String(p.name ?? '').trim() || pathBasename(path);
      const rpcEndpointId = String(p.rpcEndpointId ?? 'mainnet-public');
      const network = String(p.network ?? 'mainnet-beta');
      await createProjectFolder(path, {
        name,
        network: network as RpcEndpoint['network'],
        rpcEndpointId,
      });
      await focusOrOpenProjectWindow(path);
      return { path };
    }

    case 'app.openProjectByPath': {
      const path = String(p.path);
      await focusOrOpenProjectWindow(path);
      return { path };
    }

    case 'app.showWelcome': {
      const { showWelcomeWindow } = require('./project-windows') as {
        showWelcomeWindow: () => unknown;
      };
      showWelcomeWindow();
      return { ok: true };
    }

    case 'app.closeProjectWindow': {
      const win = BrowserWindow.fromWebContents(sender);
      if (win) closeWindowForProject(win.id);
      return { ok: true };
    }

    case 'app.rpcEndpoints':
      return store.rpcEndpoints();

    case 'app.upsertRpcEndpoint':
      await store.upsertRpc(p as unknown as RpcEndpoint);
      return { ok: true };

    case 'app.deleteRpcEndpoint':
      await store.deleteRpc(String(p.id));
      return { ok: true };

    case 'app.preferences':
      return store.preferences();

    case 'app.setPreferences':
      await store.setPreferences(p as Record<string, unknown>);
      return store.preferences();

    case 'app.projectInfo': {
      const win = BrowserWindow.fromWebContents(sender);
      if (!win) return null;
      return getProjectInfoForWindow(win.id);
    }

    default:
      throw new Error(`unknown app method: ${method}`);
  }
}

function pathBasename(p: string): string {
  return p.split(/[\\/]/).filter(Boolean).pop() ?? 'project';
}

function getProjectInfoForWindow(
  windowId: number,
): { path: string; name: string } | null {
  // Lazy import to avoid circular dep.
  const { getProjectInfoForWindow: impl } = require('./project-windows') as {
    getProjectInfoForWindow: (id: number) => { path: string; name: string } | null;
  };
  return impl(windowId);
}
