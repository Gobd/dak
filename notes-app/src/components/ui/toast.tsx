import { X, Check, TriangleAlert } from 'lucide-react';
import { Button } from '@dak/ui';
import { useToastStore, type ToastType } from '../../stores/toast-store';
import type { LucideIcon } from 'lucide-react';

const icons: Record<ToastType, LucideIcon> = {
  success: Check,
  error: TriangleAlert,
  info: Check,
};

const iconColors: Record<ToastType, string> = {
  success: 'text-success',
  error: 'text-danger',
  info: 'text-accent',
};

const borderColors: Record<ToastType, string> = {
  success: 'border-l-success',
  error: 'border-l-danger',
  info: 'border-l-accent',
};

export function ToastContainer() {
  const { toasts, hideToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-[60px] right-4 flex flex-col items-end z-[9999] pointer-events-none">
      {toasts.map((toast) => {
        const Icon = icons[toast.type];

        return (
          <div
            key={toast.id}
            className={`flex items-center rounded-lg py-3 px-4 mb-2 max-w-[360px] min-w-[200px] shadow-lg pointer-events-auto bg-surface-sunken border-l-[3px] ${borderColors[toast.type]}`}
          >
            <Icon size={18} className={`mr-2.5 flex-shrink-0 ${iconColors[toast.type]}`} />
            <span className="flex-1 text-sm text-text">{toast.message}</span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => hideToast(toast.id)}
              className="ml-2 text-text-muted"
            >
              <X size={16} />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
