import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { formatDate } from '../../lib/format';

interface Row {
  id: string;
  result: string;
  scanned_at: string;
  reservation: { reference: string; slot: { date: string; start_time: string } | null } | null;
  scanner: { first_name: string | null; last_name: string | null } | null;
}

export function StaffHistory() {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured) {
        setRows([]);
        return;
      }
      const { data } = await supabase
        .from('scan_log')
        .select('id, result, scanned_at, reservation:reservations(reference, slot:slots(date, start_time)), scanner:profiles!scan_log_scanned_by_fkey(first_name, last_name)')
        .order('scanned_at', { ascending: false })
        .limit(200);
      setRows((data ?? []) as any);
    }
    load();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 p-4">
        <div className="container-app flex items-center justify-between max-w-3xl">
          <Link to="/staff" className="text-sm text-slate-600 inline-flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Retour</Link>
          <h1 className="font-display font-bold text-lg">Historique des scans</h1>
          <span />
        </div>
      </header>

      <div className="container-app max-w-3xl py-6 space-y-2">
        {rows.length === 0 && <div className="card p-10 text-center text-sm text-slate-500">Aucun scan enregistré</div>}
        {rows.map((r) => {
          const Icon = r.result === 'valid' ? CheckCircle2 : r.result === 'already_used' ? AlertTriangle : XCircle;
          const cls = r.result === 'valid' ? 'text-emerald-600' : r.result === 'already_used' ? 'text-amber-600' : 'text-red-600';
          return (
            <article key={r.id} className="card p-4 flex items-center gap-3">
              <Icon className={`w-6 h-6 ${cls} flex-shrink-0`} />
              <div className="flex-1 min-w-0">
                <div className="font-mono text-xs text-slate-500">{r.reservation?.reference ?? '—'}</div>
                <div className="text-sm">{formatDate(r.scanned_at, 'EEE d MMM yyyy · HH:mm')}</div>
              </div>
              <div className="text-xs text-slate-500 text-right">
                {r.scanner?.first_name} {r.scanner?.last_name}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
