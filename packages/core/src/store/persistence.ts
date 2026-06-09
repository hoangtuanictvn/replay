import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { ErrorCode, RelayError } from '@relay/shared';
import type { PersistenceSink, StoreSnapshot } from './types.js';

export const STORE_FORMAT_VERSION = 1;

export class JsonFileSink implements PersistenceSink {
  constructor(private readonly path: string) {}

  async load(): Promise<StoreSnapshot | null> {
    if (!existsSync(this.path)) return null;
    const raw = await readFile(this.path, 'utf8');
    const parsed = JSON.parse(raw, reviver) as StoreSnapshot;
    if (parsed.formatVersion !== STORE_FORMAT_VERSION) {
      throw new RelayError(
        ErrorCode.INTERNAL,
        `unsupported store formatVersion: ${parsed.formatVersion}`,
      );
    }
    return parsed;
  }

  async save(snapshot: StoreSnapshot): Promise<void> {
    const dir = dirname(this.path);
    if (!existsSync(dir)) await mkdir(dir, { recursive: true });
    const tmp = `${this.path}.tmp`;
    await writeFile(tmp, JSON.stringify(snapshot, replacer, 2));
    await rename(tmp, this.path);
  }
}

function replacer(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') return { __bigint: value.toString() };
  if (value instanceof Uint8Array) return { __bytes: Buffer.from(value).toString('base64') };
  return value;
}

function reviver(_key: string, value: unknown): unknown {
  if (value && typeof value === 'object') {
    const v = value as { __bigint?: string; __bytes?: string };
    if (typeof v.__bigint === 'string') return BigInt(v.__bigint);
    if (typeof v.__bytes === 'string') return new Uint8Array(Buffer.from(v.__bytes, 'base64'));
  }
  return value;
}
