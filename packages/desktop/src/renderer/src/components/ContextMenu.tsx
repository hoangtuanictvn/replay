import { useCallback, useEffect, useState } from 'react';

export interface MenuItem {
  label: string;
  onSelect: () => void | Promise<void>;
  danger?: boolean;
  disabled?: boolean;
}

export interface MenuState {
  x: number;
  y: number;
  items: MenuItem[];
}

export function useContextMenu(): {
  menu: MenuState | null;
  open: (e: React.MouseEvent, items: MenuItem[]) => void;
  close: () => void;
} {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const open = useCallback((e: React.MouseEvent, items: MenuItem[]) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, items });
  }, []);
  const close = useCallback(() => setMenu(null), []);
  return { menu, open, close };
}

export function ContextMenu({ menu, onClose }: { menu: MenuState; onClose: () => void }): JSX.Element {
  useEffect(() => {
    const handle = () => onClose();
    window.addEventListener('click', handle);
    window.addEventListener('contextmenu', handle);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') onClose();
    });
    return () => {
      window.removeEventListener('click', handle);
      window.removeEventListener('contextmenu', handle);
    };
  }, [onClose]);

  return (
    <div
      className="context-menu"
      style={{ left: menu.x, top: menu.y }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {menu.items.map((item) => (
        <div
          key={item.label}
          className={`context-menu-item${item.disabled ? ' disabled' : ''}${item.danger ? ' danger' : ''}`}
          onClick={async () => {
            if (item.disabled) return;
            onClose();
            await item.onSelect();
          }}
        >
          {item.label}
        </div>
      ))}
    </div>
  );
}
