import { Modal } from './Modal';
import { Button } from './Button';

interface AlertModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  message: string;
}

/**
 * Alert dialog - replaces browser alert()
 */
export function AlertModal({ open, onClose, title = 'Alert', message }: AlertModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      actions={
        <Button onClick={onClose} variant="primary">
          OK
        </Button>
      }
    >
      <p>{message}</p>
    </Modal>
  );
}
