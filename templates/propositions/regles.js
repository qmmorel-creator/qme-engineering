// Règles métier des Propositions commerciales : fonctions pures, sans DOM ni état global.
// Chargé dans le navigateur avant app.js (globalThis.PCM_REGLES) et dans les tests Node.
// Montants en centimes (entiers), taux en centièmes de pourcent (2000 = 20 %), dates AAAA-MM-JJ.
// Aucune règle légale : prix hors taxes, TTC seulement à un taux saisi par l'utilisateur.
(() => {
  'use strict';

  const entier = (n) => (Number.isFinite(Number(n)) ? Math.trunc(Number(n)) : 0);
  const texte = (s) => String(s ?? '').trim();

  // Division entière arrondie au plus proche, demi éloigné de zéro.
  function arrondiDiv(a, b) {
    a = entier(a); b = entier(b);
    if (!b) return 0;
    const signe = (a < 0) !== (b < 0) ? -1 : 1;
    return signe * Math.floor((2 * Math.abs(a) + Math.abs(b)) / (2 * Math.abs(b)));
  }

  // ---------- Saisie et affichage ----------
  function lireDecimal(t, dec) {
    const s = String(t ?? '').replace(/[\s  €%]/g, '').replace(',', '.');
    if (!s || !/^[-+]?\d*(\.\d*)?$/.test(s) || s === '.' || s === '-' || s === '+') return null;
    const neg = s.startsWith('-');
    const [ent, frac = ''] = s.replace(/^[-+]/, '').split('.');
    const f = (frac + '0'.repeat(dec + 1)).slice(0, dec + 1);
    let v = Number(ent || '0') * 10 ** dec + Number(f.slice(0, dec) || '0');
    if (Number(f[dec]) >= 5) v += 1;
    return neg ? -v : v;
  }
  const lireMontant = (t) => lireDecimal(t, 2);
  const lirePourcent = (t) => lireDecimal(t, 2);
  const groupes = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  function decimal(v, dec, min = dec) {
    v = entier(v);
    const a = Math.abs(v), p = 10 ** dec;
    let frac = String(a % p).padStart(dec, '0');
    while (frac.length > min && frac.endsWith('0')) frac = frac.slice(0, -1);
    return `${v < 0 ? '−' : ''}${groupes(Math.floor(a / p))}${frac ? `,${frac}` : ''}`;
  }
  const euros = (c) => `${decimal(c, 2)} €`;
  // Montant arrondi à l'euro quand il tombe juste (affichage des options).
  const eurosCourt = (c) => (entier(c) % 100 === 0 ? `${decimal(c, 2, 0)} €` : euros(c));
  const pourcent = (bp) => `${decimal(bp, 2, 0)} %`;
  const saisieMontant = (c) => decimal(c, 2).replace(/ /g, '').replace('−', '-');
  const saisiePourcent = (bp) => decimal(bp, 2, 0).replace(/ /g, '').replace('−', '-');
  // TTC à un taux saisi par l'utilisateur ; null si aucun taux.
  const ttc = (ht, tauxBp) => (tauxBp === null || tauxBp === undefined || tauxBp === '' ? null : entier(ht) + arrondiDiv(entier(ht) * entier(tauxBp), 10000));

  // ---------- Dates ----------
  const deux = (n) => String(n).padStart(2, '0');
  const dateValide = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
  function ajouterJours(iso, n) {
    const [a, m, j] = String(iso).split('-').map(Number);
    const d = new Date(Date.UTC(a, m - 1, j + entier(n)));
    return `${d.getUTCFullYear()}-${deux(d.getUTCMonth() + 1)}-${deux(d.getUTCDate())}`;
  }
  const versUTC = (iso) => { const [a, m, j] = String(iso).split('-').map(Number); return Date.UTC(a, m - 1, j); };
  const ecartJours = (de, a) => Math.round((versUTC(a) - versUTC(de)) / 86400000);
  const finValidite = (p) => ajouterJours(p.date, p.validiteJours ?? 30);

  // ---------- Numérotation : <préfixe>-<année>-<numéro>, compteur annuel jamais réutilisé ----------
  const nettoyerPrefixe = (p) => String(p ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'P';
  const numeroDe = (prefixe, annee, n) => `${nettoyerPrefixe(prefixe)}-${annee}-${String(n).padStart(3, '0')}`;
  function rangDuNumero(numero, annee) {
    const m = String(numero || '').match(/-(\d{4})-(\d+)$/);
    return m && Number(m[1]) === Number(annee) ? Number(m[2]) : 0;
  }
  function prochainNumero(liste, prefixe, annee, compteur = 0) {
    const max = Math.max(entier(compteur), ...(liste || []).map((p) => rangDuNumero(p.numero, annee)), 0);
    return { numero: numeroDe(prefixe, annee, max + 1), rang: max + 1 };
  }

  // ---------- Options ----------
  const options = (p) => (Array.isArray(p?.options) ? p.options : []);
  const optionRecommandee = (p) => options(p).find((o) => o.recommandee) || null;
  const optionRetenue = (p) => options(p).find((o) => o.id === p?.optionRetenue) || null;
  // Montant d'une proposition : option retenue, sinon recommandée, sinon la moins chère chiffrée.
  function montantProposition(p) {
    const r = optionRetenue(p);
    if (r) return entier(r.prixHT);
    const rec = optionRecommandee(p);
    if (rec && entier(rec.prixHT) > 0) return entier(rec.prixHT);
    const prix = options(p).map((o) => entier(o.prixHT)).filter((x) => x > 0);
    return prix.length ? Math.min(...prix) : 0;
  }
  const cleInclus = (s) => texte(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
  // Tableau comparatif : une colonne par option, une ligne par élément inclus (réunion des contenus,
  // éléments communs à toutes les options d'abord), écart de prix avec la première option.
  function comparerOptions(liste, tauxBp = null) {
    const opts = (liste || []).filter((o) => o && (texte(o.nom) || (o.inclus || []).length || entier(o.prixHT)));
    const base = entier(opts[0]?.prixHT);
    const colonnes = opts.map((o, i) => ({
      id: o.id, nom: texte(o.nom) || `Option ${i + 1}`, prixHT: entier(o.prixHT), ttc: ttc(o.prixHT, tauxBp),
      ecart: i === 0 ? 0 : entier(o.prixHT) - base, recommandee: !!o.recommandee, delai: texte(o.delai),
    }));
    const lignes = [];
    const index = new Map();
    opts.forEach((o, i) => {
      for (const brut of o.inclus || []) {
        const k = cleInclus(brut);
        if (!k) continue;
        if (!index.has(k)) { index.set(k, lignes.length); lignes.push({ libelle: texte(brut), presences: opts.map(() => false), ordre: lignes.length }); }
        lignes[index.get(k)].presences[i] = true;
      }
    });
    const nb = (l) => l.presences.filter(Boolean).length;
    lignes.sort((a, b) => nb(b) - nb(a) || a.ordre - b.ordre);
    return { colonnes, lignes: lignes.map(({ libelle, presences }) => ({ libelle, presences, commun: presences.every(Boolean) })) };
  }

  // ---------- Planning : étapes en semaines, à la suite ou en parallèle de la précédente ----------
  function calculerPlanning(debut, etapes) {
    const liste = [];
    let curseur = 0, fin = 0, precedent = 0;
    for (const e of etapes || []) {
      const semaines = Math.max(1, entier(e.semaines) || 1);
      const depart = e.parallele && liste.length ? precedent : curseur;
      const arrivee = depart + semaines;
      liste.push({
        id: e.id, titre: texte(e.titre), semaines, depart, arrivee, parallele: !!e.parallele && liste.length > 0,
        debut: dateValide(debut) ? ajouterJours(debut, depart * 7) : null,
        fin: dateValide(debut) ? ajouterJours(debut, arrivee * 7 - 1) : null,
      });
      precedent = depart;
      curseur = Math.max(curseur, arrivee);
      fin = Math.max(fin, arrivee);
    }
    return { etapes: liste, semaines: fin, fin: dateValide(debut) && fin ? ajouterJours(debut, fin * 7 - 1) : null };
  }

  // ---------- Statuts, relances, validité ----------
  const STATUTS = ['brouillon', 'envoyee', 'acceptee', 'refusee', 'sans-suite'];
  const DECIDES = ['acceptee', 'refusee', 'sans-suite'];
  const statut = (p) => (STATUTS.includes(p?.statut) ? p.statut : 'brouillon');
  function dernierContact(p) {
    const dates = [p?.envoyeeLe, ...(p?.relances || [])].filter(dateValide).sort();
    return dates.length ? dates[dates.length - 1] : null;
  }
  // Date de la prochaine relance d'une proposition envoyée et sans réponse.
  function prochaineRelance(p, relanceJours = 7) {
    if (statut(p) !== 'envoyee') return null;
    const d = dernierContact(p) || p.date;
    return ajouterJours(d, Math.max(1, entier(relanceJours) || 7));
  }
  // Statut affiché : « expiree » (validité dépassée sans réponse), « a-relancer » (relance due).
  function statutAffiche(p, aujourdhui, relanceJours = 7) {
    const s = statut(p);
    if (s !== 'envoyee') return s;
    if (finValidite(p) < aujourdhui) return 'expiree';
    if (prochaineRelance(p, relanceJours) <= aujourdhui) return 'a-relancer';
    return 'envoyee';
  }
  function changerStatut(p, nouveau, aujourdhui, extra = {}) {
    if (!STATUTS.includes(nouveau)) return p;
    const d = { ...p, statut: nouveau };
    if (nouveau === 'brouillon') Object.assign(d, { envoyeeLe: null, decideeLe: null, relances: [], optionRetenue: null, motifRefus: '' });
    if (nouveau === 'envoyee') Object.assign(d, { envoyeeLe: p.envoyeeLe || aujourdhui, decideeLe: null, optionRetenue: null, motifRefus: '' });
    if (DECIDES.includes(nouveau)) {
      d.envoyeeLe = p.envoyeeLe || p.date;
      d.decideeLe = extra.le || aujourdhui;
      d.optionRetenue = nouveau === 'acceptee' ? (extra.optionId || p.optionRetenue || optionRecommandee(p)?.id || options(p)[0]?.id || null) : null;
      d.motifRefus = nouveau === 'acceptee' ? '' : texte(extra.motif ?? p.motifRefus);
    }
    return d;
  }
  // Relance faite ce jour (une seule par jour).
  function enregistrerRelance(p, aujourdhui) {
    const relances = [...(p.relances || [])];
    if (!relances.includes(aujourdhui)) relances.push(aujourdhui);
    return { ...p, relances: relances.sort() };
  }
  // Prolonge la validité de `jours` à partir d'aujourd'hui (jamais en la raccourcissant).
  function prolonger(p, jours, aujourdhui) {
    const cible = ajouterJours(aujourdhui, Math.max(1, entier(jours)));
    const actuelle = finValidite(p);
    return cible <= actuelle ? p : { ...p, validiteJours: ecartJours(p.date, cible) };
  }

  // ---------- Complétude ----------
  function completude(p) {
    const opts = options(p);
    const points = [
      ['Client', !!texte(p.client?.organisation)],
      ['Titre de la proposition', !!texte(p.titre)],
      ['Contexte', texte(p.contexte).length >= 20],
      ['Objectifs', (p.objectifs || []).some((o) => texte(o))],
      ['Livrables', (p.livrables || []).some((l) => texte(l.titre))],
      ['Au moins une option chiffrée', opts.some((o) => texte(o.nom) && entier(o.prixHT) > 0)],
      ['Toutes les options chiffrées', opts.length > 0 && opts.every((o) => entier(o.prixHT) > 0)],
      ['Planning', (p.etapes || []).some((e) => texte(e.titre))],
      ['Début prévu', dateValide(p.debut)],
      ['Conditions', !!texte(p.conditions)],
    ];
    const faits = points.filter(([, ok]) => ok).length;
    return { faits, total: points.length, pct: Math.round((faits * 100) / points.length), manque: points.filter(([, ok]) => !ok).map(([l]) => l) };
  }

  // ---------- Duplication : nouveau numéro, brouillon, suivi remis à zéro, identifiants neufs ----------
  function dupliquer(p, { id, numero, date, nouvelId }) {
    const c = JSON.parse(JSON.stringify(p));
    const neuf = (x) => ({ ...x, id: nouvelId() });
    return {
      ...c, id, numero, date, statut: 'brouillon', envoyeeLe: null, decideeLe: null, relances: [], optionRetenue: null, motifRefus: '',
      livrables: (c.livrables || []).map(neuf), options: (c.options || []).map(neuf), etapes: (c.etapes || []).map(neuf), blocs: (c.blocs || []).map(neuf),
    };
  }

  // ---------- Statistiques ----------
  const moisDe = (iso) => String(iso).slice(0, 7);
  function moisPrecedents(aujourdhui, n) {
    let [a, m] = aujourdhui.split('-').map(Number);
    const r = [];
    for (let i = 0; i < n; i++) { r.unshift(`${a}-${deux(m)}`); m -= 1; if (!m) { m = 12; a -= 1; } }
    return r;
  }
  function statistiques(liste, aujourdhui, relanceJours = 7) {
    const depuis = ajouterJours(aujourdhui, -365);
    const s = {
      brouillons: 0, enAttente: 0, montantAttente: 0, aRelancer: 0, expirees: 0,
      acceptees: 0, refusees: 0, sansSuite: 0, montantAccepte: 0, montantDecide: 0,
      taux: null, tauxValeur: null, delaiMoyen: null, panierMoyen: null,
      choix: [0, 0, 0, 0], motifs: {}, parTrame: {}, parMois: [],
    };
    const delais = [];
    for (const p of liste || []) {
      const st = statutAffiche(p, aujourdhui, relanceJours);
      const montant = montantProposition(p);
      if (st === 'brouillon') s.brouillons++;
      if (st === 'envoyee' || st === 'a-relancer') { s.enAttente++; s.montantAttente += montant; }
      if (st === 'a-relancer') s.aRelancer++;
      if (st === 'expiree') s.expirees++;
      if (!DECIDES.includes(st) || !p.decideeLe || p.decideeLe < depuis || p.decideeLe > aujourdhui) continue;
      s.montantDecide += montant;
      const t = (s.parTrame[p.trame || 'autre'] ||= { decidees: 0, acceptees: 0, montant: 0 });
      t.decidees++;
      if (st === 'acceptee') {
        s.acceptees++; s.montantAccepte += montant; t.acceptees++; t.montant += montant;
        const i = options(p).findIndex((o) => o.id === p.optionRetenue);
        if (i >= 0) s.choix[Math.min(i, 3)]++;
      } else {
        if (st === 'refusee') s.refusees++; else s.sansSuite++;
        const m = texte(p.motifRefus) || (st === 'sans-suite' ? 'Pas de réponse' : 'Non précisé');
        s.motifs[m] = (s.motifs[m] || 0) + 1;
      }
      if (st !== 'sans-suite' && dateValide(p.envoyeeLe)) delais.push(Math.max(0, ecartJours(p.envoyeeLe, p.decideeLe)));
    }
    const decidees = s.acceptees + s.refusees + s.sansSuite;
    s.taux = decidees ? Math.round((s.acceptees * 100) / decidees) : null;
    s.tauxValeur = s.montantDecide ? Math.round((s.montantAccepte * 100) / s.montantDecide) : null;
    s.delaiMoyen = delais.length ? Math.round(delais.reduce((a, b) => a + b, 0) / delais.length) : null;
    s.panierMoyen = s.acceptees ? Math.round(s.montantAccepte / s.acceptees) : null;
    for (const t of Object.values(s.parTrame)) t.taux = Math.round((t.acceptees * 100) / t.decidees);
    s.parMois = moisPrecedents(aujourdhui, 12).map((mois) => ({
      mois,
      envoyees: (liste || []).filter((p) => p.envoyeeLe && moisDe(p.envoyeeLe) === mois).length,
      acceptees: (liste || []).filter((p) => statut(p) === 'acceptee' && p.decideeLe && moisDe(p.decideeLe) === mois).length,
    }));
    return s;
  }

  // ---------- Message de relance à copier (rien n'est envoyé) ----------
  function messageRelance(p, profil = {}, rang = 1, fmtDate = (d) => d) {
    const qui = texte(p.client?.interlocuteur) ? `Bonjour ${texte(p.client.interlocuteur)},` : 'Bonjour,';
    const objet = texte(p.titre) || 'notre projet';
    const signature = texte(profil.signature) || texte(profil.nom);
    const fin = finValidite(p);
    const corps = rang <= 1
      ? `Je reviens vers vous au sujet de ma proposition « ${objet} » (${p.numero}), envoyée le ${fmtDate(p.envoyeeLe || p.date)}. Avez-vous eu le temps de la parcourir ? Je peux vous présenter les options en quinze minutes, au moment qui vous convient.`
      : `Je me permets une nouvelle relance au sujet de ma proposition « ${objet} » (${p.numero}). Elle reste valable jusqu'au ${fmtDate(fin)}. Si le projet a évolué ou si une option doit être ajustée, dites-le-moi : je l'adapte volontiers.`;
    return `${qui}\n\n${corps}\n\nBien cordialement,${signature ? `\n${signature}` : ''}`;
  }

  globalThis.PCM_REGLES = {
    arrondiDiv, lireMontant, lirePourcent, euros, eurosCourt, pourcent, saisieMontant, saisiePourcent, ttc,
    ajouterJours, ecartJours, dateValide, finValidite, nettoyerPrefixe, numeroDe, prochainNumero,
    optionRecommandee, optionRetenue, montantProposition, comparerOptions, calculerPlanning,
    STATUTS, DECIDES, statutAffiche, dernierContact, prochaineRelance, changerStatut, enregistrerRelance, prolonger,
    completude, dupliquer, statistiques, messageRelance,
  };
})();
