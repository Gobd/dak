import { Routes, Route } from 'react-router-dom';
import { useAuthStore } from './stores/auth-store';
import { ProtectedRoute } from '@dak/ui';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { SignUp } from './pages/SignUp';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { Home } from './pages/Home';
import { History } from './pages/History';
import { Stats } from './pages/Stats';
import { Settings } from './pages/Settings';
import { useEffect } from 'react';
import { useRealtimeSync } from './hooks/useRealtimeSync';

function AuthenticatedApp({ children }: { children: React.ReactNode }) {
  const { session } = useAuthStore();

  // Subscribe to realtime sync when logged in
  useRealtimeSync(session?.user?.id);

  return <>{children}</>;
}

export default function App() {
  const { initialize, session, loading } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute session={session} loading={loading}>
            <AuthenticatedApp>
              <Layout>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/history" element={<History />} />
                  <Route path="/stats" element={<Stats />} />
                  <Route path="/settings" element={<Settings />} />
                </Routes>
              </Layout>
            </AuthenticatedApp>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
