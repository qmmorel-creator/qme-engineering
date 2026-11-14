// Relance des impayés QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.RCV) et par les tests Node (vm).
// Dates locales « AAAA-MM-JJ » (comparables comme des chaînes), montants en centimes (entiers),
// taux en pour cent (12.4 = 12,40 % par an).
(function (racine) {
  'use strict';

  const TYPES_CLIENT = ['pro', 'particulier'];
  const STATUTS = ['aEchoir', 'echue', 'enRelance', 'payee', 'litige', 'abandonnee'];
  const LIB_STATUT = { aEchoir: 'À échoir', echue: 'Échue', enRelance: 'En relance', payee: 'Payée', litige: 'Litige', abandonnee: 'Abandonnée' };
  const TRANCHES = [
    { id: 't30', nom: '0 à 30 jours', de: 1, a: 30 },
    { id: 't60', nom: '31 à 60 jours', de: 31, a: 60 },
    { id: 't90', nom: '61 à 90 jours', de: 61, a: 90 },
    { id: 'tplus', nom: 'Plus de 90 jours', de: 91, a: Infinity },
  ];
  const BASE_JOURS = 365; // intérêts simples, année de 365 jours (convention courante, à vérifier selon le contrat)

  // ---------- Dates ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const joursDansMois = (annee, mois) => new Date(annee, mois, 0).getDate();
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  function ajoutMois(s, n) {
    const [a, m, j] = s.split('-').map(Number);
    const total = (a * 12 + (m - 1)) + n;
    const an = Math.floor(total / 12), mo = total - an * 12 + 1;
    return `${an}-${deux(mo)}-${deux(Math.min(j, joursDansMois(an, mo)))}`;
  }
  // Début du semestre civil d'une date (1er janvier ou 1er juillet).
  const debutSemestre = (s) => `${s.slice(0, 4)}-${Number(s.slice(5, 7)) <= 6 ? '01' : '07'}-01`;

  // ---------- Montants et taux ----------
  function lireMontant(saisie) {
    const s = String(saisie ?? '').replace(/[\s  €]/g, '').replace(',', '.');
    if (!s || !/^\d+(\.\d{0,2})?$/.test(s)) return null;
    return Math.round(Number(s) * 100);
  }
  function euros(c, { centimes = true } = {}) {
    if (c === null || c === undefined || Number.isNaN(c)) return '–';
    const neg = c < 0;
    const n = Math.abs(Math.round(c));
    const ent = Math.floor(n / 100), dec = n % 100;
    const arrondi = centimes ? ent : Math.round(n / 100);
    const milliers = String(arrondi).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return `${neg ? '−' : ''}${centimes ? `${milliers},${deux(dec)}` : milliers} €`;
  }
  const saisieMontant = (c) => (c === null || c === undefined ? '' : `${Math.floor(c / 100)},${deux(c % 100)}`);
  // « 12,40 », « 12.4 % » → 12.4 ; null si vide ou illisible ; borné à 0–100.
  function lireTaux(saisie) {
    const s = String(saisie ?? '').replace(/[\s %]/g, '').replace(',', '.');
    if (!s || !/^\d+(\.\d{0,3})?$/.test(s)) return null;
    const n = Number(s);
    return n <= 100 ? Math.round(n * 1000) / 1000 : null;
  }
  const pct = (t) => (t === null || t === undefined ? '–' : `${t.toFixed(2).replace('.', ',')} %`);
  const saisieTaux = (t) => (t === null || t === undefined ? '' : String(t).replace('.', ','));

  // ---------- Paiements, restant dû, statut ----------
  const paiementsTries = (f) => [...(f.paiements || [])].sort((x, y) => x.date.localeCompare(y.date));
  // Total payé jusqu'à une date incluse (toutes dates si absente).
  const paye = (f, jusqua) => paiementsTries(f).filter((p) => !jusqua || p.date <= jusqua).reduce((s, p) => s + p.montant, 0);
  const restant = (f, jusqua) => Math.max(0, f.montant - paye(f, jusqua));
  // Date à laquelle la facture est entièrement payée (cumul des paiements), sinon null.
  function dateSolde(f) {
    let cumul = 0;
    for (const p of paiementsTries(f)) { cumul += p.montant; if (cumul >= f.montant) return p.date; }
    return f.montant <= 0 ? f.emission : null;
  }
  const relancesTriees = (f) => [...(f.relances || [])].sort((x, y) => x.date.localeCompare(y.date));
  // Date de la première relance notée « mise en demeure » (point de départ des intérêts pour un particulier).
  const dateMiseEnDemeure = (f) => relancesTriees(f).find((r) => r.md)?.date || null;

  // Statut calculé, par ordre de priorité : payée, abandonnée, litige, à échoir, en relance, échue.
  function statut(f, auj) {
    if (restant(f, auj) <= 0 && dateSolde(f) && dateSolde(f) <= auj) return 'payee';
    if (f.abandonnee) return 'abandonnee';
    if (f.litige) return 'litige';
    if (auj <= f.echeance) return 'aEchoir';
    if ((f.relances || []).some((r) => r.date <= auj)) return 'enRelance';
    return 'echue';
  }
  const estOuverte = (s) => s !== 'payee' && s !== 'abandonnee';

  // Retard en jours : à la date du jour pour une facture ouverte, à la date du solde pour une facture payée.
  function retardJours(f, auj) {
    const fin = dateSolde(f) && dateSolde(f) <= auj ? dateSolde(f) : auj;
    return Math.max(0, ecart(f.echeance, fin));
  }

  // ---------- Taux de référence (paramètres datés des Réglages) ----------
  // Liste de semestres { debut: 'AAAA-01-01' | 'AAAA-07-01', taux } : on prend l'entrée la plus récente dont
  // le début est au plus tard le jour demandé. « aVerifier » : jour avant la première entrée, ou au-delà du
  // semestre de la dernière entrée (nouveau taux non saisi).
  function tauxDuJour(liste, jour) {
    const l = [...(liste || [])].filter((x) => estDate(x.debut) && Number.isFinite(x.taux)).sort((x, y) => x.debut.localeCompare(y.debut));
    if (!l.length) return { taux: null, aVerifier: true };
    let choisi = null;
    for (const x of l) if (x.debut <= jour) choisi = x;
    if (!choisi) return { taux: l[0].taux, aVerifier: true, debut: l[0].debut };
    const finSemestre = ajoutMois(debutSemestre(choisi.debut), 6);
    return { taux: choisi.taux, aVerifier: jour >= finSemestre, debut: choisi.debut };
  }
  // Taux annuel applicable à un jour donné, selon le type de débiteur.
  //  pro : taux contractuel s'il est saisi, sinon taux BCE du semestre + majoration (10 points par défaut,
  //        art. L441-10 du Code de commerce) ;
  //  particulier : taux contractuel s'il est saisi, sinon taux de l'intérêt légal du semestre (créancier
  //        professionnel, « autres cas »).
  function tauxApplicable(reglages, type, jour) {
    const r = reglages || {};
    if (type === 'particulier') {
      if (Number.isFinite(r.tauxContractuelPart)) return { taux: r.tauxContractuelPart, aVerifier: false, source: 'contrat' };
      return { ...tauxDuJour(r.tauxLegal, jour), source: 'legal' };
    }
    if (Number.isFinite(r.tauxContractuelPro)) return { taux: r.tauxContractuelPro, aVerifier: false, source: 'contrat' };
    const b = tauxDuJour(r.bce, jour);
    return { ...b, taux: b.taux === null ? null : Math.round((b.taux + (Number(r.majoration) || 0)) * 1000) / 1000, source: 'bce' };
  }
  // Plancher légal d'un taux contractuel entre professionnels : 3 fois le taux de l'intérêt légal.
  function plancherPro(reglages, jour) {
    const l = tauxDuJour(reglages?.tauxLegal, jour);
    return l.taux === null ? null : Math.round(l.taux * 3 * 1000) / 1000;
  }

  // ---------- Pénalités de retard ----------
  // Intérêts simples, au prorata des jours, sur le restant dû (TTC), segment par segment : chaque paiement
  // partiel réduit la base à partir de sa date, chaque nouveau semestre peut changer le taux.
  //  pro : à partir du lendemain de l'échéance, sans rappel (art. L441-10, II) ;
  //  particulier : à partir de la mise en demeure (art. 1231-6 du Code civil), sauf taux contractuel prévu
  //  dès l'échéance (option « depuisEcheance »).
  // Fin du calcul : date du solde, sinon le jour demandé. Une facture abandonnée ne porte rien.
  function penalites(f, type, reglages, auj) {
    const vide = (raison) => ({ montant: 0, segments: [], debut: null, fin: null, aVerifier: false, raison });
    if (f.abandonnee) return vide('abandonnee');
    let debut = f.echeance;
    if (type === 'particulier' && !(reglages?.depuisEcheancePart && Number.isFinite(reglages?.tauxContractuelPart))) {
      const md = dateMiseEnDemeure(f);
      if (!md) return vide('sans-mise-en-demeure');
      if (md > debut) debut = md;
    }
    const solde = dateSolde(f);
    const fin = solde && solde < auj ? solde : auj;
    if (fin <= debut) return vide(fin <= f.echeance ? 'pas-de-retard' : 'pas-encore');
    // Points de rupture : paiements et débuts de semestre strictement entre debut et fin.
    const coupures = new Set([debut, fin]);
    for (const p of f.paiements || []) if (p.date > debut && p.date < fin) coupures.add(p.date);
    for (let s = ajoutMois(debutSemestre(debut), 6); s < fin; s = ajoutMois(s, 6)) coupures.add(s);
    const points = [...coupures].sort();
    const segments = [];
    let total = 0, aVerifier = false;
    for (let i = 0; i < points.length - 1; i++) {
      const de = points[i], a = points[i + 1];
      const base = restant(f, de);
      const jours = ecart(de, a);
      if (base <= 0 || jours <= 0) continue;
      const t = tauxApplicable(reglages, type, de);
      if (t.taux === null) { aVerifier = true; continue; }
      if (t.aVerifier) aVerifier = true;
      const brut = base * (t.taux / 100) * (jours / BASE_JOURS);
      total += brut;
      segments.push({ de, a, jours, base, taux: t.taux, montant: Math.round(brut), aVerifier: !!t.aVerifier });
    }
    return { montant: Math.round(total), segments, debut, fin, aVerifier, raison: null };
  }

  // Indemnité forfaitaire pour frais de recouvrement : une par facture payée en retard ou impayée à
  // l'échéance, seulement entre professionnels (art. L441-10 et D441-5 du Code de commerce).
  function indemnite(f, type, reglages, auj) {
    if (type !== 'pro' || f.abandonnee) return 0;
    return retardJours(f, auj) > 0 ? Math.max(0, Number(reglages?.indemnite) || 0) : 0;
  }

  // ---------- Paliers de relance ----------
  const paliersTries = (paliers) => [...(paliers || [])].sort((x, y) => x.jours - y.jours || x.nom.localeCompare(y.nom));
  // Prochaine relance : premier palier (par délai croissant) au-delà du dernier palier déjà envoyé.
  // Date due = échéance + délai du palier, et au moins « ecartMin » jours après la dernière relance.
  // Aucune pour une facture payée, abandonnée ou en litige, ni une fois le dernier palier envoyé.
  function prochaineRelance(f, paliers, auj, ecartMin = 7) {
    const s = statut(f, auj);
    if (s === 'payee' || s === 'abandonnee' || s === 'litige') return null;
    const l = paliersTries(paliers);
    if (!l.length) return null;
    const faits = new Set((f.relances || []).map((r) => r.palier));
    let rang = -1;
    l.forEach((p, i) => { if (faits.has(p.id)) rang = i; });
    const p = l[rang + 1];
    if (!p) return null;
    const derniere = relancesTriees(f).at(-1)?.date;
    let date = ajout(f.echeance, Math.max(0, p.jours));
    if (derniere && ecartMin > 0 && ajout(derniere, ecartMin) > date) date = ajout(derniere, ecartMin);
    return { palier: p, date, due: date <= auj, joursDepuis: Math.max(0, ecart(date, auj)), rang: rang + 1 };
  }

  // ---------- Vue d'ensemble ----------
  // Encours (restant dû des factures ouvertes), échu par tranche d'ancienneté, à échoir, pénalités et
  // indemnités estimées, relances dues, encours par client.
  function synthese(factures, clients, reglages, paliers, auj) {
    const typeDe = (id) => (clients.find((c) => c.id === id)?.type) || 'pro';
    const r = { encours: 0, echu: 0, aEchoir: 0, litige: 0, penalites: 0, indemnites: 0, nbOuvertes: 0, nbEchues: 0, relancesDues: [], aVenir: [],
      tranches: TRANCHES.map((t) => ({ ...t, montant: 0, nb: 0 })), parClient: new Map(), aVerifier: false, paye: 0, abandonne: 0 };
    for (const f of factures) {
      const s = statut(f, auj);
      const type = typeDe(f.client);
      if (s === 'abandonnee') { r.abandonne += restant(f, auj); continue; }
      const pen = penalites(f, type, reglages, auj);
      if (pen.aVerifier) r.aVerifier = true;
      const ind = indemnite(f, type, reglages, auj);
      if (s === 'payee') { r.paye += f.montant; continue; }
      const du = restant(f, auj);
      r.nbOuvertes++;
      r.encours += du;
      r.penalites += pen.montant;
      r.indemnites += ind;
      if (s === 'litige') r.litige += du;
      if (s === 'aEchoir') r.aEchoir += du;
      else {
        r.echu += du; r.nbEchues++;
        const j = retardJours(f, auj);
        const t = r.tranches.find((x) => j >= x.de && j <= x.a) || r.tranches[0];
        t.montant += du; t.nb++;
      }
      if (!r.parClient.has(f.client)) r.parClient.set(f.client, { client: f.client, encours: 0, echu: 0, nb: 0, retardMax: 0 });
      const c = r.parClient.get(f.client);
      c.encours += du; c.nb++;
      if (s !== 'aEchoir') { c.echu += du; c.retardMax = Math.max(c.retardMax, retardJours(f, auj)); }
      const pr = prochaineRelance(f, paliers, auj, reglages?.ecartMin ?? 7);
      if (pr) (pr.due ? r.relancesDues : r.aVenir).push({ facture: f.id, ...pr });
    }
    r.relancesDues.sort((x, y) => x.date.localeCompare(y.date));
    r.aVenir.sort((x, y) => x.date.localeCompare(y.date));
    r.parClient = [...r.parClient.values()].sort((x, y) => y.echu - x.echu || y.encours - x.encours);
    return r;
  }

  // ---------- Modèles de messages ----------
  // Remplace chaque {champ} connu ; un champ inconnu reste tel quel (visible, donc corrigeable).
  const remplir = (modele, valeurs) => String(modele || '').replace(/\{([a-z_]+)\}/g, (m, cle) => (Object.prototype.hasOwnProperty.call(valeurs, cle) ? String(valeurs[cle]) : m));

  const dateFr = (s) => (s ? versDate(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

  // Valeurs des champs d'un message pour une facture, calculées au jour demandé.
  function valeursMessage(f, client, etat, auj) {
    const reg = etat.reglages;
    const type = client?.type || 'pro';
    const pen = penalites(f, type, reg, auj);
    const ind = indemnite(f, type, reg, auj);
    const du = restant(f, auj);
    const t = tauxApplicable(reg, type, auj);
    const retard = retardJours(f, auj);
    let ligne = '';
    if (type === 'pro') {
      ligne = `Conformément à l'article L441-10 du Code de commerce, ce retard rend exigibles des pénalités de retard au taux annuel de ${pct(t.taux)}, soit ${euros(pen.montant)} à ce jour, ainsi que l'indemnité forfaitaire pour frais de recouvrement de ${euros(ind)} (article D441-5).`;
    } else if (pen.montant > 0) {
      ligne = `Ce retard fait courir des intérêts au taux annuel de ${pct(t.taux)} depuis le ${dateFr(pen.debut)}, soit ${euros(pen.montant)} à ce jour.`;
    } else {
      ligne = `À défaut de paiement, des intérêts au taux légal courront à compter de la présente mise en demeure (article 1231-6 du Code civil).`;
    }
    const delai = Math.max(1, Number(reg.delaiReponse) || 8);
    return {
      client: client?.nom || '',
      numero: f.numero,
      date_facture: dateFr(f.emission),
      echeance: dateFr(f.echeance),
      montant: euros(f.montant),
      deja_paye: euros(paye(f, auj)),
      restant: euros(du),
      retard: `${retard} jour${retard > 1 ? 's' : ''}`,
      taux: pct(t.taux),
      penalites: euros(pen.montant),
      indemnite: euros(ind),
      total_du: euros(du + pen.montant + ind),
      ligne_penalites: ligne,
      delai_reponse: `${delai} jours`,
      date_limite: dateFr(ajout(auj, delai)),
      date_jour: dateFr(auj),
      entreprise: etat.entreprise || '',
      signature: etat.signature || etat.entreprise || '',
    };
  }
  const CHAMPS = ['client', 'numero', 'date_facture', 'echeance', 'montant', 'deja_paye', 'restant', 'retard', 'taux', 'penalites', 'indemnite', 'total_du', 'ligne_penalites', 'delai_reponse', 'date_limite', 'date_jour', 'entreprise', 'signature'];

  // ---------- État ----------
  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const entier = (v, min, max, defaut) => { const n = Math.round(Number(v)); return Number.isFinite(n) && v !== '' && v !== null ? Math.min(max, Math.max(min, n)) : defaut; };
  const centimes = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) || Number(v) < 0 ? null : Math.round(Number(v)));
  const dateOuNull = (v) => (estDate(v) ? v : null);
  const tauxOuNull = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) || Number(v) < 0 || Number(v) > 100 ? null : Number(v));
  const texte = (v, n) => String(v ?? '').slice(0, n);

  function normaliserClient(x) {
    const c = x && typeof x === 'object' ? x : {};
    return { id: String(c.id || nouvelId()), nom: texte(c.nom || 'Client', 80) || 'Client', type: TYPES_CLIENT.includes(c.type) ? c.type : 'pro', contact: texte(c.contact, 120), note: texte(c.note, 300), efface: !!c.efface };
  }
  function normaliserFacture(x, auj) {
    const f = x && typeof x === 'object' ? x : {};
    const emission = dateOuNull(f.emission) || auj;
    const echeance = dateOuNull(f.echeance) || ajout(emission, 30);
    return {
      id: String(f.id || nouvelId()),
      client: String(f.client || ''),
      numero: texte(f.numero || 'Sans numéro', 40),
      emission,
      echeance: echeance < emission ? emission : echeance,
      montant: centimes(f.montant) ?? 0,
      paiements: (Array.isArray(f.paiements) ? f.paiements : []).map((p) => ({ id: String(p?.id || nouvelId()), date: dateOuNull(p?.date) || auj, montant: centimes(p?.montant) ?? 0, note: texte(p?.note, 120) })).filter((p) => p.montant > 0),
      relances: (Array.isArray(f.relances) ? f.relances : []).map((r) => ({ id: String(r?.id || nouvelId()), date: dateOuNull(r?.date) || auj, palier: String(r?.palier || ''), nom: texte(r?.nom || 'Relance', 60), md: !!r?.md, canal: texte(r?.canal, 40), note: texte(r?.note, 200) })),
      litige: !!f.litige,
      abandonnee: !!f.abandonnee,
      note: texte(f.note, 300),
    };
  }
  function normaliserPalier(x, i = 0) {
    const p = x && typeof x === 'object' ? x : {};
    return { id: String(p.id || nouvelId()), nom: texte(p.nom || `Palier ${i + 1}`, 60), jours: entier(p.jours, 0, 365, 0), md: !!p.md, objet: texte(p.objet, 200), corps: texte(p.corps, 4000) };
  }
  const normaliserTaux = (l) => (Array.isArray(l) ? l : []).map((x) => ({ debut: dateOuNull(x?.debut), taux: tauxOuNull(x?.taux) })).filter((x) => x.debut && x.taux !== null).sort((a, b) => a.debut.localeCompare(b.debut));

  function normaliser(d, auj, defauts) {
    const v = etatVide(defauts);
    if (!d || typeof d !== 'object') return v;
    const r = d.reglages || {};
    const dv = v.reglages;
    return {
      ...v, ...d,
      entreprise: texte(d.entreprise, 80),
      signature: texte(d.signature, 300),
      reglages: {
        delaiPaiement: entier(r.delaiPaiement, 0, 120, dv.delaiPaiement),
        ecartMin: entier(r.ecartMin, 0, 60, dv.ecartMin),
        delaiReponse: entier(r.delaiReponse, 1, 60, dv.delaiReponse),
        majoration: tauxOuNull(r.majoration) ?? dv.majoration,
        bce: r.bce ? normaliserTaux(r.bce) : dv.bce,
        tauxLegal: r.tauxLegal ? normaliserTaux(r.tauxLegal) : dv.tauxLegal,
        tauxContractuelPro: tauxOuNull(r.tauxContractuelPro),
        tauxContractuelPart: tauxOuNull(r.tauxContractuelPart),
        depuisEcheancePart: !!r.depuisEcheancePart,
        indemnite: centimes(r.indemnite) ?? dv.indemnite,
        verifieLe: dateOuNull(r.verifieLe) || dv.verifieLe,
      },
      paliers: Array.isArray(d.paliers) ? d.paliers.map(normaliserPalier) : v.paliers,
      clients: (Array.isArray(d.clients) ? d.clients : []).map(normaliserClient),
      factures: (Array.isArray(d.factures) ? d.factures : []).map((f) => normaliserFacture(f, auj)),
    };
  }
  // « defauts » : { reglages, paliers } tirés de la base intégrée (donnees.js).
  function etatVide(defauts = {}) {
    return {
      version: 1, entreprise: '', signature: '',
      reglages: { delaiPaiement: 30, ecartMin: 7, delaiReponse: 8, majoration: 10, bce: [], tauxLegal: [], tauxContractuelPro: null, tauxContractuelPart: null, depuisEcheancePart: false, indemnite: 4000, verifieLe: null, ...structuredCloneSimple(defauts.reglages || {}) },
      paliers: (defauts.paliers || []).map((p, i) => normaliserPalier(p, i)),
      clients: [], factures: [],
    };
  }
  function structuredCloneSimple(o) { return JSON.parse(JSON.stringify(o)); }

  // ---------- RGPD : effacement des données personnelles d'un débiteur ----------
  // Le client devient « Client effacé », sans contact ni note ; les notes libres de ses factures, paiements
  // et relances sont vidées. Montants et dates restent (pièces comptables). Renvoie un nouvel état.
  function effacerClient(etat, id, rang = 1) {
    const e = structuredCloneSimple(etat);
    const c = e.clients.find((x) => x.id === id);
    if (!c) return e;
    Object.assign(c, { nom: `Client effacé ${rang}`, contact: '', note: '', efface: true });
    for (const f of e.factures) {
      if (f.client !== id) continue;
      f.note = '';
      f.paiements.forEach((p) => { p.note = ''; });
      f.relances.forEach((r) => { r.note = ''; });
    }
    return e;
  }
  // Suppression complète : le client et toutes ses factures.
  function supprimerClient(etat, id) {
    const e = structuredCloneSimple(etat);
    e.clients = e.clients.filter((c) => c.id !== id);
    e.factures = e.factures.filter((f) => f.client !== id);
    return e;
  }

  // ---------- Export CSV ----------
  const champCsv = (v) => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const nombreCsv = (c) => (c === null || c === undefined ? '' : (c / 100).toFixed(2).replace('.', ','));
  function versCsv(etat, auj) {
    const tete = ['Client', 'Type', 'Numéro', 'Émission', 'Échéance', 'Montant TTC', 'Payé', 'Restant dû', 'Statut', 'Retard (jours)', 'Pénalités estimées', 'Indemnité forfaitaire', 'Dernière relance', 'Prochaine relance', 'Note'];
    const lignes = etat.factures.map((f) => {
      const c = etat.clients.find((x) => x.id === f.client);
      const type = c?.type || 'pro';
      const der = relancesTriees(f).at(-1);
      const pr = prochaineRelance(f, etat.paliers, auj, etat.reglages.ecartMin);
      return [c?.nom || '', type === 'pro' ? 'Professionnel' : 'Particulier', f.numero, f.emission, f.echeance, nombreCsv(f.montant), nombreCsv(paye(f, auj)), nombreCsv(restant(f, auj)), LIB_STATUT[statut(f, auj)], retardJours(f, auj), nombreCsv(penalites(f, type, etat.reglages, auj).montant), nombreCsv(indemnite(f, type, etat.reglages, auj)), der ? `${der.date} ${der.nom}` : '', pr ? `${pr.date} ${pr.palier.nom}` : '', f.note];
    });
    return '﻿' + [tete, ...lignes].map((l) => l.map(champCsv).join(';')).join('\r\n');
  }

  racine.RCV = {
    TYPES_CLIENT, STATUTS, LIB_STATUT, TRANCHES, BASE_JOURS, CHAMPS,
    iso, versDate, ajout, ecart, ajoutMois, joursDansMois, estDate, debutSemestre,
    lireMontant, euros, saisieMontant, lireTaux, pct, saisieTaux,
    paye, restant, dateSolde, statut, estOuverte, retardJours, dateMiseEnDemeure, relancesTriees,
    tauxDuJour, tauxApplicable, plancherPro, penalites, indemnite,
    paliersTries, prochaineRelance, synthese, remplir, valeursMessage,
    nouvelId, normaliserClient, normaliserFacture, normaliserPalier, normaliser, etatVide,
    effacerClient, supprimerClient, versCsv,
  };
})(typeof window !== 'undefined' ? window : globalThis);
