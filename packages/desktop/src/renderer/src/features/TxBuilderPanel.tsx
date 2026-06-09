import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useDialogs } from '../components/Dialogs';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import type { Project } from '../types';
import { DeriveAddressForm } from './DeriveAddressForm';
import { TxResultView, type TxSendResult } from './TxResultView';

interface KeypairMeta {
  id: string;
  label: string;
  pubkey: string;
  sealed: boolean;
}

interface IxAccountInput {
  pubkey: string;
  isSigner: boolean;
  isWritable: boolean;
}

interface PendingIx {
  id: number;
  programId: string;
  programLabel: string;
  instructionName: string;
  /** Single-line preview. */
  summary: string;
  accounts: IxAccountInput[];
  dataBase64: string;
}

interface TxTemplate {
  id: string;
  name: string;
  description: string;
  ixs: Array<{
    programId: string;
    programLabel: string;
    instructionName: string;
    summary: string;
    accounts: IxAccountInput[];
    dataBase64: string;
  }>;
  computeUnitLimit: number | null;
  airdropLamports: string | null;
  createdAt: number;
  updatedAt: number;
}

interface IdlInstruction {
  name: string;
  docs: string[] | null;
  args: Array<{ name: string; type: unknown }>;
  accounts: Array<{
    name: string;
    isWritable: boolean;
    isSigner: boolean;
    optional: boolean;
    docs: string[] | null;
  }>;
}

interface InstructionsList {
  hasIdl: boolean;
  source?: 'anchor' | 'native' | 'none';
  idlName?: string;
  instructions: IdlInstruction[];
}

type Mode = 'instruction' | 'raw';

