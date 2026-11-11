import { useEffect, useMemo } from "react";
import { Link } from "react-router";
import { ArrowRight, CalendarDays, ClipboardList } from "lucide-react";
import { BarsIcon, BrushUnderline, Crown, FootballIcon, TelegramIcon, TennisIcon } from "@/components/brand/icons";
import { SiteMenu } from "@/components/site-menu";
import { SITE } from "@/config/site";
import { usePronostics } from "@/hooks/use-pronostics";
import { fmtEuros, fmtInt, fmtPercent } from "@/lib/format";
import { filterByRange, lastNDays, summarize, summarizeReal } from "@/lib/stats";
import { cn } from "@/lib/utils";
import stadium from "@/assets/stadium.webp";
import "./home.css";

/** Précharge le tableau de bord pour une navigation instantanée depuis l'accueil. */
const prefetchDashboard = () => void import("@/pages/Dashboard");

const LINKS = [
  { to: "/stats", label: "Voir les statistiques", icon: BarsIcon },
  { to: "/periode", label: "Choisir une période", icon: CalendarDays },
  { to: "/historique", label: "Historique des pronostics", icon: ClipboardList },
] as const;

export default function Home() {
  const { pronostics, isDemo } = usePronostics();
  const last30 = useMemo(() => filterByRange(pronostics, lastNDays(30)), [pronostics]);
  const s = useMemo(() => summarize(last30), [last30]);
  const real = useMemo(() => summarizeReal(last30), [last30]);

  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(prefetchDashboard);
    else window.setTimeout(prefetchDashboard, 1200);
  }, []);

  return (
    <div className="home">
      <header className="home-header">
        <span className="home-header__brand">{SITE.name}</span>
        <SiteMenu />
      </header>

      <div className="home-stadium" aria-hidden="true">
        <img src={stadium} alt="" decoding="async" fetchPriority="high" />
      </div>

      <main className="home-main">
        <section className="home-hero" aria-label={SITE.name}>
          <Crown className="home-crown" />
          <h1 className="home-logo">{SITE.name}</h1>
          <BrushUnderline className="home-underline" />
          <p className="home-kicker">Analyses sportives</p>
          <p className="home-tagline">
            Analyses et pronostics sportifs,
            <br />
            avec un suivi transparent des résultats.
          </p>
          <ul className="home-sports" aria-label="Sports couverts">
            <li>
              <FootballIcon />
              Football
            </li>
            <li className="home-sports__divider" aria-hidden="true" />
            <li>
              <TennisIcon />
              Tennis
            </li>
          </ul>
        </section>

        <span className="home-gap" />

        <a className="home-telegram" href={SITE.telegramUrl} target="_blank" rel="noopener noreferrer">
          <TelegramIcon className="home-telegram__icon" />
          <span>Rejoindre le Telegram</span>
          <ArrowRight className="home-telegram__arrow" strokeWidth={2.2} aria-hidden="true" />
        </a>
        <p className="home-tags" aria-hidden="true">
          Pronos<i>•</i>Analyses<i>•</i>Résultats
        </p>

        <span className="home-gap" />

        <section className="home-perf" aria-labelledby="home-perf-title">
          <h2 id="home-perf-title">
            Performances <small>(30 derniers jours)</small>
            {isDemo && <span className="home-perf__demo">Démo</span>}
          </h2>
          {s.total === 0 ? (
            <p className="home-perf__empty">Aucun pronostic publié sur les 30 derniers jours.</p>
          ) : (
            <div className="home-perf__grid">
              <div className="home-perf__cell">
                <strong className="home-perf__value">{fmtInt(s.total)}</strong>
                <span className="home-perf__label">Pronostics</span>
              </div>
              <div className="home-perf__cell">
                <strong className={cn("home-perf__value", s.gagnes > 0 && "is-green")}>{fmtInt(s.gagnes)}</strong>
                <span className="home-perf__label">Gagnés</span>
              </div>
              <div className="home-perf__cell">
                <strong className={cn("home-perf__value", s.reussite !== null && "is-green")}>
                  {fmtPercent(s.reussite)}
                </strong>
                <span className="home-perf__label">Réussite</span>
              </div>
            </div>
          )}
          {real ? (
            <p className="home-perf__money">
              <strong className={real.benefice >= 0 ? "is-green" : "is-red"}>{fmtEuros(real.benefice, true)}</strong>
              de gains réels{real.complet ? "" : "*"}
              {s.enAttente > 0 && <span> · {s.enAttente} en attente</span>}
            </p>
          ) : (
            s.enAttente > 0 && (
              <p className="home-perf__note">
                dont {s.enAttente} en attente de résultat (non {s.enAttente > 1 ? "comptés" : "compté"})
              </p>
            )
          )}
        </section>

        <span className="home-gap" />

        <nav className="home-links" aria-label="Accès rapides">
          {LINKS.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="home-link"
              onPointerEnter={prefetchDashboard}
              onTouchStart={prefetchDashboard}
            >
              <Icon className="home-link__icon" strokeWidth={1.8} aria-hidden="true" />
              <span>{label}</span>
              <ArrowRight className="home-link__arrow" strokeWidth={1.8} aria-hidden="true" />
            </Link>
          ))}
        </nav>
      </main>
    </div>
  );
}
