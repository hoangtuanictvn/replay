import { useEffect, useState } from 'react';
import { api } from '../api';
import { AddressInput } from '../components/AddressInput';
import { useAddressSuggestions } from '../components/useAddressSuggestions';
import type { Project } from '../types';

interface EditableField {
  name: string;
  type: string;
}

interface DecodedResult {
  address: string;
  programId: string;
  accountName: string | null;
  value: unknown;
  dataLen: number;
  raw?: string;
  decoder?: 'anchor' | 'native' | null;
  editableFields?: EditableField[];
}

type PatchKind = 'setField' | 'setLamports' | 'setOwner' | 'rawSplice';

export function PatchAccountForm({
  projectId,
  sessionId,
  address,
  project,
  onDone,
}: {
  projectId: string;
  sessionId: string | null;
  address: string;
  project?: Project | null;
  onDone: () => void;
}): JSX.Element {
  const suggestions = useAddressSuggestions(project ?? null);
  const [scope, setScope] = useState<'project' | 'session'>(sessionId ? 'session' : 'project');
  const [decoded, setDecoded] = useState<DecodedResult | null>(null);
  const [decodeErr, setDecodeErr] = useState<string | null>(null);
  const [kind, setKind] = useState<PatchKind>('setField');
  const [fieldPath, setFieldPath] = useState('');
  const [valueJson, setValueJson] = useState('');
  const [lamports, setLamports] = useState('');
  const [owner, setOwner] = useState('');
  const [offset, setOffset] = useState('0');
  const [hexBytes, setHexBytes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void api
      .call<DecodedResult>('account.decode', { projectId, address })
      .then(setDecoded)
      .catch((e) => setDecodeErr(String(e)));
  }, [projectId, address]);

  const submit = async (): Promise<void> => {
    setBusy(true);
    setErr(null);
    try {
      let op: unknown;
      if (kind === 'setField') {
        op = { kind: 'setField', fieldPath, valueJson };
      } else if (kind === 'setLamports') {
        op = { kind: 'setLamports', lamports: BigInt(lamports || '0') };
      } else if (kind === 'setOwner') {
        op = { kind: 'setOwner', owner };
      } else {
        const hex = hexBytes.startsWith('0x') ? hexBytes.slice(2) : hexBytes;
        const clean = hex.replace(/\s+/g, '');
        if (clean.length % 2 !== 0) throw new Error('hex must have even length');
        const bytes = new Uint8Array(clean.length / 2);
        for (let i = 0; i < bytes.length; i += 1) {
          bytes[i] = Number.parseInt(clean.substr(i * 2, 2), 16);
        }
        op = { kind: 'rawSplice', offset: Number(offset), bytes };
      }
      // bigint can't survive structured clone via IPC reliably — encode setLamports as string then
      // re-cast in handler when needed. Our PatchOp schema expects bigint — for now we send string
      // and the handler stores as-is (patch engine cast happens at apply time).
      await api.call('patch.create', {
        scope,
        scopeId: scope === 'project' ? projectId : sessionId,
        target: address,
        op,
        enabled: true,
      });
      onDone();
    } catch (e) {
      setErr(String(e));
      setBusy(false);
    }
  };

  return (
    <>
      <h3>
        Patch {address.slice(0, 6)}…{address.slice(-4)}
      </h3>
      {err && <div className="error-banner">{err}</div>}

      <label>Scope</label>
      <div className="row">
        <button
          className={scope === 'project' ? 'primary' : ''}
          onClick={() => setScope('project')}
        >
          Project
        </button>
        <button
          className={scope === 'session' ? 'primary' : ''}
          disabled={!sessionId}
          onClick={() => setScope('session')}
        >
          Session
        </button>
      </div>

      <label>Decoded</label>
      {decodeErr && <div style={{ color: 'var(--danger)', fontSize: 11 }}>{decodeErr}</div>}
      {decoded && (
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, padding: 8, maxHeight: 200, overflow: 'auto' }}>
          <div style={{ color: 'var(--text-dim)', fontSize: 11, marginBottom: 4 }}>
            program: <span className="mono">{decoded.programId}</span> · accountName:{' '}
            <span className="mono">{decoded.accountName ?? '<no IDL match>'}</span> · {decoded.dataLen} bytes
          </div>
          <pre className="mono" style={{ margin: 0, fontSize: 11 }}>
            {JSON.stringify(decoded.value ?? decoded.raw ?? '(raw bytes)', null, 2)}
          </pre>
        </div>
      )}

      <label>Patch type</label>
      <select value={kind} onChange={(e) => setKind(e.target.value as PatchKind)}>
        <option value="setField">setField (IDL-aware)</option>
        <option value="setLamports">setLamports</option>
        <option value="setOwner">setOwner</option>
        <option value="rawSplice">rawSplice (hex)</option>
      </select>

      {kind === 'setField' && (
        <>
          {decoded?.editableFields && decoded.editableFields.length > 0 && (
            <>
              <label>Editable fields ({decoded.decoder})</label>
              <select
                value={fieldPath}
                onChange={(e) => setFieldPath(e.target.value)}
              >
                <option value="">— pick a field —</option>
                {decoded.editableFields.map((f) => (
                  <option key={f.name} value={f.name}>
                    {f.name} : {f.type}
                  </option>
                ))}
              </select>
            </>
          )}
          <label>Field path (dotted) {decoded?.editableFields ? '— or type manually' : ''}</label>
          <input
            value={fieldPath}
            onChange={(e) => setFieldPath(e.target.value)}
            placeholder={decoded?.decoder === 'native' ? 'mintAuthority / supply / decimals …' : 'admin'}
            className="mono"
          />
          <label>Value (JSON-encoded)</label>
          <input
            value={valueJson}
            onChange={(e) => setValueJson(e.target.value)}
            placeholder={'"<base58 pubkey>" or "1000000" or null'}
            className="mono"
          />
        </>
      )}
      {kind === 'setLamports' && (
        <>
          <label>Lamports</label>
          <input value={lamports} onChange={(e) => setLamports(e.target.value)} placeholder="1000000000" />
        </>
      )}
      {kind === 'setOwner' && (
        <>
          <label>New owner (base58)</label>
          <AddressInput value={owner} onChange={setOwner} suggestions={suggestions} />
        </>
      )}
      {kind === 'rawSplice' && (
        <>
          <label>Offset</label>
          <input value={offset} onChange={(e) => setOffset(e.target.value)} />
          <label>Bytes (hex)</label>
          <input value={hexBytes} onChange={(e) => setHexBytes(e.target.value)} className="mono" />
        </>
      )}

      <div className="actions">
        <button onClick={() => onDone()}>Cancel</button>
        <button className="primary" disabled={busy} onClick={submit}>
          {busy ? 'Saving…' : 'Save patch'}
        </button>
      </div>
    </>
  );
}
