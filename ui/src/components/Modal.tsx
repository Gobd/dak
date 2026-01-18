import { useEffect, useRef, type ReactNode, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  actions?: ReactNode;
  wide?: boolean;
  fit?: boolean; // If true, modal fits content instead of stretching to max-width
}

/**
 * Reusable modal component
 * Uses React Portal to render at document.body level (escapes overflow-hidden parents)
 */
export function Modal({ open, onClose, title, children, actions, wide, fit }: ModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  // Handle escape key
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  // Use portal to render at document body level - fixes positioning issues
  // when modal is inside a container with overflow-hidden or transforms
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in"
      onClick={handleBackdropClick}
    >
      <div
        ref={contentRef}
        className={`bg-white dark:bg-black rounded-xl p-6 shadow-2xl animate-slide-up ${
          fit ? '' : wide ? 'max-w-2xl w-full' : 'max-w-md w-full'
        } max-h-[90vh] overflow-y-auto custom-scrollbar`}
      >
        {title && (
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">{title}</h3>
        )}
        <div className="text-neutral-700 dark:text-neutral-300">{children}</div>
        {actions && <div className="flex justify-end gap-2 mt-6">{actions}</div>}
      </div>
    </div>,
    document.body
  );
}
