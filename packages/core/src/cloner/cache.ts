import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sha256Hex } from '../util/hash.js';

export interface CacheKey {
  network: string;
  kind: 'account' | 'programElf';
  address: string;
  slot: bigint | null;
}

export class BlobCache {
  constructor(private readonly rootDir: string) {}

  private async ensureRoot(): Promise<void> {
    if (!existsSync(this.rootDir)) {
      await mkdir(this.rootDir, { recursive: true });
    }
  }

  private keyPath(key: CacheKey): string {
    const slotStr = key.slot === null ? 'latest' : key.slot.toString();
    const hash = sha256Hex(Buffer.from(`${key.network}|${key.kind}|${key.address}|${slotStr}`));
    return join(this.rootDir, `${hash}.bin`);
  }

  async get(key: CacheKey): Promise<Uint8Array | null> {
    const path = this.keyPath(key);
    if (!existsSync(path)) return null;
    const buf = await readFile(path);
    return new Uint8Array(buf);
  }

  async set(key: CacheKey, data: Uint8Array): Promise<void> {
    await this.ensureRoot();
    await writeFile(this.keyPath(key), data);
  }
}
