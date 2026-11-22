// Espace acheteurs commun à /connexion/ et /packs/espace/ : recherche, épinglés, récemment ouverts et
// regroupement par thème des applications d'un acheteur (un template acheté s'appelle une application).
// Données (PRODUITS, THEMES) générées dans chaque page par node outils/connexion/generer.mjs.
//
// Personnalisation (22/11/2026) : nom donné à une application, applications masquées (section « Masquées »),
// ordre des épinglés, en mode « Personnaliser » (edition). Préférences sur l'appareil (localStorage
// qme-espace-*), partagées entre les deux pages et le panneau des applications ; chaque changement déclenche
// l'événement « qme-espace-prefs », que assets/compte.js envoie au compte quand l'acheteur est connecté.
(() => {
  const lire = (c) => { try { const v = localStorage.getItem(c) ?? sessionStorage.getItem(c); return v ? JSON.parse(v) : null; } catch { return null; } };
  const garder = (c, v) => { try { localStorage.setItem(c, JSON.stringify(v)); } catch { /* stockage indisponible */ } };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plat = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, ' ');
  const CLE_EPINGLES = 'qme-espace-epingles', CLE_RECENTS = 'qme-espace-recents', CLE_OUVERTS = 'qme-espace-themes-ouverts';
  const CLE_NOMS = 'qme-espace-noms', CLE_MASQUES = 'qme-espace-masques', CLE_PRENOM = 'qme-espace-prenom', CLE_MAJ = 'qme-espace-prefs-maj';
  const ETOILE = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg>';
  const OEIL = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const OEIL_BARRE = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 3l18 18M10.6 5.1A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3 3.9M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a10 10 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
  const FLECHE = (d) => `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="${d === 'haut' ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'}"/></svg>`;

  // Statut d'une application sur cet appareil (même règle que assets/mes-templates.js) : null, 'achete', 'essai'
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
  // Code administrateur (ADM-…) : il donne accès à toutes les applications, y compris celles ajoutées au catalogue
  // après sa saisie. Recopié dans le même stockage (local ou session) pour chaque application sans code (ou en démo) ;
  // un achat ou un essai déjà présent n'est jamais remplacé. Renvoie le nombre d'applications complétées.
  function etendreAdmin(produits) {
    let code = null, stock = null;
    for (const p of Object.values(produits || {})) {
      for (const st of [localStorage, sessionStorage]) {
        try { const v = JSON.parse(st.getItem(p.cle) || 'null'); if (typeof v === 'string' && norm(v).startsWith('ADM')) { code = v; stock = st; break; } } catch { /* illisible */ }
      }
      if (code) break;
    }
    if (!code) return 0;
    let n = 0;
    for (const p of Object.values(produits)) {
      const v = lire(p.cle);
      if (v && v !== 'DEMO') continue;
      try { stock.setItem(p.cle, JSON.stringify(code)); n++; } catch { /* stockage indisponible */ }
    }
    return n;
  }
  const badgeStatut = (k) => { const s = statut(k); return s ? `<span class="esp-badge esp-${s}">${BADGES[s]}</span>` : ''; };
  function noterOuverture(k) { const l = (lire(CLE_RECENTS) || []).filter((r) => r.p !== k); l.unshift({ p: k, t: Date.now() }); garder(CLE_RECENTS, l.slice(0, 12)); }

  // Préférences de l'espace (synchronisées avec le compte par assets/compte.js).
  const prefs = () => ({ noms: lire(CLE_NOMS) || {}, masques: lire(CLE_MASQUES) || [], epingles: lire(CLE_EPINGLES) || [] });
  const prenom = () => lire(CLE_PRENOM) || '';
  function changerPrefs(partiel, { depuisCompte = false, maj = new Date().toISOString() } = {}) {
    if (partiel.noms) garder(CLE_NOMS, partiel.noms);
    if (partiel.masques) garder(CLE_MASQUES, partiel.masques);
    if (partiel.epingles) garder(CLE_EPINGLES, partiel.epingles);
    if (partiel.prenom !== undefined) garder(CLE_PRENOM, partiel.prenom);
    garder(CLE_MAJ, maj);
    window.dispatchEvent(new CustomEvent('qme-espace-prefs', { detail: { depuisCompte, prenom: partiel.prenom !== undefined } }));
  }

  // racine : élément vide à remplir. options : produits {PRE: {nom, url, theme, phrase, img}}, themes [{id, nom, c}],
  // seuil (nombre d'applications à partir duquel recherche, thèmes et récents s'affichent), avantOuverture(k),
  // actions(k) → HTML d'un bouton supplémentaire par application, badge(k) → HTML d'un badge.
  // grille : lanceur d'icônes (espace personnel) ; thèmes en filtres, favoris en tête, sans « récemment ouverts ».
  // marque(k) : badge visuel posé dans le coin haut-droit de l'icône (mode grille) ; badge(k) : pastille de texte (listes).
  function creer(racine, { produits, themes, seuil = 5, avantOuverture, actions, badge, marque, grille = false } = {}) {
    racine.classList.add('esp');
    racine.innerHTML = `<div class="espace-outils" data-outils>
        <label class="esp-recherche"><span class="vh">Rechercher dans mes applications</span>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/></svg>
          <input type="search" data-recherche placeholder="Rechercher : courses, budget, devis…" autocomplete="off" spellcheck="false" enterkeyhint="go"></label>
        <nav class="sauts" data-sauts aria-label="Aller à un thème"></nav></div>
      <p class="vh" role="status" data-statut></p>
      <div data-resultats hidden><ul class="esp-tuiles" data-liste-res></ul><p class="vide" data-vide hidden></p></div>
      <div data-zones>
        <section class="zone" data-z="epingles" aria-label="Épinglés" hidden><h2>Épinglés</h2><ul class="esp-tuiles"></ul></section>
        <section class="zone" data-z="recents" aria-label="Récemment ouverts" hidden><h2>Récemment ouverts</h2><ul class="esp-tuiles"></ul></section>
        <section class="zone" data-z="themes" aria-label="Mes applications"><h2 data-h-themes>Par thème</h2><div data-themes></div></section>
        <section class="zone" data-z="masques" aria-label="Applications masquées" hidden><details data-masques-details><summary><span data-masques-titre>Masquées</span></summary><ul class="esp-tuiles"></ul></details></section>
      </div>`;
    const $ = (s) => racine.querySelector(s);
    const E = { outils: $('[data-outils]'), recherche: $('[data-recherche]'), sauts: $('[data-sauts]'), statut: $('[data-statut]'), resultats: $('[data-resultats]'),
      listeRes: $('[data-liste-res]'), vide: $('[data-vide]'), zones: $('[data-zones]'), epingles: $('[data-z="epingles"]'), recents: $('[data-z="recents"]'),
      hThemes: $('[data-h-themes]'), themes: $('[data-themes]'), masques: $('[data-z="masques"]') };
    let tous = [], mes = [], edition = false, filtre = '';
    if (grille) racine.classList.add('esp-grille');
    const P = (k) => produits[k];
    const nom = (k) => prefs().noms[k] || P(k).nom;
    const theme = (id) => themes.find((t) => t.id === id) || { id, nom: 'Autres', c: 'encre' };
    const masquees = () => prefs().masques.filter((k) => tous.includes(k));
    const epingles = () => prefs().epingles.filter((k) => mes.includes(k));
    const recents = () => (lire(CLE_RECENTS) || []).filter((r) => mes.includes(r.p)).sort((a, b) => b.t - a.t).map((r) => r.p);
    const parNom = (a, b) => nom(a).localeCompare(nom(b), 'fr');
    const vignette = (p) => (p.img ? `<img src="${esc(p.img)}" alt="" width="96" height="60" loading="lazy" decoding="async">` : '<span class="vign-vide" aria-hidden="true"></span>');

    // Lanceur : icône de l'application, nom, badge ; étoile discrète.
    function icone(k, ep) {
      const p = P(k), t = theme(p.theme), estEp = ep.includes(k);
      return `<li class="app" style="--c:var(--${t.c})"><a href="${esc(p.url)}" data-pre="${esc(k)}" title="${esc(p.nom)}">`
        + `<span class="app-icone">${p.icone ? `<img src="${esc(p.icone)}" alt="" width="64" height="64" loading="lazy" decoding="async">` : ''}${marque ? marque(k) || '' : ''}</span>`
        + `<span class="app-nom">${esc(nom(k))}</span>${marque ? '' : badge ? badge(k) || '' : ''}</a>`
        + `<button type="button" class="epingle app-etoile" data-epingle="${esc(k)}" aria-pressed="${estEp}" aria-label="${estEp ? 'Retirer des favoris' : 'Ajouter aux favoris'} : ${esc(nom(k))}" title="${estEp ? 'Retirer des favoris' : 'Ajouter aux favoris'}">${ETOILE}</button></li>`;
    }
    function tuile(k, ep, zone = '') {
      if (grille && !edition) return icone(k, ep);
      const p = P(k), t = theme(p.theme), renomme = prefs().noms[k], masque = prefs().masques.includes(k);
      const etoile = `<button type="button" class="epingle" data-epingle="${esc(k)}" aria-pressed="${ep.includes(k)}" aria-label="Épingler ${esc(nom(k))}" title="${ep.includes(k) ? 'Retirer des épinglés' : 'Épingler'}">${ETOILE}</button>`;
      if (edition) {
        // Mode « Personnaliser » : nom modifiable, masquer / afficher, ordre des épinglés ; pas de lien.
        const i = ep.indexOf(k), ordre = zone === 'epingles'
          ? `<button type="button" data-monter="${esc(k)}" aria-label="Monter ${esc(nom(k))}" title="Monter"${i <= 0 ? ' disabled' : ''}>${FLECHE('haut')}</button><button type="button" data-descendre="${esc(k)}" aria-label="Descendre ${esc(nom(k))}" title="Descendre"${i === ep.length - 1 ? ' disabled' : ''}>${FLECHE('bas')}</button>` : '';
        return `<li class="esp-tuile en-edition" style="--c:var(--${t.c})"><div class="t-corps">${vignette(p)}<span class="t-txt">` +
          `<input class="t-nom" data-renommer="${esc(k)}" value="${esc(renomme || '')}" placeholder="${esc(p.nom)}" maxlength="60" aria-label="Nom affiché pour ${esc(p.nom)}">` +
          `<small>${renomme ? `Nom d’origine : ${esc(p.nom)}` : 'Touchez le nom pour le changer'}</small></span></div>` +
          `<span class="t-actions">${ordre}<button type="button" data-masquer="${esc(k)}" aria-pressed="${masque}" aria-label="${masque ? 'Afficher' : 'Masquer'} ${esc(nom(k))}" title="${masque ? 'Afficher' : 'Masquer'}">${masque ? OEIL_BARRE : OEIL}</button>${masque ? '' : etoile}</span></li>`;
      }
      const extra = actions ? actions(k) || '' : '';
      return `<li class="esp-tuile${extra ? ' a-action' : ''}" style="--c:var(--${t.c})"><a href="${esc(p.url)}" data-pre="${esc(k)}">${vignette(p)}` +
        `<span class="t-txt"><b>${esc(nom(k))}</b><small>${esc(renomme ? p.nom : (p.phrase || t.nom))}</small>${badge ? badge(k) || '' : ''}</span></a><span class="t-actions">${extra}${etoile}</span></li>`;
    }
    function rendre() {
      const masq = masquees();
      mes = tous.filter((k) => !masq.includes(k));
      racine.classList.toggle('esp-edition', edition);
      const ep = epingles(), beaucoup = mes.length >= seuil;
      E.outils.hidden = !beaucoup || edition;
      racine.querySelectorAll('ul.esp-tuiles').forEach((u) => u.classList.toggle('apps', grille && !edition));
      if (grille) E.epingles.querySelector('h2').textContent = 'Favoris';
      E.epingles.hidden = !ep.length;
      E.epingles.querySelector('ul').innerHTML = ep.map((k) => tuile(k, ep, 'epingles')).join('');
      const rc = beaucoup && !edition && !grille ? recents().filter((k) => !ep.includes(k)).slice(0, 4) : [];
      E.recents.hidden = !rc.length;
      E.recents.querySelector('ul').innerHTML = rc.map((k) => tuile(k, ep)).join('');
      E.masques.hidden = !masq.length;
      E.masques.querySelector('[data-masques-titre]').textContent = `Masquées (${masq.length})`;
      E.masques.querySelector('ul').innerHTML = masq.slice().sort(parNom).map((k) => tuile(k, ep)).join('');
      if (edition) E.masques.querySelector('details').open = true;
      if (!beaucoup || edition) {
        E.hThemes.textContent = ep.length ? 'Toutes mes applications' : 'Mes applications';
        const liste = mes.filter((k) => !edition || !ep.includes(k)).sort(parNom);
        E.hThemes.classList.toggle('vh', !ep.length && !edition);
        E.themes.closest('[data-z]').hidden = !liste.length;
        E.themes.innerHTML = `<ul class="esp-tuiles${grille && !edition ? ' apps' : ''}">${liste.map((k) => tuile(k, ep)).join('')}</ul>`;
        E.sauts.innerHTML = '';
        return;
      }
      E.hThemes.textContent = 'Par thème'; E.hThemes.classList.remove('vh'); E.themes.closest('[data-z]').hidden = false;
      if (grille) {
        // Lanceur : toutes les applications (ou celles du thème choisi), thèmes en filtres.
        const presents = themes.filter((t) => mes.some((k) => P(k).theme === t.id));
        if (filtre && !presents.some((t) => t.id === filtre)) filtre = '';
        const liste = mes.filter((k) => !filtre || P(k).theme === filtre).sort(parNom);
        E.hThemes.textContent = filtre ? theme(filtre).nom : 'Toutes mes applications';
        E.themes.innerHTML = `<ul class="esp-tuiles apps">${liste.map((k) => icone(k, ep)).join('')}</ul>`;
        E.sauts.innerHTML = presents.length > 1 ? [`<button type="button" data-filtre="" aria-pressed="${!filtre}">Toutes <small>${mes.length}</small></button>`,
          ...presents.map((t) => `<button type="button" data-filtre="${t.id}" aria-pressed="${filtre === t.id}" style="--c:var(--${t.c})">${esc(t.nom)} <small>${mes.filter((k) => P(k).theme === t.id).length}</small></button>`)].join('') : '';
        if (E.recherche.value) chercher();
        return;
      }
      const groupes = themes.map((t) => ({ t, l: mes.filter((k) => P(k).theme === t.id).sort(parNom) })).filter((g) => g.l.length);
      // Thèmes repliés au-delà de 12 applications ; l'état ouvert / fermé de chaque thème est retenu.
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
        const p = P(k), n = plat(nom(k)), tout = `${n} ${plat(p.nom)} ${plat(p.phrase || '')} ${plat(theme(p.theme).nom)} ${plat(p.url)} ${k.toLowerCase()}`;
        if (!mots.every((m) => tout.includes(m))) return -1;
        return (n.startsWith(q) ? 4 : 0) + (n.includes(q) ? 2 : 0) + (mots.every((m) => n.includes(m)) ? 1 : 0);
      };
      // Les applications masquées restent trouvables.
      const ep = epingles(), l = tous.map((k) => [k, score(k)]).filter(([, s]) => s >= 0).sort((a, b) => b[1] - a[1] || parNom(a[0], b[0])).map(([k]) => k);
      E.listeRes.innerHTML = l.map((k) => tuile(k, ep)).join('');
      E.vide.hidden = !!l.length;
      if (!l.length) { const brut = E.recherche.value.trim(); E.vide.innerHTML = `Aucune de vos applications ne correspond à « ${esc(brut)} ». <a href="/templates/?q=${encodeURIComponent(brut)}">Le chercher dans le catalogue <span aria-hidden="true">→</span></a>`; }
      E.statut.textContent = l.length ? `${l.length} application${l.length > 1 ? 's' : ''} trouvée${l.length > 1 ? 's' : ''}` : 'Aucun résultat';
    }
    // Après un changement, le focus revient sur le même bouton (même zone si possible).
    const refocaliser = (selecteur, zone) => (racine.querySelector(`${zone} ${selecteur}`) || racine.querySelector(selecteur))?.focus();
    const zoneDe = (el) => { const z = el.closest('[data-z],[data-resultats],.groupe'); return z?.dataset.z ? `[data-z="${z.dataset.z}"]` : z?.id ? `#${z.id}` : '[data-resultats]'; };
    E.recherche.addEventListener('input', chercher);
    E.recherche.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { E.recherche.value = ''; chercher(); }
      if (e.key === 'Enter') { const a = E.listeRes.querySelector('a'); if (a && !E.resultats.hidden) { e.preventDefault(); a.click(); } }
    });
    racine.addEventListener('click', (e) => {
      const b = e.target.closest('[data-epingle]');
      if (b) {
        const k = b.dataset.epingle, l = prefs().epingles.filter((x) => x !== k);
        if (b.getAttribute('aria-pressed') !== 'true') l.push(k);
        const zone = zoneDe(b);
        changerPrefs({ epingles: l }); rendre(); refocaliser(`[data-epingle="${k}"]`, zone);
        return;
      }
      const m = e.target.closest('[data-masquer]');
      if (m) {
        const k = m.dataset.masquer, p = prefs(), masque = p.masques.includes(k);
        changerPrefs({ masques: masque ? p.masques.filter((x) => x !== k) : [...p.masques, k], epingles: masque ? p.epingles : p.epingles.filter((x) => x !== k) });
        rendre(); refocaliser(`[data-masquer="${k}"]`, '');
        return;
      }
      const d = e.target.closest('[data-monter],[data-descendre]');
      if (d) {
        const k = d.dataset.monter || d.dataset.descendre, l = epingles(), i = l.indexOf(k), j = d.dataset.monter ? i - 1 : i + 1;
        if (i < 0 || j < 0 || j >= l.length) return;
        [l[i], l[j]] = [l[j], l[i]];
        changerPrefs({ epingles: [...l, ...prefs().epingles.filter((x) => !l.includes(x))] });
        rendre(); refocaliser(`[data-${d.dataset.monter ? 'monter' : 'descendre'}="${k}"]:not([disabled])`, '[data-z="epingles"]');
        return;
      }
      const a = e.target.closest('a[data-pre]');
      if (a) { if (avantOuverture) avantOuverture(a.dataset.pre); noterOuverture(a.dataset.pre); }
      const f = e.target.closest('[data-filtre]');
      if (f) { filtre = f.dataset.filtre; rendre(); racine.querySelector(`[data-filtre="${filtre}"]`)?.focus(); return; }
      const s = e.target.closest('[data-saut]');
      if (s) { const det = document.getElementById('t-' + s.dataset.saut); if (det) det.open = true; }
    });
    // Renommer : enregistré en quittant le champ ou avec Entrée ; vide = nom d'origine.
    racine.addEventListener('change', (e) => {
      const i = e.target.closest('[data-renommer]');
      if (!i) return;
      const k = i.dataset.renommer, noms = { ...prefs().noms }, v = i.value.trim().replace(/\s+/g, ' ').slice(0, 60).replace(/[<>]/g, '');
      if (v && v !== P(k).nom) noms[k] = v; else delete noms[k];
      changerPrefs({ noms });
      const small = i.parentElement.querySelector('small');
      if (small) small.textContent = noms[k] ? `Nom d’origine : ${P(k).nom}` : 'Touchez le nom pour le changer';
    });
    racine.addEventListener('keydown', (e) => { const i = e.target.closest('[data-renommer]'); if (i && e.key === 'Enter') { e.preventDefault(); i.blur(); } });
    E.themes.addEventListener('toggle', () => { garder(CLE_OUVERTS, [...E.themes.querySelectorAll('details[open]')].map((x) => x.id.slice(2))); }, true);
    window.addEventListener('qme-espace-prefs', (e) => { if (e.detail?.depuisCompte) rendre(); });
    return {
      maj(liste) { tous = [...new Set(liste)].filter((k) => P(k)); rendre(); },
      edition(on) { edition = Boolean(on); if (edition) { E.recherche.value = ''; chercher(); } rendre(); },
      get nombre() { return tous.length; },
      get visibles() { return mes.slice(); },
    };
  }
  // Info-bulle du badge (coin de l'icône) : ouverte vers la droite quand le badge est dans la moitié gauche de l'écran.
  const orienter = (e) => {
    const zone = e.target?.closest?.('a, .carte-app, .app'), m = zone?.querySelector?.('.app-marque');
    if (m) m.classList.toggle('vers-droite', m.getBoundingClientRect().left < innerWidth / 2);
  };
  for (const t of ['pointerover', 'focusin', 'touchstart']) document.addEventListener(t, orienter, { passive: true });

  window.QMEEspace = { creer, noterOuverture, lire, garder, esc, statut, badgeStatut, etendreAdmin, prefs, prenom, changerPrefs, CLE_MAJ };
})();
