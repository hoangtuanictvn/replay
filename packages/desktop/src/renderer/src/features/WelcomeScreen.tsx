import { useEffect, useState } from 'react';
import { api } from '../api';
import { useDialogs } from '../components/Dialogs';
import { useToast } from '../components/Toast';

interface RecentProject {
  path: string;
  name: string;
  lastOpened: number;
}

interface RpcEndpoint {
  id: string;
  label: string;
  url: string;
  network: string;
}

const isMac = api.platform === 'darwin';

export function WelcomeScreen(): JSX.Element {
  const [recents, setRecents] = useState<RecentProject[]>([]);
  const [rpcEndpoints, setRpcEndpoints] = useState<RpcEndpoint[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNetwork, setNewNetwork] = useState<'mainnet-beta' | 'devnet' | 'testnet'>(
    'mainnet-beta',
  );
  const [newRpc, setNewRpc] = useState<string>('mainnet-public');
  const toast = useToast();
  const dialogs = useDialogs();

  const reload = async (): Promise<void> => {
    try {
      const [r, e] = await Promise.all([
        api.call<RecentProject[]>('app.recentProjects'),
        api.call<RpcEndpoint[]>('app.rpcEndpoints'),
      ]);
      setRecents(r);
      setRpcEndpoints(e);
      if (e[0] && !e.find((ep) => ep.id === newRpc)) setNewRpc(e[0].id);
    } catch (err) {
      toast.error(String(err));
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const openPicker = async (): Promise<void> => {
    try {
      const r = await api.call<{ canceled?: boolean; path?: string }>('app.openProjectPicker');
      if (!r.canceled) await reload();
    } catch (err) {
      toast.error(String(err));
    }
  };

  const newProject = async (): Promise<void> => {
    if (!newName.trim()) {
      toast.error('Project name required');
      return;
    }
    setCreating(true);
    try {
      await api.call('app.newProjectPicker', {
        name: newName.trim(),
        network: newNetwork,
        rpcEndpointId: newRpc,
      });
    } catch (err) {
      toast.error(String(err));
    } finally {
      setCreating(false);
    }
  };

  const openRecent = async (p: RecentProject): Promise<void> => {
    try {
      await api.call('app.openProjectByPath', { path: p.path });
    } catch (err) {
      toast.error(String(err));
      await reload();
    }
  };

  const removeRecent = async (p: RecentProject): Promise<void> => {
    const ok = await dialogs.confirm({
      title: 'Remove from recents?',
      message: `${p.name} (${p.path})`,
      confirmText: 'Remove',
    });
    if (!ok) return;
    try {
      await api.call('app.removeRecent', { path: p.path });
      await reload();
    } catch (err) {
      toast.error(String(err));
    }
  };

  return (
    <div className="welcome">
      <div className="welcome-titlebar" />

      <div className="welcome-grid">
        <div className="welcome-hero">
          <h1>Relay</h1>
          <p className="welcome-sub">Solana program sandbox · LiteSVM · per-project workspaces</p>

          <div className="welcome-actions">
            <button className="primary big" onClick={() => void openPicker()}>
              Open Project…
            </button>
            <span className="welcome-shortcut">{isMac ? '⌘O' : 'Ctrl+O'}</span>
          </div>

          <div className="welcome-new">
            <div className="welcome-new-title">New project</div>
            <div className="welcome-new-row">
              <input
                placeholder="Project name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <select
                value={newNetwork}
                onChange={(e) => setNewNetwork(e.target.value as typeof newNetwork)}
              >
                <option value="mainnet-beta">mainnet-beta</option>
                <option value="devnet">devnet</option>
                <option value="testnet">testnet</option>
              </select>
              <select value={newRpc} onChange={(e) => setNewRpc(e.target.value)}>
                {rpcEndpoints.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
              <button
                className="primary"
                disabled={creating || !newName.trim()}
                onClick={() => void newProject()}
              >
                {creating ? 'Creating…' : 'Create…'}
              </button>
            </div>
            <p className="welcome-hint">
              You'll pick a folder. Relay writes <code>.relay.json</code> + <code>.relay/</code>{' '}
              inside.
            </p>
          </div>
        </div>

        <div className="welcome-recents">
          <div className="welcome-recents-title">Recent</div>
          {recents.length === 0 && <div className="welcome-empty">No recent projects.</div>}
          {recents.map((r) => (
            <div className="welcome-recent" key={r.path}>
              <button className="welcome-recent-main" onClick={() => void openRecent(r)}>
                <div className="welcome-recent-name">{r.name}</div>
                <div className="welcome-recent-path">{r.path}</div>
              </button>
              <button
                className="welcome-recent-remove"
                title="Remove from recents"
                onClick={() => void removeRecent(r)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
