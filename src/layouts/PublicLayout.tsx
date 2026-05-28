import { Outlet } from 'react-router-dom';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { CookieBanner } from '../components/CookieBanner';
import { InaugurationBanner } from '../components/InaugurationBanner';

export function PublicLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main" className="skip-link">Aller au contenu principal</a>
      <InaugurationBanner />
      <Header />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <CookieBanner />
    </div>
  );
}
