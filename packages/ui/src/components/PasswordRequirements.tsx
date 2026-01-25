import { Check, X } from 'lucide-react';
import { validatePassword } from '../lib/password-validation';

interface PasswordRequirementsProps {
  password: string;
}

export function PasswordRequirements({ password }: PasswordRequirementsProps) {
  const validation = validatePassword(password);

  const requirements = [
    { met: validation.minLength, label: 'At least 8 characters' },
    { met: validation.hasLower, label: 'One lowercase letter' },
    { met: validation.hasUpper, label: 'One uppercase letter' },
    { met: validation.hasDigit, label: 'One number' },
    { met: validation.hasSymbol, label: 'One symbol' },
  ];

  return (
    <div className="mt-2 space-y-1">
      {requirements.map((req, index) => (
        <div key={index} className="flex items-center gap-1.5">
          {req.met ? (
            <Check size={14} className="text-success" />
          ) : (
            <X size={14} className="text-text-muted" />
          )}
          <span className={`text-[13px] ${req.met ? 'text-success' : 'text-text-muted'}`}>
            {req.label}
          </span>
        </div>
      ))}
    </div>
  );
}
