import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Mail, Loader2, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../lib/auth';

export function LoginPage() {
  const { signInWithMagicLink } = useAuth();
  const location = useLocation();
  const fromPath = (location.state as { from?: string })?.from ?? '/compte';
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await signInWithMagicLink(email, `${window.location.origin}${fromPath}`);
    setLoading(false);
    if (error) {
      toast.error(error);
    } else {
      setSent(true);
      toast.success('Lien magique envoyé !');
    }
  }

  return (
    <div className="container-app py-16 max-w-md">
      <div className="card p-8">
        <div className="w-12 h-12 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center mx-auto mb-4">
          <Mail className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-display font-bold text-center mb-2">Connexion</h1>
        <p className="text-sm text-slate-600 text-center mb-6">
          Recevez un lien magique par email pour vous connecter sans mot de passe.
        </p>

        {sent ? (
          <div className="text-center space-y-4">
            <p className="text-sm text-slate-700">
              Un lien de connexion a été envoyé à <strong>{email}</strong>.
              <br />Vérifiez votre boîte de réception (et vos spams).
            </p>
            <button onClick={() => setSent(false)} className="btn-ghost text-sm">Renvoyer un lien</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="label">Adresse email</label>
              <input
                id="email"
                type="email"
                required
                className="input"
                placeholder="vous@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ArrowRight className="w-4 h-4" /> Recevoir le lien</>}
            </button>
          </form>
        )}

        <p className="text-xs text-center text-slate-500 mt-6">
          Pas encore réservé ? <Link to="/reserver" className="text-brand-700 underline">Voir les créneaux</Link>
        </p>
      </div>
    </div>
  );
}
