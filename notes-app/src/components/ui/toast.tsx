import { X, Check, TriangleAlert } from 'lucide-react';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useToastStore, type ToastType } from '../../stores/toast-store';
import type { LucideIcon } from 'lucide-react';

const icons: Record<ToastType, LucideIcon> = {
  success: Check,
  error: TriangleAlert,
  info: Check,
};

export function ToastContainer() {
  const colors = useThemeColors();
  const { toasts, hideToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-[60px] right-4 flex flex-col items-end z-[9999] pointer-events-none">
      {toasts.map((toast) => {
        const Icon = icons[toast.type];
        const iconColor =
          toast.type === 'success'
            ? colors.success || '#22c55e'
            : toast.type === 'error'
              ? colors.error
              : colors.info || '#3b82f6';

        return (
          <div
            key={toast.id}
            className="flex items-center rounded-lg py-3 px-4 mb-2 max-w-[360px] min-w-[200px] shadow-lg pointer-events-auto"
            style={{
              backgroundColor: colors.bgSecondary,
              borderLeftWidth: 3,
              borderLeftColor: iconColor,
            }}
          >
            <Icon size={18} color={iconColor} className="mr-2.5 flex-shrink-0" />
            <span className="flex-1 text-sm" style={{ color: colors.text }}>
              {toast.message}
            </span>
            <button
              onClick={() => hideToast(toast.id)}
              className="p-1 ml-2 hover:opacity-70 transition-opacity"
            >
              <X size={16} color={colors.iconMuted} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
