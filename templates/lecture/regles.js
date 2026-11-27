// Suivi de lecture QME (code PGS ; nouveau nom proposé « Suivi culturel ») · règles métier pures (aucun accès au DOM ni au
// stockage). Chargé tel quel par le navigateur (window.PGS) et par les tests Node (outils/templates/lecture.test.mjs).
// Dates locales « AAAA-MM-JJ ». Cinq médias : livre (pages), livre audio (minutes), film (minutes), série (épisodes,
// répartis en saisons) et podcast (épisodes). Les œuvres restent dans le tableau `livres` (nom historique, gardé pour
// qu'une ancienne version de l'application ouverte sur un autre appareil conserve toutes les fiches et sessions).
// Une session est datée et porte une quantité (pages, minutes ou épisodes). Tout ce qui dépend du jour présent
// reçoit `auj` en paramètre : rien n'est lu dans l'horloge ici.
// Versions des données : 1 = livres seuls (jusqu'au 27/11/2026) ; 2 = champ `media` et objectifs par média. Une
// donnée v1 est une donnée v2 valide : le média se déduit du format (audio → livre audio, sinon livre).
(function (g) {
  'use strict';

  // ---------- Dates ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = String(s).slice(0, 10).split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  const bissextile = (a) => (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;
  const joursAnnee = (a) => (bissextile(a) ? 366 : 365);
  // Rang du jour dans l'année : 1er janvier = 1.
  const jourDeLAnnee = (s) => ecart(`${s.slice(0, 4)}-01-01`, s) + 1;
  const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const dateFrLongue = (s) => { const d = versDate(s); return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`; };
  const dateFr = (s) => { const d = versDate(s); return `${d.getDate()} ${MOIS[d.getMonth()]}`; };
  // « 1 h 30 », « 45 min », « 12 h ».
  function dureeTexte(minutes) {
    const n = Math.round(Math.abs(Number(minutes) || 0));
    if (n < 60) return `${n} min`;
    const h = Math.floor(n / 60), r = n % 60;
    return `${h} h${r ? ` ${deux(r)}` : ''}`;
  }
  // Nombre lisible à la française : 1234,5 → « 1 234,5 » (espace fine insécable).
  function nombreTexte(n, decimales = 0) {
    const v = Number(n) || 0;
    const f = Math.pow(10, decimales);
    const r = Math.round(Math.abs(v) * f) / f;
    const [ent, dec] = r.toFixed(decimales).split('.');
    const groupes = ent.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return `${v < 0 && r !== 0 ? '−' : ''}${groupes}${dec && Number(dec) ? `,${dec.replace(/0+$/, '')}` : ''}`;
  }
  const plat = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36).slice(-5)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

  // ---------- Référentiels ----------
  const VERSION = 2;
  // Formats d'un livre (papier, numérique) ou d'un livre audio (audio). Les autres médias n'ont pas de format.
  const FORMATS = { papier: { nom: 'Papier', unite: 'pages' }, numerique: { nom: 'Numérique', unite: 'pages' }, audio: { nom: 'Audio', unite: 'minutes' } };
  // Médias : unité de progression, libellés (statuts « à … » et « terminé » accordés), créateur, objectif annuel.
  const MEDIAS = {
    livre: { nom: 'Livre', pluriel: 'Livres', unite: 'pages', alire: 'À lire', lu: 'Lu', fem: false, createur: 'Auteur', verbe: 'lu' },
    livreaudio: { nom: 'Livre audio', pluriel: 'Livres audio', unite: 'minutes', alire: 'À écouter', lu: 'Écouté', fem: false, createur: 'Auteur', verbe: 'écouté' },
    film: { nom: 'Film', pluriel: 'Films', unite: 'minutes', alire: 'À voir', lu: 'Vu', fem: false, createur: 'Réalisation', verbe: 'vu' },
    serie: { nom: 'Série', pluriel: 'Séries', unite: 'episodes', alire: 'À voir', lu: 'Vue', fem: true, createur: 'Création', verbe: 'vue' },
    podcast: { nom: 'Podcast', pluriel: 'Podcasts', unite: 'episodes', alire: 'À écouter', lu: 'Écouté', fem: false, createur: 'Animation', verbe: 'écouté' },
  };
  const LIVRES = ['livre', 'livreaudio']; // médias comptés dans l'objectif « livres » (comme avant la v2)
  const STATUTS = { encours: 'En cours', alire: 'À lire', lu: 'Lu', abandonne: 'Abandonné' };
  // Libellés génériques, quand la liste mélange les médias.
  const STATUTS_TOUS = { encours: 'En cours', alire: 'À découvrir', lu: 'Terminé', abandonne: 'Abandonné' };
  const PRIORITES = { 1: 'Prioritaire', 2: 'Bientôt', 3: 'Un jour' };
  // Objectifs annuels : nombre d'œuvres terminées par média, pages lues, épisodes vus ou écoutés (séries et podcasts).
  const OBJECTIFS = ['livres', 'pages', 'films', 'series', 'episodes', 'podcasts'];
  // Média d'une œuvre : champ `media`, sinon déduit du format (données v1).
  const mediaDe = (o) => (MEDIAS[o?.media] ? o.media : o?.format === 'audio' ? 'livreaudio' : 'livre');
  const unite = (o) => MEDIAS[mediaDe(o)].unite;
  const estLivre = (o) => LIVRES.includes(mediaDe(o));
  function statutTexte(statut, media) {
    const m = MEDIAS[media];
    if (!m) return STATUTS_TOUS[statut] || '';
    if (statut === 'alire') return m.alire;
    if (statut === 'lu') return m.lu;
    return statut === 'abandonne' ? (m.fem ? 'Abandonnée' : 'Abandonné') : STATUTS[statut] || '';
  }
  // « 320 pages », « 9 h 30 », « 12 épisodes ».
  function quantiteTexte(q, u) {
    if (u === 'minutes') return dureeTexte(q);
    if (u === 'episodes') return `${nombreTexte(q)} épisode${Math.abs(q) > 1 ? 's' : ''}`;
    return `${nombreTexte(q)} page${Math.abs(q) > 1 ? 's' : ''}`;
  }

  // ---------- Saisons d'une série ----------
  // `saisons` : [{ n, episodes }] dans l'ordre. Le k-ième épisode vu (k ≥ 1, cumul des sessions) donne une position
  // « saison, épisode » ; et inversement. Sans saisons, la série se compte en épisodes seuls.
  const totalSaisons = (saisons) => (saisons || []).reduce((t, s) => t + s.episodes, 0);
  function positionEpisode(saisons, k) {
    if (!saisons?.length || k <= 0) return null;
    let reste = k;
    for (const s of saisons) {
      if (reste <= s.episodes) return { saison: s.n, episode: reste };
      reste -= s.episodes;
    }
    const der = saisons.at(-1);
    return { saison: der.n, episode: der.episodes, fini: true };
  }
  function rangEpisode(saisons, saison, episode) {
    let k = 0;
    for (const s of saisons || []) {
      if (s.n === Number(saison)) return Number(episode) >= 1 && Number(episode) <= s.episodes ? k + Number(episode) : null;
      k += s.episodes;
    }
    return null;
  }
  const episodeTexte = (p) => (p ? `S${p.saison} · É${p.episode}` : '');

  // ---------- Normalisation ----------
  const txt = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
  const txtLong = (v, max) => String(v ?? '').replace(/\r\n?/g, '\n').trim().slice(0, max);
  const ent = (v, min, max, def = min) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def; };
  const idOk = (v) => (typeof v === 'string' && /^[\w-]{1,40}$/.test(v) ? v : nouvelId());

  const MAX_OBJ = { livres: 1000, pages: 500000, films: 2000, series: 500, episodes: 20000, podcasts: 500 };
  function normaliserReglages(r, base) {
    const genres = Array.isArray(r?.genres) ? r.genres : (base?.genres || []);
    const objectifs = {};
    if (r?.objectifs && typeof r.objectifs === 'object') {
      for (const [a, o] of Object.entries(r.objectifs)) {
        if (!/^\d{4}$/.test(a)) continue;
        // livres et pages toujours présents (format v1) ; les autres médias seulement s'ils sont fixés.
        const n = { livres: ent(o?.livres, 0, MAX_OBJ.livres), pages: ent(o?.pages, 0, MAX_OBJ.pages) };
        for (const k of OBJECTIFS.slice(2)) { const v = ent(o?.[k], 0, MAX_OBJ[k]); if (v) n[k] = v; }
        objectifs[a] = n;
      }
    }
    return { genres: [...new Set(genres.map((x) => txt(x, 40)).filter(Boolean))].slice(0, 60), objectifs };
  }
  function normaliserCitation(c) {
    const o = { id: idOk(c?.id), texte: txtLong(c?.texte, 1000) };
    const p = ent(c?.page, 0, 100000, 0);
    if (p) o.page = p;
    return o;
  }
  const normaliserSaisons = (v) => (Array.isArray(v) ? v : [])
    .map((s, i) => ({ n: ent(s?.n, 0, 999, i + 1), episodes: ent(s?.episodes, 0, 5000, 0) }))
    .filter((s) => s.episodes > 0).slice(0, 200);
  // Référence d'une œuvre trouvée en ligne : base (ol, tmdb, itunes) et identifiant. Jamais d'URL stockée.
  const SOURCES = ['ol', 'tmdb', 'itunes'];
  function normaliserSource(v) {
    if (!v || !SOURCES.includes(v.s)) return null;
    const id = String(v.id ?? '').trim();
    return /^[\w/.-]{1,60}$/.test(id) ? { s: v.s, id } : null;
  }
  function normaliserLivre(x) {
    const media = mediaDe(x);
    const format = media === 'livreaudio' ? 'audio' : media === 'livre' ? (x?.format === 'numerique' ? 'numerique' : 'papier') : '';
    const saisons = media === 'serie' ? normaliserSaisons(x?.saisons) : [];
    const l = {
      id: idOk(x?.id),
      media,
      titre: txt(x?.titre, 140) || 'Sans titre',
      auteur: txt(x?.auteur, 100),
      genre: txt(x?.genre, 40),
      format,
      total: saisons.length ? totalSaisons(saisons) : ent(x?.total, 0, 100000, 0),
      statut: STATUTS[x?.statut] ? x.statut : 'alire',
      priorite: ent(x?.priorite, 1, 3, 2),
      ordre: Number.isFinite(Number(x?.ordre)) ? Number(x.ordre) : 0,
      ajoute: estDate(x?.ajoute) ? x.ajoute : '',
      debut: estDate(x?.debut) ? x.debut : '',
      fin: estDate(x?.fin) ? x.fin : '',
      note: ent(x?.note, 0, 5, 0),
    };
    if (l.fin && l.debut && l.fin < l.debut) l.fin = l.debut;
    if (saisons.length) l.saisons = saisons;
    const annee = ent(x?.annee, 0, 2999, 0);
    if (annee >= 1000) l.annee = annee;
    const source = normaliserSource(x?.source);
    if (source) l.source = source;
    const avis = txtLong(x?.avis, 4000);
    if (avis) l.avis = avis; // champs vides omis : les données restent légères
    const cit = Array.isArray(x?.citations) ? x.citations.map(normaliserCitation).filter((c) => c.texte) : [];
    if (cit.length) l.citations = cit.slice(0, 200);
    return l;
  }
  const normaliserSession = (x) => ({ id: idOk(x?.id), livre: txt(x?.livre, 40), date: estDate(x?.date) ? x.date : '', quantite: ent(x?.quantite, 0, 100000, 0) });
  const etatVide = (base) => ({ version: VERSION, reglages: normaliserReglages({}, base), livres: [], sessions: [] });
  function normaliser(d, base) {
    const v = etatVide(base);
    if (!d || typeof d !== 'object') return v;
    const livres = (Array.isArray(d.livres) ? d.livres : []).map(normaliserLivre);
    const ids = new Set(livres.map((l) => l.id));
    const sessions = (Array.isArray(d.sessions) ? d.sessions : []).map(normaliserSession).filter((s) => s.date && s.quantite > 0 && ids.has(s.livre));
    // Migration v1 → v2 : chaque livre reçoit son média (normaliserLivre), rien n'est retiré.
    return { ...v, ...d, version: VERSION, reglages: normaliserReglages(d.reglages || {}, base), livres, sessions };
  }
  const taille = (etat) => new TextEncoder().encode(JSON.stringify(etat)).length;

  // ---------- Progression d'un livre ----------
  const sessionsDe = (etat, id) => etat.sessions.filter((s) => s.livre === id).sort((a, b) => a.date.localeCompare(b.date));
  const cumul = (etat, id) => etat.sessions.reduce((t, s) => (s.livre === id ? t + s.quantite : t), 0);
  // Fait, total, part lue (0 → 1, null sans total), reste. Un livre « lu » est complet par définition.
  function progression(etat, livre) {
    const total = livre.total;
    let fait = cumul(etat, livre.id);
    if (livre.statut === 'lu' && total) fait = total;
    if (total) fait = Math.min(fait, total);
    return { fait, total, part: total ? fait / total : null, reste: total ? Math.max(0, total - fait) : null, unite: unite(livre) };
  }
  // Rythme actuel d'un livre : quantité lue sur les `fenetre` derniers jours (aujourd'hui compris), divisée par
  // le nombre de ces jours écoulés depuis la première session du livre (au plus `fenetre`). Null sans lecture récente.
  function rythmeLivre(etat, livre, auj, fenetre = 14) {
    const ses = sessionsDe(etat, livre.id).filter((s) => s.date <= auj);
    if (!ses.length) return null;
    const depuis = ajout(auj, 1 - fenetre);
    const q = ses.filter((s) => s.date >= depuis).reduce((t, s) => t + s.quantite, 0);
    if (!q) return null;
    const jours = Math.min(fenetre, ecart(ses[0].date, auj) + 1);
    return q / jours;
  }
  // Date de fin estimée au rythme actuel : demain au plus tôt si on ne finit pas aujourd'hui.
  function finEstimee(etat, livre, auj, fenetre = 14) {
    const p = progression(etat, livre);
    if (!p.reste || livre.statut === 'lu' || livre.statut === 'abandonne') return null;
    const r = rythmeLivre(etat, livre, auj, fenetre);
    if (!r) return null;
    const jours = Math.ceil(p.reste / r);
    return { jours, date: ajout(auj, jours), rythme: r };
  }
  // Quantité d'une session saisie comme « arrivé à la page (ou à la minute) N ».
  const quantiteDepuisPosition = (etat, livre, position) => Math.max(0, Math.round(Number(position) || 0) - progression(etat, livre).fait);

  // Ajoute une session et fait suivre le statut du livre : « à lire » ou « abandonné » → « en cours » (début =
  // date de la première session), total atteint → « lu » (fin = date de la session). Renvoie un nouvel état.
  function appliquerSession(etat, session) {
    const s = normaliserSession(session);
    const livres = etat.livres.map((l) => ({ ...l }));
    const l = livres.find((x) => x.id === s.livre);
    if (!l || !s.date || s.quantite <= 0) return { etat, termine: false, refus: true };
    const sessions = etat.sessions.filter((x) => x.id !== s.id).concat([s]);
    const e = { ...etat, livres, sessions };
    const premiere = sessionsDe(e, l.id)[0]?.date || s.date;
    if (!l.debut || premiere < l.debut) l.debut = premiere;
    if (l.statut === 'alire' || l.statut === 'abandonne') { l.statut = 'encours'; l.fin = ''; }
    let termine = false;
    if (l.statut === 'encours' && l.total && cumul(e, l.id) >= l.total) {
      l.statut = 'lu';
      l.fin = sessionsDe(e, l.id).at(-1).date;
      termine = true;
    }
    return { etat: e, termine };
  }
  // Passe un livre à un statut et date le changement (début, fin) sans effacer l'historique.
  function changerStatut(etat, id, statut, date) {
    const livres = etat.livres.map((l) => {
      if (l.id !== id) return l;
      const n = { ...l, statut };
      if (statut === 'encours') { n.debut = n.debut || date; n.fin = ''; }
      if (statut === 'lu' || statut === 'abandonne') { n.debut = n.debut || date; n.fin = date; }
      if (statut === 'alire') { n.fin = ''; }
      return n;
    });
    return { ...etat, livres };
  }
  function supprimerLivre(etat, id) {
    return { ...etat, livres: etat.livres.filter((l) => l.id !== id), sessions: etat.sessions.filter((s) => s.livre !== id) };
  }
  function renommerGenre(etat, ancien, nouveau) {
    const n = txt(nouveau, 40);
    if (!n) return etat;
    const genres = [...new Set(etat.reglages.genres.map((x) => (x === ancien ? n : x)))];
    return { ...etat, reglages: { ...etat.reglages, genres }, livres: etat.livres.map((l) => (l.genre === ancien ? { ...l, genre: n } : l)) };
  }

  // ---------- Liste « à lire » ----------
  function aLire(etat) {
    return etat.livres.filter((l) => l.statut === 'alire')
      .sort((a, b) => a.priorite - b.priorite || a.ordre - b.ordre || (a.ajoute || '').localeCompare(b.ajoute || '') || a.titre.localeCompare(b.titre, 'fr'));
  }
  // Monte (sens -1) ou descend (sens 1) un livre dans la liste ; en franchissant le bord de sa priorité, il
  // passe à la priorité voisine. Les rangs sont renumérotés de 1 à n.
  function deplacer(etat, id, sens) {
    const liste = aLire(etat).map((l) => ({ ...l }));
    const i = liste.findIndex((l) => l.id === id);
    if (i < 0) return etat;
    const j = i + sens;
    if (j >= 0 && j < liste.length && liste[j].priorite === liste[i].priorite) [liste[i], liste[j]] = [liste[j], liste[i]];
    // Bord de sa priorité : il change de priorité sans changer de place (fin du groupe du dessus, début de celui du dessous).
    else if (sens < 0 && liste[i].priorite > 1) liste[i].priorite -= 1;
    else if (sens > 0 && liste[i].priorite < 3) liste[i].priorite += 1;
    else return etat;
    const parId = new Map(liste.map((l, k) => [l.id, { priorite: l.priorite, ordre: k + 1 }]));
    return { ...etat, livres: etat.livres.map((l) => (parId.has(l.id) ? { ...l, ...parId.get(l.id) } : l)) };
  }

  // ---------- Lectures datées ----------
  // Toutes les quantités lues, datées : les sessions, plus pour un livre « lu » la part non couverte par des
  // sessions (livre noté lu sans détail), comptée à sa date de fin.
  function lectures(etat) {
    const parId = new Map(etat.livres.map((l) => [l.id, l]));
    const l = etat.sessions.filter((s) => parId.has(s.livre)).map((s) => ({ date: s.date, livre: s.livre, quantite: s.quantite, unite: unite(parId.get(s.livre)), media: mediaDe(parId.get(s.livre)) }));
    for (const b of etat.livres) {
      if (b.statut !== 'lu' || !b.fin || !b.total) continue;
      const reste = b.total - cumul(etat, b.id);
      if (reste > 0) l.push({ date: b.fin, livre: b.id, quantite: reste, unite: unite(b), media: mediaDe(b), complement: true });
    }
    return l.sort((a, b) => a.date.localeCompare(b.date));
  }

  // ---------- Séries de jours de lecture ----------
  // Jours avec au moins une session. Série actuelle : jours consécutifs jusqu'à aujourd'hui, ou jusqu'à hier si
  // rien n'est encore noté aujourd'hui (la série n'est pas perdue avant la fin de la journée).
  function series(etat, auj) {
    const jours = [...new Set(etat.sessions.filter((s) => s.date <= auj).map((s) => s.date))].sort();
    const ens = new Set(jours);
    let record = 0, courant = 0, prec = '';
    for (const d of jours) {
      courant = prec && ajout(prec, 1) === d ? courant + 1 : 1;
      record = Math.max(record, courant);
      prec = d;
    }
    let actuelle = 0;
    let d = ens.has(auj) ? auj : ajout(auj, -1);
    while (ens.has(d)) { actuelle++; d = ajout(d, -1); }
    return { actuelle, record, aujourdhui: ens.has(auj), jours: jours.length };
  }

  // ---------- Objectif annuel ----------
  // Pour une cible (livres ou pages) : réalisé, attendu au jour près (cible × jours écoulés / jours de l'année),
  // écart, avance ou retard en jours (date à laquelle le réalisé aurait dû être atteint au rythme régulier),
  // projection au rythme de l'année et quantité nécessaire par jour pour finir à temps.
  function suiviObjectif(cible, fait, annee, auj) {
    const n = joursAnnee(annee);
    const a = Number(auj.slice(0, 4));
    const ecoules = annee < a ? n : annee > a ? 0 : jourDeLAnnee(auj);
    const restants = n - ecoules;
    const attendu = cible * ecoules / n;
    const r = { cible, fait, ecoules, restants, attendu, ecart: fait - attendu, atteint: cible > 0 && fait >= cible };
    r.part = cible ? fait / cible : null;
    r.joursAvance = cible && ecoules ? Math.round(fait * n / cible - ecoules) : null;
    r.projection = ecoules ? fait / ecoules * n : null;
    r.parJour = cible && restants > 0 && fait < cible ? (cible - fait) / restants : null;
    return r;
  }
  // Objectifs de l'année, un suivi par cible fixée (null sinon) : livres (papier, numérique et audio, comme en v1),
  // pages, films, séries et podcasts terminés, épisodes vus ou écoutés.
  function objectifAnnee(etat, annee, auj) {
    const o = etat.reglages.objectifs[String(annee)] || {};
    const b = bilanAnnee(etat, annee, auj);
    const fait = { livres: b.nbLivres, pages: b.pages, films: b.nbFilms, series: b.nbSeries, episodes: b.episodes, podcasts: b.nbPodcasts };
    const r = { annee, bilan: b };
    for (const k of OBJECTIFS) r[k] = o[k] ? suiviObjectif(o[k], fait[k], annee, auj) : null;
    return r;
  }

  // ---------- Statistiques ----------
  const moyenne = (l) => (l.length ? l.reduce((t, x) => t + x, 0) / l.length : null);
  // Bilan d'une année : livres terminés (statut « lu », date de fin dans l'année), pages et minutes lues
  // (sessions et compléments datés dans l'année), par mois, par genre, par auteur, par format ; pages par jour
  // sur les jours écoulés de l'année.
  // Bilan d'une année. `finis` : toutes les œuvres terminées ; `nbLivres` : livres et livres audio terminés (sens v1).
  // Quantités : `pages` (livres), `minutes` (livres audio, « écoute »), `minutesFilms`, `episodes` (séries et podcasts).
  function bilanAnnee(etat, annee, auj) {
    const an = String(annee);
    const finis = etat.livres.filter((l) => l.statut === 'lu' && l.fin.slice(0, 4) === an).sort((a, b) => a.fin.localeCompare(b.fin));
    const livresFinis = finis.filter(estLivre);
    const abandons = etat.livres.filter((l) => l.statut === 'abandonne' && l.fin.slice(0, 4) === an);
    const lec = lectures(etat).filter((x) => x.date.slice(0, 4) === an && x.date <= auj);
    const parId = new Map(etat.livres.map((l) => [l.id, l]));
    const parMois = Array.from({ length: 12 }, (_, i) => ({ mois: i + 1, livres: 0, oeuvres: 0, pages: 0, minutes: 0, minutesFilms: 0, episodes: 0 }));
    for (const l of finis) { const m = parMois[Number(l.fin.slice(5, 7)) - 1]; m.oeuvres++; if (estLivre(l)) m.livres++; }
    const somme = { pages: 0, minutes: 0, minutesFilms: 0, episodes: 0 };
    const cleQ = (x) => (x.unite === 'pages' ? 'pages' : x.unite === 'episodes' ? 'episodes' : x.media === 'film' ? 'minutesFilms' : 'minutes');
    const quantiteMedia = Object.fromEntries(Object.keys(MEDIAS).map((m) => [m, 0]));
    for (const x of lec) {
      const k = cleQ(x);
      parMois[Number(x.date.slice(5, 7)) - 1][k] += x.quantite;
      somme[k] += x.quantite;
      quantiteMedia[x.media] += x.quantite;
    }
    const { pages, minutes } = somme;
    const grouper = (cle) => {
      const map = new Map();
      for (const l of finis) {
        const k = l[cle] || '';
        if (!map.has(k)) map.set(k, { nom: k, oeuvres: 0, livres: 0, pages: 0, minutes: 0, notes: [], medias: {} });
        const o = map.get(k);
        o.oeuvres++;
        o.medias[l.media] = (o.medias[l.media] || 0) + 1;
        if (estLivre(l)) { o.livres++; if (unite(l) === 'minutes') o.minutes += l.total; else o.pages += l.total; }
        if (l.note) o.notes.push(l.note);
      }
      return [...map.values()].map((o) => ({ ...o, note: moyenne(o.notes) }))
        .sort((a, b) => b.oeuvres - a.oeuvres || b.pages - a.pages || a.nom.localeCompare(b.nom, 'fr'));
    };
    const parFormat = Object.keys(FORMATS).map((f) => ({ format: f, livres: livresFinis.filter((l) => l.format === f).length }));
    const parMedia = Object.keys(MEDIAS).map((m) => ({ media: m, termines: finis.filter((l) => l.media === m).length, quantite: quantiteMedia[m], unite: MEDIAS[m].unite }));
    const n = joursAnnee(Number(an));
    const a = Number(auj.slice(0, 4));
    const ecoules = Number(an) < a ? n : Number(an) > a ? 0 : jourDeLAnnee(auj);
    const joursLus = new Set(etat.sessions.filter((s) => s.date.slice(0, 4) === an && s.date <= auj).map((s) => s.date)).size;
    const notes = finis.map((l) => l.note).filter(Boolean);
    const durees = livresFinis.filter((l) => l.debut).map((l) => ecart(l.debut, l.fin) + 1);
    const plusLong = finis.filter((l) => unite(l) === 'pages').sort((x, y) => y.total - x.total)[0] || null;
    const nb = (m) => finis.filter((l) => l.media === m).length;
    return {
      annee: Number(an), finis, nbLivres: livresFinis.length, nbOeuvres: finis.length, nbFilms: nb('film'), nbSeries: nb('serie'), nbPodcasts: nb('podcast'),
      abandons: abandons.length, pages, minutes, minutesFilms: somme.minutesFilms, episodes: somme.episodes, parMois, parMedia,
      parGenre: grouper('genre'), parAuteur: grouper('auteur'), parFormat,
      pagesParJour: ecoules ? pages / ecoules : 0, joursLus, ecoules,
      noteMoyenne: moyenne(notes), dureeMoyenne: moyenne(durees), plusLong,
      livresIds: new Set(lec.map((x) => x.livre).filter((id) => parId.has(id))).size,
    };
  }
  // Années qui ont des lectures ou un objectif, plus l'année en cours, de la plus récente à la plus ancienne.
  function annees(etat, auj) {
    const s = new Set([Number(auj.slice(0, 4))]);
    for (const l of etat.livres) if (l.fin) s.add(Number(l.fin.slice(0, 4)));
    for (const x of etat.sessions) s.add(Number(x.date.slice(0, 4)));
    for (const a of Object.keys(etat.reglages.objectifs)) s.add(Number(a));
    return [...s].filter((a) => a > 1900 && a < 3000).sort((a, b) => b - a);
  }
  // Quantités des `n` derniers jours (aujourd'hui compris), jour par jour : pages, minutes d'écoute (livres audio),
  // minutes de film, épisodes (séries et podcasts).
  function derniersJours(etat, auj, n = 14) {
    const parId = new Map(etat.livres.map((l) => [l.id, l]));
    const jours = Array.from({ length: n }, (_, i) => ({ date: ajout(auj, i - n + 1), pages: 0, minutes: 0, minutesFilms: 0, episodes: 0 }));
    const idx = new Map(jours.map((j, i) => [j.date, i]));
    for (const s of etat.sessions) {
      if (!idx.has(s.date) || !parId.has(s.livre)) continue;
      const j = jours[idx.get(s.date)];
      const o = parId.get(s.livre), u = unite(o);
      if (u === 'pages') j.pages += s.quantite;
      else if (u === 'episodes') j.episodes += s.quantite;
      else if (mediaDe(o) === 'film') j.minutesFilms += s.quantite;
      else j.minutes += s.quantite;
    }
    return jours;
  }

  // ---------- Recherche tolérante ----------
  // Sans accents ni casse ; chaque mot cherché doit figurer dans le texte (début de mot de préférence) ou ressembler à
  // un mot du texte : une faute permise de 4 à 7 lettres, deux au-delà (frappe incomplète comprise). Score 0 : absent.
  function distance(a, b, max = 3) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    // Distance de Damerau-Levenshtein restreinte (inversion de deux lettres voisines = une faute), arrêtée au-delà de max.
    let avant = null, prec = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cour = [i];
      let min = i;
      for (let j = 1; j <= b.length; j++) {
        cour[j] = Math.min(prec[j] + 1, cour[j - 1] + 1, prec[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (avant && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cour[j] = Math.min(cour[j], avant[j - 2] + 1);
        min = Math.min(min, cour[j]);
      }
      if (min > max) return max + 1;
      avant = prec; prec = cour;
    }
    return prec[b.length];
  }
  const mots = (t) => plat(t).split(/[^a-z0-9]+/).filter(Boolean);
  function scoreRecherche(q, texte) {
    const cherches = mots(q);
    if (!cherches.length) return 1;
    const t = plat(texte), tm = mots(texte);
    let score = 0;
    for (const m of cherches) {
      if (tm.some((w) => w.startsWith(m))) { score += 3; continue; }
      if (t.includes(m)) { score += 2; continue; }
      const tol = m.length >= 8 ? 2 : m.length >= 4 ? 1 : 0;
      if (tol && tm.some((w) => distance(m, w, tol) <= tol || (w.length > m.length && distance(m, w.slice(0, m.length), tol) <= tol))) score += 1;
      else return 0;
    }
    return score;
  }

  // ---------- Export CSV ----------
  // Point-virgule, BOM, formules neutralisées (une cellule qui commence par = + - @ est préfixée d'une apostrophe).
  function champCsv(v) {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
  const versCsv = (lignes) => `﻿${lignes.map((l) => l.map(champCsv).join(';')).join('\r\n')}\r\n`;
  function csvLivres(etat) {
    // Colonnes v1 dans le même ordre (tableurs existants), média, année et saisons ajoutés à la fin.
    const tete = ['Titre', 'Auteur', 'Genre', 'Format', 'Pages, minutes ou épisodes', 'Unité', 'Statut', 'Priorité', 'Ajouté le', 'Début', 'Fin', 'Fait (pages, minutes ou épisodes)', 'Note sur 5', 'Avis', 'Citations', 'Média', 'Année', 'Saisons'];
    const lignes = etat.livres.slice().sort((a, b) => a.titre.localeCompare(b.titre, 'fr')).map((l) => {
      const p = progression(etat, l);
      return [l.titre, l.auteur, l.genre, FORMATS[l.format]?.nom || '', l.total || '', unite(l), statutTexte(l.statut, l.media), l.statut === 'alire' ? PRIORITES[l.priorite] : '', l.ajoute, l.debut, l.fin, p.fait, l.note || '', l.avis || '',
        (l.citations || []).map((c) => `${c.texte}${c.page ? ` (p. ${c.page})` : ''}`).join(' | '),
        MEDIAS[l.media].nom, l.annee || '', (l.saisons || []).map((x) => `S${x.n} : ${x.episodes}`).join(' | ')];
    });
    return versCsv([tete, ...lignes]);
  }
  function csvSessions(etat) {
    const parId = new Map(etat.livres.map((l) => [l.id, l]));
    const lignes = etat.sessions.slice().sort((a, b) => a.date.localeCompare(b.date)).map((s) => { const l = parId.get(s.livre); return [s.date, l?.titre || '', l?.auteur || '', s.quantite, unite(l), MEDIAS[mediaDe(l)].nom]; });
    return versCsv([['Date', 'Titre', 'Auteur', 'Quantité', 'Unité', 'Média'], ...lignes]);
  }

  g.PGS = {
    deux, iso, versDate, ajout, ecart, estDate, bissextile, joursAnnee, jourDeLAnnee, JOURS, MOIS, dateFrLongue, dateFr, dureeTexte, nombreTexte, plat, nouvelId,
    VERSION, FORMATS, MEDIAS, LIVRES, STATUTS, STATUTS_TOUS, PRIORITES, OBJECTIFS, mediaDe, unite, estLivre, statutTexte, quantiteTexte,
    totalSaisons, positionEpisode, rangEpisode, episodeTexte, distance, scoreRecherche,
    normaliserReglages, normaliserLivre, normaliserSession, normaliserCitation, normaliserSaisons, normaliserSource, etatVide, normaliser, taille,
    sessionsDe, cumul, progression, rythmeLivre, finEstimee, quantiteDepuisPosition, appliquerSession, changerStatut, supprimerLivre, renommerGenre,
    aLire, deplacer, lectures, series, suiviObjectif, objectifAnnee, bilanAnnee, annees, derniersJours, moyenne,
    champCsv, versCsv, csvLivres, csvSessions,
  };
})(typeof window !== 'undefined' ? window : globalThis);
