// Espace acheteurs commun à /connexion/ et /packs/espace/ : recherche, épinglés, récemment ouverts et
// regroupement par thème des templates d'un acheteur. Données (PRODUITS, THEMES) générées dans chaque page
// par node outils/connexion/generer.mjs. Préférences sur l'appareil seulement (localStorage qme-espace-*),
// partagées entre les deux pages.
(() => {
  const lire = (c) => { try { const v = localStorage.getItem(c) ?? sessionStorage.getItem(c); return v ? JSON.parse(v) : null; } catch { return null; } };
  const garder = (c, v) => { try { localStorage.setItem(c, JSON.stringify(v)); } catch { /* stockage indisponible */ } };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plat = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, ' ');
  const CLE_EPINGLES = 'qme-espace-epingles', CLE_RECENTS = 'qme-espace-recents', CLE_OUVERTS = 'qme-espace-themes-ouverts';
  const ETOILE = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg>';
  // Statut d'un template sur cet appareil (même règle que assets/mes-templates.js) : null, 'achete', 'essai'
  // (code égal à qme-<pre>-essai, écrit par essai.js) ou 'admin' (code ADM-…).
  const norm = (s) => String(s || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  function statut(pre) {
    const p = pre.toLowerCase(), code = lire(`qme-${p}-code`);
    if (!code || code === 'DEMO' || typeof code !== 'string') return null;
    if (norm(code).startsWith('ADM')) return 'admin';
    const essai = lire(`qme-${p}-essai`);
    return essai && norm(essai) === norm(code) ? 'essai' : 'achete';
  }
  const BADGES = { achete: 'Acheté', essai: 'Essai', admin: 'Admin' };
  const badgeStatut = (k) => { const s = statut(k); return s ? `<span class="esp-badge esp-${s}">${BADGES[s]}</span>` : ''; };
  function noterOuverture(k) { const l = (lire(CLE_RECENTS) || []).filter((r) => r.p !== k); l.unshift({ p: k, t: Date.now() }); garder(CLE_RECENTS, l.slice(0, 12)); }

  // racine : élément vide à remplir. options : produits {PRE: {nom, url, theme, phrase, img}}, themes [{id, nom, c}],
  // seuil (nombre de templates à partir duquel recherche, thèmes et récents s'affichent), avantOuverture(k),
  // actions(k) → HTML de boutons supplémentaires par template (au plus un), badge(k) → HTML d'un badge.
  function creer(racine, { produits, themes, seuil = 5, avantOuverture, actions, badge } = {}) {
    racine.classList.add('esp');
    racine.innerHTML = `<div class="espace-outils" data-outils>
        <label class="esp-recherche"><span class="vh">Rechercher dans mes templates</span>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/></svg>
          <input type="search" data-recherche placeholder="Rechercher : courses, budget, devis…" autocomplete="off" spellcheck="false" enterkeyhint="go"></label>
        <nav class="sauts" data-sauts aria-label="Aller à un thème"></nav></div>
      <p class="vh" role="status" data-statut></p>
      <div data-resultats hidden><ul class="esp-tuiles" data-liste-res></ul><p class="vide" data-vide hidden></p></div>
      <div data-zones>
        <section class="zone" data-z="epingles" aria-label="Épinglés" hidden><h2>Épinglés</h2><ul class="esp-tuiles"></ul></section>
        <section class="zone" data-z="recents" aria-label="Récemment ouverts" hidden><h2>Récemment ouverts</h2><ul class="esp-tuiles"></ul></section>
        <section class="zone" data-z="themes" aria-label="Mes templates"><h2 data-h-themes>Par thème</h2><div data-themes></div></section>
      </div>`;
    const $ = (s) => racine.querySelector(s);
    const E = { outils: $('[data-outils]'), recherche: $('[data-recherche]'), sauts: $('[data-sauts]'), statut: $('[data-statut]'), resultats: $('[data-resultats]'),
      listeRes: $('[data-liste-res]'), vide: $('[data-vide]'), zones: $('[data-zones]'), epingles: $('[data-z="epingles"]'), recents: $('[data-z="recents"]'),
      hThemes: $('[data-h-themes]'), themes: $('[data-themes]') };
    let mes = [];
    const P = (k) => produits[k];
    const theme = (id) => themes.find((t) => t.id === id) || { id, nom: 'Autres', c: 'encre' };
    const epingles = () => (lire(CLE_EPINGLES) || []).filter((k) => mes.includes(k));
    const recents = () => (lire(CLE_RECENTS) || []).filter((r) => mes.includes(r.p)).sort((a, b) => b.t - a.t).map((r) => r.p);
    const parNom = (a, b) => P(a).nom.localeCompare(P(b).nom, 'fr');
    function tuile(k, ep) {
      const p = P(k), t = theme(p.theme), extra = actions ? actions(k) || '' : '';
      return `<li class="esp-tuile${extra ? ' a-action' : ''}" style="--c:var(--${t.c})"><a href="${esc(p.url)}" data-pre="${esc(k)}">` +
        (p.img ? `<img src="${esc(p.img)}" alt="" width="96" height="60" loading="lazy" decoding="async">` : '<span class="vign-vide" aria-hidden="true"></span>') +
        `<span class="t-txt"><b>${esc(p.nom)}</b><small>${esc(p.phrase || t.nom)}</small>${badge ? badge(k) || '' : ''}</span></a><span class="t-actions">${extra}` +
        `<button type="button" class="epingle" data-epingle="${esc(k)}" aria-pressed="${ep.includes(k)}" aria-label="Épingler ${esc(p.nom)}" title="${ep.includes(k) ? 'Retirer des épinglés' : 'Épingler'}">${ETOILE}</button></span></li>`;
    }
    function rendre() {
      const ep = epingles(), beaucoup = mes.length >= seuil;
      E.outils.hidden = !beaucoup;
      E.epingles.hidden = !ep.length;
      E.epingles.querySelector('ul').innerHTML = ep.map((k) => tuile(k, ep)).join('');
      const rc = beaucoup ? recents().filter((k) => !ep.includes(k)).slice(0, 4) : [];
      E.recents.hidden = !rc.length;
      E.recents.querySelector('ul').innerHTML = rc.map((k) => tuile(k, ep)).join('');
      if (!beaucoup) {
        E.hThemes.textContent = ep.length ? 'Tous mes templates' : 'Mes templates';
        E.hThemes.classList.toggle('vh', !ep.length);
        E.themes.innerHTML = `<ul class="esp-tuiles">${mes.slice().sort(parNom).map((k) => tuile(k, ep)).join('')}</ul>`;
        E.sauts.innerHTML = '';
        return;
      }
      E.hThemes.textContent = 'Par thème'; E.hThemes.classList.remove('vh');
      const groupes = themes.map((t) => ({ t, l: mes.filter((k) => P(k).theme === t.id).sort(parNom) })).filter((g) => g.l.length);
      // Thèmes repliés au-delà de 12 templates ; l'état ouvert / fermé de chaque thème est retenu.
      const ouverts = lire(CLE_OUVERTS) || [], tout = mes.length <= 12 || groupes.length === 1;
      E.themes.innerHTML = groupes.map(({ t, l }) => `<details class="groupe" id="t-${t.id}" style="--c:var(--${t.c})"${tout || ouverts.includes(t.id) ? ' open' : ''}><summary><span class="pastille" aria-hidden="true"></span><span class="g-nom">${esc(t.nom)}</span><small>${l.length}</small></summary><ul class="esp-tuiles">${l.map((k) => tuile(k, ep)).join('')}</ul></details>`).join('');
      E.sauts.innerHTML = groupes.length > 1 ? groupes.map(({ t, l }) => `<a href="#t-${t.id}" data-saut="${t.id}" style="--c:var(--${t.c})">${esc(t.nom)} <small>${l.length}</small></a>`).join('') : '';
      if (E.recherche.value) chercher();
    }
    function chercher() {
      const q = plat(E.recherche.value).trim(), mots = q.split(/\s+/).filter(Boolean);
      E.resultats.hidden = !mots.length; E.zones.hidden = !!mots.length;
      if (!mots.length) { E.statut.textContent = ''; return; }
      const score = (k) => {
        const p = P(k), nom = plat(p.nom), tout = `${nom} ${plat(p.phrase || '')} ${plat(theme(p.theme).nom)} ${plat(p.url)} ${k.toLowerCase()}`;
        if (!mots.every((m) => tout.includes(m))) return -1;
        return (nom.startsWith(q) ? 4 : 0) + (nom.includes(q) ? 2 : 0) + (mots.every((m) => nom.includes(m)) ? 1 : 0);
      };
      const ep = epingles(), l = mes.map((k) => [k, score(k)]).filter(([, s]) => s >= 0).sort((a, b) => b[1] - a[1] || parNom(a[0], b[0])).map(([k]) => k);
      E.listeRes.innerHTML = l.map((k) => tuile(k, ep)).join('');
      E.vide.hidden = !!l.length;
      if (!l.length) { const brut = E.recherche.value.trim(); E.vide.innerHTML = `Aucun de vos templates ne correspond à « ${esc(brut)} ». <a href="/templates/?q=${encodeURIComponent(brut)}">Le chercher dans le catalogue <span aria-hidden="true">→</span></a>`; }
      E.statut.textContent = l.length ? `${l.length} template${l.length > 1 ? 's' : ''} trouvé${l.length > 1 ? 's' : ''}` : 'Aucun résultat';
    }
    E.recherche.addEventListener('input', chercher);
    E.recherche.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { E.recherche.value = ''; chercher(); }
      if (e.key === 'Enter') { const a = E.listeRes.querySelector('a'); if (a && !E.resultats.hidden) { e.preventDefault(); a.click(); } }
    });
    racine.addEventListener('click', (e) => {
      const b = e.target.closest('[data-epingle]');
      if (b) {
        const k = b.dataset.epingle, l = (lire(CLE_EPINGLES) || []).filter((x) => x !== k);
        if (b.getAttribute('aria-pressed') !== 'true') l.push(k);
        garder(CLE_EPINGLES, l);
        const zone = b.closest('[data-z],[data-resultats],.groupe');
        const sel = zone?.dataset.z ? `[data-z="${zone.dataset.z}"]` : zone?.id ? `#${zone.id}` : '[data-resultats]';
        rendre();
        (racine.querySelector(`${sel} [data-epingle="${k}"]`) || racine.querySelector(`[data-epingle="${k}"]`))?.focus();
        return;
      }
      const a = e.target.closest('a[data-pre]');
      if (a) { if (avantOuverture) avantOuverture(a.dataset.pre); noterOuverture(a.dataset.pre); }
      const s = e.target.closest('[data-saut]');
      if (s) { const d = document.getElementById('t-' + s.dataset.saut); if (d) d.open = true; }
    });
    E.themes.addEventListener('toggle', () => { garder(CLE_OUVERTS, [...E.themes.querySelectorAll('details[open]')].map((d) => d.id.slice(2))); }, true);
    return { maj(liste) { mes = [...new Set(liste)].filter((k) => P(k)); rendre(); }, get nombre() { return mes.length; } };
  }
  window.QMEEspace = { creer, noterOuverture, lire, garder, esc, statut, badgeStatut };
})();
