import { useEffect, useMemo, useState } from 'react';
import { Search, Download, Filter, Loader2, FileText, Home, X, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { formatDate, formatPrice, formatTimeRange } from '../../lib/format';
import { mapSupabaseError, formatReservationStatus } from '../../lib/errors';
import { Modal } from '../../components/Modal';
import type { ReservationStatus, UsagerType } from '../../types/database';

interface Row {
  id: string;
  reference: string;
  status: ReservationStatus;
  nb_adults: number;
  nb_children: number;
  total_amount_cents: number;
  usager_type: UsagerType;
  resident_proof_url: string | null;
  honor_certification: boolean;
  created_at: string;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  stripe_session_id?: string | null;
  stripe_refund_id?: string | null;
  user: { id?: string; email: string; first_name: string | null; last_name: string | null; phone?: string | null } | null;
  slot: { id?: string; date: string; start_time: string; end_time: string } | null;
}

const PAGE_SIZE = 500;

export function AdminReservations() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [truncated, setTruncated] = useState(false);
  const [detail, setDetail] = useState<Row | null>(null);

  async function load() {
    if (!isSupabaseConfigured) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error, count } = await supabase
      .from('reservations')
      .select(
        'id, reference, status, nb_adults, nb_children, total_amount_cents, usager_type, resident_proof_url, honor_certification, created_at, cancelled_at, cancellation_reason, stripe_session_id, stripe_refund_id, user:profiles(id, email, first_name, last_name, phone), slot:slots(id, date, start_time, end_time)',
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);
    if (error) toast.error(mapSupabaseError(error));
    setRows((data ?? []) as any);
    setTruncated((count ?? 0) > PAGE_SIZE);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const fullName = [r.user?.first_name, r.user?.last_name].filter(Boolean).join(' ').toLowerCase();
      const matchSearch =
        !q ||
        r.reference.toLowerCase().includes(q) ||
        (r.user?.email ?? '').toLowerCase().includes(q) ||
        fullName.includes(q);
      const matchStatus = statusFilter === 'all' || r.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [rows, search, statusFilter]);

  async function openProof(path: string) {
    if (!isSupabaseConfigured) {
      toast.error('Mode démonstration : justificatif non disponible.');
      return;
    }
    const { data, error } = await supabase.storage
      .from('resident-proofs')
      .createSignedUrl(path, 60 * 5);
    if (error || !data?.signedUrl) {
      toast.error(mapSupabaseError(error) || 'Impossible d\'ouvrir le justificatif.');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  // Échappement formules CSV (anti-injection : =cmd, +cmd, -cmd, @, tab, CR)
  function csvCell(v: unknown): string {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return `"${s.replace(/"/g, '""')}"`;
  }

  function exportCsv() {
    const header = ['Référence', 'Statut', 'Type usager', 'Nom', 'Email', 'Date', 'Horaire', 'Adultes', 'Enfants', 'Montant', 'Justificatif'];
    const lines = filtered.map((r) => [
      r.reference,
      r.status,
      r.usager_type,
      [r.user?.first_name, r.user?.last_name].filter(Boolean).join(' '),
      r.user?.email ?? '',
      r.slot?.date ?? '',
      r.slot ? `${r.slot.start_time} - ${r.slot.end_time}` : '',
      r.nb_adults,
      r.nb_children,
      (r.total_amount_cents / 100).toFixed(2),
      r.resident_proof_url ? 'oui' : 'non',
    ].map(csvCell).join(','));
    const csv = [header.map(csvCell).join(','), ...lines].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reservations-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <header className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold">Réservations</h1>
          <p className="text-sm text-slate-600">{filtered.length} résultat{filtered.length > 1 ? 's' : ''}{truncated ? ` (sur les ${PAGE_SIZE} plus récentes, affinez les filtres pour voir le reste)` : ''}.</p>
        </div>
        <button onClick={exportCsv} className="btn-secondary text-sm"><Download className="w-4 h-4" /> Exporter CSV</button>
      </header>

      <div className="card p-3 flex gap-3 mb-4 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Référence, courriel, nom…"
            className="input pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Rechercher une réservation"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" aria-hidden="true" />
          <label className="sr-only" htmlFor="status-filter">Filtrer par statut</label>
          <select id="status-filter" className="input py-2 text-sm w-44" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">Tous statuts</option>
            <option value="confirmed">Confirmées</option>
            <option value="pending_payment">En attente</option>
            <option value="used">Utilisées</option>
            <option value="cancelled">Annulées</option>
            <option value="refunded">Remboursées</option>
            <option value="no_show">Non présentées</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="card p-10 text-center"><Loader2 className="w-6 h-6 animate-spin text-brand-600 mx-auto" /></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 text-left">Réf.</th>
                <th className="px-4 py-3 text-left">Usager</th>
                <th className="px-4 py-3 text-left">Créneau</th>
                <th className="px-4 py-3 text-left">Pers.</th>
                <th className="px-4 py-3 text-left">Tarif</th>
                <th className="px-4 py-3 text-left">Justif.</th>
                <th className="px-4 py-3 text-left">Montant</th>
                <th className="px-4 py-3 text-left">Statut</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs">{r.reference}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{[r.user?.first_name, r.user?.last_name].filter(Boolean).join(' ') || '·'}</div>
                    <div className="text-xs text-slate-500">{r.user?.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    {r.slot ? (
                      <>
                        <div>{formatDate(r.slot.date, 'EEE d MMM')}</div>
                        <div className="text-xs text-slate-500">{formatTimeRange(r.slot.start_time, r.slot.end_time)}</div>
                      </>
                    ) : '·'}
                  </td>
                  <td className="px-4 py-3">{r.nb_adults}A {r.nb_children > 0 && `· ${r.nb_children}E`}</td>
                  <td className="px-4 py-3"><UsagerBadge type={r.usager_type} /></td>
                  <td className="px-4 py-3">
                    {r.resident_proof_url ? (
                      <button
                        onClick={() => openProof(r.resident_proof_url as string)}
                        className="inline-flex items-center gap-1 text-brand-700 hover:underline text-xs font-medium"
                      >
                        <FileText className="w-3.5 h-3.5" aria-hidden="true" /> Voir
                      </button>
                    ) : r.usager_type === 'habitant' ? (
                      <span className="text-xs text-amber-600">manquant</span>
                    ) : (
                      <span className="text-xs text-slate-400">·</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{formatPrice(r.total_amount_cents)}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setDetail(r)}
                      className="text-brand-700 hover:underline text-xs font-medium"
                      aria-label={`Voir le détail de la réservation ${r.reference}`}
                    >
                      Détail
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-500 text-sm">Aucun résultat.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <DetailDrawer reservation={detail} onClose={() => setDetail(null)} onChanged={load} />
    </div>
  );
}

function UsagerBadge({ type }: { type: UsagerType }) {
  const map: Record<UsagerType, { label: string; cls: string; icon: typeof Home | null }> = {
    habitant: { label: 'Nocéen', cls: 'badge bg-emerald-50 text-emerald-700 border border-emerald-200', icon: Home },
    exterieur: { label: 'Extérieur', cls: 'badge-muted', icon: null },
    groupe: { label: 'Groupe', cls: 'badge-info', icon: null },
    ecole: { label: 'École', cls: 'badge-info', icon: null },
  };
  const m = map[type];
  const Icon = m.icon;
  return (
    <span className={`${m.cls} inline-flex items-center gap-1`}>
      {Icon && <Icon className="w-3 h-3" aria-hidden="true" />} {m.label}
    </span>
  );
}

function StatusBadge({ status }: { status: ReservationStatus }) {
  const map: Record<ReservationStatus, { label: string; cls: string }> = {
    confirmed: { label: 'Confirmée', cls: 'badge-success' },
    pending_payment: { label: 'En attente', cls: 'badge-warning' },
    used: { label: 'Utilisée', cls: 'badge-info' },
    cancelled: { label: 'Annulée', cls: 'badge-danger' },
    refunded: { label: 'Remboursée', cls: 'badge-muted' },
    no_show: { label: 'Non présentée', cls: 'badge-muted' },
    expired: { label: 'Expirée', cls: 'badge-muted' },
  };
  const m = map[status];
  return <span className={m.cls}>{m.label}</span>;
}

// ============== Drawer / Modal de détail + actions admin ==============
function DetailDrawer({ reservation, onClose, onChanged }: {
  reservation: Row | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);

  if (!reservation) return null;

  const cancellable = reservation.status === 'pending_payment' || reservation.status === 'confirmed';

  async function doCancel() {
    if (!reservation) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc('cancel_reservation', {
        p_reservation_id: reservation.id,
        p_reason: reason.trim() || null,
      });
      if (error) throw error;
      toast.success('Réservation annulée. L\'usager va être notifié et la place libérée.');
      onChanged();
      onClose();
    } catch (err) {
      toast.error(mapSupabaseError(err));
    } finally {
      setBusy(false);
      setConfirming(false);
      setReason('');
    }
  }

  return (
    <Modal
      open={!!reservation}
      onClose={onClose}
      title={`Réservation ${reservation.reference}`}
      description={reservation.slot ? `Créneau du ${reservation.slot.date} · ${reservation.slot.start_time} à ${reservation.slot.end_time}` : undefined}
      size="lg"
      locked={busy}
    >
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <Field label="Statut"><StatusBadge status={reservation.status} /></Field>
        <Field label="Type"><UsagerBadge type={reservation.usager_type} /></Field>
        <Field label="Usager">{[reservation.user?.first_name, reservation.user?.last_name].filter(Boolean).join(' ') || '·'}</Field>
        <Field label="Courriel">{reservation.user?.email ?? '·'}</Field>
        {reservation.user?.phone && <Field label="Téléphone">{reservation.user.phone}</Field>}
        <Field label="Adultes / Enfants">{reservation.nb_adults} / {reservation.nb_children}</Field>
        <Field label="Montant total">{formatPrice(reservation.total_amount_cents)}</Field>
        <Field label="Justificatif">{reservation.resident_proof_url ? 'Présent' : (reservation.usager_type === 'habitant' ? 'Manquant' : '·')}</Field>
        {reservation.cancelled_at && (
          <Field label="Annulée le" wide>{new Date(reservation.cancelled_at).toLocaleString('fr-FR')}{reservation.cancellation_reason ? ` : « ${reservation.cancellation_reason} »` : ''}</Field>
        )}
        {reservation.stripe_session_id && (
          <Field label="Paiement Stripe" wide>
            <code className="text-xs text-slate-600">{reservation.stripe_session_id}</code>
            {reservation.stripe_refund_id && <span className="ml-2 badge-muted text-xs">remboursé</span>}
          </Field>
        )}
      </dl>

      <div className="mt-6 pt-5 border-t border-slate-100 space-y-3">
        {!cancellable ? (
          <p className="text-sm text-slate-500">Aucune action disponible pour le statut « {formatReservationStatus(reservation.status)} ».</p>
        ) : !confirming ? (
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <a
              href={`mailto:${reservation.user?.email ?? ''}?subject=${encodeURIComponent('Réservation ' + reservation.reference)}`}
              className="btn-secondary text-sm"
            >
              Contacter par courriel
            </a>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="btn-secondary text-sm border-red-200 text-red-700 hover:bg-red-50"
            >
              <X className="w-4 h-4" aria-hidden="true" /> Annuler la réservation
            </button>
          </div>
        ) : (
          <div className="space-y-3 rounded-xl bg-red-50 border border-red-200 p-4">
            <div className="flex items-start gap-2 text-red-900">
              <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden="true" />
              <p className="text-sm">
                <strong>Annulation administrative</strong> : la place sera libérée immédiatement et la première personne en liste d&apos;attente recevra automatiquement une offre. Cette action est définitive (sauf re-création manuelle).
              </p>
            </div>
            <label className="block text-xs font-medium text-red-900">
              Motif (optionnel, sera visible dans le détail)
              <input
                type="text"
                className="input mt-1 text-sm"
                placeholder="Ex. demande de l\'usager, erreur de saisie…"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={200}
              />
            </label>
            <p className="text-xs text-red-800">
              <strong>Remboursement Stripe</strong> : à effectuer manuellement depuis le tableau de bord Stripe tant que la passerelle n&apos;est pas branchée. L&apos;annulation ci-dessous libère la place mais ne rembourse pas.
            </p>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => { setConfirming(false); setReason(''); }} disabled={busy} className="btn-ghost text-sm">Conserver</button>
              <button type="button" onClick={doCancel} disabled={busy} className="btn-primary bg-red-600 hover:bg-red-700 text-sm">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Annuler définitivement'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-900">{children}</dd>
    </div>
  );
}
