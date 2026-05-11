import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import type { UserRole } from '../types/database';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  roles?: UserRole[];
}

export function RequireAuth({ children, roles }: Props) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="container-app py-20 text-center text-slate-500">
        <div className="inline-block w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/connexion" state={{ from: location.pathname }} replace />;
  }

  if (roles && roles.length > 0 && profile && !roles.includes(profile.role)) {
    return (
      <div className="container-app py-20 text-center">
        <h1 className="text-2xl font-display font-bold mb-2">Accès refusé</h1>
        <p className="text-slate-600">Vous n'avez pas les droits nécessaires pour accéder à cette page.</p>
      </div>
    );
  }

  return <>{children}</>;
}
