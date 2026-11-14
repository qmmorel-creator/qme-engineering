// Entretiens annuels et professionnels QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.ENP) et par les tests Node (vm).
// Dates locales « AAAA-MM-JJ » (comparables comme des chaînes). Périodicités en mois (réglages), état des lieux en
// années. Repères légaux (EPP, état des lieux, cas particuliers) : voir BASE.reperes, datés et sourcés.
(function (racine) {
  'use strict';

  const TYPES = ['annuel', 'epp', 'bilan'];
  const MOTIFS = ['periodique', 'premier', 'retour', 'mi-carriere', 'fin-carriere'];
  const STATUTS_ENTRETIEN = ['prevu', 'realise'];
  const STATUTS_OBJECTIF = ['en-cours', 'atteint', 'partiel', 'non-atteint', 'abandonne'];
  const STATUTS_FORMATION = ['demandee', 'acceptee', 'planifiee', 'realisee', 'reportee', 'refusee'];
  const NATURES = ['obligatoire', 'adaptation', 'developpement', 'certifiante', 'vae', 'bilan-competences'];
  const NON_OBLIGATOIRES = ['adaptation', 'developpement', 'certifiante', 'vae', 'bilan-competences'];
  const CERTIFIANTES = ['certifiante', 'vae'];
  const ORIGINES = ['entretien', 'salarie', 'manager'];
  const ABSENCES = ['maternite', 'adoption', 'naissance', 'parental', 'partiel-parental', 'aidant', 'sabbatique', 'mobilite', 'longue-maladie', 'mandat'];
  const COMPLEMENTS = ['retour', 'mi-carriere', 'fin-carriere', 'forfait-jours'];
  const DEFAUTS = { annuelActif: true, annuelMois: 12, premierEppMois: 12, eppMois: 48, bilanAns: 8, fenetreJours: 60, effacementMois: 12, toleranceMois: 3 };
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  // ---------- Dates ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j, 12); };
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  // Ajout de mois borné à la fin du mois : 31/01 + 1 mois → 28/02 (ou 29/02).
  function ajoutMois(s, n) {
    const [a, m, j] = s.split('-').map(Number);
    const cible = new Date(a, m - 1 + n, 1, 12);
    const dernier = new Date(cible.getFullYear(), cible.getMonth() + 1, 0, 12).getDate();
    cible.setDate(Math.min(j, dernier));
    return iso(cible);
  }
  const ajoutAns = (s, n) => ajoutMois(s, 12 * n);
  const libDate = (s) => { const d = versDate(s); return `${d.getDate() === 1 ? '1er' : d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`; };
  const maxDate = (...l) => l.filter(Boolean).sort().pop() || null;

  // ---------- Textes et identifiants ----------
  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const texte = (v, n) => String(v ?? '').trim().slice(0, n);
  const entier = (v, min, max, defaut) => { const n = Math.round(Number(v)); return v !== '' && v !== null && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : defaut; };
  const dateOuNull = (v) => (estDate(v) ? v : null);
  const mots = (s) => String(s ?? '').trim().split(/\s+/).filter((m) => m.replace(/[^\p{L}\p{N}]/gu, '').length > 0);

  // « camille durand » → « Camille D. » ; « Jean-Marc de la Tour » → « Jean-Marc D. » ; « Inès » → « Inès ».
  function nomMinimal(saisie) {
    const l = String(saisie ?? '').trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
    if (!l.length) return '';
    const cap = (m) => m.split('-').map((x) => x.charAt(0).toLocaleUpperCase('fr') + x.slice(1).toLocaleLowerCase('fr')).join('-');
    const prenom = cap(l[0]).slice(0, 30);
    if (l.length === 1) return prenom;
    const lettre = l.slice(1).join('').replace(/[^\p{L}]/gu, '').charAt(0).toLocaleUpperCase('fr');
    return lettre ? `${prenom} ${lettre}.` : prenom;
  }

  // ---------- Normalisation (tolérante aux anciennes versions et aux saisies abîmées) ----------
  function normaliserReglages(r) {
    const x = r && typeof r === 'object' ? r : {};
    return {
      annuelActif: x.annuelActif === undefined ? DEFAUTS.annuelActif : Boolean(x.annuelActif),
      annuelMois: entier(x.annuelMois, 1, 36, DEFAUTS.annuelMois),
      premierEppMois: entier(x.premierEppMois, 1, 24, DEFAUTS.premierEppMois),
      eppMois: entier(x.eppMois, 6, 72, DEFAUTS.eppMois),
      bilanAns: entier(x.bilanAns, 2, 12, DEFAUTS.bilanAns),
      fenetreJours: entier(x.fenetreJours, 7, 180, DEFAUTS.fenetreJours),
      effacementMois: entier(x.effacementMois, 0, 120, DEFAUTS.effacementMois),
      toleranceMois: entier(x.toleranceMois, 0, 12, DEFAUTS.toleranceMois),
    };
  }

  function normaliserSalarie(x, auj) {
    const s = x && typeof x === 'object' ? x : {};
    const a = entier(s.anneeNaissance, 1930, 2015, null);
    return {
      id: String(s.id || nouvelId()),
      prenom: nomMinimal(s.prenom) || 'Sans nom',
      poste: texte(s.poste, 80),
      service: texte(s.service, 60),
      manager: texte(s.manager, 60),
      entree: dateOuNull(s.entree) || auj,
      sortie: dateOuNull(s.sortie),
      anneeNaissance: a,
      visiteMiCarriere: dateOuNull(s.visiteMiCarriere),
      forfaitJours: Boolean(s.forfaitJours),
      absences: (Array.isArray(s.absences) ? s.absences : []).map((b) => ({
        id: String(b?.id || nouvelId()),
        type: ABSENCES.includes(b?.type) ? b.type : 'parental',
        debut: dateOuNull(b?.debut),
        retour: dateOuNull(b?.retour),
      })).filter((b) => b.retour || b.debut),
      note: texte(s.note, 300),
    };
  }

  function normaliserEntretien(x) {
    const e = x && typeof x === 'object' ? x : {};
    const type = TYPES.includes(e.type) ? e.type : 'annuel';
    const rep = {};
    if (e.reponses && typeof e.reponses === 'object') for (const [k, v] of Object.entries(e.reponses)) { const t = texte(v, 4000); if (t) rep[String(k).slice(0, 40)] = t; }
    return {
      id: String(e.id || nouvelId()),
      salarie: String(e.salarie || ''),
      type,
      motif: type === 'annuel' ? null : (MOTIFS.includes(e.motif) ? e.motif : 'periodique'),
      date: dateOuNull(e.date) || '2000-01-01',
      heure: /^\d{2}:\d{2}$/.test(e.heure || '') ? e.heure : '',
      statut: STATUTS_ENTRETIEN.includes(e.statut) ? e.statut : 'prevu',
      historique: Boolean(e.historique),
      complements: (Array.isArray(e.complements) ? e.complements : []).filter((c) => COMPLEMENTS.includes(c)),
      preparation: texte(e.preparation, 8000),
      reponses: rep,
      synthese: texte(e.synthese, 4000),
      progression: ['oui', 'non'].includes(e.progression) ? e.progression : '',
      copieRemiseLe: dateOuNull(e.copieRemiseLe),
      modifieApresRemise: Boolean(e.modifieApresRemise),
    };
  }

  function normaliserObjectif(x, auj) {
    const o = x && typeof x === 'object' ? x : {};
    return {
      id: String(o.id || nouvelId()),
      salarie: String(o.salarie || ''),
      entretien: o.entretien ? String(o.entretien) : null,
      intitule: texte(o.intitule, 200) || 'Objectif',
      indicateur: texte(o.indicateur, 160),
      cible: texte(o.cible, 80),
      moyens: texte(o.moyens, 300),
      lien: texte(o.lien, 200),
      echeance: dateOuNull(o.echeance),
      creeLe: dateOuNull(o.creeLe) || auj,
      avancement: entier(o.avancement, 0, 100, 0),
      statut: STATUTS_OBJECTIF.includes(o.statut) ? o.statut : 'en-cours',
      bilan: texte(o.bilan, 600),
      bilanLe: dateOuNull(o.bilanLe),
      reportDe: o.reportDe ? String(o.reportDe) : null,
    };
  }

  function normaliserFormation(x, auj) {
    const f = x && typeof x === 'object' ? x : {};
    return {
      id: String(f.id || nouvelId()),
      salarie: String(f.salarie || ''),
      entretien: f.entretien ? String(f.entretien) : null,
      intitule: texte(f.intitule, 160) || 'Formation',
      nature: NATURES.includes(f.nature) ? f.nature : 'developpement',
      dispositif: texte(f.dispositif, 80),
      origine: ORIGINES.includes(f.origine) ? f.origine : 'entretien',
      statut: STATUTS_FORMATION.includes(f.statut) ? f.statut : 'demandee',
      demandeLe: dateOuNull(f.demandeLe) || auj,
      datePrevue: dateOuNull(f.datePrevue),
      dateRealisee: dateOuNull(f.dateRealisee),
      commentaire: texte(f.commentaire, 400),
    };
  }

  function normaliserQuestionsPerso(q) {
    const r = { annuel: [], epp: [], bilan: [] };
    if (!q || typeof q !== 'object') return r;
    for (const t of TYPES) {
      r[t] = (Array.isArray(q[t]) ? q[t] : []).map((x) => ({ id: String(x?.id || `p-${nouvelId()}`), texte: texte(x?.texte, 300) })).filter((x) => x.texte).slice(0, 40);
    }
    return r;
  }

  const etatVide = () => ({ version: 1, entreprise: '', effectif50: false, reglages: normaliserReglages({}), salaries: [], entretiens: [], objectifs: [], formations: [], questionsPerso: normaliserQuestionsPerso(null), questionsMasquees: [] });

  function normaliser(d, auj) {
    const v = etatVide();
    if (!d || typeof d !== 'object') return v;
    v.entreprise = texte(d.entreprise, 60);
    v.effectif50 = Boolean(d.effectif50);
    v.reglages = normaliserReglages(d.reglages);
    v.salaries = (Array.isArray(d.salaries) ? d.salaries : []).map((s) => normaliserSalarie(s, auj));
    const ids = new Set(v.salaries.map((s) => s.id));
    v.entretiens = (Array.isArray(d.entretiens) ? d.entretiens : []).map(normaliserEntretien).filter((e) => ids.has(e.salarie));
    v.objectifs = (Array.isArray(d.objectifs) ? d.objectifs : []).map((o) => normaliserObjectif(o, auj)).filter((o) => ids.has(o.salarie));
    v.formations = (Array.isArray(d.formations) ? d.formations : []).map((f) => normaliserFormation(f, auj)).filter((f) => ids.has(f.salarie));
    v.questionsPerso = normaliserQuestionsPerso(d.questionsPerso);
    v.questionsMasquees = (Array.isArray(d.questionsMasquees) ? d.questionsMasquees : []).map(String).slice(0, 200);
    if (d.majLe) v.majLe = d.majLe;
    return v;
  }

  // ---------- Échéances ----------
  const estPresent = (s, auj) => !s.sortie || s.sortie > auj;
  // Entretiens d'un salarié, triés par date.
  const entretiensDe = (entretiens, sid) => entretiens.filter((e) => e.salarie === sid).sort((a, b) => a.date.localeCompare(b.date));
  // EPP réalisés : l'état des lieux compte comme un EPP.
  const eppRealises = (entretiens, sid) => entretiensDe(entretiens, sid).filter((e) => e.statut === 'realise' && (e.type === 'epp' || e.type === 'bilan'));
  const dernierRealise = (entretiens, sid, type) => entretiensDe(entretiens, sid).filter((e) => e.statut === 'realise' && e.type === type).pop() || null;

  // Annuel : dernier réalisé + périodicité, sinon entrée + périodicité. null si désactivé.
  function echeanceAnnuel(s, entretiens, reglages) {
    if (!reglages.annuelActif) return null;
    const d = dernierRealise(entretiens, s.id, 'annuel');
    return { type: 'annuel', motif: null, date: ajoutMois(d ? d.date : s.entree, reglages.annuelMois), depuis: d ? d.date : null };
  }

  // EPP : candidates (périodique ou premier, retour d'absence, mi-carrière, avant 60 ans) ; la plus proche est
  // retenue. Un EPP réalisé après le fait générateur éteint le cas particulier.
  function candidatsEpp(s, entretiens, reglages) {
    const epp = eppRealises(entretiens, s.id);
    const dernier = epp[epp.length - 1] || null;
    const apres = (date) => epp.some((e) => e.date >= date);
    const l = [];
    l.push(dernier
      ? { motif: 'periodique', date: ajoutMois(dernier.date, reglages.eppMois), depuis: dernier.date }
      : { motif: 'premier', date: ajoutMois(s.entree, reglages.premierEppMois), depuis: null });
    for (const b of s.absences) {
      if (!b.retour || b.retour < s.entree) continue;
      // Dû au retour si aucun EPP dans les 12 mois précédant la reprise (ni depuis).
      if (!apres(ajoutMois(b.retour, -12))) l.push({ motif: 'retour', date: b.retour, absence: b.id, typeAbsence: b.type });
    }
    if (s.visiteMiCarriere && !apres(s.visiteMiCarriere)) l.push({ motif: 'mi-carriere', date: ajoutMois(s.visiteMiCarriere, 2), depuis: s.visiteMiCarriere });
    if (s.anneeNaissance) {
      // Année de naissance seule : un EPP tenu dans l'année des 59 ans est toujours dans les 2 ans qui précèdent
      // les 60 ans, quel que soit le jour de l'anniversaire. Repère approché, affiché comme tel.
      const debut = `${s.anneeNaissance + 59}-01-01`, fin = `${s.anneeNaissance + 59}-12-31`;
      if (fin >= s.entree && !epp.some((e) => e.date >= debut && e.date <= fin)) l.push({ motif: 'fin-carriere', date: fin, debut, approche: true });
    }
    return l.sort((a, b) => a.date.localeCompare(b.date));
  }
  function echeanceEpp(s, entretiens, reglages) {
    const l = candidatsEpp(s, entretiens, reglages);
    return { type: 'epp', ...l[0], autres: l.slice(1) };
  }

  // État des lieux : dernier état des lieux + N ans, sinon entrée + N ans. « possibleDes » : premier EPP de la
  // période + (N − 1) ans (la fiche officielle : le premier peut intervenir 7 ans après le premier EPP).
  function echeanceBilan(s, entretiens, reglages) {
    const d = dernierRealise(entretiens, s.id, 'bilan');
    const depart = d ? d.date : s.entree;
    const premierEpp = eppRealises(entretiens, s.id).find((e) => e.date > depart);
    return { type: 'bilan', motif: null, date: ajoutAns(depart, reglages.bilanAns), depuis: d ? d.date : null, possibleDes: premierEpp ? ajoutAns(premierEpp.date, reglages.bilanAns - 1) : null };
  }

  // Un entretien prévu couvre l'échéance : même type (un état des lieux prévu couvre aussi l'EPP).
  function prevuPour(ech, entretiens, sid) {
    const ok = ech.type === 'epp' ? ['epp', 'bilan'] : [ech.type];
    return entretiensDe(entretiens, sid).find((e) => e.statut === 'prevu' && ok.includes(e.type)) || null;
  }

  // planifie, retard (échéance passée), bientot (dans la fenêtre), ok.
  function statutEcheance(ech, prevu, auj, fenetreJours) {
    if (prevu) return 'planifie';
    if (ech.date < auj) return 'retard';
    if (ech.date <= ajout(auj, fenetreJours)) return 'bientot';
    return 'ok';
  }

  // Échéances d'un salarié présent : annuel, EPP, état des lieux, avec statut et entretien prévu.
  function echeancesSalarie(s, E, auj) {
    if (!estPresent(s, auj)) return [];
    const r = E.reglages;
    const l = [echeanceAnnuel(s, E.entretiens, r), echeanceEpp(s, E.entretiens, r), echeanceBilan(s, E.entretiens, r)].filter(Boolean);
    return l.map((ech) => {
      const prevu = prevuPour(ech, E.entretiens, s.id);
      return { ...ech, salarie: s.id, prevu: prevu ? prevu.id : null, datePrevue: prevu ? prevu.date : null, statut: statutEcheance(ech, prevu, auj, r.fenetreJours) };
    });
  }

  const ORDRE_STATUT = { retard: 0, bientot: 1, planifie: 2, ok: 3 };
  function echeances(E, auj) {
    return E.salaries.flatMap((s) => echeancesSalarie(s, E, auj))
      .sort((a, b) => ORDRE_STATUT[a.statut] - ORDRE_STATUT[b.statut] || (a.datePrevue || a.date).localeCompare(b.datePrevue || b.date));
  }

  // Entretiens prévus dont la date est passée : compte rendu à finaliser.
  const aFinaliser = (E, auj) => E.entretiens.filter((e) => e.statut === 'prevu' && e.date < auj).sort((a, b) => a.date.localeCompare(b.date));
  // Réalisés sans copie remise (EPP et état des lieux : copie au salarié).
  const copieARemettre = (E) => E.entretiens.filter((e) => e.statut === 'realise' && !e.historique && e.type !== 'annuel' && !e.copieRemiseLe);

  // ---------- Contrôle de l'état des lieux (8 ans) ----------
  // Période : de max(entrée, fin − N ans) à la date de l'état des lieux. Les EPP réalisés de la période (l'état
  // des lieux lui-même compte pour la fin) doivent se suivre sans écart supérieur à la périodicité + tolérance ;
  // le premier après l'embauche dans le délai du premier EPP.
  function controleBilan(s, E, fin, bilanId = null) {
    const r = E.reglages;
    const debut = maxDate(s.entree, ajoutAns(fin, -r.bilanAns));
    const epp = eppRealises(E.entretiens, s.id).filter((e) => e.id !== bilanId && e.date >= debut && e.date < fin).map((e) => e.date);
    const manques = [];
    let precedent = debut, delai = s.entree >= debut ? r.premierEppMois : r.eppMois;
    for (const d of [...epp, fin]) {
      const limite = ajoutMois(precedent, delai + r.toleranceMois);
      if (d > limite) manques.push({ de: precedent, a: d, attendu: ajoutMois(precedent, delai) });
      precedent = d; delai = r.eppMois;
    }
    const dans = (f) => f.statut === 'realisee' && f.dateRealisee && f.dateRealisee >= debut && f.dateRealisee <= fin;
    const formations = E.formations.filter((f) => f.salarie === s.id && dans(f));
    const nonObligatoires = formations.filter((f) => NON_OBLIGATOIRES.includes(f.nature));
    const certifications = formations.filter((f) => CERTIFIANTES.includes(f.nature));
    const entretiensOk = manques.length === 0;
    const formationOk = nonObligatoires.length > 0;
    return { debut, fin, epp, manques, entretiensOk, formations, nonObligatoires, certifications, formationOk, risqueAbondement: E.effectif50 && (!entretiensOk || !formationOk) };
  }

  // ---------- Objectifs ----------
  // Contrôle SMART indicatif. S : intitulé d'au moins 4 mots ; M : indicateur et cible ; A : moyens ; R : lien au
  // poste ou à l'équipe ; T : échéance comprise entre la création et 18 mois après.
  function controleSmart(o) {
    const c = {
      S: mots(o.intitule).length >= 4,
      M: Boolean(o.indicateur && o.cible),
      A: Boolean(o.moyens),
      R: Boolean(o.lien),
      T: Boolean(o.echeance && o.echeance >= o.creeLe && o.echeance <= ajoutMois(o.creeLe, 18)),
    };
    const manque = Object.keys(c).filter((k) => !c[k]);
    return { ...c, manque, ok: manque.length === 0 };
  }
  // Objectif « en cours » arrivé à échéance : à faire le bilan.
  const objectifEchu = (o, auj) => o.statut === 'en-cours' && Boolean(o.echeance) && o.echeance < auj;
  // Objectifs à revoir dans un entretien : ceux du salarié encore en cours, créés avant l'entretien, ou dont le
  // bilan a été fait dans cet entretien.
  const objectifsARevoir = (objectifs, sid, ent) => objectifs.filter((o) => o.salarie === sid && o.entretien !== ent.id && o.creeLe <= ent.date && (o.statut === 'en-cours' || o.bilanLe === ent.date));
  const objectifsFixes = (objectifs, entId) => objectifs.filter((o) => o.entretien === entId);
  // Report : nouvel objectif lié au précédent (suivi d'une année sur l'autre), avancement repris.
  function reporter(o, { auj, echeance, entretien = null }) {
    return normaliserObjectif({ ...o, id: nouvelId(), entretien, creeLe: auj, echeance, statut: 'en-cours', bilan: '', bilanLe: null, reportDe: o.id }, auj);
  }
  // Historique d'un objectif : le plus ancien d'abord.
  function chaineObjectif(objectifs, id) {
    const parId = new Map(objectifs.map((o) => [o.id, o]));
    const l = [];
    for (let o = parId.get(id), n = 0; o && n < 50; o = parId.get(o.reportDe), n++) l.unshift(o);
    return l;
  }
  // Bilan des objectifs par année de création.
  function bilanObjectifs(objectifs) {
    const r = {};
    for (const o of objectifs) {
      const a = o.creeLe.slice(0, 4);
      r[a] ||= { annee: a, total: 0, 'en-cours': 0, atteint: 0, partiel: 0, 'non-atteint': 0, abandonne: 0 };
      r[a].total++; r[a][o.statut]++;
    }
    return Object.values(r).sort((a, b) => b.annee.localeCompare(a.annee)).map((x) => {
      const clos = x.atteint + x.partiel + x['non-atteint'];
      return { ...x, tauxAtteinte: clos ? Math.round((100 * (x.atteint + x.partiel / 2)) / clos) : null };
    });
  }

  // ---------- Formations ----------
  const ATTENTE = ['demandee', 'acceptee', 'reportee'];
  const formationEnAttente = (f) => ATTENTE.includes(f.statut);
  // Demandée depuis plus de N jours sans réponse.
  const formationSansReponse = (f, auj, jours = 60) => f.statut === 'demandee' && ecart(f.demandeLe, auj) > jours;
  function indicateursFormations(formations, auj) {
    const r = { total: formations.length, attente: 0, planifiee: 0, realisee: 0, refusee: 0, sansReponse: 0 };
    for (const f of formations) {
      if (formationEnAttente(f)) r.attente++;
      if (f.statut === 'planifiee') r.planifiee++;
      if (f.statut === 'realisee') r.realisee++;
      if (f.statut === 'refusee') r.refusee++;
      if (formationSansReponse(f, auj)) r.sansReponse++;
    }
    return r;
  }

  // ---------- Tableau de bord ----------
  function indicateurs(E, auj) {
    const l = echeances(E, auj);
    return {
      presents: E.salaries.filter((s) => estPresent(s, auj)).length,
      retard: l.filter((e) => e.statut === 'retard').length,
      bientot: l.filter((e) => e.statut === 'bientot').length,
      planifie: E.entretiens.filter((e) => e.statut === 'prevu' && e.date >= auj).length,
      aFinaliser: aFinaliser(E, auj).length,
      copie: copieARemettre(E).length,
      formationsAttente: E.formations.filter(formationEnAttente).length,
      objectifsEchus: E.objectifs.filter((o) => objectifEchu(o, auj)).length,
    };
  }

  // ---------- Trames et questionnaire ----------
  // Thèmes d'un entretien : trame du type, compléments du motif et ajoutés, questions personnalisées, sans les
  // questions masquées.
  function themesEntretien(ent, salarie, E, BASE) {
    const motif = (BASE.motifs.find((m) => m.id === ent.motif) || { themes: [] }).themes;
    const comp = [...new Set([...motif, ...ent.complements, ...(ent.type === 'annuel' && salarie?.forfaitJours ? ['forfait-jours'] : [])])];
    const masque = new Set(E.questionsMasquees);
    const themes = BASE.trames[ent.type].map((t) => ({ ...t, questions: t.questions.filter((x) => !masque.has(x.id)) }));
    const extra = comp.map((c) => BASE.complements[c]).filter(Boolean).map((t) => ({ ...t, complement: true, questions: t.questions.filter((x) => !masque.has(x.id)) }));
    const perso = E.questionsPerso[ent.type] || [];
    const l = [...themes.slice(0, -1), ...extra, ...(perso.length ? [{ id: 'perso', nom: 'Questions de l\'entreprise', questions: perso }] : []), ...themes.slice(-1)];
    return l.filter((t) => t.questions.length || t.auto);
  }

  // Questionnaire de préparation à copier pour le salarié (texte brut, numéroté).
  function questionnaire(ent, salarie, themes, { entreprise = '', nomType = '' } = {}) {
    const lignes = [];
    lignes.push(`Préparation de ton ${nomType.toLowerCase() || 'entretien'}${salarie ? ` · ${salarie.prenom}` : ''}`);
    lignes.push(`Date prévue : ${libDate(ent.date)}${ent.heure ? ` à ${ent.heure.replace(':', ' h ')}` : ''}${entreprise ? ` · ${entreprise}` : ''}`);
    lignes.push('');
    lignes.push('Prends quelques minutes pour noter tes réponses, même brèves. Tu peux sauter une question. Renvoie tes notes avant l\'entretien ou apporte-les.');
    let n = 0;
    for (const t of themes) {
      const qs = t.questions.filter((x) => !/^Commentaire du manager/.test(x.texte) && !/information donnée\.?$/i.test(x.texte) && !/^Ce qui est convenu/.test(x.texte));
      if (!qs.length) continue;
      lignes.push('', t.nom.toUpperCase());
      for (const x of qs) lignes.push(`${++n}. ${x.texte}`, '   Réponse : ');
    }
    return lignes.join('\n');
  }

  // ---------- RGPD ----------
  // Salariés sortis depuis au moins le délai réglé : effacement proposé.
  const aEffacer = (E, auj) => E.salaries.filter((s) => s.sortie && s.sortie < auj && ajoutMois(s.sortie, E.reglages.effacementMois) <= auj);
  function donneesSalarie(E, sid) {
    const salarie = E.salaries.find((s) => s.id === sid) || null;
    return { salarie, entretiens: E.entretiens.filter((e) => e.salarie === sid), objectifs: E.objectifs.filter((o) => o.salarie === sid), formations: E.formations.filter((f) => f.salarie === sid) };
  }
  // Nouvel état sans le salarié ni rien de ce qui le concerne.
  function sansSalarie(E, sid) {
    return { ...E, salaries: E.salaries.filter((s) => s.id !== sid), entretiens: E.entretiens.filter((e) => e.salarie !== sid), objectifs: E.objectifs.filter((o) => o.salarie !== sid), formations: E.formations.filter((f) => f.salarie !== sid) };
  }

  // ---------- CSV ----------
  // Point-virgule, BOM UTF-8 (ouverture directe dans Excel), guillemets doublés.
  function versCsv(entetes, lignes) {
    const cel = (v) => { const s = String(v ?? ''); return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    return '﻿' + [entetes, ...lignes].map((l) => l.map(cel).join(';')).join('\r\n') + '\r\n';
  }

  racine.ENP = {
    TYPES, MOTIFS, STATUTS_OBJECTIF, STATUTS_FORMATION, NATURES, NON_OBLIGATOIRES, CERTIFIANTES, ABSENCES, COMPLEMENTS, DEFAUTS,
    iso, versDate, estDate, ajout, ajoutMois, ajoutAns, ecart, libDate, nouvelId, nomMinimal, mots,
    etatVide, normaliser, normaliserSalarie, normaliserEntretien, normaliserObjectif, normaliserFormation, normaliserReglages,
    estPresent, entretiensDe, eppRealises, dernierRealise,
    echeanceAnnuel, candidatsEpp, echeanceEpp, echeanceBilan, prevuPour, statutEcheance, echeancesSalarie, echeances, aFinaliser, copieARemettre,
    controleBilan, controleSmart, objectifEchu, objectifsARevoir, objectifsFixes, reporter, chaineObjectif, bilanObjectifs,
    formationEnAttente, formationSansReponse, indicateursFormations, indicateurs,
    themesEntretien, questionnaire, aEffacer, donneesSalarie, sansSalarie, versCsv,
  };
})(typeof window !== 'undefined' ? window : globalThis);
