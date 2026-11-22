// Candidatures études, stages, alternance QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.CAN) et par les tests Node (vm).
// Dates locales « AAAA-MM-JJ » (comparables comme des chaînes), heures « HH:MM ».
(function (racine) {
  'use strict';

  const ALERTE_DEFAUT = 7; // jours avant une date limite : « à envoyer bientôt »
  const RELANCE_DEFAUT = 10; // jours sans nouvelles après un envoi : relance proposée
  const URGENT = 3; // jours : date limite urgente
  const TYPES = ['formation', 'stage', 'alternance', 'job'];
  const STATUTS = ['preparer', 'envoyee', 'entretien', 'attente', 'acceptee', 'refusee', 'retiree'];
  const ACTIFS = ['preparer', 'envoyee', 'entretien', 'attente'];
  const EN_ATTENTE_REPONSE = ['envoyee', 'entretien', 'attente'];
  // Une réponse est encore attendue : envoyée ou entretien sans réponse reçue, ou liste d'attente (la réponse
  // reçue est la mise en attente ; la date de réponse saisie est alors celle de la réponse définitive).
  const attendReponse = (c) => c.statut === 'attente' || (EN_ATTENTE_REPONSE.includes(c.statut) && !c.dates.recue);
  const STATUTS_PIECE = ['afaire', 'encours', 'prete', 'envoyee'];
  const CANAUX = ['email', 'telephone', 'site', 'place'];
  const FORMATS = ['presentiel', 'visio', 'telephone'];

  // ---------- Dates ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  const estHeure = (s) => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
  const dateOuNul = (s) => (estDate(s) ? s : null);

  // ---------- Textes ----------
  const sansAccents = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const pluriel = (n, s, p) => `${n} ${n > 1 ? (p || s + 's') : s}`;
  const texte = (v, max) => String(v ?? '').trim().slice(0, max);

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

  // ---------- Normalisation ----------
  const pieceDe = (base, id) => (base.pieces || []).find((x) => x.id === id) || null;
  const modeleDe = (base, id) => (base.modeles || []).find((x) => x.id === id) || null;
  const trameDe = (base, id) => (base.trames || []).find((x) => x.id === id) || null;
  const questionDe = (base, id) => (base.questions || []).find((x) => x.id === id) || null;
  const modeleParDefaut = (type) => ({ formation: 'master', stage: 'stage', alternance: 'alternance', job: 'job' }[type] || 'vide');

  function normaliserPiece(x, base) {
    const ref = x && x.ref ? pieceDe(base, x.ref) : null;
    return {
      id: String(x?.id || nouvelId()),
      ref: ref ? ref.id : null,
      nom: texte(x?.nom || ref?.nom || 'Pièce', 80) || 'Pièce',
      statut: STATUTS_PIECE.includes(x?.statut) ? x.statut : 'afaire',
      apres: x && typeof x.apres === 'boolean' ? x.apres : Boolean(ref?.apres),
      precision: texte(x?.precision, 120),
    };
  }
  const piecesDuModele = (base, idModele) => (modeleDe(base, idModele)?.pieces || []).map((id) => normaliserPiece({ ref: id }, base));

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
    const e = x?.entretien || {};
    const l = x?.lettre || {};
    const champs = {};
    if (l.champs && typeof l.champs === 'object') for (const [k, v] of Object.entries(l.champs)) if (/^[a-z0-9]{1,20}$/.test(k)) champs[k] = texte(v, 400);
    return {
      id: String(x?.id || nouvelId()),
      type,
      intitule: texte(x?.intitule, 120),
      organisme: texte(x?.organisme, 120),
      ville: texte(x?.ville, 60),
      contact: texte(x?.contact, 120),
      lien: /^https?:\/\/\S+$/i.test(String(x?.lien || '').trim()) ? String(x.lien).trim().slice(0, 300) : '',
      statut: STATUTS.includes(x?.statut) ? x.statut : 'preparer',
      rang: Number.isInteger(x?.rang) && x.rang > 0 ? x.rang : null,
      dates: {
        limite: dateOuNul(d.limite), envoi: dateOuNul(d.envoi), entretien: dateOuNul(d.entretien),
        heure: estHeure(d.heure) ? d.heure : '', reponse: dateOuNul(d.reponse), recue: dateOuNul(d.recue),
      },
      pieces: Array.isArray(x?.pieces) ? x.pieces.slice(0, 40).map((pc) => normaliserPiece(pc, base)) : [],
      relances: Array.isArray(x?.relances) ? x.relances.slice(0, 30).map(normaliserRelance).filter((r) => r.date).sort((a, b) => (a.date < b.date ? -1 : 1)) : [],
      entretien: {
        format: FORMATS.includes(e.format) ? e.format : 'presentiel',
        lieu: texte(e.lieu, 120),
        questions: Array.isArray(e.questions) ? e.questions.slice(0, 40).map((qq) => normaliserQuestion(qq, base)).filter((qq) => qq.texte) : [],
        notes: texte(e.notes, 2000),
      },
      lettre: { trame: trameDe(base, l.trame) ? l.trame : null, champs, texte: l.texte ? texte(l.texte, 6000) : '' },
      motif: texte(x?.motif, 200),
      note: texte(x?.note, 600),
      creeLe: dateOuNul(x?.creeLe),
    };
  }

  function etatVide() {
    return { version: 1, profil: { prenom: '', signature: '', campagne: '' }, reglages: { alerte: ALERTE_DEFAUT, relance: RELANCE_DEFAUT }, candidatures: [] };
  }
  function normaliser(d, base) {
    const e = etatVide();
    if (!d || typeof d !== 'object') return e;
    const pr = d.profil || {};
    e.profil = { prenom: texte(pr.prenom, 40), signature: texte(pr.signature, 80), campagne: texte(pr.campagne, 60) };
    const rg = d.reglages || {};
    const borne = (v, min, max, def) => (Number.isFinite(Number(v)) && Number(v) >= min && Number(v) <= max ? Math.round(Number(v)) : def);
    e.reglages = { alerte: borne(rg.alerte, 1, 30, ALERTE_DEFAUT), relance: borne(rg.relance, 3, 45, RELANCE_DEFAUT) };
    e.candidatures = Array.isArray(d.candidatures) ? d.candidatures.slice(0, 300).map((c) => normaliserCandidature(c, base)) : [];
    if (d.majLe) e.majLe = d.majLe;
    return e;
  }

  // ---------- Pièces ----------
  // Les pièces « après acceptation » (convention, contrat…) ne comptent qu'une fois la candidature acceptée.
  function piecesUtiles(c) { return c.pieces.filter((x) => !x.apres || c.statut === 'acceptee'); }
  function avancement(c) {
    const utiles = piecesUtiles(c);
    const pretes = utiles.filter((x) => x.statut === 'prete' || x.statut === 'envoyee').length;
    return { total: utiles.length, pretes, envoyees: utiles.filter((x) => x.statut === 'envoyee').length, manquantes: utiles.length - pretes, pct: utiles.length ? Math.round((pretes / utiles.length) * 100) : 100, apres: c.pieces.length - utiles.length };
  }
  const piecesManquantes = (c) => piecesUtiles(c).filter((x) => x.statut === 'afaire' || x.statut === 'encours');
  // Statut suivant d'une pièce au toucher : à faire → en cours → prête → envoyée → à faire.
  const pieceSuivante = (s) => STATUTS_PIECE[(STATUTS_PIECE.indexOf(s) + 1) % STATUTS_PIECE.length];

  // ---------- Statuts ----------
  // Changement de statut avec ses effets : à l'envoi, date d'envoi du jour (si vide) et pièces prêtes passées
  // « envoyées » ; à une réponse (acceptée, refusée, liste d'attente), date de réponse reçue du jour (si vide).
  function changerStatut(c, statut, auj) {
    if (!STATUTS.includes(statut)) return c;
    const n = JSON.parse(JSON.stringify(c));
    n.statut = statut;
    if (statut === 'envoyee') {
      if (!n.dates.envoi) n.dates.envoi = auj;
      n.pieces.forEach((x) => { if (x.statut === 'prete' && !x.apres) x.statut = 'envoyee'; });
    }
    if (['acceptee', 'refusee', 'attente'].includes(statut) && !n.dates.recue) n.dates.recue = auj;
    if (statut === 'preparer') n.dates.recue = null;
    return n;
  }
  const estActive = (c) => ACTIFS.includes(c.statut);

  // ---------- Relances ----------
  // Dernier contact : la dernière relance, sinon l'envoi. Relance proposée si la candidature attend une réponse,
  // qu'aucune réponse n'est reçue et que : la réponse attendue est dépassée, ou (hors formation, où l'établissement
  // annonce en général sa date) le délai sans nouvelles est atteint. Après un entretien passé : remerciement.
  function dernierContact(c) {
    const r = c.relances.length ? c.relances[c.relances.length - 1].date : null;
    const cand = [r, c.dates.envoi, c.statut === 'entretien' && c.dates.entretien ? c.dates.entretien : null, c.statut === 'attente' ? c.dates.recue : null].filter(Boolean).sort();
    return cand.length ? cand[cand.length - 1] : null;
  }
  function relance(c, auj, delai = RELANCE_DEFAUT) {
    if (!attendReponse(c)) return null;
    const dernier = dernierContact(c);
    if (c.dates.reponse && c.dates.reponse < auj && (!dernier || dernier <= c.dates.reponse)) return { date: ajout(c.dates.reponse, 1), raison: 'reponse', due: true, jours: ecart(c.dates.reponse, auj) };
    if (c.statut === 'entretien' && c.dates.entretien && c.dates.entretien < auj && !c.relances.some((r) => r.date >= c.dates.entretien)) {
      return { date: ajout(c.dates.entretien, 1), raison: 'remerciement', due: true, jours: ecart(c.dates.entretien, auj) };
    }
    if (c.statut === 'entretien' && c.dates.entretien && c.dates.entretien >= auj) return null; // entretien à venir
    if (c.type === 'formation' || !dernier) return null;
    if (c.dates.reponse && c.dates.reponse >= auj) return null; // date de réponse annoncée : on attend
    const date = ajout(dernier, delai);
    return { date, raison: 'delai', due: date <= auj, jours: ecart(dernier, auj) };
  }

  // ---------- Échéances ----------
  // Événements datés d'une candidature : date limite (à préparer), épreuve ou entretien, réponse attendue,
  // relance proposée. Niveau : depasse, urgent (≤ 3 jours), proche (≤ alerte), loin.
  function niveau(jours, alerte) { return jours < 0 ? 'depasse' : jours <= URGENT ? 'urgent' : jours <= alerte ? 'proche' : 'loin'; }
  function evenementsDe(c, auj, reglages = {}) {
    const alerte = reglages.alerte || ALERTE_DEFAUT;
    const out = [];
    const ev = (nature, date, extra = {}) => { const jours = ecart(auj, date); out.push({ id: `${c.id}-${nature}`, cand: c, nature, date, jours, niveau: niveau(jours, alerte), ...extra }); };
    if (c.statut === 'preparer' && c.dates.limite) ev('limite', c.dates.limite);
    if (c.dates.entretien && (c.statut === 'entretien' || (estActive(c) && c.dates.entretien >= auj))) ev('entretien', c.dates.entretien, { heure: c.dates.heure });
    if (attendReponse(c) && c.dates.reponse) ev('reponse', c.dates.reponse);
    const r = relance(c, auj, reglages.relance || RELANCE_DEFAUT);
    if (r) ev('relance', r.due ? auj : r.date, { raison: r.raison, due: r.due });
    return out;
  }
  // Tri : dates croissantes, à date égale limite > entretien > réponse > relance.
  const ORDRE_NATURE = { limite: 0, entretien: 1, reponse: 2, relance: 3 };
  function evenements(cands, auj, reglages = {}, { horizon = null } = {}) {
    return cands.flatMap((c) => evenementsDe(c, auj, reglages))
      .filter((e) => horizon === null || e.jours <= horizon)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (ORDRE_NATURE[a.nature] - ORDRE_NATURE[b.nature]) || (a.heure || '').localeCompare(b.heure || '')));
  }
  // Candidatures à préparer dont la date limite est passée, imminente (≤ alerte) ou absente, avec leurs pièces.
  function aEnvoyer(cands, auj, reglages = {}) {
    const alerte = reglages.alerte || ALERTE_DEFAUT;
    return cands.filter((c) => c.statut === 'preparer' && c.dates.limite && ecart(auj, c.dates.limite) <= alerte)
      .map((c) => ({ cand: c, jours: ecart(auj, c.dates.limite), av: avancement(c) }))
      .sort((a, b) => a.jours - b.jours);
  }

  // Regroupement par mois (« AAAA-MM ») pour l'onglet Échéances.
  function parMois(evs) {
    const g = new Map();
    for (const e of evs) { const k = e.date.slice(0, 7); if (!g.has(k)) g.set(k, []); g.get(k).push(e); }
    return [...g.entries()].map(([mois, liste]) => ({ mois, liste }));
  }

  // ---------- Classement des vœux ----------
  // Ordre de préférence personnel : candidatures encore en jeu ou acceptées, rang 1, 2, 3… ; les non classées
  // suivent. Les refusées et retirées sortent du classement.
  const classable = (c) => !['refusee', 'retiree'].includes(c.statut);
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
  function bilan(cands, auj, reglages = {}) {
    const parStatut = Object.fromEntries(STATUTS.map((s) => [s, 0]));
    const parType = Object.fromEntries(TYPES.map((t) => [t, 0]));
    for (const c of cands) { parStatut[c.statut]++; parType[c.type]++; }
    const envoyees = cands.filter((c) => c.statut !== 'preparer').length;
    const reponses = cands.filter((c) => ['acceptee', 'refusee', 'attente'].includes(c.statut)).length;
    const evs = evenements(cands, auj, reglages);
    return {
      total: cands.length, actives: cands.filter(estActive).length, parStatut, parType, envoyees, reponses,
      aEnvoyer: aEnvoyer(cands, auj, reglages).length,
      depassees: cands.filter((c) => c.statut === 'preparer' && c.dates.limite && c.dates.limite < auj).length,
      entretiens: evs.filter((e) => e.nature === 'entretien' && e.jours >= 0).length,
      relances: evs.filter((e) => e.nature === 'relance' && e.due).length,
      manquantes: cands.filter((c) => c.statut === 'preparer').reduce((s, c) => s + avancement(c).manquantes, 0),
    };
  }

  // ---------- Recherche et filtres ----------
  function rechercher(cands, q, ctx = {}) {
    const mots = sansAccents(q).split(/[\s,;'’]+/).filter((m) => m.length > 1);
    if (!mots.length) return cands.slice();
    return cands.filter((c) => {
      const t = sansAccents([c.intitule, c.organisme, c.ville, c.contact, c.note, ctx.nomType?.(c.type), ctx.nomStatut?.(c.statut), ...c.pieces.map((x) => x.nom)].join(' '));
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

  // raison « remerciement » (après un entretien) ou relance ordinaire (formation ou autre).
  function messageRelance(base, c, profil = {}, formatDate = (s) => s, raison = '') {
    const merci = raison === 'remerciement';
    const modele = merci ? base.relances.remerciement : c.type === 'formation' ? base.relances.formation : base.relances.autre;
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
  function versCsv(cands, ctx) {
    const tete = ['Rang', 'Type', 'Intitulé', 'Établissement ou entreprise', 'Ville', 'Statut', 'Date limite', 'Envoyée le', 'Entretien', 'Réponse attendue', 'Réponse reçue', 'Pièces prêtes', 'Pièces manquantes', 'Relances', 'Contact', 'Lien', 'Note'];
    return csv([tete, ...cands.map((c) => {
      const a = avancement(c);
      return [c.rang || '', ctx.nomType(c.type), c.intitule, c.organisme, c.ville, ctx.nomStatut(c.statut), c.dates.limite || '', c.dates.envoi || '', c.dates.entretien ? `${c.dates.entretien}${c.dates.heure ? ` ${c.dates.heure}` : ''}` : '', c.dates.reponse || '', c.dates.recue || '', `${a.pretes}/${a.total}`, piecesManquantes(c).map((x) => x.nom).join(', '), c.relances.length, c.contact, c.lien, c.note];
    })]);
  }

  // Calendrier iCalendar (RFC 5545) des échéances : événements « journée » (date limite, réponse, relance)
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
    ALERTE_DEFAUT, RELANCE_DEFAUT, URGENT, TYPES, STATUTS, ACTIFS, STATUTS_PIECE, CANAUX, FORMATS, MESSAGES_SENSIBLES,
    iso, versDate, ajout, ecart, estDate, estHeure, sansAccents, pluriel, contientSecret, nouvelId, attendReponse,
    pieceDe, modeleDe, trameDe, questionDe, modeleParDefaut, normaliserPiece, piecesDuModele, normaliserRelance,
    normaliserQuestion, normaliserCandidature, etatVide, normaliser,
    piecesUtiles, avancement, piecesManquantes, pieceSuivante, changerStatut, estActive,
    dernierContact, relance, niveau, evenementsDe, evenements, aEnvoyer, parMois,
    classable, classement, appliquerOrdre, deplacer, retirerDuClassement, resserrer, bilan, rechercher, trier,
    remplacer, valeursLettre, composerLettre, trameConseillee, messageRelance, questionsPour, preparation, versCsv, versIcs,
  };
})(typeof window !== 'undefined' ? window : globalThis);
