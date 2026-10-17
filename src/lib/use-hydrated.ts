"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/** true depois da hidratação (no servidor e no primeiro render do cliente, false). */
export function useHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
