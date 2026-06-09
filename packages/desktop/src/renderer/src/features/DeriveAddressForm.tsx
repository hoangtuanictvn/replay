import { useState } from 'react';
import { api } from '../api';

type Tab = 'ata' | 'pda';

interface SeedRow {
  kind: 'pubkey' | 'utf8' | 'hex' | 'u8' | 'u32' | 'u64';
  value: string;
}

export function DeriveAddressForm({
  onPick,
  onClose,
  suggestions = [],
}: {
  onPick: (address: string) => void;
  onClose: () => void;
  suggestions?: Array<{ pubkey: string; label: string }>;
}): JSX.Element {
  const [tab, setTab] = useState<Tab>('ata');

  // ATA fields
  const [owner, setOwner] = useState('');
  const [mint, setMint] = useState('');
  const [token2022, setToken2022] = useState(false);

  // PDA fields
  const [programId, setProgramId] = useState('');
  const [seeds, setSeeds] = useState<SeedRow[]>([{ kind: 'utf8', value: '' }]);

  const [result, setResult] = useState<{ address: string; bump?: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const derive = async (): Promise<void> => {
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      if (tab === 'ata') {
        if (!owner.trim() || !mint.trim()) throw new Error('owner + mint required');
        const r = await api.call<{ address: string }>('address.deriveAta', {
          owner: owner.trim(),
          mint: mint.trim(),
          ...(token2022 && { tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb' }),
        });
        setResult(r);
      } else {
        if (!programId.trim()) throw new Error('program ID required');
        const r = await api.call<{ address: string; bump: number }>('address.derivePda', {
          programId: programId.trim(),
          seeds,
        });
        setResult(r);
      }
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h3>Derive address</h3>
      {err && <div className="error-banner">{err}</div>}

      <div className="row" style={{ marginBottom: 10 }}>
        <button className={tab === 'ata' ? 'primary' : ''} onClick={() => setTab('ata')}>
          Associated Token Account
        </button>
        <button className={tab === 'pda' ? 'primary' : ''} onClick={() => setTab('pda')}>
          PDA (custom seeds)
        </button>
      </div>

      {tab === 'ata' && (
        <>
          <label>Owner (wallet pubkey)</label>
          <input
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            className="mono"
            list="derive-owner-suggest"
          />
          <datalist id="derive-owner-suggest">
            {suggestions.map((s) => (
              <option key={s.pubkey} value={s.pubkey}>
                {s.label}
              </option>
            ))}
          </datalist>
          <label>Mint</label>
          <input
            value={mint}
            onChange={(e) => setMint(e.target.value)}
            className="mono"
            list="derive-mint-suggest"
          />
          <datalist id="derive-mint-suggest">
            {suggestions.map((s) => (
              <option key={s.pubkey} value={s.pubkey}>
                {s.label}
              </option>
            ))}
          </datalist>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              textTransform: 'none',
              letterSpacing: 0,
              fontSize: 12,
              color: 'var(--text)',
            }}
          >
            <input
              type="checkbox"
              checked={token2022}
              onChange={(e) => setToken2022(e.target.checked)}
            />
            Mint uses Token-2022
          </label>
        </>
      )}

      {tab === 'pda' && (
        <>
          <label>Program ID</label>
          <input
            value={programId}
            onChange={(e) => setProgramId(e.target.value)}
            className="mono"
            list="derive-programid-suggest"
          />
          <datalist id="derive-programid-suggest">
            {suggestions.map((s) => (
              <option key={s.pubkey} value={s.pubkey}>
                {s.label}
              </option>
            ))}
          </datalist>
          <label>Seeds</label>
          {seeds.map((s, i) => (
            <div className="row" key={i} style={{ marginTop: 4 }}>
              <select
                value={s.kind}
                onChange={(e) =>
                  setSeeds((prev) =>
                    prev.map((x, idx) =>
                      idx === i ? { ...x, kind: e.target.value as SeedRow['kind'] } : x,
                    ),
                  )
                }
                style={{ width: 110 }}
              >
                <option value="utf8">utf8</option>
                <option value="pubkey">pubkey</option>
                <option value="hex">hex</option>
                <option value="u8">u8</option>
                <option value="u32">u32 LE</option>
                <option value="u64">u64 LE</option>
              </select>
              <input
                value={s.value}
                onChange={(e) =>
                  setSeeds((prev) =>
                    prev.map((x, idx) => (idx === i ? { ...x, value: e.target.value } : x)),
                  )
                }
                className="mono"
                style={{ flex: 1 }}
                list={s.kind === 'pubkey' ? `derive-seed-pubkey-${i}` : undefined}
              />
              {s.kind === 'pubkey' && (
                <datalist id={`derive-seed-pubkey-${i}`}>
                  {suggestions.map((sg) => (
                    <option key={sg.pubkey} value={sg.pubkey}>
                      {sg.label}
                    </option>
                  ))}
                </datalist>
              )}
              <button
                className="danger"
                onClick={() => setSeeds((prev) => prev.filter((_, idx) => idx !== i))}
              >
                ×
              </button>
            </div>
          ))}
          <button
            style={{ marginTop: 6 }}
            onClick={() => setSeeds((prev) => [...prev, { kind: 'utf8', value: '' }])}
          >
            + Add seed
          </button>
        </>
      )}

      {result && (
        <div
          style={{
            marginTop: 12,
            background: 'var(--bg)',
            border: '1px solid var(--success)',
            borderRadius: 4,
            padding: 8,
          }}
        >
          <div className="mono" style={{ fontSize: 11, wordBreak: 'break-all' }}>
            {result.address}
          </div>
          {result.bump !== undefined && (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
              bump: {result.bump}
            </div>
          )}
        </div>
      )}

      <div className="actions">
        <button onClick={onClose}>Close</button>
        <button onClick={derive} disabled={busy}>
          {busy ? 'Deriving…' : 'Derive'}
        </button>
        {result && (
          <button
            className="primary"
            onClick={() => {
              onPick(result.address);
              onClose();
            }}
          >
            Use this address
          </button>
        )}
      </div>
    </>
  );
}
