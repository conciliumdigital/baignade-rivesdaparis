import { useEffect, useState } from 'react';
import { UserPlus, Shield, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { mapSupabaseError } from '../../lib/errors';
import { Modal } from '../../components/Modal';
import type { Profile, UserRole } from '../../types/database';

const ROLE_LABELS: Record<UserRole, { label: string; cls: string }> = {
  admin: { label: 'Administrateur', cls: 'badge-info' },
  manager: { label: 'Gestionnaire', cls: 'badge-warning' },
  staff: { label: 'Agent d\'accueil', cls: 'badge-success' },
  user: { label: 'Usager', cls: 'badge-muted' },
};

export function AdminStaff() {
  const [staff, setStaff] = useState<Profile[]>([]);
  const [showInvite, setShowInvite] = useState(false);

  async function loadStaff() {
    if (!isSupabaseConfigured) {
      setStaff([]);
      return;
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .in('role', ['admin', 'manager', 'staff'])
      .order('role');
    if (error) toast.error(mapSupabaseError(error));
    setStaff((data ?? []) as Profile[]);
  }

  useEffect(() => { loadStaff(); }, []);

  return (
    <div>
      <header className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold">Équipe</h1>
          <p className="text-sm text-slate-600">Comptes administrateur, gestionnaire et agents d&apos;accueil.</p>
        </div>
        <button onClick={() => setShowInvite(true)} className="btn-primary text-sm">
          <UserPlus className="w-4 h-4" aria-hidden="true" /> Inviter un membre
        </button>
      </header>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-100">
            <tr>
              <th className="px-4 py-3 text-left">Nom</th>
              <th className="px-4 py-3 text-left">Adresse électronique</th>
              <th className="px-4 py-3 text-left">Rôle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {staff.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-10 text-center text-slate-500 text-sm">
                <Shield className="w-8 h-8 mx-auto mb-2 text-slate-300" aria-hidden="true" />
                Aucun compte d&apos;équipe configuré.
              </td></tr>
            )}
            {staff.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3 font-medium">{p.first_name} {p.last_name}</td>
                <td className="px-4 py-3">{p.email}</td>
                <td className="px-4 py-3"><span className={ROLE_LABELS[p.role].cls}>{ROLE_LABELS[p.role].label}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showInvite && (
        <InviteModal onClose={() => setShowInvite(false)} onSaved={loadStaff} />
      )}
    </div>
  );
}

function InviteModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('staff');
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const target = email.trim().toLowerCase();
    if (!target) return;
    if (role === 'admin' && !isAdmin) {
      // Garde-fou UI redondant avec la RLS : les gestionnaires ne doivent
      // pas pouvoir promouvoir admin via l'interface.
      toast.error('Seul un administrateur peut attribuer le rôle d\'administrateur.');
      return;
    }
    if (!isSupabaseConfigured) {
      toast.success('Mode démonstration : rôle attribué (simulation).');
      onClose();
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('email', target)
      .select('id');
    setSaving(false);
    if (error) {
      toast.error(mapSupabaseError(error));
      return;
    }
    if (!data || data.length === 0) {
      toast.error(
        'Aucun compte ne correspond à cette adresse. La personne doit d\'abord se connecter une fois via le lien de connexion (page Connexion), puis réessayez.',
        { duration: 7000 },
      );
      return;
    }
    toast.success(`Rôle « ${ROLE_LABELS[role].label} » attribué à ${target}.`);
    onSaved();
    onClose();
  }

  return (
    <Modal open onClose={onClose} title="Inviter un membre" description="La personne doit s'être déjà connectée une fois via le lien de connexion (sans mot de passe). Vous lui attribuez ensuite un rôle ici." locked={saving} size="md">
      <form onSubmit={handleSave} className="space-y-3">
        <div>
          <label className="label" htmlFor="invite-email">Adresse électronique</label>
          <input
            id="invite-email"
            type="email"
            required
            className="input"
            placeholder="prenom.nom@exemple.fr"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
        <div>
          <label className="label" htmlFor="invite-role">Rôle</label>
          <select id="invite-role" className="input" value={role} onChange={e => setRole(e.target.value as UserRole)}>
            <option value="staff">Agent d&apos;accueil (scan QR)</option>
            <option value="manager">Gestionnaire (back-office)</option>
            {isAdmin && <option value="admin">Administrateur (accès complet)</option>}
          </select>
          {!isAdmin && (
            <p className="text-xs text-slate-500 mt-1">
              L&apos;attribution du rôle administrateur est réservée aux administrateurs.
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost" disabled={saving}>Annuler</button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : 'Attribuer le rôle'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
