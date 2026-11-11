import * as React from "react";
import { Settings, RotateCcw, CalendarRange as CalendarRangeIcon, ChevronLeft, ChevronRight } from "lucide-react";
import {
  format,
  addMonths,
  subMonths,
  isSameDay,
  isToday,
  getDate,
  getDaysInMonth,
  startOfMonth,
  startOfDay,
  isBefore,
  getDay,
} from "date-fns";
import { fr } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// Base : composant GlassCalendar fourni (effet verre, coins arrondis, Framer Motion,
// navigation entre les mois, bande de jours défilante).
// Ajouts BECTANCEMAX : mode « range » (date de début + date de fin), vue Mensuel en grille,
// onglets Hebdo / Mensuel fonctionnels, raccourcis de période (bouton réglages),
// jours ayant des pronostics marqués d'un point, libellés en français, cibles tactiles ≥ 40 px.

// --- TYPE DEFINITIONS ---
interface Day {
  date: Date;
  isToday: boolean;
  isSelected: boolean;
  isRangeStart: boolean;
  isRangeEnd: boolean;
  isInRange: boolean;
  isMarked: boolean;
}

export interface CalendarRange {
  from: Date;
  to?: Date;
}

export interface CalendarPreset {
  label: string;
  range: () => { from: Date; to: Date };
}

interface GlassCalendarProps extends React.HTMLAttributes<HTMLDivElement> {
  selectedDate?: Date;
  onDateSelect?: (date: Date) => void;
  /** "single" (comportement d'origine) ou "range" (début + fin). */
  mode?: "single" | "range";
  selectedRange?: CalendarRange;
  onRangeSelect?: (range: CalendarRange | undefined) => void;
  /** Jours à signaler par un point, au format "AAAA-MM-JJ". */
  markedDates?: ReadonlySet<string>;
  presets?: CalendarPreset[];
  defaultView?: "weekly" | "monthly";
  className?: string;
}

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const keyOf = (d: Date) => format(d, "yyyy-MM-dd");
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// --- HELPER TO HIDE SCROLLBAR ---
const ScrollbarHide = () => (
  <style>{`
    .scrollbar-hide::-webkit-scrollbar {
      display: none;
    }
    .scrollbar-hide {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
  `}</style>
);

