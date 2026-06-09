import { describe, expect, it } from 'vitest';
import { ProjectStore } from '../src/store/project-store.js';

function createProject(store: ProjectStore, name = 'p1') {
  return store.create({
    name,
    description: 'd',
    network: 'mainnet-beta',
    rpcEndpointId: 'http://x',
  });
}

describe('ProjectStore', () => {
  it('creates and lists projects', () => {
    const store = new ProjectStore();
    const p = createProject(store);
    const meta = store.list();
    expect(meta).toHaveLength(1);
    expect(meta[0]?.id).toBe(p.id);
    expect(meta[0]?.programCount).toBe(0);
  });

  it('adds and groups accounts under programs', () => {
    const store = new ProjectStore();
    const p = createProject(store);
    store.addProgram({
      projectId: p.id,
      programId: 'PROG111111111111111111111111111111111111111',
      elfBlobHash: 'hash1',
      source: { kind: 'cloned', slot: 100n },
    });
    store.addAccount({
      projectId: p.id,
      programId: 'PROG111111111111111111111111111111111111111',
      address: 'ACC1111111111111111111111111111111111111111',
      blobHash: 'h2',
    });
    expect(store.list()[0]?.programCount).toBe(1);
    const project = store.get(p.id);
    const programId: string = 'PROG111111111111111111111111111111111111111';
    const prog = project.programs[programId];
    expect(prog?.accounts).toHaveLength(1);
    expect(prog?.accounts[0]?.address).toBe('ACC1111111111111111111111111111111111111111');
  });

  it('rejects duplicate program adds', () => {
    const store = new ProjectStore();
    const p = createProject(store);
    const programId = 'PROG111111111111111111111111111111111111111';
    store.addProgram({
      projectId: p.id,
      programId,
      elfBlobHash: 'x',
      source: { kind: 'cloned', slot: 1n },
    });
    expect(() =>
      store.addProgram({
        projectId: p.id,
        programId,
        elfBlobHash: 'y',
        source: { kind: 'cloned', slot: 1n },
      }),
    ).toThrow(/already in project/);
  });

  it('removes accounts and programs', () => {
    const store = new ProjectStore();
    const p = createProject(store);
    const programId = 'PROG111111111111111111111111111111111111111';
    store.addProgram({
      projectId: p.id,
      programId,
      elfBlobHash: 'x',
      source: { kind: 'cloned', slot: 1n },
    });
    store.addAccount({
      projectId: p.id,
      programId,
      address: 'ACC1111111111111111111111111111111111111111',
      blobHash: 'h',
    });
    store.removeAccount(p.id, 'ACC1111111111111111111111111111111111111111');
    expect(store.get(p.id).programs[programId]?.accounts).toHaveLength(0);
    store.removeProgram(p.id, programId);
    expect(Object.keys(store.get(p.id).programs)).toHaveLength(0);
  });
});
