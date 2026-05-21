import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Lock, Unlock, Loader2, Copy, CalendarDays, CloudRain, BellRing } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { formatDate, formatPrice, formatTimeRange } from '../../lib/format';
import { addDays, format } from 'date-fns';
import type { Slot } from '../../types/database';

export function AdminSlots() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [waitlistCounts, setWaitlistCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [editing, setEditing] = useState<{ slot: Slot; mode: 'edit' | 'duplicate' } | null>(null);
  const [closing, setClosing] = useState<Slot | null>(null);

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
    const list = (data ?? []) as Slot[];
    setSlots(list);

    // Compteurs liste d'attente par créneau
    if (list.length > 0) {
      const ids = list.map((s) => s.id);
      const { data: wl } = await supabase
        .from('waitlist')
        .select('slot_id')
        .in('slot_id', ids)
        .eq('status', 'waiting');
      const counts: Record<string, number> = {};
      (wl ?? []).forEach((row: any) => {
        counts[row.slot_id] = (counts[row.slot_id] ?? 0) + 1;
      });
      setWaitlistCounts(counts);
    }
    setLoading(false);
  }

  useEffect(() => { loadSlots(); }, []);

  async function reopenSlot(slot: Slot) {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.from('slots')
      .update({ status: 'open', closure_reason: null })
      .eq('id', slot.id);
    if (error) toast.error(error.message);
    else { toast.success('Créneau rouvert'); loadSlots(); }
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
                    {waitlistCounts[s.id] > 0 && (
                      <span
                        className="inline-flex items-center gap-1 text-xs text-amber-700 mr-2"
                        title="Personnes en liste d'attente"
                      >
                        <BellRing className="w-3.5 h-3.5" /> {waitlistCounts[s.id]}
                      </span>
                    )}
                    {s.status === 'open' && (
                      <button onClick={() => setClosing(s)} className="btn-ghost text-xs" title="Fermer (météo)">
                        <Lock className="w-4 h-4" />
                      </button>
                    )}
                    {s.status === 'closed' && (
                      <button onClick={() => reopenSlot(s)} className="btn-ghost text-xs" title="Rouvrir">
                        <Unlock className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => setEditing({ slot: s, mode: 'edit' })} className="btn-ghost text-xs" title="Modifier"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => setEditing({ slot: s, mode: 'duplicate' })} className="btn-ghost text-xs" title="Dupliquer"><Copy className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <CreateSlotModal onClose={() => setShowCreate(false)} onSaved={loadSlots} />}
      {editing && (
        <CreateSlotModal
          slot={editing.slot}
          mode={editing.mode}
          onClose={() => setEditing(null)}
          onSaved={loadSlots}
        />
      )}
      {showBulk && <BulkGenerateModal onClose={() => setShowBulk(false)} onSaved={loadSlots} />}
      {closing && (
        <CloseSlotModal
          slot={closing}
          onClose={() => setClosing(null)}
          onSaved={() => { setClosing(null); loadSlots(); }}
        />
      )}
    </div>
  );
}

