import type { AccountEntry } from './account.js';
import type { Base58String, Uuid } from './primitives.js';

export type ProgramSource = { kind: 'cloned'; slot: bigint } | { kind: 'localFile'; path: string };

export interface ProgramEntry {
  programId: Base58String;
  label: string;
  elfBlobHash: string;
  source: ProgramSource;
  idlId: Uuid | null;
  accounts: AccountEntry[];
  upgradeAuthority: Base58String | null;
  clonedAtSlot: bigint | null;
}
