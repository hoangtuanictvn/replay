import type { AccountSource, Base58String } from './primitives.js';

export interface AccountSnapshot {
  pubkey: Base58String;
  lamports: bigint;
  owner: Base58String;
  executable: boolean;
  rentEpoch: bigint;
  data: Uint8Array;
  clonedAtSlot: bigint | null;
  source: AccountSource;
}

export interface AccountEntry {
  address: Base58String;
  label: string;
  blobHash: string;
  clonedAtSlot: bigint | null;
  source: 'cloned' | 'manual';
}
