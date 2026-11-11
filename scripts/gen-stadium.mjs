// Génère l'arrière-plan « stade de nuit en noir et blanc » de l'accueil.
// Image 100 % procédurale (aucune photo tierce) : tribunes, toit, projecteurs, pelouse, grain.
//   npm run stadium   →   src/assets/stadium.webp
import sharp from "sharp";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const W = 1200;
const H = 1000;
const CX = W / 2;

let seed = 7;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);

// Ellipse de la « cuvette » : plus ry est petit, plus la courbe est proche de la pelouse.
const BOWL_CY = 900;
const BOWL_RX = 980;
const yOn = (ry, x) => {
  const t = (x - CX) / BOWL_RX;
  return BOWL_CY - ry * Math.sqrt(Math.max(0, 1 - t * t));
};
const arc = (ry, step = 20) => {
  const pts = [];
  for (let x = -40; x <= W + 40; x += step) pts.push(`${x.toFixed(1)},${yOn(ry, x).toFixed(1)}`);
  return pts;
};
const band = (ryTop, ryBottom) => {
  const top = arc(ryTop);
  const bottom = arc(ryBottom).reverse();
  return `M${top.join(" L")} L${bottom.join(" L")} Z`;
};

// Rangées de sièges : fines lignes concentriques
const rows = [];
for (let ry = 640; ry > 330; ry -= 7) {
  if (ry < 520 && ry > 500) continue; // coursive entre les deux anneaux
  rows.push(`<polyline points="${arc(ry, 30).join(" ")}" />`);
}

