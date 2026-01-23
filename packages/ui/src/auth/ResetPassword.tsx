import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import type { AuthState } from './auth-store';

interface ResetPasswordProps {
  appName: string;
  useAuthStore: () => AuthState;
  useThemeStore: () => { dark: boolean; toggle: () => void };
}

export function ResetPassword({ appName, useAuthStore, useThemeStore }: ResetPasswordProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const { updatePassword } = useAuthStore();
  const { dark, toggle } = useThemeStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    const { error } = await updatePassword(password);

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
      setTimeout(() => navigate('/'), 2000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4">
      <button
        onClick={toggle}
        className="absolute top-4 right-4 p-2 rounded-lg text-text-secondary hover:bg-surface-sunken"
      >
        {dark ? <Sun size={20} /> : <Moon size={20} />}
      </button>
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-8 text-text">{appName}</h1>
        {success ? (
          <div className="bg-surface rounded-xl shadow-sm p-6 text-center">
            <h2 className="text-lg font-semibold text-text mb-2">Password Updated</h2>
            <p className="text-text-secondary text-text-muted mb-4">
              Redirecting you to the app...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-surface rounded-xl shadow-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold text-text text-center">Set New Password</h2>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                New Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-surface-sunken text-text focus:outline-none focus:ring-2 focus:ring-accent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-surface-sunken text-text focus:outline-none focus:ring-2 focus:ring-accent"
                required
              />
            </div>
            {error && <div className="text-danger text-sm">{error}</div>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent text-text py-2 rounded-lg font-medium hover:bg-accent-hover disabled:opacity-50"
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
            <p className="text-center text-sm text-text-secondary text-text-muted">
              <Link to="/login" className="text-accent hover:text-accent-hover font-medium">
                Back to Sign In
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
