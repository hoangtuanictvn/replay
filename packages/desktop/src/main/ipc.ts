import { ipcMain } from 'electron';
import { getClient } from './workerMgr';

const RPC_CHANNEL = 'relay:rpc';

export function registerIpc(): void {
  ipcMain.handle(RPC_CHANNEL, async (_evt, method: string, params: unknown) => {
    try {
      const result = await getClient().call(method, params);
      return { ok: true, result };
    } catch (err) {
      const e = err as Error & { code?: string };
      return { ok: false, error: { code: e.code ?? 'INTERNAL', message: e.message } };
    }
  });
}