export function TxBuilderPanel({
  project,
  activeSessionId,
}: {
  project: Project;
  activeSessionId: string | null;
}): JSX.Element {
  const [programId, setProgramId] = useState<string>('');
  const [mode, setMode] = useState<Mode>('instruction');
  const [instructions, setInstructions] = useState<InstructionsList>({ hasIdl: false, instructions: [] });
  const [selectedIx, setSelectedIx] = useState<IdlInstruction | null>(null);
  const [argValues, setArgValues] = useState<Record<string, string>>({});
  const [namedAccounts, setNamedAccounts] = useState<Record<string, string>>({});
  const [dataHex, setDataHex] = useState('');
  const [accounts, setAccounts] = useState<IxAccountInput[]>([]);
  const [keypairs, setKeypairs] = useState<KeypairMeta[]>([]);
  const [payerId, setPayerId] = useState<string>('');
  const [cuLimit, setCuLimit] = useState('');
  const [airdrop, setAirdrop] = useState('10000000000');
  const [drafts, setDrafts] = useState<PendingIx[]>([]);
  const [result, setResult] = useState<TxSendResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [templates, setTemplates] = useState<TxTemplate[]>([]);
  const [editingDraftId, setEditingDraftId] = useState<number | null>(null);
  const [loadedTemplateId, setLoadedTemplateId] = useState<string | null>(null);
  const [deriveOpen, setDeriveOpen] = useState<null | { onPick: (addr: string) => void }>(null);
  const toast = useToast();
  const dialogs = useDialogs();
  /** Skip the next programId-change auto-reset (we're loading from a draft and will set state ourselves). */
  const editingFromDraftRef = useRef(false);
  let nextDraftId = drafts.length > 0 ? Math.max(...drafts.map((d) => d.id)) + 1 : 1;

  useEffect(() => {
    void api.call<KeypairMeta[]>('keypair.list').then((list) => {
      setKeypairs(list);
      if (list.length && !payerId) setPayerId(list[0]!.id);
    });
  }, []);

  const reloadTemplates = (): void => {
    void api
      .call<TxTemplate[]>('tx.templateList', { projectId: project.id })
      .then(setTemplates)
      .catch(() => setTemplates([]));
  };

  useEffect(() => {
    reloadTemplates();
  }, [project.id]);

  const updateLoadedTemplate = async (): Promise<void> => {
    if (!loadedTemplateId) return;
    setErr(null);
    try {
      const ixs: PendingIx[] = [...drafts];
      if (programId) {
        try {
          ixs.push(await draftFromForm());
        } catch {
          /* ignore */
        }
      }
      if (ixs.length === 0) throw new Error('nothing to save');
      const current = templates.find((t) => t.id === loadedTemplateId);
      await api.call('tx.templateSave', {
        projectId: project.id,
        id: loadedTemplateId,
        name: current?.name ?? 'untitled',
        description: current?.description ?? '',
        ixs: ixs.map((d) => ({
          programId: d.programId,
          programLabel: d.programLabel,
          instructionName: d.instructionName,
          summary: d.summary,
          accounts: d.accounts,
          dataBase64: d.dataBase64,
        })),
        computeUnitLimit: cuLimit ? Number(cuLimit) : null,
        airdropLamports: airdrop || null,
      });
      reloadTemplates();
      toast.success(`updated "${current?.name ?? 'template'}"`);
    } catch (e) {
      setErr(String(e));
      toast.error(String(e));
    }
  };

  const saveTemplate = async (): Promise<void> => {
    setErr(null);
    try {
      const ixs: PendingIx[] = [...drafts];
      if (programId) {
        try {
          ixs.push(await draftFromForm());
        } catch {
          /* ignore form errors when saving */
        }
      }
      if (ixs.length === 0) throw new Error('nothing to save (build at least one instruction)');
      const name = await dialogs.prompt({
        title: 'Save template',
        label: 'Template name',
        placeholder: 'e.g. mint setup',
      });
      if (!name?.trim()) return;
      await api.call('tx.templateSave', {
        projectId: project.id,
        name: name.trim(),
        ixs: ixs.map((d) => ({
          programId: d.programId,
          programLabel: d.programLabel,
          instructionName: d.instructionName,
          summary: d.summary,
          accounts: d.accounts,
          dataBase64: d.dataBase64,
        })),
        computeUnitLimit: cuLimit ? Number(cuLimit) : null,
        airdropLamports: airdrop || null,
      });
      reloadTemplates();
    } catch (e) {
      setErr(String(e));
    }
  };

  const loadTemplate = (templateId: string): void => {
    if (!templateId) return;
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;
    setDrafts(
      tpl.ixs.map((ix, idx) => ({
        id: idx + 1,
        programId: ix.programId,
        programLabel: ix.programLabel,
        instructionName: ix.instructionName,
        summary: ix.summary,
        accounts: ix.accounts,
        dataBase64: ix.dataBase64,
      })),
    );
    if (tpl.computeUnitLimit !== null) setCuLimit(String(tpl.computeUnitLimit));
    if (tpl.airdropLamports !== null) setAirdrop(tpl.airdropLamports);
    setProgramId('');
    setSelectedIx(null);
    setArgValues({});
    setNamedAccounts({});
    setDataHex('');
    setAccounts([]);
    setEditingDraftId(null);
    setLoadedTemplateId(templateId);
  };

  const deleteTemplate = async (templateId: string): Promise<void> => {
    const ok = await dialogs.confirm({
      title: 'Delete template',
      message: 'Permanently remove this saved template?',
      danger: true,
      confirmText: 'Delete',
    });
    if (!ok) return;
    await api.call('tx.templateDelete', { projectId: project.id, id: templateId });
    reloadTemplates();
  };

  useEffect(() => {
    if (!programId) {
      setInstructions({ hasIdl: false, instructions: [] });
      setSelectedIx(null);
      return;
    }
    void api
      .call<InstructionsList>('program.listInstructions', { programId })
      .then((list) => {
        setInstructions(list);
        if (editingFromDraftRef.current) {
          // editDraft is driving — keep its mode + selectedIx.
          return;
        }
        if (list.instructions.length === 0) setMode('raw');
        else setMode('instruction');
        setSelectedIx(null);
      })
      .catch(() => {
        if (editingFromDraftRef.current) return;
        setInstructions({ hasIdl: false, instructions: [] });
        setMode('raw');
      });
  }, [programId]);

  // When instruction picked, init args + accounts — unless editDraft is driving
  // (which sets these explicitly from the decoded draft).
  useEffect(() => {
    if (!selectedIx) return;
    if (editingFromDraftRef.current) return;
    const initArgs: Record<string, string> = {};
    for (const a of selectedIx.args) initArgs[a.name] = '';
    setArgValues(initArgs);
    const initAccs: Record<string, string> = {};
    for (const a of selectedIx.accounts) initAccs[a.name] = '';
    setNamedAccounts(initAccs);
  }, [selectedIx]);

  if (!activeSessionId) {
    return <div className="empty">Select a session in the tree to build transactions.</div>;
  }

  const addAccount = (): void =>
    setAccounts((a) => [...a, { pubkey: '', isSigner: false, isWritable: false }]);
  const removeAccount = (i: number): void => setAccounts((a) => a.filter((_, idx) => idx !== i));
  const updateAccount = (i: number, patch: Partial<IxAccountInput>): void =>
    setAccounts((a) => a.map((acc, idx) => (idx === i ? { ...acc, ...patch } : acc)));

  const knownAccountSuggestions: Array<{ pubkey: string; label: string }> = [
    ...Object.values(project.programs).flatMap((p) =>
      p.accounts.map((a) => ({
        pubkey: a.address,
        label: a.label && a.label !== a.address ? `${a.label} (account)` : 'account',
      })),
    ),
    ...keypairs.map((k) => ({ pubkey: k.pubkey, label: `${k.label} (keypair)` })),
    ...Object.values(project.programs).map((p) => ({
      pubkey: p.programId,
      label: `${p.label} (program)`,
    })),
  ];

  const deriveSuggestions = knownAccountSuggestions;

  const hexToBase64 = (hex: string): string => {
    const clean = (hex.startsWith('0x') ? hex.slice(2) : hex).replace(/\s+/g, '');
    if (clean.length % 2 !== 0) throw new Error('hex needs even length');
    const bytes = new Uint8Array(clean.length / 2);
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Number.parseInt(clean.substr(i * 2, 2), 16);
    }
    return btoa(String.fromCharCode(...bytes));
  };

  /**
   * Resolve the current form into a PendingIx (without mutating state).
   * Throws if form is incomplete.
   */
  const draftFromForm = async (): Promise<PendingIx> => {
    if (!programId) throw new Error('program required');
    const programLabel =
      Object.values(project.programs).find((p) => p.programId === programId)?.label ?? programId;

    if (mode === 'instruction' && selectedIx) {
      const missing = selectedIx.accounts
        .filter((a) => !a.optional && !(namedAccounts[a.name] ?? '').trim())
        .map((a) => a.name);
      if (missing.length > 0) {
        throw new Error(`missing required account(s): ${missing.join(', ')}`);
      }
      const args: Record<string, unknown> = {};
      for (const a of selectedIx.args) {
        const raw = argValues[a.name] ?? '';
        if (raw === '') {
          args[a.name] = null;
          continue;
        }
        try {
          args[a.name] = JSON.parse(raw);
        } catch {
          args[a.name] = raw;
        }
      }
      const enc = await api.call<{ dataBase64: string; dataHex: string }>('tx.encodeIx', {
        programId,
        name: selectedIx.name,
        args,
      });
      const ixAccounts = selectedIx.accounts
        .filter((a) => !a.optional || (namedAccounts[a.name] ?? '').trim())
        .map((a) => ({
          pubkey: (namedAccounts[a.name] ?? '').trim(),
          isSigner: a.isSigner,
          isWritable: a.isWritable,
        }));
      const argPreview = selectedIx.args
        .map((a) => `${a.name}=${argValues[a.name] ?? '∅'}`)
        .join(', ');
      return {
        id: nextDraftId,
        programId,
        programLabel,
        instructionName: selectedIx.name,
        summary: argPreview || `${ixAccounts.length} accounts`,
        accounts: ixAccounts,
        dataBase64: enc.dataBase64,
      };
    }
    if (accounts.some((a) => !a.pubkey.trim())) {
      throw new Error('all account rows need a pubkey (or remove empty rows)');
    }
    const dataBase64 = hexToBase64(dataHex);
    return {
      id: nextDraftId,
      programId,
      programLabel,
      instructionName: 'raw',
      summary: `${dataHex.length} hex chars · ${accounts.length} accounts`,
      accounts: [...accounts],
      dataBase64,
    };
  };

  /**
   * Final list of instructions to send: drafts plus current form (if non-empty).
   */
  const collectInstructions = async (): Promise<PendingIx[]> => {
    const list: PendingIx[] = [...drafts];
    if (programId) {
      try {
        const current = await draftFromForm();
        list.push(current);
      } catch (e) {
        if (drafts.length === 0) throw e;
      }
    }
    if (list.length === 0) throw new Error('no instructions to send');
    return list;
  };

  const buildPayload = async (): Promise<{
    sessionId: string;
    build: Record<string, unknown>;
  }> => {
    const ixs = await collectInstructions();
    return {
      sessionId: activeSessionId!,
      build: {
        payer: 'AUTO',
        ixs: ixs.map((d) => ({
          programId: d.programId,
          accounts: d.accounts,
          dataBase64: d.dataBase64,
        })),
        signers: [{ pubkey: 'AUTO', secretKey: 'AUTO' }],
        airdropPayer: airdrop,
        ...(cuLimit && { computeUnitLimit: Number(cuLimit) }),
        ...(payerId && { payerKeypairId: payerId }),
      },
    };
  };

  const addToTx = async (position: 'prepend' | 'append' | 'replace'): Promise<void> => {
    setErr(null);
    try {
      const draft = await draftFromForm();
      if (editingDraftId !== null && position === 'replace') {
        // Replace the edited draft in place, keep its id and position
        setDrafts((prev) =>
          prev.map((d) => (d.id === editingDraftId ? { ...draft, id: editingDraftId } : d)),
        );
        setEditingDraftId(null);
      } else {
        setDrafts((prev) => (position === 'prepend' ? [draft, ...prev] : [...prev, draft]));
      }
      setProgramId('');
      setSelectedIx(null);
      setArgValues({});
      setNamedAccounts({});
      setDataHex('');
      setAccounts([]);
    } catch (e) {
      setErr(String(e));
    }
  };

  const cancelEdit = (): void => {
    setEditingDraftId(null);
    setProgramId('');
    setSelectedIx(null);
    setArgValues({});
    setNamedAccounts({});
    setDataHex('');
    setAccounts([]);
  };

  const removeDraft = (id: number): void =>
    setDrafts((prev) => prev.filter((d) => d.id !== id));

  /**
   * Pull a draft back into the form for editing. Drops it from the list; user
   * then re-Append / re-Prepend to restore. Tries to load args structurally
   * (when the instruction name matches a known IDL/native ix); otherwise falls
   * back to raw hex mode with the original bytes + accounts.
   */
  const editDraft = async (draftId: number): Promise<void> => {
    const draft = drafts.find((d) => d.id === draftId);
    if (!draft) return;
    setErr(null);
    setResult(null);

    editingFromDraftRef.current = true;
    setProgramId(draft.programId);

    let list: InstructionsList | null = null;
    try {
      list = await api.call<InstructionsList>('program.listInstructions', {
        programId: draft.programId,
      });
      setInstructions(list);
    } catch {
      list = null;
    }

    const matchedIx = list?.instructions.find((i) => i.name === draft.instructionName);
    if (matchedIx) {
      setMode('instruction');
      setSelectedIx(matchedIx);

      // Restore named accounts in IDL order
      const newNamed: Record<string, string> = {};
      matchedIx.accounts.forEach((acc, idx) => {
        newNamed[acc.name] = draft.accounts[idx]?.pubkey ?? '';
      });
      setNamedAccounts(newNamed);

      // Try to decode args back via Anchor IDL (if attached). Fallback: empty.
      const initArgs: Record<string, string> = {};
      for (const a of matchedIx.args) initArgs[a.name] = '';
      try {
        const decoded = await api.call<{
          source: 'anchor' | 'native' | 'none';
          name: string | null;
          args: Record<string, unknown> | null;
        }>('tx.decodeIx', { programId: draft.programId, dataBase64: draft.dataBase64 });
        if ((decoded.source === 'anchor' || decoded.source === 'native') && decoded.args) {
          for (const a of matchedIx.args) {
            if (a.name in decoded.args) {
              const v = decoded.args[a.name];
              initArgs[a.name] = JSON.stringify(v);
            }
          }
          toast.success(`Args restored from ${decoded.source} decode.`);
        } else {
          toast.info('Args not restorable — re-enter manually.');
        }
      } catch {
        toast.info('Could not decode args — re-enter manually.');
      }
      setArgValues(initArgs);
    } else {
      setMode('raw');
      setSelectedIx(null);
      const raw = atob(draft.dataBase64);
      const hex = Array.from(raw)
        .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('');
      setDataHex(hex);
      setAccounts(draft.accounts);
      toast.info('Loaded into raw mode — bytes + accounts preserved.');
    }

    // Mark which draft we're editing — keep it in the list so position is preserved
    setEditingDraftId(draftId);
    setTimeout(() => {
      editingFromDraftRef.current = false;
    }, 100);
  };

  const moveDraft = (id: number, dir: -1 | 1): void =>
    setDrafts((prev) => {
      const idx = prev.findIndex((d) => d.id === id);
      if (idx < 0) return prev;
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = prev.slice();
      const tmp = next[idx]!;
      next[idx] = next[target]!;
      next[target] = tmp;
      return next;
    });

  const simulate = async (): Promise<void> => {
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const payload = await buildPayload();
      const r = await api.call<TxSendResult>('tx.simulate', payload);
      setResult({ ...r, simulated: true });
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  };

  const submit = async (): Promise<void> => {
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const payload = await buildPayload();
      const r = await api.call<TxSendResult>('tx.send', payload);
      setResult(r);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="panel">
        <h2>Templates</h2>
        <div style={{ color: 'var(--text-dim)', fontSize: 11, marginBottom: 8 }}>
          Save the current tx (drafts + form) as a named template. Reload anytime.
        </div>
        <div className="row" style={{ alignItems: 'center' }}>
          <select
            value={loadedTemplateId ?? ''}
            onChange={(e) => loadTemplate(e.target.value)}
            style={{ flex: 1 }}
          >
            <option value="">— load template —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.ixs.length} ix)
              </option>
            ))}
          </select>
          {loadedTemplateId && (
            <button
              className="primary"
              onClick={() => void updateLoadedTemplate()}
              title="Overwrite the loaded template with current drafts"
            >
              ⟲ Update template
            </button>
          )}
          <button onClick={saveTemplate}>Save as new…</button>
          {loadedTemplateId && (
            <button onClick={() => setLoadedTemplateId(null)} title="Detach from loaded template">
              ⌫ Unlink
            </button>
          )}
        </div>
        {templates.length > 0 && (
          <table className="acc-table" style={{ marginTop: 10 }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Ix</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td>{t.ixs.length}</td>
                  <td className="mono" style={{ fontSize: 11 }}>
                    {new Date(t.updatedAt).toISOString().slice(0, 19)}
                  </td>
                  <td>
                    <button onClick={() => loadTemplate(t.id)}>Load</button>{' '}
                    <button className="danger" onClick={() => void deleteTemplate(t.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {drafts.length > 0 && (
        <div className="panel">
          <h2>Pending instructions ({drafts.length})</h2>
          <div style={{ color: 'var(--text-dim)', fontSize: 11, marginBottom: 8 }}>
            Reorder with ↑/↓. Current form (below) executes at the position you choose when adding.
          </div>
          {drafts.map((d, idx) => (
            <div
              key={d.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: 8,
                borderBottom: '1px solid var(--border)',
                fontSize: 12,
                background:
                  editingDraftId === d.id ? 'rgba(90,141,238,0.12)' : undefined,
              }}
            >
              <span
                className="mono"
                style={{
                  width: 22,
                  color: 'var(--text-dim)',
                  textAlign: 'right',
                }}
              >
                #{idx + 1}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div>
                  <span style={{ color: 'var(--accent)' }}>{d.instructionName}</span>{' '}
                  <span style={{ color: 'var(--text-dim)' }}>on</span> {d.programLabel}
                </div>
                <div
                  className="mono"
                  style={{
                    color: 'var(--text-dim)',
                    fontSize: 10,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {d.summary}
                </div>
              </div>
              <button
                onClick={() => moveDraft(d.id, -1)}
                disabled={idx === 0}
                title="Move up"
              >
                ↑
              </button>
              <button
                onClick={() => moveDraft(d.id, 1)}
                disabled={idx === drafts.length - 1}
                title="Move down"
              >
                ↓
              </button>
              <button
                onClick={() => void editDraft(d.id)}
                title="Load into form for editing (then re-Append to restore)"
              >
                ✎ Edit
              </button>
              <button className="danger" onClick={() => removeDraft(d.id)} title="Remove">
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="panel">
        <h2>
          {editingDraftId !== null
            ? `Editing instruction #${drafts.findIndex((d) => d.id === editingDraftId) + 1}`
            : `Build instruction · session ${activeSessionId.slice(0, 8)}`}
        </h2>
        {err && <div className="error-banner">{err}</div>}

        <label>Program</label>
        <select value={programId} onChange={(e) => setProgramId(e.target.value)}>
          <option value="">— pick a program —</option>
          {Object.values(project.programs).map((p) => (
            <option key={p.programId} value={p.programId}>
              {p.label} · {p.programId.slice(0, 8)}…
            </option>
          ))}
        </select>

        {programId && (
          <div className="row" style={{ marginTop: 8 }}>
            <button
              className={mode === 'instruction' ? 'primary' : ''}
              onClick={() => setMode('instruction')}
              disabled={instructions.instructions.length === 0}
            >
              Instruction{' '}
              {instructions.instructions.length > 0
                ? `(${instructions.instructions.length} via ${instructions.source})`
                : '— none known'}
            </button>
            <button className={mode === 'raw' ? 'primary' : ''} onClick={() => setMode('raw')}>
              Raw hex
            </button>
          </div>
        )}

        {mode === 'instruction' && instructions.instructions.length > 0 && (
          <>
            <label>Instruction</label>
            <select
              value={selectedIx?.name ?? ''}
              onChange={(e) => {
                const ix = instructions.instructions.find((i) => i.name === e.target.value);
                setSelectedIx(ix ?? null);
              }}
            >
              <option value="">— pick an instruction —</option>
              {instructions.instructions.map((ix) => (
                <option key={ix.name} value={ix.name}>
                  {ix.name}
                  {ix.args.length > 0 ? ` (${ix.args.length} args)` : ''}
                </option>
              ))}
            </select>

            {selectedIx && (
              <>
                {selectedIx.docs && selectedIx.docs.length > 0 && (
                  <div
                    style={{
                      color: 'var(--text-dim)',
                      fontSize: 11,
                      marginTop: 6,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {selectedIx.docs.join('\n')}
                  </div>
                )}

                {selectedIx.args.length > 0 && (
                  <>
                    <label style={{ marginTop: 10 }}>Args</label>
                    {selectedIx.args.map((arg) => (
                      <div className="row" key={arg.name} style={{ marginTop: 4 }}>
                        <div style={{ minWidth: 140, color: 'var(--text-dim)', fontSize: 12 }}>
                          {arg.name}{' '}
                          <span className="mono" style={{ fontSize: 10 }}>
                            {typeof arg.type === 'string' ? arg.type : JSON.stringify(arg.type)}
                          </span>
                        </div>
                        <input
                          value={argValues[arg.name] ?? ''}
                          onChange={(e) =>
                            setArgValues((p) => ({ ...p, [arg.name]: e.target.value }))
                          }
                          placeholder={'JSON value (e.g. 42, "foo", true)'}
                          className="mono"
                        />
                      </div>
                    ))}
                  </>
                )}

                <label style={{ marginTop: 10 }}>Accounts</label>
                {selectedIx.accounts.map((acc) => (
                  <div className="row" key={acc.name} style={{ marginTop: 4 }}>
                    <div style={{ minWidth: 140, color: 'var(--text-dim)', fontSize: 12 }}>
                      {acc.name}
                      <div style={{ fontSize: 10 }}>
                        {acc.isSigner && '· signer'} {acc.isWritable && '· mut'}{' '}
                        {acc.optional && '· opt'}
                      </div>
                    </div>
                    <input
                      value={namedAccounts[acc.name] ?? ''}
                      onChange={(e) =>
                        setNamedAccounts((p) => ({ ...p, [acc.name]: e.target.value }))
                      }
                      placeholder="base58 pubkey"
                      className="mono"
                      list={`acc-suggestions-${acc.name}`}
                      style={{ flex: '1 1 200px' }}
                    />
                    <button
                      title="Derive ATA or PDA"
                      onClick={() =>
                        setDeriveOpen({
                          onPick: (addr) =>
                            setNamedAccounts((p) => ({ ...p, [acc.name]: addr })),
                        })
                      }
                    >
                      ⛬
                    </button>
                    <datalist id={`acc-suggestions-${acc.name}`}>
                      {knownAccountSuggestions.map((s) => (
                        <option key={s.pubkey} value={s.pubkey}>
                          {s.label}
                        </option>
                      ))}
                    </datalist>
                  </div>
                ))}
              </>
            )}
          </>
        )}

        {mode === 'raw' && (
          <>
            <label>Instruction data (hex)</label>
            <input
              value={dataHex}
              onChange={(e) => setDataHex(e.target.value)}
              placeholder="68656c6c6f"
              className="mono"
            />
            <label>Accounts</label>
            {accounts.map((a, i) => (
              <div className="row" key={i} style={{ marginTop: 6 }}>
                <input
                  value={a.pubkey}
                  onChange={(e) => updateAccount(i, { pubkey: e.target.value })}
                  placeholder="base58 pubkey"
                  className="mono"
                  list={`raw-acc-${i}`}
                  style={{ flex: '1 1 240px' }}
                />
                <button
                  title="Derive ATA or PDA"
                  onClick={() =>
                    setDeriveOpen({
                      onPick: (addr) => updateAccount(i, { pubkey: addr }),
                    })
                  }
                >
                  ⛬
                </button>
                <datalist id={`raw-acc-${i}`}>
                  {knownAccountSuggestions.map((s) => (
                    <option key={s.pubkey} value={s.pubkey}>
                      {s.label}
                    </option>
                  ))}
                </datalist>
                <label
                  style={{
                    margin: 0,
                    textTransform: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={a.isSigner}
                    onChange={(e) => updateAccount(i, { isSigner: e.target.checked })}
                  />
                  signer
                </label>
                <label
                  style={{
                    margin: 0,
                    textTransform: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={a.isWritable}
                    onChange={(e) => updateAccount(i, { isWritable: e.target.checked })}
                  />
                  writable
                </label>
                <button className="danger" onClick={() => removeAccount(i)}>
                  ×
                </button>
              </div>
            ))}
            <div style={{ marginTop: 8 }}>
              <button onClick={addAccount}>+ Add account</button>
            </div>
          </>
        )}

        <div className="panel-section">
          <div className="panel-section-title">Signing &amp; budget</div>
          <label>Sign with</label>
          <select
            value={payerId}
            onChange={(e) => setPayerId(e.target.value)}
            disabled={keypairs.length === 0}
          >
            <option value="">— ephemeral (auto-generate + airdrop) —</option>
            {keypairs.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label} · {k.pubkey.slice(0, 8)}…
              </option>
            ))}
          </select>
          <div style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 4 }}>
            Sandbox-only signing. Ephemeral payer recommended unless ix requires a specific signer.
          </div>

          <div className="row" style={{ marginTop: 10, gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px' }}>
              <label>Compute unit limit (optional)</label>
              <input
                value={cuLimit}
                onChange={(e) => setCuLimit(e.target.value)}
                placeholder="200000"
              />
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <label>Payer airdrop (lamports)</label>
              <input
                value={airdrop}
                onChange={(e) => setAirdrop(e.target.value)}
                className="mono"
              />
            </div>
          </div>
        </div>

        <div
          className="actions"
          style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}
        >
          <div style={{ display: 'flex', gap: 6 }}>
            {editingDraftId !== null ? (
              <>
                <button
                  className="primary"
                  disabled={!programId || (mode === 'instruction' && !selectedIx)}
                  onClick={() => void addToTx('replace')}
                  title="Save edits back into the draft at its current position"
                >
                  💾 Save edit
                </button>
                <button onClick={cancelEdit} title="Discard edits, leave draft as-is">
                  ✕ Cancel edit
                </button>
              </>
            ) : (
              <>
                <button
                  disabled={!programId || (mode === 'instruction' && !selectedIx)}
                  onClick={() => void addToTx('prepend')}
                  title="Add as first instruction in the transaction"
                >
                  ↥ Prepend to tx
                </button>
                <button
                  disabled={!programId || (mode === 'instruction' && !selectedIx)}
                  onClick={() => void addToTx('append')}
                  title="Add as last instruction in the transaction"
                >
                  ↧ Append to tx
                </button>
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              disabled={busy || (drafts.length === 0 && !programId)}
              onClick={simulate}
              title="Run all stacked instructions in LiteSVM read-only"
            >
              {busy ? 'Running…' : `Simulate (${drafts.length + (programId ? 1 : 0)} ix)`}
            </button>
            <button
              className="primary"
              disabled={busy || (drafts.length === 0 && !programId)}
              onClick={submit}
              title="Execute all stacked instructions and persist state + tx history"
            >
              {busy ? 'Submitting…' : `Submit (${drafts.length + (programId ? 1 : 0)} ix)`}
            </button>
          </div>
        </div>
      </div>

      {result && <TxResultView result={result} />}

      {deriveOpen && (
        <Modal onClose={() => setDeriveOpen(null)}>
          <DeriveAddressForm
            onPick={(addr) => {
              deriveOpen.onPick(addr);
              toast.success(`address picked: ${addr.slice(0, 6)}…${addr.slice(-4)}`);
            }}
            onClose={() => setDeriveOpen(null)}
            suggestions={deriveSuggestions}
          />
        </Modal>
      )}
    </>
  );
}
