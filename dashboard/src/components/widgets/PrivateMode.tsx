import { useState } from 'react';
import { useToggle } from '@dak/hooks';
import { Lock, LockOpen, Settings } from 'lucide-react';
import { useConfigStore } from '../../stores/config-store';
import { usePrivateModeStore } from '../../stores/private-mode-store';
import { Modal, Button, Input, Alert } from '@dak/ui';
import type { WidgetComponentProps } from './index';

interface PrivateModeData {
  pin?: string;
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, '');
}

export default function PrivateMode({ panel }: WidgetComponentProps) {
  const widgetId = panel.id || 'private-mode';
  const data = useConfigStore((s) => s.widgetData?.[widgetId]) as PrivateModeData | undefined;
  const updateWidgetData = useConfigStore((s) => s.updateWidgetData);
  const storedPin = data?.pin;

  const isActive = usePrivateModeStore((s) => s.isActive);
  const activate = usePrivateModeStore((s) => s.activate);
  const tryUnlock = usePrivateModeStore((s) => s.tryUnlock);

  const showSetupModal = useToggle(false);
  const showUnlockModal = useToggle(false);
  const [pinInput, setPinInput] = useState('');
  const [newPin, setNewPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handlePress() {
    if (!storedPin) {
      setNewPin('');
      setError(null);
      showSetupModal.setTrue();
      return;
    }
    if (isActive) {
      setPinInput('');
      setError(null);
      showUnlockModal.setTrue();
      return;
    }
    activate();
  }

  function handleOpenChangePin() {
    setNewPin('');
    setError(null);
    showSetupModal.setTrue();
  }

  function handleSavePin() {
    if (!newPin) {
      setError('Enter a PIN');
      return;
    }
    updateWidgetData(widgetId, { pin: newPin } satisfies PrivateModeData);
    showSetupModal.setFalse();
    setNewPin('');
    setError(null);
  }

  function handleUnlock() {
    if (!storedPin || !tryUnlock(pinInput, storedPin)) {
      setError('Incorrect PIN');
      return;
    }
    showUnlockModal.setFalse();
    setPinInput('');
    setError(null);
  }

  return (
    <div className="w-full h-full flex items-center justify-center gap-0.5">
      <Button
        variant="ghost"
        size="icon"
        onClick={handlePress}
        title={isActive ? 'Private mode active - tap to unlock' : 'Enable private mode'}
      >
        {isActive ? (
          <Lock size={24} className="text-danger" />
        ) : (
          <LockOpen size={24} className="text-text-muted" />
        )}
      </Button>

      {!isActive && storedPin && (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleOpenChangePin}
          title="Change PIN"
          className="text-text-muted"
        >
          <Settings size={14} />
        </Button>
      )}

      {/* Set PIN modal (first-time setup / change PIN) */}
      <Modal
        open={showSetupModal.value}
        onClose={() => {
          showSetupModal.setFalse();
          setNewPin('');
          setError(null);
        }}
        title={storedPin ? 'Change Private Mode PIN' : 'Set Private Mode PIN'}
        actions={
          <>
            <Button onClick={() => showSetupModal.setFalse()}>Cancel</Button>
            <Button onClick={handleSavePin} variant="primary">
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-text-muted">
            This PIN unlocks the screen once private mode is enabled.
          </p>
          <Input
            label="PIN"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            value={newPin}
            onChange={(e) => setNewPin(digitsOnly(e.target.value))}
            placeholder="Numbers only"
          />
          {error && <Alert variant="error">{error}</Alert>}
        </div>
      </Modal>

      {/* Unlock modal */}
      <Modal
        open={showUnlockModal.value}
        onClose={() => {
          showUnlockModal.setFalse();
          setPinInput('');
          setError(null);
        }}
        title="Enter PIN to Unlock"
        actions={
          <>
            <Button onClick={() => showUnlockModal.setFalse()}>Cancel</Button>
            <Button onClick={handleUnlock} variant="primary">
              Unlock
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="PIN"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            value={pinInput}
            onChange={(e) => setPinInput(digitsOnly(e.target.value))}
            placeholder="Numbers only"
            autoFocus
          />
          {error && <Alert variant="error">{error}</Alert>}
        </div>
      </Modal>
    </div>
  );
}
