import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Menu, X, LogOut, User as UserIcon, ShieldCheck, ScanLine } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../lib/auth';

export function Header() {
  const [open, setOpen] = useState(false);
  const { user, profile, signOut, hasRole } = useAuth();
  const navigate = useNavigate();

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `link-underline relative px-1.5 py-2 text-sm transition-colors ${
      isActive ? 'text-brand-700 font-semibold' : 'text-slate-600 font-medium hover:text-slate-900'
    }`;

  async function handleSignOut() {
    await signOut();
    setOpen(false);
    navigate('/');
  }

  return (
    <header className="sticky top-0 z-40 bg-white/85 backdrop-blur border-b border-slate-100">
      <div className="container-app flex items-center justify-between h-16">
        <Link to="/" className="flex items-center gap-2.5 group" aria-label="Accueil Baignade Rives d'Paris">
          <div className="w-9 h-9 rounded-lg bg-brand-800 flex items-center justify-center transition-transform group-hover:-translate-y-0.5">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="currentColor" aria-hidden="true">
              <path d="M2 17c2 0 2-1 4-1s2 1 4 1 2-1 4-1 2 1 4 1 2-1 4-1v3c-2 0-2-1-4-1s-2 1-4 1-2-1-4-1-2 1-4 1-2-1-4-1v-2zM2 12c2 0 2-1 4-1s2 1 4 1 2-1 4-1 2 1 4 1 2-1 4-1v3c-2 0-2-1-4-1s-2 1-4 1-2-1-4-1-2 1-4 1-2-1-4-1v-2z" />
            </svg>
          </div>
          <div className="leading-tight">
            <div className="font-display font-semibold text-slate-900 text-[17px]">Baignade Rives d'Paris</div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500 mt-0.5">Ville de Neuilly-sur-Marne</div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          <NavLink to="/" end className={navLinkClass}>Accueil</NavLink>
          <NavLink to="/reserver" className={navLinkClass}>Réserver</NavLink>
          <NavLink to="/infos-pratiques" className={navLinkClass}>Infos pratiques</NavLink>
          {user && <NavLink to="/compte" className={navLinkClass}>Mon espace</NavLink>}
          {hasRole('admin', 'manager') && (
            <NavLink to="/admin" className={navLinkClass}>
              <span className="inline-flex items-center gap-1"><ShieldCheck className="w-4 h-4" />Admin</span>
            </NavLink>
          )}
          {hasRole('staff', 'admin', 'manager') && (
            <NavLink to="/staff" className={navLinkClass}>
              <span className="inline-flex items-center gap-1"><ScanLine className="w-4 h-4" />Scan</span>
            </NavLink>
          )}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          {user ? (
            <>
              <Link to="/compte" className="btn-ghost text-sm" title={profile?.email ?? user.email ?? ''}>
                <UserIcon className="w-4 h-4" />
                <span className="max-w-[160px] truncate">{profile?.first_name || profile?.email || user.email}</span>
              </Link>
              <button onClick={handleSignOut} className="btn-secondary text-sm" aria-label="Se déconnecter">
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <Link to="/connexion" className="btn-ghost text-sm">Se connecter</Link>
              <Link to="/reserver" className="btn-primary text-sm">Réserver</Link>
            </>
          )}
        </div>

        <button
          className="md:hidden p-2 rounded-lg hover:bg-slate-100"
          onClick={() => setOpen(!open)}
          aria-label="Menu"
          aria-expanded={open}
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-slate-100 bg-white">
          <nav className="container-app py-3 flex flex-col gap-1">
            <NavLink to="/" end className={navLinkClass} onClick={() => setOpen(false)}>Accueil</NavLink>
            <NavLink to="/reserver" className={navLinkClass} onClick={() => setOpen(false)}>Réserver</NavLink>
            <NavLink to="/infos-pratiques" className={navLinkClass} onClick={() => setOpen(false)}>Infos pratiques</NavLink>
            {user && <NavLink to="/compte" className={navLinkClass} onClick={() => setOpen(false)}>Mon espace</NavLink>}
            {hasRole('admin', 'manager') && (
              <NavLink to="/admin" className={navLinkClass} onClick={() => setOpen(false)}>Admin</NavLink>
            )}
            {hasRole('staff', 'admin', 'manager') && (
              <NavLink to="/staff" className={navLinkClass} onClick={() => setOpen(false)}>Scan</NavLink>
            )}
            <div className="border-t border-slate-100 mt-2 pt-2 flex flex-col gap-2">
              {user ? (
                <button onClick={handleSignOut} className="btn-secondary justify-start">
                  <LogOut className="w-4 h-4" /> Se déconnecter
                </button>
              ) : (
                <Link to="/connexion" onClick={() => setOpen(false)} className="btn-secondary justify-start">
                  Se connecter
                </Link>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
