import { useState } from 'react';
import { Lock, RefreshCw, Eye, EyeOff, BookOpen } from 'lucide-react';
import { Modal } from '@dak/ui';
import { useSettingsStore } from '../../stores/settings-store';
import { useInstancesStore } from '../../stores/instances-store';

interface SettingsModalProps {
  onClose: () => void;
  onShowWalkthrough?: () => void;
}

export function SettingsModal({ onClose, onShowWalkthrough }: SettingsModalProps) {
  const { settings, setPin, setHidePoints } = useSettingsStore();
  const { ensureTodayInstances } = useInstancesStore();
  const [showPinChange, setShowPinChange] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const handleChangePin = async () => {
    if (newPin.length < 4) {
      setPinError('PIN must be at least 4 digits');
      return;
    }
    if (newPin !== confirmPin) {
      setPinError('PINs do not match');
      return;
    }

    await setPin(newPin);
    setShowPinChange(false);
    setNewPin('');
    setConfirmPin('');
    setPinError('');
  };

  const handleRefreshTasks = async () => {
    setRefreshing(true);
    await ensureTodayInstances();
    setRefreshing(false);
  };

  return (
    <Modal open={true} onClose={onClose} title="Settings">
      <div className="space-y-4">
        {/* PIN Section */}
        <div className="bg-gray-50 dark:bg-neutral-800 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <Lock size={20} className="text-gray-500" />
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">Parent PIN</h3>
              <p className="text-sm text-gray-500 dark:text-neutral-400">
                {settings?.parent_pin ? 'PIN is set' : 'No PIN set'}
              </p>
            </div>
          </div>

          {showPinChange ? (
            <div className="space-y-3">
              <input
                type="password"
                value={newPin}
                onChange={(e) => {
                  setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6));
                  setPinError('');
                }}
                placeholder="New PIN (4-6 digits)"
                className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 dark:text-white"
                inputMode="numeric"
              />
              <input
                type="password"
                value={confirmPin}
                onChange={(e) => {
                  setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6));
                  setPinError('');
                }}
                placeholder="Confirm PIN"
                className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 dark:text-white"
                inputMode="numeric"
              />
              {pinError && <p className="text-red-600 text-sm">{pinError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowPinChange(false);
                    setNewPin('');
                    setConfirmPin('');
                    setPinError('');
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleChangePin}
                  className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-lg"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowPinChange(true)}
              className="w-full px-3 py-2 bg-white dark:bg-neutral-700 border border-gray-300 dark:border-neutral-600 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-600"
            >
              {settings?.parent_pin ? 'Change PIN' : 'Set PIN'}
            </button>
          )}
        </div>

        {/* Hide Points */}
        <div className="bg-gray-50 dark:bg-neutral-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {settings?.hide_points ? (
                <EyeOff size={20} className="text-gray-500" />
              ) : (
                <Eye size={20} className="text-gray-500" />
              )}
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">Hide Points</h3>
                <p className="text-sm text-gray-500 dark:text-neutral-400">
                  Hide all points, leaderboard, and rewards
                </p>
              </div>
            </div>
            <button
              onClick={() => setHidePoints(!settings?.hide_points)}
              className={`relative w-12 h-7 rounded-full transition-colors ${
                settings?.hide_points ? 'bg-blue-600' : 'bg-gray-300 dark:bg-neutral-600'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                  settings?.hide_points ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>
        </div>

        {/* Refresh Tasks */}
        <div className="bg-gray-50 dark:bg-neutral-800 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <RefreshCw size={20} className="text-gray-500" />
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">Refresh Tasks</h3>
              <p className="text-sm text-gray-500 dark:text-neutral-400">
                Regenerate today's task list
              </p>
            </div>
          </div>
          <button
            onClick={handleRefreshTasks}
            disabled={refreshing}
            className="w-full px-3 py-2 bg-white dark:bg-neutral-700 border border-gray-300 dark:border-neutral-600 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-600 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh Now'}
          </button>
        </div>

        {/* Review Walkthrough */}
        {onShowWalkthrough && (
          <div className="bg-gray-50 dark:bg-neutral-800 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <BookOpen size={20} className="text-gray-500" />
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">Review Walkthrough</h3>
                <p className="text-sm text-gray-500 dark:text-neutral-400">
                  Learn about chores, habits, and goals
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                onClose();
                onShowWalkthrough();
              }}
              className="w-full px-3 py-2 bg-white dark:bg-neutral-700 border border-gray-300 dark:border-neutral-600 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-600 flex items-center justify-center gap-2"
            >
              <BookOpen size={16} />
              Show Walkthrough
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
