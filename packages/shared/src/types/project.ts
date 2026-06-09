import type { Patch } from './patch.js';
import type { Base58String, NetworkId, Uuid } from './primitives.js';
import type { ProgramEntry } from './program.js';

export interface ScriptEntry {
  id: Uuid;
  name: string;
  source: string;
  updatedAt: number;
}

export interface TxTemplateInstruction {
  programId: Base58String;
  programLabel: string;
  instructionName: string;
  summary: string;
  accounts: Array<{ pubkey: Base58String; isSigner: boolean; isWritable: boolean }>;
  dataBase64: string;
}

export interface TxTemplate {
  id: Uuid;
  name: string;
  description: string;
  ixs: TxTemplateInstruction[];
  computeUnitLimit: number | null;
  airdropLamports: string | null;
  createdAt: number;
  updatedAt: number;
}

export type WorkflowStep =
  | {
      kind: 'tx';
      id: Uuid;
      name: string;
      ixs: TxTemplateInstruction[];
      computeUnitLimit?: number | null;
      airdropPayerLamports?: string | null;
      payerKeypairId?: Uuid | null;
      templateId?: Uuid | null;
    }
  | { kind: 'airdrop'; id: Uuid; name: string; pubkey: Base58String; lamports: string }
  | { kind: 'warpTime'; id: Uuid; name: string; seconds: number }
  | { kind: 'warpSlot'; id: Uuid; name: string; slot: string }
  | { kind: 'expireBlockhash'; id: Uuid; name: string }
  | { kind: 'resetSession'; id: Uuid; name: string };

export interface Workflow {
  id: Uuid;
  name: string;
  description: string;
  steps: WorkflowStep[];
  createdAt: number;
  updatedAt: number;
}

export interface WorkflowStepResult {
  stepId: Uuid;
  kind: WorkflowStep['kind'];
  name: string;
  success: boolean;
  errorMessage: string | null;
  durationMs: number;
  /** For tx steps: TxSendResult-shaped subset. */
  tx?: {
    cuConsumed: string;
    logs: string[];
    errorMessage: string | null;
    success: boolean;
  };
}

export interface WorkflowRunResult {
  workflowId: Uuid;
  sessionId: Uuid;
  startedAt: number;
  completedAt: number;
  success: boolean;
  steps: WorkflowStepResult[];
}

export interface Project {
  id: Uuid;
  name: string;
  description: string;
  network: NetworkId;
  rpcEndpointId: Uuid;
  programs: Record<Base58String, ProgramEntry>;
  patches: Patch[];
  sessionIds: Uuid[];
  keypairRefs: Uuid[];
  scripts: ScriptEntry[];
  txTemplates: TxTemplate[];
  workflows: Workflow[];
  createdAt: number;
  lastOpenedAt: number;
  pinned: boolean;
}

export interface ProjectMeta {
  id: Uuid;
  name: string;
  network: NetworkId;
  programCount: number;
  sessionCount: number;
  createdAt: number;
  lastOpenedAt: number;
  pinned: boolean;
}
