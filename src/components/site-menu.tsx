import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router";
import { CalendarDays, ChartNoAxesColumnIncreasing, ClipboardList, House, Menu, X } from "lucide-react";
import { TelegramIcon } from "@/components/brand/icons";
import { SITE } from "@/config/site";
import { cn } from "@/lib/utils";

const LINKS = [
  { to: "/", label: "Accueil", icon: House },
  { to: "/stats", label: "Statistiques", icon: ChartNoAxesColumnIncreasing },
  { to: "/periode", label: "Choisir une période", icon: CalendarDays },
  { to: "/historique", label: "Historique des pronostics", icon: ClipboardList },
] as const;

/** Bouton « hamburger » + panneau de navigation (rendu dans <body> via un portail). */
export function SiteMenu({ className, panelTop }: { className?: string; panelTop?: string }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const { pathname, search } = useLocation();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>("a")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        ref={button}
        type="button"
        className={cn("site-menu-btn", className)}
        aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <X size={26} strokeWidth={1.8} /> : <Menu size={28} strokeWidth={1.8} />}
      </button>
      {open &&
        createPortal(
          <>
            <div className="site-menu-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
            <nav
              ref={panel}
              id={id}
              className="site-menu-panel"
              aria-label="Menu principal"
              style={panelTop ? { top: panelTop } : undefined}
            >
              {LINKS.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={{ pathname: to, search: to === "/" ? "" : search }}
                  aria-current={pathname === to ? "page" : undefined}
                  onClick={() => setOpen(false)}
                >
                  <Icon strokeWidth={1.7} />
                  {label}
                </Link>
              ))}
              <hr />
              <a href={SITE.telegramUrl} target="_blank" rel="noopener noreferrer">
                <TelegramIcon />
                Rejoindre le Telegram
              </a>
            </nav>
          </>,
          document.body,
        )}
    </>
  );
}
