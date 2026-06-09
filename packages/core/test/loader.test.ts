import { PublicKey } from '@solana/web3.js';
import { describe, expect, it } from 'vitest';
import {
  BPF_LOADER_2,
  BPF_LOADER_UPGRADEABLE,
  deriveProgramDataAddress,
  detectLoader,
} from '../src/util/loader.js';

describe('detectLoader', () => {
  it('identifies BPF Loader Upgradeable', () => {
    expect(detectLoader(BPF_LOADER_UPGRADEABLE)).toBe('upgradeable');
  });

  it('identifies BPF Loader 2', () => {
    expect(detectLoader(BPF_LOADER_2)).toBe('bpf2');
  });

  it('returns unknown for random pubkey', () => {
    expect(detectLoader(new PublicKey('11111111111111111111111111111111'))).toBe('unknown');
  });
});

describe('deriveProgramDataAddress', () => {
  it('derives deterministic PDA for a program id', () => {
    const programId = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
    const a = deriveProgramDataAddress(programId);
    const b = deriveProgramDataAddress(programId);
    expect(a.toBase58()).toBe(b.toBase58());
  });
});
