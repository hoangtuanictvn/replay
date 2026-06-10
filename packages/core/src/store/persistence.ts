import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { ErrorCode, RelayError } from '@relay/shared';
import type { PersistenceSink, Project, SessionState, StoreSnapshot } from './types.js';

export const STORE_FORMAT_VERSION = 1;
const MANIFEST_NAME = '.relay.json';

/** Manifest sink: <projectRoot>/.relay.json holding the single Project object. */
export class ProjectManifestSink {
  private readonly path: string;

  constructor(projectRoot: string) {
    this.path = join(projectRoot, MANIFEST_NAME);
  }

  async load(): Promise<Project | null> {
    if (!existsSync(this.path)) return null;
    const raw = await readFile(this.path, 'utf8');
    const parsed = JSON.parse(raw, reviver) as Project & { formatVersion?: number };
    if (parsed.formatVersion && parsed.formatVersion !== STORE_FORMAT_VERSION) {
      throw new RelayError(
        ErrorCode.INTERNAL,
        `unsupported manifest formatVersion: ${parsed.formatVersion}`,
      );
    }
    backfill(parsed);
    return parsed;
  }

  async save(project: Project): Promise<void> {
    const dir = dirname(this.path);
    if (!existsSync(dir)) await mkdir(dir, { recursive: true });
    const wire = { formatVersion: STORE_FORMAT_VERSION, ...project };
    const tmp = `${this.path}.tmp`;
    await writeFile(tmp, JSON.stringify(wire, replacer, 2));
    await rename(tmp, this.path);
  }
}

/** Session sink: <projectRoot>/.relay/sessions/<sessionId>.json — one file per session. */
export class SessionFolderSink {
  constructor(private readonly dir: string) {}

  async loadAll(): Promise<SessionState[]> {
    if (!existsSync(this.dir)) return [];
    const entries = await readdir(this.dir);
    const out: SessionState[] = [];
    for (const e of entries) {
      if (!e.endsWith('.json')) continue;
      try {
        const raw = await readFile(join(this.dir, e), 'utf8');
        out.push(JSON.parse(raw, reviver) as SessionState);
      } catch {
        /* skip corrupt session file */
      }
    }
    return out;
  }

  async saveAll(sessions: SessionState[]): Promise<void> {
    if (!existsSync(this.dir)) await mkdir(this.dir, { recursive: true });
    const wanted = new Set(sessions.map((s) => `${s.id}.json`));
    for (const s of sessions) {
      const path = join(this.dir, `${s.id}.json`);
      const tmp = `${path}.tmp`;
      await writeFile(tmp, JSON.stringify(s, replacer, 2));
      await rename(tmp, path);
    }
    // Purge stale session files.
    try {
      const existing = await readdir(this.dir);
      for (const f of existing) {
        if (f.endsWith('.json') && !wanted.has(f)) {
          await unlink(join(this.dir, f)).catch(() => {});
        }
      }
    } catch {
      /* ignore */
    }
  }
}

/**
 * Legacy combined sink — retained only for backwards compat in tests/CLI that pass a
 * single store.json. New desktop runtime uses ProjectManifestSink + SessionFolderSink.
 */
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

function backfill(p: Project): void {
  if (!Array.isArray((p as { txTemplates?: unknown }).txTemplates)) {
    (p as { txTemplates: unknown[] }).txTemplates = [];
  }
  if (!Array.isArray((p as { workflows?: unknown }).workflows)) {
    (p as { workflows: unknown[] }).workflows = [];
  }
  if (!Array.isArray(p.patches)) p.patches = [];
  if (!Array.isArray(p.sessionIds)) p.sessionIds = [];
  if (!Array.isArray(p.scripts)) p.scripts = [];
  if (!Array.isArray(p.keypairRefs)) p.keypairRefs = [];
  if (!p.programs || typeof p.programs !== 'object') p.programs = {};
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
