// Tableau de bord annuel et roue de vie QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.RDV) et par les tests Node (vm).
// Dates locales « AAAA-MM-JJ » (comparables comme des chaînes). Trimestres 1 à 4.
//
// État :
//  domaines  [{ id, nom, couleur, modele, questions[3], archive }]   8 actifs au plus (une couleur chacun)
//  revues    [{ id, date, annee, trimestre, type: 'initiale' | 'trimestrielle' | 'annuelle',
//               notes: { idDomaine: [n|null, n|null, n|null] }, bilan: { cle: texte }, priorites: [idDomaine],
//               avancement: { idObjectif: 0…1 } }]
//  objectifs [{ id, annee, domaine, titre, pourquoi, resultats: [{ id, titre, type: 'nombre'|'case',
//               depart, cible, actuel, unite, fait }] }]
//  actions   [{ id, annee, trimestre, domaine, objectif, titre, statut: 'afaire'|'encours'|'fait'|'abandon', reports }]
//  brouillon revue en cours (même forme qu'une revue + etape), ou null
(function (racine) {
  'use strict';

  const STATUTS = ['afaire', 'encours', 'fait', 'abandon'];
  const MAX_DOMAINES = 8;
  const FENETRE_REVUE = 21; // jours avant la fin du trimestre à partir desquels sa revue est proposée

  // ---------- Dates ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const anneeDe = (s) => Number(s.slice(0, 4));
  const trimestreDe = (s) => Math.floor((Number(s.slice(5, 7)) - 1) / 3) + 1;
  const debutTrimestre = (a, t) => `${a}-${deux((t - 1) * 3 + 1)}-01`;
  const finTrimestre = (a, t) => (t === 4 ? `${a}-12-31` : ajout(debutTrimestre(a, t + 1), -1));
  const trimestreSuivant = (a, t, k = 1) => { const n = a * 4 + (t - 1) + k; return { annee: Math.floor(n / 4), trimestre: (n % 4) + 1 }; };
  const rang = (a, t) => a * 4 + t; // pour comparer deux trimestres
  // Part de l'année écoulée au jour donné (0 au 1er janvier, 1 au 31 décembre) ; 0 ou 1 hors de l'année.
  function partAnnee(annee, jour) {
    if (anneeDe(jour) < annee) return 0;
    if (anneeDe(jour) > annee) return 1;
    const total = ecart(`${annee}-01-01`, `${annee}-12-31`);
    return ecart(`${annee}-01-01`, jour) / total;
  }

  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  // ---------- Nombres ----------
  // « 1,5 », « -2 », « 2 400 » → nombre arrondi au centième ; null si illisible.
  function lireNombre(saisie) {
    const s = String(saisie ?? '').trim().replace(/[\s  ]/g, '').replace(',', '.');
    if (!/^-?(\d+(\.\d+)?|\.\d+)$/.test(s)) return null;
    return Math.round(Number(s) * 100) / 100;
  }
  const nombreTexte = (n) => (n === null || n === undefined || Number.isNaN(n) ? '' : Number(n).toLocaleString('fr-FR', { maximumFractionDigits: 2 }));
  const arrondi1 = (x) => Math.round(x * 10) / 10;
  const borne = (x, a, b) => Math.min(b, Math.max(a, x));

  // ---------- Roue de vie ----------
  const noteValide = (n) => typeof n === 'number' && n >= 0 && n <= 10;
  // Note d'un domaine : moyenne des questions répondues, au dixième ; null si aucune.
  function noteDomaine(reponses) {
    const v = (reponses || []).filter(noteValide);
    return v.length ? arrondi1(v.reduce((s, x) => s + x, 0) / v.length) : null;
  }
  const domainesActifs = (e) => e.domaines.filter((d) => !d.archive);
  // Notes de la roue pour une revue : [{ id, note }] dans l'ordre des domaines actifs.
  const notesRoue = (e, revue) => domainesActifs(e).map((d) => ({ id: d.id, note: revue ? noteDomaine(revue.notes?.[d.id]) : null }));
  // Équilibre : moyenne des domaines notés, au dixième ; null si rien n'est noté.
  function equilibre(e, revue) {
    const v = notesRoue(e, revue).map((x) => x.note).filter((n) => n !== null);
    return v.length ? arrondi1(v.reduce((s, x) => s + x, 0) / v.length) : null;
  }
  // Écart entre la note la plus haute et la plus basse : plus il est petit, plus la roue est ronde.
  function ecartRoue(e, revue) {
    const v = notesRoue(e, revue).map((x) => x.note).filter((n) => n !== null);
    return v.length > 1 ? arrondi1(Math.max(...v) - Math.min(...v)) : null;
  }
  // Variation par domaine entre deux revues : { id: delta | null }.
  function variations(e, revue, precedente) {
    const r = {};
    for (const d of domainesActifs(e)) {
      const a = revue ? noteDomaine(revue.notes?.[d.id]) : null;
      const b = precedente ? noteDomaine(precedente.notes?.[d.id]) : null;
      r[d.id] = a === null || b === null ? null : arrondi1(a - b);
    }
    return r;
  }
  // Domaines à prioriser : les plus basses notes d'abord (à note égale, la plus forte baisse), `n` au plus.
  function domainesFaibles(e, revue, precedente, n = 3) {
    const v = variations(e, revue, precedente);
    return notesRoue(e, revue).filter((x) => x.note !== null)
      .sort((a, b) => a.note - b.note || (v[a.id] ?? 0) - (v[b.id] ?? 0))
      .slice(0, n).map((x) => x.id);
  }

  // ---------- Revues ----------
  const revuesTriees = (e) => [...e.revues].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : rang(a.annee, a.trimestre) - rang(b.annee, b.trimestre)));
  const derniereRevue = (e) => revuesTriees(e).at(-1) || null;
  const revuePrecedente = (e, revue) => { const l = revuesTriees(e); const i = l.findIndex((r) => r.id === revue?.id); return i > 0 ? l[i - 1] : null; };
  const revueDe = (e, annee, trimestre) => e.revues.find((r) => r.annee === annee && r.trimestre === trimestre && r.type !== 'initiale') || null;

  // Un trimestre est « couvert » dès qu'une revue (point de départ compris) porte sur lui ou sur un trimestre suivant.
  const couvert = (e, annee, trimestre) => e.revues.some((r) => rang(r.annee, r.trimestre) >= rang(annee, trimestre));
  const ouvertureRevue = (annee, trimestre) => ajout(finTrimestre(annee, trimestre), -(FENETRE_REVUE - 1));

  // Trimestre que la revue faite ce jour-là doit couvrir : le précédent s'il n'est pas couvert alors que le
  // suivi avait commencé, sinon le trimestre en cours (revue en avance ou dans ses 21 derniers jours).
  function periodeRevue(e, jour) {
    const a = anneeDe(jour), t = trimestreDe(jour);
    const p = trimestreSuivant(a, t, -1);
    const premiere = revuesTriees(e)[0];
    if (premiere && premiere.date <= finTrimestre(p.annee, p.trimestre) && !couvert(e, p.annee, p.trimestre)) return p;
    return { annee: a, trimestre: t };
  }
  const typeRevue = (e, periode) => (!e.revues.length ? 'initiale' : periode.trimestre === 4 ? 'annuelle' : 'trimestrielle');

  // Prochaine revue : { annee, trimestre, date (fin du trimestre), ouverture, due, enRetard (jours), premiere }.
  // Sans aucune revue : le point de départ est dû tout de suite.
  function prochaineRevue(e, jour) {
    if (!e.revues.length) return { annee: anneeDe(jour), trimestre: trimestreDe(jour), date: jour, ouverture: jour, due: true, enRetard: 0, premiere: true };
    const p = periodeRevue(e, jour);
    const a = anneeDe(jour), t = trimestreDe(jour);
    if (rang(p.annee, p.trimestre) < rang(a, t)) {
      const fin = finTrimestre(p.annee, p.trimestre);
      return { ...p, date: fin, ouverture: ouvertureRevue(p.annee, p.trimestre), due: true, enRetard: ecart(fin, jour), premiere: false };
    }
    const cible = couvert(e, a, t) ? trimestreSuivant(a, t) : { annee: a, trimestre: t };
    const ouverture = ouvertureRevue(cible.annee, cible.trimestre);
    return { ...cible, date: finTrimestre(cible.annee, cible.trimestre), ouverture, due: jour >= ouverture, enRetard: 0, premiere: false };
  }

  // ---------- Objectifs et résultats clés ----------
  // Avancement d'un résultat clé, de 0 à 1. Nombre : du départ vers la cible, dans les deux sens
  // (une cible plus basse que le départ se lit « réduire à ») ; dépassement plafonné à 1.
  function avancementResultat(r) {
    if (!r) return null;
    if (r.type === 'case') return r.fait ? 1 : 0;
    const d = Number(r.depart), c = Number(r.cible), a = r.actuel === null || r.actuel === undefined || r.actuel === '' ? d : Number(r.actuel);
    if (![d, c, a].every(Number.isFinite)) return null;
    if (c === d) return a === c ? 1 : 0;
    return borne((a - d) / (c - d), 0, 1);
  }
  // Avancement d'un objectif : moyenne de ses résultats clés ; null sans résultat clé.
  function avancementObjectif(o) {
    const v = (o.resultats || []).map(avancementResultat).filter((x) => x !== null);
    return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
  }
  const pourcent = (x) => (x === null || x === undefined ? null : Math.round(x * 100));
  const objectifsDe = (e, annee) => e.objectifs.filter((o) => o.annee === annee);

  // Statut d'un objectif au jour donné, comparé à la part de l'année écoulée :
  // atteint (100 %), « en avance ou dans les temps », « à surveiller » (jusqu'à 15 points de retard),
  // « en retard », « non atteint » (année finie), « à préciser » (sans résultat clé).
  function statutObjectif(o, jour) {
    const av = avancementObjectif(o);
    if (av === null) return 'apreciser';
    if (av >= 1) return 'atteint';
    if (anneeDe(jour) > o.annee) return 'nonatteint';
    const attendu = partAnnee(o.annee, jour);
    if (av >= attendu) return 'bonnevoie';
    if (av >= attendu - 0.15) return 'surveiller';
    return 'retard';
  }

  // Score de l'année : avancement moyen des objectifs de l'année (0 à 100) ; null sans objectif mesurable.
  function scoreAnnee(e, annee) {
    const v = objectifsDe(e, annee).map(avancementObjectif).filter((x) => x !== null);
    return v.length ? pourcent(v.reduce((s, x) => s + x, 0) / v.length) : null;
  }
  // Score attendu à date si l'on avançait au même rythme toute l'année.
  const scoreAttendu = (annee, jour) => Math.round(partAnnee(annee, jour) * 100);

  // Photo de l'avancement des objectifs, gardée dans chaque revue (pour la courbe de l'année).
  function photoAvancement(e, annee) {
    const r = {};
    for (const o of objectifsDe(e, annee)) { const a = avancementObjectif(o); if (a !== null) r[o.id] = Math.round(a * 1000) / 1000; }
    return r;
  }

  // Nouvel objectif depuis un modèle de la base (résultats clés copiés, valeur actuelle = départ).
  function objectifDepuisModele(m, domaine, annee) {
    return {
      id: nouvelId(), annee, domaine, titre: m.titre, pourquoi: m.pourquoi || '',
      resultats: m.resultats.map((r) => normaliserResultat({ ...r, id: nouvelId(), actuel: r.type === 'nombre' ? r.depart ?? 0 : null })),
    };
  }
  // Reprise des objectifs non atteints d'une année dans la suivante : nouvelle copie dont le point de départ
  // est la valeur atteinte ; les résultats clés « case » déjà faits ne sont pas repris. Jamais deux fois.
  function reprendreObjectifs(e, de, vers) {
    const deja = new Set(objectifsDe(e, vers).map((o) => o.repris).filter(Boolean));
    const copies = objectifsDe(e, de).filter((o) => (avancementObjectif(o) ?? 0) < 1 && !deja.has(o.id)).map((o) => ({
      id: nouvelId(), annee: vers, domaine: o.domaine, titre: o.titre, pourquoi: o.pourquoi, repris: o.id,
      resultats: o.resultats.filter((r) => !(r.type === 'case' && r.fait) && avancementResultat(r) < 1).map((r) => (r.type === 'case'
        ? { ...r, id: nouvelId(), fait: false }
        : { ...r, id: nouvelId(), depart: r.actuel ?? r.depart, actuel: r.actuel ?? r.depart })),
    }));
    e.objectifs.push(...copies);
    return copies.length;
  }

  function verifierObjectif(o) {
    if (!String(o.titre || '').trim()) return 'Donne un nom à ton objectif.';
    for (const r of o.resultats || []) {
      if (!String(r.titre || '').trim()) return 'Chaque résultat clé a besoin d\'un intitulé.';
      if (r.type === 'nombre' && (!Number.isFinite(r.depart) || !Number.isFinite(r.cible))) return `« ${r.titre} » : indique un point de départ et une cible chiffrés.`;
      if (r.type === 'nombre' && r.depart === r.cible) return `« ${r.titre} » : la cible doit être différente du point de départ.`;
    }
    return null;
  }

  // ---------- Actions trimestrielles ----------
  const actionsDu = (e, annee, trimestre) => e.actions.filter((x) => x.annee === annee && x.trimestre === trimestre);
  const ouverte = (x) => x.statut === 'afaire' || x.statut === 'encours';
  // Actions ouvertes laissées dans un trimestre passé.
  const actionsEnRetard = (e, jour) => { const r = rang(anneeDe(jour), trimestreDe(jour)); return e.actions.filter((x) => ouverte(x) && rang(x.annee, x.trimestre) < r); };
  // Avancement des actions d'un trimestre : faites sur le total hors abandons.
  function avancementActions(e, annee, trimestre) {
    const l = actionsDu(e, annee, trimestre).filter((x) => x.statut !== 'abandon');
    const faites = l.filter((x) => x.statut === 'fait').length;
    return { faites, total: l.length, taux: l.length ? Math.round((faites / l.length) * 100) : null };
  }
  // Reporter une action au trimestre suivant (ou au trimestre donné) : compteur de reports.
  function reporter(x, vers) {
    const v = vers || trimestreSuivant(x.annee, x.trimestre);
    x.annee = v.annee; x.trimestre = v.trimestre; x.reports = (x.reports || 0) + 1;
    if (x.statut === 'fait' || x.statut === 'abandon') x.statut = 'afaire';
    return x;
  }
  // Cycle du bouton d'état : à faire → en cours → fait → à faire.
  const statutSuivant = (s) => ({ afaire: 'encours', encours: 'fait', fait: 'afaire', abandon: 'afaire' }[s] || 'afaire');

  // ---------- Évolution ----------
  // Une ligne par revue : date, libellé, équilibre, notes par domaine, score des objectifs à la date.
  function evolution(e) {
    return revuesTriees(e).map((r) => {
      const av = Object.values(r.avancement || {});
      return {
        id: r.id, date: r.date, annee: r.annee, trimestre: r.trimestre, type: r.type,
        libelle: libelleRevue(r), equilibre: equilibre(e, r),
        notes: Object.fromEntries(domainesActifs(e).map((d) => [d.id, noteDomaine(r.notes?.[d.id])])),
        score: av.length ? pourcent(av.reduce((s, x) => s + x, 0) / av.length) : null,
      };
    });
  }
  const libelleRevue = (r) => (r.type === 'initiale' ? 'Point de départ' : r.type === 'annuelle' ? `Bilan ${r.annee}` : `T${r.trimestre} ${r.annee}`);
  const libelleCourt = (r) => (r.type === 'initiale' ? 'Départ' : `T${r.trimestre} ${String(r.annee).slice(2)}`);

  // ---------- Domaines ----------
  // Ajoute des domaines de la base (couleurs libres dans l'ordre fixe) ; renvoie le nombre ajouté.
  function ajouterDomaines(e, ids, base) {
    let n = 0;
    for (const id of ids) {
      const m = base.domaines.find((d) => d.id === id);
      if (!m || domainesActifs(e).length >= MAX_DOMAINES) continue;
      const existant = e.domaines.find((d) => d.modele === id);
      if (existant) { if (existant.archive) { existant.archive = false; n++; } continue; }
      const prises = new Set(domainesActifs(e).map((d) => d.couleur));
      const couleur = base.couleurs.map((c) => c.id).find((c) => !prises.has(c));
      e.domaines.push({ id: m.id, modele: m.id, nom: m.nom, couleur, questions: [...m.questions], archive: false });
      n++;
    }
    return n;
  }
  const couleurLibre = (e, base) => { const prises = new Set(domainesActifs(e).map((d) => d.couleur)); return base.couleurs.map((c) => c.id).find((c) => !prises.has(c)) || null; };

  // ---------- Texte du bilan (à copier) ----------
  function texteBilan(e, base, annee, jour) {
    const revuesAn = revuesTriees(e).filter((r) => r.annee === annee && r.type !== 'initiale');
    const derniere = revuesAn.at(-1) || derniereRevue(e);
    const lignes = [`Mon année ${annee} (au ${versDate(jour).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })})`];
    const eq = equilibre(e, derniere);
    if (eq !== null) lignes.push(`Roue de vie : ${nombreTexte(eq)}/10 en moyenne (${libelleRevue(derniere)})`);
    for (const { id, note } of notesRoue(e, derniere)) if (note !== null) lignes.push(`- ${e.domaines.find((d) => d.id === id).nom} : ${nombreTexte(note)}/10`);
    const sc = scoreAnnee(e, annee);
    lignes.push('', `Objectifs : ${sc === null ? '–' : `${sc} %`} d'avancement moyen`);
    for (const o of objectifsDe(e, annee)) lignes.push(`- ${o.titre} : ${pourcent(avancementObjectif(o)) ?? '–'} %`);
    const faites = e.actions.filter((x) => x.annee === annee && x.statut === 'fait').length;
    lignes.push('', `Actions faites dans l'année : ${faites}`);
    const questions = [...base.bilan.trimestrielle, ...base.bilan.annuelle];
    if (derniere?.bilan) for (const [cle, q] of questions) if (derniere.bilan[cle]) lignes.push('', q, derniere.bilan[cle]);
    return lignes.join('\n');
  }

  // Export CSV des notes (une ligne par revue, une colonne par domaine).
  function versCsv(e) {
    const ds = domainesActifs(e);
    const cel = (v) => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const tete = ['Date', 'Revue', ...ds.map((d) => d.nom), 'Moyenne', 'Objectifs (%)'];
    const lignes = evolution(e).map((l) => [l.date, l.libelle, ...ds.map((d) => (l.notes[d.id] === null ? '' : String(l.notes[d.id]).replace('.', ','))), l.equilibre === null ? '' : String(l.equilibre).replace('.', ','), l.score ?? '']);
    return [tete, ...lignes].map((l) => l.map(cel).join(';')).join('\r\n');
  }

  // ---------- Normalisation (tolère les anciennes versions et les saisies partielles) ----------
  function normaliserResultat(r) {
    const type = r.type === 'case' ? 'case' : 'nombre';
    const num = (v, d = 0) => (Number.isFinite(Number(v)) && v !== '' && v !== null ? Number(v) : d);
    return type === 'case'
      ? { id: r.id || nouvelId(), titre: String(r.titre || ''), type, fait: Boolean(r.fait) }
      : { id: r.id || nouvelId(), titre: String(r.titre || ''), type, depart: num(r.depart), cible: num(r.cible, 1), actuel: num(r.actuel, num(r.depart)), unite: String(r.unite || '') };
  }
  function normaliserEtat(d, jour, base) {
    const v = { version: 1, prenom: '', domaines: [], revues: [], objectifs: [], actions: [], brouillon: null };
    if (!d || typeof d !== 'object') return v;
    const couleurs = base ? base.couleurs.map((c) => c.id) : [];
    const domaines = (Array.isArray(d.domaines) ? d.domaines : []).filter((x) => x && x.id).map((x, i) => ({
      id: String(x.id), modele: x.modele || null, nom: String(x.nom || 'Domaine'),
      couleur: couleurs.includes(x.couleur) || !couleurs.length ? x.couleur : couleurs[i % couleurs.length],
      questions: Array.isArray(x.questions) && x.questions.length ? x.questions.map(String).slice(0, 3) : ['Je suis satisfait(e) de ce domaine.'],
      archive: Boolean(x.archive),
    }));
    const revues = (Array.isArray(d.revues) ? d.revues : []).filter((r) => r && /^\d{4}-\d{2}-\d{2}$/.test(r.date)).map((r) => ({
      id: r.id || nouvelId(), date: r.date, annee: Number(r.annee) || anneeDe(r.date), trimestre: borne(Number(r.trimestre) || trimestreDe(r.date), 1, 4),
      type: ['initiale', 'trimestrielle', 'annuelle'].includes(r.type) ? r.type : 'trimestrielle',
      notes: Object.fromEntries(Object.entries(r.notes || {}).map(([k, l]) => [k, (Array.isArray(l) ? l : []).map((n) => (noteValide(n) ? n : null))])),
      bilan: { ...(r.bilan || {}) }, priorites: Array.isArray(r.priorites) ? r.priorites.slice(0, 3) : [], avancement: { ...(r.avancement || {}) },
    }));
    const objectifs = (Array.isArray(d.objectifs) ? d.objectifs : []).filter((o) => o && o.titre).map((o) => ({
      ...o, id: o.id || nouvelId(), annee: Number(o.annee) || anneeDe(jour), domaine: o.domaine || null, titre: String(o.titre), pourquoi: String(o.pourquoi || ''),
      resultats: (Array.isArray(o.resultats) ? o.resultats : []).map(normaliserResultat),
    }));
    const actions = (Array.isArray(d.actions) ? d.actions : []).filter((x) => x && x.titre).map((x) => ({
      id: x.id || nouvelId(), annee: Number(x.annee) || anneeDe(jour), trimestre: borne(Number(x.trimestre) || trimestreDe(jour), 1, 4),
      domaine: x.domaine || null, objectif: x.objectif || null, titre: String(x.titre), statut: STATUTS.includes(x.statut) ? x.statut : 'afaire', reports: Number(x.reports) || 0,
    }));
    return { ...v, ...d, prenom: String(d.prenom || ''), domaines, revues, objectifs, actions, brouillon: d.brouillon && typeof d.brouillon === 'object' ? d.brouillon : null };
  }

  racine.RDV = {
    STATUTS, MAX_DOMAINES, FENETRE_REVUE,
    iso, versDate, ajout, ecart, anneeDe, trimestreDe, debutTrimestre, finTrimestre, trimestreSuivant, rang, partAnnee, nouvelId,
    lireNombre, nombreTexte, arrondi1,
    noteValide, noteDomaine, domainesActifs, notesRoue, equilibre, ecartRoue, variations, domainesFaibles,
    revuesTriees, derniereRevue, revuePrecedente, revueDe, couvert, ouvertureRevue, periodeRevue, typeRevue, prochaineRevue, libelleRevue, libelleCourt,
    avancementResultat, avancementObjectif, pourcent, objectifsDe, statutObjectif, scoreAnnee, scoreAttendu, photoAvancement,
    objectifDepuisModele, reprendreObjectifs, verifierObjectif, normaliserResultat,
    actionsDu, ouverte, actionsEnRetard, avancementActions, reporter, statutSuivant,
    evolution, ajouterDomaines, couleurLibre, texteBilan, versCsv, normaliserEtat,
  };
})(typeof window !== 'undefined' ? window : globalThis);
