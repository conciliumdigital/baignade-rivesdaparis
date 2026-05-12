import { useEffect, useMemo, useState } from 'react';
import { Search, Download, Filter, Loader2, FileText, Home } from 'lucide-react';
import toast from 'react-hot-toast';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { formatDate, formatPrice, formatTimeRange } from '../../lib/format';
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
  user: { email: string; first_name: string | null; last_name: string | null } | null;
  slot: { date: string; start_time: string; end_time: string } | null;
}

export function AdminReservations() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured) {
        setRows([]);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('reservations')
        .select('id, reference, status, nb_adults, nb_children, total_amount_cents, usager_type, resident_proof_url, honor_certification, created_at, user:profiles(email, first_name, last_name), slot:slots(date, start_time, end_time)')
        .order('created_at', { ascending: false })
        .limit(500);
      setRows((data ?? []) as any);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const matchSearch =
        !search ||
        r.reference.toLowerCase().includes(search.toLowerCase()) ||
        r.user?.email.toLowerCase().includes(search.toLowerCase()) ||
        `${r.user?.first_name} ${r.user?.last_name}`.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || r.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [rows, search, statusFilter]);

  async function openProof(path: string) {
    if (!isSupabaseConfigured) {
      toast.error('Mode démo : justificatif non disponible.');
      return;
    }
    const { data, error } = await supabase.storage
      .from('resident-proofs')
      .createSignedUrl(path, 60 * 5);
    if (error || !data?.signedUrl) {
      toast.error('Impossible d\'ouvrir le justificatif.');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  function exportCsv() {
    const header = ['Référence', 'Statut', 'Type usager', 'Nom', 'Email', 'Date', 'Horaire', 'Adultes', 'Enfants', 'Montant', 'Justificatif'];
    const lines = filtered.map((r) => [
      r.reference,
      r.status,
      r.usager_type,
      `${r.user?.first_name ?? ''} ${r.user?.last_name ?? ''}`.trim(),
      r.user?.email ?? '',
      r.slot?.date ?? '',
      r.slot ? `${r.slot.start_time} - ${r.slot.end_time}` : '',
      r.nb_adults,
      r.nb_children,
      (r.total_amount_cents / 100).toFixed(2),
      r.resident_proof_url ? 'oui' : 'non',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const csv = [header.join(','), ...lines].join('\n');
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
          <p className="text-sm text-slate-600">{filtered.length} résultat{filtered.length > 1 ? 's' : ''}</p>
        </div>
        <button onClick={exportCsv} className="btn-secondary text-sm"><Download className="w-4 h-4" /> Exporter CSV</button>
      </header>

      <div className="card p-3 flex gap-3 mb-4 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Référence, email, nom…"
            className="input pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <select className="input py-2 text-sm w-44" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">Tous statuts</option>
            <option value="confirmed">Confirmées</option>
            <option value="pending_payment">En attente</option>
            <option value="used">Utilisées</option>
            <option value="cancelled">Annulées</option>
            <option value="refunded">Remboursées</option>
            <option value="no_show">No-show</option>
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
                <th className="px-4 py-3 text-left">Client</th>
                <th className="px-4 py-3 text-left">Créneau</th>
                <th className="px-4 py-3 text-left">Pers.</th>
                <th className="px-4 py-3 text-left">Tarif</th>
                <th className="px-4 py-3 text-left">Justif.</th>
                <th className="px-4 py-3 text-left">Montant</th>
                <th className="px-4 py-3 text-left">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs">{r.reference}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.user?.first_name} {r.user?.last_name}</div>
                    <div className="text-xs text-slate-500">{r.user?.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    {r.slot ? (
                      <>
                        <div>{formatDate(r.slot.date, 'EEE d MMM')}</div>
                        <div className="text-xs text-slate-500">{formatTimeRange(r.slot.start_time, r.slot.end_time)}</div>
                      </>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">{r.nb_adults}A {r.nb_children > 0 && `· ${r.nb_children}E`}</td>
                  <td className="px-4 py-3"><UsagerBadge type={r.usager_type} /></td>
                  <td className="px-4 py-3">
                    {r.resident_proof_url ? (
                      <button
                        onClick={() => openProof(r.resident_proof_url as string)}
                        className="inline-flex items-center gap-1 text-brand-700 hover:underline text-xs font-medium"
                      >
                        <FileText className="w-3.5 h-3.5" /> Voir
                      </button>
                    ) : r.usager_type === 'habitant' ? (
                      <span className="text-xs text-amber-600">manquant</span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{formatPrice(r.total_amount_cents)}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500 text-sm">Aucun résultat</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function UsagerBadge({ type }: { type: UsagerType }) {
  const map: Record<UsagerType, { label: string; cls: string; icon: typeof Home | null }> = {
    habitant: { label: 'Habitant', cls: 'badge bg-emerald-50 text-emerald-700 border border-emerald-200', icon: Home },
    exterieur: { label: 'Extérieur', cls: 'badge-muted', icon: null },
    groupe: { label: 'Groupe', cls: 'badge-info', icon: null },
    ecole: { label: 'École', cls: 'badge-info', icon: null },
  };
  const m = map[type];
  const Icon = m.icon;
  return (
    <span className={`${m.cls} inline-flex items-center gap-1`}>
      {Icon && <Icon className="w-3 h-3" />} {m.label}
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
    no_show: { label: 'No-show', cls: 'badge-muted' },
    expired: { label: 'Expirée', cls: 'badge-muted' },
  };
  const m = map[status];
  return <span className={m.cls}>{m.label}</span>;
}
