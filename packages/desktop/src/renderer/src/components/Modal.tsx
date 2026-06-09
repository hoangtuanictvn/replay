import type { ReactNode } from 'react';

export function Modal({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}): JSX.Element {
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal">{children}</div>
    </div>
  );
}
