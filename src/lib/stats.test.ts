import { describe, expect, it } from "vitest";
import {
  evolution,
  filterByRange,
  lastNDays,
  netEuros,
  parseDayKey,
  sortRecent,
  summarize,
  summarizeReal,
  type Pronostic,
} from "@/lib/stats";
import { fmtEuros, fmtPercent, fmtPercentSigned, fmtRangeLong, fmtUnits } from "@/lib/format";

const p = (id: string, date: string, statut: Pronostic["statut"], cote: number | null = 2): Pronostic => ({
  id,
  date,
  sport: "football",
  match: "A – B",
  selection: "Victoire A",
  cote,
  statut,
});

const list: Pronostic[] = [
  p("1", "2026-11-01", "gagne", 1.9),
  p("2", "2026-11-03", "perdu", 2.1),
  p("3", "2026-11-03", "gagne", 1.5),
  p("4", "2026-11-08", "en_attente", 1.8),
  p("5", "2026-11-09", "annule", 2.5),
  p("6", "2026-11-15", "gagne", 2),
];

describe("filterByRange", () => {
  it("garde les bornes incluses, quel que soit l'ordre des dates", () => {
    const r = { from: parseDayKey("2026-11-10")!, to: parseDayKey("2026-11-01")! };
    expect(filterByRange(list, r).map((x) => x.id)).toEqual(["1", "2", "3", "4", "5"]);
  });
  it("ignore les dates invalides", () => {
    const bad = [...list, p("x", "2026-13-40", "gagne")];
    const r = { from: parseDayKey("2026-01-01")!, to: parseDayKey("2026-12-31")! };
    expect(filterByRange(bad, r)).toHaveLength(6);
  });
});

describe("summarize", () => {
  it("ne compte jamais les pronostics en attente ou annulés comme gagnés/perdus", () => {
    const s = summarize(filterByRange(list, { from: parseDayKey("2026-11-01")!, to: parseDayKey("2026-11-10")! }));
    expect(s).toMatchObject({ total: 5, gagnes: 2, perdus: 1, enAttente: 1, annules: 1, termines: 3 });
    expect(s.reussite).toBeCloseTo(66.667, 2);
    // +0,9 − 1 + 0,5 = +0,4 u sur 3 u engagées
    expect(s.benefice).toBe(0.4);
    expect(s.miseEngagee).toBe(3);
    // cote moyenne hors annulé : (1,9 + 2,1 + 1,5 + 1,8) / 4
    expect(s.coteMoyenne).toBeCloseTo(1.825, 5);
  });
  it("renvoie des valeurs nulles (pas de chiffres inventés) sur une période vide", () => {
    const s = summarize([]);
    expect(s).toMatchObject({ total: 0, reussite: null, benefice: null, coteMoyenne: null, roi: null });
  });
  it("n'affiche pas de bénéfice si une cote manque", () => {
    const s = summarize([p("a", "2026-11-01", "gagne", null), p("b", "2026-11-02", "perdu", 2)]);
    expect(s.benefice).toBeNull();
    expect(s.reussite).toBe(50);
  });
  it("seulement des pronostics en attente : réussite non calculée", () => {
    const s = summarize([p("a", "2026-11-01", "en_attente")]);
    expect(s.reussite).toBeNull();
    expect(s.benefice).toBeNull();
  });
});

describe("evolution", () => {
  it("cumule gagnés − perdus par jour, en partant de 0", () => {
    expect(evolution(list).map((x) => [x.key, x.solde])).toEqual([
      ["2026-10-31", 0],
      ["2026-11-01", 1],
      ["2026-11-03", 1],
      ["2026-11-15", 2],
    ]);
  });
  it("est vide sans résultat terminé", () => {
    expect(evolution([p("a", "2026-11-01", "en_attente")])).toEqual([]);
  });
});

describe("registre réel", () => {
  it("10 novembre : 3 gagnés, Sabalenka–Andreeva en attente", async () => {
    const { PRONOSTICS } = await import("@/data/pronostics");
    const s = summarize(PRONOSTICS);
    expect(s).toMatchObject({ total: 4, gagnes: 3, perdus: 0, enAttente: 1, reussite: 100 });
    // 1 unité par prono : (2,33 − 1) + (1,84 − 1) + (2,13 − 1) = +3,30 u
    expect(s.benefice).toBe(3.3);
  });
  it("gains réels en euros : 385 € misés, 792,85 € encaissés, +407,85 € nets", async () => {
    const { PRONOSTICS } = await import("@/data/pronostics");
    const r = summarizeReal(PRONOSTICS)!;
    expect(r).toMatchObject({ count: 3, termines: 3, complet: true, mise: 385, retour: 792.85, benefice: 407.85 });
    expect(r.roi).toBeCloseTo(105.94, 2);
    const noskova = PRONOSTICS.find((x) => x.id === "2026-11-10-gauff-noskova")!;
    expect(netEuros(noskova)).toBe(166.25);
  });
});

describe("summarizeReal", () => {
  const e = (statut: Pronostic["statut"], cote: number | null, miseEuros?: number): Pronostic => ({
    ...p("x", "2026-11-01", statut, cote),
    miseEuros,
  });
  it("perte = −mise ; en attente et annulés exclus", () => {
    const r = summarizeReal([e("gagne", 2, 100), e("perdu", 1.8, 50), e("en_attente", 2, 70), e("annule", 2, 40)])!;
    expect(r).toMatchObject({ count: 2, mise: 150, retour: 200, benefice: 50 });
    expect(netEuros(e("perdu", 1.8, 50))).toBe(-50);
    expect(netEuros(e("en_attente", 2, 70))).toBeNull();
  });
  it("signale un calcul partiel quand une mise manque", () => {
    const r = summarizeReal([e("gagne", 2, 100), e("perdu", 2)])!;
    expect(r).toMatchObject({ count: 1, termines: 2, complet: false });
  });
  it("null sans aucune mise renseignée (rien d'affiché)", () => {
    expect(summarizeReal([e("gagne", 2), e("perdu", 2)])).toBeNull();
  });
});

describe("utilitaires", () => {
  it("lastNDays inclut aujourd'hui", () => {
    const r = lastNDays(30, new Date(2026, 10, 30, 15));
    expect([r.from.getDate(), r.to.getDate()]).toEqual([1, 30]);
  });
  it("sortRecent trie du plus récent au plus ancien", () => {
    expect(sortRecent(list)[0].id).toBe("6");
  });
  it("formats français", () => {
    expect(fmtPercent(66.6667)).toBe("66,7 %");
    expect(fmtPercent(100)).toBe("100 %");
    expect(fmtUnits(0.4)).toBe("+0,40 u");
    expect(fmtUnits(-1)).toBe("−1,00 u");
    expect(fmtEuros(407.85, true)).toBe("+407,85 €");
    expect(fmtEuros(-125, true)).toBe("−125,00 €");
    expect(fmtEuros(792.85)).toBe("792,85 €");
    expect(fmtPercentSigned(105.94)).toBe("+105,9 %");
    expect(fmtRangeLong({ from: new Date(2026, 10, 1), to: new Date(2026, 10, 10) })).toBe(
      "Du 1 novembre au 10 novembre 2026",
    );
  });
});
