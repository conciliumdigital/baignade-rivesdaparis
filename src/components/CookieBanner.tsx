import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const STORAGE_KEY = 'baignade_cookie_consent_v1';

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) setVisible(true);
  }, []);

  function setConsent(value: 'accepted' | 'essential') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ value, at: new Date().toISOString() }));
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-3 left-3 right-3 md:left-auto md:right-6 md:bottom-6 md:max-w-md z-50 card p-5 shadow-elevated"
      role="dialog"
      aria-labelledby="cookie-title"
    >
      <h2 id="cookie-title" className="font-display font-bold text-base mb-2">Cookies & confidentialité</h2>
      <p className="text-sm text-slate-600 leading-relaxed mb-4">
        Ce site utilise uniquement les cookies strictement nécessaires au bon fonctionnement de la réservation et du paiement.
        Aucune publicité, aucun traçage tiers. Données hébergées en Union européenne (RGPD).
      </p>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setConsent('accepted')} className="btn-primary text-xs">J'accepte</button>
        <button onClick={() => setConsent('essential')} className="btn-secondary text-xs">Cookies essentiels uniquement</button>
        <Link to="/confidentialite" className="text-xs text-brand-700 hover:underline self-center ml-1">En savoir plus</Link>
      </div>
    </div>
  );
}
