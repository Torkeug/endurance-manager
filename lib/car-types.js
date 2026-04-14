/**
 * Shared utilities for iRacing car type classification.
 * Used by admin inventory matrix, driver inventaire page.
 */

// Derives a display class label from a car's car_types array,
// using the priority-ordered labels fetched from the DB.
// carTypeLabels must be sorted by priority ascending (lowest = checked first).
export function deriveCarClass(carTypes, carTypeLabels) {
  if (!carTypes || carTypes.length === 0) return "—";
  for (const { car_type, label } of carTypeLabels) {
    if (carTypes.includes(car_type)) return label;
  }
  return "—";
}

// Detects legacy or retired iRacing content by checking for
// [Legacy] or [Retired] tags in the name string.
export function isLegacyContent(name) {
  return /\[(legacy|retired)\]/i.test(name || "");
}
