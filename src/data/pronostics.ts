import type { Pronostic } from "@/lib/stats";

/**
 * REGISTRE OFFICIEL DES PRONOSTICS BECTANCEMAX
 * ─────────────────────────────────────────────
 * C'est la SEULE source des statistiques affichées sur le site (accueil, stats, période, historique).
 * Les visiteurs le consultent en lecture seule : il n'est modifiable qu'ici, dans le code.
 *
 * Pour ajouter un prono : copier une ligne, changer id / date / match / sélection / cote.
 * Quand le match est terminé : passer `statut` à "gagne", "perdu" ou "annule" (pari remboursé).
 *   - "en_attente" → affiché, mais jamais compté comme gagné ou perdu.
 *   - cote : décimale, celle réellement prise. Laisser null si inconnue
 *     (le bénéfice théorique ne sera alors pas affiché, faute de données).
 *   - miseEuros : facultatif, mise réelle en euros. Affiche les « gains réels » (bénéfice net,
 *     misé, encaissé) sur l'accueil, les stats, la période et l'historique. Sans mise, le prono
 *     compte dans les stats mais pas dans les montants en euros (calcul partiel signalé).
 */
export const PRONOSTICS: Pronostic[] = [
  // ── 10 novembre 2026 : « PERFECT » (3/3), bilan annoncé dans la vidéo Sabalenka–Andreeva ──
  {
    id: "2026-11-10-gauff-noskova",
    date: "2026-11-10",
    sport: "tennis",
    competition: "WTA Finals",
    match: "Gauff – Noskova",
    selection: "Victoire Noskova",
    cote: 2.33, // cote prise (la vidéo annonçait 2,40)
    statut: "gagne", // Noskova gagne 6-3 6-3
    miseEuros: 125, // retour 291,25 € (gain net 166,25 €)
  },
  {
    id: "2026-11-10-fritz-norrie",
    date: "2026-11-10",
    sport: "tennis",
    match: "Fritz – Norrie",
    selection: "Fritz gagne 2 sets à 0",
    cote: 1.84,
    statut: "gagne",
    miseEuros: 180, // retour 331,20 € (gain net 151,20 €)
  },
  {
    id: "2026-11-10-tabilo",
    date: "2026-11-10",
    sport: "tennis",
    match: "Alejandro Tabilo", // adversaire à compléter
    selection: "Victoire Tabilo",
    cote: 2.13,
    statut: "gagne", // prono annoncé en privé aux membres
    miseEuros: 80, // retour 170,40 € (gain net 90,40 €)
  },
  // ── 11 novembre 2026 ──
  {
    id: "2026-11-11-sabalenka-andreeva",
    date: "2026-11-11",
    sport: "tennis",
    competition: "Indian Wells",
    match: "Sabalenka – Andreeva",
    selection: "Victoire Andreeva",
    cote: 1.87,
    statut: "en_attente",
    // miseEuros: à ajouter (ex. 100) pour l'inclure dans les gains réels une fois terminé
  },
];
