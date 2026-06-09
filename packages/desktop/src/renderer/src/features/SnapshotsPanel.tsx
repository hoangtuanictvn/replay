import { useEffect, useState } from 'react';
import { api } from '../api';
import { useDialogs } from '../components/Dialogs';

interface SnapshotRef {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: number;
  blobHash?: string;
  fingerprint?: string;
}

interface SessionWithSnaps {
  id: string;
  name: string;
  snapshots: SnapshotRef[];
}

export function SnapshotsPanel({
  activeSessionId,
  onChange,
}: {
  activeSessionId: string | null;
  onChange: () => void;
}): JSX.Element {
  const [session, setSession] = useState<SessionWithSnaps | null>(null);
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dialogs = useDialogs();

  const reload = async (): Promise<void> => {
    if (!activeSessionId) {
      setSession(null);
      return;
    }
    try {
      const s = await api.call<SessionWithSnaps>('session.open', { id: activeSessionId });
      setSession(s);
    } catch (e) {
      setErr(String(e));
    }
  };

  useEffect(() => {
    void reload();
  }, [activeSessionId]);

  if (!activeSessionId) {
    return <div className="empty">Select a session in the tree to manage snapshots.</div>;
  }

  const save = async (): Promise<void> => {
    if (!name.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await api.call('snapshot.save', { sessionId: activeSessionId, name: name.trim() });
      setName('');
      await reload();
      onChange();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  };

  const restore = async (snapshotId: string): Promise<void> => {
    setBusy(true);
    try {
      await api.call('snapshot.restore', { sessionId: activeSessionId, snapshotId });
      onChange();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  };

  const fork = async (snapshotId: string, forkName: string): Promise<void> => {
    setBusy(true);
    try {
      await api.call('snapshot.fork', {
        sessionId: activeSessionId,
        snapshotId,
        name: forkName,
      });
      onChange();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel">
      <h2>
        Snapshots ·{' '}
        <span style={{ color: 'var(--text-dim)', textTransform: 'none', fontSize: 12 }}>
          {session?.name}
        </span>
      </h2>
      {err && <div className="error-banner">{err}</div>}

      <div className="row">
        <input
          placeholder="Snapshot name (e.g. pre-swap)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="primary" disabled={!name.trim() || busy} onClick={save}>
          Save current state
        </button>
      </div>

      <table className="acc-table" style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Fingerprint</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {(session?.snapshots ?? []).map((s) => (
            <tr key={s.id}>
              <td>{s.name}</td>
              <td className="mono" style={{ fontSize: 11 }}>
                {s.fingerprint ? `${s.fingerprint.slice(0, 12)}…` : '—'}
              </td>
              <td className="mono" style={{ fontSize: 11 }}>
                {new Date(s.createdAt).toISOString().slice(0, 19)}
              </td>
              <td>
                <button onClick={() => void restore(s.id)}>Restore</button>{' '}
                <button
                  onClick={async () => {
                    const forkName = await dialogs.prompt({
                      title: 'Fork into new session',
                      label: 'New session name',
                      initial: `${s.name}-fork`,
                    });
                    if (forkName) void fork(s.id, forkName);
                  }}
                >
                  Fork
                </button>
              </td>
            </tr>
          ))}
          {(!session || session.snapshots.length === 0) && (
            <tr>
              <td colSpan={4} style={{ color: 'var(--text-dim)' }}>
                no snapshots yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
