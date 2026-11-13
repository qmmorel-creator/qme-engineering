// ContrôleRéception · interface. Socle commun : templates/commun/socle.js. Règles : regles.js (window.RCP).
// Modèles de contrôle génériques : aucune valeur de certification. Aucun envoi au fournisseur.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.RCP;
  const O = window.QME_OUTILS;
  const { esc } = window.QME_SOCLE;
  let S = null;
  const uid = () => O.nouvelId();
  const nb = (n) => (n === null || n === undefined ? '–' : O.fmtNombre(n, { dec: 3 }));
  const dateFr = (s) => (s ? O.versDate(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
  const COUL = { attente: 'sable', conforme: 'vert', reserves: 'jaune', nonconforme: 'rouge' };
  const pastille = (s) => `<span class="etiquette ${COUL[s]}">${R.LIB_STATUT[s]}</span>`;
  const ui = { filtre: 'tous', fournisseur: 'tous', q: '', ref: 'familles' };
  const rec = () => S.E.receptions.find((r) => r.id === S.E.receptionActive) || null;
  const famille = (id) => S.E.familles.find((f) => f.id === id);
  const fournisseur = (id) => S.E.fournisseurs.find((f) => f.id === id);
  const nomGravite = (id) => B.gravites.find((g) => g.id === id)?.nom || id;
  const nomType = (id) => B.typesConstat.find((t) => t.id === id)?.nom.split(' (')[0] || id;

  // ---------- Photos : compression dans le navigateur (JPEG ≈ 640 px), jamais envoyées ailleurs ----------
  function compresser(fichier, cote = 640, qualite = 0.6) {
    return new Promise((ok, ko) => {
      if (!/^image\//.test(fichier.type)) return ko(new Error('Ce fichier n\'est pas une image.'));
      const img = new Image();
      const url = URL.createObjectURL(fichier);
      img.onload = () => {
        const k = Math.min(1, cote / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        ok(c.toDataURL('image/jpeg', qualite));
      };
      img.onerror = () => { URL.revokeObjectURL(url); ko(new Error('Image illisible.')); };
      img.src = url;
    });
  }
  // Petite illustration de démonstration (dessinée, aucune photo réelle).
  function photoDemo(couleur, texte) {
    const c = document.createElement('canvas');
    c.width = 240; c.height = 160;
    const g = c.getContext('2d');
    g.fillStyle = '#E4DCCE'; g.fillRect(0, 0, 240, 160);
    g.fillStyle = couleur; g.fillRect(40, 40, 120, 90);
    g.fillStyle = '#24221F'; g.beginPath(); g.moveTo(160, 40); g.lineTo(200, 70); g.lineTo(160, 130); g.fill();
    g.font = 'bold 14px sans-serif'; g.fillText(texte, 12, 22);
    return c.toDataURL('image/jpeg', 0.7);
  }

  // ---------- Données de démonstration (fictives) ----------
  function donneesDemo() {
    const e = R.etatVide();
    e.reglages = { societe: 'Restaurant d\'exemple (fictif)', receptionnaire: 'Camille (réception)' };
    const f = (nom, contact) => { const x = { id: uid(), nom, contact, note: '' }; e.fournisseurs.push(x); return x.id; };
    const fA = f('Fournisseur A · produits laitiers', 'Commandes : téléphone du commercial'), fB = f('Grossiste B · épicerie', ''), fC = f('Négoce C · matériaux', ''), fD = f('Atelier D · usinage', '');
    const t = O.iso(new Date());
    const an = Number(t.slice(0, 4));
    const tout = (fam, extra = {}) => { const c = {}; for (const p of R.pointsFamille(e.familles.find((x) => x.id === fam))) c[p.id] = p.type === 'mesure' ? { valeur: p.min !== null && p.max !== null ? O.arrondi((p.min + p.max) / 2, 1) : 0 } : { resultat: 'ok' }; return { ...c, ...extra }; };
    const L = (ref, designation, unite, cmd, recue, extra = {}) => ({ id: uid(), ref, designation, unite, qteCommandee: cmd, qteRecue: recue, qteRefusee: 0, lot: '', ...extra });
    const r = (j, fournisseurId, familleId, lignes, controles, extra = {}) => ({ id: uid(), date: O.ajout(t, j), heure: '07:40', fournisseurId, familleId, commande: `CMD-${1200 + e.receptions.length}`, bl: `BL-${88400 + e.receptions.length * 7}`, transporteur: 'Transporteur du fournisseur', receptionnaire: 'Camille (réception)', lignes, controles, constats: [], decision: null, cloturee: true, observations: '', ...extra });
    e.receptions.push(
      r(-21, fA, 'frais', [L('YA-01', 'Yaourts nature', 'carton', 20, 20), L('CR-02', 'Crème fraîche 1 L', 'u', 12, 12)], tout('frais', { temp: { valeur: 3.1 } })),
      r(-17, fB, 'epicerie', [L('FA-10', 'Farine T55 25 kg', 'u', 10, 10), L('SU-03', 'Sucre 1 kg', 'carton', 6, 5), L('HU-07', 'Huile 5 L', 'u', 8, 8)], tout('epicerie'), {
        constats: [{ id: uid(), type: 'quantitatif', gravite: 'majeure', description: '1 carton de sucre manquant, signalé sur le bon du transporteur.', reserve: true, ligneId: null, photos: [], levee: { date: O.ajout(t, -10), commentaire: 'Carton livré avec la commande suivante.' } }] }),
      r(-12, fA, 'frais', [L('YA-01', 'Yaourts nature', 'carton', 20, 20), L('BE-04', 'Beurre doux 250 g', 'carton', 8, 8)], tout('frais', { temp: { valeur: 7.4, commentaire: 'Relevé sur 3 cartons, groupe froid du camion en panne.' } }), {
        constats: [{ id: uid(), type: 'logistique', gravite: 'critique', description: 'Température des produits à 7,4 °C : chaîne du froid rompue pendant le transport.', reserve: true, ligneId: null, photos: [{ id: uid(), data: photoDemo('#E58C74', 'Thermomètre 7,4 °C'), legende: 'Relevé de température' }], levee: null }],
        decision: { statut: 'nonconforme', motif: '', par: 'Camille', le: O.ajout(t, -12) }, observations: 'Livraison refusée, retour avec le transporteur.' }),
      r(-8, fC, 'materiaux', [L('BL-20', 'Blocs béton 20 × 20 × 50', 'palette', 6, 6), L('CI-35', 'Ciment 35 kg', 'u', 40, 40, { qteRefusee: 3 }), L('SA-04', 'Sable 0/4', 't', 8, 8.12)], tout('materiaux', { etat: { resultat: 'nok', commentaire: '3 sacs de ciment percés.' } }), {
        constats: [{ id: uid(), type: 'qualitatif', gravite: 'mineure', description: '3 sacs de ciment percés, refusés et laissés au chauffeur.', reserve: true, ligneId: null, photos: [{ id: uid(), data: photoDemo('#E8B93A', 'Sacs percés'), legende: 'Sacs refusés' }], levee: null }] }),
      r(-5, fD, 'mecanique', [L('AX-118', 'Axe Ø 20 h7, longueur 118', 'u', 50, 50)], tout('mecanique', { cote: { valeur: 19.985, commentaire: 'Mesure au micromètre sur 5 pièces.' } }), {
        decision: { statut: 'conforme', motif: '', par: 'Camille', le: O.ajout(t, -5) } }),
      r(-2, fB, 'epicerie', [L('RI-02', 'Riz long 5 kg', 'u', 12, 12), L('PA-11', 'Pâtes 3 kg', 'u', 15, 15)], tout('epicerie', { dates: { resultat: 'nok', commentaire: 'Dates courtes : 3 semaines.' } }), {
        decision: { statut: 'conforme', motif: 'Dates courtes acceptées : consommation prévue sous 10 jours.', par: 'Camille', le: O.ajout(t, -2) } }),
      r(0, fA, 'frais', [L('YA-01', 'Yaourts nature', 'carton', 20, 18), L('CR-02', 'Crème fraîche 1 L', 'u', 12, null), L('FR-09', 'Fromage blanc 5 kg', 'u', 4, 4)], { bl: { resultat: 'ok' }, emballage: { resultat: 'ok' }, temp: { valeur: 3.6 } }, { cloturee: false, heure: '08:15' }),
    );
    e.receptions.forEach((x, i) => { x.numero = `REC-${an}-${String(i + 1).padStart(4, '0')}`; });
    const n = R.normaliser(e);
    n.receptionActive = n.receptions.at(-1).id;
    return n;
  }

  // ---------- Premier lancement ----------
  function accueil() {
    return `
      <p class="surtitre">Bienvenue</p>
      <h1>Contrôle tes livraisons avant de signer.</h1>
      <p class="intro">${B.familles.length} familles de produits ont déjà leurs points de contrôle. Indique ton établissement et tes premiers fournisseurs : tu pourras créer ta première réception tout de suite.</p>
      <form id="form-accueil" class="formulaire-accueil" novalidate>
        <label class="champ">Établissement <small>Imprimé sur les procès-verbaux.</small><input name="societe" maxlength="120"></label>
        <label class="champ">Réceptionnaire habituel<input name="receptionnaire" maxlength="80"></label>
        <label class="champ">Fournisseurs <small>Un par ligne, facultatif.</small><textarea name="fournisseurs" rows="4"></textarea></label>
        <p class="erreur" role="alert"></p>
        <div class="accueil-pied"><span></span><button class="btn primaire" type="submit">Commencer</button></div>
      </form>
      <ol class="conseils" style="margin-top:32px">${B.conseils.map(([a, b]) => `<li><b>${esc(a)}</b><span>${esc(b)}</span></li>`).join('')}</ol>`;
  }
  function apresAccueil() {
    S.$('#form-accueil').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const etat = R.etatVide();
      etat.reglages = { societe: O.texte(f.get('societe'), 120), receptionnaire: O.texte(f.get('receptionnaire'), 80) };
      etat.fournisseurs = String(f.get('fournisseurs') || '').split('\n').map((x) => O.texte(x, 100)).filter(Boolean).slice(0, 100).map((nom) => ({ id: uid(), nom, contact: '', note: '' }));
      S.terminerAccueil(etat, { vue: 'receptions', message: 'Prêt. Crée ta première réception.' });
    });
  }

  // ---------- Vues ----------
  const AVERTISSEMENT = `<p class="mention avertissement">${esc(B.avertissement)}</p>`;
  const videRec = () => `<div class="vide-etat">${S.FORME_VIDE}<div><h3>Aucune réception ouverte</h3><p>Crée une réception ou ouvre-en une depuis l'historique.</p><div class="actions"><button class="btn primaire" data-action="reception-nouvelle">${S.ICONES.plus}Nouvelle réception</button><button class="btn" data-action="vue" data-vue="receptions">Historique</button></div></div></div>`;

  function vueReceptions() {
    const st = R.statistiques(S.E);
    const q = ui.q.trim().toLowerCase();
    const liste = st.analyses.filter(({ r, a }) => (ui.filtre === 'tous' || a.statut === ui.filtre) && (ui.fournisseur === 'tous' || r.fournisseurId === ui.fournisseur)
      && (!q || `${r.numero} ${r.commande} ${r.bl} ${fournisseur(r.fournisseurId)?.nom || ''} ${r.lignes.map((l) => `${l.ref} ${l.designation}`).join(' ')}`.toLowerCase().includes(q)))
      .sort((x, y) => (y.r.date + y.r.heure).localeCompare(x.r.date + x.r.heure));
    const filtres = [['tous', 'Toutes', st.total], ['attente', 'En attente', st.attente], ['conforme', 'Conformes', st.conforme], ['reserves', 'Avec réserves', st.reserves], ['nonconforme', 'Non conformes', st.nonconforme]];
    return `
      <div class="vue-tete"><div><h1>Réceptions</h1><p>Historique de tes livraisons contrôlées. Ouvre une réception pour la compléter, la décider ou imprimer son procès-verbal.</p></div>
        <div class="actions"><button class="btn primaire" data-action="reception-nouvelle">${S.ICONES.plus}Nouvelle réception</button></div></div>
      <div class="outils-liste">
        <div class="filtres" role="group" aria-label="Filtrer par statut">${filtres.map(([id, lib, n]) => `<button class="filtre" data-action="filtre" data-id="${id}" aria-pressed="${ui.filtre === id}">${lib} <small>${n}</small></button>`).join('')}</div>
        <div class="rang-boutons"><label class="champ"><span class="sr-only">Fournisseur</span><select id="filtre-fournisseur"><option value="tous">Tous les fournisseurs</option>${S.E.fournisseurs.map((f) => `<option value="${f.id}" ${ui.fournisseur === f.id ? 'selected' : ''}>${esc(f.nom)}</option>`).join('')}</select></label>
        <label class="champ recherche"><span class="sr-only">Rechercher</span><input id="recherche" type="search" placeholder="N°, commande, BL, article" value="${esc(ui.q)}"></label></div>
      </div>
      ${liste.length ? `<ul class="lignes-abos">${liste.map(({ r, a }) => `<li class="ligne alerte-${a.statut === 'nonconforme' ? 'rouge' : a.statut === 'reserves' ? 'jaune' : a.statut === 'conforme' ? 'vert' : 'bleu'}">
        <button class="ligne-info" data-action="reception-ouvrir" data-id="${r.id}"><b>${esc(r.numero)} · ${esc(fournisseur(r.fournisseurId)?.nom || 'Fournisseur non renseigné')}</b>
          <span class="ligne-detail">${dateFr(r.date)}${r.heure ? ` à ${r.heure}` : ''} · ${esc(famille(r.familleId)?.nom || '')} · ${S.pluriel(r.lignes.length, 'ligne')}${r.commande ? ` · commande ${esc(r.commande)}` : ''}</span>
          <span class="ligne-etiquettes">${pastille(a.statut)}${a.decisionDiffere ? '<span class="etiquette sable">Décision motivée</span>' : ''}${a.anomalies.length ? `<span class="etiquette rose">${S.pluriel(a.anomalies.length, 'anomalie')}</span>` : ''}${a.reservesActives ? `<span class="etiquette jaune">${S.pluriel(a.reservesActives, 'réserve non levée', 'réserves non levées')}</span>` : ''}${r.cloturee ? '<span class="etiquette">Clôturée</span>' : ''}</span></button>
        <div class="ligne-droite"><span class="rang-boutons"><button class="btn petit" data-action="reception-pv" data-id="${r.id}">PV</button></span></div></li>`).join('')}</ul>`
        : `<div class="vide-etat">${S.FORME_VIDE}<div><h3>${S.E.receptions.length ? 'Aucune réception ne correspond' : 'Aucune réception'}</h3><p>${S.E.receptions.length ? 'Change le filtre ou la recherche.' : 'Crée une réception à l\'arrivée d\'une livraison : fournisseur, commande, lignes, puis contrôles.'}</p><div class="actions"><button class="btn primaire" data-action="reception-nouvelle">${S.ICONES.plus}Nouvelle réception</button></div></div></div>`}
      ${AVERTISSEMENT}`;
  }

  function vueControle() {
    const r = rec();
    if (!r) return videRec();
    const f = famille(r.familleId);
    const a = R.analyser(r, f);
    const lecture = r.cloturee;
    const dis = lecture ? 'disabled' : '';
    const LIB_ETAT = { 'a-compter': ['À compter', 'sable'], conforme: ['Conforme', 'vert'], tolere: ['Dans la tolérance', 'ciel'], manquant: ['Manquant', 'rouge'], excedent: ['Excédent', 'jaune'] };
    const lignes = a.lignes.map(({ l, e }) => `<tr>
      <td><button class="lien-ligne" data-action="ligne-ouvrir" data-id="${l.id}" ${dis}><b>${esc(l.designation || l.ref || 'Sans désignation')}</b><span>${esc([l.ref, l.lot && `lot ${l.lot}`].filter(Boolean).join(' · '))}</span></button></td>
      <td class="nb" data-libelle="Commandé">${nb(l.qteCommandee)} ${esc(l.unite)}</td>
      <td data-libelle="Reçu"><input class="saisie-qte" data-ligne="${l.id}" data-champ="qteRecue" inputmode="decimal" value="${O.saisieNombre(l.qteRecue)}" placeholder="?" aria-label="Quantité reçue : ${esc(l.designation)}" ${dis}></td>
      <td data-libelle="Refusé"><input class="saisie-qte" data-ligne="${l.id}" data-champ="qteRefusee" inputmode="decimal" value="${l.qteRefusee ? O.saisieNombre(l.qteRefusee) : ''}" placeholder="0" aria-label="Quantité refusée : ${esc(l.designation)}" ${dis}></td>
      <td data-libelle="État"><span class="etiquette ${LIB_ETAT[e.etat][1]}">${LIB_ETAT[e.etat][0]}</span>${e.ecart ? `<div class="mini">${e.ecart > 0 ? '+' : ''}${nb(e.ecart)}${e.pct !== null ? ` (${e.ecart > 0 ? '+' : ''}${O.fmtNombre(e.pct)} %)` : ''}</div>` : ''}</td></tr>`).join('');
    const points = a.points.map(({ p, r: res, saisie }) => `<li class="point ${res ? `res-${res}` : ''}">
      <div class="point-tete"><div><b>${esc(p.libelle)}</b><span class="ligne-etiquettes">${p.critique ? '<span class="etiquette rouge">Critique</span>' : ''}<span class="etiquette sable">${p.type === 'mesure' ? `Mesure${p.unite ? ` (${esc(p.unite)})` : ''}` : p.type === 'documentaire' ? 'Documentaire' : 'Visuel'}</span>${p.type === 'mesure' && (p.min !== null || p.max !== null) ? `<span class="etiquette ciel">Plage ${p.min ?? '…'} à ${p.max ?? '…'}</span>` : ''}</span>${p.aide ? `<small class="mini">${esc(p.aide)}</small>` : ''}</div>
        <div class="tri-etat" role="group" aria-label="Résultat">${p.type === 'mesure' ? `<input class="saisie-mesure" data-point="${p.id}" inputmode="decimal" value="${O.saisieNombre(saisie.valeur)}" placeholder="Valeur" aria-label="Mesure : ${esc(p.libelle)}" ${dis}>` : ''}
          ${[['ok', 'Conforme'], ['nok', 'Non conforme'], ['na', 'N/A']].filter(([v]) => p.type !== 'mesure' || v === 'na' || typeof saisie.valeur !== 'number').map(([v, lib]) => `<button data-action="point" data-point="${p.id}" data-res="${v}" aria-pressed="${res === v}" ${dis}>${lib}</button>`).join('')}
          ${p.type === 'mesure' && typeof saisie.valeur === 'number' ? `<span class="etiquette ${res === 'ok' ? 'vert' : res === 'nok' ? 'rouge' : 'sable'}">${res === 'ok' ? 'Dans la plage' : res === 'nok' ? 'Hors plage' : 'N/A'}</span>` : ''}</div></div>
      <input class="saisie-commentaire" data-point="${p.id}" maxlength="300" value="${esc(saisie.commentaire || '')}" placeholder="Commentaire (facultatif)" aria-label="Commentaire : ${esc(p.libelle)}" ${dis}></li>`).join('');
    const constats = r.constats.map((c) => `<li class="constat ${c.levee ? 'leve' : ''} grav-${c.gravite}">
      <div class="constat-corps"><span class="ligne-etiquettes"><span class="etiquette ${c.gravite === 'critique' ? 'rouge' : c.gravite === 'majeure' ? 'jaune' : 'sable'}">${nomGravite(c.gravite)}</span><span class="etiquette ciel">${nomType(c.type)}</span>${c.reserve ? '<span class="etiquette rose">Réserve</span>' : ''}${c.levee ? `<span class="etiquette vert">Levée le ${dateFr(c.levee.date)}</span>` : ''}</span>
        <p>${esc(c.description)}</p>${c.ligneId ? `<p class="mini">Ligne : ${esc(r.lignes.find((l) => l.id === c.ligneId)?.designation || '')}</p>` : ''}${c.levee?.commentaire ? `<p class="mini">Levée : ${esc(c.levee.commentaire)}</p>` : ''}
        ${c.photos.length ? `<div class="photos">${c.photos.map((ph) => `<figure><img src="${ph.data}" alt="${esc(ph.legende || 'Photo du constat')}" loading="lazy"><figcaption>${esc(ph.legende)}</figcaption></figure>`).join('')}</div>` : ''}</div>
      <div class="rang-boutons">${lecture ? '' : `<button class="btn petit" data-action="constat-ouvrir" data-id="${c.id}">Modifier</button>${c.levee ? `<button class="btn petit" data-action="constat-relever" data-id="${c.id}">Annuler la levée</button>` : `<button class="btn petit" data-action="constat-lever" data-id="${c.id}">Lever</button>`}`}</div></li>`).join('');
    const reste = R.pointsFamille(f).filter((p) => p.type !== 'mesure' && R.resultatPoint(p, r.controles[p.id]) === null).length;
    return `
      <p class="fil-app"><button data-action="vue" data-vue="receptions">Réceptions</button><span>›</span><b>${esc(r.numero)}</b></p>
      <div class="vue-tete"><div><h1>${esc(r.numero)}</h1><p>${esc(fournisseur(r.fournisseurId)?.nom || 'Fournisseur non renseigné')} · ${dateFr(r.date)}${r.heure ? ` à ${r.heure}` : ''} · ${esc(f?.nom || '')}${r.commande ? ` · commande ${esc(r.commande)}` : ''}${r.bl ? ` · BL ${esc(r.bl)}` : ''}</p></div>
        <div class="actions">${lecture ? '<button class="btn" data-action="rouvrir">Rouvrir</button>' : '<button class="btn" data-action="reception-modifier">En-tête</button>'}<button class="btn" data-action="vue" data-vue="pv">Procès-verbal</button></div></div>
      <div class="bloc-statut st-${a.statut}">
        <div><p class="surtitre">Statut ${a.decisionDiffere || r.decision ? 'décidé' : 'calculé'}</p><p class="statut-grand">${R.LIB_STATUT[a.statut]}</p>${a.decisionDiffere ? `<p class="mini">Calculé : ${R.LIB_STATUT[a.calcule].toLowerCase()}. Motif : ${esc(r.decision.motif)}</p>` : ''}</div>
        <div class="avancement"><span>${a.lignes.filter((x) => x.e.etat !== 'a-compter').length}/${r.lignes.length} lignes comptées</span><span>${a.repondus}/${a.nbPoints} points contrôlés</span><span>${S.pluriel(r.constats.length, 'constat')}</span></div>
      </div>
      ${lecture ? '<p class="aide">Réception clôturée : lecture seule. « Rouvrir » pour la modifier.</p>' : ''}
      <h2 class="titre-section">1. Quantités <span>Tolérance ${O.fmtNombre(a.tolerance)} %${r.tolerance !== null ? ' (propre à cette réception)' : ' (famille)'}</span></h2>
      ${r.lignes.length ? `<div class="defile"><table class="tableau compact table-qte"><thead><tr><th>Article</th><th class="nb">Commandé</th><th>Reçu</th><th>Refusé</th><th>État</th></tr></thead><tbody>${lignes}</tbody></table></div>` : '<div class="vide-etat petit"><div><h3>Aucune ligne</h3><p>Ajoute les articles du bon de commande ou du bon de livraison.</p></div></div>'}
      ${lecture ? '' : `<div class="rang-boutons" style="margin-top:10px"><button class="btn petit" data-action="ligne-nouvelle">${S.ICONES.plus}Ligne</button><button class="btn petit" data-action="lignes-coller">Coller une liste</button>${a.lignes.some((x) => x.e.etat === 'a-compter') ? '<button class="btn petit" data-action="tout-recu">Reçu = commandé pour les lignes à compter</button>' : ''}</div>`}
      <h2 class="titre-section">2. Points de contrôle <span>${S.pluriel(a.nbPoints, 'point')} de la famille « ${esc(f?.nom || '')} »</span></h2>
      <ul class="points">${points}</ul>
      ${!lecture && reste ? `<div class="rang-boutons" style="margin-top:10px"><button class="btn petit" data-action="points-ok">Les ${reste} points visuels et documentaires restants sont conformes</button></div>` : ''}
      <h2 class="titre-section">3. Constats et réserves</h2>
      ${constats ? `<ul class="constats">${constats}</ul>` : '<p class="aide">Aucun constat. Ajoutes-en un pour tout écart à décrire (casse, dates, documents), avec photos si utile.</p>'}
      ${lecture ? '' : `<div class="rang-boutons" style="margin-top:10px"><button class="btn petit" data-action="constat-nouveau">${S.ICONES.plus}Constat</button></div>`}
      <h2 class="titre-section">4. Synthèse et décision</h2>
      ${a.manque.length ? `<div class="aide">À terminer avant de décider : ${esc(a.manque.join(', '))}.</div>` : ''}
      ${a.anomalies.length ? `<ul class="anomalies">${a.anomalies.map((x) => `<li class="niv-${x.niveau}"><span class="etiquette ${x.niveau === 'nonconforme' ? 'rouge' : 'jaune'}">${x.niveau === 'nonconforme' ? 'Non-conformité' : 'Réserve'}</span><span>${esc(x.texte)}</span></li>`).join('')}</ul>` : a.manque.length ? '' : '<p class="aide">Aucune anomalie.</p>'}
      <label class="champ" style="margin-top:14px">Observations générales<textarea id="observations" rows="3" maxlength="1500" ${dis}>${esc(r.observations)}</textarea></label>
      ${lecture ? '' : `<div class="rang-boutons" style="margin-top:14px"><button class="btn primaire" data-action="decider" ${a.calcule === 'attente' ? 'disabled' : ''}>Décider et clôturer</button>${r.decision ? '<button class="btn" data-action="decision-effacer">Effacer la décision</button>' : ''}<button class="btn danger" data-action="reception-supprimer">Supprimer la réception</button></div>`}
      ${AVERTISSEMENT}`;
  }

  function vuePV() {
    const r = rec();
    if (!r) return videRec();
    const f = famille(r.familleId);
    const a = R.analyser(r, f);
    const fo = fournisseur(r.fournisseurId);
    const LIB = { ok: 'Conforme', nok: 'Non conforme', na: 'Sans objet' };
    return `
      <p class="fil-app pas-imprimer"><button data-action="vue" data-vue="receptions">Réceptions</button><span>›</span><button data-action="vue" data-vue="controle">${esc(r.numero)}</button><span>›</span><b>Procès-verbal</b></p>
      <div class="vue-tete pas-imprimer"><div><h1>Procès-verbal</h1><p>Document de réception à imprimer et à signer. ${a.calcule === 'attente' ? '<b class="texte-rouge">Réception incomplète : le procès-verbal le mentionne.</b>' : ''}</p></div>
        <div class="actions"><button class="btn" data-action="vue" data-vue="controle">Retour au contrôle</button><button class="btn primaire" data-action="imprimer">Imprimer</button></div></div>
      <article class="document pv">
        <div class="entete-doc"><div><p class="surtitre">Procès-verbal de réception</p><h2>${esc(r.numero)}</h2><p class="mini">${esc(S.E.reglages.societe || '')}</p></div>
          <dl><dt>Date</dt><dd>${dateFr(r.date)}${r.heure ? ` à ${r.heure}` : ''}</dd><dt>Fournisseur</dt><dd>${esc(fo?.nom || '–')}</dd><dt>Commande</dt><dd>${esc(r.commande || '–')}</dd><dt>Bon de livraison</dt><dd>${esc(r.bl || '–')}</dd><dt>Transporteur</dt><dd>${esc(r.transporteur || '–')}</dd><dt>Famille</dt><dd>${esc(f?.nom || '')}</dd></dl></div>
        <p class="statut-pv st-${a.statut}">${R.LIB_STATUT[a.statut]}${a.decisionDiffere ? ` <small>(statut calculé : ${R.LIB_STATUT[a.calcule].toLowerCase()} · motif : ${esc(r.decision.motif)})</small>` : ''}</p>
        <h3>Quantités (tolérance ${O.fmtNombre(a.tolerance)} %)</h3>
        <div class="defile"><table class="tableau compact"><thead><tr><th>Article</th><th class="nb">Commandé</th><th class="nb">Reçu</th><th class="nb">Refusé</th><th class="nb">Accepté</th><th class="nb">Écart</th></tr></thead><tbody>${a.lignes.map(({ l, e }) => `<tr><td>${esc(l.designation || l.ref)}${l.ref && l.designation ? ` <span class="mini">${esc(l.ref)}</span>` : ''}</td><td class="nb">${nb(l.qteCommandee)} ${esc(l.unite)}</td><td class="nb">${nb(l.qteRecue)}</td><td class="nb">${nb(l.qteRefusee)}</td><td class="nb">${nb(e.accepte)}</td><td class="nb ${e.horsTolerance ? 'ecart-plus' : ''}">${e.ecart === null ? 'à compter' : `${e.ecart > 0 ? '+' : ''}${nb(e.ecart)}`}</td></tr>`).join('') || '<tr><td colspan="6">Aucune ligne</td></tr>'}</tbody></table></div>
        <h3>Points de contrôle</h3>
        <div class="defile"><table class="tableau compact"><thead><tr><th>Point</th><th>Résultat</th><th>Observation</th></tr></thead><tbody>${a.points.map(({ p, r: res, saisie }) => `<tr><td>${esc(p.libelle)}${p.critique ? ' <b>(critique)</b>' : ''}</td><td>${res ? LIB[res] : 'Non contrôlé'}${p.type === 'mesure' && typeof saisie.valeur === 'number' ? ` · ${O.fmtNombre(saisie.valeur)} ${esc(p.unite)}` : ''}</td><td>${esc(saisie.commentaire || '')}</td></tr>`).join('')}</tbody></table></div>
        <h3>Constats et réserves</h3>
        ${r.constats.length ? `<ol class="puces">${r.constats.map((c) => `<li><b>${nomGravite(c.gravite)}, ${nomType(c.type).toLowerCase()}${c.reserve ? ', réserve' : ''}</b> : ${esc(c.description)}${c.levee ? ` <i>(levée le ${dateFr(c.levee.date)}${c.levee.commentaire ? ` : ${esc(c.levee.commentaire)}` : ''})</i>` : ''}${c.photos.length ? `<div class="photos petites">${c.photos.map((ph) => `<img src="${ph.data}" alt="${esc(ph.legende || 'Photo')}">`).join('')}</div>` : ''}</li>`).join('')}</ol>` : '<p class="mini">Aucun constat.</p>'}
        ${r.observations ? `<h3>Observations</h3><p>${esc(r.observations)}</p>` : ''}
        ${a.manque.length ? `<p class="texte-rouge"><b>Réception incomplète :</b> ${esc(a.manque.join(', '))}.</p>` : ''}
        <div class="signatures"><div>Réceptionnaire : ${esc(r.receptionnaire || S.E.reglages.receptionnaire || '')}<br>Date et signature</div><div>Transporteur ou fournisseur<br>Date et signature</div></div>
        <p class="mention" style="margin-top:14px">Procès-verbal établi avec ContrôleRéception (QME) à partir de contrôles génériques ; il ne vaut pas certification.</p>
      </article>`;
  }

  function vueSynthese() {
    const st = R.statistiques(S.E);
    const fin = st.total - st.attente;
    return `
      <div class="vue-tete"><div><h1>Synthèse</h1><p>Taux de conformité par fournisseur, réserves à suivre et répartition des anomalies.</p></div></div>
      <div class="tuiles">
        <div class="tuile" style="--c:var(--vert)"><p class="surtitre">Conformes</p><b>${fin ? O.fmtNombre(O.arrondi((st.conforme / fin) * 100, 1)) : 0} %</b><span>${st.conforme} sur ${S.pluriel(fin, 'réception terminée', 'réceptions terminées')}</span></div>
        <div class="tuile rond" style="--c:var(--jaune)"><p class="surtitre">Avec réserves</p><b>${st.reserves}</b><span>réceptions</span></div>
        <div class="tuile" style="--c:var(--rouge)"><p class="surtitre">Non conformes</p><b>${st.nonconforme}</b><span>réceptions</span></div>
        <div class="tuile rond" style="--c:var(--bleu)"><p class="surtitre">En attente</p><b>${st.attente}</b><span>à terminer</span></div>
      </div>
      <h2 class="titre-section">Par fournisseur <span>Réceptions terminées seulement</span></h2>
      ${st.parFournisseur.length ? `<div class="defile"><table class="tableau compact"><thead><tr><th>Fournisseur</th><th class="nb">Réceptions</th><th class="nb">Conformes</th><th class="nb">Réserves</th><th class="nb">Non conformes</th><th class="nb">Taux de conformité</th><th class="nb">Constats</th></tr></thead><tbody>${st.parFournisseur.map((x) => `<tr><td>${esc(x.nom)}</td><td class="nb">${x.total}</td><td class="nb">${x.conforme}</td><td class="nb">${x.reserves}</td><td class="nb">${x.nonconforme}</td><td class="nb"><b>${x.taux === null ? '–' : `${O.fmtNombre(x.taux)} %`}</b></td><td class="nb">${x.constats}</td></tr>`).join('')}</tbody></table></div>` : '<p class="aide">Pas encore de réception terminée.</p>'}
      <h2 class="titre-section">Réserves et constats à suivre <span>${st.reservesNonLevees.length}</span></h2>
      ${st.reservesNonLevees.length ? `<ul class="lignes-abos">${st.reservesNonLevees.map(({ reception: r, constat: c }) => `<li class="ligne alerte-${c.gravite === 'critique' ? 'rouge' : 'jaune'}"><button class="ligne-info" data-action="reception-ouvrir" data-id="${r.id}"><b>${esc(r.numero)} · ${esc(fournisseur(r.fournisseurId)?.nom || '')}</b><span class="ligne-detail">${dateFr(r.date)} · ${esc(c.description)}</span><span class="ligne-etiquettes"><span class="etiquette ${c.gravite === 'critique' ? 'rouge' : 'jaune'}">${nomGravite(c.gravite)}</span>${c.reserve ? '<span class="etiquette rose">Réserve</span>' : ''}</span></button></li>`).join('')}</ul>` : '<p class="aide">Rien à suivre : toutes les réserves sont levées.</p>'}
      <h2 class="titre-section">Anomalies par type</h2>
      ${(() => { const t = {}; st.analyses.forEach(({ a }) => a.anomalies.forEach((x) => { t[x.type] = (t[x.type] || 0) + 1; })); const l = Object.entries(t).sort((x, y) => y[1] - x[1]); const max = Math.max(1, ...l.map((x) => x[1])); return l.length ? `<figure class="graphique"><div class="barres-cats">${l.map(([k, n]) => `<div class="barre-cat"><span class="bc-nom">${esc(nomType(k))}</span><span class="bc-piste"><span class="bc-barre" style="width:${(n / max) * 100}%"></span></span><span class="bc-val"><b>${n}</b></span></div>`).join('')}</div></figure>` : '<p class="aide">Aucune anomalie enregistrée.</p>'; })()}
      ${AVERTISSEMENT}`;
  }

  function vueReferentiel() {
    const sous = `<div class="onglets-internes" role="group" aria-label="Référentiel">${[['familles', 'Familles et contrôles'], ['fournisseurs', 'Fournisseurs']].map(([id, l]) => `<button data-action="ref" data-id="${id}" aria-pressed="${ui.ref === id}">${l}</button>`).join('')}</div>`;
    const corps = ui.ref === 'familles'
      ? `<div class="grille-cartes">${S.E.familles.map((f) => `<button class="carte-el" data-action="famille-ouvrir" data-id="${f.id}"><b>${esc(f.nom)}</b><span class="detail">${S.pluriel(R.pointsFamille(f).length, 'point')} dont ${R.pointsFamille(f).filter((p) => p.critique).length} critique${R.pointsFamille(f).filter((p) => p.critique).length > 1 ? 's' : ''} · tolérance ${O.fmtNombre(f.tolerance)} %</span>${f.perso ? '<span class="etiquettes"><span class="etiquette jaune">Modifiée</span></span>' : ''}</button>`).join('')}</div>
         <div class="rang-boutons" style="margin-top:12px"><button class="btn" data-action="famille-nouvelle">${S.ICONES.plus}Nouvelle famille</button></div>
         <p class="aide" style="margin-top:16px">Les 3 points communs (bon de livraison, emballages, étiquetage) s'ajoutent à chaque famille.</p>`
      : `${S.E.fournisseurs.length ? `<ul class="lignes-abos">${S.E.fournisseurs.map((f) => { const n = S.E.receptions.filter((r) => r.fournisseurId === f.id).length; return `<li class="ligne"><button class="ligne-info" data-action="fournisseur-ouvrir" data-id="${f.id}"><b>${esc(f.nom)}</b><span class="ligne-detail">${esc(f.contact || 'Sans contact')} · ${S.pluriel(n, 'réception')}</span></button></li>`; }).join('')}</ul>` : '<p class="aide">Aucun fournisseur.</p>'}
         <div class="rang-boutons" style="margin-top:12px"><button class="btn" data-action="fournisseur-nouveau">${S.ICONES.plus}Nouveau fournisseur</button></div>`;
    return `<div class="vue-tete"><div><h1>Référentiel</h1><p>Points de contrôle par famille de produits, tolérances de quantité et fournisseurs. Tout est modifiable.</p></div></div>${sous}${corps}${AVERTISSEMENT}`;
  }

  // ---------- Modales ----------
  function modaleReception(id) {
    const r = id ? S.E.receptions.find((x) => x.id === id) : null;
    const t = S.auj();
    const v = r || { date: t, heure: new Date().toTimeString().slice(0, 5), fournisseurId: S.E.fournisseurs[0]?.id || '', familleId: 'generique', commande: '', bl: '', transporteur: '', receptionnaire: S.E.reglages.receptionnaire, tolerance: null };
    S.ouvrirModale(r ? 'En-tête de la réception' : 'Nouvelle réception', `
      <div class="rang-champs"><label class="champ">Date<input type="date" name="date" value="${v.date}" required></label><label class="champ">Heure<input type="time" name="heure" value="${v.heure}"></label></div>
      <label class="champ">Fournisseur<select name="fournisseurId"><option value="">— Choisir —</option>${S.E.fournisseurs.map((f) => `<option value="${f.id}" ${f.id === v.fournisseurId ? 'selected' : ''}>${esc(f.nom)}</option>`).join('')}<option value="__nouveau">+ Nouveau fournisseur…</option></select></label>
      <label class="champ" id="champ-nouveau-f" hidden>Nom du nouveau fournisseur<input name="nouveauFournisseur" maxlength="100"></label>
      <label class="champ">Famille de produits <small>Détermine les points de contrôle et la tolérance.</small><select name="familleId">${S.E.familles.map((f) => `<option value="${f.id}" ${f.id === v.familleId ? 'selected' : ''}>${esc(f.nom)} (tolérance ${O.fmtNombre(f.tolerance)} %)</option>`).join('')}</select></label>
      <div class="rang-champs"><label class="champ">N° de commande<input name="commande" maxlength="60" value="${esc(v.commande)}"></label><label class="champ">N° du bon de livraison<input name="bl" maxlength="60" value="${esc(v.bl)}"></label></div>
      <div class="rang-champs"><label class="champ">Transporteur<input name="transporteur" maxlength="80" value="${esc(v.transporteur)}"></label><label class="champ">Réceptionnaire<input name="receptionnaire" maxlength="80" value="${esc(v.receptionnaire)}"></label></div>
      <label class="champ">Tolérance de quantité propre à cette réception (%) <small>Vide : celle de la famille.</small><input name="tolerance" inputmode="decimal" value="${O.saisieNombre(v.tolerance)}"></label>
      <p class="erreur" role="alert"></p>`,
    `<button class="btn primaire" value="ok">${r ? 'Enregistrer' : 'Créer et contrôler'}</button><button class="btn" value="annuler">Annuler</button>`, (f) => {
      if (!O.estDate(f.get('date'))) return 'Indique la date de livraison.';
      let fid = f.get('fournisseurId');
      const nouveau = O.texte(f.get('nouveauFournisseur'), 100);
      if (fid === '__nouveau' && !nouveau) return 'Donne le nom du nouveau fournisseur.';
      if (!fid) return 'Choisis le fournisseur.';
      const tb = String(f.get('tolerance') || '').trim();
      const tol = tb ? O.lireNombre(tb) : null;
      if (tb && (tol === null || tol > 100)) return 'Tolérance : pourcentage entre 0 et 100.';
      S.retenir();
      if (fid === '__nouveau') { fid = uid(); S.E.fournisseurs.push({ id: fid, nom: nouveau, contact: '', note: '' }); }
      const champs = { date: f.get('date'), heure: f.get('heure') || '', fournisseurId: fid, familleId: f.get('familleId'), commande: O.texte(f.get('commande'), 60), bl: O.texte(f.get('bl'), 60), transporteur: O.texte(f.get('transporteur'), 80), receptionnaire: O.texte(f.get('receptionnaire'), 80), tolerance: tol };
      if (r) Object.assign(r, champs);
      else {
        const n = R.normaliserReception({ id: uid(), numero: R.prochainNumero(S.E.receptions, Number(champs.date.slice(0, 4))), ...champs, lignes: [], controles: {}, constats: [] }, S.E.familles);
        S.E.receptions.push(n); S.E.receptionActive = n.id;
      }
      S.sauver();
      if (r) { S.rendre(); S.toast('En-tête enregistré.'); } else { S.changerVue('controle'); S.toast('Réception créée : ajoute les lignes de la livraison.'); }
      return undefined;
    });
    const d = S.modale();
    d.querySelector('[name=fournisseurId]').addEventListener('change', (e) => { d.querySelector('#champ-nouveau-f').hidden = e.target.value !== '__nouveau'; if (e.target.value === '__nouveau') d.querySelector('[name=nouveauFournisseur]').focus(); });
  }

  function modaleLigne(id) {
    const r = rec();
    const l = id ? r.lignes.find((x) => x.id === id) : null;
    const v = l || { ref: '', designation: '', unite: 'u', qteCommandee: null, qteRecue: null, qteRefusee: 0, lot: '' };
    S.ouvrirModale(l ? 'Ligne de livraison' : 'Nouvelle ligne', `
      <div class="rang-champs"><label class="champ">Référence<input name="ref" maxlength="60" value="${esc(v.ref)}"></label><label class="champ">N° de lot<input name="lot" maxlength="60" value="${esc(v.lot)}"></label></div>
      <label class="champ">Désignation<input name="designation" maxlength="160" value="${esc(v.designation)}"></label>
      <div class="rang-champs"><label class="champ">Unité<input name="unite" maxlength="20" list="unites" value="${esc(v.unite)}"></label><label class="champ">Quantité commandée<input name="qteCommandee" inputmode="decimal" value="${O.saisieNombre(v.qteCommandee)}"></label><label class="champ">Quantité reçue<small>Vide si pas encore comptée.</small><input name="qteRecue" inputmode="decimal" value="${O.saisieNombre(v.qteRecue)}"></label></div>
      <datalist id="unites">${B.unites.map((u) => `<option value="${esc(u)}">`).join('')}</datalist>
      <p class="erreur" role="alert"></p>`,
    l ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>' : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="ok-suivant">Ajouter et nouvelle</button><button class="btn" value="annuler">Annuler</button>', (f, action) => {
      if (action === 'supprimer') { S.retenir(); r.lignes = r.lignes.filter((x) => x.id !== l.id); r.constats.forEach((c) => { if (c.ligneId === l.id) c.ligneId = null; }); S.sauver(); S.rendre(); S.toast('Ligne supprimée.', { libelle: 'Annuler', faire: S.annuler }); return undefined; }
      const designation = O.texte(f.get('designation'), 160), ref = O.texte(f.get('ref'), 60);
      if (!designation && !ref) return 'Indique une référence ou une désignation.';
      const cmd = O.lireNombre(f.get('qteCommandee'));
      if (cmd === null) return 'Quantité commandée : nombre positif ou nul.';
      const brut = String(f.get('qteRecue') || '').trim();
      const recue = brut ? O.lireNombre(brut) : null;
      if (brut && recue === null) return 'Quantité reçue : nombre positif ou nul.';
      S.retenir();
      const champs = { ref, designation, lot: O.texte(f.get('lot'), 60), unite: O.texte(f.get('unite'), 20) || 'u', qteCommandee: cmd, qteRecue: recue };
      if (l) { Object.assign(l, champs); if (recue === null || l.qteRefusee > recue) l.qteRefusee = recue === null ? 0 : Math.min(l.qteRefusee, recue); } else r.lignes.push({ id: uid(), qteRefusee: 0, ...champs });
      S.sauver(); S.rendre();
      if (action === 'ok-suivant') { S.garderModale(); setTimeout(() => modaleLigne(null), 0); }
      return undefined;
    });
  }

  function modaleColler() {
    S.ouvrirModale('Coller une liste de lignes', `
      <p class="aide">Une ligne par article, colonnes séparées par un point-virgule ou une tabulation (copie depuis un tableur) : <b>référence ; désignation ; quantité commandée ; unité</b>. L'unité est facultative.</p>
      <label class="champ"><span class="sr-only">Lignes</span><textarea name="liste" rows="8" placeholder="YA-01;Yaourts nature;20;carton"></textarea></label>
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const lignes = String(f.get('liste') || '').split('\n').map((x) => x.trim()).filter(Boolean);
      if (!lignes.length) return 'Colle au moins une ligne.';
      const res = [];
      for (const [i, x] of lignes.entries()) {
        const c = x.split(/\t|;/).map((y) => y.trim());
        const q = O.lireNombre(c[2]);
        if (c.length < 3 || q === null) return `Ligne ${i + 1} illisible : « ${x.slice(0, 40)} ». Format : référence ; désignation ; quantité ; unité.`;
        res.push({ id: uid(), ref: O.texte(c[0], 60), designation: O.texte(c[1], 160), qteCommandee: q, unite: O.texte(c[3], 20) || 'u', qteRecue: null, qteRefusee: 0, lot: '' });
      }
      S.retenir();
      rec().lignes.push(...res);
      S.sauver(); S.rendre(); S.toast(`${S.pluriel(res.length, 'ligne ajoutée', 'lignes ajoutées')}.`, { libelle: 'Annuler', faire: S.annuler });
      return undefined;
    });
  }

  function modaleConstat(id) {
    const r = rec();
    const c = id ? r.constats.find((x) => x.id === id) : null;
    let photos = structuredClone(c?.photos || []);
    const v = c || { type: 'qualitatif', gravite: 'mineure', description: '', ligneId: null, reserve: true };
    const vignettes = () => photos.map((ph) => `<figure><img src="${ph.data}" alt=""><button type="button" class="btn-icone" data-action="photo-retirer" data-id="${ph.id}" aria-label="Retirer la photo">×</button></figure>`).join('');
    const d = S.ouvrirModale(c ? 'Constat' : 'Nouveau constat', `
      <div class="rang-champs"><label class="champ">Type<select name="type">${B.typesConstat.map((t) => `<option value="${t.id}" ${t.id === v.type ? 'selected' : ''}>${esc(t.nom)}</option>`).join('')}</select></label>
        <label class="champ">Gravité<select name="gravite">${B.gravites.map((g) => `<option value="${g.id}" ${g.id === v.gravite ? 'selected' : ''}>${esc(g.nom)} : ${esc(g.aide)}</option>`).join('')}</select></label></div>
      <label class="champ">Description <small>Quoi, combien, où : « 2 cartons écrasés sur 12 ».</small><textarea name="description" rows="3" maxlength="600">${esc(v.description)}</textarea></label>
      <label class="champ">Ligne concernée <small>Facultatif.</small><select name="ligneId"><option value="">Toute la livraison</option>${r.lignes.map((l) => `<option value="${l.id}" ${l.id === v.ligneId ? 'selected' : ''}>${esc(l.designation || l.ref)}</option>`).join('')}</select></label>
      <label class="case"><input type="checkbox" name="reserve" ${v.reserve ? 'checked' : ''}> Réserve notée sur le bon du transporteur</label>
      <fieldset class="champ cadre-champs"><legend>Photos <small>6 au plus, réduites à environ 640 px pour tenir dans le stockage en ligne.</small></legend>
        <div class="photos edition" id="vignettes">${vignettes()}</div>
        <label class="btn petit" style="cursor:pointer;align-self:flex-start">${S.ICONES.plus}Ajouter des photos<input type="file" accept="image/*" capture="environment" multiple id="photos-constat" hidden></label></fieldset>
      <p class="erreur" role="alert"></p>`,
    c ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>' : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>', (f, action) => {
      if (action === 'supprimer') { S.retenir(); r.constats = r.constats.filter((x) => x.id !== c.id); S.sauver(); S.rendre(); S.toast('Constat supprimé.', { libelle: 'Annuler', faire: S.annuler }); return undefined; }
      const description = O.texte(f.get('description'), 600);
      if (!description) return 'Décris le constat.';
      const nouveau = { id: c?.id || uid(), type: f.get('type'), gravite: f.get('gravite'), description, ligneId: f.get('ligneId') || null, reserve: !!f.get('reserve'), photos, levee: c?.levee || null };
      const essai = structuredClone(S.E);
      const er = essai.receptions.find((x) => x.id === r.id);
      if (c) Object.assign(er.constats.find((x) => x.id === c.id), nouveau); else er.constats.push(nouveau);
      if (!S.tailleOk(essai)) return 'Stockage plein (880 Ko) : retire des photos ici ou dans d\'anciens constats.';
      S.retenir();
      if (c) Object.assign(c, nouveau); else r.constats.push(nouveau);
      S.sauver(); S.rendre(); S.toast(c ? 'Constat enregistré.' : 'Constat ajouté.', { libelle: 'Annuler', faire: S.annuler });
      return undefined;
    });
    d.querySelector('#photos-constat').addEventListener('change', async (e) => {
      const err = d.querySelector('.erreur');
      for (const fi of [...e.target.files]) {
        if (photos.length >= 6) { err.textContent = '6 photos au plus par constat.'; break; }
        try { photos.push({ id: uid(), data: await compresser(fi), legende: '' }); } catch (x) { err.textContent = x.message; }
      }
      e.target.value = '';
      d.querySelector('#vignettes').innerHTML = vignettes();
    });
    d.querySelector('#vignettes').addEventListener('click', (e) => {
      const b = e.target.closest('[data-action="photo-retirer"]');
      if (!b) return;
      e.stopPropagation();
      photos = photos.filter((p) => p.id !== b.dataset.id);
      d.querySelector('#vignettes').innerHTML = vignettes();
    });
  }

  function modaleLever(id) {
    const c = rec().constats.find((x) => x.id === id);
    S.ouvrirModale('Lever le constat', `<p>${esc(c.description)}</p>
      <label class="champ">Date de levée<input type="date" name="date" value="${S.auj()}"></label>
      <label class="champ">Comment a-t-il été levé ? <small>Avoir, remplacement, livraison du manquant…</small><input name="commentaire" maxlength="300"></label><p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Lever</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      if (!O.estDate(f.get('date'))) return 'Indique la date.';
      S.retenir();
      c.levee = { date: f.get('date'), commentaire: O.texte(f.get('commentaire'), 300) };
      S.sauver(); S.rendre(); S.toast('Constat levé.', { libelle: 'Annuler', faire: S.annuler });
      return undefined;
    });
  }

  function modaleDecision() {
    const r = rec();
    const a = R.analyser(r, famille(r.familleId));
    S.ouvrirModale('Décision et clôture', `
      <p>Statut calculé : ${pastille(a.calcule)}</p>
      ${a.anomalies.length ? `<ul class="puces">${a.anomalies.map((x) => `<li>${esc(x.texte)}</li>`).join('')}</ul>` : ''}
      <fieldset class="champ"><legend>Décision</legend><div class="choix-statut">${['conforme', 'reserves', 'nonconforme'].map((s) => `<label><input type="radio" name="statut" value="${s}" ${(r.decision?.statut || a.calcule) === s ? 'checked' : ''}><span>${R.LIB_STATUT[s]}</span></label>`).join('')}</div></fieldset>
      <label class="champ">Motif <small>Obligatoire si la décision diffère du statut calculé.</small><textarea name="motif" rows="2" maxlength="400">${esc(r.decision?.motif || '')}</textarea></label>
      <label class="champ">Décidé par<input name="par" maxlength="80" value="${esc(r.decision?.par || r.receptionnaire || S.E.reglages.receptionnaire)}"></label>
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Décider et clôturer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const err = R.validerDecision(f.get('statut'), a.calcule, f.get('motif'));
      if (err) return err;
      S.retenir();
      r.decision = { statut: f.get('statut'), motif: O.texte(f.get('motif'), 400), par: O.texte(f.get('par'), 80), le: S.auj() };
      r.cloturee = true;
      S.sauver(); S.rendre(); S.toast(`Réception ${r.numero} clôturée : ${R.LIB_STATUT[r.decision.statut].toLowerCase()}.`, { libelle: 'Annuler', faire: S.annuler });
      return undefined;
    });
  }

  function modaleFamille(id) {
    const fa = id ? famille(id) : null;
    let pts = structuredClone(fa?.controles || []);
    const corps = () => `
      <div class="rang-champs"><label class="champ">Nom<input name="nom" maxlength="80" value="${esc(fa?.nom || '')}"></label><label class="champ">Tolérance de quantité (%)<input name="tolerance" inputmode="decimal" value="${O.saisieNombre(fa?.tolerance ?? 0)}"></label></div>
      <p class="aide">Points communs ajoutés d'office : ${B.communs.map((c) => esc(c.libelle.toLowerCase())).join(' ; ')}.</p>
      <div id="points-famille">${pts.map((p, i) => `<div class="rang-point" data-pt="${i}">
        <label class="champ">Point de contrôle<input name="pl-${i}" maxlength="160" value="${esc(p.libelle)}"></label>
        <label class="champ">Type<select name="pt-${i}" data-maj="1">${[['visuel', 'Visuel'], ['documentaire', 'Documentaire'], ['mesure', 'Mesure']].map(([v, l]) => `<option value="${v}" ${p.type === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        ${p.type === 'mesure' ? `<label class="champ">Unité<input name="pu-${i}" maxlength="12" value="${esc(p.unite)}"></label><label class="champ">Min<input name="pmin-${i}" inputmode="decimal" value="${O.saisieNombre(p.min)}"></label><label class="champ">Max<input name="pmax-${i}" inputmode="decimal" value="${O.saisieNombre(p.max)}"></label>` : ''}
        <label class="case"><input type="checkbox" name="pc-${i}" ${p.critique ? 'checked' : ''}> Critique</label>
        <button class="btn-icone" type="button" data-action="pt-retirer" data-id="${i}" aria-label="Retirer le point">×</button></div>`).join('')}</div>
      <button class="btn petit" type="button" data-action="pt-ajouter">${S.ICONES.plus}Ajouter un point</button>
      <p class="erreur" role="alert"></p>`;
    const lire = (form) => {
      const f = new FormData(form);
      return [...form.querySelectorAll('[data-pt]')].map((el) => {
        const i = el.dataset.pt;
        const type = f.get(`pt-${i}`);
        const lireN = (n) => { const s = String(f.get(n) || '').trim(); return s ? O.lireNombre(s, { negatif: true }) : null; };
        return { ...pts[i], libelle: O.texte(f.get(`pl-${i}`), 160), type, critique: !!f.get(`pc-${i}`), unite: type === 'mesure' ? O.texte(f.get(`pu-${i}`), 12) : '', min: type === 'mesure' ? lireN(`pmin-${i}`) : null, max: type === 'mesure' ? lireN(`pmax-${i}`) : null };
      });
    };
    const d = S.ouvrirModale(fa ? 'Famille de produits' : 'Nouvelle famille', corps(), `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${fa && B.familles.some((x) => x.id === fa.id) ? '<button class="btn" value="reinit">Valeurs d\'origine</button>' : ''}${fa ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`, (f, action) => {
      if (action === 'supprimer') {
        const n = S.E.receptions.filter((r) => r.familleId === fa.id).length;
        if (n) return `Impossible : ${S.pluriel(n, 'réception utilise', 'réceptions utilisent')} cette famille.`;
        S.retenir(); S.E.familles = S.E.familles.filter((x) => x.id !== fa.id); S.sauver(); S.rendre(); return undefined;
      }
      if (action === 'reinit') { S.retenir(); Object.assign(fa, R.normaliserFamille(structuredClone(B.familles.find((x) => x.id === fa.id))), { perso: false }); S.sauver(); S.rendre(); S.toast('Valeurs d\'origine rétablies.', { libelle: 'Annuler', faire: S.annuler }); return undefined; }
      const nom = O.texte(f.get('nom'), 80);
      if (!nom) return 'Donne un nom à la famille.';
      const tol = O.lireNombre(f.get('tolerance'));
      if (tol === null || tol > 100) return 'Tolérance : pourcentage entre 0 et 100.';
      const lus = lire(d.querySelector('form'));
      for (const p of lus) {
        if (!p.libelle) return 'Chaque point doit avoir un libellé.';
        if (p.min !== null && p.max !== null && p.max < p.min) return `« ${p.libelle} » : le maximum est inférieur au minimum.`;
      }
      S.retenir();
      const propre = R.normaliserFamille({ id: fa?.id || uid(), nom, tolerance: tol, controles: lus.map((p) => ({ ...p, id: p.id || uid() })), perso: true });
      if (fa) Object.assign(fa, propre); else S.E.familles.push(propre);
      S.sauver(); S.rendre(); S.toast('Famille enregistrée.', { libelle: 'Annuler', faire: S.annuler });
      return undefined;
    }, { large: true });
    const form = d.querySelector('form');
    form.addEventListener('click', (e) => {
      const b = e.target.closest('[data-action="pt-ajouter"],[data-action="pt-retirer"]');
      if (!b) return;
      e.stopPropagation();
      pts = lire(form);
      if (b.dataset.action === 'pt-ajouter') pts.push({ id: uid(), libelle: '', type: 'visuel', critique: false, unite: '', min: null, max: null, aide: '' });
      else pts.splice(Number(b.dataset.id), 1);
      d.querySelector('.modale-corps').innerHTML = corps();
    });
    form.addEventListener('change', (e) => { if (e.target.dataset.maj) { pts = lire(form); d.querySelector('.modale-corps').innerHTML = corps(); } });
  }

  function modaleFournisseur(id) {
    const fo = id ? fournisseur(id) : null;
    S.ouvrirModale(fo ? 'Fournisseur' : 'Nouveau fournisseur', `
      <label class="champ">Nom<input name="nom" maxlength="100" value="${esc(fo?.nom || '')}"></label>
      <label class="champ">Contact <small>Service, téléphone ou e-mail professionnel.</small><input name="contact" maxlength="160" value="${esc(fo?.contact || '')}"></label>
      <label class="champ">Note<input name="note" maxlength="300" value="${esc(fo?.note || '')}"></label><p class="erreur" role="alert"></p>`,
    `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${fo ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`, (f, action) => {
      if (action === 'supprimer') {
        const n = S.E.receptions.filter((r) => r.fournisseurId === fo.id).length;
        if (n) return `Impossible : ${S.pluriel(n, 'réception est liée', 'réceptions sont liées')} à ce fournisseur.`;
        S.retenir(); S.E.fournisseurs = S.E.fournisseurs.filter((x) => x.id !== fo.id); S.sauver(); S.rendre(); return undefined;
      }
      const nom = O.texte(f.get('nom'), 100);
      if (!nom) return 'Donne un nom.';
      S.retenir();
      const champs = { nom, contact: O.texte(f.get('contact'), 160), note: O.texte(f.get('note'), 300) };
      if (fo) Object.assign(fo, champs); else S.E.fournisseurs.push({ id: uid(), ...champs });
      S.sauver(); S.rendre(); S.toast('Fournisseur enregistré.');
      return undefined;
    });
  }

  // ---------- Saisies directes dans la vue Contrôle ----------
  function brancherSaisies() {
    const r = rec();
    if (!r) return;
    document.querySelectorAll('.saisie-qte').forEach((el) => el.addEventListener('change', () => {
      const l = r.lignes.find((x) => x.id === el.dataset.ligne);
      const brut = el.value.trim();
      const v = brut ? O.lireNombre(brut) : null;
      if (brut && v === null) { S.toast('Quantité illisible : nombre positif, par exemple 12 ou 2,5.'); el.focus(); return; }
      S.retenir();
      if (el.dataset.champ === 'qteRecue') { l.qteRecue = v; if (v === null) l.qteRefusee = 0; else l.qteRefusee = Math.min(l.qteRefusee, v); }
      else {
        if (l.qteRecue === null && v) { S.toast('Saisis d\'abord la quantité reçue.'); S.rendre(); return; }
        if (v > l.qteRecue) { S.toast('La quantité refusée ne peut pas dépasser la quantité reçue.'); S.rendre(); return; }
        l.qteRefusee = v || 0;
      }
      S.sauver(); S.rendre();
    }));
    document.querySelectorAll('.saisie-mesure').forEach((el) => el.addEventListener('change', () => {
      const brut = el.value.trim();
      const v = brut ? O.lireNombre(brut, { negatif: true }) : null;
      if (brut && v === null) { S.toast('Mesure illisible : nombre, par exemple -18 ou 3,5.'); return; }
      S.retenir();
      const c = r.controles[el.dataset.point] || (r.controles[el.dataset.point] = { resultat: null, valeur: null, commentaire: '' });
      c.valeur = v;
      if (c.resultat !== 'na') c.resultat = null;
      S.sauver(); S.rendre();
    }));
    document.querySelectorAll('.saisie-commentaire').forEach((el) => el.addEventListener('change', () => {
      const c = r.controles[el.dataset.point] || (r.controles[el.dataset.point] = { resultat: null, valeur: null, commentaire: '' });
      c.commentaire = O.texte(el.value, 300);
      S.sauver();
    }));
    S.$('#observations')?.addEventListener('change', (e) => { r.observations = O.texte(e.target.value, 1500); S.sauver(); });
  }

  // ---------- Actions ----------
  const actions = {
    'reception-nouvelle': () => modaleReception(null),
    'reception-modifier': () => modaleReception(rec().id),
    'reception-ouvrir': (el) => { S.E.receptionActive = el.dataset.id; S.sauver(); S.changerVue('controle'); },
    'reception-pv': (el) => { S.E.receptionActive = el.dataset.id; S.sauver(); S.changerVue('pv'); },
    'reception-supprimer': () => {
      const r = rec();
      if (!S.confirmer(`Supprimer la réception ${r.numero} et ses constats ?`)) return;
      S.retenir(); S.E.receptions = S.E.receptions.filter((x) => x.id !== r.id); S.E.receptionActive = S.E.receptions.at(-1)?.id ?? null;
      S.sauver(); S.changerVue('receptions'); S.toast(`Réception ${r.numero} supprimée.`, { libelle: 'Annuler', faire: S.annuler });
    },
    filtre: (el) => { ui.filtre = el.dataset.id; S.rendre(); },
    ref: (el) => { ui.ref = el.dataset.id; S.rendre(); },
    'ligne-nouvelle': () => modaleLigne(null),
    'ligne-ouvrir': (el) => modaleLigne(el.dataset.id),
    'lignes-coller': () => modaleColler(),
    'tout-recu': () => { const r = rec(); S.retenir(); r.lignes.forEach((l) => { if (l.qteRecue === null) l.qteRecue = l.qteCommandee; }); S.sauver(); S.rendre(); S.toast('Quantités reçues remplies.', { libelle: 'Annuler', faire: S.annuler }); },
    point: (el) => {
      const r = rec();
      S.retenir();
      const c = r.controles[el.dataset.point] || (r.controles[el.dataset.point] = { resultat: null, valeur: null, commentaire: '' });
      c.resultat = c.resultat === el.dataset.res ? null : el.dataset.res;
      S.sauver(); S.rendre();
    },
    'points-ok': () => {
      const r = rec();
      S.retenir();
      R.pointsFamille(famille(r.familleId)).filter((p) => p.type !== 'mesure' && R.resultatPoint(p, r.controles[p.id]) === null).forEach((p) => { r.controles[p.id] = { ...(r.controles[p.id] || { valeur: null, commentaire: '' }), resultat: 'ok' }; });
      S.sauver(); S.rendre(); S.toast('Points restants marqués conformes.', { libelle: 'Annuler', faire: S.annuler });
    },
    'constat-nouveau': () => modaleConstat(null),
    'constat-ouvrir': (el) => modaleConstat(el.dataset.id),
    'constat-lever': (el) => modaleLever(el.dataset.id),
    'constat-relever': (el) => { const c = rec().constats.find((x) => x.id === el.dataset.id); S.retenir(); c.levee = null; S.sauver(); S.rendre(); },
    decider: () => modaleDecision(),
    'decision-effacer': () => { S.retenir(); rec().decision = null; S.sauver(); S.rendre(); },
    rouvrir: () => { S.retenir(); rec().cloturee = false; S.sauver(); S.rendre(); S.toast('Réception rouverte.', { libelle: 'Annuler', faire: S.annuler }); },
    'famille-ouvrir': (el) => modaleFamille(el.dataset.id),
    'famille-nouvelle': () => modaleFamille(null),
    'fournisseur-ouvrir': (el) => modaleFournisseur(el.dataset.id),
    'fournisseur-nouveau': () => modaleFournisseur(null),
    imprimer: () => { if (!rec()) return S.toast('Ouvre d\'abord une réception.'); if (S.vue !== 'pv') S.changerVue('pv'); S.imprimer(); },
    'csv-receptions': () => S.exporterCsv(R.csvReceptions(S.E), 'receptions'),
    'csv-lignes': () => S.exporterCsv(R.csvLignes(S.E), 'receptions-lignes'),
    'csv-constats': () => S.exporterCsv(R.csvConstats(S.E), 'receptions-constats'),
  };

  S = window.QME_SOCLE.creer({
    produit: 'RCP', prefixe: 'rcp', nom: 'ContrôleRéception', fichier: 'controle-reception', titreBarre: 'ContrôleRéception<br>Livraisons contrôlées',
    connexion: { titre: 'Ne valide plus une livraison sans l\'avoir contrôlée.', texte: 'Quantités, points de contrôle par famille de produits, constats avec photos, réserves et procès-verbal : chaque réception est tracée, chaque fournisseur suivi.', ouvrir: 'Ouvre ContrôleRéception', bouton: 'Ouvrir ContrôleRéception' },
    onglets: [
      { id: 'receptions', nom: 'Réceptions', icone: 'lignes' },
      { id: 'controle', nom: 'Contrôle', icone: 'carre' },
      { id: 'pv', nom: 'PV', icone: 'quart' },
      { id: 'synthese', nom: 'Synthèse', icone: 'barres' },
      { id: 'referentiel', nom: 'Référentiel', icone: 'triangle' },
    ],
    vueParDefaut: 'receptions',
    etatVide: R.etatVide, normaliser: R.normaliser, donneesDemo, accueil, apresAccueil,
    vues: { receptions: vueReceptions, controle: vueControle, pv: vuePV, synthese: vueSynthese, referentiel: vueReferentiel },
    apresRendu() {
      brancherSaisies();
      S.$('#recherche')?.addEventListener('input', (e) => { ui.q = e.target.value; S.rendre(); });
      S.$('#filtre-fournisseur')?.addEventListener('change', (e) => { ui.fournisseur = e.target.value; S.rendre(); });
    },
    actions,
    reglages: {
      corps: () => `<label class="champ">Établissement <small>Imprimé sur les procès-verbaux.</small><input name="societe" maxlength="120" value="${esc(S.E.reglages.societe)}"></label><label class="champ">Réceptionnaire habituel<input name="receptionnaire" maxlength="80" value="${esc(S.E.reglages.receptionnaire)}"></label>`,
      valider: (f) => { S.E.reglages = { societe: O.texte(f.get('societe'), 120), receptionnaire: O.texte(f.get('receptionnaire'), 80) }; return undefined; },
      exports: [['csv-receptions', 'Réceptions (CSV)'], ['csv-lignes', 'Lignes (CSV)'], ['csv-constats', 'Constats (CSV)'], ['imprimer', 'Imprimer le PV ouvert']],
      aPropos: () => `<p class="mention">Base : ${B.familles.length} familles de produits, ${B.communs.length} points communs (version ${B.version}). ${esc(B.avertissement)} Photos réduites dans le navigateur et enregistrées avec tes données ; rien n'est envoyé au fournisseur.</p>`,
    },
    importValide: (d) => d && typeof d === 'object' && Array.isArray(d.receptions),
    resumeImport: (d) => S.pluriel(d.receptions.length, 'réception'),
  });
  S.lancer();
})();
