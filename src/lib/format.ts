// Formats français (virgule décimale, espace insécable avant %).
import { parseDayKey, type DayRange, type StatutPronostic } from "@/lib/stats";

// 1 décimale au plus : 66,7 % mais 100 % / 70 % (comme sur la maquette)
const nf1 = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat("fr-FR");

export const fmtInt = (n: number) => nf0.format(n);

/** 66.666 → "66,7 %" ; null → "—" */
export const fmtPercent = (n: number | null) => (n === null ? "—" : `${nf1.format(n)} %`);

/** 1.92 → "1,92" */
export const fmtCote = (n: number | null) =>
  n === null || !Number.isFinite(n) ? "—" : nf2.format(n);

/** 4.2 → "+4,20 u" ; null → "—" */
export const fmtUnits = (n: number | null) =>
  n === null ? "—" : `${n > 0 ? "+" : n < 0 ? "−" : ""}${nf2.format(Math.abs(n))} u`;

const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

/** 407.85 → "407,85 €" ; signed → "+407,85 €" / "−125,00 €" */
export const fmtEuros = (n: number, signed = false) =>
  `${signed && n > 0 ? "+" : n < 0 ? "−" : ""}${eur.format(Math.abs(n))}`;

/** 105.94 → "+105,9 %" */
export const fmtPercentSigned = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${fmtPercent(Math.abs(n))}`;

/** 8 → "+8" ; -3 → "−3" */
export const fmtSigned = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");

const short = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
const long = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });
const longYear = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

const asDate = (d: Date | string) => (typeof d === "string" ? parseDayKey(d) ?? new Date(NaN) : d);

/** "1 nov." */
export const fmtDayShort = (d: Date | string) => short.format(asDate(d));

/** "Du 1 novembre au 10 novembre 2026" */
export function fmtRangeLong(range: DayRange) {
  const { from, to } = range;
  if (from.toDateString() === to.toDateString()) return `Le ${longYear.format(from)}`;
  const sameYear = from.getFullYear() === to.getFullYear();
  return `Du ${(sameYear ? long : longYear).format(from)} au ${longYear.format(to)}`;
}

/** "1 nov. – 10 nov." */
export const fmtRangeShort = (range: DayRange) =>
  range.from.toDateString() === range.to.toDateString()
    ? fmtDayShort(range.from)
    : `${fmtDayShort(range.from)} – ${fmtDayShort(range.to)}`;

export const STATUT_LABEL: Record<StatutPronostic, string> = {
  gagne: "Gagné",
  perdu: "Perdu",
  en_attente: "En attente",
  annule: "Annulé",
};
