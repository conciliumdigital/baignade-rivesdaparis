import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Mail, Loader2, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../lib/auth';
import { mapSupabaseError } from '../lib/errors';

// Sécurité : whitelist des chemins de redirection autorisés après magic
// link, pour éviter un open-redirect via `?next=` ou `location.state.from`.
const ALLOWED_REDIRECT_PREFIXES = ['/compte', '/reserver', '/admin', '/staff'];
function safeRedirect(raw: string | undefined | null): string {
  if (!raw) return '/compte';
  try {
    // Si on reçoit une URL complète, on ne garde que le chemin
    const url = raw.startsWith('http') ? new URL(raw) : null;
    const sameOrigin = url ? url.origin === window.location.origin : true;
    const pathAndQuery = url ? url.pathname + url.search : raw;
    if (!sameOrigin) return '/compte';
    if (!pathAndQuery.startsWith('/')) return '/compte';
    if (pathAndQuery.startsWith('//')) return '/compte'; // protocol-relative
    if (!ALLOWED_REDIRECT_PREFIXES.some((p) => pathAndQuery === p || pathAndQuery.startsWith(p + '/') || pathAndQuery.startsWith(p + '?'))) {
      return '/compte';
    }
    return pathAndQuery;
  } catch {
    return '/compte';
  }
}

export function LoginPage() {
  const { signInWithMagicLink } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  // Source possible : state.from (interne) > ?next= (lien) > /compte (défaut)
  const candidate = (location.state as { from?: string; email?: string })?.from ?? searchParams.get('next');
  const fromPath = safeRedirect(candidate);
  const presetEmail = (location.state as { from?: string; email?: string })?.email ?? '';

  const [email, setEmail] = useState(presetEmail);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (presetEmail && !email) setEmail(presetEmail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetEmail]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await signInWithMagicLink(email, `${window.location.origin}${fromPath}`);
    setLoading(false);
    if (error) {
      toast.error(mapSupabaseError(error));
    } else {
      setSent(true);
      toast.success('Un lien de connexion vient de vous être envoyé.');
    }
  }

  return (
    <div className="container-app py-16 max-w-md">
      <div className="card p-8">
        <div className="w-12 h-12 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center mx-auto mb-4">
          <Mail className="w-6 h-6" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-display font-bold text-center mb-2">Connexion</h1>
        <p className="text-sm text-slate-600 text-center mb-6">
          Recevez un lien de connexion par courriel pour vous identifier sans mot de passe.
        </p>

        {sent ? (
          <div className="text-center space-y-4" role="status" aria-live="polite">
            <p className="text-sm text-slate-700">
              Un lien de connexion a été envoyé à <strong>{email}</strong>.
              <br />Vérifiez votre boîte de réception (et le dossier des courriers indésirables).
            </p>
            <button onClick={() => setSent(false)} className="btn-ghost text-sm">Renvoyer un lien</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="label">Adresse électronique</label>
              <input
                id="email"
                type="email"
                required
                className="input"
                placeholder="vous@exemple.fr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center min-h-[44px]">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <><ArrowRight className="w-4 h-4" aria-hidden="true" /> Recevoir le lien</>}
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
