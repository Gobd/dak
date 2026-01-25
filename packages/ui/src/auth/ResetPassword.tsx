import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import type { AuthState } from './auth-store';
import { Input } from '../components/Input';
import { Button } from '../components/Button';

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
  const confirmRef = useRef<HTMLInputElement>(null);

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
            <p className="text-text-muted mb-4">Redirecting you to the app...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-surface rounded-xl shadow-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold text-text text-center">Set New Password</h2>
            <Input
              label="New Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              onKeyDown={(e) => e.key === 'Enter' && confirmRef.current?.focus()}
            />
            <Input
              ref={confirmRef}
              label="Confirm Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              error={error}
              required
            />
            <Button type="submit" loading={loading} className="w-full">
              Update Password
            </Button>
            <p className="text-center text-sm text-text-muted">
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
