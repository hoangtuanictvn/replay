import { useEffect, useState } from 'react';
import { api } from '../api';
import { useDialogs } from '../components/Dialogs';
import { useToast } from '../components/Toast';

interface KeypairMeta {
  id: string;
  label: string;
  pubkey: string;
  createdAt: number;
  sealed: boolean;
}

export function KeypairsPanel({
  activeSessionId,
}: {
  activeSessionId?: string | null;
}): JSX.Element {
  const [items, setItems] = useState<KeypairMeta[]>([]);
  const [label, setLabel] = useState('');
  const [secret, setSecret] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [airdropping, setAirdropping] = useState<string | null>(null);
  const dialogs = useDialogs();
  const toast = useToast();

  const copySecret = async (id: string, label: string): Promise<void> => {
    const ok = await dialogs.confirm({
      title: 'Reveal secret key',
      message:
        `The base58 secret for "${label}" will be copied to your clipboard. ` +
        `Anyone with this string can sign as this keypair. Don't paste into untrusted places.`,
      danger: true,
      confirmText: 'Reveal & copy',
    });
    if (!ok) return;
    try {
      const r = await api.call<{ secret: string }>('keypair.exportSecret', {
        id,
        format: 'base58',
      });
      await navigator.clipboard.writeText(r.secret);
      toast.success(`secret copied (base58) — ${label}`);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const copySecretJson = async (id: string, label: string): Promise<void> => {
    const ok = await dialogs.confirm({
      title: 'Export secret as JSON array',
      message:
        `The 64-byte secret array for "${label}" will be copied to your clipboard ` +
        `(Solana-CLI / id.json format).`,
      danger: true,
      confirmText: 'Reveal & copy',
    });
    if (!ok) return;
    try {
      const r = await api.call<{ secret: string }>('keypair.exportSecret', {
        id,
        format: 'json',
      });
      await navigator.clipboard.writeText(r.secret);
      toast.success(`secret copied (JSON) — ${label}`);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const airdrop = async (pubkey: string): Promise<void> => {
    if (!activeSessionId) {
      setErr('select a session first (left sidebar)');
      return;
    }
    const input = await dialogs.prompt({
      title: `Airdrop SOL`,
      label: `to ${pubkey.slice(0, 6)}…${pubkey.slice(-4)}`,
      initial: '10',
      placeholder: 'SOL amount',
    });
    if (!input?.trim()) return;
    const sol = Number(input);
    if (!Number.isFinite(sol) || sol <= 0) {
      setErr('invalid amount');
      return;
    }
    const lamports = BigInt(Math.round(sol * 1_000_000_000));
    setAirdropping(pubkey);
    setErr(null);
    try {
      await api.call('session.airdrop', {
        sessionId: activeSessionId,
        pubkey,
        lamports: lamports.toString(),
      });
    } catch (e) {
      setErr(String(e));
    } finally {
      setAirdropping(null);
    }
  };

  const reload = async (): Promise<void> => {
    try {
      setItems(await api.call<KeypairMeta[]>('keypair.list'));
    } catch (e) {
      setErr(String(e));
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const generate = async (): Promise<void> => {
    if (!label.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await api.call('keypair.generate', { label: label.trim() });
      setLabel('');
      await reload();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  };

  const importKp = async (): Promise<void> => {
    if (!label.trim() || !secret.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      let secretInput: string | number[] = secret.trim();
      try {
        const parsed = JSON.parse(secretInput);
        if (Array.isArray(parsed)) secretInput = parsed as number[];
      } catch {
        // not JSON — assume base58
      }
      await api.call('keypair.import', { label: label.trim(), secretKey: secretInput });
      setLabel('');
      setSecret('');
      await reload();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string): Promise<void> => {
    await api.call('keypair.delete', { id });
    await reload();
  };

  return (
    <div className="panel">
      <h2>Sandbox keypairs</h2>
      <div style={{ color: 'var(--text-dim)', fontSize: 11, marginBottom: 10 }}>
        Local-only. Used to sign sandbox transactions. Do NOT use for mainnet funds.
        {items.some((i) => !i.sealed) && (
          <span style={{ color: 'var(--danger)', display: 'block', marginTop: 4 }}>
            ⚠ {items.filter((i) => !i.sealed).length} keypair(s) stored unsealed (created before
            safeStorage was wired, or platform doesn't support it).{' '}
            <button
              style={{ padding: '1px 6px', fontSize: 10, marginLeft: 4 }}
              onClick={async () => {
                setErr(null);
                try {
                  const r = await api.call<{ updated: number }>('keypair.reseal');
                  if (r.updated === 0) {
                    setErr('nothing to re-seal');
                  }
                  await reload();
                } catch (e) {
                  setErr(String(e));
                }
              }}
            >
              Re-seal now
            </button>
          </span>
        )}
      </div>
      {err && <div className="error-banner">{err}</div>}

      <div className="row">
        <input
          placeholder="Label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          style={{ flex: '1 1 200px' }}
        />
        <button className="primary" disabled={!label.trim() || busy} onClick={generate}>
          Generate
        </button>
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <input
          placeholder="Secret (base58 OR JSON [...64 bytes...])"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          className="mono"
        />
        <button disabled={!label.trim() || !secret.trim() || busy} onClick={importKp}>
          Import
        </button>
      </div>

      <table className="acc-table" style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th>Label</th>
            <th>Pubkey</th>
            <th>Sealed</th>
            <th>Created</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((k) => (
            <tr key={k.id}>
              <td>{k.label}</td>
              <td className="mono">
                {k.pubkey.slice(0, 8)}…{k.pubkey.slice(-4)}{' '}
                <button
                  style={{ padding: '2px 6px', fontSize: 11, marginLeft: 4 }}
                  onClick={() => void navigator.clipboard.writeText(k.pubkey)}
                >
                  copy
                </button>
              </td>
              <td>{k.sealed ? '✓' : '—'}</td>
              <td className="mono" style={{ fontSize: 11 }}>
                {new Date(k.createdAt).toISOString().slice(0, 19)}
              </td>
              <td>
                <button
                  disabled={!activeSessionId || airdropping === k.pubkey}
                  onClick={() => void airdrop(k.pubkey)}
                  title={
                    activeSessionId
                      ? 'Fund this pubkey with SOL in active session'
                      : 'Select a session first'
                  }
                >
                  {airdropping === k.pubkey ? '…' : 'Airdrop'}
                </button>{' '}
                <button
                  onClick={() => void copySecret(k.id, k.label)}
                  title="Copy base58 secret key"
                >
                  Copy secret
                </button>{' '}
                <button
                  onClick={() => void copySecretJson(k.id, k.label)}
                  title="Copy Solana-CLI JSON (64-byte array)"
                  style={{ padding: '2px 6px', fontSize: 11 }}
                >
                  JSON
                </button>{' '}
                <button className="danger" onClick={() => void remove(k.id)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={5} style={{ color: 'var(--text-dim)' }}>
                no keypairs yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
