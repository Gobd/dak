interface ConfirmModalProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  confirmClassName?: string;
}

export function ConfirmModal({
  message,
  onConfirm,
  onCancel,
  confirmText = "Delete",
  confirmClassName,
}: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 w-full max-w-sm">
        <p className="text-lg mb-6">{message}</p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-700 dark:text-neutral-300"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={
              confirmClassName ??
              "flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
            }
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
