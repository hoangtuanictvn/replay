import { useState } from 'react';
import { api } from '../api';

export function AttachIdlForm({
  programId,
  onDone,
}: {
  programId: string;
  onDone: () => void;
}): JSX.Element {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (): Promise<void> => {
    setBusy(true);
    setErr(null);
    try {
      const idl = JSON.parse(text);
      await api.call('idl.attach', { programId, idl });
      onDone();
    } catch (e) {
      setErr(String(e));
      setBusy(false);
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;
    setText(await file.text());
  };

  return (
    <>
      <h3>Attach IDL to {programId.slice(0, 4)}…{programId.slice(-4)}</h3>
      {err && <div className="error-banner">{err}</div>}
      <label>Load from file</label>
      <input type="file" accept=".json,application/json" onChange={onFile} />
      <label>Or paste IDL JSON</label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Anchor IDL JSON"
        rows={12}
        style={{
          width: '100%',
          fontFamily: 'JetBrains Mono, ui-monospace, Menlo, monospace',
          fontSize: 11,
          padding: 8,
          background: 'var(--bg)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          borderRadius: 4,
        }}
      />
      <div className="actions">
        <button onClick={() => onDone()}>Cancel</button>
        <button className="primary" disabled={!text.trim() || busy} onClick={submit}>
          {busy ? 'Attaching…' : 'Attach'}
        </button>
      </div>
    </>
  );
}
