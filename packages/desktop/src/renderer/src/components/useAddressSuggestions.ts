import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Project } from '../types';

interface KeypairMeta {
  id: string;
  label: string;
  pubkey: string;
  sealed: boolean;
}

export interface AddressSuggestion {
  pubkey: string;
  label: string;
}

/**
 * Returns combined suggestion list for any "address" input:
 * - cloned accounts in the project (with their labels)
 * - sandbox keypairs from the vault
 * - project programs
 */
export function useAddressSuggestions(project: Project | null | undefined): AddressSuggestion[] {
  const [keypairs, setKeypairs] = useState<KeypairMeta[]>([]);
  useEffect(() => {
    void api
      .call<KeypairMeta[]>('keypair.list')
      .then(setKeypairs)
      .catch(() => setKeypairs([]));
  }, []);

  if (!project) return keypairs.map((k) => ({ pubkey: k.pubkey, label: `${k.label} (keypair)` }));

  return [
    ...Object.values(project.programs).flatMap((p) =>
      p.accounts.map((a) => ({
        pubkey: a.address,
        label: a.label && a.label !== a.address ? `${a.label} (account)` : 'account',
      })),
    ),
    ...keypairs.map((k) => ({ pubkey: k.pubkey, label: `${k.label} (keypair)` })),
    ...Object.values(project.programs).map((p) => ({
      pubkey: p.programId,
      label: `${p.label} (program)`,
    })),
  ];
}
