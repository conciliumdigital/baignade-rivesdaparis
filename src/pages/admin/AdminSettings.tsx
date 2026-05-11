import { useState } from 'react';
import toast from 'react-hot-toast';
import { Save } from 'lucide-react';

export function AdminSettings() {
  const [siteOpen, setSiteOpen] = useState(true);
  const [seasonStart, setSeasonStart] = useState('2026-07-01');
  const [seasonEnd, setSeasonEnd] = useState('2026-08-31');
  const [cancelDeadline, setCancelDeadline] = useState(24);
  const [contactEmail, setContactEmail] = useState('baignade@neuillysurmarne.fr');

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    toast.success('Paramètres enregistrés.');
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-display font-bold">Paramètres</h1>
        <p className="text-sm text-slate-600">Configuration globale du service.</p>
      </header>

      <form onSubmit={handleSave} className="space-y-4 max-w-2xl">
        <section className="card p-6 space-y-4">
          <h2 className="font-semibold">Saison</h2>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={siteOpen} onChange={e => setSiteOpen(e.target.checked)} />
            Site ouvert (réservations actives)
          </label>
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className="label">Début de saison</label><input type="date" className="input" value={seasonStart} onChange={e => setSeasonStart(e.target.value)} /></div>
            <div><label className="label">Fin de saison</label><input type="date" className="input" value={seasonEnd} onChange={e => setSeasonEnd(e.target.value)} /></div>
          </div>
        </section>

        <section className="card p-6 space-y-4">
          <h2 className="font-semibold">Annulation</h2>
          <div>
            <label className="label">Délai d'annulation gratuite (heures avant le créneau)</label>
            <input type="number" min={0} className="input" value={cancelDeadline} onChange={e => setCancelDeadline(Number(e.target.value))} />
          </div>
        </section>

        <section className="card p-6 space-y-4">
          <h2 className="font-semibold">Contact</h2>
          <div>
            <label className="label">Email de contact</label>
            <input type="email" className="input" value={contactEmail} onChange={e => setContactEmail(e.target.value)} />
          </div>
        </section>

        <div className="flex justify-end">
          <button type="submit" className="btn-primary"><Save className="w-4 h-4" /> Enregistrer</button>
        </div>
      </form>
    </div>
  );
}
