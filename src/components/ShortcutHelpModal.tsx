'use client';

import { useEffect } from 'react';
import { Keyboard, X } from 'lucide-react';

interface ShortcutHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Shortcut {
  keys: string[];
  description: string;
  group: 'Navigation' | 'Actions' | 'Help';
}

const SHORTCUTS: Shortcut[] = [
  { keys: ['Cmd/Ctrl', 'K'],   description: 'Open command palette',           group: 'Navigation' },
  { keys: ['g', 'n'],          description: 'Go to Now',                      group: 'Navigation' },
  { keys: ['g', 'p'],          description: 'Go to Pipeline',                 group: 'Navigation' },
  { keys: ['g', 'i'],          description: 'Go to Intake',                   group: 'Navigation' },
  { keys: ['g', 'h'],          description: 'Go to Health',                   group: 'Navigation' },
  { keys: ['Esc'],             description: 'Close palette / modal',          group: 'Actions' },
  { keys: ['↑', '↓'],          description: 'Navigate palette items',         group: 'Actions' },
  { keys: ['↵'],               description: 'Run highlighted command',        group: 'Actions' },
  { keys: ['?'],               description: 'Show this help',                 group: 'Help' },
];

/** Keyboard shortcut help — opened by pressing ? */
export default function ShortcutHelpModal({ isOpen, onClose }: ShortcutHelpModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const grouped: Record<string, Shortcut[]> = {};
  for (const s of SHORTCUTS) {
    grouped[s.group] = grouped[s.group] || [];
    grouped[s.group].push(s);
  }

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-surface border border-border-strong rounded-lg shadow-2xl overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Keyboard size={14} className="text-accent" />
            <h2 className="text-sm font-semibold text-primary">Keyboard shortcuts</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-tertiary hover:text-secondary"
          >
            <X size={14} />
          </button>
        </div>

        <div className="px-4 py-3 space-y-4 max-h-[60vh] overflow-y-auto">
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group}>
              <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-tertiary mb-1.5">
                {group}
              </div>
              <ul className="space-y-1">
                {items.map((s, i) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <span className="text-secondary">{s.description}</span>
                    <span className="flex items-center gap-1">
                      {s.keys.map((k, j) => (
                        <kbd
                          key={j}
                          className="text-[10px] font-mono text-secondary px-1.5 py-0.5 bg-elevated border border-border rounded"
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="px-4 py-2 border-t border-border bg-elevated/30 text-[10px] font-mono text-tertiary text-center">
          Press ESC to close
        </div>
      </div>
    </div>
  );
}
