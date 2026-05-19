import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Lock, Unlock, Loader2, Copy, CalendarDays } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { formatDate, formatPrice, formatTimeRange } from '../../lib/format';
import { addDays, format } from 'date-fns';
import type { Slot } from '../../types/database';

export function AdminSlots() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showBulk, setShowBulk] = useState(false);

  async function loadSlots() {
    setLoading(true);
    if (!isSupabaseConfigured) {
      setSlots([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('slots')
      .select('*')
      .gte('date', new Date().toISOString().slice(0, 10))
      .order('date')
      .order('start_time');
    setSlots((data ?? []) as Slot[]);
    setLoading(false);
  }

  useEffect(() => { loadSlots(); }, []);

  async function toggleSlot(slot: Slot) {
    if (!isSupabaseConfigured) return;
    const newStatus = slot.status === 'open' ? 'closed' : 'open';
    const reason = newStatus === 'closed' ? prompt('Motif de fermeture ?') ?? '' : null;
    const { error } = await supabase.from('slots').update({ status: newStatus, closure_reason: reason }).eq('id', slot.id);
    if (error) toast.error(error.message);
    else { toast.success(newStatus === 'closed' ? 'Créneau fermé' : 'Créneau rouvert'); loadSlots(); }
  }

  return (
    <div>
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold">Gestion des créneaux</h1>
          <p className="text-sm text-slate-600">Planning saisonnier de la zone de baignade.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowBulk(true)} className="btn-secondary text-sm"><CalendarDays className="w-4 h-4" /> Génération en masse</button>
          <button onClick={() => setShowCreate(true)} className="btn-primary text-sm"><Plus className="w-4 h-4" /> Nouveau créneau</button>
        </div>
      </header>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="card p-4 h-16 shimmer" />)}</div>
      ) : slots.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-slate-500 text-sm mb-4">Aucun créneau publié pour le moment.</p>
          <button onClick={() => setShowBulk(true)} className="btn-primary">Générer le planning saisonnier</button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Horaire</th>
                <th className="px-4 py-3 text-left">Capacité</th>
                <th className="px-4 py-3 text-left">Tarif</th>
                <th className="px-4 py-3 text-left">Statut</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {slots.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 capitalize">{formatDate(s.date, 'EEE d MMM')}</td>
                  <td className="px-4 py-3 font-medium">{formatTimeRange(s.start_time, s.end_time)}</td>
                  <td className="px-4 py-3">{s.capacity}</td>
                  <td className="px-4 py-3">
                    {formatPrice(s.price_cents)}
                    {s.price_resident_cents != null && s.price_resident_cents > 0 && (
                      <span className="text-xs text-slate-500"> · hab. {formatPrice(s.price_resident_cents)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {s.status === 'open' ? <span className="badge-success">Ouvert</span>
                      : s.status === 'closed' ? <span className="badge-danger">Fermé{s.closure_reason && ` · ${s.closure_reason}`}</span>
                      : s.status === 'private' ? <span className="badge-info">Privé (cours / loisirs)</span>
                      : s.status === 'archived' ? <span className="badge-muted">Archivé</span>
                      : <span className="badge-muted">{s.status}</span>}
                  </td>
                  <td className="px-4 py-3 text-right space-x-1">
                    {(s.status === 'open' || s.status === 'closed') && (
                      <button onClick={() => toggleSlot(s)} className="btn-ghost text-xs" title={s.status === 'open' ? 'Fermer' : 'Ouvrir'}>
                        {s.status === 'open' ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                      </button>
                    )}
                    <button className="btn-ghost text-xs" title="Modifier"><Pencil className="w-4 h-4" /></button>
                    <button className="btn-ghost text-xs" title="Dupliquer"><Copy className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <CreateSlotModal onClose={() => setShowCreate(false)} onSaved={loadSlots} />}
      {showBulk && <BulkGenerateModal onClose={() => setShowBulk(false)} onSaved={loadSlots} />}
    </div>
  );
}

function CreateSlotModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [start, setStart] = useState('10:00');
  const [end, setEnd] = useState('12:00');
  const [capacity, setCapacity] = useState(50);
  // Tarifs saisis en EUROS (convertis en centimes à l'enregistrement).
  const [price, setPrice] = useState(5);
  const [priceResident, setPriceResident] = useState(3);
  const [priceChild, setPriceChild] = useState(2.5);
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      toast.success('Mode démo : créneau virtuel créé');
      onClose();
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('slots').insert({
      date, start_time: start, end_time: end, capacity,
      price_cents: Math.round(price * 100),
      price_resident_cents: Math.round(priceResident * 100),
      price_child_cents: Math.round(priceChild * 100),
      status: 'open',
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success('Créneau créé'); onSaved(); onClose(); }
  }

  return (
    <Modal title="Nouveau créneau" onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-3">
        <div><label className="label">Date</label><input type="date" required className="input" value={date} onChange={e => setDate(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Début</label><input type="time" required className="input" value={start} onChange={e => setStart(e.target.value)} /></div>
          <div><label className="label">Fin</label><input type="time" required className="input" value={end} onChange={e => setEnd(e.target.value)} /></div>
        </div>
        <div><label className="label">Capacité</label><input type="number" min={1} className="input" value={capacity} onChange={e => setCapacity(Number(e.target.value))} /></div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="label">Tarif extérieur (€)</label><input type="number" min={0} step={0.5} className="input" value={price} onChange={e => setPrice(Number(e.target.value))} /></div>
          <div><label className="label">Tarif habitant (€)</label><input type="number" min={0} step={0.5} className="input" value={priceResident} onChange={e => setPriceResident(Number(e.target.value))} /></div>
          <div><label className="label">Tarif enfant (€)</label><input type="number" min={0} step={0.5} className="input" value={priceChild} onChange={e => setPriceChild(Number(e.target.value))} /></div>
        </div>
        <p className="text-xs text-slate-500">Tarif habitant ≥ tarif extérieur → l'option « habitant » est masquée côté usager (pas de réduction).</p>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost">Annuler</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Créer'}</button>
        </div>
      </form>
    </Modal>
  );
}

function BulkGenerateModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [from, setFrom] = useState('2026-07-01');
  const [to, setTo] = useState('2026-08-31');
  const [capacity, setCapacity] = useState(50);
  // Tarifs saisis en EUROS (convertis en centimes à l'enregistrement).
  const [price, setPrice] = useState(5);
  const [priceResident, setPriceResident] = useState(3);
  const [priceChild, setPriceChild] = useState(2.5);
  const [saving, setSaving] = useState(false);

  const slotTimes = [
    { start: '10:00', end: '12:00' }, { start: '12:00', end: '14:00' },
    { start: '14:00', end: '16:00' }, { start: '16:00', end: '18:00' },
    { start: '18:00', end: '20:00' },
  ];

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!isSupabaseConfigured) { toast.success('Mode démo'); onClose(); return; }
    setSaving(true);
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const rows: any[] = [];
    for (let d = fromDate; d <= toDate; d = addDays(d, 1)) {
      const dateStr = format(d, 'yyyy-MM-dd');
      slotTimes.forEach((t) => rows.push({
        date: dateStr, start_time: t.start, end_time: t.end, capacity,
        price_cents: Math.round(price * 100),
        price_resident_cents: Math.round(priceResident * 100),
        price_child_cents: Math.round(priceChild * 100),
        status: 'open',
      }));
    }
    const { error } = await supabase.from('slots').upsert(rows, { onConflict: 'date,start_time' });
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success(`${rows.length} créneaux générés`); onSaved(); onClose(); }
  }

  return (
    <Modal title="Génération en masse" onClose={onClose}>
      <form onSubmit={handleGenerate} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Du</label><input type="date" required className="input" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><label className="label">Au</label><input type="date" required className="input" value={to} onChange={e => setTo(e.target.value)} /></div>
        </div>
        <div><label className="label">Capacité par créneau</label><input type="number" min={1} className="input" value={capacity} onChange={e => setCapacity(Number(e.target.value))} /></div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="label">Tarif extérieur (€)</label><input type="number" min={0} step={0.5} className="input" value={price} onChange={e => setPrice(Number(e.target.value))} /></div>
          <div><label className="label">Tarif habitant (€)</label><input type="number" min={0} step={0.5} className="input" value={priceResident} onChange={e => setPriceResident(Number(e.target.value))} /></div>
          <div><label className="label">Tarif enfant (€)</label><input type="number" min={0} step={0.5} className="input" value={priceChild} onChange={e => setPriceChild(Number(e.target.value))} /></div>
        </div>
        <p className="text-xs text-slate-500">5 créneaux/jour seront créés (10h, 12h, 14h, 16h, 18h). Tarif habitant ≥ extérieur → option « habitant » masquée côté usager.</p>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost">Annuler</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Générer'}</button>
        </div>
      </form>
    </Modal>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
        <h2 className="font-display font-bold text-lg mb-4">{title}</h2>
        {children}
      </div>
    </div>
  );
}
