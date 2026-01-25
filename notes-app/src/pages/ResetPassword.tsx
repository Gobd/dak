import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth-store';
import { Button, Input, PasswordRequirements, isPasswordValid } from '@dak/ui';

export function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const { resetPassword, isLoading } = useAuthStore();
  const confirmPasswordRef = useRef<HTMLInputElement>(null);

  const handleResetPassword = async () => {
    setError('');

    if (!password) {
      setError('Please enter a new password');
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
      await resetPassword(password);
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-surface">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-center mb-2 text-text">Reset Password</h1>
        <p className="text-center mb-8 text-text-muted">Enter your new password</p>

        <div className="mb-4">
          <Input
            label="New Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter new password"
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
            onKeyDown={(e) => e.key === 'Enter' && handleResetPassword()}
          />
        </div>

        <Button onClick={handleResetPassword} loading={isLoading} className="w-full">
          Reset Password
        </Button>
      </div>
    </div>
  );
}
