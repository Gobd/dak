import { useState, useRef, useCallback } from 'react';
import {
  fetchPlacesAutocomplete,
  fetchPlaceDetails,
  type PlacePrediction,
} from '../../hooks/useLocation';

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (details: { address: string; lat?: number; lon?: number }) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Address input with Google Places autocomplete
 */
export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'Enter address...',
  className = '',
}: AddressAutocompleteProps) {
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleChange = useCallback(
    (newValue: string) => {
      onChange(newValue);

      // Clear previous debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Clear predictions if query too short
      if (newValue.length < 2) {
        setPredictions([]);
        setShowDropdown(false);
        return;
      }

      // Fetch autocomplete predictions with debounce
      debounceRef.current = setTimeout(async () => {
        setLoading(true);
        const results = await fetchPlacesAutocomplete(newValue);
        setPredictions(results);
        setShowDropdown(results.length > 0);
        setLoading(false);
      }, 300);
    },
    [onChange]
  );

  async function handleSelectPrediction(prediction: PlacePrediction) {
    onChange(prediction.description);
    setShowDropdown(false);

    // Get place details for lat/lon if callback provided
    if (onSelect) {
      const details = await fetchPlaceDetails(prediction.placeId);
      onSelect({
        address: prediction.description,
        lat: details?.lat,
        lon: details?.lon,
      });
    }
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => predictions.length > 0 && setShowDropdown(true)}
        onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
        placeholder={placeholder}
        className={`w-full p-2 rounded bg-neutral-700 border border-neutral-600 text-white placeholder:text-neutral-400 ${className}`}
        autoComplete="off"
      />

      {/* Loading indicator */}
      {loading && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-neutral-500 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* Autocomplete dropdown */}
      {showDropdown && predictions.length > 0 && (
        <div
          className="absolute z-50 w-full mt-1 bg-neutral-800
                     border border-neutral-600 rounded-lg shadow-lg overflow-hidden"
        >
          {predictions.map((prediction) => {
            const parts = prediction.description.split(', ');
            const main = parts[0];
            const secondary = parts.slice(1).join(', ');

            return (
              <button
                key={prediction.placeId}
                type="button"
                className="w-full px-3 py-2 text-left hover:bg-neutral-700
                           transition-colors cursor-pointer"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelectPrediction(prediction)}
              >
                <span className="font-medium text-white">{main}</span>
                {secondary && (
                  <span className="text-sm text-neutral-400 ml-1">{secondary}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
