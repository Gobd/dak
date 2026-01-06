import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Home,
  Syringe,
  Pill,
  Clock,
  Users,
  LogOut,
  Moon,
  Sun,
  RefreshCw,
} from "lucide-react";
import { useAuthStore } from "../stores/auth-store";
import { useThemeStore } from "../stores/theme-store";
import { ConfirmModal } from "./ConfirmModal";

const navItems = [
  { to: "/shots", icon: Syringe, label: "Shots" },
  { to: "/medicine", icon: Pill, label: "Courses" },
  { to: "/prn", icon: Clock, label: "As-Needed" },
  { to: "/people", icon: Users, label: "People" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { signOut } = useAuthStore();
  const { dark, toggle } = useThemeStore();
  const [showSignOutModal, setShowSignOutModal] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      <nav className="bg-white dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-700 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-1">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-100 text-blue-700 dark:bg-neutral-800 dark:text-white"
                    : "text-gray-600 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-700"
                }`
              }
              title="Home"
            >
              <Home size={18} />
              <span className="hidden sm:inline">Home</span>
            </NavLink>
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-blue-100 text-blue-700 dark:bg-neutral-800 dark:text-white"
                      : "text-gray-600 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-700"
                  }`
                }
              >
                <Icon size={18} />
                <span className="hidden sm:inline">{label}</span>
              </NavLink>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => window.location.reload()}
              className="p-2 rounded-lg text-gray-600 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-700"
              title="Reload"
            >
              <RefreshCw size={18} />
            </button>
            <button
              onClick={toggle}
              className="p-2 rounded-lg text-gray-600 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-700"
              title={dark ? "Light mode" : "Dark mode"}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              onClick={() => setShowSignOutModal(true)}
              className="p-2 rounded-lg text-gray-600 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-700"
              title="Sign Out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </nav>
      <main className="max-w-4xl mx-auto p-4">{children}</main>
      {showSignOutModal && (
        <ConfirmModal
          message="Are you sure you want to sign out?"
          confirmText="Sign Out"
          confirmClassName="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          onConfirm={signOut}
          onCancel={() => setShowSignOutModal(false)}
        />
      )}
    </div>
  );
}
