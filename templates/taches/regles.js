// Gestionnaire de tâches QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.TCH) et par les tests Node (vm).
// Dates locales au format AAAA-MM-JJ (comparables comme des chaînes), jamais d'heure UTC.
(function (racine) {
  'use strict';

  // ---------- Dates ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j, 12); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  // Jour de la semaine ISO : 1 = lundi … 7 = dimanche.
  const jourSem = (s) => ((versDate(s).getDay() + 6) % 7) + 1;
  const lundiDe = (s) => ajout(s, 1 - jourSem(s));
  const joursDansMois = (a, m) => new Date(a, m, 0).getDate(); // m : 1 à 12
  const dateDe = (a, m, j) => `${a}-${deux(m)}-${deux(j)}`;
  // Ajoute n mois à (année, mois) ; renvoie [année, mois] (mois 1 à 12).
  const moisPlus = (a, m, n) => { const k = a * 12 + (m - 1) + n; return [Math.floor(k / 12), (k % 12) + 1]; };
  const finDeMois = (s) => { const [a, m] = s.split('-').map(Number); return dateDe(a, m, joursDansMois(a, m)); };

  // ---------- Jours fériés (Code du travail, art. L3133-1 ; liste service-public.gouv.fr F2405) ----------
  // Dimanche de Pâques, calendrier grégorien (algorithme anonyme de Meeus/Jones/Butcher).
  function paques(a) {
    const b = a % 19, c = Math.floor(a / 100), d = a % 100, e = Math.floor(c / 4), f = c % 4;
    const g = Math.floor((c + 8) / 25), h = Math.floor((c - g + 1) / 3);
    const i = (19 * b + c - e - h + 15) % 30, k = Math.floor(d / 4), l = d % 4;
    const m = (32 + 2 * f + 2 * k - i - l) % 7, n = Math.floor((b + 11 * i + 22 * m) / 451);
    const mois = Math.floor((i + m - 7 * n + 114) / 31), jour = ((i + m - 7 * n + 114) % 31) + 1;
    return dateDe(a, mois, jour);
  }

  const cacheFeries = new Map();
  // Fêtes légales de l'année : cas général, ou Alsace-Moselle (vendredi saint et 26 décembre en plus).
  function feries(a, alsace = false) {
    const cle = `${a}-${alsace}`;
    if (cacheFeries.has(cle)) return cacheFeries.get(cle);
    const p = paques(a);
    const liste = [
      [dateDe(a, 1, 1), 'Jour de l\'An'], [ajout(p, 1), 'Lundi de Pâques'], [dateDe(a, 5, 1), 'Fête du Travail'],
      [dateDe(a, 5, 8), 'Victoire 1945'], [ajout(p, 39), 'Ascension'], [ajout(p, 50), 'Lundi de Pentecôte'],
      [dateDe(a, 7, 14), 'Fête nationale'], [dateDe(a, 8, 15), 'Assomption'], [dateDe(a, 11, 1), 'Toussaint'],
      [dateDe(a, 11, 11), 'Armistice 1918'], [dateDe(a, 12, 25), 'Noël'],
    ];
    if (alsace) liste.push([ajout(p, -2), 'Vendredi saint'], [dateDe(a, 12, 26), 'Saint-Étienne']);
    const m = new Map(liste.sort((x, y) => x[0].localeCompare(y[0])));
    cacheFeries.set(cle, m);
    return m;
  }
  const nomFerie = (s, cal = {}) => (cal.feries === false ? null : feries(Number(s.slice(0, 4)), !!cal.alsace).get(s) || null);

  // Jour ouvré : du lundi au vendredi, hors jours fériés (si le calendrier en tient compte).
  // cal = { feries: true|false, alsace: true|false }
  const estOuvre = (s, cal = {}) => jourSem(s) <= 5 && !nomFerie(s, cal);
  function ouvreSuivant(s, cal, inclus = false) {
    let d = inclus ? s : ajout(s, 1);
    while (!estOuvre(d, cal)) d = ajout(d, 1);
    return d;
  }
  function ouvrePrecedent(s, cal, inclus = false) {
    let d = inclus ? s : ajout(s, -1);
    while (!estOuvre(d, cal)) d = ajout(d, -1);
    return d;
  }
  // Ajuste une date tombant un jour non ouvré : 'suivant', 'precedent' ou laissée telle quelle.
  function ajuster(s, mode, cal) {
    if (mode === 'suivant') return ouvreSuivant(s, cal, true);
    if (mode === 'precedent') return ouvrePrecedent(s, cal, true);
    return s;
  }
  // k-ième jour ouvré du mois (k = -1 : dernier). null si le mois en compte moins.
  function nemeOuvre(a, m, k, cal) {
    if (k < 0) return ouvrePrecedent(dateDe(a, m, joursDansMois(a, m)), cal, true);
    let d = ouvreSuivant(dateDe(a, m, 1), cal, true);
    for (let i = 1; i < k; i++) d = ouvreSuivant(d, cal);
    return Number(d.slice(5, 7)) === m ? d : null;
  }
  // rang-ième jour j (1 = lundi … 7) du mois ; rang -1 = dernier.
  function nemeJourSemaine(a, m, rang, j) {
    if (rang < 0) {
      const fin = dateDe(a, m, joursDansMois(a, m));
      return ajout(fin, -((jourSem(fin) - j + 7) % 7));
    }
    const debut = dateDe(a, m, 1);
    const d = ajout(debut, ((j - jourSem(debut) + 7) % 7) + 7 * (rang - 1));
    return Number(d.slice(5, 7)) === m ? d : null;
  }

  // ---------- Récurrence ----------
  // rec = { type, n, jours, mode, jour, rang, jourSem, mois, ajuster, depuis, fin }
  //  type 'jour'    : tous les n jours (depuis 'fait' : n jours après la date où la tâche est faite)
  //  type 'ouvre'   : chaque jour ouvré
  //  type 'semaine' : toutes les n semaines, les jours de rec.jours (1 = lundi … 7)
  //  type 'mois'    : tous les n mois ; mode 'date' (le rec.jour, ramené au dernier jour si le mois est
  //                   plus court), 'fin' (dernier jour), 'ouvre' (rec.rang-ième jour ouvré, -1 = dernier),
  //                   'jourSem' (rec.rang-ième rec.jourSem du mois, -1 = dernier)
  //  type 'annee'   : tous les n ans, le rec.jour du rec.mois (29 février → 28 hors années bissextiles)
  //  ajuster : 'suivant' | 'precedent' | null, pour 'mois' (modes date et fin) et 'annee'
  //  fin : dernière date possible (incluse) ou null
  const clampN = (n) => Math.max(1, Math.min(99, Math.round(Number(n) || 1)));

  // Occurrence du mois (a, m) pour une règle mensuelle ou annuelle ; null si elle n'existe pas.
  function occurrenceDuMois(rec, a, m, cal) {
    if (rec.type === 'annee' || rec.mode === 'date' || !rec.mode) {
      const d = dateDe(a, m, Math.min(rec.jour || 1, joursDansMois(a, m)));
      return ajuster(d, rec.ajuster, cal);
    }
    if (rec.mode === 'fin') return ajuster(dateDe(a, m, joursDansMois(a, m)), rec.ajuster, cal);
    if (rec.mode === 'ouvre') return nemeOuvre(a, m, rec.rang || 1, cal);
    if (rec.mode === 'jourSem') return nemeJourSemaine(a, m, rec.rang || 1, rec.jourSem || 1);
    return null;
  }

  // Première occurrence le jour même ou après « depuis ».
  function premiereOccurrence(rec, depuis, cal = {}) {
    if (!rec) return null;
    let d = null;
    if (rec.type === 'jour') d = depuis;
    else if (rec.type === 'ouvre') d = ouvreSuivant(depuis, cal, true);
    else if (rec.type === 'semaine') {
      const jours = (rec.jours && rec.jours.length ? rec.jours : [jourSem(depuis)]);
      for (let i = 0; i < 7 && !d; i++) if (jours.includes(jourSem(ajout(depuis, i)))) d = ajout(depuis, i);
    } else if (rec.type === 'mois' || rec.type === 'annee') {
      const [a0, m0] = depuis.split('-').map(Number);
      for (let k = 0; k < 400 && !d; k++) {
        const [a, m] = rec.type === 'annee' ? [a0 + k, rec.mois || 1] : moisPlus(a0, m0, k);
        const x = occurrenceDuMois(rec, a, m, cal);
        if (x && x >= depuis) d = x;
      }
    }
    return d && rec.fin && d > rec.fin ? null : d;
  }

  // Occurrence suivant celle du « ref » (l'échéance de la tâche ; la date de fin si depuis = 'fait').
  // Strictement après ref ; null si la récurrence est terminée.
  function occurrenceSuivante(rec, ref, cal = {}) {
    if (!rec || !ref) return null;
    const n = clampN(rec.n);
    let d = null;
    if (rec.type === 'jour') d = ajout(ref, n);
    else if (rec.type === 'ouvre') d = ouvreSuivant(ref, cal);
    else if (rec.type === 'semaine') {
      const jours = [...(rec.jours && rec.jours.length ? rec.jours : [jourSem(ref)])].sort((x, y) => x - y);
      const j = jourSem(ref);
      const plusTard = jours.find((x) => x > j);
      d = plusTard ? ajout(ref, plusTard - j) : ajout(lundiDe(ref), 7 * n + jours[0] - 1);
    } else if (rec.type === 'mois' || rec.type === 'annee') {
      // Le mois de l'occurrence est celui de « ref », sauf si un ajustement l'a fait déborder :
      // on repart alors du mois nominal pour ne jamais sauter ni doubler un mois.
      let [a, m] = ref.split('-').map(Number);
      if (rec.type === 'mois' && (rec.mode === 'date' || rec.mode === 'fin' || !rec.mode) && rec.ajuster && occurrenceDuMois(rec, a, m, cal) !== ref) {
        for (const k of [-1, 1]) {
          const [a2, m2] = moisPlus(a, m, k);
          if (occurrenceDuMois(rec, a2, m2, cal) === ref) { [a, m] = [a2, m2]; break; }
        }
      }
      if (rec.type === 'annee' && rec.ajuster && occurrenceDuMois(rec, a, rec.mois || 1, cal) !== ref && occurrenceDuMois(rec, a - 1, rec.mois || 1, cal) === ref) a -= 1;
      for (let k = 1; k < 400 && !d; k++) {
        const [a2, m2] = rec.type === 'annee' ? [a + n * k, rec.mois || 1] : moisPlus(a, m, n * k);
        const x = occurrenceDuMois(rec, a2, m2, cal);
        if (x && x > ref) d = x;
      }
    }
    return d && rec.fin && d > rec.fin ? null : d;
  }

  const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const rangTexte = (r) => (r === -1 ? 'dernier' : r === 1 ? '1er' : `${r}e`);

  function decrireRecurrence(rec) {
    if (!rec) return '';
    const n = clampN(rec.n);
    const aj = rec.ajuster === 'suivant' ? ' (jour ouvré suivant si besoin)' : rec.ajuster === 'precedent' ? ' (jour ouvré précédent si besoin)' : '';
    let s;
    if (rec.type === 'jour') s = rec.depuis === 'fait' ? `${n === 1 ? 'Le lendemain' : `${n} jours après`} de la dernière fois` : n === 1 ? 'Tous les jours' : `Tous les ${n} jours`;
    else if (rec.type === 'ouvre') s = 'Chaque jour ouvré';
    else if (rec.type === 'semaine') {
      const j = (rec.jours || []).slice().sort((a, b) => a - b).map((x) => JOURS[x - 1]).join(', ');
      s = `${n === 1 ? 'Chaque semaine' : `Toutes les ${n} semaines`}${j ? ` : ${j}` : ''}`;
    } else if (rec.type === 'mois') {
      const p = n === 1 ? 'Chaque mois' : `Tous les ${n} mois`;
      if (rec.mode === 'fin') s = `${p}, le dernier jour${aj}`;
      else if (rec.mode === 'ouvre') s = `${p}, le ${rangTexte(rec.rang || 1)} jour ouvré`;
      else if (rec.mode === 'jourSem') s = `${p}, le ${rangTexte(rec.rang || 1)} ${JOURS[(rec.jourSem || 1) - 1]}`;
      else s = `${p}, le ${rec.jour === 1 ? '1er' : rec.jour}${rec.jour > 28 ? ' (ou le dernier jour)' : ''}${aj}`;
    } else if (rec.type === 'annee') s = `${n === 1 ? 'Chaque année' : `Tous les ${n} ans`}, le ${rec.jour === 1 ? '1er' : rec.jour} ${MOIS[(rec.mois || 1) - 1]}${aj}`;
    else return '';
    return rec.fin ? `${s}, jusqu'au ${Number(rec.fin.slice(8))} ${MOIS[Number(rec.fin.slice(5, 7)) - 1]} ${rec.fin.slice(0, 4)}` : s;
  }

  // ---------- Saisie rapide ----------
  // « Appeler la banque demain 14h !haute #Perso 30min »
  // → { titre, echeance, heure, criticite, projet, duree (minutes), recurrence, reconnu: [libellés] }
  const CRITICITES = ['basse', 'normale', 'haute', 'critique'];
  const sansAccent = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const MOIS_RX = 'janv(?:ier)?\\.?|f[ée]vr?(?:ier)?\\.?|mars|avr(?:il)?\\.?|mai|juin|juil(?:let)?\\.?|ao[uû]t|sept(?:embre)?\\.?|oct(?:obre)?\\.?|nov(?:embre)?\\.?|d[ée]c(?:embre)?\\.?';
  const numMois = (s) => {
    const x = sansAccent(s).replace('.', '');
    const pref = ['jan', 'fev', 'mar', 'avr', 'mai', 'juin', 'juil', 'aou', 'sep', 'oct', 'nov', 'dec'];
    return pref.findIndex((p) => x.startsWith(p)) + 1;
  };
  const JOUR_RX = 'lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche';
  const numJour = (s) => JOURS.indexOf(sansAccent(s)) + 1;
  // Prochaine date (le jour même compris) pour un jour et un mois donnés ; l'année suivante si passée.
  function prochainJourMois(t, j, m, a) {
    if (a) { const aa = a < 100 ? 2000 + a : a; return j <= joursDansMois(aa, m) ? dateDe(aa, m, j) : null; }
    let an = Number(t.slice(0, 4));
    for (let k = 0; k < 8; k++, an++) if (j <= joursDansMois(an, m) && dateDe(an, m, j) >= t) return dateDe(an, m, j);
    return null;
  }

  function analyserSaisie(texte, t, options = {}) {
    let s = ` ${String(texte || '').replace(/\s+/g, ' ').trim()} `;
    const r = { titre: '', echeance: null, heure: null, criticite: null, projet: null, duree: null, recurrence: null, reconnu: [] };
    const prendre = (rx, f) => {
      const m = s.match(rx);
      if (!m) return false;
      const ok = f(m);
      if (ok === false) return false;
      s = s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length);
      return true;
    };
    const B = '(?=[\\s,.;!?]|$)'; // fin de mot (les lettres accentuées empêchent \b)
    const D = '(?<=\\s)'; // début de mot

    // Projet : #Perso, #"Mon projet" ou #Mon_projet
    prendre(/(?<=\s)#(?:"([^"]+)"|([^\s#!]+))/, (m) => { r.projet = (m[1] || m[2]).replace(/_/g, ' ').trim(); r.reconnu.push(`Projet ${r.projet}`); });
    // Criticité : !basse !normale !haute !critique (ou !!! = critique, !! = haute)
    prendre(new RegExp(`${D}!(basse|normale|haute|critique|!{1,2})${B}`, 'i'), (m) => {
      const v = m[1].toLowerCase();
      r.criticite = v === '!!' ? 'critique' : v === '!' ? 'haute' : v;
      r.reconnu.push(`Criticité ${r.criticite}`);
    });
    // Récurrence (avant les dates : « chaque lundi » ne doit pas être lu comme « lundi »)
    const rec = (x, lib) => { r.recurrence = x; r.reconnu.push(lib); };
    prendre(new RegExp(`${D}(?:tous les|chaque) jours? ouvr[ée]s?${B}`, 'i'), () => rec({ type: 'ouvre', n: 1 }, 'Chaque jour ouvré'))
      || prendre(new RegExp(`${D}(?:chaque|toutes les) fins? de mois${B}|${D}tous les derniers jours du mois${B}`, 'i'), () => rec({ type: 'mois', n: 1, mode: 'fin' }, 'Chaque fin de mois'))
      || prendre(new RegExp(`${D}(?:tous les|chaque) (${JOUR_RX})s?${B}`, 'i'), (m) => rec({ type: 'semaine', n: 1, jours: [numJour(m[1])] }, `Chaque ${m[1].toLowerCase()}`))
      || prendre(new RegExp(`${D}tous les (\\d{1,2}) jours${B}`, 'i'), (m) => rec({ type: 'jour', n: Number(m[1]) }, `Tous les ${m[1]} jours`))
      || prendre(new RegExp(`${D}toutes les (\\d{1,2}) semaines${B}`, 'i'), (m) => rec({ type: 'semaine', n: Number(m[1]), jours: [] }, `Toutes les ${m[1]} semaines`))
      || prendre(new RegExp(`${D}tous les (\\d{1,2}) mois${B}`, 'i'), (m) => rec({ type: 'mois', n: Number(m[1]), mode: 'date' }, `Tous les ${m[1]} mois`))
      || prendre(new RegExp(`${D}(?:tous les jours|chaque jour|quotidien(?:nement)?)${B}`, 'i'), () => rec({ type: 'jour', n: 1 }, 'Tous les jours'))
      || prendre(new RegExp(`${D}(?:toutes les semaines|chaque semaine|hebdo(?:madaire)?)${B}`, 'i'), () => rec({ type: 'semaine', n: 1, jours: [] }, 'Chaque semaine'))
      || prendre(new RegExp(`${D}(?:tous les mois|chaque mois|mensuel(?:lement)?)${B}`, 'i'), () => rec({ type: 'mois', n: 1, mode: 'date' }, 'Chaque mois'))
      || prendre(new RegExp(`${D}(?:tous les ans|chaque ann[ée]e|annuel(?:lement)?)${B}`, 'i'), () => rec({ type: 'annee', n: 1 }, 'Chaque année'));

    // Durée : 30min, 45 mn, 1h30 / 2h (moins de 6 h), ~3h, pendant 2h, 1,5h
    prendre(new RegExp(`${D}(?:~|pendant |dur[ée]e )?(\\d{1,3}) ?(?:min|mn|minutes?)${B}`, 'i'), (m) => { r.duree = Number(m[1]); })
      || prendre(new RegExp(`${D}(~|pendant |dur[ée]e )(\\d{1,2})(?:[.,](\\d))? ?h(?:eures?)?(\\d{2})?${B}`, 'i'), (m) => { r.duree = Number(m[2]) * 60 + (m[3] ? Number(m[3]) * 6 : 0) + Number(m[4] || 0); })
      || prendre(new RegExp(`${D}([1-5])(?:[.,](\\d))? ?h(\\d{2})?${B}`, 'i'), (m) => {
        if (/(?:^|\s)à\s*$/i.test(s.slice(0, m.index))) return false; // « à 3h » est une heure
        r.duree = Number(m[1]) * 60 + (m[2] ? Number(m[2]) * 6 : 0) + Number(m[3] || 0);
      });
    if (r.duree) r.reconnu.push(`Durée ${dureeTexte(r.duree)}`);
    // Heure : 14h, 9h30, à 8h, 14:30
    prendre(new RegExp(`${D}(?:à )?([01]?\\d|2[0-3])(?:h|:)([0-5]\\d)?${B}`, 'i'), (m) => {
      if (!m[2] && !/h/i.test(m[0])) return false;
      r.heure = `${deux(Number(m[1]))}:${m[2] || '00'}`;
      r.reconnu.push(`À ${m[1]}h${m[2] || ''}`);
    });

    // Dates en français
    const poser = (d, lib) => { if (d) { r.echeance = d; r.reconnu.push(lib); } return !!d; };
    const dateTrouvee =
      prendre(new RegExp(`${D}(?:aujourd'hui|aujourd’hui|auj|ce soir|ce matin|cet après-midi|cet apres-midi)${B}`, 'i'), () => poser(t, 'Aujourd\'hui'))
      || prendre(new RegExp(`${D}apr[eè]s-demain${B}`, 'i'), () => poser(ajout(t, 2), 'Après-demain'))
      || prendre(new RegExp(`${D}demain(?: (?:matin|soir|midi|après-midi))?${B}`, 'i'), () => poser(ajout(t, 1), 'Demain'))
      || prendre(new RegExp(`${D}dans (\\d{1,3}|un|une|deux|trois) (jours?|semaines?|mois)${B}`, 'i'), (m) => {
        const n = { un: 1, une: 1, deux: 2, trois: 3 }[m[1].toLowerCase()] || Number(m[1]);
        const u = sansAccent(m[2]);
        if (u.startsWith('jour')) return poser(ajout(t, n), `Dans ${n} j`);
        if (u.startsWith('semaine')) return poser(ajout(t, 7 * n), `Dans ${n} sem.`);
        const [a, mo] = t.split('-').map(Number); const [a2, m2] = moisPlus(a, mo, n);
        return poser(dateDe(a2, m2, Math.min(Number(t.slice(8)), joursDansMois(a2, m2))), `Dans ${n} mois`);
      })
      || prendre(new RegExp(`${D}(?:en |à la )?fin (?:du |de )?mois${B}`, 'i'), () => poser(finDeMois(t), 'Fin du mois'))
      || prendre(new RegExp(`${D}(?:en |à la )?fin (?:de (?:la )?)?semaine${B}`, 'i'), () => poser(ajout(lundiDe(t), 4) >= t ? ajout(lundiDe(t), 4) : ajout(lundiDe(t), 11), 'Fin de semaine'))
      || prendre(new RegExp(`${D}la semaine prochaine${B}|${D}semaine prochaine${B}`, 'i'), () => poser(ajout(lundiDe(t), 7), 'Lundi prochain'))
      || prendre(new RegExp(`${D}(?:le |la |ce )?(${JOUR_RX})(?: (prochain|en huit))?${B}`, 'i'), (m) => {
        const j = numJour(m[1]);
        let d = ajout(t, ((j - jourSem(t) + 7) % 7) || 7);
        if (m[2] && sansAccent(m[2]) === 'en huit') d = ajout(d, 7);
        return poser(d, m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase());
      })
      || prendre(new RegExp(`${D}(?:le |au |pour le )?(\\d{1,2})/(\\d{1,2})(?:/(\\d{2}|\\d{4}))?${B}`, 'i'), (m) => {
        const j = Number(m[1]), mo = Number(m[2]);
        if (mo < 1 || mo > 12 || j < 1) return false;
        return poser(prochainJourMois(t, j, mo, m[3] ? Number(m[3]) : null), `${j}/${mo}`);
      })
      || prendre(new RegExp(`${D}(?:le |au |pour le )?(1er|\\d{1,2}) (${MOIS_RX})(?: (\\d{4}))?${B}`, 'i'), (m) => {
        const j = m[1] === '1er' ? 1 : Number(m[1]), mo = numMois(m[2]);
        if (!mo || j < 1) return false;
        return poser(prochainJourMois(t, j, mo, m[3] ? Number(m[3]) : null), `${j} ${MOIS[mo - 1]}`);
      })
      || prendre(new RegExp(`${D}(?:le |pour le )(1er|\\d{1,2})${B}`, 'i'), (m) => {
        const j = m[1] === '1er' ? 1 : Number(m[1]);
        if (j < 1 || j > 31) return false;
        let [a, mo] = t.split('-').map(Number);
        for (let k = 0; k < 3; k++) {
          if (j <= joursDansMois(a, mo) && dateDe(a, mo, j) >= t) return poser(dateDe(a, mo, j), `Le ${j}`);
          [a, mo] = moisPlus(a, mo, 1);
        }
        return false;
      });

    // Récurrence sans date : première occurrence à partir d'aujourd'hui, ancrée sur la date donnée sinon.
    if (r.recurrence) {
      const x = r.recurrence;
      const base = r.echeance || t;
      if (x.type === 'semaine' && !x.jours.length) x.jours = [jourSem(base)];
      if (x.type === 'mois' && x.mode === 'date') x.jour = Number(base.slice(8));
      if (x.type === 'annee') { x.jour = Number(base.slice(8)); x.mois = Number(base.slice(5, 7)); }
      if (!r.echeance || !dateTrouvee) r.echeance = premiereOccurrence(x, t, options.cal);
    }
    if (r.heure && !r.echeance) r.echeance = t; // « 14h » seul : aujourd'hui

    r.titre = s.replace(/\s+/g, ' ').replace(/\s+([,.;])/g, '$1').replace(/^[\s,;.-]+|[\s,;-]+$/g, '').trim();
    if (r.titre) r.titre = r.titre.charAt(0).toUpperCase() + r.titre.slice(1);
    return r;
  }

  function dureeTexte(min) {
    if (!min) return '';
    const h = Math.floor(min / 60), m = min % 60;
    return h ? `${h} h${m ? ` ${deux(m)}` : ''}` : `${m} min`;
  }

  // ---------- Tâches ----------
  // Une tâche est terminée quand son statut est le statut « fini » du jeu (ou faitLe renseigné).
  const estFaite = (tache) => !!tache.faitLe;
  const estActive = (tache) => !tache.archiveLe && !tache.faitLe;
  // Bloquée : au moins une tâche « après » existante, ni faite ni archivée.
  function bloquantes(tache, taches) {
    const ids = new Set(tache.apres || []);
    return taches.filter((x) => ids.has(x.id) && x.id !== tache.id && !x.faitLe && !x.archiveLe);
  }
  const estBloquee = (tache, taches) => bloquantes(tache, taches).length > 0;
  // Dépendance circulaire : ajouter « apres » à tache créerait-il une boucle ?
  function creeBoucle(tacheId, apresId, taches) {
    const parId = new Map(taches.map((x) => [x.id, x]));
    const vus = new Set();
    const pile = [apresId];
    while (pile.length) {
      const id = pile.pop();
      if (id === tacheId) return true;
      if (vus.has(id)) continue;
      vus.add(id);
      pile.push(...((parId.get(id) || {}).apres || []));
    }
    return false;
  }

  // Eisenhower : urgent / important → quadrant.
  const QUADRANTS = {
    faire: { nom: 'Faire', detail: 'Urgent et important : aujourd\'hui ou demain.' },
    planifier: { nom: 'Planifier', detail: 'Important, pas urgent : lui donner une date.' },
    expedier: { nom: 'Expédier ou déléguer', detail: 'Urgent, peu important : vite fait, ou par quelqu\'un d\'autre.' },
    abandonner: { nom: 'Abandonner ?', detail: 'Ni urgent ni important : à supprimer ou à garder pour plus tard.' },
  };
  function quadrant(tache) {
    if (tache.urgent == null && tache.important == null) return null;
    if (tache.urgent && tache.important) return 'faire';
    if (tache.important) return 'planifier';
    if (tache.urgent) return 'expedier';
    return 'abandonner';
  }
  // Suggestion d'urgence au triage : échéance passée ou dans les 2 jours.
  const urgenceSuggeree = (tache, t) => !!(tache.echeance && ecart(t, tache.echeance) <= 2);

  // Tranches d'échéance pour la vue Liste.
  function tranche(tache, t) {
    if (!tache.echeance) return 'sansdate';
    const n = ecart(t, tache.echeance);
    if (n < 0) return 'retard';
    if (n === 0) return 'aujourdhui';
    if (n === 1) return 'demain';
    if (tache.echeance <= ajout(lundiDe(t), 6)) return 'semaine';
    if (tache.echeance <= ajout(lundiDe(t), 13)) return 'semaineProchaine';
    return 'plustard';
  }
  const TRANCHES = [['retard', 'En retard'], ['aujourdhui', 'Aujourd\'hui'], ['demain', 'Demain'], ['semaine', 'Cette semaine'],
    ['semaineProchaine', 'La semaine prochaine'], ['plustard', 'Plus tard'], ['sansdate', 'Sans date']];

  // Score de priorité (tri et suggestions du rituel du matin) : plus haut = plus pressant.
  function score(tache, t) {
    let s = { basse: 0, normale: 10, haute: 25, critique: 45 }[tache.criticite || 'normale'] ?? 10;
    const q = quadrant(tache);
    s += { faire: 30, planifier: 15, expedier: 8, abandonner: -15 }[q] || 0;
    if (tache.echeance) {
      const n = ecart(t, tache.echeance);
      s += n < 0 ? 40 + Math.min(20, -n * 2) : n === 0 ? 35 : n === 1 ? 20 : n <= 7 ? 10 - n : 0;
    }
    return s;
  }
  function trier(taches, t) {
    return taches.slice().sort((a, b) => score(b, t) - score(a, t) || (a.echeance || '9999').localeCompare(b.echeance || '9999')
      || (a.heure || '99').localeCompare(b.heure || '99') || String(a.titre).localeCompare(String(b.titre), 'fr'));
  }

  // Candidates au focus du jour : actives, triées (hors boîte de réception), non bloquées,
  // en retard, dues aujourd'hui, critiques/hautes ou « faire ».
  function suggestionsFocus(taches, t, max = 5) {
    const pertinentes = taches.filter((x) => estActive(x) && !x.inbox && !estBloquee(x, taches)
      && ((x.echeance && x.echeance <= t) || quadrant(x) === 'faire' || ['haute', 'critique'].includes(x.criticite) || x.focus === t));
    return trier(pertinentes, t).slice(0, max);
  }

  // Charge d'une liste de tâches en minutes (sans durée : 0) et dépassement de la capacité.
  const charge = (taches) => taches.reduce((n, x) => n + (Number(x.duree) || 0), 0);

  // Tâche suivante d'une tâche récurrente terminée le jour « fait ». null si la série est finie.
  // Les sous-tâches repartent décochées ; la nouvelle tâche garde projet, criticité, durée, heure.
  function prochaineInstance(tache, fait, cal, nouvelId) {
    const rec = tache.recurrence;
    if (!rec) return null;
    let ref = rec.type === 'jour' && rec.depuis === 'fait' ? fait : (tache.echeance || fait);
    let d = occurrenceSuivante(rec, ref, cal);
    // Une série en retard ne recrée pas toutes les occurrences manquées : on saute au futur proche.
    let garde = 0;
    while (d && d <= fait && rec.depuis !== 'fait' && garde++ < 1000) { ref = d; d = occurrenceSuivante(rec, ref, cal); }
    if (!d) return null;
    return {
      ...structuredCloneSimple(tache), id: nouvelId, echeance: d, faitLe: null, archiveLe: null, focus: null, inbox: false,
      sousTaches: (tache.sousTaches || []).map((s) => ({ ...s, fait: false })), creeLe: fait, serie: tache.serie || tache.id,
    };
  }
  const structuredCloneSimple = (o) => JSON.parse(JSON.stringify(o));

  // Bilan d'une journée (clôture du soir).
  function bilanJour(taches, t) {
    const faites = taches.filter((x) => x.faitLe === t);
    const focus = taches.filter((x) => x.focus === t && !x.archiveLe);
    return {
      faites: faites.length,
      minutes: charge(faites),
      focusFaits: focus.filter((x) => x.faitLe).length,
      focusTotal: focus.length,
      restantes: focus.filter((x) => !x.faitLe),
    };
  }

  // Série de jours consécutifs (jusqu'à aujourd'hui ou hier) avec la clôture du soir faite.
  function serieClotures(journal, t) {
    let n = 0;
    for (let d = journal[t]?.soir ? t : ajout(t, -1); journal[d]?.soir; d = ajout(d, -1)) n++;
    return n;
  }

  // Applique un jeu de statuts : les tâches dont le statut disparaît prennent le premier statut
  // (ou le statut « fini » si elles sont faites).
  function appliquerStatuts(taches, statuts) {
    const ids = new Set(statuts.map((s) => s.id));
    const fini = statuts.find((s) => s.fini) || statuts[statuts.length - 1];
    const premier = statuts.find((s) => !s.fini) || statuts[0];
    for (const x of taches) {
      if (x.faitLe) x.statut = fini.id;
      else if (!ids.has(x.statut) || x.statut === fini.id) x.statut = premier.id;
    }
    return taches;
  }

  // Fusion pour la synchronisation : rien à faire ici (le socle garde la version du serveur en cas de
  // conflit). Recherche plein texte tolérante aux accents.
  function correspond(tache, q, projetNom = '') {
    if (!q) return true;
    const h = sansAccent(`${tache.titre} ${tache.note || ''} ${projetNom} ${(tache.sousTaches || []).map((s) => s.titre).join(' ')}`);
    return sansAccent(q).split(/\s+/).filter(Boolean).every((m) => h.includes(m));
  }

  racine.TCH = {
    iso, versDate, ajout, ecart, jourSem, lundiDe, joursDansMois, finDeMois, paques, feries, nomFerie, estOuvre,
    ouvreSuivant, ouvrePrecedent, nemeOuvre, nemeJourSemaine, premiereOccurrence, occurrenceSuivante, decrireRecurrence,
    analyserSaisie, dureeTexte, CRITICITES, JOURS, MOIS, estFaite, estActive, bloquantes, estBloquee, creeBoucle,
    QUADRANTS, quadrant, urgenceSuggeree, tranche, TRANCHES, score, trier, suggestionsFocus, charge, prochaineInstance,
    bilanJour, serieClotures, appliquerStatuts, correspond, sansAccent,
  };
})(typeof window !== 'undefined' ? window : globalThis);
