// Retour rapide « Mes applications » (un template acheté s'appelle une application) dans chaque application QME (décision de Quentin, 22/11/2026).
// Chargé par toutes les applications (/templates/<slug>/index.html), sans toucher à leur app.js :
//   <script src="/assets/mes-templates.js?v=…" defer></script>
// Le logo QME de l'en-tête (.barre .marque dans l'application, a.marque sur l'écran de connexion) ouvre un panneau qui liste les templates enregistrés sur cet appareil
// (clés qme-<pre>-code), avec un badge : Acheté, Essai (code égal à qme-<pre>-essai, écrit par essai.js) ou
// Admin (code ADM-…). Liens vers l'espace complet /connexion/ et le site. Données (noms, adresses, vignettes)
// chargées à la première ouverture : /assets/espace-donnees.js (node outils/connexion/generer.mjs).
(() => {
  'use strict';
  if (window.QMEMesTemplates) return;
  const V = '20261123b';
  const lire = (c) => { try { const v = localStorage.getItem(c) ?? sessionStorage.getItem(c); return v ? JSON.parse(v) : null; } catch { return null; } };
  const garder = (c, v) => { try { localStorage.setItem(c, JSON.stringify(v)); } catch { /* stockage indisponible */ } };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  const plat = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  // Statut d'un template sur cet appareil : null (absent ou démo), 'achete', 'essai' ou 'admin'.
  function statut(pre) {
    const p = pre.toLowerCase(), code = lire(`qme-${p}-code`);
    if (!code || code === 'DEMO' || typeof code !== 'string') return null;
    if (norm(code).startsWith('ADM')) return 'admin';
    const essai = lire(`qme-${p}-essai`);
    return essai && norm(essai) === norm(code) ? 'essai' : 'achete';
  }
  // Code administrateur : étendu à toutes les applications du catalogue (même règle que QMEEspace.etendreAdmin dans
  // assets/espace.js) ; un achat ou un essai déjà présent n'est jamais remplacé.
  function etendreAdmin(produits) {
    let code = null, stock = null;
    for (const p of Object.values(produits || {})) {
      for (const st of [localStorage, sessionStorage]) {
        try { const v = JSON.parse(st.getItem(p.cle) || 'null'); if (typeof v === 'string' && norm(v).startsWith('ADM')) { code = v; stock = st; break; } } catch { /* illisible */ }
      }
      if (code) break;
    }
    if (!code) return;
    for (const p of Object.values(produits)) {
      const v = lire(p.cle);
      if (v && v !== 'DEMO') continue;
      try { stock.setItem(p.cle, JSON.stringify(code)); } catch { /* stockage indisponible */ }
    }
  }
  const BADGE = { achete: ['Acheté', 'achete'], essai: ['Essai', 'essai'], admin: ['Admin', 'admin'] };
  const badge = (s) => (BADGE[s] ? `<span class="qme-mt-badge qme-mt-${BADGE[s][1]}">${BADGE[s][0]}</span>` : '');

  const CSS = `
[data-mt]{position:relative;cursor:pointer;-webkit-tap-highlight-color:transparent}
[data-mt]:focus-visible{outline:3px solid #E8B93A;outline-offset:3px;border-radius:8px}
[data-mt]::after{content:"";display:inline-block;width:18px;height:18px;margin-left:6px;vertical-align:middle;background:currentColor;opacity:.75;
 -webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect x='3' y='3' width='7.5' height='7.5' rx='1.5'/%3E%3Crect x='13.5' y='3' width='7.5' height='7.5' rx='1.5'/%3E%3Crect x='3' y='13.5' width='7.5' height='7.5' rx='1.5'/%3E%3Crect x='13.5' y='13.5' width='7.5' height='7.5' rx='1.5'/%3E%3C/svg%3E") center/contain no-repeat;
 mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect x='3' y='3' width='7.5' height='7.5' rx='1.5'/%3E%3Crect x='13.5' y='3' width='7.5' height='7.5' rx='1.5'/%3E%3Crect x='3' y='13.5' width='7.5' height='7.5' rx='1.5'/%3E%3Crect x='13.5' y='13.5' width='7.5' height='7.5' rx='1.5'/%3E%3C/svg%3E") center/contain no-repeat}
.qme-mt{--mt-encre:#24221F;--mt-papier:#FBF7F1;--mt-trait:#E4DCCE;--mt-discret:#6E685F;--mt-texte:#514C44;
 width:min(560px,100vw);max-width:100vw;max-height:min(86vh,760px);margin:auto auto 0;padding:0;border:0;border-radius:20px 20px 0 0;
 background:var(--mt-papier);color:var(--mt-encre);font:400 16px/1.45 Outfit,system-ui,sans-serif;box-shadow:0 -10px 40px rgba(0,0,0,.18);overflow:hidden}
.qme-mt[open]{display:flex;flex-direction:column}
.qme-mt::backdrop{background:rgba(20,20,20,.45)}
@media (min-width:700px){.qme-mt{margin:auto;border-radius:20px}}
.qme-mt-tete{display:flex;align-items:center;gap:12px;padding:16px 16px 6px 20px}
.qme-mt-tete h2{margin:0;font-size:22px;line-height:1.2;font-weight:700;flex:1}
.qme-mt-fermer{width:44px;height:44px;border:0;border-radius:50%;background:none;color:inherit;font:400 26px/1 Outfit,sans-serif;cursor:pointer}
.qme-mt-fermer:hover{background:#F3EDE3}
.qme-mt-sous{margin:0;padding:0 20px 10px;color:var(--mt-discret);font-size:15px}
.qme-mt-cherche{margin:0 16px 10px;display:flex;align-items:center;gap:8px;padding:0 12px;min-height:46px;border:2px solid var(--mt-encre);border-radius:12px;background:#fff}
.qme-mt-cherche input{flex:1;min-width:0;border:0;outline:none;background:none;font:500 16px Outfit,system-ui,sans-serif;color:inherit}
.qme-mt-cherche:focus-within{outline:3px solid #E8B93A}
.qme-mt-liste{list-style:none;margin:0;padding:4px 12px 12px;overflow:auto;display:flex;flex-direction:column;gap:8px;flex:1;min-height:0}
.qme-mt-liste a,.qme-mt-ici{display:flex;align-items:center;gap:12px;min-height:64px;padding:8px;border:1px solid var(--mt-trait);border-radius:14px;background:#fff;color:inherit;text-decoration:none}
.qme-mt-liste a:hover{border-color:var(--mt-encre)}
.qme-mt-liste a:focus-visible{outline:3px solid #E8B93A;outline-offset:1px}
.qme-mt-ici{background:#FBEBC2;border-color:#E8B93A}
.qme-mt-liste img,.qme-mt-vide-img{flex:none;width:72px;height:45px;object-fit:cover;border-radius:8px;background:#F3EDE3}
.qme-mt-txt{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.qme-mt-txt b{font-size:16px;line-height:1.25;font-weight:700}
.qme-mt-txt small{font-size:13px;color:var(--mt-texte)}
.qme-mt-badge{flex:none;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;padding:4px 9px;border-radius:999px;white-space:nowrap}
.qme-mt-achete{background:#D9EBDD;color:#1F5130}
.qme-mt-essai{background:#D8E4F0;color:#22476E}
.qme-mt-admin{background:#EDE8DF;color:#514C44}
.qme-mt-vide{margin:4px 8px;padding:16px;border:1px dashed var(--mt-trait);border-radius:14px;color:var(--mt-texte)}
.qme-mt-vide a{color:#2E5A88;font-weight:700}
.qme-mt-pied{display:flex;flex-wrap:wrap;gap:8px;padding:12px 16px calc(14px + env(safe-area-inset-bottom));border-top:1px solid var(--mt-trait);background:var(--mt-papier)}
.qme-mt-pied a{flex:1 1 200px;display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 16px;border-radius:999px;border:1px solid var(--mt-trait);background:#fff;color:inherit;font-weight:700;text-decoration:none}
.qme-mt-pied a.principal{background:var(--mt-encre);border-color:var(--mt-encre);color:var(--mt-papier)}
/* Bandeau QME au-dessus de chaque application : Mon espace, site, templates, packs, sur mesure */
.qme-bandeau{display:flex;align-items:center;gap:4px;min-height:38px;padding:0 max(10px,env(safe-area-inset-left));background:#24221F;color:#FBF7F1;font:600 13.5px/1 Outfit,system-ui,sans-serif;overflow-x:auto;scrollbar-width:none;white-space:nowrap;position:relative;z-index:30}
.qme-bandeau::-webkit-scrollbar{display:none}
.qme-bandeau a{display:inline-flex;align-items:center;gap:7px;min-height:32px;padding:0 10px;border-radius:999px;color:inherit;text-decoration:none;flex:none}
.qme-bandeau a:hover{background:rgba(251,247,241,.12)}
.qme-bandeau a:focus-visible{outline:2px solid #E8B93A;outline-offset:1px}
.qme-bandeau .qme-b-espace{background:#E8B93A;color:#24221F}
.qme-bandeau .qme-b-espace:hover{background:#F5CF63}
.qme-bandeau .qme-b-ini{width:20px;height:20px;border-radius:50%;display:inline-grid;place-items:center;background:#24221F;color:#FBF7F1;font-size:11px}
.qme-bandeau .qme-b-sep{flex:1;min-width:8px}
@media (max-width:520px){.qme-bandeau{font-size:13px}.qme-bandeau a{padding:0 8px}}
.qme-relier{display:block;padding:9px max(14px,env(safe-area-inset-left));background:#E8B93A;color:#24221F;font:600 14px/1.35 Outfit,system-ui,sans-serif;text-decoration:none;position:relative;z-index:30}
.qme-relier:hover,.qme-relier:focus-visible{background:#F5CF63}
@media print{.qme-bandeau,.qme-relier{display:none}}
@media (prefers-reduced-motion:no-preference){.qme-mt[open]{animation:qme-mt-entree .18s ease-out}@keyframes qme-mt-entree{from{transform:translateY(24px);opacity:.6}}}
`;
  let donnees = null, dialogue = null;
  const charger = () => donnees ? Promise.resolve(donnees) : new Promise((ok, ko) => {
    if (window.QME_ESPACE) { donnees = window.QME_ESPACE; ok(donnees); return; }
    const s = document.createElement('script');
    s.src = `/assets/espace-donnees.js?v=${V}`;
    s.onload = () => { donnees = window.QME_ESPACE; donnees ? ok(donnees) : ko(new Error('données absentes')); };
    s.onerror = () => ko(new Error('hors ligne'));
    document.head.appendChild(s);
  });
  // Template courant : préfixe donné à essai.js, sinon déduit de l'adresse.
  const produitCourant = (produits) => document.querySelector('script[src*="/assets/essai.js"][data-produit]')?.dataset.produit
    || Object.keys(produits).find((k) => location.pathname.startsWith(produits[k].url)) || null;

  function construire() {
    if (dialogue) return dialogue;
    dialogue = document.createElement('dialog');
    dialogue.className = 'qme-mt';
    dialogue.setAttribute('aria-labelledby', 'qme-mt-titre');
    dialogue.innerHTML = `<div class="qme-mt-tete"><h2 id="qme-mt-titre">Mes applications</h2><button type="button" class="qme-mt-fermer" data-mt-fermer aria-label="Fermer">×</button></div>
      <p class="qme-mt-sous" data-mt-sous></p>
      <label class="qme-mt-cherche" data-mt-cherche hidden><span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Rechercher</span>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/></svg>
        <input type="search" placeholder="Rechercher une application" autocomplete="off" enterkeyhint="go"></label>
      <ul class="qme-mt-liste" data-mt-liste></ul>
      <div class="qme-mt-pied"><a class="principal" href="${ESPACE}">Mon espace : tout voir</a><a href="/">Site QME</a></div>`;
    document.body.appendChild(dialogue);
    dialogue.addEventListener('click', (e) => {
      if (e.target === dialogue || e.target.closest('[data-mt-fermer]')) { dialogue.close(); return; }
      const a = e.target.closest('a[data-mt-pre]');
      if (a) { const l = (lire('qme-espace-recents') || []).filter((r) => r.p !== a.dataset.mtPre); l.unshift({ p: a.dataset.mtPre, t: Date.now() }); garder('qme-espace-recents', l.slice(0, 12)); }
    });
    // Échap ferme le panneau même si l'application intercepte la touche pour ses propres fenêtres.
    dialogue.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); dialogue.close(); } });
    dialogue.addEventListener('close', () => { document.querySelector('[data-mt]:not(a)')?.focus?.(); });
    const champ = dialogue.querySelector('input');
    champ.addEventListener('input', () => remplir(champ.value));
    champ.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const a = dialogue.querySelector('a[data-mt-pre]'); if (a) { e.preventDefault(); a.click(); } } });
    return dialogue;
  }
  function remplir(filtre = '') {
    const { produits } = donnees, ici = produitCourant(produits);
    etendreAdmin(produits);
    const recents = Object.fromEntries((lire('qme-espace-recents') || []).map((r) => [r.p, r.t]));
    const epingles = lire('qme-espace-epingles') || [], noms = lire('qme-espace-noms') || {}, masques = lire('qme-espace-masques') || [];
    const nom = (k) => noms[k] || produits[k].nom;
    // Applications masquées dans l'espace : absentes du panneau (sauf celle ouverte).
    const mes = Object.keys(produits).filter((k) => k !== ici && statut(k) && !masques.includes(k));
    const total = mes.length + (ici && statut(ici) ? 1 : 0);
    const mots = plat(filtre).trim().split(/\s+/).filter(Boolean);
    const trouve = (k) => { const p = produits[k], t = plat(`${nom(k)} ${p.nom} ${p.phrase} ${p.url}`); return mots.every((m) => t.includes(m)); };
    // Épinglés d'abord, puis les plus récemment ouverts, puis par nom.
    const rang = (k) => (epingles.includes(k) ? 2e13 : 0) + (recents[k] || 0);
    const liste = mes.filter(trouve).sort((a, b) => rang(b) - rang(a) || nom(a).localeCompare(nom(b), 'fr'));
    dialogue.querySelector('[data-mt-sous]').textContent = total ? `${total} application${total > 1 ? 's' : ''} sur cet appareil` : 'Aucune application enregistrée sur cet appareil';
    dialogue.querySelector('[data-mt-cherche]').hidden = mes.length < 8;
    const tuile = (k, cible) => { const p = produits[k];
      const corps = `${p.img ? `<img src="${esc(p.img)}" alt="" width="72" height="45" loading="lazy">` : '<span class="qme-mt-vide-img"></span>'}<span class="qme-mt-txt"><b>${esc(nom(k))}</b>${cible ? '' : '<small>Ouverte en ce moment</small>'}</span>${badge(statut(k))}`;
      return cible ? `<li><a href="${esc(p.url)}" data-mt-pre="${esc(k)}">${corps}</a></li>` : `<li><div class="qme-mt-ici" aria-current="page">${corps}</div></li>`; };
    let html = ici && produits[ici] && !mots.length ? tuile(ici, false) : '';
    html += liste.map((k) => tuile(k, true)).join('');
    if (!liste.length) html += mots.length
      ? `<li class="qme-mt-vide">Aucune de vos applications ne correspond. <a href="/templates/?q=${encodeURIComponent(filtre.trim())}">Chercher dans le catalogue</a></li>`
      : `<li class="qme-mt-vide">Aucune autre application sur cet appareil. <a href="/templates/">Découvrir les templates</a> ou <a href="/essai/">essayer 14 jours gratuitement</a>.</li>`;
    dialogue.querySelector('[data-mt-liste]').innerHTML = html;
  }
  async function ouvrir() {
    try { await charger(); } catch { location.href = ESPACE; return; }
    construire();
    const champ = dialogue.querySelector('input'); champ.value = '';
    remplir();
    if (!dialogue.open) dialogue.showModal();
    dialogue.querySelector('[data-mt-fermer]').focus();
  }

  // Application lancée depuis l'écran d'accueil : sa mémoire est séparée du navigateur ; la page Mon espace le signale.
  const ESPACE = (navigator.standalone === true || matchMedia('(display-mode: standalone)').matches) ? '/connexion/?depuis=ecran' : '/connexion/';
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  // Bandeau QME (demande de Quentin, 23/11/2026) : depuis une application, retour direct à son espace et au site.
  function bandeau() {
    if (document.querySelector('.qme-bandeau')) return;
    let session = null; try { session = JSON.parse(localStorage.getItem('qme-compte') || 'null'); } catch { /* indisponible */ }
    const prenom = lire('qme-espace-prenom') || '';
    const ini = session?.jeton ? String(prenom || session.email || '').trim().charAt(0).toUpperCase().replace(/[^\p{L}\p{N}]/gu, '') : '';
    const n = document.createElement('nav');
    n.className = 'qme-bandeau'; n.setAttribute('aria-label', 'QME : mon espace et le site');
    n.innerHTML = `<a class="qme-b-espace" href="${ESPACE}">${ini ? `<span class="qme-b-ini" aria-hidden="true">${esc(ini)}</span>` : '<span aria-hidden="true">←</span>'}Mon espace</a>`
      + '<span class="qme-b-sep" aria-hidden="true"></span><a href="/">Site QME</a><a href="/templates/">Templates</a><a href="/packs/">Packs</a><a href="/sur-mesure/">Sur mesure</a>';
    document.body.prepend(n);
    // Application de l'écran d'accueil sans compte : sa mémoire est séparée du navigateur, il faut s'y connecter une
    // fois (e-mail + code à 6 chiffres) pour y retrouver toutes ses applications, sans la réinstaller.
    if (ESPACE !== '/connexion/' && !session?.jeton) {
      const r = document.createElement('a');
      r.className = 'qme-relier'; r.href = ESPACE;
      r.textContent = 'Connectez cette application une fois pour retrouver toutes vos applications →';
      n.after(r);
    }
  }
  bandeau();
  // Le logo de l'en-tête (rendu et re-rendu par l'application) devient le bouton du panneau.
  const CIBLE = '.barre .marque, a.marque';
  const marquer = () => {
    for (const el of document.querySelectorAll(`:is(${CIBLE}):not([data-mt])`)) {
      el.dataset.mt = ''; el.setAttribute('aria-label', 'Mes applications'); el.setAttribute('aria-haspopup', 'dialog'); el.title = 'Mes applications';
      if (el.tagName !== 'A') { el.setAttribute('role', 'button'); el.tabIndex = 0; }
    }
  };
  document.addEventListener('click', (e) => {
    const el = e.target.closest?.('[data-mt]');
    if (!el || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault(); ouvrir();
  }, true);
  document.addEventListener('keydown', (e) => {
    const el = e.target.closest?.('[data-mt]');
    if (el && el.tagName !== 'A' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); ouvrir(); }
  });
  marquer();
  new MutationObserver(marquer).observe(document.body || document.documentElement, { childList: true, subtree: true });
  window.QMEMesTemplates = { ouvrir, statut };
})();
