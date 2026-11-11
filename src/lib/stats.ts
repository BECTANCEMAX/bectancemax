// Statistiques BECTANCEMAX — fonctions pures, sans dépendance, testées (stats.test.ts).
//
// Règles :
//  - un pronostic « en_attente » n'est jamais compté comme gagné ou perdu ;
//  - un pronostic « annule » (match annulé, pari remboursé) n'entre ni dans la réussite ni dans la mise ;
//  - réussite = gagnés / (gagnés + perdus) ;
//  - bénéfice théorique = mise × (cote − 1) si gagné, − mise si perdu (mise par défaut : 1 unité).
//    Il n'est calculé que si TOUS les pronostics terminés de la période ont une cote : sinon null.

export type Sport = "football" | "tennis";
export type StatutPronostic = "gagne" | "perdu" | "en_attente" | "annule";

export interface Pronostic {
  /** Identifiant unique et stable (ex. "2026-11-10-gauff-noskova"). */
  id: string;
  /** Date du match, au format "AAAA-MM-JJ". */
  date: string;
  sport: Sport;
  competition?: string;
  /** Affiche du match, ex. "Gauff – Noskova". */
  match: string;
  /** Le pronostic publié, ex. "Victoire Noskova". */
  selection: string;
  /** Cote décimale au moment de la publication (null si inconnue). */
  cote: number | null;
  statut: StatutPronostic;
  /** Mise conseillée en unités (1 par défaut). */
  mise?: number;
  /**
   * Mise réellement engagée, en euros (facultatif). Sert aux « gains réels » affichés en euros
   * (bénéfice net, total misé, total encaissé). Sans elle, le prono n'entre pas dans ces montants.
   */
  miseEuros?: number;
}

export interface RealSummary {
  /** Pronostics terminés (gagnés/perdus) dont la mise réelle est renseignée. */
  count: number;
  /** Pronostics terminés au total : count < termines ⇒ calcul partiel, signalé à l'écran. */
  termines: number;
  complet: boolean;
  /** Total misé (€). */
  mise: number;
  /** Total encaissé (€), mise incluse — ce que l'appli du bookmaker affiche comme « gain ». */
  retour: number;
  /** Bénéfice net (€) = encaissé − misé. */
  benefice: number;
  /** Bénéfice / misé × 100. */
  roi: number;
}

export interface DayRange {
  from: Date;
  to: Date;
}

export interface Summary {
  /** Tous les pronostics publiés sur la période (y compris en attente et annulés). */
  total: number;
  gagnes: number;
  perdus: number;
  enAttente: number;
  annules: number;
  /** gagnés + perdus */
  termines: number;
  /** Pourcentage 0–100, null si aucun pronostic terminé. */
  reussite: number | null;
  /** Moyenne des cotes renseignées (hors annulés), null si aucune. */
  coteMoyenne: number | null;
  /** Bénéfice théorique en unités, null si données insuffisantes. */
  benefice: number | null;
  /** Unités engagées sur les pronostics terminés (gagnés + perdus). */
  miseEngagee: number;
  /** Bénéfice / mise engagée × 100, null si non calculable. */
  roi: number | null;
}

export interface EvolutionPoint {
  key: string;
  /** Solde cumulé gagnés − perdus à la fin de la journée. */
  solde: number;
  /** Bénéfice théorique cumulé (null si une cote manque). */
  benefice: number | null;
}

const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseDayKey(key: string): Date | null {
  const m = DAY_KEY.exec(key);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = new Date(y, mo, Number(m[3]));
  return d.getFullYear() === y && d.getMonth() === mo && d.getDate() === Number(m[3]) ? d : null;
}

