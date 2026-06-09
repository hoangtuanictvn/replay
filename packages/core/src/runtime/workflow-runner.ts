import { Keypair } from '@solana/web3.js';
import { ErrorCode, RelayError, type Uuid } from '@relay/shared';
import { buildTransaction, signTransaction } from './tx-builder.js';
import type { SessionRuntime } from './session-runtime.js';
import type { CoreContext } from '../store/context.js';
import { parseTrace } from '../trace/parser.js';

interface TxStepIx {
  programId: string;
  accounts: Array<{ pubkey: string; isSigner: boolean; isWritable: boolean }>;
  dataBase64: string;
}

export type WorkflowStepInput =
  | {
      kind: 'tx';
      id: Uuid;
      name: string;
      ixs: TxStepIx[];
      computeUnitLimit?: number | null;
      airdropPayerLamports?: string | null;
      payerKeypairId?: string | null;
    }
  | { kind: 'airdrop'; id: Uuid; name: string; pubkey: string; lamports: string }
  | { kind: 'warpTime'; id: Uuid; name: string; seconds: number }
  | { kind: 'warpSlot'; id: Uuid; name: string; slot: string }
  | { kind: 'expireBlockhash'; id: Uuid; name: string }
  | { kind: 'resetSession'; id: Uuid; name: string };

export interface WorkflowStepResult {
  stepId: Uuid;
  kind: WorkflowStepInput['kind'];
  name: string;
  success: boolean;
  errorMessage: string | null;
  durationMs: number;
  tx?: {
    cuConsumed: string;
    logs: string[];
    errorMessage: string | null;
    success: boolean;
  };
}

export async function runWorkflow(
  ctx: CoreContext,
  runtime: SessionRuntime,
  sessionId: string,
  steps: WorkflowStepInput[],
): Promise<WorkflowStepResult[]> {
  const results: WorkflowStepResult[] = [];
  for (const step of steps) {
    const start = performance.now();
    try {
      switch (step.kind) {
        case 'airdrop':
          await runtime.airdrop(sessionId, step.pubkey, BigInt(step.lamports));
          results.push({
            stepId: step.id,
            kind: step.kind,
            name: step.name,
            success: true,
            errorMessage: null,
            durationMs: performance.now() - start,
          });
          break;

        case 'warpTime': {
          await runtime.warpByTime(sessionId, step.seconds);
          results.push({
            stepId: step.id,
            kind: step.kind,
            name: step.name,
            success: true,
            errorMessage: null,
            durationMs: performance.now() - start,
          });
          break;
        }

        case 'warpSlot':
          await runtime.warpToSlot(sessionId, BigInt(step.slot));
          results.push({
            stepId: step.id,
            kind: step.kind,
            name: step.name,
            success: true,
            errorMessage: null,
            durationMs: performance.now() - start,
          });
          break;

        case 'expireBlockhash':
          await runtime.expireBlockhash(sessionId);
          results.push({
            stepId: step.id,
            kind: step.kind,
            name: step.name,
            success: true,
            errorMessage: null,
            durationMs: performance.now() - start,
          });
          break;

        case 'resetSession': {
          ctx.sessions.reset(sessionId);
          runtime.invalidate(sessionId);
          results.push({
            stepId: step.id,
            kind: step.kind,
            name: step.name,
            success: true,
            errorMessage: null,
            durationMs: performance.now() - start,
          });
          break;
        }

        case 'tx': {
          if (step.ixs.length === 0) {
            throw new RelayError(ErrorCode.INVALID_INPUT, `tx step "${step.name}" has no ixs`);
          }
          let payer: Keypair;
          if (step.payerKeypairId) {
            const secret = await ctx.keypairs.exportSecretKey(step.payerKeypairId);
            payer = Keypair.fromSecretKey(secret);
          } else {
            payer = Keypair.generate();
          }
          if (step.airdropPayerLamports) {
            await runtime.airdrop(sessionId, payer.publicKey.toBase58(), BigInt(step.airdropPayerLamports));
          } else if (!step.payerKeypairId) {
            // ephemeral payer needs SOL for fees
            await runtime.airdrop(sessionId, payer.publicKey.toBase58(), 10_000_000_000n);
          }
          await runtime.expireBlockhash(sessionId);
          const recentBlockhash = await runtime.latestBlockhash(sessionId);
          const tx = buildTransaction({
            payer: payer.publicKey.toBase58(),
            ixs: step.ixs,
            recentBlockhash,
            ...(step.computeUnitLimit !== undefined &&
              step.computeUnitLimit !== null && { computeUnitLimit: step.computeUnitLimit }),
          });
          signTransaction(tx, [
            { pubkey: payer.publicKey.toBase58(), secretKey: Array.from(payer.secretKey) },
          ]);
          const txResult = await runtime.sendTransaction(sessionId, tx.serialize());
          const session = ctx.sessions.get(sessionId);
          const trace = parseTrace(txResult.logs);
          session.txHistory.push({
            id: crypto.randomUUID(),
            signature: null,
            submittedAt: Date.now(),
            success: txResult.success,
            errorMessage: txResult.errorMessage,
            cuConsumed: txResult.cuConsumed,
            trace: trace[0] ?? {
              programId: '<no-trace>',
              depth: 0,
              instructionIndex: 0,
              cuConsumed: 0n,
              cuRemaining: 0n,
              logs: [],
              events: [],
              returnData: null,
              children: [],
              error: null,
            },
            touchedAccounts: [],
          });
          results.push({
            stepId: step.id,
            kind: 'tx',
            name: step.name,
            success: txResult.success,
            errorMessage: txResult.errorMessage,
            durationMs: performance.now() - start,
            tx: {
              cuConsumed: txResult.cuConsumed.toString(),
              logs: txResult.logs,
              errorMessage: txResult.errorMessage,
              success: txResult.success,
            },
          });
          if (!txResult.success) {
            return results; // stop on first failed tx step
          }
          break;
        }
      }
    } catch (err) {
      results.push({
        stepId: step.id,
        kind: step.kind,
        name: step.name,
        success: false,
        errorMessage: err instanceof Error ? err.message : String(err),
        durationMs: performance.now() - start,
      });
      return results; // halt on first error
    }
  }
  return results;
}
