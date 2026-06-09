import type { AccountInfo, PublicKey } from '@solana/web3.js';
import type { LoaderKind } from '../util/loader.js';

export interface ClonedAccount {
  address: PublicKey;
  account: AccountInfo<Buffer>;
  slot: bigint;
}

export interface ClonedProgram {
  programId: PublicKey;
  loader: LoaderKind;
  elf: Uint8Array;
  programAccount: AccountInfo<Buffer>;
  programDataAddress: PublicKey | null;
  programDataAccount: AccountInfo<Buffer> | null;
  upgradeAuthority: PublicKey | null;
  slot: bigint;
}

export interface ClonerOptions {
  commitment?: 'processed' | 'confirmed' | 'finalized';
  cacheDir?: string;
}
