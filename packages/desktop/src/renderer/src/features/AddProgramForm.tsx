import { useEffect, useState } from 'react';
import { api } from '../api';
import { Spinner } from '../components/Spinner';

interface BuiltinDescriptor {
  programId: string;
  label: string;
  inSvm: boolean;
  hasIdl: boolean;
  description: string;
}

const OTHER = '__other__';

export function AddProgramForm({
  projectId,
  onDone,
}: {
  projectId: string;
  onDone: () => void;
}): JSX.Element {
  const [builtins, setBuiltins] = useState<BuiltinDescriptor[]>([]);
  const [selection, setSelection] = useState<string>(OTHER); // OTHER or builtin programId
  const [programId, setProgramId] = useState('');
  const [rpcUrl, setRpcUrl] = useState('');
  const [slot, setSlot] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void api
      .call<BuiltinDescriptor[]>('program.listBuiltins')
      .then(setBuiltins)
      .catch(() => setBuiltins([]));
  }, []);

  const chosenBuiltin = builtins.find((b) => b.programId === selection);
  const isOther = selection === OTHER;
  const effectiveProgramId = isOther ? programId : chosenBuiltin?.programId ?? '';

  const submit = async (): Promise<void> => {
    setBusy(true);
    setErr(null);
    try {
      const params: Record<string, unknown> = {
        projectId,
        programId: effectiveProgramId,
      };
      if (isOther) {
        if (rpcUrl) params.rpcUrl = rpcUrl;
        if (slot) params.slot = slot;
      }
      await api.call('program.add', params);
      onDone();
    } catch (e) {
      setErr(String(e));
      setBusy(false);
    }
  };

  return (
    <>
      <h3>Add program</h3>
      {err && <div className="error-banner">{err}</div>}

      <label>Source</label>
      <select value={selection} onChange={(e) => setSelection(e.target.value)}>
        <option value={OTHER}>Other (paste program ID, clone from RPC)</option>
        {builtins.length > 0 && <option disabled>──── Built-in ────</option>}
        {builtins.map((b) => (
          <option key={b.programId} value={b.programId}>
            {b.label}
            {b.inSvm ? ' · LiteSVM' : ' · RPC clone (auto)'}
          </option>
        ))}
      </select>

      {chosenBuiltin && (
        <div
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: 10,
            marginTop: 10,
            fontSize: 12,
            color: 'var(--text-dim)',
          }}
        >
          <div style={{ color: 'var(--text)', marginBottom: 4 }}>{chosenBuiltin.label}</div>
          <div className="mono" style={{ fontSize: 11, marginBottom: 4 }}>
            {chosenBuiltin.programId}
          </div>
          <div>{chosenBuiltin.description}</div>
          {chosenBuiltin.inSvm && (
            <div style={{ marginTop: 6, color: 'var(--success)' }}>
              ✓ Bundled into LiteSVM — instant attach, no RPC roundtrip
            </div>
          )}
          {!chosenBuiltin.inSvm && (
            <div style={{ marginTop: 6, color: 'var(--accent)' }}>
              ↻ Will auto-clone from RPC on first use
            </div>
          )}
        </div>
      )}

      {isOther && (
        <>
          <label>Program ID</label>
          <input
            value={programId}
            onChange={(e) => setProgramId(e.target.value)}
            placeholder="base58 program ID"
            className="mono"
            autoFocus
          />
          <label>RPC URL override (optional)</label>
          <input value={rpcUrl} onChange={(e) => setRpcUrl(e.target.value)} />
          <label>Slot (optional)</label>
          <input value={slot} onChange={(e) => setSlot(e.target.value)} />
        </>
      )}

      <div className="actions">
        <button onClick={() => onDone()}>Cancel</button>
        <button className="primary" disabled={!effectiveProgramId || busy} onClick={submit}>
          {busy ? (
            <>
              <Spinner /> &nbsp;
              {isOther && chosenBuiltin === undefined ? 'Cloning from RPC…' : 'Adding…'}
            </>
          ) : (
            'Add'
          )}
        </button>
      </div>
    </>
  );
}
