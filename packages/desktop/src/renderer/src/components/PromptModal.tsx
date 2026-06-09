import { useState } from 'react';
import { Modal } from './Modal';

export interface PromptOptions {
  title: string;
  label: string;
  initial?: string;
  placeholder?: string;
  confirmText?: string;
  danger?: boolean;
}

export function PromptModal({
  options,
  onConfirm,
  onCancel,
}: {
  options: PromptOptions;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}): JSX.Element {
  const [value, setValue] = useState(options.initial ?? '');
  return (
    <Modal onClose={onCancel}>
      <h3>{options.title}</h3>
      <label>{options.label}</label>
      <input
        autoFocus
        value={value}
        placeholder={options.placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && value.trim()) onConfirm(value.trim());
          if (e.key === 'Escape') onCancel();
        }}
      />
      <div className="actions">
        <button onClick={onCancel}>Cancel</button>
        <button
          className={options.danger ? 'danger' : 'primary'}
          disabled={!value.trim()}
          onClick={() => onConfirm(value.trim())}
        >
          {options.confirmText ?? 'OK'}
        </button>
      </div>
    </Modal>
  );
}

export function ConfirmModal({
  title,
  message,
  confirmText,
  danger,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}): JSX.Element {
  return (
    <Modal onClose={onCancel}>
      <h3>{title}</h3>
      <div style={{ margin: '8px 0 16px', color: 'var(--text-dim)' }}>{message}</div>
      <div className="actions">
        <button onClick={onCancel}>Cancel</button>
        <button className={danger ? 'danger' : 'primary'} onClick={onConfirm}>
          {confirmText ?? 'Confirm'}
        </button>
      </div>
    </Modal>
  );
}
