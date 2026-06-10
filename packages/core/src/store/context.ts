import { join } from 'node:path';
import { KeypairStore, type SealAdapter } from '../keypair/keypair-store.js';
import { IdlStore } from '../patcher/idl-store.js';
import { BlobStore } from './blob-store.js';
import { ProjectManifestSink, SessionFolderSink } from './persistence.js';
import { ProjectStore } from './project-store.js';
import { SessionStore } from './session-store.js';

export interface CoreContextOptions {
  /**
   * Absolute path to the project root folder (the folder that contains `.relay.json`
   * and a `.relay/` directory). A single CoreContext represents one project.
   */
  projectRoot: string;
  seal?: SealAdapter;
}

export class CoreContext {
  readonly projects: ProjectStore;
  readonly sessions: SessionStore;
  readonly blobs: BlobStore;
  readonly idls: IdlStore;
  readonly keypairs: KeypairStore;
  readonly projectRoot: string;
  private readonly manifestSink: ProjectManifestSink;
  private readonly sessionSink: SessionFolderSink;

  constructor(opts: CoreContextOptions) {
    this.projectRoot = opts.projectRoot;
    const relayDir = join(opts.projectRoot, '.relay');
    this.blobs = new BlobStore(join(relayDir, 'blobs'));
    this.idls = new IdlStore(join(relayDir, 'idls'));
    this.keypairs = new KeypairStore(join(relayDir, 'keypairs'), opts.seal);
    this.projects = new ProjectStore();
    this.sessions = new SessionStore();
    this.manifestSink = new ProjectManifestSink(opts.projectRoot);
    this.sessionSink = new SessionFolderSink(join(relayDir, 'sessions'));
  }

  async load(): Promise<void> {
    const project = await this.manifestSink.load();
    if (project) this.projects.loadAll([project]);
    const sessions = await this.sessionSink.loadAll();
    this.sessions.loadAll(sessions);
  }

  async save(): Promise<void> {
    const projects = this.projects.exportAll();
    const first = projects[0];
    if (first) await this.manifestSink.save(first);
    await this.sessionSink.saveAll(this.sessions.exportAll());
  }

  /** Returns the single project's id (this context represents one project). */
  projectId(): string | null {
    const all = this.projects.exportAll();
    return all[0]?.id ?? null;
  }
}
