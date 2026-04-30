'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastKind = 'success' | 'error' | 'info';
export interface ToastAction {
  label: string;
  run: () => void | Promise<void>;
}
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  action?: ToastAction;
}

interface ToastCtx {
  push: (kind: ToastKind, message: string, action?: ToastAction) => void;
}

const Ctx = createContext<ToastCtx>({ push: () => {} });

export const useToast = () => useContext(Ctx);

let nextId = 1;

/** Top-right floating toast stack. Wrap the app once. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((kind: ToastKind, message: string, action?: ToastAction) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, kind, message, action }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), action ? 6000 : 4000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] space-y-2 pointer-events-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setVisible(true); }, []);

  const tone =
    toast.kind === 'success'
      ? { Icon: CheckCircle2, classes: 'bg-success/10 border-success/30 text-success' }
      : toast.kind === 'error'
        ? { Icon: AlertCircle, classes: 'bg-danger/10 border-danger/30 text-danger' }
        : { Icon: Info, classes: 'bg-info/10 border-info/30 text-info' };
  const { Icon, classes } = tone;

  return (
    <div
      className={`pointer-events-auto flex items-start gap-2 px-3 py-2 border rounded-md backdrop-blur-md min-w-[260px] max-w-sm transition-all duration-200 ${classes} ${
        visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'
      }`}
    >
      <Icon size={14} className="mt-0.5 flex-shrink-0" />
      <span className="text-xs flex-1">{toast.message}</span>
      {toast.action && (
        <button
          onClick={() => { void toast.action!.run(); onDismiss(); }}
          className="text-xs font-semibold underline underline-offset-2 hover:no-underline whitespace-nowrap"
        >
          {toast.action.label}
        </button>
      )}
      <button onClick={onDismiss} className="text-tertiary hover:text-secondary p-0.5 -mt-0.5 -mr-0.5">
        <X size={12} />
      </button>
    </div>
  );
}
