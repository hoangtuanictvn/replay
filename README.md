# Relay

Clone any on-chain Solana program into a local LiteSVM sandbox. Mutate PDA state. Simulate, replay, trace, and diff transactions — without touching mainnet.

**Status:** v0 — Phases 0–7 engine complete. UI partial (project / session / program / account CRUD). Tests: 49 passing.

## Install

```bash
pnpm install
pnpm build
```

Requires Node 20 (see `.nvmrc`). pnpm 11.

## Quick start (CLI)

```bash
# Init project
pnpm cli project create "DEX Integration" --rpc https://api.mainnet-beta.solana.com

# Add program (cloned from mainnet)
pnpm cli program add MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr --project <project-id>

# Add a PDA / account under the program
pnpm cli account add <pubkey> --project <pid> --program <programId> --label "pool A"

# Open session
pnpm cli session create main --project <pid>

# Send a tx into LiteSVM
pnpm cli tx send \
  --session <sid> \
  --program <programId> \
  --data 68656c6c6f \
  --account "<pubkey>:false:true"

# Replay a mainnet tx locally (requires archive RPC for slot-1 reads)
pnpm cli tx replay <signature> --session <sid> --rpc-url <archive-rpc-url>
```

## Desktop app

```bash
pnpm --filter @relay/desktop dev      # Electron + Vite HMR
pnpm --filter @relay/desktop build    # production bundle
```

The desktop app is a thin UI over the same dispatcher the CLI uses. Native modules (`litesvm`, `better-sqlite3`) load under Electron's Node ABI.

## Architecture

```
Renderer (sandbox)
   │ ipcRenderer
   ▼
Electron main process
   │ Worker MessagePort
   ▼
Core worker (Node) — LiteSVM via NAPI
```

See `REQUIREMENTS.md` and `IMPLEMENTATION_PLAN.md` for the full spec.

## Layout

```
packages/shared       — types, zod schemas, IPC method names, errors
packages/core         — headless engine
  src/svm/            LiteSVM wrapper
  src/cloner/         RPC clone (ELF + accounts + cache)
  src/patcher/        Anchor IDL coder + IDL store + setField
  src/trace/          log → instruction tree parser
  src/replayer/       historical tx hydrate + execute + diff
  src/runtime/        per-session LiteSVM lifecycle + tx builder
  src/snapshot/       deterministic state snapshots + fork + diff
  src/keypair/        sandbox keypair vault (safeStorage hook)
  src/scripting/      vm.Context sandbox with network allowlist
  src/telemetry/      opt-in client interface (Sentry / PostHog stubs)
  src/store/          Project / Session in-memory catalogs + JSON persistence
  src/rpc/            Dispatcher + handler map + Worker bridge
packages/core-cli     — Phase 0–6 CLI driver
packages/desktop      — Electron + React shell
```

## Tests

```bash
pnpm test
```

49 passing across loader / project-store / patch-engine / anchor-coder / trace / tx-builder / snapshot / keypair / scripting suites.

## License

BUSL-1.1 (Business Source License). Free for individual and internal commercial use. Restricted use: hosting Relay as a commercial service to third parties (preserves future paid cloud tier). Each release converts to Apache-2.0 after 3 years from its release date. See `LICENSE`.
