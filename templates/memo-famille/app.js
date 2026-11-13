// MémoFamille · interface. Socle commun : templates/commun/socle.js. Règles : regles.js (window.MMF).
// Aide-mémoire du foyer : jamais de mot de passe, de code ni de numéro bancaire (saisie refusée).
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.MMF;
  const O = window.QME_OUTILS;
  const { esc } = window.QME_SOCLE;
  let S = null;
  const uid = () => O.nouvelId();
  const dateFr = (s) => (s ? O.versDate(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
  const ui = { cat: 'tout', q: '', choix: null };
  const fiche = (id) => S.E.fiches.find((f) => f.id === id);
  const valeurAffichee = (c, v) => (c.type === 'date' ? dateFr(v) : esc(v));

  // ---------- Données de démonstration (foyer fictif) ----------
  function donneesDemo() {
    const t = O.iso(new Date());
    const F = (categorie, titre, valeurs, extra = {}) => ({ id: uid(), categorie, titre, valeurs, note: '', prive: false, majLe: O.ajout(t, -30), ...extra });
    const e = R.normaliser({ reglages: { nomFoyer: 'Famille d\'exemple', revueJours: 365 }, fiches: [
      F('membres', 'Camille Exemple', { naissance: '1984-03-12', role: 'Parent', medecin: 'Cabinet médical du quartier', urgence: 'Allergie à la pénicilline.', 'carte-vitale': 'Portefeuille, poche intérieure' }),
      F('membres', 'Sacha Exemple', { naissance: '1982-09-30', role: 'Parent', medecin: 'Cabinet médical du quartier', 'carte-vitale': 'Tiroir du bureau' }),
      F('membres', 'Lou Exemple', { naissance: '2015-06-21', role: 'Enfant' }),
      F('contacts', 'Voisine du 2e', { relation: 'Voisine, a un double des clés', telephone: '06 00 00 00 01' }, { note: 'Numéro fictif.' }),
      F('contacts', 'Grand-mère', { relation: 'Mère de Camille, peut garder Lou', telephone: '06 00 00 00 02', adresse: 'Ville voisine (exemple)' }),
      F('contacts', 'Notaire de la famille', { relation: 'Notaire', telephone: '01 00 00 00 03' }, { prive: true }),
      F('contrats', 'Assurance habitation', { type: 'Assurance habitation', organisme: 'Assureur fictif', numero: 'HAB-2024-55871', titulaire: 'Camille', echeance: O.ajout(t, 95), joindre: 'Agence ou application mobile', ou: 'Classeur bleu, onglet Assurances' }),
      F('contrats', 'Électricité', { type: 'Électricité', organisme: 'Fournisseur fictif', numero: 'Client 00458712', ou: 'Espace client en ligne (identifiants dans le gestionnaire de Sacha)' }),
      F('contrats', 'Complémentaire santé', { type: 'Complémentaire santé', organisme: 'Mutuelle fictive', numero: 'Adhérent 778 541', ou: 'Classeur bleu' }, { majLe: O.ajout(t, -420) }),
      F('logement', 'Appartement', { adresse: 'Adresse fictive', statut: 'Locataire', gestion: 'Agence de gestion fictive', electricite: 'Placard de l\'entrée, à gauche', eau: 'Sous l\'évier de la cuisine', chauffage: 'Chaudière gaz dans la salle de bains, entretien chaque automne', cles: 'Voisine du 2e et grand-mère', alarme: 'Pas d\'alarme' }),
      F('equipements', 'Chaudière', { modele: 'Chaudière murale gaz (exemple)', achat: '2019-10-15', facture: 'Classeur vert', entretien: 'Contrat d\'entretien annuel, prochain passage en octobre' }),
      F('equipements', 'Lave-linge', { modele: 'Lave-linge 8 kg', achat: O.ajout(t, -400), garantie: O.ajout(t, 330), facture: 'Boîte des garanties' }),
      F('prestataires', 'Plombier', { metier: 'Plomberie, chauffage', telephone: '06 00 00 00 04', derniere: O.ajout(t, -120) }),
      F('vehicules', 'Voiture familiale', { modele: 'Citadine (exemple)', immatriculation: 'AA-000-AA', assurance: 'Assureur fictif', controle: O.ajout(t, 200), papiers: 'Boîte à gants', cles: 'Double dans le tiroir de l\'entrée' }),
      F('documents', 'Livret de famille', { type: 'Livret de famille', original: 'Coffre du bureau', copie: 'Copie numérisée sur le disque familial' }),
      F('documents', 'Passeport de Lou', { type: 'Passeport', concerne: 'Lou', original: 'Coffre du bureau', validite: O.ajout(t, 60) }),
      F('consignes', 'Si Camille est hospitalisée', { quand: 'Hospitalisation ou absence de plus de 3 jours', consigne: 'Prévenir la grand-mère pour Lou. Le dossier de la mutuelle est dans le classeur bleu.', contact: 'Grand-mère' }, { prive: true }),
      F('enfants', 'Lou', { ecole: 'École élémentaire du quartier', 'contact-ecole': '01 00 00 00 05', autorises: 'Parents, grand-mère, voisine du 2e', activites: 'Judo le mercredi 14 h', sante: 'Pas d\'allergie connue' }),
      F('animaux', 'Félix', { espece: 'Chat européen', veterinaire: 'Clinique vétérinaire (exemple)', alimentation: 'Croquettes, deux fois par jour', garde: 'Voisine du 2e' }),
    ] });
    e.retraits = 0;
    return e;
  }

  // ---------- Premier lancement ----------
  function accueil() {
    return `
      <p class="surtitre">Bienvenue</p>
      <h1>Ce que tes proches doivent pouvoir retrouver.</h1>
      <p class="intro">Contacts, contrats, logement, documents, consignes : MémoFamille range les informations utiles de ton foyer en ${B.categories.length} catégories, avec un dossier imprimable que tu choisis.</p>
      <form id="form-accueil" class="formulaire-accueil" novalidate>
        <label class="champ">Nom du foyer <small>Facultatif, imprimé sur le dossier.</small><input name="nomFoyer" maxlength="80"></label>
        <div class="encart-securite"><b>Règle de sécurité</b><p>${esc(B.securite)}</p>
          <label class="case"><input type="checkbox" name="compris"> J'ai compris : je ne noterai ni mot de passe, ni code, ni numéro bancaire.</label></div>
        <p class="erreur" role="alert"></p>
        <div class="accueil-pied"><span></span><button class="btn primaire" type="submit">Ouvrir mon classeur</button></div>
      </form>
      <ol class="conseils" style="margin-top:32px">${B.conseils.map(([a, b]) => `<li><b>${esc(a)}</b><span>${esc(b)}</span></li>`).join('')}</ol>`;
  }
  function apresAccueil() {
    S.$('#form-accueil').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      if (!f.get('compris')) { e.target.querySelector('.erreur').textContent = 'Coche la règle de sécurité pour continuer.'; return; }
      const etat = R.etatVide();
      etat.reglages.nomFoyer = O.texte(f.get('nomFoyer'), 80);
      S.terminerAccueil(etat, { vue: 'classeur', message: 'Commence par une catégorie : contacts, contrats ou logement.' });
    });
  }

  // ---------- Vues ----------
  const AVERTISSEMENT = `<p class="mention avertissement">${esc(B.securite)} ${esc(B.rgpd)}</p>`;
  function carteFiche(f) {
    const cat = R.categorie(f.categorie);
    const remplis = cat.champs.filter((c) => f.valeurs[c.id]).slice(0, 3);
    const revoir = R.aRevoir(f, S.auj(), S.E.reglages.revueJours);
    return `<button class="carte-el carte-fiche" data-action="fiche-ouvrir" data-id="${f.id}">
      <b>${esc(f.titre)}</b>
      ${remplis.length ? `<dl class="mini-champs">${remplis.map((c) => `<dt>${esc(c.libelle)}</dt><dd>${valeurAffichee(c, f.valeurs[c.id])}</dd>`).join('')}</dl>` : '<span class="detail">Fiche à compléter</span>'}
      <span class="etiquettes">${ui.cat === 'tout' ? `<span class="etiquette ciel">${esc(cat.nom)}</span>` : ''}${f.prive ? '<span class="etiquette encre">Privée</span>' : ''}${revoir ? '<span class="etiquette jaune">À revoir</span>' : ''}</span></button>`;
  }

  function vueClasseur() {
    const comp = R.completude(S.E);
    const liste = S.E.fiches.filter((f) => ui.cat === 'tout' || f.categorie === ui.cat).sort((a, b) => a.titre.localeCompare(b.titre, 'fr'));
    const cat = ui.cat === 'tout' ? null : R.categorie(ui.cat);
    const vides = comp.filter((c) => !c.nb);
    return `
      <div class="vue-tete"><div><h1>${esc(S.E.reglages.nomFoyer || 'Classeur')}</h1><p>${S.pluriel(S.E.fiches.length, 'fiche')} en ${S.pluriel(comp.filter((c) => c.nb).length, 'catégorie')}. Touche une fiche pour la lire ou la modifier.</p></div>
        <div class="actions"><button class="btn primaire" data-action="fiche-nouvelle">${S.ICONES.plus}Nouvelle fiche</button></div></div>
      <div class="onglets-internes" role="group" aria-label="Catégorie"><button data-action="cat" data-id="tout" aria-pressed="${ui.cat === 'tout'}">Tout <small>${S.E.fiches.length}</small></button>${comp.map((c) => `<button data-action="cat" data-id="${c.id}" aria-pressed="${ui.cat === c.id}">${esc(c.nom)} <small>${c.nb}</small></button>`).join('')}</div>
      ${cat?.aide ? `<p class="aide">${esc(cat.aide)}</p>` : ''}
      ${liste.length ? `<div class="grille-cartes">${liste.map(carteFiche).join('')}</div>` : `<div class="vide-etat">${S.FORME_VIDE}<div><h3>${cat ? `Aucune fiche « ${esc(cat.nom.toLowerCase())} »` : 'Ton classeur est vide'}</h3><p>${cat ? esc(cat.aide || 'Ajoute la première fiche de cette catégorie.') : 'Commence par les contacts importants, les contrats et le logement.'}</p><div class="actions"><button class="btn primaire" data-action="fiche-nouvelle" data-cat="${cat?.id || 'contacts'}">${S.ICONES.plus}Nouvelle fiche</button></div></div></div>`}
      ${ui.cat === 'tout' && vides.length && S.E.fiches.length ? `<h2 class="titre-section">À compléter <span>Catégories sans fiche</span></h2><div class="rang-boutons">${vides.map((c) => `<button class="btn petit" data-action="fiche-nouvelle" data-cat="${c.id}">${S.ICONES.plus}${esc(c.nom)}</button>`).join('')}</div>` : ''}
      ${AVERTISSEMENT}`;
  }

  function vueRecherche() {
    const res = R.rechercher(S.E.fiches, ui.q);
    return `
      <div class="vue-tete"><div><h1>Rechercher</h1><p>Dans les titres, tous les champs et les notes, sans tenir compte des accents ni des majuscules.</p></div></div>
      <label class="champ recherche-grande"><span class="sr-only">Rechercher</span><input id="recherche" type="search" placeholder="Plombier, assurance, école, chaudière…" value="${esc(ui.q)}" autocomplete="off"></label>
      ${!ui.q.trim() ? '<p class="aide" style="margin-top:14px">Saisis un ou plusieurs mots : toutes les fiches qui les contiennent s\'affichent.</p>'
        : res.length ? `<p class="mini" style="margin:12px 0">${S.pluriel(res.length, 'fiche trouvée', 'fiches trouvées')}</p><ul class="lignes-abos">${res.map(({ fiche: f, champs }) => `<li class="ligne"><button class="ligne-info" data-action="fiche-ouvrir" data-id="${f.id}"><b>${esc(f.titre)}</b><span class="ligne-detail">${esc(R.categorie(f.categorie).nom)}${champs.length ? ` · trouvé dans : ${esc(champs.join(', ').toLowerCase())}` : ''}</span></button></li>`).join('')}</ul>`
        : `<div class="vide-etat petit"><div><h3>Aucun résultat pour « ${esc(ui.q)} »</h3><p>Essaie un autre mot ou une partie du mot.</p></div></div>`}`;
  }

  function choixDossier() {
    if (!ui.choix) ui.choix = { categories: B.categories.map((c) => c.id), exclues: [], prives: [] };
    return ui.choix;
  }
  function vueDossier() {
    const ch = choixDossier();
    const d = R.dossier(S.E, ch);
    const nb = d.reduce((s, g) => s + g.fiches.length, 0);
    const prives = S.E.fiches.filter((f) => f.prive && ch.categories.includes(f.categorie));
    return `
      <div class="vue-tete pas-imprimer"><div><h1>Dossier</h1><p>Choisis ce que contient le dossier à imprimer ou à exporter. Les fiches privées en sont exclues, sauf si tu les coches une à une.</p></div>
        <div class="actions"><button class="btn" data-action="csv-selection">Sélection (CSV)</button><button class="btn" data-action="json-selection">Sélection (JSON)</button><button class="btn primaire" data-action="imprimer">Imprimer</button></div></div>
      <div class="pas-imprimer choix-dossier">
        <fieldset class="carte-el"><legend class="surtitre">Catégories</legend><div class="cases-colonnes">${B.categories.map((c) => { const n = S.E.fiches.filter((f) => f.categorie === c.id).length; return `<label class="case"><input type="checkbox" data-action="choix-cat" data-id="${c.id}" ${ch.categories.includes(c.id) ? 'checked' : ''} ${n ? '' : 'disabled'}> ${esc(c.nom)} <small class="mini">(${n})</small></label>`; }).join('')}</div>
          <div class="rang-boutons"><button class="btn petit" data-action="choix-tout">Tout</button><button class="btn petit" data-action="choix-rien">Rien</button></div></fieldset>
        ${prives.length ? `<fieldset class="carte-el"><legend class="surtitre">Fiches privées à inclure quand même</legend>${prives.map((f) => `<label class="case"><input type="checkbox" data-action="choix-prive" data-id="${f.id}" ${ch.prives.includes(f.id) ? 'checked' : ''}> ${esc(f.titre)} <small class="mini">(${esc(R.categorie(f.categorie).nom)})</small></label>`).join('')}</fieldset>` : ''}
      </div>
      <p class="aide pas-imprimer" style="margin:14px 0">${S.pluriel(nb, 'fiche')} dans le dossier. Décoche une fiche dans l'aperçu pour la retirer.</p>
      <article class="document dossier">
        <div class="entete-doc"><div><p class="surtitre">Dossier du foyer</p><h2>${esc(S.E.reglages.nomFoyer || 'Notre foyer')}</h2><p class="mini">Édité le ${dateFr(S.auj())} · ${S.pluriel(nb, 'fiche')}</p></div>
          <p class="mini avertissement-dossier">Document personnel et confidentiel. Ne contient ni mot de passe, ni code, ni numéro bancaire.</p></div>
        ${d.length ? d.map((g) => `<section class="dossier-cat"><h3>${esc(g.categorie.nom)}</h3>${g.fiches.map((f) => `<div class="dossier-fiche">
          <label class="case pas-imprimer exclure"><input type="checkbox" data-action="choix-fiche" data-id="${f.id}" checked> Inclure</label>
          <h4>${esc(f.titre)}${f.prive ? ' <span class="etiquette encre">Privée</span>' : ''}</h4>
          <dl>${g.categorie.champs.filter((c) => f.valeurs[c.id]).map((c) => `<dt>${esc(c.libelle)}</dt><dd>${valeurAffichee(c, f.valeurs[c.id]).replace(/\n/g, '<br>')}</dd>`).join('')}${f.note ? `<dt>Note</dt><dd>${esc(f.note).replace(/\n/g, '<br>')}</dd>` : ''}</dl>
          ${f.majLe ? `<p class="mini">Mise à jour le ${dateFr(f.majLe)}</p>` : ''}</div>`).join('')}</section>`).join('') : '<p class="aide">Aucune fiche sélectionnée.</p>'}
        ${ch.exclues.length ? `<p class="pas-imprimer mini">${S.pluriel(ch.exclues.length, 'fiche retirée')}. <button class="btn lien" data-action="choix-reinclure">Tout réinclure</button></p>` : ''}
      </article>`;
  }

  function vueSecurite() {
    const t = S.auj();
    const alertes = S.E.fiches.map((f) => ({ f, d: R.verifierFiche(f) })).filter((x) => x.d.length);
    const revoir = S.E.fiches.filter((f) => R.aRevoir(f, t, S.E.reglages.revueJours));
    const prives = S.E.fiches.filter((f) => f.prive);
    return `
      <div class="vue-tete"><div><h1>Sécurité</h1><p>Ce que MémoFamille garde, ce qu'il refuse, et les fiches à revoir.</p></div></div>
      <div class="tuiles tuiles-3">
        <div class="tuile" style="--c:var(--vert)"><p class="surtitre">Informations sensibles</p><b>${alertes.length}</b><span>${alertes.length ? 'fiche(s) à corriger' : 'aucune détectée'}</span></div>
        <div class="tuile rond" style="--c:var(--jaune)"><p class="surtitre">À revoir</p><b>${revoir.length}</b><span>non revues depuis ${S.pluriel(S.E.reglages.revueJours, 'jour')}</span></div>
        <div class="tuile" style="--c:var(--encre)"><p class="surtitre">Privées</p><b>${prives.length}</b><span>hors dossier par défaut</span></div>
      </div>
      ${S.E.retraits ? `<div class="aide" style="margin-top:16px">Lors de la dernière restauration, ${S.pluriel(S.E.retraits, 'information sensible a été retirée', 'informations sensibles ont été retirées')} et remplacée(s) par « ${esc(R.RETIRE)} ». <button class="btn lien" data-action="retraits-vu">Compris</button></div>` : ''}
      ${alertes.length ? `<h2 class="titre-section">À corriger</h2><ul class="lignes-abos">${alertes.map(({ f, d }) => `<li class="ligne alerte-rouge"><button class="ligne-info" data-action="fiche-ouvrir" data-id="${f.id}"><b>${esc(f.titre)}</b><span class="ligne-detail">${esc(d.map((x) => `${x.champ} : ${x.message}`).join(' · '))}</span></button></li>`).join('')}</ul>` : ''}
      <h2 class="titre-section">Fiches à revoir <span>Revue conseillée tous les ${S.pluriel(S.E.reglages.revueJours, 'jour')}</span></h2>
      ${revoir.length ? `<ul class="lignes-abos">${revoir.map((f) => `<li class="ligne alerte-jaune"><button class="ligne-info" data-action="fiche-ouvrir" data-id="${f.id}"><b>${esc(f.titre)}</b><span class="ligne-detail">${esc(R.categorie(f.categorie).nom)} · ${f.majLe ? `mise à jour le ${dateFr(f.majLe)}` : 'jamais revue'}</span></button><div class="ligne-droite"><button class="btn petit" data-action="fiche-revue" data-id="${f.id}">C'est à jour</button></div></li>`).join('')}</ul>` : '<p class="aide">Toutes les fiches ont été revues récemment.</p>'}
      <h2 class="titre-section">Les règles</h2>
      <ol class="conseils">
        <li><b>Refusé à la saisie</b><span>Mot de passe, code (PIN, alarme, digicode, accès), cryptogramme, numéro de carte bancaire, IBAN, numéro de sécurité sociale. Note où les trouver, jamais leur valeur.</span></li>
        <li><b>Nettoyé à la restauration</b><span>Une sauvegarde importée ou reçue d'un autre appareil est vérifiée : toute information de ce type est retirée avant d'être gardée.</span></li>
        <li><b>Hébergement</b><span>Fiches enregistrées en ligne chez QME (Europe, Francfort), protégées par ta clé de licence, sans chiffrement de bout en bout. Une copie reste dans ce navigateur pour le hors ligne.</span></li>
        <li><b>Partage choisi</b><span>Le dossier imprimé et les exports ne contiennent que ce que tu coches ; les fiches privées en sont exclues par défaut.</span></li>
        <li><b>Pas un coffre-fort</b><span>MémoFamille n'est pas un coffre-fort numérique certifié. Pour les mots de passe, utilise un gestionnaire de mots de passe.</span></li>
      </ol>
      ${AVERTISSEMENT}`;
  }

  // ---------- Modale : fiche ----------
  function champSaisie(c, v) {
    const val = v ?? '';
    const ph = c.exemple ? ` placeholder="${esc(c.exemple)}"` : '';
    const aide = c.aide ? `<small>${esc(c.aide)}</small>` : '';
    if (c.type === 'long') return `<label class="champ">${esc(c.libelle)}${aide}<textarea name="v-${c.id}" rows="3" maxlength="1500"${ph}>${esc(val)}</textarea></label>`;
    if (c.type === 'choix') return `<label class="champ">${esc(c.libelle)}<select name="v-${c.id}"><option value="">—</option>${c.options.map((o) => `<option ${o === val ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
    const type = { date: 'date', tel: 'tel', email: 'email' }[c.type] || 'text';
    return `<label class="champ">${esc(c.libelle)}${aide}<input type="${type}" name="v-${c.id}" maxlength="200" value="${esc(val)}"${ph}${c.type === 'tel' ? ' inputmode="tel"' : ''}></label>`;
  }
  function modaleFiche(id, catId) {
    const f = id ? fiche(id) : null;
    const cat = R.categorie(f?.categorie || catId || (ui.cat !== 'tout' ? ui.cat : 'contacts'));
    const lire = (form) => {
      const fd = new FormData(form);
      const valeurs = {};
      for (const c of cat.champs) { const v = String(fd.get(`v-${c.id}`) || '').trim(); if (v) valeurs[c.id] = v; }
      return { id: f?.id || uid(), categorie: cat.id, titre: O.texte(fd.get('titre'), 120), valeurs, note: String(fd.get('note') || '').trim().slice(0, 2000), prive: !!fd.get('prive'), majLe: S.auj() };
    };
    const d = S.ouvrirModale(f ? esc(f.titre) : `Nouvelle fiche : ${esc(cat.nom.toLowerCase())}`, `
      ${f ? '' : `<label class="champ">Catégorie<select name="categorie" data-maj="1">${B.categories.map((c) => `<option value="${c.id}" ${c.id === cat.id ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}</select></label>`}
      <label class="champ">${esc(cat.titre)}<input name="titre" maxlength="120" value="${esc(f?.titre || '')}" required></label>
      ${cat.champs.map((c) => champSaisie(c, f?.valeurs[c.id])).join('')}
      <label class="champ">Note<textarea name="note" rows="3" maxlength="2000">${esc(f?.note || '')}</textarea></label>
      <label class="case"><input type="checkbox" name="prive" ${f?.prive ? 'checked' : ''}> Fiche privée : hors du dossier imprimé et des exports, sauf choix explicite</label>
      <div class="alerte-sensible" id="alerte-sensible" hidden></div>
      ${f?.majLe ? `<p class="mini">Mise à jour le ${dateFr(f.majLe)}.</p>` : ''}
      <p class="erreur" role="alert"></p>`,
    f ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>' : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>', (fd, action) => {
      if (action === 'supprimer') {
        if (!S.confirmer(`Supprimer la fiche « ${f.titre} » ?`)) { S.garderModale(); return undefined; }
        S.retenir(); S.E.fiches = S.E.fiches.filter((x) => x.id !== f.id); S.sauver(); S.rendre(); S.toast('Fiche supprimée.', { libelle: 'Annuler', faire: S.annuler });
        return undefined;
      }
      const x = lire(d.querySelector('form'));
      if (!x.titre) return `Indique : ${cat.titre.toLowerCase()}.`;
      const det = R.verifierFiche(x);
      if (det.length) return `${det[0].champ} : ${R.messageRefus(det)}`;
      for (const c of cat.champs) if (c.type === 'email' && x.valeurs[c.id] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x.valeurs[c.id])) return `${c.libelle} : adresse e-mail incomplète.`;
      S.retenir();
      const propre = R.normaliserFiche(x, { n: 0 });
      if (f) Object.assign(f, propre); else S.E.fiches.push(propre);
      S.sauver(); S.rendre(); S.toast(f ? 'Fiche enregistrée.' : 'Fiche ajoutée.', { libelle: 'Annuler', faire: S.annuler });
      return undefined;
    }, { large: true });
    const form = d.querySelector('form');
    form.addEventListener('input', () => {
      const det = R.verifierFiche(lire(form));
      const el = d.querySelector('#alerte-sensible');
      el.hidden = !det.length;
      if (det.length) el.innerHTML = `<b>Information sensible détectée</b><span>${esc(det.map((x) => `${x.champ} : ${x.message}`).join(' · '))}. Elle ne sera pas enregistrée : note plutôt où la trouver.</span>`;
    });
    form.querySelector('[data-maj]')?.addEventListener('change', (e) => { const garde = lire(form); S.modale().close(); modaleFiche(null, e.target.value); const n = S.modale().querySelector('[name=titre]'); if (n) n.value = garde.titre; });
  }

  // ---------- Exports de la sélection ----------
  function selection() { return R.dossier(S.E, choixDossier()).flatMap((g) => g.fiches); }

  // ---------- Actions ----------
  const actions = {
    cat: (el) => { ui.cat = el.dataset.id; S.rendre(); },
    'fiche-nouvelle': (el) => modaleFiche(null, el.dataset.cat),
    'fiche-ouvrir': (el) => modaleFiche(el.dataset.id),
    'fiche-revue': (el) => { const f = fiche(el.dataset.id); S.retenir(); f.majLe = S.auj(); S.sauver(); S.rendre(); S.toast(`« ${f.titre} » marquée à jour.`, { libelle: 'Annuler', faire: S.annuler }); },
    'retraits-vu': () => { S.E.retraits = 0; S.sauver(); S.rendre(); },
    'choix-cat': (el) => { const c = choixDossier(); c.categories = el.checked ? [...new Set([...c.categories, el.dataset.id])] : c.categories.filter((x) => x !== el.dataset.id); S.rendre(); },
    'choix-tout': () => { choixDossier().categories = B.categories.map((c) => c.id); S.rendre(); },
    'choix-rien': () => { choixDossier().categories = []; S.rendre(); },
    'choix-prive': (el) => { const c = choixDossier(); c.prives = el.checked ? [...c.prives, el.dataset.id] : c.prives.filter((x) => x !== el.dataset.id); S.rendre(); },
    'choix-fiche': (el) => { const c = choixDossier(); if (!el.checked) c.exclues.push(el.dataset.id); S.rendre(); },
    'choix-reinclure': () => { choixDossier().exclues = []; S.rendre(); },
    'csv-selection': () => { const s = selection(); if (!s.length) return S.toast('Aucune fiche sélectionnée.'); S.exporterCsv(R.csvFiches(s), 'memofamille-selection'); },
    'json-selection': () => { const s = selection(); if (!s.length) return S.toast('Aucune fiche sélectionnée.'); S.telecharger(JSON.stringify({ application: 'MémoFamille', produit: 'MMF', selection: true, exporteLe: new Date().toISOString(), reglages: S.E.reglages, fiches: s }, null, 2), 'application/json', `memofamille-selection-${S.auj()}.json`); },
    imprimer: () => S.imprimer(() => { if (S.vue !== 'dossier') S.changerVue('dossier'); }),
  };

  S = window.QME_SOCLE.creer({
    produit: 'MMF', prefixe: 'mmf', nom: 'MémoFamille', fichier: 'memo-famille', titreBarre: 'MémoFamille<br>L\'essentiel du foyer',
    connexion: { titre: 'Si tu es indisponible, tes proches sauront où chercher.', texte: 'Contacts, contrats, logement, documents, consignes : les informations essentielles du foyer, rangées, cherchables et imprimables. Sans mot de passe, sans code, sans numéro bancaire.', ouvrir: 'Ouvre MémoFamille', bouton: 'Ouvrir MémoFamille' },
    onglets: [
      { id: 'classeur', nom: 'Classeur', icone: 'grille' },
      { id: 'recherche', nom: 'Rechercher', icone: 'rond' },
      { id: 'dossier', nom: 'Dossier', icone: 'carre' },
      { id: 'securite', nom: 'Sécurité', icone: 'triangle' },
    ],
    etatVide: R.etatVide, normaliser: R.normaliser, donneesDemo, accueil, apresAccueil,
    vues: { classeur: vueClasseur, recherche: vueRecherche, dossier: vueDossier, securite: vueSecurite },
    apresRendu() { S.$('#recherche')?.addEventListener('input', (e) => { ui.q = e.target.value; S.rendre(); }); },
    actions,
    reglages: {
      corps: () => `<label class="champ">Nom du foyer<input name="nomFoyer" maxlength="80" value="${esc(S.E.reglages.nomFoyer)}"></label><label class="champ">Revue conseillée tous les (jours)<input type="number" name="revueJours" min="30" max="1825" value="${S.E.reglages.revueJours}"></label><p class="aide">La sauvegarde complète (JSON) contient toutes les fiches, privées comprises : garde-la en lieu sûr. Pour partager, préfère le dossier ou l'export de la sélection.</p>`,
      valider: (f) => { const n = O.entier(f.get('revueJours'), 30, 1825, 0); if (!n) return 'Revue : de 30 à 1 825 jours.'; S.E.reglages = { nomFoyer: O.texte(f.get('nomFoyer'), 80), revueJours: n }; return undefined; },
      exports: [['csv-selection', 'Sélection du dossier (CSV)'], ['json-selection', 'Sélection du dossier (JSON)'], ['imprimer', 'Imprimer le dossier']],
      aPropos: () => `<p class="mention">${B.categories.length} catégories et leurs modèles de champs (version ${B.version}). ${esc(B.securite)}</p>`,
    },
    importValide: (d) => d && typeof d === 'object' && Array.isArray(d.fiches),
    resumeImport: (d) => S.pluriel(d.fiches.length, 'fiche'),
  });
  S.lancer();
})();
