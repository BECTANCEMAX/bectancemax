"use client";

// Base : composant « adjustable-glass-dashboard » fourni (GlassWorkspace) — verre réglable,
// révélations GSAP entre les vues, graphique SVG, panneaux, dock / rail, panneau « Glass appearance ».
// Adaptation BECTANCEMAX :
//  - contenu bancaire remplacé par les pronostics (résultats, gagnés / perdus, réussite, cotes, évolution) ;
//  - vues : Stats (vue d'ensemble), Période (calendrier Glass + résultats recalculés en direct), Historique ;
//  - mobile : en-tête collant, barre d'onglets fixe en bas, cartes empilées, graphiques à la largeur du téléphone,
//    contenu sans double couche de verre (plus fluide sur smartphone) ;
//  - toutes les valeurs viennent de `pronostics` (aucun chiffre inventé, états vides sinon).

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  ChartNoAxesCombined,
  Check,
  ClipboardList,
  Download,
  House,
  Info,
  Layers,
  Search,
  Settings2,
  Target,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { GlassCalendar, type CalendarPreset, type CalendarRange } from "@/components/ui/glass-calendar";
import { Crown, FootballIcon, TelegramIcon, TennisIcon } from "@/components/brand/icons";
import { SiteMenu } from "@/components/site-menu";
import {
  evolution,
  filterByRange,
  lastNDays,
  netEuros,
  sortRecent,
  startOfDayLocal,
  summarize,
  summarizeReal,
  type DayRange,
  type EvolutionPoint,
  type Pronostic,
  type RealSummary,
} from "@/lib/stats";
import {
  STATUT_LABEL,
  fmtCote,
  fmtDayShort,
  fmtEuros,
  fmtInt,
  fmtPercent,
  fmtPercentSigned,
  fmtRangeLong,
  fmtRangeShort,
  fmtSigned,
  fmtUnits,
} from "@/lib/format";

gsap.registerPlugin(useGSAP);

export type GlassSettings = {
  blur: number;
  opacity: number;
  saturation: number;
  tint: string;
  edge: number;
};
export type DashboardView = "stats" | "periode" | "historique";
export type RangePreset = "7j" | "30j" | "custom";
export interface RangeSelection extends DayRange {
  preset: RangePreset;
}
export interface GlassWorkspaceProps {
  brand?: string;
  backgroundImage?: string;
  /** Registre des pronostics : seule source des statistiques. */
  pronostics?: readonly Pronostic[];
  view: DashboardView;
  onViewChange: (view: DashboardView) => void;
  range: RangeSelection;
  /** Change la période ; `nextView` permet de changer de vue dans la même navigation. */
  onRangeChange: (range: RangeSelection, nextView?: DashboardView) => void;
  onNavigateHome?: () => void;
  isDemo?: boolean;
  telegramUrl?: string;
  footerNote?: string;
  glass?: Partial<GlassSettings>;
  onGlassChange?: (settings: GlassSettings) => void;
  theme?: "system" | "light" | "dark";
  /** Inherit complete Tailwind v4 --color-* tokens. The host owns theme switching. */
  useHostTheme?: boolean;
  className?: string;
  style?: CSSProperties;
}

const defaults: GlassSettings = {
  blur: 22,
  opacity: 0.3,
  saturation: 1.2,
  tint: "#ffffff",
  edge: 0.6,
};
const tabs = [
  { id: "accueil", label: "Accueil", icon: House },
  { id: "stats", label: "Stats", icon: ChartNoAxesColumnIncreasing },
  { id: "periode", label: "Période", icon: CalendarDays },
  { id: "historique", label: "Historique", icon: ClipboardList },
] as const;
type TabId = (typeof tabs)[number]["id"];
const bounded = (value: number, min: number, max: number, fallback: number) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
const normalize = (v: Partial<GlassSettings>): GlassSettings => ({
  blur: bounded(v.blur ?? defaults.blur, 0, 40, defaults.blur),
  opacity: bounded(v.opacity ?? defaults.opacity, 0.08, 0.9, defaults.opacity),
  saturation: bounded(v.saturation ?? defaults.saturation, 0.5, 2, defaults.saturation),
  edge: bounded(v.edge ?? defaults.edge, 0, 1, defaults.edge),
  tint: /^#[0-9a-f]{6}$/i.test(v.tint ?? "") ? v.tint! : defaults.tint,
});

const calendarPresets: CalendarPreset[] = [
  { label: "7 derniers jours", range: () => lastNDays(7) },
  { label: "30 derniers jours", range: () => lastNDays(30) },
  {
    label: "Ce mois-ci",
    range: () => {
      const t = startOfDayLocal(new Date());
      return { from: new Date(t.getFullYear(), t.getMonth(), 1), to: t };
    },
  },
  {
    label: "Mois dernier",
    range: () => {
      const t = new Date();
      return { from: new Date(t.getFullYear(), t.getMonth() - 1, 1), to: new Date(t.getFullYear(), t.getMonth(), 0) };
    },
  },
];

type StatusFilter = "tous" | "gagne" | "perdu" | "en_attente";
const statusFilters: { id: StatusFilter; label: string }[] = [
  { id: "tous", label: "Tous" },
  { id: "gagne", label: "Gagnés" },
  { id: "perdu", label: "Perdus" },
  { id: "en_attente", label: "En attente" },
];

/** Échelle « ronde » pour l'axe vertical (pas de 1, 2, 5, 10…). */
function niceScale(min: number, max: number) {
  if (max - min < 2) max = min + 2;
  const rough = (max - min) / 3;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? 10 * pow);
  const lo = Math.floor(min / step) * step;
  const hi = Math.max(Math.ceil(max / step) * step, lo + step);
  const ticks: number[] = [];
  for (let t = hi; t >= lo; t -= step) ticks.push(Math.round(t));
  return { lo, hi, ticks };
}

function SportIcon({ sport }: { sport: Pronostic["sport"] }) {
  const Icon = sport === "tennis" ? TennisIcon : FootballIcon;
  return <Icon width={18} height={18} />;
}

