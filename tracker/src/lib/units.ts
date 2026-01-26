/**
 * Calculate units from volume and percentage
 * 1 unit = 10ml of pure ethanol
 *
 * @param volumeMl Volume in milliliters
 * @param percentage Strength (e.g., 5.0 for 5%)
 * @returns Number of units (rounded to 2 decimal places)
 */
export function calculateUnits(volumeMl: number, percentage: number): number {
  return Math.round(((volumeMl * percentage) / 100 / 10) * 100) / 100;
}

/**
 * Convert fluid ounces to milliliters
 */
export function ozToMl(oz: number): number {
  return Math.round(oz * 29.5735);
}

/**
 * Convert milliliters to fluid ounces
 */
export function mlToOz(ml: number): number {
  return Math.round((ml / 29.5735) * 10) / 10;
}

/**
 * Format units for display
 */
export function formatUnits(units: number): string {
  if (units === 0) return '0';
  if (units < 0.1) return units.toFixed(2);
  if (units < 1) return units.toFixed(1);
  return units.toFixed(1);
}

/**
 * Format volume for display (shows both ml and oz)
 */
export function formatVolume(ml: number): string {
  const oz = mlToOz(ml);
  return `${ml}ml (${oz}oz)`;
}

/**
 * Format volume for display in a specific unit
 */
export function formatVolumeUnit(ml: number, unit: 'ml' | 'oz'): string {
  if (unit === 'oz') {
    return `${mlToOz(ml)}oz`;
  }
  return `${ml}ml`;
}
