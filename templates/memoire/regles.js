// Planning de mémoire ou de thèse QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.MMR) et par les tests Node (outils/templates/memoire.test.mjs).
// Dates locales « AAAA-MM-JJ ». Tout ce qui dépend du jour présent reçoit `auj` en paramètre.
// Plan hiérarchique : parties (niveau 1), chapitres (2), sections (3). Les mots se saisissent par élément (recopiés
// du traitement de texte) ; un élément qui a des enfants totalise ses mots et les leurs. Le total du jour est relevé
// chaque jour (`releves`) : il donne la courbe d'avancement et le rythme réel.
(function (g) {
  'use strict';

  // ---------- Dates et textes ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = String(s).slice(0, 10).split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const dateFrLongue = (s) => { const d = versDate(s); return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`; };
  const dateFr = (s) => { const d = versDate(s); return `${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`; };
  const dateNum = (s) => (estDate(s) ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '');
  function nombreTexte(n, decimales = 0) {
    const v = Number(n) || 0;
    const f = Math.pow(10, decimales);
    const r = Math.round(Math.abs(v) * f) / f;
    const [ent, dec] = r.toFixed(decimales).split('.');
    const groupes = ent.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return `${v < 0 && r !== 0 ? '−' : ''}${groupes}${dec && Number(dec) ? `,${dec.replace(/0+$/, '')}` : ''}`;
  }
  function dureeTexte(minutes) {
    const n = Math.round(Math.abs(Number(minutes) || 0));
    if (n < 60) return `${n} min`;
    const h = Math.floor(n / 60), r = n % 60;
    return `${h} h${r ? ` ${deux(r)}` : ''}`;
  }
  const plat = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36).slice(-5)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

  // ---------- Référentiels ----------
  const STATUTS = { aecrire: 'À écrire', brouillon: 'Brouillon', relu: 'Relu', final: 'Final' };
  const POIDS = { aecrire: 0, brouillon: 0.5, relu: 0.8, final: 1 };
  const ORDRE_STATUTS = ['aecrire', 'brouillon', 'relu', 'final'];
  const NIVEAUX = { 1: 'Partie', 2: 'Chapitre', 3: 'Section' };
  const LECTURE = { alire: 'À lire', encours: 'En cours', lu: 'Lu' };
  const MODES = { presentiel: 'En présentiel', visio: 'En visio', telephone: 'Au téléphone', ecrit: 'Par écrit' };
  const ANCRES = { rendu: 'date de rendu', soutenance: 'soutenance', date: 'date fixée' };

  // ---------- Normalisation ----------
  const txt = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
  const txtLong = (v, max) => String(v ?? '').replace(/\r\n?/g, '\n').trim().slice(0, max);
  const ent = (v, min, max, def = min) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def; };
  const idOk = (v) => (typeof v === 'string' && /^[\w-]{1,40}$/.test(v) ? v : nouvelId());
  const dateOk = (v) => (estDate(v) ? v : '');

  function normaliserProjet(p, base) {
    const type = base?.types?.[p?.type] ? p.type : 'master';
    const jours = Array.isArray(p?.joursTravail) ? [...new Set(p.joursTravail.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort() : [1, 2, 3, 4, 5];
    return {
      type,
      titre: txt(p?.titre, 200),
      discipline: txt(p?.discipline, 120),
      etablissement: txt(p?.etablissement, 120),
      directeur: txt(p?.directeur, 100),
      debut: dateOk(p?.debut),
      rendu: dateOk(p?.rendu),
      soutenance: dateOk(p?.soutenance),
      objectifMots: ent(p?.objectifMots, 0, 2000000, 0),
      motsParPage: ent(p?.motsParPage, 50, 2000, base?.motsParPage || 300),
      joursTravail: jours.length ? jours : [1, 2, 3, 4, 5],
    };
  }
  function normaliserSection(s) {
    return {
      id: idOk(s?.id),
      parent: typeof s?.parent === 'string' ? s.parent : '',
      niveau: ent(s?.niveau, 1, 3, 2),
      titre: txt(s?.titre, 160) || 'Sans titre',
      statut: STATUTS[s?.statut] ? s.statut : 'aecrire',
      mots: ent(s?.mots, 0, 2000000, 0),
      objectif: ent(s?.objectif, 0, 2000000, 0),
      note: txtLong(s?.note, 2000),
      ordre: ent(s?.ordre, 0, 100000, 0),
    };
  }
  function normaliserJalon(j) {
    const ancre = ANCRES[j?.ancre] ? j.ancre : 'rendu';
    const o = { id: idOk(j?.id), nom: txt(j?.nom, 140) || 'Jalon', ancre, decalage: ent(j?.decalage, -3650, 3650, 0), date: dateOk(j?.date), fait: dateOk(j?.fait), fin: !!j?.fin, note: txtLong(j?.note, 1000) };
    if (ancre === 'date' && !o.date) o.ancre = 'rendu';
    return o;
  }
  function normaliserAction(a) { return { id: idOk(a?.id), texte: txt(a?.texte, 300) || 'Action', echeance: dateOk(a?.echeance), faite: dateOk(a?.faite) }; }
  function normaliserRdv(r) {
    return {
      id: idOk(r?.id), date: dateOk(r?.date) || '2000-01-01', mode: MODES[r?.mode] ? r.mode : 'presentiel',
      points: txtLong(r?.points, 4000), notes: txtLong(r?.notes, 4000),
      actions: Array.isArray(r?.actions) ? r.actions.slice(0, 60).map(normaliserAction) : [],
    };
  }
  function normaliserRef(r) {
    return {
      id: idOk(r?.id), auteurs: txt(r?.auteurs, 400), annee: txt(r?.annee, 12), titre: txt(r?.titre, 400) || 'Sans titre',
      source: txt(r?.source, 300), type: txt(r?.type, 40) || 'Article', url: /^https?:\/\/\S+$/i.test(String(r?.url || '').trim()) ? String(r.url).trim().slice(0, 500) : '',
      consulte: dateOk(r?.consulte), statut: LECTURE[r?.statut] ? r.statut : 'alire', notes: txtLong(r?.notes, 4000),
      sections: Array.isArray(r?.sections) ? [...new Set(r.sections.filter((x) => typeof x === 'string'))].slice(0, 40) : [],
      ajoute: dateOk(r?.ajoute),
    };
  }
  function normaliserSeance(s) {
    return { id: idOk(s?.id), date: dateOk(s?.date) || '2000-01-01', minutes: ent(s?.minutes, 0, 1440, 0), mots: ent(s?.mots, -200000, 200000, 0), section: typeof s?.section === 'string' ? s.section : '', note: txtLong(s?.note, 1000) };
  }
  const etatVide = (base) => ({ version: 1, projet: normaliserProjet({}, base), sections: [], jalons: [], rdv: [], refs: [], seances: [], releves: [] });

  // Parent inconnu, boucle ou parent trop profond : l'élément remonte à la racine ; niveaux recalculés.
  function reparerArbre(sections) {
    const parId = new Map(sections.map((s) => [s.id, s]));
    for (const s of sections) {
      if (s.parent === s.id || (s.parent && !parId.has(s.parent))) s.parent = '';
      const vus = new Set([s.id]);
      let p = s.parent;
      while (p) { if (vus.has(p)) { s.parent = ''; break; } vus.add(p); p = parId.get(p)?.parent || ''; }
    }
    const fixer = (parent, niveauParent) => {
      for (const s of sections.filter((x) => x.parent === parent)) {
        if (parent) s.niveau = Math.min(3, niveauParent + 1); else if (s.niveau > 2) s.niveau = 2;
        fixer(s.id, s.niveau);
      }
    };
    fixer('', 0);
    return sections;
  }

  function normaliser(d, base) {
    const e = etatVide(base);
    if (!d || typeof d !== 'object') return e;
    e.projet = normaliserProjet(d.projet, base);
    e.sections = reparerArbre(Array.isArray(d.sections) ? d.sections.slice(0, 600).map(normaliserSection) : []);
    e.jalons = Array.isArray(d.jalons) ? d.jalons.slice(0, 120).map(normaliserJalon) : [];
    e.rdv = Array.isArray(d.rdv) ? d.rdv.slice(0, 300).map(normaliserRdv).sort((a, b) => a.date.localeCompare(b.date)) : [];
    e.refs = Array.isArray(d.refs) ? d.refs.slice(0, 1500).map(normaliserRef) : [];
    const ids = new Set(e.sections.map((s) => s.id));
    e.refs.forEach((r) => { r.sections = r.sections.filter((x) => ids.has(x)); });
    e.seances = Array.isArray(d.seances) ? d.seances.slice(0, 5000).map(normaliserSeance).map((s) => (ids.has(s.section) ? s : { ...s, section: '' })).sort((a, b) => a.date.localeCompare(b.date)) : [];
    const rel = new Map();
    if (Array.isArray(d.releves)) for (const r of d.releves) if (estDate(r?.date)) rel.set(r.date, ent(r.mots, 0, 5000000, 0));
    e.releves = [...rel].sort((a, b) => a[0].localeCompare(b[0])).slice(-3000).map(([date, mots]) => ({ date, mots }));
    if (typeof d.majLe === 'string') e.majLe = d.majLe;
    return e;
  }
  const taille = (e) => new TextEncoder().encode(JSON.stringify(e)).length;

  // ---------- Plan ----------
  const enfants = (etat, parent) => etat.sections.filter((s) => s.parent === (parent || '')).sort((a, b) => a.ordre - b.ordre);
  const descendants = (etat, id) => enfants(etat, id).flatMap((s) => [s, ...descendants(etat, s.id)]);
  // Liste à plat dans l'ordre de lecture, avec la profondeur (0 à la racine).
  function arbre(etat) {
    const out = [];
    const visiter = (parent, prof) => { for (const s of enfants(etat, parent)) { out.push({ s, prof, nbEnfants: enfants(etat, s.id).length }); visiter(s.id, prof + 1); } };
    visiter('', 0);
    return out;
  }
  const feuilles = (etat) => etat.sections.filter((s) => !etat.sections.some((x) => x.parent === s.id));
  function motsSection(etat, id) { const s = etat.sections.find((x) => x.id === id); return s ? s.mots + enfants(etat, id).reduce((t, x) => t + motsSection(etat, x.id), 0) : 0; }
  function objectifSection(etat, id) {
    const s = etat.sections.find((x) => x.id === id);
    if (!s) return 0;
    if (s.objectif) return s.objectif;
    return enfants(etat, id).reduce((t, x) => t + objectifSection(etat, x.id), 0);
  }
  const totalMots = (etat) => enfants(etat, '').reduce((t, s) => t + motsSection(etat, s.id), 0);
  // Statut d'un élément qui a des enfants : le moins avancé de ses éléments terminaux.
  function statutAgrege(etat, id) {
    const s = etat.sections.find((x) => x.id === id);
    if (!s) return 'aecrire';
    const d = descendants(etat, id).filter((x) => !etat.sections.some((y) => y.parent === x.id));
    if (!d.length) return s.statut;
    return ORDRE_STATUTS[Math.min(...d.map((x) => ORDRE_STATUTS.indexOf(x.statut)))];
  }
  // Avancement par statut : moyenne des poids des éléments terminaux, pondérée par leurs mots visés quand tous en ont.
  function avancement(etat, racine = '') {
    const f = racine ? descendants(etat, racine).filter((x) => !etat.sections.some((y) => y.parent === x.id)) : feuilles(etat);
    const liste = f.length ? f : (racine ? etat.sections.filter((s) => s.id === racine) : []);
    const parStatut = { aecrire: 0, brouillon: 0, relu: 0, final: 0 };
    liste.forEach((s) => { parStatut[s.statut] += 1; });
    if (!liste.length) return { part: 0, parStatut, nb: 0, pondere: false };
    const pondere = liste.every((s) => s.objectif > 0);
    const w = (s) => (pondere ? s.objectif : 1);
    const somme = liste.reduce((t, s) => t + w(s), 0);
    return { part: liste.reduce((t, s) => t + w(s) * POIDS[s.statut], 0) / somme, parStatut, nb: liste.length, pondere };
  }
  // Mots des éléments terminaux par statut, sous un élément de la racine (graphique empilé).
  function motsParStatut(etat, id) {
    const o = { aecrire: 0, brouillon: 0, relu: 0, final: 0 };
    const d = descendants(etat, id).filter((x) => !etat.sections.some((y) => y.parent === x.id));
    const s = etat.sections.find((x) => x.id === id);
    (d.length ? d : [s]).forEach((x) => { o[x.statut] += x.mots; });
    if (d.length) o[statutAgrege(etat, id)] += s.mots; // mots propres d'un élément parent (introduction de partie)
    return o;
  }

  function ajouterSection(etat, s) {
    const parent = s.parent && etat.sections.some((x) => x.id === s.parent) ? s.parent : '';
    const ordre = Math.max(0, ...enfants(etat, parent).map((x) => x.ordre)) + 1;
    const n = normaliserSection({ ...s, parent, ordre });
    return { ...etat, sections: reparerArbre(etat.sections.map((x) => ({ ...x })).concat([n])) };
  }
  function modifierSection(etat, id, champs) {
    const sections = etat.sections.map((x) => (x.id === id ? normaliserSection({ ...x, ...champs, id }) : { ...x }));
    const s = sections.find((x) => x.id === id);
    if (s && 'parent' in champs) {
      // Interdit de se placer sous soi-même ou sous un de ses descendants.
      const interdits = new Set([id, ...descendants(etat, id).map((x) => x.id)]);
      if (interdits.has(s.parent)) s.parent = etat.sections.find((x) => x.id === id).parent;
      else if (s.parent !== etat.sections.find((x) => x.id === id).parent) s.ordre = Math.max(0, ...sections.filter((x) => x.parent === s.parent && x.id !== id).map((x) => x.ordre)) + 1;
    }
    return { ...etat, sections: reparerArbre(sections) };
  }
  function deplacerSection(etat, id, sens) {
    const s = etat.sections.find((x) => x.id === id);
    if (!s) return etat;
    const freres = enfants(etat, s.parent);
    const i = freres.findIndex((x) => x.id === id), j = i + sens;
    if (j < 0 || j >= freres.length) return etat;
    const ordre = new Map(freres.map((x, k) => [x.id, k + 1]));
    ordre.set(id, j + 1); ordre.set(freres[j].id, i + 1);
    return { ...etat, sections: etat.sections.map((x) => (ordre.has(x.id) ? { ...x, ordre: ordre.get(x.id) } : x)) };
  }
  function supprimerSection(etat, id) {
    const retires = new Set([id, ...descendants(etat, id).map((x) => x.id)]);
    return {
      ...etat,
      sections: etat.sections.filter((x) => !retires.has(x.id)),
      seances: etat.seances.map((s) => (retires.has(s.section) ? { ...s, section: '' } : s)),
      refs: etat.refs.map((r) => ({ ...r, sections: r.sections.filter((x) => !retires.has(x)) })),
    };
  }
  // Plan de départ de la base : objectifs arrondis à la centaine.
  function genererPlan(base, type, objectifMots) {
    const modele = base.plans[type] || base.plans.autre;
    const sections = [];
    let partie = '';
    let ordreRacine = 0, ordreEnfant = 0;
    for (const [prof, titre, pct] of modele) {
      const id = nouvelId();
      const objectif = pct && objectifMots ? Math.round((objectifMots * pct) / 10000) * 100 : 0;
      if (prof === 0) {
        sections.push(normaliserSection({ id, parent: '', niveau: pct ? 2 : 1, titre, objectif, ordre: ++ordreRacine }));
        partie = pct ? '' : id; ordreEnfant = 0;
      } else sections.push(normaliserSection({ id, parent: partie, niveau: partie ? 2 : 2, titre, objectif, ordre: partie ? ++ordreEnfant : ++ordreRacine }));
    }
    return reparerArbre(sections);
  }

  // ---------- Rétroplanning ----------
  function genererJalons(base, type) {
    return (base.jalons[type] || base.jalons.autre).map(([nom, ancre, decalage, fin]) => normaliserJalon({ id: nouvelId(), nom, ancre, decalage, fin: !!fin }));
  }
  // Dates des jalons. Les jalons ancrés au rendu sont resserrés (facteur < 1) quand le modèle commence avant la date
  // de début du projet ; une date fixée par l'utilisateur prime toujours.
  function retroplanning(etat) {
    const p = etat.projet;
    const span = Math.max(0, ...etat.jalons.filter((j) => j.ancre === 'rendu').map((j) => -j.decalage));
    const dispo = p.debut && p.rendu ? ecart(p.debut, p.rendu) : null;
    const facteur = dispo !== null && dispo > 0 && span > dispo ? dispo / span : 1;
    const jalons = etat.jalons.map((j) => {
      let date = '';
      if (j.ancre === 'date') date = j.date;
      else if (j.ancre === 'rendu' && p.rendu) date = ajout(p.rendu, Math.round(j.decalage * (j.decalage < 0 ? facteur : 1)));
      else if (j.ancre === 'soutenance' && p.soutenance) date = ajout(p.soutenance, j.decalage);
      return { ...j, quand: date };
    }).sort((a, b) => (a.quand || '9999').localeCompare(b.quand || '9999'));
    return { jalons, facteur, dispo, span };
  }
  function statutJalon(j, auj) {
    if (j.fait) return 'fait';
    if (!j.quand) return 'sansdate';
    if (j.quand < auj) return 'retard';
    if (ecart(auj, j.quand) <= 14) return 'proche';
    return 'avenir';
  }
  // Échéance de la rédaction : le jalon « fin de rédaction » s'il reste à faire, sinon la date de rendu.
  function echeanceRedaction(etat) {
    const { jalons } = retroplanning(etat);
    const fin = jalons.find((j) => j.fin && !j.fait && j.quand);
    return fin ? { date: fin.quand, nom: fin.nom } : (etat.projet.rendu ? { date: etat.projet.rendu, nom: 'Date de rendu' } : null);
  }

  // ---------- Rythme ----------
  const estJourTravail = (d, jours) => jours.includes(versDate(d).getDay());
  function joursTravail(de, a, jours) {
    if (!estDate(de) || !estDate(a) || a < de) return 0;
    let n = 0;
    for (let d = de; d <= a; d = ajout(d, 1)) if (estJourTravail(d, jours)) n++;
    return n;
  }
  // n-ième jour de travail strictement après `de`.
  function nemeJourTravail(de, n, jours) {
    let d = de, k = 0;
    for (let garde = 0; garde < 40000; garde++) { d = ajout(d, 1); if (estJourTravail(d, jours) && ++k >= n) return d; }
    return null;
  }
  // Total relevé à une date (dernier relevé au plus tard ce jour-là), null avant le premier relevé.
  function valeurAu(releves, date) {
    let v = null;
    for (const r of releves) { if (r.date <= date) v = r; else break; }
    return v;
  }
  // Relève le total du jour ; inutile quand il ne change rien au relevé précédent.
  function noterReleve(etat, auj) {
    const total = totalMots(etat);
    const autres = etat.releves.filter((r) => r.date !== auj);
    const prec = valeurAu(autres, auj);
    const releves = prec && prec.mots === total ? autres : autres.concat([{ date: auj, mots: total }]).sort((a, b) => a.date.localeCompare(b.date));
    return { ...etat, releves };
  }
  function rythme(etat, auj) {
    const p = etat.projet;
    const total = totalMots(etat);
    const restants = Math.max(0, p.objectifMots - total);
    const ech = echeanceRedaction(etat);
    const jours = ech && ech.date >= auj ? joursTravail(auj, ech.date, p.joursTravail) : 0;
    const parJour = restants && jours ? Math.ceil(restants / jours) : null;
    // Rythme réel : mots gagnés sur les 14 derniers jours, ramenés aux jours de travail.
    const depuis = ajout(auj, -14);
    let base = valeurAu(etat.releves, depuis);
    if (!base) base = etat.releves.find((r) => r.date <= auj && r.date > depuis) || null;
    let reel = null;
    if (base) {
      const jt = joursTravail(ajout(base.date, 1), auj, p.joursTravail);
      reel = jt ? Math.max(0, (total - base.mots) / jt) : null;
    }
    const projection = restants && reel ? nemeJourTravail(auj, Math.ceil(restants / reel), p.joursTravail) : null;
    return {
      total, objectif: p.objectifMots, restants, part: p.objectifMots ? total / p.objectifMots : null,
      pages: total / p.motsParPage, pagesObjectif: p.objectifMots / p.motsParPage,
      echeance: ech, jours, parJour, reel, projection, atteint: p.objectifMots > 0 && total >= p.objectifMots,
      enRetard: !!(projection && ech && projection > ech.date), depasse: !!(ech && ech.date < auj && restants > 0),
    };
  }
  // Points de la courbe d'avancement : relevés jusqu'à aujourd'hui (le dernier prolongé à aujourd'hui).
  function courbe(etat, auj) {
    const pts = etat.releves.filter((r) => r.date <= auj).map((r) => ({ date: r.date, mots: r.mots }));
    if (pts.length && pts.at(-1).date < auj) pts.push({ date: auj, mots: totalMots(etat) });
    if (!pts.length) pts.push({ date: auj, mots: totalMots(etat) });
    return pts;
  }

  // ---------- Journal ----------
  function bilanSeances(etat, auj) {
    const semaine = etat.seances.filter((s) => s.date > ajout(auj, -7) && s.date <= auj);
    const parSection = new Map();
    for (const s of etat.seances) if (s.section) parSection.set(s.section, (parSection.get(s.section) || 0) + s.minutes);
    return {
      nb: etat.seances.length, minutes: etat.seances.reduce((t, s) => t + s.minutes, 0),
      semaine: semaine.reduce((t, s) => t + s.minutes, 0), seancesSemaine: semaine.length,
      motsSemaine: semaine.reduce((t, s) => t + s.mots, 0),
      parSection: [...parSection].map(([id, minutes]) => ({ id, minutes })).sort((a, b) => b.minutes - a.minutes),
    };
  }
  // Ajoute une séance ; ses mots peuvent s'ajouter à la section travaillée (`ajouterMots`).
  function ajouterSeance(etat, s, ajouterMots) {
    const n = normaliserSeance(s);
    let e = { ...etat, seances: etat.seances.filter((x) => x.id !== n.id).concat([n]).sort((a, b) => a.date.localeCompare(b.date)) };
    if (ajouterMots && n.section && n.mots) e = { ...e, sections: e.sections.map((x) => (x.id === n.section ? { ...x, mots: Math.max(0, x.mots + n.mots) } : x)) };
    return e;
  }

  // ---------- Directeur ----------
  function actionsOuvertes(etat, auj) {
    return etat.rdv.flatMap((r) => r.actions.filter((a) => !a.faite).map((a) => ({ ...a, rdv: r.id, dateRdv: r.date, retard: !!(a.echeance && a.echeance < auj) })))
      .sort((a, b) => (a.echeance || '9999').localeCompare(b.echeance || '9999') || a.dateRdv.localeCompare(b.dateRdv));
  }
  const rdvPasses = (etat, auj) => etat.rdv.filter((r) => r.date <= auj);
  const prochainRdv = (etat, auj) => etat.rdv.find((r) => r.date > auj) || null;
  // Ordre du jour du prochain rendez-vous, à copier dans un e-mail au directeur.
  function ordreDuJour(etat, auj) {
    const p = etat.projet;
    const prochain = prochainRdv(etat, auj);
    const dernier = rdvPasses(etat, auj).at(-1) || null;
    const total = totalMots(etat);
    const lignes = [`Point d'avancement${prochain ? ` du ${dateFr(prochain.date)}` : ''}${p.titre ? ` · ${p.titre}` : ''}`, ''];
    let av = `Avancement : ${nombreTexte(total)} mots`;
    if (p.objectifMots) av += ` sur ${nombreTexte(p.objectifMots)} visés (${Math.floor((total / p.objectifMots) * 100)} %)`;
    if (dernier) { const v = valeurAu(etat.releves, dernier.date); if (v) av += `, ${total - v.mots >= 0 ? '+' : ''}${nombreTexte(total - v.mots)} depuis le rendez-vous du ${dateFr(dernier.date)}`; }
    lignes.push(`${av}.`);
    const a = avancement(etat);
    if (a.nb) lignes.push(`Plan : ${ORDRE_STATUTS.slice().reverse().map((s) => `${a.parStatut[s]} ${STATUTS[s].toLowerCase()}${a.parStatut[s] > 1 && s !== 'aecrire' ? 's' : ''}`).join(', ')}.`);
    if (dernier && dernier.actions.length) {
      lignes.push('', `Actions décidées le ${dateFr(dernier.date)} :`);
      dernier.actions.forEach((x) => lignes.push(`- [${x.faite ? 'fait' : 'en cours'}] ${x.texte}${x.echeance && !x.faite ? ` (pour le ${dateFr(x.echeance)})` : ''}`));
    }
    const autres = actionsOuvertes(etat, auj).filter((x) => !dernier || x.rdv !== dernier.id);
    if (autres.length) { lignes.push('', 'Autres actions encore ouvertes :'); autres.forEach((x) => lignes.push(`- ${x.texte}`)); }
    const proches = retroplanning(etat).jalons.filter((j) => !j.fait && j.quand && j.quand >= auj && ecart(auj, j.quand) <= 45);
    if (proches.length) { lignes.push('', 'Prochains jalons :'); proches.forEach((j) => lignes.push(`- ${dateFr(j.quand)} : ${j.nom}`)); }
    if (prochain?.points) { lignes.push('', 'Points que je souhaite aborder :'); prochain.points.split('\n').map((x) => x.trim()).filter(Boolean).forEach((x) => lignes.push(`- ${x.replace(/^[-•*]\s*/, '')}`)); }
    return lignes.join('\n');
  }

  // ---------- Bibliographie (auteur-date simple) ----------
  // « Nom, Prénom ; Nom, Prénom » ; sans virgule, l'entrée est gardée entière (organisation, collectif).
  function parserAuteurs(t) {
    const brut = String(t || '').trim();
    if (!brut) return [];
    return brut.split(/\s*;\s*/).filter(Boolean).map((a) => {
      const i = a.indexOf(',');
      return i < 0 ? { nom: a.trim(), prenom: '' } : { nom: a.slice(0, i).trim(), prenom: a.slice(i + 1).trim() };
    }).filter((a) => a.nom);
  }
  const initiales = (p) => String(p || '').trim().split(/\s+/).filter(Boolean).map((m) => m.split('-').filter(Boolean).map((x) => `${x[0].toUpperCase()}.`).join('-')).join(' ');
  function auteursTexte(liste) {
    const n = liste.map((a) => (a.prenom ? `${a.nom}, ${initiales(a.prenom)}` : a.nom));
    if (n.length <= 1) return n[0] || '';
    return `${n.slice(0, -1).join(', ')} et ${n.at(-1)}`;
  }
  const sansPoint = (s) => String(s || '').trim().replace(/[.\s]+$/, '');
  function citation(r, suffixe = '') {
    const a = parserAuteurs(r.auteurs);
    const an = `${r.annee || 's. d.'}${suffixe}`;
    const noms = !a.length ? sansPoint(r.titre).slice(0, 40) : a.length === 1 ? a[0].nom : a.length === 2 ? `${a[0].nom} et ${a[1].nom}` : `${a[0].nom} et al.`;
    return `(${noms}, ${an})`;
  }
  function referenceTexte(r, suffixe = '') {
    const a = auteursTexte(parserAuteurs(r.auteurs));
    const an = `(${r.annee || 's. d.'}${suffixe})`;
    const parts = [a ? `${sansPoint(a)}. ${an}.` : `${sansPoint(r.titre)}. ${an}.`];
    if (a) parts.push(`${sansPoint(r.titre)}.`);
    if (r.source) parts.push(`${sansPoint(r.source)}.`);
    if (r.url) parts.push(`${r.url}${r.consulte ? ` (consulté le ${dateNum(r.consulte)})` : ''}`);
    return parts.join(' ').replace(/\.\./g, '.');
  }
  const cleTri = (r) => `${plat(parserAuteurs(r.auteurs).map((a) => a.nom).join(' ') || r.titre)}`;
  // Liste triée par auteur puis année ; même auteurs et même année : suffixes a, b, c.
  function bibliographie(refs) {
    const tri = refs.slice().sort((a, b) => cleTri(a).localeCompare(cleTri(b), 'fr') || String(a.annee).localeCompare(String(b.annee)) || plat(a.titre).localeCompare(plat(b.titre), 'fr'));
    const groupes = new Map();
    tri.forEach((r) => { const k = `${cleTri(r)}|${r.annee}`; groupes.set(k, (groupes.get(k) || []).concat([r])); });
    return tri.map((r) => {
      const g = groupes.get(`${cleTri(r)}|${r.annee}`);
      const suffixe = g.length > 1 && r.annee ? String.fromCharCode(97 + g.indexOf(r)) : '';
      return { ref: r, suffixe, texte: referenceTexte(r, suffixe), citation: citation(r, suffixe) };
    });
  }
  const bibliographieTexte = (refs) => `${bibliographie(refs).map((x) => x.texte).join('\n\n')}\n`;

  // ---------- Export CSV ----------
  function champCsv(v) {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
  const versCsv = (lignes) => `﻿${lignes.map((l) => l.map(champCsv).join(';')).join('\r\n')}\r\n`;
  function csvPlan(etat) {
    return versCsv([['Niveau', 'Titre', 'Statut', 'Mots', 'Mots visés', 'Note'], ...arbre(etat).map(({ s, nbEnfants }) => [NIVEAUX[s.niveau], `${'  '.repeat(s.niveau - 1)}${s.titre}`, STATUTS[nbEnfants ? statutAgrege(etat, s.id) : s.statut], motsSection(etat, s.id), objectifSection(etat, s.id) || '', s.note])]);
  }
  function csvBiblio(etat) {
    const nomSection = new Map(etat.sections.map((s) => [s.id, s.titre]));
    return versCsv([['Référence', 'Citation', 'Auteurs', 'Année', 'Titre', 'Source', 'Type', 'Adresse', 'Consulté le', 'Statut', 'Sections', 'Notes'],
      ...bibliographie(etat.refs).map(({ ref: r, texte, citation: c }) => [texte, c, r.auteurs, r.annee, r.titre, r.source, r.type, r.url, r.consulte, LECTURE[r.statut], r.sections.map((x) => nomSection.get(x)).join(' | '), r.notes])]);
  }
  function csvSeances(etat) {
    const nomSection = new Map(etat.sections.map((s) => [s.id, s.titre]));
    return versCsv([['Date', 'Durée (minutes)', 'Mots écrits', 'Section', 'Note'], ...etat.seances.map((s) => [s.date, s.minutes, s.mots, nomSection.get(s.section) || '', s.note])]);
  }
  function csvActions(etat) {
    return versCsv([['Rendez-vous', 'Action', 'Échéance', 'Faite le'], ...etat.rdv.flatMap((r) => r.actions.map((a) => [r.date, a.texte, a.echeance, a.faite]))]);
  }

  g.MMR = {
    deux, iso, versDate, ajout, ecart, estDate, JOURS, MOIS, dateFrLongue, dateFr, dateNum, nombreTexte, dureeTexte, plat, nouvelId,
    STATUTS, POIDS, ORDRE_STATUTS, NIVEAUX, LECTURE, MODES, ANCRES,
    normaliserProjet, normaliserSection, normaliserJalon, normaliserAction, normaliserRdv, normaliserRef, normaliserSeance, etatVide, normaliser, taille,
    enfants, descendants, arbre, feuilles, motsSection, objectifSection, totalMots, statutAgrege, avancement, motsParStatut,
    ajouterSection, modifierSection, deplacerSection, supprimerSection, genererPlan,
    genererJalons, retroplanning, statutJalon, echeanceRedaction,
    joursTravail, nemeJourTravail, valeurAu, noterReleve, rythme, courbe,
    bilanSeances, ajouterSeance, actionsOuvertes, rdvPasses, prochainRdv, ordreDuJour,
    parserAuteurs, initiales, auteursTexte, citation, referenceTexte, bibliographie, bibliographieTexte,
    champCsv, versCsv, csvPlan, csvBiblio, csvSeances, csvActions,
  };
})(typeof window !== 'undefined' ? window : globalThis);
