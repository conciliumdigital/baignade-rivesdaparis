import { useEffect, useRef, type ReactNode } from 'react';

// =====================================================================
// Modal accessible : focus trap, Escape, aria-modal, restauration focus
// Conforme RGAA 7.1 / WCAG 2.1.2 + 2.4.3.
// =====================================================================

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** Empêche la fermeture par clic backdrop / Esc (ex. sauvegarde en cours). */
  locked?: boolean;
  /** Largeur max (Tailwind), défaut max-w-lg. */
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const SIZE_CLASS: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
};

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ open, onClose, title, description, children, locked = false, size = 'lg' }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Mémorise le focus appelant à l'ouverture, le restitue à la fermeture
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = (document.activeElement as HTMLElement) ?? null;

    // Place le focus initial sur le premier élément focusable
    requestAnimationFrame(() => {
      const node = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      node?.focus();
    });

    // Empêche le scroll de la page derrière
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  // Esc + piège à focus
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !locked) {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === 'Tab') {
        const root = dialogRef.current;
        if (!root) return;
        const nodes = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
          (n) => !n.hasAttribute('disabled') && n.offsetParent !== null,
        );
        if (nodes.length === 0) {
          e.preventDefault();
          return;
        }
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, locked, onClose]);

  if (!open) return null;

  const titleId = 'modal-title-' + Math.random().toString(36).slice(2, 8);
  const descId = description ? 'modal-desc-' + Math.random().toString(36).slice(2, 8) : undefined;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-sm"
      onClick={(e) => {
        // Clic backdrop ferme uniquement si non verrouillé et clic en dehors du panneau
        if (locked) return;
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className={`relative w-full ${SIZE_CLASS[size]} bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto`}
      >
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-start justify-between gap-4 rounded-t-2xl">
          <div className="flex-1 min-w-0">
            <h2 id={titleId} className="text-lg font-semibold text-slate-900">
              {title}
            </h2>
            {description ? (
              <p id={descId} className="text-sm text-slate-600 mt-1">
                {description}
              </p>
            ) : null}
          </div>
          {!locked && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer la fenêtre"
              className="shrink-0 -mr-2 -mt-1 inline-flex items-center justify-center w-10 h-10 rounded-lg text-slate-500 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <span aria-hidden="true" className="text-2xl leading-none">×</span>
            </button>
          )}
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
