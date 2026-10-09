"use client";

import { useEffect } from "react";

/** Registra a visualização do imóvel (uma vez por montagem real da página). */
export function PropertyTracker({ propertyId }: { propertyId: string }) {
  useEffect(() => {
    fetch("/api/track/property-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId }),
      keepalive: true,
    }).catch(() => {});
  }, [propertyId]);
  return null;
}
