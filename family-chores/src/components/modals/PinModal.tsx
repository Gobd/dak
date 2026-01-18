import { useState } from 'react';
import { Delete } from 'lucide-react';
import { Modal } from '@dak/ui';
import { useSettingsStore } from '../../stores/settings-store';

interface PinModalProps {
  onSuccess: () => void;
  onCancel: () => void;
  mode?: 'verify' | 'set';
}

export function PinModal({ onSuccess, onCancel, mode = 'verify' }: PinModalProps) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [error, setError] = useState('');
  const { verifyPin, setPin: savePin, settings } = useSettingsStore();

  const isSettingNewPin = mode === 'set' || !settings?.parent_pin;

  const handleDigit = (digit: string) => {
    setError('');
    if (step === 'enter') {
      if (pin.length < 6) {
        const newPin = pin + digit;
        setPin(newPin);

        // Auto-verify on 4+ digits for existing PIN
        if (!isSettingNewPin && newPin.length >= 4) {
          if (verifyPin(newPin)) {
            onSuccess();
          } else if (newPin.length === 6) {
            setError('Incorrect PIN');
            setPin('');
          }
        }
      }
    } else {
      if (confirmPin.length < 6) {
        setConfirmPin(confirmPin + digit);
      }
    }
  };

  const handleBackspace = () => {
    if (step === 'enter') {
      setPin(pin.slice(0, -1));
    } else {
      setConfirmPin(confirmPin.slice(0, -1));
    }
    setError('');
  };

  const handleSubmit = async () => {
    if (isSettingNewPin) {
      if (step === 'enter') {
        if (pin.length >= 4) {
          setStep('confirm');
        } else {
          setError('PIN must be at least 4 digits');
        }
      } else {
        if (pin === confirmPin) {
          await savePin(pin);
          onSuccess();
        } else {
          setError('PINs do not match');
          setConfirmPin('');
        }
      }
    } else {
      if (verifyPin(pin)) {
        onSuccess();
      } else {
        setError('Incorrect PIN');
        setPin('');
      }
    }
  };

  const currentPin = step === 'enter' ? pin : confirmPin;

  return (
    <Modal
      open={true}
      onClose={onCancel}
      title={isSettingNewPin ? (step === 'enter' ? 'Set PIN' : 'Confirm PIN') : 'Enter PIN'}
      actions={
        <button
          onClick={handleSubmit}
          disabled={currentPin.length < 4}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSettingNewPin ? (step === 'enter' ? 'Continue' : 'Set PIN') : 'Unlock'}
        </button>
      }
    >
      {/* PIN display */}
      <div className="flex justify-center gap-3 mb-6">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full ${
              i < currentPin.length ? 'bg-blue-600' : 'bg-gray-200 dark:bg-neutral-700'
            }`}
          />
        ))}
      </div>

      {error && <p className="text-red-600 text-sm text-center mb-4">{error}</p>}

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'].map((key) => {
          if (key === '') {
            return <div key="empty" />;
          }

          if (key === 'back') {
            return (
              <button
                key="back"
                onClick={handleBackspace}
                className="h-16 rounded-xl bg-gray-100 dark:bg-neutral-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-neutral-700"
              >
                <Delete size={24} />
              </button>
            );
          }

          return (
            <button
              key={key}
              onClick={() => handleDigit(key)}
              className="h-16 rounded-xl bg-gray-100 dark:bg-neutral-800 text-2xl font-semibold hover:bg-gray-200 dark:hover:bg-neutral-700"
            >
              {key}
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
