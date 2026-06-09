import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Project, SessionMeta } from '../types';
import type { TraceNode } from './TxResultView';

export type InspectorTab = 'details' | 'activity' | 'shortcuts';

interface TxRecord {
  id: string;
  signature: string | null;
  submittedAt: number;
  success: boolean;
  errorMessage: string | null;
  cuConsumed: bigint | string | number;
  trace: TraceNode;
  touchedAccounts: string[];
}

export function InspectorPane({
  project,
  sessions,
  activeSessionId,
  tab,
}: {
  project: Project | null;
  sessions: SessionMeta[];
  activeSessionId: string | null;
  tab: InspectorTab;
}): JSX.Element {
  const [activity, setActivity] = useState<TxRecord[]>([]);

  useEffect(() => {
    if (tab !== 'activity' || !activeSessionId) {
      setActivity([]);
      return;
    }
    void api
      .call<TxRecord[]>('tx.history', { sessionId: activeSessionId })
      .then((list) => setActivity(list.slice(-10).reverse()))
      .catch(() => setActivity([]));
  }, [tab, activeSessionId]);

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const accountCount = project
    ? Object.values(project.programs).reduce((n, p) => n + p.accounts.length, 0)
    : 0;

  return (
    <aside className="inspector">
      <div
        className="inspector-section-title"
        style={{
          padding: '4px 0 12px',
          borderBottom: '1px solid var(--border)',
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        {tab}
      </div>

      {tab === 'details' &&
        (project ? (
          <DetailsTab
            project={project}
            sessions={sessions}
            activeSession={activeSession ?? null}
            accountCount={accountCount}
          />
        ) : (
          <div className="empty">No project selected.</div>
        ))}

      {tab === 'activity' && (
        <ActivityTab activeSessionId={activeSessionId} activity={activity} />
      )}

      {tab === 'shortcuts' && <ShortcutsTab />}
    </aside>
  );
}

function DetailsTab({
  project,
  sessions,
  activeSession,
  accountCount,
}: {
  project: Project;
  sessions: SessionMeta[];
  activeSession: SessionMeta | null;
  accountCount: number;
}): JSX.Element {
  const copy = (value: string): void => {
    void navigator.clipboard.writeText(value);
  };
  const [rpcStatus, setRpcStatus] = useState<{ running: boolean; port: number | null }>({
    running: false,
    port: null,
  });
  const [rpcPort, setRpcPort] = useState('8899');
  const [rpcBusy, setRpcBusy] = useState(false);

  const refreshRpc = (): void => {
    void api
      .call<{ running: boolean; port: number | null; host: string | null }>('rpcServer.status')
      .then((s) => setRpcStatus({ running: s.running, port: s.port }))
      .catch(() => setRpcStatus({ running: false, port: null }));
  };
  useEffect(refreshRpc, []);

  const startRpc = async (): Promise<void> => {
    setRpcBusy(true);
    try {
      await api.call('rpcServer.start', { port: Number(rpcPort) || 8899 });
      refreshRpc();
    } catch (e) {
      window.alert(String(e));
    } finally {
      setRpcBusy(false);
    }
  };
  const stopRpc = async (): Promise<void> => {
    setRpcBusy(true);
    try {
      await api.call('rpcServer.stop');
      refreshRpc();
    } finally {
      setRpcBusy(false);
    }
  };
  const sessionUrl =
    rpcStatus.running && rpcStatus.port && activeSession
      ? `http://127.0.0.1:${rpcStatus.port}/session/${activeSession.id}`
      : null;
  return (
    <>
      <div className="inspector-section">
        <div className="inspector-section-title">Project</div>
        <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{project.name}</div>
        <div className="address" style={{ display: 'flex', alignItems: 'center', marginTop: 2 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{project.id.slice(0, 14)}…</span>
          <button className="copy-btn" onClick={() => copy(project.id)}>
            copy
          </button>
        </div>
        {project.description && (
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-dim)' }}>
            {project.description}
          </div>
        )}
      </div>

      <div className="inspector-section">
        <div className="inspector-section-title">Network</div>
        <div style={{ fontSize: 12 }}>
          <span className="mono">{project.network}</span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginTop: 4,
            fontSize: 11,
          }}
        >
          <span
            className="mono"
            style={{
              wordBreak: 'break-all',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              color: 'var(--text-dim)',
            }}
          >
            {project.rpcEndpointId}
          </span>
          <button className="copy-btn" onClick={() => copy(project.rpcEndpointId)}>
            copy
          </button>
        </div>
      </div>

      <div className="inspector-section">
        <div className="inspector-section-title">Counts</div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
            fontSize: 12,
          }}
        >
          <StatCard label="programs" value={Object.keys(project.programs).length} />
          <StatCard label="accounts" value={accountCount} />
          <StatCard label="sessions" value={sessions.length} />
          <StatCard label="patches" value={project.patches.length} />
        </div>
      </div>

      {activeSession && (
        <div className="inspector-section">
          <div className="inspector-section-title">Active session</div>
          <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
            {activeSession.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
            {activeSession.accountCount} accounts · {activeSession.mutationCount} mutations
          </div>
        </div>
      )}

      <div className="inspector-section">
        <div className="inspector-section-title">RPC endpoint</div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>
          Expose the active session via Solana-compatible JSON-RPC. Point @solana/web3.js or anchor
          tests at the URL.
        </div>
        <div
          style={{
            display: 'flex',
            gap: 4,
            alignItems: 'center',
            marginBottom: 6,
            fontSize: 12,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: rpcStatus.running ? 'var(--success)' : 'var(--text-dim)',
            }}
          />
          <span>{rpcStatus.running ? `running on :${rpcStatus.port}` : 'stopped'}</span>
          {rpcStatus.running && rpcStatus.port && (
            <>
              <button
                className="copy-btn"
                style={{ marginLeft: 6 }}
                onClick={() => copy(`http://127.0.0.1:${rpcStatus.port}`)}
                title="Copy server base URL"
              >
                copy endpoint
              </button>
              {sessionUrl && (
                <button
                  className="copy-btn"
                  onClick={() => copy(sessionUrl)}
                  title="Copy full session URL"
                >
                  copy session URL
                </button>
              )}
            </>
          )}
        </div>
        <div className="row" style={{ gap: 4 }}>
          <input
            value={rpcPort}
            onChange={(e) => setRpcPort(e.target.value)}
            placeholder="port"
            style={{ width: 80 }}
            disabled={rpcStatus.running || rpcBusy}
          />
          {rpcStatus.running ? (
            <button className="danger" disabled={rpcBusy} onClick={() => void stopRpc()}>
              Stop
            </button>
          ) : (
            <button className="primary" disabled={rpcBusy} onClick={() => void startRpc()}>
              Start
            </button>
          )}
        </div>
        {sessionUrl && (
          <div style={{ marginTop: 8 }}>
            <div className="inspector-section-title">Session URL</div>
            <div
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span
                className="mono"
                style={{
                  fontSize: 10,
                  wordBreak: 'break-all',
                  flex: 1,
                  color: 'var(--text)',
                }}
              >
                {sessionUrl}
              </span>
              <button className="copy-btn" onClick={() => copy(sessionUrl)}>
                copy
              </button>
            </div>
            <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-dim)' }}>
              Example: <span className="mono">new Connection("{sessionUrl}")</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function StatCard({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <div
      style={{
        background: 'var(--bg-elev)',
        border: '1px solid var(--border)',
        borderRadius: 4,
        padding: 8,
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 600 }}>{value}</div>
      <div
        style={{
          fontSize: 10,
          color: 'var(--text-dim)',
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function ActivityTab({
  activeSessionId,
  activity,
}: {
  activeSessionId: string | null;
  activity: TxRecord[];
}): JSX.Element {
  const clear = async (): Promise<void> => {
    if (!activeSessionId) return;
    if (!window.confirm) return;
    try {
      await api.call('tx.historyClear', { sessionId: activeSessionId });
    } catch {
      /* ignore */
    }
  };
  if (!activeSessionId) {
    return <div className="empty">Pick a session in the sidebar to see its activity.</div>;
  }
  if (activity.length === 0) {
    return (
      <div className="empty" style={{ padding: 12, fontStyle: 'normal' }}>
        No transactions yet for this session. Use Tx Builder → Simulate or Submit.
      </div>
    );
  }
  return (
    <>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div className="inspector-section-title">Recent transactions</div>
        <button
          style={{ padding: '1px 6px', fontSize: 10 }}
          onClick={() => void clear()}
          title="Clear activity"
        >
          clear
        </button>
      </div>
      {activity.map((tx) => (
        <div key={tx.id} className="activity-item">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              minWidth: 0,
            }}
          >
            <span
              className={`activity-status ${tx.success ? 'success' : 'failure'}`}
            />
            <span className="mono" style={{ fontSize: 11 }}>
              {tx.trace.programId.slice(0, 4)}…{tx.trace.programId.slice(-4)}
            </span>
          </div>
          <div
            style={{
              color: 'var(--text-dim)',
              fontFamily: 'JetBrains Mono, ui-monospace, Menlo, monospace',
              fontSize: 11,
              textAlign: 'right',
            }}
          >
            cu {tx.cuConsumed.toString()}
            <br />
            <span style={{ fontSize: 9 }}>
              {new Date(tx.submittedAt).toISOString().slice(11, 19)}
            </span>
          </div>
        </div>
      ))}
    </>
  );
}

function ShortcutsTab(): JSX.Element {
  const shortcuts: Array<{ keys: string; what: string }> = [
    { keys: 'Right-click', what: 'Show actions for project / program / account / session' },
    { keys: 'Click account', what: 'Open Inspector modal' },
    { keys: 'Click session', what: 'Set as active session' },
    { keys: 'Click program', what: 'Expand / collapse accounts' },
    { keys: 'Esc', what: 'Close modal' },
    { keys: 'Enter', what: 'Submit prompt' },
    { keys: 'Drag sidebar edge', what: 'Resize left sidebar' },
  ];
  const concepts: Array<{ title: string; body: string }> = [
    {
      title: 'Simulate vs Submit',
      body: 'Simulate runs read-only — no state change. Submit persists state + appends to tx history. Both produce logs + trace.',
    },
    {
      title: 'Patch scopes',
      body: 'Project patches apply to every session. Session patches apply to one session. Eval order: project → session.',
    },
    {
      title: 'Built-in programs',
      body: 'SPL Token / Token-2022 / Memo / System / ATA / Compute Budget / ALT are in LiteSVM — attach with zero clone cost.',
    },
  ];
  return (
    <>
      <div className="inspector-section">
        <div className="inspector-section-title">Shortcuts</div>
        {shortcuts.map((s) => (
          <div
            key={s.keys}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '4px 0',
              fontSize: 11,
            }}
          >
            <span className="kbd">{s.keys}</span>
            <span style={{ color: 'var(--text-dim)', textAlign: 'right', flex: 1, marginLeft: 8 }}>
              {s.what}
            </span>
          </div>
        ))}
      </div>
      <div className="inspector-section">
        <div className="inspector-section-title">Concepts</div>
        {concepts.map((c) => (
          <div key={c.title} style={{ marginTop: 8, fontSize: 12 }}>
            <div style={{ color: 'var(--text)', fontWeight: 500 }}>{c.title}</div>
            <div style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 2 }}>{c.body}</div>
          </div>
        ))}
      </div>
    </>
  );
}
