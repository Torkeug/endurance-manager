"use client";
import { useState, useEffect } from "react";
import { useLocale } from "next-intl";

export default function LocalDate({ iso }) {
  const locale = useLocale();
  const [formatted, setFormatted] = useState("");
  useEffect(() => {
    setFormatted(
      new Date(iso).toLocaleString(locale, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
  }, [iso, locale]);
  return formatted || "—";
}
