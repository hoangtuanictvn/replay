import { useEffect, useMemo, useRef, useState } from 'react';

export interface PaletteItem {
  id: string;
  label: string;
  hint?: string;
  group?: string;
  shortcut?: string;
  onSelect: () => void;
}

export function CommandPalette({
  items,
  open,
  onClose,
}: {
  items: PaletteItem[];
  open: boolean;
  onClose: () => void;
}): JSX.Element | null {
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.label.toLowerCase().includes(q) ||
        (it.hint ?? '').toLowerCase().includes(q) ||
        (it.group ?? '').toLowerCase().includes(q),
    );
  }, [items, query]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  if (!open) return null;

  const select = (idx: number): void => {
    const it = filtered[idx];
    if (!it) return;
    it.onSelect();
    onClose();
  };

  return (
    <div
      className="palette-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="palette-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a command, project, program, or session…"
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
            else if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActiveIdx((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              select(activeIdx);
            }
          }}
        />
        <div className="palette-list">
          {filtered.length === 0 ? (
            <div style={{ padding: 14, color: 'var(--text-dim)', fontSize: 12 }}>no matches</div>
          ) : (
            filtered.map((it, idx) => (
              <div
                key={it.id}
                className={`palette-item${idx === activeIdx ? ' active' : ''}`}
                onMouseEnter={() => setActiveIdx(idx)}
                onClick={() => select(idx)}
              >
                {it.group && <span className="palette-group">{it.group}</span>}
                <span className="palette-label">{it.label}</span>
                {it.hint && <span className="palette-hint">{it.hint}</span>}
                {it.shortcut && <span className="kbd palette-shortcut">{it.shortcut}</span>}
              </div>
            ))
          )}
        </div>
        <div className="palette-footer">
          <span>
            <span className="kbd">↑↓</span> navigate · <span className="kbd">Enter</span> open ·{' '}
            <span className="kbd">Esc</span> close
          </span>
        </div>
      </div>
    </div>
  );
}
