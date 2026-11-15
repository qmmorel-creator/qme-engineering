// Studio vidéo QME : API de mise en scène appelée par le moteur (docs/videos/moteur.mjs) via page.evaluate.
// - Caméra amortie : mode « suivre » (elle suit le curseur, zoomée) ou « fixe » (elle cadre une zone).
// - Curseur en coordonnées de l'application : il reste posé sur l'élément visé quand la caméra bouge.
// - Repères et emphases ancrés sur des éléments RÉELS de l'application (sélecteurs CSS dans l'iframe).
(() => {
  const $ = (s) => document.querySelector(s);
  const params = new URLSearchParams(location.search);
  const LARGEUR = Number(params.get('w') || 1280), HAUTEUR = Number(params.get('h') || 1600);
  const VUE = { l: 1000, h: 936 };
  const app = $('#app'), camera = $('#camera'), calque = $('#calque'), curseur = $('#curseur'), vue = $('#vue'), toile = $('#toile');
  app.width = LARGEUR; app.height = HAUTEUR;
  if (params.get('marque')) $('#marque-texte').textContent = params.get('marque');
  if (params.get('url')) $('#url').textContent = params.get('url');
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));
  const borne = (v, a, b) => Math.min(b, Math.max(a, v));
  const echapper = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  const mots = (texte) => texte.split(/\s+/).filter(Boolean).map((m) => {
    const fort = m.includes('*');
    const propre = echapper(m.replace(/\*/g, '').replace(/_/g, '\u00a0'));
    return { html: fort ? `<mark>${propre}</mark>` : propre, fort };
  });
  const docApp = () => app.contentDocument;
  const el = (sel) => { const e = docApp()?.querySelector(sel); if (!e) throw new Error(`Élément introuvable dans l'application : ${sel}`); return e; };
  function rectApp(sel) { const r = el(sel).getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }
  const union = (rs) => { const x = Math.min(...rs.map((r) => r.x)), y = Math.min(...rs.map((r) => r.y));
    return { x, y, w: Math.max(...rs.map((r) => r.x + r.w)) - x, h: Math.max(...rs.map((r) => r.y + r.h)) - y }; };
  const zoneDe = (z) => typeof z === 'string' ? rectApp(z) : Array.isArray(z) ? union(z.map(zoneDe)) : z;

  // ---------- Caméra ----------
  const PLAN_LARGE = VUE.l / LARGEUR;
  const cam = { cx: LARGEUR / 2, cy: VUE.h / 2 / PLAN_LARGE, s: PLAN_LARGE };
  const cible = { ...cam };
  let mode = 'fixe', zoomSuivi = 2.2, decalSuivi = 0, tau = 0.3, punch = { t0: -1e9, a: 0 };
  let applique = { x: 0, y: 0, s: cam.s };
  // Centre atteignable (la caméra ne sort jamais de l'application).
  function centreBorne(cx, cy, s) {
    const demiL = VUE.l / 2 / s, demiH = VUE.h / 2 / s;
    return {
      cx: LARGEUR * s <= VUE.l ? LARGEUR / 2 : borne(cx, demiL, LARGEUR - demiL),
      cy: HAUTEUR * s <= VUE.h ? demiH : borne(cy, demiH, HAUTEUR - demiH),
    };
  }
  function translation(cx, cy, s) { const c = centreBorne(cx, cy, s); return { x: VUE.l / 2 - c.cx * s, y: VUE.h / 2 - c.cy * s }; }
  function versToile(px, py) {
    const v = vue.getBoundingClientRect(), t = toile.getBoundingClientRect();
    return { x: v.left - t.left + applique.x + px * applique.s, y: v.top - t.top + applique.y + py * applique.s };
  }
  function cadrer(zone, { tau: t = 0.17, marge = 28, max = 2.8 } = {}) {
    mode = 'fixe'; tau = t;
    if (!zone) Object.assign(cible, { cx: LARGEUR / 2, cy: VUE.h / 2 / PLAN_LARGE, s: PLAN_LARGE });
    else {
      const z = zoneDe(zone);
      const s = Math.min((VUE.l - 2 * marge) / z.w, (VUE.h - 2 * marge) / z.h, max);
      Object.assign(cible, { cx: z.x + z.w / 2, cy: z.y + z.h / 2, s });
    }
    return attendreCamera();
  }
  function suivre(zoom = 2.2, t = 0.15, dx = -150) { mode = 'suivre'; zoomSuivi = zoom; tau = t; decalSuivi = dx; } // dx : cadre un peu à gauche du curseur (noms des lignes visibles)
  function attendreCamera(max = 2200) {
    const t0 = performance.now();
    return new Promise((fin) => {
      const test = () => {
        const c = centreBorne(cible.cx, cible.cy, cible.s), a = centreBorne(cam.cx, cam.cy, cam.s);
        const ok = Math.hypot(c.cx - a.cx, c.cy - a.cy) * cam.s < 6 && Math.abs(cible.s - cam.s) < 0.02;
        ok || performance.now() - t0 > max ? fin() : requestAnimationFrame(test);
      };
      requestAnimationFrame(test);
    });
  }
  function coup(a = 0.07) { punch = { t0: performance.now(), a }; }

  // ---------- Rythme : un battement visuel sur chaque temps de la musique ----------
  let rythmeP = 0, rythmeT0 = 0, dernierTemps = -1;
  function rythme(periodeMs, ecouleMs) { rythmeP = periodeMs; rythmeT0 = performance.now() - ecouleMs; }
  function battement(k) {
    for (const n of [$('#marque')]) { n.classList.remove('bat'); void n.offsetWidth; n.classList.add('bat'); }
    if (k % 2 === 0 && performance.now() - punch.t0 > 500) punch = { t0: performance.now(), a: 0.012 };
  }

  // ---------- Curseur (coordonnées de l'application) ----------
  const cur = { x: LARGEUR / 2, y: 700 };
  let trajet = null;
  function curseurVers(px, py, ms = 700) {
    curseur.classList.add('vu');
    return new Promise((fin) => { trajet = { de: { ...cur }, a: { x: px, y: py }, t0: performance.now(), ms, fin }; });
  }
  function placerCurseur(px, py) { Object.assign(cur, { x: px, y: py }); curseur.classList.add('vu'); }
  function pointeur(sel, fx = 0.5, fy = 0.5) { const r = rectApp(sel); return { x: r.x + r.w * fx, y: r.y + r.h * fy }; }
  function appui() {
    curseur.classList.add('appui'); setTimeout(() => curseur.classList.remove('appui'), 150);
    const p = versToile(cur.x, cur.y);
    const o = document.createElement('div'); o.className = 'onde'; o.style.left = `${p.x}px`; o.style.top = `${p.y}px`;
    toile.append(o); setTimeout(() => o.remove(), 700);
    coup(0.06);
  }
  function cacherCurseur() { curseur.classList.remove('vu'); }
  function touche(texte) {
    const p = versToile(cur.x, cur.y);
    const k = document.createElement('div'); k.className = 'touche'; k.textContent = texte;
    k.style.left = `${Math.min(940, p.x + 50)}px`; k.style.top = `${p.y - 130}px`;
    calque.append(k); setTimeout(() => k.remove(), 1000);
  }

  // ---------- Éléments ancrés ----------
  const ancres = new Map();
  function ancrer(id, sel, noeud, placer) { retirer(id, true); calque.append(noeud); ancres.set(id, { sel, noeud, placer }); requestAnimationFrame(() => noeud.classList.add('vu')); }
  function retirer(id, vite) {
    for (const i of id ? [id] : [...ancres.keys()]) {
      const r = ancres.get(i); if (!r) continue; ancres.delete(i);
      r.noeud.classList.remove('vu'); setTimeout(() => r.noeud.remove(), vite ? 0 : 400);
    }
  }
  function ancreToile(sel) {
    const r = rectApp(sel), a = versToile(r.x, r.y);
    return { x: a.x, y: a.y, w: r.w * applique.s, h: r.h * applique.s };
  }
  const posEtiquette = (n, q, cote, m) => {
    const l = n.offsetWidth, h = n.offsetHeight;
    const x = borne(q.x + q.w / 2 - l / 2, 30, 1050 - l);
    const y = cote === 'dessus' ? q.y - m - h - 22 : q.y + q.h + m + 22;
    n.style.left = `${x}px`; n.style.top = `${y}px`;
    n.style.setProperty('--fx', `${borne(q.x + q.w / 2 - x - 14, 16, l - 44)}px`);
  };
  function anneau(id, sel, { couleur = 'var(--jaune)', etiquette = '', cote = 'dessus', pulse = true, marge = 8 } = {}) {
    const g = document.createElement('div'); g.className = 'groupe';
    g.innerHTML = `<div class="anneau${pulse ? ' pulse' : ''}"></div>${etiquette ? `<div class="etiquette ${cote}">${etiquette}</div>` : ''}`;
    g.style.setProperty('--c', couleur); g.classList.toggle('clair', couleur.includes('jaune'));
    ancrer(id, sel, g, (q) => {
      Object.assign(g.firstChild.style, { left: `${q.x - marge}px`, top: `${q.y - marge}px`, width: `${q.w + 2 * marge}px`, height: `${q.h + 2 * marge}px` });
      if (g.children[1]) posEtiquette(g.children[1], q, cote, marge);
    });
  }
  function couleurRepere(id, couleur, etiquette) {
    const r = ancres.get(id); if (!r) return;
    r.noeud.style.setProperty('--c', couleur); r.noeud.classList.toggle('clair', couleur.includes('jaune'));
    const e = r.noeud.querySelector('.etiquette'); if (e && etiquette != null) { e.innerHTML = etiquette; e.classList.remove('rebond'); void e.offsetWidth; e.classList.add('rebond'); }
  }
  // Valeur avant → après, ancrée sur l'élément qui a changé.
  function avantApres(id, sel, avant, apres, { couleur = 'var(--encre)', cote = 'dessus', note = '' } = {}) {
    const g = document.createElement('div'); g.className = 'groupe';
    g.style.setProperty('--c', couleur); g.classList.toggle('clair', couleur.includes('jaune'));
    const meme = avant === apres;
    g.innerHTML = `<div class="etiquette grand ${cote}">${meme ? `<b class="neuf">${echapper(apres)}</b>` : `<s>${echapper(avant)}</s><i>→</i><b class="neuf">${echapper(apres)}</b>`}${note ? `<em>${note}</em>` : ''}</div>`;
    ancrer(id, sel, g, (q) => posEtiquette(g.firstChild, q, cote, 6));
  }
  function flash(sel, couleur = 'var(--jaune)') {
    const f = document.createElement('div'); f.className = 'flash'; f.style.setProperty('--c', couleur);
    const id = `flash-${Math.random()}`;
    ancrer(id, sel, f, (q) => Object.assign(f.style, { left: `${q.x - 6}px`, top: `${q.y - 6}px`, width: `${q.w + 12}px`, height: `${q.h + 12}px` }));
    setTimeout(() => retirer(id, true), 1000);
  }
  function souligner(id, sel, couleur = 'var(--jaune)') {
    const g = document.createElement('div'); g.className = 'souligne'; g.style.setProperty('--c', couleur);
    g.innerHTML = '<svg viewBox="0 0 200 20" preserveAspectRatio="none"><path d="M3 12 C 40 3, 70 18, 105 9 S 170 4, 197 11" pathLength="1"/></svg>';
    ancrer(id, sel, g, (q) => Object.assign(g.style, { left: `${q.x - 6}px`, top: `${q.y + q.h + 2}px`, width: `${q.w + 12}px` }));
  }
  function eclat(sel, couleurs = ['var(--jaune)', 'var(--rouge)', 'var(--bleu)']) {
    const q = ancreToile(sel), cx = q.x + q.w / 2, cy = q.y + q.h / 2;
    for (let i = 0; i < 18; i++) {
      const p = document.createElement('i'), a = (i / 18) * Math.PI * 2 + Math.random() * 0.3, d = 110 + Math.random() * 120;
      p.className = `particule f${i % 3}`; p.style.setProperty('--c', couleurs[i % couleurs.length]);
      p.style.left = `${cx}px`; p.style.top = `${cy}px`;
      p.style.setProperty('--dx', `${Math.cos(a) * d}px`); p.style.setProperty('--dy', `${Math.sin(a) * d}px`); p.style.setProperty('--r', `${Math.random() * 540 - 270}deg`);
      calque.append(p); setTimeout(() => p.remove(), 1000);
    }
  }
  function secouer(id) { const n = ancres.get(id)?.noeud; if (!n) return; n.classList.remove('secoue'); void n.offsetWidth; n.classList.add('secoue'); }

  // ---------- Boucle d'animation ----------
  let tPrec = performance.now();
  (function boucle(t) {
    const dt = Math.min(0.05, ((t ?? tPrec) - tPrec) / 1000); tPrec = t ?? tPrec;
    if (rythmeP) { const k = Math.floor((performance.now() - rythmeT0) / rythmeP); if (k !== dernierTemps) { dernierTemps = k; battement(k); } }
    if (trajet) {
      const k = Math.min(1, (performance.now() - trajet.t0) / trajet.ms), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      cur.x = trajet.de.x + (trajet.a.x - trajet.de.x) * e; cur.y = trajet.de.y + (trajet.a.y - trajet.de.y) * e;
      if (k >= 1) { const f = trajet.fin; trajet = null; f(); }
    }
    if (mode === 'suivre') Object.assign(cible, { cx: cur.x + decalSuivi, cy: cur.y, s: zoomSuivi });
    const c = centreBorne(cible.cx, cible.cy, cible.s);
    const kp = 1 - Math.exp(-dt / tau), ks = 1 - Math.exp(-dt / (tau * 1.15));
    cam.s += (cible.s - cam.s) * ks;
    const a = centreBorne(cam.cx, cam.cy, cam.s); cam.cx = a.cx + (c.cx - a.cx) * kp; cam.cy = a.cy + (c.cy - a.cy) * kp;
    const kpu = Math.min(1, (performance.now() - punch.t0) / 320), s = cam.s * (1 + punch.a * Math.sin(Math.PI * kpu));
    const tr = translation(cam.cx, cam.cy, s);
    applique = { ...tr, s };
    camera.style.transform = `translate(${tr.x}px,${tr.y}px) scale(${s})`;
    const p = versToile(cur.x, cur.y);
    curseur.style.setProperty('--x', `${p.x - 6}px`); curseur.style.setProperty('--y', `${p.y - 3}px`);
    const v = vue.getBoundingClientRect(), tt = toile.getBoundingClientRect();
    const vx = v.left - tt.left, vy = v.top - tt.top;
    curseur.classList.toggle('hors', p.x < vx || p.x > vx + VUE.l || p.y < vy || p.y > vy + VUE.h); // curseur sorti du champ : masqué
    for (const r of ancres.values()) {
      try {
        const q = ancreToile(r.sel), mx = q.x + q.w / 2, my = q.y + q.h / 2;
        r.noeud.classList.toggle('hors', mx < vx || mx > vx + VUE.l || my < vy || my > vy + VUE.h); // élément sorti du champ : repère masqué
        r.placer(q);
      } catch { /* élément en cours de rendu */ }
    }
    requestAnimationFrame(boucle);
  })();

  // ---------- Textes ----------
  function accroche(lignes, pas = 110) {
    const a = $('#accroche'); a.className = ''; a.innerHTML = '';
    let d = 0;
    for (const ligne of lignes) {
      const l = document.createElement('div'); l.className = 'l';
      const rouge = ligne.startsWith('!');
      for (const m of mots(ligne.replace(/^!/, ''))) {
        const s = document.createElement('span'); s.className = 'mot' + (rouge && m.fort ? ' rouge' : '');
        s.innerHTML = m.html; s.style.animationDelay = `${d}ms`; d += pas; l.append(s);
      }
      a.append(l);
    }
    return pause(d);
  }
  function accrocheSortie() { $('#accroche').classList.add('sort'); return pause(450); }
  function question(texte) {
    const q = $('#question'); q.innerHTML = '';
    mots(texte).forEach((m, i) => { const s = document.createElement('span'); s.className = 'mot'; s.innerHTML = m.html; q.append(s); setTimeout(() => s.classList.add('vu'), 60 + i * 70); });
  }
  function legende(html, pastille) {
    const z = $('#legende');
    for (const v of z.children) { v.classList.add('sort'); setTimeout(() => v.remove(), 300); }
    if (!html) return pause(300);
    const l = document.createElement('div'); l.className = 'ligne';
    l.innerHTML = (pastille ? `<span class="pastille">${echapper(pastille)}</span>` : '') + html;
    setTimeout(() => z.append(l), z.children.length ? 220 : 0);
    return pause(500);
  }
  let tamponActif = null;
  function tampon(titre, sous, couleur = 'var(--vert)', y = 1530) {
    tamponFin();
    const t = document.createElement('div'); t.className = 'tampon';
    t.style.setProperty('--c', couleur); t.style.setProperty('--y', `${y}px`);
    t.innerHTML = `${titre}${sous ? `<small>${sous}</small>` : ''}`;
    toile.append(t); tamponActif = t; $('#legende').classList.add('masque');
    return pause(600);
  }
  function tamponFin() { const t = tamponActif; if (!t) return; tamponActif = null; $('#legende').classList.remove('masque'); t.classList.add('sort'); setTimeout(() => t.remove(), 400); }
  function fenetre(visible) { $('#fenetre').classList.toggle('cache', !visible); return pause(800); }
  function volet() { const v = $('#volet'); v.classList.remove('passe'); void v.offsetWidth; v.classList.add('passe'); return pause(450); }
  function outro({ titre, sous, url }) {
    const o = $('#outro');
    o.innerHTML = `<img src="/assets/qme-symbole.svg" alt=""><h2>${titre}</h2><p>${sous}</p><div class="url">${url}</div>`;
    o.classList.add('vu');
  }
  const pret = new Promise((r) => app.addEventListener('load', r, { once: true }));
  // Changer de template en cours de vidéo (vidéo d'un pack) : à masquer derrière un volet.
  function changerApp(url, { url: barre } = {}) {
    return new Promise((r) => { app.addEventListener('load', () => setTimeout(r, 500), { once: true }); app.src = url; if (barre) $('#url').textContent = barre; });
  }
  app.src = params.get('app') || '/templates/gantt/?demo';

  window.S = { pret: () => pret, rythme, changerApp, rectApp, versToile, pointeur, cadrer, suivre, attendreCamera, coup,
    curseurVers, placerCurseur, appui, cacherCurseur, touche,
    anneau, couleurRepere, avantApres, flash, souligner, eclat, secouer, retirer,
    accroche, accrocheSortie, question, legende, tampon, tamponFin, fenetre, volet, outro, pause };
})();
