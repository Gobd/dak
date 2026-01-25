import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import type { AuthState } from './auth-store';
import { Input } from '../components/Input';
import { Button } from '../components/Button';

interface LoginProps {
  appName: string;
  useAuthStore: () => AuthState;
  useThemeStore: () => { dark: boolean; toggle: () => void };
}

export function Login({ appName, useAuthStore, useThemeStore }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuthStore();
  const { dark, toggle } = useThemeStore();
  const navigate = useNavigate();
  const passwordRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4">
      <div className="w-full max-w-xs">
        <h1 className="text-2xl font-bold text-center mb-8 text-text">{appName}</h1>
        <form onSubmit={handleSubmit} className="bg-surface rounded-xl shadow-sm p-6 space-y-4">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            onKeyDown={(e) => e.key === 'Enter' && passwordRef.current?.focus()}
          />
          <Input
            ref={passwordRef}
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            error={error}
            required
          />
          <Button type="submit" loading={loading} className="w-full">
            Sign In
          </Button>
          <div className="flex justify-between text-sm">
            <Link to="/signup" className="text-accent hover:text-accent-hover font-medium">
              Create Account
            </Link>
            <Link to="/forgot-password" className="text-accent hover:text-accent-hover font-medium">
              Forgot Password?
            </Link>
          </div>
        </form>
        <Button variant="ghost" size="icon" onClick={toggle} className="mt-6 mx-auto">
          {dark ? <Sun size={20} /> : <Moon size={20} />}
        </Button>
      </div>
    </div>
  );
}
