// Suivi du bébé QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.BBE) et par les tests Node (outils/templates/bebe.test.mjs).
// Dates locales « AAAA-MM-JJ », horodatages locaux « AAAA-MM-JJTHH:MM » (comparables comme des chaînes).
// Toute fonction qui dépend de l'heure reçoit `maintenant` (horodatage). AUCUNE règle médicale : pas de norme
// de quantité de lait ni de durée de sommeil, pas de courbe de référence, pas de seuil, pas d'alerte.
// Les totaux et moyennes ne sont que la somme des saisies des parents.
(function (g) {
  'use strict';

  // ---------- Dates et heures ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const horo = (d) => `${iso(d)}T${deux(d.getHours())}:${deux(d.getMinutes())}`;
  const versDate = (s) => { const [a, m, j] = String(s).slice(0, 10).split('-').map(Number); return new Date(a, m - 1, j); };
  // Horodatage local → Date (heure locale, sans fuseau).
  const versInstant = (s) => { const d = versDate(s); const [h, mi] = String(s).slice(11, 16).split(':').map(Number); d.setHours(h || 0, mi || 0, 0, 0); return d; };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  const estHoro = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) && horo(versInstant(s)) === s;
  const jourDe = (s) => String(s).slice(0, 10);
  const heureDe = (s) => String(s).slice(11, 16);
  const ajoutMinutes = (s, n) => { const d = versInstant(s); d.setMinutes(d.getMinutes() + Math.round(n)); return horo(d); };
  // Minutes entières de a à b (négatif si b est avant a). Robuste aux changements d'heure (heure murale).
  const minutesEntre = (a, b) => Math.round((versInstant(b) - versInstant(a)) / 60000);
  const dateFr = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '');
  function ajoutMois(s, n) {
    const [a, m, j] = s.split('-').map(Number);
    const t = (a * 12 + (m - 1)) + Number(n);
    const an = Math.floor(t / 12), mo = t - an * 12;
    const fin = new Date(an, mo + 1, 0).getDate();
    return `${an}-${deux(mo + 1)}-${deux(Math.min(j, fin))}`;
  }

  // « 1 h 05 », « 45 min », « 0 min ».
  function texteDuree(min) {
    const m = Math.max(0, Math.round(Number(min) || 0));
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60), r = m % 60;
    return r ? `${h} h ${deux(r)}` : `${h} h`;
  }
  // Temps écoulé depuis un horodatage : « à l'instant », « il y a 12 min », « il y a 2 h 05 », « il y a 3 jours ».
  function ilYa(s, maintenant) {
    if (!estHoro(s) || !estHoro(maintenant)) return '';
    const m = minutesEntre(s, maintenant);
    if (m < 0) return `dans ${texteDuree(-m)}`;
    if (m < 1) return 'à l\'instant';
    if (m < 48 * 60) return `il y a ${texteDuree(m)}`;
    const j = Math.floor(m / 1440);
    return `il y a ${j} jours`;
  }

  // ---------- Âge ----------
  // Âge en jours révolus (null si naissance inconnue ou future).
  const ageJours = (naissance, auj) => (estDate(naissance) && estDate(auj) && naissance <= auj ? ecart(naissance, auj) : null);
  function ageMois(naissance, auj) {
    if (!estDate(naissance) || !estDate(auj) || naissance > auj) return null;
    let m = 0;
    while (ajoutMois(naissance, m + 1) <= auj) m++;
    return { mois: m, jours: ecart(ajoutMois(naissance, m), auj) };
  }
  // « 5 jours », « 3 semaines », « 2 mois et 1 semaine », « 2 ans et 3 mois ».
  function texteAge(naissance, auj) {
    const j = ageJours(naissance, auj);
    if (j === null) return '';
    if (j === 0) return 'naissance';
    const p = (n, s, pl) => `${n} ${n > 1 ? pl : s}`;
    if (j < 14) return p(j, 'jour', 'jours');
    const a = ageMois(naissance, auj);
    if (a.mois < 2) return p(Math.floor(j / 7), 'semaine', 'semaines');
    if (a.mois < 24) {
      const s = Math.floor(a.jours / 7);
      return s ? `${a.mois} mois et ${p(s, 'semaine', 'semaines')}` : `${a.mois} mois`;
    }
    const ans = Math.floor(a.mois / 12), r = a.mois % 12;
    return r ? `${p(ans, 'an', 'ans')} et ${r} mois` : p(ans, 'an', 'ans');
  }

  // ---------- Saisie des nombres ----------
  const arrondi = (n, d = 2) => Math.round((n + Number.EPSILON) * 10 ** d) / 10 ** d;
  // « 1 234,5 » → 1234.5 ; null si vide ou illisible (jamais négatif).
  function lireNombre(saisie) {
    const s = String(saisie ?? '').replace(/[\s  ]/g, '').replace(',', '.');
    if (!s || !/^\d+(\.\d{0,3})?$/.test(s)) return null;
    return Number(s);
  }
  // Poids en kg (« 4,25 », « 4.25 kg ») ou en g (« 4250 g », ou un nombre ≥ 300 sans unité) → kg.
  // Bornes de LECTURE seulement (0,3 à 40 kg), pas des normes : elles évitent les fautes de frappe.
  function lirePoids(saisie) {
    const s = String(saisie ?? '').toLowerCase().replace(/[\s  ]/g, '');
    const g2 = /^(\d+(?:[.,]\d{0,3})?)g$/.exec(s);
    const kg = /^(\d+(?:[.,]\d{0,3})?)(kg)?$/.exec(s);
    let n = g2 ? Number(g2[1].replace(',', '.')) / 1000 : kg ? Number(kg[1].replace(',', '.')) : NaN;
    if (kg && !kg[2] && n >= 300) n /= 1000; // « 3450 » : des grammes
    return Number.isFinite(n) && n >= 0.3 && n <= 40 ? arrondi(n, 3) : null;
  }
  // Longueur en cm (« 52,5 », « 52,5 cm ») ; bornes de lecture.
  function lireCm(saisie, mini, maxi) {
    const s = String(saisie ?? '').toLowerCase().replace(/[\s  ]/g, '').replace(/cm$/, '');
    const n = lireNombre(s);
    return n !== null && n >= mini && n <= maxi ? arrondi(n, 1) : null;
  }
  const lireTaille = (s) => lireCm(s, 25, 130);
  const lirePc = (s) => lireCm(s, 20, 60);
  // Quantité en ml (biberon), entière, 1 à 500 (bornes de lecture).
  function lireMl(saisie) {
    const s = String(saisie ?? '').toLowerCase().replace(/[\s  ]/g, '').replace(/ml$/, '');
    const n = lireNombre(s);
    return n !== null && n >= 1 && n <= 500 ? Math.round(n) : null;
  }
  // Durée en minutes (« 15 », « 1h10 », « 1 h 10 », « 0:45 »), 1 à 24 h.
  function lireDuree(saisie) {
    const s = String(saisie ?? '').toLowerCase().replace(/[\s  ]/g, '').replace(/min$|mn$/, '');
    let m = null;
    const hm = /^(\d{1,2})(?:h|:)(\d{0,2})$/.exec(s);
    if (hm) m = Number(hm[1]) * 60 + Number(hm[2] || 0);
    else if (/^\d{1,4}$/.test(s)) m = Number(s);
    return m !== null && m >= 1 && m <= 1440 ? m : null;
  }

  // ---------- Types d'événements ----------
  // repas : mode sein (côté G, D ou 2, durée ou minuteur), biberon (ml, contenu), solide (texte) ;
  // sommeil : début, fin (null = en cours) ; couche : pipi, selle ; mesure : poids, taille, pc ; note : texte.
  const TYPES = ['repas', 'sommeil', 'couche', 'mesure', 'note'];
  const MODES = ['sein', 'biberon', 'solide'];
  const COTES = ['G', 'D', '2'];

  // Durée d'un événement (sein ou sommeil) en minutes ; en cours : jusqu'à `maintenant`.
  function dureeMinutes(ev, maintenant) {
    if (ev.type === 'sommeil' || (ev.type === 'repas' && ev.mode === 'sein')) {
      if (ev.fin) return Math.max(0, minutesEntre(ev.debut, ev.fin));
      if (ev.type === 'repas' && ev.duree) return ev.duree;
      if (maintenant && estHoro(maintenant)) return Math.max(0, minutesEntre(ev.debut, maintenant));
    }
    return 0;
  }
  const enCours = (ev) => (ev.type === 'sommeil' || (ev.type === 'repas' && ev.mode === 'sein')) && !ev.fin && !ev.duree;
  // Fin effective (pour les chevauchements) : fin notée, sinon début + durée, sinon maintenant.
  function finEffective(ev, maintenant) {
    if (ev.fin) return ev.fin;
    if (ev.duree) return ajoutMinutes(ev.debut, ev.duree);
    return enCours(ev) && maintenant ? maintenant : ev.debut;
  }
  // Minutes d'un intervalle [a, b] comprises dans le jour j (de 00:00 à 24:00).
  function minutesDansJour(a, b, j) {
    const d0 = `${j}T00:00`, d1 = `${ajout(j, 1)}T00:00`;
    const de = a > d0 ? a : d0, a2 = b < d1 ? b : d1;
    return de < a2 ? minutesEntre(de, a2) : 0;
  }

  // Événements d'un enfant, triés du plus récent au plus ancien.
  const evenementsDe = (etat, enfantId) => (etat.evenements || []).filter((e) => e.enfantId === enfantId && estHoro(e.debut))
    .sort((a, b) => b.debut.localeCompare(a.debut) || String(b.id).localeCompare(String(a.id)));

  // ---------- Résumés (sans jugement : sommes et moyennes des saisies) ----------
  function resumeJour(etat, enfantId, j, maintenant) {
    const r = { jour: j, repas: 0, tetees: 0, minutesSein: 0, biberons: 0, ml: 0, solides: 0, sommeilMin: 0, sommeils: 0, couches: 0, pipi: 0, selles: 0, mesures: 0, notes: 0, saisies: 0 };
    for (const e of etat.evenements || []) {
      if (e.enfantId !== enfantId || !estHoro(e.debut)) continue;
      if (e.type === 'sommeil') {
        const m = minutesDansJour(e.debut, finEffective(e, maintenant), j);
        if (m > 0 || jourDe(e.debut) === j) { r.sommeilMin += m; if (jourDe(e.debut) === j) { r.sommeils++; r.saisies++; } }
        continue;
      }
      if (jourDe(e.debut) !== j) continue;
      r.saisies++;
      if (e.type === 'repas') {
        r.repas++;
        if (e.mode === 'sein') { r.tetees++; r.minutesSein += dureeMinutes(e, maintenant); }
        else if (e.mode === 'biberon') { r.biberons++; r.ml += e.ml || 0; }
        else r.solides++;
      } else if (e.type === 'couche') { r.couches++; if (e.pipi) r.pipi++; if (e.selle) r.selles++; }
      else if (e.type === 'mesure') r.mesures++;
      else if (e.type === 'note') r.notes++;
    }
    return r;
  }
  const CHAMPS_RESUME = ['repas', 'tetees', 'minutesSein', 'biberons', 'ml', 'solides', 'sommeilMin', 'couches', 'pipi', 'selles'];
  // n jours finissant à `fin` (inclus). Les moyennes portent sur les jours NOTÉS (au moins une saisie),
  // pour ne pas compter comme « zéro » un jour où personne n'a rien noté ; le jour en cours est exclu des moyennes.
  function resumePeriode(etat, enfantId, fin, n, maintenant) {
    const jours = [];
    for (let k = n - 1; k >= 0; k--) jours.push(resumeJour(etat, enfantId, ajout(fin, -k), maintenant));
    const aujourd = maintenant ? jourDe(maintenant) : null;
    const notes = jours.filter((r) => r.saisies > 0 && r.jour !== aujourd);
    const totaux = {}, moyennes = {};
    for (const c of CHAMPS_RESUME) {
      totaux[c] = jours.reduce((s, r) => s + r[c], 0);
      moyennes[c] = notes.length ? arrondi(notes.reduce((s, r) => s + r[c], 0) / notes.length, 1) : null;
    }
    return { jours, totaux, moyennes, joursNotes: notes.length };
  }

  // ---------- Dernières saisies et état du moment ----------
  function etatDuMoment(etat, enfantId, maintenant) {
    const evs = evenementsDe(etat, enfantId).filter((e) => e.debut <= maintenant);
    const repas = evs.find((e) => e.type === 'repas') || null;
    const sein = evs.find((e) => e.type === 'repas' && e.mode === 'sein' && e.cote) || null;
    const couche = evs.find((e) => e.type === 'couche') || null;
    const sommeilEnCours = evs.find((e) => e.type === 'sommeil' && enCours(e)) || null;
    const teteeEnCours = evs.find((e) => e.type === 'repas' && enCours(e)) || null;
    const dernierSommeil = evs.find((e) => e.type === 'sommeil' && !enCours(e)) || null;
    return {
      repas, dernierCote: sein ? sein.cote : null, couche, sommeilEnCours, teteeEnCours, dernierSommeil,
      reveilDepuis: !sommeilEnCours && dernierSommeil ? finEffective(dernierSommeil, maintenant) : null,
    };
  }

  // ---------- Mesures (aucune courbe de référence, aucun percentile) ----------
  // Liste par grandeur : [{ date, valeur, id }] triée par date croissante (une mesure par saisie).
  function mesures(etat, enfantId, grandeur) {
    return (etat.evenements || []).filter((e) => e.enfantId === enfantId && e.type === 'mesure' && estHoro(e.debut) && e[grandeur] > 0)
      .map((e) => ({ id: e.id, date: jourDe(e.debut), quand: e.debut, valeur: e[grandeur], note: e.texte || '' }))
      .sort((a, b) => a.quand.localeCompare(b.quand));
  }
  function statsMesure(liste) {
    if (!liste.length) return { nombre: 0, dernier: null, precedent: null, ecart: null, jours: null };
    const dernier = liste.at(-1), precedent = liste.length > 1 ? liste.at(-2) : null;
    return { nombre: liste.length, dernier, precedent, ecart: precedent ? arrondi(dernier.valeur - precedent.valeur, 3) : null, jours: precedent ? ecart(precedent.date, dernier.date) : null };
  }

  // ---------- Rendez-vous ----------
  const rdvDe = (etat, enfantId) => (etat.rdv || []).filter((r) => !enfantId || r.enfantId === enfantId);
  const rdvAVenir = (etat, enfantId, maintenant) => rdvDe(etat, enfantId).filter((r) => r.quand >= maintenant.slice(0, 10) + 'T00:00' && !r.fait).sort((a, b) => a.quand.localeCompare(b.quand));
  const rdvPasses = (etat, enfantId, maintenant) => rdvDe(etat, enfantId).filter((r) => r.quand < maintenant.slice(0, 10) + 'T00:00' || r.fait).sort((a, b) => b.quand.localeCompare(a.quand));

  // ---------- Libellés ----------
  const NOM_COTE = { G: 'gauche', D: 'droit', 2: 'les deux côtés' };
  function libelle(e, maintenant) {
    if (e.type === 'repas') {
      if (e.mode === 'sein') {
        const d = dureeMinutes(e, maintenant);
        return `Tétée${e.cote ? ` · ${e.cote === '2' ? 'les deux côtés' : `côté ${NOM_COTE[e.cote]}`}` : ''}${enCours(e) ? ' · en cours' : d ? ` · ${texteDuree(d)}` : ''}`;
      }
      if (e.mode === 'biberon') return `Biberon${e.ml ? ` · ${e.ml} ml` : ''}${e.contenu ? ` · ${e.contenu}` : ''}`;
      return `Repas${e.texte ? ` · ${e.texte}` : ''}`;
    }
    if (e.type === 'sommeil') return enCours(e) ? 'Sommeil · en cours' : `Sommeil · ${texteDuree(dureeMinutes(e, maintenant))}`;
    if (e.type === 'couche') return `Couche · ${[e.pipi ? 'pipi' : '', e.selle ? 'selle' : ''].filter(Boolean).join(' et ') || 'sèche'}`;
    if (e.type === 'mesure') {
      const v = (n, d) => n.toLocaleString('fr-FR', { maximumFractionDigits: d });
      return `Mesure · ${[e.poids ? `${v(e.poids, 3)} kg` : '', e.taille ? `${v(e.taille, 1)} cm` : '', e.pc ? `PC ${v(e.pc, 1)} cm` : ''].filter(Boolean).join(' · ')}`;
    }
    return 'Note';
  }

  // ---------- Récapitulatif pour le rendez-vous ----------
  function recap(etat, enfant, du, au, maintenant) {
    const n = Math.max(1, ecart(du, au) + 1);
    const p = resumePeriode(etat, enfant.id, au, n, maintenant);
    const dans = (s) => jourDe(s) >= du && jourDe(s) <= au;
    const evs = evenementsDe(etat, enfant.id);
    const m = { poids: mesures(etat, enfant.id, 'poids'), taille: mesures(etat, enfant.id, 'taille'), pc: mesures(etat, enfant.id, 'pc') };
    return {
      enfant, du, au, age: texteAge(enfant.naissance, au), periode: p,
      mesures: evs.filter((e) => e.type === 'mesure').slice(0, 6).reverse(),
      derniers: { poids: m.poids.at(-1) || null, taille: m.taille.at(-1) || null, pc: m.pc.at(-1) || null },
      notes: evs.filter((e) => e.type === 'note' && dans(e.debut)).reverse(),
      repasTextes: evs.filter((e) => e.type === 'repas' && e.mode === 'solide' && dans(e.debut)).reverse(),
      prochain: rdvAVenir(etat, enfant.id, maintenant)[0] || null,
    };
  }
  function texteRecap(c) {
    const nb = (x, d = 1) => (x === null || x === undefined ? '–' : Number(x).toLocaleString('fr-FR', { maximumFractionDigits: d }));
    const t = [`Récapitulatif de ${c.enfant.prenom}${c.age ? ` (${c.age})` : ''}`, `Du ${dateFr(c.du)} au ${dateFr(c.au)} · notes des parents`, ''];
    const d = c.derniers;
    t.push(`Dernières mesures : ${[d.poids ? `poids ${nb(d.poids.valeur, 3)} kg le ${dateFr(d.poids.date)}` : '', d.taille ? `taille ${nb(d.taille.valeur)} cm le ${dateFr(d.taille.date)}` : '', d.pc ? `périmètre crânien ${nb(d.pc.valeur)} cm le ${dateFr(d.pc.date)}` : ''].filter(Boolean).join(' ; ') || 'aucune'}`);
    t.push('', 'Par jour (saisies des parents) :');
    for (const r of c.periode.jours) {
      if (!r.saisies && !r.sommeilMin) { t.push(`${dateFr(r.jour)} · non noté`); continue; }
      t.push(`${dateFr(r.jour)} · ${r.repas} repas (${r.tetees} tétée${r.tetees > 1 ? 's' : ''}${r.minutesSein ? `, ${texteDuree(r.minutesSein)}` : ''} ; ${r.biberons} biberon${r.biberons > 1 ? 's' : ''}${r.ml ? `, ${r.ml} ml` : ''}${r.solides ? ` ; ${r.solides} repas solide${r.solides > 1 ? 's' : ''}` : ''}) · sommeil ${texteDuree(r.sommeilMin)} · ${r.couches} couche${r.couches > 1 ? 's' : ''} (${r.pipi} pipi, ${r.selles} selle${r.selles > 1 ? 's' : ''})`);
    }
    const mo = c.periode.moyennes;
    if (c.periode.joursNotes) t.push('', `Moyenne par jour noté (${c.periode.joursNotes} jour${c.periode.joursNotes > 1 ? 's' : ''}) : ${nb(mo.repas)} repas, ${nb(mo.ml, 0)} ml en biberon, sommeil ${texteDuree(mo.sommeilMin)}, ${nb(mo.couches)} couches.`);
    if (c.notes.length) { t.push('', 'Notes :'); for (const n of c.notes) t.push(`${dateFr(jourDe(n.debut))} ${heureDe(n.debut)} · ${n.texte}`); }
    if (c.prochain) { t.push('', `Prochain rendez-vous : ${dateFr(jourDe(c.prochain.quand))} à ${heureDe(c.prochain.quand)}${c.prochain.avec ? ` · ${c.prochain.avec}` : ''}`); if (c.prochain.questions) t.push(`Questions à poser : ${c.prochain.questions}`); }
    t.push('', 'Établi à partir des notes des parents. Ne remplace ni le carnet de santé ni l\'avis du médecin, de la sage-femme ou de la PMI.');
    return t.join('\n');
  }

  // ---------- Export CSV (point-virgule, BOM UTF-8, tableurs français) ----------
  function champCsv(v) {
    let s = typeof v === 'number' ? String(v).replace('.', ',') : String(v ?? '');
    if (typeof v !== 'number' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`; // formules neutralisées
    return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
  const versCsv = (lignes) => `﻿${lignes.map((l) => l.map(champCsv).join(';')).join('\r\n')}\r\n`;
  function csv(etat, maintenant) {
    const nom = (id) => (etat.enfants || []).find((x) => x.id === id)?.prenom || 'Enfant supprimé';
    const vide = (n) => (n ? n : '');
    const lignes = (etat.evenements || []).filter((e) => estHoro(e.debut)).slice().sort((a, b) => a.debut.localeCompare(b.debut)).map((e) => [
      dateFr(jourDe(e.debut)), heureDe(e.debut), nom(e.enfantId), e.type === 'repas' ? (e.mode === 'sein' ? 'tétée' : e.mode) : e.type,
      e.type === 'repas' && e.mode === 'sein' ? (NOM_COTE[e.cote] || '') : e.type === 'repas' ? (e.contenu || '') : '',
      e.fin ? `${dateFr(jourDe(e.fin))} ${heureDe(e.fin)}` : enCours(e) ? 'en cours' : '',
      vide(dureeMinutes(e, maintenant)), vide(e.ml), e.type === 'couche' ? (e.pipi ? 'oui' : 'non') : '', e.type === 'couche' ? (e.selle ? 'oui' : 'non') : '',
      vide(e.poids), vide(e.taille), vide(e.pc), e.texte || '',
    ]);
    for (const r of etat.rdv || []) lignes.push([dateFr(jourDe(r.quand)), heureDe(r.quand), nom(r.enfantId), 'rendez-vous', r.avec, '', '', '', '', '', '', '', '', [r.motif, r.questions, r.compteRendu].filter(Boolean).join(' · ')]);
    return versCsv([['Date', 'Heure', 'Enfant', 'Type', 'Détail', 'Fin', 'Durée (min)', 'Quantité (ml)', 'Pipi', 'Selle', 'Poids (kg)', 'Taille (cm)', 'Périmètre crânien (cm)', 'Texte'], ...lignes]);
  }

  // ---------- Normalisation ----------
  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const texte = (v, n) => String(v ?? '').trim().slice(0, n);
  const horoOuNull = (v) => (estHoro(v) ? v : null);
  const positif = (v, f) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? f(n) : 0; };
  const maj = (x) => (typeof x?.maj === 'number' && Number.isFinite(x.maj) ? x.maj : 0);

  const normaliserEnfant = (x) => ({ id: texte(x?.id, 40) || nouvelId(), prenom: texte(x?.prenom, 40) || 'Bébé', naissance: estDate(x?.naissance) ? x.naissance : null, notes: texte(x?.notes, 500), actif: x?.actif !== false, maj: maj(x) });
  function normaliserEvenement(x) {
    const type = TYPES.includes(x?.type) ? x.type : 'note';
    const e = { id: texte(x?.id, 40) || nouvelId(), enfantId: texte(x?.enfantId, 40), type, debut: horoOuNull(x?.debut) || '2026-01-01T00:00', texte: texte(x?.texte, 500), maj: maj(x) };
    if (type === 'repas') {
      e.mode = MODES.includes(x?.mode) ? x.mode : 'sein';
      if (e.mode === 'sein') { e.cote = COTES.includes(String(x?.cote)) ? String(x.cote) : ''; e.fin = horoOuNull(x?.fin); e.duree = e.fin ? 0 : positif(x?.duree, (n) => Math.min(1440, Math.round(n))); }
      if (e.mode === 'biberon') { e.ml = positif(x?.ml, (n) => Math.min(500, Math.round(n))); e.contenu = texte(x?.contenu, 60); }
      if (e.fin && e.fin < e.debut) e.fin = null;
    } else if (type === 'sommeil') {
      e.fin = horoOuNull(x?.fin);
      if (e.fin && e.fin < e.debut) e.fin = null;
    } else if (type === 'couche') {
      e.pipi = !!x?.pipi; e.selle = !!x?.selle;
    } else if (type === 'mesure') {
      e.poids = positif(x?.poids, (n) => arrondi(n, 3)); e.taille = positif(x?.taille, (n) => arrondi(n, 1)); e.pc = positif(x?.pc, (n) => arrondi(n, 1));
    }
    return e;
  }
  const normaliserRdv = (x) => ({ id: texte(x?.id, 40) || nouvelId(), enfantId: texte(x?.enfantId, 40), quand: horoOuNull(x?.quand) || '2026-01-01T09:00', avec: texte(x?.avec, 120), motif: texte(x?.motif, 200), questions: texte(x?.questions, 1000), compteRendu: texte(x?.compteRendu, 2000), fait: !!x?.fait, maj: maj(x) });
  function normaliserReglages(r, dv) {
    r = r || {};
    const n = Math.round(Number(r.resumeJours));
    return { resumeJours: [7, 14].includes(n) ? n : dv.resumeJours, maj: maj(r) };
  }
  function etatVide(base) {
    return { version: 1, consentement: null, reglages: normaliserReglages({}, base.reglages), enfants: [], evenements: [], rdv: [], supprimes: {} };
  }
  function normaliserConsentement(c) {
    if (!c || typeof c !== 'object' || typeof c.date !== 'string' || !c.version) return null;
    return { date: c.date.slice(0, 40), version: String(c.version).slice(0, 20), ...(c.demo ? { demo: true } : {}) };
  }
  function normaliser(d, base) {
    const v = etatVide(base);
    if (!d || typeof d !== 'object') return v;
    const liste = (l, f) => (Array.isArray(l) ? l : []).map(f);
    const supprimes = {};
    if (d.supprimes && typeof d.supprimes === 'object') for (const [k, t] of Object.entries(d.supprimes)) if (typeof t === 'number') supprimes[String(k).slice(0, 40)] = t;
    return {
      ...v, ...d,
      consentement: normaliserConsentement(d.consentement),
      reglages: normaliserReglages(d.reglages, base.reglages),
      enfants: liste(d.enfants, normaliserEnfant),
      evenements: liste(d.evenements, normaliserEvenement),
      rdv: liste(d.rdv, normaliserRdv),
      supprimes,
    };
  }
  const consentementValide = (c) => !!(c && typeof c.date === 'string' && c.version);

  // ---------- Fusion des saisies de deux appareils (les deux parents, même clé) ----------
  // Union par identifiant ; pour un même identifiant, la version modifiée le plus récemment (`maj`) gagne ;
  // une suppression (`supprimes[id] = instant`) l'emporte sur toute version antérieure. Si l'espace en ligne a
  // été effacé (plus de consentement), il n'y a rien à fusionner : la version en ligne est renvoyée telle quelle.
  function fusionner(local, serveur) {
    if (!serveur || !consentementValide(serveur.consentement)) return serveur;
    if (!local) return serveur;
    const supprimes = { ...(serveur.supprimes || {}) };
    for (const [k, t] of Object.entries(local.supprimes || {})) supprimes[k] = Math.max(t, supprimes[k] || 0);
    const unir = (a = [], b = []) => {
      const m = new Map();
      for (const x of [...b, ...a]) { const y = m.get(x.id); if (!y || maj(x) > maj(y)) m.set(x.id, x); }
      return [...m.values()].filter((x) => !(supprimes[x.id] >= maj(x)));
    };
    // Les suppressions de plus de 90 jours sont oubliées (l'état ne grossit pas indéfiniment).
    const limite = Math.max(0, ...Object.values(supprimes)) - 90 * 86400000;
    for (const k of Object.keys(supprimes)) if (supprimes[k] < limite) delete supprimes[k];
    return {
      ...serveur,
      reglages: maj(local.reglages) > maj(serveur.reglages) ? local.reglages : serveur.reglages,
      enfants: unir(local.enfants, serveur.enfants),
      evenements: unir(local.evenements, serveur.evenements),
      rdv: unir(local.rdv, serveur.rdv),
      supprimes,
    };
  }

  // Suppression d'un enfant et de tout ce qui le concerne (marquée pour la fusion).
  function supprimerEnfant(etat, id, instant) {
    const supprimes = { ...(etat.supprimes || {}), [id]: instant };
    for (const l of ['evenements', 'rdv']) for (const x of etat[l] || []) if (x.enfantId === id) supprimes[x.id] = instant;
    return { ...etat, enfants: etat.enfants.filter((a) => a.id !== id), evenements: etat.evenements.filter((x) => x.enfantId !== id), rdv: etat.rdv.filter((x) => x.enfantId !== id), supprimes };
  }
  // Taille en octets de l'état sérialisé (le service accepte environ 900 000 octets par compte).
  const taille = (etat) => new TextEncoder().encode(JSON.stringify(etat)).length;

  g.BBE = {
    iso, horo, versDate, versInstant, ajout, ecart, estDate, estHoro, jourDe, heureDe, ajoutMinutes, minutesEntre, dateFr, ajoutMois,
    texteDuree, ilYa, ageJours, ageMois, texteAge, arrondi, lireNombre, lirePoids, lireTaille, lirePc, lireMl, lireDuree,
    TYPES, MODES, COTES, NOM_COTE, dureeMinutes, enCours, finEffective, minutesDansJour, evenementsDe, resumeJour, resumePeriode,
    etatDuMoment, mesures, statsMesure, rdvAVenir, rdvPasses, libelle, recap, texteRecap, champCsv, versCsv, csv,
    nouvelId, normaliserEnfant, normaliserEvenement, normaliserRdv, normaliserReglages, normaliserConsentement, etatVide, normaliser,
    consentementValide, fusionner, supprimerEnfant, taille,
  };
})(typeof window !== 'undefined' ? window : globalThis);
