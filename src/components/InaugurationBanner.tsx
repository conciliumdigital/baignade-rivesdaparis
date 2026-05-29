import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

// Cérémonie d'inauguration : 4 juillet 2026, 14 h à 16 h (heure de Paris),
// puis baignade gratuite de 16 h à 20 h (créneaux de 16 h et 18 h offerts).
// La bannière s'affiche jusqu'à 16 h ce jour-là (fin de la cérémonie),
// puis disparaît automatiquement.
//
// Heure d'été Paris (CEST = UTC+2) → 16:00 Paris = 14:00 UTC.
const INAUGURATION_END_UTC = new Date('2026-07-04T14:00:00Z');

export function InaugurationBanner() {
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    // Rafraîchit à chaque minute pour faire disparaître la bannière
    // pile à 16 h sans rechargement requis.
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (now >= INAUGURATION_END_UTC) return null;

  return (
    <div
      role="region"
      aria-label="Information : cérémonie d'inauguration"
      className="bg-gradient-to-r from-brand-700 to-brand-900 text-white"
    >
      <div className="container-app py-2.5 flex items-center gap-3 text-sm">
        <Sparkles className="w-4 h-4 shrink-0" style={{ color: '#F5C111' }} aria-hidden="true" />
        <p>
          <strong>Inauguration le 4 juillet de 14 h à 16 h.</strong>{' '}
          <span className="opacity-90">La baignade ouvre ensuite <strong>gratuitement de 16 h à 20 h</strong> : créneaux de 16 h et 18 h offerts.</span>
        </p>
      </div>
    </div>
  );
}
