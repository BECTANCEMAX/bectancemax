import { useMemo } from "react";
import { PRONOSTICS } from "@/data/pronostics";
import { buildDemoPronostics } from "@/data/demo";
import type { Pronostic } from "@/lib/stats";

/** Mode démo : « ?demo » dans l'URL (avant le #) ou VITE_DEMO=1. Désactivé par défaut. */
export function isDemoMode(): boolean {
  if (import.meta.env.VITE_DEMO === "1") return true;
  try {
    return new URLSearchParams(window.location.search).has("demo");
  } catch {
    return false;
  }
}

export function usePronostics(): { pronostics: readonly Pronostic[]; isDemo: boolean } {
  return useMemo(() => {
    const isDemo = isDemoMode();
    return { pronostics: isDemo ? buildDemoPronostics() : PRONOSTICS, isDemo };
  }, []);
}
