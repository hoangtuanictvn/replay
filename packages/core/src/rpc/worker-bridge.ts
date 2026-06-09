import type { MessagePort, Worker } from 'node:worker_threads';
import type { Dispatcher } from './dispatcher.js';
import type { RpcRequest, RpcResponse } from './protocol.js';

/**
 * Run as the worker side: dispatch incoming requests through the dispatcher and
 * post back responses. Caller passes the worker_threads parentPort.
 */
export function serveOnPort(port: MessagePort, dispatcher: Dispatcher): void {
  port.on('message', (msg: RpcRequest) => {
    void dispatcher.dispatch(msg).then((resp) => port.postMessage(resp));
  });
}

interface PendingCall {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
}

export class WorkerClient {
  private nextId = 1;
  private readonly pending = new Map<number, PendingCall>();

  constructor(private readonly worker: Worker) {
    worker.on('message', (msg: RpcResponse) => {
      const pending = this.pending.get(msg.id);
      if (!pending) return;
      this.pending.delete(msg.id);
      if ('error' in msg) {
        const err = new Error(msg.error.message);
        (err as Error & { code?: string }).code = msg.error.code;
        pending.reject(err);
      } else {
        pending.resolve(msg.result);
      }
    });
    worker.on('error', (err) => {
      for (const p of this.pending.values()) p.reject(err);
      this.pending.clear();
    });
  }

  call(method: string, params?: unknown): Promise<unknown> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, method, params } satisfies RpcRequest);
    });
  }
}
