import { parentPort, workerData } from 'node:worker_threads';
import { CoreContext, Dispatcher, buildHandlers, serveOnPort } from '@relay/core';
import { createWorkerSealAdapter } from './worker-seal';

interface WorkerInit {
  dataDir: string;
  defaultRpcUrl: string;
  sealAvailable: boolean;
}

async function main(): Promise<void> {
  if (!parentPort) throw new Error('worker must be launched with parentPort');

  const init = workerData as WorkerInit;
  const seal = createWorkerSealAdapter(parentPort, init.sealAvailable);
  const ctx = new CoreContext({ dataDir: init.dataDir, seal });
  await ctx.load();

  const dispatcher = new Dispatcher(
    buildHandlers({
      ctx,
      resolveRpcUrl: (endpointId) => {
        if (endpointId.startsWith('http://') || endpointId.startsWith('https://')) {
          return endpointId;
        }
        return init.defaultRpcUrl;
      },
      persist: () => ctx.save(),
    }),
  );

  serveOnPort(parentPort, dispatcher);
  parentPort.postMessage({ event: 'ready', payload: { pid: process.pid } });
}

main().catch((err) => {
  console.error('worker init failed:', err);
  process.exit(1);
});
