// Motion design de Carreau (F11) : le dessin vient TOUJOURS de ../mascotte/carreau.js ; ce module ne fait que le
// placer, le déformer et l'animer image par image (temps virtuel, appelé depuis window.placer(ms)).
// Écrasement et étirement (échelles X/Y opposées, pied au sol comme pivot), anticipation et dépassement (courbes des
// positions clés), rebonds, secousses, gonflement, effondrement, coups de bras, clignements, traînée de fantômes.
import { carreau } from '../mascotte/carreau.js';

// Courbes : u de 0 à 1.
export const COURBES = {
  lin: (u) => u,
  doux: (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2),
  sortie: (u) => 1 - Math.pow(1 - u, 3),
  entree: (u) => u * u * u,
  back: (u) => { const c1 = 2.2, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); }, // dépassement puis retour
  rebond: (u) => { const n = 7.5625, d = 2.75; if (u < 1 / d) return n * u * u; if (u < 2 / d) return n * (u -= 1.5 / d) * u + 0.75; if (u < 2.5 / d) return n * (u -= 2.25 / d) * u + 0.9375; return n * (u -= 2.625 / d) * u + 0.984375; },
};
const borne = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
// Ressort amorti : impulsion qui oscille et s'éteint (dt en ms).
const ressort = (dt, amort = 110, periode = 60) => (dt < 0 ? 0 : Math.exp(-dt / amort) * Math.cos(dt / periode));

// Piste de positions : [{ t, x, y, r = 0, s = 1, e = 'doux' }] ; e = courbe du segment qui ARRIVE à cette clé.
export function piste(cles) {
  return (ms) => {
    let i = 0; while (i < cles.length - 1 && cles[i + 1].t <= ms) i++;
    const a = cles[i], b = cles[Math.min(i + 1, cles.length - 1)];
    if (b === a || ms <= a.t) return { x: a.x, y: a.y, r: a.r || 0, s: a.s ?? 1 };
    const u = (COURBES[b.e || 'doux'])(borne((ms - a.t) / (b.t - a.t)));
    const m = (k, d) => (a[k] ?? d) + ((b[k] ?? d) - (a[k] ?? d)) * u;
    return { x: m('x', 0), y: m('y', 0), r: m('r', 0), s: m('s', 1) };
  };
}

// Crée Carreau dans `parent`. Options : taille, cles, etats [[t, expression, pose, couleur?]], cligne [[de, a]],
// evenements [{ t, type, f, d, fin }] : ecrase (atterrissage), etire (démarrage), gonfle (jusqu'à fin), tremble
// (jusqu'à fin), effondre (reste écrasé), coup (coup de bras : rotation sèche), hop (petit saut sur place).
export function creerCarreau(parent, { taille = 300, cles, etats, cligne = [], evenements = [], fantomes = 3 }) {
  const H = taille * 380 / 320; // hauteur du dessin
  const ox = taille / 2, oy = H * 0.915; // pivot : entre les pieds
  const mk = (z, op) => { const d = document.createElement('div'); Object.assign(d.style, { position: 'absolute', left: 0, top: 0, zIndex: z, transformOrigin: `${ox}px ${oy}px`, opacity: op, willChange: 'transform' }); parent.appendChild(d); return d; };
  const traine = Array.from({ length: fantomes }, (_, i) => mk(78 - i, 0));
  const el = mk(80, 1);
  const pos = piste(cles);
  let cle = '';
  const etatA = (ms) => { let e = etats[0]; for (const x of etats) if (x[0] <= ms) e = x; return e; };
  function deformation(ms, pose, expr) {
    let sx = 1, sy = 1, g = 1, r = 0, dx = 0, dy = 0;
    for (const ev of evenements) {
      const dt = ms - ev.t; if (dt < 0) continue;
      const f = ev.f ?? 0.25;
      if (ev.type === 'ecrase' && dt < 700) { const k = f * ressort(dt, 120, 55); sx += k; sy -= k; }
      if (ev.type === 'etire' && dt < 500) { const k = f * ressort(dt, 90, 70); sx -= k * 0.7; sy += k; }
      if (ev.type === 'hop' && dt < 420) { const u = dt / 420; dy -= Math.sin(Math.PI * u) * (ev.h ?? 60); const k = u < 0.15 ? -f * (1 - u / 0.15) : (u > 0.8 ? f * ressort((u - 0.8) * 420, 60, 40) : -f * 0.4); sx -= k * 0.6; sy += k; }
      if (ev.type === 'gonfle') {
        const fin = ev.fin ?? Infinity;
        if (ms < fin) { const u = COURBES.back(borne(dt / (ev.d ?? 320))); g *= 1 + f * u; dx += Math.sin(ms / 19) * 5; dy += Math.cos(ms / 23) * 4; }
        else { const k = ressort(ms - fin, 140, 60); g *= 1 + f * k; }
      }
      if (ev.type === 'tremble' && ms < (ev.fin ?? Infinity)) { const a = ev.a ?? 8; dx += Math.sin(ms / 17) * a; dy += Math.cos(ms / 13) * a * 0.5; r += Math.sin(ms / 29) * (ev.ar ?? 5); }
      if (ev.type === 'effondre') { const u = COURBES.rebond(borne(dt / (ev.d ?? 520))); sx += f * 0.8 * u; sy -= f * u; }
      if (ev.type === 'coup' && dt < 600) { r += dt < 110 ? -28 * (dt / 110) : -28 * ressort(dt - 110, 120, 45); }
    }
    if (pose === 'court') { const p = Math.abs(Math.sin(ms / 95)); dy -= p * 22; sy -= (1 - p) * 0.06; sx += (1 - p) * 0.05; } // foulées
    else if (expr !== 'panique') { dy -= Math.abs(Math.sin(ms / 300)) * 5; sy += Math.sin(ms / 300) * 0.012; } // respiration
    return { sx, sy, g, r, dx, dy };
  }
  function dessiner(d, expr, pose, couleur) { const k = expr + pose + (couleur || ''); if (d.dataset.k !== k) { d.innerHTML = carreau({ expression: expr, pose, couleur, taille }); d.dataset.k = k; } }
  function transforme(ms, d, expr, pose) {
    const p = pos(ms); const f = deformation(ms, pose, expr);
    d.style.transform = `translate(${p.x + f.dx}px, ${p.y + f.dy}px) rotate(${p.r + f.r}deg) scale(${p.s * f.g * f.sx}, ${p.s * f.g * f.sy})`;
    return p;
  }
  return (ms) => {
    let [, expr, pose, couleur] = etatA(ms);
    if (cligne.some(([a, b]) => ms >= a && ms < b) && expr !== 'panique') expr = 'soulage';
    dessiner(el, expr, pose, couleur);
    const p = transforme(ms, el, expr, pose);
    // Traînée : copies aux positions passées quand Carreau file vite.
    const q = pos(ms - 50); const v = Math.hypot(p.x - q.x, p.y - q.y);
    traine.forEach((d, i) => {
      if (v > 14) { dessiner(d, expr, pose, couleur); transforme(ms - 45 * (i + 1), d, expr, pose); d.style.opacity = String([0.38, 0.22, 0.1][i] ?? 0.08); }
      else d.style.opacity = '0';
    });
    cle = expr + pose;
    return p;
  };
}

