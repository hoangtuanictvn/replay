import { PublicKey } from '@solana/web3.js';

export const BPF_LOADER_2 = new PublicKey('BPFLoader2111111111111111111111111111111111');
export const BPF_LOADER_DEPRECATED = new PublicKey('BPFLoader1111111111111111111111111111111111');
export const BPF_LOADER_UPGRADEABLE = new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111');
export const LOADER_V4 = new PublicKey('LoaderV411111111111111111111111111111111111');

export type LoaderKind = 'bpf2' | 'bpfDeprecated' | 'upgradeable' | 'v4' | 'unknown';

export function detectLoader(owner: PublicKey): LoaderKind {
  if (owner.equals(BPF_LOADER_UPGRADEABLE)) return 'upgradeable';
  if (owner.equals(BPF_LOADER_2)) return 'bpf2';
  if (owner.equals(BPF_LOADER_DEPRECATED)) return 'bpfDeprecated';
  if (owner.equals(LOADER_V4)) return 'v4';
  return 'unknown';
}

export function deriveProgramDataAddress(programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync([programId.toBuffer()], BPF_LOADER_UPGRADEABLE);
  return pda;
}

export const PROGRAM_DATA_HEADER_LEN = 45;
