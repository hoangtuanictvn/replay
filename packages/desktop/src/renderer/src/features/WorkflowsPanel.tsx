import { useEffect, useState } from 'react';
import { api } from '../api';
import { AddressInput } from '../components/AddressInput';
import { useDialogs } from '../components/Dialogs';
import { useToast } from '../components/Toast';
import { useAddressSuggestions } from '../components/useAddressSuggestions';
import type { Project } from '../types';

type StepKind = 'tx' | 'airdrop' | 'warpTime' | 'warpSlot' | 'expireBlockhash' | 'resetSession';

interface BaseStep {
  id: string;
  name: string;
  kind: StepKind;
}

interface TxIxLite {
  programId: string;
  programLabel: string;
  instructionName: string;
  summary: string;
  accounts: Array<{ pubkey: string; isSigner: boolean; isWritable: boolean }>;
  dataBase64: string;
}

type Step =
  | (BaseStep & {
      kind: 'tx';
      ixs: TxIxLite[];
      computeUnitLimit?: number | null;
      airdropPayerLamports?: string | null;
      payerKeypairId?: string | null;
      templateId?: string | null;
    })
  | (BaseStep & { kind: 'airdrop'; pubkey: string; lamports: string })
  | (BaseStep & { kind: 'warpTime'; seconds: number })
  | (BaseStep & { kind: 'warpSlot'; slot: string })
  | (BaseStep & { kind: 'expireBlockhash' })
  | (BaseStep & { kind: 'resetSession' });

interface Workflow {
  id: string;
  name: string;
  description: string;
  steps: Step[];
  createdAt: number;
  updatedAt: number;
}

interface StepResult {
  stepId: string;
  kind: StepKind;
  name: string;
  success: boolean;
  errorMessage: string | null;
  durationMs: number;
  tx?: {
    cuConsumed: string;
    logs: string[];
    errorMessage: string | null;
    success: boolean;
  };
}

interface RunResult {
  workflowId: string | null;
  sessionId: string;
  startedAt: number;
  completedAt: number;
  success: boolean;
  steps: StepResult[];
}

const newId = (): string =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const defaultStep = (kind: StepKind): Step => {
  const base = { id: newId(), name: prettyKind(kind) };
  switch (kind) {
    case 'tx':
      return {
        ...base,
        kind,
        ixs: [],
        computeUnitLimit: null,
        airdropPayerLamports: null,
        payerKeypairId: null,
        templateId: null,
      };
    case 'airdrop':
      return { ...base, kind, pubkey: '', lamports: '1000000000' };
    case 'warpTime':
      return { ...base, kind, seconds: 60 };
    case 'warpSlot':
      return { ...base, kind, slot: '0' };
    case 'expireBlockhash':
      return { ...base, kind };
    case 'resetSession':
      return { ...base, kind };
  }
};

const prettyKind = (k: StepKind): string => {
  switch (k) {
    case 'tx':
      return 'Submit tx';
    case 'airdrop':
      return 'Airdrop SOL';
    case 'warpTime':
      return 'Warp by time';
    case 'warpSlot':
      return 'Warp to slot';
    case 'expireBlockhash':
      return 'Expire blockhash';
    case 'resetSession':
      return 'Reset session';
  }
};

