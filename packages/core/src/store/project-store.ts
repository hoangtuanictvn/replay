import { randomUUID } from 'node:crypto';
import { ErrorCode, RelayError } from '@relay/shared';
import type {
  AddAccountInput,
  AddProgramInput,
  CreateProjectInput,
  Project,
  ProjectMeta,
} from './types.js';

export class ProjectStore {
  private readonly projects = new Map<string, Project>();

  list(): ProjectMeta[] {
    return Array.from(this.projects.values()).map((p) => this.toMeta(p));
  }

  get(id: string): Project {
    const p = this.projects.get(id);
    if (!p) throw new RelayError(ErrorCode.NOT_FOUND, `project not found: ${id}`);
    return p;
  }

  create(input: CreateProjectInput): Project {
    const now = Date.now();
    const project: Project = {
      id: randomUUID(),
      name: input.name,
      description: input.description ?? '',
      network: input.network,
      rpcEndpointId: input.rpcEndpointId,
      programs: {},
      patches: [],
      sessionIds: [],
      keypairRefs: [],
      scripts: [],
      txTemplates: [],
      workflows: [],
      createdAt: now,
      lastOpenedAt: now,
      pinned: false,
    };
    this.projects.set(project.id, project);
    return project;
  }

  rename(id: string, name: string): Project {
    const p = this.get(id);
    p.name = name;
    return p;
  }

  delete(id: string): void {
    if (!this.projects.delete(id)) {
      throw new RelayError(ErrorCode.NOT_FOUND, `project not found: ${id}`);
    }
  }

  touchOpened(id: string): void {
    const p = this.get(id);
    p.lastOpenedAt = Date.now();
  }

  addProgram(input: AddProgramInput): Project {
    const p = this.get(input.projectId);
    if (p.programs[input.programId]) {
      throw new RelayError(
        ErrorCode.INVALID_INPUT,
        `program already in project: ${input.programId}`,
      );
    }
    p.programs[input.programId] = {
      programId: input.programId,
      label: input.label ?? input.programId,
      elfBlobHash: input.elfBlobHash,
      source: input.source,
      idlId: null,
      accounts: [],
      upgradeAuthority: input.upgradeAuthority ?? null,
      clonedAtSlot: input.clonedAtSlot ?? null,
    };
    return p;
  }

  setProgramLabel(projectId: string, programId: string, label: string): Project {
    const p = this.get(projectId);
    const prog = p.programs[programId];
    if (!prog) {
      throw new RelayError(ErrorCode.NOT_FOUND, `program not in project: ${programId}`);
    }
    prog.label = label;
    return p;
  }

  setAccountLabel(projectId: string, address: string, label: string): Project {
    const p = this.get(projectId);
    for (const prog of Object.values(p.programs)) {
      const acc = prog.accounts.find((a) => a.address === address);
      if (acc) {
        acc.label = label;
        return p;
      }
    }
    throw new RelayError(ErrorCode.NOT_FOUND, `account not in project: ${address}`);
  }

  removeProgram(projectId: string, programId: string): Project {
    const p = this.get(projectId);
    if (!p.programs[programId]) {
      throw new RelayError(ErrorCode.NOT_FOUND, `program not in project: ${programId}`);
    }
    delete p.programs[programId];
    return p;
  }

  addAccount(input: AddAccountInput): Project {
    const p = this.get(input.projectId);
    const prog = p.programs[input.programId];
    if (!prog) {
      throw new RelayError(ErrorCode.NOT_FOUND, `program not in project: ${input.programId}`);
    }
    if (prog.accounts.some((a) => a.address === input.address)) {
      throw new RelayError(
        ErrorCode.INVALID_INPUT,
        `account already under program: ${input.address}`,
      );
    }
    prog.accounts.push({
      address: input.address,
      label: input.label ?? input.address,
      blobHash: input.blobHash,
      clonedAtSlot: input.clonedAtSlot ?? null,
      source: input.source ?? 'cloned',
    });
    return p;
  }

  removeAccount(projectId: string, address: string): Project {
    const p = this.get(projectId);
    for (const prog of Object.values(p.programs)) {
      const idx = prog.accounts.findIndex((a) => a.address === address);
      if (idx >= 0) {
        prog.accounts.splice(idx, 1);
        return p;
      }
    }
    throw new RelayError(ErrorCode.NOT_FOUND, `account not in project: ${address}`);
  }

  setLastSessions(projectId: string, sessionIds: string[]): void {
    const p = this.get(projectId);
    p.sessionIds = sessionIds;
  }

  exportAll(): Project[] {
    return Array.from(this.projects.values());
  }

  loadAll(projects: Project[]): void {
    this.projects.clear();
    for (const p of projects) {
      // Backfill fields added in newer versions
      if (!Array.isArray((p as { txTemplates?: unknown }).txTemplates)) {
        (p as { txTemplates: unknown[] }).txTemplates = [];
      }
      if (!Array.isArray((p as { workflows?: unknown }).workflows)) {
        (p as { workflows: unknown[] }).workflows = [];
      }
      this.projects.set(p.id, p);
    }
  }

  private toMeta(p: Project): ProjectMeta {
    const programCount = Object.keys(p.programs).length;
    return {
      id: p.id,
      name: p.name,
      network: p.network,
      programCount,
      sessionCount: p.sessionIds.length,
      createdAt: p.createdAt,
      lastOpenedAt: p.lastOpenedAt,
      pinned: p.pinned,
    };
  }
}
