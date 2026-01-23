import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth-store';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { LoadingSpinner } from '../components/ui/loading-spinner';
import { PasswordRequirements } from '../components/ui/password-requirements';
import { isPasswordValid } from '../lib/password-validation';

export function SetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const { setPassword: updatePassword, isLoading, user, isInitialized } = useAuthStore();
  const confirmPasswordRef = useRef<HTMLInputElement>(null);

  // Redirect if no active session (user must come from email verification link)
  useEffect(() => {
    if (isInitialized && !user) {
      navigate('/login', { replace: true });
    }
  }, [isInitialized, user, navigate]);

  // Show loading while checking session
  if (!isInitialized || !user) {
    return <LoadingSpinner fullScreen />;
  }

  const handleSetPassword = async () => {
    setError('');

    if (!password) {
      setError('Please enter a password');
      return;
    }

    if (!isPasswordValid(password)) {
      setError('Password does not meet requirements');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      await updatePassword(password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set password');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-surface">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-center mb-2 text-text">Set Your Password</h1>
        <p className="text-center mb-8 text-text-muted">
          Choose a strong password for your account
        </p>

        <div className="mb-4">
          <Input
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            type="password"
            autoComplete="new-password"
            onKeyDown={(e) => e.key === 'Enter' && confirmPasswordRef.current?.focus()}
          />
          <PasswordRequirements password={password} />
        </div>

        <div className="mb-6">
          <Input
            ref={confirmPasswordRef}
            label="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm your password"
            type="password"
            autoComplete="new-password"
            error={error}
            onKeyDown={(e) => e.key === 'Enter' && handleSetPassword()}
          />
        </div>

        <Button onClick={handleSetPassword} loading={isLoading} className="w-full">
          Set Password
        </Button>
      </div>
    </div>
  );
}
