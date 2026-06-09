import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Modal } from './Modal';

interface PromptOpts {
  title: string;
  label?: string;
  initial?: string;
  placeholder?: string;
  confirmText?: string;
  danger?: boolean;
}

interface ConfirmOpts {
  title: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
}

interface DialogsApi {
  prompt(opts: PromptOpts): Promise<string | null>;
  confirm(opts: ConfirmOpts): Promise<boolean>;
}

const Ctx = createContext<DialogsApi | null>(null);

export function DialogsProvider({ children }: { children: ReactNode }): JSX.Element {
  const [promptState, setPromptState] = useState<PromptOpts | null>(null);
  const [promptValue, setPromptValue] = useState('');
  const [confirmState, setConfirmState] = useState<ConfirmOpts | null>(null);
  const promptResolve = useRef<((v: string | null) => void) | null>(null);
  const confirmResolve = useRef<((v: boolean) => void) | null>(null);

  const prompt = useCallback((opts: PromptOpts): Promise<string | null> => {
    setPromptValue(opts.initial ?? '');
    setPromptState(opts);
    return new Promise<string | null>((resolve) => {
      promptResolve.current = resolve;
    });
  }, []);

  const confirm = useCallback((opts: ConfirmOpts): Promise<boolean> => {
    setConfirmState(opts);
    return new Promise<boolean>((resolve) => {
      confirmResolve.current = resolve;
    });
  }, []);

  const closePrompt = (value: string | null): void => {
    promptResolve.current?.(value);
    promptResolve.current = null;
    setPromptState(null);
  };

  const closeConfirm = (value: boolean): void => {
    confirmResolve.current?.(value);
    confirmResolve.current = null;
    setConfirmState(null);
  };

  return (
    <Ctx.Provider value={{ prompt, confirm }}>
      {children}

      {promptState && (
        <Modal onClose={() => closePrompt(null)}>
          <h3>{promptState.title}</h3>
          {promptState.label && <label>{promptState.label}</label>}
          <input
            autoFocus
            value={promptValue}
            placeholder={promptState.placeholder}
            onChange={(e) => setPromptValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') closePrompt(promptValue);
              if (e.key === 'Escape') closePrompt(null);
            }}
          />
          <div className="actions">
            <button onClick={() => closePrompt(null)}>Cancel</button>
            <button
              className={promptState.danger ? 'danger' : 'primary'}
              onClick={() => closePrompt(promptValue)}
            >
              {promptState.confirmText ?? 'OK'}
            </button>
          </div>
        </Modal>
      )}

      {confirmState && (
        <Modal onClose={() => closeConfirm(false)}>
          <h3>{confirmState.title}</h3>
          <div style={{ margin: '8px 0 16px', color: 'var(--text-dim)' }}>
            {confirmState.message}
          </div>
          <div className="actions">
            <button onClick={() => closeConfirm(false)}>Cancel</button>
            <button
              className={confirmState.danger ? 'danger' : 'primary'}
              onClick={() => closeConfirm(true)}
            >
              {confirmState.confirmText ?? 'Confirm'}
            </button>
          </div>
        </Modal>
      )}
    </Ctx.Provider>
  );
}

export function useDialogs(): DialogsApi {
  const c = useContext(Ctx);
  if (!c) {
    // Fallback to noop so components don't crash when used outside provider.
    return {
      prompt: async () => null,
      confirm: async () => false,
    };
  }
  return c;
}
