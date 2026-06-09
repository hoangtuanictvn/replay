import { useEffect, useState } from 'react';
import { api } from '../api';
import { useDialogs } from '../components/Dialogs';
import { useToast } from '../components/Toast';
import { TxResultView, type TraceNode } from './TxResultView';

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

export function TxHistoryPanel({
  activeSessionId,
}: {
  activeSessionId: string | null;
}): JSX.Element {
  const [items, setItems] = useState<TxRecord[]>([]);
  const [selected, setSelected] = useState<TxRecord | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();
  const dialogs = useDialogs();

  const reload = (): void => {
    if (!activeSessionId) {
      setItems([]);
      return;
    }
    void api
      .call<TxRecord[]>('tx.history', { sessionId: activeSessionId })
      .then(setItems)
      .catch((e) => setErr(String(e)));
  };

  useEffect(() => {
    reload();
  }, [activeSessionId]);

  const clearAll = async (): Promise<void> => {
    if (!activeSessionId) return;
    const ok = await dialogs.confirm({
      title: 'Clear transaction history',
      message: `Drop all ${items.length} tx records for this session? State stays intact, only the log is wiped.`,
      danger: true,
      confirmText: 'Clear',
    });
    if (!ok) return;
    try {
      await api.call('tx.historyClear', { sessionId: activeSessionId });
      setSelected(null);
      reload();
      toast.success('history cleared');
    } catch (e) {
      toast.error(String(e));
    }
  };

  if (!activeSessionId) {
    return <div className="empty">Select a session to view its transaction history.</div>;
  }

  return (
    <>
      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Transaction history</h2>
          {items.length > 0 && (
            <button className="danger" onClick={() => void clearAll()}>
              Clear all
            </button>
          )}
        </div>
        {err && <div className="error-banner">{err}</div>}
        {items.length === 0 ? (
          <div style={{ color: 'var(--text-dim)' }}>no transactions yet</div>
        ) : (
          <table className="acc-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Status</th>
                <th>CU</th>
                <th>Programs</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items
                .slice()
                .reverse()
                .map((tx) => (
                  <tr key={tx.id}>
                    <td className="mono" style={{ fontSize: 11 }}>
                      {new Date(tx.submittedAt).toISOString().slice(11, 19)}
                    </td>
                    <td style={{ color: tx.success ? 'var(--success)' : 'var(--danger)' }}>
                      {tx.success ? 'OK' : 'ERR'}
                    </td>
                    <td className="mono">{tx.cuConsumed.toString()}</td>
                    <td className="mono" style={{ fontSize: 11 }}>
                      {tx.trace.programId.slice(0, 4)}…{tx.trace.programId.slice(-4)}
                    </td>
                    <td>
                      <button onClick={() => setSelected(tx)}>View</button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <TxResultView
          result={{
            success: selected.success,
            errorMessage: selected.errorMessage,
            cuConsumed: selected.cuConsumed,
            returnData: null,
            logs: selected.trace.logs.map((l) => l.raw),
            trace: [selected.trace],
            recordId: selected.id,
          }}
        />
      )}
    </>
  );
}
