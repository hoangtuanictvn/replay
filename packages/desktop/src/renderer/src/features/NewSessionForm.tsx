import { useState } from 'react';
import { api } from '../api';

export function NewSessionForm({
  projectId,
  onDone,
}: {
  projectId: string;
  onDone: () => void;
}): JSX.Element {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (): Promise<void> => {
    setBusy(true);
    setErr(null);
    try {
      await api.call('session.create', { projectId, name });
      onDone();
    } catch (e) {
      setErr(String(e));
      setBusy(false);
    }
  };

  return (
    <>
      <h3>New session</h3>
      {err && <div className="error-banner">{err}</div>}
      <label>Name</label>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="happy-path" />
      <div className="actions">
        <button onClick={() => onDone()}>Cancel</button>
        <button className="primary" disabled={!name || busy} onClick={submit}>
          {busy ? 'Creating…' : 'Create'}
        </button>
      </div>
    </>
  );
}
