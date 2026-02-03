import { Link, useLocation } from 'react-router-dom';
import { Search, Plus, Tags, FolderTree, LogOut, Sun, Moon } from 'lucide-react';
import { Button } from '@dak/ui';
import { useAuthStore } from '../stores/auth-store';
import { useThemeStore } from '../stores/theme-store';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { signOut } = useAuthStore();
  const { dark, toggle } = useThemeStore();

  const navItems = [
    { path: '/', label: 'Search', icon: Search },
    { path: '/add', label: 'Add', icon: Plus },
    { path: '/tags', label: 'Tags', icon: Tags },
    { path: '/dewey-admin', label: 'Dewey', icon: FolderTree },
  ];

  return (
    <div className="min-h-screen bg-surface">
      <nav className="bg-surface-raised border-b border-border sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-accent/10 text-accent'
                        : 'text-text-secondary hover:bg-surface-sunken hover:text-text'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggle}
                title={dark ? 'Light mode' : 'Dark mode'}
              >
                {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => signOut()} title="Sign out">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  );
}
