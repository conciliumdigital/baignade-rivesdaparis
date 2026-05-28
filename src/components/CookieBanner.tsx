import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';

const STORAGE_KEY = 'baignade_cookie_consent_v1';
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) setVisible(true);
  }, []);

  // Piège de focus + Escape + restitution focus (RGAA 7.1 / WCAG 2.1.2)
  useEffect(() => {
    if (!visible) return;
    previouslyFocused.current = (document.activeElement as HTMLElement) ?? null;
    requestAnimationFrame(() => {
      const node = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      node?.focus();
    });
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setConsent('essential');
        return;
      }
      if (e.key === 'Tab') {
        const root = dialogRef.current;
        if (!root) return;
        const nodes = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
          (n) => !n.hasAttribute('disabled') && n.offsetParent !== null,
        );
        if (nodes.length === 0) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      previouslyFocused.current?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function setConsent(value: 'accepted' | 'essential') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ value, at: new Date().toISOString() }));
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      ref={dialogRef}
      className="fixed bottom-3 left-3 right-3 md:left-auto md:right-6 md:bottom-6 md:max-w-md z-50 card p-5 shadow-elevated"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-title"
      aria-describedby="cookie-desc"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h2 id="cookie-title" className="font-display font-bold text-base">Cookies et confidentialité</h2>
        <button
          type="button"
          onClick={() => setConsent('essential')}
          aria-label="Fermer (cookies essentiels uniquement)"
          className="-mr-2 -mt-1 inline-flex items-center justify-center w-9 h-9 rounded-lg text-slate-500 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
      <p id="cookie-desc" className="text-sm text-slate-600 leading-relaxed mb-4">
        Ce site utilise uniquement les cookies strictement nécessaires au bon fonctionnement de la réservation et du paiement.
        Aucune publicité, aucun traçage tiers. Données hébergées en Union européenne (RGPD).
      </p>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setConsent('accepted')} className="btn-primary text-xs min-h-[36px]">J&apos;accepte</button>
        <button onClick={() => setConsent('essential')} className="btn-secondary text-xs min-h-[36px]">Cookies essentiels uniquement</button>
        <Link to="/confidentialite" className="text-xs text-brand-700 hover:underline self-center ml-1">En savoir plus</Link>
      </div>
    </div>
  );
}
