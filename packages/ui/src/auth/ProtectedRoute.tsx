import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { Spinner } from '../components/Spinner';

interface ProtectedRouteProps {
  /** Current session from auth store */
  session: Session | null;
  /** Whether auth is still loading */
  loading: boolean;
  /** Route to redirect to when not authenticated */
  loginPath?: string;
  /** Children to render when authenticated */
  children: ReactNode;
  /** Optional custom loading component */
  loadingComponent?: ReactNode;
}

/**
 * Protects routes by requiring authentication.
 * Redirects to login page if not authenticated.
 *
 * @example
 * function App() {
 *   const { session, loading } = useAuthStore();
 *
 *   return (
 *     <ProtectedRoute session={session} loading={loading}>
 *       <Dashboard />
 *     </ProtectedRoute>
 *   );
 * }
 */
export function ProtectedRoute({
  session,
  loading,
  loginPath = '/login',
  children,
  loadingComponent,
}: ProtectedRouteProps) {
  if (loading) {
    return (
      loadingComponent ?? (
        <div className="min-h-screen flex items-center justify-center bg-surface">
          <Spinner size="lg" />
        </div>
      )
    );
  }

  if (!session) {
    return <Navigate to={loginPath} replace />;
  }

  return <>{children}</>;
}
