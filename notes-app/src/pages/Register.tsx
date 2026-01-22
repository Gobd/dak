import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/auth-store';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

export function Register() {
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
      <div className="min-h-screen flex items-center justify-center px-6 bg-white dark:bg-zinc-950">
        <div className="w-full max-w-sm">
          <h1 className="text-3xl font-bold text-center mb-4 text-zinc-950 dark:text-white">
            Check your email
          </h1>
          <p className="text-center mb-8 text-zinc-500">
            We sent a verification link to
            <br />
            <span className="font-medium text-zinc-950 dark:text-white">{email}</span>
          </p>
          <p className="text-center text-sm text-zinc-500">
            Click the link in the email to verify your account and set your password.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-white dark:bg-zinc-950">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-center mb-2 text-zinc-950 dark:text-white">
          Create Account
        </h1>
        <p className="text-center mb-8 text-zinc-500">Enter your email to get started</p>

        <div className="mb-6">
          <Input
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            type="email"
            autoComplete="email"
            error={error}
            onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
          />
        </div>

        <div className="mb-4">
          <Button onClick={handleRegister} loading={isLoading} className="w-full">
            Create Account
          </Button>
        </div>

        <p className="text-center text-zinc-500">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-amber-500 dark:text-amber-400">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
