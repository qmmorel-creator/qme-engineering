// Emploi du temps d'établissement QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.EDT) et par les tests Node (outils/templates/emploi-du-temps.test.mjs).
// Dates locales « AAAA-MM-JJ », heures « HH:MM ». Une séance est datée : elle a un jour, une heure de début et
// une heure de fin, un module (qui donne le groupe), un formateur et une salle. Tout ce qui dépend du moment
// présent reçoit `maintenant` ({ date, heure }) : rien n'est lu dans l'horloge ici.
// Aucune optimisation automatique : ces règles détectent et comptent, elles ne placent rien.
(function (g) {
  'use strict';

  // ---------- Dates et heures ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = String(s).slice(0, 10).split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  const estHeure = (s) => typeof s === 'string' && /^\d{2}:\d{2}$/.test(s) && Number(s.slice(0, 2)) < 24 && Number(s.slice(3)) < 60;
  const hMin = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
  const minH = (n) => `${deux(Math.floor(n / 60))}:${deux(n % 60)}`;
  // Jour de la semaine : 1 = lundi … 7 = dimanche.
  const jourSem = (s) => ((versDate(s).getDay() + 6) % 7) + 1;
  const lundi = (s) => ajout(s, 1 - jourSem(s));
  function numeroSemaine(s) { // semaine ISO 8601
    const jeudi = ajout(s, 4 - jourSem(s));
    const debutAn = `${jeudi.slice(0, 4)}-01-01`;
    return Math.floor(ecart(debutAn, jeudi) / 7) + 1;
  }
  const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const JOURS_COURTS = ['', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const dateFrLongue = (s) => { const d = versDate(s); return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`; };
  const dateFr = (s) => { const d = versDate(s); return `${d.getDate()} ${MOIS[d.getMonth()]}`; };
  // « 1 h 30 », « 45 min », « 12 h ».
  function dureeTexte(minutes) {
    const n = Math.round(Math.abs(Number(minutes) || 0));
    const s = Number(minutes) < 0 ? '−' : '';
    if (n < 60) return `${s}${n} min`;
    const h = Math.floor(n / 60), r = n % 60;
    return `${s}${h} h${r ? ` ${deux(r)}` : ''}`;
  }
  // Heures décimales lisibles : 12,5 → « 12,5 h ».
  const heuresTexte = (minutes) => `${String(Math.round((minutes / 60) * 10) / 10).replace('.', ',')} h`;
  const plat = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36).slice(-5)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

  // ---------- Jours fériés (France) ----------
  // Pâques (algorithme de Meeus / Jones / Butcher, calendrier grégorien).
  function paques(annee) {
    const a = annee % 19, b = Math.floor(annee / 100), c = annee % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), gg = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - gg + 15) % 30, i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mois = Math.floor((h + l - 7 * m + 114) / 31), jour = ((h + l - 7 * m + 114) % 31) + 1;
    return `${annee}-${deux(mois)}-${deux(jour)}`;
  }
  // Les 11 fêtes légales (article L3133-1 du Code du travail), plus Vendredi saint et 26 décembre
  // en Alsace-Moselle si demandé.
  function feries(annee, alsaceMoselle = false) {
    const p = paques(annee);
    const f = (m, j) => `${annee}-${deux(m)}-${deux(j)}`;
    const l = [
      [f(1, 1), 'Jour de l\'an'], [ajout(p, 1), 'Lundi de Pâques'], [f(5, 1), 'Fête du Travail'], [f(5, 8), 'Victoire 1945'],
      [ajout(p, 39), 'Ascension'], [ajout(p, 50), 'Lundi de Pentecôte'], [f(7, 14), 'Fête nationale'], [f(8, 15), 'Assomption'],
      [f(11, 1), 'Toussaint'], [f(11, 11), 'Armistice 1918'], [f(12, 25), 'Noël'],
    ];
    if (alsaceMoselle) l.push([ajout(p, -2), 'Vendredi saint'], [f(12, 26), 'Saint-Étienne']);
    return l.map(([date, nom]) => ({ date, nom })).sort((x, y) => x.date.localeCompare(y.date));
  }
  const cacheFeries = new Map();
  function nomFerie(date, alsaceMoselle = false) {
    const cle = `${date.slice(0, 4)}-${alsaceMoselle ? 1 : 0}`;
    if (!cacheFeries.has(cle)) cacheFeries.set(cle, new Map(feries(Number(date.slice(0, 4)), alsaceMoselle).map((x) => [x.date, x.nom])));
    return cacheFeries.get(cle).get(date) || '';
  }
  function feriesEntre(debut, fin, alsaceMoselle = false) {
    const l = [];
    for (let a = Number(debut.slice(0, 4)); a <= Number(fin.slice(0, 4)); a++) l.push(...feries(a, alsaceMoselle));
    return l.filter((x) => x.date >= debut && x.date <= fin);
  }

  // ---------- Calendrier de l'établissement ----------
  // Jour fermé : férié, fermeture saisie, ou jour non travaillé. Renvoie { type, nom } ou null.
  function fermeture(etat, date) {
    const r = etat.reglages;
    if (!r.jours.includes(jourSem(date))) return { type: 'jour', nom: 'Jour non travaillé' };
    const ferie = nomFerie(date, r.alsaceMoselle);
    if (ferie) return { type: 'ferie', nom: ferie };
    const f = (etat.fermetures || []).find((x) => date >= x.debut && date <= x.fin);
    return f ? { type: 'fermeture', nom: f.nom || 'Fermeture' } : null;
  }
  const joursDeSemaine = (etat, l) => etat.reglages.jours.map((j) => ajout(l, j - 1));
  const semaineFermee = (etat, l) => joursDeSemaine(etat, l).every((d) => fermeture(etat, d));
  // Semaines de l'année (lundis) entre le début et la fin, avec leur type A ou B : l'alternance ne
  // compte que les semaines ouvertes (une semaine entièrement fermée ne change pas le type).
  function semainesAnnee(etat) {
    const r = etat.reglages;
    if (!estDate(r.debut) || !estDate(r.fin) || r.fin < r.debut) return [];
    const l = [];
    let n = 0;
    for (let s = lundi(r.debut); s <= r.fin && l.length < 120; s = ajout(s, 7)) {
      const fermee = semaineFermee(etat, s);
      l.push({ lundi: s, numero: numeroSemaine(s), fermee, type: r.alternance && !fermee ? (n % 2 ? 'B' : 'A') : '' });
      if (!fermee) n++;
    }
    return l;
  }
  function typeSemaine(etat, date) {
    const s = semainesAnnee(etat).find((x) => x.lundi === lundi(date));
    return s ? s.type : '';
  }

  // ---------- Séances ----------
  const duree = (s) => Math.max(0, hMin(s.fin) - hMin(s.debut));
  const actives = (etat) => (etat.seances || []).filter((s) => !s.annulee);
  const chevauche = (a, b) => a.date === b.date && hMin(a.debut) < hMin(b.fin) && hMin(b.debut) < hMin(a.fin);
  const parId = (l) => new Map((l || []).map((x) => [x.id, x]));
  const groupeDe = (etat, s) => { const m = (etat.modules || []).find((x) => x.id === s.module); return m ? m.groupe : ''; };
  const trierSeances = (l) => [...l].sort((a, b) => a.date.localeCompare(b.date) || a.debut.localeCompare(b.debut) || String(a.id).localeCompare(String(b.id)));
  // Indices des créneaux qu'une séance recouvre.
  const creneauxCouverts = (s, creneaux) => creneaux.map((c, i) => (hMin(s.debut) < hMin(c.fin) && hMin(c.debut) < hMin(s.fin) ? i : -1)).filter((i) => i >= 0);
  // Séances d'une ressource : type 'groupe' | 'formateur' | 'salle' | 'module' | 'tout'.
  function concerne(etat, s, type, id, modules) {
    if (type === 'tout') return true;
    if (type === 'groupe') { const m = (modules || parId(etat.modules)).get(s.module); return !!m && m.groupe === id; }
    return s[type] === id;
  }
  const seancesDe = (etat, type, id, debut, fin) => {
    const mods = parId(etat.modules);
    return trierSeances((etat.seances || []).filter((s) => s.date >= debut && s.date <= fin && concerne(etat, s, type, id, mods)));
  };
  function validerSeance(etat, s) {
    if (!estDate(s.date)) return 'Indique le jour de la séance.';
    if (!estHeure(s.debut) || !estHeure(s.fin)) return 'Indique l\'heure de début et l\'heure de fin.';
    if (hMin(s.fin) <= hMin(s.debut)) return 'L\'heure de fin doit être après l\'heure de début.';
    if (!(etat.modules || []).some((m) => m.id === s.module)) return 'Choisis le module (il donne le groupe).';
    return '';
  }

  // ---------- Conflits ----------
  // Gravité : 'rouge' (impossible tel quel), 'jaune' (à vérifier), 'info' (incomplet).
  const TYPES_CONFLIT = {
    formateur: { gravite: 'rouge', nom: 'Formateur en double' },
    salle: { gravite: 'rouge', nom: 'Salle en double' },
    groupe: { gravite: 'rouge', nom: 'Groupe en double' },
    ferme: { gravite: 'rouge', nom: 'Jour fermé' },
    capacite: { gravite: 'jaune', nom: 'Salle trop petite' },
    indispo: { gravite: 'jaune', nom: 'Formateur indisponible' },
    equipement: { gravite: 'jaune', nom: 'Équipement manquant' },
    volume: { gravite: 'jaune', nom: 'Volume prévu dépassé' },
    quota: { gravite: 'jaune', nom: 'Quota du formateur dépassé' },
    incomplet: { gravite: 'info', nom: 'Séance incomplète' },
  };
  const ORDRE_GRAVITE = { rouge: 0, jaune: 1, info: 2 };
  // Disponibilités d'un formateur : liste « jour-idCréneau » des créneaux hebdomadaires où il n'est pas
  // disponible, et absences datées (début, fin), sans motif.
  function formateurIndisponible(etat, f, s) {
    if ((f.absences || []).some((a) => s.date >= a.debut && s.date <= a.fin)) return 'absent ce jour-là';
    const j = jourSem(s.date);
    const c = (etat.reglages.creneaux || []).find((x) => f.indispos.includes(`${j}-${x.id}`) && hMin(s.debut) < hMin(x.fin) && hMin(x.debut) < hMin(s.fin));
    return c ? `indisponible le ${JOURS[j % 7]} ${c.debut}-${c.fin}` : '';
  }

  // Détection complète. Renvoie la liste des conflits (chacun lié à une ou plusieurs séances) et un
  // index par séance. Les séances annulées sont ignorées.
  function conflits(etat) {
    const mods = parId(etat.modules), forms = parId(etat.formateurs), salles = parId(etat.salles), groupes = parId(etat.groupes);
    const liste = [];
    const ajouter = (type, seances, texte, extra = {}) => liste.push({ type, gravite: TYPES_CONFLIT[type].gravite, seances: seances.map((s) => s.id), date: seances[0]?.date || '', debut: seances[0]?.debut || '', texte, ...extra });
    const act = trierSeances(actives(etat));
    const nomG = (id) => groupes.get(id)?.nom || 'groupe';
    // Doubles réservations, jour par jour.
    const parJour = new Map();
    for (const s of act) { if (!parJour.has(s.date)) parJour.set(s.date, []); parJour.get(s.date).push(s); }
    for (const jour of parJour.values()) {
      for (let i = 0; i < jour.length; i++) {
        for (let k = i + 1; k < jour.length; k++) {
          const a = jour[i], b = jour[k];
          if (!chevauche(a, b)) continue;
          if (a.formateur && a.formateur === b.formateur) ajouter('formateur', [a, b], `${forms.get(a.formateur)?.nom || 'Formateur'} a deux séances en même temps`, { ressource: a.formateur });
          if (a.salle && a.salle === b.salle) ajouter('salle', [a, b], `${salles.get(a.salle)?.nom || 'Salle'} est occupée deux fois`, { ressource: a.salle });
          const ga = mods.get(a.module)?.groupe, gb = mods.get(b.module)?.groupe;
          if (ga && ga === gb) ajouter('groupe', [a, b], `${nomG(ga)} a deux séances en même temps`, { ressource: ga });
        }
      }
    }
    // Contrôles séance par séance.
    for (const s of act) {
      const m = mods.get(s.module), f = forms.get(s.formateur), sa = salles.get(s.salle), gr = m ? groupes.get(m.groupe) : null;
      const fe = fermeture(etat, s.date);
      if (fe) ajouter('ferme', [s], `${fe.nom} : aucune séance ne devrait avoir lieu`);
      if (sa && gr && sa.capacite > 0 && gr.effectif > sa.capacite) ajouter('capacite', [s], `${sa.nom} : ${sa.capacite} places pour ${gr.effectif} personnes (${gr.nom})`, { ressource: sa.id });
      if (sa && m && m.equipement && !sa.equipements.includes(m.equipement)) ajouter('equipement', [s], `${m.nom} demande « ${m.equipement} », absent de ${sa.nom}`, { ressource: sa.id });
      if (f) { const raison = formateurIndisponible(etat, f, s); if (raison) ajouter('indispo', [s], `${f.nom} : ${raison}`, { ressource: f.id }); }
      const manque = [!s.formateur && 'formateur', !s.salle && 'salle'].filter(Boolean);
      if (manque.length) ajouter('incomplet', [s], `Séance sans ${manque.join(' ni ')}`);
    }
    // Volumes : chaque séance qui fait passer le module au-delà de son volume prévu.
    const cumul = (cle, plafond, seances, type, texte) => {
      let total = 0;
      for (const s of seances) {
        total += duree(s);
        if (total > plafond) ajouter(type, [s], texte(total), { ressource: cle });
      }
    };
    for (const m of etat.modules || []) {
      if (!(m.volume > 0)) continue;
      cumul(m.id, m.volume * 60, act.filter((s) => s.module === m.id), 'volume', (t) => `${m.nom} (${nomG(m.groupe)}) : ${heuresTexte(t)} placées pour ${heuresTexte(m.volume * 60)} prévues`);
    }
    for (const f of etat.formateurs || []) {
      if (!(f.quota > 0)) continue;
      cumul(f.id, f.quota * 60, act.filter((s) => s.formateur === f.id), 'quota', (t) => `${f.nom} : ${heuresTexte(t)} placées pour un quota de ${heuresTexte(f.quota * 60)}`);
    }
    liste.sort((a, b) => a.date.localeCompare(b.date) || a.debut.localeCompare(b.debut) || ORDRE_GRAVITE[a.gravite] - ORDRE_GRAVITE[b.gravite]);
    const parSeance = new Map();
    for (const c of liste) for (const id of c.seances) { if (!parSeance.has(id)) parSeance.set(id, []); parSeance.get(id).push(c); }
    return { liste, parSeance };
  }
  // Gravité la plus forte d'une liste de conflits (ou '').
  const graviteMax = (l) => (l && l.length ? l.reduce((g2, c) => (ORDRE_GRAVITE[c.gravite] < ORDRE_GRAVITE[g2] ? c.gravite : g2), 'info') : '');

  // ---------- Heures ----------
  const realisee = (s, maintenant) => s.date < maintenant.date || (s.date === maintenant.date && s.fin <= maintenant.heure);
  // Prévu (volume), placé (toutes les séances non annulées), réalisé (séances passées), par module et
  // par formateur, en minutes.
  function heures(etat, maintenant) {
    const act = actives(etat);
    const parModule = (etat.modules || []).map((m) => {
      const l = act.filter((s) => s.module === m.id);
      const place = l.reduce((t, s) => t + duree(s), 0);
      const realise = l.filter((s) => realisee(s, maintenant)).reduce((t, s) => t + duree(s), 0);
      const prevu = (m.volume || 0) * 60;
      return { id: m.id, groupe: m.groupe, prevu, place, realise, reste: prevu ? prevu - place : 0, seances: l.length, depasse: prevu > 0 && place > prevu };
    });
    const parFormateur = (etat.formateurs || []).map((f) => {
      const l = act.filter((s) => s.formateur === f.id);
      const place = l.reduce((t, s) => t + duree(s), 0);
      const realise = l.filter((s) => realisee(s, maintenant)).reduce((t, s) => t + duree(s), 0);
      const quota = (f.quota || 0) * 60;
      return { id: f.id, quota, place, realise, seances: l.length, depasse: quota > 0 && place > quota };
    });
    const parGroupe = (etat.groupes || []).map((gr) => {
      const ms = parModule.filter((m) => m.groupe === gr.id);
      return { id: gr.id, prevu: ms.reduce((t, m) => t + m.prevu, 0), place: ms.reduce((t, m) => t + m.place, 0), realise: ms.reduce((t, m) => t + m.realise, 0) };
    });
    return { parModule, parFormateur, parGroupe };
  }
  const totalMinutes = (l) => l.reduce((t, s) => t + (s.annulee ? 0 : duree(s)), 0);

  // ---------- Duplication de semaine ----------
  // Semaines cibles après `source` jusqu'à `jusqua` (incluse), semaines entièrement fermées exclues ;
  // avec `memeType`, seulement les semaines du même type A ou B que la source.
  function ciblesDuplication(etat, source, { jusqua, memeType = false } = {}) {
    const sem = semainesAnnee(etat);
    const typeSource = (sem.find((x) => x.lundi === lundi(source)) || {}).type || '';
    const fin = estDate(jusqua) ? jusqua : etat.reglages.fin;
    return sem.filter((x) => x.lundi > lundi(source) && x.lundi <= fin && !x.fermee && (!memeType || !typeSource || x.type === typeSource)).map((x) => x.lundi);
  }
  // Recopie les séances (non annulées) de la semaine `source` qui concernent `portee` sur chaque semaine
  // cible. Les jours fermés de la cible sont sautés ; avec `remplacer`, les séances de la portée déjà
  // présentes dans la semaine cible sont d'abord retirées. Renvoie un nouvel état et un bilan.
  function dupliquerSemaine(etat, source, cibles, { portee = { type: 'tout' }, remplacer = false } = {}) {
    const l0 = lundi(source), fin0 = ajout(l0, 6);
    const mods = parId(etat.modules);
    const dans = (s, l) => s.date >= l && s.date <= ajout(l, 6) && concerne(etat, s, portee.type, portee.id, mods);
    const modele = (etat.seances || []).filter((s) => !s.annulee && s.date >= l0 && s.date <= fin0 && concerne(etat, s, portee.type, portee.id, mods));
    let seances = [...(etat.seances || [])];
    let ajoutees = 0, sautees = 0, retirees = 0;
    for (const c of cibles.map(lundi)) {
      if (c === l0) continue;
      if (remplacer) { const avant = seances.length; seances = seances.filter((s) => !dans(s, c)); retirees += avant - seances.length; }
      for (const s of modele) {
        const date = ajout(c, ecart(l0, s.date));
        if (fermeture(etat, date)) { sautees++; continue; }
        seances.push({ ...s, id: nouvelId(), date });
        ajoutees++;
      }
    }
    return { etat: { ...etat, seances }, ajoutees, sautees, retirees, modele: modele.length };
  }

  // ---------- Ressources ----------
  // Ce que supprimerait la suppression d'une ressource.
  function impactSuppression(etat, type, id) {
    if (type === 'groupe') {
      const ms = (etat.modules || []).filter((m) => m.groupe === id).map((m) => m.id);
      return { modules: ms.length, seances: (etat.seances || []).filter((s) => ms.includes(s.module)).length };
    }
    if (type === 'module') return { modules: 1, seances: (etat.seances || []).filter((s) => s.module === id).length };
    return { modules: 0, seances: (etat.seances || []).filter((s) => s[type] === id).length };
  }
  // Groupe : ses modules et leurs séances partent avec lui. Module : ses séances. Formateur ou salle :
  // les séances restent, « à désigner ».
  function supprimerRessource(etat, type, id) {
    const e = { ...etat };
    if (type === 'groupe') {
      const ms = new Set((etat.modules || []).filter((m) => m.groupe === id).map((m) => m.id));
      e.groupes = etat.groupes.filter((x) => x.id !== id);
      e.modules = etat.modules.filter((m) => !ms.has(m.id));
      e.seances = etat.seances.filter((s) => !ms.has(s.module));
    } else if (type === 'module') {
      e.modules = etat.modules.filter((m) => m.id !== id);
      e.seances = etat.seances.filter((s) => s.module !== id);
    } else if (type === 'formateur') {
      e.formateurs = etat.formateurs.filter((x) => x.id !== id);
      e.modules = etat.modules.map((m) => (m.formateur === id ? { ...m, formateur: '' } : m));
      e.seances = etat.seances.map((s) => (s.formateur === id ? { ...s, formateur: '' } : s));
    } else if (type === 'salle') {
      e.salles = etat.salles.filter((x) => x.id !== id);
      e.seances = etat.seances.map((s) => (s.salle === id ? { ...s, salle: '' } : s));
    }
    return e;
  }
  // Retire les séances antérieures à `date` (après export), pour alléger les données.
  function purgerAvant(etat, date) {
    const seances = (etat.seances || []).filter((s) => s.date >= date);
    return { etat: { ...etat, seances }, retirees: (etat.seances || []).length - seances.length };
  }

  // ---------- Export CSV ----------
  function champCsv(v) {
    let s = typeof v === 'number' ? String(v).replace('.', ',') : String(v ?? '');
    if (typeof v !== 'number' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`; // formules neutralisées
    return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
  const versCsv = (lignes) => `﻿${lignes.map((l) => l.map(champCsv).join(';')).join('\r\n')}\r\n`;
  const arrondi = (m) => Math.round((m / 60) * 100) / 100;
  // Séances d'une période (toutes ressources, ou une seule), avec leurs conflits.
  function csvSeances(etat, { debut, fin, type = 'tout', id = '' } = {}) {
    const mods = parId(etat.modules), forms = parId(etat.formateurs), salles = parId(etat.salles), groupes = parId(etat.groupes);
    const { parSeance } = conflits(etat);
    const sem = new Map(semainesAnnee(etat).map((x) => [x.lundi, x]));
    const lignes = [['Date', 'Jour', 'Semaine', 'Type de semaine', 'Début', 'Fin', 'Durée (h)', 'Groupe', 'Effectif', 'Module', 'Formateur', 'Salle', 'Statut', 'Conflits', 'Note']];
    for (const s of seancesDe(etat, type, id, debut || '0000-01-01', fin || '9999-12-31')) {
      const m = mods.get(s.module), gr = m ? groupes.get(m.groupe) : null, w = sem.get(lundi(s.date));
      lignes.push([s.date, JOURS[versDate(s.date).getDay()], numeroSemaine(s.date), w?.type || '', s.debut, s.fin, arrondi(duree(s)), gr?.nom || '', gr ? gr.effectif : '', m?.nom || '', forms.get(s.formateur)?.nom || '', salles.get(s.salle)?.nom || '', s.annulee ? 'Annulée' : 'Prévue', s.annulee ? '' : (parSeance.get(s.id) || []).map((c) => TYPES_CONFLIT[c.type].nom).join(', '), s.note || '']);
    }
    return versCsv(lignes);
  }
  function csvHeures(etat, maintenant) {
    const h = heures(etat, maintenant);
    const groupes = parId(etat.groupes), forms = parId(etat.formateurs), mods = parId(etat.modules);
    const lignes = [['Type', 'Nom', 'Groupe', 'Prévu ou quota (h)', 'Placé (h)', 'Réalisé (h)', 'Reste à placer (h)', 'Séances']];
    for (const m of h.parModule) lignes.push(['Module', mods.get(m.id).nom, groupes.get(m.groupe)?.nom || '', arrondi(m.prevu), arrondi(m.place), arrondi(m.realise), m.prevu ? arrondi(m.reste) : '', m.seances]);
    for (const f of h.parFormateur) lignes.push(['Formateur', forms.get(f.id).nom, '', f.quota ? arrondi(f.quota) : '', arrondi(f.place), arrondi(f.realise), f.quota ? arrondi(f.quota - f.place) : '', f.seances]);
    return versCsv(lignes);
  }

  // ---------- Normalisation (tolérante aux anciennes versions et aux imports) ----------
  const txt = (v, n = 120) => String(v ?? '').trim().slice(0, n);
  const ent = (v, min, max) => { const n = Math.round(Number(String(v ?? '').replace(',', '.'))); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min; };
  const dec = (v, max) => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) && n > 0 ? Math.min(max, Math.round(n * 4) / 4) : 0; };
  const idOk = (v) => (typeof v === 'string' && v ? v.slice(0, 40) : nouvelId());
  function normaliserCreneau(c) {
    const debut = estHeure(c?.debut) ? c.debut : '08:00';
    const fin = estHeure(c?.fin) && hMin(c.fin) > hMin(debut) ? c.fin : minH(Math.min(1439, hMin(debut) + 60));
    return { id: idOk(c?.id), debut, fin };
  }
  const trierCreneaux = (l) => [...l].sort((a, b) => a.debut.localeCompare(b.debut));
  function normaliserReglages(r, base) {
    const d = r && typeof r === 'object' ? r : {};
    const jours = Array.isArray(d.jours) ? [...new Set(d.jours.map(Number).filter((j) => Number.isInteger(j) && j >= 1 && j <= 6))].sort() : [...base.reglages.jours];
    return {
      etablissement: txt(d.etablissement, 80),
      jours: jours.length ? jours : [...base.reglages.jours],
      creneaux: trierCreneaux((Array.isArray(d.creneaux) ? d.creneaux : []).map(normaliserCreneau)).slice(0, 16),
      alternance: d.alternance === true,
      alsaceMoselle: d.alsaceMoselle === true,
      debut: estDate(d.debut) ? d.debut : '',
      fin: estDate(d.fin) ? d.fin : '',
      equipements: Array.isArray(d.equipements) ? [...new Set(d.equipements.map((x) => txt(x, 40)).filter(Boolean))].slice(0, 30) : [...base.equipements],
    };
  }
  const normaliserGroupe = (x) => ({ id: idOk(x?.id), nom: txt(x?.nom, 60) || 'Groupe', effectif: ent(x?.effectif, 0, 999) });
  const normaliserAbsence = (a) => (estDate(a?.debut) ? { debut: a.debut, fin: estDate(a.fin) && a.fin >= a.debut ? a.fin : a.debut } : null);
  const normaliserFormateur = (x) => ({
    id: idOk(x?.id), nom: txt(x?.nom, 60) || 'Formateur', quota: dec(x?.quota, 5000),
    indispos: Array.isArray(x?.indispos) ? [...new Set(x.indispos.filter((k) => typeof k === 'string' && /^[1-7]-/.test(k)).map((k) => k.slice(0, 48)))] : [],
    absences: (Array.isArray(x?.absences) ? x.absences : []).map(normaliserAbsence).filter(Boolean).slice(0, 60),
  });
  const normaliserSalle = (x) => ({ id: idOk(x?.id), nom: txt(x?.nom, 60) || 'Salle', capacite: ent(x?.capacite, 0, 9999), equipements: Array.isArray(x?.equipements) ? [...new Set(x.equipements.map((e) => txt(e, 40)).filter(Boolean))] : [] });
  const normaliserModule = (x) => ({ id: idOk(x?.id), nom: txt(x?.nom, 80) || 'Module', groupe: txt(x?.groupe, 40), formateur: txt(x?.formateur, 40), volume: dec(x?.volume, 5000), equipement: txt(x?.equipement, 40), couleur: ent(x?.couleur, 0, 7) });
  function normaliserSeance(x) {
    const s = { id: idOk(x?.id), date: estDate(x?.date) ? x.date : '', debut: estHeure(x?.debut) ? x.debut : '08:00', fin: estHeure(x?.fin) ? x.fin : '09:00', module: txt(x?.module, 40), formateur: txt(x?.formateur, 40), salle: txt(x?.salle, 40) };
    if (hMin(s.fin) <= hMin(s.debut)) s.fin = minH(Math.min(1439, hMin(s.debut) + 60));
    const note = txt(x?.note, 200);
    if (note) s.note = note; // champs vides omis : les données restent légères
    if (x?.annulee === true) s.annulee = true;
    return s;
  }
  const normaliserFermeture = (x) => { const debut = estDate(x?.debut) ? x.debut : ''; return { id: idOk(x?.id), nom: txt(x?.nom, 60) || 'Fermeture', debut, fin: estDate(x?.fin) && x.fin >= debut ? x.fin : debut }; };
  const etatVide = (base) => ({ version: 1, reglages: normaliserReglages({}, base), groupes: [], formateurs: [], salles: [], modules: [], seances: [], fermetures: [] });
  function normaliser(d, base) {
    const v = etatVide(base);
    if (!d || typeof d !== 'object') return v;
    const liste = (l, f) => (Array.isArray(l) ? l : []).map(f);
    return {
      ...v, ...d,
      reglages: normaliserReglages(d.reglages, base),
      groupes: liste(d.groupes, normaliserGroupe),
      formateurs: liste(d.formateurs, normaliserFormateur),
      salles: liste(d.salles, normaliserSalle),
      modules: liste(d.modules, normaliserModule),
      seances: liste(d.seances, normaliserSeance).filter((s) => s.date),
      fermetures: liste(d.fermetures, normaliserFermeture).filter((f) => f.debut),
    };
  }
  const taille = (etat) => new TextEncoder().encode(JSON.stringify(etat)).length;

  // Année proposée : la rentrée de septembre qui précède (ou suit en été) la date donnée.
  function anneeProposee(date) {
    const a = Number(date.slice(0, 4)), m = Number(date.slice(5, 7));
    const an = m >= 8 ? a : a - 1;
    const premierLundi = (d) => ajout(d, (8 - jourSem(d)) % 7);
    return { debut: premierLundi(`${an}-09-01`), fin: `${an + 1}-07-03` };
  }

  g.EDT = {
    deux, iso, versDate, ajout, ecart, estDate, estHeure, hMin, minH, jourSem, lundi, numeroSemaine, JOURS, JOURS_COURTS, MOIS, dateFrLongue, dateFr, dureeTexte, heuresTexte, plat, nouvelId,
    paques, feries, nomFerie, feriesEntre, fermeture, joursDeSemaine, semaineFermee, semainesAnnee, typeSemaine, anneeProposee,
    duree, actives, chevauche, groupeDe, trierSeances, creneauxCouverts, concerne, seancesDe, validerSeance,
    TYPES_CONFLIT, formateurIndisponible, conflits, graviteMax, realisee, heures, totalMinutes,
    ciblesDuplication, dupliquerSemaine, impactSuppression, supprimerRessource, purgerAvant,
    champCsv, versCsv, csvSeances, csvHeures,
    normaliserReglages, normaliserGroupe, normaliserFormateur, normaliserSalle, normaliserModule, normaliserSeance, normaliserFermeture, normaliserCreneau, etatVide, normaliser, taille,
  };
})(typeof window !== 'undefined' ? window : globalThis);
