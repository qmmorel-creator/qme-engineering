// Cadeaux reçus et remerciements QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.CDX) et par les tests Node (vm, sans structuredClone).
// Dates locales « AAAA-MM-JJ » (comparables comme des chaînes). Montants en centimes (entiers).
// Unité du remerciement : le foyer (une personne ou une famille), qui porte le statut et le message ; les
// cadeaux s'y rattachent. Plusieurs événements par espace, chacun avec ses foyers.
(function (racine) {
  'use strict';

  const TYPES_EVENEMENT = ['mariage', 'naissance', 'anniversaire', 'retraite', 'obseques', 'autre'];
  const TYPES_CADEAU = ['objet', 'argent', 'cagnotte', 'bon', 'fleurs', 'message', 'presence', 'aide', 'don'];
  const STATUTS = ['a-ecrire', 'ecrit', 'envoye'];
  const CANAUX = ['poste', 'main', 'message', 'vive-voix'];
  const TONS = ['chaleureux', 'sobre', 'bref', 'leger'];
  const FORMATS = ['3x8', '3x7', '2x7', '2x8'];
  const DEFAUTS = { delaiSemaines: 6, format: '3x8', decalageX: 0, decalageY: 0, masquerMontants: false };

  // ---------- Dates ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j, 12); };
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const dateOuNull = (v) => (estDate(v) ? v : null);

  // ---------- Textes, identifiants, montants ----------
  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const texte = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
  const texteLong = (v, n) => String(v ?? '').replace(/\r\n?/g, '\n').trim().slice(0, n);
  const entier = (v, min, max, defaut) => { const n = Math.round(Number(v)); return v !== '' && v !== null && v !== undefined && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : defaut; };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  // Clé de rapprochement d'un nom : sans accents, sans casse, espaces réduits.
  const cle = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  // « 50 », « 50,5 », « 50,00 € », « 1 200 », « 1.200,50 » → centimes ; vide ou illisible → null.
  function lireMontant(v) {
    if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) : null;
    let s = String(v ?? '').replace(/[\s  ]/g, '').replace(/€|eur(os?)?/gi, '');
    if (!s) return null;
    if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '');
    s = s.replace(',', '.');
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
    const c = Math.round(Number(s) * 100);
    return c > 100_000_000 ? null : c;
  }
  // Centimes → « 50 € », « 50,50 € », « 1 200 € » (espaces insécables du format français).
  const formatMontant = (c) => (c / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 });

  // ---------- Normalisation (tolérante aux anciennes versions et aux saisies abîmées) ----------
  const tab = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : []);
  const parmi = (v, liste, defaut) => (liste.includes(v) ? v : defaut);

  function normaliserReglages(r = {}) {
    r = r && typeof r === 'object' ? r : {};
    return {
      delaiSemaines: entier(r.delaiSemaines, 1, 26, DEFAUTS.delaiSemaines),
      format: parmi(r.format, FORMATS, DEFAUTS.format),
      decalageX: Math.min(10, Math.max(-10, Math.round(Number(r.decalageX) * 2) / 2 || 0)),
      decalageY: Math.min(10, Math.max(-10, Math.round(Number(r.decalageY) * 2) / 2 || 0)),
      masquerMontants: r.masquerMontants === true,
    };
  }
  function normaliserEvenement(e = {}) {
    return {
      id: texte(e.id, 40) || nouvelId(),
      type: parmi(e.type, TYPES_EVENEMENT, 'autre'),
      nom: texte(e.nom, 80) || 'Événement',
      date: dateOuNull(e.date),
      occasion: texte(e.occasion, 80),
      concerne: texte(e.concerne, 60),
      projet: texte(e.projet, 100),
      signature: texte(e.signature, 80),
      ton: parmi(e.ton, TONS, 'chaleureux'),
    };
  }
  function normaliserAdresse(a = {}) {
    a = a && typeof a === 'object' ? a : {};
    return { destinataire: texte(a.destinataire, 80), ligne1: texte(a.ligne1, 80), ligne2: texte(a.ligne2, 80), cp: texte(a.cp, 12), ville: texte(a.ville, 60), pays: texte(a.pays, 40) };
  }
  function normaliserPersonne(p = {}) {
    const statut = parmi(p.statut, STATUTS, 'a-ecrire');
    return {
      id: texte(p.id, 40) || nouvelId(),
      evenement: texte(p.evenement, 40),
      nom: texte(p.nom, 80) || 'Sans nom',
      appel: texte(p.appel, 80),
      adresse: normaliserAdresse(p.adresse),
      statut,
      canal: parmi(p.canal, CANAUX, 'poste'),
      envoyeLe: statut === 'envoye' ? dateOuNull(p.envoyeLe) : null,
      message: texteLong(p.message, 3000),
      modele: texte(p.modele, 40),
      note: texte(p.note, 200),
    };
  }
  function normaliserCadeau(c = {}) {
    const m = c.montant === null || c.montant === undefined || c.montant === '' ? null : entier(c.montant, 0, 100_000_000, null);
    return {
      id: texte(c.id, 40) || nouvelId(),
      personne: texte(c.personne, 40),
      type: parmi(c.type, TYPES_CADEAU, 'objet'),
      description: texte(c.description, 120),
      montant: m,
      cagnotte: c.type === 'cagnotte' ? texte(c.cagnotte, 60) : '',
      recuLe: dateOuNull(c.recuLe),
    };
  }
  function normaliserModele(x = {}) {
    return { id: texte(x.id, 40) || `p-${nouvelId()}`, evenement: parmi(x.evenement, [...TYPES_EVENEMENT, 'tous'], 'tous'), ton: parmi(x.ton, TONS, 'chaleureux'), nom: texte(x.nom, 60) || 'Mon modèle', texte: texteLong(x.texte, 2000) };
  }

  const etatVide = () => ({ version: 1, evenements: [], personnes: [], cadeaux: [], modelesPerso: [], reglages: normaliserReglages(), courant: null });

  function normaliser(d) {
    d = d && typeof d === 'object' ? d : {};
    const evenements = tab(d.evenements).map(normaliserEvenement);
    const idsEv = new Set(evenements.map((e) => e.id));
    const personnes = tab(d.personnes).map(normaliserPersonne).filter((p) => idsEv.has(p.evenement));
    const idsP = new Set(personnes.map((p) => p.id));
    const cadeaux = tab(d.cadeaux).map(normaliserCadeau).filter((c) => idsP.has(c.personne));
    const E = { version: 1, evenements, personnes, cadeaux, modelesPerso: tab(d.modelesPerso).map(normaliserModele).filter((x) => x.texte), reglages: normaliserReglages(d.reglages), courant: idsEv.has(d.courant) ? d.courant : (evenements[0]?.id ?? null) };
    if (d.majLe) E.majLe = d.majLe;
    return E;
  }

  // ---------- Accès ----------
  const evenement = (E, id) => E.evenements.find((e) => e.id === id) || null;
  const personnesDe = (E, evId) => E.personnes.filter((p) => p.evenement === evId);
  const cadeauxDe = (E, pid) => E.cadeaux.filter((c) => c.personne === pid);
  const cadeauxEvenement = (E, evId) => { const ids = new Set(personnesDe(E, evId).map((p) => p.id)); return E.cadeaux.filter((c) => ids.has(c.personne)); };
  const adresseComplete = (p) => Boolean(p.adresse.ligne1 && (p.adresse.cp || p.adresse.ville));
  const aDesCadeaux = (E, p) => E.cadeaux.some((c) => c.personne === p.id);
  const premierCadeau = (E, p) => cadeauxDe(E, p.id).map((c) => c.recuLe).filter(Boolean).sort()[0] || null;

  // Date à laquelle le remerciement devrait être parti (objectif personnel, réglable) :
  // délai compté depuis la date de l'événement, ou depuis le premier cadeau s'il arrive après.
  function dateObjectif(E, p) {
    const ev = evenement(E, p.evenement);
    const depart = [ev?.date, premierCadeau(E, p)].filter(Boolean).sort().pop();
    return depart ? ajout(depart, 7 * E.reglages.delaiSemaines) : null;
  }
  const enRetard = (E, p, auj) => p.statut !== 'envoye' && aDesCadeaux(E, p) && Boolean(dateObjectif(E, p)) && dateObjectif(E, p) < auj;

  // File « reste à remercier » : foyers qui ont offert et dont le remerciement n'est pas parti, l'objectif le
  // plus proche (ou dépassé) d'abord.
  function aRemercier(E, evId) {
    return personnesDe(E, evId).filter((p) => p.statut !== 'envoye' && aDesCadeaux(E, p))
      .sort((a, b) => (dateObjectif(E, a) || '9999').localeCompare(dateObjectif(E, b) || '9999') || a.nom.localeCompare(b.nom, 'fr'));
  }

  function indicateurs(E, evId, auj) {
    const ps = personnesDe(E, evId);
    const avec = ps.filter((p) => aDesCadeaux(E, p));
    const cad = cadeauxEvenement(E, evId);
    const n = (st) => avec.filter((p) => p.statut === st).length;
    const parType = {};
    for (const c of cad) { const t = (parType[c.type] ||= { n: 0, total: 0 }); t.n++; t.total += c.montant || 0; }
    const cagnottes = {};
    for (const c of cad.filter((x) => x.type === 'cagnotte')) { const k = c.cagnotte || 'Cagnotte'; const g = (cagnottes[k] ||= { nom: k, n: 0, total: 0 }); g.n++; g.total += c.montant || 0; }
    const envoyes = n('envoye');
    return {
      foyers: ps.length,
      avecCadeau: avec.length,
      sansCadeau: ps.length - avec.length,
      cadeaux: cad.length,
      aEcrire: n('a-ecrire'),
      ecrits: n('ecrit'),
      envoyes,
      reste: avec.length - envoyes,
      progression: avec.length ? Math.round((envoyes / avec.length) * 100) : 0,
      // Un don à une association n'est pas reçu : compté dans son type, pas dans le total reçu.
      total: cad.filter((c) => c.type !== 'don').reduce((s, c) => s + (c.montant || 0), 0),
      avecMontant: cad.filter((c) => c.montant !== null && c.type !== 'don').length,
      parType,
      cagnottes: Object.values(cagnottes).sort((a, b) => b.total - a.total),
      retard: avec.filter((p) => enRetard(E, p, auj)).length,
      sansAdresse: avec.filter((p) => p.statut !== 'envoye' && p.canal === 'poste' && !adresseComplete(p)).length,
    };
  }

  // ---------- Messages ----------
  const typeCadeau = (B, id) => B.cadeaux.find((t) => t.id === id) || B.cadeaux[0];
  const typeEvenement = (B, id) => B.evenements.find((t) => t.id === id) || B.evenements[B.evenements.length - 1];

  // Groupe nominal d'un cadeau dans une phrase : description saisie, sinon la formule du type.
  function groupeCadeau(B, c) {
    if (c.description) return c.description;
    if (c.type === 'cagnotte' && c.cagnotte) return `votre participation à la cagnotte « ${c.cagnotte} »`;
    return typeCadeau(B, c.type).defaut;
  }
  // « a », « a et b », « a, b et c » ; doublons retirés.
  function enumerer(l) {
    const u = [...new Set(l.filter(Boolean))];
    return u.length < 2 ? (u[0] || '') : `${u.slice(0, -1).join(', ')} et ${u[u.length - 1]}`;
  }
  const phraseCadeaux = (B, cadeaux) => enumerer(cadeaux.map((c) => groupeCadeau(B, c))) || 'votre attention';

  function occasionDe(B, ev) {
    if (ev.occasion) return ev.occasion;
    const t = typeEvenement(B, ev.type);
    return t.occasion.includes('{concerne}') ? (ev.concerne ? t.occasion.replace('{concerne}', ev.concerne) : t.occasionSans) : t.occasion;
  }

  function contexteMessage(B, E, p) {
    const ev = evenement(E, p.evenement) || normaliserEvenement({});
    const cad = cadeauxDe(E, p.id);
    const argent = cad.some((c) => typeCadeau(B, c.type).monetaire);
    return {
      appel: p.appel || `${p.nom},`,
      cadeaux: phraseCadeaux(B, cad),
      occasion: occasionDe(B, ev),
      concerne: ev.concerne,
      projet: argent ? ev.projet : '',
      argent: argent ? 'oui' : '',
      signature: ev.signature,
    };
  }

  // Remplit un modèle : blocs conditionnels {?champ}…{/champ} et {!champ}…{/champ}, puis champs {champ}.
  // Majuscule en début de phrase (un prénom saisi « maman » qui ouvre une phrase), espaces nettoyés.
  function remplir(modele, ctx) {
    let s = String(modele ?? '');
    for (let i = 0; i < 5; i++) {
      const avant = s;
      s = s.replace(/\{([?!])(\w+)\}([\s\S]*?)\{\/\2\}/g, (_, signe, k, dedans) => ((signe === '?') === Boolean(ctx[k]) ? dedans : ''));
      if (s === avant) break;
    }
    s = s.replace(/\{(\w+)\}/g, (_, k) => String(ctx[k] ?? ''));
    s = s.replace(/[ \t]+([.,])/g, '$1').replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
    s = s.replace(/(^|[.!?]\s+|\n)(\p{Ll})/gu, (_, a, l) => a + l.toLocaleUpperCase('fr'));
    return s.trim();
  }

  // Modèles disponibles pour un type d'événement (intégrés puis personnels), filtrés par ton si donné.
  function modelesPour(B, E, typeEv, ton = null) {
    const base = (B.modeles[typeEv] || B.modeles.autre).map((x) => ({ ...x, perso: false }));
    const perso = E.modelesPerso.filter((x) => x.evenement === 'tous' || x.evenement === typeEv).map((x) => ({ ...x, perso: true }));
    return [...base, ...perso].filter((x) => !ton || x.ton === ton);
  }
  function genererMessage(B, E, pid, modeleId) {
    const p = E.personnes.find((x) => x.id === pid);
    if (!p) return '';
    const ev = evenement(E, p.evenement);
    const tous = modelesPour(B, E, ev?.type || 'autre');
    const mod = tous.find((x) => x.id === modeleId) || tous.find((x) => x.ton === ev?.ton) || tous[0];
    return remplir(mod.texte, contexteMessage(B, E, p));
  }

  // ---------- Import d'une liste collée ----------
  // Une ligne par cadeau : nom ; cadeau ; montant ; adresse ; code postal ; ville (tabulations d'un tableur ou
  // points-virgules ; seul le nom est obligatoire). En-tête ignoré. Lignes au même nom regroupées en un foyer.
  function deviner(description, montant) {
    if (/cagnotte|pot commun/i.test(description)) return 'cagnotte';
    if (/ch[eè]que|virement|esp[eè]ces|argent|enveloppe|billet/i.test(description) || (montant !== null && !description)) return 'argent';
    if (/fleur|bouquet|couronne|gerbe|composition/i.test(description)) return 'fleurs';
    if (/\bdon\b/i.test(description)) return 'don';
    if (/\bbon\b|coffret|exp[eé]rience|week-end|s[eé]jour/i.test(description)) return 'bon';
    if (/pr[eé]sence/i.test(description)) return 'presence';
    if (/message|carte|lettre|mot\b/i.test(description)) return 'message';
    return 'objet';
  }
  function analyserListe(brut) {
    const lignes = String(brut ?? '').replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim()).filter(Boolean);
    const sep = lignes.some((l) => l.includes('\t')) ? '\t' : lignes.some((l) => l.includes(';')) ? ';' : null;
    const foyers = new Map();
    const erreurs = [];
    let nbCadeaux = 0;
    lignes.forEach((l, i) => {
      const cols = (sep ? l.split(sep) : [l]).map((c) => c.trim());
      if (i === 0 && /^(nom|qui|foyer|invit|personne|de la part)/i.test(cols[0]) && (cols.length > 1 || /^nom$/i.test(cols[0]))) return;
      const nom = cols[0].slice(0, 80);
      if (!nom) { erreurs.push(`Ligne ${i + 1} : nom manquant, ligne ignorée.`); return; }
      const description = (cols[1] || '').slice(0, 120);
      const brutMontant = cols[2] || '';
      let montant = lireMontant(brutMontant);
      if (brutMontant && montant === null) erreurs.push(`Ligne ${i + 1} : montant « ${brutMontant} » illisible, laissé vide.`);
      const k = cle(nom);
      const f = foyers.get(k) || { nom, adresse: normaliserAdresse({}), cadeaux: [] };
      const adresse = normaliserAdresse({ ligne1: cols[3], cp: cols[4], ville: cols[5] });
      if (!f.adresse.ligne1 && adresse.ligne1) f.adresse = adresse;
      if (description || montant !== null) {
        const type = deviner(description, montant);
        f.cadeaux.push({ type, description: type === 'cagnotte' && /^cagnotte$/i.test(description) ? '' : description, montant });
        nbCadeaux++;
      }
      foyers.set(k, f);
    });
    return { foyers: [...foyers.values()], erreurs, nbCadeaux };
  }
  // Ajoute les foyers analysés à l'événement : un nom déjà présent reçoit les nouveaux cadeaux (et l'adresse si
  // elle manquait) au lieu d'être créé en double. Renvoie un nouvel état.
  function importer(E, evId, foyers, auj) {
    const N = clone(E);
    let crees = 0, completes = 0, cadeaux = 0;
    for (const f of foyers) {
      let p = N.personnes.find((x) => x.evenement === evId && cle(x.nom) === cle(f.nom));
      if (p) { completes++; if (!p.adresse.ligne1 && f.adresse.ligne1) p.adresse = normaliserAdresse(f.adresse); }
      else { p = normaliserPersonne({ evenement: evId, nom: f.nom, adresse: f.adresse }); N.personnes.push(p); crees++; }
      for (const c of f.cadeaux) { N.cadeaux.push(normaliserCadeau({ ...c, personne: p.id, recuLe: auj })); cadeaux++; }
      // Un foyer déjà remercié qui reçoit un nouveau cadeau repasse « à écrire ».
      if (f.cadeaux.length && p.statut === 'envoye') { p.statut = 'a-ecrire'; p.envoyeLe = null; }
    }
    return { E: N, crees, completes, cadeaux };
  }

  // ---------- Étiquettes d'adresses ----------
  function lignesAdresse(p) {
    const a = p.adresse;
    return [a.destinataire || p.nom, a.ligne1, a.ligne2, [a.cp, a.ville].filter(Boolean).join(' '), a.pays].filter(Boolean);
  }
  // Place les foyers sur des planches : départ à la position « depart » (1 = en haut à gauche) sur la première
  // planche (planche entamée), puis planches pleines. Coordonnées en mm depuis le coin de la feuille.
  function etiquettes(B, personnes, formatId, depart = 1, decalage = { x: 0, y: 0 }) {
    const f = B.etiquettes.find((x) => x.id === formatId) || B.etiquettes[0];
    const parPlanche = f.colonnes * f.lignes;
    let i = Math.min(Math.max(entier(depart, 1, parPlanche, 1) - 1, 0), parPlanche - 1);
    const planches = [];
    for (const p of personnes) {
      const n = Math.floor(i / parPlanche), k = i % parPlanche;
      const col = k % f.colonnes, lig = Math.floor(k / f.colonnes);
      (planches[n] ||= []).push({ position: k + 1, x: +(f.gauche + col * f.pasX + (decalage.x || 0)).toFixed(2), y: +(f.haut + lig * f.pasY + (decalage.y || 0)).toFixed(2), largeur: f.largeur, hauteur: f.hauteur, lignes: lignesAdresse(p), id: p.id });
      i++;
    }
    return { format: f, parPlanche, planches };
  }

  // ---------- Effacement (RGPD) ----------
  function sansEvenement(E, evId) {
    const ids = new Set(personnesDe(E, evId).map((p) => p.id));
    const evenements = E.evenements.filter((e) => e.id !== evId);
    return { ...E, evenements, personnes: E.personnes.filter((p) => !ids.has(p.id)), cadeaux: E.cadeaux.filter((c) => !ids.has(c.personne)), courant: E.courant === evId ? (evenements[0]?.id ?? null) : E.courant };
  }
  // Efface les adresses des foyers déjà remerciés d'un événement (elles ne servent plus).
  function effacerAdresses(E, evId) {
    let n = 0;
    const personnes = E.personnes.map((p) => {
      if (p.evenement !== evId || p.statut !== 'envoye' || !Object.values(p.adresse).some(Boolean)) return p;
      n++;
      return { ...p, adresse: normaliserAdresse({}) };
    });
    return { E: { ...E, personnes }, n };
  }

  // ---------- CSV ----------
  // Point-virgule, BOM UTF-8 (ouverture directe dans Excel), guillemets doublés.
  function versCsv(entetes, lignes) {
    const cel = (v) => { const s = String(v ?? ''); return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    return '﻿' + [entetes, ...lignes].map((l) => l.map(cel).join(';')).join('\r\n') + '\r\n';
  }
  const montantCsv = (c) => (c === null || c === undefined ? '' : (c / 100).toFixed(2).replace('.', ','));
  function csvEvenement(B, E, evId) {
    const nomSt = (id) => (B.statuts.find((s) => s.id === id) || { nom: id }).nom;
    const nomCanal = (id) => (B.canaux.find((s) => s.id === id) || { nom: id }).nom;
    const lignes = [];
    for (const p of personnesDe(E, evId).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))) {
      const a = p.adresse;
      const base = [p.nom, a.destinataire, a.ligne1, a.ligne2, a.cp, a.ville, a.pays];
      const fin = [nomSt(p.statut), nomCanal(p.canal), p.envoyeLe || ''];
      const cad = cadeauxDe(E, p.id);
      if (!cad.length) lignes.push([...base, '', '', '', '', '', ...fin]);
      for (const c of cad) lignes.push([...base, c.description || typeCadeau(B, c.type).defaut, typeCadeau(B, c.type).court || typeCadeau(B, c.type).nom, montantCsv(c.montant), c.cagnotte, c.recuLe || '', ...fin]);
    }
    return versCsv(['Foyer', 'Destinataire', 'Adresse', 'Complément', 'Code postal', 'Ville', 'Pays', 'Cadeau', 'Type', 'Montant (€)', 'Cagnotte', 'Reçu le', 'Remerciement', 'Canal', 'Envoyé le'], lignes);
  }

  racine.CDX = {
    TYPES_EVENEMENT, TYPES_CADEAU, STATUTS, CANAUX, TONS, FORMATS, DEFAUTS,
    iso, versDate, estDate, ajout, ecart, nouvelId, cle, lireMontant, formatMontant, clone,
    etatVide, normaliser, normaliserReglages, normaliserEvenement, normaliserPersonne, normaliserCadeau, normaliserAdresse, normaliserModele,
    evenement, personnesDe, cadeauxDe, cadeauxEvenement, adresseComplete, aDesCadeaux, premierCadeau, dateObjectif, enRetard, aRemercier, indicateurs,
    typeCadeau, typeEvenement, groupeCadeau, enumerer, phraseCadeaux, occasionDe, contexteMessage, remplir, modelesPour, genererMessage,
    deviner, analyserListe, importer, lignesAdresse, etiquettes, sansEvenement, effacerAdresses, versCsv, montantCsv, csvEvenement,
  };
})(typeof window !== 'undefined' ? window : globalThis);
