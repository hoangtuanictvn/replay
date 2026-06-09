import { useState } from 'react';
import { api } from '../api';

export function NewProjectForm({ onDone }: { onDone: () => void }): JSX.Element {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [network, setNetwork] = useState('mainnet-beta');
  const [rpc, setRpc] = useState('https://api.mainnet-beta.solana.com');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (): Promise<void> => {
    setBusy(true);
    setErr(null);
    try {
      await api.call('project.create', {
        name,
        description,
        network,
        rpcEndpointId: rpc,
      });
      onDone();
    } catch (e) {
      setErr(String(e));
      setBusy(false);
    }
  };

  return (
    <>
      <h3>New project</h3>
      {err && <div className="error-banner">{err}</div>}
      <label>Name</label>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="DEX Integration" />
      <label>Description</label>
      <input value={description} onChange={(e) => setDescription(e.target.value)} />
      <label>Network</label>
      <select value={network} onChange={(e) => setNetwork(e.target.value)}>
        <option value="mainnet-beta">mainnet-beta</option>
        <option value="devnet">devnet</option>
        <option value="testnet">testnet</option>
        <option value="custom">custom</option>
      </select>
      <label>RPC URL</label>
      <input value={rpc} onChange={(e) => setRpc(e.target.value)} />
      <div className="actions">
        <button onClick={() => onDone()}>Cancel</button>
        <button className="primary" disabled={!name || busy} onClick={submit}>
          {busy ? 'Creating…' : 'Create'}
        </button>
      </div>
    </>
  );
}
