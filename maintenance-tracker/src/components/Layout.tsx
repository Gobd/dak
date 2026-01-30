import { Link } from 'react-router-dom';
import { Wrench, LogOut } from 'lucide-react';
import { useAuthStore } from '../stores/auth-store';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { signOut } = useAuthStore();

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Header */}
      <header className="bg-surface-raised border-b border-border px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <Wrench className="text-accent" size={24} />
          <span className="font-semibold text-lg">Maintenance</span>
        </Link>
        <button
          onClick={() => signOut()}
          className="p-2 text-text-muted hover:text-text transition-colors"
          title="Sign out"
        >
          <LogOut size={20} />
        </button>
      </header>

      {/* Main content */}
      <main className="flex-1 p-4 max-w-2xl mx-auto w-full">{children}</main>
    </div>
  );
}
