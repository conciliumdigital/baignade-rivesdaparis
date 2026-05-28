import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Menu, X, LogOut, User as UserIcon, ShieldCheck, ScanLine } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../lib/auth';

export function Header() {
  const [open, setOpen] = useState(false);
  const { user, profile, signOut, hasRole } = useAuth();
  const navigate = useNavigate();
  const burgerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `link-underline relative px-1.5 py-2 text-sm transition-colors min-h-[44px] inline-flex items-center ${
      isActive ? 'text-brand-700 font-semibold' : 'text-slate-600 font-medium hover:text-slate-900'
    }`;

  const navLinkClassMobile = ({ isActive }: { isActive: boolean }) =>
    `block px-2 py-3 text-base min-h-[44px] transition-colors ${
      isActive ? 'text-brand-700 font-semibold' : 'text-slate-700 font-medium hover:text-slate-900'
    }`;

  async function handleSignOut() {
    await signOut();
    setOpen(false);
    navigate('/');
  }

  // Fermeture mobile : Esc + clic en dehors + restitution focus sur le burger
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        burgerRef.current?.focus();
      }
    }
    function onClickOutside(e: MouseEvent) {
      if (!panelRef.current) return;
      if (panelRef.current.contains(e.target as Node)) return;
      if (burgerRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-40 bg-white/85 backdrop-blur border-b border-slate-100" role="banner">
      {/* Skip-link déjà fourni par PublicLayout */}
      <div className="w-full px-6 lg:px-10 flex items-center justify-between h-16">
        <Link to="/" className="flex items-center gap-2.5 group min-w-0" aria-label="Accueil — Baignade Rives d'Paris">
          <div className="w-9 h-9 rounded-lg bg-brand-800 flex items-center justify-center transition-transform group-hover:-translate-y-0.5 flex-shrink-0">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="currentColor" aria-hidden="true">
              <path d="M2 17c2 0 2-1 4-1s2 1 4 1 2-1 4-1 2 1 4 1 2-1 4-1v3c-2 0-2-1-4-1s-2 1-4 1-2-1-4-1-2 1-4 1-2-1-4-1v-2zM2 12c2 0 2-1 4-1s2 1 4 1 2-1 4-1 2 1 4 1 2-1 4-1v3c-2 0-2-1-4-1s-2 1-4 1-2-1-4-1-2 1-4 1-2-1-4-1v-2z" />
            </svg>
          </div>
          <div className="leading-tight min-w-0">
            <div className="font-display font-semibold text-slate-900 text-[17px] truncate max-w-[200px] sm:max-w-none">Baignade Rives d&apos;Paris</div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500 mt-0.5 hidden sm:block">Ville de Neuilly-sur-Marne</div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1" aria-label="Navigation principale">
          <NavLink to="/" end className={navLinkClass}>Accueil</NavLink>
          <NavLink to="/reserver" className={navLinkClass}>Réserver</NavLink>
          <NavLink to="/infos-pratiques" className={navLinkClass}>Infos pratiques</NavLink>
          {user && <NavLink to="/compte" className={navLinkClass}>Mon espace</NavLink>}
          {hasRole('admin', 'manager') && (
            <NavLink to="/admin" className={navLinkClass}>
              <span className="inline-flex items-center gap-1"><ShieldCheck className="w-4 h-4" aria-hidden="true" />Administration</span>
            </NavLink>
          )}
          {hasRole('staff', 'admin', 'manager') && (
            <NavLink to="/staff" className={navLinkClass}>
              <span className="inline-flex items-center gap-1"><ScanLine className="w-4 h-4" aria-hidden="true" />Scan</span>
            </NavLink>
          )}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          {user ? (
            <>
              <Link to="/compte" className="btn-ghost text-sm" title={profile?.email ?? user.email ?? ''}>
                <UserIcon className="w-4 h-4" aria-hidden="true" />
                <span className="max-w-[160px] truncate">{profile?.first_name || profile?.email || user.email}</span>
              </Link>
              <button onClick={handleSignOut} className="btn-secondary text-sm" aria-label="Se déconnecter">
                <LogOut className="w-4 h-4" aria-hidden="true" />
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
          ref={burgerRef}
          className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-lg hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          onClick={() => setOpen(!open)}
          aria-label={open ? 'Fermer le menu de navigation' : 'Ouvrir le menu de navigation'}
          aria-expanded={open}
          aria-controls="mobile-nav"
        >
          {open ? <X className="w-5 h-5" aria-hidden="true" /> : <Menu className="w-5 h-5" aria-hidden="true" />}
        </button>
      </div>

      {open && (
        <div
          id="mobile-nav"
          ref={panelRef}
          className="md:hidden border-t border-slate-100 bg-white shadow-md"
        >
          <nav className="w-full px-6 lg:px-10 py-3 flex flex-col gap-1" aria-label="Navigation principale">
            <NavLink to="/" end className={navLinkClassMobile} onClick={() => setOpen(false)}>Accueil</NavLink>
            <NavLink to="/reserver" className={navLinkClassMobile} onClick={() => setOpen(false)}>Réserver</NavLink>
            <NavLink to="/infos-pratiques" className={navLinkClassMobile} onClick={() => setOpen(false)}>Infos pratiques</NavLink>
            {user && <NavLink to="/compte" className={navLinkClassMobile} onClick={() => setOpen(false)}>Mon espace</NavLink>}
            {hasRole('admin', 'manager') && (
              <NavLink to="/admin" className={navLinkClassMobile} onClick={() => setOpen(false)}>Administration</NavLink>
            )}
            {hasRole('staff', 'admin', 'manager') && (
              <NavLink to="/staff" className={navLinkClassMobile} onClick={() => setOpen(false)}>Scan</NavLink>
            )}
            <div className="border-t border-slate-100 mt-2 pt-2 flex flex-col gap-2">
              {user ? (
                <button onClick={handleSignOut} className="btn-secondary justify-start min-h-[44px]">
                  <LogOut className="w-4 h-4" aria-hidden="true" /> Se déconnecter
                </button>
              ) : (
                <Link to="/connexion" onClick={() => setOpen(false)} className="btn-secondary justify-start min-h-[44px]">
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
