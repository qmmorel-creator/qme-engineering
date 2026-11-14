// Carnet de voiture QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.CAR) et par les tests Node (outils/templates/voiture.test.mjs).
// Version particulier du moteur de la gestion de flotte (templates/flotte/regles.js), sans conducteurs,
// réservations ni sinistres. Dates locales « AAAA-MM-JJ » (comparables comme des chaînes) ; toutes les
// fonctions qui dépendent du jour reçoivent la date de référence `auj`.
(function (g) {
  'use strict';

  // ---------- Dates ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = String(s).slice(0, 10).split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  const dateFr = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '');
  // Ajoute n mois ; le jour est borné à la fin du mois (31 janvier + 1 mois = 28 ou 29 février).
  function ajoutMois(s, n) {
    const [a, m, j] = s.split('-').map(Number);
    const t = (a * 12 + (m - 1)) + Number(n);
    const an = Math.floor(t / 12), mo = t - an * 12;
    const fin = new Date(an, mo + 1, 0).getDate();
    return `${an}-${deux(mo + 1)}-${deux(Math.min(j, fin))}`;
  }

  // ---------- Nombres et textes ----------
  const arrondi = (n, d = 2) => Math.round((n + Number.EPSILON) * 10 ** d) / 10 ** d;
  const nombre = (v) => { const n = Number(String(v ?? '').replace(/[\s ]/g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
  // « 1 234,5 » → 1234.5 ; null si vide ou illisible (jamais négatif).
  function lireNombre(saisie) {
    const s = String(saisie ?? '').replace(/[\s  ]/g, '').replace(',', '.');
    if (!s || !/^\d+(\.\d{0,3})?$/.test(s)) return null;
    return Number(s);
  }
  // Immatriculation : majuscules, tirets normalisés (format libre accepté).
  const immat = (s) => String(s || '').toUpperCase().replace(/[\s_.]+/g, '-').replace(/[^0-9A-Z-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 16);
  const plat = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  // ---------- Énergies ----------
  const energieDe = (base, code) => base.energies.find((e) => e.code === code) || base.energies.at(-1);
  const thermique = (base, code) => energieDe(base, code).carburant;
  // Catégories d'énergie proposées pour une voiture : CAR (litres) et/ou REC (kWh).
  const categoriesEnergie = (base, code) => { const e = energieDe(base, code); return [e.carburant && 'CAR', e.electrique && 'REC'].filter(Boolean); };
  const UNITE = { CAR: 'L', REC: 'kWh' };

  // ---------- Kilométrage ----------
  // Points connus (date, km) : entrée dans le carnet, relevés, entretiens, contrôles, pleins et recharges.
  function pointsKm(etat, v) {
    const p = [];
    const ok = (x) => x !== null && x !== undefined && x !== '' && Number.isFinite(Number(x));
    if (estDate(v.achat) && ok(v.kmAchat)) p.push({ date: v.achat, km: Number(v.kmAchat), source: 'entree' });
    for (const r of etat.releves || []) if (r.vehiculeId === v.id && ok(r.km)) p.push({ date: r.date, km: Number(r.km), source: 'releve', id: r.id });
    for (const e of etat.entretiens || []) if (e.vehiculeId === v.id && ok(e.km)) p.push({ date: e.date, km: Number(e.km), source: 'entretien', id: e.id });
    for (const c of etat.controles || []) if (c.vehiculeId === v.id && ok(c.km)) p.push({ date: c.date, km: Number(c.km), source: 'controle', id: c.id });
    for (const d of etat.depenses || []) if (d.vehiculeId === v.id && ok(d.km)) p.push({ date: d.date, km: Number(d.km), source: 'depense', id: d.id });
    return p.filter((x) => estDate(x.date)).sort((a, b) => a.date.localeCompare(b.date) || a.km - b.km);
  }
  const kmActuel = (points) => points.reduce((m, p) => Math.max(m, p.km), 0);
  const dernierReleve = (points) => points.reduce((m, p) => (!m || p.date > m ? p.date : m), null);

  // Rythme en km par jour sur la fenêtre (365 jours), repli sur tout l'historique ; null si inconnu.
  function rythme(points, auj, fenetre = 365) {
    const dans = (l) => l.filter((p) => p.date <= auj);
    let l = dans(points).filter((p) => p.date >= ajout(auj, -fenetre));
    if (new Set(l.map((p) => p.date)).size < 2) l = dans(points);
    if (l.length < 2) return null;
    const a = l[0], b = l.reduce((m, p) => (p.date > m.date || (p.date === m.date && p.km > m.km) ? p : m), l[0]);
    const j = ecart(a.date, b.date);
    if (j < 1 || b.km < a.km) return null;
    return (b.km - a.km) / j;
  }

  // Kilométrage estimé à une date : interpolation linéaire entre deux points connus, borné aux extrémités
  // (jamais d'extrapolation). null sans aucun point.
  function kmA(points, date) {
    if (!points.length) return null;
    const avant = points.filter((p) => p.date <= date);
    const apres = points.filter((p) => p.date > date);
    if (!avant.length) return apres[0].km;
    const a = avant.reduce((m, p) => (p.km > m.km ? p : m), avant[0]);
    if (!apres.length) return a.km;
    const b = apres.reduce((m, p) => (p.km < m.km ? p : m), apres[0]);
    const j = ecart(a.date, b.date);
    return j > 0 ? Math.round(a.km + (b.km - a.km) * ecart(a.date, date) / j) : a.km;
  }

  // Un nouveau relevé reste cohérent avec les relevés antérieurs et postérieurs (compteur jamais en baisse).
  function verifierReleve(points, date, km, ignorerId = null) {
    if (!estDate(date)) return 'Date invalide.';
    if (!Number.isFinite(km) || km < 0) return 'Kilométrage invalide.';
    if (km > 2000000) return 'Kilométrage invraisemblable.';
    const autres = points.filter((p) => !ignorerId || p.id !== ignorerId);
    const avant = autres.filter((p) => p.date <= date && p.km > km).sort((a, b) => b.km - a.km)[0];
    if (avant) return `Incohérent : ${avant.km.toLocaleString('fr-FR')} km notés le ${dateFr(avant.date)}${avant.date === date ? '' : ', avant cette date'}.`;
    const apres = autres.filter((p) => p.date > date && p.km < km).sort((a, b) => a.km - b.km)[0];
    if (apres) return `Incohérent : seulement ${apres.km.toLocaleString('fr-FR')} km notés le ${dateFr(apres.date)}, après cette date.`;
    return null;
  }

  // ---------- Plan d'entretien ----------
  // Plan proposé depuis la base selon l'énergie (copie modifiable ; le carnet du constructeur prime).
  function planDefaut(base, codeEnergie) {
    const th = thermique(base, codeEnergie);
    return base.entretiens.filter((o) => o.pour === 'tous' || (o.pour === 'thermique' && th) || (o.pour === 'electrique' && !th))
      .map((o) => ({ id: o.code, nom: o.nom, km: o.km, mois: o.mois, depuis: null, depuisKm: null }));
  }

  // Échéance d'une opération : la première atteinte entre la date et le kilométrage.
  // Référence = dernier entretien qui contient l'opération, sinon « dernière fois connue » saisie dans le
  // plan, sinon l'entrée de la voiture dans le carnet. alerte : { jours, km }. ry : km par jour (ou null).
  function echeanceEntretien(op, v, entretiens, kmAct, auj, alerte, ry = null) {
    const faits = (entretiens || []).filter((e) => e.vehiculeId === v.id && (e.operations || []).includes(op.id) && estDate(e.date))
      .sort((a, b) => b.date.localeCompare(a.date));
    const dernier = faits[0] || null;
    const vide = (x) => x === null || x === undefined || x === '';
    let refDate, refKm;
    if (dernier) { refDate = dernier.date; refKm = vide(dernier.km) ? (vide(op.depuisKm) ? Number(v.kmAchat) || 0 : Number(op.depuisKm)) : Number(dernier.km); }
    else { refDate = estDate(op.depuis) ? op.depuis : (v.achat || v.miseEnCirculation || null); refKm = vide(op.depuisKm) ? Number(v.kmAchat) || 0 : Number(op.depuisKm); }
    const echKm = Number(op.km) > 0 ? refKm + Number(op.km) : null;
    const echDate = Number(op.mois) > 0 && estDate(refDate) ? ajoutMois(refDate, Number(op.mois)) : null;
    const kmRestant = echKm === null ? null : echKm - kmAct;
    const joursRestant = echDate === null ? null : ecart(auj, echDate);
    const dateKm = kmRestant === null ? null : kmRestant <= 0 ? auj : ry > 0 ? ajout(auj, Math.ceil(kmRestant / ry)) : null;
    const prevue = [echDate, dateKm].filter(Boolean).sort()[0] || null;
    // Critère qui arrive en premier (pour l'affichage « à 60 000 km ou le 12/05/2027, la première atteinte »).
    const premier = echDate && dateKm ? (dateKm < echDate ? 'km' : 'date') : echDate ? 'date' : echKm !== null ? 'km' : null;
    let etat = 'ok';
    if (echKm === null && echDate === null) etat = 'sans';
    else if ((kmRestant !== null && kmRestant <= 0) || (joursRestant !== null && joursRestant < 0)) etat = 'retard';
    else if ((kmRestant !== null && kmRestant <= alerte.km) || (joursRestant !== null && joursRestant <= alerte.jours) || (dateKm && ecart(auj, dateKm) <= alerte.jours)) etat = 'proche';
    return { op, dernier, refDate, refKm, echKm, echDate, kmRestant, joursRestant, dateKm, prevue, premier, etat };
  }

  // ---------- Contrôle technique ----------
  // Voiture particulière (M1), service-public.gouv.fr F2878 : 1er contrôle avant le 4e anniversaire de la
  // 1re mise en circulation (fenêtre des 6 derniers mois) ; résultat favorable valable 2 ans ; contre-visite
  // dans les 2 mois après une défaillance majeure ou critique ; contre-visite favorable valable 2 ans à
  // compter du contrôle défavorable. Échéance = date limite incluse (anniversaire − 1 jour, comme l'exemple
  // de la fiche : contrôle du 14/05/2025 → 13/05/2027). Pour un autre type, les périodicités sont celles
  // saisies sur la voiture (0 = aucune échéance calculée).
  function echeanceCT(v, controles, reglages) {
    const autre = v.type === 'AUTRE';
    const premierMois = autre ? Number(v.ctPremierMois) || 0 : Number(reglages.ctPremierMois) || 0;
    const periode = autre ? Number(v.ctMois) || 0 : Number(reglages.ctPeriodiqueMois) || 0;
    const cvMois = Number(reglages.ctContreVisiteMois) || 2;
    const cts = (controles || []).filter((c) => c.vehiculeId === v.id && estDate(c.date)).sort((a, b) => a.date.localeCompare(b.date));
    const periodiques = cts.filter((c) => c.nature === 'periodique');
    const dernierP = periodiques.at(-1) || null;
    let ref = null;
    if (dernierP) {
      if (dernierP.resultat !== 'favorable') {
        const apres = cts.filter((c) => c.date >= dernierP.date && c.id !== dernierP.id);
        const levee = apres.find((c) => c.nature === 'contre-visite' && c.resultat === 'favorable');
        if (!levee) {
          const mauvais = [dernierP, ...apres.filter((c) => c.resultat !== 'favorable')].at(-1);
          const critique = [dernierP, ...apres].some((c) => c.resultat === 'critique') && mauvais.resultat === 'critique';
          return { nature: 'contre-visite', echeance: ajout(ajoutMois(mauvais.date, cvMois), -1), ref: mauvais.date, critique, controle: dernierP };
        }
      }
      ref = dernierP.date;
    } else if (estDate(v.ctDernier)) ref = v.ctDernier;
    if (ref) return periode > 0 ? { nature: 'periodique', echeance: ajout(ajoutMois(ref, periode), -1), ref, premier: false } : { nature: 'aucune' };
    if (premierMois > 0 && estDate(v.miseEnCirculation)) {
      const echeance = ajout(ajoutMois(v.miseEnCirculation, premierMois), -1);
      return { nature: 'periodique', echeance, ref: null, premier: true, des: autre ? null : ajoutMois(v.miseEnCirculation, premierMois - 6) };
    }
    return { nature: 'aucune' };
  }
  const etatDate = (echeance, auj, jours) => (echeance < auj ? 'retard' : ecart(auj, echeance) <= jours ? 'proche' : 'ok');

  // ---------- Consommation (plein à plein) ----------
  // Pleins (CAR, litres) ou recharges (REC, kWh) d'une voiture. Un intervalle va d'un plein complet avec
  // kilométrage au plein complet suivant : quantité = tout ce qui a été mis après le premier, jusqu'au
  // second inclus ; distance = écart des compteurs. Un plein « oublié avant celui-ci » ou un plein complet
  // sans kilométrage coupe la chaîne. Résultat en unités pour 100 km.
  function consommation(depenses, vehiculeId, categorie) {
    const vide = (x) => x === null || x === undefined || x === '';
    const l = (depenses || []).filter((d) => d.vehiculeId === vehiculeId && d.categorie === categorie && nombre(d.quantite) > 0 && estDate(d.date))
      .sort((a, b) => a.date.localeCompare(b.date) || (vide(a.km) || vide(b.km) ? 0 : Number(a.km) - Number(b.km)));
    const intervalles = [];
    let prec = null, q = 0, m = 0;
    for (const p of l) {
      if (p.oubli) { prec = null; q = 0; m = 0; }
      if (!prec) {
        if (p.plein && !vide(p.km)) { prec = p; q = 0; m = 0; }
        continue;
      }
      q += nombre(p.quantite); m += nombre(p.montant);
      if (!p.plein) continue;
      // Plein complet sans compteur : chaîne coupée. Compteur incohérent : on repart de ce plein.
      if (vide(p.km)) { prec = null; q = 0; m = 0; continue; }
      if (Number(p.km) <= Number(prec.km)) { prec = p; q = 0; m = 0; continue; }
      const km = Number(p.km) - Number(prec.km);
      intervalles.push({ du: prec.date, au: p.date, kmDu: Number(prec.km), kmAu: Number(p.km), km, quantite: arrondi(q, 3), montant: arrondi(m), pour100: arrondi(q / km * 100, 2), coutKm: arrondi(m / km, 3) });
      prec = p; q = 0; m = 0;
    }
    const km = intervalles.reduce((s, x) => s + x.km, 0);
    const quantite = intervalles.reduce((s, x) => s + x.quantite, 0);
    const litres = l.reduce((s, x) => s + nombre(x.quantite), 0);
    const payes = l.reduce((s, x) => s + nombre(x.montant), 0);
    return {
      unite: UNITE[categorie] || '', intervalles, km, quantite: arrondi(quantite, 3),
      moyenne: km > 0 ? arrondi(quantite / km * 100, 2) : null,
      derniere: intervalles.at(-1) || null,
      prixMoyen: litres > 0 && payes > 0 ? arrondi(payes / litres, 3) : null, nombre: l.length,
    };
  }

  // ---------- Coûts ----------
  // Lignes de coût : dépenses saisies + coût des entretiens (ENT) + coût des contrôles techniques (CT).
  function lignesCout(etat) {
    const l = [];
    for (const d of etat.depenses || []) l.push({ date: d.date, vehiculeId: d.vehiculeId, categorie: d.categorie, montant: nombre(d.montant), libelle: d.libelle || '', km: d.km, quantite: d.quantite, source: 'depense', id: d.id });
    for (const e of etat.entretiens || []) if (nombre(e.cout) > 0) l.push({ date: e.date, vehiculeId: e.vehiculeId, categorie: 'ENT', montant: nombre(e.cout), libelle: e.garage || '', km: e.km, source: 'entretien', id: e.id });
    for (const c of etat.controles || []) if (nombre(c.cout) > 0) l.push({ date: c.date, vehiculeId: c.vehiculeId, categorie: 'CT', montant: nombre(c.cout), libelle: c.nature === 'contre-visite' ? 'Contre-visite' : 'Contrôle périodique', km: c.km, source: 'controle', id: c.id });
    return l.filter((x) => estDate(x.date)).sort((a, b) => b.date.localeCompare(a.date));
  }

  // Coûts d'une voiture (ou de toutes : vehiculeId null) du `du` au `au` inclus.
  // km = kilomètres parcourus sur la période (interpolés) ; coût au km = total / km (rien sous 1 km) ;
  // coût mensuel = total / mois de la période effective (à partir de l'entrée dans le carnet), 1 mois au moins.
  function couts(etat, base, vehiculeId, du, au) {
    const vs = (etat.vehicules || []).filter((v) => !vehiculeId || v.id === vehiculeId);
    const ids = new Set(vs.map((v) => v.id));
    const lignes = lignesCout(etat).filter((x) => ids.has(x.vehiculeId) && x.date >= du && x.date <= au);
    const parCategorie = {}, parGroupe = {};
    for (const x of lignes) {
      parCategorie[x.categorie] = arrondi((parCategorie[x.categorie] || 0) + x.montant);
      const gr = base.categories.find((c) => c.code === x.categorie)?.groupe || 'autre';
      parGroupe[gr] = arrondi((parGroupe[gr] || 0) + x.montant);
    }
    const total = arrondi(lignes.reduce((s, x) => s + x.montant, 0));
    let km = 0, debutEff = null;
    for (const v of vs) {
      const pts = pointsKm(etat, v);
      if (!pts.length) continue;
      const a = kmA(pts, du), b = kmA(pts, au);
      km += Math.max(0, b - a);
      const d0 = [v.achat, pts[0].date, ...lignes.filter((x) => x.vehiculeId === v.id).map((x) => x.date)].filter(estDate).sort()[0];
      if (d0 && (!debutEff || d0 < debutEff)) debutEff = d0;
    }
    const debut = debutEff && debutEff > du ? debutEff : du;
    const mois = Math.max(1, (ecart(debut, au) + 1) / (365.25 / 12));
    return {
      lignes, parCategorie, parGroupe, total, km, debut,
      coutKm: km >= 1 ? arrondi(total / km, 3) : null,
      mois: arrondi(mois, 2), coutMensuel: arrondi(total / mois),
    };
  }

  // Total par mois civil sur les n derniers mois (le mois en cours compris), du plus ancien au plus récent.
  function coutsParMois(etat, vehiculeId, auj, n = 12) {
    const premier = `${ajoutMois(`${auj.slice(0, 7)}-01`, -(n - 1))}`;
    const res = [];
    for (let k = 0; k < n; k++) res.push({ mois: ajoutMois(premier, k).slice(0, 7), total: 0 });
    for (const x of lignesCout(etat)) {
      if (vehiculeId && x.vehiculeId !== vehiculeId) continue;
      if (!(etat.vehicules || []).some((v) => v.id === x.vehiculeId)) continue;
      const r = res.find((m) => m.mois === x.date.slice(0, 7));
      if (r && x.date <= auj) r.total = arrondi(r.total + x.montant);
    }
    return res;
  }

  // ---------- Synthèse et alertes ----------
  const reglAlerte = (rg) => ({ jours: rg.alerteJours, km: rg.alerteKm });

  function syntheseVehicule(etat, base, v, auj) {
    const pts = pointsKm(etat, v);
    const km = kmActuel(pts), ry = rythme(pts, auj);
    const ents = (v.plan || []).map((op) => echeanceEntretien(op, v, etat.entretiens, km, auj, reglAlerte(etat.reglages), ry));
    const ct = echeanceCT(v, etat.controles, etat.reglages);
    const ctEtat = ct.nature === 'aucune' ? 'sans' : ct.critique ? 'retard' : etatDate(ct.echeance, auj, etat.reglages.alerteJours);
    const rang = { retard: 0, proche: 1, ok: 2, sans: 3 };
    const pire = [...ents.map((e) => e.etat), ctEtat].sort((a, b) => rang[a] - rang[b])[0] || 'ok';
    const prochains = ents.filter((e) => e.prevue).sort((a, b) => rang[a.etat] - rang[b.etat] || a.prevue.localeCompare(b.prevue));
    return { points: pts, km, ry, dernier: dernierReleve(pts), entretiens: ents, prochain: prochains[0] || null, ct, ctEtat, pire };
  }

  // Une alerte : { type, etat: retard|proche, vehiculeId, refId, titre, detail, date } ; retards d'abord.
  function alertes(etat, base, auj) {
    const rg = etat.reglages;
    const out = [];
    for (const v of (etat.vehicules || []).filter((x) => x.actif !== false)) {
      const s = syntheseVehicule(etat, base, v, auj);
      for (const e of s.entretiens) {
        if (e.etat !== 'retard' && e.etat !== 'proche') continue;
        const crit = [e.echKm !== null && `${e.echKm.toLocaleString('fr-FR')} km`, e.echDate && dateFr(e.echDate)].filter(Boolean).join(' ou le ');
        out.push({ type: 'entretien', etat: e.etat, vehiculeId: v.id, refId: e.op.id, titre: e.op.nom, detail: `À ${crit}${e.echKm !== null && e.echDate ? ', la première atteinte' : ''}`, date: e.etat === 'retard' ? (e.kmRestant !== null && e.kmRestant <= 0 ? auj : e.echDate) : (e.prevue || auj) });
      }
      const ct = s.ct;
      if (ct.nature !== 'aucune' && s.ctEtat !== 'ok') {
        const titre = ct.nature === 'contre-visite' ? (ct.critique ? 'Contre-visite : défaillance critique' : 'Contre-visite du contrôle technique') : ct.premier ? 'Premier contrôle technique' : 'Contrôle technique';
        const detail = ct.critique ? `Ne plus circuler avant réparation ; contre-visite au plus tard le ${dateFr(ct.echeance)}` : `Au plus tard le ${dateFr(ct.echeance)}${ct.des && ct.des > auj ? ` (possible dès le ${dateFr(ct.des)})` : ''}`;
        out.push({ type: 'ct', etat: s.ctEtat, vehiculeId: v.id, refId: ct.nature, titre, detail, date: ct.echeance });
      }
      if (s.dernier && ecart(s.dernier, auj) > rg.releveAncienJours) {
        out.push({ type: 'releve', etat: 'proche', vehiculeId: v.id, refId: 'releve', titre: 'Kilométrage à mettre à jour', detail: `Dernier relevé le ${dateFr(s.dernier)} : les échéances au km sont estimées`, date: ajout(s.dernier, rg.releveAncienJours) });
      }
    }
    const rang = { retard: 0, proche: 1 };
    return out.sort((a, b) => rang[a.etat] - rang[b.etat] || (a.date || '').localeCompare(b.date || ''));
  }

  // ---------- Historique pour la revente ----------
  // Données de l'historique d'une voiture : entretiens, contrôles et réparations, du plus récent au plus ancien.
  function historique(etat, base, v, auj, { montants = false } = {}) {
    const s = syntheseVehicule(etat, base, v, auj);
    const nomOp = (id) => (v.plan || []).find((o) => o.id === id)?.nom || base.entretiens.find((o) => o.code === id)?.nom || id;
    const lignes = [];
    for (const e of etat.entretiens || []) if (e.vehiculeId === v.id) lignes.push({ date: e.date, km: e.km, type: 'Entretien', detail: [(e.operations || []).map(nomOp).join(', '), e.note].filter(Boolean).join(' · '), par: e.garage || '', montant: nombre(e.cout) });
    for (const c of etat.controles || []) if (c.vehiculeId === v.id) lignes.push({ date: c.date, km: c.km, type: c.nature === 'contre-visite' ? 'Contre-visite' : 'Contrôle technique', detail: { favorable: 'Favorable', majeure: 'Défaillance majeure : contre-visite', critique: 'Défaillance critique : contre-visite' }[c.resultat] || '', par: c.centre || '', montant: nombre(c.cout) });
    for (const d of etat.depenses || []) if (d.vehiculeId === v.id && (d.categorie === 'REP' || d.categorie === 'PNE')) lignes.push({ date: d.date, km: d.km, type: d.categorie === 'PNE' ? 'Pneus' : 'Réparation', detail: d.libelle || '', par: '', montant: nombre(d.montant) });
    lignes.sort((a, b) => b.date.localeCompare(a.date));
    if (!montants) lignes.forEach((l) => { delete l.montant; });
    return { vehicule: v, km: s.km, dernier: s.dernier, ct: s.ct, lignes, energie: energieDe(base, v.energie).nom };
  }

  function texteHistorique(h, auj) {
    const v = h.vehicule;
    const t = [`Historique d'entretien · ${v.nom || 'Voiture'}${v.immat ? ` (${v.immat})` : ''}`, `Arrêté le ${dateFr(auj)} · ${h.km.toLocaleString('fr-FR')} km`, `Énergie : ${h.energie}${v.miseEnCirculation ? ` · 1re mise en circulation : ${dateFr(v.miseEnCirculation)}` : ''}`];
    if (h.ct.nature === 'periodique' && h.ct.ref) t.push(`Dernier contrôle technique : ${dateFr(h.ct.ref)} · prochain au plus tard le ${dateFr(h.ct.echeance)}`);
    t.push('');
    for (const l of h.lignes) t.push(`${dateFr(l.date)}${l.km !== '' && l.km != null ? ` · ${Number(l.km).toLocaleString('fr-FR')} km` : ''} · ${l.type}${l.detail ? ` : ${l.detail}` : ''}${l.par ? ` (${l.par})` : ''}${l.montant ? ` · ${l.montant.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : ''}`);
    if (!h.lignes.length) t.push('Aucun entretien noté.');
    t.push('', 'Établi à partir du carnet tenu par le propriétaire ; les factures font foi.');
    return t.join('\n');
  }

  // ---------- Export CSV (point-virgule, BOM UTF-8, tableurs français) ----------
  function champCsv(v) {
    let s = typeof v === 'number' ? String(v).replace('.', ',') : String(v ?? '');
    if (typeof v !== 'number' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`; // formules neutralisées
    return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
  const versCsv = (lignes) => `﻿${lignes.map((l) => l.map(champCsv).join(';')).join('\r\n')}\r\n`;

  function csvJournal(etat, base) {
    const v = (id) => etat.vehicules.find((x) => x.id === id);
    const cat = (c) => base.categories.find((x) => x.code === c)?.nom || c;
    const vide = (x) => x === null || x === undefined || x === '';
    const lignes = lignesCout(etat).slice().reverse().map((x) => [dateFr(x.date), v(x.vehiculeId)?.nom || '', v(x.vehiculeId)?.immat || '', cat(x.categorie), x.libelle,
      vide(x.km) ? '' : Number(x.km), vide(x.quantite) ? '' : nombre(x.quantite), UNITE[x.categorie] || '', x.montant]);
    return versCsv([['Date', 'Voiture', 'Immatriculation', 'Catégorie', 'Libellé', 'Km', 'Quantité', 'Unité', 'Montant'], ...lignes]);
  }

  // ---------- Normalisation ----------
  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const texte = (v, n) => String(v ?? '').trim().slice(0, n);
  const dateOuNull = (v) => (estDate(v) ? v : null);
  const kmOuVide = (v) => { if (v === null || v === undefined || v === '') return ''; const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 0 ? n : ''; };
  const montant = (v) => { const n = nombre(v); return n > 0 ? arrondi(n) : 0; };
  const entier = (v, mini, maxi, defaut) => { const n = Math.round(Number(v)); return v !== '' && v !== null && v !== undefined && Number.isFinite(n) ? Math.min(maxi, Math.max(mini, n)) : defaut; };

  function normaliserOp(o) {
    return { id: texte(o?.id, 40) || nouvelId(), nom: texte(o?.nom, 80) || 'Opération', km: entier(o?.km, 0, 1000000, 0), mois: entier(o?.mois, 0, 240, 0), depuis: dateOuNull(o?.depuis), depuisKm: kmOuVide(o?.depuisKm) };
  }
  function normaliserVehicule(x, base) {
    const energie = base.energies.some((e) => e.code === x?.energie) ? x.energie : 'ES';
    return {
      id: texte(x?.id, 40) || nouvelId(), nom: texte(x?.nom, 60) || 'Ma voiture', immat: immat(x?.immat),
      type: x?.type === 'AUTRE' ? 'AUTRE' : 'M1', energie,
      miseEnCirculation: dateOuNull(x?.miseEnCirculation), achat: dateOuNull(x?.achat), kmAchat: kmOuVide(x?.kmAchat),
      ctDernier: dateOuNull(x?.ctDernier), ctPremierMois: entier(x?.ctPremierMois, 0, 240, 0), ctMois: entier(x?.ctMois, 0, 240, 0),
      plan: Array.isArray(x?.plan) ? x.plan.map(normaliserOp) : planDefaut(base, energie),
      notes: texte(x?.notes, 400), actif: x?.actif !== false, venteLe: dateOuNull(x?.venteLe),
    };
  }
  const normaliserReleve = (x) => ({ id: texte(x?.id, 40) || nouvelId(), vehiculeId: texte(x?.vehiculeId, 40), date: dateOuNull(x?.date) || '2026-01-01', km: kmOuVide(x?.km) });
  const normaliserEntretien = (x) => ({ id: texte(x?.id, 40) || nouvelId(), vehiculeId: texte(x?.vehiculeId, 40), date: dateOuNull(x?.date) || '2026-01-01', km: kmOuVide(x?.km), operations: Array.isArray(x?.operations) ? x.operations.map((o) => texte(o, 40)).filter(Boolean) : [], garage: texte(x?.garage, 80), cout: montant(x?.cout), note: texte(x?.note, 200) });
  const normaliserControle = (x) => ({ id: texte(x?.id, 40) || nouvelId(), vehiculeId: texte(x?.vehiculeId, 40), date: dateOuNull(x?.date) || '2026-01-01', km: kmOuVide(x?.km), nature: x?.nature === 'contre-visite' ? 'contre-visite' : 'periodique', resultat: ['favorable', 'majeure', 'critique'].includes(x?.resultat) ? x.resultat : 'favorable', centre: texte(x?.centre, 80), cout: montant(x?.cout) });
  function normaliserDepense(x, base) {
    const categorie = base.categories.some((c) => c.code === x?.categorie && !c.auto) ? x.categorie : 'AUT';
    const energie = categorie === 'CAR' || categorie === 'REC';
    const q = nombre(x?.quantite);
    return { id: texte(x?.id, 40) || nouvelId(), vehiculeId: texte(x?.vehiculeId, 40), date: dateOuNull(x?.date) || '2026-01-01', categorie, montant: montant(x?.montant), libelle: texte(x?.libelle, 120), km: kmOuVide(x?.km), quantite: energie && q > 0 ? arrondi(q, 3) : '', plein: energie ? !!x?.plein : false, oubli: energie ? !!x?.oubli : false };
  }
  function normaliserReglages(r, dv) {
    r = r || {};
    return {
      alerteJours: entier(r.alerteJours, 0, 365, dv.alerteJours), alerteKm: entier(r.alerteKm, 0, 50000, dv.alerteKm),
      releveAncienJours: entier(r.releveAncienJours, 7, 730, dv.releveAncienJours),
      ctPremierMois: entier(r.ctPremierMois, 0, 240, dv.ctPremierMois), ctPeriodiqueMois: entier(r.ctPeriodiqueMois, 0, 240, dv.ctPeriodiqueMois),
      ctContreVisiteMois: entier(r.ctContreVisiteMois, 1, 24, dv.ctContreVisiteMois), ctVerifieLe: dateOuNull(r.ctVerifieLe) || dv.ctVerifieLe,
    };
  }
  function etatVide(base) {
    return { version: 1, reglages: normaliserReglages({}, base.reglages), vehicules: [], releves: [], entretiens: [], controles: [], depenses: [] };
  }
  function normaliser(d, base) {
    const v = etatVide(base);
    if (!d || typeof d !== 'object') return v;
    const liste = (l, f) => (Array.isArray(l) ? l : []).map(f);
    return {
      ...v, ...d,
      reglages: normaliserReglages(d.reglages, base.reglages),
      vehicules: liste(d.vehicules, (x) => normaliserVehicule(x, base)),
      releves: liste(d.releves, normaliserReleve),
      entretiens: liste(d.entretiens, normaliserEntretien),
      controles: liste(d.controles, normaliserControle),
      depenses: liste(d.depenses, (x) => normaliserDepense(x, base)),
    };
  }
  // Suppression d'une voiture et de tout ce qui la concerne.
  function supprimerVehicule(etat, id) {
    const garde = (l) => (l || []).filter((x) => x.vehiculeId !== id);
    return { ...etat, vehicules: etat.vehicules.filter((v) => v.id !== id), releves: garde(etat.releves), entretiens: garde(etat.entretiens), controles: garde(etat.controles), depenses: garde(etat.depenses) };
  }
  // Taille en octets de l'état sérialisé (le service accepte environ 900 000 octets par compte).
  const taille = (etat) => new TextEncoder().encode(JSON.stringify(etat)).length;

  g.CAR = {
    iso, versDate, ajout, ecart, estDate, dateFr, ajoutMois, arrondi, nombre, lireNombre, immat, plat,
    energieDe, thermique, categoriesEnergie, UNITE,
    pointsKm, kmActuel, dernierReleve, rythme, kmA, verifierReleve, planDefaut, echeanceEntretien, echeanceCT, etatDate,
    consommation, lignesCout, couts, coutsParMois, syntheseVehicule, alertes, historique, texteHistorique,
    champCsv, versCsv, csvJournal, nouvelId, normaliserOp, normaliserVehicule, normaliserReleve, normaliserEntretien,
    normaliserControle, normaliserDepense, normaliserReglages, etatVide, normaliser, supprimerVehicule, taille,
  };
})(typeof window !== 'undefined' ? window : globalThis);
