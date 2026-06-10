import { homedir } from 'node:os';
import { join } from 'node:path';
import { CoreContext, Dispatcher, buildHandlers } from '@relay/core';

export interface HostOptions {
  projectRoot?: string;
}

export function defaultProjectRoot(): string {
  return process.env.RELAY_PROJECT_ROOT ?? join(homedir(), '.relay-cli-project');
}

export async function createHost(opts: HostOptions = {}): Promise<{
  ctx: CoreContext;
  dispatcher: Dispatcher;
}> {
  const projectRoot = opts.projectRoot ?? defaultProjectRoot();
  const ctx = new CoreContext({ projectRoot });
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
