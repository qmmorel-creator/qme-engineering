// PlanB · interface. Socle commun : templates/commun/socle.js. Règles : regles.js (window.PNB).
// Référentiel général et prudent : il ne remplace jamais les consignes des autorités.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.PNB;
  const O = window.QME_OUTILS;
  const { esc } = window.QME_SOCLE;
  let S = null;
  const uid = () => O.nouvelId();
  // Unité accordée : « 6 jeux », « 5 portions » ; abréviations (L, u, kg) inchangées.
  const accord = (n, u) => (n > 1 && /^[a-zéè]{3,}$/.test(u) && !/[sx]$/.test(u) ? (u.endsWith('eu') ? `${u}x` : `${u}s`) : u);
  const q = (n, u) => `${O.fmtNombre(n, { dec: 2 })} ${esc(accord(n, u))}`;
  const dateFr = (s) => (s ? O.versDate(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
  const nomCat = (id) => B.categories.find((c) => c.id === id)?.nom || '';
  const nomProfil = (id) => B.profils.find((p) => p.id === id)?.nom || '';
  const nomBesoin = (id) => B.besoins.find((b) => b.id === id)?.nom || '';
  const ui = { situation: 'electricite' };
  const MOMENTS = [['avant', 'Avant : se préparer'], ['pendant', 'Pendant'], ['apres', 'Après']];
  const article = (id) => S.E.articles.find((a) => a.id === id);

  // ---------- Données de démonstration (foyer fictif) ----------
  function donneesDemo() {
    const e = R.etatVide();
    const t = O.iso(new Date());
    e.reglages = { nomFoyer: 'Foyer d\'exemple', jours: 3, alerteJours: 60 };
    e.membres = [
      { id: uid(), prenom: 'Camille', profil: 'adulte', besoins: ['traitement'], note: 'Traitement du matin et du soir.' },
      { id: uid(), prenom: 'Sacha', profil: 'adulte', besoins: [], note: '' },
      { id: uid(), prenom: 'Lou', profil: 'enfant', besoins: ['alimentation'], note: 'Allergie aux arachides.' },
      { id: uid(), prenom: 'Noé', profil: 'bebe', besoins: [], note: '' },
      { id: uid(), prenom: 'Jeanne', profil: 'senior', besoins: ['mobilite'], note: 'Se déplace avec une canne.' },
    ];
    e.animaux = [{ id: uid(), nom: 'Minou', espece: 'chat', nombre: 1 }];
    e.contacts = [
      { id: uid(), nom: 'Voisine du 2e', role: 'Voisine, a un double des clés', telephone: '06 00 00 00 01', note: 'Numéro fictif' },
      { id: uid(), nom: 'Cousin hors de la région', role: 'Contact hors de la zone', telephone: '06 00 00 00 02', note: 'Numéro fictif' },
    ];
    const lot = (articleId, quantite, j, emplacement = 'Placard du cellier') => ({ id: uid(), articleId, quantite, peremption: j === null ? null : O.ajout(t, j), emplacement });
    e.stock = [
      lot('eau', 24, 240), lot('eau', 12, 25), lot('eau-hygiene', 20, null), lot('repas', 24, 400), lot('repas', 6, -12), lot('en-cas', 10, 45),
      lot('ouvre-boite', 1, null, 'Tiroir de la cuisine'), lot('lampe', 3, null, 'Entrée'), lot('piles', 4, 900, 'Entrée'), lot('radio', 1, null, 'Entrée'),
      lot('trousse', 1, 30, 'Salle de bains'), lot('traitement', 5, 120, 'Salle de bains'), lot('couches', 20, null, 'Chambre de Noé'), lot('lait-infantile', 2, 50, 'Cuisine'),
      lot('nourriture-animal', 6, 150), lot('savon', 2, null), lot('couverture', 5, null, 'Sac d\'évacuation'), lot('copies', 1, null, 'Sac d\'évacuation'),
    ];
    for (const id of ['e1', 'e2', 'e3', 'o1', 'i1', 'v1', 'v2', 'c1', 'c3', 'besoin-traitement']) e.faits[id] = O.ajout(t, -20);
    e.persos = [{ id: uid(), situationId: 'evacuation', moment: 'avant', texte: 'Mettre la caisse de transport du chat près de l\'entrée' }];
    e.plans = { evacuation: { rassemblement: 'Devant l\'école du quartier, puis chez le cousin si besoin', consignes: 'Sacha s\'occupe de Jeanne, Camille de Noé et Lou. Le chat dans sa caisse.' }, communications: { rassemblement: 'À la maison à 18 h si personne ne répond', consignes: 'Envoyer un SMS au cousin, qui fait le relais.' } };
    return R.normaliser(e);
  }

  // ---------- Premier lancement ----------
  function accueil() {
    const champ = (id, lib) => `<label class="champ">${lib}<input type="number" name="${id}" min="0" max="20" value="0" inputmode="numeric"></label>`;
    return `
      <p class="surtitre">Bienvenue</p>
      <h1>Ton foyer est-il prêt ?</h1>
      <p class="intro">Indique la composition du foyer : les quantités de réserves et l'autonomie se calculent à partir d'elle. Tu pourras nommer chaque personne et préciser ses besoins ensuite.</p>
      <form id="form-accueil" class="formulaire-accueil" novalidate>
        <label class="champ">Nom du foyer <small>Facultatif, imprimé sur le plan.</small><input name="nomFoyer" maxlength="80"></label>
        <div class="rang-champs">${champ('adulte', 'Adultes')}${champ('enfant', 'Enfants (3 à 17 ans)')}${champ('bebe', 'Bébés')}${champ('senior', 'Personnes âgées')}</div>
        <div class="rang-champs">${champ('animaux', 'Animaux')}<label class="champ">Objectif d'autonomie (jours)<input type="number" name="jours" min="1" max="30" value="3" inputmode="numeric"></label></div>
        <p class="erreur" role="alert"></p>
        <div class="accueil-pied"><span class="mini">${esc(B.avertissement)}</span><button class="btn primaire" type="submit">Créer mon plan</button></div>
      </form>
      <ol class="conseils" style="margin-top:32px">${B.conseils.map(([a, b]) => `<li><b>${esc(a)}</b><span>${esc(b)}</span></li>`).join('')}</ol>`;
  }
  function apresAccueil() {
    S.$('#form-accueil').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const n = (k) => O.entier(f.get(k), 0, 20, -1);
      if (['adulte', 'enfant', 'bebe', 'senior', 'animaux'].some((k) => n(k) < 0)) return void (e.target.querySelector('.erreur').textContent = 'Nombres entre 0 et 20.');
      const total = n('adulte') + n('enfant') + n('bebe') + n('senior');
      if (!total) return void (e.target.querySelector('.erreur').textContent = 'Indique au moins une personne.');
      const jours = O.entier(f.get('jours'), 1, 30, 0);
      if (!jours) return void (e.target.querySelector('.erreur').textContent = 'Objectif : de 1 à 30 jours.');
      const etat = R.etatVide();
      etat.reglages = { nomFoyer: O.texte(f.get('nomFoyer'), 80), jours, alerteJours: 60 };
      for (const p of B.profils) for (let i = 1; i <= n(p.id); i++) etat.membres.push({ id: uid(), prenom: `${p.nom.split(' (')[0]} ${i}`, profil: p.id, besoins: [], note: '' });
      if (n('animaux')) etat.animaux.push({ id: uid(), nom: '', espece: 'autre', nombre: n('animaux') });
      S.terminerAccueil(etat, { vue: 'tableau', message: 'Plan créé. Commence par l\'inventaire de tes réserves.' });
    });
  }

  // ---------- Vues ----------
  const AVERTISSEMENT = `<p class="mention avertissement">${esc(B.avertissement)} ${esc(B.sourcesExternes)}</p>`;
  const jauge = (pct, coul) => `<span class="jauge" style="--c:${coul}"><span style="width:${Math.max(0, Math.min(100, pct))}%"></span></span>`;
  const coulCouv = (c) => (c >= 1 ? 'var(--vert)' : c >= 0.5 ? 'var(--jaune)' : 'var(--rouge)');
  const fmtJours = (j) => (j === null ? '–' : `${O.fmtNombre(j, { dec: 1 })} j`);

  function vueTableau() {
    const t = S.auj();
    const p = R.preparation(S.E, t);
    const a = R.autonomie(S.E, t);
    const per = R.peremptions(S.E, t, S.E.reglages.alerteJours);
    const m = R.manques(S.E, t);
    const obj = S.E.reglages.jours;
    const coul = p.score >= 70 ? 'var(--vert)' : p.score >= 40 ? 'var(--jaune)' : 'var(--rouge)';
    return `
      <div class="vue-tete"><div><h1>${esc(S.E.reglages.nomFoyer || 'Mon foyer')}</h1><p>${S.pluriel(S.E.membres.length, 'personne')}${S.E.animaux.length ? `, ${S.pluriel(S.E.animaux.reduce((s, x) => s + x.nombre, 0), 'animal', 'animaux')}` : ''} · objectif ${S.pluriel(obj, 'jour')} d'autonomie.</p></div>
        <div class="actions"><button class="btn" data-action="vue" data-vue="plan">Plan familial</button></div></div>
      <div class="bloc-niveau">
        <div class="niveau-score" style="--c:${coul}"><b>${p.score}</b><span>/ 100</span></div>
        <div class="niveau-detail"><p class="surtitre">Niveau de préparation</p><p class="niveau-texte">${p.niveau}</p>
          <div class="jauges">
            <div class="jauge-ligne"><span>Réserves (50 %)</span>${jauge(p.reserves, 'var(--bleu)')}<b>${p.reserves} %</b></div>
            <div class="jauge-ligne"><span>Actions préparées (40 %)</span>${jauge(p.plan, 'var(--jaune)')}<b>${p.actionsFaites}/${p.actionsTotal}</b></div>
            <div class="jauge-ligne"><span>Contact personnel (10 %)</span>${jauge(p.contacts ? 100 : 0, 'var(--vert)')}<b>${p.contacts ? 'oui' : 'non'}</b></div>
          </div></div>
      </div>
      <h2 class="titre-section">Autonomie théorique <span>Stock non périmé ÷ besoin quotidien du foyer. Objectif : ${S.pluriel(obj, 'jour')}.</span></h2>
      <div class="tuiles tuiles-3">
        ${[['Eau potable', a.eau, 'var(--bleu)', ''], ['Nourriture', a.nourriture, 'var(--jaune)', 'rond'], ['Autonomie globale', a.global, a.global !== null && a.global >= obj ? 'var(--vert)' : 'var(--rouge)', '']].map(([lib, v, c, fo]) => `<div class="tuile ${fo}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${fmtJours(v)}</b><span>${v === null ? 'foyer à décrire' : v >= obj ? 'objectif atteint' : `il manque ${O.fmtNombre(O.arrondi(obj - v, 1))} j`}${lib === 'Autonomie globale' && a.limitant ? ` · limité par ${a.limitant === 'eau' ? 'l\'eau' : 'la nourriture'}` : ''}</span></div>`).join('')}
      </div>
      <div class="colonnes-2">
        <section><h2 class="titre-section">À vérifier <span>Péremption dans les ${S.E.reglages.alerteJours} jours</span></h2>
          ${per.perimes.length || per.proches.length ? `<ul class="lignes-abos">${[...per.perimes, ...per.proches].map(({ lot, jours }) => `<li class="ligne alerte-${jours < 0 ? 'rouge' : 'jaune'}"><button class="ligne-info" data-action="lot-ouvrir" data-id="${lot.id}"><b>${esc(article(lot.articleId)?.nom || '')}</b><span class="ligne-detail">${q(lot.quantite, article(lot.articleId)?.unite || '')} · ${jours < 0 ? `périmé depuis ${S.pluriel(-jours, 'jour')}` : jours === 0 ? 'périme aujourd\'hui' : `périme dans ${S.pluriel(jours, 'jour')}`} (${dateFr(lot.peremption)})${lot.emplacement ? ` · ${esc(lot.emplacement)}` : ''}</span></button></li>`).join('')}</ul>` : '<p class="aide">Rien à renouveler prochainement.</p>'}</section>
        <section><h2 class="titre-section">Éléments manquants <span>${m.length}</span></h2>
          ${m.length ? `<ul class="liste-manques">${m.slice(0, 10).map((x) => `<li class="manque-${x.type}"><span class="etiquette ${x.type === 'achat' ? 'ciel' : x.type === 'remplacer' ? 'rouge' : 'jaune'}">${{ achat: 'À acheter', remplacer: 'À remplacer', action: 'À faire', contact: 'Contact', foyer: 'Foyer' }[x.type]}</span><span>${esc(x.texte)}${x.quantite ? ` : <b>${q(x.quantite, x.unite)}</b>` : ''}</span></li>`).join('')}</ul>${m.length > 10 ? `<button class="btn lien" data-action="vue" data-vue="reserves">Voir tout dans Réserves</button>` : ''}
            <div class="rang-boutons" style="margin-top:10px"><button class="btn petit" data-action="csv-courses">Liste de courses (CSV)</button></div>` : '<p class="aide">Rien ne manque pour l\'objectif fixé.</p>'}</section>
      </div>
      ${AVERTISSEMENT}`;
  }

  function vueReserves() {
    const t = S.auj();
    const bilan = R.bilanArticles(S.E, t);
    const groupes = B.categories.map((c) => ({ c, ls: bilan.filter((x) => x.article.categorie === c.id) })).filter((g) => g.ls.length);
    const inactifs = S.E.articles.filter((a) => !a.actif);
    return `
      <div class="vue-tete"><div><h1>Réserves</h1><p>Besoin pour ${S.pluriel(S.E.reglages.jours, 'jour')} et ${S.pluriel(S.E.membres.length, 'personne')}, comparé à ton stock non périmé. Ajoute un lot avec sa date de péremption et son emplacement.</p></div>
        <div class="actions"><button class="btn" data-action="csv-reserves">Inventaire (CSV)</button><button class="btn" data-action="article-nouveau">${S.ICONES.plus}Article</button></div></div>
      ${groupes.map(({ c, ls }) => `<section class="groupe-cat"><h2 class="titre-cat">${esc(c.nom)}</h2><ul class="lignes-abos">${ls.map((x) => {
        const lots = S.E.stock.filter((l) => l.articleId === x.article.id).sort((a, b) => (a.peremption || '9999').localeCompare(b.peremption || '9999'));
        const nonConcerne = x.besoin === 0;
        return `<li class="ligne ligne-article ${nonConcerne ? 'non-concerne' : ''}">
          <div class="ligne-info"><button class="lien-ligne" data-action="article-ouvrir" data-id="${x.article.id}"><b>${esc(x.article.nom)}</b><span>${nonConcerne ? 'Non concerné par la composition du foyer' : `Besoin ${q(x.besoin, x.article.unite)} · stock ${q(x.stock, x.article.unite)}${x.manquant ? ` · <b class="texte-rouge">manque ${q(x.manquant, x.article.unite)}</b>` : ' · couvert'}`}</span></button>
            ${nonConcerne ? '' : `<div class="jauge-ligne compacte">${jauge((x.couverture ?? 0) * 100, coulCouv(x.couverture ?? 0))}<b>${Math.round((x.couverture ?? 0) * 100)} %</b></div>`}
            ${lots.length ? `<ul class="lots">${lots.map((l) => `<li><button data-action="lot-ouvrir" data-id="${l.id}" class="${R.estPerime(l, t) ? 'perime' : ''}">${q(l.quantite, x.article.unite)}${l.peremption ? ` · ${R.estPerime(l, t) ? 'périmé le' : 'jusqu\'au'} ${dateFr(l.peremption)}` : ''}${l.emplacement ? ` · ${esc(l.emplacement)}` : ''}</button></li>`).join('')}</ul>` : ''}</div>
          <div class="ligne-droite"><button class="btn petit" data-action="lot-nouveau" data-id="${x.article.id}">${S.ICONES.plus}Lot</button></div></li>`;
      }).join('')}</ul></section>`).join('')}
      ${inactifs.length ? `<details class="tableau-details"><summary>${S.pluriel(inactifs.length, 'article désactivé', 'articles désactivés')}</summary><ul class="liste-simple">${inactifs.map((a) => `<li><button class="lien-ligne" data-action="article-ouvrir" data-id="${a.id}"><b>${esc(a.nom)}</b><span>Désactivé : hors besoins et hors calculs</span></button></li>`).join('')}</ul></details>` : ''}
      ${AVERTISSEMENT}`;
  }

  function vueSituations() {
    const s = B.situations.find((x) => x.id === ui.situation);
    const a = R.actions(S.E, s.id);
    const plan = S.E.plans[s.id] || { rassemblement: '', consignes: '' };
    const besoins = R.actionsBesoins(S.E);
    const item = (x, cochable) => `<li class="${cochable && S.E.faits[x.id] ? 'fait' : ''}">${cochable ? `<input type="checkbox" id="f-${x.id}" data-action="fait" data-id="${x.id}" ${S.E.faits[x.id] ? 'checked' : ''}>` : '<span class="puce-moment" aria-hidden="true"></span>'}<label class="libelle" ${cochable ? `for="f-${x.id}"` : ''}><span>${esc(x.texte)}</span>${cochable && S.E.faits[x.id] ? `<small>Fait le ${dateFr(S.E.faits[x.id])}</small>` : ''}${x.membres ? `<small>Pour ${esc(x.membres.join(', '))}</small>` : ''}</label>${x.perso ? `<button class="btn petit" data-action="perso-retirer" data-id="${x.id}" aria-label="Retirer l'action">Retirer</button>` : '<span></span>'}</li>`;
    return `
      <div class="vue-tete"><div><h1>Situations</h1><p>Pour chaque situation : ce qu'on prépare avant (à cocher), ce qu'on fait pendant et après. Ajoute tes propres actions et le point de rassemblement de ton foyer.</p></div></div>
      <div class="onglets-internes" role="group" aria-label="Situation">${B.situations.map((x) => { const av = R.actions(S.E, x.id).avant; const n = av.filter((y) => S.E.faits[y.id]).length; return `<button data-action="situation" data-id="${x.id}" aria-pressed="${x.id === s.id}">${esc(x.nom)} <small>${n}/${av.length}</small></button>`; }).join('')}</div>
      ${besoins.length ? `<section class="besoins-foyer"><h2 class="titre-section">Besoins spécifiques du foyer <span>Valables pour toutes les situations</span></h2><ul class="liste-cases">${besoins.map((x) => item(x, true)).join('')}</ul></section>` : ''}
      ${MOMENTS.map(([m, lib]) => `<h2 class="titre-section">${lib}</h2><ul class="liste-cases">${a[m].map((x) => item(x, m === 'avant')).join('')}</ul>
        <form class="ajout-perso" data-moment="${m}"><label class="champ"><span class="sr-only">Nouvelle action (${lib})</span><input name="texte" maxlength="200" placeholder="Ajouter une action pour ton foyer"></label><button class="btn petit" type="submit">${S.ICONES.plus}Ajouter</button></form>`).join('')}
      <h2 class="titre-section">Plan du foyer pour cette situation</h2>
      <div class="carte-el plan-situation">
        <label class="champ">Point de rassemblement ou de rendez-vous<input id="rassemblement" maxlength="200" value="${esc(plan.rassemblement)}"></label>
        <label class="champ">Qui fait quoi <small>Imprimé sur le plan familial.</small><textarea id="consignes" rows="3" maxlength="1000">${esc(plan.consignes)}</textarea></label>
      </div>
      ${AVERTISSEMENT}`;
  }

  function vueFoyer() {
    return `
      <div class="vue-tete"><div><h1>Foyer</h1><p>Membres, besoins spécifiques, animaux et contacts. Les quantités de réserves suivent la composition du foyer.</p></div>
        <div class="actions"><button class="btn" data-action="objectif">Objectif : ${S.pluriel(S.E.reglages.jours, 'jour')}</button></div></div>
      <h2 class="titre-section">Membres <span>${S.E.membres.length}</span></h2>
      <div class="grille-cartes">${S.E.membres.map((m) => `<button class="carte-el" data-action="membre-ouvrir" data-id="${m.id}"><b>${esc(m.prenom)}</b><span class="detail">${esc(nomProfil(m.profil))}${m.note ? ` · ${esc(m.note)}` : ''}</span>${m.besoins.length ? `<span class="etiquettes">${m.besoins.map((b) => `<span class="etiquette jaune">${esc(nomBesoin(b))}</span>`).join('')}</span>` : ''}</button>`).join('')}
        <button class="carte-el carte-ajout" data-action="membre-nouveau">${S.ICONES.plus}<b>Ajouter un membre</b></button></div>
      <h2 class="titre-section">Animaux</h2>
      <div class="grille-cartes">${S.E.animaux.map((a) => `<button class="carte-el" data-action="animal-ouvrir" data-id="${a.id}"><b>${esc(a.nom || B.especes.find((x) => x.id === a.espece).nom)}</b><span class="detail">${a.nombre > 1 ? `${a.nombre} × ` : ''}${esc(B.especes.find((x) => x.id === a.espece).nom.toLowerCase())}</span></button>`).join('')}
        <button class="carte-el carte-ajout" data-action="animal-nouveau">${S.ICONES.plus}<b>Ajouter un animal</b></button></div>
      <h2 class="titre-section">Contacts importants</h2>
      <div class="colonnes-2">
        <section><h3 class="sous-titre">Numéros d'urgence (France)</h3><ul class="urgences">${B.urgences.map(([n, l]) => `<li><b>${n}</b><span>${esc(l)}</span></li>`).join('')}</ul></section>
        <section><h3 class="sous-titre">Contacts du foyer</h3>${S.E.contacts.length ? `<ul class="lignes-abos">${S.E.contacts.map((c) => `<li class="ligne"><button class="ligne-info" data-action="contact-ouvrir" data-id="${c.id}"><b>${esc(c.nom)}</b><span class="ligne-detail">${esc([c.role, c.telephone].filter(Boolean).join(' · '))}</span></button></li>`).join('')}</ul>` : '<p class="aide">Ajoute un proche, un voisin et un contact hors de ta région.</p>'}
          <div class="rang-boutons" style="margin-top:10px"><button class="btn petit" data-action="contact-nouveau">${S.ICONES.plus}Contact</button></div></section>
      </div>
      ${AVERTISSEMENT}`;
  }

  function vuePlan() {
    const t = S.auj();
    const a = R.autonomie(S.E, t);
    const m = R.manques(S.E, t).filter((x) => x.type === 'achat');
    const besoins = R.actionsBesoins(S.E);
    return `
      <div class="vue-tete pas-imprimer"><div><h1>Plan familial</h1><p>Synthèse à imprimer et à ranger avec le sac d'évacuation. Relis-la avec tout le foyer.</p></div>
        <div class="actions"><button class="btn primaire" data-action="imprimer">Imprimer</button></div></div>
      <article class="document plan">
        <div class="entete-doc"><div><p class="surtitre">Plan familial d'urgence</p><h2>${esc(S.E.reglages.nomFoyer || 'Notre foyer')}</h2><p class="mini">Mis à jour le ${dateFr(t)}</p></div>
          <dl><dt>Personnes</dt><dd>${S.E.membres.length}</dd><dt>Autonomie</dt><dd>${fmtJours(a.global)} (objectif ${S.E.reglages.jours} j)</dd><dt>Eau</dt><dd>${fmtJours(a.eau)}</dd><dt>Nourriture</dt><dd>${fmtJours(a.nourriture)}</dd></dl></div>
        <p class="encart-urgence"><b>Danger immédiat : 112.</b> SAMU 15 · Police 17 · Pompiers 18 · SMS 114. Suivre en priorité les consignes des autorités (radio, mairie, préfecture).</p>
        <h3>Le foyer</h3>
        <ul class="puces">${S.E.membres.map((x) => `<li><b>${esc(x.prenom)}</b> (${esc(nomProfil(x.profil).toLowerCase())})${x.besoins.length ? ` : ${esc(x.besoins.map(nomBesoin).join(', ').toLowerCase())}` : ''}${x.note ? `. ${esc(x.note)}` : ''}</li>`).join('')}${S.E.animaux.map((x) => `<li>${esc(x.nom || 'Animal')} (${esc(B.especes.find((y) => y.id === x.espece).nom.toLowerCase())}${x.nombre > 1 ? ` × ${x.nombre}` : ''})</li>`).join('')}</ul>
        ${besoins.length ? `<h3>Besoins spécifiques</h3><ul class="puces">${besoins.map((b) => `<li>${esc(b.texte)} <i>(${esc(b.membres.join(', '))})</i></li>`).join('')}</ul>` : ''}
        <h3>Contacts</h3>
        ${S.E.contacts.length ? `<ul class="puces">${S.E.contacts.map((c) => `<li><b>${esc(c.nom)}</b>${c.role ? `, ${esc(c.role)}` : ''}${c.telephone ? ` : ${esc(c.telephone)}` : ''}</li>`).join('')}</ul>` : '<p class="mini">Aucun contact personnel renseigné.</p>'}
        <h3>Par situation</h3>
        ${B.situations.map((s) => { const p = S.E.plans[s.id]; const ac = R.actions(S.E, s.id); return `<div class="plan-bloc"><h4>${esc(s.nom)}</h4>${p?.rassemblement ? `<p><b>Rendez-vous :</b> ${esc(p.rassemblement)}</p>` : ''}${p?.consignes ? `<p><b>Qui fait quoi :</b> ${esc(p.consignes)}</p>` : ''}<p class="mini"><b>Pendant :</b> ${ac.pendant.map((x) => esc(x.texte)).join(' · ')}</p></div>`; }).join('')}
        <h3>Réserves</h3>
        <p>${S.pluriel(S.E.stock.length, 'lot enregistré', 'lots enregistrés')}${m.length ? `, ${S.pluriel(m.length, 'article à compléter', 'articles à compléter')} : ${m.map((x) => `${esc(x.texte.split(' (')[0].toLowerCase())} (${q(x.quantite, x.unite)})`).join(', ')}` : ', objectif couvert'}.</p>
        <p class="mention" style="margin-top:16px">${esc(B.avertissement)}</p>
      </article>`;
  }

  // ---------- Modales ----------
  function modaleLot(id, articleId) {
    const l = id ? S.E.stock.find((x) => x.id === id) : null;
    const a = article(l?.articleId || articleId);
    S.ouvrirModale(l ? 'Lot de réserve' : `Ajouter : ${esc(a.nom)}`, `
      <p class="mini">${esc(a.aide || '')}</p>
      <div class="rang-champs"><label class="champ">Quantité (${esc(a.unite)})<input name="quantite" inputmode="decimal" value="${O.saisieNombre(l?.quantite ?? null)}"></label>
        <label class="champ">Péremption <small>${a.peremption ? 'Date indiquée sur l\'emballage.' : 'Facultative.'}</small><input type="date" name="peremption" value="${l?.peremption || ''}"></label></div>
      <label class="champ">Emplacement<input name="emplacement" maxlength="80" value="${esc(l?.emplacement || '')}" placeholder="Ex. : cellier, sac d'évacuation"></label>
      <p class="erreur" role="alert"></p>`,
    l ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer (consommé)</button>' : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>', (f, action) => {
      if (action === 'supprimer') { S.retenir(); S.E.stock = S.E.stock.filter((x) => x.id !== l.id); S.sauver(); S.rendre(); S.toast('Lot retiré.', { libelle: 'Annuler', faire: S.annuler }); return undefined; }
      const qte = O.lireNombre(f.get('quantite'));
      if (!(qte > 0)) return 'Quantité : nombre strictement positif.';
      const per = f.get('peremption') || null;
      if (per && !O.estDate(per)) return 'Date de péremption invalide.';
      if (a.peremption && !per && !S.confirmer('Aucune date de péremption pour un produit qui en a d\'ordinaire. Enregistrer quand même ?')) return 'Ajoute la date de péremption.';
      S.retenir();
      const champs = { quantite: qte, peremption: per, emplacement: O.texte(f.get('emplacement'), 80) };
      if (l) Object.assign(l, champs); else S.E.stock.push({ id: uid(), articleId: a.id, ...champs });
      S.sauver(); S.rendre(); S.toast(per && per < S.auj() ? 'Enregistré : ce lot est déjà périmé et ne compte pas dans l\'autonomie.' : 'Lot enregistré.', { libelle: 'Annuler', faire: S.annuler });
      return undefined;
    });
  }

  function modaleArticle(id) {
    const a = id ? article(id) : null;
    const v = a || { nom: '', categorie: 'equipement', unite: 'u', regle: 'foyer', q: 1, peremption: false, actif: true };
    const regles = [['personneJour', 'Par personne et par jour'], ['personne', 'Par personne'], ['foyer', 'Pour le foyer'], ['bebeJour', 'Par bébé et par jour'], ['animalJour', 'Par animal et par jour'], ['besoinJour', 'Par personne concernée et par jour']];
    const base = id ? B.articles.find((x) => x.id === id) : null;
    S.ouvrirModale(a ? 'Article du référentiel' : 'Nouvel article', `
      <label class="champ">Nom<input name="nom" maxlength="120" value="${esc(v.nom)}" ${a && !a.perso ? 'readonly' : ''}></label>
      <div class="rang-champs"><label class="champ">Catégorie<select name="categorie">${B.categories.map((c) => `<option value="${c.id}" ${c.id === v.categorie ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}</select></label><label class="champ">Unité<input name="unite" maxlength="20" value="${esc(v.unite)}"></label></div>
      <div class="rang-champs"><label class="champ">Quantité<input name="q" inputmode="decimal" value="${O.saisieNombre(v.q)}"></label><label class="champ">Règle<select name="regle" ${a && !a.perso ? 'disabled' : ''}>${regles.filter(([r]) => r !== 'besoinJour' || v.regle === 'besoinJour').map(([r, l]) => `<option value="${r}" ${r === v.regle ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
      ${base ? `<p class="aide">Valeur du référentiel QME : ${O.fmtNombre(base.q)} ${esc(base.unite)} (${esc(regles.find(([r]) => r === base.regle)[1].toLowerCase())}). Valeur prudente par défaut, non officielle.</p>` : ''}
      <label class="case"><input type="checkbox" name="peremption" ${v.peremption ? 'checked' : ''}> Produit qui se périme</label>
      <label class="case"><input type="checkbox" name="actif" ${v.actif ? 'checked' : ''}> Article utilisé par mon foyer</label>
      <p class="erreur" role="alert"></p>`,
    `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${a?.perso ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`, (f, action) => {
      if (action === 'supprimer') { S.retenir(); S.E.articles = S.E.articles.filter((x) => x.id !== a.id); S.E.stock = S.E.stock.filter((l) => l.articleId !== a.id); S.sauver(); S.rendre(); return undefined; }
      const nom = O.texte(f.get('nom'), 120);
      if (!nom) return 'Donne un nom.';
      const qte = O.lireNombre(f.get('q'));
      if (qte === null || qte > 1000) return 'Quantité : nombre entre 0 et 1 000.';
      S.retenir();
      const champs = { nom, categorie: f.get('categorie'), unite: O.texte(f.get('unite'), 20) || 'u', q: qte, peremption: !!f.get('peremption'), actif: !!f.get('actif') };
      if (a) Object.assign(a, champs, a.perso ? { regle: f.get('regle') } : {}); else S.E.articles.push(R.normaliserArticle({ id: uid(), ...champs, regle: f.get('regle'), perso: true }));
      S.sauver(); S.rendre(); S.toast('Article enregistré.', { libelle: 'Annuler', faire: S.annuler });
      return undefined;
    });
  }

  function modaleMembre(id) {
    const m = id ? S.E.membres.find((x) => x.id === id) : null;
    const v = m || { prenom: '', profil: 'adulte', besoins: [], note: '' };
    S.ouvrirModale(m ? 'Membre du foyer' : 'Nouveau membre', `
      <div class="rang-champs"><label class="champ">Prénom<input name="prenom" maxlength="40" value="${esc(v.prenom)}"></label><label class="champ">Profil<select name="profil">${B.profils.map((p) => `<option value="${p.id}" ${p.id === v.profil ? 'selected' : ''}>${esc(p.nom)}</option>`).join('')}</select></label></div>
      <fieldset class="champ"><legend>Besoins spécifiques</legend>${B.besoins.map((b) => `<label class="case"><input type="checkbox" name="b-${b.id}" ${v.besoins.includes(b.id) ? 'checked' : ''}> ${esc(b.nom)}</label>`).join('')}</fieldset>
      <label class="champ">Note utile <small>Ce qui aide le jour venu, sans données médicales détaillées.</small><input name="note" maxlength="300" value="${esc(v.note)}"></label>
      <p class="erreur" role="alert"></p>`,
    m ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Retirer</button>' : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>', (f, action) => {
      if (action === 'supprimer') { S.retenir(); S.E.membres = S.E.membres.filter((x) => x.id !== m.id); S.sauver(); S.rendre(); S.toast(`${m.prenom} retiré du foyer.`, { libelle: 'Annuler', faire: S.annuler }); return undefined; }
      const prenom = O.texte(f.get('prenom'), 40);
      if (!prenom) return 'Indique un prénom (ou un surnom).';
      if (!m && S.E.membres.length >= 30) return '30 membres au maximum.';
      S.retenir();
      const champs = { prenom, profil: f.get('profil'), besoins: B.besoins.filter((b) => f.get(`b-${b.id}`)).map((b) => b.id), note: O.texte(f.get('note'), 300) };
      if (m) Object.assign(m, champs); else S.E.membres.push({ id: uid(), ...champs });
      S.sauver(); S.rendre(); S.toast('Foyer mis à jour : les besoins sont recalculés.', { libelle: 'Annuler', faire: S.annuler });
      return undefined;
    });
  }

  function modaleAnimal(id) {
    const a = id ? S.E.animaux.find((x) => x.id === id) : null;
    S.ouvrirModale(a ? 'Animal' : 'Nouvel animal', `
      <div class="rang-champs"><label class="champ">Nom<input name="nom" maxlength="40" value="${esc(a?.nom || '')}"></label><label class="champ">Espèce<select name="espece">${B.especes.map((x) => `<option value="${x.id}" ${x.id === a?.espece ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label><label class="champ">Nombre<input type="number" name="nombre" min="1" max="50" value="${a?.nombre || 1}"></label></div><p class="erreur" role="alert"></p>`,
    a ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Retirer</button>' : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>', (f, action) => {
      if (action === 'supprimer') { S.retenir(); S.E.animaux = S.E.animaux.filter((x) => x.id !== a.id); S.sauver(); S.rendre(); return undefined; }
      const n = O.entier(f.get('nombre'), 1, 50, 0);
      if (!n) return 'Nombre entre 1 et 50.';
      S.retenir();
      const champs = { nom: O.texte(f.get('nom'), 40), espece: f.get('espece'), nombre: n };
      if (a) Object.assign(a, champs); else S.E.animaux.push({ id: uid(), ...champs });
      S.sauver(); S.rendre();
      return undefined;
    });
  }

  function modaleContact(id) {
    const c = id ? S.E.contacts.find((x) => x.id === id) : null;
    S.ouvrirModale(c ? 'Contact' : 'Nouveau contact', `
      <label class="champ">Nom<input name="nom" maxlength="80" value="${esc(c?.nom || '')}"></label>
      <label class="champ">Rôle <small>Voisin, médecin traitant, contact hors de la zone…</small><input name="role" maxlength="80" value="${esc(c?.role || '')}"></label>
      <label class="champ">Téléphone<input name="telephone" maxlength="40" inputmode="tel" value="${esc(c?.telephone || '')}"></label>
      <label class="champ">Note<input name="note" maxlength="200" value="${esc(c?.note || '')}"></label><p class="erreur" role="alert"></p>`,
    c ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>' : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>', (f, action) => {
      if (action === 'supprimer') { S.retenir(); S.E.contacts = S.E.contacts.filter((x) => x.id !== c.id); S.sauver(); S.rendre(); return undefined; }
      const nom = O.texte(f.get('nom'), 80);
      if (!nom) return 'Indique un nom.';
      S.retenir();
      const champs = { nom, role: O.texte(f.get('role'), 80), telephone: O.texte(f.get('telephone'), 40), note: O.texte(f.get('note'), 200) };
      if (c) Object.assign(c, champs); else S.E.contacts.push({ id: uid(), ...champs });
      S.sauver(); S.rendre();
      return undefined;
    });
  }

  const champsObjectif = () => `<div class="rang-champs"><label class="champ">Objectif d'autonomie (jours)<input type="number" name="jours" min="1" max="30" value="${S.E.reglages.jours}"></label><label class="champ">Alerte de péremption (jours avant)<input type="number" name="alerteJours" min="7" max="365" value="${S.E.reglages.alerteJours}"></label></div><label class="champ">Nom du foyer<input name="nomFoyer" maxlength="80" value="${esc(S.E.reglages.nomFoyer)}"></label>`;
  function lireObjectif(f) {
    const jours = O.entier(f.get('jours'), 1, 30, 0), alerte = O.entier(f.get('alerteJours'), 7, 365, 0);
    if (!jours) return 'Objectif : de 1 à 30 jours.';
    if (!alerte) return 'Alerte : de 7 à 365 jours.';
    S.E.reglages = { nomFoyer: O.texte(f.get('nomFoyer'), 80), jours, alerteJours: alerte };
    return undefined;
  }

  // ---------- Actions ----------
  const actions = {
    'lot-nouveau': (el) => modaleLot(null, el.dataset.id),
    'lot-ouvrir': (el) => modaleLot(el.dataset.id),
    'article-ouvrir': (el) => modaleArticle(el.dataset.id),
    'article-nouveau': () => modaleArticle(null),
    situation: (el) => { ui.situation = el.dataset.id; S.rendre(); },
    fait: (el) => { S.retenir(); if (el.checked) S.E.faits[el.dataset.id] = S.auj(); else delete S.E.faits[el.dataset.id]; S.sauver(); S.rendre(); },
    'perso-retirer': (el) => { S.retenir(); S.E.persos = S.E.persos.filter((p) => p.id !== el.dataset.id); delete S.E.faits[el.dataset.id]; S.sauver(); S.rendre(); S.toast('Action retirée.', { libelle: 'Annuler', faire: S.annuler }); },
    'membre-ouvrir': (el) => modaleMembre(el.dataset.id),
    'membre-nouveau': () => modaleMembre(null),
    'animal-ouvrir': (el) => modaleAnimal(el.dataset.id),
    'animal-nouveau': () => modaleAnimal(null),
    'contact-ouvrir': (el) => modaleContact(el.dataset.id),
    'contact-nouveau': () => modaleContact(null),
    objectif: () => S.ouvrirModale('Objectif et alertes', `${champsObjectif()}<p class="aide">Trois jours d'autonomie est un premier objectif courant ; adapte-le à ta situation et aux recommandations officielles.</p><p class="erreur" role="alert"></p>`, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => { S.retenir(); const e = lireObjectif(f); if (e) return e; S.sauver(); S.rendre(); return undefined; }),
    imprimer: () => S.imprimer(() => { if (S.vue !== 'plan') S.changerVue('plan'); }),
    'csv-reserves': () => S.exporterCsv(R.csvReserves(S.E, S.auj()), 'planb-reserves'),
    'csv-courses': () => S.exporterCsv(R.csvCourses(S.E, S.auj()), 'planb-courses'),
  };

  S = window.QME_SOCLE.creer({
    produit: 'PNB', prefixe: 'pnb', nom: 'PlanB', fichier: 'plan-b', titreBarre: 'PlanB<br>Foyer préparé',
    connexion: { titre: 'Coupure, intempérie, évacuation : es-tu prêt ?', texte: 'Réserves calculées pour ton foyer, autonomie en jours, péremptions suivies, actions à préparer par situation et plan familial à imprimer.', ouvrir: 'Ouvre PlanB', bouton: 'Ouvrir PlanB' },
    onglets: [
      { id: 'tableau', nom: 'Préparation', icone: 'rond' },
      { id: 'reserves', nom: 'Réserves', icone: 'grille' },
      { id: 'situations', nom: 'Situations', icone: 'triangle' },
      { id: 'foyer', nom: 'Foyer', icone: 'quart' },
      { id: 'plan', nom: 'Plan', icone: 'carre' },
    ],
    etatVide: R.etatVide, normaliser: R.normaliser, donneesDemo, accueil, apresAccueil,
    vues: { tableau: vueTableau, reserves: vueReserves, situations: vueSituations, foyer: vueFoyer, plan: vuePlan },
    apresRendu() {
      document.querySelectorAll('.ajout-perso').forEach((f) => f.addEventListener('submit', (e) => {
        e.preventDefault();
        const texte = O.texte(new FormData(f).get('texte'), 200);
        if (!texte) return;
        S.retenir();
        S.E.persos.push({ id: uid(), situationId: ui.situation, moment: f.dataset.moment, texte });
        S.sauver(); S.rendre();
      }));
      const maj = (champ) => (e) => { const p = S.E.plans[ui.situation] || (S.E.plans[ui.situation] = { rassemblement: '', consignes: '' }); p[champ] = O.texte(e.target.value, champ === 'consignes' ? 1000 : 200); S.sauver(); };
      S.$('#rassemblement')?.addEventListener('change', maj('rassemblement'));
      S.$('#consignes')?.addEventListener('change', maj('consignes'));
    },
    actions,
    reglages: {
      corps: champsObjectif,
      valider: lireObjectif,
      exports: [['csv-reserves', 'Inventaire des réserves (CSV)'], ['csv-courses', 'Liste de courses (CSV)'], ['imprimer', 'Imprimer le plan familial']],
      aPropos: () => `<p class="mention">Référentiel : ${B.articles.length} articles, ${B.situations.length} situations, date de référence ${O.versDate(B.dateReference).toLocaleDateString('fr-FR')}. ${esc(B.avertissement)} ${esc(B.sourcesExternes)}</p>`,
    },
    importValide: (d) => d && typeof d === 'object' && Array.isArray(d.membres) && Array.isArray(d.stock),
    resumeImport: (d) => `${S.pluriel(d.membres.length, 'membre')}, ${S.pluriel(d.stock.length, 'lot')}`,
  });
  S.lancer();
})();
