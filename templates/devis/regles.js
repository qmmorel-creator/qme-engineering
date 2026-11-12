// Règles métier du générateur de devis : fonctions pures, sans DOM ni état global.
// Chargé dans le navigateur avant app.js (globalThis.DVS_REGLES) et dans les tests Node.
// Unités entières partout, aucun calcul d'argent en virgule flottante :
//   montants en centimes, quantités en millièmes, remises et taux de TVA en centièmes de pourcent
//   (2000 = 20 %, 550 = 5,5 %).
(() => {
  'use strict';

  const entier = (n) => (Number.isFinite(Number(n)) ? Math.trunc(Number(n)) : 0);

  // Division entière arrondie au plus proche, demi éloigné de zéro (1,005 € → 1,01 €).
  function arrondiDiv(a, b) {
    a = entier(a); b = entier(b);
    if (!b) return 0;
    const signe = (a < 0) !== (b < 0) ? -1 : 1;
    const A = Math.abs(a), Bv = Math.abs(b);
    return signe * Math.floor((2 * A + Bv) / (2 * Bv));
  }

  // ---------- Saisie ----------
  // Nombre décimal français ou anglais → entier à `dec` décimales (null si invalide).
  function lireDecimal(texte, dec) {
    const s = String(texte ?? '').replace(/[\s  €%]/g, '').replace(',', '.');
    if (!s) return null;
    if (!/^[-+]?\d*(\.\d*)?$/.test(s) || s === '.' || s === '-' || s === '+') return null;
    const neg = s.startsWith('-');
    const [ent, frac = ''] = s.replace(/^[-+]/, '').split('.');
    const f = (frac + '0'.repeat(dec + 1)).slice(0, dec + 1);
    let v = Number(ent || '0') * 10 ** dec + Number(f.slice(0, dec) || '0');
    if (Number(f[dec]) >= 5) v += 1; // arrondi de la saisie au-delà de la précision
    return neg ? -v : v;
  }
  const lireMontant = (t) => lireDecimal(t, 2);   // centimes
  const lireQuantite = (t) => lireDecimal(t, 3);  // millièmes
  const lirePourcent = (t) => lireDecimal(t, 2);  // centièmes de pourcent

  // ---------- Affichage ----------
  const groupes = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  function decimal(v, dec, min = dec) {
    v = entier(v);
    const neg = v < 0;
    const a = Math.abs(v);
    const p = 10 ** dec;
    let frac = String(a % p).padStart(dec, '0');
    while (frac.length > min && frac.endsWith('0')) frac = frac.slice(0, -1);
    return `${neg ? '−' : ''}${groupes(Math.floor(a / p))}${frac ? `,${frac}` : ''}`;
  }
  const euros = (c) => `${decimal(c, 2)} €`;
  const quantite = (m) => decimal(m, 3, 0);
  const pourcent = (bp) => `${decimal(bp, 2, 0)} %`;
  // Valeur à remettre dans un champ de saisie (sans espace insécable ni symbole).
  const saisieMontant = (c) => decimal(c, 2).replace(/ /g, '').replace('−', '-');
  const saisieQuantite = (m) => quantite(m).replace(/ /g, '').replace('−', '-');
  const saisiePourcent = (bp) => decimal(bp, 2, 0).replace(/ /g, '').replace('−', '-');

  // ---------- Dates (AAAA-MM-JJ) ----------
  const deux = (n) => String(n).padStart(2, '0');
  function ajouterJours(iso, n) {
    const [a, m, j] = String(iso).split('-').map(Number);
    const d = new Date(Date.UTC(a, m - 1, j + entier(n)));
    return `${d.getUTCFullYear()}-${deux(d.getUTCMonth() + 1)}-${deux(d.getUTCDate())}`;
  }
  const finValidite = (devis) => ajouterJours(devis.date, devis.validiteJours ?? 30);

  // ---------- Calculs ----------
  // Une ligne : brut = quantité × prix unitaire, remise de ligne, net HT.
  function calculLigne(l) {
    const brut = arrondiDiv(entier(l.quantite) * entier(l.prixHT), 1000);
    const remise = arrondiDiv(brut * Math.min(10000, Math.max(0, entier(l.remise))), 10000);
    return { brut, remise, net: brut - remise };
  }

  // Répartit `montant` selon des poids positifs (plus forts restes) : la somme est exacte.
  function repartir(montant, poids) {
    montant = entier(montant);
    const total = poids.reduce((s, p) => s + Math.max(0, entier(p)), 0);
    if (!total) return poids.map(() => 0);
    const parts = poids.map((p) => {
      const x = Math.max(0, entier(p)) * Math.abs(montant);
      return { q: Math.floor(x / total), r: x % total };
    });
    let reste = Math.abs(montant) - parts.reduce((s, p) => s + p.q, 0);
    const ordre = parts.map((p, i) => i).sort((a, b) => parts[b].r - parts[a].r || a - b);
    for (const i of ordre) { if (reste <= 0) break; parts[i].q += 1; reste -= 1; }
    return parts.map((p) => (montant < 0 ? -p.q : p.q));
  }

  // Totaux d'un devis. options.franchise : franchise en base de TVA (aucune TVA facturée).
  function calculerTotaux(devis, options = {}) {
    const franchise = !!options.franchise;
    const lignes = Array.isArray(devis?.lignes) ? devis.lignes : [];
    const detail = {};
    const sections = {};
    const bases = new Map(); // taux → base HT après remise de ligne
    let sousTotal = 0, remisesLignes = 0, brutTotal = 0, section = null;
    for (const l of lignes) {
      if (l.type === 'titre') { section = l.id; sections[l.id] = 0; continue; }
      if (l.type === 'texte') continue;
      const c = calculLigne(l);
      detail[l.id] = c;
      brutTotal += c.brut; remisesLignes += c.remise; sousTotal += c.net;
      if (section) sections[section] += c.net;
      const taux = franchise ? 0 : Math.max(0, entier(l.tva));
      bases.set(taux, (bases.get(taux) || 0) + c.net);
    }
    // Remise globale : en pourcent sur chaque base, ou en euros répartie au prorata des bases.
    const r = devis?.remise || {};
    const taux = [...bases.keys()].sort((a, b) => b - a);
    let remisesBases = taux.map(() => 0);
    if (r.mode === 'pourcent' && entier(r.valeur) > 0) {
      const bp = Math.min(10000, entier(r.valeur));
      remisesBases = taux.map((t) => Math.max(0, arrondiDiv(bases.get(t) * bp, 10000)));
    } else if (r.mode === 'montant' && entier(r.valeur) > 0) {
      const positif = taux.reduce((s, t) => s + Math.max(0, bases.get(t)), 0);
      remisesBases = repartir(Math.min(entier(r.valeur), positif), taux.map((t) => bases.get(t)));
    }
    const remiseGlobale = remisesBases.reduce((s, x) => s + x, 0);
    const tva = taux.map((t, i) => {
      const base = bases.get(t) - remisesBases[i];
      return { taux: t, base, montant: franchise ? 0 : arrondiDiv(base * t, 10000) };
    });
    const totalHT = sousTotal - remiseGlobale;
    const totalTVA = tva.reduce((s, x) => s + x.montant, 0);
    const totalTTC = totalHT + totalTVA;
    // Acompte : pourcent du TTC ou montant fixe, borné entre 0 et le TTC.
    const a = devis?.acompte || {};
    let acompte = 0;
    if (a.mode === 'pourcent') acompte = arrondiDiv(totalTTC * Math.min(10000, Math.max(0, entier(a.valeur))), 10000);
    else if (a.mode === 'montant') acompte = entier(a.valeur);
    acompte = Math.max(0, Math.min(acompte, Math.max(0, totalTTC)));
    return { detail, sections, brutTotal, remisesLignes, sousTotal, remiseGlobale, totalHT, tva, totalTVA, totalTTC, acompte, reste: totalTTC - acompte, franchise };
  }

  // ---------- Numérotation ----------
  // Format <préfixe>-<année>-<numéro sur 3 chiffres au moins>, un compteur par année.
  const nettoyerPrefixe = (p) => String(p ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'D';
  function numeroDe(prefixe, annee, n) { return `${nettoyerPrefixe(prefixe)}-${annee}-${String(n).padStart(3, '0')}`; }
  function rangDuNumero(numero, annee) {
    const m = String(numero || '').match(/-(\d{4})-(\d+)$/);
    return m && Number(m[1]) === Number(annee) ? Number(m[2]) : 0;
  }
  // Le compteur mémorisé évite de réutiliser un numéro après la suppression du dernier devis.
  function prochainNumero(devisListe, prefixe, annee, compteur = 0) {
    const max = Math.max(entier(compteur), ...(devisListe || []).map((d) => rangDuNumero(d.numero, annee)), 0);
    return { numero: numeroDe(prefixe, annee, max + 1), rang: max + 1 };
  }

  // ---------- Statuts ----------
  const STATUTS = ['brouillon', 'envoye', 'accepte', 'refuse'];
  // Statut affiché : « expire » pour un devis envoyé dont la validité est dépassée.
  function statutAffiche(devis, aujourdhui) {
    const s = STATUTS.includes(devis?.statut) ? devis.statut : 'brouillon';
    if (s === 'envoye' && finValidite(devis) < aujourdhui) return 'expire';
    return s;
  }
  // Changement de statut, avec les dates utiles (envoi, décision).
  function changerStatut(devis, statut, aujourdhui) {
    if (!STATUTS.includes(statut)) return devis;
    const d = { ...devis, statut };
    if (statut === 'brouillon') { d.envoyeLe = null; d.decideLe = null; }
    if (statut === 'envoye') { d.envoyeLe = devis.envoyeLe || aujourdhui; d.decideLe = null; }
    if (statut === 'accepte' || statut === 'refuse') { d.envoyeLe = devis.envoyeLe || devis.date; d.decideLe = aujourdhui; }
    return d;
  }

  // Copie d'un devis : nouveau numéro, date du jour, brouillon, identifiants de lignes neufs.
  function dupliquer(devis, { id, numero, date, nouvelId }) {
    const copie = JSON.parse(JSON.stringify(devis));
    return {
      ...copie, id, numero, date, statut: 'brouillon', envoyeLe: null, decideLe: null,
      lignes: (copie.lignes || []).map((l) => ({ ...l, id: nouvelId() })),
    };
  }

  // ---------- Contrôle des mentions ----------
  // Ce qui manque pour qu'un devis porte les mentions de base (liste indicative, pas exhaustive).
  function mentionsManquantes(entreprise = {}, devis = {}) {
    const m = [];
    const e = entreprise;
    if (!String(e.nom || '').trim()) m.push('Nom de ton entreprise (onglet Entreprise)');
    if (!String(e.adresse || '').trim()) m.push('Adresse de ton entreprise');
    if (!String(e.siren || '').replace(/\D/g, '')) m.push('Numéro SIREN');
    else if (String(e.siren).replace(/\D/g, '').length !== 9) m.push('SIREN : 9 chiffres attendus');
    if (e.forme === 'societe' && !String(e.formeJuridique || '').trim()) m.push('Forme juridique de la société');
    if (e.assuranceObligatoire && (!String(e.assureur || '').trim() || !String(e.couverture || '').trim())) m.push('Assurance professionnelle : assureur et couverture géographique');
    if (!String(devis.client?.nom || '').trim()) m.push('Nom du client');
    if (!String(devis.objet || '').trim()) m.push('Objet du devis (nature des travaux ou de la prestation)');
    if (!(devis.lignes || []).some((l) => (l.type || 'ligne') === 'ligne' && String(l.designation || '').trim())) m.push('Au moins une ligne chiffrée');
    if ((devis.lignes || []).some((l) => (l.type || 'ligne') === 'ligne' && String(l.designation || '').trim() && !entier(l.prixHT))) m.push('Des lignes sans prix unitaire');
    if (devis.payant && !entier(devis.cout)) m.push('Coût du devis (il est indiqué payant)');
    return m;
  }

  // ---------- Tableau de bord ----------
  function statistiques(devisListe, aujourdhui, options = {}) {
    const liste = devisListe || [];
    const ht = (d) => calculerTotaux(d, options).totalHT;
    const depuis = ajouterJours(aujourdhui, -365);
    const s = { attente: 0, attenteHT: 0, expires: 0, acceptes12: 0, accepteHT12: 0, refuses12: 0, brouillons: 0, taux: null };
    for (const d of liste) {
      const st = statutAffiche(d, aujourdhui);
      if (st === 'brouillon') s.brouillons++;
      if (st === 'envoye') { s.attente++; s.attenteHT += ht(d); }
      if (st === 'expire') s.expires++;
      const decision = d.decideLe || d.date;
      if (st === 'accepte' && decision >= depuis) { s.acceptes12++; s.accepteHT12 += ht(d); }
      if (st === 'refuse' && decision >= depuis) s.refuses12++;
    }
    const tranches = s.acceptes12 + s.refuses12;
    s.taux = tranches ? Math.round((s.acceptes12 * 100) / tranches) : null;
    return s;
  }

  globalThis.DVS_REGLES = {
    arrondiDiv, lireMontant, lireQuantite, lirePourcent, euros, quantite, pourcent,
    saisieMontant, saisieQuantite, saisiePourcent, ajouterJours, finValidite,
    calculLigne, repartir, calculerTotaux, nettoyerPrefixe, numeroDe, prochainNumero,
    STATUTS, statutAffiche, changerStatut, dupliquer, mentionsManquantes, statistiques,
  };
})();