export function dayKey(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function startOfDayLocal(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** Les n derniers jours, aujourd'hui inclus. */
export function lastNDays(n: number, today: Date = new Date()): DayRange {
  const to = startOfDayLocal(today);
  return { from: addDays(to, -(Math.max(1, n) - 1)), to };
}

export function isValidPronostic(p: Pronostic): boolean {
  return parseDayKey(p.date) !== null;
}

const validCote = (c: number | null | undefined): c is number =>
  typeof c === "number" && Number.isFinite(c) && c >= 1;
const stake = (p: Pronostic) =>
  typeof p.mise === "number" && Number.isFinite(p.mise) && p.mise > 0 ? p.mise : 1;

export function filterByRange(list: readonly Pronostic[], range: DayRange): Pronostic[] {
  let a = dayKey(range.from);
  let b = dayKey(range.to);
  if (a > b) [a, b] = [b, a];
  return list.filter((p) => isValidPronostic(p) && p.date >= a && p.date <= b);
}

/** Du plus récent au plus ancien. */
export function sortRecent(list: readonly Pronostic[]): Pronostic[] {
  return list
    .filter(isValidPronostic)
    .slice()
    .sort((x, y) => (x.date === y.date ? y.id.localeCompare(x.id) : y.date.localeCompare(x.date)));
}

export function summarize(list: readonly Pronostic[]): Summary {
  let gagnes = 0;
  let perdus = 0;
  let enAttente = 0;
  let annules = 0;
  let coteSum = 0;
  let coteCount = 0;
  let benefice = 0;
  let beneficeOk = true;
  let miseEngagee = 0;

  for (const p of list) {
    if (p.statut !== "annule" && validCote(p.cote)) {
      coteSum += p.cote;
      coteCount += 1;
    }
    switch (p.statut) {
      case "gagne":
        gagnes += 1;
        miseEngagee += stake(p);
        if (validCote(p.cote)) benefice += stake(p) * (p.cote - 1);
        else beneficeOk = false;
        break;
      case "perdu":
        perdus += 1;
        miseEngagee += stake(p);
        benefice -= stake(p);
        if (!validCote(p.cote)) beneficeOk = false;
        break;
      case "annule":
        annules += 1;
        break;
      default:
        enAttente += 1;
    }
  }

  const termines = gagnes + perdus;
  const beneficeFinal = termines > 0 && beneficeOk ? round2(benefice) : null;
  return {
    total: list.length,
    gagnes,
    perdus,
    enAttente,
    annules,
    termines,
    reussite: termines > 0 ? (gagnes / termines) * 100 : null,
    coteMoyenne: coteCount > 0 ? coteSum / coteCount : null,
    benefice: beneficeFinal,
    miseEngagee,
    roi: beneficeFinal !== null && miseEngagee > 0 ? (beneficeFinal / miseEngagee) * 100 : null,
  };
}

const validEuros = (m: number | undefined): m is number =>
  typeof m === "number" && Number.isFinite(m) && m > 0;

/**
 * Gains RÉELS en euros, à partir de `miseEuros`.
 * Seuls les pronostics gagnés/perdus avec une mise renseignée (et une cote, s'ils sont gagnés) comptent.
 * En attente : jamais comptés. Annulés : remboursés, donc neutres (exclus). null si aucune donnée.
 */
export function summarizeReal(list: readonly Pronostic[]): RealSummary | null {
  let count = 0;
  let termines = 0;
  let mise = 0;
  let retour = 0;
  for (const p of list) {
    if (p.statut !== "gagne" && p.statut !== "perdu") continue;
    termines += 1;
    if (!validEuros(p.miseEuros)) continue;
    if (p.statut === "gagne") {
      if (!validCote(p.cote)) continue;
      retour += p.miseEuros * p.cote;
    }
    count += 1;
    mise += p.miseEuros;
  }
  if (!count) return null;
  const benefice = round2(retour - mise);
  return {
    count,
    termines,
    complet: count === termines,
    mise: round2(mise),
    retour: round2(retour),
    benefice,
    roi: (benefice / mise) * 100,
  };
}

/** Résultat net en euros d'un prono : +gain, −mise, 0 si annulé ; null si inconnu ou en attente. */
export function netEuros(p: Pronostic): number | null {
  if (!validEuros(p.miseEuros)) return null;
  if (p.statut === "perdu") return -p.miseEuros;
  if (p.statut === "annule") return 0;
  if (p.statut === "gagne" && validCote(p.cote)) return round2(p.miseEuros * (p.cote - 1));
  return null;
}

/**
 * Évolution jour par jour des pronostics terminés (gagnés/perdus), cumulée.
 * Le premier point est l'origine (0) à la veille du premier résultat.
 */
export function evolution(list: readonly Pronostic[]): EvolutionPoint[] {
  const settled = list
    .filter((p) => isValidPronostic(p) && (p.statut === "gagne" || p.statut === "perdu"))
    .slice()
    .sort((x, y) => x.date.localeCompare(y.date) || x.id.localeCompare(y.id));
  if (!settled.length) return [];

  const first = parseDayKey(settled[0].date)!;
  const points: EvolutionPoint[] = [{ key: dayKey(addDays(first, -1)), solde: 0, benefice: 0 }];
  let solde = 0;
  let benefice: number | null = 0;
  for (const p of settled) {
    solde += p.statut === "gagne" ? 1 : -1;
    if (benefice !== null) {
      if (!validCote(p.cote)) benefice = null;
      else benefice += p.statut === "gagne" ? stake(p) * (p.cote - 1) : -stake(p);
    }
    const last = points[points.length - 1];
    const value = { key: p.date, solde, benefice: benefice === null ? null : round2(benefice) };
    if (last.key === p.date && points.length > 1) points[points.length - 1] = value;
    else points.push(value);
  }
  return points;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
