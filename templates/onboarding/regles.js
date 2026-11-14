// Onboarding et offboarding salarié QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.ARD) et par les tests Node (vm).
// Dates locales « AAAA-MM-JJ » (comparables comme des chaînes). J = date d'arrivée ou dernier jour.
(function (racine) {
  'use strict';

  const SENS = ['arrivee', 'depart'];
  const STATUTS = ['afaire', 'fait', 'so'];
  const RESPONSABLES = ['rh', 'manager', 'info', 'sg', 'salarie'];
  const ETATS = ['neuf', 'bon', 'usage', 'abime', 'perdu'];

  // ---------- Dates ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  // Semaine du lundi au dimanche contenant la date.
  const lundi = (s) => ajout(s, -((versDate(s).getDay() + 6) % 7));
  const semaine = (s) => { const de = lundi(s); return { de, a: ajout(de, 6) }; };

  // « J-15 », « J », « J+3 »
  const libJ = (j) => (j === 0 ? 'J' : j > 0 ? `J+${j}` : `J−${-j}`);
  // Saisie « J-15 », « -15 », « +3 », « 3 », « J » → entier ; null si illisible.
  function lireJ(saisie) {
    const s = String(saisie ?? '').trim().toUpperCase().replace(/\s/g, '').replace('−', '-');
    if (s === 'J' || s === 'J0') return 0;
    const m = /^J?([+-]?\d{1,3})$/.exec(s);
    return m ? Number(m[1]) : null;
  }

  // ---------- Données minimales ----------
  // « camille durand » → « Camille D. » ; « Jean-Marc de la Tour » → « Jean-Marc D. » ; « Inès » → « Inès ».
  function nomMinimal(saisie) {
    const mots = String(saisie ?? '').trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
    if (!mots.length) return '';
    const cap = (m) => m.split('-').map((x) => x.charAt(0).toLocaleUpperCase('fr') + x.slice(1).toLocaleLowerCase('fr')).join('-');
    const prenom = cap(mots[0]).slice(0, 30);
    if (mots.length === 1) return prenom;
    const lettre = mots.slice(1).join('').replace(/[^\p{L}]/gu, '').charAt(0).toLocaleUpperCase('fr');
    return lettre ? `${prenom} ${lettre}.` : prenom;
  }

  // ---------- Échéances et statuts ----------
  const echeance = (p, t) => ajout(p.date, t.j);
  // fait, so (sans objet), retard (échéance passée), semaine (d'aujourd'hui à dimanche), avenir.
  function statutTache(t, p, auj) {
    if (t.statut === 'fait' || t.statut === 'so') return t.statut;
    const e = echeance(p, t);
    if (e < auj) return 'retard';
    if (e <= semaine(auj).a) return 'semaine';
    return 'avenir';
  }

  // Progression : tâches faites sur tâches applicables (les « sans objet » sortent du compte).
  function progression(p, auj) {
    const r = { total: p.taches.length, fait: 0, so: 0, aFaire: 0, retard: 0, semaine: 0, pct: 0 };
    for (const t of p.taches) {
      const s = statutTache(t, p, auj);
      if (s === 'fait') r.fait++;
      else if (s === 'so') r.so++;
      else { r.aFaire++; if (s === 'retard') r.retard++; if (s === 'semaine') r.semaine++; }
    }
    const applicables = r.total - r.so;
    r.pct = applicables ? Math.round((r.fait / applicables) * 100) : (r.total ? 100 : 0);
    return r;
  }

  // Phases d'un parcours, pour regrouper les tâches.
  const PHASES = {
    arrivee: [
      { id: 'avant', nom: 'Avant l\'arrivée', de: -Infinity, a: -1 },
      { id: 'jour', nom: 'Jour J', de: 0, a: 0 },
      { id: 'semaine1', nom: 'Première semaine', de: 1, a: 7 },
      { id: 'mois1', nom: 'Premier mois', de: 8, a: 30 },
      { id: 'suite', nom: 'Jusqu\'à trois mois', de: 31, a: Infinity },
    ],
    depart: [
      { id: 'preparer', nom: 'Préparer le départ', de: -Infinity, a: -8 },
      { id: 'derniere', nom: 'Dernière semaine', de: -7, a: -1 },
      { id: 'jour', nom: 'Dernier jour', de: 0, a: 0 },
      { id: 'apres', nom: 'Après le départ', de: 1, a: Infinity },
    ],
  };
  const phase = (j, sens) => (PHASES[sens] || PHASES.arrivee).find((x) => j >= x.de && j <= x.a);

  function trierTaches(taches) {
    const ordre = (r) => { const i = RESPONSABLES.indexOf(r); return i < 0 ? 99 : i; };
    return [...taches].sort((x, y) => x.j - y.j || ordre(x.resp) - ordre(y.resp) || x.titre.localeCompare(y.titre, 'fr'));
  }

  // Tâches d'un nouveau parcours : profil commun + profils choisis, copiées (les modèles peuvent changer
  // ensuite sans toucher aux parcours en cours). Doublons de titre fusionnés.
  function genererTaches(modeles, profils, sens) {
    const ids = ['commun', ...profils.filter((x) => x !== 'commun')];
    const vus = new Set();
    const liste = [];
    for (const id of ids) {
      const m = modeles.find((x) => x.id === id);
      if (!m) continue;
      for (const t of m[sens] || []) {
        const cle = t.titre.trim().toLowerCase();
        if (vus.has(cle)) continue;
        vus.add(cle);
        liste.push({ id: nouvelId(), titre: t.titre, resp: t.resp, j: t.j, r: t.r || '', statut: 'afaire', faitLe: null });
      }
    }
    return trierTaches(liste);
  }

  // ---------- Matériel ----------
  // Arrivée : remis, ou à remettre (en retard après J). Départ : restitué, à restituer, non rendu après J.
  function etatMateriel(m, p, auj) {
    if (p.sens === 'arrivee') return m.remisLe ? 'remis' : (auj > p.date ? 'a-remettre-retard' : 'a-remettre');
    if (m.restitueLe) return 'restitue';
    return auj > p.date ? 'non-rendu' : 'a-restituer';
  }
  // Alertes : matériel non rendu (départ passé), à restituer dans les 7 jours, à remettre en retard.
  function alertesMateriel(personnes, auj) {
    const liste = [];
    for (const p of personnes) {
      for (const m of p.materiel) {
        const e = etatMateriel(m, p, auj);
        const urgent = e === 'non-rendu' || e === 'a-remettre-retard' || (e === 'a-restituer' && ecart(auj, p.date) <= 7);
        if (urgent) liste.push({ personneId: p.id, prenom: p.prenom, materielId: m.id, nom: m.nom, etat: e, date: p.date, jours: ecart(p.date, auj) });
      }
    }
    const rang = { 'non-rendu': 0, 'a-remettre-retard': 1, 'a-restituer': 2 };
    return liste.sort((x, y) => rang[x.etat] - rang[y.etat] || x.date.localeCompare(y.date) || x.nom.localeCompare(y.nom, 'fr'));
  }

  // ---------- Vues transverses ----------
  // Parcours terminé : toutes les tâches faites ou sans objet et, pour un départ, tout le matériel rendu.
  function termine(p, auj) {
    if (!p.taches.length) return false;
    if (p.taches.some((t) => t.statut === 'afaire')) return false;
    if (p.sens === 'depart' && p.materiel.some((m) => !m.restitueLe)) return false;
    return true;
  }
  const finParcours = (p) => p.taches.reduce((max, t) => (echeance(p, t) > max ? echeance(p, t) : max), p.date);
  // RGPD : parcours terminés dont la dernière échéance est passée depuis au moins « delai » jours.
  function aEffacer(personnes, auj, delai = 30) {
    return personnes.filter((p) => termine(p, auj) && ecart(finParcours(p), auj) >= delai);
  }

  // Tâches en retard et de la semaine, par responsable (ordre des fonctions), triées par échéance.
  function parResponsable(personnes, auj, { avecAvenir = false } = {}) {
    const groupes = new Map(RESPONSABLES.map((r) => [r, []]));
    for (const p of personnes) {
      if (termine(p, auj)) continue;
      for (const t of p.taches) {
        const s = statutTache(t, p, auj);
        if (s === 'retard' || s === 'semaine' || (avecAvenir && s === 'avenir')) {
          if (!groupes.has(t.resp)) groupes.set(t.resp, []);
          groupes.get(t.resp).push({ personneId: p.id, prenom: p.prenom, sens: p.sens, tacheId: t.id, titre: t.titre, j: t.j, echeance: echeance(p, t), statut: s });
        }
      }
    }
    return [...groupes.entries()].map(([resp, items]) => ({ resp, items: items.sort((x, y) => x.echeance.localeCompare(y.echeance) || x.prenom.localeCompare(y.prenom, 'fr')) }))
      .filter((g) => g.items.length);
  }

  // Indicateurs du tableau de bord.
  function indicateurs(personnes, auj) {
    const r = { enCours: 0, arrivees: 0, departs: 0, retard: 0, semaine: 0, nonRendu: 0, aEffacer: 0 };
    for (const p of personnes) {
      if (termine(p, auj)) continue;
      r.enCours++;
      if (p.sens === 'arrivee') r.arrivees++; else r.departs++;
      const pr = progression(p, auj);
      r.retard += pr.retard; r.semaine += pr.semaine;
    }
    r.nonRendu = alertesMateriel(personnes, auj).filter((a) => a.etat === 'non-rendu').length;
    return r;
  }

  // Ordre d'affichage : en cours d'abord (date la plus proche d'aujourd'hui), terminés ensuite.
  function trierPersonnes(personnes, auj) {
    return [...personnes].sort((x, y) => Number(termine(x, auj)) - Number(termine(y, auj)) || Math.abs(ecart(auj, x.date)) - Math.abs(ecart(auj, y.date)) || x.prenom.localeCompare(y.prenom, 'fr'));
  }

  // ---------- État ----------
  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const entier = (v, min, max, defaut) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : defaut; };
  const dateOuNull = (v) => (estDate(v) ? v : null);
  const texte = (v, n) => String(v ?? '').trim().slice(0, n);

  function normaliserTache(x, { avecStatut = true } = {}) {
    const t = x && typeof x === 'object' ? x : {};
    const o = { id: String(t.id || nouvelId()), titre: texte(t.titre, 160) || 'Tâche', resp: RESPONSABLES.includes(t.resp) ? t.resp : 'rh', j: entier(t.j, -365, 365, 0), r: texte(t.r, 20) };
    if (avecStatut) { o.statut = STATUTS.includes(t.statut) ? t.statut : 'afaire'; o.faitLe = o.statut === 'afaire' ? null : dateOuNull(t.faitLe); o.note = texte(t.note, 200); }
    return o;
  }

  function normaliserMateriel(x) {
    const m = x && typeof x === 'object' ? x : {};
    return { id: String(m.id || nouvelId()), nom: texte(m.nom, 80) || 'Matériel', remisLe: dateOuNull(m.remisLe), etat: ETATS.includes(m.etat) ? m.etat : 'bon', restitueLe: dateOuNull(m.restitueLe), etatRetour: ETATS.includes(m.etatRetour) ? m.etatRetour : null, note: texte(m.note, 120) };
  }

  function normaliserPersonne(x, auj) {
    const p = x && typeof x === 'object' ? x : {};
    return {
      id: String(p.id || nouvelId()),
      sens: SENS.includes(p.sens) ? p.sens : 'arrivee',
      prenom: nomMinimal(p.prenom) || 'Sans nom',
      poste: texte(p.poste, 80),
      contrat: texte(p.contrat, 40),
      service: texte(p.service, 60),
      manager: texte(p.manager, 60),
      date: dateOuNull(p.date) || auj,
      profils: (Array.isArray(p.profils) ? p.profils : []).map(String).slice(0, 10),
      taches: trierTaches((Array.isArray(p.taches) ? p.taches : []).map((t) => normaliserTache(t))),
      materiel: (Array.isArray(p.materiel) ? p.materiel : []).map(normaliserMateriel),
      note: texte(p.note, 300),
      lieeA: p.lieeA ? String(p.lieeA) : null,
    };
  }

  function normaliserModele(x) {
    const m = x && typeof x === 'object' ? x : {};
    const taches = (l) => trierTaches((Array.isArray(l) ? l : []).map((t) => normaliserTache(t, { avecStatut: false })));
    return { id: String(m.id || nouvelId()), nom: texte(m.nom, 60) || 'Profil', desc: texte(m.desc, 160), fixe: Boolean(m.fixe), arrivee: taches(m.arrivee), depart: taches(m.depart) };
  }
  const modelesDepuisBase = (profils) => profils.map((p) => normaliserModele({ ...p, arrivee: p.arrivee.map((t) => ({ ...t, id: nouvelId() })), depart: p.depart.map((t) => ({ ...t, id: nouvelId() })) }));

  const etatVide = (profils = []) => ({ version: 1, entreprise: '', reglages: { effacementJours: 30 }, modeles: modelesDepuisBase(profils), personnes: [] });
  function normaliser(d, auj, profils = []) {
    const v = etatVide(profils);
    if (!d || typeof d !== 'object') return v;
    return {
      ...v, ...d,
      entreprise: texte(d.entreprise, 60),
      reglages: { ...v.reglages, ...(d.reglages || {}), effacementJours: entier(d.reglages?.effacementJours, 0, 365, 30) },
      modeles: Array.isArray(d.modeles) && d.modeles.length ? d.modeles.map(normaliserModele) : v.modeles,
      personnes: (Array.isArray(d.personnes) ? d.personnes : []).map((p) => normaliserPersonne(p, auj)),
    };
  }

  // Départ préparé depuis une arrivée : mêmes informations, matériel remis repris « à restituer ».
  function departDepuis(p, date, modeles, profils = p.profils) {
    return {
      id: nouvelId(), sens: 'depart', prenom: p.prenom, poste: p.poste, contrat: p.contrat, service: p.service, manager: p.manager,
      date, profils: [...profils], taches: genererTaches(modeles, profils, 'depart'),
      materiel: p.materiel.filter((m) => m.remisLe && m.etat !== 'perdu').map((m) => ({ ...m, id: nouvelId(), restitueLe: null, etatRetour: null })),
      note: '', lieeA: p.id,
    };
  }

  // ---------- Exports ----------
  const LIB_STATUT = { afaire: 'À faire', fait: 'Fait', so: 'Sans objet', retard: 'En retard', semaine: 'Cette semaine', avenir: 'À venir' };
  const LIB_SENS = { arrivee: 'Arrivée', depart: 'Départ' };
  const champCsv = (v) => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = (lignes) => '﻿' + lignes.map((l) => l.map(champCsv).join(';')).join('\r\n');
  function versCsv(personnes, nomResp, auj) {
    const tete = ['Personne', 'Parcours', 'Poste', 'Service', 'Contrat', 'Date (J)', 'Tâche', 'Responsable', 'J', 'Échéance', 'Statut', 'Fait le'];
    const lignes = personnes.flatMap((p) => p.taches.map((t) => [p.prenom, LIB_SENS[p.sens], p.poste, p.service, p.contrat, p.date, t.titre, nomResp(t.resp), libJ(t.j).replace('−', '-'), echeance(p, t), LIB_STATUT[statutTache(t, p, auj)], t.faitLe || '']));
    return csv([tete, ...lignes]);
  }
  const LIB_MAT = { remis: 'Remis', 'a-remettre': 'À remettre', 'a-remettre-retard': 'À remettre (en retard)', restitue: 'Restitué', 'a-restituer': 'À restituer', 'non-rendu': 'Non rendu' };
  function versCsvMateriel(personnes, nomEtat, auj) {
    const tete = ['Personne', 'Parcours', 'Date (J)', 'Matériel', 'Situation', 'Remis le', 'État à la remise', 'Restitué le', 'État au retour', 'Note'];
    const lignes = personnes.flatMap((p) => p.materiel.map((m) => [p.prenom, LIB_SENS[p.sens], p.date, m.nom, LIB_MAT[etatMateriel(m, p, auj)], m.remisLe || '', nomEtat(m.etat), m.restitueLe || '', m.etatRetour ? nomEtat(m.etatRetour) : '', m.note]));
    return csv([tete, ...lignes]);
  }

  racine.ARD = {
    SENS, STATUTS, RESPONSABLES, ETATS, PHASES, LIB_STATUT, LIB_SENS, LIB_MAT,
    iso, versDate, ajout, ecart, estDate, lundi, semaine, libJ, lireJ, nomMinimal,
    echeance, statutTache, progression, phase, trierTaches, genererTaches,
    etatMateriel, alertesMateriel, termine, finParcours, aEffacer, parResponsable, indicateurs, trierPersonnes,
    nouvelId, normaliserTache, normaliserMateriel, normaliserPersonne, normaliserModele, modelesDepuisBase, etatVide, normaliser, departDepuis,
    versCsv, versCsvMateriel,
  };
})(typeof window !== 'undefined' ? window : globalThis);
