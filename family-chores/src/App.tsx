import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth-store';
import { Login } from './Login';
import { SignUp } from './SignUp';
import { ForgotPassword } from './ForgotPassword';
import { ResetPassword } from './ResetPassword';
import { Dashboard } from './Dashboard';
import { useEffect } from 'react';
import { useRealtimeSync } from './hooks/useRealtimeSync';
import { useMembersStore } from './stores/members-store';
import { useChoresStore } from './stores/chores-store';
import { useInstancesStore } from './stores/instances-store';
import { usePointsStore } from './stores/points-store';
import { useSettingsStore } from './stores/settings-store';
import { useGoalsStore } from './stores/goals-store';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuthStore();

  // Subscribe to realtime sync when logged in
  useRealtimeSync(session?.user?.id);

  // Fetch initial data when logged in
  useEffect(() => {
    if (session) {
      useMembersStore.getState().fetchMembers();
      useChoresStore.getState().fetchChores();
      usePointsStore.getState().fetchBalances();
      usePointsStore.getState().fetchPeriodPoints('week');
      useSettingsStore.getState().fetchSettings();

      // Ensure today's instances exist and fetch them
      // Also fetch goal progress after chores are loaded
      setTimeout(() => {
        useInstancesStore.getState().ensureTodayInstances();
        useGoalsStore.getState().fetchGoalProgress();
      }, 500);
    }
  }, [session]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const { initialize } = useAuthStore();

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
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
