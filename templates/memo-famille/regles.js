// MémoFamille · règles métier pures (aucun accès au DOM ni au stockage). window.MMF, testé par
// outils/templates/memo-famille.test.mjs.
// Sécurité : detecter() repère dans un texte un numéro de carte bancaire (préfixe d'émetteur + Luhn),
// un IBAN (contrôle modulo 97), un numéro de sécurité sociale français (clé), ou un mot qui annonce
// un mot de passe ou un code. La saisie est refusée ; une sauvegarde importée ou reçue est nettoyée
// (masquer) avant d'être gardée : rien de tel n'est jamais enregistré.
(function (racine) {
  'use strict';
  const O = racine.QME_OUTILS;
  const B = () => racine.BASE;
  const RETIRE = '[information sensible retirée]';
  const sansAccents = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’`]/g, '\'').toLowerCase();

  // ---------- Contrôles de numéros ----------
  function luhn(chiffres) {
    let s = 0;
    for (let i = 0; i < chiffres.length; i++) {
      let d = Number(chiffres[chiffres.length - 1 - i]);
      if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
      s += d;
    }
    return s % 10 === 0;
  }
  // Préfixes des grands réseaux de cartes (Visa, Mastercard, American Express, CB/Discover…).
  const PREFIXE_CARTE = /^(4\d{12}(\d{3}){0,2}|5[1-5]\d{14}|2(2[2-9]\d|[3-6]\d\d|7[01]\d|720)\d{12}|3[47]\d{13}|6\d{15,18})$/;
  const estCarte = (n) => PREFIXE_CARTE.test(n) && luhn(n);
  function mod97(chaine) { let r = 0; for (const c of chaine) r = (r * 10 + Number(c)) % 97; return r; }
  function estIban(brut) {
    const s = brut.replace(/\s/g, '').toUpperCase();
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(s)) return false;
    const r = (s.slice(4) + s.slice(0, 4)).replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
    return mod97(r) === 1;
  }
  function estNir(brut) {
    const s = brut.replace(/[\s.]/g, '').toUpperCase();
    if (!/^[12]\d{4}(\d{2}|2A|2B)\d{6}\d{2}$/.test(s)) return false;
    const corps = s.slice(0, 13).replace('2A', '19').replace('2B', '18');
    return 97 - mod97(corps) === Number(s.slice(13));
  }

  // ---------- Détection ----------
  // Renvoie [{ type, message, debut, fin }] (positions dans le texte d'origine).
  function detecter(texte) {
    const t = String(texte ?? '');
    const res = [];
    const ajout = (type, message, debut, fin) => { if (!res.some((x) => debut < x.fin && fin > x.debut)) res.push({ type, message, debut, fin }); };
    for (const m of t.matchAll(/\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]){11,30}\b/gi)) if (estIban(m[0])) ajout('iban', 'un IBAN', m.index, m.index + m[0].length);
    for (const m of t.matchAll(/\b[12][ .]?\d{2}[ .]?\d{2}[ .]?(?:\d{2}|2[AB])[ .]?\d{3}[ .]?\d{3}[ .]?\d{2}\b/gi)) if (estNir(m[0])) ajout('nir', 'un numéro de sécurité sociale', m.index, m.index + m[0].length);
    for (const m of t.matchAll(/\d(?:[ -]?\d){12,18}/g)) {
      const n = m[0].replace(/[ -]/g, '');
      if (n.length >= 13 && n.length <= 19 && estCarte(n)) ajout('carte', 'un numéro de carte bancaire', m.index, m.index + m[0].length);
    }
    // Mots qui annoncent un secret : on retire du mot jusqu'à la fin de la ligne.
    // Version sans accents de MÊME LONGUEUR (unité par unité) pour garder les positions.
    let norm = '';
    for (let i = 0; i < t.length; i++) { const c = t[i]; const b = c.normalize('NFD')[0]; norm += (b && b.length === 1 ? b : c).toLowerCase().replace('’', '\'').slice(0, 1) || c; }
    for (const [mot, quoi] of B().motsInterdits) {
      const re = new RegExp(`(^|[^a-z0-9])${sansAccents(mot).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^a-z0-9])`, 'g');
      for (const m of norm.matchAll(re)) {
        const debut = m.index + m[1].length;
        const finLigne = t.indexOf('\n', debut);
        ajout('mot', quoi, debut, finLigne < 0 ? t.length : finLigne);
      }
    }
    return res.sort((a, b) => a.debut - b.debut);
  }
  function masquer(texte) {
    const t = String(texte ?? '');
    const d = detecter(t);
    if (!d.length) return { texte: t, retraits: 0 };
    let out = '', pos = 0;
    for (const x of d) { out += t.slice(pos, x.debut) + RETIRE; pos = x.fin; }
    return { texte: out + t.slice(pos), retraits: d.length };
  }
  // Message de refus clair pour l'utilisateur.
  function messageRefus(detections) {
    const quoi = [...new Set(detections.map((x) => x.message))];
    return `Ce texte semble contenir ${quoi.join(', ')}. MémoFamille ne garde jamais ce type d'information : note plutôt où la trouver (par exemple « dans le gestionnaire de mots de passe » ou « carte rangée dans le portefeuille »).`;
  }

  // ---------- Fiches ----------
  const categorie = (id) => B().categories.find((c) => c.id === id);
  // Tous les textes d'une fiche, avec leur libellé (pour la détection et la recherche).
  function textes(f) {
    const cat = categorie(f.categorie);
    return [['Titre', f.titre], ...(cat?.champs || []).map((c) => [c.libelle, f.valeurs[c.id]]), ['Note', f.note]].filter(([, v]) => v);
  }
  function verifierFiche(f) {
    const res = [];
    for (const [libelle, v] of textes(f)) for (const d of detecter(v)) res.push({ ...d, champ: libelle });
    return res;
  }
  // Recherche insensible à la casse et aux accents ; tous les mots doivent apparaître.
  function rechercher(fiches, requete) {
    const mots = sansAccents(requete).split(/\s+/).filter(Boolean);
    if (!mots.length) return [];
    return fiches.map((f) => {
      const champs = textes(f).map(([l, v]) => [l, sansAccents(v)]);
      const tout = champs.map(([, v]) => v).join(' ');
      if (!mots.every((m) => tout.includes(m) || sansAccents(categorie(f.categorie)?.nom).includes(m))) return null;
      const score = mots.reduce((s, m) => s + (sansAccents(f.titre).includes(m) ? 3 : 1), 0);
      return { fiche: f, score, champs: champs.filter(([, v]) => mots.some((m) => v.includes(m))).map(([l]) => l) };
    }).filter(Boolean).sort((a, b) => b.score - a.score || a.fiche.titre.localeCompare(b.fiche.titre, 'fr'));
  }
  const aRevoir = (f, auj, jours = 365) => !f.majLe || O.ecart(f.majLe, auj) > jours;
  function completude(e) {
    return B().categories.map((c) => ({ id: c.id, nom: c.nom, nb: e.fiches.filter((f) => f.categorie === c.id).length }));
  }
  // Fiches retenues pour le dossier imprimé : catégories cochées, fiches privées exclues sauf choix
  // explicite, exclusions individuelles respectées.
  function dossier(e, choix) {
    const cats = new Set(choix.categories);
    const inclus = (f) => cats.has(f.categorie) && !choix.exclues.includes(f.id) && (!f.prive || choix.prives.includes(f.id));
    return B().categories.filter((c) => cats.has(c.id)).map((c) => ({ categorie: c, fiches: e.fiches.filter((f) => f.categorie === c.id && inclus(f)).sort((a, b) => a.titre.localeCompare(b.titre, 'fr')) })).filter((g) => g.fiches.length);
  }

  // ---------- Normalisation : nettoyage systématique des informations sensibles ----------
  function normaliserFiche(f, compteur) {
    f = f && typeof f === 'object' ? f : {};
    const cat = categorie(f.categorie) || B().categories.find((c) => c.id === 'consignes');
    const propre = (v, max) => { const m = masquer(O.texte(v, max)); compteur.n += m.retraits; return m.texte; };
    const valeurs = {};
    for (const c of cat.champs) {
      const v = f.valeurs?.[c.id];
      if (v === null || v === undefined || v === '') continue;
      if (c.type === 'date') { if (O.estDate(v)) valeurs[c.id] = v; }
      else if (c.type === 'choix') { if (c.options.includes(v)) valeurs[c.id] = v; }
      else valeurs[c.id] = propre(v, c.type === 'long' ? 1500 : 200);
    }
    return { id: O.idValide(f.id), categorie: cat.id, titre: propre(f.titre, 120) || cat.titre, valeurs, note: propre(f.note, 2000), prive: !!f.prive, majLe: O.dateOuNull(f.majLe) };
  }
  const etatVide = () => ({ version: 1, reglages: { nomFoyer: '', revueJours: 365 }, fiches: [], retraits: 0 });
  function normaliser(d) {
    const v = etatVide();
    if (!d || typeof d !== 'object') return v;
    const compteur = { n: 0 };
    const fiches = O.tableau(d.fiches).slice(0, 2000).map((f) => normaliserFiche(f, compteur));
    return { ...d, version: 1, reglages: { nomFoyer: O.texte(d.reglages?.nomFoyer, 80), revueJours: O.entier(d.reglages?.revueJours, 30, 1825, 365) }, fiches, retraits: compteur.n };
  }

  // ---------- Export CSV (fiches choisies) ----------
  function csvFiches(fiches) {
    const rows = [['Catégorie', 'Titre', 'Champ', 'Valeur', 'Privée', 'Mise à jour']];
    for (const f of fiches) {
      const cat = categorie(f.categorie);
      const lignes = [...cat.champs.filter((c) => f.valeurs[c.id]).map((c) => [c.libelle, f.valeurs[c.id]]), ...(f.note ? [['Note', f.note]] : [])];
      if (!lignes.length) rows.push([cat.nom, f.titre, '', '', f.prive ? 'oui' : 'non', f.majLe || '']);
      for (const [l, v] of lignes) rows.push([cat.nom, f.titre, l, v, f.prive ? 'oui' : 'non', f.majLe || '']);
    }
    return rows;
  }

  racine.MMF = {
    RETIRE, sansAccents, luhn, estCarte, estIban, estNir, detecter, masquer, messageRefus,
    categorie, textes, verifierFiche, rechercher, aRevoir, completude, dossier, normaliserFiche, etatVide, normaliser, csvFiches,
  };
})(typeof window !== 'undefined' ? window : globalThis);
