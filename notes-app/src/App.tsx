import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth-store';
import { useThemeStore } from './stores/theme-store';
import { useEffect } from 'react';

// Pages
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { SetPassword } from './pages/SetPassword';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { Dashboard } from './pages/Dashboard';
import { Settings } from './pages/Settings';
import { Trash } from './pages/Trash';
import { About } from './pages/About';
import { ToastContainer } from './components/ui/toast';
import { LoadingSpinner } from './components/ui/loading-spinner';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, isInitialized } = useAuthStore();

  if (!isInitialized) {
    return <LoadingSpinner fullScreen />;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { session, isInitialized } = useAuthStore();

  if (!isInitialized) {
    return <LoadingSpinner fullScreen />;
  }

  // If logged in, redirect to dashboard
  if (session) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const { initialize } = useAuthStore();
  const { dark } = useThemeStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Apply dark mode class
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  return (
    <>
      <Routes>
        {/* Auth routes (accessible when not logged in) */}
        <Route
          path="/login"
          element={
            <AuthRoute>
              <Login />
            </AuthRoute>
          }
        />
        <Route
          path="/register"
          element={
            <AuthRoute>
              <Register />
            </AuthRoute>
          }
        />
        <Route path="/set-password" element={<SetPassword />} />
        <Route
          path="/forgot-password"
          element={
            <AuthRoute>
              <ForgotPassword />
            </AuthRoute>
          }
        />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Protected routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/trash"
          element={
            <ProtectedRoute>
              <Trash />
            </ProtectedRoute>
          }
        />
        <Route
          path="/about"
          element={
            <ProtectedRoute>
              <About />
            </ProtectedRoute>
          }
        />

        {/* Catch all - redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastContainer />
    </>
  );
}
