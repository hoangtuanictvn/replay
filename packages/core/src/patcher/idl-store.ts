import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Idl } from '@coral-xyz/anchor';

export interface IdlEntry {
  programId: string;
  idlName: string;
  source: 'manual' | 'onChain' | 'bundled';
  updatedAt: number;
}

export class IdlStore {
  private cache = new Map<string, Idl>();

  constructor(private readonly rootDir: string) {}

  private async ensureRoot(): Promise<void> {
    if (!existsSync(this.rootDir)) await mkdir(this.rootDir, { recursive: true });
  }

  private pathFor(programId: string): string {
    return join(this.rootDir, `${programId}.json`);
  }

  async attach(
    programId: string,
    idl: Idl,
    source: 'manual' | 'onChain' | 'bundled' = 'manual',
  ): Promise<IdlEntry> {
    await this.ensureRoot();
    this.cache.set(programId, idl);
    const wrapped = { __source: source, __updatedAt: Date.now(), idl };
    await writeFile(this.pathFor(programId), JSON.stringify(wrapped, null, 2));
    return {
      programId,
      idlName: idl.metadata?.name ?? programId,
      source,
      updatedAt: wrapped.__updatedAt,
    };
  }

  async detach(programId: string): Promise<void> {
    this.cache.delete(programId);
    if (existsSync(this.pathFor(programId))) {
      await unlink(this.pathFor(programId));
    }
  }

  async get(programId: string): Promise<Idl | null> {
    if (this.cache.has(programId)) return this.cache.get(programId) ?? null;
    const path = this.pathFor(programId);
    if (!existsSync(path)) return null;
    const raw = await readFile(path, 'utf8');
    const parsed = JSON.parse(raw) as { idl: Idl };
    this.cache.set(programId, parsed.idl);
    return parsed.idl;
  }

  async list(): Promise<IdlEntry[]> {
    if (!existsSync(this.rootDir)) return [];
    const files = await readdir(this.rootDir);
    const out: IdlEntry[] = [];
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      const programId = f.replace(/\.json$/, '');
      const raw = await readFile(join(this.rootDir, f), 'utf8');
      const parsed = JSON.parse(raw) as { __source?: string; __updatedAt?: number; idl: Idl };
      out.push({
        programId,
        idlName: parsed.idl.metadata?.name ?? programId,
        source: (parsed.__source as IdlEntry['source']) ?? 'manual',
        updatedAt: parsed.__updatedAt ?? 0,
      });
    }
    return out;
  }
}
