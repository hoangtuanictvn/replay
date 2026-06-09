import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sha256Hex } from '../util/hash.js';

export class BlobStore {
  constructor(private readonly rootDir: string) {}

  private async ensureRoot(): Promise<void> {
    if (!existsSync(this.rootDir)) await mkdir(this.rootDir, { recursive: true });
  }

  private pathFor(hash: string): string {
    return join(this.rootDir, `${hash}.bin`);
  }

  async put(data: Uint8Array): Promise<string> {
    const hash = sha256Hex(data);
    await this.ensureRoot();
    const path = this.pathFor(hash);
    if (!existsSync(path)) {
      await writeFile(path, data);
    }
    return hash;
  }

  async get(hash: string): Promise<Uint8Array | null> {
    const path = this.pathFor(hash);
    if (!existsSync(path)) return null;
    return new Uint8Array(await readFile(path));
  }

  async has(hash: string): Promise<boolean> {
    return existsSync(this.pathFor(hash));
  }
}
