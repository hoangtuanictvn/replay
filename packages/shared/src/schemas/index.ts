import { z } from 'zod';

export const Base58Schema = z
  .string()
  .regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, 'invalid base58 pubkey');

export const NetworkIdSchema = z.enum(['mainnet-beta', 'devnet', 'testnet', 'custom']);

export const PatchOpSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('setField'), fieldPath: z.string(), valueJson: z.string() }),
  z.object({
    kind: z.literal('rawSplice'),
    offset: z.number().int().nonnegative(),
    bytes: z.instanceof(Uint8Array),
  }),
  z.object({ kind: z.literal('setLamports'), lamports: z.bigint().nonnegative() }),
  z.object({ kind: z.literal('setOwner'), owner: Base58Schema }),
]);

export const PatchSchema = z.object({
  id: z.string().uuid(),
  target: Base58Schema,
  op: PatchOpSchema,
  createdAt: z.number().int(),
  enabled: z.boolean(),
});

export const PatchScopeSchema = z.enum(['project', 'session']);

export const AccountSnapshotSchema = z.object({
  pubkey: Base58Schema,
  lamports: z.bigint(),
  owner: Base58Schema,
  executable: z.boolean(),
  rentEpoch: z.bigint(),
  data: z.instanceof(Uint8Array),
  clonedAtSlot: z.bigint().nullable(),
  source: z.enum(['cloned', 'patched', 'manual']),
});

export const ProgramSourceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('cloned'), slot: z.bigint() }),
  z.object({ kind: z.literal('localFile'), path: z.string() }),
]);
