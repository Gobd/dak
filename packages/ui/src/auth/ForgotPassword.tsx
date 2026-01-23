import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import type { AuthState } from './auth-store';

interface ForgotPasswordProps {
  appName: string;
  useAuthStore: () => AuthState;
  useThemeStore: () => { dark: boolean; toggle: () => void };
}

export function ForgotPassword({ appName, useAuthStore, useThemeStore }: ForgotPasswordProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const { resetPassword } = useAuthStore();
  const { dark, toggle } = useThemeStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await resetPassword(email);

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
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
            <h2 className="text-lg font-semibold text-text mb-2">Check your email</h2>
            <p className="text-text-secondary text-text-muted mb-4">
              We sent a password reset link to {email}
            </p>
            <Link to="/login" className="text-accent hover:text-accent-hover font-medium">
              Back to Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-surface rounded-xl shadow-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold text-text text-center">Reset Password</h2>
            <p className="text-sm text-text-secondary text-text-muted text-center">
              Enter your email and we'll send you a reset link
            </p>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
              {loading ? 'Sending...' : 'Send Reset Link'}
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
