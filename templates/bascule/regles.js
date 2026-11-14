// Pilotage d'une journée de bascule QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.BSC) et par les tests Node (outils/templates/bascule.test.mjs).
// Heures locales « AAAA-MM-JJTHH:MM » ; les calculs se font en minutes (horodatage / 60 000), ce qui
// gère les bascules de nuit (passage de minuit). Toute fonction qui dépend de l'heure reçoit `now`
// (en minutes) : rien n'est lu dans l'horloge ici.
(function (g) {
  'use strict';

  // ---------- Dates et heures ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = String(s).slice(0, 10).split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  // Date et heure locales « AAAA-MM-JJTHH:MM ».
  function estDH(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return false;
    const h = Number(s.slice(11, 13)), m = Number(s.slice(14, 16));
    return estDate(s.slice(0, 10)) && h < 24 && m < 60;
  }
  function versMin(s) {
    const [a, mo, j] = s.slice(0, 10).split('-').map(Number);
    return Math.round(new Date(a, mo - 1, j, Number(s.slice(11, 13)), Number(s.slice(14, 16))).getTime() / 60000);
  }
  function depuisMin(n) {
    const d = new Date(n * 60000);
    return `${iso(d)}T${deux(d.getHours())}:${deux(d.getMinutes())}`;
  }
  const maintenant = (d = new Date()) => Math.floor(d.getTime() / 60000);
  const heure = (n) => depuisMin(n).slice(11, 16);
  const dateDe = (n) => depuisMin(n).slice(0, 10);
  // Durée lisible : « 45 min », « 1 h 05 », « 2 h ». Signe conservé.
  function dureeTexte(m) {
    const n = Math.round(Math.abs(Number(m) || 0));
    const s = Number(m) < 0 ? '−' : '';
    if (n < 60) return `${s}${n} min`;
    const h = Math.floor(n / 60), r = n % 60;
    return `${s}${h} h${r ? ` ${deux(r)}` : ''}`;
  }
  // Retard ou avance : « +25 min », « −10 min », « à l'heure ».
  const ecartTexte = (m) => (Math.round(m) === 0 ? 'à l\'heure' : `${m > 0 ? '+' : ''}${dureeTexte(m)}`);
  // Saisie d'une durée : « 45 », « 45 min », « 1h30 », « 1:30 », « 1 h 30 », « 2h ». null si illisible.
  function lireDuree(saisie) {
    const s = String(saisie ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!s) return null;
    let m = s.match(/^(\d{1,4}) ?(min|mn|m)?$/);
    if (m) return Number(m[1]) <= 10080 ? Number(m[1]) : null;
    m = s.match(/^(\d{1,3}) ?(h|:) ?(\d{1,2})? ?(min|mn)?$/);
    if (m && (!m[3] || Number(m[3]) < 60)) { const t = Number(m[1]) * 60 + Number(m[3] || 0); return t <= 10080 ? t : null; }
    return null;
  }
  // Heure « HH:MM » saisie pendant la bascule → date et heure, le jour le plus proche de la référence
  // (une bascule de nuit : « 01:10 » après « 23:40 » tombe le lendemain).
  function heureVersDH(hhmm, reference) {
    if (!/^\d{1,2}:\d{2}$/.test(String(hhmm || '')) || !estDH(reference)) return null;
    const [h, m] = hhmm.split(':').map(Number);
    if (h > 23 || m > 59) return null;
    const ref = versMin(reference);
    const jour = reference.slice(0, 10);
    const candidats = [-1, 0, 1].map((k) => `${ajout(jour, k)}T${deux(h)}:${deux(m)}`);
    return candidats.reduce((meilleur, c) => (Math.abs(versMin(c) - ref) < Math.abs(versMin(meilleur) - ref) ? c : meilleur));
  }

  // ---------- Textes ----------
  const plat = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 7)}`;

  // ---------- Étapes : groupes, ordre, dépendances ----------
  const STATUTS = ['a-faire', 'en-cours', 'fait', 'bloque', 'saute'];
  const TYPES = ['action', 'go', 'arret'];
  const groupe = (e) => (e.phase === 'repli' ? 'repli' : 'principal');
  const finie = (e) => e.statut === 'fait' || e.statut === 'saute';
  const trier = (liste) => [...liste].sort((a, b) => a.ordre - b.ordre || String(a.id).localeCompare(String(b.id)));
  const etapesDe = (etat, basculeId) => trier((etat.etapes || []).filter((e) => e.basculeId === basculeId));

  // Prédécesseurs d'une étape : `apres` null = l'étape précédente du même groupe (enchaînement par
  // défaut) ; [] = démarre au début ; sinon les étapes citées, du même groupe.
  function predecesseurs(e, liste) {
    const memes = liste.filter((x) => groupe(x) === groupe(e));
    if (Array.isArray(e.apres)) return e.apres.filter((id) => id !== e.id && memes.some((x) => x.id === id));
    const i = memes.findIndex((x) => x.id === e.id);
    return i > 0 ? [memes[i - 1].id] : [];
  }
  // Vrai si donner `apres` à l'étape `id` crée une boucle (A après B après A).
  function creeCycle(liste, id, apres) {
    const l = liste.map((x) => (x.id === id ? { ...x, apres } : x));
    const vus = new Set();
    const pile = [...predecesseurs(l.find((x) => x.id === id), l)];
    while (pile.length) {
      const p = pile.pop();
      if (p === id) return true;
      if (vus.has(p)) continue;
      vus.add(p);
      const e = l.find((x) => x.id === p);
      if (e) pile.push(...predecesseurs(e, l));
    }
    return false;
  }
  // Retire une étape ; celles qui en dépendaient héritent de ses prédécesseurs.
  function retirerEtape(liste, id) {
    const e = liste.find((x) => x.id === id);
    if (!e) return liste;
    const herite = predecesseurs(e, liste);
    const reste = liste.filter((x) => x.id !== id);
    return reste.map((x) => {
      if (Array.isArray(x.apres) && x.apres.includes(id)) return { ...x, apres: [...new Set([...x.apres.filter((p) => p !== id), ...herite])] };
      // Enchaînement implicite : l'étape suivante dépendait de celle retirée sans le dire.
      if (x.apres === null && groupe(x) === groupe(e)) {
        const memes = liste.filter((y) => groupe(y) === groupe(e));
        const i = memes.findIndex((y) => y.id === x.id);
        if (i > 0 && memes[i - 1].id === id && Array.isArray(e.apres)) return { ...x, apres: herite };
      }
      return x;
    });
  }

  // ---------- Calcul des horaires ----------
  // Ordre de calcul : chaque étape après ses prédécesseurs ; une boucle éventuelle est cassée.
  function ordreCalcul(liste) {
    const faits = new Set(), sortie = [];
    let reste = trier(liste);
    while (reste.length) {
      const prets = reste.filter((e) => predecesseurs(e, liste).every((p) => faits.has(p)));
      const lot = prets.length ? prets : [reste[0]];
      for (const e of lot) { faits.add(e.id); sortie.push(e); }
      reste = reste.filter((e) => !faits.has(e.id));
    }
    return sortie;
  }
  // Horaires des étapes d'un groupe à partir de `depart` (minutes).
  // mode 'prevu' : durées prévues seulement. mode 'estime' : heures réelles des étapes commencées ou
  // finies, et, si `actif`, rien de ce qui reste ne peut commencer avant `now` (le retard se reporte).
  function planifier(liste, depart, { mode = 'prevu', now = null, actif = false } = {}) {
    const r = {};
    for (const e of ordreCalcul(liste)) {
      const preds = predecesseurs(e, liste).filter((p) => r[p]);
      let pret = preds.reduce((m, p) => Math.max(m, r[p].fin), depart);
      if (e.pasAvant && estDH(e.pasAvant)) pret = Math.max(pret, versMin(e.pasAvant));
      const d = Number(e.duree) || 0;
      if (mode === 'prevu') { r[e.id] = { debut: pret, fin: pret + d }; continue; }
      const dr = e.debutReel && estDH(e.debutReel) ? versMin(e.debutReel) : null;
      const fr = e.finReel && estDH(e.finReel) ? versMin(e.finReel) : null;
      if (e.statut === 'fait') {
        const debut = dr ?? (fr !== null ? fr - d : pret);
        r[e.id] = { debut, fin: fr ?? debut + d, reel: true };
      } else if (e.statut === 'saute') {
        r[e.id] = { debut: pret, fin: pret, saute: true };
      } else if (e.statut === 'en-cours') {
        const debut = dr ?? (actif && now !== null ? Math.max(pret, now) : pret);
        r[e.id] = { debut, fin: Math.max(debut + d, actif && now !== null ? now : 0), reel: dr !== null };
      } else {
        const debut = actif && now !== null ? Math.max(pret, now) : pret;
        r[e.id] = { debut, fin: debut + d };
      }
    }
    return r;
  }
  const finMax = (h, defaut) => Object.values(h).reduce((m, x) => Math.max(m, x.fin), defaut);
  // Durée du plan de retour arrière (chemin le plus long de ses étapes).
  function dureeRepli(liste) {
    const rep = liste.filter((e) => groupe(e) === 'repli');
    return rep.length ? finMax(planifier(rep, 0), 0) : 0;
  }

  // ---------- Synthèse d'une bascule ----------
  // Statuts : preparation · en-cours · terminee · repli (retour arrière lancé) · revenue (retour arrière fini).
  function synthese(etat, b, now) {
    const rg = etat.reglages || {};
    const tri = etapesDe(etat, b.id);
    const main = tri.filter((e) => groupe(e) === 'principal');
    const rep = tri.filter((e) => groupe(e) === 'repli');
    const debut = estDH(b.debut) ? versMin(b.debut) : now;
    const fenetre = estDH(b.finFenetre) ? versMin(b.finFenetre) : null;
    const repliLance = estDH(b.repliLance) ? versMin(b.repliLance) : null;
    const prevu = planifier(main, debut);
    const prevuFin = finMax(prevu, debut);
    const mainFinie = main.length > 0 && main.every(finie);
    const lancee = main.some((e) => e.statut !== 'a-faire') || now >= debut;
    const estime = planifier(main, debut, { mode: 'estime', now, actif: lancee && !mainFinie && repliLance === null });
    const estimeFinMain = finMax(estime, debut);
    const dRepli = dureeRepli(tri);
    const limite = estDH(b.limiteRetour) ? versMin(b.limiteRetour) : (fenetre !== null && rep.length ? fenetre - dRepli : null);
    const departRepli = repliLance ?? limite ?? fenetre ?? prevuFin;
    const repliFini = rep.length > 0 && rep.every(finie);
    const prevuRepli = planifier(rep, departRepli);
    const estimeRepli = planifier(rep, departRepli, { mode: 'estime', now, actif: repliLance !== null && !repliFini });
    let statut = 'preparation';
    if (repliLance !== null) statut = repliFini ? 'revenue' : 'repli';
    else if (mainFinie) statut = 'terminee';
    else if (lancee) statut = 'en-cours';
    const courant = repliLance !== null ? rep : main;
    const est = { ...estime, ...estimeRepli };
    const prev = { ...prevu, ...prevuRepli };
    const parDebut = (l) => [...l].sort((a, b2) => est[a.id].debut - est[b2.id].debut || a.ordre - b2.ordre);
    const enCours = courant.filter((e) => e.statut === 'en-cours');
    const restantes = parDebut(courant.filter((e) => e.statut === 'a-faire' || e.statut === 'bloque'));
    const prochaineDecision = repliLance === null ? parDebut(main.filter((e) => e.type === 'go' && !finie(e)))[0] || null : null;
    const estimeFin = repliLance !== null ? finMax(estimeRepli, repliLance) : estimeFinMain;
    const faites = courant.filter(finie).length;
    const s = {
      bascule: b, statut, debut, fenetre, now,
      prevu: prev, estime: est, prevuFin, estimeFin,
      retard: repliLance !== null ? null : estimeFinMain - prevuFin,
      marge: fenetre !== null ? fenetre - estimeFin : null,
      limite, dureeRepli: dRepli, repliLance,
      principal: main, repli: rep, courant,
      avancement: { faites, total: courant.length, pct: courant.length ? Math.round((faites / courant.length) * 100) : 0 },
      enCours, prochaine: restantes[0] || null, restantes, prochaineDecision,
      bloquees: courant.filter((e) => e.statut === 'bloque'),
      retardEtape: (id) => (est[id] && prev[id] ? est[id].fin - prev[id].fin : 0),
    };
    s.alertes = alertes(etat, s, rg);
    return s;
  }

  // ---------- Alertes ----------
  // niveau : rouge (agir), jaune (surveiller), info (à préparer).
  function alertes(etat, s, rg) {
    const l = [];
    const b = s.bascule;
    const now = s.now;
    const tol = Number(rg.toleranceMinutes ?? 10);
    const proche = Number(rg.alerteMinutes ?? 15);
    const margeRetour = Number(rg.margeRetourMinutes ?? 30);
    const incs = (etat.incidents || []).filter((i) => i.basculeId === b.id && !i.resolu);
    const vivante = s.statut === 'en-cours' || s.statut === 'repli';
    if (vivante) {
      for (const e of s.bloquees) l.push({ niveau: 'rouge', type: 'bloque', etapeId: e.id, texte: `Étape bloquée : ${e.titre}` });
      for (const i of incs.filter((x) => x.gravite === 'bloquant')) l.push({ niveau: 'rouge', type: 'incident', incidentId: i.id, texte: `Incident bloquant ouvert : ${i.titre}` });
      if (s.fenetre !== null && s.estimeFin > s.fenetre) l.push({ niveau: 'rouge', type: 'fenetre', texte: `Fin estimée ${heure(s.estimeFin)}, après la fin de fenêtre (${heure(s.fenetre)}) de ${dureeTexte(s.estimeFin - s.fenetre)}` });
      if (s.statut === 'en-cours' && s.limite !== null && s.repli.length) {
        const reste = s.limite - now;
        if (reste < 0) l.push({ niveau: 'jaune', type: 'limite', texte: `Limite de décision de retour arrière dépassée depuis ${dureeTexte(-reste)} (${heure(s.limite)}) : un retour arrière ne tiendrait plus dans la fenêtre` });
        else if (reste <= margeRetour) l.push({ niveau: s.marge !== null && s.marge < 0 ? 'rouge' : 'jaune', type: 'limite', texte: `Retour arrière possible jusqu'à ${heure(s.limite)} : encore ${dureeTexte(reste)} pour décider` });
      }
      for (const e of s.enCours) {
        const dr = estDH(e.debutReel) ? versMin(e.debutReel) : null;
        if (dr !== null && now - dr > (Number(e.duree) || 0) + tol) l.push({ niveau: 'jaune', type: 'depassement', etapeId: e.id, texte: `${e.titre} : en cours depuis ${dureeTexte(now - dr)} (prévu ${dureeTexte(e.duree)})` });
      }
      for (const i of incs.filter((x) => x.gravite === 'majeur')) l.push({ niveau: 'jaune', type: 'incident', incidentId: i.id, texte: `Incident majeur ouvert : ${i.titre}` });
      const d = s.prochaineDecision;
      if (d && d.statut !== 'bloque') {
        const dans = s.estime[d.id].debut - now;
        const manque = (d.criteres || []).filter((c) => !c.ok).length;
        if (dans <= proche && manque) l.push({ niveau: 'jaune', type: 'criteres', etapeId: d.id, texte: `${d.titre} ${dans > 0 ? `dans ${dureeTexte(dans)}` : 'maintenant'} : ${manque} critère${manque > 1 ? 's' : ''} non coché${manque > 1 ? 's' : ''}` });
      }
      if (s.retard !== null && s.retard > tol && !l.some((a) => a.type === 'fenetre')) l.push({ niveau: 'jaune', type: 'retard', texte: `Retard cumulé de ${dureeTexte(s.retard)} : fin estimée ${heure(s.estimeFin)}` });
    }
    if (s.statut === 'preparation' || s.statut === 'en-cours') {
      const sans = s.principal.concat(s.repli).filter((e) => !e.responsable && !finie(e));
      if (sans.length) l.push({ niveau: 'info', type: 'responsable', texte: `${sans.length} étape${sans.length > 1 ? 's' : ''} sans responsable` });
      const goSans = s.principal.filter((e) => e.type === 'go' && !(e.criteres || []).length);
      if (goSans.length) l.push({ niveau: 'info', type: 'go-vide', etapeId: goSans[0].id, texte: `${goSans.length} point${goSans.length > 1 ? 's' : ''} go/no-go sans critère` });
      if (!s.repli.length) l.push({ niveau: 'info', type: 'sans-repli', texte: 'Aucun plan de retour arrière : ajoute ses étapes (phase « Retour arrière »)' });
      if (s.fenetre === null) l.push({ niveau: 'info', type: 'sans-fenetre', texte: 'Aucune fin de fenêtre : la marge et la limite de retour arrière ne se calculent pas' });
      else if (s.statut === 'preparation' && s.prevuFin > s.fenetre) l.push({ niveau: 'rouge', type: 'plan-long', texte: `Le déroulé prévu finit à ${heure(s.prevuFin)}, après la fin de fenêtre (${heure(s.fenetre)})` });
    }
    const rang = { rouge: 0, jaune: 1, info: 2 };
    return l.sort((a, b2) => rang[a.niveau] - rang[b2.niveau]);
  }

  // Critères d'un point go/no-go : cochés, total, tous cochés.
  function etatCriteres(e) {
    const c = e.criteres || [];
    const ok = c.filter((x) => x.ok).length;
    return { ok, total: c.length, tous: c.length > 0 && ok === c.length };
  }

  // ---------- Point de situation, chronologie, bilan ----------
  const LIB_STATUT = { preparation: 'En préparation', 'en-cours': 'En cours', terminee: 'Terminée', repli: 'Retour arrière en cours', revenue: 'Retour arrière effectué' };
  const LIB_GRAVITE = { mineur: 'mineur', majeur: 'majeur', bloquant: 'bloquant' };

  function pointSituation(etat, s) {
    const b = s.bascule;
    const nomM = (id) => { const m = (etat.membres || []).find((x) => x.id === id); return m ? (m.nom || m.role) : ''; };
    const L = [];
    L.push(`POINT DE SITUATION · ${b.nom}`);
    L.push(`${dateFrLongue(dateDe(s.now))} à ${heure(s.now)} · ${LIB_STATUT[s.statut]}`);
    L.push('');
    L.push(`Avancement : ${s.avancement.faites}/${s.avancement.total} étapes${s.repliLance !== null ? ' du retour arrière' : ''} (${s.avancement.pct} %)`);
    if (s.retard !== null) L.push(`Retard cumulé : ${ecartTexte(s.retard)} · fin estimée ${heure(s.estimeFin)} (prévue ${heure(s.prevuFin)})`);
    else L.push(`Retour arrière lancé à ${heure(s.repliLance)} · fin estimée ${heure(s.estimeFin)}`);
    if (s.fenetre !== null) L.push(`Fin de fenêtre : ${heure(s.fenetre)} · marge ${s.marge >= 0 ? dureeTexte(s.marge) : `dépassée de ${dureeTexte(-s.marge)}`}`);
    if (s.statut === 'en-cours' && s.limite !== null && s.repli.length) L.push(`Retour arrière possible jusqu'à ${heure(s.limite)} (durée du plan : ${dureeTexte(s.dureeRepli)})`);
    if (s.enCours.length) {
      L.push('', 'En cours :');
      for (const e of s.enCours) L.push(`- ${e.titre}${e.responsable ? ` (${nomM(e.responsable)})` : ''}, depuis ${estDH(e.debutReel) ? heure(versMin(e.debutReel)) : '?'}`);
    }
    if (s.bloquees.length) {
      L.push('', 'Bloqué :');
      for (const e of s.bloquees) L.push(`- ${e.titre}${e.note ? ` : ${e.note}` : ''}`);
    }
    const suivantes = s.restantes.filter((e) => e.statut === 'a-faire').slice(0, 3);
    if (suivantes.length) {
      L.push('', 'À suivre :');
      for (const e of suivantes) L.push(`- ${heure(s.estime[e.id].debut)} ${e.titre}${e.responsable ? ` (${nomM(e.responsable)})` : ''}`);
    }
    if (s.prochaineDecision) {
      const d = s.prochaineDecision, c = etatCriteres(d);
      L.push('', `Prochaine décision : ${d.titre} vers ${heure(s.estime[d.id].debut)}${d.responsable ? `, ${nomM(d.responsable)}` : ''} · critères ${c.ok}/${c.total}`);
    }
    const incs = (etat.incidents || []).filter((i) => i.basculeId === b.id && !i.resolu).sort((a, b2) => (a.heure < b2.heure ? -1 : 1));
    L.push('', incs.length ? `Incidents ouverts (${incs.length}) :` : 'Aucun incident ouvert.');
    for (const i of incs) L.push(`- ${heure(versMin(i.heure))} [${LIB_GRAVITE[i.gravite]}] ${i.titre}${i.action ? ` · action : ${i.action}` : ''}`);
    return L.join('\n');
  }
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const dateFrLongue = (s) => { const d = versDate(s); return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`; };

  // Chronologie : départs, fins, décisions, incidents et retour arrière, dans l'ordre des heures.
  function chronologie(etat, basculeId) {
    const b = (etat.bascules || []).find((x) => x.id === basculeId);
    const ev = [];
    const pousser = (dh, type, texte, ref = {}) => { if (estDH(dh)) ev.push({ quand: versMin(dh), dh, type, texte, ...ref }); };
    for (const e of etapesDe(etat, basculeId)) {
      if (e.type === 'go' && e.decision) pousser(e.finReel || e.debutReel, 'decision', `${e.titre} : ${e.decision === 'go' ? 'GO' : 'NO-GO'}${e.commentaire ? ` (${e.commentaire})` : ''}`, { etapeId: e.id, decision: e.decision });
      else {
        pousser(e.debutReel, 'debut', `Début : ${e.titre}`, { etapeId: e.id });
        if (e.statut === 'fait') pousser(e.finReel, 'fin', `Fin : ${e.titre}`, { etapeId: e.id });
      }
    }
    for (const i of (etat.incidents || []).filter((x) => x.basculeId === basculeId)) {
      pousser(i.heure, 'incident', `Incident ${LIB_GRAVITE[i.gravite]} : ${i.titre}`, { incidentId: i.id, gravite: i.gravite });
      if (i.resolu) pousser(i.heureResolution, 'resolution', `Résolu : ${i.titre}`, { incidentId: i.id });
    }
    if (b && estDH(b.repliLance)) pousser(b.repliLance, 'repli', 'Retour arrière lancé');
    const rang = { repli: 0, decision: 1, incident: 2, fin: 3, debut: 4, resolution: 5 };
    return ev.sort((a, b2) => a.quand - b2.quand || rang[a.type] - rang[b2.type]);
  }

  // Bilan d'une bascule : écart de chaque étape faite (durée réelle − prévue), les plus longues d'abord.
  function bilan(etat, s) {
    const ecarts = s.courant.filter((e) => e.statut === 'fait' && estDH(e.debutReel) && estDH(e.finReel)).map((e) => {
      const reelle = versMin(e.finReel) - versMin(e.debutReel);
      return { etape: e, prevue: Number(e.duree) || 0, reelle, ecart: reelle - (Number(e.duree) || 0) };
    }).sort((a, b) => b.ecart - a.ecart);
    const incs = (etat.incidents || []).filter((i) => i.basculeId === s.bascule.id);
    return {
      ecarts,
      depassees: ecarts.filter((x) => x.ecart > 0),
      incidents: { total: incs.length, ouverts: incs.filter((i) => !i.resolu).length, bloquants: incs.filter((i) => i.gravite === 'bloquant').length, majeurs: incs.filter((i) => i.gravite === 'majeur').length },
    };
  }

  // ---------- Export CSV ----------
  function champCsv(v) {
    let s = typeof v === 'number' ? String(v).replace('.', ',') : String(v ?? '');
    if (typeof v !== 'number' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`; // formules neutralisées
    return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
  const versCsv = (lignes) => `﻿${lignes.map((l) => l.map(champCsv).join(';')).join('\r\n')}\r\n`;
  const LIB_ETAT = { 'a-faire': 'À faire', 'en-cours': 'En cours', fait: 'Fait', bloque: 'Bloqué', saute: 'Sauté' };
  const LIB_TYPE = { action: 'Étape', go: 'Go/no-go', arret: 'Point d\'arrêt' };
  function csvDeroule(etat, base, s) {
    const nomM = (id) => { const m = (etat.membres || []).find((x) => x.id === id); return m ? [m.nom, m.role].filter(Boolean).join(' · ') : ''; };
    const phase = (c) => (base.phases.find((p) => p.code === c) || {}).nom || c;
    const lignes = [['Phase', 'Étape', 'Type', 'Responsable', 'Durée prévue (min)', 'Début prévu', 'Fin prévue', 'Début estimé ou réel', 'Fin estimée ou réelle', 'Statut', 'Écart à la fin (min)', 'Décision', 'Note']];
    for (const e of s.principal.concat(s.repli)) {
      const p = s.prevu[e.id], x = s.estime[e.id];
      lignes.push([phase(e.phase), e.titre, LIB_TYPE[e.type], nomM(e.responsable), Number(e.duree) || 0, depuisMin(p.debut).replace('T', ' '), depuisMin(p.fin).replace('T', ' '),
        depuisMin(x.debut).replace('T', ' '), depuisMin(x.fin).replace('T', ' '), LIB_ETAT[e.statut], x.fin - p.fin, e.decision ? e.decision.toUpperCase() : '', e.note || '']);
    }
    return versCsv(lignes);
  }

  // ---------- Modèles et duplication ----------
  // Crée une bascule depuis un modèle de la base : équipe (un membre par rôle utilisé), étapes,
  // dépendances (indices du modèle → identifiants) et critères des points go/no-go.
  function depuisModele(base, code, { nom, debut, finFenetre = '', lieu = '' }) {
    const mod = base.modeles.find((m) => m.code === code) || base.modeles[0];
    const b = normaliserBascule({ id: nouvelId(), nom: nom || mod.nom, modele: mod.code, debut, finFenetre, lieu, objectif: mod.objectif || '' });
    const roles = [...new Set((mod.etapes || []).map((e) => e.r).filter(Boolean).concat('PIL'))];
    const membres = roles.map((r) => normaliserMembre({ id: nouvelId(), basculeId: b.id, nom: '', role: (base.roles.find((x) => x.code === r) || { nom: r }).nom }));
    const parRole = Object.fromEntries(roles.map((r, i) => [r, membres[i].id]));
    const ids = (mod.etapes || []).map(() => nouvelId());
    const etapes = (mod.etapes || []).map((x, i) => normaliserEtape({
      id: ids[i], basculeId: b.id, ordre: (i + 1) * 10, phase: x.p, titre: x.t, type: x.type || 'action', duree: x.d,
      responsable: x.r ? parRole[x.r] : '', apres: Array.isArray(x.apres) ? x.apres.map((k) => ids[k]) : null,
      criteres: (x.c || []).map((texte) => ({ id: nouvelId(), texte, ok: false })), note: x.n || '',
    }));
    return { bascule: b, etapes, membres };
  }
  // Copie d'une bascule (répétition, nouvelle date) : statuts, heures réelles, décisions et critères
  // remis à zéro, horaires fixes décalés. dureesReelles : reprend la durée mesurée des étapes faites.
  function dupliquer(etat, id, { nom, debut, dureesReelles = false }) {
    const src = (etat.bascules || []).find((x) => x.id === id);
    if (!src || !estDH(debut)) return null;
    const delta = versMin(debut) - versMin(src.debut);
    const dec = (dh) => (estDH(dh) ? depuisMin(versMin(dh) + delta) : '');
    const b = normaliserBascule({ ...src, id: nouvelId(), nom: nom || `${src.nom} (copie)`, debut, finFenetre: dec(src.finFenetre), limiteRetour: dec(src.limiteRetour), repliLance: '', archivee: false, creeLe: '' });
    const carteM = {};
    const membres = (etat.membres || []).filter((m) => m.basculeId === id).map((m) => { const n = normaliserMembre({ ...m, id: nouvelId(), basculeId: b.id }); carteM[m.id] = n.id; return n; });
    const src2 = etapesDe(etat, id);
    const carteE = Object.fromEntries(src2.map((e) => [e.id, nouvelId()]));
    const etapes = src2.map((e) => {
      let duree = e.duree;
      if (dureesReelles && e.statut === 'fait' && estDH(e.debutReel) && estDH(e.finReel)) duree = Math.max(0, versMin(e.finReel) - versMin(e.debutReel));
      return normaliserEtape({
        ...e, id: carteE[e.id], basculeId: b.id, duree, responsable: carteM[e.responsable] || '', decideur: carteM[e.decideur] || '',
        apres: Array.isArray(e.apres) ? e.apres.map((p) => carteE[p]).filter(Boolean) : null, pasAvant: dec(e.pasAvant),
        statut: 'a-faire', debutReel: '', finReel: '', decision: '', commentaire: '', criteres: (e.criteres || []).map((c) => ({ id: nouvelId(), texte: c.texte, ok: false })),
      });
    });
    return { bascule: b, etapes, membres };
  }

  // ---------- Normalisation ----------
  const txt = (v, n = 200) => String(v ?? '').slice(0, n);
  const dh = (v) => (estDH(v) ? v : '');
  function normaliserBascule(x) {
    return {
      id: x.id || nouvelId(), nom: txt(x.nom, 120) || 'Bascule', modele: txt(x.modele, 20), debut: estDH(x.debut) ? x.debut : '2026-01-01T20:00',
      finFenetre: dh(x.finFenetre), limiteRetour: dh(x.limiteRetour), lieu: txt(x.lieu, 120), objectif: txt(x.objectif, 600),
      repliLance: dh(x.repliLance), archivee: x.archivee === true, creeLe: txt(x.creeLe, 10),
    };
  }
  function normaliserEtape(x) {
    const duree = Math.round(Number(x.duree));
    return {
      id: x.id || nouvelId(), basculeId: x.basculeId || '', ordre: Number.isFinite(Number(x.ordre)) ? Number(x.ordre) : 0,
      phase: txt(x.phase, 20) || 'bascule', titre: txt(x.titre, 160) || 'Étape', type: TYPES.includes(x.type) ? x.type : 'action',
      duree: Number.isFinite(duree) && duree >= 0 ? Math.min(duree, 10080) : 0, responsable: txt(x.responsable, 40),
      apres: Array.isArray(x.apres) ? x.apres.map(String) : null, pasAvant: dh(x.pasAvant),
      statut: STATUTS.includes(x.statut) ? x.statut : 'a-faire', debutReel: dh(x.debutReel), finReel: dh(x.finReel), note: txt(x.note, 600),
      criteres: (Array.isArray(x.criteres) ? x.criteres : []).map((c) => ({ id: c.id || nouvelId(), texte: txt(c.texte, 200), ok: c.ok === true })),
      decision: x.decision === 'go' || x.decision === 'nogo' ? x.decision : '', decideur: txt(x.decideur, 40), commentaire: txt(x.commentaire, 400),
    };
  }
  function normaliserMembre(x) {
    return { id: x.id || nouvelId(), basculeId: x.basculeId || '', nom: txt(x.nom, 80), role: txt(x.role, 80), organisation: txt(x.organisation, 80), joignable: txt(x.joignable, 120), note: txt(x.note, 300) };
  }
  function normaliserIncident(x) {
    return {
      id: x.id || nouvelId(), basculeId: x.basculeId || '', heure: estDH(x.heure) ? x.heure : '2026-01-01T00:00',
      gravite: ['mineur', 'majeur', 'bloquant'].includes(x.gravite) ? x.gravite : 'mineur', etapeId: txt(x.etapeId, 40), titre: txt(x.titre, 160) || 'Incident',
      action: txt(x.action, 600), responsable: txt(x.responsable, 40), resolu: x.resolu === true, heureResolution: dh(x.heureResolution),
    };
  }
  function normaliserReglages(r, defaut) {
    const o = { ...defaut };
    for (const k of Object.keys(defaut)) { const n = Number(r?.[k]); if (Number.isFinite(n) && n >= 0) o[k] = Math.round(n); }
    return o;
  }
  const etatVide = (base) => ({ version: 1, reglages: { ...base.reglages }, bascules: [], etapes: [], membres: [], incidents: [] });
  function normaliser(d, base) {
    const v = etatVide(base);
    if (!d || typeof d !== 'object') return v;
    const liste = (l, f) => (Array.isArray(l) ? l : []).map(f);
    return {
      ...v, ...d,
      reglages: normaliserReglages(d.reglages, base.reglages),
      bascules: liste(d.bascules, normaliserBascule),
      etapes: liste(d.etapes, normaliserEtape),
      membres: liste(d.membres, normaliserMembre),
      incidents: liste(d.incidents, normaliserIncident),
    };
  }
  function supprimerBascule(etat, id) {
    const garde = (l) => (l || []).filter((x) => x.basculeId !== id);
    return { ...etat, bascules: etat.bascules.filter((b) => b.id !== id), etapes: garde(etat.etapes), membres: garde(etat.membres), incidents: garde(etat.incidents) };
  }
  // Retire un membre : ses étapes et incidents perdent leur responsable.
  function supprimerMembre(etat, id) {
    const libre = (x) => ({ ...x, responsable: x.responsable === id ? '' : x.responsable, ...(x.decideur !== undefined ? { decideur: x.decideur === id ? '' : x.decideur } : {}) });
    return { ...etat, membres: etat.membres.filter((m) => m.id !== id), etapes: etat.etapes.map(libre), incidents: etat.incidents.map(libre) };
  }
  const taille = (etat) => new TextEncoder().encode(JSON.stringify(etat)).length;

  g.BSC = {
    iso, versDate, ajout, ecart, estDate, estDH, versMin, depuisMin, maintenant, heure, dateDe, dureeTexte, ecartTexte, lireDuree, heureVersDH, dateFrLongue, plat, nouvelId,
    STATUTS, TYPES, LIB_STATUT, LIB_ETAT, LIB_TYPE, groupe, finie, trier, etapesDe, predecesseurs, creeCycle, retirerEtape, ordreCalcul, planifier, dureeRepli,
    synthese, alertes, etatCriteres, pointSituation, chronologie, bilan, champCsv, versCsv, csvDeroule, depuisModele, dupliquer,
    normaliserBascule, normaliserEtape, normaliserMembre, normaliserIncident, normaliserReglages, etatVide, normaliser, supprimerBascule, supprimerMembre, taille,
  };
})(typeof window !== 'undefined' ? window : globalThis);
