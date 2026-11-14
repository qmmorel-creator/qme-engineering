// État des lieux QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.ETD) et par les tests Node (outils/templates/etat-des-lieux.test.mjs).
//
// Modèle : dossiers (un par bail) → pièces → éléments. Chaque élément porte deux constats, `entree` et `sortie`
// (état codé, commentaire, vignette photo) ; la sortie porte en plus le coût de remise en état et le choix
// « imputable au locataire ». Le dossier porte aussi les compteurs (relevés d'entrée et de sortie), les clés
// (remises et rendues), la grille de vétusté convenue dans le bail (saisie, aucune intégrée) et le dépôt de garantie.
// Comparaison : une sortie moins bonne que l'entrée (rang de l'état plus élevé) est une dégradation.
// Vétusté : taux = min(100 − part résiduelle, max(0, âge − franchise) × abattement annuel), âge en années pleines
// entre la pose (ou la dernière rénovation) et la date de sortie. Part du locataire = coût × (1 − taux).
// Délais (dépôt de garantie, rectification) : paramètres des réglages. Tout ce qui dépend du jour reçoit `auj`.
(function (g) {
  'use strict';

  // ---------- Dates et textes ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = String(s).slice(0, 10).split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  // Ajoute n mois ; le jour est ramené au dernier jour du mois s'il n'existe pas (31 janvier + 1 mois = 28 ou 29 février).
  function ajoutMois(s, n) {
    const d = versDate(s);
    const cible = new Date(d.getFullYear(), d.getMonth() + n, 1);
    const fin = new Date(cible.getFullYear(), cible.getMonth() + 1, 0).getDate();
    cible.setDate(Math.min(d.getDate(), fin));
    return iso(cible);
  }
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const dateFr = (s) => { const d = versDate(s); return `${d.getDate() === 1 ? '1er' : d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`; };
  function nombreTexte(n, decimales = 0, fixe = false) {
    const v = Number(n) || 0;
    const f = Math.pow(10, decimales);
    const r = Math.round(Math.abs(v) * f) / f;
    const [e, d] = r.toFixed(decimales).split('.');
    const groupes = e.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const dec = d ? (fixe ? d : d.replace(/0+$/, '')) : '';
    return `${v < 0 && r !== 0 ? '−' : ''}${groupes}${dec ? `,${dec}` : ''}`;
  }
  const euros = (n) => `${nombreTexte(n, 2, true)} €`;
  const plat = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36).slice(-5)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const centimes = (v) => Math.round(v * 100 + 1e-9) / 100;

  // ---------- Normalisation ----------
  const txt = (v, max) => String(v ?? '').replace(/[ \t]+/g, ' ').trim().slice(0, max);
  const long = (v, max) => String(v ?? '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
  const nb = (v, min, max, def = min) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def; };
  const nbOuNul = (v, min, max) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Math.min(max, Math.max(min, Number(v))));
  const idOk = (v) => (typeof v === 'string' && /^[\w-]{1,40}$/.test(v) ? v : nouvelId());
  const dateOk = (v) => (estDate(v) ? v : '');
  const ETATS = ['neuf', 'bon', 'usage', 'degrade', 'hs'];
  const rang = (etat) => ETATS.indexOf(etat);
  const PHOTO_MAX_CAR = 40000; // une vignette synchronisée ne dépasse pas ~40 000 caractères (data URL JPEG)
  const photoOk = (p) => (typeof p === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p) && p.length <= PHOTO_MAX_CAR ? p : '');
  // Date de pose : « 2019 », « 03/2019 », « 2019-03 » ou une date complète ; gardée sous forme AAAA ou AAAA-MM ou AAAA-MM-JJ.
  function lirePose(v) {
    const s = String(v ?? '').trim();
    if (!s) return '';
    let m = s.match(/^(\d{4})$/);
    if (m) return Number(m[1]) >= 1900 && Number(m[1]) <= 2200 ? m[1] : null;
    const mois = (a, mo) => (Number(mo) < 1 || Number(mo) > 12 || Number(a) < 1900 || Number(a) > 2200 ? null : `${a}-${deux(Number(mo))}`);
    m = s.match(/^(\d{1,2})[/.-](\d{4})$/);
    if (m) return mois(m[2], m[1]);
    m = s.match(/^(\d{4})-(\d{1,2})$/);
    if (m) return mois(m[1], m[2]);
    m = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
    if (m) { const d = `${m[3]}-${deux(Number(m[2]))}-${deux(Number(m[1]))}`; return estDate(d) ? d : null; }
    return estDate(s) ? s : null;
  }
  // Date retenue pour une pose : année seule → 1er juillet (milieu d'année) ; mois → 1er du mois.
  const datePose = (p) => (!p ? '' : p.length === 4 ? `${p}-07-01` : p.length === 7 ? `${p}-01` : p);
  const poseTexte = (p) => (!p ? '' : p.length === 4 ? p : p.length === 7 ? `${p.slice(5)}/${p.slice(0, 4)}` : `${p.slice(8)}/${p.slice(5, 7)}/${p.slice(0, 4)}`);

  function normaliserConstat(c, sortie = false) {
    const r = { etat: ETATS.includes(c?.etat) ? c.etat : '', com: long(c?.com, 400), photo: photoOk(c?.photo) };
    if (sortie) { r.cout = nbOuNul(c?.cout, 0, 1e6); r.imputable = c?.imputable !== false; }
    return r;
  }
  function normaliserElement(x) {
    return {
      id: idOk(x?.id), nom: txt(x?.nom, 80) || 'Élément', cat: txt(x?.cat, 20) || 'equipements',
      grille: typeof x?.grille === 'string' ? x.grille.slice(0, 40) : '', pose: lirePose(x?.pose) || '',
      entree: normaliserConstat(x?.entree), sortie: normaliserConstat(x?.sortie, true),
    };
  }
  function normaliserPiece(p) {
    return { id: idOk(p?.id), nom: txt(p?.nom, 60) || 'Pièce', type: txt(p?.type, 20) || 'autre', elements: (Array.isArray(p?.elements) ? p.elements : []).slice(0, 60).map(normaliserElement) };
  }
  function normaliserCompteur(c) {
    return { id: idOk(c?.id), type: txt(c?.type, 20) || 'autre', nom: txt(c?.nom, 60), numero: txt(c?.numero, 40), unite: txt(c?.unite, 12), entree: nbOuNul(c?.entree, 0, 1e9), sortie: nbOuNul(c?.sortie, 0, 1e9), com: long(c?.com, 200) };
  }
  function normaliserCle(c) {
    return { id: idOk(c?.id), type: txt(c?.type, 20) || 'autre', nom: txt(c?.nom, 60), entree: nbOuNul(c?.entree, 0, 99), sortie: nbOuNul(c?.sortie, 0, 99), com: long(c?.com, 200) };
  }
  function normaliserLigneGrille(l) {
    return { id: idOk(l?.id), nom: txt(l?.nom, 60) || 'Ligne', franchise: nb(l?.franchise, 0, 50, 0), abattement: nb(l?.abattement, 0, 100, 0), residuel: nb(l?.residuel, 0, 100, 0) };
  }
  const personne = (p) => ({ nom: txt(p?.nom, 100), adresse: long(p?.adresse, 200) });
  function normaliserDossier(d) {
    const lg = d?.logement || {};
    return {
      id: idOk(d?.id),
      logement: { adresse: long(lg.adresse, 200), complement: txt(lg.complement, 120), type: lg.type === 'meuble' ? 'meuble' : 'nu', surface: nbOuNul(lg.surface, 0, 10000), modele: txt(lg.modele, 20) },
      bailleur: personne(d?.bailleur),
      mandataire: personne(d?.mandataire),
      locataires: txt(d?.locataires, 160),
      bail: { debut: dateOk(d?.bail?.debut), fin: dateOk(d?.bail?.fin), depot: nbOuNul(d?.bail?.depot, 0, 1e6), loyer: nbOuNul(d?.bail?.loyer, 0, 1e6) },
      entree: { date: dateOk(d?.entree?.date), lieu: txt(d?.entree?.lieu, 80), observations: long(d?.entree?.observations, 1200) },
      sortie: { date: dateOk(d?.sortie?.date), lieu: txt(d?.sortie?.lieu, 80), adresse: long(d?.sortie?.adresse, 200), observations: long(d?.sortie?.observations, 1200) },
      conformite: ['auto', 'conforme', 'non'].includes(d?.conformite) ? d.conformite : 'auto',
      pieces: (Array.isArray(d?.pieces) ? d.pieces : []).slice(0, 40).map(normaliserPiece),
      compteurs: (Array.isArray(d?.compteurs) ? d.compteurs : []).slice(0, 20).map(normaliserCompteur),
      cles: (Array.isArray(d?.cles) ? d.cles : []).slice(0, 20).map(normaliserCle),
      grille: (Array.isArray(d?.grille) ? d.grille : []).slice(0, 40).map(normaliserLigneGrille),
      archive: !!d?.archive,
      cree: dateOk(d?.cree),
    };
  }
  function normaliserReglages(r, base) {
    const b = base?.reglages || {};
    return {
      restitutionConforme: nb(r?.restitutionConforme, 0, 12, b.restitutionConforme ?? 1),
      restitutionNonConforme: nb(r?.restitutionNonConforme, 0, 12, b.restitutionNonConforme ?? 2),
      rectificationJours: nb(r?.rectificationJours, 0, 60, b.rectificationJours ?? 10),
      photosMax: Math.round(nb(r?.photosMax, 0, 60, b.photosMax ?? 30)),
    };
  }
  const etatVide = (base) => ({ version: 1, dossiers: [], reglages: normaliserReglages({}, base) });
  function normaliser(d, base) {
    const e = d && typeof d === 'object' ? d : {};
    const r = { version: 1, dossiers: (Array.isArray(e.dossiers) ? e.dossiers : []).slice(0, 60).map(normaliserDossier), reglages: normaliserReglages(e.reglages, base) };
    if (e.majLe) r.majLe = e.majLe;
    return r;
  }

  // ---------- Création ----------
  function elementsType(type, meuble, base) {
    const t = base.pieces.find((p) => p.code === type) || base.pieces.find((p) => p.code === 'autre');
    return t.elements.concat(meuble ? t.meuble : []).map(([nom, cat]) => normaliserElement({ nom, cat }));
  }
  function nouvellePiece(type, nom, meuble, base) {
    const t = base.pieces.find((p) => p.code === type);
    return normaliserPiece({ type, nom: nom || t?.nom || 'Pièce', elements: elementsType(type, meuble, base) });
  }
  function piecesModele(modele, meuble, base) {
    const m = base.modeles.find((x) => x.code === modele) || base.modeles[0];
    return m.pieces.map(([type, nom]) => nouvellePiece(type, nom, meuble, base));
  }
  // Compteurs et clés proposés à la création d'un dossier.
  const compteursDefaut = (base) => ['eau-froide', 'elec-base'].map((t) => { const c = base.compteurs.find((x) => x.code === t); return normaliserCompteur({ type: t, nom: c.nom, unite: c.unite }); });
  const clesDefaut = (base) => ['porte', 'boite'].map((t) => normaliserCle({ type: t, nom: base.cles.find((x) => x.code === t).nom, entree: 2 }));

  // Nouveau locataire à partir d'un dossier : mêmes logement, bailleur, pièces, éléments, compteurs et clés ; l'état
  // d'entrée reprend l'état (et la photo) constaté à la sortie précédente, ou l'entrée précédente si la sortie manque.
  function reprendreDossier(d, auj) {
    const s = normaliserDossier(d);
    const copie = (c) => ({ etat: c.etat, com: c.com, photo: c.photo });
    return normaliserDossier({
      logement: s.logement, bailleur: s.bailleur, mandataire: s.mandataire, grille: [], locataires: '', cree: auj,
      bail: { depot: s.bail.depot, loyer: s.bail.loyer },
      pieces: s.pieces.map((p) => ({ nom: p.nom, type: p.type, elements: p.elements.map((x) => ({ nom: x.nom, cat: x.cat, pose: x.pose, entree: x.sortie.etat ? copie(x.sortie) : copie(x.entree) })) })),
      compteurs: s.compteurs.map((c) => ({ type: c.type, nom: c.nom, numero: c.numero, unite: c.unite, entree: c.sortie ?? null })),
      cles: s.cles.map((c) => ({ type: c.type, nom: c.nom, entree: c.sortie ?? c.entree })),
    });
  }

  // ---------- Comparaison ----------
  // Différence d'un élément : `vide` (aucun constat), `entree` (sortie pas encore constatée), `sansEntree`
  // (sortie sans entrée), `identique`, `ameliore` (meilleure), `usure` (moins bonne mais encore neuf, bon ou usage
  // normal : l'usure due au temps, sans retenue) et `degrade` (moins bonne et dégradé ou hors service).
  const RANG_DEGRADE = 3;
  function difference(x) {
    const e = rang(x.entree.etat), s = rang(x.sortie.etat);
    if (e < 0 && s < 0) return 'vide';
    if (s < 0) return 'entree';
    if (e < 0) return 'sansEntree';
    if (s < e) return 'ameliore';
    if (s === e) return 'identique';
    return s >= RANG_DEGRADE ? 'degrade' : 'usure';
  }
  const ecartRang = (x) => { const e = rang(x.entree.etat), s = rang(x.sortie.etat); return e < 0 || s < 0 ? 0 : s - e; };
  const tousElements = (d) => d.pieces.flatMap((p) => p.elements.map((x) => ({ piece: p, x })));

  // Avancement d'une phase : éléments constatés / total.
  function avancement(d, phase) {
    const els = tousElements(d);
    const faits = els.filter(({ x }) => x[phase].etat).length;
    return { faits, total: els.length, pct: els.length ? Math.round((faits / els.length) * 100) : 0 };
  }

  // Statut du dossier : à préparer, entrée en cours, entrée faite (logement occupé), sortie en cours, sortie faite.
  function statut(d) {
    const ae = avancement(d, 'entree'), as = avancement(d, 'sortie');
    if (as.faits && as.faits === as.total && d.sortie.date) return 'sortie-faite';
    if (as.faits || d.sortie.date) return 'sortie';
    if (ae.total && ae.faits === ae.total && d.entree.date) return 'occupe';
    if (ae.faits || d.entree.date) return 'entree';
    return 'preparer';
  }

  function consommation(c) {
    if (c.entree === null || c.sortie === null) return null;
    return Math.round((c.sortie - c.entree) * 1000) / 1000;
  }
  // Clés manquantes à la sortie (rendues − remises < 0), null tant que la sortie n'est pas saisie.
  const clesManquantes = (c) => (c.entree === null || c.sortie === null ? null : Math.max(0, c.entree - c.sortie));

  // Différences d'un dossier, triées par pièce (dégradations d'abord dans chaque pièce).
  function differences(d) {
    const ordre = { degrade: 0, sansEntree: 1, ameliore: 2, usure: 3, entree: 4, identique: 5, vide: 6 };
    return d.pieces.flatMap((p) => p.elements.map((x) => ({ piece: p, x, diff: difference(x), ecart: ecartRang(x) }))
      .sort((a, b) => ordre[a.diff] - ordre[b.diff]));
  }

  // ---------- Vétusté et retenues ----------
  // Âge en années pleines entre la pose et la date de sortie (null si la pose ou la sortie manque, ou pose future).
  function ageAnnees(pose, dateSortie) {
    const dp = datePose(pose);
    if (!dp || !estDate(dateSortie) || dateSortie < dp) return null;
    const a = versDate(dp), b = versDate(dateSortie);
    let ans = b.getFullYear() - a.getFullYear();
    if (b.getMonth() < a.getMonth() || (b.getMonth() === a.getMonth() && b.getDate() < a.getDate())) ans -= 1;
    return Math.max(0, ans);
  }
  // Taux de vétusté (0 à 100) d'après une ligne de grille ; null si l'âge est inconnu.
  function tauxVetuste(ligne, age) {
    if (!ligne || age === null || age === undefined) return null;
    const plafond = Math.max(0, 100 - ligne.residuel);
    return Math.min(plafond, Math.max(0, age - ligne.franchise) * ligne.abattement);
  }
  // Retenue proposée pour un élément dégradé : coût de remise en état diminué de la vétusté.
  function retenueElement(d, x) {
    const diff = difference(x);
    const ligne = d.grille.find((l) => l.id === x.grille) || null;
    const age = ageAnnees(x.pose, d.sortie.date);
    const taux = ligne ? tauxVetuste(ligne, age) : null;
    const cout = x.sortie.cout;
    const retenue = diff !== 'degrade' || !x.sortie.imputable || cout === null ? 0 : centimes(cout * (1 - (taux ?? 0) / 100));
    return { diff, ligne, age, taux, cout, retenue, imputable: x.sortie.imputable, incomplet: !!ligne && taux === null };
  }
  function bilanRetenues(d) {
    const lignes = tousElements(d).filter(({ x }) => difference(x) === 'degrade').map(({ piece, x }) => ({ piece, x, ...retenueElement(d, x) }));
    const total = centimes(lignes.reduce((s, l) => s + l.retenue, 0));
    const depot = d.bail.depot;
    return {
      lignes, total, depot,
      sansCout: lignes.filter((l) => l.imputable && l.cout === null).length,
      aRendre: depot === null ? null : centimes(Math.max(0, depot - total)),
      depassement: depot === null ? null : centimes(Math.max(0, total - depot)),
    };
  }

  // ---------- Délais ----------
  // Sortie conforme : réglée par l'utilisateur, ou automatique (aucun élément dégradé ni clé manquante).
  function conforme(d) {
    if (d.conformite !== 'auto') return d.conformite === 'conforme';
    const degrade = tousElements(d).some(({ x }) => difference(x) === 'degrade');
    const cles = d.cles.some((c) => (clesManquantes(c) || 0) > 0);
    return !degrade && !cles;
  }
  // Date limite de restitution du dépôt de garantie : remise des clés (date de sortie) + 1 ou 2 mois (réglages).
  function restitution(d, reglages, auj) {
    if (!d.sortie.date) return null;
    const ok = conforme(d);
    const mois = ok ? reglages.restitutionConforme : reglages.restitutionNonConforme;
    const limite = ajoutMois(d.sortie.date, mois);
    return { conforme: ok, mois, limite, joursRestants: auj ? ecart(auj, limite) : null };
  }
  // Fin du délai pour demander de compléter l'état des lieux d'entrée (entrée + 10 jours, réglage).
  function rectification(d, reglages, auj) {
    if (!d.entree.date) return null;
    const limite = ajout(d.entree.date, reglages.rectificationJours);
    return { limite, ouvert: auj ? auj <= limite : null };
  }

  // Points à compléter avant d'imprimer une phase (repères tirés du contenu minimal, pas une validation juridique).
  function manques(d, phase) {
    const m = [];
    const p = d[phase];
    if (!p.date) m.push(`Date de l'état des lieux de ${phase === 'entree' ? 'l\'entrée' : 'la sortie'}`);
    if (!d.logement.adresse) m.push('Adresse du logement');
    if (!d.locataires) m.push('Nom du ou des locataires');
    if (!d.bailleur.nom) m.push('Nom du bailleur');
    if (!d.bailleur.adresse && !d.mandataire.adresse) m.push('Domicile du bailleur (ou de son représentant)');
    if (!d.pieces.length) m.push('Au moins une pièce');
    const av = avancement(d, phase);
    if (av.faits < av.total) m.push(`${av.total - av.faits} élément${av.total - av.faits > 1 ? 's' : ''} sans état`);
    const sansReleve = d.compteurs.filter((c) => c[phase] === null).length;
    if (sansReleve) m.push(`${sansReleve} relevé${sansReleve > 1 ? 's' : ''} de compteur`);
    if (!d.cles.length) m.push('Clés et moyens d\'accès');
    else if (d.cles.some((c) => c[phase] === null)) m.push('Nombre de clés');
    if (phase === 'sortie') {
      if (!d.sortie.adresse) m.push('Nouvelle adresse du locataire');
      if (!d.entree.date) m.push('Date de l\'état des lieux d\'entrée');
    }
    return m;
  }

  // ---------- Photos et taille ----------
  const photosDossier = (d) => tousElements(d).reduce((n, { x }) => n + (x.entree.photo ? 1 : 0) + (x.sortie.photo ? 1 : 0), 0);
  const nbPhotos = (e) => e.dossiers.reduce((n, d) => n + photosDossier(d), 0);
  const taille = (e) => new TextEncoder().encode(JSON.stringify(e)).length;

  // ---------- Libellés ----------
  function titreDossier(d) {
    const a = (d.logement.adresse || '').split('\n')[0];
    return [a || 'Logement sans adresse', d.logement.complement].filter(Boolean).join(', ');
  }
  const STATUTS = { preparer: 'À préparer', entree: 'Entrée en cours', occupe: 'Entrée faite', sortie: 'Sortie en cours', 'sortie-faite': 'Sortie faite' };

  // ---------- Export CSV ----------
  const cellule = (v) => { const s = String(v ?? ''); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const ligneCsv = (l) => l.map(cellule).join(';');
  function csvDossier(d, base) {
    const nomEtat = (c) => base.etats.find((x) => x.code === c)?.nom || '';
    const nomDiff = { vide: '', entree: 'sortie à constater', sansEntree: 'sans état d\'entrée', identique: 'identique', usure: 'usure normale', degrade: 'dégradé', ameliore: 'amélioré' };
    const lignes = [['Pièce', 'Élément', 'Catégorie', 'État entrée', 'Commentaire entrée', 'État sortie', 'Commentaire sortie', 'Différence', 'Vétusté (%)', 'Coût de remise en état (€)', 'Retenue proposée (€)']];
    for (const p of d.pieces) for (const x of p.elements) {
      const r = retenueElement(d, x);
      lignes.push([p.nom, x.nom, base.categories.find((c) => c.code === x.cat)?.nom || x.cat, nomEtat(x.entree.etat), x.entree.com, nomEtat(x.sortie.etat), x.sortie.com, nomDiff[r.diff],
        r.taux === null ? '' : nombreTexte(r.taux, 1), r.cout === null ? '' : nombreTexte(r.cout, 2, true), r.diff === 'degrade' && r.cout !== null ? nombreTexte(r.retenue, 2, true) : '']);
    }
    lignes.push([]);
    lignes.push(['Compteur', 'Numéro', 'Unité', 'Relevé entrée', 'Relevé sortie', 'Consommation']);
    for (const c of d.compteurs) { const k = consommation(c); lignes.push([c.nom, c.numero, c.unite, c.entree === null ? '' : nombreTexte(c.entree, 3), c.sortie === null ? '' : nombreTexte(c.sortie, 3), k === null ? '' : nombreTexte(k, 3)]); }
    lignes.push([]);
    lignes.push(['Clés et accès', 'Remises à l\'entrée', 'Rendues à la sortie', 'Manquantes']);
    for (const c of d.cles) { const k = clesManquantes(c); lignes.push([c.nom, c.entree ?? '', c.sortie ?? '', k === null ? '' : k]); }
    return '﻿' + lignes.map(ligneCsv).join('\r\n');
  }

  g.ETD = {
    iso, versDate, ajout, ajoutMois, ecart, estDate, dateFr, nombreTexte, euros, plat, nouvelId, centimes,
    ETATS, rang, lirePose, datePose, poseTexte, photoOk, PHOTO_MAX_CAR,
    normaliser, normaliserDossier, normaliserPiece, normaliserElement, normaliserCompteur, normaliserCle, normaliserLigneGrille, normaliserReglages, etatVide,
    elementsType, nouvellePiece, piecesModele, compteursDefaut, clesDefaut, reprendreDossier,
    difference, ecartRang, tousElements, avancement, statut, STATUTS, consommation, clesManquantes, differences,
    ageAnnees, tauxVetuste, retenueElement, bilanRetenues, conforme, restitution, rectification, manques,
    photosDossier, nbPhotos, taille, titreDossier, csvDossier,
  };
})(typeof window !== 'undefined' ? window : globalThis);
