import { NavLink, Outlet, Link } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, ClipboardList, Mail, Star, Users2, Settings, ArrowLeft } from 'lucide-react';
import { Footer } from '../components/Footer';

export function AdminLayout() {
  const itemClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
      isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="container-app h-14 flex items-center justify-between">
          <Link to="/" className="text-sm text-slate-600 hover:text-slate-900 inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Retour au site
          </Link>
          <span className="font-display font-bold">Back-office Baignade</span>
          <span />
        </div>
      </header>

      <div className="container-app flex flex-1 gap-6 py-6">
        <aside className="w-60 flex-shrink-0 hidden md:block">
          <nav className="card p-3 sticky top-6 space-y-1">
            <NavLink end to="/admin" className={itemClass}><LayoutDashboard className="w-4 h-4" /> Tableau de bord</NavLink>
            <NavLink to="/admin/creneaux" className={itemClass}><CalendarDays className="w-4 h-4" /> Créneaux</NavLink>
            <NavLink to="/admin/reservations" className={itemClass}><ClipboardList className="w-4 h-4" /> Réservations</NavLink>
            <NavLink to="/admin/communication" className={itemClass}><Mail className="w-4 h-4" /> Communication</NavLink>
            <NavLink to="/admin/satisfaction" className={itemClass}><Star className="w-4 h-4" /> Satisfaction</NavLink>
            <NavLink to="/admin/staff" className={itemClass}><Users2 className="w-4 h-4" /> Équipe</NavLink>
            <NavLink to="/admin/parametres" className={itemClass}><Settings className="w-4 h-4" /> Paramètres</NavLink>
          </nav>
        </aside>

        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>

      <Footer />
    </div>
  );
}