export function WorkflowsPanel({
  project,
  activeSessionId,
}: {
  project: Project;
  activeSessionId: string | null;
}): JSX.Element {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [editing, setEditing] = useState<Workflow | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const dialogs = useDialogs();
  const suggestions = useAddressSuggestions(project);

  const reload = (): void => {
    void api
      .call<Workflow[]>('workflow.list', { projectId: project.id })
      .then(setWorkflows)
      .catch(() => setWorkflows([]));
  };
  useEffect(() => {
    reload();
  }, [project.id]);

  const newWorkflow = async (): Promise<void> => {
    const name = await dialogs.prompt({
      title: 'New workflow',
      label: 'Name',
      placeholder: 'e.g. setup-and-swap',
    });
    if (!name?.trim()) return;
    setEditing({
      id: '',
      name: name.trim(),
      description: '',
      steps: [],
      createdAt: 0,
      updatedAt: 0,
    });
  };

  const save = async (): Promise<void> => {
    if (!editing) return;
    setBusy(true);
    try {
      const saved = await api.call<Workflow>('workflow.save', {
        projectId: project.id,
        ...(editing.id && { id: editing.id }),
        name: editing.name,
        description: editing.description,
        steps: editing.steps,
      });
      setEditing(saved);
      reload();
      toast.success('workflow saved');
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string): Promise<void> => {
    const ok = await dialogs.confirm({
      title: 'Delete workflow',
      message: 'Permanently remove this workflow?',
      danger: true,
      confirmText: 'Delete',
    });
    if (!ok) return;
    await api.call('workflow.delete', { projectId: project.id, id });
    reload();
    if (editing?.id === id) setEditing(null);
  };

  const run = async (wf?: Workflow): Promise<void> => {
    if (!activeSessionId) {
      toast.error('select a session first');
      return;
    }
    const target = wf ?? editing;
    if (!target) return;
    if (target.steps.length === 0) {
      toast.error('workflow has no steps');
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const r = await api.call<RunResult>('workflow.run', {
        sessionId: activeSessionId,
        ...(target.id && { workflowId: target.id }),
        ...(!target.id && { steps: target.steps }),
      });
      setResult(r);
      if (r.success) toast.success(`workflow done · ${r.steps.length} steps`);
      else toast.error('workflow halted (see results below)');
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <WorkflowEditor
        workflow={editing}
        project={project}
        busy={busy}
        onChange={setEditing}
        onSave={save}
        onCancel={() => setEditing(null)}
        onRun={() => void run()}
        result={result}
        suggestions={suggestions}
      />
    );
  }

  return (
    <>
      <div className="panel">
        <h2>Workflows</h2>
        <div style={{ color: 'var(--text-dim)', fontSize: 11, marginBottom: 10 }}>
          A workflow is a named sequence of steps run against a session. Steps include tx submits,
          airdrops, time warps, blockhash expiry, session reset.
        </div>
        <div className="row">
          <button className="primary" onClick={() => void newWorkflow()}>
            + New workflow
          </button>
        </div>
        {workflows.length === 0 ? (
          <div style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: 12 }}>
            no workflows yet
          </div>
        ) : (
          <table className="acc-table" style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Steps</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {workflows.map((w) => (
                <tr key={w.id}>
                  <td>{w.name}</td>
                  <td>{w.steps.length}</td>
                  <td className="mono" style={{ fontSize: 11 }}>
                    {new Date(w.updatedAt).toISOString().slice(0, 19)}
                  </td>
                  <td>
                    <button onClick={() => void run(w)}>Run</button>{' '}
                    <button onClick={() => setEditing(w)}>Edit</button>{' '}
                    <button className="danger" onClick={() => void remove(w.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {result && <RunResultView result={result} />}
    </>
  );
}

function WorkflowEditor({
  workflow,
  project,
  busy,
  onChange,
  onSave,
  onCancel,
  onRun,
  result,
  suggestions,
}: {
  workflow: Workflow;
  project: Project;
  busy: boolean;
  onChange: (w: Workflow) => void;
  onSave: () => Promise<void>;
  onCancel: () => void;
  onRun: () => void;
  result: RunResult | null;
  suggestions: import('../components/useAddressSuggestions').AddressSuggestion[];
}): JSX.Element {
  const update = (patch: Partial<Workflow>): void => onChange({ ...workflow, ...patch });
  const addStep = (kind: StepKind): void =>
    update({ steps: [...workflow.steps, defaultStep(kind)] });
  const removeStep = (id: string): void =>
    update({ steps: workflow.steps.filter((s) => s.id !== id) });
  const moveStep = (id: string, dir: -1 | 1): void => {
    const idx = workflow.steps.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const target = idx + dir;
    if (target < 0 || target >= workflow.steps.length) return;
    const next = workflow.steps.slice();
    const tmp = next[idx]!;
    next[idx] = next[target]!;
    next[target] = tmp;
    update({ steps: next });
  };
  const updateStep = (id: string, patch: Partial<Step>): void => {
    update({
      steps: workflow.steps.map((s) => (s.id === id ? ({ ...s, ...patch } as Step) : s)),
    });
  };

  const allTemplates = (project.txTemplates ?? []) as Array<{
    id: string;
    name: string;
    ixs: TxIxLite[];
  }>;

  return (
    <>
      <div className="panel">
        <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>Workflow editor</h2>
          <div className="row">
            <button onClick={onCancel}>Back</button>
            <button onClick={onRun} disabled={busy}>
              ▶ Run
            </button>
            <button className="primary" onClick={() => void onSave()} disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        <label>Name</label>
        <input value={workflow.name} onChange={(e) => update({ name: e.target.value })} />
        <label>Description</label>
        <input
          value={workflow.description}
          onChange={(e) => update({ description: e.target.value })}
        />

        <div
          style={{
            marginTop: 14,
            paddingTop: 10,
            borderTop: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0 }}>Steps ({workflow.steps.length})</h2>
            <div className="row" style={{ flexWrap: 'wrap', gap: 4 }}>
              <button onClick={() => addStep('tx')}>+ Tx</button>
              <button onClick={() => addStep('airdrop')}>+ Airdrop</button>
              <button onClick={() => addStep('warpTime')}>+ Warp time</button>
              <button onClick={() => addStep('warpSlot')}>+ Warp slot</button>
              <button onClick={() => addStep('expireBlockhash')}>+ Expire bh</button>
              <button onClick={() => addStep('resetSession')}>+ Reset</button>
            </div>
          </div>

          {workflow.steps.length === 0 && (
            <div
              style={{
                color: 'var(--text-dim)',
                fontSize: 12,
                padding: 12,
                textAlign: 'center',
              }}
            >
              add a step above
            </div>
          )}

          {workflow.steps.map((step, idx) => (
            <div key={step.id} className="step-card">
              <div className="step-card-header">
                <span
                  className="mono"
                  style={{ width: 22, color: 'var(--text-dim)', textAlign: 'right' }}
                >
                  #{idx + 1}
                </span>
                <span className="badge">{prettyKind(step.kind)}</span>
                <input
                  value={step.name}
                  onChange={(e) => updateStep(step.id, { name: e.target.value })}
                  style={{ flex: 1 }}
                />
                <button onClick={() => moveStep(step.id, -1)} disabled={idx === 0} title="Move up">
                  ↑
                </button>
                <button
                  onClick={() => moveStep(step.id, 1)}
                  disabled={idx === workflow.steps.length - 1}
                  title="Move down"
                >
                  ↓
                </button>
                <button className="danger" onClick={() => removeStep(step.id)} title="Remove step">
                  ✕
                </button>
              </div>
              <div className="step-card-body">
                <StepForm
                  step={step}
                  templates={allTemplates}
                  onPatch={(patch) => updateStep(step.id, patch)}
                  suggestions={suggestions}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {result && <RunResultView result={result} />}
    </>
  );
}

function StepForm({
  step,
  templates,
  onPatch,
  suggestions,
}: {
  step: Step;
  templates: Array<{ id: string; name: string; ixs: TxIxLite[] }>;
  onPatch: (patch: Partial<Step>) => void;
  suggestions: import('../components/useAddressSuggestions').AddressSuggestion[];
}): JSX.Element {
  if (step.kind === 'airdrop') {
    return (
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        <AddressInput
          value={step.pubkey}
          onChange={(v) => onPatch({ pubkey: v } as Partial<Step>)}
          suggestions={suggestions}
          placeholder="recipient pubkey"
          style={{ flex: '1 1 200px' }}
        />
        <input
          value={step.lamports}
          onChange={(e) => onPatch({ lamports: e.target.value } as Partial<Step>)}
          placeholder="lamports"
          className="mono"
          style={{ width: 160 }}
        />
      </div>
    );
  }
  if (step.kind === 'warpTime') {
    return (
      <input
        value={step.seconds}
        onChange={(e) =>
          onPatch({ seconds: Number(e.target.value) || 0 } as Partial<Step>)
        }
        placeholder="seconds"
        style={{ width: 160 }}
      />
    );
  }
  if (step.kind === 'warpSlot') {
    return (
      <input
        value={step.slot}
        onChange={(e) => onPatch({ slot: e.target.value } as Partial<Step>)}
        placeholder="absolute slot"
        className="mono"
        style={{ width: 200 }}
      />
    );
  }
  if (step.kind === 'expireBlockhash' || step.kind === 'resetSession') {
    return (
      <div style={{ color: 'var(--text-dim)', fontSize: 11 }}>(no parameters)</div>
    );
  }

  // tx step
  return <TxStepForm step={step} templates={templates} onPatch={onPatch} />;
}

function TxStepForm({
  step,
  templates,
  onPatch,
}: {
  step: Step & { kind: 'tx' };
  templates: Array<{ id: string; name: string; ixs: TxIxLite[] }>;
  onPatch: (patch: Partial<Step>) => void;
}): JSX.Element {
  const [keypairs, setKeypairs] = useState<Array<{ id: string; label: string; pubkey: string }>>([]);
  useEffect(() => {
    void api
      .call<Array<{ id: string; label: string; pubkey: string }>>('keypair.list')
      .then(setKeypairs)
      .catch(() => setKeypairs([]));
  }, []);

  return (
    <div>
      <div style={{ color: 'var(--text-dim)', fontSize: 11, marginBottom: 6 }}>
        Pulls instructions from a saved template. Build templates from the Tx Builder tab.
      </div>
      <div className="row" style={{ alignItems: 'center' }}>
        <span style={{ color: 'var(--text-dim)', fontSize: 12, minWidth: 80 }}>Template</span>
        <select
          value={step.templateId ?? ''}
          onChange={(e) => {
            const id = e.target.value;
            if (!id) {
              onPatch({ templateId: null } as Partial<Step>);
              return;
            }
            const tpl = templates.find((t) => t.id === id);
            if (!tpl) return;
            onPatch({ templateId: id, ixs: tpl.ixs } as Partial<Step>);
          }}
          style={{ flex: 1 }}
        >
          <option value="">— pick a template —</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.ixs.length} ix)
            </option>
          ))}
        </select>
        {step.templateId && (
          <button
            title="Re-sync ixs from the currently linked template (in case template was edited)"
            onClick={() => {
              const tpl = templates.find((t) => t.id === step.templateId);
              if (!tpl) return;
              onPatch({ ixs: tpl.ixs } as Partial<Step>);
            }}
          >
            ⟲ Reload
          </button>
        )}
      </div>

      <div className="row" style={{ marginTop: 6, alignItems: 'center' }}>
        <span style={{ color: 'var(--text-dim)', fontSize: 12, minWidth: 80 }}>Payer</span>
        <select
          value={step.payerKeypairId ?? ''}
          onChange={(e) =>
            onPatch({ payerKeypairId: e.target.value || null } as Partial<Step>)
          }
          style={{ flex: 1 }}
        >
          <option value="">— ephemeral (auto-generate + airdrop) —</option>
          {keypairs.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label} · {k.pubkey.slice(0, 8)}…
            </option>
          ))}
        </select>
      </div>

      <div className="row" style={{ marginTop: 6, alignItems: 'center' }}>
        <span style={{ color: 'var(--text-dim)', fontSize: 12, minWidth: 80 }}>CU limit</span>
        <input
          value={step.computeUnitLimit ?? ''}
          onChange={(e) =>
            onPatch({
              computeUnitLimit: e.target.value ? Number(e.target.value) : null,
            } as Partial<Step>)
          }
          placeholder="(default)"
          style={{ width: 160 }}
        />
      </div>

      <div className="row" style={{ marginTop: 6, alignItems: 'center' }}>
        <span style={{ color: 'var(--text-dim)', fontSize: 12, minWidth: 80 }}>
          Payer airdrop (lamports)
        </span>
        <input
          value={step.airdropPayerLamports ?? ''}
          onChange={(e) =>
            onPatch({
              airdropPayerLamports: e.target.value || null,
            } as Partial<Step>)
          }
          placeholder="(skip)"
          className="mono"
          style={{ width: 180 }}
        />
      </div>

      <div style={{ marginTop: 6, fontSize: 11 }}>
        Current ixs: <strong>{step.ixs.length}</strong>
      </div>
      {step.ixs.map((ix, i) => (
        <div
          key={i}
          style={{
            marginTop: 4,
            color: 'var(--text-dim)',
            fontSize: 11,
          }}
        >
          {i + 1}. {ix.instructionName} <span className="mono">on {ix.programLabel}</span> · {ix.summary}
        </div>
      ))}
    </div>
  );
}

function RunResultView({ result }: { result: RunResult }): JSX.Element {
  return (
    <div className="panel">
      <h2>
        Run result ·{' '}
        <span style={{ color: result.success ? 'var(--success)' : 'var(--danger)' }}>
          {result.success ? 'SUCCESS' : 'FAILED'}
        </span>
      </h2>
      <div style={{ color: 'var(--text-dim)', fontSize: 11, marginBottom: 10 }}>
        {result.steps.length} steps · {result.completedAt - result.startedAt} ms total
      </div>
      {result.steps.map((s, i) => (
        <StepResultRow key={s.stepId} index={i + 1} step={s} />
      ))}
    </div>
  );
}

function StepResultRow({ index, step }: { index: number; step: StepResult }): JSX.Element {
  const [open, setOpen] = useState(false);
  const hasLogs = !!(step.tx && step.tx.logs.length > 0);
  const expandable = hasLogs || !!step.errorMessage;
  return (
    <div
      style={{
        borderBottom: '1px solid var(--border)',
        padding: '8px 0',
        fontSize: 12,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          cursor: expandable ? 'pointer' : 'default',
        }}
        onClick={() => expandable && setOpen((v) => !v)}
      >
        <span style={{ width: 14, color: 'var(--text-dim)' }}>
          {expandable ? (open ? '▾' : '▸') : '·'}
        </span>
        <span className="mono" style={{ width: 22, color: 'var(--text-dim)' }}>
          #{index}
        </span>
        <span className="badge">{prettyKind(step.kind)}</span>
        <span style={{ flex: 1 }}>{step.name}</span>
        <span
          style={{
            color: step.success ? 'var(--success)' : 'var(--danger)',
            minWidth: 16,
          }}
        >
          {step.success ? '✓' : '✕'}
        </span>
        <span
          className="mono"
          style={{ fontSize: 11, color: 'var(--text-dim)', minWidth: 70, textAlign: 'right' }}
        >
          {step.tx ? `cu ${step.tx.cuConsumed} · ` : ''}
          {step.durationMs.toFixed(1)} ms
        </span>
      </div>

      {open && (
        <div style={{ marginLeft: 32, marginTop: 6 }}>
          {step.errorMessage && (
            <div
              style={{
                color: 'var(--danger)',
                fontSize: 11,
                marginBottom: 6,
                wordBreak: 'break-all',
              }}
            >
              error: <span className="mono">{step.errorMessage}</span>
            </div>
          )}
          {hasLogs && (
            <pre
              className="mono"
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: 8,
                fontSize: 11,
                maxHeight: 320,
                overflow: 'auto',
                margin: 0,
                whiteSpace: 'pre-wrap',
              }}
            >
              {step.tx!.logs.join('\n')}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
