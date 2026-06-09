import { describe, expect, it } from 'vitest';
import { PublicKey } from '@solana/web3.js';
import {
  encodeNativeIx,
  findNativeInstruction,
  listNativeInstructions,
} from '../src/instructions/native-ix.js';
import {
  COMPUTE_BUDGET_PROGRAM,
  MEMO_PROGRAM,
  SYSTEM_PROGRAM,
  TOKEN_2022_PROGRAM,
  TOKEN_PROGRAM,
} from '../src/util/builtins.js';

describe('listNativeInstructions', () => {
  it('returns System instructions', () => {
    const list = listNativeInstructions(SYSTEM_PROGRAM.toBase58());
    expect(list.map((i) => i.name)).toContain('Transfer');
    expect(list.map((i) => i.name)).toContain('CreateAccount');
  });

  it('returns SPL Token + Token-2022 instructions', () => {
    const t = listNativeInstructions(TOKEN_PROGRAM.toBase58());
    const t22 = listNativeInstructions(TOKEN_2022_PROGRAM.toBase58());
    expect(t.map((i) => i.name)).toContain('Transfer');
    expect(t22.map((i) => i.name)).toContain('MintTo');
  });

  it('returns Memo instruction', () => {
    expect(listNativeInstructions(MEMO_PROGRAM.toBase58())[0]?.name).toBe('Memo');
  });

  it('returns Compute Budget instructions', () => {
    const list = listNativeInstructions(COMPUTE_BUDGET_PROGRAM.toBase58());
    expect(list.map((i) => i.name)).toEqual([
      'RequestHeapFrame',
      'SetComputeUnitLimit',
      'SetComputeUnitPrice',
    ]);
  });
});

describe('encodeNativeIx', () => {
  it('encodes System.Transfer (tag u32 + lamports u64)', () => {
    const bytes = encodeNativeIx(SYSTEM_PROGRAM.toBase58(), 'Transfer', { lamports: 1000 });
    // tag=2 LE u32 = 02 00 00 00, then 1000 LE u64 = e8 03 00 00 00 00 00 00
    expect(Array.from(bytes)).toEqual([2, 0, 0, 0, 0xe8, 0x03, 0, 0, 0, 0, 0, 0]);
  });

  it('encodes SPL Token Transfer (tag u8=3 + amount u64)', () => {
    const bytes = encodeNativeIx(TOKEN_PROGRAM.toBase58(), 'Transfer', { amount: '1' });
    expect(bytes[0]).toBe(3);
    expect(Array.from(bytes.slice(1))).toEqual([1, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('encodes SPL Token InitializeMint with COption<Pubkey> None freezeAuthority', () => {
    const mintAuth = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
    const bytes = encodeNativeIx(TOKEN_PROGRAM.toBase58(), 'InitializeMint', {
      decimals: 9,
      mintAuthority: mintAuth.toBase58(),
      freezeAuthority: null,
    });
    // 1 (tag) + 1 (decimals) + 32 (pubkey) + 4 (COption tag=0, no trailing 32 since None)
    expect(bytes.length).toBe(1 + 1 + 32 + 4);
    expect(bytes[0]).toBe(0); // InitializeMint tag
    expect(bytes[1]).toBe(9); // decimals
    // last 4 bytes = u32 None tag
    expect(Array.from(bytes.slice(-4))).toEqual([0, 0, 0, 0]);
  });

  it('encodes Memo as raw UTF-8', () => {
    const bytes = encodeNativeIx(MEMO_PROGRAM.toBase58(), 'Memo', { message: 'hi' });
    expect(new TextDecoder().decode(bytes)).toBe('hi');
  });

  it('encodes ComputeBudget.SetComputeUnitLimit', () => {
    const bytes = encodeNativeIx(COMPUTE_BUDGET_PROGRAM.toBase58(), 'SetComputeUnitLimit', {
      units: 250000,
    });
    expect(bytes[0]).toBe(2);
    const v = new DataView(bytes.buffer, bytes.byteOffset).getUint32(1, true);
    expect(v).toBe(250000);
  });
});

describe('findNativeInstruction', () => {
  it('finds by program + name', () => {
    expect(findNativeInstruction(SYSTEM_PROGRAM.toBase58(), 'Transfer')?.name).toBe('Transfer');
  });
  it('returns null for unknown', () => {
    expect(findNativeInstruction(SYSTEM_PROGRAM.toBase58(), 'Nope')).toBeNull();
  });
});
