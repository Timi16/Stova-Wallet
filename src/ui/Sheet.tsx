import { useEffect, useId, type ReactNode } from 'react';

/** Bottom sheet, as drawn: dim scrim, 24 px top radius, grab handle, rises in. */
export function Sheet({ open, onClose, title, children, danger = false }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; danger?: boolean }) {
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="scrim-in absolute inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-[2px]">
      <button type="button" aria-label="Close" onClick={onClose} className="flex-1 cursor-default bg-transparent" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? id : undefined}
        className="flex max-h-[92%] flex-col gap-3.5 overflow-y-auto rounded-t-[24px] bg-surface px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 animate-rise"
      >
        <span className="h-1 w-10 self-center rounded-full bg-surface-3" />
        {title && (
          <h2 id={id} className={`m-0 text-lg font-semibold ${danger ? 'text-bad' : ''}`}>
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>
  );
}
