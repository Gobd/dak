import { useState } from 'react';
import { Modal, Button } from './Modal';
import { AddressAutocomplete } from './AddressAutocomplete';
import type { LocationConfig } from '../../types';
import { formatLocation } from '../../hooks/useLocation';

interface LocationSettingsModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (location: LocationConfig) => void;
  currentLocation?: LocationConfig | null;
}

/**
 * Location settings modal - used by weather, sun-moon, etc.
 * Features Google Places autocomplete for address input.
 */
export function LocationSettingsModal({
  open,
  onClose,
  onSave,
  currentLocation,
}: LocationSettingsModalProps) {
  const [query, setQuery] = useState(currentLocation?.query ?? '');
  const [pendingLocation, setPendingLocation] = useState<{
    lat?: number;
    lon?: number;
    address: string;
  } | null>(null);
  const [status, setStatus] = useState<{
    type: 'idle' | 'loading' | 'error';
    message?: string;
  }>({ type: 'idle' });

  function handleSelect(details: { address: string; lat?: number; lon?: number }) {
    setPendingLocation(details);
    setStatus({ type: 'idle' });
  }

  function handleSave() {
    if (!pendingLocation?.lat || !pendingLocation?.lon) {
      setStatus({ type: 'error', message: 'Please select a location from the suggestions.' });
      return;
    }

    // Parse city/state from address
    const parts = pendingLocation.address.split(', ');
    let city = parts[0];
    let state = '';

    // Try to find state code (2-letter)
    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i].trim();
      const stateMatch = part.match(/^([A-Z]{2})(?:\s+\d{5})?$/);
      if (stateMatch) {
        state = stateMatch[1];
        if (i > 0) city = parts[i - 1].trim();
        break;
      }
    }

    onSave({
      lat: pendingLocation.lat,
      lon: pendingLocation.lon,
      city,
      state,
      query: pendingLocation.address,
    });
    onClose();
  }

  const currentDisplay = currentLocation
    ? formatLocation(currentLocation.city, currentLocation.state)
    : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Set Location"
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} variant="primary" disabled={status.type === 'loading'}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Enter a city, address, or ZIP code:
        </p>

        <AddressAutocomplete
          value={query}
          onChange={setQuery}
          onSelect={handleSelect}
          placeholder="e.g., San Francisco, CA"
          className="bg-neutral-100 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-600 text-neutral-900 dark:text-white"
        />

        {currentDisplay && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Current: {currentDisplay}
          </p>
        )}

        {pendingLocation && (
          <p className="text-sm text-green-500">
            Selected: {pendingLocation.address}
          </p>
        )}

        {status.message && (
          <p
            className={`text-sm ${
              status.type === 'error' ? 'text-red-500' : 'text-neutral-500 dark:text-neutral-400'
            }`}
          >
            {status.message}
          </p>
        )}
      </div>
    </Modal>
  );
}
