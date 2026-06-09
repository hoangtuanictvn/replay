declare global {
  interface Window {
    relay: {
      call(method: string, params?: unknown): Promise<unknown>;
      platform: 'darwin' | 'win32' | 'linux' | 'freebsd' | 'openbsd' | 'sunos' | 'aix' | string;
      window: {
        minimize(): void;
        maximize(): void;
        close(): void;
      };
    };
  }
}

export const api = {
  call: <T>(method: string, params?: unknown): Promise<T> =>
    window.relay.call(method, params) as Promise<T>,
  platform: window.relay.platform,
  windowCtl: window.relay.window,
};
