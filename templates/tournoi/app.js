// TournoiFacile · interface. Socle commun : templates/commun/socle.js. Moteur : regles.js (window.TRN).
// Les participants des rencontres se déduisent des résultats : une correction ne laisse jamais de tableau incohérent.
(() => {
  'use strict';
  const R = window.TRN;
  const O = window.QME_OUTILS;
  const { esc } = window.QME_SOCLE;
  let S = null;
  const uid = () => O.nouvelId();
  const FORMATS = {
    elimination: ['Élimination directe', 'Une défaite et on sort. Exempts automatiques si le nombre n\'est pas une puissance de 2.'],
    double: ['Double élimination', 'Il faut perdre deux fois pour sortir : tableau des gagnants, des perdants, grande finale.'],
    poules: ['Poules puis phase finale', 'Chacun joue tous les autres de sa poule, puis les qualifiés passent en tableau à élimination.'],
    championnat: ['Championnat', 'Tout le monde rencontre tout le monde, une fois ou en aller-retour. Classement aux points.'],
  };
  const CRIT = { points: 'Points', diff: 'Différence (pour − contre)', pour: 'Points ou buts marqués', confrontation: 'Confrontation directe', victoires: 'Nombre de victoires', tirage: 'Tirage au sort' };
  const PHASES = { poule: 'Poule', championnat: 'Journée', tableau: 'Tableau', perdants: 'Tableau des perdants', finale: 'Grande finale', revanche: 'Finale décisive', troisieme: 'Match pour la 3e place' };
  const ui = { filtre: 'avenir' };

  const tournoi = () => S.E.tournois.find((t) => t.id === S.E.actif) || null;
  const nomP = (t, id) => t.participants.find((p) => p.id === id)?.nom || '?';
  const nomTour = (t, m) => {
    if (m.phase === 'poule') return `Poule ${m.groupe} · tour ${m.tour}`;
    if (m.phase === 'championnat') return `Journée ${m.tour}${m.retour ? ' (retour)' : ''}`;
    if (m.phase === 'tableau') {
      const max = Math.max(...t.matchs.filter((x) => x.phase === 'tableau').map((x) => x.tour));
      const reste = max - m.tour;
      return reste === 0 ? (t.format === 'double' ? 'Finale des gagnants' : 'Finale') : reste === 1 ? (t.format === 'double' ? 'Demi-finales des gagnants' : 'Demi-finales') : reste === 2 ? 'Quarts de finale' : reste === 3 ? 'Huitièmes de finale' : `Tour ${m.tour}`;
    }
    if (m.phase === 'perdants') return `Perdants · tour ${m.tour}`;
    return PHASES[m.phase];
  };
  const libSlot = (t, s, m) => {
    if (s.id) return esc(nomP(t, s.id));
    if (s.vide) return '<i class="exempt">exempt</i>';
    if (s.poule) return `<i>${s.rang}${s.rang === 1 ? 'er' : 'e'} poule ${s.poule}</i>`;
    if (s.source) { const src = t.matchs.find((x) => x.id === s.source); return `<i>${s.type === 'v' ? 'Vainqueur' : 'Perdant'} ${esc(src ? nomTour(t, src).toLowerCase() : '')}${src && src.phase !== 'finale' ? ` n° ${src.ordre}` : ''}</i>`; }
    return '<i>à déterminer</i>';
  };

  // ---------- Données de démonstration (tournois fictifs) ----------
  function donneesDemo() {
    const t1 = R.normaliserTournoi({
      id: uid(), nom: 'Tournoi de pétanque de l\'association', discipline: 'Pétanque en doublettes', format: 'poules', graine: 'demo1',
      participants: ['Les Pointeurs', 'Carreau d\'Or', 'Boule Rouge', 'Les Tireurs du Lac', 'Cochonnet Club', 'Les Rapides', 'Les Vétérans', 'Terre Battue', 'Les Platanes', 'Les Copains'].map((nom) => ({ id: uid(), nom })),
      options: { ...R.optionsDefaut(), nbPoules: 3, qualifies: 2, troisieme: true, terrains: [{ id: uid(), nom: 'Terrain 1' }, { id: uid(), nom: 'Terrain 2' }, { id: uid(), nom: 'Terrain 3' }], debut: `${O.iso(new Date())}T09:00`, dureeMatch: 35, repos: 10, departage: ['points', 'confrontation', 'diff', 'pour', 'tirage'], points: { victoire: 2, nul: 1, defaite: 0, forfait: 0 }, nulsAutorises: false },
    });
    const g = R.generer(t1); t1.matchs = g.matchs; t1.poules = g.poules; t1.genere = true;
    const scores = [[13, 7], [11, 13], [13, 9], [13, 12], [6, 13], [13, 4], [13, 10], [9, 13], [13, 11], [12, 13], [13, 8]];
    t1.matchs.filter((m) => m.phase === 'poule').slice(0, 11).forEach((m, i) => { t1.resultats[m.id] = { scoreA: scores[i][0], scoreB: scores[i][1], forfait: null, departage: null }; });
    const forfait = t1.matchs.filter((m) => m.phase === 'poule')[11];
    if (forfait) t1.resultats[forfait.id] = { scoreA: null, scoreB: null, forfait: 'b', departage: null };
    const t2 = R.normaliserTournoi({
      id: uid(), nom: 'Tournoi de tennis de table du bureau', discipline: 'Tennis de table', format: 'double', graine: 'demo2',
      participants: ['Alex', 'Bao', 'Cyd', 'Dom', 'Élie'].map((nom) => ({ id: uid(), nom })),
      options: { ...R.optionsDefaut(), revanche: true, terrains: [{ id: uid(), nom: 'Table 1' }], debut: `${O.ajout(O.iso(new Date()), -1)}T12:15`, dureeMatch: 15, repos: 5, nulsAutorises: false },
    });
    const g2 = R.generer(t2); t2.matchs = g2.matchs; t2.poules = []; t2.genere = true;
    for (let i = 0; i < 4; i++) { const r = R.resoudre(t2).parMatch; const m = t2.matchs.find((x) => r[x.id].etat === 'jouable'); if (!m) break; t2.resultats[m.id] = { scoreA: 3, scoreB: i % 2 ? 2 : 1, forfait: null, departage: null }; }
    return R.normaliser({ tournois: [t1, t2], actif: t1.id });
  }

  // ---------- Premier lancement ----------
  function accueil() {
    return `
      <p class="surtitre">Bienvenue</p>
      <h1>Un tournoi équilibré en quelques minutes.</h1>
      <p class="intro">Saisis les participants, choisis le format : les rencontres, le tableau, les horaires et les classements se calculent, exempts et égalités compris.</p>
      <form id="form-accueil" class="formulaire-accueil" novalidate>
        <label class="champ">Nom du tournoi<input name="nom" maxlength="80" placeholder="Ex. : Tournoi de badminton du club"></label>
        <label class="champ">Participants ou équipes <small>Un par ligne, dans l'ordre des têtes de série si tu en as.</small><textarea name="participants" rows="6"></textarea></label>
        <p class="erreur" role="alert"></p>
        <div class="accueil-pied"><span></span><button class="btn primaire" type="submit">Créer le tournoi</button></div>
      </form>`;
  }
  function apresAccueil() {
    S.$('#form-accueil').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const nom = O.texte(f.get('nom'), 80);
      if (!nom) { e.target.querySelector('.erreur').textContent = 'Donne un nom au tournoi.'; return; }
      const t = R.normaliserTournoi({ id: uid(), nom, participants: lignes(f.get('participants')) });
      S.terminerAccueil({ version: 1, tournois: [t], actif: t.id }, { vue: 'preparer', message: 'Tournoi créé : choisis le format puis génère les rencontres.' });
    });
  }
  const lignes = (texte) => String(texte || '').split('\n').map((x) => O.texte(x, 60)).filter(Boolean).slice(0, 128).map((nom) => ({ id: uid(), nom, membres: '' }));

  // ---------- Vues ----------
  const vide = () => `<div class="vide-etat">${S.FORME_VIDE}<div><h3>Aucun tournoi</h3><p>Crée un tournoi : participants, format, terrains.</p><div class="actions"><button class="btn primaire" data-action="tournoi-nouveau">${S.ICONES.plus}Nouveau tournoi</button></div></div></div>`;
  const sansRencontres = () => `<div class="vide-etat petit"><div><h3>Rencontres pas encore générées</h3><p>Termine la préparation (participants, format) puis génère les rencontres.</p><div class="actions"><button class="btn petit" data-action="vue" data-vue="preparer">Préparer</button></div></div></div>`;
  function enTete(t) {
    const autres = S.E.tournois.length > 1 ? `<label class="champ choix-tournoi"><span class="sr-only">Tournoi</span><select id="choix-tournoi">${S.E.tournois.map((x) => `<option value="${x.id}" ${x.id === t.id ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label>` : '';
    return `<div class="tournoi-tete">${autres || `<b class="nom-tournoi">${esc(t.nom)}</b>`}<span class="mini">${esc(FORMATS[t.format][0])} · ${S.pluriel(t.participants.length, 'participant')}${t.discipline ? ` · ${esc(t.discipline)}` : ''}</span></div>`;
  }

  function vuePreparer() {
    const t = tournoi();
    if (!t) return vide();
    const o = t.options;
    const err = R.verifier(t);
    const verrou = t.genere;
    const dis = verrou ? 'disabled' : '';
    const nb = t.participants.length;
    const nbP = o.nbPoules || R.nbPoulesConseille(nb);
    return `
      ${enTete(t)}
      <div class="vue-tete"><div><h1>${esc(t.nom)}</h1><p>${verrou ? 'Rencontres générées : participants et format sont verrouillés. Les options de planning restent modifiables.' : 'Participants, format et options, puis génération des rencontres.'}</p></div>
        <div class="actions"><button class="btn" data-action="tournoi-modifier">Nom et discipline</button><button class="btn" data-action="tournoi-nouveau">${S.ICONES.plus}Autre tournoi</button></div></div>
      <h2 class="titre-section">1. Participants <span>${nb} · ordre = têtes de série</span></h2>
      ${nb ? `<ol class="participants">${t.participants.map((p, i) => `<li><span class="seed">${i + 1}</span><button class="lien-ligne" data-action="participant-ouvrir" data-id="${p.id}" ${dis}><b>${esc(p.nom)}</b>${p.membres ? `<span>${esc(p.membres)}</span>` : ''}</button>${verrou ? '' : `<span class="rang-boutons"><button class="btn-icone" data-action="monter" data-id="${p.id}" aria-label="Monter" ${i ? '' : 'disabled'}>↑</button><button class="btn-icone" data-action="descendre" data-id="${p.id}" aria-label="Descendre" ${i < nb - 1 ? '' : 'disabled'}>↓</button></span>`}</li>`).join('')}</ol>` : '<p class="aide">Aucun participant.</p>'}
      ${verrou ? '' : `<div class="rang-boutons" style="margin-top:10px"><button class="btn petit" data-action="participants-coller">Ajouter une liste</button><button class="btn petit" data-action="participant-nouveau">${S.ICONES.plus}Participant</button>${nb > 1 ? '<button class="btn petit" data-action="melanger">Mélanger (tirage au sort)</button>' : ''}</div>`}
      <h2 class="titre-section">2. Format</h2>
      <div class="formats">${Object.entries(FORMATS).map(([id, [n, d]]) => `<label class="format ${t.format === id ? 'choisi' : ''}"><input type="radio" name="format" value="${id}" ${t.format === id ? 'checked' : ''} ${dis} data-option="format"><b>${n}</b><span>${d}</span></label>`).join('')}</div>
      <div class="options-format carte-el">
        ${t.format === 'poules' ? `<div class="rang-champs"><label class="champ">Nombre de poules <small>Conseillé : ${R.nbPoulesConseille(nb)} (poules de 4 environ).</small><input type="number" min="1" max="16" value="${nbP}" data-option="nbPoules" ${dis}></label><label class="champ">Qualifiés par poule<input type="number" min="1" max="8" value="${o.qualifies}" data-option="qualifies" ${dis}></label></div><p class="mini">Répartition en serpentin selon l'ordre des têtes de série : ${nb ? R.repartirPoules(t.participants.map((p) => p.id), Math.min(nbP, Math.max(1, Math.floor(nb / 2)))).map((x, i) => `poule ${R.LETTRES[i]} : ${x.length}`).join(', ') : '—'}.</p>` : ''}
        ${t.format === 'championnat' ? `<label class="case"><input type="checkbox" data-option="allerRetour" ${o.allerRetour ? 'checked' : ''} ${dis}> Aller-retour (chaque rencontre jouée deux fois)</label>` : ''}
        ${['elimination', 'poules'].includes(t.format) ? `<label class="case"><input type="checkbox" data-option="troisieme" ${o.troisieme ? 'checked' : ''} ${dis}> Match pour la 3e place</label>` : ''}
        ${t.format === 'double' ? `<label class="case"><input type="checkbox" data-option="revanche" ${o.revanche ? 'checked' : ''} ${dis}> Finale décisive si le vainqueur des perdants gagne la grande finale</label>` : ''}
        ${['poules', 'championnat'].includes(t.format) ? `<div class="rang-champs"><label class="champ">Victoire<input type="number" min="0" max="10" value="${o.points.victoire}" data-option="pts-victoire"></label><label class="champ">Nul<input type="number" min="0" max="10" value="${o.points.nul}" data-option="pts-nul"></label><label class="champ">Défaite<input type="number" min="0" max="10" value="${o.points.defaite}" data-option="pts-defaite"></label><label class="champ">Forfait<input type="number" min="-5" max="10" value="${o.points.forfait}" data-option="pts-forfait"></label></div>
          <label class="case"><input type="checkbox" data-option="nulsAutorises" ${o.nulsAutorises ? 'checked' : ''}> Matchs nuls autorisés</label>
          <fieldset class="champ"><legend>Départage des égalités, dans l'ordre</legend><ol class="criteres">${o.departage.map((c, i) => `<li><span>${CRIT[c]}</span><span class="rang-boutons"><button class="btn-icone" data-action="crit-monter" data-id="${c}" ${i ? '' : 'disabled'} aria-label="Monter">↑</button><button class="btn-icone" data-action="crit-retirer" data-id="${c}" ${o.departage.length > 1 ? '' : 'disabled'} aria-label="Retirer">×</button></span></li>`).join('')}</ol>
          ${R.CRITERES.filter((c) => !o.departage.includes(c)).map((c) => `<button class="btn petit" data-action="crit-ajouter" data-id="${c}">${S.ICONES.plus}${CRIT[c]}</button>`).join(' ')}</fieldset>` : '<p class="mini">En élimination, une égalité se tranche par un départage (prolongation, tirs au but, jeu décisif) saisi avec le score.</p>'}
      </div>
      <h2 class="titre-section">3. Terrains et horaires</h2>
      <div class="carte-el">
        <div class="rang-champs"><label class="champ">Début<input type="datetime-local" value="${o.debut}" data-option="debut"></label><label class="champ">Durée d'une rencontre (min)<input type="number" min="1" max="600" value="${o.dureeMatch}" data-option="dureeMatch"></label><label class="champ">Repos minimal entre deux rencontres (min)<input type="number" min="0" max="600" value="${o.repos}" data-option="repos"></label></div>
        <label class="champ">Terrains ou espaces de jeu <small>Un par ligne.</small><textarea rows="3" data-option="terrains">${esc(o.terrains.map((x) => x.nom).join('\n'))}</textarea></label>
      </div>
      <div class="generer">${verrou
        ? `<p>${S.pluriel(t.matchs.length, 'rencontre')} générées, ${S.pluriel(Object.keys(t.resultats).length, 'résultat')} saisis.</p><button class="btn danger" data-action="reinitialiser">Réinitialiser le tournoi</button>`
        : `${err ? `<p class="texte-rouge"><b>${esc(err)}</b></p>` : `<p>Prêt : ${S.pluriel(R.generer(t).matchs.length, 'rencontre')} vont être créées.</p>`}<button class="btn primaire" data-action="generer" ${err ? 'disabled' : ''}>Générer les rencontres</button>`}</div>`;
  }

  function ligneMatch(t, m, e, pl) {
    const r = t.resultats[m.id];
    const h = pl[m.id] ? R.heureDe(t, pl[m.id].debut) : null;
    const is = r ? R.issue(m, r) : null;
    const score = e.etat === 'jouee' ? (r.forfait ? `forfait ${esc(nomP(t, e[r.forfait].id))}` : `${r.scoreA} – ${r.scoreB}${r.departage ? ` (${esc(nomP(t, e[r.departage].id))} au départage)` : ''}`) : '';
    return `<li class="rencontre et-${e.etat}">
      <button class="rencontre-corps" data-action="resultat" data-id="${m.id}" ${['jouable', 'jouee'].includes(e.etat) ? '' : 'disabled'}>
        <span class="tour">${esc(nomTour(t, m))}${h ? ` · ${h.date !== (t.options.debut || '').slice(0, 10) ? `${O.versDate(h.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} ` : ''}${h.heure}` : ''}${pl[m.id] ? ` · ${esc(t.options.terrains[pl[m.id].terrain]?.nom || '')}` : ''}</span>
        <span class="duel"><span class="${is === 'a' ? 'gagnant' : ''}">${libSlot(t, e.a, m)}</span><b class="score">${score || (e.etat === 'exempt' ? 'qualifié d\'office' : e.etat === 'annulee' ? 'sans objet' : 'contre')}</b><span class="${is === 'b' ? 'gagnant' : ''}">${libSlot(t, e.b, m)}</span></span>
      </button>
      ${e.etat === 'jouable' ? '<span class="etiquette jaune">À jouer</span>' : e.etat === 'jouee' ? '<span class="etiquette vert">Jouée</span>' : e.etat === 'exempt' ? '<span class="etiquette">Exempt</span>' : e.etat === 'annulee' ? '<span class="etiquette">Sans objet</span>' : '<span class="etiquette ciel">En attente</span>'}
    </li>`;
  }

  function vueRencontres() {
    const t = tournoi();
    if (!t) return vide();
    if (!t.genere) return `${enTete(t)}${sansRencontres()}`;
    const res = R.resoudre(t).parMatch;
    const pl = R.planning(t);
    const filtres = [['avenir', 'À jouer'], ['jouees', 'Jouées'], ['toutes', 'Toutes']];
    const garde = (m) => ui.filtre === 'toutes' || (ui.filtre === 'avenir' ? ['jouable', 'attente'].includes(res[m.id].etat) : res[m.id].etat === 'jouee');
    const groupes = [];
    for (const m of [...t.matchs].sort((x, y) => (pl[x.id]?.debut ?? 1e9) - (pl[y.id]?.debut ?? 1e9) || x.tour - y.tour)) {
      if (!garde(m)) continue;
      const cle = nomTour(t, m).replace(/ · tour \d+$/, (x) => x);
      let g = groupes.find((y) => y.cle === cle);
      if (!g) { g = { cle, ms: [] }; groupes.push(g); }
      g.ms.push(m);
    }
    const nbJ = t.matchs.filter((m) => res[m.id].etat === 'jouee').length, nbAJ = t.matchs.filter((m) => ['jouable', 'attente'].includes(res[m.id].etat)).length;
    return `
      ${enTete(t)}
      <div class="vue-tete"><div><h1>Rencontres</h1><p>${nbJ} jouées, ${nbAJ} à venir. Touche une rencontre à jouer pour saisir le score ; une rencontre jouée pour le corriger.</p></div>
        <div class="actions"><button class="btn" data-action="imprimer">Imprimer</button></div></div>
      <div class="outils-liste"><div class="filtres" role="group" aria-label="Filtrer">${filtres.map(([id, l]) => `<button class="filtre" data-action="filtre" data-id="${id}" aria-pressed="${ui.filtre === id}">${l}</button>`).join('')}</div></div>
      ${groupes.length ? groupes.map((g) => `<section class="groupe-cat"><h2 class="titre-cat">${esc(g.cle)}</h2><ul class="rencontres">${g.ms.map((m) => ligneMatch(t, m, res[m.id], pl)).join('')}</ul></section>`).join('') : `<div class="vide-etat petit"><div><h3>${ui.filtre === 'avenir' ? 'Plus aucune rencontre à jouer' : 'Aucune rencontre ici'}</h3><p>${ui.filtre === 'avenir' ? 'Le tournoi est terminé : consulte le classement.' : 'Change de filtre.'}</p></div></div>`}`;
  }

  function boiteMatch(t, m, e) {
    const r = t.resultats[m.id];
    const is = r ? R.issue(m, r) : null;
    const ligne = (cote) => `<span class="${is === cote ? 'gagnant' : ''} ${e[cote].vide ? 'vide' : ''}"><span class="nom">${libSlot(t, e[cote], m)}</span><b>${e.etat === 'jouee' ? (r.forfait ? (r.forfait === cote ? 'F' : '') : r[cote === 'a' ? 'scoreA' : 'scoreB']) : ''}</b></span>`;
    return `<button class="boite et-${e.etat}" data-action="resultat" data-id="${m.id}" ${['jouable', 'jouee'].includes(e.etat) ? '' : 'disabled'} title="${esc(nomTour(t, m))}">${ligne('a')}${ligne('b')}</button>`;
  }
  function arbre(t, ms, res, titre) {
    const tours = [...new Set(ms.map((m) => m.tour))].sort((a, b) => a - b);
    return `<section class="arbre-bloc"><h2 class="titre-section">${titre}</h2><div class="defile"><div class="arbre" style="--n:${tours.length}">${tours.map((tr) => { const l = ms.filter((m) => m.tour === tr).sort((a, b) => a.ordre - b.ordre); return `<div class="colonne-arbre"><p class="surtitre">${esc(nomTour(t, l[0]))}</p><div class="boites">${l.map((m) => boiteMatch(t, m, res[m.id])).join('')}</div></div>`; }).join('')}</div></div></section>`;
  }
  function tablePoule(t, lettre, classement, fini) {
    return `<div class="carte-el poule"><h3>Poule ${lettre}${fini ? ' <span class="etiquette vert">Terminée</span>' : ''}</h3><div class="defile"><table class="tableau compact"><thead><tr><th>#</th><th>Équipe</th><th class="nb">J</th><th class="nb">V</th><th class="nb">N</th><th class="nb">D</th><th class="nb">Diff.</th><th class="nb">Pts</th></tr></thead><tbody>${classement.map((c) => `<tr class="${c.rang <= t.options.qualifies ? 'qualifie' : ''}"><td>${c.rang}</td><td>${esc(nomP(t, c.id))}${c.critere && !['points'].includes(c.critere) && c.j ? ` <span class="mini" title="Départagé par : ${esc(CRIT[c.critere])}">(${esc(CRIT[c.critere].split(' ')[0].toLowerCase())})</span>` : ''}</td><td class="nb">${c.j}</td><td class="nb">${c.v}</td><td class="nb">${c.n}</td><td class="nb">${c.d}</td><td class="nb">${c.diff > 0 ? '+' : ''}${c.diff}</td><td class="nb"><b>${c.points}</b></td></tr>`).join('')}</tbody></table></div></div>`;
  }

  function vueTableau() {
    const t = tournoi();
    if (!t) return vide();
    if (!t.genere) return `${enTete(t)}${sansRencontres()}`;
    const rs = R.resoudre(t);
    const res = rs.parMatch;
    let corps = '';
    if (t.format === 'championnat') corps = `<p class="aide">En championnat, il n'y a pas de tableau : consulte le classement et les journées.</p>`;
    if (t.format === 'poules') corps += `<div class="grille-poules">${t.poules.map((p) => tablePoule(t, p.lettre, rs.classements[p.lettre], rs.poulesFinies[p.lettre])).join('')}</div>`;
    const tab = t.matchs.filter((m) => m.phase === 'tableau');
    if (tab.length) corps += arbre(t, tab, res, t.format === 'double' ? 'Tableau des gagnants' : t.format === 'poules' ? 'Phase finale' : 'Tableau');
    const lb = t.matchs.filter((m) => m.phase === 'perdants');
    if (lb.length) corps += arbre(t, lb, res, 'Tableau des perdants');
    const fin = t.matchs.filter((m) => ['finale', 'revanche', 'troisieme'].includes(m.phase));
    if (fin.length) corps += `<section class="arbre-bloc"><h2 class="titre-section">Finales</h2><div class="boites-ligne">${fin.map((m) => `<div><p class="surtitre">${esc(nomTour(t, m))}</p>${boiteMatch(t, m, res[m.id])}</div>`).join('')}</div></section>`;
    return `${enTete(t)}<div class="vue-tete"><div><h1>Tableau</h1><p>Touche une rencontre pour saisir ou corriger son résultat. Les vainqueurs avancent d'eux-mêmes.</p></div><div class="actions"><button class="btn" data-action="imprimer">Imprimer</button></div></div>${corps}`;
  }

  function vueClassement() {
    const t = tournoi();
    if (!t) return vide();
    if (!t.genere) return `${enTete(t)}${sansRencontres()}`;
    const rs = R.resoudre(t);
    let corps;
    if (t.format === 'championnat') {
      const c = R.classer(t.participants.map((p) => p.id), t.matchs, t.resultats, t.options, t.graine);
      const total = t.matchs.length, jouees = t.matchs.filter((m) => rs.parMatch[m.id].etat === 'jouee').length;
      corps = `<p class="aide">${jouees}/${total} rencontres jouées. Victoire ${t.options.points.victoire} pts, nul ${t.options.points.nul}, défaite ${t.options.points.defaite}, forfait ${t.options.points.forfait}. Départage : ${t.options.departage.map((x) => CRIT[x].toLowerCase()).join(', ')}.</p>
        <div class="defile"><table class="tableau classement-final"><thead><tr><th>#</th><th>Équipe</th><th class="nb">J</th><th class="nb">V</th><th class="nb">N</th><th class="nb">D</th><th class="nb">Pour</th><th class="nb">Contre</th><th class="nb">Diff.</th><th class="nb">Pts</th></tr></thead><tbody>${c.map((x) => `<tr><td>${x.rang}</td><td><b>${esc(nomP(t, x.id))}</b>${x.critere && x.critere !== 'points' && x.j ? ` <span class="mini">départagé : ${esc(CRIT[x.critere].toLowerCase())}</span>` : ''}</td><td class="nb">${x.j}</td><td class="nb">${x.v}</td><td class="nb">${x.n}</td><td class="nb">${x.d}</td><td class="nb">${x.pour}</td><td class="nb">${x.contre}</td><td class="nb">${x.diff > 0 ? '+' : ''}${x.diff}</td><td class="nb"><b>${x.points}</b></td></tr>`).join('')}</tbody></table></div>`;
    } else {
      const p = R.podium(t);
      const elimines = {};
      for (const m of t.matchs) { const e = rs.parMatch[m.id]; if (e.etat !== 'jouee') continue; const is = R.issue(m, t.resultats[m.id]); const perdant = e[is === 'a' ? 'b' : 'a'].id; elimines[perdant] = nomTour(t, m); }
      corps = `${p ? `<div class="podium">${[['2', p.second], ['1', p.premier], ['3', p.troisieme]].map(([r, id]) => `<div class="marche m${r}"><b>${id ? esc(nomP(t, id)) : '—'}</b><span>${r}</span></div>`).join('')}</div>` : '<p class="aide">Le classement final s\'affichera quand la finale sera jouée.</p>'}
        ${t.format === 'poules' ? `<h2 class="titre-section">Poules</h2><div class="grille-poules">${t.poules.map((x) => tablePoule(t, x.lettre, rs.classements[x.lettre], rs.poulesFinies[x.lettre])).join('')}</div>` : ''}
        <h2 class="titre-section">Parcours</h2><ul class="liste-simple">${t.participants.map((x) => `<li><b>${esc(x.nom)}</b> <span class="mini">${p?.premier === x.id ? 'vainqueur' : elimines[x.id] ? `dernière défaite : ${esc(elimines[x.id].toLowerCase())}` : 'encore en lice'}</span></li>`).join('')}</ul>`;
    }
    return `${enTete(t)}<div class="vue-tete"><div><h1>Classement</h1></div><div class="actions"><button class="btn" data-action="imprimer">Imprimer</button></div></div>${corps}`;
  }

  function vuePlanning() {
    const t = tournoi();
    if (!t) return vide();
    if (!t.genere) return `${enTete(t)}${sansRencontres()}`;
    const res = R.resoudre(t).parMatch;
    const pl = R.planning(t);
    const liste = t.matchs.filter((m) => pl[m.id]).sort((a, b) => pl[a.id].debut - pl[b.id].debut || pl[a.id].terrain - pl[b.id].terrain);
    const fin = liste.length ? Math.max(...liste.map((m) => pl[m.id].fin)) : 0;
    const hFin = R.heureDe(t, fin);
    const prochains = liste.filter((m) => res[m.id].etat === 'jouable').slice(0, 6);
    return `
      ${enTete(t)}
      <div class="vue-tete"><div><h1>Planning</h1><p>${S.pluriel(liste.length, 'rencontre')} sur ${S.pluriel(t.options.terrains.length, 'terrain')}, ${t.options.dureeMatch} min chacune, ${t.options.repos} min de repos minimal.${hFin ? ` Fin estimée : ${hFin.date !== t.options.debut.slice(0, 10) ? `${O.versDate(hFin.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} ` : ''}${hFin.heure}.` : ' Indique l\'heure de début dans « Préparer » pour avoir les horaires.'}</p></div>
        <div class="actions"><button class="btn" data-action="imprimer">Imprimer</button></div></div>
      <h2 class="titre-section">Prochaines rencontres <span>Participants connus, à jouer</span></h2>
      ${prochains.length ? `<ul class="rencontres">${prochains.map((m) => ligneMatch(t, m, res[m.id], pl)).join('')}</ul>` : '<p class="aide">Aucune rencontre prête à jouer.</p>'}
      <h2 class="titre-section">Programme complet</h2>
      <div class="defile"><table class="tableau compact"><thead><tr><th>${t.options.debut ? 'Heure' : 'Créneau'}</th><th>Terrain</th><th>Rencontre</th><th>Participants</th><th>État</th></tr></thead><tbody>${liste.map((m) => { const h = R.heureDe(t, pl[m.id].debut); const e = res[m.id]; return `<tr class="et-${e.etat}"><td>${h ? h.heure : `+${pl[m.id].debut} min`}</td><td>${esc(t.options.terrains[pl[m.id].terrain]?.nom || '')}</td><td>${esc(nomTour(t, m))}</td><td>${libSlot(t, e.a, m)} – ${libSlot(t, e.b, m)}</td><td>${{ jouable: 'à jouer', jouee: 'jouée', attente: 'en attente' }[e.etat]}</td></tr>`; }).join('')}</tbody></table></div>
      <p class="mention" style="margin-top:12px">Horaires indicatifs, recalculés à chaque résultat : chaque rencontre commence quand un terrain est libre, que ses participants ont fini et que leur repos est écoulé.</p>`;
  }

  // ---------- Modales ----------
  function modaleResultat(id) {
    const t = tournoi();
    const m = t.matchs.find((x) => x.id === id);
    const e = R.resoudre(t).parMatch[id];
    const r = t.resultats[id] || { scoreA: null, scoreB: null, forfait: null, departage: null };
    const na = esc(nomP(t, e.a.id)), nb = esc(nomP(t, e.b.id));
    const d = S.ouvrirModale(esc(nomTour(t, m)), `
      <div class="saisie-score"><label class="champ"><span>${na}</span><input type="number" name="scoreA" min="0" max="9999" inputmode="numeric" value="${r.scoreA ?? ''}"></label><span class="contre">–</span><label class="champ"><span>${nb}</span><input type="number" name="scoreB" min="0" max="9999" inputmode="numeric" value="${r.scoreB ?? ''}"></label></div>
      <fieldset class="champ" id="bloc-departage"><legend>En cas d'égalité, vainqueur au départage</legend><div class="choix-statut deux"><label><input type="radio" name="departage" value="a" ${r.departage === 'a' ? 'checked' : ''}><span>${na}</span></label><label><input type="radio" name="departage" value="b" ${r.departage === 'b' ? 'checked' : ''}><span>${nb}</span></label></div></fieldset>
      <fieldset class="champ"><legend>Forfait</legend><div class="choix-statut">${[['', 'Aucun'], ['a', `${na} forfait`], ['b', `${nb} forfait`]].map(([v, l]) => `<label><input type="radio" name="forfait" value="${v}" ${(r.forfait || '') === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>
      <p class="erreur" role="alert"></p>`,
    `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${t.resultats[id] ? '<button class="btn danger gauche" value="effacer">Effacer le résultat</button>' : ''}`, (f, action) => {
      const nouveau = action === 'effacer' ? undefined : (() => {
        const lire = (k) => { const s = String(f.get(k) || '').trim(); return s === '' ? null : Number(s); };
        const forfait = f.get('forfait') || null;
        return { scoreA: forfait ? null : lire('scoreA'), scoreB: forfait ? null : lire('scoreB'), forfait, departage: f.get('departage') || null };
      })();
      if (nouveau) {
        if (!nouveau.forfait && (nouveau.scoreA === null || nouveau.scoreB === null)) return 'Saisis les deux scores, ou un forfait.';
        if (!nouveau.forfait && nouveau.scoreA !== nouveau.scoreB) nouveau.departage = null;
        const err = R.validerResultat(m, nouveau, t.options);
        if (err) return err;
      }
      const suites = R.consequences(t, id, nouveau);
      if (suites.length && !S.confirmer(`Ce changement modifie les participants de ${S.pluriel(suites.length, 'rencontre déjà jouée', 'rencontres déjà jouées')} (${suites.map((x) => nomTour(t, t.matchs.find((y) => y.id === x))).join(', ')}). Leurs résultats seront effacés. Continuer ?`)) return 'Correction annulée : rien n\'a changé.';
      S.retenir();
      if (nouveau) t.resultats[id] = nouveau; else delete t.resultats[id];
      for (const x of suites) delete t.resultats[x];
      S.sauver(); S.rendre();
      S.toast(suites.length ? `Résultat corrigé, ${S.pluriel(suites.length, 'rencontre suivante remise', 'rencontres suivantes remises')} à jouer.` : nouveau ? 'Résultat enregistré.' : 'Résultat effacé.', { libelle: 'Annuler', faire: S.annuler });
      return undefined;
    });
    const maj = () => {
      const a = d.querySelector('[name=scoreA]').value, b = d.querySelector('[name=scoreB]').value;
      const forfait = d.querySelector('[name=forfait]:checked')?.value;
      d.querySelector('#bloc-departage').hidden = !!forfait || a === '' || a !== b;
      d.querySelectorAll('[name=scoreA],[name=scoreB]').forEach((x) => { x.disabled = !!forfait; });
    };
    d.querySelector('form').addEventListener('input', maj);
    maj();
  }

  function modaleTournoi(id) {
    const t = id ? tournoi() : null;
    S.ouvrirModale(t ? 'Tournoi' : 'Nouveau tournoi', `
      <label class="champ">Nom<input name="nom" maxlength="80" value="${esc(t?.nom || '')}"></label>
      <label class="champ">Discipline <small>Facultative : sport, jeu, catégorie.</small><input name="discipline" maxlength="60" value="${esc(t?.discipline || '')}"></label>
      ${t ? '' : '<label class="champ">Participants <small>Un par ligne.</small><textarea name="participants" rows="5"></textarea></label>'}
      <p class="erreur" role="alert"></p>`,
    t ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer le tournoi</button>' : '<button class="btn primaire" value="ok">Créer</button><button class="btn" value="annuler">Annuler</button>', (f, action) => {
      if (action === 'supprimer') {
        if (!S.confirmer(`Supprimer « ${t.nom} » et tous ses résultats ?`)) { S.garderModale(); return undefined; }
        S.retenir(); S.E.tournois = S.E.tournois.filter((x) => x.id !== t.id); S.E.actif = S.E.tournois[0]?.id ?? null; S.sauver(); S.rendre(); S.toast('Tournoi supprimé.', { libelle: 'Annuler', faire: S.annuler });
        return undefined;
      }
      const nom = O.texte(f.get('nom'), 80);
      if (!nom) return 'Donne un nom au tournoi.';
      S.retenir();
      if (t) Object.assign(t, { nom, discipline: O.texte(f.get('discipline'), 60) });
      else { const n = R.normaliserTournoi({ id: uid(), nom, discipline: f.get('discipline'), participants: lignes(f.get('participants')) }); S.E.tournois.push(n); S.E.actif = n.id; }
      S.sauver(); if (t) S.rendre(); else S.changerVue('preparer');
      return undefined;
    });
  }

  function modaleParticipant(id) {
    const t = tournoi();
    const p = id ? t.participants.find((x) => x.id === id) : null;
    S.ouvrirModale(p ? 'Participant' : 'Nouveau participant', `
      <label class="champ">Nom du participant ou de l'équipe<input name="nom" maxlength="60" value="${esc(p?.nom || '')}"></label>
      <label class="champ">Membres <small>Facultatif.</small><input name="membres" maxlength="200" value="${esc(p?.membres || '')}"></label><p class="erreur" role="alert"></p>`,
    p ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Retirer</button>' : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="ok-suivant">Ajouter et suivant</button><button class="btn" value="annuler">Annuler</button>', (f, action) => {
      if (action === 'supprimer') { S.retenir(); t.participants = t.participants.filter((x) => x.id !== p.id); S.sauver(); S.rendre(); return undefined; }
      const nom = O.texte(f.get('nom'), 60);
      if (!nom) return 'Indique un nom.';
      if (t.participants.some((x) => x.id !== p?.id && x.nom.toLowerCase() === nom.toLowerCase())) return 'Ce nom est déjà pris.';
      if (!p && t.participants.length >= 128) return '128 participants au maximum.';
      S.retenir();
      if (p) Object.assign(p, { nom, membres: O.texte(f.get('membres'), 200) }); else t.participants.push({ id: uid(), nom, membres: O.texte(f.get('membres'), 200) });
      S.sauver(); S.rendre();
      if (action === 'ok-suivant') { S.garderModale(); setTimeout(() => modaleParticipant(null), 0); }
      return undefined;
    });
  }

  // ---------- Actions ----------
  const deplacer = (liste, id, delta) => { const i = liste.findIndex((x) => (x.id ?? x) === id); const j = i + delta; if (i < 0 || j < 0 || j >= liste.length) return; [liste[i], liste[j]] = [liste[j], liste[i]]; };
  const actions = {
    'tournoi-nouveau': () => modaleTournoi(null),
    'tournoi-modifier': () => modaleTournoi(tournoi().id),
    'participant-nouveau': () => modaleParticipant(null),
    'participant-ouvrir': (el) => modaleParticipant(el.dataset.id),
    'participants-coller': () => S.ouvrirModale('Ajouter une liste', '<label class="champ">Un participant par ligne<textarea name="liste" rows="8"></textarea></label><p class="erreur" role="alert"></p>', '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const t = tournoi();
      const l = lignes(f.get('liste')).filter((x) => !t.participants.some((y) => y.nom.toLowerCase() === x.nom.toLowerCase()));
      if (!l.length) return 'Aucun nouveau nom (les doublons sont ignorés).';
      S.retenir(); t.participants.push(...l.slice(0, 128 - t.participants.length)); S.sauver(); S.rendre(); S.toast(`${S.pluriel(l.length, 'participant ajouté', 'participants ajoutés')}.`);
      return undefined;
    }),
    monter: (el) => { S.retenir(); deplacer(tournoi().participants, el.dataset.id, -1); S.sauver(); S.rendre(); },
    descendre: (el) => { S.retenir(); deplacer(tournoi().participants, el.dataset.id, 1); S.sauver(); S.rendre(); },
    melanger: () => {
      const t = tournoi();
      S.retenir();
      const graine = O.nouvelId();
      t.participants.sort((a, b) => R.hache(`${graine}${a.id}`) - R.hache(`${graine}${b.id}`));
      S.sauver(); S.rendre(); S.toast('Ordre tiré au sort.', { libelle: 'Annuler', faire: S.annuler });
    },
    'crit-monter': (el) => { S.retenir(); deplacer(tournoi().options.departage, el.dataset.id, -1); S.sauver(); S.rendre(); },
    'crit-retirer': (el) => { const o = tournoi().options; S.retenir(); o.departage = o.departage.filter((x) => x !== el.dataset.id); S.sauver(); S.rendre(); },
    'crit-ajouter': (el) => { const o = tournoi().options; S.retenir(); o.departage.push(el.dataset.id); S.sauver(); S.rendre(); },
    generer: () => {
      const t = tournoi();
      const err = R.verifier(t);
      if (err) return S.toast(err);
      S.retenir();
      const g = R.generer(t);
      Object.assign(t, { matchs: g.matchs, poules: g.poules, genere: true, resultats: {} });
      if (!S.sauver()) return undefined;
      S.changerVue('rencontres');
      S.toast(`${S.pluriel(t.matchs.length, 'rencontre générée', 'rencontres générées')}.`, { libelle: 'Annuler', faire: S.annuler });
      return undefined;
    },
    reinitialiser: () => {
      const t = tournoi();
      if (!S.confirmer(`Effacer les ${Object.keys(t.resultats).length} résultats et les rencontres pour revenir à la préparation ?`)) return;
      S.retenir(); Object.assign(t, { matchs: [], poules: [], resultats: {}, genere: false }); S.sauver(); S.rendre(); S.toast('Tournoi réinitialisé.', { libelle: 'Annuler', faire: S.annuler });
    },
    resultat: (el) => modaleResultat(el.dataset.id),
    filtre: (el) => { ui.filtre = el.dataset.id; S.rendre(); },
    imprimer: () => S.imprimer(),
    'csv-rencontres': () => { const t = tournoi(); if (!t?.genere) return S.toast('Génère d\'abord les rencontres.'); S.exporterCsv(R.csvRencontres(t), 'tournoi-rencontres'); return undefined; },
    'csv-classement': () => {
      const t = tournoi();
      if (!t?.genere) return S.toast('Génère d\'abord les rencontres.');
      const rs = R.resoudre(t);
      const groupes = t.format === 'championnat' ? [['', t.participants.map((p) => p.id), t.matchs]] : t.poules.map((p) => [p.lettre, p.ids, t.matchs.filter((m) => m.groupe === p.lettre)]);
      const rows = [['Poule', 'Rang', 'Participant', 'Joués', 'Victoires', 'Nuls', 'Défaites', 'Pour', 'Contre', 'Différence', 'Points', 'Départagé par']];
      for (const [g, ids, ms] of groupes) for (const c of R.classer(ids, ms, t.resultats, t.options, g ? `${t.graine}:${g}` : t.graine)) rows.push([g, c.rang, nomP(t, c.id), c.j, c.v, c.n, c.d, c.pour, c.contre, c.diff, c.points, c.critere ? CRIT[c.critere] : '']);
      if (!groupes.length) { const p = R.podium(t); rows.push(['', 1, p ? nomP(t, p.premier) : '']); }
      void rs;
      S.exporterCsv(rows, 'tournoi-classement');
      return undefined;
    },
  };

  S = window.QME_SOCLE.creer({
    produit: 'TRN', prefixe: 'trn', nom: 'TournoiFacile', fichier: 'tournoi', titreBarre: 'TournoiFacile<br>Tournois équilibrés',
    connexion: { titre: 'Un tournoi équilibré en quelques minutes.', texte: 'Élimination directe ou double, poules, championnat : rencontres générées, exempts gérés, horaires sur plusieurs terrains, scores, classements et départages configurables.', ouvrir: 'Ouvre TournoiFacile', bouton: 'Ouvrir TournoiFacile' },
    onglets: [
      { id: 'preparer', nom: 'Préparer', icone: 'grille' },
      { id: 'rencontres', nom: 'Rencontres', icone: 'lignes' },
      { id: 'tableau', nom: 'Tableau', icone: 'triangle' },
      { id: 'classement', nom: 'Classement', icone: 'barres' },
      { id: 'planning', nom: 'Planning', icone: 'rond' },
    ],
    vueParDefaut: 'rencontres',
    etatVide: R.etatVide, normaliser: R.normaliser, donneesDemo, accueil, apresAccueil,
    vues: { preparer: vuePreparer, rencontres: vueRencontres, tableau: vueTableau, classement: vueClassement, planning: vuePlanning },
    apresRendu() {
      S.$('#choix-tournoi')?.addEventListener('change', (e) => { S.E.actif = e.target.value; S.sauver(); S.rendre(); });
      document.querySelectorAll('[data-option]').forEach((el) => el.addEventListener('change', () => {
        const t = tournoi();
        const o = t.options;
        const k = el.dataset.option;
        const n = (min, max, def) => O.entier(el.value, min, max, def);
        S.retenir();
        if (k === 'format') t.format = el.value;
        else if (k === 'nbPoules') o.nbPoules = n(1, 16, o.nbPoules);
        else if (k === 'qualifies') o.qualifies = n(1, 8, o.qualifies);
        else if (['allerRetour', 'troisieme', 'revanche', 'nulsAutorises'].includes(k)) o[k] = el.checked;
        else if (k.startsWith('pts-')) o.points[k.slice(4)] = n(k === 'pts-forfait' ? -5 : 0, 10, o.points[k.slice(4)]);
        else if (k === 'debut') o.debut = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(el.value) ? el.value : '';
        else if (k === 'dureeMatch') o.dureeMatch = n(1, 600, o.dureeMatch);
        else if (k === 'repos') o.repos = n(0, 600, o.repos);
        else if (k === 'terrains') { const noms = el.value.split('\n').map((x) => O.texte(x, 40)).filter(Boolean).slice(0, 30); o.terrains = noms.length ? noms.map((nom, i) => ({ id: o.terrains[i]?.id || uid(), nom })) : [{ id: uid(), nom: 'Terrain 1' }]; }
        S.sauver(); S.rendre();
      }));
    },
    actions,
    reglages: {
      exports: [['csv-rencontres', 'Rencontres et résultats (CSV)'], ['csv-classement', 'Classement (CSV)'], ['imprimer', 'Imprimer la page affichée']],
      aPropos: () => '<p class="mention">Formats : élimination directe (avec exempts et 3e place), double élimination (avec finale décisive), poules en serpentin puis phase finale, championnat (aller simple ou aller-retour). Départage configurable avec tirage au sort reproductible. Aucun envoi de message ni connexion à un service externe.</p>',
    },
    importValide: (d) => d && typeof d === 'object' && Array.isArray(d.tournois),
    resumeImport: (d) => S.pluriel(d.tournois.length, 'tournoi'),
  });
  S.lancer();
})();
