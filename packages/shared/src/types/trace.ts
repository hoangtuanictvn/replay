import type { Base58String } from './primitives.js';

export interface LogLine {
  raw: string;
  level: 'log' | 'data' | 'invoke' | 'success' | 'failure' | 'consumed' | 'return' | 'unknown';
}

export interface DecodedEvent {
  name: string;
  data: Record<string, unknown>;
}

export interface TraceNode {
  programId: Base58String;
  depth: number;
  instructionIndex: number;
  cuConsumed: bigint;
  cuRemaining: bigint;
  logs: LogLine[];
  events: DecodedEvent[];
  returnData: Uint8Array | null;
  children: TraceNode[];
  error: string | null;
}
