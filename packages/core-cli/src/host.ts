import { homedir } from 'node:os';
import { join } from 'node:path';
import { CoreContext, Dispatcher, buildHandlers } from '@relay/core';

export interface HostOptions {
  dataDir?: string;
}

export function defaultDataDir(): string {
  return process.env.RELAY_DATA_DIR ?? join(homedir(), '.relay');
}

export async function createHost(opts: HostOptions = {}): Promise<{
  ctx: CoreContext;
  dispatcher: Dispatcher;
}> {
  const dataDir = opts.dataDir ?? defaultDataDir();
  const ctx = new CoreContext({ dataDir });
  await ctx.load();

  const dispatcher = new Dispatcher(
    buildHandlers({
      ctx,
      resolveRpcUrl: (endpointId) => {
        if (process.env.RELAY_RPC_URL) return process.env.RELAY_RPC_URL;
        if (endpointId.startsWith('http://') || endpointId.startsWith('https://')) {
          return endpointId;
        }
        return 'https://api.mainnet-beta.solana.com';
      },
      persist: () => ctx.save(),
    }),
  );

  return { ctx, dispatcher };
}
