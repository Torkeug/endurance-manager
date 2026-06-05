// All timezone conversions use luxon instead of native Date —
// native Date has no reliable DST-aware timezone support.
// luxon handles DST transitions automatically (e.g. CET ↔ CEST).
import { DateTime } from "luxon";

// Common timezones for race venues
export const TIMEZONES = [
  { value: "Europe/Paris", label: "Paris (CET/CEST)" },
  { value: "Europe/London", label: "Londres (GMT/BST)" },
  { value: "Europe/Berlin", label: "Berlin (CET/CEST)" },
  { value: "Europe/Madrid", label: "Madrid (CET/CEST)" },
  { value: "Europe/Rome", label: "Rome (CET/CEST)" },
  { value: "Europe/Amsterdam", label: "Amsterdam (CET/CEST)" },
  { value: "Europe/Brussels", label: "Bruxelles (CET/CEST)" },
  { value: "Europe/Zurich", label: "Zurich (CET/CEST)" },
  { value: "America/New_York", label: "New York (ET)" },
  { value: "America/Chicago", label: "Chicago (CT)" },
  { value: "America/Denver", label: "Denver (MT)" },
  { value: "America/Los_Angeles", label: "Los Angeles (PT)" },
  { value: "America/Sao_Paulo", label: "São Paulo (BRT)" },
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Asia/Dubai", label: "Dubaï (GST)" },
  { value: "UTC", label: "UTC" },
];

/**
 * Convert a local date + time string to UTC ISO string
 * using the event's timezone (handles DST automatically)
 *
 * @param {string} date - 'YYYY-MM-DD'
 * @param {string} time - 'HH:MM'
 * @param {string} timezone - e.g. 'Europe/Paris'
 * @returns {string} UTC ISO string
 */
export function localToUTC(date, time, timezone) {
  const dt = DateTime.fromISO(`${date}T${time}:00`, { zone: timezone });
  return dt.toUTC().toISO();
}

/**
 * Convert a UTC ISO string to local time in the event's timezone
 *
 * @param {string} utcIso - UTC ISO string from Supabase
 * @param {string} timezone - e.g. 'Europe/Paris'
 * @returns {DateTime} Luxon DateTime in the event timezone
 */
export function utcToLocal(utcIso, timezone) {
  return DateTime.fromISO(utcIso, { zone: "utc" }).setZone(timezone);
}

/**
 * Format a UTC ISO string for display in the event's timezone
 *
 * @param {string} utcIso - UTC ISO string
 * @param {string} timezone - e.g. 'Europe/Paris'
 * @param {object} opts - Luxon format options
 * @returns {string} Formatted datetime string with timezone abbreviation
 */
export function formatInZone(utcIso, timezone, opts = {}) {
  if (!utcIso) return "—";
  const dt = utcToLocal(utcIso, timezone);
  const defaultOpts = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  };
  const formatted = dt.toLocaleString(
    { ...defaultOpts, ...opts },
    { locale: "fr-FR" },
  );
  const tzAbbr = dt.toFormat("ZZZZ"); // e.g. "CEST", "CET"
  return `${formatted} ${tzAbbr}`;
}

/**
 * Format time only (HH:MM) in event timezone
 */
export function formatTimeInZone(utcIso, timezone) {
  if (!utcIso) return "—";
  const dt = utcToLocal(utcIso, timezone);
  return dt.toFormat("HH:mm");
}

/**
 * Format date only (DD/MM/YYYY) in event timezone
 */
export function formatDateInZone(utcIso, timezone) {
  if (!utcIso) return "—";
  const dt = utcToLocal(utcIso, timezone);
  return dt.toFormat("dd/MM/yyyy");
}

/**
 * Get the input values (date + time) from a UTC ISO string in event timezone
 * Used to pre-fill edit forms
 */
export function utcToInputValues(utcIso, timezone) {
  if (!utcIso) return { date: "", time: "" };
  const dt = utcToLocal(utcIso, timezone);
  return {
    date: dt.toFormat("yyyy-MM-dd"),
    time: dt.toFormat("HH:mm"),
  };
}

/**
 * Format a UTC ISO string as a human-readable date label in event timezone.
 * Produces e.g. "Saturday 23 April 2025" or "Samedi 23 avril 2025" depending on locale.
 */
export function formatDateLabelInZone(utcIso, timezone, locale) {
  if (!utcIso) return "—";
  const dt = utcToLocal(utcIso, timezone).setLocale(locale);
  const dayName = dt.toFormat("EEEE");
  const dayNum = dt.toFormat("d");
  const month = dt.toFormat("MMMM yyyy");
  return `${dayName.charAt(0).toUpperCase() + dayName.slice(1)} ${dayNum} ${month}`;
}

/**
 * Get timezone abbreviation for a given timezone and date
 */
export function getTZAbbr(timezone, date = new Date()) {
  const dt = DateTime.fromJSDate(date, { zone: timezone });
  return dt.toFormat("ZZZZ");
}
