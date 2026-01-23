import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/auth-store';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

export function ForgotPassword() {
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
      <div className="min-h-screen flex items-center justify-center px-6 bg-surface">
        <div className="w-full max-w-sm">
          <h1 className="text-3xl font-bold text-center mb-4 text-text">Check your email</h1>
          <p className="text-center mb-8 text-text-muted">
            We sent a password reset link to
            <br />
            <span className="font-medium text-text">{email}</span>
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
    <div className="min-h-screen flex items-center justify-center px-6 bg-surface">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-center mb-2 text-text">Forgot Password</h1>
        <p className="text-center mb-8 text-text-muted">Enter your email to receive a reset link</p>

        <div className="mb-6">
          <Input
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            type="email"
            autoComplete="email"
            error={error}
            onKeyDown={(e) => e.key === 'Enter' && handleSendReset()}
          />
        </div>

        <div className="mb-4">
          <Button onClick={handleSendReset} loading={isLoading} className="w-full">
            Send Reset Link
          </Button>
        </div>

        <p className="text-center">
          <Link to="/login" className="font-medium text-accent">
            Back to Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
