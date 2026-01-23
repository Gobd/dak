import { useEffect, useRef, useCallback, useState, type ReactNode, type MouseEvent } from 'react';
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

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Reusable modal component
 * Uses React Portal to render at document.body level (escapes overflow-hidden parents)
 * Draggable by the title bar
 */
export function Modal({ open, onClose, title, children, actions, wide, fit }: ModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Drag state
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const dragStartRef = useRef<{
    startX: number;
    startY: number;
    posX: number;
    posY: number;
  } | null>(null);

  // Reset position when modal opens
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset drag position on open; this derived state pattern is valid per React docs
      setPosition(null);
    }
  }, [open]);

  // Store onClose in ref to avoid stale closure in event handler
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Focus trap: cycle through focusable elements
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCloseRef.current();
      return;
    }

    if (e.key !== 'Tab' || !contentRef.current) return;

    const focusableElements = contentRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault();
      lastElement.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault();
      firstElement.focus();
    }
  }, []);

  // Handle escape key and focus trap
  useEffect(() => {
    if (!open) return;

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, handleKeyDown]);

  // Focus management: focus first element on open, restore focus on close
  useEffect(() => {
    if (open) {
      previousActiveElement.current = document.activeElement as HTMLElement;

      // Delay focus to allow modal to render
      requestAnimationFrame(() => {
        if (contentRef.current) {
          const firstFocusable = contentRef.current.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
          firstFocusable?.focus();
        }
      });
    } else if (previousActiveElement.current) {
      previousActiveElement.current.focus();
      previousActiveElement.current = null;
    }
  }, [open]);

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

  // Drag handlers
  const handleDragStart = useCallback(
    (e: MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      dragStartRef.current = {
        startX: clientX,
        startY: clientY,
        posX: position?.x ?? 0,
        posY: position?.y ?? 0,
      };
    },
    [position],
  );

  useEffect(() => {
    if (!open) return;

    const handleMove = (e: globalThis.MouseEvent | TouchEvent) => {
      if (!dragStartRef.current) return;

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      const deltaX = clientX - dragStartRef.current.startX;
      const deltaY = clientY - dragStartRef.current.startY;

      setPosition({
        x: dragStartRef.current.posX + deltaX,
        y: dragStartRef.current.posY + deltaY,
      });
    };

    const handleEnd = () => {
      dragStartRef.current = null;
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleMove);
    document.addEventListener('touchend', handleEnd);

    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [open]);

  if (!open) return null;

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  const positionStyle = position
    ? { transform: `translate(${position.x}px, ${position.y}px)` }
    : {};

  // Use portal to render at document body level - fixes positioning issues
  // when modal is inside a container with overflow-hidden or transforms
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      <div
        ref={contentRef}
        className={`bg-white dark:bg-black rounded-xl shadow-2xl animate-slide-up ${
          fit ? '' : wide ? 'max-w-2xl w-full' : 'max-w-md w-full'
        } max-h-[90vh] overflow-hidden flex flex-col`}
        style={positionStyle}
      >
        {/* Draggable header */}
        <div
          className="px-6 pt-6 pb-4 cursor-move select-none shrink-0"
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
        >
          {title && (
            <h3 id="modal-title" className="text-lg font-semibold text-neutral-900 dark:text-white">
              {title}
            </h3>
          )}
        </div>

        {/* Scrollable content */}
        <div className="px-6 pb-6 overflow-y-auto custom-scrollbar flex-1">
          <div className="text-neutral-700 dark:text-neutral-300">{children}</div>
          {actions && <div className="flex justify-end gap-2 mt-6">{actions}</div>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
