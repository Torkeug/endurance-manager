"use client";
import { useLocale } from "next-intl";
import { useSyncExternalStore } from "react";

// useSyncExternalStore returns getServerSnapshot() on SSR/hydration and
// getClientSnapshot() after mount — cleanly avoids hydration mismatch.
const subscribe = () => () => {};
const getServerSnapshot = () => false;
const getClientSnapshot = () => true;

export default function LocalDate({ iso }) {
  const locale = useLocale();
  const mounted = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  if (!mounted) return "—";
  return new Date(iso).toLocaleString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
