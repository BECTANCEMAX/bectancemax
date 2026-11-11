import { useMemo, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router";
import GlassWorkspace, {
  type DashboardView,
  type GlassSettings,
  type RangeSelection,
} from "@/components/ui/adjustable-glass-dashboard";
import { bectanceGlass, bectancePalette } from "@/config/dashboard-theme";
import { SITE } from "@/config/site";
import { usePronostics } from "@/hooks/use-pronostics";
import { dayKey, lastNDays, parseDayKey } from "@/lib/stats";
import stadium from "@/assets/stadium.webp";

const VIEWS: readonly DashboardView[] = ["stats", "periode", "historique"];
const GLASS_KEY = "bectancemax.glass";

function readGlass(): GlassSettings {
  try {
    const raw = window.localStorage.getItem(GLASS_KEY);
    return raw ? { ...bectanceGlass, ...JSON.parse(raw) } : bectanceGlass;
  } catch {
    return bectanceGlass;
  }
}

/**
 * Relie le dashboard Glass au routeur :
 *  /stats, /periode, /historique  → vue affichée
 *  ?p=7j | ?du=AAAA-MM-JJ&au=AAAA-MM-JJ → période (par défaut : 30 derniers jours) — lien partageable.
 */
export default function DashboardPage() {
  const { view } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { pronostics, isDemo } = usePronostics();
  const [glass] = useState(readGlass);

  const range = useMemo<RangeSelection>(() => {
    const du = parseDayKey(params.get("du") ?? "");
    const au = parseDayKey(params.get("au") ?? "");
    if (du && au) return du <= au ? { preset: "custom", from: du, to: au } : { preset: "custom", from: au, to: du };
    const preset = params.get("p") === "7j" ? "7j" : "30j";
    return { preset, ...lastNDays(preset === "7j" ? 7 : 30) };
  }, [params]);

  if (!VIEWS.includes(view as DashboardView)) return <Navigate to="/" replace />;

  const go = (nextView: DashboardView, nextRange: RangeSelection = range) => {
    const q = new URLSearchParams();
    if (nextRange.preset === "custom") {
      q.set("du", dayKey(nextRange.from));
      q.set("au", dayKey(nextRange.to));
    } else if (nextRange.preset === "7j") q.set("p", "7j");
    const search = q.toString();
    navigate({ pathname: `/${nextView}`, search: search ? `?${search}` : "" }, { replace: nextView === view });
  };

  return (
    <GlassWorkspace
      brand={SITE.name}
      view={view as DashboardView}
      onViewChange={(v) => go(v)}
      range={range}
      onRangeChange={(r, nextView) => go(nextView ?? (view as DashboardView), r)}
      onNavigateHome={() => navigate("/")}
      pronostics={pronostics}
      isDemo={isDemo}
      telegramUrl={SITE.telegramUrl}
      footerNote="Statistiques calculées automatiquement à partir des pronostics publiés. Pronostics en attente non comptés."
      backgroundImage={stadium}
      glass={glass}
      onGlassChange={(g) => {
        try {
          window.localStorage.setItem(GLASS_KEY, JSON.stringify(g));
        } catch {
          /* stockage indisponible : réglage gardé pour la session */
        }
      }}
      theme="dark"
      useHostTheme={false}
      style={bectancePalette}
    />
  );
}
