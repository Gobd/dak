import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./stores/auth-store";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Home } from "./pages/Home";
import { Shots } from "./pages/Shots";
import { Courses } from "./pages/Courses";
import { AsNeeded } from "./pages/AsNeeded";
import { People } from "./pages/People";
import { useEffect } from "react";
import { useRealtimeSync } from "./hooks/useRealtimeSync";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuthStore();

  // Subscribe to realtime sync when logged in
  useRealtimeSync(session?.user?.id);

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
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/shots" element={<Shots />} />
                <Route path="/medicine" element={<Courses />} />
                <Route path="/prn" element={<AsNeeded />} />
                <Route path="/people" element={<People />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
