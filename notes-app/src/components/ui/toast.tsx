import { X, Check, TriangleAlert } from 'lucide-react';
import { useToastStore, type ToastType } from '../../stores/toast-store';
import type { LucideIcon } from 'lucide-react';

const icons: Record<ToastType, LucideIcon> = {
  success: Check,
  error: TriangleAlert,
  info: Check,
};

const iconColors: Record<ToastType, string> = {
  success: 'text-green-500',
  error: 'text-red-500',
  info: 'text-blue-500',
};

const borderColors: Record<ToastType, string> = {
  success: 'border-l-green-500',
  error: 'border-l-red-500',
  info: 'border-l-blue-500',
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
            className={`flex items-center rounded-lg py-3 px-4 mb-2 max-w-[360px] min-w-[200px] shadow-lg pointer-events-auto bg-zinc-100 dark:bg-zinc-900 border-l-[3px] ${borderColors[toast.type]}`}
          >
            <Icon size={18} className={`mr-2.5 flex-shrink-0 ${iconColors[toast.type]}`} />
            <span className="flex-1 text-sm text-zinc-950 dark:text-white">{toast.message}</span>
            <button
              onClick={() => hideToast(toast.id)}
              className="p-1 ml-2 hover:opacity-70 transition-opacity text-zinc-500"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
