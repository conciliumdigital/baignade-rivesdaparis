import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Trash2, Loader2, Save, ShieldAlert } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { mapSupabaseError } from '../lib/errors';

export function ProfilePage() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const [firstName, setFirstName] = useState(profile?.first_name ?? '');
  const [lastName, setLastName] = useState(profile?.last_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [notifEmail, setNotifEmail] = useState(profile?.notification_email ?? true);
  const [notifSms, setNotifSms] = useState(profile?.notification_sms ?? false);
  const [marketing, setMarketing] = useState(profile?.marketing_consent ?? false);
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !isSupabaseConfigured) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: firstName,
        last_name: lastName,
        phone,
        notification_email: notifEmail,
        notification_sms: notifSms,
        marketing_consent: marketing,
      })
      .eq('id', user.id);
    setSaving(false);
    if (error) toast.error(mapSupabaseError(error));
    else {
      await refreshProfile();
      toast.success('Profil mis à jour.');
    }
  }

  async function handleDelete() {
    if (!user || !isSupabaseConfigured) return;
    const confirmed = confirm(
      'Supprimer votre compte effacera l\'ensemble de vos données personnelles (RGPD - droit à l\'oubli). Cette action est irréversible. Confirmer ?',
    );
    if (!confirmed) return;
    const { error } = await supabase.from('profiles').delete().eq('id', user.id);
    if (error) toast.error(mapSupabaseError(error));
    else {
      toast.success('Compte supprimé. À bientôt.');
      await signOut();
    }
  }

  return (
    <div className="container-app py-10 max-w-3xl">
      <h1 className="text-3xl md:text-4xl font-display font-bold mb-1">Profil & confidentialité</h1>
      <p className="text-slate-600 mb-8">Gérez vos informations personnelles et vos préférences (RGPD).</p>

      <div className="flex gap-2 mb-6 border-b border-slate-200">
        <Link to="/compte" className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-800">Mes réservations</Link>
        <Link to="/compte/profil" className="px-4 py-2 text-sm font-semibold border-b-2 border-brand-600 text-brand-700">Profil & RGPD</Link>
      </div>

      <form onSubmit={handleSave} className="card p-6 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="fn" className="label">Prénom</label>
            <input id="fn" className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div>
            <label htmlFor="ln" className="label">Nom</label>
            <input id="ln" className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="email-display">Adresse électronique</label>
            <input id="email-display" className="input bg-slate-50" disabled value={profile?.email ?? user?.email ?? ''} />
            <p className="text-xs text-slate-500 mt-1">L&apos;adresse électronique sert d&apos;identifiant et ne peut pas être modifiée ici.</p>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="ph" className="label">Téléphone</label>
            <input id="ph" type="tel" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>

        <fieldset className="border-t border-slate-100 pt-4 space-y-2">
          <legend className="font-semibold text-sm mb-2">Notifications</legend>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={notifEmail} onChange={(e) => setNotifEmail(e.target.checked)} />
            Recevoir les confirmations et rappels par courriel (recommandé).
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={notifSms} onChange={(e) => setNotifSms(e.target.checked)} />
            Recevoir les rappels par SMS (J-1, H-1)
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
            Accepter les communications de la Mairie (actualités estivales, événements)
          </label>
        </fieldset>

        <div className="flex justify-end pt-2">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Enregistrer</>}
          </button>
        </div>
      </form>

      <div className="card p-6 mt-6 border-red-100 bg-red-50/40">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h2 className="font-display font-bold text-base text-red-900 mb-1">Droit à l&apos;oubli (RGPD)</h2>
            <p className="text-sm text-slate-700 mb-3">
              Vous pouvez supprimer définitivement votre compte et l&apos;ensemble de vos données personnelles à tout moment. Les réservations passées seront anonymisées pour les besoins comptables légaux.
            </p>
            <button onClick={handleDelete} className="btn-danger text-sm">
              <Trash2 className="w-4 h-4" /> Supprimer mon compte
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
