import { type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';
import { Button } from './Button';

type AlertVariant = 'error' | 'warning' | 'success' | 'info';

interface AlertProps {
  children: ReactNode;
  variant?: AlertVariant;
  icon?: boolean;
  onDismiss?: () => void;
  className?: string;
}

const variantConfig = {
  error: {
    bg: 'bg-danger/20',
    text: 'text-danger',
    Icon: AlertCircle,
  },
  warning: {
    bg: 'bg-warning/20',
    text: 'text-warning',
    Icon: AlertTriangle,
  },
  success: {
    bg: 'bg-success/20',
    text: 'text-success',
    Icon: CheckCircle2,
  },
  info: {
    bg: 'bg-accent/20',
    text: 'text-accent',
    Icon: Info,
  },
};

export function Alert({
  children,
  variant = 'error',
  icon = true,
  onDismiss,
  className = '',
}: AlertProps) {
  const config = variantConfig[variant];
  const Icon = config.Icon;

  return (
    <div
      className={`p-2 rounded text-sm flex items-center gap-2 ${config.bg} ${config.text} ${className}`}
      role="alert"
    >
      {icon && <Icon size={14} className="flex-shrink-0" />}
      <span className="flex-1">{children}</span>
      {onDismiss && (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onDismiss}
          className={`flex-shrink-0 ${config.text} hover:opacity-70`}
        >
          <X size={14} />
        </Button>
      )}
    </div>
  );
}
