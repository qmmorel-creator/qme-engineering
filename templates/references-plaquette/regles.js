// Kit références et plaquette QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.KRF) et par les tests Node (vm).
// Mois « AAAA-MM » (comparables comme des chaînes). Les textes sont ceux saisis par l'utilisateur ; les
// comparaisons (filtres, mots-clés, pertinence) ignorent la casse et les accents.
(function (racine) {
  'use strict';

  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const MAX_VISUEL = 160_000;     // octets d'un visuel (après compression dans le navigateur)
  const MAX_VISUELS = 12;         // visuels au plus pour l'ensemble des références
  const MAX_ETAT = 850_000;       // octets du JSON enregistré (marge sous la limite de 900 Ko du stockage)
  const MAX_RESULTATS = 4;
  const OPTIONS_DEFAUT = { nomsClients: true, temoignages: true, montants: false, visuels: true };

  // ---------- Textes ----------
  const sansAccents = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
  const cleTexte = (s) => sansAccents(s).toLowerCase().replace(/[’']/g, ' ').replace(/\s+/g, ' ').trim();
  const nbMots = (s) => (String(s ?? '').trim().match(/[^\s]+/g) || []).length;
  // « a, b ; c » ou une liste → mots-clés uniques (casse et accents ignorés), dans l'ordre de saisie.
  function lireMotsCles(v) {
    const liste = Array.isArray(v) ? v : String(v ?? '').split(/[,;\n]/);
    const vus = new Set(), sortie = [];
    for (const brut of liste) {
      const m = String(brut ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
      const k = cleTexte(m);
      if (!m || vus.has(k)) continue;
      vus.add(k); sortie.push(m);
      if (sortie.length >= 12) break;
    }
    return sortie;
  }
  const contientChiffre = (s) => /\d/.test(String(s ?? ''));

  // ---------- Mois ----------
  const estMois = (s) => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
  const moisDeDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  function ajoutMois(c, n) {
    const [a, m] = c.split('-').map(Number);
    const t = a * 12 + (m - 1) + n;
    return `${Math.floor(t / 12)}-${String((t % 12 + 12) % 12 + 1).padStart(2, '0')}`;
  }
  const ecartMois = (de, a) => { const [a1, m1] = de.split('-').map(Number), [a2, m2] = a.split('-').map(Number); return (a2 - a1) * 12 + (m2 - m1); };
  const libMois = (c) => { const [a, m] = c.split('-').map(Number); return `${MOIS[m - 1]} ${a}`; };
  // Période lisible : « 2025 », « mars → juin 2025 », « nov. 2024 → févr. 2025 », « depuis mars 2025 ».
  function periode(p) {
    const d = p.debut, f = p.fin;
    if (!estMois(d) && !estMois(f)) return '';
    if (!estMois(d)) return libMois(f);
    if (!estMois(f)) return `depuis ${libMois(d)}`;
    if (d === f) return libMois(d);
    const [ad, md] = d.split('-').map(Number), [af] = f.split('-').map(Number);
    if (ad === af) return `${MOIS[md - 1]} → ${libMois(f)}`;
    return `${libMois(d)} → ${libMois(f)}`;
  }
  // Année retenue pour les filtres et la liste : celle de la fin, sinon du début.
  const annee = (p) => (estMois(p.fin) ? p.fin : estMois(p.debut) ? p.debut : '').slice(0, 4);
  // Mois de référence d'un projet (pour le tri et la récence) : fin, sinon début.
  const moisRef = (p) => (estMois(p.fin) ? p.fin : estMois(p.debut) ? p.debut : '');

  // ---------- Identifiants ----------
  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  // ---------- Normalisation (tolérante aux anciennes versions et aux imports) ----------
  const txt = (v, max) => String(v ?? '').slice(0, max);
  const VISUEL_OK = /^data:image\/(jpeg|png|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/;
  const octetsDataUrl = (u) => { const i = String(u || '').indexOf(','); return i < 0 ? 0 : Math.floor((u.length - i - 1) * 3 / 4); };

  function normaliserProjet(p = {}) {
    const c = p.client || {};
    const t = p.temoignage || {};
    const resultats = (Array.isArray(p.resultats) ? p.resultats : [])
      .map((r) => ({ valeur: txt(r?.valeur, 24).trim(), libelle: txt(r?.libelle, 80).trim() }))
      .filter((r) => r.valeur || r.libelle).slice(0, MAX_RESULTATS);
    const visuel = typeof p.visuel === 'string' && VISUEL_OK.test(p.visuel) && octetsDataUrl(p.visuel) <= MAX_VISUEL ? p.visuel : '';
    return {
      id: txt(p.id, 40) || nouvelId(),
      titre: txt(p.titre, 120).trim(),
      type: txt(p.type, 60).trim(),
      client: { nom: txt(c.nom, 80).trim(), accord: c.accord === true, secteur: txt(c.secteur, 30), taille: txt(c.taille, 30), region: txt(c.region, 60).trim() },
      debut: estMois(p.debut) ? p.debut : '',
      fin: estMois(p.fin) ? p.fin : '',
      duree: txt(p.duree, 40).trim(),
      contexte: txt(p.contexte, 1500),
      mission: txt(p.mission, 2000),
      resultats,
      temoignage: { texte: txt(t.texte, 800), auteur: txt(t.auteur, 100).trim(), accord: t.accord === true },
      motsCles: lireMotsCles(p.motsCles),
      montant: txt(p.montant, 40).trim(),
      afficherMontant: p.afficherMontant === true,
      visuel,
      legende: visuel ? txt(p.legende, 120).trim() : '',
      avant: p.avant === true,
      creeLe: txt(p.creeLe, 30),
    };
  }

  function normaliserSelection(s = {}, idsProjets = null) {
    const o = s.options || {};
    const ids = (Array.isArray(s.projets) ? s.projets : []).filter((id) => typeof id === 'string' && (!idsProjets || idsProjets.has(id)));
    return {
      id: txt(s.id, 40) || nouvelId(),
      nom: txt(s.nom, 80).trim(),
      secteur: txt(s.secteur, 30),
      type: txt(s.type, 60).trim(),
      motsCles: lireMotsCles(s.motsCles),
      intro: txt(s.intro, 1200),
      modele: ['plaquette', 'fiches', 'liste'].includes(s.modele) ? s.modele : 'plaquette',
      projets: [...new Set(ids)],
      options: Object.fromEntries(Object.entries(OPTIONS_DEFAUT).map(([k, d]) => [k, typeof o[k] === 'boolean' ? o[k] : d])),
      creeLe: txt(s.creeLe, 30),
    };
  }

  function normaliserProfil(p = {}) {
    return {
      nom: txt(p.nom, 80).trim(),
      metier: txt(p.metier, 30) || 'general',
      accroche: txt(p.accroche, 160),
      presentation: txt(p.presentation, 900),
      zone: txt(p.zone, 120),
      coordonnees: txt(p.coordonnees, 400),
      chiffres: (Array.isArray(p.chiffres) ? p.chiffres : []).map((c) => ({ valeur: txt(c?.valeur, 16).trim(), libelle: txt(c?.libelle, 60).trim() })).filter((c) => c.valeur || c.libelle).slice(0, 4),
      accent: ['bleu', 'rouge', 'jaune', 'encre'].includes(p.accent) ? p.accent : 'bleu',
    };
  }

  const etatVide = () => ({ version: 1, profil: normaliserProfil(), projets: [], selections: [] });

  function normaliser(d) {
    const e = etatVide();
    if (!d || typeof d !== 'object') return e;
    e.profil = normaliserProfil(d.profil);
    e.projets = (Array.isArray(d.projets) ? d.projets : []).map(normaliserProjet);
    // Identifiants en double (import fusionné à la main) : renommés.
    const vus = new Set();
    for (const p of e.projets) { if (vus.has(p.id)) p.id = nouvelId(); vus.add(p.id); }
    const ids = new Set(e.projets.map((p) => p.id));
    e.selections = (Array.isArray(d.selections) ? d.selections : []).map((s) => normaliserSelection(s, ids));
    if (d.majLe) e.majLe = d.majLe;
    return e;
  }

  // ---------- Client affiché ----------
  // Le nom n'apparaît que s'il est saisi, que l'accord du client est noté et que la sélection l'autorise.
  // Sinon : description (taille, secteur, région), jamais vide.
  function descriptionClient(c, base) {
    const taille = base?.tailles?.find((t) => t.id === c.taille);
    // « Une association · Associations » : le secteur répète la taille, il est omis.
    const REDONDANT = { association: 'associations', collectivite: 'public', particulier: 'particuliers' };
    const secteur = REDONDANT[c.taille] === c.secteur ? null : base?.secteurs?.find((s) => s.id === c.secteur);
    const morceaux = [taille ? taille.phrase : '', secteur ? secteur.nom : '', c.region].filter(Boolean);
    if (!morceaux.length) return 'Client confidentiel';
    if (!taille && morceaux.length) morceaux[0] = `Client · ${morceaux[0]}`;
    return morceaux.join(' · ');
  }
  const clientNommable = (p) => Boolean(p.client.nom && p.client.accord);
  function clientAffiche(p, base, options = OPTIONS_DEFAUT) {
    if (clientNommable(p) && options.nomsClients !== false) return p.client.nom;
    return descriptionClient(p.client, base);
  }
  const temoignageVisible = (p, options = OPTIONS_DEFAUT) => Boolean(p.temoignage.texte.trim() && p.temoignage.accord && options.temoignages !== false);
  const montantVisible = (p, options = OPTIONS_DEFAUT) => Boolean(p.montant && p.afficherMontant && options.montants === true);
  const resultatsChiffres = (p) => p.resultats.filter((r) => contientChiffre(r.valeur));

  // ---------- Complétude et alertes ----------
  // Pondération : ce qui convainc un prospect (mission décrite, résultat chiffré) pèse le plus. Total 100.
  const CRITERES = [
    ['titre', 10, 'Un titre', (p) => p.titre.length >= 3],
    ['client', 10, 'Le client décrit (secteur ou taille)', (p) => Boolean(p.client.secteur || p.client.taille || clientNommable(p))],
    ['contexte', 15, 'Le contexte (15 mots au moins)', (p) => nbMots(p.contexte) >= 15],
    ['mission', 20, 'La mission (15 mots au moins)', (p) => nbMots(p.mission) >= 15],
    ['resultat', 20, 'Un résultat chiffré', (p) => resultatsChiffres(p).length > 0],
    ['periode', 5, 'La période', (p) => Boolean(p.debut || p.fin)],
    ['motsCles', 10, 'Deux mots-clés', (p) => p.motsCles.length >= 2],
    ['temoignage', 5, 'Un témoignage avec accord', (p) => Boolean(p.temoignage.texte.trim() && p.temoignage.accord)],
    ['visuel', 5, 'Un visuel', (p) => Boolean(p.visuel)],
  ];
  function completude(p) {
    let score = 0;
    const manques = [];
    for (const [id, poids, lib, ok] of CRITERES) { if (ok(p)) score += poids; else manques.push({ id, poids, libelle: lib }); }
    return { score, manques, niveau: score >= 80 ? 'pret' : score >= 50 ? 'correct' : 'brouillon' };
  }
  const NIVEAUX = { pret: 'Prête à montrer', correct: 'À enrichir', brouillon: 'À compléter' };

  const RE_EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
  // Numéro de téléphone (format français courant ou international) : 10 chiffres groupés, ou +XX suivi de 9 chiffres.
  const RE_TEL = /(?:\+\d{2}\s?[1-9](?:[\s.-]?\d{2}){4}|\b0[1-9](?:[\s.-]?\d{2}){4}\b)/;
  function alertes(p) {
    const a = [];
    if (p.client.nom && !p.client.accord) a.push({ id: 'nom-sans-accord', niveau: 'attention', texte: 'Client nommé sans accord noté : la plaquette affichera sa description à la place de son nom.' });
    if (p.temoignage.texte.trim() && !p.temoignage.accord) a.push({ id: 'temoignage-sans-accord', niveau: 'attention', texte: 'Témoignage sans accord de citation : il ne sera pas imprimé.' });
    const textes = [p.titre, p.contexte, p.mission, p.temoignage.texte, p.temoignage.auteur, p.legende, ...p.resultats.map((r) => `${r.valeur} ${r.libelle}`)].join('\n');
    if (RE_EMAIL.test(textes) || RE_TEL.test(textes)) a.push({ id: 'coordonnees', niveau: 'attention', texte: 'Une adresse e-mail ou un numéro de téléphone figure dans la fiche : retire-le si ce sont les coordonnées d\'une personne.' });
    if (p.montant && p.afficherMontant) a.push({ id: 'montant', niveau: 'info', texte: 'Montant affiché si la sélection l\'autorise : vérifie que le client est d\'accord.' });
    if (p.resultats.length && !resultatsChiffres(p).length) a.push({ id: 'resultat-sans-chiffre', niveau: 'info', texte: 'Résultat sans chiffre : un nombre (délai, volume, pourcentage) le rend plus parlant.' });
    return a;
  }

  // ---------- Filtres et mots-clés ----------
  function motsCles(projets) {
    const m = new Map();
    for (const p of projets) for (const mot of p.motsCles) {
      const k = cleTexte(mot);
      const x = m.get(k) || { mot, n: 0 };
      x.n++; m.set(k, x);
    }
    return [...m.values()].sort((a, b) => b.n - a.n || cleTexte(a.mot).localeCompare(cleTexte(b.mot)));
  }
  const annees = (projets) => [...new Set(projets.map(annee).filter(Boolean))].sort().reverse();
  const texteRecherche = (p, base) => cleTexte([p.titre, p.type, p.client.nom, descriptionClient(p.client, base), p.contexte, p.mission, p.motsCles.join(' '), p.resultats.map((r) => `${r.valeur} ${r.libelle}`).join(' '), p.temoignage.texte].join(' '));

  // Tri : mises en avant d'abord, puis les plus récentes, puis par titre.
  function trier(projets) {
    return [...projets].sort((a, b) => (b.avant - a.avant) || moisRef(b).localeCompare(moisRef(a)) || cleTexte(a.titre).localeCompare(cleTexte(b.titre)));
  }

  function filtrer(projets, f = {}, base = null) {
    const q = cleTexte(f.q).split(' ').filter(Boolean);
    const mot = f.motCle ? cleTexte(f.motCle) : '';
    return trier(projets.filter((p) => {
      if (f.secteur && p.client.secteur !== f.secteur) return false;
      if (f.type && cleTexte(p.type) !== cleTexte(f.type)) return false;
      if (f.annee && annee(p) !== String(f.annee)) return false;
      if (mot && !p.motsCles.some((m) => cleTexte(m) === mot)) return false;
      if (f.chiffre && !resultatsChiffres(p).length) return false;
      if (f.temoignage && !(p.temoignage.texte.trim() && p.temoignage.accord)) return false;
      if (f.aCompleter && completude(p).niveau === 'pret') return false;
      if (f.avant && !p.avant) return false;
      if (q.length) { const t = texteRecherche(p, base); if (!q.every((x) => t.includes(x))) return false; }
      return true;
    }));
  }

  // ---------- Pertinence pour un prospect ----------
  // criteres : { secteur, type, motsCles } d'une sélection. Score sur 100 (borné), avec ses raisons.
  //  secteur identique 30 ; type de mission identique 15 ; mot-clé commun 15 chacun (45 au plus) ;
  //  mot-clé du prospect trouvé seulement dans les textes 5 chacun (15 au plus) ; résultat chiffré 5 ;
  //  témoignage citable 4 ; récence (12 derniers mois 4, 36 derniers mois 2) ; mise en avant 2.
  function pertinence(p, c = {}, aujourdhui = null) {
    let score = 0;
    const raisons = [];
    if (c.secteur && p.client.secteur === c.secteur) { score += 30; raisons.push('même secteur'); }
    if (c.type && p.type && cleTexte(p.type) === cleTexte(c.type)) { score += 15; raisons.push('même type de mission'); }
    const mp = new Set(p.motsCles.map(cleTexte));
    const texte = cleTexte(`${p.titre} ${p.contexte} ${p.mission} ${p.type}`);
    const communs = [], dansTexte = [];
    for (const m of lireMotsCles(c.motsCles)) {
      const k = cleTexte(m);
      if (mp.has(k)) communs.push(m); else if (k.length >= 3 && texte.includes(k)) dansTexte.push(m);
    }
    if (communs.length) { score += Math.min(45, communs.length * 15); raisons.push(`mots-clés : ${communs.join(', ')}`); }
    if (dansTexte.length) { score += Math.min(15, dansTexte.length * 5); raisons.push(`cité dans le texte : ${dansTexte.join(', ')}`); }
    if (resultatsChiffres(p).length) { score += 5; raisons.push('résultat chiffré'); }
    if (p.temoignage.texte.trim() && p.temoignage.accord) { score += 4; raisons.push('témoignage'); }
    const ref = moisRef(p);
    if (ref && estMois(aujourdhui)) {
      const age = ecartMois(ref, aujourdhui);
      if (age <= 12) { score += 4; raisons.push('récente'); } else if (age <= 36) score += 2;
    }
    if (p.avant) score += 2;
    return { score: Math.min(100, score), raisons };
  }
  // Toutes les références triées par pertinence décroissante (les ex aequo par récence), sans celles exclues.
  function suggerer(projets, c = {}, aujourdhui = null, exclure = []) {
    const ex = new Set(exclure);
    return projets.filter((p) => !ex.has(p.id))
      .map((p) => ({ p, ...pertinence(p, c, aujourdhui) }))
      .sort((a, b) => b.score - a.score || moisRef(b.p).localeCompare(moisRef(a.p)) || cleTexte(a.p.titre).localeCompare(cleTexte(b.p.titre)));
  }

  // ---------- Sélection et pages imprimables ----------
  function deplacer(liste, id, delta) {
    const i = liste.indexOf(id), j = i + delta;
    if (i < 0 || j < 0 || j >= liste.length) return liste.slice();
    const l = liste.slice();
    [l[i], l[j]] = [l[j], l[i]];
    return l;
  }
  // Références d'une sélection, dans son ordre, sans celles supprimées depuis.
  const projetsSelection = (E, sel) => sel.projets.map((id) => E.projets.find((p) => p.id === id)).filter(Boolean);
  // Sélection « Mes références mises en avant » (aucune sélection choisie) : mises en avant, sinon les 6 plus récentes.
  function selectionParDefaut(E) {
    const avant = trier(E.projets.filter((p) => p.avant));
    const liste = avant.length ? avant : trier(E.projets).slice(0, 6);
    return normaliserSelection({ id: '', nom: '', projets: liste.map((p) => p.id), modele: 'plaquette' }, null);
  }
  // Découpage en pages A4. Plaquette : couverture puis 2 références par page. Fiches : 1 par page (la première
  // porte l'introduction). Liste : 14 lignes par page. Une sélection vide donne une seule page (couverture ou liste vide).
  function pagesPlaquette(ids, modele = 'plaquette') {
    const n = { plaquette: 2, fiches: 1, liste: 14 }[modele] || 2;
    const paquets = [];
    for (let i = 0; i < ids.length; i += n) paquets.push(ids.slice(i, i + n));
    if (modele === 'plaquette') return [{ type: 'couverture', refs: [] }, ...paquets.map((refs) => ({ type: 'refs', refs }))];
    if (modele === 'liste') return (paquets.length ? paquets : [[]]).map((refs, i) => ({ type: 'liste', refs, premiere: i === 0 }));
    return (paquets.length ? paquets : [[]]).map((refs, i) => ({ type: 'fiche', refs, premiere: i === 0 }));
  }

  // ---------- Textes à copier ----------
  function texteReference(p, base, options = OPTIONS_DEFAUT) {
    const l = [];
    l.push(p.titre || 'Référence');
    const meta = [clientAffiche(p, base, options), p.type, periode(p), p.duree, montantVisible(p, options) ? p.montant : ''].filter(Boolean);
    if (meta.length) l.push(meta.join(' · '));
    if (p.contexte.trim()) l.push('', `Contexte : ${p.contexte.trim()}`);
    if (p.mission.trim()) l.push('', `Mission : ${p.mission.trim()}`);
    const r = p.resultats.filter((x) => x.valeur || x.libelle);
    if (r.length) l.push('', 'Résultats :', ...r.map((x) => `- ${[x.valeur, x.libelle].filter(Boolean).join(' ')}`));
    if (temoignageVisible(p, options)) l.push('', `« ${p.temoignage.texte.trim()} »${p.temoignage.auteur ? ` (${p.temoignage.auteur})` : ''}`);
    return l.join('\n');
  }
  function texteSelection(E, sel, base) {
    const projets = projetsSelection(E, sel);
    const l = [];
    if (sel.intro.trim()) l.push(sel.intro.trim(), '');
    projets.forEach((p, i) => { l.push(`${i + 1}. ${texteReference(p, base, sel.options)}`, ''); });
    const signature = [E.profil.nom, E.profil.accroche, E.profil.coordonnees].map((x) => String(x || '').trim()).filter(Boolean);
    if (signature.length) l.push(...signature);
    return l.join('\n').trim();
  }
  function texteDemandeTemoignage(p, base) {
    const q = base?.questionsTemoignage || [];
    return [
      'Bonjour,',
      '',
      `Je prépare la présentation de mes réalisations et j'aimerais y faire figurer notre projet${p?.titre ? ` « ${p.titre} »` : ''}. Auriez-vous quelques minutes pour répondre à ces questions, en deux ou trois phrases chacune ?`,
      '',
      ...q.map((x, i) => `${i + 1}. ${x}`),
      '',
      'Je vous enverrai le texte final pour validation avant toute utilisation. Merci beaucoup !',
    ].join('\n');
  }

  // ---------- Visuels et taille ----------
  const nbVisuels = (E) => E.projets.filter((p) => p.visuel).length;
  function tailleEtat(E) {
    const s = JSON.stringify(E);
    return typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s).length : s.length;
  }
  // Un visuel peut-il être ajouté (ou remplacer celui du projet idProjet) ? → null si oui, sinon la raison.
  function refusVisuel(E, idProjet, dataUrl) {
    if (!VISUEL_OK.test(dataUrl || '')) return 'Format d\'image non reconnu (JPEG, PNG ou WebP).';
    const o = octetsDataUrl(dataUrl);
    if (o > MAX_VISUEL) return `Image trop lourde même réduite (${Math.round(o / 1000)} Ko, ${MAX_VISUEL / 1000} Ko au plus).`;
    const p = E.projets.find((x) => x.id === idProjet);
    const autres = nbVisuels(E) - (p?.visuel ? 1 : 0);
    if (autres >= MAX_VISUELS) return `${MAX_VISUELS} visuels au plus pour l'ensemble des références : retire-en un d'abord.`;
    const apres = tailleEtat(E) - (p?.visuel?.length || 0) + dataUrl.length;
    if (apres > MAX_ETAT) return 'Espace de stockage presque plein : retire un visuel ou raccourcis des textes.';
    return null;
  }
  // Couverture géométrique d'une référence sans visuel : couleur et forme stables, tirées du type et de l'id.
  function couverture(p, base) {
    const k = `${cleTexte(p.type)}|${p.id}`;
    let h = 0;
    for (const ch of k) h = (h * 31 + ch.charCodeAt(0)) | 0;
    h = Math.abs(h);
    const accents = base?.accents || [{ id: 'bleu' }];
    const formes = base?.formes || ['rond'];
    return { accent: accents[h % accents.length].id, forme: formes[Math.floor(h / 7) % formes.length] };
  }

  // ---------- Statistiques ----------
  function statistiques(E) {
    const p = E.projets;
    const ans = annees(p);
    return {
      total: p.length,
      chiffres: p.filter((x) => resultatsChiffres(x).length).length,
      temoignages: p.filter((x) => x.temoignage.texte.trim() && x.temoignage.accord).length,
      prets: p.filter((x) => completude(x).niveau === 'pret').length,
      alertes: p.filter((x) => alertes(x).some((a) => a.niveau === 'attention')).length,
      secteurs: new Set(p.map((x) => x.client.secteur).filter(Boolean)).size,
      depuis: ans.length ? ans[ans.length - 1] : '',
    };
  }

  // ---------- Export CSV (point-virgule, BOM pour les tableurs) ----------
  const champCsv = (v) => { const s = String(v ?? ''); return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = (lignes) => '﻿' + lignes.map((l) => l.map(champCsv).join(';')).join('\r\n');
  function versCsv(E, base) {
    const nom = (liste, id) => base?.[liste]?.find((x) => x.id === id)?.nom || '';
    const tete = ['Titre', 'Type de mission', 'Client (nom)', 'Accord pour le nommer', 'Client affiché', 'Secteur', 'Taille', 'Région', 'Début', 'Fin', 'Durée', 'Contexte', 'Mission', 'Résultats', 'Témoignage', 'Auteur du témoignage', 'Accord de citation', 'Mots-clés', 'Montant', 'Visuel', 'Mise en avant', 'Complétude'];
    const lignes = trier(E.projets).map((p) => [p.titre, p.type, p.client.nom, p.client.accord ? 'oui' : 'non', clientAffiche(p, base), nom('secteurs', p.client.secteur), nom('tailles', p.client.taille), p.client.region, p.debut, p.fin, p.duree, p.contexte, p.mission, p.resultats.map((r) => `${r.valeur} ${r.libelle}`.trim()).join(' | '), p.temoignage.texte, p.temoignage.auteur, p.temoignage.accord ? 'oui' : 'non', p.motsCles.join(', '), p.montant, p.visuel ? 'oui' : 'non', p.avant ? 'oui' : 'non', completude(p).score]);
    return csv([tete, ...lignes]);
  }

  function dupliquer(p) {
    const c = normaliserProjet(JSON.parse(JSON.stringify(p)));
    c.id = nouvelId();
    c.titre = `${p.titre} (copie)`.slice(0, 120);
    c.avant = false;
    return c;
  }

  racine.KRF = {
    MOIS, MAX_VISUEL, MAX_VISUELS, MAX_ETAT, MAX_RESULTATS, OPTIONS_DEFAUT, NIVEAUX, CRITERES,
    sansAccents, cleTexte, nbMots, lireMotsCles, contientChiffre,
    estMois, moisDeDate, ajoutMois, ecartMois, libMois, periode, annee, moisRef,
    nouvelId, octetsDataUrl, normaliserProjet, normaliserSelection, normaliserProfil, etatVide, normaliser,
    descriptionClient, clientNommable, clientAffiche, temoignageVisible, montantVisible, resultatsChiffres,
    completude, alertes, motsCles, annees, trier, filtrer, pertinence, suggerer,
    deplacer, projetsSelection, selectionParDefaut, pagesPlaquette,
    texteReference, texteSelection, texteDemandeTemoignage,
    nbVisuels, tailleEtat, refusVisuel, couverture, statistiques, versCsv, dupliquer,
  };
})(typeof window !== 'undefined' ? window : globalThis);
