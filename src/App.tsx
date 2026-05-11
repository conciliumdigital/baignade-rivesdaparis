import { Routes, Route, Navigate } from 'react-router-dom';
import { PublicLayout } from './layouts/PublicLayout';
import { AdminLayout } from './layouts/AdminLayout';
import { RequireAuth } from './components/RequireAuth';

import { HomePage } from './pages/HomePage';
import { ReservationPage } from './pages/ReservationPage';
import { ReservationDetailPage } from './pages/ReservationDetailPage';
import { ConfirmationPage } from './pages/ConfirmationPage';
import { LoginPage } from './pages/LoginPage';
import { InfosPage } from './pages/InfosPage';
import { CguPage, PrivacyPage, MentionsLegalesPage, AccessibilityPage } from './pages/LegalPages';
import { AccountPage } from './pages/AccountPage';
import { ProfilePage } from './pages/ProfilePage';
import { UserReservationDetailPage } from './pages/UserReservationDetailPage';

import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminSlots } from './pages/admin/AdminSlots';
import { AdminReservations } from './pages/admin/AdminReservations';
import { AdminCommunication } from './pages/admin/AdminCommunication';
import { AdminSatisfaction } from './pages/admin/AdminSatisfaction';
import { AdminStaff } from './pages/admin/AdminStaff';
import { AdminSettings } from './pages/admin/AdminSettings';

import { StaffScanner } from './pages/staff/StaffScanner';
import { StaffHistory } from './pages/staff/StaffHistory';

function NotFoundPage() {
  return (
    <div className="container-app py-20 text-center">
      <h1 className="text-5xl font-display font-extrabold text-brand-700 mb-2">404</h1>
      <p className="text-slate-600 mb-6">Cette page n'existe pas.</p>
      <a href="/" className="btn-primary">Retour à l'accueil</a>
    </div>
  );
}

function EmailSentPage() {
  return (
    <div className="container-app py-20 text-center max-w-md">
      <div className="text-5xl mb-4">📬</div>
      <h1 className="text-2xl font-display font-bold mb-2">Vérifiez votre email</h1>
      <p className="text-slate-600 text-sm">Un lien de connexion vous a été envoyé. Cliquez dessus pour finaliser votre réservation.</p>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Espace public */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/reserver" element={<ReservationPage />} />
        <Route path="/reserver/:slotId" element={<ReservationDetailPage />} />
        <Route path="/reserver/confirmation/:reservationId" element={<ConfirmationPage />} />
        <Route path="/connexion" element={<LoginPage />} />
        <Route path="/connexion/email-envoye" element={<EmailSentPage />} />
        <Route path="/infos-pratiques" element={<InfosPage />} />
        <Route path="/cgu" element={<CguPage />} />
        <Route path="/confidentialite" element={<PrivacyPage />} />
        <Route path="/mentions-legales" element={<MentionsLegalesPage />} />
        <Route path="/accessibilite" element={<AccessibilityPage />} />

        {/* Espace utilisateur */}
        <Route path="/compte" element={<RequireAuth><AccountPage /></RequireAuth>} />
        <Route path="/compte/profil" element={<RequireAuth><ProfilePage /></RequireAuth>} />
        <Route path="/compte/reservation/:id" element={<RequireAuth><UserReservationDetailPage /></RequireAuth>} />

        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* Back-office admin */}
      <Route element={<RequireAuth roles={['admin', 'manager']}><AdminLayout /></RequireAuth>}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/creneaux" element={<AdminSlots />} />
        <Route path="/admin/reservations" element={<AdminReservations />} />
        <Route path="/admin/communication" element={<AdminCommunication />} />
        <Route path="/admin/satisfaction" element={<AdminSatisfaction />} />
        <Route path="/admin/staff" element={<AdminStaff />} />
        <Route path="/admin/parametres" element={<AdminSettings />} />
      </Route>

      {/* Staff scan QR */}
      <Route path="/staff" element={<RequireAuth roles={['admin', 'manager', 'staff']}><StaffScanner /></RequireAuth>} />
      <Route path="/staff/historique" element={<RequireAuth roles={['admin', 'manager', 'staff']}><StaffHistory /></RequireAuth>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
