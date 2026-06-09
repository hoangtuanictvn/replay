import { useState } from 'react';
import { api } from '../api';

export function AddAccountForm({
  projectId,
  programId,
  onDone,
}: {
  projectId: string;
  programId: string;
  onDone: () => void;
}): JSX.Element {
  const [address, setAddress] = useState('');
  const [label, setLabel] = useState('');
  const [slot, setSlot] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (): Promise<void> => {
    setBusy(true);
    setErr(null);
    try {
      const params: Record<string, unknown> = { projectId, programId, address };
      if (label) params.label = label;
      if (slot) params.slot = slot;
      await api.call('account.add', params);
      onDone();
    } catch (e) {
      setErr(String(e));
      setBusy(false);
    }
  };

  return (
    <>
      <h3>
        Add account under {programId.slice(0, 4)}…{programId.slice(-4)}
      </h3>
      {err && <div className="error-banner">{err}</div>}
      <label>Address</label>
      <input
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="base58 PDA address"
        className="mono"
      />
      <label>Label (optional)</label>
      <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="DLMM pool A" />
      <label>Slot (optional)</label>
      <input value={slot} onChange={(e) => setSlot(e.target.value)} />
      <div className="actions">
        <button onClick={() => onDone()}>Cancel</button>
        <button className="primary" disabled={!address || busy} onClick={submit}>
          {busy ? 'Cloning…' : 'Add'}
        </button>
      </div>
    </>
  );
}
