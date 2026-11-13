// Règles métier du registre des non-conformités : fonctions pures, sans DOM ni stockage.
// Chargé par l'application (window.REGLES) et par les tests (outils/templates/non-conformites.test.mjs).
(function (g) {
  'use strict';

  // ---------- Dates locales au format AAAA-MM-JJ (comparables comme des chaînes) ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const dateFr = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '');
  const dateLongue = (s) => { const d = versDate(s); return `${d.getDate() === 1 ? '1er' : d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`; };

  const ETAPES = [
    { id: 'analyse', nom: 'À analyser' },
    { id: 'actions', nom: 'Actions en cours' },
    { id: 'verification', nom: 'À vérifier' },
    { id: 'cloturee', nom: 'Clôturée' },
  ];
  const nomEtape = (id) => (ETAPES.find((e) => e.id === id) || {}).nom || id;

  // ---------- Numérotation : NC-AAAA-NNN, séquence par année du constat ----------
  function numeroSuivant(ncs, date) {
    const annee = date.slice(0, 4);
    const max = ncs.reduce((m, n) => {
      const r = /^NC-(\d{4})-(\d+)$/.exec(n.numero || '');
      return r && r[1] === annee ? Math.max(m, Number(r[2])) : m;
    }, 0);
    return `NC-${annee}-${String(max + 1).padStart(3, '0')}`;
  }

  // ---------- Étape, échéances, retards ----------
  const derniereVerif = (nc) => (nc.verifications && nc.verifications.length ? nc.verifications[nc.verifications.length - 1] : null);

  function etape(nc) {
    if (nc.cloture) return 'cloturee';
    const actions = nc.actions || [];
    const v = derniereVerif(nc);
    // Vérification inefficace : il faut une nouvelle action avant de pouvoir revérifier.
    if (v && v.efficace === false && actions.length <= (v.nbActions || 0)) return 'analyse';
    if (!actions.length) return 'analyse';
    if (actions.some((a) => !a.faite)) return 'actions';
    return 'verification';
  }

  const delaiGravite = (reglages, gravite) => {
    const d = reglages && reglages.delais ? Number(reglages.delais[gravite]) : NaN;
    return Number.isFinite(d) && d >= 0 ? d : ({ 1: 30, 2: 15, 3: 7, 4: 2 }[gravite] ?? 15);
  };
  // Échéance de traitement : date choisie, sinon date du constat + délai de la gravité.
  const echeance = (nc, reglages) => nc.echeance || ajout(nc.date, delaiGravite(reglages, nc.gravite));
  const actionEnRetard = (a, auj) => !a.faite && !!a.echeance && a.echeance < auj;

  function enRetard(nc, auj, reglages) {
    if (nc.cloture) return false;
    // Actions toutes faites : seule compte la date de vérification d'efficacité.
    if (etape(nc) === 'verification') { const p = verifPrevue(nc, reglages); return !!p && p < auj; }
    if (echeance(nc, reglages) < auj) return true;
    return (nc.actions || []).some((a) => actionEnRetard(a, auj));
  }

  // Vérification d'efficacité : date choisie, sinon dernière action faite + délai (réglage).
  function verifPrevue(nc, reglages) {
    if (etape(nc) !== 'verification') return null;
    if (nc.verifPrevue) return nc.verifPrevue;
    const derniere = (nc.actions || []).reduce((m, a) => (a.faite && a.faite > m ? a.faite : m), '');
    const delai = reglages && Number.isFinite(Number(reglages.delaiVerif)) ? Number(reglages.delaiVerif) : 30;
    return derniere ? ajout(derniere, delai) : null;
  }
  const verifDue = (nc, auj, reglages) => { const p = verifPrevue(nc, reglages); return !!p && p <= auj; };

  // Enregistre une vérification ; efficace → clôture à la même date. Renvoie la NC modifiée.
  function verifier(nc, { date, efficace, commentaire = '', par = '' }) {
    if (!nc.verifications) nc.verifications = [];
    nc.verifications.push({ date, efficace: !!efficace, commentaire, par, nbActions: (nc.actions || []).length });
    nc.verifPrevue = null;
    if (efficace) nc.cloture = { date, par };
    return nc;
  }

  const delaiCloture = (nc) => (nc.cloture ? ecart(nc.date, nc.cloture.date) : null);

  // ---------- 5 pourquoi ----------
  // Question du niveau i (0 à 4) : reprend la réponse précédente, ou le problème pour le premier niveau.
  function questionPourquoi(probleme, reponses, i) {
    const prec = i === 0 ? probleme : (reponses[i - 1] || '').trim();
    if (!prec) return i === 0 ? 'Pourquoi cet écart s\'est-il produit ?' : `Pourquoi ? (réponds d'abord au pourquoi n° ${i})`;
    const t = prec.replace(/[.\s]+$/, '');
    return `Pourquoi « ${t.charAt(0).toLowerCase()}${t.slice(1)} » ?`;
  }
  // Cause racine proposée : la dernière réponse renseignée.
  const racineProposee = (reponses) => [...(reponses || [])].reverse().find((r) => r && r.trim())?.trim() || '';

  // ---------- Tri et filtres du registre ----------
  function trier(ncs, auj, reglages) {
    const rang = (n) => (n.cloture ? 3 : enRetard(n, auj, reglages) ? 0 : verifDue(n, auj, reglages) ? 1 : 2);
    return [...ncs].sort((a, b) => rang(a) - rang(b)
      || (a.cloture ? b.cloture.date.localeCompare(a.cloture.date) : echeance(a, reglages).localeCompare(echeance(b, reglages)))
      || b.gravite - a.gravite || (b.numero || '').localeCompare(a.numero || ''));
  }

  const plat = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  function filtrer(ncs, f, auj, reglages) {
    const q = plat(f.texte).trim();
    return ncs.filter((n) => {
      if (f.etape === 'ouvertes' && n.cloture) return false;
      if (f.etape === 'retard' && !enRetard(n, auj, reglages)) return false;
      if (f.etape && !['ouvertes', 'retard', 'tout'].includes(f.etape) && etape(n) !== f.etape) return false;
      if (f.gravite && Number(f.gravite) !== n.gravite) return false;
      if (f.type && f.type !== n.type) return false;
      if (f.zone && f.zone !== n.zone) return false;
      if (q) {
        const sac = plat([n.numero, n.titre, n.description, n.lieu, n.zone, n.detectePar, n.analyse?.racine, ...(n.actions || []).map((a) => `${a.quoi} ${a.responsable}`)].join(' '));
        if (!q.split(/\s+/).every((m) => sac.includes(m))) return false;
      }
      return true;
    });
  }

  // Actions ouvertes de toutes les NC non clôturées, par échéance (sans échéance à la fin).
  function actionsOuvertes(ncs) {
    return ncs.filter((n) => !n.cloture).flatMap((n) => (n.actions || []).filter((a) => !a.faite).map((a) => ({ nc: n, a })))
      .sort((x, y) => (x.a.echeance || '9999').localeCompare(y.a.echeance || '9999') || y.nc.gravite - x.nc.gravite);
  }

  // ---------- Indicateurs ----------
  // depuis : date de début de période (incluse) ou null pour tout l'historique.
  function indicateurs(ncs, auj, reglages, depuis = null) {
    const dans = (d) => !!d && (!depuis || d >= depuis) && d <= auj;
    const ouvertes = ncs.filter((n) => !n.cloture);
    const periode = ncs.filter((n) => dans(n.date));
    const closes = ncs.filter((n) => n.cloture && dans(n.cloture.date));
    const delais = closes.map(delaiCloture);
    const compter = (liste, cle) => liste.reduce((m, n) => { const k = cle(n); if (k != null && k !== '') m[k] = (m[k] || 0) + 1; return m; }, {});
    const premiere = closes.filter((n) => !(n.verifications || []).some((v) => v.efficace === false)).length;
    const couts = periode.map((n) => Number(n.cout)).filter((c) => Number.isFinite(c) && c > 0);
    return {
      ouvertes: ouvertes.length,
      retard: ouvertes.filter((n) => enRetard(n, auj, reglages)).length,
      aVerifier: ouvertes.filter((n) => verifDue(n, auj, reglages)).length,
      constatees: periode.length,
      cloturees: closes.length,
      delaiMoyen: delais.length ? Math.round((delais.reduce((s, d) => s + d, 0) / delais.length) * 10) / 10 : null,
      efficacite: closes.length ? Math.round((premiere / closes.length) * 100) : null,
      parGravite: compter(periode, (n) => n.gravite),
      parCause: compter(periode, (n) => n.analyse?.cause || null),
      sansCause: periode.filter((n) => !n.analyse?.cause).length,
      parType: compter(periode, (n) => n.type),
      parZone: compter(periode, (n) => n.zone),
      cout: couts.reduce((s, c) => s + c, 0),
      nbCouts: couts.length,
    };
  }

  // Constatées et clôturées par mois sur les n derniers mois (mois courant compris).
  function parMois(ncs, auj, n = 12) {
    const d = versDate(auj);
    return Array.from({ length: n }, (_, i) => {
      const m = new Date(d.getFullYear(), d.getMonth() - (n - 1 - i), 1);
      const cle = `${m.getFullYear()}-${deux(m.getMonth() + 1)}`;
      return {
        cle, libelle: `${MOIS_COURTS[m.getMonth()]}${m.getMonth() === 0 || i === 0 ? ` ${String(m.getFullYear()).slice(2)}` : ''}`,
        mois: `${MOIS[m.getMonth()]} ${m.getFullYear()}`,
        constatees: ncs.filter((x) => x.date && x.date.slice(0, 7) === cle).length,
        cloturees: ncs.filter((x) => x.cloture && x.cloture.date.slice(0, 7) === cle).length,
      };
    });
  }

  // ---------- Export CSV (point-virgule, tableur français) ----------
  function champCsv(v) {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // neutralise les formules
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
  const ligneCsv = (cols) => cols.map(champCsv).join(';');
  const nombreFr = (n) => (n == null || n === '' || !Number.isFinite(Number(n)) ? '' : String(n).replace('.', ','));

  function csvRegistre(etat, base, auj) {
    const nom = (liste, id) => (liste.find((x) => x.id === id) || {}).nom || '';
    const R = etat.reglages;
    const tete = ['Numéro', 'Date du constat', 'Titre', 'Description', 'Lieu', R.libelleZone || 'Zone', 'Type d\'écart', 'Gravité', 'Origine', 'Détecté par',
      'Quantité ou étendue', 'Référence photo', 'Décision sur le produit', 'Traitement immédiat', 'Cause racine', 'Famille de cause', 'Actions', 'Actions faites',
      'Échéance', 'En retard', 'Étape', 'Vérifications', 'Date de clôture', 'Délai de clôture (j)', 'Coût estimé (€)'];
    const lignes = trier(etat.ncs, auj, R).map((n) => ligneCsv([
      n.numero, dateFr(n.date), n.titre, n.description, n.lieu, n.zone, nom(base.types, n.type), nom(base.gravites, n.gravite), nom(base.origines, n.origine), n.detectePar,
      n.quantite, n.photo, nom(base.decisions, n.decision), n.traitement, n.analyse?.racine, nom(base.causes, n.analyse?.cause),
      (n.actions || []).length, (n.actions || []).filter((a) => a.faite).length, dateFr(echeance(n, R)), enRetard(n, auj, R) ? 'oui' : 'non',
      nomEtape(etape(n)), (n.verifications || []).map((v) => `${dateFr(v.date)} ${v.efficace ? 'efficace' : 'inefficace'}`).join(' | '),
      dateFr(n.cloture?.date), nombreFr(delaiCloture(n)), nombreFr(n.cout),
    ]));
    return `﻿${[ligneCsv(tete), ...lignes].join('\r\n')}\r\n`;
  }

  function csvActions(etat, auj) {
    const tete = ['Numéro NC', 'Titre NC', 'Nature', 'Action', 'Responsable', 'Échéance', 'Faite le', 'En retard'];
    const lignes = etat.ncs.flatMap((n) => (n.actions || []).map((a) => ligneCsv([
      n.numero, n.titre, a.nature === 'preventive' ? 'Préventive' : 'Corrective', a.quoi, a.responsable, dateFr(a.echeance), dateFr(a.faite), actionEnRetard(a, auj) && !n.cloture ? 'oui' : 'non',
    ])));
    return `﻿${[ligneCsv(tete), ...lignes].join('\r\n')}\r\n`;
  }

  g.REGLES = {
    iso, versDate, ajout, ecart, dateFr, dateLongue, MOIS, ETAPES, nomEtape,
    numeroSuivant, etape, delaiGravite, echeance, actionEnRetard, enRetard, verifPrevue, verifDue, verifier, delaiCloture,
    questionPourquoi, racineProposee, trier, filtrer, actionsOuvertes, indicateurs, parMois, champCsv, csvRegistre, csvActions,
  };
})(typeof window !== 'undefined' ? window : globalThis);
