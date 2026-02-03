import { Routes, Route } from 'react-router-dom';
import { useAuthStore } from './stores/auth-store';
import { ProtectedRoute, ToastContainer } from '@dak/ui';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { SignUp } from './pages/SignUp';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { Home } from './pages/Home';
import { AddRecipePage } from './pages/AddRecipePage';
import { RecipePage } from './pages/RecipePage';
import { TagsPage } from './pages/TagsPage';
import { DeweyAdminPage } from './pages/DeweyAdminPage';
import { useEffect } from 'react';

function AuthenticatedApp({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export default function App() {
  const { initialize, session, loading } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <>
      <ToastContainer />
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
                    <Route path="/add" element={<AddRecipePage />} />
                    <Route path="/recipe/:id" element={<RecipePage />} />
                    <Route path="/tags" element={<TagsPage />} />
                    <Route path="/dewey-admin" element={<DeweyAdminPage />} />
                  </Routes>
                </Layout>
              </AuthenticatedApp>
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  );
}
