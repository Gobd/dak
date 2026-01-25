import { Routes, Route } from 'react-router-dom';
import { useAuthStore } from './stores/auth-store';
import { ProtectedRoute } from '@dak/ui';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { SignUp } from './pages/SignUp';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { Home } from './pages/Home';
import { Shots } from './pages/Shots';
import { Courses } from './pages/Courses';
import { AsNeeded } from './pages/AsNeeded';
import { People } from './pages/People';
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
                  <Route path="/shots" element={<Shots />} />
                  <Route path="/medicine" element={<Courses />} />
                  <Route path="/prn" element={<AsNeeded />} />
                  <Route path="/people" element={<People />} />
                </Routes>
              </Layout>
            </AuthenticatedApp>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
