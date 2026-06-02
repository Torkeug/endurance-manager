"use client";
import { useState, useEffect } from "react";

export default function LocalDate({ iso }) {
  const [formatted, setFormatted] = useState("");
  useEffect(() => {
    setFormatted(
      new Date(iso).toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
  }, [iso]);
  return formatted || "—";
}
