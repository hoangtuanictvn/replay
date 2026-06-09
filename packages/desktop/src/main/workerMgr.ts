import { createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import { WorkerClient } from '@relay/core';
import { app, safeStorage } from 'electron';

interface WorkerSealRequest {
  __relaySeal: true;
  id: number;
  op: 'seal' | 'unseal';
  payload: string; // base64
}

export interface WorkerHandle {
  worker: Worker;
  client: WorkerClient;
}

let current: WorkerHandle | null = null;
let workerScriptPath: string | null = null;
let onReady: (() => void) | null = null;

export function setWorkerScriptPath(p: string): void {
  workerScriptPath = p;
}

export function spawnWorker(): WorkerHandle {
  if (!workerScriptPath) throw new Error('worker script path not set');

  const dataDir = join(app.getPath('userData'), 'data');
  const defaultRpcUrl = process.env.RELAY_RPC_URL ?? 'https://api.mainnet-beta.solana.com';

  const logPath = join(app.getPath('userData'), 'worker.log');
  const logStream = createWriteStream(logPath, { flags: 'a' });
  logStream.write(`\n=== worker spawn at ${new Date().toISOString()} ===\n`);

  const sealAvailable = safeStorage.isEncryptionAvailable();

  const worker = new Worker(workerScriptPath, {
    workerData: { dataDir, defaultRpcUrl, sealAvailable },
    stdout: true,
    stderr: true,
  });

  // Worker → main seal/unseal sub-protocol
  worker.on('message', (msg: unknown) => {
    if (!msg || typeof msg !== 'object') return;
    const m = msg as Partial<WorkerSealRequest>;
    if (!m.__relaySeal || m.id === undefined || !m.op || m.payload === undefined) return;
    try {
      const input = Buffer.from(m.payload, 'base64');
      if (!sealAvailable) {
        worker.postMessage({
          __relaySealReply: true,
          id: m.id,
          ok: false,
          error: 'safeStorage not available on this platform',
        });
        return;
      }
      let result: Buffer;
      if (m.op === 'seal') {
        result = safeStorage.encryptString(input.toString('binary'));
      } else {
        result = Buffer.from(safeStorage.decryptString(input), 'binary');
      }
      worker.postMessage({
        __relaySealReply: true,
        id: m.id,
        ok: true,
        result: result.toString('base64'),
      });
    } catch (err) {
      worker.postMessage({
        __relaySealReply: true,
        id: m.id,
        ok: false,
        error: (err as Error).message,
      });
    }
  });
  worker.stdout?.pipe(logStream);
  worker.stderr?.pipe(logStream);

  const client = new WorkerClient(worker);

  worker.on('exit', (code) => {
    logStream.write(`[exit ${code}]\n`);
    console.log(`[workerMgr] worker exited with code ${code}; log: ${logPath}`);
    if (current?.worker === worker) {
      current = null;
      setTimeout(() => {
        try {
          spawnWorker();
        } catch (e) {
          console.error('[workerMgr] respawn failed:', e);
        }
      }, 300);
    }
  });

  worker.on('error', (err) => {
    logStream.write(`[error] ${err.stack ?? err.message}\n`);
    console.error('[workerMgr] worker error:', err);
  });

  worker.on('message', (msg) => {
    if (msg && typeof msg === 'object' && (msg as { event?: string }).event === 'ready') {
      onReady?.();
    }
  });

  current = { worker, client };
  return current;
}

export function getClient(): WorkerClient {
  if (!current) throw new Error('worker not running');
  return current.client;
}

export function awaitReady(): Promise<void> {
  return new Promise((resolve) => {
    onReady = () => resolve();
    setTimeout(resolve, 2000);
  });
}

export async function shutdown(): Promise<void> {
  if (!current) return;
  await current.worker.terminate();
  current = null;
}
