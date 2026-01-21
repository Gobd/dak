import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth-store';
import { useThemeColors } from '../hooks/useThemeColors';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

export function Login() {
  const colors = useThemeColors();
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
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ backgroundColor: colors.bg }}
    >
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-center mb-2" style={{ color: colors.text }}>
          Welcome Back
        </h1>
        <p className="text-center mb-8" style={{ color: colors.textMuted }}>
          Sign in to your account
        </p>

        <div className="mb-4">
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            type="email"
            autoComplete="email"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
        </div>

        <div className="mb-2">
          <Input
            ref={passwordRef}
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            type="password"
            autoComplete="current-password"
            error={error}
            onSubmitEditing={handleSignIn}
          />
        </div>

        <Link
          to="/forgot-password"
          className="block text-right text-sm mb-6"
          style={{ color: colors.primary }}
        >
          Forgot password?
        </Link>

        <div className="mb-4">
          <Button onPress={handleSignIn} loading={isLoading} className="w-full">
            Sign In
          </Button>
        </div>

        <p className="text-center" style={{ color: colors.textMuted }}>
          Don't have an account?{' '}
          <Link to="/register" className="font-medium" style={{ color: colors.primary }}>
            Create Account
          </Link>
        </p>
      </div>
    </div>
  );
}
