import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/auth-store';
import { useThemeColors } from '../hooks/useThemeColors';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

export function Register() {
  const colors = useThemeColors();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const { register, isLoading } = useAuthStore();

  const handleRegister = async () => {
    setError('');

    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email');
      return;
    }

    try {
      await register(email.trim().toLowerCase());
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    }
  };

  if (success) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-6"
        style={{ backgroundColor: colors.bg }}
      >
        <div className="w-full max-w-sm">
          <h1 className="text-3xl font-bold text-center mb-4" style={{ color: colors.text }}>
            Check your email
          </h1>
          <p className="text-center mb-8" style={{ color: colors.textMuted }}>
            We sent a verification link to
            <br />
            <span className="font-medium" style={{ color: colors.text }}>
              {email}
            </span>
          </p>
          <p className="text-center text-sm" style={{ color: colors.textTertiary }}>
            Click the link in the email to verify your account and set your password.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ backgroundColor: colors.bg }}
    >
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-center mb-2" style={{ color: colors.text }}>
          Create Account
        </h1>
        <p className="text-center mb-8" style={{ color: colors.textMuted }}>
          Enter your email to get started
        </p>

        <div className="mb-6">
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            type="email"
            autoComplete="email"
            error={error}
            onSubmitEditing={handleRegister}
          />
        </div>

        <div className="mb-4">
          <Button onPress={handleRegister} loading={isLoading} className="w-full">
            Create Account
          </Button>
        </div>

        <p className="text-center" style={{ color: colors.textMuted }}>
          Already have an account?{' '}
          <Link to="/login" className="font-medium" style={{ color: colors.primary }}>
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