// Fermeture météo : motif libre + confirmation.
// Le trigger SQL `notify_on_slot_closed` enfile automatiquement un
// e-mail `closure` pour chaque réservation confirmée/pending/used.
function CloseSlotModal({
  slot, onClose, onSaved,
}: { slot: Slot; onClose: () => void; onSaved: () => void }) {
  const [reason, setReason] = useState('Fermeture météo');
  const [saving, setSaving] = useState(false);

  async function handleClose(e: React.FormEvent) {
    e.preventDefault();
    if (!isSupabaseConfigured) { toast.success('Mode démo'); onSaved(); return; }
    setSaving(true);
    const { error } = await supabase.from('slots')
      .update({ status: 'closed', closure_reason: reason.trim() || 'Fermeture météo' })
      .eq('id', slot.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success('Créneau fermé. Les clients concernés vont être notifiés.'); onSaved(); }
  }

  return (
    <Modal title="Fermer le créneau" onClose={onClose}>
      <form onSubmit={handleClose} className="space-y-4">
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm flex items-start gap-2">
          <CloudRain className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-amber-900">{formatDate(slot.date)} · {formatTimeRange(slot.start_time, slot.end_time)}</div>
            <div className="text-amber-800 mt-1">
              Les personnes ayant déjà réservé recevront automatiquement un e-mail
              d'information (modèle « Fermeture météo », éditable dans
              <em> Communication › E-mails auto</em>).
            </div>
          </div>
        </div>
        <div>
          <label className="label">Motif (visible en interne ; les clients reçoivent le modèle d'e-mail standard)</label>
          <input
            className="input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex : orages annoncés, qualité de l'eau, événement…"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost">Annuler</button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Fermer le créneau'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CreateSlotModal({
  onClose, onSaved, slot, mode = 'create',
}: {
  onClose: () => void;
  onSaved: () => void;
  slot?: Slot;
  mode?: 'create' | 'edit' | 'duplicate';
}) {
  const [date, setDate] = useState(slot ? slot.date : format(new Date(), 'yyyy-MM-dd'));
  const [start, setStart] = useState(slot ? slot.start_time.slice(0, 5) : '10:00');
  const [end, setEnd] = useState(slot ? slot.end_time.slice(0, 5) : '12:00');
  const [capacity, setCapacity] = useState(slot ? slot.capacity : 50);
  // Tarifs saisis en EUROS (convertis en centimes à l'enregistrement).
  const [price, setPrice] = useState(slot ? slot.price_cents / 100 : 5);
  const [priceResident, setPriceResident] = useState(slot ? (slot.price_resident_cents ?? 0) / 100 : 3);
  const [priceChild, setPriceChild] = useState(slot ? (slot.price_child_cents ?? 0) / 100 : 2.5);
  const [saving, setSaving] = useState(false);

  const titles = { create: 'Nouveau créneau', edit: 'Modifier le créneau', duplicate: 'Dupliquer le créneau' };

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      toast.success('Mode démo : créneau virtuel enregistré');
      onClose();
      return;
    }
    setSaving(true);
    const payload = {
      date, start_time: start, end_time: end, capacity,
      price_cents: Math.round(price * 100),
      price_resident_cents: Math.round(priceResident * 100),
      price_child_cents: Math.round(priceChild * 100),
    };
    const { error } =
      mode === 'edit' && slot
        ? await supabase.from('slots').update(payload).eq('id', slot.id)
        : await supabase.from('slots').insert({ ...payload, status: 'open' });
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success(mode === 'edit' ? 'Créneau modifié' : 'Créneau créé');
      onSaved();
      onClose();
    }
  }

  return (
    <Modal title={titles[mode]} onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-3">
        <div><label className="label">Date</label><input type="date" required className="input" value={date} onChange={e => setDate(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Début</label><input type="time" required className="input" value={start} onChange={e => setStart(e.target.value)} /></div>
          <div><label className="label">Fin</label><input type="time" required className="input" value={end} onChange={e => setEnd(e.target.value)} /></div>
        </div>
        <div><label className="label">Capacité</label><input type="number" min={1} className="input" value={capacity} onChange={e => setCapacity(Number(e.target.value))} /></div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="label">Tarif extérieur (€)</label><input type="number" min={0} step={0.5} className="input" value={price} onChange={e => setPrice(Number(e.target.value))} /></div>
          <div><label className="label">Tarif Nocéen (€)</label><input type="number" min={0} step={0.5} className="input" value={priceResident} onChange={e => setPriceResident(Number(e.target.value))} /></div>
          <div><label className="label">Tarif enfant (€)</label><input type="number" min={0} step={0.5} className="input" value={priceChild} onChange={e => setPriceChild(Number(e.target.value))} /></div>
        </div>
        <p className="text-xs text-slate-500">Tarif Nocéen ≥ tarif extérieur → l'option « Nocéen » est masquée côté usager (pas de réduction).</p>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost">Annuler</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (mode === 'edit' ? 'Enregistrer' : 'Créer')}</button>
        </div>
      </form>
    </Modal>
  );
}

function BulkGenerateModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [from, setFrom] = useState('2026-07-04');
  const [to, setTo] = useState('2026-08-30');
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
          <div><label className="label">Tarif Nocéen (€)</label><input type="number" min={0} step={0.5} className="input" value={priceResident} onChange={e => setPriceResident(Number(e.target.value))} /></div>
          <div><label className="label">Tarif enfant (€)</label><input type="number" min={0} step={0.5} className="input" value={priceChild} onChange={e => setPriceChild(Number(e.target.value))} /></div>
        </div>
        <p className="text-xs text-slate-500">5 créneaux/jour seront créés (10h, 12h, 14h, 16h, 18h). Tarif Nocéen ≥ extérieur → option « Nocéen » masquée côté usager.</p>
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
