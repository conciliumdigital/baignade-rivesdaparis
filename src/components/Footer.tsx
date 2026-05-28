import { Link } from 'react-router-dom';
import { APP_VERSION } from '../version';

export function Footer() {
  return (
    <footer className="mt-auto bg-slate-900 text-slate-300" role="contentinfo">
      <div className="container-app py-12 grid gap-8 md:grid-cols-4">
        <div className="space-y-3">
          <div className="font-display font-bold text-white text-lg">Baignade Rives d&apos;Paris</div>
          <p className="text-sm text-slate-400 leading-relaxed">
            Service municipal de réservation de la zone de baignade estivale, aménagée par la Commune de Neuilly-sur-Marne.
          </p>
        </div>

        <div>
          <h2 className="font-semibold mb-3 text-sm uppercase tracking-wide" style={{ color: '#F5C111' }}>Réserver</h2>
          <ul className="space-y-2 text-sm">
            <li><Link to="/reserver" className="hover:text-white transition">Voir les créneaux</Link></li>
            <li><Link to="/infos-pratiques" className="hover:text-white transition">Informations pratiques</Link></li>
            <li><Link to="/compte" className="hover:text-white transition">Mon espace</Link></li>
          </ul>
        </div>

        <div>
          <h2 className="font-semibold mb-3 text-sm uppercase tracking-wide" style={{ color: '#F5C111' }}>Cadre légal</h2>
          <ul className="space-y-2 text-sm">
            <li><Link to="/cgu" className="hover:text-white transition">Conditions générales d&apos;utilisation</Link></li>
            <li><Link to="/confidentialite" className="hover:text-white transition">Politique de confidentialité</Link></li>
            <li><Link to="/mentions-legales" className="hover:text-white transition">Mentions légales</Link></li>
            <li><Link to="/accessibilite" className="hover:text-white transition">Accessibilité : non conforme</Link></li>
          </ul>
        </div>

        <div>
          <h2 className="font-semibold mb-3 text-sm uppercase tracking-wide" style={{ color: '#F5C111' }}>Contact</h2>
          <address className="not-italic">
            <ul className="space-y-2 text-sm text-slate-400">
              <li>Mairie de Neuilly-sur-Marne</li>
              <li>Place Ferdinand Buisson</li>
              <li>93330 Neuilly-sur-Marne</li>
              <li><a href="mailto:baignade@neuillysurmarne.fr" className="hover:text-white transition">baignade@neuillysurmarne.fr</a></li>
            </ul>
          </address>
        </div>
      </div>

      <div className="border-t border-slate-800">
        <div className="container-app py-5 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <span>© {new Date().getFullYear()} Commune de Neuilly-sur-Marne — Tous droits réservés.</span>
          <span>Réalisé par CONCILIUM · v{APP_VERSION}</span>
        </div>
      </div>
    </footer>
  );
}
