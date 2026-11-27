// Carreau, mascotte QME (format F11 du test des formats, fiche du 24/11/2026, à valider par Quentin).
// Une cellule de tableur qui s'est échappée de son tableur. Uniquement des formes Bauhaus (carré, cercles, triangle,
// traits) et la palette du kit. Usage : carreau({ expression, pose, couleur }) renvoie un <svg> en texte.
// expressions : neutre, inquiet, panique, soulage, fier ; poses : debout, court, montre.
const PALETTE = { encre: '#141414', papier: '#F0EDE6', rouge: '#D9302A', jaune: '#F5B400', bleu: '#1D4E89', blanc: '#FFFFFF' };

function carreau({ expression = 'neutre', pose = 'debout', couleur, taille = 320 } = {}) {
  const P = PALETTE;
  const fond = couleur || (expression === 'panique' ? P.rouge : P.jaune);
  const trait = 9;
  // Corps : la cellule (carré 200 × 200), ombre pleine, petite étiquette « A1 ».
  const incl = pose === 'court' ? -8 : 0;
  const corps = `
    <g transform="rotate(${incl} 160 150)">
      <rect x="66" y="56" width="200" height="200" fill="${P.encre}"/>
      <rect x="56" y="46" width="200" height="200" fill="${fond}" stroke="${P.encre}" stroke-width="${trait}"/>
      <rect x="56" y="46" width="46" height="30" fill="${P.encre}"/>
      <text x="79" y="68" font-family="Outfit, sans-serif" font-weight="700" font-size="20" fill="${P.papier}" text-anchor="middle">A1</text>
      ${yeux(expression, P)}
      ${bouche(expression, P)}
      ${extras(expression, P)}
    </g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 380" width="${taille}" height="${taille * 380 / 320}" role="img" aria-label="Carreau, mascotte QME : ${expression}, ${pose}">${membres(pose, P, trait)}${corps}</svg>`;
}

function yeux(e, P) {
  const oeil = (cx, cy, r, pupille, dx = 0, dy = 0) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${P.blanc}" stroke="${P.encre}" stroke-width="6"/>` + (pupille ? `<circle cx="${cx + dx}" cy="${cy + dy}" r="${pupille}" fill="${P.encre}"/>` : '');
  switch (e) {
    case 'inquiet': return oeil(118, 128, 24, 9, 4, -6) + oeil(194, 128, 24, 9, -4, -6) + `<path d="M96 96 L136 104 M216 96 L176 104" stroke="${P.encre}" stroke-width="7" stroke-linecap="square"/>`;
    case 'panique': return oeil(116, 124, 32, 6) + oeil(196, 124, 32, 6);
    case 'soulage': return `<path d="M98 130 Q118 112 138 130 M174 130 Q194 112 214 130" fill="none" stroke="${P.encre}" stroke-width="8" stroke-linecap="round"/>`;
    case 'fier': return oeil(118, 126, 24, 10, 3, 0) + `<path d="M172 128 L214 128" stroke="${P.encre}" stroke-width="8" stroke-linecap="square"/>`;
    default: return oeil(118, 126, 24, 10, 3, 2) + oeil(194, 126, 24, 10, 3, 2);
  }
}

function bouche(e, P) {
  switch (e) {
    case 'inquiet': return `<path d="M128 200 Q156 186 184 200" fill="none" stroke="${P.encre}" stroke-width="8" stroke-linecap="round"/>`;
    case 'panique': return `<rect x="136" y="180" width="40" height="40" fill="${P.encre}"/>`;
    case 'soulage': return `<path d="M120 186 Q156 222 192 186" fill="none" stroke="${P.encre}" stroke-width="8" stroke-linecap="round"/>`;
    case 'fier': return `<path d="M116 182 L196 182 L156 222 Z" fill="${P.encre}"/>`;
    default: return `<path d="M132 194 L180 194" stroke="${P.encre}" stroke-width="8" stroke-linecap="square"/>`;
  }
}

function extras(e, P) {
  switch (e) {
    case 'inquiet': return `<text x="236" y="40" font-family="Outfit, sans-serif" font-weight="800" font-size="26" fill="${P.rouge}">#REF!</text>`;
    case 'panique': return `<circle cx="262" cy="70" r="9" fill="${P.bleu}"/><circle cx="276" cy="96" r="6" fill="${P.bleu}"/><circle cx="50" cy="88" r="7" fill="${P.bleu}"/>`;
    case 'soulage': return `<circle cx="96" cy="170" r="12" fill="${P.rouge}" opacity=".35"/><circle cx="216" cy="170" r="12" fill="${P.rouge}" opacity=".35"/>`;
    case 'fier': return `<path d="M232 18 L252 52 L212 52 Z" fill="${P.rouge}" stroke="${P.encre}" stroke-width="5"/>`;
    default: return '';
  }
}

function membres(pose, P, t) {
  const l = (x1, y1, x2, y2) => `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="${P.encre}" stroke-width="${t}" stroke-linecap="square"/>`;
  const main = (cx, cy) => `<circle cx="${cx}" cy="${cy}" r="12" fill="${P.encre}"/>`;
  const pied = (x, y) => `<rect x="${x}" y="${y}" width="34" height="14" fill="${P.encre}"/>`;
  switch (pose) {
    case 'court':
      return l(110, 250, 70, 320) + pied(48, 318) + l(200, 250, 250, 300) + l(250, 300, 236, 344) + pied(226, 340)
        + l(60, 150, 22, 196) + main(22, 196) + l(258, 140, 300, 96) + main(300, 96);
    case 'montre':
      return l(120, 250, 116, 336) + pied(100, 334) + l(196, 250, 200, 336) + pied(186, 334)
        + l(56, 170, 28, 230) + main(28, 230)
        + l(258, 130, 306, 70) + main(306, 70) + `<rect x="276" y="10" width="40" height="40" fill="${P.bleu}" stroke="${P.encre}" stroke-width="5"/>`;
    default:
      return l(120, 250, 120, 336) + pied(104, 334) + l(196, 250, 196, 336) + pied(180, 334)
        + l(56, 170, 26, 236) + main(26, 236) + l(258, 170, 288, 236) + main(288, 236);
  }
}
