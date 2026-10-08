import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { IconCheck, IconWarn } from '@/ui/Icons';

type ToastKind = 'ok' | 'warn';
interface ToastMsg {
  id: number;
  text: string;
  kind: ToastKind;
}

const Ctx = createContext<(text: string, kind?: ToastKind) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((text: string, kind: ToastKind = 'ok') => {
    setToast({ id: Date.now(), text, kind });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const value = useMemo(() => show, [show]);
  return (
    <Ctx.Provider value={value}>
      {children}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[88px] z-[80] flex justify-center px-4">
          <div
            role="status"
            key={toast.id}
            className="pointer-events-auto flex w-full max-w-[398px] items-center gap-2.5 rounded-[14px] bg-surface-3 px-3.5 py-3 text-sm font-medium text-text shadow-[0_12px_30px_rgba(0,0,0,0.5)] animate-pop"
          >
            {toast.kind === 'ok' ? <IconCheck className="h-4 w-4 shrink-0 text-good" strokeWidth={2.8} /> : <IconWarn className="h-4 w-4 shrink-0 text-warn" />}
            {toast.text}
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}
