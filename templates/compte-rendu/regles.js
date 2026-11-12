// Règles métier du compte rendu et plan d'actions : fonctions pures, sans DOM ni stockage.
// Chargé par l'application (window.REGLES) et par les tests (outils/templates/compte-rendu.test.mjs).
(function (g) {
  'use strict';

  // ---------- Dates locales au format AAAA-MM-JJ ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ajoutMois = (s, n) => { const d = versDate(s); return iso(new Date(d.getFullYear(), d.getMonth() + n, 1)); };
  const finMois = (s) => { const d = versDate(s); return iso(new Date(d.getFullYear(), d.getMonth() + 1, 0)); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const jourSemaine = (s) => versDate(s).getDay(); // 0 = dimanche
  const dateValide = (a, m, j) => { const d = new Date(a, m - 1, j); return d.getFullYear() === a && d.getMonth() === m - 1 && d.getDate() === j; };

  const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const MOIS_PLATS = MOIS.map((m) => plat(m));

  // Date lisible : « lundi 16 novembre 2026 », « lun. 16 nov. », « 16/11 ».
  function dateLongue(s, annee = true) {
    const d = versDate(s);
    return `${JOURS[d.getDay()]} ${d.getDate() === 1 ? '1er' : d.getDate()} ${MOIS[d.getMonth()]}${annee ? ` ${d.getFullYear()}` : ''}`;
  }
  function dateCourte(s) {
    const d = versDate(s);
    return `${JOURS[d.getDay()].slice(0, 3)}. ${d.getDate()}/${deux(d.getMonth() + 1)}`;
  }

  // Minuscules sans accents, même longueur que le texte d'origine (les positions restent valables).
  function plat(t) {
    const table = { à: 'a', â: 'a', ä: 'a', á: 'a', ç: 'c', é: 'e', è: 'e', ê: 'e', ë: 'e', î: 'i', ï: 'i', í: 'i', ô: 'o', ö: 'o', ó: 'o', ù: 'u', û: 'u', ü: 'u', ú: 'u', ÿ: 'y', œ: 'o', æ: 'a', '’': "'", '‘': "'", 'ʼ': "'", ' ': ' ' };
    return [...String(t)].map((c) => { const l = c.toLowerCase(); return l.length === 1 ? (table[l] ?? l) : c; }).join('');
  }

  // ---------- Échéances en français ----------
  const NOMBRES = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, dix: 10, quinze: 15 };
  const B0 = '(?<![a-z0-9])';
  const B1 = '(?![a-z0-9])';
  // Prépositions qui introduisent une échéance ; retirées du texte de l'action avec la date.
  const PREP = "(?:(?:au plus tard|avant le|avant|pour le|pour|d'ici le|d'ici au|d'ici a|d'ici|jusqu'au|jusqu'a|des le|le|au|a|de|du|echeance)\\s+|,\\s*)?";

  // Prochain jour de semaine (0 à 6) strictement après aujourd'hui ; « ce vendredi » le jour même = aujourd'hui.
  function prochainJour(auj, cible, ce) {
    const n = (cible - jourSemaine(auj) + 7) % 7;
    return ajout(auj, n === 0 ? (ce ? 0 : 7) : n);
  }
  // Vendredi de la semaine en cours (ou de la suivante le week-end).
  function vendredi(auj, semaines = 0) {
    const j = jourSemaine(auj);
    const lundi = ajout(auj, -((j + 6) % 7));
    const v = ajout(lundi, 4 + 7 * semaines);
    return semaines === 0 && v < auj ? ajout(v, 7) : v;
  }

  const MOTIFS = [
    { re: "aujourd'hui|ce soir|ce jour|dans la journee", f: (m, auj) => auj },
    { re: 'apres[- ]demain', f: (m, auj) => ajout(auj, 2) },
    { re: '(?<!apres[- ])demain', f: (m, auj) => ajout(auj, 1) },
    { re: 'j\\s*\\+\\s*(\\d{1,3})', f: (m, auj) => ajout(auj, Number(m[1])) },
    { re: 'dans (\\d{1,3}|un|une|deux|trois|quatre|cinq|six|sept|huit|dix|quinze) (jours?|semaines?|mois)', f: (m, auj) => {
      const n = /^\d+$/.test(m[1]) ? Number(m[1]) : NOMBRES[m[1]];
      if (m[2].startsWith('mois')) { const d = versDate(auj); const c = new Date(d.getFullYear(), d.getMonth() + n, d.getDate()); return c.getDate() === d.getDate() ? iso(c) : iso(new Date(d.getFullYear(), d.getMonth() + n + 1, 0)); }
      return ajout(auj, m[2].startsWith('semaine') ? 7 * n : n);
    } },
    { re: 'fin (?:de la |du |de )?mois prochain', f: (m, auj) => finMois(ajoutMois(auj, 1)) },
    { re: 'fin (?:de |du )?mois', f: (m, auj) => finMois(auj) },
    { re: '(?:la )?fin (?:de la |de )?semaine prochaine', f: (m, auj) => vendredi(auj, 1) },
    { re: 'fin (?:de la |de )?semaine', f: (m, auj) => vendredi(auj) },
    { re: "fin (?:de l'|d')annee", f: (m, auj) => `${versDate(auj).getFullYear()}-12-31` },
    { re: 'debut (?:du |de )?mois prochain', f: (m, auj) => ajoutMois(auj, 1) },
    { re: 'debut (?:de la |de )?semaine prochaine', f: (m, auj) => ajout(vendredi(auj, 1), -4) },
    { re: '(?:la )?semaine prochaine', f: (m, auj) => vendredi(auj, 1) },
    { re: '(?:le )?mois prochain', f: (m, auj) => finMois(ajoutMois(auj, 1)) },
    { re: '(ce |cette )?(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)( prochain)?(?: (?:matin|midi|soir|apres-midi))?', f: (m, auj) => prochainJour(auj, JOURS.indexOf(m[2]), Boolean(m[1]) && !m[3]) },
    { re: '(\\d{4})-(\\d{2})-(\\d{2})', f: (m) => (dateValide(+m[1], +m[2], +m[3]) ? `${m[1]}-${m[2]}-${m[3]}` : null) },
    { re: '(\\d{1,2})[/.](\\d{1,2})(?:[/.](\\d{4}|\\d{2}))?', f: (m, auj) => jourMois(auj, +m[1], +m[2], m[3]) },
    { re: `(1er|\\d{1,2}) (${MOIS_PLATS.join('|')})(?: (\\d{4}))?`, f: (m, auj) => jourMois(auj, m[1] === '1er' ? 1 : +m[1], MOIS_PLATS.indexOf(m[2]) + 1, m[3]) },
  ];

  // Jour et mois sans année : prochaine occurrence à partir d'aujourd'hui.
  function jourMois(auj, j, mo, an) {
    let a = an ? Number(an.length === 2 ? `20${an}` : an) : versDate(auj).getFullYear();
    if (!dateValide(a, mo, j)) return null;
    let s = `${a}-${deux(mo)}-${deux(j)}`;
    if (!an && s < auj) { a += 1; if (!dateValide(a, mo, j)) return null; s = `${a}-${deux(mo)}-${deux(j)}`; }
    return s;
  }

  // Cherche une échéance dans un texte. Renvoie { date, debut, fin } (positions dans le texte, préposition comprise)
  // ou null. En cas de plusieurs dates, celle qui finit le plus loin l'emporte (l'échéance se dit en fin
  // de phrase) ; à fin égale, la plus longue (« après-demain » plutôt que « demain »).
  function lireEcheance(texte, auj) {
    const p = plat(texte);
    let meilleur = null;
    const trouves = [];
    for (const { re, f } of MOTIFS) {
      const rx = new RegExp(`${B0}${PREP}(${re})${B1}`, 'g');
      for (const m of p.matchAll(rx)) {
        const coeur = new RegExp(`^(?:${re})$`).exec(m[1]);
        const date = coeur ? f(coeur, auj) : null;
        if (!date) continue;
        const debut = m.index, fin = m.index + m[0].length;
        trouves.push({ date, debut, fin });
        if (!meilleur || fin > meilleur.fin || (fin === meilleur.fin && debut < meilleur.debut)) meilleur = { date, debut, fin };
      }
    }
    if (!meilleur) return null;
    // « vendredi 20/11 » : une autre date accolée juste avant est retirée avec l'échéance retenue.
    for (let encore = true; encore;) {
      encore = false;
      for (const t of trouves) if (t.fin <= meilleur.debut && t.fin >= meilleur.debut - 1 && /^\s*$/.test(p.slice(t.fin, meilleur.debut))) { meilleur.debut = t.debut; encore = true; }
    }
    meilleur.expression = texte.slice(meilleur.debut, meilleur.fin).replace(/^[\s,]+/, '').trim();
    return meilleur;
  }

  // Saisie rapide : « Marie : envoyer le devis avant vendredi » → responsables, quoi, échéance.
  // « Marie et Paul : … » ou « Marie, Paul : … » donne deux responsables ; « @Marie … » aussi accepté.
  // Un préfixe « … : » n'est un responsable que s'il ressemble à des noms : au plus 4 mots par nom, et
  // chaque mot commence par une majuscule (sauf particules), ou le nom est connu du carnet, ou vaut « moi ».
  function analyserAction(texte, auj, personnes = []) {
    let reste = String(texte || '').replace(/\s+/g, ' ').trim();
    let noms = [];
    const deuxPoints = /^([^:\d]{1,60}?)\s*:\s*(.+)$/.exec(reste);
    const arobase = /^@([^\s:,]+)\s*:?\s*(.+)$/.exec(reste);
    const PARTICULES = /^(de|du|des|la|le|d'|van|von)$/i;
    const mots = (n) => n.replace(/^@/, '').split(/\s+/);
    const ressembleNom = (n) => mots(n).length <= 4 && (
      (/^\p{Lu}/u.test(mots(n)[0]) && mots(n).every((m) => /^\p{Lu}/u.test(m) || PARTICULES.test(m)))
      || /^(moi|je)$/i.test(n) || Boolean(trouverPersonne(n, personnes)));
    if (deuxPoints) {
      const candidats = deuxPoints[1].split(/\s*(?:,|\bet\b|&|\+)\s*/i).map((n) => n.trim()).filter(Boolean);
      if (candidats.length && candidats.every(ressembleNom)) { noms = candidats; reste = deuxPoints[2]; }
    }
    if (!noms.length && arobase) { noms = [arobase[1]]; reste = arobase[2]; }
    noms = noms.map((n) => n.replace(/^@/, '').trim()).filter(Boolean);
    const e = lireEcheance(reste, auj);
    let quoi = reste;
    if (e) quoi = `${reste.slice(0, e.debut)} ${reste.slice(e.fin)}`;
    quoi = quoi.replace(/\s+([,.;!?])/g, '$1').replace(/\s{2,}/g, ' ').replace(/^[\s,;:.–—-]+|[\s,;:.–—-]+$/g, '').trim();
    if (quoi) quoi = quoi[0].toUpperCase() + quoi.slice(1);
    return { responsables: noms, quoi, echeance: e ? e.date : null, expression: e ? e.expression : '' };
  }

  // Retrouve une personne du carnet par son nom complet, son prénom ou son nom de famille (si unique).
  function trouverPersonne(nom, personnes) {
    const n = plat(nom).trim();
    if (!n) return null;
    const exact = personnes.filter((p) => plat(p.nom).trim() === n);
    if (exact.length) return exact[0];
    const partiel = personnes.filter((p) => plat(p.nom).split(/[\s-]+/).includes(n) || plat(p.nom).startsWith(`${n} `));
    return partiel.length === 1 ? partiel[0] : null;
  }

  // ---------- Actions ----------
  const STATUTS = [
    { id: 'afaire', nom: 'À faire' },
    { id: 'encours', nom: 'En cours' },
    { id: 'fait', nom: 'Fait' },
    { id: 'abandonnee', nom: 'Abandonnée' },
  ];
  const estOuverte = (a) => a.statut === 'afaire' || a.statut === 'encours';
  const enRetard = (a, auj) => estOuverte(a) && Boolean(a.echeance) && a.echeance < auj;

  // État affiché : fait, abandonnée, retard, aujourd'hui, semaine (7 jours), à venir, sans date.
  function etatAction(a, auj) {
    if (a.statut === 'fait') return 'fait';
    if (a.statut === 'abandonnee') return 'abandonnee';
    if (!a.echeance) return 'sansdate';
    if (a.echeance < auj) return 'retard';
    if (a.echeance === auj) return 'aujourdhui';
    if (a.echeance <= ajout(auj, 7)) return 'semaine';
    return 'avenir';
  }

  // Ouvertes d'abord (retard, échéance la plus proche, sans date), puis faites et abandonnées.
  function trierActions(liste, auj) {
    const rang = { retard: 0, aujourdhui: 1, semaine: 2, avenir: 3, sansdate: 4, fait: 5, abandonnee: 6 };
    return [...liste].sort((a, b) => {
      const ea = etatAction(a, auj), eb = etatAction(b, auj);
      if (rang[ea] !== rang[eb]) return rang[ea] - rang[eb];
      if (ea === 'fait' || ea === 'abandonnee') return (b.faitLe || '').localeCompare(a.faitLe || '');
      return (a.echeance || '').localeCompare(b.echeance || '') || (a.creeLe || '').localeCompare(b.creeLe || '');
    });
  }

  // Changement de statut : garde la date de clôture (utile pour « fait il y a 3 jours »).
  function changerStatut(a, statut, auj) {
    a.statut = statut;
    a.faitLe = statut === 'fait' || statut === 'abandonnee' ? (a.faitLe || auj) : null;
    return a;
  }
  const STATUT_SUIVANT = { afaire: 'encours', encours: 'fait', fait: 'afaire', abandonnee: 'afaire' };

  // ---------- Séries et report des actions ----------
  // Réunions d'une série, de la plus ancienne à la plus récente (ordre stable par date puis création).
  function reunionsDeSerie(etat, serieId) {
    return etat.reunions.filter((r) => r.serieId === serieId && serieId)
      .sort((a, b) => a.date.localeCompare(b.date) || (a.creeLe || '').localeCompare(b.creeLe || ''));
  }
  // Réunion précédente de la série avant une date (même jour exclu sauf autre réunion déjà créée).
  function reunionPrecedente(etat, serieId, date, saufId) {
    return reunionsDeSerie(etat, serieId).filter((r) => r.id !== saufId && r.date <= date).at(-1) || null;
  }
  // Actions encore ouvertes décidées lors des réunions précédentes de la série : elles sont reprises
  // en « suivi des actions » en tête du compte rendu suivant. Une action reprise et toujours ouverte
  // repart donc à la réunion d'après, jusqu'à sa clôture.
  function actionsAReprendre(etat, serieId, date, saufId) {
    if (!serieId) return [];
    const avant = new Set(reunionsDeSerie(etat, serieId).filter((r) => r.id !== saufId && r.date <= date).map((r) => r.id));
    return etat.actions.filter((a) => avant.has(a.reunionId) && estOuverte(a))
      .sort((a, b) => (a.echeance || '9999').localeCompare(b.echeance || '9999'));
  }

  // Prépare une nouvelle réunion : participants de la précédente, ordre du jour du modèle, suivi des actions.
  function preparerReunion(etat, { serieId = null, date, titre = '', modele = null, lieu = '' }, uid) {
    const serie = etat.series.find((s) => s.id === serieId) || null;
    const prec = serie ? reunionPrecedente(etat, serieId, date) : null;
    const source = modele ? modele.points : prec ? prec.points.map((p) => ({ titre: p.titre, aide: p.aide || '' })) : [{ titre: 'Points divers', aide: '' }];
    return {
      id: uid(),
      serieId: serie ? serie.id : null,
      titre: titre || (serie ? serie.nom : modele ? modele.nom : 'Réunion'),
      date,
      lieu: lieu || (prec ? prec.lieu || '' : ''),
      participants: prec ? [...prec.participants] : serie ? [...(serie.participants || [])] : [],
      points: source.map((p) => ({ id: uid(), titre: p.titre, aide: p.aide || '', notes: '' })),
      decisions: [],
      suivi: actionsAReprendre(etat, serieId, date).map((a) => a.id),
      creeLe: date,
    };
  }

  // ---------- Compte rendu en texte (e-mail) ----------
  function nomPersonne(etat, id) { return etat.personnes.find((p) => p.id === id)?.nom || 'Sans responsable'; }

  function ligneAction(etat, a, auj, avecStatut) {
    const st = STATUTS.find((s) => s.id === a.statut)?.nom || '';
    const ech = a.echeance ? ` · échéance ${dateCourte(a.echeance)}${enRetard(a, auj) ? ' (en retard)' : ''}` : '';
    return `- ${avecStatut ? `[${st}] ` : ''}${nomPersonne(etat, a.responsableId)} : ${a.texte}${ech}`;
  }

  function texteCompteRendu(etat, r, auj) {
    const L = [];
    const serie = etat.series.find((s) => s.id === r.serieId);
    L.push(`Compte rendu · ${r.titre}`);
    L.push(`${dateLongue(r.date)}${r.lieu ? ` · ${r.lieu}` : ''}${serie && serie.nom !== r.titre ? ` · ${serie.nom}` : ''}`);
    const presents = r.participants.map((id) => etat.personnes.find((p) => p.id === id)).filter(Boolean);
    if (presents.length) L.push(`Participants : ${presents.map((p) => (p.role ? `${p.nom} (${p.role})` : p.nom)).join(', ')}`);
    const suivi = r.suivi.map((id) => etat.actions.find((a) => a.id === id)).filter(Boolean);
    if (suivi.length) { L.push('', 'SUIVI DES ACTIONS'); suivi.forEach((a) => L.push(ligneAction(etat, a, auj, true))); }
    const points = r.points.filter((p) => p.titre || p.notes);
    if (points.length) {
      L.push('', 'ORDRE DU JOUR');
      points.forEach((p, i) => {
        L.push(`${i + 1}. ${p.titre || 'Point'}`);
        String(p.notes || '').split('\n').map((x) => x.trim()).filter(Boolean).forEach((x) => L.push(`   ${x}`));
      });
    }
    if (r.decisions.length) { L.push('', 'DÉCISIONS'); r.decisions.forEach((d) => L.push(`- ${d.texte}`)); }
    const actions = etat.actions.filter((a) => a.reunionId === r.id);
    if (actions.length) { L.push('', 'ACTIONS'); trierActions(actions, auj).forEach((a) => L.push(ligneAction(etat, a, auj, false))); }
    return L.join('\n');
  }

  g.REGLES = {
    iso, versDate, ajout, ecart, finMois, jourSemaine, dateLongue, dateCourte, plat, JOURS, MOIS,
    lireEcheance, analyserAction, trouverPersonne,
    STATUTS, STATUT_SUIVANT, estOuverte, enRetard, etatAction, trierActions, changerStatut,
    reunionsDeSerie, reunionPrecedente, actionsAReprendre, preparerReunion, texteCompteRendu,
  };
})(typeof window !== 'undefined' ? window : globalThis);
