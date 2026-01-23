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
      <div className="w-full max-w-[340px] rounded-xl p-5 shadow-lg bg-surface-raised">
        <h2 className="text-lg font-semibold mb-2 text-text">{title}</h2>
        <p className="text-sm leading-5 mb-5 text-text-muted">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-lg font-medium transition-opacity hover:opacity-80 bg-surface-sunken text-text"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-3 rounded-lg font-medium text-text transition-opacity hover:opacity-80 ${
              destructive ? 'bg-danger' : 'bg-warning text-black'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