// Bulle : rectangle blanc, bord encre, pointe triangulaire ; apparition avec dépassement.
export function creerBulles(el, bulles) {
  return (ms) => {
    const b = bulles.find((x) => ms >= x.de && ms < x.a);
    if (!b) { el.style.display = 'none'; return; }
    if (el.dataset.t !== b.texte) { el.innerHTML = b.texte; el.dataset.t = b.texte; el.className = 'bulle' + (b.d ? ' d' : ''); el.style.setProperty('--px', b.px + 'px'); }
    const u = borne((ms - b.de) / 260);
    const fin = borne((b.a - ms) / 120);
    Object.assign(el.style, { maxWidth: (b.w || 640) + 'px', display: 'block', left: b.x + 'px', top: b.y + 'px', transform: `scale(${(0.4 + 0.6 * COURBES.back(u)) * (0.85 + 0.15 * fin)})`, opacity: String(Math.min(1, u * 3, fin)) });
  };
}

// Temps musicaux : la musique démarre sur un temps (rendu.mjs, choisirMusique), les temps tombent à k × 60 / bpm.
export const temps = (bpm) => (k) => k * 60000 / bpm;
// « Claque » d'un élément sur un temps : arrivée en grand puis retour avec dépassement ; 0 avant t.
export function claque(ms, t, f = 0.5) { const dt = ms - t; if (dt < 0) return { o: 0, s: 1 + f }; const u = borne(dt / 260); return { o: Math.min(1, dt / 60), s: 1 + f * (1 - COURBES.back(u)) }; }
// Pulsation sur chaque temps entre de et a (élément déjà visible).
export function pulse(ms, de, a, periode, f = 0.06) { if (ms < de || ms > a) return 1; const dt = (ms - de) % periode; return 1 + f * ressort(dt, 90, 1e9); }
// Domino : chute d'un élément (rotation autour d'un coin et gravité) à partir de t.
export function chute(ms, t, sens = 1) { const dt = (ms - t) / 1000; if (dt <= 0) return ''; return `translateY(${Math.round(2600 * dt * dt)}px) rotate(${sens * Math.min(28, dt * 140)}deg)`; }
// Envol : un onglet s'envole en tournoyant.
export function envol(ms, t, i) { const dt = (ms - t) / 1000; if (dt <= 0) return ''; return `translate(${(i % 2 ? 1 : -1) * 420 * dt}px, ${-500 * dt + 2600 * dt * dt}px) rotate(${(i % 2 ? 1 : -1) * 540 * dt}deg)`; }