// --- MAIN COMPONENT ---
export const GlassCalendar = React.forwardRef<HTMLDivElement, GlassCalendarProps>(
  (
    {
      className,
      selectedDate: propSelectedDate,
      onDateSelect,
      mode = "single",
      selectedRange: propRange,
      onRangeSelect,
      markedDates,
      presets,
      defaultView = "monthly",
      ...props
    },
    ref,
  ) => {
    // Ouvre sur le mois le plus récent de la période (sa fin), comme sur la maquette.
    const [currentMonth, setCurrentMonth] = React.useState(
      propRange?.to || propRange?.from || propSelectedDate || new Date(),
    );
    const [selectedDate, setSelectedDate] = React.useState(propSelectedDate || new Date());
    const [range, setRange] = React.useState<CalendarRange | undefined>(propRange);
    const [view, setView] = React.useState<"weekly" | "monthly">(defaultView);
    const [showPresets, setShowPresets] = React.useState(false);
    const stripRef = React.useRef<HTMLDivElement>(null);

    // Synchronisation avec la période contrôlée par le parent
    const fromTime = propRange?.from?.getTime();
    const toTime = propRange?.to?.getTime();
    React.useEffect(() => {
      setRange(propRange);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fromTime, toTime]);

    // Generate all days for the current month
    const monthDays = React.useMemo(() => {
      const start = startOfMonth(currentMonth);
      const totalDays = getDaysInMonth(currentMonth);
      const from = range?.from ? startOfDay(range.from) : undefined;
      const to = range?.to ? startOfDay(range.to) : undefined;
      const days: Day[] = [];
      for (let i = 0; i < totalDays; i++) {
        const date = new Date(start.getFullYear(), start.getMonth(), i + 1);
        const isRangeStart = !!from && isSameDay(date, from);
        const isRangeEnd = (!!to && isSameDay(date, to)) || (!!from && !to && isRangeStart);
        days.push({
          date,
          isToday: isToday(date),
          isSelected: mode === "range" ? isRangeStart || isRangeEnd : isSameDay(date, selectedDate),
          isRangeStart,
          isRangeEnd,
          isInRange: !!from && !!to && date >= from && date <= to,
          isMarked: !!markedDates?.has(keyOf(date)),
        });
      }
      return days;
    }, [currentMonth, selectedDate, range, mode, markedDates]);

    const commitRange = (next: CalendarRange | undefined) => {
      setRange(next);
      onRangeSelect?.(next);
    };

    const handleDateClick = (date: Date) => {
      if (mode === "range") {
        // 1er appui : date de début. 2e appui : date de fin (inversées si besoin). 3e : nouvelle période.
        if (!range?.from || range.to) commitRange({ from: date });
        else if (isBefore(date, startOfDay(range.from))) commitRange({ from: date, to: range.from });
        else commitRange({ from: range.from, to: date });
        return;
      }
      setSelectedDate(date);
      onDateSelect?.(date);
    };

    const handlePrevMonth = () => {
      setCurrentMonth(subMonths(currentMonth, 1));
    };

    const handleNextMonth = () => {
      setCurrentMonth(addMonths(currentMonth, 1));
    };

    const applyPreset = (preset: CalendarPreset) => {
      const r = preset.range();
      commitRange(r);
      setCurrentMonth(r.to);
      setShowPresets(false);
    };

    // Vue Hebdo : centre la bande sur le début de la période, sinon sa fin, sinon aujourd'hui
    React.useEffect(() => {
      if (view !== "weekly") return;
      const strip = stripRef.current;
      if (!strip) return;
      const target =
        strip.querySelector<HTMLElement>("[data-anchor='start']") ??
        strip.querySelector<HTMLElement>("[data-anchor='end']") ??
        strip.querySelector<HTMLElement>("[data-today='true']");
      strip.scrollLeft = target ? target.offsetLeft - strip.clientWidth / 2 + target.clientWidth / 2 : 0;
    }, [view, currentMonth]);

    const dayButtonClass = (day: Day) =>
      cn(
        "relative z-[1] flex aspect-square w-full max-w-10 items-center justify-center rounded-full text-sm font-semibold transition-all duration-200",
        {
          "bg-gradient-to-br from-[#56e07c] to-[#22a447] text-white shadow-lg shadow-black/40": day.isSelected,
          "hover:bg-white/20 active:bg-white/20": !day.isSelected,
          "text-white": !day.isSelected,
          "ring-1 ring-inset ring-white/35": day.isToday && !day.isSelected,
        },
      );

    const marker = (day: Day) =>
      day.isMarked ? (
        <span
          className={cn("absolute bottom-[5px] h-1 w-1 rounded-full", day.isSelected ? "bg-white" : "bg-white/55")}
          aria-hidden="true"
        />
      ) : null;

    const dayLabel = (day: Day) =>
      `${format(day.date, "EEEE d MMMM yyyy", { locale: fr })}${day.isMarked ? ", pronostics publiés" : ""}`;

    const rangeText = (() => {
      if (mode !== "range") return format(selectedDate, "d MMMM yyyy", { locale: fr });
      if (!range?.from) return "Choisis une date de début";
      if (!range.to) return `${format(range.from, "d MMM", { locale: fr })} → choisis la date de fin`;
      return isSameDay(range.from, range.to)
        ? format(range.from, "d MMMM yyyy", { locale: fr })
        : `${format(range.from, "d MMM", { locale: fr })} → ${format(range.to, "d MMM yyyy", { locale: fr })}`;
    })();

    const leading = (getDay(startOfMonth(currentMonth)) + 6) % 7; // semaine commençant le lundi

    return (
      <div
        ref={ref}
        className={cn(
          "w-full max-w-[360px] rounded-3xl p-5 shadow-2xl overflow-hidden",
          "bg-black/20 backdrop-blur-xl border border-white/10",
          "text-white font-sans",
          className,
        )}
        {...props}
      >
        <ScrollbarHide />
        {/* Header: Tabs and Settings */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1 rounded-full bg-black/20 p-1" role="tablist" aria-label="Affichage">
            {(
              [
                ["weekly", "Hebdo"],
                ["monthly", "Mensuel"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={view === id}
                onClick={() => setView(id)}
                className={cn(
                  "min-h-9 rounded-full px-4 py-1 text-xs transition-colors",
                  view === id ? "bg-white font-bold text-black shadow-md" : "font-semibold text-white/60 hover:text-white",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {presets?.length ? (
            <button
              type="button"
              onClick={() => setShowPresets((v) => !v)}
              aria-expanded={showPresets}
              aria-label="Raccourcis de période"
              className={cn(
                "grid h-10 w-10 place-items-center rounded-full border border-white/10 text-white/70 transition-colors hover:bg-black/20",
                showPresets && "bg-white/10 text-white",
              )}
            >
              <Settings className="h-5 w-5" />
            </button>
          ) : null}
        </div>

        <AnimatePresence initial={false}>
          {showPresets && presets?.length ? (
            <motion.div
              key="presets"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap gap-2 pt-4">
                {presets.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className="min-h-9 rounded-full border border-white/10 bg-white/5 px-3 text-xs font-semibold text-white/85 transition-colors hover:bg-white/15"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Date Display and Navigation */}
        <div className="my-5 flex items-center justify-between">
          <button
            type="button"
            onClick={handlePrevMonth}
            aria-label="Mois précédent"
            className="grid h-10 w-10 place-items-center rounded-full text-white/70 transition-colors hover:bg-black/20"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <motion.p
            key={format(currentMonth, "yyyy-MM")}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="text-[clamp(1.45rem,6.4vw,1.85rem)] font-bold tracking-tight"
            aria-live="polite"
          >
            {capitalize(format(currentMonth, "LLLL yyyy", { locale: fr }))}
          </motion.p>
          <button
            type="button"
            onClick={handleNextMonth}
            aria-label="Mois suivant"
            className="grid h-10 w-10 place-items-center rounded-full text-white/70 transition-colors hover:bg-black/20"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>

        {view === "monthly" ? (
          /* Monthly grid */
          <div className="grid grid-cols-7 gap-y-1">
            {WEEKDAYS.map((w) => (
              <span key={w} className="pb-1 text-center text-xs font-bold text-white/50">
                {w}
              </span>
            ))}
            {Array.from({ length: leading }, (_, i) => (
              <span key={`blank-${i}`} aria-hidden="true" />
            ))}
            {monthDays.map((day, i) => {
              const col = (leading + i) % 7;
              const roundLeft = day.isRangeStart || col === 0 || i === 0;
              const roundRight = day.isRangeEnd || col === 6 || i === monthDays.length - 1;
              return (
                <div key={keyOf(day.date)} className="relative flex h-11 min-w-0 items-center justify-center">
                  {day.isInRange && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute inset-y-[3px] left-0 right-0 border-y border-primary/40 bg-primary/15",
                        roundLeft && "left-0.5 rounded-l-full border-l",
                        roundRight && "right-0.5 rounded-r-full border-r",
                      )}
                    />
                  )}
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleDateClick(day.date)}
                    aria-pressed={day.isSelected || day.isInRange}
                    aria-label={dayLabel(day)}
                    className={dayButtonClass(day)}
                  >
                    {getDate(day.date)}
                    {marker(day)}
                  </motion.button>
                </div>
              );
            })}
          </div>
        ) : (
          /* Scrollable Monthly Calendar Strip (vue d'origine) */
          <div ref={stripRef} className="overflow-x-auto overscroll-x-contain scrollbar-hide -mx-5 px-5 scroll-px-5">

            <div className="flex">
              {monthDays.map((day, i) => {
                const roundLeft = day.isRangeStart || i === 0;
                const roundRight = day.isRangeEnd || i === monthDays.length - 1;
                return (
                  <div
                    key={keyOf(day.date)}
                    data-anchor={
                      day.isRangeStart || (mode === "single" && day.isSelected)
                        ? "start"
                        : day.isRangeEnd
                          ? "end"
                          : undefined
                    }
                    data-today={day.isToday ? "true" : undefined}
                    className="flex w-11 flex-shrink-0 flex-col items-center space-y-2"
                  >
                    <span className="text-xs font-bold text-white/50">
                      {format(day.date, "EEEEE", { locale: fr }).toUpperCase()}
                    </span>
                    <div className="relative flex h-11 w-full items-center justify-center">
                      {day.isInRange && (
                        <span
                          aria-hidden="true"
                          className={cn(
                            "absolute inset-y-[3px] left-0 right-0 border-y border-primary/40 bg-primary/15",
                            roundLeft && "left-0.5 rounded-l-full border-l",
                            roundRight && "right-0.5 rounded-r-full border-r",
                          )}
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => handleDateClick(day.date)}
                        aria-pressed={day.isSelected || day.isInRange}
                        aria-label={dayLabel(day)}
                        className={dayButtonClass(day)}
                      >
                        {getDate(day.date)}
                        {marker(day)}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="mt-5 h-px bg-white/20" />

        {/* Footer Actions */}
        <div className="mt-4 flex items-center justify-between space-x-4">
          <p className="flex min-w-0 items-center space-x-2 text-sm font-medium text-white/70" aria-live="polite">
            <CalendarRangeIcon className="h-4 w-4 flex-none" />
            <span className="truncate">{rangeText}</span>
          </p>
          {mode === "range" && range?.from && (
            <button
              type="button"
              onClick={() => commitRange(undefined)}
              className="flex min-h-9 flex-none items-center space-x-2 rounded-lg bg-black/20 px-3 py-2 text-xs font-bold text-white shadow-md transition-colors hover:bg-black/30"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Effacer</span>
            </button>
          )}
        </div>
      </div>
    );
  },
);

GlassCalendar.displayName = "GlassCalendar";
