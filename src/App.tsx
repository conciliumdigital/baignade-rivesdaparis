import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { PublicLayout } from './layouts/PublicLayout';
import { RequireAuth } from './components/RequireAuth';

// Chemin public critique : chargé immédiatement
import { HomePage } from './pages/HomePage';
import { ReservationPage } from './pages/ReservationPage';
import { LoginPage } from './pages/LoginPage';

// Le reste est code-splitté (le scanner QR / zxing et tout l'admin ne
// sont plus dans le bundle initial d'un visiteur public).
const named = <T extends Record<string, unknown>, K extends keyof T>(
  factory: () => Promise<T>,
  key: K,
) => lazy(() => factory().then((m) => ({ default: m[key] as React.ComponentType })));

const ReservationDetailPage = named(() => import('./pages/ReservationDetailPage'), 'ReservationDetailPage');
const ConfirmationPage = named(() => import('./pages/ConfirmationPage'), 'ConfirmationPage');
const InfosPage = named(() => import('./pages/InfosPage'), 'InfosPage');
const CguPage = named(() => import('./pages/LegalPages'), 'CguPage');
const PrivacyPage = named(() => import('./pages/LegalPages'), 'PrivacyPage');
const MentionsLegalesPage = named(() => import('./pages/LegalPages'), 'MentionsLegalesPage');
const AccessibilityPage = named(() => import('./pages/LegalPages'), 'AccessibilityPage');
const AccountPage = named(() => import('./pages/AccountPage'), 'AccountPage');
const ProfilePage = named(() => import('./pages/ProfilePage'), 'ProfilePage');
const UserReservationDetailPage = named(() => import('./pages/UserReservationDetailPage'), 'UserReservationDetailPage');

const AdminLayout = named(() => import('./layouts/AdminLayout'), 'AdminLayout');
const AdminDashboard = named(() => import('./pages/admin/AdminDashboard'), 'AdminDashboard');
const AdminSlots = named(() => import('./pages/admin/AdminSlots'), 'AdminSlots');
const AdminReservations = named(() => import('./pages/admin/AdminReservations'), 'AdminReservations');
const AdminCommunication = named(() => import('./pages/admin/AdminCommunication'), 'AdminCommunication');
const AdminSatisfaction = named(() => import('./pages/admin/AdminSatisfaction'), 'AdminSatisfaction');
const AdminStaff = named(() => import('./pages/admin/AdminStaff'), 'AdminStaff');
const AdminSettings = named(() => import('./pages/admin/AdminSettings'), 'AdminSettings');
const AdminHelp = named(() => import('./pages/admin/AdminHelp'), 'AdminHelp');
const AdminEmailTemplates = named(() => import('./pages/admin/AdminEmailTemplates'), 'AdminEmailTemplates');
const AdminDiscounts = named(() => import('./pages/admin/AdminDiscounts'), 'AdminDiscounts');

const StaffScanner = named(() => import('./pages/staff/StaffScanner'), 'StaffScanner');
const StaffHistory = named(() => import('./pages/staff/StaffHistory'), 'StaffHistory');

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

function RouteFallback() {
  return (
    <div className="container-app py-24 flex justify-center" aria-busy="true" aria-live="polite">
      <div className="h-8 w-8 rounded-full border-2 border-brand-200 border-t-brand-600 animate-spin" />
      <span className="sr-only">Chargement…</span>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
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
          <Route path="/admin/emails" element={<AdminEmailTemplates />} />
          <Route path="/admin/reductions" element={<AdminDiscounts />} />
          <Route path="/admin/parametres" element={<AdminSettings />} />
          <Route path="/admin/aide" element={<AdminHelp />} />
        </Route>

        {/* Staff scan QR */}
        <Route path="/staff" element={<RequireAuth roles={['admin', 'manager', 'staff']}><StaffScanner /></RequireAuth>} />
        <Route path="/staff/historique" element={<RequireAuth roles={['admin', 'manager', 'staff']}><StaffHistory /></RequireAuth>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
