import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, MapPin, QrCode, Inbox, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../lib/auth';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { formatDate, formatPrice, formatTimeRange } from '../lib/format';
import type { ReservationWithSlot, ReservationStatus } from '../types/database';

const STATUS_LABELS: Record<ReservationStatus, { label: string; cls: string }> = {
  pending_payment: { label: 'Paiement en attente', cls: 'badge-warning' },
  confirmed: { label: 'Confirmée', cls: 'badge-success' },
  used: { label: 'Utilisée', cls: 'badge-muted' },
  cancelled: { label: 'Annulée', cls: 'badge-danger' },
  refunded: { label: 'Remboursée', cls: 'badge-muted' },
  no_show: { label: 'Non venu', cls: 'badge-muted' },
  expired: { label: 'Expirée', cls: 'badge-muted' },
};

export function AccountPage() {
  const { user, profile } = useAuth();
  const [reservations, setReservations] = useState<ReservationWithSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured) {
        setReservations([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setLoadError(false);
      const { data, error } = await supabase
        .from('reservations')
        .select('*, slot:slots(*)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) {
        setLoadError(true);
      } else {
        setReservations((data ?? []) as ReservationWithSlot[]);
      }
      setLoading(false);
    }
    if (user) load();
  }, [user, reloadTick]);

  // Heure de début du créneau (pour la règle d'annulation 24h)
  function slotStart(r: ReservationWithSlot) {
    return new Date(`${r.slot.date}T${r.slot.start_time}`);
  }

  async function cancelReservation(r: ReservationWithSlot) {
    const isPending = r.status === 'pending_payment';
    // Réservation confirmée : annulation impossible à moins de 24h du créneau
    if (!isPending) {
      const msLeft = slotStart(r).getTime() - Date.now();
      if (msLeft < 24 * 3600 * 1000) {
        toast.error("L'annulation n'est plus possible à moins de 24h du créneau.");
        return;
      }
    }
    const msg = isPending
      ? 'Abandonner cette demande de réservation non payée ?'
      : "Confirmer l'annulation de cette réservation ?";
    if (!confirm(msg)) return;
    if (!isSupabaseConfigured) return;
    const { error } = await supabase
      .from('reservations')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', r.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      isPending
        ? 'Demande abandonnée.'
        : "Demande d'annulation enregistrée. Le remboursement éventuel sera traité par la commune.",
    );
    setReservations((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: 'cancelled' } : x)));
  }

  return (
    <div className="container-app py-10 max-w-5xl">
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-display font-bold mb-1">Mon espace</h1>
        <p className="text-slate-600">
          Bonjour {profile?.first_name || 'à vous'} 👋 — voici vos réservations et informations personnelles.
        </p>
      </header>

      <div className="flex gap-2 mb-6 border-b border-slate-200">
        <Link to="/compte" className="px-4 py-2 text-sm font-semibold border-b-2 border-brand-600 text-brand-700">Mes réservations</Link>
        <Link to="/compte/profil" className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-800">Profil & RGPD</Link>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-6 h-28 shimmer" />
          ))}
        </div>
      ) : loadError ? (
        <div className="card p-10 text-center">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <h2 className="font-display font-bold text-lg mb-1">Impossible de charger vos réservations</h2>
          <p className="text-sm text-slate-500 mb-5">Une erreur réseau est survenue. Vos réservations ne sont pas perdues.</p>
          <button onClick={() => setReloadTick((t) => t + 1)} className="btn-primary">Réessayer</button>
        </div>
      ) : reservations.length === 0 ? (
        <div className="card p-10 text-center">
          <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h2 className="font-display font-bold text-lg mb-1">Aucune réservation pour le moment</h2>
          <p className="text-sm text-slate-500 mb-5">Réservez votre prochain créneau de baignade en quelques clics.</p>
          <Link to="/reserver" className="btn-primary">Voir les créneaux</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {reservations.map((r) => {
            const statusMeta = STATUS_LABELS[r.status];
            const isUpcoming = r.status === 'confirmed' && new Date(r.slot.date) >= new Date(new Date().toDateString());
            return (
              <article key={r.id} className="card p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className={statusMeta.cls}>{statusMeta.label}</span>
                    <span className="text-xs text-slate-400 font-mono">#{r.reference}</span>
                  </div>
                  <h3 className="font-display font-bold text-lg">{formatDate(r.slot.date)}</h3>
                  <ul className="mt-1.5 text-sm text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                    <li className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {formatTimeRange(r.slot.start_time, r.slot.end_time)}</li>
                    <li className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Berge de la Marne</li>
                    <li>{r.nb_adults} adulte{r.nb_adults > 1 ? 's' : ''}{r.nb_children > 0 && ` · ${r.nb_children} enfant${r.nb_children > 1 ? 's' : ''}`}</li>
                    <li className="font-semibold text-slate-700">{formatPrice(r.total_amount_cents)}</li>
                  </ul>
                </div>
                <div className="flex flex-col items-stretch sm:items-end gap-2 flex-shrink-0">
                  {r.status === 'confirmed' && (
                    <Link to={`/compte/reservation/${r.id}`} className="btn-primary text-sm justify-center">
                      <QrCode className="w-4 h-4" /> Voir QR
                    </Link>
                  )}
                  {r.status === 'pending_payment' && (
                    <>
                      <p className="text-xs text-amber-700 sm:text-right sm:max-w-[13rem]">
                        Réservation non confirmée tant que le paiement n'est pas réglé.
                      </p>
                      <button onClick={() => cancelReservation(r)} className="btn-secondary text-sm justify-center">
                        Annuler la demande
                      </button>
                    </>
                  )}
                  {isUpcoming && (
                    <button onClick={() => cancelReservation(r)} className="btn-secondary text-sm justify-center">
                      Annuler
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {!isSupabaseConfigured && (
        <div className="mt-6 card p-4 border-amber-200 bg-amber-50/60 flex gap-3 items-start text-sm">
          <AlertTriangle className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
          <div>
            <strong>Mode démo</strong> — Configurez Supabase dans <code>.env.local</code> pour activer la persistance des données.
          </div>
        </div>
      )}

      <div className="mt-10 flex items-center justify-center">
        <Calendar className="w-4 h-4 text-slate-400 mr-2" />
        <Link to="/reserver" className="text-sm text-brand-700 hover:underline">Réserver un nouveau créneau</Link>
      </div>
    </div>
  );
}
