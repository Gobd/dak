import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/auth-store';
import { useThemeColors } from '../hooks/useThemeColors';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

export function ForgotPassword() {
  const colors = useThemeColors();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const { sendPasswordReset, isLoading } = useAuthStore();

  const handleSendReset = async () => {
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
      await sendPasswordReset(email.trim().toLowerCase());
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset link');
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
            We sent a password reset link to
            <br />
            <span className="font-medium" style={{ color: colors.text }}>
              {email}
            </span>
          </p>
          <Link to="/login">
            <Button variant="secondary" className="w-full">
              Back to Sign In
            </Button>
          </Link>
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
          Forgot Password
        </h1>
        <p className="text-center mb-8" style={{ color: colors.textMuted }}>
          Enter your email to receive a reset link
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
            onSubmitEditing={handleSendReset}
          />
        </div>

        <div className="mb-4">
          <Button onPress={handleSendReset} loading={isLoading} className="w-full">
            Send Reset Link
          </Button>
        </div>

        <p className="text-center" style={{ color: colors.primary }}>
          <Link to="/login" className="font-medium">
            Back to Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
