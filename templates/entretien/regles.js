// Entretien de la maison QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.ENT) et par les tests Node (vm).
// Dates locales « AAAA-MM-JJ » (comparables comme des chaînes) ; fréquences en mois ; saison = mois 1 à 12.
(function (racine) {
  'use strict';

  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const STATUTS = ['retard', 'mois', 'avenir', 'plustard', 'inconnue'];
  const HORIZON_AVENIR = 90; // jours : « à venir » au-delà du mois en cours

  // ---------- Dates ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const moisDe = (s) => Number(s.slice(5, 7));
  const anDe = (s) => Number(s.slice(0, 4));
  const debutMois = (s) => `${s.slice(0, 7)}-01`;
  const finMois = (s) => { const [a, m] = s.split('-').map(Number); return iso(new Date(a, m, 0)); };
  // Ajoute n mois ; le 31 janvier + 1 mois donne le 28 (ou 29) février, jamais le 3 mars.
  function ajoutMois(s, n) {
    const [a, m, j] = s.split('-').map(Number);
    const total = a * 12 + (m - 1) + n;
    const an = Math.floor(total / 12), mo = total - an * 12;
    const dernierJour = new Date(an, mo + 1, 0).getDate();
    return iso(new Date(an, mo, Math.min(j, dernierJour)));
  }

  // ---------- Fréquences et saisons ----------
  function libelleFrequence(n) {
    if (!n || n < 1) return 'Fréquence à choisir';
    if (n === 1) return 'Tous les mois';
    if (n === 12) return 'Tous les ans';
    if (n % 12 === 0) return `Tous les ${n / 12} ans`;
    return `Tous les ${n} mois`;
  }

  const saisonValide = (s) => (Array.isArray(s) ? [...new Set(s.map(Number).filter((m) => Number.isInteger(m) && m >= 1 && m <= 12))] : []);

  // « mars à mai », « novembre, décembre », « octobre à avril » (à cheval sur l'année).
  function libelleSaison(saison) {
    const s = saisonValide(saison);
    if (!s.length || s.length === 12) return '';
    const present = new Set(s);
    // Point de départ : un mois présent dont le précédent est absent (sinon, tout est contigu).
    const depart = s.find((m) => !present.has(((m + 10) % 12) + 1)) ?? s[0];
    const ordre = [];
    for (let i = 0; i < 12; i++) { const m = ((depart - 1 + i) % 12) + 1; if (present.has(m)) ordre.push(m); }
    const contigu = ordre.every((m, i) => i === 0 || m === (ordre[i - 1] % 12) + 1);
    if (contigu && ordre.length > 2) return `${MOIS[ordre[0] - 1]} à ${MOIS[ordre.at(-1) - 1]}`;
    return ordre.map((m) => MOIS[m - 1]).join(', ');
  }

  // Ramène une date dans la saison conseillée : la date elle-même si son mois en fait partie, sinon la plus
  // proche entre la fin de la saison précédente (si elle tombe après « apres ») et le 1er du prochain mois
  // de saison. Faire un peu plus tôt vaut mieux qu'attendre presque un an (obligations annuelles).
  function ajusterSaison(date, saison, apres = null) {
    const s = saisonValide(saison);
    if (!s.length || s.includes(moisDe(date))) return date;
    let suivant = debutMois(date);
    for (let i = 0; i < 12 && !s.includes(moisDe(suivant)); i++) suivant = ajoutMois(suivant, 1);
    let precedent = debutMois(date);
    for (let i = 0; i < 12 && !s.includes(moisDe(precedent)); i++) precedent = ajoutMois(precedent, -1);
    precedent = finMois(precedent);
    if ((!apres || precedent > apres) && ecart(precedent, date) < ecart(date, suivant)) return precedent;
    return suivant;
  }

  // ---------- Tâches ----------
  const entreesDe = (etat, id) => (etat.historique || []).filter((h) => h.tache === id);

  // Dernière réalisation : la plus récente entre la date saisie au départ et l'historique.
  function derniere(etat, t) {
    let d = estDate(t.depart) ? t.depart : null;
    for (const h of entreesDe(etat, t.id)) if (estDate(h.date) && (!d || h.date > d)) d = h.date;
    return d;
  }

  // Prochaine échéance : date reportée, sinon dernière + fréquence (ramenée dans la saison),
  // sinon date prévue (« étaler »), sinon null (date inconnue).
  function prochaine(etat, t) {
    if (estDate(t.reporte)) return t.reporte;
    const d = derniere(etat, t);
    if (d) return ajusterSaison(ajoutMois(d, Math.max(1, t.frequence || 12)), t.saison, d);
    return estDate(t.prevue) ? t.prevue : null;
  }

  function statut(echeance, auj) {
    if (!echeance) return 'inconnue';
    if (echeance < auj) return 'retard';
    if (echeance <= finMois(auj)) return 'mois';
    if (ecart(auj, echeance) <= HORIZON_AVENIR) return 'avenir';
    return 'plustard';
  }

  function etatTache(etat, t, auj) {
    const p = prochaine(etat, t);
    return { tache: t, prochaine: p, derniere: derniere(etat, t), statut: statut(p, auj), jours: p ? ecart(auj, p) : null };
  }

  // Échéances des tâches actives, regroupées par statut et triées par date.
  function echeances(etat, auj) {
    const groupes = Object.fromEntries(STATUTS.map((s) => [s, []]));
    for (const t of etat.taches || []) {
      if (!t.actif) continue;
      const e = etatTache(etat, t, auj);
      groupes[e.statut].push(e);
    }
    for (const s of STATUTS) groupes[s].sort((a, b) => (a.prochaine || '').localeCompare(b.prochaine || '') || a.tache.titre.localeCompare(b.tache.titre));
    return groupes;
  }

  // « 12,50 », « 1 200 € », « 80 » → nombre ; vide → null ; illisible ou négatif → NaN.
  function lireMontant(saisie) {
    const s = String(saisie ?? '').replace(/[\s  €]/g, '').replace(',', '.');
    if (!s) return null;
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
    return Math.round(Number(s) * 100) / 100;
  }

  // Enregistre une réalisation. Renvoie l'entrée, ou une chaîne d'erreur.
  function marquerFait(etat, id, { date, cout = null, intervenant = '', note = '' } = {}, auj, nouvelId) {
    const t = (etat.taches || []).find((x) => x.id === id);
    if (!t) return 'Cette tâche n\'existe plus.';
    if (!estDate(date)) return 'Indique la date de réalisation.';
    if (auj && date > auj) return 'La date ne peut pas être dans le futur : utilise « Reporter » pour planifier.';
    const montant = typeof cout === 'number' || cout === null ? cout : lireMontant(cout);
    if (Number.isNaN(montant) || (typeof montant === 'number' && montant < 0)) return 'Coût illisible : écris un montant comme 85 ou 85,50.';
    const entree = { id: nouvelId ? nouvelId() : `h${Date.now().toString(36)}`, tache: id, date, cout: montant, intervenant: String(intervenant || '').trim().slice(0, 80), note: String(note || '').trim().slice(0, 300) };
    etat.historique = [...(etat.historique || []), entree];
    t.reporte = null; t.prevue = null;
    return entree;
  }

  function supprimerEntree(etat, id) {
    const avant = (etat.historique || []).length;
    etat.historique = (etat.historique || []).filter((h) => h.id !== id);
    return avant !== etat.historique.length;
  }

  // Reporte l'échéance à une date (efface le report si date vide).
  function reporter(etat, id, date) {
    const t = (etat.taches || []).find((x) => x.id === id);
    if (!t) return 'Cette tâche n\'existe plus.';
    if (date && !estDate(date)) return 'Date illisible.';
    t.reporte = date || null;
    return null;
  }

  // Dates d'échéance prévues d'une tâche entre « de » et « a » (incluses), à partir de sa prochaine échéance.
  function occurrences(etat, t, de, a) {
    const p = prochaine(etat, t);
    if (!p) return [];
    const pas = Math.max(1, t.frequence || 12);
    const liste = [];
    let d = p;
    for (let i = 0; i < 400 && d <= a; i++) {
      if (d >= de) liste.push(d);
      d = ajusterSaison(ajoutMois(d, pas), t.saison, d);
    }
    return liste;
  }

  // Liste d'une année, mois par mois : réalisations de l'historique et échéances prévues.
  // Les tâches mensuelles sont à part (« chaque mois ») ; une tâche en retard figure au mois en cours,
  // puis repart d'aujourd'hui.
  function annee(etat, an, auj) {
    const debut = `${an}-01-01`, fin = `${an}-12-31`;
    const mois = Array.from({ length: 12 }, (_, i) => ({ mois: i + 1, faits: [], prevus: [] }));
    const parId = new Map((etat.taches || []).map((t) => [t.id, t]));
    for (const h of etat.historique || []) {
      if (!estDate(h.date) || h.date < debut || h.date > fin) continue;
      const t = parId.get(h.tache);
      if (t && t.actif && (t.frequence || 12) <= 1) continue; // tâches mensuelles : listées à part
      mois[moisDe(h.date) - 1].faits.push({ entree: h, tache: t || null });
    }
    const mensuelles = [];
    const inconnues = [];
    for (const t of etat.taches || []) {
      if (!t.actif) continue;
      if ((t.frequence || 12) <= 1) { mensuelles.push(t); continue; }
      const p = prochaine(etat, t);
      if (!p) { inconnues.push(t); continue; }
      let dates;
      if (p < auj) {
        dates = [];
        if (auj >= debut && auj <= fin) mois[moisDe(auj) - 1].prevus.push({ tache: t, date: p, retard: true });
        const suite = { ...t, reporte: ajusterSaison(ajoutMois(auj, Math.max(1, t.frequence)), t.saison, auj) };
        dates = occurrences(etat, suite, debut, fin);
      } else dates = occurrences(etat, t, debut, fin);
      for (const d of dates) if (an > anDe(auj) || d >= auj) mois[moisDe(d) - 1].prevus.push({ tache: t, date: d, retard: false });
    }
    for (const m of mois) {
      m.faits.sort((a, b) => a.entree.date.localeCompare(b.entree.date));
      m.prevus.sort((a, b) => Number(b.retard) - Number(a.retard) || a.date.localeCompare(b.date) || a.tache.titre.localeCompare(b.tache.titre));
    }
    mensuelles.sort((a, b) => a.titre.localeCompare(b.titre));
    return { an, mois, mensuelles, inconnues };
  }

  // Donne une première date aux tâches sans date connue, étalées sur l'année :
  // obligations d'abord, une à trois par mois, chacune ramenée dans sa saison.
  function etaler(etat, auj) {
    const aDater = (etat.taches || []).filter((t) => t.actif && !prochaine(etat, t));
    aDater.sort((a, b) => Number(!a.regle) - Number(!b.regle) || (a.frequence || 12) - (b.frequence || 12) || a.titre.localeCompare(b.titre));
    aDater.forEach((t, i) => {
      const decalage = i % Math.max(1, Math.min(12, t.frequence || 12));
      let d = decalage === 0 ? auj : debutMois(ajoutMois(debutMois(auj), decalage));
      d = ajusterSaison(d, t.saison, ajout(auj, -1));
      t.prevue = d < auj ? auj : d;
    });
    return aDater.length;
  }

  // ---------- Coûts ----------
  function coutsMensuels(etat, auj, n = 12) {
    const mois = Array.from({ length: n }, (_, i) => ajoutMois(debutMois(auj), i - n + 1).slice(0, 7));
    const tot = new Map(mois.map((m) => [m, { mois: m, total: 0, nb: 0 }]));
    for (const h of etat.historique || []) {
      const m = tot.get(String(h.date).slice(0, 7));
      if (!m) continue;
      m.nb++;
      if (typeof h.cout === 'number') m.total = Math.round((m.total + h.cout) * 100) / 100;
    }
    return mois.map((m) => tot.get(m));
  }

  function totalCouts(etat, de, a) {
    let total = 0, nb = 0, sansCout = 0;
    for (const h of etat.historique || []) {
      if (!estDate(h.date) || h.date < de || h.date > a) continue;
      nb++;
      if (typeof h.cout === 'number') total += h.cout; else sansCout++;
    }
    return { total: Math.round(total * 100) / 100, nb, sansCout };
  }

  // ---------- Équipements ----------
  const refBase = (equipId, i) => `${equipId}:${i}`;

  function tacheDepuisBase(equip, i, nouvelId) {
    const b = equip.taches[i];
    return { id: nouvelId(), base: refBase(equip.id, i), titre: b.titre, equip: equip.id, zone: equip.zone, frequence: b.frequence, saison: [...b.saison], depart: null, prevue: null, reporte: null, actif: true, note: '', regle: b.regle || null, qui: b.qui || 'selon', conseil: b.conseil || '' };
  }

  // Applique la liste d'équipements choisis : ajoute les tâches types manquantes, réactive celles
  // d'un équipement recoché, désactive (sans rien effacer) celles d'un équipement retiré.
  function appliquerEquipements(etat, ids, base, nouvelId) {
    const choisis = new Set(ids.filter((id) => base.equipements.some((e) => e.id === id)));
    let ajoutees = 0, desactivees = 0;
    for (const eq of base.equipements) {
      const actif = choisis.has(eq.id);
      eq.taches.forEach((_, i) => {
        const ref = refBase(eq.id, i);
        const t = etat.taches.find((x) => x.base === ref);
        if (actif && !t) { etat.taches.push(tacheDepuisBase(eq, i, nouvelId)); ajoutees++; }
        else if (t && !actif && t.actif) { t.actif = false; desactivees++; }
        else if (t && actif && !etat.equipements.includes(eq.id)) t.actif = true;
      });
    }
    etat.equipements = base.equipements.filter((e) => choisis.has(e.id)).map((e) => e.id);
    return { ajoutees, desactivees };
  }

  const equipementsParDefaut = (base, logement) => base.equipements.filter((e) => (e.defaut || []).includes(logement) && !(e.maison && logement === 'appartement')).map((e) => e.id);
  const frequenceProposee = (t, base) => {
    if (!t.base) return null;
    const [eq, i] = t.base.split(':');
    return base.equipements.find((e) => e.id === eq)?.taches[Number(i)]?.frequence ?? null;
  };

  // ---------- Export ----------
  const champCsv = (v) => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  function csvHistorique(etat, base) {
    const parId = new Map((etat.taches || []).map((t) => [t.id, t]));
    const zone = (id) => base.zones.find((z) => z.id === id)?.nom || '';
    const equip = (id) => base.equipements.find((e) => e.id === id)?.nom || '';
    const lignes = [...(etat.historique || [])].sort((a, b) => a.date.localeCompare(b.date)).map((h) => {
      const t = parId.get(h.tache);
      return [h.date, t?.titre || 'Tâche supprimée', zone(t?.zone), equip(t?.equip), typeof h.cout === 'number' ? h.cout.toFixed(2).replace('.', ',') : '', h.intervenant, h.note].map(champCsv).join(';');
    });
    return ['Date;Tâche;Zone;Équipement;Coût (€);Intervenant;Note', ...lignes].join('\r\n');
  }

  // ---------- État ----------
  const etatVide = () => ({ version: 1, prenom: '', logement: 'maison', statut: 'proprietaire', equipements: [], taches: [], historique: [] });

  // Tolère les anciennes versions et les copies partielles ou abîmées.
  function normaliser(d) {
    const v = etatVide();
    if (!d || typeof d !== 'object') return v;
    const tab = (x) => (Array.isArray(x) ? x : []);
    const date = (x) => (estDate(x) ? x : null);
    return {
      ...v, ...d,
      logement: d.logement === 'appartement' ? 'appartement' : 'maison',
      statut: d.statut === 'locataire' ? 'locataire' : 'proprietaire',
      prenom: String(d.prenom || ''),
      equipements: tab(d.equipements).filter((x) => typeof x === 'string'),
      taches: tab(d.taches).filter((t) => t && t.id && t.titre).map((t) => ({
        base: null, equip: null, zone: 'interieur', note: '', regle: null, qui: 'selon', conseil: '', actif: true, ...t,
        frequence: Math.max(1, Math.min(240, Math.round(Number(t.frequence) || 12))),
        saison: saisonValide(t.saison), depart: date(t.depart), prevue: date(t.prevue), reporte: date(t.reporte), actif: t.actif !== false,
      })),
      historique: tab(d.historique).filter((h) => h && h.id && h.tache && estDate(h.date)).map((h) => ({
        intervenant: '', note: '', ...h, cout: typeof h.cout === 'number' && h.cout >= 0 ? h.cout : null,
      })),
    };
  }

  racine.ENT = {
    MOIS, STATUTS, HORIZON_AVENIR,
    iso, estDate, versDate, ajout, ecart, moisDe, anDe, debutMois, finMois, ajoutMois,
    libelleFrequence, libelleSaison, ajusterSaison, saisonValide,
    derniere, prochaine, statut, etatTache, echeances, lireMontant, marquerFait, supprimerEntree, reporter,
    occurrences, annee, etaler, coutsMensuels, totalCouts,
    refBase, tacheDepuisBase, appliquerEquipements, equipementsParDefaut, frequenceProposee,
    csvHistorique, etatVide, normaliser,
  };
})(typeof window !== 'undefined' ? window : globalThis);
