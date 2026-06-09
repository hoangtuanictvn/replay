import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Keypair } from '@solana/web3.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { KeypairStore } from '../src/keypair/keypair-store.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'relay-kp-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('KeypairStore', () => {
  it('generates and lists keypairs', async () => {
    const store = new KeypairStore(dir);
    const meta = await store.generate('alpha');
    expect(meta.label).toBe('alpha');
    expect(meta.pubkey).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/);
    expect(meta.sealed).toBe(false);

    const list = await store.list();
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(meta.id);
    expect(list[0]).not.toHaveProperty('secret');
  });

  it('imports from raw 64-byte secret', async () => {
    const store = new KeypairStore(dir);
    const kp = Keypair.generate();
    const meta = await store.importSecret('imp', Array.from(kp.secretKey));
    expect(meta.pubkey).toBe(kp.publicKey.toBase58());
  });

  it('round-trips secret on export', async () => {
    const store = new KeypairStore(dir);
    const kp = Keypair.generate();
    const meta = await store.importSecret('roundtrip', Array.from(kp.secretKey));
    const secret = await store.exportSecretKey(meta.id);
    expect(Array.from(secret)).toEqual(Array.from(kp.secretKey));
  });

  it('persists across instances', async () => {
    const s1 = new KeypairStore(dir);
    const meta = await s1.generate('persistent');
    const s2 = new KeypairStore(dir);
    const list = await s2.list();
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(meta.id);
  });

  it('deletes', async () => {
    const store = new KeypairStore(dir);
    const meta = await store.generate('to-delete');
    await store.delete(meta.id);
    expect(await store.list()).toHaveLength(0);
  });

  it('rejects malformed secret', async () => {
    const store = new KeypairStore(dir);
    await expect(store.importSecret('bad', [1, 2, 3])).rejects.toThrow(/64 bytes/);
  });
});