export default function GlassWorkspace({
  brand = "BECTANCEMAX",
  backgroundImage,
  pronostics = [],
  view,
  onViewChange,
  range,
  onRangeChange,
  onNavigateHome,
  isDemo = false,
  telegramUrl,
  footerNote,
  glass = defaults,
  onGlassChange,
  theme = "dark",
  useHostTheme = false,
  className = "",
  style,
}: GlassWorkspaceProps) {
  const root = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const settingsTrigger = useRef<HTMLButtonElement>(null);
  const id = useId().replace(/:/g, "");
  const [material, setMaterial] = useState(() => normalize(glass));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("tous");
  const [draft, setDraft] = useState<CalendarRange | undefined>({ from: range.from, to: range.to });
  const [notice, setNotice] = useState("");
  const [backgroundFailed, setBackgroundFailed] = useState(false);
  useEffect(
    () => setMaterial(normalize(glass)),
    [glass.blur, glass.opacity, glass.saturation, glass.tint, glass.edge],
  );
  // En arrivant sur « Période », le calendrier part de la période actuellement affichée.
  useEffect(() => {
    if (view === "periode") setDraft({ from: range.from, to: range.to });
    window.scrollTo({ top: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);
  useEffect(() => {
    if (settingsOpen) root.current?.querySelector<HTMLButtonElement>(".gw-material button")?.focus();
  }, [settingsOpen]);
  useEffect(() => setBackgroundFailed(false), [backgroundImage]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  // ── Statistiques (toujours calculées depuis le registre) ──
  const inRange = useMemo(() => filterByRange(pronostics, range), [pronostics, range]);
  const summary = useMemo(() => summarize(inRange), [inRange]);
  const points = useMemo(() => evolution(inRange), [inRange]);
  const real = useMemo(() => summarizeReal(inRange), [inRange]);
  const draftRange = useMemo<DayRange | null>(
    () => (draft?.from ? { from: draft.from, to: draft.to ?? draft.from } : null),
    [draft],
  );
  const draftList = useMemo(() => (draftRange ? filterByRange(pronostics, draftRange) : []), [pronostics, draftRange]);
  const draftSummary = useMemo(() => summarize(draftList), [draftList]);
  const draftPoints = useMemo(() => evolution(draftList), [draftList]);
  const draftReal = useMemo(() => summarizeReal(draftList), [draftList]);
  const recent = useMemo(() => sortRecent(pronostics), [pronostics]);
  const marked = useMemo(() => new Set(pronostics.map((p) => p.date)), [pronostics]);
  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { tous: recent.length, gagne: 0, perdu: 0, en_attente: 0 };
    for (const p of recent) if (p.statut !== "annule") c[p.statut] += 1;
    return c;
  }, [recent]);
  const query = filter.trim().toLowerCase();
  const visible = recent.filter(
    (p) =>
      (statusFilter === "tous" || p.statut === statusFilter) &&
      `${p.match} ${p.selection} ${p.competition ?? ""}`.toLowerCase().includes(query),
  );

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const panels = content.current?.querySelectorAll(".gw-reveal");
        if (!panels?.length) return;
        gsap.fromTo(
          panels,
          { y: 12, opacity: 0.45, filter: "blur(3px)" },
          {
            y: 0,
            opacity: 1,
            filter: "blur(0px)",
            duration: 0.48,
            stagger: 0.045,
            ease: "power3.out",
            clearProps: "transform,opacity,filter",
          },
        );
      });
      return () => mm.revert();
    },
    { scope: root, dependencies: [view], revertOnUpdate: true },
  );

  function updateGlass(patch: Partial<GlassSettings>) {
    const next = normalize({ ...material, ...patch });
    setMaterial(next);
    onGlassChange?.(next);
  }
  function closeSettings() {
    setSettingsOpen(false);
    settingsTrigger.current?.focus();
  }
  function changeView(next: TabId) {
    setSettingsOpen(false);
    if (next === "accueil") onNavigateHome?.();
    else onViewChange(next);
  }
  function applyPeriod() {
    if (!draftRange) return;
    onRangeChange({ preset: "custom", ...draftRange }, "stats");
  }
  function exportReport() {
    const clean = (v: string) => `"${(/^[\s]*[=+@-]/.test(v) ? "'" : "") + v.replace(/"/g, '""')}"`;
    const num = (n: number | null | undefined) =>
      typeof n === "number" && Number.isFinite(n) ? n.toFixed(2).replace(".", ",") : "";
    const csv = [
      "Date;Sport;Compétition;Match;Pronostic;Cote;Statut;Mise (€);Résultat net (€)",
      ...visible.map((p) =>
        [
          clean(p.date),
          clean(p.sport),
          clean(p.competition ?? ""),
          clean(p.match),
          clean(p.selection),
          p.cote === null ? "" : fmtCote(p.cote),
          clean(STATUT_LABEL[p.statut]),
          num(p.miseEuros),
          num(netEuros(p)),
        ].join(";"),
      ),
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "bectancemax-pronostics.csv";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Historique exporté.");
  }

  const nav = (variant: "rail" | "dock" | "tabbar") => (
    <nav
      className={variant === "rail" ? "gw-rail gw-glass" : "gw-dock gw-glass"}
      aria-label={variant === "rail" ? "Navigation rapide" : "Sections du tableau de bord"}
    >
      {tabs.map((tab, i) => (
        <button
          key={tab.id}
          type="button"
          aria-label={variant === "rail" ? tab.label : undefined}
          title={variant === "rail" ? tab.label : undefined}
          aria-current={view === tab.id ? "page" : undefined}
          onClick={() => changeView(tab.id)}
          onKeyDown={(e) => {
            const keys = variant === "rail" ? ["ArrowUp", "ArrowDown", "Home", "End"] : ["ArrowLeft", "ArrowRight", "Home", "End"];
            if (!keys.includes(e.key)) return;
            e.preventDefault();
            const n = tabs.length;
            const forward = e.key === "ArrowRight" || e.key === "ArrowDown";
            const next = e.key === "Home" ? 0 : e.key === "End" ? n - 1 : (i + (forward ? 1 : n - 1)) % n;
            if (tabs[next].id !== "accueil") changeView(tabs[next].id);
            (e.currentTarget.parentElement?.children[next] as HTMLButtonElement)?.focus();
          }}
        >
          <tab.icon size={18} strokeWidth={1.7} aria-hidden="true" />
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );

  const demoBadge = isDemo ? (
    <span className="gw-demo-badge" title="Chiffres fictifs, pour prévisualiser l'interface">
      <span>
        Données de
        <br />
        démonstration
      </span>
      <Info size={15} aria-hidden="true" />
    </span>
  ) : null;

  const chart = (pts: EvolutionPoint[], opts: { compact?: boolean; label: string }) => {
    if (!pts.length)
      return (
        <div className="gw-empty gw-chart-empty">
          <ChartNoAxesCombined size={23} aria-hidden="true" />
          <h3>Pas encore de résultat</h3>
          <p>La courbe apparaîtra dès qu'un pronostic de la période sera terminé.</p>
        </div>
      );
    const values = pts.map((p) => p.solde);
    const { lo, hi, ticks } = niceScale(Math.min(0, ...values), Math.max(0, ...values));
    const chartX = (index: number) => (pts.length === 1 ? 300 : (index * 600) / (pts.length - 1));
    const chartY = (value: number) => 172 - ((value - lo) / (hi - lo)) * 156;
    const maxLabels = opts.compact ? 0 : 5;
    const labelIndices = new Set(
      Array.from({ length: Math.min(pts.length, maxLabels) }, (_, i) =>
        pts.length <= maxLabels ? i : Math.round((i * (pts.length - 1)) / (maxLabels - 1)),
      ),
    );
    // Le 1er point est le départ réel (veille du 1er résultat, solde 0) : la courbe ne simule pas
    // une progression régulière depuis le début de la période.
    const pointLabel = (i: number) => fmtDayShort(pts[i].key);
    const gradientId = `${id}-area-${opts.compact ? "c" : "m"}`;
    const last = pts[pts.length - 1];
    return (
      <div className={`gw-chart-wrap${opts.compact ? " is-compact" : ""}`}>
        {!opts.compact && (
          <div className="gw-chart-labels" aria-hidden="true">
            {ticks.map((t) => (
              <span key={t} style={{ top: `${(chartY(t) / 185) * 100}%` }}>
                {fmtSigned(t)}
              </span>
            ))}
          </div>
        )}
        <svg
          viewBox="0 0 600 185"
          role="img"
          aria-label={`${opts.label} : solde gagnés moins perdus de ${fmtSigned(last.solde)} sur la période.`}
          preserveAspectRatio="none"
        >
          <desc>{pts.map((p, i) => `${pointLabel(i)} : ${fmtSigned(p.solde)}`).join(". ")}</desc>
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--gw-accent)" stopOpacity=".32" />
              <stop offset="1" stopColor="var(--gw-accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {!opts.compact &&
            ticks.map((t) => (
              <path
                key={t}
                d={`M0 ${chartY(t)} H600`}
                stroke="currentColor"
                opacity={t === 0 ? ".24" : ".11"}
                strokeDasharray={t === 0 ? undefined : "3 5"}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          <path
            d={`M${chartX(0)} 185 ${pts.map((p, i) => `L${chartX(i)} ${chartY(p.solde)}`).join(" ")} L${chartX(pts.length - 1)} 185 Z`}
            fill={`url(#${gradientId})`}
          />
          <polyline
            points={pts.map((p, i) => `${chartX(i)},${chartY(p.solde)}`).join(" ")}
            fill="none"
            stroke="var(--gw-accent)"
            strokeWidth="2.6"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {/* Points : traits de longueur nulle à bout rond, restent circulaires malgré preserveAspectRatio="none" */}
          {pts.map((p, i) =>
            i === pts.length - 1 || pts.length <= 24 ? (
              <path
                key={p.key}
                d={`M${chartX(i)} ${chartY(p.solde)} h0`}
                stroke="var(--gw-accent)"
                strokeWidth={i === pts.length - 1 ? 9 : 6}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            ) : null,
          )}
        </svg>
        {!opts.compact && (
          <div className="gw-chart-months" aria-hidden="true">
            {pts.map(
              (p, index) =>
                labelIndices.has(index) && (
                  <span
                    key={`${p.key}-${index}`}
                    style={{
                      left: `${chartX(index) / 6}%`,
                      transform:
                        index === 0 && pts.length > 1
                          ? "none"
                          : index === pts.length - 1 && pts.length > 1
                            ? "translateX(-100%)"
                            : "translateX(-50%)",
                    }}
                  >
                    {pointLabel(index)}
                  </span>
                ),
            )}
          </div>
        )}
      </div>
    );
  };

  const pronoList = (items: Pronostic[], limit?: number) => (
    <div className="gw-transactions">
      {items.length ? (
        items.slice(0, limit).map((p) => (
          <div className="gw-transaction" key={p.id}>
            <span className="gw-transaction-icon">
              <SportIcon sport={p.sport} />
            </span>
            <div className="gw-transaction-name">
              <strong>{p.match}</strong>
              <span>
                {p.selection} · {fmtDayShort(p.date)}
              </span>
            </div>
            <span className={`gw-status is-${p.statut}`}>
              {p.statut === "gagne" && <Check size={12} aria-hidden="true" />}
              {STATUT_LABEL[p.statut]}
            </span>
            <span className="gw-amounts">
              <strong className="gw-cote" aria-label={`Cote ${fmtCote(p.cote)}`}>
                {fmtCote(p.cote)}
              </strong>
              {netEuros(p) !== null && (
                <span
                  className={netEuros(p)! > 0 ? "gw-positive" : netEuros(p)! < 0 ? "gw-negative" : undefined}
                  aria-label={`Résultat réel ${fmtEuros(netEuros(p)!, true)}`}
                >
                  {fmtEuros(netEuros(p)!, true)}
                </span>
              )}
            </span>
          </div>
        ))
      ) : (
        <div className="gw-empty">
          <Search size={23} aria-hidden="true" />
          <h3>{query || statusFilter !== "tous" ? "Aucun pronostic correspondant" : "Aucun pronostic publié"}</h3>
          <p>
            {query || statusFilter !== "tous"
              ? "Essaie un autre nom ou un autre filtre."
              : "Les pronostics apparaîtront ici dès leur publication."}
          </p>
          {(query || statusFilter !== "tous") && (
            <button
              type="button"
              onClick={() => {
                setFilter("");
                setStatusFilter("tous");
              }}
            >
              Effacer la recherche
            </button>
          )}
        </div>
      )}
    </div>
  );

  // Panneau « Gains réels » : reprend le panneau de solde du composant d'origine (gros montant + pastille).
  const realPanel = (r: RealSummary) => (
    <section className="gw-panel gw-balance gw-reveal" aria-label="Gains réels en euros">
      <div className="gw-panel-title">
        <h2>
          <Wallet size={18} aria-hidden="true" />
          Gains réels
        </h2>
        <span className="gw-small-label">{fmtRangeShort(range)}</span>
      </div>
      <strong className={`gw-balance-value ${r.benefice >= 0 ? "gw-positive" : "gw-negative"}`}>
        {fmtEuros(r.benefice, true)}
      </strong>
      <p className="gw-balance-meta">
        <span className={r.roi >= 0 ? "gw-positive" : "gw-negative"}>{fmtPercentSigned(r.roi)}</span>
        de bénéfice net sur les mises
      </p>
      <dl className="gw-money">
        <div>
          <dt>Misé</dt>
          <dd>{fmtEuros(r.mise)}</dd>
        </div>
        <div>
          <dt>Encaissé</dt>
          <dd>{fmtEuros(r.retour)}</dd>
        </div>
        <div>
          <dt>Pronostics</dt>
          <dd>{fmtInt(r.count)}</dd>
        </div>
      </dl>
      <p className="gw-chart-footnote">
        {r.complet
          ? "Mises et gains réels en euros. « Encaissé » inclut la mise des pronostics gagnés."
          : `Calculé sur ${r.count} des ${r.termines} pronostics terminés (ceux dont la mise est renseignée). « Encaissé » inclut la mise.`}
      </p>
    </section>
  );

  const telegramCta = telegramUrl ? (
    <a className="gw-telegram gw-reveal" href={telegramUrl} target="_blank" rel="noopener noreferrer">
      <TelegramIcon width={24} height={24} />
      Rejoindre le Telegram
      <ArrowRight size={20} strokeWidth={2.2} aria-hidden="true" />
    </a>
  ) : null;

  const headings: Record<DashboardView, { title: string; subtitle: string }> = {
    stats: { title: "Statistiques", subtitle: "Suivi de nos pronostics sportifs" },
    periode: {
      title: "Choisir une période",
      subtitle: "Sélectionne une date de début et une date de fin pour voir les résultats.",
    },
    historique: { title: "Historique", subtitle: "Tous les pronostics publiés, du plus récent au plus ancien." },
  };

  return (
    <div
      ref={root}
      className={`gw-root ${className}`}
      data-theme={useHostTheme ? "system" : theme}
      data-host-theme={useHostTheme}
      style={
        {
          "--gw-blur": `${material.blur}px`,
          "--gw-opacity": material.opacity,
          "--gw-saturation": material.saturation,
          "--gw-tint": useHostTheme
            ? `color-mix(in srgb, var(--color-background, Canvas) 80%, ${material.tint})`
            : material.tint,
          "--gw-edge": material.edge,
          ...style,
        } as CSSProperties
      }
      onKeyDown={(e) => {
        if (e.key === "Escape" && settingsOpen) closeSettings();
      }}
    >
      <style>{styles}</style>
      {backgroundImage && !backgroundFailed && (
        <img className="gw-room" src={backgroundImage} alt="" onError={() => setBackgroundFailed(true)} />
      )}
      <div className="gw-room-shade" aria-hidden="true" />
      <div className="gw-workspace">
        <header className="gw-topbar gw-glass">
          <a
            className="gw-brand"
            href="#/"
            onClick={(e) => {
              e.preventDefault();
              changeView("accueil");
            }}
          >
            <span className="gw-brand-icon">
              <Crown />
            </span>
            <strong>{brand}</strong>
            <span className="gw-brand-divider" />
            <span className="gw-personal">Analyses sportives</span>
          </a>
          <div className="gw-toolbar">
            <button
              type="button"
              className="gw-adjust"
              ref={settingsTrigger}
              onClick={() => setSettingsOpen(!settingsOpen)}
              aria-expanded={settingsOpen}
              aria-controls={`${id}-material`}
              aria-label="Réglages du verre"
            >
              <Settings2 size={18} aria-hidden="true" />
              <span>Réglages du verre</span>
            </button>
            <SiteMenu className="gw-menu" />
          </div>
        </header>
        <div className="gw-stage">
          {nav("rail")}
          <main className="gw-main gw-glass">
            <div className="gw-view-heading">
              <div className="gw-heading-text">
                {view === "periode" && (
                  <button
                    type="button"
                    className="gw-back"
                    aria-label="Retour aux statistiques"
                    onClick={() => changeView("stats")}
                  >
                    <ArrowLeft size={24} aria-hidden="true" />
                  </button>
                )}
                <div>
                  <h1>{headings[view].title}</h1>
                  <p className="gw-greeting">{headings[view].subtitle}</p>
                </div>
              </div>
              <div className="gw-heading-action">
                {view === "historique" ? (
                  <button type="button" className="gw-button" onClick={exportReport} disabled={!visible.length}>
                    <Download size={14} aria-hidden="true" />
                    Export CSV
                  </button>
                ) : view === "stats" ? (
                  (demoBadge ?? <span className="gw-date">{fmtRangeLong(range)}</span>)
                ) : null}
              </div>
            </div>
            <div ref={content} key={view} className="gw-view">
              {view === "stats" && (
                <>
                  <div className="gw-segment gw-chips gw-reveal" role="group" aria-label="Période affichée">
                    {(
                      [
                        ["7j", "7 jours"],
                        ["30j", "30 jours"],
                      ] as const
                    ).map(([preset, label]) => (
                      <button
                        key={preset}
                        type="button"
                        aria-pressed={range.preset === preset}
                        onClick={() => onRangeChange({ preset, ...lastNDays(preset === "7j" ? 7 : 30) })}
                      >
                        {label}
                      </button>
                    ))}
                    <button type="button" aria-pressed={range.preset === "custom"} onClick={() => changeView("periode")}>
                      <CalendarDays size={17} aria-hidden="true" />
                      {range.preset === "custom" ? fmtRangeShort(range) : "Personnalisé"}
                    </button>
                  </div>

                  {summary.total === 0 ? (
                    <section className="gw-panel gw-reveal">
                      <div className="gw-empty">
                        <CalendarDays size={23} aria-hidden="true" />
                        <h3>Aucun pronostic sur cette période</h3>
                        <p>{fmtRangeLong(range)} : rien n'a encore été publié.</p>
                        <button type="button" onClick={() => changeView("periode")}>
                          Choisir une autre période
                        </button>
                      </div>
                    </section>
                  ) : (
                    <>
                      <div className="gw-kpis gw-reveal">
                        {[
                          { label: "Pronostics", value: fmtInt(summary.total), icon: Target, tone: "" },
                          { label: "Gagnés", value: fmtInt(summary.gagnes), icon: Check, tone: "is-win" },
                          { label: "Perdus", value: fmtInt(summary.perdus), icon: X, tone: "is-loss" },
                          {
                            label: "Réussite",
                            value: fmtPercent(summary.reussite),
                            icon: ChartNoAxesColumnIncreasing,
                            tone: summary.reussite === null ? "" : "is-win is-rate",
                          },
                        ].map((k) => (
                          <section className={`gw-panel gw-kpi ${k.tone}`} key={k.label}>
                            <span className="gw-kpi-icon">
                              <k.icon size={20} strokeWidth={2} aria-hidden="true" />
                            </span>
                            <div>
                              <span>{k.label}</span>
                              <strong>{k.value}</strong>
                            </div>
                          </section>
                        ))}
                      </div>
                      {summary.enAttente > 0 && (
                        <p className="gw-pending-note gw-reveal">
                          <Info size={14} aria-hidden="true" />
                          {summary.enAttente} pronostic{summary.enAttente > 1 ? "s" : ""} en attente de résultat : non
                          compté{summary.enAttente > 1 ? "s" : ""} comme gagné ou perdu.
                        </p>
                      )}
                      {real && realPanel(real)}
                    </>
                  )}

                  <div className="gw-lower-grid">
                    {summary.total > 0 && (
                      <section className="gw-panel gw-reveal">
                        <div className="gw-panel-title">
                          <h2>
                            <TrendingUp size={18} aria-hidden="true" />
                            Évolution des résultats
                          </h2>
                          <span className="gw-small-label">{fmtRangeShort(range)}</span>
                        </div>
                        <div className="gw-chart-summary">
                          <div>
                            <span>
                              <i />
                              Gagnés − perdus
                            </span>
                            <strong>{summary.termines ? fmtSigned(summary.gagnes - summary.perdus) : "—"}</strong>
                          </div>
                          <div>
                            <span>
                              <i />
                              Cote moyenne
                            </span>
                            <strong>{fmtCote(summary.coteMoyenne)}</strong>
                          </div>
                          <div>
                            <span>
                              <i />
                              Bénéfice théorique
                            </span>
                            <strong>{fmtUnits(summary.benefice)}</strong>
                          </div>
                        </div>
                        {chart(points, { label: "Évolution des résultats" })}
                        <p className="gw-chart-footnote">
                          Bénéfice théorique : mise fixe de 1 unité par pronostic, à la cote publiée. Ce n'est pas un
                          gain encaissé.
                        </p>
                      </section>
                    )}
                    <section className="gw-panel gw-reveal">
                      <div className="gw-panel-title">
                        <h2>Derniers pronostics</h2>
                        <button className="gw-text-button" type="button" onClick={() => changeView("historique")}>
                          Voir tout
                          <ArrowRight size={14} aria-hidden="true" />
                        </button>
                      </div>
                      {pronoList(recent, 4)}
                    </section>
                  </div>
                  {telegramCta}
                </>
              )}
              {view === "periode" && (
                <>
                  <div className="gw-periode-grid">
                    <div className="gw-reveal">
                      <GlassCalendar
                        mode="range"
                        selectedRange={draft}
                        onRangeSelect={setDraft}
                        markedDates={marked}
                        presets={calendarPresets}
                        className="gw-calendar"
                      />
                    </div>
                    <section className="gw-panel gw-reveal gw-period-results" aria-live="polite">
                      <div className="gw-panel-title">
                        <h2>
                          <ChartNoAxesColumnIncreasing size={18} aria-hidden="true" />
                          Résultats de la période
                        </h2>
                        {demoBadge}
                      </div>
                      <p className="gw-period-label">
                        {draftRange ? fmtRangeLong(draftRange) : "Aucune période sélectionnée"}
                      </p>
                      {!draftRange ? (
                        <div className="gw-empty gw-chart-empty">
                          <CalendarDays size={23} aria-hidden="true" />
                          <h3>Choisis une date de début</h3>
                          <p>Puis une date de fin : les résultats se calculent automatiquement.</p>
                        </div>
                      ) : draftSummary.total === 0 ? (
                        <div className="gw-empty gw-chart-empty">
                          <CalendarDays size={23} aria-hidden="true" />
                          <h3>Aucun pronostic sur cette période</h3>
                          <p>Les jours marqués d'un point sur le calendrier ont des pronostics.</p>
                        </div>
                      ) : (
                        <>
                          <div className="gw-period-stats">
                            <div>
                              <strong>{fmtInt(draftSummary.total)}</strong>
                              <span>Pronostics</span>
                            </div>
                            <div>
                              <strong className={draftSummary.gagnes ? "is-win" : ""}>{fmtInt(draftSummary.gagnes)}</strong>
                              <span>Gagnés</span>
                            </div>
                            <div>
                              <strong className={draftSummary.perdus ? "is-loss" : ""}>{fmtInt(draftSummary.perdus)}</strong>
                              <span>Perdus</span>
                            </div>
                            <div>
                              <strong className={draftSummary.reussite !== null ? "is-win" : ""}>
                                {fmtPercent(draftSummary.reussite)}
                              </strong>
                              <span>Réussite</span>
                            </div>
                          </div>
                          <dl className="gw-period-extra">
                            <div>
                              <dt>Cote moyenne</dt>
                              <dd>{fmtCote(draftSummary.coteMoyenne)}</dd>
                            </div>
                            <div>
                              <dt>Bénéfice théorique</dt>
                              <dd>{fmtUnits(draftSummary.benefice)}</dd>
                            </div>
                            <div>
                              <dt>En attente</dt>
                              <dd>{fmtInt(draftSummary.enAttente)}</dd>
                            </div>
                            {draftReal && (
                              <div>
                                <dt>Bénéfice réel{draftReal.complet ? "" : "*"}</dt>
                                <dd className={draftReal.benefice >= 0 ? "gw-positive" : "gw-negative"}>
                                  {fmtEuros(draftReal.benefice, true)}
                                </dd>
                              </div>
                            )}
                          </dl>
                          {draftReal && !draftReal.complet && (
                            <p className="gw-chart-footnote">
                              * Sur {draftReal.count} des {draftReal.termines} pronostics terminés (mise renseignée).
                            </p>
                          )}
                          {chart(draftPoints, { compact: true, label: "Évolution sur la période" })}
                        </>
                      )}
                    </section>
                  </div>
                  <button type="button" className="gw-apply gw-reveal" disabled={!draftRange} onClick={applyPeriod}>
                    Appliquer la période
                    <ArrowRight size={22} strokeWidth={2.2} aria-hidden="true" />
                  </button>
                </>
              )}
              {view === "historique" && (
                <section className="gw-panel gw-reveal">
                  <div className="gw-panel-title">
                    <h2>
                      Pronostics <span className="gw-count">{recent.length}</span>
                    </h2>
                    <label className="gw-search">
                      <Search size={15} aria-hidden="true" />
                      <input
                        aria-label="Rechercher un pronostic"
                        placeholder="Rechercher un match, une équipe…"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                      />
                      {filter && (
                        <button type="button" aria-label="Effacer la recherche" onClick={() => setFilter("")}>
                          <X size={14} aria-hidden="true" />
                        </button>
                      )}
                    </label>
                  </div>
                  <div className="gw-segment gw-filters" role="group" aria-label="Filtrer par résultat">
                    {statusFilters.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        aria-pressed={statusFilter === f.id}
                        onClick={() => setStatusFilter(f.id)}
                      >
                        {f.label} <span>{counts[f.id]}</span>
                      </button>
                    ))}
                  </div>
                  {pronoList(visible)}
                </section>
              )}
            </div>
            {footerNote && (
              <footer className="gw-footer">
                <span>
                  <i />
                  {footerNote}
                </span>
              </footer>
            )}
            <div className="gw-desktop-dock">{nav("dock")}</div>
          </main>
        </div>
        {settingsOpen && (
          <aside className="gw-material gw-glass" id={`${id}-material`} aria-label="Apparence du verre">
            <div className="gw-material-title">
              <div>
                <span className="gw-material-icon">
                  <Settings2 size={18} aria-hidden="true" />
                </span>
                <h2>Apparence du verre</h2>
              </div>
              <button
                type="button"
                className="gw-icon-button"
                aria-label="Fermer les réglages du verre"
                onClick={closeSettings}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <p>Ajuste le verre de tout le tableau de bord.</p>
            <div className="gw-material-sample" aria-hidden="true">
              <Layers size={28} strokeWidth={1.1} />
              <span>Aperçu en direct</span>
            </div>
            <div className="gw-presets" aria-label="Préréglages du verre">
              {[
                { name: "Clair", value: { blur: 8, opacity: 0.12, saturation: 1.1, edge: 0.4 } },
                { name: "Givré", value: normalize(glass) },
                { name: "Opaque", value: { blur: 32, opacity: 0.86, saturation: 1, edge: 0.2 } },
              ].map((p) => (
                <button key={p.name} type="button" onClick={() => updateGlass(p.value)}>
                  {p.name}
                </button>
              ))}
            </div>
            {[
              { key: "blur", label: "Flou", min: 0, max: 40, step: 1, value: `${Math.round(material.blur)} px` },
              {
                key: "opacity",
                label: "Opacité",
                min: 0.08,
                max: 0.9,
                step: 0.01,
                value: `${Math.round(material.opacity * 100)} %`,
              },
              {
                key: "saturation",
                label: "Saturation",
                min: 0.5,
                max: 2,
                step: 0.05,
                value: `${Math.round(material.saturation * 100)} %`,
              },
              {
                key: "edge",
                label: "Reflet des bords",
                min: 0,
                max: 1,
                step: 0.05,
                value: `${Math.round(material.edge * 100)} %`,
              },
            ].map((c) => (
              <label className="gw-range" key={c.key}>
                <span>
                  {c.label}
                  <output>{c.value}</output>
                </span>
                <input
                  type="range"
                  aria-label={c.label}
                  min={c.min}
                  max={c.max}
                  step={c.step}
                  value={material[c.key as keyof GlassSettings]}
                  onChange={(e) => updateGlass({ [c.key]: Number(e.target.value) })}
                />
              </label>
            ))}
            <label className="gw-tint">
              Teinte du verre{" "}
              <input type="color" value={material.tint} onChange={(e) => updateGlass({ tint: e.target.value })} />
            </label>
            <button className="gw-reset" type="button" onClick={() => updateGlass(normalize(glass))}>
              Réinitialiser l'apparence
            </button>
          </aside>
        )}
      </div>
      {/* Barre d'onglets mobile : hors du verre de <main> pour rester fixée à l'écran */}
      <div className="gw-tabbar">{nav("tabbar")}</div>
      {notice && (
        <div className="gw-toast" role="status">
          <Check size={16} aria-hidden="true" />
          {notice}
        </div>
      )}
    </div>
  );
}

const styles = `
.gw-root {
  --gw-ink: var(--color-foreground, CanvasText);
  --gw-muted: var(--color-muted-foreground, GrayText);
  --gw-accent: var(--color-primary, Highlight);
  --gw-loss: #ef5350;
  --gw-line: color-mix(in srgb, var(--color-border, CanvasText) 35%, transparent);
  --gw-background: var(--color-background, Canvas);
  --gw-shade: color-mix(in srgb, var(--color-background, Canvas) 22%, transparent);
  --gw-surface: var(--color-card, var(--color-background, Canvas));
  --gw-panel: var(--color-card, var(--color-background, Canvas));
  --gw-brand-ink: var(--color-foreground, CanvasText);
  --gw-rail-active: color-mix(in srgb, var(--color-secondary, ButtonFace) 70%, transparent);
  --gw-segment: color-mix(in srgb, var(--color-muted, ButtonFace) 25%, transparent);
  --gw-segment-active: color-mix(in srgb, var(--color-card, Canvas) 85%, transparent);
  --gw-transaction-surface: color-mix(in srgb, var(--color-secondary, ButtonFace) 45%, transparent);
  --gw-dock: color-mix(in srgb, var(--color-card, Canvas) 70%, transparent);
  --gw-dock-active: var(--color-secondary, ButtonFace);
  --gw-button: var(--color-primary, Highlight);
  --gw-button-ink: var(--color-primary-foreground, HighlightText);
  --gw-search: color-mix(in srgb, var(--color-input, Canvas) 35%, transparent);
  --gw-popover: color-mix(in srgb, var(--color-popover, Canvas) 94%, transparent);
  --gw-fallback: var(--color-card, Canvas);
  --gw-mobile-dock: color-mix(in srgb, var(--color-card, Canvas) 55%, transparent);
  --gw-shadow: color-mix(in srgb, var(--color-foreground, CanvasText) 18%, transparent);
  --gw-panel-shadow: color-mix(in srgb, var(--color-foreground, CanvasText) 16%, transparent);
  --gw-soft-shadow: color-mix(in srgb, var(--color-foreground, CanvasText) 7%, transparent);
  --gw-segment-shadow: color-mix(in srgb, var(--color-foreground, CanvasText) 6%, transparent);
  --gw-dock-shadow: color-mix(in srgb, var(--color-foreground, CanvasText) 7%, transparent);
  --gw-popover-shadow: color-mix(in srgb, var(--color-foreground, CanvasText) 20%, transparent);
  --gw-sample-shadow: color-mix(in srgb, var(--color-foreground, CanvasText) 35%, transparent);
  --gw-toast-shadow: color-mix(in srgb, var(--color-foreground, CanvasText) 13%, transparent);
  --gw-toast: var(--color-primary, Highlight);
  --gw-dock-ink: var(--color-secondary-foreground, CanvasText);
  --gw-selection: color-mix(in srgb, var(--color-primary, Highlight) 35%, transparent);
  --gw-scrollbar: var(--color-muted-foreground, GrayText);
  --gw-hover: color-mix(in srgb, var(--color-secondary, ButtonFace) 25%, transparent);
  --gw-dock-hover: color-mix(in srgb, var(--color-secondary, ButtonFace) 30%, transparent);
  --gw-control-hover: color-mix(in srgb, var(--color-secondary, ButtonFace) 35%, transparent);
  --gw-soft-edge: color-mix(in srgb, var(--color-card, Canvas) 53%, transparent);
  --gw-toast-ink: var(--color-primary-foreground, HighlightText);
  --gw-highlight: var(--color-card, Canvas);
  --gw-telegram: #229ed9;
  position: relative;
  isolation: isolate;
  min-height: 100svh;
  overflow: hidden;
  padding: 38px 28px 32px;
  background: var(--gw-background);
  color: var(--gw-ink);
  font:
    14px/1.5 "Inter Variable",
    "Segoe UI",
    Arial,
    sans-serif;
  letter-spacing: -0.012em;
  font-variant-numeric: tabular-nums;
  box-sizing: border-box;
  color-scheme: inherit;
}
.gw-root[data-theme="light"] {
  color-scheme: light;
}
.gw-root[data-theme="dark"] {
  color-scheme: dark;
}
/* Réinitialisations placées dans la couche « base » de Tailwind : elles ne doivent pas
   écraser les utilitaires Tailwind du calendrier Glass intégré (couche « utilities »). */
@layer base {
  .gw-root * {
    box-sizing: border-box;
  }
  .gw-root ::selection {
    background: var(--gw-selection);
  }
  .gw-root button,
  .gw-root input,
  .gw-root a {
    font: inherit;
    color: inherit;
  }
  .gw-root button {
    cursor: pointer;
  }
  .gw-root button:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
  .gw-root button,
  .gw-root a,
  .gw-root input {
    outline-offset: 4px;
  }
  .gw-root :focus-visible {
    outline: 2px solid var(--gw-accent);
  }
  .gw-root button {
    border: 0;
    background: none;
  }
  .gw-root h1,
  .gw-root h2,
  .gw-root h3,
  .gw-root p,
  .gw-root dl,
  .gw-root dd {
    margin: 0;
  }
}
.gw-room {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 30%;
  z-index: -3;
}
.gw-room-shade {
  position: absolute;
  inset: 0;
  background: var(--gw-shade);
  z-index: -2;
}
.gw-workspace {
  position: relative;
  width: min(1280px, 100%);
  margin: auto;
}
.gw-glass {
  background: color-mix(in srgb, var(--gw-surface) calc(var(--gw-opacity) * 100%), transparent);
  backdrop-filter: blur(var(--gw-blur)) saturate(var(--gw-saturation));
  -webkit-backdrop-filter: blur(var(--gw-blur)) saturate(var(--gw-saturation));
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--gw-highlight) calc(var(--gw-edge) * 100%), transparent),
    inset 0 0 0 1px color-mix(in srgb, var(--gw-highlight) calc(var(--gw-edge) * 34%), transparent),
    0 20px 52px -25px var(--gw-shadow);
  position: relative;
}
.gw-glass:before {
  content: "";
  position: absolute;
  inset: 0;
  background: var(--gw-tint);
  opacity: 0.06;
  pointer-events: none;
  border-radius: inherit;
}
.gw-topbar {
  height: 62px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  border-radius: 20px;
  margin-bottom: 18px;
  padding: 0 20px;
  z-index: 10;
}
.gw-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  white-space: nowrap;
  min-width: 0;
}
.gw-brand strong {
  font-family: "Montserrat", "Inter Variable", sans-serif;
  font-style: italic;
  font-weight: 800;
  font-size: 18px;
  letter-spacing: -0.02em;
}
.gw-brand-icon {
  display: grid;
  place-items: center;
  width: 34px;
  color: var(--gw-brand-ink);
}
.gw-brand-icon svg {
  width: 34px;
  height: auto;
}
.gw-brand-divider {
  height: 16px;
  width: 1px;
  background: var(--gw-line);
  margin: 0 4px;
}
.gw-personal {
  font-size: 12px;
  color: var(--gw-muted);
}
.gw-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
}
.gw-adjust {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  border-radius: 10px;
  padding: 8px 10px;
}
.gw-adjust:hover,
.gw-adjust[aria-expanded="true"] {
  background: var(--gw-hover);
}
.gw-icon-button {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  flex: none;
}
.gw-icon-button:hover {
  background: var(--gw-hover);
}
.gw-stage {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}
.gw-rail {
  border-radius: 23px;
  width: 50px;
  padding: 8px 5px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 50px;
  flex: none;
}
.gw-rail button {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: grid;
  place-items: center;
}
.gw-rail button span {
  display: none;
}
.gw-rail button[aria-current] {
  background: var(--gw-rail-active);
  color: var(--gw-accent);
  box-shadow: 0 3px 8px var(--gw-soft-shadow);
}
.gw-main {
  border-radius: 27px;
  padding: 30px 30px 98px;
  flex: 1;
  min-width: 0;
}
.gw-view-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 24px;
}
.gw-heading-text {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
}
.gw-back {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  margin: -4px 0 0 -10px;
  border-radius: 50%;
  flex: none;
}
.gw-back:hover {
  background: var(--gw-hover);
}
.gw-greeting {
  font-size: 14px;
  color: var(--gw-muted);
  margin-top: 4px !important;
}
.gw-view-heading h1 {
  font-size: clamp(23px, 2.3vw, 31px);
  font-weight: 650;
  letter-spacing: -0.035em;
  line-height: 1.18;
}
.gw-date {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: var(--gw-muted);
  white-space: nowrap;
}
.gw-demo-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex: none;
  padding: 6px 10px;
  border: 1px solid var(--gw-line);
  border-radius: 10px;
  background: color-mix(in srgb, var(--gw-ink) 5%, transparent);
  font-size: 10.5px;
  line-height: 1.25;
  text-align: center;
  color: var(--gw-muted);
}
.gw-panel {
  background: color-mix(in srgb, var(--gw-panel) calc((0.16 + var(--gw-opacity) * 0.5) * 100%), transparent);
  border-radius: 17px;
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--gw-highlight) calc(var(--gw-edge) * 75%), transparent),
    inset 0 0 0 1px color-mix(in srgb, var(--gw-highlight) calc(var(--gw-edge) * 30%), transparent),
    0 8px 22px -20px var(--gw-panel-shadow);
  padding: 21px;
  min-width: 0;
  position: relative;
}
.gw-panel-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
  color: var(--gw-muted);
  font-size: 12px;
}
.gw-panel-title h2 {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  letter-spacing: -0.02em;
  font-weight: 650;
  color: var(--gw-ink);
}
.gw-panel-title h2 svg {
  color: var(--gw-muted);
  flex: none;
}
.gw-panel-title > svg {
  opacity: 0.65;
}
.gw-segment {
  display: flex;
  gap: 3px;
  background: var(--gw-segment);
  border-radius: 8px;
  padding: 3px;
  font-size: 10px;
}
.gw-segment button {
  padding: 4px 8px;
  border-radius: 6px;
}
.gw-segment button[aria-pressed="true"] {
  background: var(--gw-segment-active);
  box-shadow: 0 2px 4px var(--gw-segment-shadow);
  color: var(--gw-ink);
}
/* Puces de période (7 jours / 30 jours / Personnalisé) */
.gw-chips {
  display: grid;
  grid-template-columns: 1fr 1fr 1.45fr;
  gap: 8px;
  max-width: 520px;
  margin-bottom: 16px;
  padding: 0;
  background: none;
}
.gw-chips button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid var(--gw-line) !important;
  background: color-mix(in srgb, var(--gw-ink) 3%, transparent) !important;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  transition: background 0.2s, border-color 0.2s;
}
.gw-chips button[aria-pressed="true"] {
  border-color: transparent !important;
  background: linear-gradient(180deg, #4ad86f, #2aa94d) !important;
  color: #fff;
  font-weight: 600;
  box-shadow: 0 8px 20px -10px color-mix(in srgb, var(--gw-accent) 80%, transparent);
}
/* Cartes de statistiques */
.gw-kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}
.gw-kpi {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
}
.gw-kpi-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--gw-ink) 7%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--gw-ink) 14%, transparent);
  color: var(--gw-muted);
}
.gw-kpi.is-win .gw-kpi-icon {
  background: color-mix(in srgb, var(--gw-accent) 15%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--gw-accent) 38%, transparent);
  color: var(--gw-accent);
}
.gw-kpi.is-loss .gw-kpi-icon {
  background: color-mix(in srgb, var(--gw-loss) 14%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--gw-loss) 36%, transparent);
  color: var(--gw-loss);
}
.gw-kpi > div {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.gw-kpi span {
  font-size: 13px;
  color: color-mix(in srgb, var(--gw-ink) 85%, transparent);
}
.gw-kpi strong {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.12;
  white-space: nowrap;
}
.gw-kpi.is-rate strong {
  color: var(--gw-accent);
}
.gw-pending-note {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: -4px 2px 16px !important;
  font-size: 12px;
  line-height: 1.45;
  color: var(--gw-muted);
}
.gw-pending-note svg {
  flex: none;
  margin-top: 2px;
}
.gw-chart-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 30px;
  margin-bottom: 18px;
}
.gw-chart-summary > div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.gw-chart-summary span {
  font-size: 11px;
  color: var(--gw-muted);
  display: flex;
  align-items: center;
  gap: 5px;
}
.gw-chart-summary i {
  width: 5px;
  height: 5px;
  background: var(--gw-accent);
  border-radius: 50%;
}
.gw-chart-summary > div + div i {
  background: var(--gw-muted);
}
.gw-chart-summary strong {
  font-size: 21px;
  font-weight: 600;
  letter-spacing: -0.03em;
  white-space: nowrap;
}
.gw-chart-wrap {
  --gw-chart-h: 150px;
  position: relative;
  padding-left: 34px;
  padding-top: 2px;
}
.gw-chart-wrap.is-compact {
  --gw-chart-h: 96px;
  padding-left: 0;
}
.gw-chart-wrap svg {
  display: block;
  width: 100%;
  height: var(--gw-chart-h);
  overflow: visible;
  color: var(--gw-ink);
}
.gw-chart-labels {
  position: absolute;
  left: 0;
  top: 2px;
  height: var(--gw-chart-h);
  width: 30px;
  font-size: 11px;
  color: var(--gw-muted);
}
.gw-chart-labels span {
  position: absolute;
  right: 6px;
  transform: translateY(-50%);
  white-space: nowrap;
}
.gw-chart-months {
  position: relative;
  height: 26px;
  font-size: 11px;
  color: var(--gw-muted);
  padding-top: 10px;
}
.gw-lower-grid {
  display: grid;
  grid-template-columns: 1.3fr 1fr;
  gap: 16px;
}
.gw-lower-grid > :only-child {
  grid-column: 1 / -1;
}
.gw-text-button {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  font-size: 13px !important;
}
.gw-text-button:hover {
  color: var(--gw-accent);
}
.gw-transaction {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 12px 0;
  border-top: 1px solid var(--gw-line);
  min-width: 0;
}
.gw-transaction:first-child {
  border-top: 0;
  padding-top: 0;
}
.gw-transaction:last-child {
  padding-bottom: 0;
}
.gw-transaction-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--gw-transaction-surface);
  flex: none;
}
.gw-transaction-name {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.gw-transaction-name strong {
  font-size: 14px;
  font-weight: 600;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.gw-transaction-name span {
  font-size: 12px;
  color: var(--gw-muted);
  margin-top: 1px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.gw-status {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  flex: none;
  padding: 3px 8px;
  border-radius: 7px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  background: color-mix(in srgb, var(--gw-ink) 8%, transparent);
  color: var(--gw-muted);
}
.gw-status.is-gagne {
  background: color-mix(in srgb, var(--gw-accent) 17%, transparent);
  color: color-mix(in srgb, var(--gw-accent) 75%, white);
}
.gw-status.is-perdu {
  background: color-mix(in srgb, var(--gw-loss) 16%, transparent);
  color: color-mix(in srgb, var(--gw-loss) 75%, white);
}
.gw-cote {
  min-width: 40px;
  text-align: right;
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
}
.gw-amounts {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: flex-end;
  gap: 1px;
}
.gw-amounts > span {
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  color: var(--gw-muted);
}
.gw-root .gw-positive {
  color: var(--gw-accent);
}
.gw-root .gw-negative {
  color: var(--gw-loss);
}
/* Gains réels (reprend le panneau de solde d'origine) */
.gw-balance {
  display: flex;
  flex-direction: column;
  margin-bottom: 16px;
}
.gw-balance-value {
  font-size: clamp(29px, 3.15vw, 43px);
  font-weight: 650;
  letter-spacing: -0.04em;
  line-height: 1.2;
  white-space: nowrap;
}
.gw-balance-meta {
  font-size: 12px;
  color: var(--gw-muted);
  margin-top: 8px !important;
}
.gw-balance-meta span {
  margin-right: 6px;
  padding: 3px 6px;
  border-radius: 6px;
  background: color-mix(in srgb, currentColor 15%, transparent);
  font-weight: 600;
}
.gw-money {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  max-width: 560px;
  margin-top: 16px !important;
  padding-top: 14px;
  border-top: 1px solid var(--gw-line);
}
.gw-money dt {
  font-size: 11px;
  color: var(--gw-muted);
}
.gw-money dd {
  font-size: 16px;
  font-weight: 600;
  white-space: nowrap;
}
.gw-small-label {
  font-size: 12px;
  white-space: nowrap;
}
.gw-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--gw-muted);
  font-size: 11px;
  margin-top: 22px;
  gap: 16px;
}
.gw-footer > span:first-child {
  display: flex;
  align-items: center;
  gap: 6px;
}
.gw-footer i {
  height: 4px;
  width: 4px;
  background: var(--gw-accent);
  border-radius: 50%;
  flex: none;
}
.gw-desktop-dock {
  position: absolute;
  bottom: 19px;
  left: 50%;
  transform: translateX(-50%);
}
.gw-dock {
  display: flex;
  align-items: center;
  gap: 3px;
  border-radius: 30px;
  padding: 5px;
  white-space: nowrap;
  background: var(--gw-dock);
  backdrop-filter: blur(20px);
}
.gw-dock button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 24px;
  padding: 10px 17px;
  font-size: 12px;
  transition:
    background 0.22s,
    color 0.22s;
}
.gw-dock button svg {
  width: 15px;
}
.gw-dock button[aria-current] {
  background: var(--gw-dock-active);
  color: var(--gw-dock-ink);
  box-shadow: 0 3px 7px var(--gw-dock-shadow);
}
.gw-dock button:not([aria-current]):hover {
  background: var(--gw-dock-hover);
}
.gw-tabbar {
  display: none;
}
.gw-button {
  padding: 9px 13px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  gap: 7px;
  min-height: 40px;
  background: var(--gw-button) !important;
  color: var(--gw-button-ink) !important;
  font-size: 12px !important;
  font-weight: 600;
  white-space: nowrap;
}
.gw-button:hover {
  filter: brightness(1.13);
}
.gw-search {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--gw-search);
  border: 1px solid var(--gw-line);
  border-radius: 10px;
  padding: 0 10px;
  min-height: 42px;
}
.gw-search input {
  width: 200px;
  background: none;
  border: 0;
  outline: none;
  caret-color: var(--gw-accent);
  font-size: 16px;
}
.gw-search input::placeholder {
  color: var(--gw-muted);
}
.gw-search button {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
}
.gw-filters {
  margin-bottom: 18px;
  font-size: 13px;
  overflow-x: auto;
  scrollbar-width: none;
}
.gw-filters::-webkit-scrollbar {
  display: none;
}
.gw-filters button {
  flex: 1 0 auto;
  min-height: 38px;
  padding: 6px 12px;
  white-space: nowrap;
}
.gw-filters button span {
  margin-left: 4px;
  color: var(--gw-muted);
}
.gw-count {
  margin-left: 6px;
  font-size: 12px;
  color: var(--gw-muted);
}
.gw-empty {
  text-align: center;
  padding: 56px 15px;
  color: var(--gw-muted);
  font-size: 13px;
}
.gw-empty svg {
  margin-bottom: 12px;
}
.gw-empty h3 {
  font-size: 15px;
  color: var(--gw-ink);
  margin-bottom: 6px;
}
.gw-empty button {
  margin-top: 15px;
  min-height: 40px;
  text-decoration: underline;
}
/* Telegram */
.gw-telegram {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  max-width: 440px;
  min-height: 54px;
  margin: 18px auto 0;
  border-radius: 16px;
  background: linear-gradient(180deg, #2aa6e2, #1677c2);
  color: #fff;
  font-size: 17px;
  font-weight: 700;
  text-decoration: none;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.25),
    0 14px 30px -16px color-mix(in srgb, var(--gw-telegram) 80%, transparent);
}
.gw-telegram:active {
  transform: scale(0.985);
}
/* Période */
.gw-periode-grid {
  display: grid;
  grid-template-columns: minmax(0, 380px) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}
.gw-periode-grid > * {
  min-width: 0;
}
.gw-calendar {
  max-width: none;
  background: color-mix(in srgb, var(--gw-panel) calc((0.16 + var(--gw-opacity) * 0.5) * 100%), transparent);
}
.gw-period-label {
  margin: -10px 0 18px !important;
  font-size: 13px;
  color: var(--gw-muted);
}
.gw-period-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
.gw-period-stats > div {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
}
.gw-period-stats > div + div {
  border-left: 1px solid var(--gw-line);
}
.gw-period-stats strong {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.15;
  white-space: nowrap;
}
.gw-period-stats span {
  font-size: 13px;
  color: color-mix(in srgb, var(--gw-ink) 80%, transparent);
}
.gw-period-stats .is-win {
  color: var(--gw-accent);
}
.gw-period-stats .is-loss {
  color: var(--gw-loss);
}
.gw-period-extra {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin: 18px 0 14px !important;
  padding: 12px 0 0;
  border-top: 1px solid var(--gw-line);
}
.gw-period-extra > div {
  min-width: 0;
}
.gw-period-extra dt {
  font-size: 11px;
  color: var(--gw-muted);
}
.gw-period-extra dd {
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
}
.gw-apply {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  width: 100%;
  max-width: 440px;
  min-height: 56px;
  margin: 18px auto 0;
  border-radius: 16px;
  background: linear-gradient(180deg, #4ad86f, #26a349) !important;
  color: #fff !important;
  font-size: 18px !important;
  font-weight: 700;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.3),
    0 16px 30px -18px color-mix(in srgb, var(--gw-accent) 90%, transparent);
}
.gw-apply:active:not(:disabled) {
  transform: scale(0.985);
}
.gw-chart-footnote {
  font-size: 11px;
  line-height: 1.45;
  color: var(--gw-muted);
  margin-top: 12px !important;
}
.gw-material {
  position: absolute;
  z-index: 30;
  max-height: calc(100svh - 128px);
  overflow: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--gw-scrollbar) transparent;
  right: 10px;
  top: 75px;
  width: 300px;
  border-radius: 22px;
  padding: 22px;
  background: var(--gw-popover);
  box-shadow:
    inset 0 1px 0 var(--gw-soft-edge),
    0 24px 80px var(--gw-popover-shadow);
}
.gw-material-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.gw-material-title > div {
  display: flex;
  gap: 10px;
  align-items: center;
}
.gw-material h2 {
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.03em;
}
.gw-material-icon {
  display: grid;
  place-items: center;
}
.gw-material > p {
  font-size: 12px;
  color: var(--gw-muted);
  margin: 7px 0 18px;
}
.gw-material-sample {
  height: 87px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  border-radius: 13px;
  margin-bottom: 17px;
  background: color-mix(in srgb, var(--gw-tint) calc(var(--gw-opacity) * 100%), transparent);
  backdrop-filter: blur(var(--gw-blur));
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--gw-highlight) calc(var(--gw-edge) * 100%), transparent),
    0 12px 20px -18px var(--gw-sample-shadow);
  font-size: 12px;
}
.gw-presets {
  display: flex;
  gap: 5px;
  margin-bottom: 20px;
}
.gw-presets button {
  flex: 1;
  min-height: 38px;
  border: 1px solid var(--gw-line);
  border-radius: 8px;
  padding: 6px 0;
  font-size: 12px;
}
.gw-presets button:hover {
  background: var(--gw-control-hover);
}
.gw-range {
  display: block;
  margin: 17px 0;
}
.gw-range > span {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}
.gw-range output {
  font-size: 11px;
  color: var(--gw-muted);
}
.gw-range input {
  width: 100%;
  accent-color: var(--gw-accent);
  height: 24px;
  margin: 6px 0 0;
  cursor: pointer;
}
.gw-tint {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  margin-top: 20px;
}
.gw-tint input {
  height: 32px;
  width: 46px;
  padding: 2px;
  background: none;
  border: 1px solid var(--gw-line);
  border-radius: 6px;
  cursor: pointer;
}
.gw-reset {
  width: 100%;
  min-height: 42px;
  border: 1px solid var(--gw-line) !important;
  border-radius: 9px;
  padding: 8px;
  margin-top: 22px;
  font-size: 12px !important;
}
.gw-reset:hover {
  background: var(--gw-control-hover);
}
.gw-toast {
  position: fixed;
  left: 50%;
  bottom: 25px;
  transform: translateX(-50%);
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 20px;
  border-radius: 12px;
  background: var(--gw-toast);
  color: var(--gw-toast-ink);
  box-shadow: 0 10px 30px var(--gw-toast-shadow);
  font-size: 13px;
  white-space: nowrap;
}
.gw-chart-months > span {
  position: absolute;
  white-space: nowrap;
}
.gw-chart-empty {
  padding: 30px 15px;
  min-height: 150px;
}
@supports not (backdrop-filter: blur(1px)) {
  .gw-glass,
  .gw-panel {
    background: var(--gw-fallback);
  }
}
@media (min-width: 1550px) {
  .gw-root {
    padding-top: 65px;
  }
  .gw-main {
    padding-top: 36px;
  }
  .gw-chart-wrap {
    --gw-chart-h: 170px;
  }
  .gw-panel {
    padding: 25px;
  }
  .gw-transaction {
    padding: 14px 0;
  }
}
@media (max-width: 1050px) {
  .gw-root {
    padding: 24px 18px;
  }
  .gw-main {
    padding: 25px 23px 92px;
  }
  .gw-rail {
    display: none;
  }
  .gw-personal,
  .gw-brand-divider {
    display: none;
  }
  .gw-panel {
    padding: 18px;
  }
  .gw-kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  /* minmax(0, …) : une colonne « 1fr » s'élargirait à la bande Hebdo (31 jours) et sortirait de l'écran */
  .gw-lower-grid,
  .gw-periode-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .gw-chart-summary {
    gap: 12px 22px;
  }
  .gw-chart-summary strong {
    font-size: 19px;
  }
}
/* ───────── Mobile (priorité 375–430 px) ───────── */
@media (max-width: 700px) {
  .gw-root {
    padding: 0;
    overflow: visible;
    overflow-x: clip;
  }
  .gw-room,
  .gw-room-shade {
    position: fixed;
  }
  .gw-topbar {
    position: sticky;
    top: 0;
    z-index: 20;
    height: calc(58px + env(safe-area-inset-top));
    padding: env(safe-area-inset-top) 16px 0 18px;
    border-radius: 0;
    margin-bottom: 0;
    box-shadow: inset 0 -1px 0 var(--gw-line);
  }
  .gw-toolbar {
    gap: 2px;
  }
  .gw-brand strong {
    font-size: clamp(19px, 5.6vw, 23px);
  }
  .gw-brand-icon,
  .gw-brand-icon svg {
    width: 36px;
  }
  .gw-adjust {
    width: 44px;
    height: 44px;
    justify-content: center;
    padding: 0;
    border-radius: 12px;
  }
  .gw-adjust span {
    display: none;
  }
  .gw-stage {
    display: block;
  }
  .gw-main.gw-glass {
    border-radius: 0;
    padding: 18px 16px calc(96px + env(safe-area-inset-bottom));
    background: transparent;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    box-shadow: none;
  }
  .gw-main.gw-glass:before {
    display: none;
  }
  .gw-view-heading {
    gap: 10px;
    margin-bottom: 18px;
  }
  .gw-view-heading h1 {
    font-size: clamp(24px, 7vw, 30px);
    font-weight: 700;
    line-height: 1.12;
  }
  .gw-period-results .gw-panel-title h2 {
    font-size: 16px;
  }
  .gw-demo-badge {
    padding: 5px 8px;
    font-size: 10px;
  }
  .gw-greeting {
    font-size: 14.5px;
    line-height: 1.4;
  }
  .gw-heading-action .gw-date {
    display: none;
  }
  .gw-heading-action .gw-button {
    padding: 8px 12px;
  }
  .gw-desktop-dock {
    display: none;
  }
  /* Barre d'onglets fixe en bas, au pouce */
  .gw-tabbar {
    display: block;
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 25;
    padding: 4px 6px env(safe-area-inset-bottom);
    background: color-mix(in srgb, var(--gw-surface) 82%, transparent);
    backdrop-filter: blur(var(--gw-blur)) saturate(var(--gw-saturation));
    -webkit-backdrop-filter: blur(var(--gw-blur)) saturate(var(--gw-saturation));
    box-shadow: inset 0 1px 0 var(--gw-line);
  }
  .gw-tabbar .gw-dock {
    justify-content: space-around;
    gap: 0;
    padding: 0;
    border-radius: 0;
    background: none;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    box-shadow: none;
  }
  .gw-tabbar .gw-dock:before {
    display: none;
  }
  .gw-tabbar .gw-dock button {
    flex: 1 1 0;
    flex-direction: column;
    gap: 4px;
    min-height: 58px;
    padding: 6px 0;
    border-radius: 12px;
    font-size: 12px;
    color: var(--gw-muted);
  }
  .gw-tabbar .gw-dock button svg {
    width: 23px;
    height: 23px;
  }
  .gw-tabbar .gw-dock button[aria-current] {
    background: none;
    box-shadow: none;
    color: var(--gw-accent);
    font-weight: 600;
  }
  .gw-tabbar .gw-dock button:not([aria-current]):hover {
    background: none;
  }
  .gw-tabbar .gw-dock button:active {
    background: var(--gw-hover);
  }
  .gw-chips {
    gap: 7px;
    margin-bottom: 14px;
  }
  .gw-chips button {
    font-size: clamp(13px, 3.7vw, 15px);
    padding: 0 6px;
    gap: 6px;
  }
  .gw-kpis {
    gap: 10px;
    margin-bottom: 12px;
  }
  .gw-kpi {
    gap: 10px;
    padding: 13px 12px;
  }
  .gw-kpi-icon {
    width: 40px;
    height: 40px;
  }
  .gw-kpi span {
    font-size: 13.5px;
  }
  .gw-kpi strong {
    font-size: min(27px, 6.7vw);
  }
  .gw-pending-note {
    margin: -2px 2px 12px !important;
  }
  .gw-lower-grid,
  .gw-periode-grid {
    gap: 12px;
  }
  .gw-panel {
    border-radius: 18px;
    padding: 16px;
  }
  .gw-panel-title {
    gap: 8px;
    margin-bottom: 14px;
  }
  .gw-panel-title h2 {
    font-size: 17px;
  }
  .gw-chart-summary {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    margin-bottom: 14px;
  }
  .gw-chart-summary span {
    font-size: 11px;
    line-height: 1.25;
  }
  .gw-chart-summary strong {
    font-size: min(18px, 4.6vw);
  }
  .gw-chart-wrap {
    --gw-chart-h: 140px;
  }
  .gw-chart-wrap.is-compact {
    --gw-chart-h: 84px;
  }
  .gw-transaction-icon {
    width: 34px;
    height: 34px;
  }
  .gw-transaction-name strong {
    font-size: 14.5px;
  }
  .gw-status {
    font-size: 12px;
    padding: 3px 7px;
  }
  .gw-calendar {
    border-radius: 22px;
  }
  .gw-period-label {
    margin: -8px 0 14px !important;
  }
  .gw-period-stats strong {
    font-size: min(26px, 6.6vw);
  }
  .gw-period-stats span {
    font-size: 12.5px;
  }
  .gw-period-extra {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px 12px;
  }
  .gw-period-extra dd {
    font-size: 14px;
  }
  .gw-balance {
    margin-bottom: 12px;
  }
  .gw-balance-value {
    font-size: min(38px, 9.6vw);
  }
  .gw-money dd {
    font-size: min(16px, 4.1vw);
  }
  .gw-footer {
    font-size: 11px;
    margin-top: 20px;
  }
  .gw-material {
    position: fixed;
    right: 8px;
    top: calc(64px + env(safe-area-inset-top));
    width: min(340px, calc(100% - 16px));
    padding: 20px;
    max-height: calc(100svh - 64px - env(safe-area-inset-top) - 90px);
  }
  .gw-search {
    width: 100%;
  }
  .gw-search input {
    width: 100%;
    min-width: 0;
  }
  .gw-view:has(.gw-search) .gw-panel-title {
    flex-wrap: wrap;
  }
  .gw-filters {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    margin-bottom: 14px;
  }
  .gw-toast {
    bottom: calc(86px + env(safe-area-inset-bottom));
    max-width: calc(100% - 30px);
    white-space: normal;
  }
}
@media (max-height: 550px) {
  .gw-material {
    top: 70px;
    max-height: calc(100svh - 110px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .gw-root * {
    scroll-behavior: auto !important;
    transition: none !important;
  }
}
`;
