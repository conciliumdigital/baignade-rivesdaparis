import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Lock, Unlock, Loader2, Copy, CalendarDays, CloudRain, BellRing, Trash2, AlertTriangle } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { formatDate, formatPrice, formatTimeRange } from '../../lib/format';
import { mapSupabaseError } from '../../lib/errors';
import { Modal } from '../../components/Modal';
import { addDays, format } from 'date-fns';
import type { Slot } from '../../types/database';

// Statuts considérés comme « occupants » (réservent une place réelle)
const OCCUPYING = ['pending_payment', 'confirmed', 'used'];

export function AdminSlots() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [waitlistCounts, setWaitlistCounts] = useState<Record<string, number>>({});
  const [reservedCounts, setReservedCounts] = useState<Record<string, { confirmed: number; persons: number }>>({});
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [editing, setEditing] = useState<{ slot: Slot; mode: 'edit' | 'duplicate' } | null>(null);
  const [closing, setClosing] = useState<Slot | null>(null);
  const [deleting, setDeleting] = useState<Slot | null>(null);

  async function loadSlots() {
    setLoading(true);
    if (!isSupabaseConfigured) {
      setSlots([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('slots')
      .select('*')
      .gte('date', new Date().toISOString().slice(0, 10))
      .order('date')
      .order('start_time');
    if (error) toast.error(mapSupabaseError(error));
    const list = (data ?? []) as Slot[];
    setSlots(list);

    // Compteurs liste d'attente + résas occupantes par créneau
    if (list.length > 0) {
      const ids = list.map((s) => s.id);
      const [{ data: wl }, { data: rs }] = await Promise.all([
        supabase.from('waitlist').select('slot_id').in('slot_id', ids).eq('status', 'waiting'),
        supabase.from('reservations').select('slot_id, status, nb_adults, nb_children').in('slot_id', ids).in('status', OCCUPYING),
      ]);
      const wlCounts: Record<string, number> = {};
      (wl ?? []).forEach((row: any) => { wlCounts[row.slot_id] = (wlCounts[row.slot_id] ?? 0) + 1; });
      setWaitlistCounts(wlCounts);

      const rsCounts: Record<string, { confirmed: number; persons: number }> = {};
      (rs ?? []).forEach((row: any) => {
        const acc = rsCounts[row.slot_id] ?? { confirmed: 0, persons: 0 };
        acc.confirmed += 1;
        acc.persons += (row.nb_adults ?? 0) + (row.nb_children ?? 0);
        rsCounts[row.slot_id] = acc;
      });
      setReservedCounts(rsCounts);
    }
    setLoading(false);
  }

  useEffect(() => { loadSlots(); }, []);

  async function reopenSlot(slot: Slot) {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.from('slots')
      .update({ status: 'open', closure_reason: null })
      .eq('id', slot.id);
    if (error) toast.error(mapSupabaseError(error));
    else { toast.success('Créneau rouvert.'); loadSlots(); }
  }

  return (
    <div>
      <header className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold">Gestion des créneaux</h1>
          <p className="text-sm text-slate-600">Planning saisonnier de la zone de baignade.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowBulk(true)} className="btn-secondary text-sm"><CalendarDays className="w-4 h-4" aria-hidden="true" /> Génération en masse</button>
          <button onClick={() => setShowCreate(true)} className="btn-primary text-sm"><Plus className="w-4 h-4" aria-hidden="true" /> Nouveau créneau</button>
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
        <div className="card overflow-x-auto">
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
              {slots.map((s) => {
                const counts = reservedCounts[s.id] ?? { confirmed: 0, persons: 0 };
                const empty = counts.confirmed === 0;
                return (
                  <tr key={s.id}>
                    <td className="px-4 py-3 capitalize">{formatDate(s.date, 'EEE d MMM')}</td>
                    <td className="px-4 py-3 font-medium">{formatTimeRange(s.start_time, s.end_time)}</td>
                    <td className="px-4 py-3">
                      {s.capacity}
                      {counts.persons > 0 && (
                        <span className="text-xs text-slate-500"> · {counts.persons} réservée{counts.persons > 1 ? 's' : ''}</span>
                      )}
                    </td>
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
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        {waitlistCounts[s.id] > 0 && (
                          <span
                            className="inline-flex items-center gap-1 text-xs text-amber-700 mr-2"
                            title="Personnes en liste d'attente"
                          >
                            <BellRing className="w-3.5 h-3.5" aria-hidden="true" /> {waitlistCounts[s.id]}
                          </span>
                        )}
                        {s.status === 'open' && (
                          <button onClick={() => setClosing(s)} className="btn-ghost text-xs min-h-[36px]" aria-label={`Fermer le créneau du ${s.date} ${s.start_time}`} title="Fermer (météo)">
                            <Lock className="w-4 h-4" aria-hidden="true" />
                          </button>
                        )}
                        {s.status === 'closed' && (
                          <button onClick={() => reopenSlot(s)} className="btn-ghost text-xs min-h-[36px]" aria-label={`Rouvrir le créneau du ${s.date} ${s.start_time}`} title="Rouvrir">
                            <Unlock className="w-4 h-4" aria-hidden="true" />
                          </button>
                        )}
                        <button onClick={() => setEditing({ slot: s, mode: 'edit' })} className="btn-ghost text-xs min-h-[36px]" aria-label="Modifier" title="Modifier"><Pencil className="w-4 h-4" aria-hidden="true" /></button>
                        <button onClick={() => setEditing({ slot: s, mode: 'duplicate' })} className="btn-ghost text-xs min-h-[36px]" aria-label="Dupliquer" title="Dupliquer"><Copy className="w-4 h-4" aria-hidden="true" /></button>
                        <button
                          onClick={() => setDeleting(s)}
                          disabled={!empty}
                          className="btn-ghost text-xs min-h-[36px] text-red-600 disabled:text-slate-300 disabled:cursor-not-allowed"
                          aria-label="Supprimer"
                          title={empty ? 'Supprimer (créneau vide)' : 'Suppression impossible : le créneau a des réservations. Utiliser « Fermer » à la place.'}
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <CreateSlotModal onClose={() => setShowCreate(false)} onSaved={loadSlots} />}
      {editing && (
        <CreateSlotModal
          slot={editing.slot}
          mode={editing.mode}
          confirmedPersons={reservedCounts[editing.slot.id]?.persons ?? 0}
          hasReservations={(reservedCounts[editing.slot.id]?.confirmed ?? 0) > 0}
          onClose={() => setEditing(null)}
          onSaved={loadSlots}
        />
      )}
      {showBulk && <BulkGenerateModal onClose={() => setShowBulk(false)} onSaved={loadSlots} />}
      {closing && (
        <CloseSlotModal
          slot={closing}
          impactedReservations={reservedCounts[closing.id]?.confirmed ?? 0}
          impactedPersons={reservedCounts[closing.id]?.persons ?? 0}
          onClose={() => setClosing(null)}
          onSaved={() => { setClosing(null); loadSlots(); }}
        />
      )}
      {deleting && (
        <DeleteSlotModal
          slot={deleting}
          onClose={() => setDeleting(null)}
          onSaved={() => { setDeleting(null); loadSlots(); }}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// Fermeture météo : avertit du nombre de réservations impactées avant
// validation. Le trigger SQL `notify_on_slot_closed` enfile les e-mails.
// ----------------------------------------------------------------------
function CloseSlotModal({
  slot, onClose, onSaved, impactedReservations, impactedPersons,
}: {
  slot: Slot;
  onClose: () => void;
  onSaved: () => void;
  impactedReservations: number;
  impactedPersons: number;
}) {
  const [reason, setReason] = useState('Fermeture météo');
  const [saving, setSaving] = useState(false);

  async function handleClose(e: React.FormEvent) {
    e.preventDefault();
    if (!isSupabaseConfigured) { toast.success('Mode démonstration.'); onSaved(); return; }
    setSaving(true);
    const { error } = await supabase.from('slots')
      .update({ status: 'closed', closure_reason: reason.trim() || 'Fermeture météo' })
      .eq('id', slot.id);
    setSaving(false);
    if (error) toast.error(mapSupabaseError(error));
    else { toast.success('Créneau fermé. Les usagers concernés vont être notifiés par courriel.'); onSaved(); }
  }

  return (
    <Modal open onClose={onClose} title="Fermer le créneau" locked={saving}>
      <form onSubmit={handleClose} className="space-y-4">
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm flex items-start gap-2">
          <CloudRain className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <div className="font-semibold text-amber-900">{formatDate(slot.date)} · {formatTimeRange(slot.start_time, slot.end_time)}</div>
            <div className="text-amber-800 mt-1">
              {impactedReservations === 0
                ? 'Aucune réservation n\'est encore enregistrée sur ce créneau.'
                : <><strong>{impactedReservations} réservation{impactedReservations > 1 ? 's' : ''}</strong> ({impactedPersons} personne{impactedPersons > 1 ? 's' : ''}) sera notifiée par courriel (modèle « Fermeture météo », éditable dans <em>Communication › Modèles d&apos;e-mails</em>).</>
              }
            </div>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="closure-reason">Motif (visible en interne ; les usagers reçoivent le modèle standard)</label>
          <input
            id="closure-reason"
            className="input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex. orages annoncés, qualité de l'eau, événement…"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost" disabled={saving}>Annuler</button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : 'Fermer le créneau'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// Suppression de créneau (vide uniquement). Garde-fou serveur via RLS
// (admin), mais on confirme côté UI quand même.
// ----------------------------------------------------------------------
function DeleteSlotModal({ slot, onClose, onSaved }: { slot: Slot; onClose: () => void; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  async function doDelete() {
    if (!isSupabaseConfigured) { toast.success('Mode démonstration.'); onSaved(); return; }
    setBusy(true);
    const { error } = await supabase.from('slots').delete().eq('id', slot.id);
    setBusy(false);
    if (error) toast.error(mapSupabaseError(error));
    else { toast.success('Créneau supprimé.'); onSaved(); }
  }
  return (
    <Modal open onClose={onClose} title="Supprimer le créneau" locked={busy} size="md">
      <p className="text-sm mb-4">
        Confirmer la suppression du créneau <strong>{formatDate(slot.date)}</strong> · {formatTimeRange(slot.start_time, slot.end_time)} ? Cette action est irréversible.
      </p>
      <p className="text-xs text-slate-500 mb-4">Le créneau est vide : aucune réservation ne sera affectée.</p>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="btn-ghost" disabled={busy}>Conserver</button>
        <button type="button" onClick={doDelete} disabled={busy} className="btn-primary bg-red-600 hover:bg-red-700">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : 'Supprimer définitivement'}
        </button>
      </div>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// Création / édition / duplication. Garde-fous quand il existe déjà des
// réservations occupantes :
//  - capacité ne peut pas descendre sous le nombre de personnes réservées
//  - changement de prix exige une confirmation explicite (l'historique
//    affiché reste figé sur le total enregistré dans chaque résa)
// ----------------------------------------------------------------------
function CreateSlotModal({
  onClose, onSaved, slot, mode = 'create', confirmedPersons = 0, hasReservations = false,
}: {
  onClose: () => void;
  onSaved: () => void;
  slot?: Slot;
  mode?: 'create' | 'edit' | 'duplicate';
  confirmedPersons?: number;
  hasReservations?: boolean;
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
  const [confirmPriceChange, setConfirmPriceChange] = useState(false);

  const titles = { create: 'Nouveau créneau', edit: 'Modifier le créneau', duplicate: 'Dupliquer le créneau' };

  const isEdit = mode === 'edit' && !!slot;
  const priceChanged = isEdit && (
    Math.round(price * 100) !== slot.price_cents
    || Math.round(priceResident * 100) !== (slot.price_resident_cents ?? 0)
    || Math.round(priceChild * 100) !== (slot.price_child_cents ?? 0)
  );
  const capacityTooLow = isEdit && hasReservations && capacity < confirmedPersons;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (capacityTooLow) {
      toast.error(`La capacité ne peut pas descendre sous ${confirmedPersons} (nombre de personnes déjà réservées).`);
      return;
    }
    if (priceChanged && hasReservations && !confirmPriceChange) {
      toast.error('Ce créneau a déjà des réservations : confirmez le changement de tarif via la case ci-dessous.');
      return;
    }
    if (!isSupabaseConfigured) {
      toast.success('Mode démonstration : créneau virtuel enregistré.');
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
    if (error) toast.error(mapSupabaseError(error));
    else {
      toast.success(mode === 'edit' ? 'Créneau modifié.' : 'Créneau créé.');
      onSaved();
      onClose();
    }
  }

  return (
    <Modal open onClose={onClose} title={titles[mode]} locked={saving} size="md">
      <form onSubmit={handleSave} className="space-y-3">
        <div><label className="label" htmlFor="slot-date">Date</label><input id="slot-date" type="date" required className="input" value={date} onChange={e => setDate(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="slot-start">Début</label><input id="slot-start" type="time" required className="input" value={start} onChange={e => setStart(e.target.value)} /></div>
          <div><label className="label" htmlFor="slot-end">Fin</label><input id="slot-end" type="time" required className="input" value={end} onChange={e => setEnd(e.target.value)} /></div>
        </div>
        <div>
          <label className="label" htmlFor="slot-capacity">Capacité</label>
          <input id="slot-capacity" type="number" min={1} className="input" value={capacity} onChange={e => setCapacity(Number(e.target.value))} aria-invalid={capacityTooLow} />
          {capacityTooLow && (
            <p className="text-xs text-red-600 mt-1" role="alert">
              <AlertTriangle className="w-3.5 h-3.5 inline mr-1" aria-hidden="true" />
              Il y a déjà {confirmedPersons} personne{confirmedPersons > 1 ? 's' : ''} réservée{confirmedPersons > 1 ? 's' : ''} sur ce créneau.
            </p>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="label" htmlFor="price-ext">Tarif extérieur (€)</label><input id="price-ext" type="number" min={0} step={0.5} className="input" value={price} onChange={e => setPrice(Number(e.target.value))} /></div>
          <div><label className="label" htmlFor="price-noc">Tarif Nocéen (€)</label><input id="price-noc" type="number" min={0} step={0.5} className="input" value={priceResident} onChange={e => setPriceResident(Number(e.target.value))} /></div>
          <div><label className="label" htmlFor="price-child">Tarif enfant (€)</label><input id="price-child" type="number" min={0} step={0.5} className="input" value={priceChild} onChange={e => setPriceChild(Number(e.target.value))} /></div>
        </div>
        <p className="text-xs text-slate-500">Si tarif Nocéen ≥ tarif extérieur, l&apos;option « Nocéen » est masquée côté usager (pas de réduction).</p>

        {priceChanged && hasReservations && (
          <label className="flex items-start gap-2 text-xs bg-amber-50 border border-amber-200 rounded-xl p-3">
            <input type="checkbox" checked={confirmPriceChange} onChange={(e) => setConfirmPriceChange(e.target.checked)} className="mt-0.5" />
            <span className="text-amber-900">
              Je confirme modifier le tarif d&apos;un créneau ayant des réservations. Les montants des réservations existantes restent inchangés (les triggers serveur ont figé le total au moment de l&apos;achat) ; seules les nouvelles réservations utiliseront le nouveau tarif.
            </span>
          </label>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost" disabled={saving}>Annuler</button>
          <button type="submit" disabled={saving || capacityTooLow} className="btn-primary">{saving ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : (mode === 'edit' ? 'Enregistrer' : 'Créer')}</button>
        </div>
      </form>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// Génération en masse : vérifie d'abord combien de créneaux seraient
// écrasés (upsert sur date,start_time) et demande confirmation explicite.
// ----------------------------------------------------------------------
function BulkGenerateModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [from, setFrom] = useState('2026-07-04');
  const [to, setTo] = useState('2026-08-30');
  const [capacity, setCapacity] = useState(50);
  // Tarifs saisis en EUROS (convertis en centimes à l'enregistrement).
  const [price, setPrice] = useState(5);
  const [priceResident, setPriceResident] = useState(3);
  const [priceChild, setPriceChild] = useState(2.5);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<{ total: number; existing: number } | null>(null);

  const slotTimes = [
    { start: '10:00', end: '12:00' }, { start: '12:00', end: '14:00' },
    { start: '14:00', end: '16:00' }, { start: '16:00', end: '18:00' },
    { start: '18:00', end: '20:00' },
  ];

  function buildRows() {
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
    return rows;
  }

  async function previewGenerate() {
    if (!isSupabaseConfigured) { setPreview({ total: buildRows().length, existing: 0 }); return; }
    setPreviewing(true);
    const rows = buildRows();
    const { count } = await supabase
      .from('slots')
      .select('id', { count: 'exact', head: true })
      .gte('date', from).lte('date', to);
    setPreviewing(false);
    setPreview({ total: rows.length, existing: count ?? 0 });
  }

  async function handleGenerate() {
    if (!isSupabaseConfigured) { toast.success('Mode démonstration.'); onClose(); return; }
    setSaving(true);
    const rows = buildRows();
    const { error } = await supabase.from('slots').upsert(rows, { onConflict: 'date,start_time' });
    setSaving(false);
    if (error) toast.error(mapSupabaseError(error));
    else { toast.success(`${rows.length} créneaux générés (créés ou mis à jour).`); onSaved(); onClose(); }
  }

  return (
    <Modal open onClose={onClose} title="Génération en masse" locked={saving} size="md">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="bulk-from">Du</label><input id="bulk-from" type="date" required className="input" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><label className="label" htmlFor="bulk-to">Au</label><input id="bulk-to" type="date" required className="input" value={to} onChange={e => setTo(e.target.value)} /></div>
        </div>
        <div><label className="label" htmlFor="bulk-capacity">Capacité par créneau</label><input id="bulk-capacity" type="number" min={1} className="input" value={capacity} onChange={e => setCapacity(Number(e.target.value))} /></div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="label" htmlFor="bulk-pr-ext">Tarif extérieur (€)</label><input id="bulk-pr-ext" type="number" min={0} step={0.5} className="input" value={price} onChange={e => setPrice(Number(e.target.value))} /></div>
          <div><label className="label" htmlFor="bulk-pr-noc">Tarif Nocéen (€)</label><input id="bulk-pr-noc" type="number" min={0} step={0.5} className="input" value={priceResident} onChange={e => setPriceResident(Number(e.target.value))} /></div>
          <div><label className="label" htmlFor="bulk-pr-child">Tarif enfant (€)</label><input id="bulk-pr-child" type="number" min={0} step={0.5} className="input" value={priceChild} onChange={e => setPriceChild(Number(e.target.value))} /></div>
        </div>
        <p className="text-xs text-slate-500">
          5 créneaux/jour seront créés (10 h, 12 h, 14 h, 16 h, 18 h). Si tarif Nocéen ≥ extérieur, l&apos;option « Nocéen » est masquée côté usager.
        </p>

        {!preview ? (
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">Annuler</button>
            <button type="button" onClick={previewGenerate} disabled={previewing} className="btn-primary">
              {previewing ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : 'Prévisualiser'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div className="text-amber-900">
                <strong>{preview.total} créneaux à créer / mettre à jour</strong>.
                {preview.existing > 0 && <> <strong>{preview.existing} créneau{preview.existing > 1 ? 'x' : ''} existant{preview.existing > 1 ? 's' : ''}</strong> dans cette période ser{preview.existing > 1 ? 'ont' : 'a'} écrasé{preview.existing > 1 ? 's' : ''} (date + horaire identiques : tarif et capacité remplacés).</>}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setPreview(null)} className="btn-ghost" disabled={saving}>Modifier les paramètres</button>
              <button type="button" onClick={handleGenerate} disabled={saving} className="btn-primary">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : 'Confirmer la génération'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
