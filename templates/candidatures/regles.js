// Suivi de candidatures QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.CAN) et par les tests Node (vm).
// Dates locales « AAAA-MM-JJ » (comparables comme des chaînes), heures « HH:MM ».
// Trois modèles partagent les mêmes données : Études et stages, Emploi, Appels d'offres et plateformes (fusion du
// 22/11/2026 avec le suivi des appels d'offres : grille go/no-go, rétroplanning des pièces, bibliothèque de pièces
// réutilisables, dépôt, résultat et bilan). Une copie exportée de l'ancien suivi se convertit (depuisAppelsOffres).
(function (racine) {
  'use strict';

  const ALERTE_DEFAUT = 7; // jours avant une date limite : « à envoyer bientôt »
  const RELANCE_DEFAUT = 10; // jours sans nouvelles après un envoi ou une relance : relance proposée
  const URGENT = 3; // jours : date limite urgente
  const USAGES = ['etudes', 'emploi', 'offres'];
  const TYPES = ['formation', 'stage', 'alternance', 'job', 'offre', 'spontanee', 'public', 'prive', 'plateforme', 'directe', 'autre'];
  const STATUTS = ['reperee', 'preparer', 'envoyee', 'entretien', 'attente', 'acceptee', 'refusee', 'retiree', 'sanssuite', 'nogo'];
  const ACTIFS = ['reperee', 'preparer', 'envoyee', 'entretien', 'attente'];
  const EN_ATTENTE_REPONSE = ['envoyee', 'entretien', 'attente'];
  const DEPOSES = ['envoyee', 'entretien', 'acceptee', 'refusee', 'sanssuite'];
  const GO = ['preparer', 'envoyee', 'entretien', 'acceptee', 'refusee', 'sanssuite', 'retiree'];
  // Une réponse est encore attendue : envoyée ou entretien sans réponse reçue, ou liste d'attente (la réponse
  // reçue est la mise en attente ; la date de réponse saisie est alors celle de la réponse définitive).
  const attendReponse = (c) => c.statut === 'attente' || (EN_ATTENTE_REPONSE.includes(c.statut) && !c.dates.recue);
  const STATUTS_PIECE = ['afaire', 'encours', 'prete', 'envoyee', 'sansobjet'];
  const CANAUX = ['email', 'telephone', 'site', 'place'];
  const FORMATS = ['presentiel', 'visio', 'telephone'];
  const REGLAGES_DEFAUT = { alerte: ALERTE_DEFAUT, relance: RELANCE_DEFAUT, marge: 1, decision: 7, renouveler: 30, seuilGo: 65, seuilDiscuter: 45 };

  // ---------- Dates ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  const estHeure = (s) => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
  const dateOuNul = (s) => (estDate(s) ? s : null);
  // 0 = lundi … 6 = dimanche ; une échéance interne qui tombe un samedi ou un dimanche est avancée au vendredi.
  const jourSemaine = (s) => (versDate(s).getDay() + 6) % 7;
  const lundi = (s) => ajout(s, -jourSemaine(s));
  const ouvreAvant = (s) => { const j = jourSemaine(s); return j >= 5 ? ajout(s, -(j - 4)) : s; };

  // ---------- Textes et nombres ----------
  const sansAccents = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const pluriel = (n, s, p) => `${n} ${n > 1 ? (p || s + 's') : s}`;
  const texte = (v, max) => String(v ?? '').trim().slice(0, max);
  const montant = (v) => { const n = Number(String(v ?? '').replace(/\s/g, '').replace(',', '.')); return v === '' || v === null || v === undefined || !Number.isFinite(n) || n < 0 ? null : Math.round(n * 100) / 100; };
  const entier = (v, min, max) => (Number.isInteger(Number(v)) && v !== '' && v !== null && Number(v) >= min && Number(v) <= max ? Number(v) : null);
  const arrondi = (x, n = 2) => Math.round(x * 10 ** n) / 10 ** n;

  // Refus des secrets dans les champs libres : un étudiant note vite l'identifiant et le mot de passe de son
  // espace de candidature. L'application ne les garde jamais.
  function contientSecret(t) {
    const s = sansAccents(t);
    if (/\b(?:mot de passe|mdp|password|identifiant de connexion|code (?:pin|secret|confidentiel)|pin)\s*[:=]/.test(s)) return 'secret';
    if (/(?:\d[\s.-]?){13,}/.test(s)) return 'numero';
    return '';
  }
  const MESSAGES_SENSIBLES = {
    secret: 'Pas de mot de passe ni de code ici : garde-les dans un gestionnaire de mots de passe, pas dans tes candidatures.',
    numero: 'Pas de numéro long ici (carte bancaire, compte, sécurité sociale) : l\'application n\'en a pas besoin.',
  };

  // ---------- Identifiants ----------
  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  // ---------- Base ----------
  const pieceDe = (base, id) => (base.pieces || []).find((x) => x.id === id) || null;
  const modeleDe = (base, id) => (base.modeles || []).find((x) => x.id === id) || null;
  const trameDe = (base, id) => (base.trames || []).find((x) => x.id === id) || null;
  const questionDe = (base, id) => (base.questions || []).find((x) => x.id === id) || null;
  const typeDe = (base, id) => (base.types || []).find((t) => t.id === id) || null;
  const familleDe = (base, type) => typeDe(base, type)?.famille || 'etudes';
  const usageDe = (base, id) => (base.usages || []).find((u) => u.id === id) || base.usages[0];
  const modeleParDefaut = (type) => ({ formation: 'master', stage: 'stage', alternance: 'alternance', job: 'job', offre: 'emploi-offre', spontanee: 'emploi-spontanee' }[type] || 'vide');
  // Statuts proposés pour une famille (modèle), dans l'ordre de la base, et leur libellé dans cette famille.
  const statutsDe = (base, famille) => base.statuts.filter((s) => !s.familles || s.familles.includes(famille)).map((s) => s.id);
  function nomStatut(base, id, famille, court = false) {
    const s = base.statuts.find((x) => x.id === id) || base.statuts[1];
    const l = famille === 'offres' && s.offres ? s.offres : [s.nom, s.court];
    return court ? l[1] : l[0];
  }
  const estOffre = (base, c) => familleDe(base, c.type) === 'offres';

  // ---------- Normalisation ----------
  function normaliserPiece(x, base) {
    const ref = x && x.ref ? pieceDe(base, x.ref) : null;
    const statut = x?.statut === 'pret' ? 'prete' : x?.statut; // ancien suivi des appels d'offres
    return {
      id: String(x?.id || nouvelId()),
      ref: ref ? ref.id : null,
      nom: texte(x?.nom || x?.libelle || ref?.nom || 'Pièce', 160) || 'Pièce',
      statut: STATUTS_PIECE.includes(statut) ? statut : 'afaire',
      apres: x && typeof x.apres === 'boolean' ? x.apres : Boolean(ref?.apres),
      precision: texte(x?.precision, 120),
      // Rétroplanning (appels d'offres) : jours avant la date limite, ou date fixée à la main.
      delai: entier(x?.delai, 0, 120),
      echeance: dateOuNul(x?.echeance),
      responsable: texte(x?.responsable, 40),
      biblio: x?.biblio ? String(x.biblio).slice(0, 40) : null,
      type: (base.typesPieces || []).some((t) => t.id === x?.type) ? x.type : null,
    };
  }
  const piecesDuModele = (base, idModele) => (modeleDe(base, idModele)?.pieces || []).map((id) => normaliserPiece({ ref: id }, base));
  // Pièces d'un dossier d'appel d'offres, depuis le modèle de dossier de son type (copie modifiable des données).
  function piecesDuDossier(dossiers, base, type, responsable = '') {
    const d = (dossiers || []).find((m) => m.id === typeDe(base, type)?.dossier) || (dossiers || [])[0];
    return (d?.pieces || []).map((p) => normaliserPiece({ nom: p.libelle, delai: p.delai, type: p.type || null, responsable }, base));
  }

  function normaliserRelance(x) {
    return { id: String(x?.id || nouvelId()), date: dateOuNul(x?.date) || null, canal: CANAUX.includes(x?.canal) ? x.canal : 'email', note: texte(x?.note, 200) };
  }
  function normaliserQuestion(x, base) {
    const ref = x && x.ref ? questionDe(base, x.ref) : null;
    return { id: String(x?.id || nouvelId()), ref: ref ? ref.id : null, texte: texte(x?.texte || ref?.texte, 200), notes: texte(x?.notes, 1200), prete: Boolean(x?.prete) };
  }

  function normaliserCandidature(x, base) {
    const d = x?.dates || {};
    const type = TYPES.includes(x?.type) ? x.type : 'formation';
    const famille = familleDe(base, type);
    const e = x?.entretien || {};
    const l = x?.lettre || {};
    const champs = {};
    if (l.champs && typeof l.champs === 'object') for (const [k, v] of Object.entries(l.champs)) if (/^[a-z0-9]{1,20}$/.test(k)) champs[k] = texte(v, 400);
    const grille = {};
    if (x?.grille && typeof x.grille === 'object') for (const [k, v] of Object.entries(x.grille)) { const n = entier(v, 0, 3); if (/^[a-z0-9-]{1,30}$/i.test(k) && n !== null) grille[k] = n; }
    let statut = STATUTS.includes(x?.statut) ? x.statut : 'preparer';
    if (!statutsDe(base, famille).includes(statut)) statut = statut === 'reperee' ? 'preparer' : statut === 'attente' ? 'envoyee' : statut === 'nogo' ? 'retiree' : statut === 'sanssuite' ? 'refusee' : 'preparer';
    const dc = x?.decision;
    return {
      id: String(x?.id || nouvelId()),
      type,
      intitule: texte(x?.intitule, 160),
      organisme: texte(x?.organisme, 120),
      ville: texte(x?.ville, 60),
      contact: texte(x?.contact, 120),
      lien: /^https?:\/\/\S+$/i.test(String(x?.lien || '').trim()) ? String(x.lien).trim().slice(0, 300) : '',
      statut,
      rang: Number.isInteger(x?.rang) && x.rang > 0 ? x.rang : null,
      dates: {
        limite: dateOuNul(d.limite), heureLimite: estHeure(d.heureLimite) ? d.heureLimite : '', envoi: dateOuNul(d.envoi), entretien: dateOuNul(d.entretien),
        heure: estHeure(d.heure) ? d.heure : '', reponse: dateOuNul(d.reponse), recue: dateOuNul(d.recue),
        questions: dateOuNul(d.questions), valable: dateOuNul(d.valable), relancer: dateOuNul(d.relancer),
      },
      pieces: Array.isArray(x?.pieces) ? x.pieces.slice(0, 60).map((pc) => normaliserPiece(pc, base)) : [],
      relances: Array.isArray(x?.relances) ? x.relances.slice(0, 30).map(normaliserRelance).filter((r) => r.date).sort((a, b) => (a.date < b.date ? -1 : 1)) : [],
      entretien: {
        format: FORMATS.includes(e.format) ? e.format : 'presentiel',
        lieu: texte(e.lieu, 120),
        questions: Array.isArray(e.questions) ? e.questions.slice(0, 40).map((qq) => normaliserQuestion(qq, base)).filter((qq) => qq.texte) : [],
        notes: texte(e.notes, 2000),
      },
      lettre: { trame: trameDe(base, l.trame) ? l.trame : null, champs, texte: l.texte ? texte(l.texte, 6000) : '' },
      motif: texte(x?.motif, 300),
      note: texte(x?.note, 2000),
      creeLe: dateOuNul(x?.creeLe),
      // Appels d'offres et plateformes.
      reference: texte(x?.reference, 80),
      source: texte(x?.source, 80),
      montantEstime: montant(x?.montantEstime),
      montantOffre: montant(x?.montantOffre),
      montantObtenu: montant(x?.montantObtenu),
      grille,
      decision: dc && ['go', 'nogo'].includes(dc.choix) ? { choix: dc.choix, date: dateOuNul(dc.date), motif: texte(dc.motif, 200) } : null,
      motifPerte: (base.motifsPerte || []).some((m) => m.id === x?.motifPerte) ? x.motifPerte : null,
      place: entier(x?.place, 1, 99),
      temps: Math.max(0, Math.min(9999, Math.round((Number(x?.temps) || 0) * 4) / 4)),
    };
  }

  const copieBase = (v) => JSON.parse(JSON.stringify(v || []));
  function etatVide(base) {
    return { version: 2, usage: 'etudes', profil: { prenom: '', signature: '', campagne: '' }, reglages: { ...REGLAGES_DEFAUT },
      criteres: copieBase(base?.criteres), dossiers: copieBase(base?.dossiers), biblio: [], candidatures: [] };
  }
  const borne = (v, min, max, def) => (Number.isFinite(Number(v)) && v !== '' && v !== null && Number(v) >= min && Number(v) <= max ? Math.round(Number(v)) : def);
  function normaliserBiblio(b, base) {
    return { id: String(b?.id || nouvelId()).slice(0, 40), type: (base.typesPieces || []).some((t) => t.id === b?.type) ? b.type : 'autre', titre: texte(b?.titre, 160) || 'Pièce',
      reference: texte(b?.reference, 200), emisLe: dateOuNul(b?.emisLe), valideJusquau: dateOuNul(b?.valideJusquau), note: texte(b?.note, 600) };
  }
  function normaliserCriteres(liste, base) {
    const parId = new Map((Array.isArray(liste) ? liste : []).map((k) => [k?.id, k]));
    return (base.criteres || []).map((k) => ({ ...k, poids: borne(parId.get(k.id)?.poids, 0, 5, k.poids) }));
  }
  function normaliserDossiers(liste, base) {
    const parId = new Map((Array.isArray(liste) ? liste : []).map((m) => [m?.id, m]));
    return (base.dossiers || []).map((m) => {
      const u = parId.get(m.id);
      const pieces = Array.isArray(u?.pieces) ? u.pieces.map((p) => ({ libelle: texte(p?.libelle, 160), delai: borne(p?.delai, 0, 90, 0), ...((base.typesPieces || []).some((t) => t.id === p?.type) ? { type: p.type } : {}) })).filter((p) => p.libelle).slice(0, 40) : null;
      return { id: m.id, nom: m.nom, description: u ? texte(u.description, 200) : m.description, pieces: pieces && pieces.length ? pieces : copieBase(m.pieces) };
    });
  }
  function normaliser(d, base) {
    if (d && typeof d === 'object' && Array.isArray(d.consultations) && !Array.isArray(d.candidatures)) return depuisAppelsOffres(d, base);
    const e = etatVide(base);
    if (!d || typeof d !== 'object') return e;
    e.usage = USAGES.includes(d.usage) ? d.usage : 'etudes';
    const pr = d.profil || {};
    e.profil = { prenom: texte(pr.prenom, 40), signature: texte(pr.signature, 80), campagne: texte(pr.campagne, 60) };
    const rg = d.reglages || {};
    e.reglages = {
      alerte: borne(rg.alerte, 1, 30, ALERTE_DEFAUT), relance: borne(rg.relance, 3, 45, RELANCE_DEFAUT),
      marge: borne(rg.marge, 0, 10, REGLAGES_DEFAUT.marge), decision: borne(rg.decision, 0, 60, REGLAGES_DEFAUT.decision),
      renouveler: borne(rg.renouveler, 1, 180, REGLAGES_DEFAUT.renouveler),
      seuilGo: borne(rg.seuilGo, 1, 100, REGLAGES_DEFAUT.seuilGo), seuilDiscuter: borne(rg.seuilDiscuter, 0, 99, REGLAGES_DEFAUT.seuilDiscuter),
    };
    if (e.reglages.seuilDiscuter >= e.reglages.seuilGo) { e.reglages.seuilGo = REGLAGES_DEFAUT.seuilGo; e.reglages.seuilDiscuter = REGLAGES_DEFAUT.seuilDiscuter; }
    e.criteres = normaliserCriteres(d.criteres, base);
    e.dossiers = normaliserDossiers(d.dossiers, base);
    e.biblio = Array.isArray(d.biblio) ? d.biblio.slice(0, 200).map((b) => normaliserBiblio(b, base)) : [];
    e.candidatures = Array.isArray(d.candidatures) ? d.candidatures.slice(0, 400).map((c) => normaliserCandidature(c, base)) : [];
    if (d.majLe) e.majLe = d.majLe;
    return e;
  }

  // Copie exportée de l'ancien « Suivi des appels d'offres et candidatures » (CND) : consultations, bibliothèque,
  // grille et modèles de dossiers convertis sans perte vers le modèle « Appels d'offres et plateformes ».
  const STATUTS_CND = { reperee: 'reperee', preparation: 'preparer', deposee: 'envoyee', gagnee: 'acceptee', perdue: 'refusee', sanssuite: 'sanssuite', nogo: 'nogo', abandon: 'retiree' };
  function depuisAppelsOffres(d, base) {
    const r = d.reglages || {};
    const notesLien = (c) => (c.lien && !/^https?:\/\/\S+$/i.test(String(c.lien).trim()) ? `Où trouver le dossier : ${c.lien}` : '');
    const e = normaliser({
      usage: 'offres',
      profil: { prenom: r.monNom || '' },
      reglages: { alerte: r.horizon, relance: r.intervalleRelance, marge: r.marge, decision: r.delaiDecision, renouveler: r.seuilBiblio, seuilGo: r.seuilGo, seuilDiscuter: r.seuilDiscuter },
      criteres: d.criteres, dossiers: d.modeles, biblio: d.biblio,
      candidatures: (d.consultations || []).map((c) => ({
        id: c.id, type: TYPES.includes(c.type) && familleDe(base, c.type) === 'offres' ? c.type : 'autre',
        intitule: c.titre, organisme: c.acheteur, reference: c.reference, source: c.source, lien: c.lien,
        statut: STATUTS_CND[c.statut] || 'reperee', creeLe: c.reperee || null,
        dates: { limite: c.dateLimite, heureLimite: c.heureLimite, questions: c.dateQuestions, envoi: c.depot || null, recue: c.resultat?.date || null,
          valable: c.offreValable, relancer: c.statut === 'deposee' ? c.relancerLe : null },
        pieces: (c.pieces || []).map((p) => ({ ...p, nom: p.libelle })),
        relances: (c.relances || []).map((x) => ({ date: x.date, canal: 'email', note: x.note })),
        montantEstime: c.montantEstime, montantOffre: c.montantOffre, montantObtenu: c.resultat?.montant,
        grille: c.notes, decision: c.decision, motifPerte: c.resultat?.motif || null, place: c.resultat?.rang ?? null,
        motif: c.resultat?.note || '', note: [notesLien(c), c.commentaire || ''].filter(Boolean).join('\n'), temps: c.temps,
      })),
    }, base);
    if (d.tutorielVu) e.tutorielVu = true;
    return e;
  }

  // ---------- Pièces ----------
  // Les pièces « après acceptation » (convention, contrat…) ne comptent qu'une fois la candidature acceptée ;
  // les pièces « sans objet » ne comptent jamais.
  function piecesUtiles(c) { return c.pieces.filter((x) => x.statut !== 'sansobjet' && (!x.apres || c.statut === 'acceptee')); }
  function avancement(c) {
    const utiles = piecesUtiles(c);
    const pretes = utiles.filter((x) => x.statut === 'prete' || x.statut === 'envoyee').length;
    return { total: utiles.length, pretes, envoyees: utiles.filter((x) => x.statut === 'envoyee').length, manquantes: utiles.length - pretes, pct: utiles.length ? Math.round((pretes / utiles.length) * 100) : 100, apres: c.pieces.filter((x) => x.apres && c.statut !== 'acceptee' && x.statut !== 'sansobjet').length };
  }
  const piecesManquantes = (c) => piecesUtiles(c).filter((x) => x.statut === 'afaire' || x.statut === 'encours');
  // Statut suivant d'une pièce au toucher : à faire → en cours → prête → envoyée → à faire (sans objet → à faire).
  const pieceSuivante = (s) => (s === 'sansobjet' ? 'afaire' : STATUTS_PIECE[(STATUTS_PIECE.indexOf(s) + 1) % 4]);

  // Rétroplanning : échéance d'une pièce = date fixée à la main, sinon date limite moins son délai (avancée au
  // vendredi si elle tombe un week-end). Sans délai ni date fixée : pas d'échéance.
  function echeancePiece(p, dateLimite) {
    if (p.echeance) return p.echeance;
    if (!dateLimite || p.delai === null || p.delai === undefined) return null;
    return p.delai > 0 ? ouvreAvant(ajout(dateLimite, -p.delai)) : dateLimite;
  }
  // Dépôt visé : date limite moins la marge choisie (un dépôt de dernière minute échoue parfois).
  const depotVise = (c, marge = 1) => (c.dates.limite ? (marge > 0 ? ajout(c.dates.limite, -marge) : c.dates.limite) : null);
  // Pièce de la bibliothèque à une date : sans date de validité, valide, bientôt expirée, expirée.
  function etatBiblio(b, date, seuil = 30) {
    if (!b) return null;
    if (!b.valideJusquau) return { etat: 'sansdate', jours: null };
    const j = ecart(date, b.valideJusquau);
    return { etat: j < 0 ? 'expiree' : j <= seuil ? 'bientot' : 'valide', jours: j };
  }
  // État d'une pièce : retard, bientôt (≤ 2 jours), en cours, à faire, prête, envoyée, sans objet. alerte : la pièce
  // liée de la bibliothèque est expirée, ou ne sera plus valable à la date limite.
  function etatPiece(p, c, auj, biblio = []) {
    const echeance = echeancePiece(p, c.dates.limite);
    const b = p.biblio ? biblio.find((x) => x.id === p.biblio) || null : null;
    let alerte = null;
    if (b && b.valideJusquau && !['sansobjet', 'envoyee'].includes(p.statut)) {
      if (b.valideJusquau < auj) alerte = 'expiree';
      else if (c.dates.limite && b.valideJusquau < c.dates.limite) alerte = 'expire-avant';
    }
    if (['sansobjet', 'prete', 'envoyee'].includes(p.statut)) return { etat: p.statut, echeance, b, alerte, retard: 0 };
    const retard = echeance && echeance < auj ? ecart(echeance, auj) : 0;
    const etat = retard > 0 ? 'retard' : echeance && ecart(auj, echeance) <= 2 ? 'bientot' : p.statut;
    return { etat, echeance, b, alerte, retard };
  }

  // ---------- Grille go/no-go ----------
  // notes : { idCritère: 0..3 }. Score en % des points possibles sur les critères notés (poids > 0).
  function scoreGrille(criteres, notes, seuils = { go: 65, discuter: 45 }) {
    let points = 0, max = 0, notees = 0;
    const eliminatoires = [];
    const comptes = criteres.filter((k) => k.poids > 0);
    for (const k of comptes) {
      const v = notes?.[k.id];
      if (v === undefined || v === null || v === '') continue;
      const n = Math.max(0, Math.min(3, Number(v)));
      notees += 1;
      points += n * k.poids;
      max += 3 * k.poids;
      if (k.eliminatoire && n === 0) eliminatoires.push(k.id);
    }
    const complet = notees === comptes.length;
    const pct = max ? Math.round((points / max) * 100) : null;
    let recommandation = null;
    if (eliminatoires.length) recommandation = 'nogo';
    else if (complet && pct !== null) recommandation = pct >= seuils.go ? 'go' : pct >= seuils.discuter ? 'discuter' : 'nogo';
    return { pct, notes: notees, total: comptes.length, complet, eliminatoires, recommandation };
  }

  // ---------- Statuts ----------
  const copie = (c) => JSON.parse(JSON.stringify(c));
  // Changement de statut avec ses effets : à l'envoi, date d'envoi du jour (si vide) et pièces prêtes passées
  // « envoyées » ; à une réponse (acceptée, refusée, liste d'attente, sans suite), date de réponse reçue du jour
  // (si vide). Revenir à préparer ou en veille efface la réponse reçue.
  function changerStatut(c, statut, auj) {
    if (!STATUTS.includes(statut)) return c;
    const n = copie(c);
    n.statut = statut;
    if (statut === 'envoyee') {
      if (!n.dates.envoi) n.dates.envoi = auj;
      n.pieces.forEach((x) => { if (x.statut === 'prete' && !x.apres) x.statut = 'envoyee'; });
    }
    if (['acceptee', 'refusee', 'attente', 'sanssuite'].includes(statut) && !n.dates.recue) n.dates.recue = auj;
    if (['preparer', 'reperee'].includes(statut)) n.dates.recue = null;
    if (statut === 'reperee') n.decision = null;
    return n;
  }
  const estActive = (c) => ACTIFS.includes(c.statut);
  const estGo = (c) => GO.includes(c.statut);
  const estDepose = (c) => DEPOSES.includes(c.statut);

  // Go / no-go d'une consultation repérée : le go la passe en préparation avec les pièces de son modèle de dossier
  // (si elle n'en a pas encore) ; le no-go l'écarte avec son motif. L'original n'est pas modifié.
  function decider(c, choix, { date, motif = '', pieces = [] }) {
    const n = copie(c);
    n.decision = { choix, date, motif: texte(motif, 200) };
    if (choix === 'go') { n.statut = 'preparer'; if (!n.pieces.length) n.pieces = copie(pieces); } else n.statut = 'nogo';
    return n;
  }
  // Dépôt d'une offre : date, montant, validité ; toutes les pièces utiles passent « envoyées ».
  function deposer(c, { date, montantOffre = null, valable = null }) {
    const n = copie(c);
    n.statut = 'envoyee';
    n.dates.envoi = date;
    n.dates.recue = null;
    n.dates.relancer = null;
    if (montant(montantOffre) !== null) n.montantOffre = montant(montantOffre);
    n.dates.valable = dateOuNul(valable);
    n.pieces.forEach((x) => { if (x.statut !== 'sansobjet' && !x.apres) x.statut = 'envoyee'; });
    return n;
  }
  // Relance faite : notée, la prochaine repart de cette date (la date fixée à la main est oubliée).
  function noterRelance(c, { date, note = '', canal = 'email' }) {
    const n = copie(c);
    n.relances.push(normaliserRelance({ date, note, canal }));
    n.relances.sort((a, b) => (a.date < b.date ? -1 : 1));
    n.dates.relancer = null;
    return n;
  }
  // Résultat d'une consultation : gagnée, perdue (motif, classement) ou sans suite.
  function cloturer(c, statut, { date, montantObtenu = null, motifPerte = null, place = null, motif = '' }) {
    const n = copie(c);
    n.statut = statut;
    n.dates.recue = date;
    n.dates.relancer = null;
    n.montantObtenu = statut === 'acceptee' ? montant(montantObtenu) : null;
    n.motifPerte = statut === 'refusee' ? (motifPerte || 'inconnu') : null;
    n.place = statut === 'refusee' ? entier(place, 1, 99) : null;
    if (motif) n.motif = texte(motif, 300);
    return n;
  }
  // Temps passé, en heures (pas d'un quart d'heure), jamais négatif.
  const ajouterTemps = (heures, delta) => Math.max(0, Math.round(((Number(heures) || 0) + Number(delta)) * 4) / 4);

  // ---------- Relances ----------
  // Dernier contact : la dernière relance, sinon l'envoi (ou l'entretien, ou la mise en liste d'attente).
  // Relance proposée si une réponse est attendue et : la date fixée à la main est atteinte, ou la réponse attendue
  // est dépassée, ou le délai sans nouvelles est atteint (délai du type pour le premier contact, puis le réglage ;
  // pas de délai pour une formation, dont l'établissement annonce la date). Après un entretien passé : remerciement.
  function dernierContact(c) {
    const r = c.relances.length ? c.relances[c.relances.length - 1].date : null;
    const cand = [r, c.dates.envoi, c.statut === 'entretien' && c.dates.entretien ? c.dates.entretien : null, c.statut === 'attente' ? c.dates.recue : null].filter(Boolean).sort();
    return cand.length ? cand[cand.length - 1] : null;
  }
  function relance(c, auj, delai = RELANCE_DEFAUT, base = null) {
    if (!attendReponse(c)) return null;
    const dernier = dernierContact(c);
    if (c.dates.relancer) return { date: c.dates.relancer, raison: 'prevue', due: c.dates.relancer <= auj, jours: dernier ? ecart(dernier, auj) : 0 };
    if (c.dates.reponse && c.dates.reponse < auj && (!dernier || dernier <= c.dates.reponse)) return { date: ajout(c.dates.reponse, 1), raison: 'reponse', due: true, jours: ecart(c.dates.reponse, auj) };
    if (c.statut === 'entretien' && c.dates.entretien && c.dates.entretien < auj && !c.relances.some((r) => r.date >= c.dates.entretien)) {
      return { date: ajout(c.dates.entretien, 1), raison: 'remerciement', due: true, jours: ecart(c.dates.entretien, auj) };
    }
    if (c.statut === 'entretien' && c.dates.entretien && c.dates.entretien >= auj) return null; // entretien à venir
    const ty = base ? typeDe(base, c.type) : null;
    if (c.type === 'formation' || ty?.relanceAuto === false || !dernier) return null;
    if (c.dates.reponse && c.dates.reponse >= auj) return null; // date de réponse annoncée : on attend
    const d = ty?.relance && !c.relances.length ? ty.relance : delai;
    const date = ajout(dernier, d);
    return { date, raison: 'delai', due: date <= auj, jours: ecart(dernier, auj) };
  }

  // ---------- Échéances ----------
  // Événements datés d'une candidature : date limite, dépôt visé, pièces du rétroplanning, questions à l'acheteur,
  // décision go/no-go, entretien, réponse attendue, relance proposée, fin de validité d'une offre.
  // Niveau : depasse, urgent (≤ 3 jours), proche (≤ alerte), loin.
  function niveau(jours, alerte) { return jours < 0 ? 'depasse' : jours <= URGENT ? 'urgent' : jours <= alerte ? 'proche' : 'loin'; }
  function evenementsDe(c, auj, reglages = {}, base = null, biblio = []) {
    const rg = { ...REGLAGES_DEFAUT, ...reglages };
    const out = [];
    const ev = (nature, date, extra = {}) => { const jours = ecart(auj, date); out.push({ id: `${c.id}-${nature}${extra.piece ? `-${extra.piece.id}` : ''}`, cand: c, nature, date, jours, niveau: niveau(jours, rg.alerte), ...extra }); };
    const offre = base ? estOffre(base, c) : false;
    if (['preparer', 'reperee'].includes(c.statut) && c.dates.limite) ev('limite', c.dates.limite, { heure: c.dates.heureLimite });
    if (c.statut === 'reperee' && c.dates.limite && c.dates.limite >= auj) { const d = ajout(c.dates.limite, -rg.decision); ev('decision', d < auj ? auj : d); }
    if (['preparer', 'reperee'].includes(c.statut) && c.dates.questions && c.dates.questions >= auj) ev('questions', c.dates.questions);
    if (c.statut === 'preparer' && offre && rg.marge > 0 && c.dates.limite) ev('depot', depotVise(c, rg.marge));
    if (c.statut === 'preparer') {
      for (const p of c.pieces) {
        const e = etatPiece(p, c, auj, biblio);
        if (!e.echeance || ['prete', 'envoyee', 'sansobjet'].includes(e.etat) || (p.apres && c.statut !== 'acceptee')) continue;
        ev('piece', e.echeance, { piece: p });
      }
    }
    if (c.dates.entretien && (c.statut === 'entretien' || (estActive(c) && c.statut !== 'reperee' && c.dates.entretien >= auj))) ev('entretien', c.dates.entretien, { heure: c.dates.heure });
    if (attendReponse(c) && c.dates.reponse) ev('reponse', c.dates.reponse);
    const r = relance(c, auj, rg.relance, base);
    if (r) ev('relance', r.due ? auj : r.date, { raison: r.raison, due: r.due });
    if (['envoyee', 'entretien'].includes(c.statut) && c.dates.valable && c.dates.valable >= auj) ev('validite', c.dates.valable);
    return out;
  }
  // Tri : dates croissantes, à date égale dans l'ordre des natures.
  const ORDRE_NATURE = { limite: 0, depot: 1, piece: 2, questions: 3, decision: 4, entretien: 5, reponse: 6, relance: 7, validite: 8 };
  function evenements(cands, auj, reglages = {}, { horizon = null, base = null, biblio = [] } = {}) {
    return cands.flatMap((c) => evenementsDe(c, auj, reglages, base, biblio))
      .filter((e) => horizon === null || e.jours <= horizon)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (ORDRE_NATURE[a.nature] - ORDRE_NATURE[b.nature]) || (a.heure || '').localeCompare(b.heure || '')));
  }
  // Pièces d'un même dossier à la même échéance regroupées en un seul événement (ordre conservé).
  function regrouperPieces(evs) {
    const sortie = [];
    const groupes = new Map();
    for (const e of evs) {
      if (e.nature !== 'piece') { sortie.push(e); continue; }
      const cle = `${e.cand.id}|${e.date}`;
      const g = groupes.get(cle);
      if (g) { g.pieces.push(e.piece); continue; }
      const n = { ...e, id: `${e.cand.id}-pieces-${e.date}`, pieces: [e.piece] };
      groupes.set(cle, n);
      sortie.push(n);
    }
    return sortie;
  }
  // Candidatures à préparer dont la date limite est passée, imminente (≤ alerte) ou absente, avec leurs pièces.
  function aEnvoyer(cands, auj, reglages = {}) {
    const alerte = reglages.alerte || ALERTE_DEFAUT;
    return cands.filter((c) => c.statut === 'preparer' && c.dates.limite && ecart(auj, c.dates.limite) <= alerte)
      .map((c) => ({ cand: c, jours: ecart(auj, c.dates.limite), av: avancement(c) }))
      .sort((a, b) => a.jours - b.jours);
  }
  // Pièces de la bibliothèque à renouveler : expirées ou valables moins de `seuil` jours.
  function aRenouveler(biblio, auj, seuil = 30) {
    return biblio.map((b) => ({ b, e: etatBiblio(b, auj, seuil) })).filter((x) => ['bientot', 'expiree'].includes(x.e.etat))
      .sort((a, b) => a.b.valideJusquau.localeCompare(b.b.valideJusquau));
  }

  // Regroupement par mois (« AAAA-MM ») pour l'onglet Échéances.
  function parMois(evs) {
    const g = new Map();
    for (const e of evs) { const k = e.date.slice(0, 7); if (!g.has(k)) g.set(k, []); g.get(k).push(e); }
    return [...g.entries()].map(([mois, liste]) => ({ mois, liste }));
  }
  // Calendrier : semaines (lundi → dimanche) qui couvrent le mois « AAAA-MM ».
  function grilleMois(mois) {
    const [a, m] = mois.split('-').map(Number);
    const dernier = iso(new Date(a, m, 0));
    const semaines = [];
    for (let d = lundi(`${mois}-01`); d <= dernier; d = ajout(d, 7)) semaines.push(Array.from({ length: 7 }, (_, i) => ajout(d, i)));
    return semaines;
  }
  const moisSuivant = (mois, n) => { const [a, m] = mois.split('-').map(Number); const t = a * 12 + m - 1 + n; return `${Math.floor(t / 12)}-${deux((t % 12) + 1)}`; };

  // ---------- Classement des vœux ----------
  // Ordre de préférence personnel : candidatures encore en jeu ou acceptées, rang 1, 2, 3… ; les non classées
  // suivent. Les refusées, retirées, écartées et sans suite sortent du classement.
  const classable = (c) => !['refusee', 'retiree', 'nogo', 'sanssuite'].includes(c.statut);
  function classement(cands, type = null) {
    const liste = cands.filter((c) => classable(c) && (!type || c.type === type));
    const classees = liste.filter((c) => c.rang).sort((a, b) => a.rang - b.rang);
    const autres = liste.filter((c) => !c.rang).sort((a, b) => (a.dates.limite || '9999') < (b.dates.limite || '9999') ? -1 : 1);
    return { classees, autres };
  }
  // Renumérote 1..n dans l'ordre donné (identifiants), retire le rang des autres. Renvoie de nouveaux objets.
  // Le classement est propre à chaque type (les formations entre elles, les stages entre eux…).
  function appliquerOrdre(cands, ids, type) {
    const pos = new Map(ids.map((id, i) => [id, i + 1]));
    return cands.map((c) => (c.type !== type ? c : { ...c, rang: classable(c) && pos.has(c.id) ? pos.get(c.id) : null }));
  }
  // Déplace une candidature dans le classement de son type (delta −1 = monter) ; une non classée est ajoutée en dernier.
  function deplacer(cands, id, delta) {
    const c = cands.find((x) => x.id === id);
    if (!c || !classable(c)) return cands.slice();
    const ids = classement(cands, c.type).classees.map((x) => x.id);
    const i = ids.indexOf(id);
    if (i < 0) { ids.push(id); return appliquerOrdre(cands, ids, c.type); }
    const j = Math.max(0, Math.min(ids.length - 1, i + delta));
    ids.splice(i, 1); ids.splice(j, 0, id);
    return appliquerOrdre(cands, ids, c.type);
  }
  function retirerDuClassement(cands, id) {
    const c = cands.find((x) => x.id === id);
    if (!c) return cands.slice();
    return appliquerOrdre(cands, classement(cands, c.type).classees.map((x) => x.id).filter((x) => x !== id), c.type);
  }
  // Après un changement de statut (refusée, retirée) ou une suppression : rangs resserrés 1, 2, 3… par type.
  const resserrer = (cands) => TYPES.reduce((acc, t) => appliquerOrdre(acc, classement(acc, t).classees.map((x) => x.id), t), cands);

  // ---------- Bilan ----------
  function bilan(cands, auj, reglages = {}, base = null) {
    const parStatut = Object.fromEntries(STATUTS.map((s) => [s, 0]));
    const parType = Object.fromEntries(TYPES.map((t) => [t, 0]));
    for (const c of cands) { parStatut[c.statut]++; parType[c.type]++; }
    const envoyees = cands.filter((c) => !['preparer', 'reperee', 'nogo'].includes(c.statut)).length;
    const reponses = cands.filter((c) => ['acceptee', 'refusee', 'attente', 'sanssuite'].includes(c.statut)).length;
    const evs = evenements(cands, auj, reglages, { base });
    return {
      total: cands.length, actives: cands.filter(estActive).length, parStatut, parType, envoyees, reponses,
      aEnvoyer: aEnvoyer(cands, auj, reglages).length,
      depassees: cands.filter((c) => c.statut === 'preparer' && c.dates.limite && c.dates.limite < auj).length,
      entretiens: evs.filter((e) => e.nature === 'entretien' && e.jours >= 0).length,
      relances: evs.filter((e) => e.nature === 'relance' && e.due).length,
      manquantes: cands.filter((c) => c.statut === 'preparer').reduce((s, c) => s + avancement(c).manquantes, 0),
    };
  }

  // Statistiques des appels d'offres sur une période (repérage, ou date limite à défaut) : taux de go, taux de
  // réussite = gagnées ÷ (gagnées + perdues), montants, temps passé, par type, par motif de perte, par mois.
  const dateRef = (c) => c.creeLe || c.dates.limite || '';
  function compter(liste) {
    const n = (f) => liste.filter(f).length;
    const gagnees = liste.filter((c) => c.statut === 'acceptee');
    const perdues = n((c) => c.statut === 'refusee');
    const decidees = n((c) => c.statut !== 'reperee');
    const go = n(estGo);
    const montantGagne = gagnees.reduce((s, c) => s + (Number(c.montantObtenu ?? c.montantOffre) || 0), 0);
    const temps = liste.reduce((s, c) => s + (Number(c.temps) || 0), 0);
    const tempsGo = liste.filter(estGo).reduce((s, c) => s + (Number(c.temps) || 0), 0);
    return {
      total: liste.length, decidees, go, nogo: n((c) => c.statut === 'nogo'), deposees: n(estDepose), gagnees: gagnees.length, perdues,
      sansSuite: n((c) => c.statut === 'sanssuite'), enAttente: n((c) => ['envoyee', 'entretien'].includes(c.statut)), abandons: n((c) => c.statut === 'retiree'),
      tauxGo: decidees ? go / decidees : null,
      tauxReussite: gagnees.length + perdues ? gagnees.length / (gagnees.length + perdues) : null,
      montantGagne, montantMoyen: gagnees.length ? montantGagne / gagnees.length : null,
      temps: arrondi(temps), tempsMoyen: go ? arrondi(tempsGo / go, 1) : null,
      heuresParGain: gagnees.length ? arrondi(tempsGo / gagnees.length, 1) : null,
      euroParHeure: tempsGo ? Math.round(montantGagne / tempsGo) : null,
    };
  }
  function statistiques(cands, { depuis = null, types = [], motifs = [], aujourdhui = null, mois = 12 } = {}) {
    const liste = depuis ? cands.filter((c) => dateRef(c) >= depuis) : cands;
    const global = compter(liste);
    const parType = types.map((t) => ({ id: t.id, nom: t.nom, ...compter(liste.filter((c) => c.type === t.id)) })).filter((x) => x.total);
    const perdues = liste.filter((c) => c.statut === 'refusee');
    const parMotif = motifs.map((m) => ({ id: m.id, nom: m.nom, n: perdues.filter((c) => (c.motifPerte || 'inconnu') === m.id).length })).filter((m) => m.n);
    let parMoisListe = [];
    if (aujourdhui) {
      const fin = aujourdhui.slice(0, 7);
      parMoisListe = Array.from({ length: mois }, (_, i) => moisSuivant(fin, i - mois + 1)).map((m) => ({
        mois: m,
        deposees: cands.filter((c) => estDepose(c) && (c.dates.envoi || '').startsWith(m)).length,
        gagnees: cands.filter((c) => c.statut === 'acceptee' && (c.dates.recue || '').startsWith(m)).length,
        perdues: cands.filter((c) => c.statut === 'refusee' && (c.dates.recue || '').startsWith(m)).length,
      }));
    }
    return { global, parType, parMotif, parMois: parMoisListe };
  }

  // ---------- Recherche et filtres ----------
  function rechercher(cands, q, ctx = {}) {
    const mots = sansAccents(q).split(/[\s,;'’]+/).filter((m) => m.length > 1);
    if (!mots.length) return cands.slice();
    return cands.filter((c) => {
      const t = sansAccents([c.intitule, c.organisme, c.ville, c.contact, c.note, c.reference, c.source, ctx.nomType?.(c.type), ctx.nomStatut?.(c), ...c.pieces.map((x) => x.nom)].join(' '));
      return mots.every((m) => t.includes(m) || (m.length > 3 && t.includes(m.replace(/[sx]$/, ''))));
    });
  }
  // Ordre d'une liste : actives d'abord (prochaine date), puis réponses définitives (acceptées, liste d'attente…).
  function trier(cands, auj) {
    const prochaine = (c) => { const e = evenementsDe(c, auj)[0]; return e ? e.date : '9999-12-31'; };
    const rangStatut = (c) => STATUTS.indexOf(c.statut);
    return cands.slice().sort((a, b) => (estActive(b) - estActive(a)) || (estActive(a) ? (prochaine(a) < prochaine(b) ? -1 : prochaine(a) > prochaine(b) ? 1 : 0) : rangStatut(a) - rangStatut(b)) || a.organisme.localeCompare(b.organisme, 'fr'));
  }

  // ---------- Textes à composer ----------
  const remplacer = (modele, valeurs) => String(modele).replace(/\{([a-z0-9]+)\}/g, (_, k) => (valeurs[k] ? valeurs[k] : `[à compléter : ${k}]`));
  // Valeurs d'une trame pour une candidature : champs saisis, plus organisme, intitulé et signature repris.
  function valeursLettre(c, trame, profil = {}) {
    return { organisme: c.organisme, intitule: c.intitule, signature: profil.signature || profil.prenom || '', ...Object.fromEntries((trame?.champs || []).map((ch) => [ch.id, c.lettre?.champs?.[ch.id] || ''])) };
  }
  // Lettre composée : objet, paragraphes et champs encore vides (avec leur libellé).
  function composerLettre(c, trame, profil = {}) {
    if (!trame) return { objet: '', paragraphes: [], manquants: [], texte: '' };
    const v = valeursLettre(c, trame, profil);
    const libelles = { organisme: c.type === 'formation' ? 'Établissement' : 'Entreprise ou organisme', intitule: 'Intitulé de la candidature', signature: 'Signature (réglages)' };
    for (const ch of trame.champs) libelles[ch.id] = ch.lib;
    const utilises = new Set();
    for (const m of [trame.objet, ...trame.paragraphes].join(' ').matchAll(/\{([a-z0-9]+)\}/g)) utilises.add(m[1]);
    const manquants = [...utilises].filter((k) => !v[k]).map((k) => ({ id: k, lib: libelles[k] || k }));
    if (!v.signature) manquants.push({ id: 'signature', lib: libelles.signature });
    const objet = remplacer(trame.objet, v);
    const paragraphes = trame.paragraphes.map((p) => remplacer(p, v));
    const corps = ['Madame, Monsieur,', ...paragraphes, 'Veuillez agréer, Madame, Monsieur, l\'expression de mes salutations distinguées.', v.signature || '[à compléter : signature]'];
    return { objet, paragraphes, manquants, texte: `Objet : ${objet}\n\n${corps.join('\n\n')}` };
  }
  const trameConseillee = (base, c) => (base.trames.find((t) => t.type === c.type) || base.trames[0]).id;

  // raison « remerciement » (après un entretien) ou relance ordinaire (formation, appel d'offres ou autre).
  function messageRelance(base, c, profil = {}, formatDate = (s) => s, raison = '') {
    const merci = raison === 'remerciement';
    const modele = merci ? base.relances.remerciement : c.type === 'formation' ? base.relances.formation : estOffre(base, c) ? base.relances.offres : base.relances.autre;
    const date = merci ? c.dates.entretien : c.dates.envoi;
    return remplacer(modele, { organisme: c.organisme, intitule: c.intitule, date: date ? formatDate(date) : '', signature: profil.signature || profil.prenom || '' });
  }

  // ---------- Entretien ----------
  // Questions types proposées pour une candidature (toutes, ou celles de son type), groupées par thème.
  function questionsPour(base, type) {
    return base.themes.map((t) => ({ theme: t, questions: base.questions.filter((x) => x.theme === t.id && (!x.pour.length || x.pour.includes(type))) })).filter((g) => g.questions.length);
  }
  function preparation(c) {
    const qs = c.entretien.questions;
    return { total: qs.length, pretes: qs.filter((x) => x.prete || x.notes.trim().length >= 20).length };
  }

  // ---------- Export ----------
  const champCsv = (v) => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = (lignes) => '﻿' + lignes.map((l) => l.map(champCsv).join(';')).join('\r\n');
  const nombreCsv = (n) => (n === null || n === undefined || n === '' ? '' : String(n).replace('.', ','));
  // ctx : nomType, nomStatut(c) ; offres : colonnes des appels d'offres (référence, montants, score, temps) ajoutées.
  function versCsv(cands, ctx) {
    const tete = ['Rang', 'Type', 'Intitulé', 'Établissement, entreprise ou acheteur', 'Ville', 'Statut', 'Date limite', 'Envoyée le', 'Entretien', 'Réponse attendue', 'Réponse reçue', 'Pièces prêtes', 'Pièces manquantes', 'Relances', 'Contact', 'Lien', 'Note'];
    const plus = ['Référence', 'Source', 'Score go/no-go (%)', 'Montant estimé', 'Montant de l\'offre', 'Montant obtenu', 'Motif de perte', 'Temps passé (h)'];
    return csv([[...tete, ...(ctx.offres ? plus : [])], ...cands.map((c) => {
      const a = avancement(c);
      const l = [c.rang || '', ctx.nomType(c.type), c.intitule, c.organisme, c.ville, ctx.nomStatut(c), c.dates.limite || '', c.dates.envoi || '', c.dates.entretien ? `${c.dates.entretien}${c.dates.heure ? ` ${c.dates.heure}` : ''}` : '', c.dates.reponse || '', c.dates.recue || '', `${a.pretes}/${a.total}`, piecesManquantes(c).map((x) => x.nom).join(', '), c.relances.length, c.contact, c.lien, c.note];
      if (ctx.offres) {
        const s = Object.keys(c.grille || {}).length && ctx.criteres ? scoreGrille(ctx.criteres, c.grille).pct : '';
        l.push(c.reference, c.source, s ?? '', nombreCsv(c.montantEstime), nombreCsv(c.montantOffre), nombreCsv(c.montantObtenu), c.motifPerte ? ctx.nomMotif?.(c.motifPerte) || c.motifPerte : '', c.temps ? nombreCsv(c.temps) : '');
      }
      return l;
    })]);
  }

  // Calendrier iCalendar (RFC 5545) des échéances : événements « journée » (date limite, réponse, relance…)
  // ou à l'heure saisie (entretien, 1 h), heure locale flottante. Aucune donnée envoyée : fichier à importer.
  const echapIcs = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  // Pliage à 75 octets UTF-8 au plus par ligne (RFC 5545), sans couper un caractère (accent, emoji).
  const octets = (car) => { const c = car.codePointAt(0); return c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4; };
  const plie = (ligne) => {
    const out = []; let cur = '', n = 0;
    for (const car of ligne) {
      const o = octets(car);
      if (n + o > 75) { out.push(cur); cur = ' '; n = 1; }
      cur += car; n += o;
    }
    out.push(cur);
    return out.join('\r\n');
  };
  function versIcs(evs, ctx, horodatage) {
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//QME//Candidatures//FR', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Candidatures'];
    for (const e of evs) {
      const c = e.cand;
      const titre = `${ctx.nomNature(e)} · ${c.organisme || c.intitule}`;
      const jour = e.date.replace(/-/g, '');
      L.push('BEGIN:VEVENT', `UID:${e.id}-${jour}@candidatures.qme`, `DTSTAMP:${horodatage}`);
      if (e.nature === 'entretien' && e.heure) {
        const [h, m] = e.heure.split(':').map(Number);
        const fin = `${deux(Math.min(23, h + 1))}${deux(h + 1 > 23 ? 59 : m)}00`;
        L.push(`DTSTART:${jour}T${deux(h)}${deux(m)}00`, `DTEND:${jour}T${fin}`);
      } else {
        L.push(`DTSTART;VALUE=DATE:${jour}`, `DTEND;VALUE=DATE:${ajout(e.date, 1).replace(/-/g, '')}`);
      }
      L.push(plie(`SUMMARY:${echapIcs(titre)}`), plie(`DESCRIPTION:${echapIcs(`${c.intitule}${c.organisme ? ` · ${c.organisme}` : ''}`)}`), 'END:VEVENT');
    }
    L.push('END:VCALENDAR');
    return L.join('\r\n') + '\r\n';
  }

  racine.CAN = {
    ALERTE_DEFAUT, RELANCE_DEFAUT, URGENT, USAGES, TYPES, STATUTS, ACTIFS, STATUTS_PIECE, CANAUX, FORMATS, MESSAGES_SENSIBLES, REGLAGES_DEFAUT,
    iso, versDate, ajout, ecart, estDate, estHeure, jourSemaine, lundi, ouvreAvant, sansAccents, pluriel, montant, contientSecret, nouvelId, attendReponse,
    pieceDe, modeleDe, trameDe, questionDe, typeDe, familleDe, usageDe, statutsDe, nomStatut, estOffre, modeleParDefaut,
    normaliserPiece, piecesDuModele, piecesDuDossier, normaliserRelance, normaliserQuestion, normaliserCandidature, normaliserBiblio, etatVide, normaliser, depuisAppelsOffres,
    piecesUtiles, avancement, piecesManquantes, pieceSuivante, echeancePiece, depotVise, etatBiblio, etatPiece, scoreGrille,
    changerStatut, estActive, estGo, estDepose, decider, deposer, noterRelance, cloturer, ajouterTemps,
    dernierContact, relance, niveau, evenementsDe, evenements, regrouperPieces, aEnvoyer, aRenouveler, parMois, grilleMois, moisSuivant,
    classable, classement, appliquerOrdre, deplacer, retirerDuClassement, resserrer, bilan, statistiques, rechercher, trier,
    remplacer, valeursLettre, composerLettre, trameConseillee, messageRelance, questionsPour, preparation, versCsv, versIcs,
  };
})(typeof window !== 'undefined' ? window : globalThis);
