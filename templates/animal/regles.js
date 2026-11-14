// Suivi d'un animal de compagnie QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.ANM) et par les tests Node (outils/templates/animal.test.mjs).
// Dates locales « AAAA-MM-JJ » (comparables comme des chaînes) ; toutes les fonctions qui dépendent du jour
// reçoivent la date de référence `auj`. Aucune règle vétérinaire : les intervalles viennent de la saisie.
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

  // ---------- Intervalles saisis ----------
  const UNITES = [['jours', 'jour', 'jours'], ['semaines', 'semaine', 'semaines'], ['mois', 'mois', 'mois'], ['ans', 'an', 'ans']];
  // Date + intervalle { valeur, unite } ; null si l'intervalle est vide.
  function ajoutIntervalle(s, valeur, unite) {
    const v = Number(valeur);
    if (!estDate(s) || !Number.isFinite(v) || v <= 0) return null;
    if (unite === 'jours') return ajout(s, v);
    if (unite === 'semaines') return ajout(s, v * 7);
    if (unite === 'ans') return ajoutMois(s, v * 12);
    return ajoutMois(s, v);
  }
  function texteIntervalle(valeur, unite) {
    const v = Number(valeur);
    if (!(v > 0)) return '';
    const f = unite === 'semaines' ? 'toutes les' : 'tous les';
    const nom = unite === 'jours' ? 'jours' : unite === 'semaines' ? 'semaines' : unite === 'ans' ? 'ans' : 'mois';
    return v === 1 ? `${f} ${nom}` : `${f} ${v} ${nom}`;
  }

  // ---------- Nombres et textes ----------
  const arrondi = (n, d = 2) => Math.round((n + Number.EPSILON) * 10 ** d) / 10 ** d;
  const nombre = (v) => { const n = Number(String(v ?? '').replace(/[\s  ]/g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
  // « 1 234,5 » → 1234.5 ; null si vide ou illisible (jamais négatif).
  function lireNombre(saisie) {
    const s = String(saisie ?? '').replace(/[\s  ]/g, '').replace(',', '.');
    if (!s || !/^\d+(\.\d{0,3})?$/.test(s)) return null;
    return Number(s);
  }
  // Poids saisi en kg (« 4,25 », « 4.25 kg ») ou en g (« 850 g ») → kg ; null si illisible ou invraisemblable.
  function lirePoids(saisie) {
    const s = String(saisie ?? '').toLowerCase().replace(/[\s  ]/g, '');
    const g2 = /^(\d+(?:[.,]\d{0,3})?)g$/.exec(s);
    const kg = /^(\d+(?:[.,]\d{0,3})?)(kg)?$/.exec(s);
    const n = g2 ? Number(g2[1].replace(',', '.')) / 1000 : kg ? Number(kg[1].replace(',', '.')) : NaN;
    return Number.isFinite(n) && n > 0 && n <= 150 ? arrondi(n, 3) : null;
  }
  const plat = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  // ---------- Âge ----------
  // Âge révolu à `auj` : { ans, mois, jours } ; null si naissance inconnue ou future.
  function age(naissance, auj) {
    if (!estDate(naissance) || !estDate(auj) || naissance > auj) return null;
    let m = 0;
    while (ajoutMois(naissance, m + 1) <= auj) m++;
    return { ans: Math.floor(m / 12), mois: m % 12, jours: ecart(ajoutMois(naissance, m), auj) };
  }
  function texteAge(a) {
    if (!a) return '';
    const p = (n, s, pl) => `${n} ${n > 1 ? pl : s}`;
    if (a.ans >= 2) return a.mois ? `${p(a.ans, 'an', 'ans')} et ${a.mois} mois` : p(a.ans, 'an', 'ans');
    const m = a.ans * 12 + a.mois;
    if (m >= 1) return `${m} mois`;
    return p(a.jours, 'jour', 'jours');
  }

  // ---------- Soins récurrents ----------
  // Faits d'un soin, du plus récent au plus ancien.
  const faitsDe = (faits, soinId) => (faits || []).filter((f) => f.soinId === soinId && estDate(f.date)).sort((a, b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id)));

  // Échéance d'un soin. Référence = dernier soin fait, sinon « dernière fois connue » du soin.
  // Prochaine échéance = date inscrite par le vétérinaire sur ce dernier soin fait (prioritaire), sinon
  // référence + intervalle saisi ; sans soin fait, « prochaine date connue » du soin, sinon référence + intervalle.
  // États : retard (date passée), proche (dans la fenêtre d'alerte), ok, sans (aucune échéance calculable).
  function echeanceSoin(soin, faits, auj, alerteJours) {
    const liste = faitsDe(faits, soin.id);
    const dernierFait = liste[0] || null;
    const ref = dernierFait ? dernierFait.date : (estDate(soin.depuis) ? soin.depuis : null);
    let prochaine = null, origine = null;
    if (dernierFait && estDate(dernierFait.prochaine) && dernierFait.prochaine > dernierFait.date) { prochaine = dernierFait.prochaine; origine = 'veterinaire'; }
    else if (!dernierFait && estDate(soin.prochaine) && (!ref || soin.prochaine > ref)) { prochaine = soin.prochaine; origine = 'saisie'; }
    else if (ref) { prochaine = ajoutIntervalle(ref, soin.intervalle, soin.unite); origine = prochaine ? 'intervalle' : null; }
    const jours = prochaine ? ecart(auj, prochaine) : null;
    let etat = 'sans';
    if (prochaine) etat = jours < 0 ? 'retard' : jours <= alerteJours ? 'proche' : 'ok';
    if (soin.actif === false) etat = 'pause';
    return { soin, dernier: ref, dernierFait, nombre: liste.length, prochaine, origine, jours, etat };
  }

  // ---------- Poids ----------
  const pesees = (etat, animalId) => (etat.pesees || []).filter((p) => p.animalId === animalId && estDate(p.date) && p.poids > 0)
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.id).localeCompare(String(b.id)));
  // Poids à une date passée : dernière pesée à cette date ou avant ; null s'il n'y en a pas.
  const poidsAu = (liste, date) => { const l = liste.filter((p) => p.date <= date); return l.length ? l.at(-1).poids : null; };
  // Statistiques factuelles (aucune interprétation) : dernière pesée, écart avec la précédente et avec
  // la pesée connue 90 jours plus tôt, minimum et maximum.
  function statsPoids(liste, auj) {
    const l = liste.filter((p) => p.date <= auj);
    if (!l.length) return { nombre: 0, dernier: null, precedent: null, variation: null, variationPct: null, sur90: null, min: null, max: null };
    const dernier = l.at(-1), precedent = l.length > 1 ? l.at(-2) : null;
    const variation = precedent ? arrondi(dernier.poids - precedent.poids, 3) : null;
    const p90 = poidsAu(l, ajout(dernier.date, -90));
    return {
      nombre: l.length, dernier, precedent, variation,
      variationPct: precedent ? arrondi((dernier.poids - precedent.poids) / precedent.poids * 100, 1) : null,
      sur90: p90 === null ? null : arrondi(dernier.poids - p90, 3),
      min: Math.min(...l.map((p) => p.poids)), max: Math.max(...l.map((p) => p.poids)),
    };
  }

  // ---------- Frais ----------
  const typeDe = (base, code) => base.types.find((t) => t.code === code) || base.types.at(-1);
  // Lignes de frais : dépenses saisies + coût des soins faits + coût des visites vétérinaires.
  function lignesFrais(etat, base) {
    const l = [];
    const soin = (id) => (etat.soins || []).find((s) => s.id === id);
    for (const d of etat.depenses || []) l.push({ date: d.date, animalId: d.animalId, categorie: d.categorie, montant: nombre(d.montant), libelle: d.libelle || '', source: 'depense', id: d.id });
    for (const f of etat.faits || []) {
      if (!(nombre(f.cout) > 0)) continue;
      const s = soin(f.soinId);
      l.push({ date: f.date, animalId: f.animalId, categorie: typeDe(base, s?.type).categorie, montant: nombre(f.cout), libelle: s?.nom || 'Soin', source: 'fait', id: f.id });
    }
    for (const v of etat.visites || []) if (nombre(v.cout) > 0) l.push({ date: v.date, animalId: v.animalId, categorie: 'VET', montant: nombre(v.cout), libelle: v.motif || 'Visite', source: 'visite', id: v.id });
    return l.filter((x) => estDate(x.date)).sort((a, b) => b.date.localeCompare(a.date));
  }
  // animalId : un animal ; '' ou null : tous (dépenses communes comprises) ; 'commun' : dépenses communes seules.
  const pour = (x, animalId) => !animalId || (animalId === 'commun' ? !x.animalId : x.animalId === animalId);

  // Frais du `du` au `au` inclus : total, par catégorie, coût mensuel moyen (mois de la période, 1 au moins).
  function frais(etat, base, animalId, du, au) {
    const lignes = lignesFrais(etat, base).filter((x) => pour(x, animalId) && x.date >= du && x.date <= au);
    const parCategorie = {};
    for (const x of lignes) parCategorie[x.categorie] = arrondi((parCategorie[x.categorie] || 0) + x.montant);
    const total = arrondi(lignes.reduce((s, x) => s + x.montant, 0));
    const debut = lignes.length ? [du, lignes.at(-1).date].sort().at(-1) : du;
    const mois = Math.max(1, (ecart(debut, au) + 1) / (365.25 / 12));
    return { lignes, parCategorie, total, mois: arrondi(mois, 2), coutMensuel: arrondi(total / mois) };
  }
  // Total par mois civil sur les n derniers mois (le mois en cours compris), du plus ancien au plus récent.
  function fraisParMois(etat, base, animalId, auj, n = 12) {
    const premier = ajoutMois(`${auj.slice(0, 7)}-01`, -(n - 1));
    const res = [];
    for (let k = 0; k < n; k++) res.push({ mois: ajoutMois(premier, k).slice(0, 7), total: 0 });
    for (const x of lignesFrais(etat, base)) {
      if (!pour(x, animalId) || x.date > auj) continue;
      const r = res.find((m) => m.mois === x.date.slice(0, 7));
      if (r) r.total = arrondi(r.total + x.montant);
    }
    return res;
  }
  // Total par année civile (de la plus ancienne à la plus récente, années vides comprises).
  function fraisParAn(etat, base, animalId, auj) {
    const l = lignesFrais(etat, base).filter((x) => pour(x, animalId) && x.date <= auj);
    if (!l.length) return [];
    const a0 = Number(l.at(-1).date.slice(0, 4)), a1 = Number(auj.slice(0, 4));
    const res = [];
    for (let a = a0; a <= a1; a++) res.push({ annee: a, total: arrondi(l.filter((x) => Number(x.date.slice(0, 4)) === a).reduce((s, x) => s + x.montant, 0)) });
    return res;
  }
  // Coût annuel = total des 12 derniers mois (du même jour l'an passé + 1 jour à aujourd'hui).
  const coutAnnuel = (etat, base, animalId, auj) => frais(etat, base, animalId, ajout(ajoutMois(auj, -12), 1), auj).total;

  // ---------- Traitements ----------
  // Traitements notés lors des visites et encore en cours (fin saisie aujourd'hui ou après).
  const traitementsEnCours = (etat, animalId, auj) => (etat.visites || [])
    .filter((v) => (!animalId || v.animalId === animalId) && String(v.traitement || '').trim() && estDate(v.finTraitement) && v.date <= auj && v.finTraitement >= auj)
    .sort((a, b) => a.finTraitement.localeCompare(b.finTraitement));

  // ---------- Synthèse et alertes ----------
  const RANG = { retard: 0, proche: 1, ok: 2, sans: 3, pause: 4 };
  function syntheseAnimal(etat, a, auj) {
    const rg = etat.reglages;
    const soins = (etat.soins || []).filter((s) => s.animalId === a.id).map((s) => echeanceSoin(s, etat.faits, auj, rg.alerteJours))
      .sort((x, y) => RANG[x.etat] - RANG[y.etat] || (x.prochaine || '9').localeCompare(y.prochaine || '9') || x.soin.nom.localeCompare(y.soin.nom));
    const actifs = soins.filter((s) => s.etat !== 'pause');
    const pire = actifs.map((s) => s.etat).sort((x, y) => RANG[x] - RANG[y])[0] || 'ok';
    const prochain = actifs.find((s) => s.prochaine) || null;
    const lp = pesees(etat, a.id);
    return { soins, pire, prochain, pesees: lp, poids: statsPoids(lp, auj), traitements: traitementsEnCours(etat, a.id, auj), age: age(a.naissance, auj) };
  }

  // Une alerte : { type, etat: retard|proche, animalId, refId, titre, detail, date } ; retards d'abord.
  function alertes(etat, auj) {
    const rg = etat.reglages;
    const out = [];
    for (const a of (etat.animaux || []).filter((x) => x.actif !== false)) {
      const s = syntheseAnimal(etat, a, auj);
      for (const e of s.soins) {
        if (e.etat !== 'retard' && e.etat !== 'proche') continue;
        const detail = e.etat === 'retard' ? `Prévu le ${dateFr(e.prochaine)}, en retard de ${-e.jours} jour${-e.jours > 1 ? 's' : ''}` : e.jours === 0 ? 'Prévu aujourd\'hui' : `Prévu le ${dateFr(e.prochaine)}, dans ${e.jours} jour${e.jours > 1 ? 's' : ''}`;
        out.push({ type: 'soin', etat: e.etat, animalId: a.id, refId: e.soin.id, titre: e.soin.nom, detail, date: e.prochaine });
      }
      if (rg.peseeJours > 0 && s.poids.dernier) {
        const due = ajout(s.poids.dernier.date, rg.peseeJours);
        if (ecart(auj, due) <= rg.alerteJours) out.push({ type: 'pesee', etat: 'proche', animalId: a.id, refId: 'pesee', titre: 'Pesée à faire', detail: `Dernière pesée le ${dateFr(s.poids.dernier.date)} (rappel tous les ${rg.peseeJours} jours)`, date: due < auj ? auj : due });
      }
    }
    const rang = { retard: 0, proche: 1 };
    return out.sort((x, y) => rang[x.etat] - rang[y.etat] || (x.date || '').localeCompare(y.date || ''));
  }

  // ---------- Carnet imprimable ----------
  function carnet(etat, base, a, auj, { montants = false } = {}) {
    const s = syntheseAnimal(etat, a, auj);
    const nomSoin = (id) => (etat.soins || []).find((x) => x.id === id)?.nom || 'Soin';
    const historique = [];
    for (const f of etat.faits || []) if (f.animalId === a.id) historique.push({ date: f.date, type: 'Soin', detail: [nomSoin(f.soinId), f.note].filter(Boolean).join(' · '), par: f.par || '', montant: nombre(f.cout) });
    for (const v of etat.visites || []) if (v.animalId === a.id) historique.push({ date: v.date, type: 'Visite', detail: [v.motif, v.notes, v.traitement ? `Traitement noté : ${v.traitement}${estDate(v.finTraitement) ? ` (jusqu'au ${dateFr(v.finTraitement)})` : ''}` : ''].filter(Boolean).join(' · '), par: v.veterinaire || '', montant: nombre(v.cout) });
    historique.sort((x, y) => y.date.localeCompare(x.date));
    if (!montants) historique.forEach((l) => { delete l.montant; });
    return { animal: a, espece: (base.especes.find((e) => e.code === a.espece) || base.especes.at(-1)).nom, age: s.age, soins: s.soins, pesees: s.pesees.slice().reverse(), poids: s.poids, historique, traitements: s.traitements };
  }
  function texteCarnet(c, auj) {
    const a = c.animal;
    const kg = (n) => `${String(arrondi(n, 3)).replace('.', ',')} kg`;
    const t = [`Carnet de suivi · ${a.nom}`, `Arrêté le ${dateFr(auj)}`,
      [a.espece === 'autre' && a.especeAutre ? a.especeAutre : c.espece, a.race, a.sexe === 'F' ? 'femelle' : a.sexe === 'M' ? 'mâle' : '', a.naissance ? `né(e) le ${dateFr(a.naissance)}${c.age ? ` (${texteAge(c.age)})` : ''}` : ''].filter(Boolean).join(' · ')];
    if (a.identification) t.push(`Identification : ${a.identification}`);
    if (a.veterinaire) t.push(`Vétérinaire : ${a.veterinaire}`);
    t.push('', 'Soins récurrents');
    for (const e of c.soins) t.push(`- ${e.soin.nom} : dernier le ${e.dernier ? dateFr(e.dernier) : '?'}${e.prochaine ? ` · prochain le ${dateFr(e.prochaine)}` : ''}${e.etat === 'pause' ? ' · en pause' : ''}`);
    if (!c.soins.length) t.push('- Aucun soin récurrent noté.');
    t.push('', 'Poids');
    if (c.poids.dernier) t.push(`- Dernière pesée : ${kg(c.poids.dernier.poids)} le ${dateFr(c.poids.dernier.date)}${c.poids.nombre > 1 ? ` · ${c.poids.nombre} pesées, de ${kg(c.poids.min)} à ${kg(c.poids.max)}` : ''}`);
    else t.push('- Aucune pesée notée.');
    t.push('', 'Historique (soins faits et visites)');
    for (const l of c.historique) t.push(`${dateFr(l.date)} · ${l.type}${l.detail ? ` : ${l.detail}` : ''}${l.par ? ` (${l.par})` : ''}${l.montant ? ` · ${l.montant.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : ''}`);
    if (!c.historique.length) t.push('Aucun soin ni visite noté.');
    t.push('', 'Établi à partir du suivi tenu par le propriétaire. Ne remplace ni le carnet de santé ni l\'avis du vétérinaire.');
    return t.join('\n');
  }

  // ---------- Export CSV (point-virgule, BOM UTF-8, tableurs français) ----------
  function champCsv(v) {
    let s = typeof v === 'number' ? String(v).replace('.', ',') : String(v ?? '');
    if (typeof v !== 'number' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`; // formules neutralisées
    return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
  const versCsv = (lignes) => `﻿${lignes.map((l) => l.map(champCsv).join(';')).join('\r\n')}\r\n`;
  function csvFrais(etat, base) {
    const nomA = (id) => (id ? (etat.animaux.find((x) => x.id === id)?.nom || 'Animal supprimé') : 'Commun');
    const cat = (c) => base.categories.find((x) => x.code === c)?.nom || c;
    const lignes = lignesFrais(etat, base).slice().reverse().map((x) => [dateFr(x.date), nomA(x.animalId), cat(x.categorie), x.libelle, x.montant]);
    return versCsv([['Date', 'Animal', 'Catégorie', 'Libellé', 'Montant'], ...lignes]);
  }
  function csvPoids(etat) {
    const lignes = [];
    for (const a of etat.animaux || []) for (const p of pesees(etat, a.id)) lignes.push([dateFr(p.date), a.nom, p.poids]);
    return versCsv([['Date', 'Animal', 'Poids (kg)'], ...lignes]);
  }

  // ---------- Normalisation ----------
  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const texte = (v, n) => String(v ?? '').trim().slice(0, n);
  const dateOuNull = (v) => (estDate(v) ? v : null);
  const montant = (v) => { const n = nombre(v); return n > 0 ? arrondi(n) : 0; };
  const entier = (v, mini, maxi, defaut) => { const n = Math.round(Number(v)); return v !== '' && v !== null && v !== undefined && Number.isFinite(n) ? Math.min(maxi, Math.max(mini, n)) : defaut; };

  function normaliserAnimal(x) {
    return {
      id: texte(x?.id, 40) || nouvelId(), nom: texte(x?.nom, 40) || 'Mon animal',
      espece: ['chien', 'chat', 'autre'].includes(x?.espece) ? x.espece : 'chien', especeAutre: texte(x?.especeAutre, 40),
      race: texte(x?.race, 60), sexe: ['M', 'F'].includes(x?.sexe) ? x.sexe : '', naissance: dateOuNull(x?.naissance),
      sterilise: ['oui', 'non'].includes(x?.sterilise) ? x.sterilise : '', identification: texte(x?.identification, 80),
      veterinaire: texte(x?.veterinaire, 120), notes: texte(x?.notes, 500), actif: x?.actif !== false, departLe: dateOuNull(x?.departLe),
    };
  }
  function normaliserSoin(x, base) {
    return {
      id: texte(x?.id, 40) || nouvelId(), animalId: texte(x?.animalId, 40),
      type: base.types.some((t) => t.code === x?.type) ? x.type : 'AUT', nom: texte(x?.nom, 80) || 'Soin',
      intervalle: entier(x?.intervalle, 0, 999, 0), unite: UNITES.some((u) => u[0] === x?.unite) ? x.unite : 'mois',
      depuis: dateOuNull(x?.depuis), prochaine: dateOuNull(x?.prochaine), note: texte(x?.note, 200), actif: x?.actif !== false,
    };
  }
  const normaliserFait = (x) => ({ id: texte(x?.id, 40) || nouvelId(), soinId: texte(x?.soinId, 40), animalId: texte(x?.animalId, 40), date: dateOuNull(x?.date) || '2026-01-01', prochaine: dateOuNull(x?.prochaine), par: texte(x?.par, 80), cout: montant(x?.cout), note: texte(x?.note, 200) });
  const normaliserPesee = (x) => ({ id: texte(x?.id, 40) || nouvelId(), animalId: texte(x?.animalId, 40), date: dateOuNull(x?.date) || '2026-01-01', poids: lirePoids(x?.poids) || 0, note: texte(x?.note, 120) });
  const normaliserVisite = (x) => ({ id: texte(x?.id, 40) || nouvelId(), animalId: texte(x?.animalId, 40), date: dateOuNull(x?.date) || '2026-01-01', motif: texte(x?.motif, 120), veterinaire: texte(x?.veterinaire, 120), notes: texte(x?.notes, 1000), traitement: texte(x?.traitement, 500), finTraitement: dateOuNull(x?.finTraitement), cout: montant(x?.cout) });
  function normaliserDepense(x, base) {
    return { id: texte(x?.id, 40) || nouvelId(), animalId: texte(x?.animalId, 40), date: dateOuNull(x?.date) || '2026-01-01', categorie: base.categories.some((c) => c.code === x?.categorie) ? x.categorie : 'AUT', montant: montant(x?.montant), libelle: texte(x?.libelle, 120) };
  }
  function normaliserReglages(r, dv) {
    r = r || {};
    return { alerteJours: entier(r.alerteJours, 0, 180, dv.alerteJours), peseeJours: entier(r.peseeJours, 0, 730, dv.peseeJours) };
  }
  function etatVide(base) {
    return { version: 1, reglages: normaliserReglages({}, base.reglages), animaux: [], soins: [], faits: [], pesees: [], visites: [], depenses: [] };
  }
  function normaliser(d, base) {
    const v = etatVide(base);
    if (!d || typeof d !== 'object') return v;
    const liste = (l, f) => (Array.isArray(l) ? l : []).map(f);
    return {
      ...v, ...d,
      reglages: normaliserReglages(d.reglages, base.reglages),
      animaux: liste(d.animaux, normaliserAnimal),
      soins: liste(d.soins, (x) => normaliserSoin(x, base)),
      faits: liste(d.faits, normaliserFait),
      pesees: liste(d.pesees, normaliserPesee).filter((p) => p.poids > 0),
      visites: liste(d.visites, normaliserVisite),
      depenses: liste(d.depenses, (x) => normaliserDepense(x, base)),
    };
  }
  // Soins proposés à partir des modèles de l'espèce : nom et type seulement, intervalle vide.
  const soinsModeles = (base, espece, animalId, codes = null) => (base.modeles[espece] || base.modeles.autre)
    .filter((_, i) => !codes || codes.includes(i))
    .map(([type, nom]) => normaliserSoin({ animalId, type, nom, intervalle: 0 }, base));
  // Suppression d'un animal et de tout ce qui le concerne (les dépenses communes restent).
  function supprimerAnimal(etat, id) {
    const garde = (l) => (l || []).filter((x) => x.animalId !== id);
    return { ...etat, animaux: etat.animaux.filter((a) => a.id !== id), soins: garde(etat.soins), faits: garde(etat.faits), pesees: garde(etat.pesees), visites: garde(etat.visites), depenses: garde(etat.depenses) };
  }
  // Suppression d'un soin et de ses soins faits.
  const supprimerSoin = (etat, id) => ({ ...etat, soins: etat.soins.filter((s) => s.id !== id), faits: etat.faits.filter((f) => f.soinId !== id) });
  // Taille en octets de l'état sérialisé (le service accepte environ 900 000 octets par compte).
  const taille = (etat) => new TextEncoder().encode(JSON.stringify(etat)).length;

  g.ANM = {
    iso, versDate, ajout, ecart, estDate, dateFr, ajoutMois, UNITES, ajoutIntervalle, texteIntervalle,
    arrondi, nombre, lireNombre, lirePoids, plat, age, texteAge,
    faitsDe, echeanceSoin, pesees, poidsAu, statsPoids, typeDe, lignesFrais, frais, fraisParMois, fraisParAn, coutAnnuel,
    traitementsEnCours, syntheseAnimal, alertes, carnet, texteCarnet, champCsv, versCsv, csvFrais, csvPoids,
    nouvelId, normaliserAnimal, normaliserSoin, normaliserFait, normaliserPesee, normaliserVisite, normaliserDepense,
    normaliserReglages, etatVide, normaliser, soinsModeles, supprimerAnimal, supprimerSoin, taille,
  };
})(typeof window !== 'undefined' ? window : globalThis);
