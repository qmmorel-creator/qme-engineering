// Déménagement QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.DMN) et par les tests Node (vm).
// Dates locales « AAAA-MM-JJ » (comparables comme des chaînes). J = jour du déménagement.
(function (racine) {
  'use strict';

  const STATUTS = ['afaire', 'fait', 'so'];
  const STATUTS_CARTON = ['remplir', 'ferme', 'arrive', 'deballe'];
  const DEPART = ['locataire', 'proprietaire', 'autre'];
  const ARRIVEE = ['locataire', 'proprietaire', 'autre'];
  const MODES = ['pro', 'soi'];
  const OPTIONS = ['enfants', 'animaux', 'vehicule'];

  // ---------- Dates ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;

  // « J−56 », « J », « J+3 »
  const libJ = (j) => (j === 0 ? 'J' : j > 0 ? `J+${j}` : `J−${-j}`);
  // Saisie « J-15 », « -15 », « +3 », « 3 », « J » → entier ; null si illisible.
  function lireJ(saisie) {
    const s = String(saisie ?? '').trim().toUpperCase().replace(/\s/g, '').replace('−', '-');
    if (s === 'J' || s === 'J0') return 0;
    const m = /^J?([+-]?\d{1,3})$/.exec(s);
    return m ? Number(m[1]) : null;
  }
  // Compte à rebours lisible : « dans 12 jours », « demain », « aujourd'hui », « il y a 3 jours ».
  const compteRebours = (date, auj) => {
    const n = ecart(auj, date);
    return n === 0 ? 'aujourd\'hui' : n === 1 ? 'demain' : n === -1 ? 'hier' : n > 0 ? `dans ${n} jours` : `il y a ${-n} jours`;
  };

  // ---------- Situation et génération du rétroplanning ----------
  function normaliserSituation(x) {
    const s = x && typeof x === 'object' ? x : {};
    return {
      depart: DEPART.includes(s.depart) ? s.depart : 'locataire',
      arrivee: ARRIVEE.includes(s.arrivee) ? s.arrivee : 'locataire',
      mode: MODES.includes(s.mode) ? s.mode : 'pro',
      enfants: Boolean(s.enfants), animaux: Boolean(s.animaux), vehicule: Boolean(s.vehicule),
    };
  }
  // Condition d'une tâche de la base : vide, « depart:locataire », « mode:pro », « enfants »…
  function applicable(si, situation) {
    if (!si) return true;
    const [cle, val] = si.split(':');
    if (val !== undefined) return situation[cle] === val;
    return Boolean(situation[cle]);
  }

  function trierTaches(taches) {
    return [...taches].sort((x, y) => x.j - y.j || (x.ordre ?? 999) - (y.ordre ?? 999) || x.titre.localeCompare(y.titre, 'fr'));
  }

  // Tâches applicables à la situation, copiées de la base (ref = identifiant stable de la base, ordre = rang
  // dans la base pour départager deux tâches du même jour). « exclure » : refs déjà présentes.
  function genererTaches(base, situation, exclure = new Set()) {
    const s = normaliserSituation(situation);
    const liste = [];
    base.forEach((t, i) => {
      if (!applicable(t.si, s) || exclure.has(t.id)) return;
      liste.push({ id: nouvelId(), ref: t.id, titre: t.titre, cat: t.cat, j: t.j, aide: t.aide || '', statut: 'afaire', faitLe: null, note: '', ordre: i });
    });
    return trierTaches(liste);
  }

  // Nouvelle situation : ajoute les tâches de la base devenues applicables (absentes par leur ref), retire
  // celles qui ne le sont plus si elles sont encore à faire (une tâche cochée ou ajoutée à la main reste).
  // « masquees » : refs des tâches de la base retirées à la main, jamais remises.
  function appliquerSituation(taches, base, situation, masquees = []) {
    const s = normaliserSituation(situation);
    const parRef = new Map(base.map((t) => [t.id, t]));
    const retirees = taches.filter((t) => t.ref && parRef.has(t.ref) && !applicable(parRef.get(t.ref).si, s) && t.statut === 'afaire');
    const ids = new Set(retirees.map((t) => t.id));
    const gardees = taches.filter((t) => !ids.has(t.id));
    const ajoutees = genererTaches(base, s, new Set([...gardees.map((t) => t.ref).filter(Boolean), ...masquees]));
    return { taches: trierTaches([...gardees, ...ajoutees]), ajoutees, retirees };
  }

  // ---------- Échéances et statuts ----------
  const echeance = (date, t) => ajout(date, t.j);
  // fait, so (sans objet), retard (échéance passée), bientot (dans les 7 jours), avenir.
  function statutTache(t, date, auj) {
    if (t.statut === 'fait' || t.statut === 'so') return t.statut;
    const e = echeance(date, t);
    if (e < auj) return 'retard';
    if (e <= ajout(auj, 7)) return 'bientot';
    return 'avenir';
  }

  // Progression : tâches faites sur tâches applicables (les « sans objet » sortent du compte).
  function progression(taches, date, auj) {
    const r = { total: taches.length, fait: 0, so: 0, aFaire: 0, retard: 0, bientot: 0, pct: 0 };
    for (const t of taches) {
      const s = statutTache(t, date, auj);
      if (s === 'fait') r.fait++;
      else if (s === 'so') r.so++;
      else { r.aFaire++; if (s === 'retard') r.retard++; if (s === 'bientot') r.bientot++; }
    }
    const applicables = r.total - r.so;
    r.pct = applicables ? Math.round((r.fait / applicables) * 100) : (r.total ? 100 : 0);
    return r;
  }

  // Phases du rétroplanning (semaines avant J, jour J, après).
  const PHASES = [
    { id: 'avant', nom: 'Plus de deux mois avant', de: -Infinity, a: -57 },
    { id: 's8', nom: 'Huit à sept semaines avant', de: -56, a: -43 },
    { id: 's6', nom: 'Six à cinq semaines avant', de: -42, a: -29 },
    { id: 's4', nom: 'Quatre à trois semaines avant', de: -28, a: -15 },
    { id: 's2', nom: 'Deux semaines avant', de: -14, a: -8 },
    { id: 's1', nom: 'La dernière semaine', de: -7, a: -1 },
    { id: 'j', nom: 'Le jour J', de: 0, a: 0 },
    { id: 'apres1', nom: 'La première semaine', de: 1, a: 7 },
    { id: 'apres', nom: 'Le premier mois', de: 8, a: Infinity },
  ];
  const phase = (j) => PHASES.find((x) => j >= x.de && j <= x.a);
  // Phase en cours aujourd'hui (pour ouvrir la checklist au bon endroit).
  const phaseDuJour = (date, auj) => phase(ecart(date, auj));

  // Tâches transverses à afficher : retards (les plus anciens d'abord) puis 7 prochains jours.
  function aFaireBientot(taches, date, auj) {
    return trierTaches(taches.filter((t) => ['retard', 'bientot'].includes(statutTache(t, date, auj))))
      .map((t) => ({ ...t, echeance: echeance(date, t), etat: statutTache(t, date, auj) }));
  }

  // Changement de date : combien de tâches à faire changent d'échéance, et de combien de jours.
  function decalage(ancienne, nouvelle, taches) {
    const jours = ecart(ancienne, nouvelle);
    return { jours, taches: jours ? taches.filter((t) => t.statut === 'afaire').length : 0 };
  }

  // ---------- Cartons ----------
  const sansAccents = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const numeroSuivant = (cartons) => cartons.reduce((m, c) => Math.max(m, c.num || 0), 0) + 1;

  // Recherche « dans quel carton est… » : numéro exact (« 12 », « n°12 », « #12 ») en tête, puis tous les
  // mots cherchés présents dans le contenu, la note ou le nom de la pièce (sans accents ni casse).
  function rechercherCartons(cartons, q, nomPiece = () => '') {
    const brut = String(q ?? '').trim();
    if (!brut) return [...cartons].sort((x, y) => x.num - y.num);
    const num = /^(?:n[°o]?\s*|#\s*)?(\d{1,4})$/i.exec(brut);
    const mots = sansAccents(brut).split(/[\s,;]+/).filter((m) => m.length > 0);
    const trouve = cartons.filter((c) => {
      if (num && c.num === Number(num[1])) return true;
      const texte = sansAccents(`${c.contenu} ${c.note} ${nomPiece(c.piece)}`);
      return mots.every((m) => texte.includes(m));
    });
    const exact = (c) => (num && c.num === Number(num[1]) ? 0 : 1);
    return trouve.sort((x, y) => exact(x) - exact(y) || x.num - y.num);
  }

  // Avancement des cartons : comptes par statut, pourcentage prêt à partir (fermé ou plus) et déballé.
  function avancementCartons(cartons) {
    const r = { total: cartons.length, remplir: 0, ferme: 0, arrive: 0, deballe: 0, fragiles: 0, prioritaires: 0, pctPrets: 0, pctDeballes: 0 };
    for (const c of cartons) { r[c.statut]++; if (c.fragile) r.fragiles++; if (c.prioritaire) r.prioritaires++; }
    if (r.total) { r.pctPrets = Math.round(((r.total - r.remplir) / r.total) * 100); r.pctDeballes = Math.round((r.deballe / r.total) * 100); }
    return r;
  }

  // Par pièce de destination, dans l'ordre des pièces ; « sans pièce » en dernier s'il y en a.
  function parPiece(cartons, pieces) {
    const ids = pieces.map((p) => p.id);
    const groupes = pieces.map((p) => ({ piece: p.id, cartons: cartons.filter((c) => c.piece === p.id) }));
    const orphelins = cartons.filter((c) => !ids.includes(c.piece));
    if (orphelins.length) groupes.push({ piece: null, cartons: orphelins });
    return groupes.filter((g) => g.cartons.length).map((g) => ({ ...g, cartons: [...g.cartons].sort((x, y) => x.num - y.num), ...avancementCartons(g.cartons) }));
  }

  // Après le jour J : cartons pas encore pointés « arrivé » (à chercher dans le camion ou l'ancien logement).
  const cartonsManquants = (cartons, date, auj) => (auj < date ? [] : cartons.filter((c) => c.statut === 'remplir' || c.statut === 'ferme').sort((x, y) => x.num - y.num));

  // ---------- Volume ----------
  // Somme des meubles (quantité × volume), meubles ajoutés, cartons × volume d'un carton, puis marge.
  function volumeEstime(volume, meubles, nbCartonsInventaire, { volumeCarton = 0.06 } = {}) {
    const v = volume || {};
    const parId = new Map(meubles.map((m) => [m.id, m]));
    let mobilier = 0;
    for (const [id, q] of Object.entries(v.items || {})) { const m = parId.get(id); if (m && q > 0) mobilier += m.v * q; }
    for (const x of v.extras || []) if (x.qte > 0 && x.vol > 0) mobilier += x.vol * x.qte;
    const nbCartons = Number.isFinite(v.cartons) && v.cartons !== null ? v.cartons : nbCartonsInventaire;
    const cartons = nbCartons * volumeCarton;
    const brut = mobilier + cartons;
    const marge = Number.isFinite(v.marge) ? v.marge : 10;
    const arrondi = (x) => Math.round(x * 10) / 10;
    return { mobilier: arrondi(mobilier), nbCartons, cartons: arrondi(cartons), brut: arrondi(brut), marge, total: arrondi(brut * (1 + marge / 100)) };
  }

  // ---------- Devis ----------
  // Comparaison : prix au m³ (volume du devis, sinon volume estimé), moins cher, écart au moins cher,
  // validité dépassée, nombre de prestations incluses. Les devis sans montant ne sont pas classés.
  function comparerDevis(devis, volume, auj) {
    const valides = devis.filter((d) => d.montant > 0);
    const min = valides.length ? Math.min(...valides.map((d) => d.montant)) : null;
    const lignes = devis.map((d) => {
      const vol = d.volume > 0 ? d.volume : volume > 0 ? volume : null;
      return {
        id: d.id,
        prixM3: d.montant > 0 && vol ? Math.round(d.montant / vol) : null,
        volumeRetenu: vol, volumeEstime: !(d.volume > 0),
        moinsCher: d.montant > 0 && d.montant === min,
        ecart: d.montant > 0 && min !== null ? d.montant - min : null,
        expire: Boolean(d.validite && auj && d.validite < auj),
        inclus: (d.inclus || []).length,
        resteAPayer: d.montant > 0 ? Math.max(0, d.montant - (d.acompte || 0)) : null,
      };
    });
    const ordre = [...lignes].sort((x, y) => (x.ecart ?? Infinity) - (y.ecart ?? Infinity));
    return { lignes, ordre: ordre.map((l) => l.id), min, max: valides.length ? Math.max(...valides.map((d) => d.montant)) : null };
  }

  // Retenir un devis : un seul retenu ; la ligne de budget « Déménageur » liée prend son montant en prévu
  // (créée si absente). Retirer le choix délie la ligne sans l'effacer.
  function retenirDevis(devis, budget, id) {
    const choisi = devis.find((d) => d.id === id);
    const dejaRetenu = choisi?.retenu;
    const nDevis = devis.map((d) => ({ ...d, retenu: !dejaRetenu && d.id === id }));
    let nBudget = budget.map((l) => ({ ...l }));
    if (!choisi) return { devis: nDevis, budget: nBudget };
    if (dejaRetenu) {
      nBudget = nBudget.map((l) => (l.devis === id ? { ...l, devis: null } : l));
      return { devis: nDevis, budget: nBudget };
    }
    const libelle = `Déménageur · ${choisi.entreprise || 'devis retenu'}`;
    const lie = nBudget.find((l) => l.devis) || nBudget.find((l) => l.poste === 'demenageur' && !(l.reel > 0));
    if (lie) Object.assign(lie, { poste: 'demenageur', libelle, prevu: choisi.montant || 0, devis: id });
    else nBudget.unshift({ id: nouvelId(), poste: 'demenageur', libelle, prevu: choisi.montant || 0, reel: null, paye: false, devis: id });
    return { devis: nDevis, budget: nBudget };
  }

  // ---------- Budget ----------
  // Prévu, réel (dépensé), payé ; écart = réel − prévu sur les lignes qui ont un réel ; reste à payer.
  function totauxBudget(lignes) {
    const r = { prevu: 0, reel: 0, paye: 0, ecart: 0, resteAPayer: 0, lignes: lignes.length, sansMontant: 0 };
    for (const l of lignes) {
      const p = l.prevu > 0 ? l.prevu : 0;
      const re = l.reel > 0 ? l.reel : null;
      r.prevu += p;
      if (re !== null) { r.reel += re; r.ecart += re - p; }
      const du = re !== null ? re : p;
      if (l.paye) r.paye += du; else r.resteAPayer += du;
      if (!p && re === null) r.sansMontant++;
    }
    const c = (x) => Math.round(x * 100) / 100;
    return { ...r, prevu: c(r.prevu), reel: c(r.reel), paye: c(r.paye), ecart: c(r.ecart), resteAPayer: c(r.resteAPayer), estime: c(lignes.reduce((s, l) => s + (l.reel > 0 ? l.reel : l.prevu > 0 ? l.prevu : 0), 0)) };
  }

  // ---------- État ----------
  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const entier = (v, min, max, defaut) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : defaut; };
  const montant = (v) => { if (v === null || v === undefined || v === '') return null; const n = Number(String(v).replace(',', '.').replace(/\s/g, '')); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null; };
  const dateOuNull = (v) => (estDate(v) ? v : null);
  const texte = (v, n) => String(v ?? '').trim().slice(0, n);

  function normaliserTache(x) {
    const t = x && typeof x === 'object' ? x : {};
    const statut = STATUTS.includes(t.statut) ? t.statut : 'afaire';
    return { id: String(t.id || nouvelId()), ref: t.ref ? String(t.ref) : null, titre: texte(t.titre, 160) || 'Tâche', cat: texte(t.cat, 20) || 'organisation', j: entier(t.j, -365, 365, 0), aide: texte(t.aide, 300), statut, faitLe: statut === 'afaire' ? null : dateOuNull(t.faitLe), note: texte(t.note, 200), ordre: Number.isFinite(t.ordre) ? t.ordre : 999 };
  }
  function normaliserPiece(x, i, couleurs) {
    const p = x && typeof x === 'object' ? x : {};
    return { id: String(p.id || nouvelId()), nom: texte(p.nom, 40) || 'Pièce', couleur: /^#[0-9A-Fa-f]{6}$/.test(p.couleur || '') ? p.couleur : couleurs[i % couleurs.length] };
  }
  function normaliserCarton(x) {
    const c = x && typeof x === 'object' ? x : {};
    return { id: String(c.id || nouvelId()), num: entier(c.num, 1, 9999, 1), piece: c.piece ? String(c.piece) : null, contenu: texte(c.contenu, 400), note: texte(c.note, 120), fragile: Boolean(c.fragile), lourd: Boolean(c.lourd), prioritaire: Boolean(c.prioritaire), statut: STATUTS_CARTON.includes(c.statut) ? c.statut : 'remplir' };
  }
  function normaliserDevis(x) {
    const d = x && typeof x === 'object' ? x : {};
    return { id: String(d.id || nouvelId()), entreprise: texte(d.entreprise, 60) || 'Déménageur', formule: texte(d.formule, 20) || 'standard', montant: montant(d.montant), volume: montant(d.volume), date: dateOuNull(d.date), validite: dateOuNull(d.validite), acompte: montant(d.acompte), visite: Boolean(d.visite), inclus: (Array.isArray(d.inclus) ? d.inclus : []).map(String).slice(0, 20), note: texte(d.note, 300), retenu: Boolean(d.retenu) };
  }
  function normaliserLigne(x) {
    const l = x && typeof x === 'object' ? x : {};
    return { id: String(l.id || nouvelId()), poste: texte(l.poste, 20) || 'autre', libelle: texte(l.libelle, 80) || 'Dépense', prevu: montant(l.prevu), reel: montant(l.reel), paye: Boolean(l.paye), devis: l.devis ? String(l.devis) : null };
  }
  function normaliserVolume(x) {
    const v = x && typeof x === 'object' ? x : {};
    const items = {};
    for (const [k, q] of Object.entries(v.items && typeof v.items === 'object' ? v.items : {})) { const n = entier(q, 0, 99, 0); if (n) items[k] = n; }
    return {
      items,
      extras: (Array.isArray(v.extras) ? v.extras : []).map((e) => ({ id: String(e?.id || nouvelId()), nom: texte(e?.nom, 60) || 'Objet', vol: montant(e?.vol) || 0, qte: entier(e?.qte, 0, 99, 1) })),
      cartons: v.cartons === null || v.cartons === undefined || v.cartons === '' ? null : entier(v.cartons, 0, 999, null),
      marge: entier(v.marge, 0, 50, 10),
    };
  }

  const piecesDepuisBase = (base, couleurs) => base.map((p, i) => normaliserPiece({ ...p, couleur: couleurs[i % couleurs.length] }, i, couleurs));
  function etatVide(base = {}, auj = iso(new Date())) {
    return {
      version: 1, date: ajout(auj, 56), depuis: '', vers: '',
      situation: normaliserSituation({}),
      taches: [], pieces: piecesDepuisBase(base.pieces || [], base.couleurs || ['#2E5A88']),
      cartons: [], devis: [], budget: [], volume: normaliserVolume({}), masquees: [],
    };
  }
  function normaliser(d, auj, base = {}) {
    const v = etatVide(base, auj);
    if (!d || typeof d !== 'object') return v;
    const couleurs = base.couleurs || ['#2E5A88'];
    return {
      ...v, ...d,
      date: dateOuNull(d.date) || v.date,
      depuis: texte(d.depuis, 60), vers: texte(d.vers, 60),
      situation: normaliserSituation(d.situation),
      taches: trierTaches((Array.isArray(d.taches) ? d.taches : []).map(normaliserTache)),
      pieces: Array.isArray(d.pieces) && d.pieces.length ? d.pieces.map((p, i) => normaliserPiece(p, i, couleurs)) : v.pieces,
      cartons: (Array.isArray(d.cartons) ? d.cartons : []).map(normaliserCarton),
      devis: (Array.isArray(d.devis) ? d.devis : []).map(normaliserDevis),
      budget: (Array.isArray(d.budget) ? d.budget : []).map(normaliserLigne),
      volume: normaliserVolume(d.volume),
      masquees: (Array.isArray(d.masquees) ? d.masquees : []).map(String).slice(0, 200),
    };
  }

  // ---------- Exports ----------
  const LIB_STATUT = { afaire: 'À faire', fait: 'Fait', so: 'Sans objet', retard: 'En retard', bientot: 'Sous 7 jours', avenir: 'À venir' };
  const LIB_CARTON = { remplir: 'À remplir', ferme: 'Fermé', arrive: 'Arrivé', deballe: 'Déballé' };
  const champCsv = (v) => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = (lignes) => '﻿' + lignes.map((l) => l.map(champCsv).join(';')).join('\r\n');
  const nombre = (n) => (n === null || n === undefined ? '' : String(n).replace('.', ','));
  function versCsvTaches(taches, date, nomCat, auj) {
    const tete = ['Tâche', 'Catégorie', 'J', 'Échéance', 'Statut', 'Fait le', 'Note'];
    return csv([tete, ...trierTaches(taches).map((t) => [t.titre, nomCat(t.cat), libJ(t.j).replace('−', '-'), echeance(date, t), LIB_STATUT[statutTache(t, date, auj)], t.faitLe || '', t.note])]);
  }
  function versCsvCartons(cartons, nomPiece) {
    const tete = ['Numéro', 'Pièce', 'Contenu', 'Fragile', 'Lourd', 'À ouvrir en premier', 'Statut', 'Note'];
    return csv([tete, ...[...cartons].sort((x, y) => x.num - y.num).map((c) => [c.num, nomPiece(c.piece), c.contenu, c.fragile ? 'Oui' : '', c.lourd ? 'Oui' : '', c.prioritaire ? 'Oui' : '', LIB_CARTON[c.statut], c.note])]);
  }
  function versCsvBudget(lignes) {
    const tete = ['Poste', 'Prévu (€)', 'Réel (€)', 'Payé'];
    return csv([tete, ...lignes.map((l) => [l.libelle, nombre(l.prevu), nombre(l.reel), l.paye ? 'Oui' : 'Non'])]);
  }

  racine.DMN = {
    STATUTS, STATUTS_CARTON, PHASES, LIB_STATUT, LIB_CARTON,
    iso, versDate, ajout, ecart, estDate, libJ, lireJ, compteRebours,
    normaliserSituation, applicable, trierTaches, genererTaches, appliquerSituation,
    echeance, statutTache, progression, phase, phaseDuJour, aFaireBientot, decalage,
    sansAccents, numeroSuivant, rechercherCartons, avancementCartons, parPiece, cartonsManquants,
    volumeEstime, comparerDevis, retenirDevis, totauxBudget,
    nouvelId, montant, normaliserTache, normaliserPiece, normaliserCarton, normaliserDevis, normaliserLigne, normaliserVolume,
    piecesDepuisBase, etatVide, normaliser,
    versCsvTaches, versCsvCartons, versCsvBudget,
  };
})(typeof window !== 'undefined' ? window : globalThis);
