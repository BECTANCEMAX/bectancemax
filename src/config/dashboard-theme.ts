import type { CSSProperties } from "react";
import type { GlassSettings } from "@/components/ui/adjustable-glass-dashboard";

/**
 * Palette BECTANCEMAX pour le dashboard Glass (même principe que la palette de la démo d'origine) :
 * noir, blanc, gris ; vert uniquement pour les statistiques positives, rouge pour les pertes.
 */
export const bectancePalette = {
  "--gw-ink": "#f5f5f5",
  "--gw-muted": "#a1a1a1",
  "--gw-accent": "#3ecf62",
  "--gw-loss": "#ef5350",
  "--gw-line": "rgba(255,255,255,0.1)",
  "--gw-background": "#030303",
  "--gw-shade": "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.82) 45%, rgba(0,0,0,0.92) 100%)",
  "--gw-surface": "#141414",
  "--gw-panel": "#161616",
  "--gw-brand-ink": "#ffffff",
  "--gw-rail-active": "rgba(255,255,255,0.1)",
  "--gw-segment": "rgba(255,255,255,0.05)",
  "--gw-segment-active": "rgba(255,255,255,0.14)",
  "--gw-transaction-surface": "rgba(255,255,255,0.07)",
  "--gw-dock": "rgba(16,16,16,0.72)",
  "--gw-dock-active": "rgba(255,255,255,0.12)",
  "--gw-dock-ink": "#ffffff",
  "--gw-button": "#f5f5f5",
  "--gw-button-ink": "#0a0a0a",
  "--gw-search": "rgba(255,255,255,0.04)",
  "--gw-popover": "rgba(16,16,16,0.94)",
  "--gw-fallback": "#121212",
  "--gw-mobile-dock": "rgba(12,12,12,0.8)",
  "--gw-shadow": "rgba(0,0,0,0.65)",
  "--gw-panel-shadow": "rgba(0,0,0,0.7)",
  "--gw-soft-shadow": "rgba(0,0,0,0.3)",
  "--gw-segment-shadow": "rgba(0,0,0,0.3)",
  "--gw-dock-shadow": "rgba(0,0,0,0.35)",
  "--gw-popover-shadow": "rgba(0,0,0,0.7)",
  "--gw-sample-shadow": "rgba(0,0,0,0.6)",
  "--gw-toast-shadow": "rgba(0,0,0,0.5)",
  "--gw-toast": "#f5f5f5",
  "--gw-toast-ink": "#0a0a0a",
  "--gw-selection": "rgba(62,207,98,0.35)",
  "--gw-scrollbar": "#555",
  "--gw-hover": "rgba(255,255,255,0.08)",
  "--gw-dock-hover": "rgba(255,255,255,0.08)",
  "--gw-control-hover": "rgba(255,255,255,0.1)",
  "--gw-soft-edge": "rgba(255,255,255,0.12)",
  "--gw-highlight": "#ffffff",
} as CSSProperties;

/** Réglages du verre par défaut (modifiables par le visiteur via « Réglages du verre »). */
export const bectanceGlass: GlassSettings = {
  blur: 18,
  opacity: 0.42,
  saturation: 1.1,
  tint: "#ffffff",
  edge: 0.22,
};
