// Ludothèque · interface. Socle commun : templates/commun/socle.js. Règles : regles.js (window.JDS).
// Catalogue d'exemple de jeux inventés ; aucune base ni API externe.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.JDS;
  const O = window.QME_OUTILS;
  const { esc } = window.QME_SOCLE;
  let S = null;
  const uid = () => O.nouvelId();
  const dateFr = (s) => (s ? O.versDate(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
  const nomCat = (id) => B.categories.find((c) => c.id === id)?.nom || '';
  const jeu = (id) => S.E.jeux.find((j) => j.id === id);
  const joueurs = (j) => (j.joueursMin === j.joueursMax ? `${j.joueursMin} joueur${j.joueursMin > 1 ? 's' : ''}` : `${j.joueursMin} à ${j.joueursMax} joueurs`);
  const ui = { cat: 'toutes', q: '', tri: 'nom', critere: { joueurs: 4, temps: 60, age: null, complexiteMax: 5, categories: [], mecaniques: [] } };

  const depuisExemple = (x, extra = {}) => R.normaliserJeu({ id: uid(), nom: x.nom, statut: 'possede', joueursMin: x.min, joueursMax: x.max, duree: x.duree, complexite: x.complexite, age: x.age, categories: x.categories, mecaniques: x.mecaniques, extensions: (x.extensions || []).map((n) => ({ id: uid(), nom: n, possede: true })), ...extra });

  // ---------- Données de démonstration (jeux inventés) ----------
  function donneesDemo() {
    const t = O.iso(new Date());
    const jeux = B.exemples.slice(0, 18).map((x, i) => depuisExemple(x, { emplacement: B.emplacements[i % B.emplacements.length], acquisLe: O.ajout(t, -60 - i * 45), note: [5, 4, 3, 4, 5, 3, 4, 4, 5, 3, 4, 2, 3, 4, 3, 5, 4, 3][i] }));
    jeux[3].pretA = 'Léa'; jeux[3].pretLe = O.ajout(t, -12);
    jeux[11].extensions[0].possede = false;
    jeux.push(...B.exemples.slice(18).map((x) => depuisExemple(x, { statut: 'decouvrir', commentaire: 'Repéré en ludothèque.' })));
    const parties = [];
    const p = (i, j, joueurs, duree, gagnant = '') => parties.push({ id: uid(), jeuId: jeux[i].id, date: O.ajout(t, -j), joueurs, duree, gagnant });
    p(1, 2, 4, 50, 'Lou'); p(2, 3, 5, 15, 'Noé'); p(2, 10, 4, 15); p(6, 5, 3, 25, 'Camille'); p(1, 16, 3, 45); p(4, 9, 2, 65, 'Victoire collective');
    p(9, 20, 4, 40, 'Sacha'); p(3, 30, 8, 20); p(7, 33, 2, 30, 'Camille'); p(10, 40, 6, 25); p(0, 45, 3, 110, 'Sacha'); p(6, 52, 4, 25);
    p(15, 70, 3, 80, 'Victoire collective'); p(1, 85, 4, 45); p(13, 100, 4, 20); p(8, 120, 4, 95, 'Victoire collective'); p(17, 140, 2, 50);
    p(2, 160, 6, 15); p(9, 190, 3, 35); p(0, 230, 4, 120); p(5, 400, 3, 80); p(12, 420, 2, 15);
    return R.normaliser({ jeux, parties });
  }

  // ---------- Premier lancement ----------
  function accueil() {
    return `
      <p class="surtitre">Bienvenue</p>
      <h1>Ta collection, tes parties, et une idée de jeu pour ce soir.</h1>
      <p class="intro">Ajoute tes jeux avec le nombre de joueurs, la durée, la complexité et l'âge. Note tes parties en quelques secondes : les statistiques et les suggestions se calculent.</p>
      <form id="form-accueil" class="formulaire-accueil" novalidate>
        <label class="case"><input type="checkbox" name="exemples"> Commencer avec quelques jeux d'exemple (inventés, à supprimer quand tu veux)</label>
        <div class="accueil-pied"><span></span><button class="btn primaire" type="submit">Ouvrir ma ludothèque</button></div>
      </form>
      <ol class="conseils" style="margin-top:32px">${B.conseils.map(([a, b]) => `<li><b>${esc(a)}</b><span>${esc(b)}</span></li>`).join('')}</ol>`;
  }
  function apresAccueil() {
    S.$('#form-accueil').addEventListener('submit', (e) => {
      e.preventDefault();
      const etat = R.etatVide();
      if (new FormData(e.target).get('exemples')) etat.jeux = B.exemples.slice(0, 8).map((x) => depuisExemple(x, { acquisLe: S.auj() }));
      S.terminerAccueil(etat, { vue: 'collection', message: etat.jeux.length ? 'Jeux d\'exemple ajoutés. Ajoute les tiens.' : 'Ajoute ton premier jeu.' });
    });
  }

  // ---------- Vues ----------
  const AVERTISSEMENT = `<p class="mention avertissement">${esc(B.avertissement)}</p>`;
  const pastilleComplexite = (n) => `<span class="complexite" title="Complexité ${n}/5 : ${esc(B.complexites[n - 1].toLowerCase())}" aria-label="Complexité ${n} sur 5">${'●'.repeat(n)}<span>${'●'.repeat(5 - n)}</span></span>`;
  function carteJeu(j, avecPartie = true) {
    const s = R.statsJeu(j, S.E.parties, S.auj());
    const ext = j.extensions.filter((x) => x.possede).length;
    const ressortir = R.aRessortir(j, S.E.parties, S.auj());
    return `<div class="carte-el carte-jeu ${j.pretA ? 'prete' : ''}">
      <button class="lien-ligne" data-action="jeu-ouvrir" data-id="${j.id}"><b>${esc(j.nom)}</b><span>${joueurs(j)} · ${j.duree} min · ${j.age} ans et +</span></button>
      <span class="detail">${pastilleComplexite(j.complexite)} ${esc(j.categories.map(nomCat).join(', '))}</span>
      <span class="etiquettes">${j.pretA ? `<span class="etiquette rose">Prêté à ${esc(j.pretA)}</span>` : ''}${ressortir ? '<span class="etiquette jaune">À ressortir</span>' : ''}${ext ? `<span class="etiquette ciel">${S.pluriel(ext, 'extension')}</span>` : ''}${j.note ? `<span class="etiquette sable">${'★'.repeat(j.note)}</span>` : ''}</span>
      <span class="mini">${s.nb ? `${S.pluriel(s.nb, 'partie')} · dernière le ${dateFr(s.derniere)}` : 'Jamais joué'}${j.emplacement ? ` · ${esc(j.emplacement)}` : ''}</span>
      ${avecPartie && j.statut === 'possede' ? `<div class="rang-boutons"><button class="btn petit" data-action="partie-rapide" data-id="${j.id}">${S.ICONES.plus}Partie</button></div>` : ''}
    </div>`;
  }

  function vueCollection() {
    const t = S.auj();
    const q = ui.q.trim().toLowerCase();
    let liste = S.E.jeux.filter((j) => j.statut === 'possede' && (ui.cat === 'toutes' || (ui.cat === 'pretes' ? j.pretA : ui.cat === 'ressortir' ? R.aRessortir(j, S.E.parties, t) : j.categories.includes(ui.cat)))
      && (!q || `${j.nom} ${j.mecaniques.join(' ')} ${j.emplacement} ${j.extensions.map((x) => x.nom).join(' ')}`.toLowerCase().includes(q)));
    const st = (j) => R.statsJeu(j, S.E.parties, t);
    const tris = { nom: (a, b) => a.nom.localeCompare(b.nom, 'fr'), parties: (a, b) => st(b).nb - st(a).nb, recent: (a, b) => (st(b).derniere || '').localeCompare(st(a).derniere || ''), duree: (a, b) => a.duree - b.duree };
    liste = liste.sort(tris[ui.tri]);
    const nb = S.E.jeux.filter((j) => j.statut === 'possede').length;
    return `
      <div class="vue-tete"><div><h1>Collection</h1><p>${S.pluriel(nb, 'jeu possédé', 'jeux possédés')}. Touche un jeu pour sa fiche, « Partie » pour noter une partie d'aujourd'hui.</p></div>
        <div class="actions"><button class="btn" data-action="catalogue">Catalogue d'exemple</button><button class="btn primaire" data-action="jeu-nouveau">${S.ICONES.plus}Jeu</button></div></div>
      <div class="outils-liste">
        <div class="rang-boutons">
          <label class="champ"><span class="sr-only">Filtrer</span><select id="filtre-cat"><option value="toutes">Toutes les catégories</option><option value="ressortir" ${ui.cat === 'ressortir' ? 'selected' : ''}>À ressortir</option><option value="pretes" ${ui.cat === 'pretes' ? 'selected' : ''}>Prêtés</option>${B.categories.map((c) => `<option value="${c.id}" ${ui.cat === c.id ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}</select></label>
          <label class="champ"><span class="sr-only">Trier</span><select id="tri"><option value="nom" ${ui.tri === 'nom' ? 'selected' : ''}>Nom</option><option value="parties" ${ui.tri === 'parties' ? 'selected' : ''}>Plus joués</option><option value="recent" ${ui.tri === 'recent' ? 'selected' : ''}>Joués récemment</option><option value="duree" ${ui.tri === 'duree' ? 'selected' : ''}>Plus courts</option></select></label>
        </div>
        <label class="champ recherche"><span class="sr-only">Rechercher</span><input id="recherche" type="search" placeholder="Nom, mécanique, extension, emplacement" value="${esc(ui.q)}"></label>
      </div>
      ${liste.length ? `<div class="grille-cartes">${liste.map((j) => carteJeu(j)).join('')}</div>` : `<div class="vide-etat">${S.FORME_VIDE}<div><h3>${nb ? 'Aucun jeu ne correspond' : 'Aucun jeu pour l\'instant'}</h3><p>${nb ? 'Change le filtre ou la recherche.' : 'Ajoute tes jeux un à un, ou pars du catalogue d\'exemple (jeux inventés).'}</p><div class="actions"><button class="btn primaire" data-action="jeu-nouveau">${S.ICONES.plus}Jeu</button></div></div></div>`}
      ${AVERTISSEMENT}`;
  }

  function vueJouer() {
    const c = ui.critere;
    const res = R.suggestions(S.E, c, S.auj());
    const temps = [15, 30, 45, 60, 90, 120, 180, 240];
    return `
      <div class="vue-tete"><div><h1>Que jouer ?</h1><p>Indique qui joue et combien de temps vous avez : seuls les jeux disponibles de ta collection qui conviennent sont proposés, classés et expliqués.</p></div></div>
      <form id="form-jouer" class="carte-el criteres">
        <div class="rang-champs">
          <label class="champ">Joueurs<input type="number" name="joueurs" min="1" max="30" value="${c.joueurs ?? ''}"></label>
          <label class="champ">Temps disponible<select name="temps"><option value="">Peu importe</option>${temps.map((x) => `<option value="${x}" ${c.temps === x ? 'selected' : ''}>${x < 60 ? `${x} min` : `${x / 60} h`.replace('.5', ' h 30').replace(' h h', ' h')}</option>`).join('')}</select></label>
          <label class="champ">Âge du plus jeune<input type="number" name="age" min="3" max="99" value="${c.age ?? ''}" placeholder="—"></label>
          <label class="champ">Complexité maximale<select name="complexiteMax">${B.complexites.map((n, i) => `<option value="${i + 1}" ${c.complexiteMax === i + 1 ? 'selected' : ''}>${i + 1} · ${esc(n)}</option>`).join('')}</select></label>
        </div>
        <fieldset class="champ"><legend>Envie de…</legend><div class="puces-choix">${B.categories.map((x) => `<button type="button" data-action="envie-cat" data-id="${x.id}" aria-pressed="${c.categories.includes(x.id)}">${esc(x.nom)}</button>`).join('')}</div></fieldset>
        <details><summary>Mécaniques préférées</summary><div class="puces-choix">${B.mecaniques.map((m) => `<button type="button" data-action="envie-meca" data-id="${esc(m)}" aria-pressed="${c.mecaniques.includes(m)}">${esc(m)}</button>`).join('')}</div></details>
      </form>
      <h2 class="titre-section">${res.length ? `${S.pluriel(res.length, 'jeu proposé', 'jeux proposés')}` : 'Aucun jeu ne convient'} <span>${c.joueurs ? `${c.joueurs} joueurs` : ''}${c.temps ? ` · ${c.temps} min (tolérance ${Math.round((R.TOLERANCE - 1) * 100)} %)` : ''}</span></h2>
      ${res.length ? `<ol class="suggestions">${res.slice(0, 12).map((x, i) => `<li class="${i < 3 ? 'podium' : ''}"><span class="rang">${i + 1}</span><div><button class="lien-ligne" data-action="jeu-ouvrir" data-id="${x.jeu.id}"><b>${esc(x.jeu.nom)}</b><span>${joueurs(x.jeu)} · ${x.jeu.duree} min · ${esc(B.complexites[x.jeu.complexite - 1].toLowerCase())}</span></button>${x.raisons.length ? `<p class="raisons">${esc(x.raisons.join(' · '))}</p>` : ''}</div><button class="btn petit primaire" data-action="partie-rapide" data-id="${x.jeu.id}">On y joue</button></li>`).join('')}</ol>`
        : `<div class="vide-etat petit"><div><h3>Rien dans ta collection pour ces critères</h3><p>Élargis le temps ou la complexité, ou regarde ta liste à découvrir.</p></div></div>`}
      <p class="mention" style="margin-top:16px">Les jeux prêtés et ceux de la liste à découvrir ne sont pas proposés. Un jeu peu joué récemment est mis en avant ; un jeu joué cette semaine passe derrière.</p>`;
  }

  function vueParties() {
    const ps = [...S.E.parties].sort((a, b) => b.date.localeCompare(a.date));
    const groupes = [];
    for (const p of ps) { const m = p.date.slice(0, 7); let g = groupes.find((x) => x.m === m); if (!g) { g = { m, ps: [] }; groupes.push(g); } g.ps.push(p); }
    const nomMois = (m) => { const s = O.versDate(`${m}-01`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }); return s.charAt(0).toUpperCase() + s.slice(1); };
    return `
      <div class="vue-tete"><div><h1>Parties</h1><p>${S.pluriel(ps.length, 'partie notée', 'parties notées')}. Elles alimentent les statistiques et les suggestions.</p></div>
        <div class="actions"><button class="btn primaire" data-action="partie-nouvelle">${S.ICONES.plus}Partie</button></div></div>
      ${groupes.length ? groupes.map((g) => `<section class="groupe-cat"><h2 class="titre-cat">${nomMois(g.m)}<span>${S.pluriel(g.ps.length, 'partie')}</span></h2><ul class="lignes-abos">${g.ps.map((p) => { const j = jeu(p.jeuId); return `<li class="ligne"><button class="ligne-info" data-action="partie-ouvrir" data-id="${p.id}"><b>${esc(j?.nom || 'Jeu supprimé')}</b><span class="ligne-detail">${dateFr(p.date)}${p.joueurs ? ` · ${p.joueurs} joueurs` : ''}${p.duree ? ` · ${p.duree} min` : ''}${p.gagnant ? ` · ${esc(p.gagnant)}` : ''}${p.extensions.length ? ` · avec ${esc(p.extensions.join(', '))}` : ''}</span>${p.commentaire ? `<span class="ligne-detail">${esc(p.commentaire)}</span>` : ''}</button></li>`; }).join('')}</ul></section>`).join('')
        : `<div class="vide-etat">${S.FORME_VIDE}<div><h3>Aucune partie notée</h3><p>Note une partie en quelques secondes depuis la collection (bouton « Partie ») ou ici.</p><div class="actions"><button class="btn primaire" data-action="partie-nouvelle" ${S.E.jeux.some((j) => j.statut === 'possede') ? '' : 'disabled'}>${S.ICONES.plus}Partie</button></div></div></div>`}`;
  }

  function vueStats() {
    const s = R.statistiques(S.E, S.auj());
    const maxM = Math.max(1, ...s.mois.map((m) => m.nb));
    const moisCourt = (m) => O.versDate(`${m}-01`).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
    return `
      <div class="vue-tete"><div><h1>Statistiques</h1><p>Ce que tu possèdes, ce à quoi tu joues, et ce qui dort sur l'étagère.</p></div></div>
      <div class="tuiles">
        <div class="tuile" style="--c:var(--bleu)"><p class="surtitre">Jeux possédés</p><b>${s.possedes}</b><span>${S.pluriel(s.extensions, 'extension')} · ${S.pluriel(s.pretes, 'prêté', 'prêtés')}</span></div>
        <div class="tuile rond" style="--c:var(--jaune)"><p class="surtitre">Parties sur 12 mois</p><b>${s.parties12}</b><span>${S.pluriel(s.parties, 'partie')} en tout</span></div>
        <div class="tuile" style="--c:var(--vert)"><p class="surtitre">Utilisation</p><b>${s.tauxUtilisation === null ? '–' : `${s.tauxUtilisation} %`}</b><span>des jeux joués dans l'année</span></div>
        <div class="tuile rond" style="--c:var(--rouge)"><p class="surtitre">À ressortir</p><b>${s.aRessortir.length}</b><span>dont ${S.pluriel(s.jamais.length, 'jamais joué', 'jamais joués')}</span></div>
      </div>
      <h2 class="titre-section">Parties par mois <span>12 derniers mois</span></h2>
      <figure class="graphique"><div class="projection">${s.mois.map((m, i) => `<div class="col-proj ${i === 11 ? 'actif' : ''}" tabindex="0" data-info="${esc(`<b>${moisCourt(m.mois)}</b>${S.pluriel(m.nb, 'partie')}`)}"><span class="cp-val">${m.nb || ''}</span><span class="cp-zone"><span class="cp-barre" style="height:${Math.max(1, (m.nb / maxM) * 100)}%"></span></span><span class="cp-mois">${moisCourt(m.mois)}</span></div>`).join('')}</div><div class="infobulle" hidden></div>
        <table class="sr-only"><caption>Parties par mois</caption><tbody>${s.mois.map((m) => `<tr><td>${m.mois}</td><td>${m.nb}</td></tr>`).join('')}</tbody></table></figure>
      <div class="colonnes-2">
        <section><h2 class="titre-section">Les plus joués</h2>${s.top.length ? `<ol class="classement">${s.top.map((x) => `<li><button class="lien-ligne" data-action="jeu-ouvrir" data-id="${x.jeu.id}"><b>${esc(x.jeu.nom)}</b><span>${S.pluriel(x.nb, 'partie')} · dernière le ${dateFr(x.derniere)}${x.dureeMoyenne ? ` · ${x.dureeMoyenne} min en moyenne` : ''}</span></button></li>`).join('')}</ol>` : '<p class="aide">Aucune partie notée.</p>'}</section>
        <section><h2 class="titre-section">À ressortir <span>Pas joués depuis 12 mois</span></h2>${s.aRessortir.length ? `<ul class="lignes-abos">${s.aRessortir.map((j) => { const x = R.statsJeu(j, S.E.parties, S.auj()); return `<li class="ligne alerte-jaune"><button class="ligne-info" data-action="jeu-ouvrir" data-id="${j.id}"><b>${esc(j.nom)}</b><span class="ligne-detail">${x.nb ? `dernière partie le ${dateFr(x.derniere)}` : 'jamais joué'} · ${joueurs(j)} · ${j.duree} min</span></button></li>`; }).join('')}</ul>` : '<p class="aide">Tous tes jeux ont été joués dans l\'année.</p>'}</section>
      </div>
      <h2 class="titre-section">Par catégorie</h2>
      ${s.parCategorie.length ? `<div class="defile"><table class="tableau compact"><thead><tr><th>Catégorie</th><th class="nb">Jeux</th><th class="nb">Parties</th></tr></thead><tbody>${s.parCategorie.map((x) => `<tr><td>${esc(x.nom)}</td><td class="nb">${x.jeux}</td><td class="nb">${x.parties}</td></tr>`).join('')}</tbody></table></div>` : '<p class="aide">Ajoute des catégories à tes jeux.</p>'}
      ${AVERTISSEMENT}`;
  }

  function vueDecouvrir() {
    const ls = S.E.jeux.filter((j) => j.statut === 'decouvrir').sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    const sortis = S.E.jeux.filter((j) => j.statut === 'sorti');
    return `
      <div class="vue-tete"><div><h1>À découvrir</h1><p>Les jeux qui te tentent, à essayer ou à acheter. Ils restent séparés de ta collection.</p></div>
        <div class="actions"><button class="btn primaire" data-action="jeu-nouveau" data-statut="decouvrir">${S.ICONES.plus}Jeu à découvrir</button></div></div>
      ${ls.length ? `<div class="grille-cartes">${ls.map((j) => `<div class="carte-el"><button class="lien-ligne" data-action="jeu-ouvrir" data-id="${j.id}"><b>${esc(j.nom)}</b><span>${joueurs(j)} · ${j.duree} min · ${j.age} ans et +</span></button>${j.commentaire ? `<span class="detail">${esc(j.commentaire)}</span>` : ''}<div class="rang-boutons"><button class="btn petit primaire" data-action="acquis" data-id="${j.id}">Je l'ai</button></div></div>`).join('')}</div>`
        : `<div class="vide-etat">${S.FORME_VIDE}<div><h3>Liste vide</h3><p>Note ici les jeux repérés chez des amis, en ludothèque ou en boutique.</p></div></div>`}
      ${sortis.length ? `<h2 class="titre-section">Sortis de la collection <span>Vendus, donnés</span></h2><ul class="liste-simple">${sortis.map((j) => `<li><button class="lien-ligne" data-action="jeu-ouvrir" data-id="${j.id}"><b>${esc(j.nom)}</b><span>${S.pluriel(R.statsJeu(j, S.E.parties, S.auj()).nb, 'partie')} notées</span></button></li>`).join('')}</ul>` : ''}`;
  }

  // ---------- Modales ----------
  function modaleJeu(id, statut = 'possede') {
    const j0 = id ? jeu(id) : null;
    let j = structuredClone(j0 || R.normaliserJeu({ id: uid(), nom: '', statut, joueursMin: 2, joueursMax: 4, duree: 30, complexite: 2, age: 8, acquisLe: statut === 'possede' ? S.auj() : null }));
    const s = j0 ? R.statsJeu(j0, S.E.parties, S.auj()) : null;
    const corps = () => `
      <label class="champ">Nom du jeu<input name="nom" maxlength="100" value="${esc(j.nom)}"></label>
      <div class="choix-statut">${[['possede', 'Possédé'], ['decouvrir', 'À découvrir'], ['sorti', 'Sorti']].map(([v, l]) => `<label><input type="radio" name="statut" value="${v}" ${j.statut === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
      <div class="rang-champs"><label class="champ">Joueurs min.<input type="number" name="joueursMin" min="1" max="100" value="${j.joueursMin}"></label><label class="champ">Joueurs max.<input type="number" name="joueursMax" min="1" max="100" value="${j.joueursMax}"></label><label class="champ">Durée moyenne (min)<input type="number" name="duree" min="1" max="1440" value="${j.duree}"></label><label class="champ">Âge conseillé<input type="number" name="age" min="0" max="99" value="${j.age}"></label></div>
      <div class="rang-champs"><label class="champ">Complexité<select name="complexite">${B.complexites.map((n, i) => `<option value="${i + 1}" ${j.complexite === i + 1 ? 'selected' : ''}>${i + 1} · ${esc(n)}</option>`).join('')}</select></label><label class="champ">Ta note<select name="note"><option value="0">—</option>${[1, 2, 3, 4, 5].map((n) => `<option value="${n}" ${j.note === n ? 'selected' : ''}>${'★'.repeat(n)}</option>`).join('')}</select></label></div>
      <fieldset class="champ"><legend>Catégories</legend><div class="puces-choix">${B.categories.map((c) => `<label class="puce-case"><input type="checkbox" name="cat-${c.id}" ${j.categories.includes(c.id) ? 'checked' : ''}><span>${esc(c.nom)}</span></label>`).join('')}</div></fieldset>
      <details ${j.mecaniques.length ? 'open' : ''}><summary>Mécaniques (${j.mecaniques.length})</summary><div class="puces-choix">${B.mecaniques.map((m, i) => `<label class="puce-case"><input type="checkbox" name="meca-${i}" ${j.mecaniques.includes(m) ? 'checked' : ''}><span>${esc(m)}</span></label>`).join('')}</div></details>
      <fieldset class="champ cadre-champs"><legend>Extensions</legend><div id="extensions">${j.extensions.map((x, i) => `<div class="rang-ext"><label class="champ"><span class="sr-only">Extension</span><input name="ext-${i}" maxlength="80" value="${esc(x.nom)}"></label><label class="case"><input type="checkbox" name="extp-${i}" ${x.possede ? 'checked' : ''}> Possédée</label><button class="btn-icone" type="button" data-action="ext-retirer" data-id="${i}" aria-label="Retirer">×</button></div>`).join('')}</div><button class="btn petit" type="button" data-action="ext-ajouter">${S.ICONES.plus}Extension</button></fieldset>
      <div class="rang-champs"><label class="champ">Emplacement<input name="emplacement" maxlength="80" list="emplacements" value="${esc(j.emplacement)}"></label><label class="champ">Acquis le<input type="date" name="acquisLe" value="${j.acquisLe || ''}"></label></div>
      <datalist id="emplacements">${[...new Set([...B.emplacements, ...S.E.jeux.map((x) => x.emplacement).filter(Boolean)])].map((e) => `<option value="${esc(e)}">`).join('')}</datalist>
      <div class="rang-champs"><label class="champ">Prêté à <small>Vide s'il est chez toi.</small><input name="pretA" maxlength="60" value="${esc(j.pretA)}"></label><label class="champ">Depuis le<input type="date" name="pretLe" value="${j.pretLe || ''}"></label></div>
      <label class="champ">Commentaire<textarea name="commentaire" rows="2" maxlength="500">${esc(j.commentaire)}</textarea></label>
      ${s ? `<p class="mini">${s.nb ? `${S.pluriel(s.nb, 'partie')}, dernière le ${dateFr(s.derniere)}${s.dureeMoyenne ? `, ${s.dureeMoyenne} min en moyenne` : ''}.` : 'Aucune partie notée.'}</p>` : ''}
      <p class="erreur" role="alert"></p>`;
    const lire = (form) => {
      const f = new FormData(form);
      const n = (k) => Number(f.get(k));
      return { ...j, nom: O.texte(f.get('nom'), 100), statut: f.get('statut'), joueursMin: n('joueursMin'), joueursMax: n('joueursMax'), duree: n('duree'), age: n('age'), complexite: n('complexite'), note: n('note'),
        categories: B.categories.filter((c) => f.get(`cat-${c.id}`)).map((c) => c.id), mecaniques: B.mecaniques.filter((m, i) => f.get(`meca-${i}`)),
        extensions: [...form.querySelectorAll('.rang-ext')].map((el, i) => ({ id: j.extensions[i]?.id || uid(), nom: O.texte(f.get(`ext-${i}`), 80), possede: !!f.get(`extp-${i}`) })),
        emplacement: O.texte(f.get('emplacement'), 80), acquisLe: f.get('acquisLe') || null, pretA: O.texte(f.get('pretA'), 60), pretLe: f.get('pretLe') || null, commentaire: O.texte(f.get('commentaire'), 500) };
    };
    const d = S.ouvrirModale(j0 ? esc(j0.nom) : 'Nouveau jeu', corps(), j0
      ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>', (f, action) => {
      if (action === 'supprimer') {
        const n = S.E.parties.filter((p) => p.jeuId === j0.id).length;
        if (!S.confirmer(`Supprimer « ${j0.nom} »${n ? ` et ses ${n} parties notées ? Pour garder l'historique, choisis plutôt « Sorti »` : ''} ?`)) { S.garderModale(); return undefined; }
        S.retenir(); S.E.jeux = S.E.jeux.filter((x) => x.id !== j0.id); S.E.parties = S.E.parties.filter((p) => p.jeuId !== j0.id); S.sauver(); S.rendre(); S.toast('Jeu supprimé.', { libelle: 'Annuler', faire: S.annuler });
        return undefined;
      }
      const x = lire(d.querySelector('form'));
      const err = R.validerJeu(x);
      if (err) return err;
      if (x.extensions.some((e) => !e.nom)) return 'Chaque extension doit avoir un nom (ou retire-la).';
      if (S.E.jeux.some((y) => y.id !== x.id && y.nom.toLowerCase() === x.nom.toLowerCase() && y.statut === x.statut) && !S.confirmer(`« ${x.nom} » existe déjà. L'ajouter quand même ?`)) return 'Jeu déjà présent.';
      S.retenir();
      const propre = R.normaliserJeu(x);
      if (j0) Object.assign(j0, propre); else S.E.jeux.push(propre);
      S.sauver(); S.rendre(); S.toast(j0 ? 'Fiche enregistrée.' : `« ${propre.nom} » ajouté.`, { libelle: 'Annuler', faire: S.annuler });
      return undefined;
    }, { large: true });
    const form = d.querySelector('form');
    form.addEventListener('click', (e) => {
      const b = e.target.closest('[data-action="ext-ajouter"],[data-action="ext-retirer"]');
      if (!b) return;
      e.stopPropagation();
      j = lire(form);
      if (b.dataset.action === 'ext-ajouter') j.extensions.push({ id: uid(), nom: '', possede: true });
      else j.extensions.splice(Number(b.dataset.id), 1);
      d.querySelector('.modale-corps').innerHTML = corps();
      if (b.dataset.action === 'ext-ajouter') d.querySelector('.rang-ext:last-child input')?.focus();
    });
  }

  function modalePartie(id, jeuId) {
    const p = id ? S.E.parties.find((x) => x.id === id) : null;
    const possedes = S.E.jeux.filter((j) => j.statut === 'possede' || j.id === p?.jeuId).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    if (!possedes.length) { S.toast('Ajoute d\'abord un jeu à ta collection.'); return; }
    let jid = p?.jeuId || jeuId || possedes[0].id;
    const corps = () => {
      const j = jeu(jid);
      return `
        <label class="champ">Jeu<select name="jeuId" data-maj="1">${possedes.map((x) => `<option value="${x.id}" ${x.id === jid ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label>
        <div class="rang-champs"><label class="champ">Date<input type="date" name="date" value="${p?.date || S.auj()}"></label><label class="champ">Joueurs<input type="number" name="joueurs" min="1" max="100" value="${p?.joueurs ?? (ui.critere.joueurs || '')}"></label><label class="champ">Durée (min)<input type="number" name="duree" min="1" max="1440" value="${p?.duree ?? ''}" placeholder="${j.duree}"></label></div>
        <label class="champ">Gagnant <small>Facultatif.</small><input name="gagnant" maxlength="80" value="${esc(p?.gagnant || '')}"></label>
        ${j.extensions.filter((x) => x.possede).length ? `<fieldset class="champ"><legend>Extensions utilisées</legend>${j.extensions.filter((x) => x.possede).map((x) => `<label class="case"><input type="checkbox" name="e-${x.id}" ${p?.extensions.includes(x.nom) ? 'checked' : ''}> ${esc(x.nom)}</label>`).join('')}</fieldset>` : ''}
        <label class="champ">Commentaire<input name="commentaire" maxlength="300" value="${esc(p?.commentaire || '')}"></label>
        <p class="erreur" role="alert"></p>`;
    };
    const d = S.ouvrirModale(p ? 'Partie' : 'Nouvelle partie', corps(), p ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>' : '<button class="btn primaire" value="ok">Noter la partie</button><button class="btn" value="annuler">Annuler</button>', (f, action) => {
      if (action === 'supprimer') { S.retenir(); S.E.parties = S.E.parties.filter((x) => x.id !== p.id); S.sauver(); S.rendre(); S.toast('Partie supprimée.', { libelle: 'Annuler', faire: S.annuler }); return undefined; }
      const date = f.get('date');
      if (!O.estDate(date)) return 'Indique la date de la partie.';
      if (date > O.ajout(S.auj(), 1)) return 'Une partie se note une fois jouée : la date est dans le futur.';
      const j = jeu(f.get('jeuId'));
      const nbJ = String(f.get('joueurs') || '').trim() ? Number(f.get('joueurs')) : null;
      if (nbJ !== null && !(Number.isInteger(nbJ) && nbJ >= 1 && nbJ <= 100)) return 'Joueurs : nombre entier de 1 à 100.';
      const duree = String(f.get('duree') || '').trim() ? Number(f.get('duree')) : null;
      if (duree !== null && !(duree >= 1 && duree <= 1440)) return 'Durée : de 1 à 1 440 minutes.';
      S.retenir();
      const champs = { jeuId: j.id, date, joueurs: nbJ, duree, gagnant: O.texte(f.get('gagnant'), 80), extensions: j.extensions.filter((x) => f.get(`e-${x.id}`)).map((x) => x.nom), commentaire: O.texte(f.get('commentaire'), 300) };
      if (p) Object.assign(p, champs); else S.E.parties.push({ id: uid(), ...champs });
      S.sauver(); S.rendre();
      const nb = S.E.parties.filter((x) => x.jeuId === j.id).length;
      S.toast(p ? 'Partie enregistrée.' : `Partie de « ${j.nom} » notée (${S.pluriel(nb, 'partie')} en tout).`, { libelle: 'Annuler', faire: S.annuler });
      if (nbJ !== null && (nbJ < j.joueursMin || nbJ > j.joueursMax)) setTimeout(() => S.toast(`Note : la fiche indique ${joueurs(j)}.`), 2500);
      return undefined;
    });
    d.querySelector('form').addEventListener('change', (e) => { if (e.target.dataset.maj) { jid = e.target.value; d.querySelector('.modale-corps').innerHTML = corps(); } });
  }

  function modaleCatalogue() {
    S.ouvrirModale('Catalogue d\'exemple', `
      <p class="aide">${esc(B.avertissement)} Coche des jeux pour les ajouter à ta collection ou à ta liste à découvrir : tout reste modifiable.</p>
      <ul class="liste-cases">${B.exemples.map((x, i) => `<li><input type="checkbox" id="ex-${i}" name="ex-${i}"><label class="libelle" for="ex-${i}"><span>${esc(x.nom)}</span><small>${x.min === x.max ? x.min : `${x.min} à ${x.max}`} joueurs · ${x.duree} min · ${x.age} ans et + · ${esc(x.categories.map(nomCat).join(', '))}</small></label><span></span></li>`).join('')}</ul>
      <div class="choix-statut deux"><label><input type="radio" name="ou" value="possede" checked><span>Dans ma collection</span></label><label><input type="radio" name="ou" value="decouvrir"><span>À découvrir</span></label></div>
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const choisis = B.exemples.filter((x, i) => f.get(`ex-${i}`));
      if (!choisis.length) return 'Coche au moins un jeu.';
      S.retenir();
      const ou = f.get('ou');
      choisis.forEach((x) => S.E.jeux.push(depuisExemple(x, { statut: ou, acquisLe: ou === 'possede' ? S.auj() : null })));
      S.sauver(); S.changerVue(ou === 'possede' ? 'collection' : 'decouvrir'); S.toast(`${S.pluriel(choisis.length, 'jeu ajouté', 'jeux ajoutés')}.`, { libelle: 'Annuler', faire: S.annuler });
      return undefined;
    }, { large: true });
  }

  // ---------- Actions ----------
  const basculer = (liste, v) => (liste.includes(v) ? liste.filter((x) => x !== v) : [...liste, v]);
  const actions = {
    'jeu-nouveau': (el) => modaleJeu(null, el.dataset.statut || 'possede'),
    'jeu-ouvrir': (el) => modaleJeu(el.dataset.id),
    'partie-rapide': (el) => modalePartie(null, el.dataset.id),
    'partie-nouvelle': () => modalePartie(null),
    'partie-ouvrir': (el) => modalePartie(el.dataset.id),
    catalogue: () => modaleCatalogue(),
    acquis: (el) => { const j = jeu(el.dataset.id); S.retenir(); j.statut = 'possede'; j.acquisLe = S.auj(); S.sauver(); S.rendre(); S.toast(`« ${j.nom} » rejoint ta collection.`, { libelle: 'Annuler', faire: S.annuler }); },
    'envie-cat': (el) => { ui.critere.categories = basculer(ui.critere.categories, el.dataset.id); S.rendre(); },
    'envie-meca': (el) => { ui.critere.mecaniques = basculer(ui.critere.mecaniques, el.dataset.id); S.rendre(); S.$('#form-jouer details').open = true; },
    imprimer: () => S.imprimer(() => { if (S.vue !== 'collection') S.changerVue('collection'); }),
    'csv-jeux': () => S.exporterCsv(R.csvJeux(S.E, S.auj()), 'ludotheque-jeux'),
    'csv-parties': () => S.exporterCsv(R.csvParties(S.E), 'ludotheque-parties'),
  };

  S = window.QME_SOCLE.creer({
    produit: 'JDS', prefixe: 'jds', nom: 'Ludothèque', fichier: 'ludotheque', titreBarre: 'Ludothèque<br>Jeux de société',
    connexion: { titre: 'Les jeux que tu as, ceux que tu joues, ceux qui dorment.', texte: 'Ta collection de jeux de société avec joueurs, durée, complexité, extensions et emplacement, le journal des parties, les statistiques et une suggestion pour ce soir.', ouvrir: 'Ouvre ta ludothèque', bouton: 'Ouvrir ma ludothèque' },
    onglets: [
      { id: 'collection', nom: 'Collection', icone: 'grille' },
      { id: 'jouer', nom: 'Que jouer ?', icone: 'triangle' },
      { id: 'parties', nom: 'Parties', icone: 'lignes' },
      { id: 'stats', nom: 'Statistiques', icone: 'barres' },
      { id: 'decouvrir', nom: 'À découvrir', icone: 'rond' },
    ],
    etatVide: R.etatVide, normaliser: R.normaliser, donneesDemo, accueil, apresAccueil,
    vues: { collection: vueCollection, jouer: vueJouer, parties: vueParties, stats: vueStats, decouvrir: vueDecouvrir },
    apresRendu() {
      S.$('#recherche')?.addEventListener('input', (e) => { ui.q = e.target.value; S.rendre(); });
      S.$('#filtre-cat')?.addEventListener('change', (e) => { ui.cat = e.target.value; S.rendre(); });
      S.$('#tri')?.addEventListener('change', (e) => { ui.tri = e.target.value; S.rendre(); });
      S.$('#form-jouer')?.addEventListener('change', (e) => {
        const f = new FormData(e.currentTarget);
        const n = (k, min, max) => { const v = Number(f.get(k)); return String(f.get(k) || '').trim() && Number.isFinite(v) && v >= min && v <= max ? v : null; };
        Object.assign(ui.critere, { joueurs: n('joueurs', 1, 30), temps: n('temps', 1, 1440), age: n('age', 3, 99), complexiteMax: n('complexiteMax', 1, 5) || 5 });
        S.rendre();
      });
      S.$('#form-jouer')?.addEventListener('submit', (e) => e.preventDefault());
    },
    actions,
    reglages: {
      exports: [['csv-jeux', 'Jeux (CSV)'], ['csv-parties', 'Parties (CSV)'], ['imprimer', 'Imprimer la collection']],
      aPropos: () => `<p class="mention">${B.categories.length} catégories, ${B.mecaniques.length} mécaniques, ${B.exemples.length} jeux d'exemple inventés (version ${B.version}). ${esc(B.avertissement)}</p>`,
    },
    importValide: (d) => d && typeof d === 'object' && Array.isArray(d.jeux),
    resumeImport: (d) => S.pluriel(d.jeux.length, 'jeu', 'jeux'),
  });
  S.lancer();
})();
