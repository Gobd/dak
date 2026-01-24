import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { create } from 'zustand';

export interface Toast {
  id: string;
  message: string;
  variant?: 'default' | 'success' | 'error' | 'warning';
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
  show: (toast: Omit<Toast, 'id'>) => string;
  dismiss: (id: string) => void;
}

/**
 * Creates a toast store for managing toast notifications.
 * Each app should create its own store instance.
 */
export function createToastStore() {
  return create<ToastState>((set) => ({
    toasts: [],
    show: (toast) => {
      const id = Math.random().toString(36).slice(2, 9);
      set((state) => ({
        toasts: [...state.toasts, { ...toast, id }],
      }));
      return id;
    },
    dismiss: (id) => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    },
  }));
}

const variantConfig = {
  default: {
    icon: Info,
    containerClass: 'bg-surface-raised border-border',
    iconClass: 'text-text-secondary',
  },
  success: {
    icon: CheckCircle,
    containerClass: 'bg-success-light border-success/20',
    iconClass: 'text-success',
  },
  error: {
    icon: AlertCircle,
    containerClass: 'bg-danger-light border-danger/20',
    iconClass: 'text-danger',
  },
  warning: {
    icon: AlertTriangle,
    containerClass: 'bg-warning-light border-warning/20',
    iconClass: 'text-warning',
  },
} as const;

interface ToastItemProps {
  toast: Toast;
  onDismiss: () => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const config = variantConfig[toast.variant || 'default'];
  const Icon = config.icon;

  useEffect(() => {
    const duration = toast.duration ?? 4000;
    if (duration > 0) {
      const timer = setTimeout(onDismiss, duration);
      return () => clearTimeout(timer);
    }
  }, [toast.duration, onDismiss]);

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg animate-slide-up ${config.containerClass}`}
    >
      <Icon className={`w-5 h-5 shrink-0 ${config.iconClass}`} />
      <p className="flex-1 text-sm text-text">{toast.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="p-1 rounded text-text-muted hover:text-text hover:bg-surface-sunken transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

/**
 * Toast container that renders toasts in a portal.
 * Position is fixed to bottom-right of viewport.
 */
export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return createPortal(
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
      ))}
    </div>,
    document.body,
  );
}
