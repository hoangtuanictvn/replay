import { useState } from 'react';
import { api } from '../api';

interface ReplayResult {
  signature: string;
  slot: bigint | string;
  onChain: {
    success: boolean;
    cuConsumed: bigint | string | number;
    logs: string[];
    errorMessage: string | null;
  };
  local: {
    success: boolean;
    cuConsumed: bigint | string | number;
    logs: string[];
    errorMessage: string | null;
  };
  verdict: 'match' | 'divergent' | 'failed-locally';
  hydratedAccounts: string[];
  loadedPrograms: string[];
}

export function ReplayPanel({
  activeSessionId,
}: {
  activeSessionId: string | null;
}): JSX.Element {
  const [signature, setSignature] = useState('');
  const [rpcOverride, setRpcOverride] = useState('');
  const [result, setResult] = useState<ReplayResult | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    setBusy(true);
    setErr(null);
    setResult(null);
    setStatus('fetching transaction…');
    try {
      const params: Record<string, unknown> = { signature: signature.trim() };
      if (activeSessionId) params.sessionId = activeSessionId;
      if (rpcOverride) params.rpcUrl = rpcOverride;
      setStatus('hydrating accounts at slot−1, replaying…');
      const r = await api.call<ReplayResult>('tx.replay', params);
      setResult(r);
      setStatus(null);
    } catch (e) {
      setErr(String(e));
      setStatus(null);
    } finally {
      setBusy(false);
    }
  };

  const verdictColor = (v: ReplayResult['verdict']): string => {
    if (v === 'match') return 'var(--success)';
    if (v === 'divergent') return '#e0b170';
    return 'var(--danger)';
  };

  return (
    <>
      <div className="panel">
        <h2>Replay mainnet transaction</h2>
        <div style={{ color: 'var(--text-dim)', fontSize: 11, marginBottom: 10 }}>
          Fetches tx, resolves ALT lookups, hydrates state at slot−1, executes in LiteSVM, diffs vs
          on-chain. Archive RPC required for reliable slot−1 reads.
        </div>
        {err && <div className="error-banner">{err}</div>}

        <label>Transaction signature</label>
        <input
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
          placeholder="base58 signature"
          className="mono"
        />

        <label>Archive RPC override (optional)</label>
        <input
          value={rpcOverride}
          onChange={(e) => setRpcOverride(e.target.value)}
          placeholder="https://… (defaults to active project's RPC)"
        />

        <div className="actions">
          <button className="primary" disabled={busy || !signature.trim()} onClick={submit}>
            {busy ? status ?? 'Replaying…' : 'Replay'}
          </button>
        </div>
      </div>

      {result && (
        <div className="panel">
          <h2>
            Verdict ·{' '}
            <span style={{ color: verdictColor(result.verdict) }}>
              {result.verdict.toUpperCase()}
            </span>
          </h2>
          <div style={{ color: 'var(--text-dim)', fontSize: 12, marginBottom: 10 }}>
            slot {result.slot.toString()} · hydrated {result.hydratedAccounts.length} accounts ·
            loaded {result.loadedPrograms.length} programs
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <SideColumn title="On-chain" side={result.onChain} />
            <SideColumn title="Local" side={result.local} />
          </div>
        </div>
      )}
    </>
  );
}

function SideColumn({
  title,
  side,
}: {
  title: string;
  side: {
    success: boolean;
    cuConsumed: bigint | string | number;
    logs: string[];
    errorMessage: string | null;
  };
}): JSX.Element {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 4, padding: 8 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>
        {side.success ? '✓ success' : '✗ failure'} · cu {side.cuConsumed.toString()}
        {side.errorMessage && <> · {side.errorMessage}</>}
      </div>
      <pre
        className="mono"
        style={{
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 2,
          padding: 6,
          fontSize: 10,
          maxHeight: 360,
          overflow: 'auto',
          margin: 0,
          whiteSpace: 'pre-wrap',
        }}
      >
        {side.logs.join('\n')}
      </pre>
    </div>
  );
}
