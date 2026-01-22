import { useState, useCallback, useMemo } from 'react';
import { useConfigStore } from '../stores/config-store';
import type { LocationConfig } from '../types';

// Geocoding API (Cloudflare Functions)
const isLocalDev =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const APP_URL = import.meta.env.VITE_APP_URL || 'https://dak.bkemper.me';
const MAPS_API_BASE = isLocalDev ? `${APP_URL}/api/maps` : '/api/maps';

export interface PlacePrediction {
  description: string;
  placeId: string;
}

interface PlaceDetails {
  lat: number;
  lon: number;
  city?: string;
  state?: string;
}

/**
 * Fetch Google Places autocomplete suggestions
 */
export async function fetchPlacesAutocomplete(input: string): Promise<PlacePrediction[]> {
  if (!input || input.length < 2) return [];

  try {
    const params = new URLSearchParams({ input });
    const response = await fetch(`${MAPS_API_BASE}/places-autocomplete?${params}`);
    if (!response.ok) return [];
    const data = await response.json();
    return data.predictions || [];
  } catch {
    return [];
  }
}

/**
 * Fetch place details (city, state, lat, lon) from placeId
 */
export async function fetchPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  try {
    const params = new URLSearchParams({ placeId });
    const response = await fetch(`${MAPS_API_BASE}/place-details?${params}`);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Hook for managing widget location
 * Location comes from: stored config > panel args > globalSettings.defaultLocation > legacy defaultLocation
 * No browser geolocation - user must configure via settings modal
 */
export function useLocation(widgetId: string, defaultLat?: number, defaultLon?: number) {
  // Subscribe to the specific location from store (re-renders when it changes)
  const storedLocation = useConfigStore((s) => s.locations?.[widgetId]);
  const configDefaultLocation = useConfigStore(
    (s) => s.globalSettings?.defaultLocation ?? s.defaultLocation
  );
  const updateLocation = useConfigStore((s) => s.updateLocation);

  const [localLocation, setLocalLocation] = useState<LocationConfig | null>(null);

  // Derive effective location: stored > local > args > globalSettings.defaultLocation
  const argsLocation = useMemo(
    (): LocationConfig | null =>
      defaultLat !== undefined && defaultLon !== undefined
        ? { lat: defaultLat, lon: defaultLon }
        : null,
    [defaultLat, defaultLon]
  );
  // configDefaultLocation comes from globalSettings.defaultLocation (loaded from public/config/dashboard.json)
  const location = storedLocation ?? localLocation ?? argsLocation ?? configDefaultLocation!;

  // Update location manually
  const setLocation = useCallback(
    (newLocation: LocationConfig) => {
      setLocalLocation(newLocation);
      updateLocation(widgetId, newLocation);
    },
    [widgetId, updateLocation]
  );

  return {
    location,
    setLocation,
  };
}

/**
 * Format location for display
 */
export function formatLocation(city?: string, state?: string): string {
  if (city && state) return `${city}, ${state}`;
  if (city) return city;
  if (state) return state;
  return 'Unknown location';
}
