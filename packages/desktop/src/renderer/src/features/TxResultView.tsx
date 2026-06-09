import { useState } from 'react';

interface LogLine {
  raw: string;
  level: string;
}

export interface TraceNode {
  programId: string;
  depth: number;
  instructionIndex: number;
  cuConsumed: bigint | string | number;
  cuRemaining: bigint | string | number;
  logs: LogLine[];
  events: Array<{ name: string; data: Record<string, unknown> }>;
  returnData: Uint8Array | string | null;
  children: TraceNode[];
  error: string | null;
}

export interface TxSendResult {
  success: boolean;
  errorMessage: string | null;
  cuConsumed: bigint | string | number;
  returnData: string | null;
  logs: string[];
  trace: TraceNode[];
  recordId?: string;
  simulated?: boolean;
}

export function TxResultView({ result }: { result: TxSendResult }): JSX.Element {
  const [tab, setTab] = useState<'tree' | 'logs' | 'return'>('tree');
  return (
    <div className="panel">
      <h2>
        {result.simulated ? 'Simulation' : 'Result'} ·{' '}
        <span style={{ color: result.success ? 'var(--success)' : 'var(--danger)' }}>
          {result.success ? 'SUCCESS' : 'FAILURE'}
        </span>
        {result.simulated && (
          <span
            className="badge"
            style={{ marginLeft: 8, background: 'rgba(90,141,238,0.2)', color: 'var(--accent)' }}
          >
            SIMULATED (no state change)
          </span>
        )}
      </h2>
      <div style={{ color: 'var(--text-dim)', fontSize: 12, marginBottom: 8 }}>
        cu consumed: <span className="mono">{result.cuConsumed.toString()}</span>
        {result.errorMessage && (
          <>
            {' '}· error: <span className="mono" style={{ color: 'var(--danger)' }}>{result.errorMessage}</span>
          </>
        )}
      </div>

      <div className="row" style={{ marginBottom: 8 }}>
        <button className={tab === 'tree' ? 'primary' : ''} onClick={() => setTab('tree')}>
          Instruction tree
        </button>
        <button className={tab === 'logs' ? 'primary' : ''} onClick={() => setTab('logs')}>
          Raw logs
        </button>
        <button className={tab === 'return' ? 'primary' : ''} onClick={() => setTab('return')}>
          Return data
        </button>
      </div>

      {tab === 'tree' && (
        <div className="mono" style={{ fontSize: 11 }}>
          {result.trace.length === 0 ? (
            <div style={{ color: 'var(--text-dim)' }}>
              No trace recorded. Tx failed before reaching the program (signature, account
              resolution, or sanitization). Check error message above.
            </div>
          ) : (
            result.trace.map((node, i) => <TraceFrame key={i} node={node} />)
          )}
        </div>
      )}

      {tab === 'logs' && (
        <pre
          className="mono"
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: 8,
            fontSize: 11,
            maxHeight: 400,
            overflow: 'auto',
            margin: 0,
          }}
        >
          {result.logs.length > 0 ? result.logs.join('\n') : '(no logs — tx never executed)'}
        </pre>
      )}

      {tab === 'return' && (
        <pre
          className="mono"
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: 8,
            fontSize: 11,
            margin: 0,
          }}
        >
          {result.returnData ?? '(none)'}
        </pre>
      )}
    </div>
  );
}

function TraceFrame({ node }: { node: TraceNode }): JSX.Element {
  const [open, setOpen] = useState(true);
  const indent = node.depth * 12;
  const cuConsumed = Number(node.cuConsumed.toString());
  const cuRemaining = Number(node.cuRemaining.toString());
  const total = cuConsumed + cuRemaining || 1;
  const pct = (cuConsumed / total) * 100;
  return (
    <div style={{ marginLeft: indent, marginTop: 4 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          cursor: 'pointer',
        }}
        onClick={() => setOpen((o) => !o)}
      >
        <span style={{ width: 14 }}>{node.children.length > 0 ? (open ? '▾' : '▸') : '•'}</span>
        <span>
          [{node.depth}] {node.programId.slice(0, 4)}…{node.programId.slice(-4)}
        </span>
        <span style={{ color: 'var(--text-dim)' }}>· cu {cuConsumed}</span>
        {node.error && (
          <span style={{ color: 'var(--danger)' }}>· {node.error}</span>
        )}
      </div>
      <div
        style={{
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 2,
          height: 4,
          marginLeft: 20,
          marginTop: 2,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: 'var(--accent)',
          }}
        />
      </div>
      {open && (
        <>
          <div style={{ marginLeft: 20, marginTop: 4, color: 'var(--text-dim)' }}>
            {node.logs
              .filter((l) => l.level !== 'invoke' && l.level !== 'success' && l.level !== 'consumed')
              .map((l, i) => (
                <div key={i}>{l.raw}</div>
              ))}
          </div>
          {node.children.map((c, i) => (
            <TraceFrame key={i} node={c} />
          ))}
        </>
      )}
    </div>
  );
}
