import { useEffect, useState } from 'react';
import { CalendarDays, Users, TrendingUp, Star, Wallet, AlertCircle } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { formatPrice } from '../../lib/format';

interface Stats {
  totalReservations: number;
  totalRevenue: number;
  fillRate: number;
  noShowRate: number;
  avgRating: number | null;
  upcomingSlots: number;
}

export function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured) {
        setStats({
          totalReservations: 1247,
          totalRevenue: 624500,
          fillRate: 78,
          noShowRate: 4.2,
          avgRating: 4.6,
          upcomingSlots: 23,
        });
        return;
      }
      const { data: rs } = await supabase.from('reservations').select('total_amount_cents, status');
      const confirmed = (rs ?? []).filter((r) => ['confirmed', 'used'].includes(r.status));
      const noShow = (rs ?? []).filter((r) => r.status === 'no_show').length;
      const revenue = confirmed.reduce((sum, r) => sum + r.total_amount_cents, 0);
      const { count: slotCount } = await supabase
        .from('slots')
        .select('*', { count: 'exact', head: true })
        .gte('date', new Date().toISOString().slice(0, 10))
        .eq('status', 'open');
      const { data: ratings } = await supabase.from('satisfaction_responses').select('rating_overall');
      const avg =
        ratings && ratings.length
          ? ratings.reduce((s, r) => s + (r.rating_overall ?? 0), 0) / ratings.length
          : null;
      setStats({
        totalReservations: rs?.length ?? 0,
        totalRevenue: revenue,
        fillRate: 0,
        noShowRate: rs && rs.length ? (noShow / rs.length) * 100 : 0,
        avgRating: avg,
        upcomingSlots: slotCount ?? 0,
      });
    }
    load();
  }, []);

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-display font-bold mb-1">Tableau de bord</h1>
        <p className="text-sm text-slate-600">Pilotage de la zone de baignade — saison 2026.</p>
      </header>

      {!stats ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="card p-5 h-32 shimmer" />)}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard icon={Users} label="Réservations" value={stats.totalReservations.toString()} accent="brand" />
          <StatCard icon={Wallet} label="Recettes saison" value={formatPrice(stats.totalRevenue)} accent="emerald" />
          <StatCard icon={TrendingUp} label="Taux de remplissage" value={`${stats.fillRate}%`} accent="indigo" />
          <StatCard icon={AlertCircle} label="Taux de no-show" value={`${stats.noShowRate.toFixed(1)}%`} accent="amber" />
          <StatCard icon={Star} label="Note moyenne" value={stats.avgRating ? `${stats.avgRating.toFixed(1)}/5` : 'n/a'} accent="yellow" />
          <StatCard icon={CalendarDays} label="Créneaux à venir" value={stats.upcomingSlots.toString()} accent="brand" />
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4 mt-6">
        <section className="card p-6">
          <h2 className="font-display font-bold mb-3">Activité des 7 derniers jours</h2>
          <div className="h-48 flex items-end gap-1.5">
            {[42, 58, 71, 65, 88, 92, 79].map((v, i) => (
              <div key={i} className="flex-1 bg-gradient-to-t from-brand-500 to-brand-300 rounded-t-md" style={{ height: `${v}%` }} title={`${v}%`} />
            ))}
          </div>
          <div className="flex justify-between text-xs text-slate-500 mt-2">
            {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => <span key={d}>{d}</span>)}
          </div>
        </section>

        <section className="card p-6">
          <h2 className="font-display font-bold mb-3">Répartition habitants / extérieurs</h2>
          <div className="space-y-3 mt-4">
            {[{ label: 'Habitants Neuilly-sur-Marne', pct: 62, cls: 'bg-brand-500' }, { label: 'Extérieurs', pct: 31, cls: 'bg-sand-400' }, { label: 'Groupes / écoles', pct: 7, cls: 'bg-emerald-500' }].map((s) => (
              <div key={s.label}>
                <div className="flex justify-between text-sm mb-1"><span>{s.label}</span><span className="font-semibold">{s.pct}%</span></div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className={`h-full ${s.cls}`} style={{ width: `${s.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: React.ElementType; label: string; value: string; accent: string }) {
  const cls: Record<string, string> = {
    brand: 'bg-brand-100 text-brand-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    indigo: 'bg-indigo-100 text-indigo-700',
    amber: 'bg-amber-100 text-amber-700',
    yellow: 'bg-yellow-100 text-yellow-700',
  };
  return (
    <div className="card p-5">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${cls[accent]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">{label}</div>
      <div className="font-display font-bold text-2xl mt-0.5">{value}</div>
    </div>
  );
}
