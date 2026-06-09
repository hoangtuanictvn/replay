export const ErrorCode = {
  INVALID_INPUT: 'INVALID_INPUT',
  NOT_FOUND: 'NOT_FOUND',
  RPC_FAILURE: 'RPC_FAILURE',
  RPC_RATE_LIMITED: 'RPC_RATE_LIMITED',
  SVM_EXECUTION_FAILURE: 'SVM_EXECUTION_FAILURE',
  PROGRAM_LOAD_FAILURE: 'PROGRAM_LOAD_FAILURE',
  ACCOUNT_NOT_CLONABLE: 'ACCOUNT_NOT_CLONABLE',
  IDL_DECODE_FAILURE: 'IDL_DECODE_FAILURE',
  PATCH_APPLY_FAILURE: 'PATCH_APPLY_FAILURE',
  REPLAY_HYDRATE_FAILURE: 'REPLAY_HYDRATE_FAILURE',
  CACHE_IO_FAILURE: 'CACHE_IO_FAILURE',
  WORKER_CRASH: 'WORKER_CRASH',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INTERNAL: 'INTERNAL',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export class RelayError extends Error {
  readonly code: ErrorCode;
  readonly details: Record<string, unknown> | undefined;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'RelayError';
    this.code = code;
    this.details = details;
  }

  static is(value: unknown): value is RelayError {
    return value instanceof RelayError;
  }

  toJSON(): { code: ErrorCode; message: string; details?: Record<string, unknown> } {
    return {
      code: this.code,
      message: this.message,
      ...(this.details && { details: this.details }),
    };
  }
}
