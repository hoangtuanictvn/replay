export interface RpcRequest {
  id: number;
  method: string;
  params?: unknown;
}

export interface RpcResponseOk {
  id: number;
  result: unknown;
}

export interface RpcResponseErr {
  id: number;
  error: { code: string; message: string; details?: Record<string, unknown> };
}

export type RpcResponse = RpcResponseOk | RpcResponseErr;

export interface RpcEvent {
  event: string;
  payload: unknown;
}

export type RpcHandler = (params: unknown) => Promise<unknown> | unknown;
export type HandlerMap = Record<string, RpcHandler>;
