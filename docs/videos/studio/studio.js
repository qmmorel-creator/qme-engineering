// Studio vidéo QME : API de mise en scène appelée par le moteur (docs/videos/moteur.mjs) via page.evaluate.
// Tout repère est ancré sur un élément RÉEL de l'application (sélecteur CSS dans l'iframe) et suit la caméra.
(() => {
  const $ = (s) => document.querySelector(s);
  const params = new URLSearchParams(location.search);
  const LARGEUR = Number(params.get('w') || 1280), HAUTEUR = Number(params.get('h') || 1600);
  const VUE = { l: 1000, h: 936 };
  const app = $('#app'), camera = $('#camera'), calque = $('#calque'), curseur = $('#curseur');
  app.width = LARGEUR; app.height = HAUTEUR;
  if (params.get('marque')) $('#marque-texte').textContent = params.get('marque');
  if (params.get('url')) $('#url').textContent = params.get('url');
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));
  const echapper = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  // « mot *important* » : les mots entre astérisques sont surlignés.
  const mots = (texte) => texte.split(/\s+/).filter(Boolean).map((m) => {
    const fort = /^\*.*\*$/.test(m) || /^\*/.test(m) && /\*[.,:;!?»]*$/.test(m);
    const propre = echapper(m.replace(/\*/g, ''));
    return { html: fort ? `<mark>${propre}</mark>` : propre, fort };
  });

  let cam = { s: 1, x: 0, y: 0 };
  const docApp = () => app.contentDocument;
  const el = (sel) => { const e = docApp()?.querySelector(sel); if (!e) throw new Error(`Élément introuvable dans l'application : ${sel}`); return e; };

  // Rectangle d'un élément de l'application en coordonnées de la toile (suit la caméra, même pendant un mouvement).
  function ancre(sel) {
    const r = el(sel).getBoundingClientRect();
    const f = app.getBoundingClientRect();
    const k = f.width / LARGEUR;
    return { x: f.left + r.left * k, y: f.top + r.top * k, w: r.width * k, h: r.height * k };
  }
  function rectApp(sel) { const r = el(sel).getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }

  // Caméra : cadre une zone de l'application (coordonnées iframe) dans la vue de la fenêtre.
  function cadrer(zone, ms = 900, marge = 24) {
    let s, cx, cy;
    if (!zone) { s = VUE.l / LARGEUR; cx = LARGEUR / 2; cy = VUE.h / 2 / s; }
    else {
      const z = typeof zone === 'string' ? rectApp(zone) : Array.isArray(zone) ? union(zone.map((q) => typeof q === 'string' ? rectApp(q) : q)) : zone;
      s = Math.min((VUE.l - 2 * marge) / z.w, (VUE.h - 2 * marge) / z.h, 2.6);
      cx = z.x + z.w / 2; cy = z.y + z.h / 2;
    }
    let x = VUE.l / 2 - cx * s, y = VUE.h / 2 - cy * s;
    x = LARGEUR * s <= VUE.l ? (VUE.l - LARGEUR * s) / 2 : Math.min(0, Math.max(VUE.l - LARGEUR * s, x));
    y = HAUTEUR * s <= VUE.h ? 0 : Math.min(0, Math.max(VUE.h - HAUTEUR * s, y));
    cam = { s, x, y };
    camera.style.setProperty('--duree', `${ms}ms`);
    camera.classList.toggle('bouge', ms > 0);
    camera.style.transform = `translate(${x}px,${y}px) scale(${s})`;
    return pause(ms);
  }
  const union = (rs) => { const x = Math.min(...rs.map((r) => r.x)), y = Math.min(...rs.map((r) => r.y));
    return { x, y, w: Math.max(...rs.map((r) => r.x + r.w)) - x, h: Math.max(...rs.map((r) => r.y + r.h)) - y }; };

  // Repères ancrés (anneau + étiquette), recalculés à chaque image.
  const reperes = new Map();
  function anneau(id, sel, { couleur = 'var(--jaune)', etiquette = '', cote = 'dessus', voile = 0, pulse = true, marge = 8 } = {}) {
    retirer(id, true);
    const a = document.createElement('div'); a.className = 'anneau' + (pulse ? ' pulse' : '');
    a.style.setProperty('--c', couleur); a.style.setProperty('--voile', voile);
    calque.append(a);
    let t = null;
    if (etiquette) {
      t = document.createElement('div'); t.className = `etiquette ${cote}` + (couleur.includes('jaune') ? ' jaune' : '');
      t.style.setProperty('--c', couleur); t.innerHTML = etiquette; calque.append(t);
    }
    reperes.set(id, { a, t, sel, cote, marge });
    requestAnimationFrame(() => { a.classList.add('vu'); setTimeout(() => t?.classList.add('vu'), 180); });
  }
  function couleurRepere(id, couleur, etiquette) {
    const r = reperes.get(id); if (!r) return;
    r.a.style.setProperty('--c', couleur);
    if (r.t) { r.t.style.setProperty('--c', couleur); r.t.classList.toggle('jaune', couleur.includes('jaune')); if (etiquette != null) r.t.innerHTML = etiquette; }
  }
  function retirer(id, vite) {
    const ids = id ? [id] : [...reperes.keys()];
    for (const i of ids) {
      const r = reperes.get(i); if (!r) continue; reperes.delete(i);
      r.a.classList.remove('vu'); r.t?.classList.remove('vu');
      setTimeout(() => { r.a.remove(); r.t?.remove(); }, vite ? 0 : 400);
    }
  }
  (function boucle() {
    for (const r of reperes.values()) {
      try {
        const q = ancre(r.sel), m = r.marge;
        Object.assign(r.a.style, { left: `${q.x - m}px`, top: `${q.y - m}px`, width: `${q.w + 2 * m}px`, height: `${q.h + 2 * m}px` });
        if (r.t) {
          const l = r.t.offsetWidth, h = r.t.offsetHeight;
          const x = Math.max(30, Math.min(1050 - l, q.x + q.w / 2 - l / 2));
          const y = r.cote === 'dessus' ? q.y - m - h - 22 : q.y + q.h + m + 22;
          Object.assign(r.t.style, { left: `${x}px`, top: `${y}px` });
          r.t.style.setProperty('--fx', `${Math.max(16, Math.min(l - 44, q.x + q.w / 2 - x - 14))}px`);
        }
      } catch { /* élément absent pendant un rendu : on garde la dernière position */ }
    }
    requestAnimationFrame(boucle);
  })();

  // Curseur : position animée côté toile ; le moteur déplace la vraie souris en même temps.
  let pos = { x: 540, y: 1300 };
  function curseurVers(x, y, ms = 600) {
    curseur.classList.add('vu');
    const de = { ...pos }, t0 = performance.now();
    return new Promise((fin) => {
      const pas = (t) => {
        const k = Math.min(1, (t - t0) / ms), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        pos = { x: de.x + (x - de.x) * e, y: de.y + (y - de.y) * e };
        curseur.style.setProperty('--x', `${pos.x - 6}px`); curseur.style.setProperty('--y', `${pos.y - 3}px`);
        k < 1 ? requestAnimationFrame(pas) : fin();
      };
      requestAnimationFrame(pas);
    });
  }
  function appui(x, y) {
    curseur.classList.add('appui'); setTimeout(() => curseur.classList.remove('appui'), 140);
    const o = document.createElement('div'); o.className = 'onde'; o.style.left = `${x}px`; o.style.top = `${y}px`;
    document.body.firstElementChild.append(o); setTimeout(() => o.remove(), 700);
  }
  function cacherCurseur() { curseur.classList.remove('vu'); }
  function touche(texte) {
    const k = document.createElement('div'); k.className = 'touche'; k.textContent = texte;
    k.style.left = `${Math.min(960, pos.x + 40)}px`; k.style.top = `${pos.y - 120}px`;
    calque.append(k); setTimeout(() => k.remove(), 1000);
  }

  // Textes
  function accroche(lignes) {
    const a = $('#accroche'); a.className = ''; a.innerHTML = '';
    let d = 0;
    for (const ligne of lignes) {
      const l = document.createElement('div'); l.className = 'l';
      const rouge = ligne.startsWith('!');
      for (const m of mots(ligne.replace(/^!/, ''))) {
        const s = document.createElement('span'); s.className = 'mot' + (rouge && m.fort ? ' rouge' : '');
        s.innerHTML = m.html; s.style.animationDelay = `${d}ms`; d += 110; l.append(s);
      }
      d += 160; a.append(l);
    }
    return pause(d + 400);
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
  function tampon(titre, sous, couleur = 'var(--vert)', y = 900) {
    tamponFin();
    const t = document.createElement('div'); t.className = 'tampon';
    t.style.setProperty('--c', couleur); t.style.setProperty('--y', `${y}px`);
    t.innerHTML = `${titre}${sous ? `<small>${sous}</small>` : ''}`;
    document.body.firstElementChild.append(t); tamponActif = t; $('#legende').classList.add('masque');
    return pause(600);
  }
  function tamponFin() { const t = tamponActif; if (!t) return; $('#legende').classList.remove('masque'); tamponActif = null; t.classList.add('sort'); setTimeout(() => t.remove(), 400); }
  function fenetre(visible) { $('#fenetre').classList.toggle('cache', !visible); return pause(800); }
  function volet() { const v = $('#volet'); v.classList.remove('passe'); void v.offsetWidth; v.classList.add('passe'); return pause(450); }
  function outro({ titre, sous, url }) {
    const o = $('#outro');
    o.innerHTML = `<img src="/assets/qme-symbole.svg" alt=""><h2>${titre}</h2><p>${sous}</p><div class="url">${url}</div>`;
    o.classList.add('vu');
  }
  function lire(sel) { return el(sel).value ?? el(sel).textContent; }
  const pret = new Promise((r) => app.addEventListener('load', r, { once: true }));
  app.src = params.get('app') || '/templates/gantt/?demo';

  window.S = { pret: () => pret, cadrer, ancre, rectApp, anneau, couleurRepere, retirer, curseurVers, appui, cacherCurseur, touche,
    accroche, accrocheSortie, question, legende, tampon, tamponFin, fenetre, volet, outro, lire, pause };
})();
