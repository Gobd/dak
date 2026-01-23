import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Syringe, Pill, Clock, Users, LogOut, Moon, Sun, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../stores/auth-store';
import { useThemeStore } from '../stores/theme-store';
import { ConfirmModal } from '@dak/ui';

const navItems = [
  { to: '/shots', icon: Syringe, label: 'Shots' },
  { to: '/medicine', icon: Pill, label: 'Courses' },
  { to: '/prn', icon: Clock, label: 'As-Needed' },
  { to: '/people', icon: Users, label: 'People' },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { signOut } = useAuthStore();
  const { dark, toggle } = useThemeStore();
  const [showSignOutModal, setShowSignOutModal] = useState(false);

  return (
    <div className="min-h-screen bg-surface">
      <nav className="bg-surface border-b border-border px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-1">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-100 text-blue-700 bg-surface-raised text-text'
                    : 'text-text-secondary hover:bg-surface-sunken'
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
                      ? 'bg-blue-100 text-blue-700 bg-surface-raised text-text'
                      : 'text-text-secondary hover:bg-surface-sunken'
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
              className="p-2 rounded-lg text-text-secondary hover:bg-surface-sunken"
              title="Reload"
            >
              <RefreshCw size={18} />
            </button>
            <button
              onClick={toggle}
              className="p-2 rounded-lg text-text-secondary hover:bg-surface-sunken"
              title={dark ? 'Light mode' : 'Dark mode'}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              onClick={() => setShowSignOutModal(true)}
              className="p-2 rounded-lg text-text-secondary hover:bg-surface-sunken"
              title="Sign Out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </nav>
      <main className="max-w-4xl mx-auto p-4">{children}</main>
      <ConfirmModal
        open={showSignOutModal}
        message="Are you sure you want to sign out?"
        confirmText="Sign Out"
        variant="primary"
        onConfirm={signOut}
        onClose={() => setShowSignOutModal(false)}
      />
    </div>
  );
}