// Spectateurs : petits points de gris aléatoires dans les deux anneaux
const crowd = [];
for (let i = 0; i < 16000; i++) {
  const x = rnd() * W;
  const ring = rnd() < 0.55 ? [640, 525] : [498, 352];
  const ry = ring[1] + rnd() * (ring[0] - ring[1]);
  const y = yOn(ry, x);
  const g = Math.floor(70 + rnd() * 150);
  const r = 0.7 + rnd() * 1.2;
  crowd.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="rgb(${g},${g},${g})" opacity="${(0.12 + rnd() * 0.38).toFixed(2)}"/>`);
}

// Rampes de projecteurs (gauche / droite), légèrement inclinées comme le toit
const lamps = (ox, oy, tilt) => {
  const out = [];
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 9; c++) {
      const x = ox + c * 12 + r * 2;
      const y = oy + r * 8 + c * tilt;
      out.push(`<rect x="${x}" y="${y}" width="7" height="4" rx="1.2" />`);
    }
  return out.join("");
};
const roofEdge = arc(690, 10);

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="haze" cx="50%" cy="30%" r="70%">
      <stop offset="0" stop-color="#4a4a4a"/>
      <stop offset="0.55" stop-color="#1b1b1b"/>
      <stop offset="1" stop-color="#050505"/>
    </radialGradient>
    <linearGradient id="standShade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2c2c2c"/>
      <stop offset="1" stop-color="#121212"/>
    </linearGradient>
    <radialGradient id="pitch" cx="50%" cy="0%" r="90%">
      <stop offset="0" stop-color="#3a3a3a"/>
      <stop offset="0.6" stop-color="#1a1a1a"/>
      <stop offset="1" stop-color="#090909"/>
    </radialGradient>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000" stop-opacity="0"/>
      <stop offset="0.55" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.95"/>
    </linearGradient>
    <radialGradient id="vignette" cx="50%" cy="38%" r="75%">
      <stop offset="0.55" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.85"/>
    </radialGradient>
    <filter id="bloom" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter>
    <filter id="bloomWide" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="55"/></filter>
    <filter id="soft"><feGaussianBlur stdDeviation="0.9"/></filter>
    <filter id="photo"><feGaussianBlur stdDeviation="0.7"/></filter>
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="4" result="n"/>
      <feColorMatrix in="n" type="saturate" values="0"/>
    </filter>
  </defs>

  <g filter="url(#photo)">
  <rect width="${W}" height="${H}" fill="url(#haze)"/>

  <!-- Tribunes -->
  <path d="${band(690, 340)}" fill="url(#standShade)"/>
  <g filter="url(#soft)">${crowd.join("")}</g>
  <g fill="none" stroke="#000" stroke-opacity="0.35" stroke-width="1">${rows.join("")}</g>
  <!-- Coursive lumineuse entre les deux anneaux -->
  <polyline points="${arc(512, 10).join(" ")}" fill="none" stroke="#bdbdbd" stroke-opacity="0.35" stroke-width="3"/>
  <polyline points="${arc(503, 10).join(" ")}" fill="none" stroke="#000" stroke-opacity="0.55" stroke-width="6"/>

  <!-- Panneaux en bord de terrain -->
  <polyline points="${arc(338, 10).join(" ")}" fill="none" stroke="#d9d9d9" stroke-opacity="0.5" stroke-width="5"/>

  <!-- Pelouse -->
  <path d="M-40,${H + 40} L${arc(334, 10).join(" L")} L${W + 40},${H + 40} Z" fill="url(#pitch)"/>
  <g stroke="#fff" stroke-opacity="0.035" stroke-width="38">
    ${Array.from({ length: 13 }, (_, i) => {
      const xb = -600 + i * 200;
      return `<line x1="${CX + (xb - CX) * 0.22}" y1="${yOn(330, CX)}" x2="${xb}" y2="${H}"/>`;
    }).join("")}
  </g>

  <!-- Toit -->
  <path d="M-40,-40 L${W + 40},-40 L${roofEdge.reverse().join(" L")} Z" fill="#060606"/>
  <polyline points="${arc(690, 10).join(" ")}" fill="none" stroke="#6b6b6b" stroke-opacity="0.7" stroke-width="2"/>
  <g stroke="#121212" stroke-width="1.5">
    ${Array.from({ length: 14 }, (_, i) => {
      const x = -60 + i * 95;
      return `<line x1="${CX + (x - CX) * 1.6}" y1="-20" x2="${x}" y2="${yOn(690, x)}"/>`;
    }).join("")}
  </g>

  </g>
  <!-- Projecteurs -->
  <g fill="#fff" opacity="0.7" filter="url(#bloomWide)">
    <ellipse cx="205" cy="${yOn(690, 205) + 22}" rx="120" ry="60"/>
    <ellipse cx="${W - 205}" cy="${yOn(690, W - 205) + 22}" rx="120" ry="60"/>
  </g>
  <g fill="#fff" filter="url(#bloom)">${lamps(145, yOn(690, 145) + 6, 0.9)}${lamps(W - 265, yOn(690, W - 265) + 13, -0.9)}</g>
  <g fill="#fff">${lamps(145, yOn(690, 145) + 6, 0.9)}${lamps(W - 265, yOn(690, W - 265) + 13, -0.9)}</g>

  <!-- Voile lumineux sur les tribunes -->
  <ellipse cx="${CX}" cy="420" rx="760" ry="150" fill="#fff" opacity="0.06" filter="url(#bloomWide)"/>

  <!-- Grain, vignette, fondu bas -->
  <rect width="${W}" height="${H}" filter="url(#grain)" opacity="0.07"/>
  <rect width="${W}" height="${H}" fill="url(#vignette)"/>
  <rect width="${W}" height="${H}" fill="url(#fade)"/>
</svg>`;

const out = new URL("../src/assets/stadium.webp", import.meta.url);
const buf = await sharp(Buffer.from(svg)).grayscale().webp({ quality: 70, effort: 6 }).toBuffer();
writeFileSync(fileURLToPath(out), buf);
const preview = process.argv[2]; // option : chemin d'un aperçu PNG
if (preview) await sharp(buf).png().toFile(preview);
console.log(`stadium.webp : ${(buf.length / 1024).toFixed(1)} Ko`);
