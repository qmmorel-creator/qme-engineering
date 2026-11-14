// Calendrier du potager QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.PTG) et par les tests Node (outils/templates/potager.test.mjs).
// Dates locales « AAAA-MM-JJ ». Tout ce qui dépend du jour présent reçoit `auj` : rien n'est lu dans l'horloge ici.
//
// L'année est découpée en 24 quinzaines : q = 2 × mois + 0 (du 1er au 15) ou 1 (du 16 à la fin du mois).
// Chaque culture porte jusqu'à quatre fenêtres saisies par le jardinier (semis sous abri, semis en pleine terre,
// plantation, récolte), chacune { de, a } en quinzaines incluses ; a < de veut dire que la fenêtre passe l'hiver
// (de novembre à mars, par exemple). Un décalage en semaines, réglé par le jardinier pour sa région ou son
// jardin, décale toutes les dates réelles. Aucune période n'est fournie par l'outil.
(function (g) {
  'use strict';

  // ---------- Dates ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = String(s).slice(0, 10).split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  const annee = (s) => Number(String(s).slice(0, 4));
  const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const INITIALES = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  const dateFr = (s) => { const d = versDate(s); return `${d.getDate() === 1 ? '1er' : d.getDate()} ${MOIS[d.getMonth()]}`; };
  const dateFrLongue = (s) => { const d = versDate(s); return `${JOURS[d.getDay()]} ${d.getDate() === 1 ? '1er' : d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`; };
  const dateCourte = (s) => { const d = versDate(s); return `${deux(d.getDate())}/${deux(d.getMonth() + 1)}`; };
  const plat = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36).slice(-5)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const nombreFr = (n, dec = 2) => String(Math.round((Number(n) || 0) * 10 ** dec) / 10 ** dec).replace('.', ',');
  const entier = (v, min, max, defaut) => { const n = Math.round(Number(v)); return Number.isFinite(n) && String(v ?? '').trim() !== '' ? Math.min(max, Math.max(min, n)) : defaut; };

  // Lundi et dimanche de la semaine d'une date ; premier et dernier jour du mois.
  function semaine(auj) { const d = versDate(auj); const recul = (d.getDay() + 6) % 7; const debut = ajout(auj, -recul); return { debut, fin: ajout(debut, 6) }; }
  function mois(auj, decalageMois = 0) {
    const d = versDate(auj);
    const debut = iso(new Date(d.getFullYear(), d.getMonth() + decalageMois, 1));
    const fin = iso(new Date(d.getFullYear(), d.getMonth() + decalageMois + 1, 0));
    return { debut, fin };
  }

  // ---------- Quinzaines ----------
  const NB_Q = 24;
  const estQ = (q) => Number.isInteger(q) && q >= 0 && q < NB_Q;
  const debutQuinzaine = (an, q) => iso(new Date(an, Math.floor(q / 2), q % 2 ? 16 : 1));
  const finQuinzaine = (an, q) => iso(q % 2 ? new Date(an, Math.floor(q / 2) + 1, 0) : new Date(an, Math.floor(q / 2), 15));
  const milieuQuinzaine = (an, q) => iso(new Date(an, Math.floor(q / 2), q % 2 ? 23 : 8));
  const quinzaineDe = (s) => { const d = versDate(s); return d.getMonth() * 2 + (d.getDate() > 15 ? 1 : 0); };
  // « début mars » (1–15) ou « fin mars » (16 à la fin du mois) ; libellé long pour les listes de choix.
  const nomQuinzaine = (q) => `${q % 2 ? 'fin' : 'début'} ${MOIS[Math.floor(q / 2)]}`;
  const libelleQuinzaine = (q) => `${q % 2 ? '16' : '1er'}–${q % 2 ? 'fin' : '15'} ${MOIS[Math.floor(q / 2)]}`;
  const dureeFenetre = (f) => (f.a >= f.de ? f.a - f.de + 1 : NB_Q - f.de + f.a + 1);
  const passeAnnee = (f) => f.a < f.de;
  function texteFenetre(f) {
    if (!f) return '';
    if (f.de === f.a) return nomQuinzaine(f.de);
    // Même mois : « mars », sinon « de début mars à fin avril ».
    if (Math.floor(f.de / 2) === Math.floor(f.a / 2) && f.de % 2 === 0) return `tout ${MOIS[Math.floor(f.de / 2)]}`;
    return `de ${nomQuinzaine(f.de)} à ${nomQuinzaine(f.a)}${passeAnnee(f) ? ' (l\'année suivante)' : ''}`;
  }
  function normaliserFenetre(f) {
    if (!f || typeof f !== 'object') return null;
    const de = Number(f.de), a = Number(f.a);
    return estQ(de) && estQ(a) ? { de, a } : null;
  }

  // Intervalle réel d'une fenêtre commencée l'année `an`, décalé de `decalage` semaines.
  function occurrence(f, an, decalage = 0) {
    const debut = debutQuinzaine(an, f.de);
    const fin = finQuinzaine(passeAnnee(f) ? an + 1 : an, f.a);
    const j = (Number(decalage) || 0) * 7;
    return { debut: ajout(debut, j), fin: ajout(fin, j), anneeDebut: an };
  }
  const chevauche = (a, b) => a.debut <= b.fin && b.debut <= a.fin;
  const contient = (o, d) => o.debut <= d && d <= o.fin;
  // Occurrences qui recoupent une période (fenêtres commencées entre l'année d'avant et l'année d'après).
  function occurrencesSur(f, periode, decalage = 0) {
    if (!f) return [];
    const r = [];
    for (let an = annee(periode.debut) - 1; an <= annee(periode.fin) + 1; an += 1) {
      const o = occurrence(f, an, decalage);
      if (chevauche(o, periode)) r.push(o);
    }
    return r;
  }
  // Frise d'une année : pour chacune des 24 cases, la fenêtre (décalée) contient-elle le jour médian de la case ?
  function frise(f, an, decalage = 0) {
    const cases = Array(NB_Q).fill(false);
    if (!f) return cases;
    for (let q = 0; q < NB_Q; q += 1) {
      const m = milieuQuinzaine(an, q);
      cases[q] = occurrencesSur(f, { debut: m, fin: m }, decalage).length > 0;
    }
    return cases;
  }

  // ---------- Accès ----------
  const OPS = ['semisAbri', 'semisPleine', 'plantation', 'recolte'];
  const cultureDe = (etat, id) => (etat.cultures || []).find((c) => c.id === id) || null;
  const parcelleDe = (etat, id) => (etat.parcelles || []).find((p) => p.id === id) || null;
  const familleDe = (base, code) => (base.familles || []).find((f) => f.code === code) || null;
  const operationDe = (base, code) => (base.operations || []).find((o) => o.code === code) || null;
  const aDesFenetres = (c) => OPS.some((k) => c.fenetres?.[k]);

  // L'entrée du journal `e` marque-t-elle l'opération `op` de la culture comme faite ?
  function correspond(e, op, cultureId) {
    if (e.culture !== cultureId) return false;
    if (op === 'semisAbri') return e.type === 'semis' && e.lieu !== 'pleine';
    if (op === 'semisPleine') return e.type === 'semis' && e.lieu !== 'abri';
    if (op === 'plantation') return e.type === 'plantation' || e.type === 'repiquage';
    return false;
  }
  // Entrée du journal qui fait l'opération dans cette occurrence (la plus récente), ou null.
  function faitDans(etat, cultureId, op, occ) {
    const l = (etat.journal || []).filter((e) => correspond(e, op, cultureId) && contient(occ, e.date)).sort((x, y) => y.date.localeCompare(x.date));
    return l[0] || null;
  }
  function recoltes(etat, cultureId, depuis) {
    return (etat.journal || []).filter((e) => e.type === 'recolte' && e.culture === cultureId && (!depuis || e.date >= depuis)).sort((x, y) => y.date.localeCompare(x.date));
  }

  // À faire sur une période : une ligne par culture, opération et occurrence qui recoupent la période.
  // etat : commence (début dans la période), finit (fin dans la période), encours, ou aVenir (début après auj).
  function aFaire(etat, periode, auj) {
    const dec = etat.reglages?.decalage || 0;
    const r = [];
    for (const c of etat.cultures || []) {
      for (const op of OPS) {
        for (const o of occurrencesSur(c.fenetres?.[op], periode, dec)) {
          const fait = op === 'recolte' ? null : faitDans(etat, c.id, op, o);
          const derniere = op === 'recolte' ? recoltes(etat, c.id, o.debut)[0] || null : null;
          let moment = 'encours';
          if (o.debut > auj) moment = 'aVenir';
          else if (contient(periode, o.debut)) moment = 'commence';
          else if (contient(periode, o.fin)) moment = 'finit';
          r.push({ culture: c.id, op, occurrence: o, moment, fait, derniere, joursRestants: ecart(auj, o.fin) });
        }
      }
    }
    return r.sort((x, y) => (x.fait ? 1 : 0) - (y.fait ? 1 : 0) || OPS.indexOf(x.op) - OPS.indexOf(y.op) || x.occurrence.fin.localeCompare(y.occurrence.fin));
  }
  // Fenêtres de semis ou de plantation terminées depuis `jours` jours au plus (3 semaines), sans rien noter au journal.
  function passees(etat, auj, jours = 21) {
    const periode = { debut: ajout(auj, -jours), fin: ajout(auj, -1) };
    const dec = etat.reglages?.decalage || 0;
    const r = [];
    for (const c of etat.cultures || []) {
      for (const op of OPS.slice(0, 3)) {
        for (const o of occurrencesSur(c.fenetres?.[op], periode, dec)) {
          if (contient(periode, o.fin) && !faitDans(etat, c.id, op, o)) r.push({ culture: c.id, op, occurrence: o, depuis: ecart(o.fin, auj) });
        }
      }
    }
    return r.sort((x, y) => x.depuis - y.depuis);
  }
  // Tableau de bord de la semaine : compteurs non faits.
  function compteSemaine(etat, auj) {
    const l = aFaire(etat, semaine(auj), auj);
    const nf = l.filter((x) => !x.fait);
    return {
      semer: nf.filter((x) => x.op === 'semisAbri' || x.op === 'semisPleine').length,
      planter: nf.filter((x) => x.op === 'plantation').length,
      recolter: nf.filter((x) => x.op === 'recolte').length,
      passees: passees(etat, auj).length,
      faits: l.filter((x) => x.fait).length,
      total: l.length,
    };
  }

  // ---------- Parcelles, rotation, associations ----------
  const placementsDe = (etat, parcelleId, an) => (etat.placements || []).filter((p) => p.parcelle === parcelleId && p.annee === an);
  // Même famille sur la même parcelle dans les `rotation` années précédentes.
  function alertesRotation(etat, placement) {
    const c = cultureDe(etat, placement.culture);
    if (!c || !c.famille) return [];
    const n = etat.reglages?.rotation || 1;
    const r = [];
    for (const p of etat.placements || []) {
      if (p.id === placement.id || p.parcelle !== placement.parcelle) continue;
      if (p.annee >= placement.annee || p.annee < placement.annee - n) continue;
      const autre = cultureDe(etat, p.culture);
      if (autre && autre.famille === c.famille) r.push({ type: 'rotation', annee: p.annee, culture: autre.id, famille: c.famille });
    }
    return r.sort((x, y) => y.annee - x.annee);
  }
  // Relation lue dans les deux sens : l'une des deux cultures a noté l'autre.
  const relation = (a, b, cle) => (a[cle] || []).includes(b.id) || (b[cle] || []).includes(a.id);
  function voisinage(etat, placement) {
    const c = cultureDe(etat, placement.culture);
    const r = { eloigner: [], amis: [] };
    if (!c) return r;
    for (const p of placementsDe(etat, placement.parcelle, placement.annee)) {
      if (p.id === placement.id || p.culture === c.id) continue;
      const autre = cultureDe(etat, p.culture);
      if (!autre) continue;
      if (relation(c, autre, 'eloigner')) r.eloigner.push(autre.id);
      else if (relation(c, autre, 'amis')) r.amis.push(autre.id);
    }
    return r;
  }
  // Toutes les alertes d'une année : rotation et cultures à éloigner, par placement.
  function alertesAnnee(etat, an) {
    const r = [];
    for (const p of (etat.placements || []).filter((x) => x.annee === an)) {
      for (const a of alertesRotation(etat, p)) r.push({ ...a, placement: p.id, parcelle: p.parcelle, cultureEnCause: p.culture });
      for (const autre of voisinage(etat, p).eloigner) {
        // Une seule alerte par paire.
        if (!r.some((x) => x.type === 'eloigner' && x.parcelle === p.parcelle && x.cultureEnCause === autre && x.culture === p.culture)) r.push({ type: 'eloigner', placement: p.id, parcelle: p.parcelle, cultureEnCause: p.culture, culture: autre });
      }
    }
    return r;
  }
  // Années à proposer : de la plus ancienne saisie à l'an prochain.
  function annees(etat, auj) {
    const a = annee(auj);
    const toutes = [...(etat.placements || []).map((p) => p.annee), ...(etat.journal || []).map((e) => annee(e.date)), a, a + 1];
    const min = Math.min(...toutes), max = Math.max(...toutes);
    const r = [];
    for (let x = max; x >= min; x -= 1) r.push(x);
    return r;
  }
  // Familles sur une parcelle, par année (les plus récentes d'abord).
  function historiqueParcelle(etat, parcelleId) {
    const parAn = new Map();
    for (const p of (etat.placements || []).filter((x) => x.parcelle === parcelleId)) {
      const c = cultureDe(etat, p.culture);
      if (!parAn.has(p.annee)) parAn.set(p.annee, new Set());
      if (c?.famille) parAn.get(p.annee).add(c.famille);
    }
    return [...parAn.entries()].sort((x, y) => y[0] - x[0]).map(([an, f]) => ({ annee: an, familles: [...f] }));
  }

  // ---------- Bilan des récoltes ----------
  // Poids en kg (g convertis) ; pièces, bottes et litres comptés à part.
  function versKg(e) { if (e.unite === 'kg') return e.quantite; if (e.unite === 'g') return e.quantite / 1000; return 0; }
  function bilan(etat, an) {
    const l = (etat.journal || []).filter((e) => e.type === 'recolte' && annee(e.date) === an);
    const parCulture = new Map();
    const parMois = Array(12).fill(0);
    const autres = { piece: 0, botte: 0, litre: 0 };
    let kg = 0;
    for (const e of l) {
      const k = versKg(e);
      kg += k;
      parMois[versDate(e.date).getMonth()] += k;
      if (autres[e.unite] !== undefined) autres[e.unite] += e.quantite;
      const x = parCulture.get(e.culture) || { culture: e.culture, nb: 0, kg: 0, piece: 0, botte: 0, litre: 0 };
      x.nb += 1; x.kg += k;
      if (x[e.unite] !== undefined && e.unite !== 'kg' && e.unite !== 'g') x[e.unite] += e.quantite;
      parCulture.set(e.culture, x);
    }
    const kgAvant = (etat.journal || []).filter((e) => e.type === 'recolte' && annee(e.date) === an - 1).reduce((s, e) => s + versKg(e), 0);
    const arr = (n) => Math.round(n * 1000) / 1000;
    return {
      nb: l.length, kg: arr(kg), kgAvant: arr(kgAvant), autres,
      parMois: parMois.map(arr),
      parCulture: [...parCulture.values()].map((x) => ({ ...x, kg: arr(x.kg) })).sort((x, y) => y.kg - x.kg || y.nb - x.nb),
    };
  }

  // ---------- Saisies ----------
  function ajouterAuJournal(etat, entree) {
    const e = normaliserEntree({ ...entree, id: entree.id || nouvelId() });
    return { etat: { ...etat, journal: [...(etat.journal || []), e] }, entree: e };
  }
  function placer(etat, { parcelle, culture, annee: an, note }) {
    if (!parcelleDe(etat, parcelle) || !cultureDe(etat, culture)) return { etat, ajoute: false };
    if (placementsDe(etat, parcelle, an).some((p) => p.culture === culture)) return { etat, ajoute: false, doublon: true };
    const p = normaliserPlacement({ id: nouvelId(), parcelle, culture, annee: an, note });
    return { etat: { ...etat, placements: [...(etat.placements || []), p] }, ajoute: true, placement: p };
  }
  const impactCulture = (etat, id) => ({
    journal: (etat.journal || []).filter((e) => e.culture === id).length,
    placements: (etat.placements || []).filter((p) => p.culture === id).length,
  });
  // Supprimer une culture retire ses placements et la retire des voisinages ; le journal garde son nom.
  function supprimerCulture(etat, id) {
    const c = cultureDe(etat, id);
    if (!c) return etat;
    return {
      ...etat,
      cultures: etat.cultures.filter((x) => x.id !== id).map((x) => ({ ...x, amis: x.amis.filter((y) => y !== id), eloigner: x.eloigner.filter((y) => y !== id) })),
      placements: etat.placements.filter((p) => p.culture !== id),
      journal: etat.journal.map((e) => (e.culture === id ? { ...e, culture: '', nomCulture: e.nomCulture || c.nom } : e)),
    };
  }
  function supprimerParcelle(etat, id) {
    return { ...etat, parcelles: etat.parcelles.filter((p) => p.id !== id), placements: etat.placements.filter((p) => p.parcelle !== id), journal: etat.journal.map((e) => (e.parcelle === id ? { ...e, parcelle: '' } : e)) };
  }
  function purgerAvant(etat, date) {
    const garde = (etat.journal || []).filter((e) => e.date >= date);
    return { etat: { ...etat, journal: garde }, retires: (etat.journal || []).length - garde.length };
  }
  function rechercherLegume(base, q) {
    const p = plat(q);
    if (!p) return [];
    return base.legumes.filter(([, nom]) => plat(nom).split(/[\s'-]+/).some((m) => m.startsWith(p)) || plat(nom).startsWith(p)).slice(0, 8);
  }

  // ---------- CSV ----------
  function champCsv(v) {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
  const versCsv = (lignes) => `﻿${lignes.map((l) => l.map(champCsv).join(';')).join('\r\n')}\r\n`;
  function csvCultures(etat, base) {
    const t = [['Culture', 'Variété', 'Famille', ...base.operations.map((o) => o.nom), 'Bons voisins', 'À éloigner', 'Note']];
    const noms = (ids) => ids.map((i) => cultureDe(etat, i)?.nom).filter(Boolean).join(', ');
    for (const c of etat.cultures) t.push([c.nom, c.variete, familleDe(base, c.famille)?.nom || '', ...OPS.map((k) => texteFenetre(c.fenetres[k])), noms(c.amis), noms(c.eloigner), c.note]);
    return versCsv(t);
  }
  function csvJournal(etat, base) {
    const types = Object.fromEntries(base.typesJournal);
    const unites = Object.fromEntries(base.unites);
    const lieux = Object.fromEntries(base.lieuxSemis);
    const t = [['Date', 'Opération', 'Culture', 'Parcelle', 'Lieu du semis', 'Quantité', 'Unité', 'Note']];
    for (const e of [...etat.journal].sort((x, y) => x.date.localeCompare(y.date))) {
      t.push([e.date, types[e.type] || e.type, cultureDe(etat, e.culture)?.nom || e.nomCulture || '', parcelleDe(etat, e.parcelle)?.nom || '', lieux[e.lieu] || '', e.quantite ? nombreFr(e.quantite, 3) : '', e.quantite ? unites[e.unite] || '' : '', e.note]);
    }
    return versCsv(t);
  }
  function csvParcelles(etat, base) {
    const t = [['Année', 'Parcelle', 'Type', 'Culture', 'Famille', 'Alerte']];
    const al = new Map();
    for (const an of new Set(etat.placements.map((p) => p.annee))) for (const a of alertesAnnee(etat, an)) al.set(a.placement, a.type === 'rotation' ? `même famille en ${a.annee}` : `à éloigner de ${cultureDe(etat, a.culture)?.nom || ''}`);
    for (const p of [...etat.placements].sort((x, y) => x.annee - y.annee || (parcelleDe(etat, x.parcelle)?.nom || '').localeCompare(parcelleDe(etat, y.parcelle)?.nom || ''))) {
      const pa = parcelleDe(etat, p.parcelle), c = cultureDe(etat, p.culture);
      t.push([p.annee, pa?.nom || '', base.typesParcelle[pa?.type] || '', c?.nom || '', familleDe(base, c?.famille)?.nom || '', al.get(p.id) || '']);
    }
    return versCsv(t);
  }

  // ---------- Normalisation ----------
  const texte = (v, n) => String(v ?? '').trim().slice(0, n);
  const ids = (l) => (Array.isArray(l) ? [...new Set(l.map(String).filter(Boolean))] : []);
  function normaliserCulture(c) {
    const f = c?.fenetres || {};
    return {
      id: String(c?.id || nouvelId()), nom: texte(c?.nom, 60) || 'Culture', variete: texte(c?.variete, 60), famille: texte(c?.famille, 40),
      base: texte(c?.base, 40),
      fenetres: Object.fromEntries(OPS.map((k) => [k, normaliserFenetre(f[k])])),
      amis: ids(c?.amis), eloigner: ids(c?.eloigner), note: texte(c?.note, 300),
    };
  }
  function normaliserParcelle(p) {
    const s = Number(String(p?.surface ?? '').replace(',', '.'));
    return { id: String(p?.id || nouvelId()), nom: texte(p?.nom, 60) || 'Parcelle', type: ['planche', 'carre', 'serre', 'bac', 'autre'].includes(p?.type) ? p.type : 'planche', surface: Number.isFinite(s) && s > 0 ? Math.round(s * 100) / 100 : 0, note: texte(p?.note, 200) };
  }
  function normaliserPlacement(p) {
    return { id: String(p?.id || nouvelId()), parcelle: String(p?.parcelle || ''), culture: String(p?.culture || ''), annee: entier(p?.annee, 1900, 2200, new Date().getFullYear()), note: texte(p?.note, 200) };
  }
  const TYPES_J = ['semis', 'levee', 'repiquage', 'plantation', 'recolte', 'note'];
  function normaliserEntree(e) {
    const q = Number(String(e?.quantite ?? '').replace(',', '.'));
    const type = TYPES_J.includes(e?.type) ? e.type : 'note';
    return {
      id: String(e?.id || nouvelId()), date: estDate(e?.date) ? e.date : '', type,
      culture: String(e?.culture || ''), nomCulture: texte(e?.nomCulture, 60), parcelle: String(e?.parcelle || ''),
      lieu: type === 'semis' && ['abri', 'pleine'].includes(e?.lieu) ? e.lieu : '',
      quantite: type === 'recolte' && Number.isFinite(q) && q > 0 ? Math.round(q * 1000) / 1000 : 0,
      unite: ['kg', 'g', 'piece', 'botte', 'litre'].includes(e?.unite) ? e.unite : 'kg',
      note: texte(e?.note, 300),
    };
  }
  function normaliserReglages(r) {
    return { jardin: texte(r?.jardin, 60), decalage: entier(r?.decalage, -8, 8, 0), rotation: entier(r?.rotation, 1, 5, 1) };
  }
  // État de départ : cultures choisies dans la base (sans fenêtre), et `nbPlanches` planches numérotées.
  function etatVide(base, codes = [], nbPlanches = 0) {
    const cultures = codes.map((code) => base.legumes.find(([c]) => c === code)).filter(Boolean).map(([code, nom, , famille]) => normaliserCulture({ id: nouvelId(), nom, famille, base: code }));
    const parcelles = Array.from({ length: entier(nbPlanches, 0, 12, 0) }, (_, i) => normaliserParcelle({ id: nouvelId(), nom: `Planche ${i + 1}`, type: 'planche' }));
    return { version: 1, reglages: normaliserReglages({}), cultures, parcelles, placements: [], journal: [] };
  }
  function normaliser(d, base) {
    const v = etatVide(base);
    if (!d || typeof d !== 'object') return v;
    const liste = (l, f) => (Array.isArray(l) ? l.map(f) : []);
    const cultures = liste(d.cultures, normaliserCulture);
    const connues = new Set(cultures.map((c) => c.id));
    for (const c of cultures) { c.amis = c.amis.filter((i) => connues.has(i) && i !== c.id); c.eloigner = c.eloigner.filter((i) => connues.has(i) && i !== c.id); }
    return {
      ...v, ...d,
      reglages: normaliserReglages(d.reglages),
      cultures,
      parcelles: liste(d.parcelles, normaliserParcelle),
      placements: liste(d.placements, normaliserPlacement).filter((p) => p.parcelle && p.culture),
      journal: liste(d.journal, normaliserEntree).filter((e) => e.date),
    };
  }
  const taille = (etat) => new TextEncoder().encode(JSON.stringify(etat)).length;

  function validerCulture(etat, c, nomSaisi) {
    if (!String(nomSaisi ?? c.nom ?? '').trim()) return 'Donne un nom à la culture.';
    const meme = (etat.cultures || []).find((x) => x.id !== c.id && plat(x.nom) === plat(c.nom) && plat(x.variete) === plat(c.variete));
    if (meme) return `« ${c.nom}${c.variete ? ` ${c.variete}` : ''} » existe déjà : ajoute une variété pour les distinguer.`;
    return '';
  }
  function validerEntree(etat, e) {
    if (!e.date) return 'Choisis une date.';
    if (e.type !== 'note' && !e.culture) return 'Choisis la culture concernée.';
    if (e.type === 'recolte' && e.quantite < 0) return 'Quantité invalide.';
    return '';
  }

  g.PTG = {
    deux, iso, versDate, ajout, ecart, estDate, annee, JOURS, MOIS, MOIS_COURTS, INITIALES, dateFr, dateFrLongue, dateCourte, plat, nouvelId, nombreFr, entier,
    semaine, mois, NB_Q, OPS, debutQuinzaine, finQuinzaine, milieuQuinzaine, quinzaineDe, nomQuinzaine, libelleQuinzaine, dureeFenetre, passeAnnee, texteFenetre, normaliserFenetre,
    occurrence, occurrencesSur, chevauche, contient, frise,
    cultureDe, parcelleDe, familleDe, operationDe, aDesFenetres, correspond, faitDans, recoltes, aFaire, passees, compteSemaine,
    placementsDe, alertesRotation, voisinage, alertesAnnee, annees, historiqueParcelle,
    versKg, bilan, ajouterAuJournal, placer, impactCulture, supprimerCulture, supprimerParcelle, purgerAvant, rechercherLegume,
    champCsv, versCsv, csvCultures, csvJournal, csvParcelles,
    normaliserCulture, normaliserParcelle, normaliserPlacement, normaliserEntree, normaliserReglages, etatVide, normaliser, taille, validerCulture, validerEntree,
  };
})(typeof window !== 'undefined' ? window : globalThis);
