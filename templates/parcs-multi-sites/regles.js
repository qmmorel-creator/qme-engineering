// Règles métier du pilotage de parcs multi-sites : fonctions pures, sans DOM ni stockage.
// Chargé par l'application (window.REGLES) et par les tests (outils/templates/parcs-multi-sites.test.mjs).
// Toutes les fonctions qui dépendent du jour reçoivent la date de référence `auj` (AAAA-MM-JJ).
(function (g) {
  'use strict';

  // ---------- Dates locales au format AAAA-MM-JJ (comparables comme des chaînes) ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.slice(0, 10).split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  const dateFr = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '');
  // Ajoute n mois ; le jour est borné à la fin du mois (31 janvier + 1 mois = 28 ou 29 février).
  function ajoutMois(s, n) {
    const [a, m, j] = s.split('-').map(Number);
    const t = (m - 1) + n;
    const an = a + Math.floor(t / 12), mo = ((t % 12) + 12) % 12;
    const fin = new Date(an, mo + 1, 0).getDate();
    return `${an}-${deux(mo + 1)}-${deux(Math.min(j, fin))}`;
  }

  const plat = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const nombre = (v) => { const n = Number(String(v ?? '').replace(/[\s  €]/g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
  const arrondi = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
  const moyenne = (l) => (l.length ? l.reduce((s, x) => s + x, 0) / l.length : null);

  // Coordonnées GPS facultatives : nombres décimaux (virgule ou point), dans les bornes.
  function coord(v, max) {
    const s = String(v ?? '').trim().replace(',', '.');
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) && Math.abs(n) <= max ? n : undefined; // undefined = invalide
  }
  const aCoordonnees = (s) => Number.isFinite(s.lat) && Number.isFinite(s.lon);

  // ---------- Équipements ----------
  const interventionsDe = (etat, eqId) => (etat.interventions || []).filter((i) => i.equipementId === eqId);

  // État calculé d'un équipement : réformé (saisi) ; à l'arrêt si un correctif ouvert l'arrête ;
  // dégradé si un correctif ouvert ne l'arrête pas ; sinon en service.
  function etatEquipement(etat, eq) {
    if (eq.reforme) return { code: 'reforme', depuis: null };
    const ouverts = interventionsDe(etat, eq.id).filter((i) => i.type === 'correctif' && !i.resolu && estDate(i.signale));
    const arrets = ouverts.filter((i) => i.arret).sort((a, b) => a.signale.localeCompare(b.signale));
    if (arrets.length) return { code: 'arret', depuis: arrets[0].signale, interventionId: arrets[0].id };
    if (ouverts.length) return { code: 'degrade', depuis: ouverts.sort((a, b) => a.signale.localeCompare(b.signale))[0].signale };
    return { code: 'service', depuis: null };
  }

  // Échéance du préventif périodique : dernier préventif réalisé (ou mise en service, ou date de
  // départ saisie) + périodicité en mois. alerteJours : fenêtre « proche ».
  function echeancePreventif(etat, eq, auj, alerteJours) {
    const mois = Number(eq.periodiciteMois) || 0;
    if (eq.reforme || mois <= 0) return { etat: 'sans', echeance: null, dernier: null, jours: null };
    const faits = interventionsDe(etat, eq.id).filter((i) => i.type === 'preventif' && estDate(i.date)).sort((a, b) => b.date.localeCompare(a.date));
    const dernier = faits[0] || null;
    const ref = dernier ? dernier.date : (estDate(eq.depuis) ? eq.depuis : estDate(eq.miseEnService) ? eq.miseEnService : null);
    if (!ref) return { etat: 'sans', echeance: null, dernier, jours: null };
    const echeance = ajoutMois(ref, mois);
    const jours = ecart(auj, echeance);
    const et = jours < 0 ? 'retard' : jours <= alerteJours ? 'proche' : 'ok';
    return { etat: et, echeance, dernier, jours };
  }

  // ---------- Indicateurs ----------
  // Indisponibilité (jours) d'un équipement sur [debut, fin] : correctifs « à l'arrêt » qui chevauchent.
  // Les arrêts qui se recouvrent ne comptent qu'une fois.
  function joursArret(etat, eqId, debut, fin) {
    const plages = interventionsDe(etat, eqId)
      .filter((i) => i.type === 'correctif' && i.arret && estDate(i.signale))
      .map((i) => [i.signale > debut ? i.signale : debut, (i.resolu && i.resolu < fin) ? i.resolu : fin])
      .filter(([a, b]) => a < b)
      .sort((x, y) => x[0].localeCompare(y[0]));
    let total = 0, cur = null;
    for (const [a, b] of plages) {
      if (!cur || a > cur[1]) { if (cur) total += ecart(cur[0], cur[1]); cur = [a, b]; } else if (b > cur[1]) cur[1] = b;
    }
    if (cur) total += ecart(cur[0], cur[1]);
    return total;
  }

  // Disponibilité d'un équipement sur les `jours` derniers jours (0 à 1), à partir de sa mise en service.
  function disponibilite(etat, eq, auj, jours) {
    if (eq.reforme) return null;
    let debut = ajout(auj, -jours);
    if (estDate(eq.miseEnService) && eq.miseEnService > debut) debut = eq.miseEnService;
    const duree = ecart(debut, auj);
    if (duree <= 0) return null;
    return Math.max(0, 1 - joursArret(etat, eq.id, debut, auj) / duree);
  }

  // Date de la dernière visite d'un site : préventif réalisé, correctif résolu ou visite.
  function derniereVisite(etat, siteId, auj) {
    let d = null;
    for (const i of etat.interventions || []) {
      if (i.siteId !== siteId) continue;
      const x = i.type === 'correctif' ? i.resolu : i.date;
      if (estDate(x) && x <= auj && (!d || x > d)) d = x;
    }
    return d;
  }

  // Coût d'une intervention, daté du jour où il est engagé (réalisation, résolution ou signalement).
  const dateCout = (i) => (i.type === 'correctif' ? (i.resolu || i.signale) : i.date);

  // Indicateurs d'un ensemble d'équipements et d'interventions (un site, ou tout le parc).
  // opts : { auj, periodeJours, alerteJours, siteIds (null = tous) }.
  function indicateurs(etat, base, opts) {
    const { auj, periodeJours, alerteJours } = opts;
    const dans = (sid) => !opts.siteIds || opts.siteIds.includes(sid);
    const debut = ajout(auj, -periodeJours);
    const eqs = (etat.equipements || []).filter((e) => dans(e.siteId));
    const actifs = eqs.filter((e) => !e.reforme);
    const dispos = actifs.map((e) => disponibilite(etat, e, auj, periodeJours)).filter((x) => x !== null);
    const ech = actifs.map((e) => echeancePreventif(etat, e, auj, alerteJours));
    const its = (etat.interventions || []).filter((i) => dans(i.siteId));
    const resolus = its.filter((i) => i.type === 'correctif' && estDate(i.signale) && estDate(i.resolu) && i.resolu > debut && i.resolu <= auj);
    const delais = resolus.map((i) => Math.max(0, ecart(i.signale, i.resolu)));
    const prevs = its.filter((i) => i.type === 'preventif' && estDate(i.date) && i.date > debut && i.date <= auj);
    const aTemps = prevs.filter((i) => !estDate(i.echeance) || i.date <= i.echeance).length;
    const enCours = its.filter((i) => estDate(dateCout(i)) && dateCout(i) > debut && dateCout(i) <= auj);
    const cout = arrondi(enCours.reduce((s, i) => s + nombre(i.cout), 0));
    const parCategorie = {};
    for (const i of enCours) {
      const eq = (etat.equipements || []).find((e) => e.id === i.equipementId);
      const cat = eq ? eq.categorie : 'SITE';
      parCategorie[cat] = arrondi((parCategorie[cat] || 0) + nombre(i.cout));
    }
    const parType = { preventif: 0, correctif: 0, visite: 0 };
    for (const i of enCours) parType[i.type] = arrondi((parType[i.type] || 0) + nombre(i.cout));
    return {
      equipements: actifs.length,
      reformes: eqs.length - actifs.length,
      arret: actifs.filter((e) => etatEquipement(etat, e).code === 'arret').length,
      degrade: actifs.filter((e) => etatEquipement(etat, e).code === 'degrade').length,
      disponibilite: dispos.length ? moyenne(dispos) : null,
      enRetard: ech.filter((x) => x.etat === 'retard').length,
      proches: ech.filter((x) => x.etat === 'proche').length,
      correctifsOuverts: its.filter((i) => i.type === 'correctif' && !i.resolu).length,
      delaiMoyen: delais.length ? arrondi(moyenne(delais), 1) : null,
      resolus: resolus.length,
      preventifsRealises: prevs.length,
      tauxATemps: prevs.length ? aTemps / prevs.length : null,
      cout, parCategorie, parType,
    };
  }

  // ---------- Alertes ----------
  // reglages : { alerteJours, arretJours, visiteMois }. Une alerte : { type, etat: retard|proche,
  // siteId, equipementId?, titre, detail, date } ; triées retards d'abord, puis par date.
  function alertes(etat, base, auj) {
    const rg = etat.reglages;
    const out = [];
    const site = (id) => (etat.sites || []).find((s) => s.id === id);
    for (const eq of etat.equipements || []) {
      if (eq.reforme || !site(eq.siteId)) continue;
      const p = echeancePreventif(etat, eq, auj, rg.alerteJours);
      if (p.etat === 'retard') out.push({ type: 'preventif', etat: 'retard', siteId: eq.siteId, equipementId: eq.id, titre: 'Préventif en retard', detail: `Échéance dépassée depuis le ${dateFr(p.echeance)}`, date: p.echeance });
      else if (p.etat === 'proche') out.push({ type: 'preventif', etat: 'proche', siteId: eq.siteId, equipementId: eq.id, titre: 'Préventif à prévoir', detail: `Échéance le ${dateFr(p.echeance)}`, date: p.echeance });
      const st = etatEquipement(etat, eq);
      if (st.code === 'arret') {
        const j = ecart(st.depuis, auj);
        if (j >= rg.arretJours) out.push({ type: 'arret', etat: 'retard', siteId: eq.siteId, equipementId: eq.id, interventionId: st.interventionId, titre: `À l'arrêt depuis ${j} jours`, detail: `Panne signalée le ${dateFr(st.depuis)}, seuil d'alerte ${rg.arretJours} jours`, date: st.depuis });
        else out.push({ type: 'arret', etat: 'proche', siteId: eq.siteId, equipementId: eq.id, interventionId: st.interventionId, titre: 'À l\'arrêt', detail: `Depuis le ${dateFr(st.depuis)} (alerte à ${rg.arretJours} jours)`, date: st.depuis });
      }
    }
    for (const s of etat.sites || []) {
      if (s.inactif) continue;
      const d = derniereVisite(etat, s.id, auj);
      const limite = ajoutMois(auj, -rg.visiteMois);
      if (!d) out.push({ type: 'visite', etat: 'proche', siteId: s.id, titre: 'Aucune visite enregistrée', detail: 'Note une visite ou une intervention pour suivre ce site', date: auj });
      else if (d < limite) out.push({ type: 'visite', etat: 'retard', siteId: s.id, titre: `Sans visite depuis plus de ${rg.visiteMois} mois`, detail: `Dernière visite le ${dateFr(d)}`, date: ajoutMois(d, rg.visiteMois) });
    }
    const rang = { retard: 0, proche: 1 };
    return out.sort((a, b) => rang[a.etat] - rang[b.etat] || (a.date || '').localeCompare(b.date || ''));
  }
  // Pire état d'un site d'après ses alertes : retard, proche ou ok.
  const etatSite = (liste, siteId) => (liste.some((a) => a.siteId === siteId && a.etat === 'retard') ? 'retard' : liste.some((a) => a.siteId === siteId) ? 'proche' : 'ok');

  // ---------- Tri et filtre de la liste des sites ----------
  // lignes : [{ site, ind, etat }] ; filtre : { texte, region, type, etat } ; tri : { cle, sens (1 ou -1) }.
  function filtrerSites(lignes, filtre = {}) {
    const q = plat(filtre.texte);
    return lignes.filter(({ site, etat }) => (!filtre.region || plat(site.region) === plat(filtre.region))
      && (!filtre.type || site.type === filtre.type)
      && (!filtre.etat || (filtre.etat === 'alerte' ? etat !== 'ok' : etat === filtre.etat))
      && (!q || plat([site.nom, site.ville, site.region, site.responsable, site.adresse].join(' ')).includes(q)));
  }
  function trierSites(lignes, tri = { cle: 'nom', sens: 1 }) {
    const rangEtat = { retard: 0, proche: 1, ok: 2 };
    const val = ({ site, ind, etat }) => ({ nom: plat(site.nom), ville: plat(site.ville), region: plat(site.region), equipements: ind.equipements,
      disponibilite: ind.disponibilite ?? 2, retards: ind.enRetard, cout: ind.cout, delai: ind.delaiMoyen ?? Infinity, etat: rangEtat[etat] }[tri.cle]);
    return [...lignes].sort((a, b) => {
      const x = val(a), y = val(b);
      const c = typeof x === 'string' ? x.localeCompare(y) : x - y;
      return c * (tri.sens || 1) || plat(a.site.nom).localeCompare(plat(b.site.nom));
    });
  }

  // ---------- Carte schématique (aucun fond de carte : projection simple des coordonnées saisies) ----------
  // Projection équirectangulaire corrigée de la latitude moyenne, cadrée sur les points avec une marge.
  // Renvoie { points: [{ id, x, y }], largeur, hauteur } ; null si aucun site n'a de coordonnées.
  function projeter(sites, largeur = 600, hauteur = 420, marge = 40) {
    const l = sites.filter(aCoordonnees);
    if (!l.length) return null;
    const latMoy = l.reduce((s, x) => s + x.lat, 0) / l.length;
    const k = Math.cos(latMoy * Math.PI / 180);
    const xs = l.map((s) => s.lon * k), ys = l.map((s) => s.lat);
    let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    // Étendue minimale (un seul site, ou sites très proches) : environ 0,5 degré.
    const min = 0.5;
    if (x1 - x0 < min) { const c = (x0 + x1) / 2; x0 = c - min / 2; x1 = c + min / 2; }
    if (y1 - y0 < min) { const c = (y0 + y1) / 2; y0 = c - min / 2; y1 = c + min / 2; }
    const ech = Math.min((largeur - 2 * marge) / (x1 - x0), (hauteur - 2 * marge) / (y1 - y0));
    const dx = (largeur - (x1 - x0) * ech) / 2, dy = (hauteur - (y1 - y0) * ech) / 2;
    return { largeur, hauteur, echelle: ech, bornes: { latMin: y0, latMax: y1, lonMin: x0 / k, lonMax: x1 / k },
      points: l.map((s) => ({ id: s.id, x: arrondi(dx + (s.lon * k - x0) * ech, 1), y: arrondi(hauteur - dy - (s.lat - y0) * ech, 1) })) };
  }
  // Sites sans coordonnées regroupés par région (ordre alphabétique, « Sans région » en dernier).
  function grilleRegions(sites) {
    const g2 = new Map();
    for (const s of sites) {
      const r = String(s.region || '').trim() || 'Sans région';
      if (!g2.has(r)) g2.set(r, []);
      g2.get(r).push(s);
    }
    return [...g2.entries()].sort((a, b) => (a[0] === 'Sans région') - (b[0] === 'Sans région') || a[0].localeCompare(b[0], 'fr'))
      .map(([region, l]) => ({ region, sites: l.sort((a, b) => a.nom.localeCompare(b.nom, 'fr')) }));
  }

  // ---------- CSV (point-virgule, UTF-8 avec BOM, tableurs français) ----------
  function champCsv(v) {
    let s = typeof v === 'number' ? String(v).replace('.', ',') : String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s) && typeof v !== 'number') s = `'${s}`; // formules neutralisées
    return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
  const versCsv = (lignes) => `﻿${lignes.map((l) => l.map(champCsv).join(';')).join('\r\n')}\r\n`;

  // Lecture d'un CSV : BOM retiré, séparateur « ; » (ou « , » / tabulation si l'en-tête l'indique),
  // guillemets doublés, retours à la ligne dans les champs, lignes vides ignorées.
  function lireCsv(texte) {
    const t = String(texte || '').replace(/^﻿/, '');
    const premiere = t.split(/\r?\n/)[0] || '';
    const compte = (c) => premiere.split(c).length - 1;
    const sep = compte(';') >= Math.max(compte(','), compte('\t')) ? ';' : compte('\t') > compte(',') ? '\t' : ',';
    const lignes = [];
    let ligne = [], champ = '', guil = false;
    for (let k = 0; k < t.length; k++) {
      const c = t[k];
      if (guil) {
        if (c === '"') { if (t[k + 1] === '"') { champ += '"'; k++; } else guil = false; } else champ += c;
      } else if (c === '"' && champ === '') guil = true;
      else if (c === sep) { ligne.push(champ); champ = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && t[k + 1] === '\n') k++;
        ligne.push(champ); lignes.push(ligne); ligne = []; champ = '';
      } else champ += c;
    }
    if (champ !== '' || ligne.length) { ligne.push(champ); lignes.push(ligne); }
    return lignes.filter((l) => l.some((x) => String(x).trim() !== '')).map((l) => l.map((x) => x.replace(/^'(?=[=+\-@])/, '')));
  }
  // Date lue dans un tableur : JJ/MM/AAAA, JJ-MM-AAAA ou AAAA-MM-JJ ; '' si vide ; undefined si invalide.
  function dateCsv(v) {
    const s = String(v ?? '').trim();
    if (!s) return '';
    let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (m) { const d = `${m[3]}-${deux(m[2])}-${deux(m[1])}`; return estDate(d) ? d : undefined; }
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) { const d = `${m[1]}-${m[2]}-${m[3]}`; return estDate(d) ? d : undefined; }
    return undefined;
  }

  const COLONNES_SITES = ['Nom', 'Type', 'Adresse', 'Ville', 'Région', 'Responsable', 'Latitude', 'Longitude', 'Notes'];
  const COLONNES_EQUIPEMENTS = ['Site', 'Désignation', 'Catégorie', 'Marque', 'Modèle', 'Mise en service', 'Criticité', 'Périodicité préventive (mois)', 'Notes'];
  const COLONNES_INTERVENTIONS = ['Date', 'Type', 'Site', 'Équipement', 'Catégorie', 'Libellé', 'Prestataire', 'Signalé le', 'Résolu le', 'Échéance du préventif', 'À l\'arrêt', 'Délai (jours)', 'Coût'];
  const libelle = (liste, code) => (liste.find((x) => x.code === code) || {}).nom || code || '';
  const versCode = (liste, v) => { const p = plat(v); if (!p) return ''; const x = liste.find((y) => plat(y.nom) === p || plat(y.code) === p || plat(y.court) === p); return x ? x.code : null; };

  function csvModele(quoi) { return versCsv([quoi === 'sites' ? COLONNES_SITES : COLONNES_EQUIPEMENTS]); }

  function csvSites(etat, base, auj) {
    const al = alertes(etat, base, auj);
    const lignes = (etat.sites || []).map((s) => {
      const ind = indicateurs(etat, base, { auj, periodeJours: etat.reglages.periodeJours, alerteJours: etat.reglages.alerteJours, siteIds: [s.id] });
      return [s.nom, libelle(base.typesSites, s.type), s.adresse, s.ville, s.region, s.responsable, Number.isFinite(s.lat) ? s.lat : '', Number.isFinite(s.lon) ? s.lon : '', s.notes,
        ind.equipements, ind.disponibilite === null ? '' : arrondi(ind.disponibilite * 100, 1), ind.enRetard, ind.correctifsOuverts, ind.delaiMoyen ?? '', ind.cout, dateFr(derniereVisite(etat, s.id, auj)), { retard: 'En retard', proche: 'À surveiller', ok: 'À jour' }[etatSite(al, s.id)]];
    });
    return versCsv([[...COLONNES_SITES, 'Équipements actifs', 'Disponibilité (%)', 'Préventifs en retard', 'Correctifs ouverts', 'Délai moyen de résolution (jours)', 'Coût sur la période', 'Dernière visite', 'État'], ...lignes]);
  }

  function csvEquipements(etat, base, auj) {
    const site = (id) => (etat.sites || []).find((s) => s.id === id);
    const ETATS = { service: 'En service', degrade: 'Dégradé', arret: 'À l\'arrêt', reforme: 'Réformé' };
    const lignes = (etat.equipements || []).map((e) => {
      const p = echeancePreventif(etat, e, auj, etat.reglages.alerteJours);
      const d = disponibilite(etat, e, auj, etat.reglages.periodeJours);
      return [site(e.siteId)?.nom || '', e.designation, libelle(base.categories, e.categorie), e.marque, e.modele, dateFr(e.miseEnService), libelle(base.criticites, e.criticite), Number(e.periodiciteMois) || '', e.notes,
        ETATS[etatEquipement(etat, e).code], dateFr(p.dernier?.date), dateFr(p.echeance), d === null ? '' : arrondi(d * 100, 1)];
    }).sort((a, b) => a[0].localeCompare(b[0], 'fr') || a[1].localeCompare(b[1], 'fr'));
    return versCsv([[...COLONNES_EQUIPEMENTS, 'État', 'Dernier préventif', 'Prochaine échéance', 'Disponibilité (%)'], ...lignes]);
  }

  function csvInterventions(etat, base) {
    const site = (id) => (etat.sites || []).find((s) => s.id === id);
    const eq = (id) => (etat.equipements || []).find((e) => e.id === id);
    const lignes = (etat.interventions || []).map((i) => {
      const e = eq(i.equipementId);
      const d = i.type === 'correctif' ? (i.resolu || i.signale) : i.date;
      return [d || '', libelle(base.typesInterventions, i.type), site(i.siteId)?.nom || '', e?.designation || '', e ? libelle(base.categories, e.categorie) : '', i.libelle, i.prestataire,
        dateFr(i.signale), dateFr(i.resolu), dateFr(i.echeance), i.type === 'correctif' ? (i.arret ? 'oui' : 'non') : '', i.type === 'correctif' && i.resolu && i.signale ? ecart(i.signale, i.resolu) : '', i.cout === '' || i.cout == null ? '' : nombre(i.cout)];
    }).sort((a, b) => b[0].localeCompare(a[0]));
    return versCsv([COLONNES_INTERVENTIONS, ...lignes.map((l) => [dateFr(l[0]), ...l.slice(1)])]);
  }

  // Correspondance des colonnes d'un fichier importé (ordre libre, accents et casse ignorés).
  function indexColonnes(entete, attendues) {
    const p = entete.map(plat);
    const idx = {};
    for (const c of attendues) { const k = p.indexOf(plat(c)); if (k >= 0) idx[c] = k; }
    return idx;
  }

  // Import des sites : met à jour le site de même nom (accents et casse ignorés), sinon l'ajoute.
  // Renvoie { sites (nouvelle liste), ajouts, majs, erreurs: [texte] } ; ne modifie pas `etat`.
  function importerSites(etat, base, texte, nouvelId) {
    const l = lireCsv(texte);
    if (!l.length) return { erreurs: ['Fichier vide.'], ajouts: 0, majs: 0, sites: etat.sites };
    const idx = indexColonnes(l[0], COLONNES_SITES);
    if (idx.Nom === undefined) return { erreurs: ['Colonne « Nom » introuvable : pars du modèle CSV des sites.'], ajouts: 0, majs: 0, sites: etat.sites };
    const sites = (etat.sites || []).map((s) => ({ ...s }));
    const erreurs = [];
    let ajouts = 0, majs = 0;
    l.slice(1).forEach((r, k) => {
      const n = k + 2;
      const v = (c) => (idx[c] === undefined ? undefined : String(r[idx[c]] ?? '').trim());
      const nom = v('Nom');
      if (!nom) { erreurs.push(`Ligne ${n} : nom du site manquant.`); return; }
      const champs = {};
      for (const [c, cle] of [['Adresse', 'adresse'], ['Ville', 'ville'], ['Région', 'region'], ['Responsable', 'responsable'], ['Notes', 'notes']]) if (v(c) !== undefined) champs[cle] = v(c);
      if (v('Type') !== undefined) { const t = v('Type') ? versCode(base.typesSites, v('Type')) : 'AUT'; if (t === null) { erreurs.push(`Ligne ${n} : type « ${v('Type')} » inconnu, « Autre » retenu.`); champs.type = 'AUT'; } else champs.type = t; }
      const la = v('Latitude') === undefined ? null : coord(v('Latitude'), 90), lo = v('Longitude') === undefined ? null : coord(v('Longitude'), 180);
      if (la === undefined || lo === undefined || (la === null) !== (lo === null)) erreurs.push(`Ligne ${n} : coordonnées ignorées (latitude et longitude décimales, les deux ou aucune).`);
      else if (v('Latitude') !== undefined) { champs.lat = la; champs.lon = lo; }
      const ex = sites.find((s) => plat(s.nom) === plat(nom));
      if (ex) { Object.assign(ex, champs); majs++; } else { sites.push({ id: nouvelId(), nom, type: 'AUT', adresse: '', ville: '', region: '', responsable: '', lat: null, lon: null, notes: '', ...champs }); ajouts++; }
    });
    return { sites, ajouts, majs, erreurs };
  }

  // Import des équipements : le site est cherché par son nom (il doit exister) ; l'équipement de
  // même désignation sur le même site est mis à jour, sinon ajouté.
  function importerEquipements(etat, base, texte, nouvelId) {
    const l = lireCsv(texte);
    const vide = { erreurs: [], ajouts: 0, majs: 0, equipements: etat.equipements };
    if (!l.length) return { ...vide, erreurs: ['Fichier vide.'] };
    const idx = indexColonnes(l[0], COLONNES_EQUIPEMENTS);
    if (idx.Site === undefined || idx['Désignation'] === undefined) return { ...vide, erreurs: ['Colonnes « Site » et « Désignation » introuvables : pars du modèle CSV des équipements.'] };
    const equipements = (etat.equipements || []).map((e) => ({ ...e }));
    const erreurs = [];
    let ajouts = 0, majs = 0;
    l.slice(1).forEach((r, k) => {
      const n = k + 2;
      const v = (c) => (idx[c] === undefined ? undefined : String(r[idx[c]] ?? '').trim());
      const site = (etat.sites || []).find((s) => plat(s.nom) === plat(v('Site')));
      if (!site) { erreurs.push(`Ligne ${n} : site « ${v('Site') || '(vide)'} » introuvable, importe d'abord les sites.`); return; }
      const designation = v('Désignation');
      if (!designation) { erreurs.push(`Ligne ${n} : désignation manquante.`); return; }
      const champs = {};
      for (const [c, cle] of [['Marque', 'marque'], ['Modèle', 'modele'], ['Notes', 'notes']]) if (v(c) !== undefined) champs[cle] = v(c);
      if (v('Catégorie') !== undefined) { const c = v('Catégorie') ? versCode(base.categories, v('Catégorie')) : 'AUT'; if (c === null) { erreurs.push(`Ligne ${n} : catégorie « ${v('Catégorie')} » inconnue, « Autre » retenue.`); champs.categorie = 'AUT'; } else champs.categorie = c; }
      if (v('Criticité') !== undefined) { const c = v('Criticité') ? versCode(base.criticites, v('Criticité')) : 'moyenne'; if (c === null) { erreurs.push(`Ligne ${n} : criticité « ${v('Criticité')} » inconnue, « Moyenne » retenue.`); champs.criticite = 'moyenne'; } else champs.criticite = c; }
      if (v('Mise en service') !== undefined) { const d = dateCsv(v('Mise en service')); if (d === undefined) erreurs.push(`Ligne ${n} : date de mise en service illisible (JJ/MM/AAAA), ignorée.`); else champs.miseEnService = d; }
      if (v('Périodicité préventive (mois)') !== undefined) {
        const s = v('Périodicité préventive (mois)'); const m = s === '' ? 0 : Number(s.replace(',', '.'));
        if (!Number.isInteger(m) || m < 0 || m > 120) erreurs.push(`Ligne ${n} : périodicité « ${s} » ignorée (nombre entier de mois, 0 à 120).`); else champs.periodiciteMois = m;
      }
      const ex = equipements.find((e) => e.siteId === site.id && plat(e.designation) === plat(designation));
      if (ex) { Object.assign(ex, champs); majs++; } else { equipements.push({ id: nouvelId(), siteId: site.id, designation, categorie: 'AUT', marque: '', modele: '', miseEnService: '', criticite: 'moyenne', periodiciteMois: 12, reforme: false, notes: '', ...champs }); ajouts++; }
    });
    return { equipements, ajouts, majs, erreurs };
  }

  // Taille en octets de l'état sérialisé (le service accepte environ 900 000 octets par compte).
  const taille = (etat) => new TextEncoder().encode(JSON.stringify(etat)).length;

  g.REGLES = {
    iso, versDate, ajout, ecart, estDate, dateFr, ajoutMois, plat, nombre, arrondi, coord, aCoordonnees,
    etatEquipement, echeancePreventif, joursArret, disponibilite, derniereVisite, indicateurs, alertes, etatSite,
    filtrerSites, trierSites, projeter, grilleRegions,
    champCsv, lireCsv, dateCsv, csvModele, csvSites, csvEquipements, csvInterventions, importerSites, importerEquipements,
    COLONNES_SITES, COLONNES_EQUIPEMENTS, COLONNES_INTERVENTIONS, taille,
  };
})(typeof window !== 'undefined' ? window : globalThis);
