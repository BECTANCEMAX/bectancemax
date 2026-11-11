# BECTANCEMAX — site (accueil, statistiques, période, historique)

React 19 + TypeScript + Vite + Tailwind CSS v4, structure shadcn/ui (`components.json`, alias `@/`, `src/components/ui/`).

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # site statique dans dist/ (à déposer sur n'importe quel hébergeur)
npm test         # tests des calculs de statistiques
```

## Mise en ligne — GitHub Pages

Site public : **https://bectancemax.github.io/bectancemax/** (dépôt `BECTANCEMAX/bectancemax`).

- Chaque `git push` sur `main` lance `.github/workflows/deploy.yml` : installation, tests, build, publication (~1–2 min, suivi dans l'onglet « Actions »).
- Une seule fois : *Settings → Pages → Build and deployment → Source : **GitHub Actions***.
- Chemins : `base: "./"` (vite.config.ts) + liens en `#/…` → le site fonctionne sous `/bectancemax/` sans réglage serveur
  (Accueil `#/`, Statistiques `#/stats`, Période `#/periode`, Historique `#/historique`).
- Pour tester le build comme sur Pages : `npm run build && npx vite preview --base /bectancemax/` puis ouvrir `http://localhost:4173/bectancemax/`.

## ⚠️ À faire avant la mise en ligne

1. ~~Lien Telegram~~ : renseigné (`https://t.me/+M9qrlCYNm0U0OGM0`) dans `src/config/site.ts`
   (modifiable sans toucher au code via `VITE_TELEGRAM_URL` dans un fichier `.env`).
2. **Résultats** : passer les pronos terminés de `"en_attente"` à `"gagne"` / `"perdu"` dans `src/data/pronostics.ts`.

## Pages

| URL | Contenu |
|---|---|
| `#/` | Accueil (maquette « Écran d'accueil ») — tient sur un seul écran de téléphone, sans défilement |
| `#/stats` | Dashboard Glass : 7 j / 30 j / période personnalisée, cartes, courbe, derniers pronos |
| `#/periode` | Calendrier Glass (début + fin) ; résultats recalculés en direct ; « Appliquer la période » |
| `#/historique` | Tous les pronos, filtres Gagnés / Perdus / En attente, recherche, export CSV |

Une période est partageable : `#/stats?du=2026-11-01&au=2026-11-10`.

## Données — `src/data/pronostics.ts`

Seule source des chiffres du site (les visiteurs ne peuvent rien modifier). Un prono :

```ts
{ id: "2026-11-12-psg-om", date: "2026-11-12", sport: "football", competition: "Ligue 1",
  match: "PSG – Marseille", selection: "Victoire PSG", cote: 1.85, statut: "en_attente", miseEuros: 100 }
```

Règles de calcul (`src/lib/stats.ts`, testées) :
- `en_attente` : affiché, jamais compté comme gagné ou perdu ;
- `annule` : pari remboursé, hors réussite et hors mise ;
- réussite = gagnés / (gagnés + perdus) ;
- bénéfice **théorique** = mise fixe de 1 unité à la cote publiée ; masqué si une cote manque ; jamais présenté comme un gain encaissé ;
- gains **réels** (€) = calculés avec `miseEuros` : gagné → mise × (cote − 1), perdu → − mise.
  « Encaissé » = mise × cote (mise incluse). Un prono sans `miseEuros` est exclu des montants,
  et l'écran le signale (« calculé sur X des Y pronostics ») ;
- période sans prono → état vide, aucun chiffre affiché.

## Mode démonstration

`http://localhost:5173/?demo#/stats` (ou `VITE_DEMO=1`) remplace le registre par un jeu **fictif**
pour prévisualiser les graphiques. Un badge « Données de démonstration » s'affiche alors. Jamais actif par défaut.

## Composants

- `src/components/ui/adjustable-glass-dashboard.tsx` — dashboard Glass fourni, adapté (pronostics, mobile, onglets bas).
- `src/components/ui/glass-calendar.tsx` — calendrier Glass fourni, + sélection de période, vue Mensuel, raccourcis.
- `src/pages/Home.tsx` + `home.css` — accueil ; tailles interpolées selon la hauteur d'écran (548 → 860 px).
- `scripts/gen-stadium.mjs` — génère le stade noir et blanc (`src/assets/stadium.webp`, 37 Ko, 100 % procédural).
