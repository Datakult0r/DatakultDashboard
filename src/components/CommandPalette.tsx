'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { Zap, Target, Inbox, HeartPulse, Send, Plus, Search, ArrowRight } from 'lucide-react';

export interface PaletteCommand {
  id: string;
  label: string;
  hint?: string;
  group: 'Navigate' | 'Action' | 'Recent';
  icon?: React.ReactNode;
  run: () => void | Promise<void>;
}

interface CommandPaletteProps {
  commands: PaletteCommand[];
  /** External ref to control open state from a hotkey handler */
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Cmd+K command palette. Standardized rendering of nav + action commands.
 * Filters by substring, ↑/↓ to move, Enter to execute, Esc to close.
 */
export default function CommandPalette({ commands, isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter((c) =>
      c.label.toLowerCase().includes(q) || (c.hint?.toLowerCase().includes(q) ?? false),
    );
  }, [query, commands]);

  useEffect(() => {
    setCursor(0);
  }, [query, isOpen]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    } else {
      setQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCursor((c) => Math.min(filtered.length - 1, c + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCursor((c) => Math.max(0, c - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const target = filtered[cursor];
        if (target) {
          onClose();
          void target.run();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, filtered, cursor, onClose]);

  if (!isOpen) return null;

  // Group by group label preserving insertion order
  const grouped: Record<string, PaletteCommand[]> = {};
  for (const c of filtered) {
    grouped[c.group] = grouped[c.group] || [];
    grouped[c.group].push(c);
  }

  let runningIdx = 0;

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center pt-[15vh] px-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}>
      <div
        className="w-full max-w-xl bg-surface border border-border-strong rounded-lg shadow-2xl overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
          <Search size={14} className="text-tertiary" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, jump to a tab, or search…"
            className="flex-1 bg-transparent outline-none text-sm text-primary placeholder:text-tertiary"
          />
          <kbd className="text-[10px] font-mono text-tertiary px-1.5 py-0.5 bg-elevated border border-border rounded">ESC</kbd>
        </div>

        <div className="max-h-[50vh] overflow-y-auto py-1">
          {filtered.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-tertiary">No matches.</div>
          )}
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group}>
              <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-[0.2em] font-mono text-tertiary">
                {group}
              </div>
              {items.map((c) => {
                const idx = runningIdx++;
                const active = idx === cursor;
                return (
                  <button
                    key={c.id}
                    onMouseEnter={() => setCursor(idx)}
                    onClick={() => { onClose(); void c.run(); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                      active ? 'bg-accent/10 text-accent' : 'text-primary hover:bg-elevated/50'
                    }`}
                  >
                    {c.icon && <span className={active ? 'text-accent' : 'text-secondary'}>{c.icon}</span>}
                    <span className="flex-1">{c.label}</span>
                    {c.hint && (
                      <span className="text-[10px] font-mono text-tertiary">{c.hint}</span>
                    )}
                    {active && <ArrowRight size={12} className="text-accent" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between px-3 py-1.5 border-t border-border bg-elevated/30 text-[10px] font-mono text-tertiary">
          <span>{filtered.length} commands</span>
          <span>↑↓ navigate · ↵ run · ESC close</span>
        </div>
      </div>
    </div>
  );
}

/** Convenience helpers for icons used by callers. */
export const PaletteIcons = {
  Now: <Zap size={14} />,
  Pipeline: <Target size={14} />,
  Intake: <Inbox size={14} />,
  Health: <HeartPulse size={14} />,
  Outbound: <Send size={14} />,
  Add: <Plus size={14} />,
};
