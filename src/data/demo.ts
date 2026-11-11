import { addDays, dayKey, startOfDayLocal, type Pronostic, type StatutPronostic } from "@/lib/stats";

/**
 * JEU DE DONNÉES DE DÉMONSTRATION — fictif.
 * Utilisé UNIQUEMENT si l'URL contient « ?demo » (ex. http://localhost:5173/?demo#/stats)
 * ou si VITE_DEMO=1. Un badge « Données de démonstration » est alors affiché partout.
 * Il sert à prévisualiser les graphiques ; il ne remplace jamais le vrai registre.
 */
const FOOT: [string, string][] = [
  ["Real Madrid – Barcelone", "Victoire Real Madrid"],
  ["PSG – Marseille", "Victoire PSG"],
  ["Lyon – Lens", "Les deux équipes marquent"],
  ["Arsenal – Chelsea", "Plus de 2,5 buts"],
  ["Inter – Milan", "Victoire Inter"],
  ["Bayern – Dortmund", "Victoire Bayern"],
  ["Monaco – Lille", "Plus de 1,5 but"],
  ["Liverpool – Man City", "Les deux équipes marquent"],
];
const TENNIS: [string, string][] = [
  ["Sinner – Alcaraz", "Sinner gagne le match"],
  ["Djokovic – Zverev", "Victoire Djokovic"],
  ["Swiatek – Gauff", "Victoire Swiatek"],
  ["Rune – Fritz", "Plus de 22,5 jeux"],
  ["Sabalenka – Rybakina", "Victoire Sabalenka"],
  ["Medvedev – Draper", "Victoire Draper"],
];

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

export function buildDemoPronostics(today: Date = new Date()): Pronostic[] {
  const r = rng(20261111);
  const end = startOfDayLocal(today);
  const out: Pronostic[] = [];
  for (let back = 70; back >= -1; back--) {
    const day = addDays(end, -back);
    const count = r() < 0.32 ? 0 : r() < 0.7 ? 1 : 2;
    for (let i = 0; i < count; i++) {
      const tennis = r() < 0.45;
      const pool = tennis ? TENNIS : FOOT;
      const [match, selection] = pool[Math.floor(r() * pool.length)];
      const cote = Math.round((1.45 + r() * 1.1) * 100) / 100;
      const statut: StatutPronostic =
        back <= 0 ? "en_attente" : r() < 0.03 ? "annule" : r() < 0.64 ? "gagne" : "perdu";
      out.push({
        id: `demo-${dayKey(day)}-${i}`,
        date: dayKey(day),
        sport: tennis ? "tennis" : "football",
        match,
        selection,
        cote,
        statut,
        miseEuros: Math.round((40 + r() * 160) / 5) * 5,
      });
    }
  }
  return out;
}
