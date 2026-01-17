// Shared location utilities for weather widgets
// Uses Google Places API for autocomplete, Nominatim for geocoding

import { getDashboardConfig, updateConfigSection } from './script.js';

const LOCATION_CACHE_KEY = 'location-cache';
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days (coordinates don't change)
// API endpoints - use production URL when running locally since CF Functions aren't available
const isLocalDev =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE = isLocalDev ? 'https://dak.bkemper.me/api/maps' : '/api/maps';

// Default location (San Francisco, CA)
const DEFAULT_LOCATION = {
  lat: '37.7749',
  lon: '-122.4194',
  city: 'San Francisco',
  state: 'CA',
};

/**
 * Get location config for a widget
 * Falls back to default if not configured
 */
export function getLocationConfig(widgetId = 'default') {
  try {
    const dashboardConfig = getDashboardConfig();
    const locations = dashboardConfig?.locations || {};
    return locations[widgetId] || locations.default || null;
  } catch {
    return null;
  }
}

/**
 * Save location config for a widget
 */
export async function saveLocationConfig(widgetId, config) {
  try {
    const dashboardConfig = getDashboardConfig();
    const locations = { ...(dashboardConfig?.locations || {}) };
    locations[widgetId] = config;
    await updateConfigSection('locations', locations);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Get cached geocode result
 */
function getCachedGeocode(query) {
  try {
    const cache = JSON.parse(localStorage.getItem(LOCATION_CACHE_KEY) || '{}');
    const entry = cache[query.toLowerCase()];
    if (entry && Date.now() - entry.timestamp < CACHE_DURATION) {
      return entry.data;
    }
  } catch {
    // Ignore cache read errors
  }
  return null;
}

/**
 * Cache geocode result
 */
function cacheGeocode(query, data) {
  try {
    const cache = JSON.parse(localStorage.getItem(LOCATION_CACHE_KEY) || '{}');
    cache[query.toLowerCase()] = { data, timestamp: Date.now() };
    localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore cache write errors
  }
}

/**
 * Forward geocode: city/state or zipcode → lat/lon
 */
export async function geocodeAddress(query) {
  const cached = getCachedGeocode(query);
  if (cached) return cached;

  try {
    // Nominatim wants a User-Agent
    const encodedQuery = encodeURIComponent(query);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&countrycodes=us&limit=1&q=${encodedQuery}`,
      {
        headers: {
          'User-Agent': 'Dashboard (bkemper.me)',
        },
      }
    );

    if (!res.ok) throw new Error('Geocode failed');

    const data = await res.json();
    if (!data.length) return null;

    const result = {
      lat: data[0].lat,
      lon: data[0].lon,
      displayName: data[0].display_name,
    };

    // Parse city/state from display_name
    const parsed = parseDisplayName(data[0].display_name);
    result.city = parsed.city;
    result.state = parsed.state;

    cacheGeocode(query, result);
    return result;
  } catch (err) {
    console.error('Geocode error:', err);
    return null;
  }
}

/**
 * Reverse geocode: lat/lon → city/state
 */
export async function reverseGeocode(lat, lon) {
  const cacheKey = `${lat},${lon}`;
  const cached = getCachedGeocode(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
      {
        headers: {
          'User-Agent': 'Dashboard (bkemper.me)',
        },
      }
    );

    if (!res.ok) throw new Error('Reverse geocode failed');

    const data = await res.json();
    const address = data.address || {};

    const result = {
      city:
        address.city || address.town || address.village || address.hamlet || address.county || '',
      state: address.state || '',
      stateCode: getStateCode(address.state),
      displayName: data.display_name,
    };

    cacheGeocode(cacheKey, result);
    return result;
  } catch (err) {
    console.error('Reverse geocode error:', err);
    return null;
  }
}

/**
 * Parse display name to extract city/state
 * Format is usually: "City, County, State, Zipcode, Country"
 */
function parseDisplayName(displayName) {
  const parts = displayName.split(', ');
  // Usually: City, County, State, Zip, USA
  return {
    city: parts[0] || '',
    state: parts.length >= 3 ? getStateCode(parts[parts.length - 3]) : '',
  };
}

/**
 * US state name to abbreviation
 */
const STATE_ABBREVS = {
  alabama: 'AL',
  alaska: 'AK',
  arizona: 'AZ',
  arkansas: 'AR',
  california: 'CA',
  colorado: 'CO',
  connecticut: 'CT',
  delaware: 'DE',
  florida: 'FL',
  georgia: 'GA',
  hawaii: 'HI',
  idaho: 'ID',
  illinois: 'IL',
  indiana: 'IN',
  iowa: 'IA',
  kansas: 'KS',
  kentucky: 'KY',
  louisiana: 'LA',
  maine: 'ME',
  maryland: 'MD',
  massachusetts: 'MA',
  michigan: 'MI',
  minnesota: 'MN',
  mississippi: 'MS',
  missouri: 'MO',
  montana: 'MT',
  nebraska: 'NE',
  nevada: 'NV',
  'new hampshire': 'NH',
  'new jersey': 'NJ',
  'new mexico': 'NM',
  'new york': 'NY',
  'north carolina': 'NC',
  'north dakota': 'ND',
  ohio: 'OH',
  oklahoma: 'OK',
  oregon: 'OR',
  pennsylvania: 'PA',
  'rhode island': 'RI',
  'south carolina': 'SC',
  'south dakota': 'SD',
  tennessee: 'TN',
  texas: 'TX',
  utah: 'UT',
  vermont: 'VT',
  virginia: 'VA',
  washington: 'WA',
  'west virginia': 'WV',
  wisconsin: 'WI',
  wyoming: 'WY',
  'district of columbia': 'DC',
};

function getStateCode(stateName) {
  if (!stateName) return '';
  // Already an abbreviation
  if (stateName.length === 2 && stateName.toUpperCase() === stateName) {
    return stateName;
  }
  return STATE_ABBREVS[stateName.toLowerCase()] || stateName;
}

/**
 * Get location for widget - checks config, geocodes if needed, falls back to default
 * Returns { lat, lon, city, state }
 */
export async function getWidgetLocation(widgetId, argsLat, argsLon) {
  // First check localStorage config for this widget
  const config = getLocationConfig(widgetId);

  if (config) {
    // If config has lat/lon, use it and reverse geocode for display
    if (config.lat && config.lon) {
      let display = { city: config.city || '', state: config.state || '' };
      if (!display.city) {
        const geo = await reverseGeocode(config.lat, config.lon);
        if (geo) {
          display = { city: geo.city, state: geo.stateCode || geo.state };
          // Update config with resolved city/state
          saveLocationConfig(widgetId, { ...config, ...display });
        }
      }
      return { lat: config.lat, lon: config.lon, ...display };
    }

    // If config has location query (city/zipcode), geocode it
    if (config.query) {
      const geo = await geocodeAddress(config.query);
      if (geo) {
        // Update config with resolved lat/lon
        const resolved = {
          lat: geo.lat,
          lon: geo.lon,
          city: geo.city,
          state: geo.state,
          query: config.query,
        };
        saveLocationConfig(widgetId, resolved);
        return resolved;
      }
    }
  }

  // Fall back to args (from panel config)
  if (argsLat && argsLon) {
    let display = { city: '', state: '' };
    const geo = await reverseGeocode(argsLat, argsLon);
    if (geo) {
      display = { city: geo.city, state: geo.stateCode || geo.state };
    }
    return { lat: argsLat, lon: argsLon, ...display };
  }

  // Ultimate fallback to default
  return DEFAULT_LOCATION;
}

/**
 * Format location display: "City, ST"
 */
export function formatLocation(city, state) {
  if (city && state) return `${city}, ${state}`;
  if (city) return city;
  if (state) return state;
  return '';
}

/**
 * Fetch Google Places autocomplete suggestions
 */
export async function fetchPlacesAutocomplete(input) {
  if (!input || input.length < 2) return [];

  try {
    const params = new URLSearchParams({ input });
    const response = await fetch(`${API_BASE}/places-autocomplete?${params}`);

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
async function fetchPlaceDetails(placeId) {
  try {
    const params = new URLSearchParams({ placeId });
    const response = await fetch(`${API_BASE}/place-details?${params}`);

    if (!response.ok) return null;

    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Setup autocomplete dropdown on an input element
 * onSelect callback receives { description, city, state, lat, lon } when user picks a suggestion
 */
export function setupLocationAutocomplete(input, onSelect) {
  let dropdown = null;
  let debounceTimer = null;

  function createDropdown() {
    if (dropdown) return dropdown;
    dropdown = document.createElement('div');
    dropdown.className = 'location-autocomplete-dropdown';
    input.parentNode.style.position = 'relative';
    input.parentNode.appendChild(dropdown);
    return dropdown;
  }

  function hideDropdown() {
    if (dropdown) {
      dropdown.innerHTML = '';
      dropdown.style.display = 'none';
    }
  }

  function showPredictions(predictions) {
    const dd = createDropdown();
    if (predictions.length === 0) {
      hideDropdown();
      return;
    }

    dd.innerHTML = predictions
      .map((p) => {
        // Parse display from description: "123 Main St, City, ST, USA" or "City, ST, USA"
        const { displayMain, displaySecondary } = parseDescription(p.description);
        return `
      <div class="location-autocomplete-item" data-description="${p.description}" data-place-id="${p.placeId || ''}">
        <span class="loc-main">${displayMain}</span>
        ${displaySecondary ? `<span class="loc-secondary">${displaySecondary}</span>` : ''}
      </div>
    `;
      })
      .join('');
    dd.style.display = 'block';

    dd.querySelectorAll('.location-autocomplete-item').forEach((item) => {
      item.addEventListener('click', async () => {
        const description = item.dataset.description;
        const placeId = item.dataset.placeId;
        input.value = description;
        hideDropdown();

        // Use Place Details API if we have a placeId
        if (placeId) {
          const details = await fetchPlaceDetails(placeId);
          if (details && details.city) {
            onSelect({
              description,
              city: details.city,
              state: details.state,
              lat: details.lat,
              lon: details.lon,
            });
            return;
          }
        }

        // Fallback: parse from description
        const { city, state } = parseCityStateFromDescription(description);
        onSelect({ description, city, state });
      });
    });
  }

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const predictions = await fetchPlacesAutocomplete(input.value);
      showPredictions(predictions);
    }, 300);
  });

  input.addEventListener('blur', () => {
    setTimeout(hideDropdown, 200);
  });

  input.addEventListener('focus', () => {
    if (input.value.length >= 2) {
      fetchPlacesAutocomplete(input.value).then(showPredictions);
    }
  });

  return { hideDropdown };
}

/**
 * Parse description for display in dropdown
 * "123 Main St, San Francisco, CA, USA" → { displayMain: "123 Main St", displaySecondary: "San Francisco, CA" }
 * "San Francisco, CA, USA" → { displayMain: "San Francisco", displaySecondary: "CA, USA" }
 */
function parseDescription(description) {
  if (!description) return { displayMain: '', displaySecondary: '' };
  const parts = description.split(', ');
  if (parts.length <= 1) return { displayMain: description, displaySecondary: '' };
  return {
    displayMain: parts[0],
    displaySecondary: parts.slice(1).join(', '),
  };
}

/**
 * Parse city and state from full Google Places description
 * "123 Main St, San Francisco, CA, USA" → { city: "San Francisco", state: "CA" }
 * "San Francisco, CA, USA" → { city: "San Francisco", state: "CA" }
 * "San Francisco, CA 94102, USA" → { city: "San Francisco", state: "CA" }
 */
function parseCityStateFromDescription(description) {
  if (!description) return { city: '', state: '' };

  // Remove country suffix
  let text = description
    .replace(/, USA$/, '')
    .replace(/, Germany$/, '')
    .trim();
  const parts = text.split(', ');

  // Find the state (2-letter code, possibly with ZIP)
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i].trim();
    const stateMatch = part.match(/^([A-Z]{2})(?:\s+\d{5})?$/);
    if (stateMatch) {
      // State found at index i, city is at i-1
      const state = stateMatch[1];
      const city = i > 0 ? parts[i - 1].trim() : '';
      return { city, state };
    }
  }

  // Fallback - first part might be city
  return { city: parts[0] || '', state: '' };
}

export { DEFAULT_LOCATION };
