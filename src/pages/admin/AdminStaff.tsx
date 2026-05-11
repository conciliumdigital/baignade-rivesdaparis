import { useEffect, useState } from 'react';
import { UserPlus, Shield } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import type { Profile, UserRole } from '../../types/database';

export function AdminStaff() {
  const [staff, setStaff] = useState<Profile[]>([]);

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured) {
        setStaff([]);
        return;
      }
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['admin', 'manager', 'staff'])
        .order('role');
      setStaff((data ?? []) as Profile[]);
    }
    load();
  }, []);

  const ROLE_LABELS: Record<UserRole, { label: string; cls: string }> = {
    admin: { label: 'Administrateur', cls: 'badge-info' },
    manager: { label: 'Gestionnaire', cls: 'badge-warning' },
    staff: { label: 'Agent d\'accueil', cls: 'badge-success' },
    user: { label: 'Usager', cls: 'badge-muted' },
  };

  return (
    <div>
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold">Équipe</h1>
          <p className="text-sm text-slate-600">Comptes admin, gestionnaire et agents d'accueil.</p>
        </div>
        <button className="btn-primary text-sm"><UserPlus className="w-4 h-4" /> Inviter un membre</button>
      </header>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-100">
            <tr>
              <th className="px-4 py-3 text-left">Nom</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Rôle</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {staff.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-500 text-sm">
                <Shield className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                Aucun compte staff configuré.
              </td></tr>
            )}
            {staff.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3 font-medium">{p.first_name} {p.last_name}</td>
                <td className="px-4 py-3">{p.email}</td>
                <td className="px-4 py-3"><span className={ROLE_LABELS[p.role].cls}>{ROLE_LABELS[p.role].label}</span></td>
                <td className="px-4 py-3 text-right text-xs text-slate-500">…</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
