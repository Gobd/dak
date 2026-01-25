import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth-store';
import { Button, Input } from '@dak/ui';

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { signIn, isLoading } = useAuthStore();
  const passwordRef = useRef<HTMLInputElement>(null);

  const handleSignIn = async () => {
    setError('');

    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }

    if (!password) {
      setError('Please enter your password');
      return;
    }

    try {
      await signIn(email.trim().toLowerCase(), password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-surface">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-center mb-2 text-text">Welcome Back</h1>
        <p className="text-center mb-8 text-text-muted">Sign in to your account</p>

        <div className="mb-4">
          <Input
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            type="email"
            autoComplete="email"
            onKeyDown={(e) => e.key === 'Enter' && passwordRef.current?.focus()}
          />
        </div>

        <div className="mb-2">
          <Input
            ref={passwordRef}
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            type="password"
            autoComplete="current-password"
            error={error}
            onKeyDown={(e) => e.key === 'Enter' && handleSignIn()}
          />
        </div>

        <Link to="/forgot-password" className="block text-right text-sm mb-6 text-accent">
          Forgot password?
        </Link>

        <div className="mb-4">
          <Button onClick={handleSignIn} loading={isLoading} className="w-full">
            Sign In
          </Button>
        </div>

        <p className="text-center text-text-muted">
          Don't have an account?{' '}
          <Link to="/register" className="font-medium text-accent">
            Create Account
          </Link>
        </p>
      </div>
    </div>
  );
}
