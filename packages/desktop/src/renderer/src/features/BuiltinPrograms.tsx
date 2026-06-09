import { useEffect, useState } from 'react';
import { api } from '../api';

interface BuiltinDescriptor {
  programId: string;
  label: string;
  inSvm: boolean;
  hasIdl: boolean;
  description: string;
}

export function BuiltinPrograms({
  projectId,
  attachedProgramIds,
  onChange,
}: {
  projectId: string;
  attachedProgramIds: Set<string>;
  onChange: () => void;
}): JSX.Element {
  const [items, setItems] = useState<BuiltinDescriptor[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void api.call<BuiltinDescriptor[]>('program.listBuiltins').then(setItems);
  }, []);

  const add = async (programId: string): Promise<void> => {
    setBusy(programId);
    setErr(null);
    try {
      await api.call('program.add', { projectId, programId });
      onChange();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="panel">
      <h2>Built-in programs</h2>
      <div style={{ color: 'var(--text-dim)', fontSize: 11, marginBottom: 10 }}>
        Always available — SPL Token / Token-2022 / Memo / ATA / Compute Budget / ALT live inside
        LiteSVM. Metaplex Token Metadata is auto-cloned on first use. No IDL needed for any of these
        (native programs).
      </div>
      {err && <div className="error-banner">{err}</div>}
      <table className="acc-table">
        <thead>
          <tr>
            <th>Label</th>
            <th>Program ID</th>
            <th>Source</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((b) => {
            const attached = attachedProgramIds.has(b.programId);
            return (
              <tr key={b.programId}>
                <td>
                  <div>{b.label}</div>
                  <div style={{ color: 'var(--text-dim)', fontSize: 11 }}>{b.description}</div>
                </td>
                <td className="mono">
                  {b.programId.slice(0, 4)}…{b.programId.slice(-4)}
                </td>
                <td>
                  {b.inSvm ? (
                    <span style={{ color: 'var(--success)' }}>LiteSVM</span>
                  ) : (
                    <span>RPC clone (auto)</span>
                  )}
                </td>
                <td>
                  {attached ? (
                    <span style={{ color: 'var(--text-dim)' }}>attached</span>
                  ) : (
                    <button
                      disabled={busy === b.programId}
                      onClick={() => {
                        void add(b.programId);
                      }}
                    >
                      {busy === b.programId ? '…' : 'Attach'}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
