/**
 * Shared utilities for iRacing content classification.
 * deriveCarClass is removed — class is now explicitly set per Kronos car.
 */

// Detects legacy or retired iRacing content by checking for
// [Legacy] or [Retired] tags in the name string.
export function isLegacyContent(name) {
  return /\[(legacy|retired)\]/i.test(name || "");
}
