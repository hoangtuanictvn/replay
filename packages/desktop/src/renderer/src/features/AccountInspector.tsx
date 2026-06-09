import { useEffect, useState } from 'react';
import { api } from '../api';

interface DecodedResult {
  address: string;
  programId: string;
  accountName: string | null;
  value: unknown;
  dataLen: number;
  raw?: string;
  decoder?: 'anchor' | 'native' | null;
}

export function AccountInspector({
  projectId,
  address,
  onClose,
  onPatchRequested,
}: {
  projectId: string;
  address: string;
  onClose: () => void;
  onPatchRequested: () => void;
}): JSX.Element {
  const [decoded, setDecoded] = useState<DecodedResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [view, setView] = useState<'decoded' | 'hex'>('decoded');

  useEffect(() => {
    void api
      .call<DecodedResult>('account.decode', { projectId, address })
      .then(setDecoded)
      .catch((e) => setErr(String(e)));
  }, [projectId, address]);

  const hex = decoded?.raw
    ? Array.from(atob(decoded.raw))
        .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(' ')
    : null;

  return (
    <>
      <h3>
        Account {address.slice(0, 6)}…{address.slice(-4)}
      </h3>
      {err && <div className="error-banner">{err}</div>}
      {decoded && (
        <div style={{ marginBottom: 10, color: 'var(--text-dim)', fontSize: 11 }}>
          program <span className="mono">{decoded.programId}</span> ·{' '}
          {decoded.accountName ?? <em>no IDL match</em>} · {decoded.dataLen} bytes ·{' '}
          {decoded.decoder ?? 'no decoder'}
        </div>
      )}

      <div className="row" style={{ marginBottom: 8 }}>
        <button className={view === 'decoded' ? 'primary' : ''} onClick={() => setView('decoded')}>
          Decoded
        </button>
        <button className={view === 'hex' ? 'primary' : ''} onClick={() => setView('hex')}>
          Hex
        </button>
      </div>

      {view === 'decoded' && (
        <pre
          className="mono"
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: 8,
            maxHeight: 400,
            overflow: 'auto',
            fontSize: 11,
            margin: 0,
          }}
        >
          {decoded?.value
            ? JSON.stringify(decoded.value, null, 2)
            : decoded
              ? '(no decoder matched — switch to Hex view)'
              : 'Loading…'}
        </pre>
      )}

      {view === 'hex' && (
        <pre
          className="mono"
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: 8,
            maxHeight: 400,
            overflow: 'auto',
            fontSize: 11,
            margin: 0,
            wordBreak: 'break-all',
            whiteSpace: 'pre-wrap',
          }}
        >
          {hex ?? '(no raw bytes available — decoded view shows fields)'}
        </pre>
      )}

      <div className="actions">
        <button onClick={onClose}>Close</button>
        <button className="primary" onClick={onPatchRequested}>
          Patch this account…
        </button>
      </div>
    </>
  );
}
