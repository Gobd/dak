interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50">
      <div className="w-full max-w-[340px] rounded-xl p-5 shadow-lg bg-zinc-100 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold mb-2 text-zinc-950 dark:text-white">{title}</h2>
        <p className="text-sm leading-5 mb-5 text-zinc-500">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-lg font-medium transition-opacity hover:opacity-80 bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-3 rounded-lg font-medium text-white transition-opacity hover:opacity-80 ${
              destructive ? 'bg-red-500' : 'bg-amber-500 dark:bg-amber-400 text-black'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
