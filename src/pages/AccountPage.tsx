import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, MapPin, QrCode, Inbox, AlertTriangle, BellRing, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../lib/auth';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { formatDate, formatPrice, formatTimeRange } from '../lib/format';
import { mapSupabaseError } from '../lib/errors';
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

type WaitlistRow = {
  id: string;
  slot_id: string;
  nb_persons: number;
  status: string;
  notified_at: string | null;
  expires_at: string | null;
  created_at: string;
  slot: { date: string; start_time: string; end_time: string; status: string };
};

export function AccountPage() {
  const { user, profile } = useAuth();
  const [reservations, setReservations] = useState<ReservationWithSlot[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured) {
        setReservations([]);
        setWaitlist([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setLoadError(false);
      const [resR, resW] = await Promise.all([
        supabase
          .from('reservations')
          .select('*, slot:slots(*)')
          .eq('user_id', user!.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('waitlist')
          .select('id, slot_id, nb_persons, status, notified_at, expires_at, created_at, slot:slots(date, start_time, end_time, status)')
          .eq('user_id', user!.id)
          .order('created_at', { ascending: false }),
      ]);
      if (resR.error) {
        setLoadError(true);
      } else {
        setReservations((resR.data ?? []) as ReservationWithSlot[]);
      }
      if (!resW.error) {
        setWaitlist((resW.data ?? []) as unknown as WaitlistRow[]);
      }
      setLoading(false);
    }
    if (user) load();
  }, [user, reloadTick]);

  async function leaveWaitlist(slot_id: string) {
    if (!isSupabaseConfigured) return;
    if (!confirm('Retirer cette inscription de la liste d\'attente ?')) return;
    const { error } = await supabase.rpc('leave_waitlist', { p_slot_id: slot_id });
    if (error) { toast.error(mapSupabaseError(error)); return; }
    toast.success('Inscription retirée.');
    setWaitlist((prev) => prev.filter((w) => w.slot_id !== slot_id));
  }

  async function cancelReservation(r: ReservationWithSlot) {
    const isPending = r.status === 'pending_payment';
    const msg = isPending
      ? 'Abandonner cette demande de réservation non payée ?'
      : 'Confirmer l\'annulation de cette réservation ? La place sera libérée immédiatement.';
    if (!confirm(msg)) return;
    if (!isSupabaseConfigured) return;
    // Délégué à la RPC SECURITY DEFINER : elle vérifie l'authentification,
    // la propriété, le statut, et le délai 24 h (en Europe/Paris). Côté
    // client on ne refait plus le calcul de fuseau (cassait sous TZ
    // négative et masquait le jour J). Trigger libère le créneau.
    const { error } = await supabase.rpc('cancel_reservation', {
      p_reservation_id: r.id,
      p_reason: null,
    });
    if (error) {
      toast.error(mapSupabaseError(error));
      return;
    }
    toast.success(
      isPending
        ? 'Demande abandonnée.'
        : 'Annulation enregistrée. La place est libérée pour la liste d\'attente. Aucun remboursement n\'est effectué (voir les conditions générales).',
    );
    setReservations((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: 'cancelled' } : x)));
  }

  return (
    <div className="container-app py-10 max-w-5xl">
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-display font-semibold mb-1">Mon espace</h1>
        <p className="text-slate-600">
          Bonjour {profile?.first_name || 'à vous'} — voici vos réservations et vos informations personnelles.
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
          <h2 className="font-display font-bold text-lg mb-1">Impossible de charger vos réservations.</h2>
          <p className="text-sm text-slate-500 mb-5">Une erreur réseau est survenue. Vos réservations ne sont pas perdues.</p>
          <button onClick={() => setReloadTick((t) => t + 1)} className="btn-primary">Réessayer</button>
        </div>
      ) : reservations.length === 0 ? (
        <div className="card p-10 text-center">
          <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h2 className="font-display font-bold text-lg mb-1">Aucune réservation pour le moment.</h2>
          <p className="text-sm text-slate-500 mb-5">Réservez votre prochain créneau de baignade en quelques clics.</p>
          <Link to="/reserver" className="btn-primary">Voir les créneaux</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {reservations.map((r) => {
            const statusMeta = STATUS_LABELS[r.status];
            // Comparaison string yyyy-MM-dd pour rester insensible au fuseau
            // (avec Date() en TZ négative, certains créneaux du jour étaient
            // masqués). On compare strictement à la date locale du navigateur.
            const todayStr = new Date().toLocaleDateString('fr-CA');
            const isUpcoming = r.status === 'confirmed' && r.slot.date >= todayStr;
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
                    <li className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Chemin de la Haute-Île</li>
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
                        Réservation non confirmée tant que le paiement n&apos;est pas réglé.
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

      {waitlist.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display font-semibold text-xl mb-3 flex items-center gap-2">
            <BellRing className="w-5 h-5 text-brand-700" /> Mes inscriptions en liste d'attente
          </h2>
          <div className="space-y-3">
            {waitlist.map((w) => {
              const offered = w.status === 'offered' && w.notified_at;
              const expired = w.expires_at && new Date(w.expires_at) < new Date();
              return (
                <article key={w.id} className="card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {offered && !expired ? (
                        <span className="badge-success">Place disponible — réservez sous 24h</span>
                      ) : expired ? (
                        <span className="badge-muted">Délai dépassé</span>
                      ) : (
                        <span className="badge-info">En attente</span>
                      )}
                    </div>
                    <div className="font-display font-semibold">{formatDate(w.slot.date)}</div>
                    <div className="text-sm text-slate-600">
                      {formatTimeRange(w.slot.start_time, w.slot.end_time)} · {w.nb_persons} personne{w.nb_persons > 1 ? 's' : ''}
                    </div>
                  </div>
                  <div className="flex flex-col sm:items-end gap-2 flex-shrink-0">
                    {offered && !expired && (
                      <Link to={`/reserver/${w.slot_id}?adults=${w.nb_persons}&children=0`} className="btn-primary text-sm justify-center">
                        Réserver maintenant
                      </Link>
                    )}
                    <button onClick={() => leaveWaitlist(w.slot_id)} className="btn-ghost text-xs justify-center" title="Me désinscrire">
                      <X className="w-4 h-4" /> Me désinscrire
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
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
