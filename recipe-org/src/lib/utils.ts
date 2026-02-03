/**
 * Formats a Dewey decimal number by combining all numbers before the last dot
 * and keeping only the last dot to separate the category from the recipe number.
 *
 * Example: "011.22.001" becomes "01122.001"
 */
export function formatDeweyDecimal(deweyDecimal: string): string {
  if (!deweyDecimal) return deweyDecimal;

  const parts = deweyDecimal.split('.');
  if (parts.length <= 1) return deweyDecimal;

  const categoryNumbers = parts.slice(0, -1).join('');
  const recipeNumber = parts[parts.length - 1];

  return `${categoryNumbers}.${recipeNumber}`;
}
