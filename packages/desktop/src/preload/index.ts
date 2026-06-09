import { contextBridge, ipcRenderer } from 'electron';

const RPC_CHANNEL = 'relay:rpc';

const api = {
  call: async (method: string, params?: unknown): Promise<unknown> => {
    const resp = (await ipcRenderer.invoke(RPC_CHANNEL, method, params)) as
      | { ok: true; result: unknown }
      | { ok: false; error: { code: string; message: string } };
    if (!resp.ok) {
      const err = new Error(resp.error.message);
      (err as Error & { code?: string }).code = resp.error.code;
      throw err;
    }
    return resp.result;
  },
  platform: process.platform,
  window: {
    minimize: () => ipcRenderer.send('relay:window:minimize'),
    maximize: () => ipcRenderer.send('relay:window:maximize'),
    close: () => ipcRenderer.send('relay:window:close'),
  },
};

contextBridge.exposeInMainWorld('relay', api);

export type RelayApi = typeof api;
