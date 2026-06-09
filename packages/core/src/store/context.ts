import { join } from 'node:path';
import { KeypairStore, type SealAdapter } from '../keypair/keypair-store.js';
import { IdlStore } from '../patcher/idl-store.js';
import { BlobStore } from './blob-store.js';
import { JsonFileSink, STORE_FORMAT_VERSION } from './persistence.js';
import { ProjectStore } from './project-store.js';
import { SessionStore } from './session-store.js';

export interface CoreContextOptions {
  dataDir: string;
  seal?: SealAdapter;
}

export class CoreContext {
  readonly projects: ProjectStore;
  readonly sessions: SessionStore;
  readonly blobs: BlobStore;
  readonly idls: IdlStore;
  readonly keypairs: KeypairStore;
  private readonly persistence: JsonFileSink;

  constructor(opts: CoreContextOptions) {
    this.projects = new ProjectStore();
    this.sessions = new SessionStore();
    this.blobs = new BlobStore(join(opts.dataDir, 'blobs'));
    this.idls = new IdlStore(join(opts.dataDir, 'idls'));
    this.keypairs = new KeypairStore(join(opts.dataDir, 'keypairs'), opts.seal);
    this.persistence = new JsonFileSink(join(opts.dataDir, 'store.json'));
  }

  async load(): Promise<void> {
    const snap = await this.persistence.load();
    if (!snap) return;
    this.projects.loadAll(snap.projects);
    this.sessions.loadAll(snap.sessions);
  }

  async save(): Promise<void> {
    await this.persistence.save({
      formatVersion: STORE_FORMAT_VERSION,
      projects: this.projects.exportAll(),
      sessions: this.sessions.exportAll(),
    });
  }
}
