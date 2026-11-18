import React, { useEffect, useRef } from 'react';

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  action: () => void;
  disabled?: boolean;
  danger?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Adjust position so it doesn't overflow screen boundaries
  const adjustedX = Math.min(x, window.innerWidth - 180);
  const adjustedY = Math.min(y, window.innerHeight - 200);

  return (
    <div
      ref={menuRef}
      style={{ top: `${adjustedY}px`, left: `${adjustedX}px` }}
      className="fixed z-50 min-w-[160px] bg-[#252526] border border-[#454545] rounded-md shadow-2xl py-1 text-xs text-gray-200 select-none"
    >
      {items.map((item, idx) => (
        <button
          key={idx}
          disabled={item.disabled}
          onClick={() => {
            if (!item.disabled) {
              item.action();
              onClose();
            }
          }}
          className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors ${
            item.disabled
              ? 'opacity-40 cursor-not-allowed'
              : item.danger
              ? 'hover:bg-red-600/80 text-red-300 hover:text-white'
              : 'hover:bg-[#04395e] hover:text-white'
          }`}
        >
          {item.icon && <span className="w-3.5 h-3.5 shrink-0">{item.icon}</span>}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
};
