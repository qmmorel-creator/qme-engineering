// Gestion d'auto-école QME : élèves (heures, paiements, compétences), moniteurs, véhicules, planning des leçons.
// Données synchronisées par clé de licence (socle commun des templates QME).
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.REGLES;
  const API = '/api/templates';
  const PRODUIT = 'AEC';
  const CLE_CODE = 'qme-aec-code';
  const CLE_CACHE = 'qme-aec-cache';
  const CLE_DEMO = 'qme-aec-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-aec-ecran-accueil';
  const TAILLE_MAX = 900000;
  const NOM_PRODUIT = 'Gestion d\'auto-école';

  // ---------- Outils ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const pluriel = (n, s, p) => `${n} ${Math.abs(n) > 1 ? (p || s + 's') : s}`;
  const stock = {
    lire(cle) { try { const v = localStorage.getItem(cle) ?? sessionStorage.getItem(cle); return v ? JSON.parse(v) : null; } catch { return null; } },
    ecrire(cle, v, session = false) { try { (session ? sessionStorage : localStorage).setItem(cle, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
    suppr(cle) { try { localStorage.removeItem(cle); sessionStorage.removeItem(cle); } catch { /* idem */ } },
  };

  const { ajout, ecart, versDate } = R;
  const auj = () => R.iso(new Date());
  const maintenant = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const fmt = (s, o = { day: 'numeric', month: 'short' }) => (s ? versDate(s).toLocaleDateString('fr-FR', o) : '–');
  const fmtLong = (s) => fmt(s, { weekday: 'long', day: 'numeric', month: 'long' });
  const quand = (s) => {
    const n = ecart(auj(), s);
    if (n === 0) return 'aujourd\'hui';
    if (n === 1) return 'demain';
    if (n === -1) return 'hier';
    return fmt(s, { weekday: 'short', day: 'numeric', month: 'short' });
  };
  const nb = (n, d = 1) => Number(n || 0).toLocaleString('fr-FR', { maximumFractionDigits: d });
  const euros = (n) => `${Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`;
  const h = (n) => `${nb(n)} h`;
  const couleur = (id) => B.couleurs.find((c) => c.id === id) || B.couleurs[0];
  const estTelephone = () => matchMedia('(max-width:720px)').matches;

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'planning';
  const plan = { mode: null, date: null, axe: 'moniteur' };
  const filtreEleves = { statut: 'actif', texte: '' };
  let eleveChoisi = null;
  let vehiculeChoisi = null;

  const etatVide = () => ({ version: 1, ecole: '', reglages: { ...B.reglagesDefaut, joursOuverts: [...B.reglagesDefaut.joursOuverts], competences: [...B.competences] },
    eleves: [], moniteurs: [], vehicules: [], achats: [], paiements: [], lecons: [], releves: [], interventionsV: [] });
  const normaliser = (d) => {
    const v = etatVide();
    if (!d || typeof d !== 'object') return v;
    const tab = (x) => (Array.isArray(x) ? x : []);
    const reglages = { ...v.reglages, ...(d.reglages || {}) };
    if (!Array.isArray(reglages.competences)) reglages.competences = [...B.competences];
    if (!Array.isArray(reglages.joursOuverts)) reglages.joursOuverts = [...B.reglagesDefaut.joursOuverts];
    return { ...v, ...d, reglages,
      eleves: tab(d.eleves).map((e) => ({ competences: {}, statut: 'actif', boite: 'manuelle', ...e })),
      moniteurs: tab(d.moniteurs).map((m) => ({ dispos: {}, absences: [], couleur: 'bleu', ...m })),
      vehicules: tab(d.vehicules), achats: tab(d.achats), paiements: tab(d.paiements), lecons: tab(d.lecons), releves: tab(d.releves), interventionsV: tab(d.interventionsV) };
  };
  const eleve = (id) => E.eleves.find((x) => x.id === id);
  const moniteur = (id) => E.moniteurs.find((x) => x.id === id);
  const vehicule = (id) => E.vehicules.find((x) => x.id === id);
  const lecon = (id) => E.lecons.find((x) => x.id === id);
  const actifs = (l) => l.filter((x) => x.actif !== false);
  const noms = { eleve: (id) => eleve(id)?.nom || 'élève supprimé', moniteur: (id) => moniteur(id)?.nom || 'moniteur supprimé', vehicule: (id) => vehicule(id)?.nom || 'sans véhicule' };
  const triNom = (a, b) => a.nom.localeCompare(b.nom);

  // ---------- Stockage et synchronisation ----------
  let minuterie = null, envoiEnCours = false, aRenvoyer = false, etatSync = 'ok';

  function cache(nonEnvoye = false) {
    if (session.demo) { stock.ecrire(CLE_DEMO, E); return; }
    stock.ecrire(CLE_CACHE, { code: session.code, jeton: session.jeton, etat: E, base: session.base, nonEnvoye }, !session.memoriser);
  }

  function sauver() {
    cache(true);
    if (session.demo) return;
    majSync('attente');
    clearTimeout(minuterie);
    minuterie = setTimeout(envoyer, 600);
  }

  async function appel(chemin, options = {}) {
    const r = await fetch(API + chemin, { ...options, headers: { 'content-type': 'application/json', ...(session.jeton ? { 'x-code': session.jeton } : {}), ...(options.headers || {}) } });
    let corps = null;
    try { corps = await r.json(); } catch { /* corps vide */ }
    return { statut: r.status, corps };
  }

  async function envoyer() {
    if (session.demo) return;
    if (envoiEnCours) { aRenvoyer = true; return; }
    envoiEnCours = true;
    majSync('envoi');
    try {
      const { statut, corps } = await appel('/donnees', { method: 'PUT', body: JSON.stringify({ donnees: E, base: session.base }) });
      if (statut === 409) {
        E = normaliser(corps.donnees);
        session.base = corps.donnees.majLe;
        cache(false);
        rendre();
        toast('Un autre appareil a modifié les données entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
      } else if (statut === 401) {
        deconnecter('Ce code d\'accès n\'est plus valide.');
        return;
      } else if (statut === 413) {
        majSync('attente');
        toast('Trop de données pour l\'enregistrement en ligne : exporte une copie, puis supprime des élèves terminés.');
        return;
      } else if (statut !== 200) {
        throw new Error(String(statut));
      } else {
        session.base = corps.majLe;
        cache(false);
      }
      majSync('ok');
    } catch {
      majSync('horsligne');
    } finally {
      envoiEnCours = false;
      if (aRenvoyer) { aRenvoyer = false; envoyer(); }
    }
  }

  async function rafraichir() {
    if (session.demo || !session.code || etatSync !== 'ok' || envoiEnCours) return;
    try {
      const { statut, corps } = await appel('/donnees');
      if (statut === 200 && corps.donnees && corps.donnees.majLe !== session.base) {
        E = normaliser(corps.donnees);
        session.base = corps.donnees.majLe;
        cache(false);
        if (!modale().open) rendre();
      }
    } catch { majSync('horsligne'); }
  }

  function majSync(etat) {
    etatSync = etat;
    const el = $('.sync');
    if (!el) return;
    const libelles = { ok: 'Enregistré', attente: 'Modifié', envoi: 'Enregistrement…', horsligne: 'Hors ligne', demo: 'Démo locale' };
    el.dataset.etat = etat;
    el.querySelector('b').textContent = libelles[etat];
    el.title = etat === 'horsligne' ? 'Pas de connexion : tes modifications sont gardées sur cet appareil et seront envoyées au retour du réseau.' : libelles[etat];
  }

  // ---------- Connexion ----------
  function formaterCode(v) {
    const n = v.toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (n === 'DEMO' || 'DEMO'.startsWith(n)) return n;
    // Code interne d'un template QME (préfixe de 3 lettres, au moins une hors hexadécimal) ; sinon clé Gumroad.
    if (estCode(n)) { const r = n.slice(0, 19); return [r.slice(0, 3), r.slice(3, 7), r.slice(7, 11), r.slice(11, 15), r.slice(15, 19)].filter(Boolean).join('-'); }
    const l = n.slice(0, 32);
    return [l.slice(0, 8), l.slice(8, 16), l.slice(16, 24), l.slice(24, 32)].filter(Boolean).join('-');
  }
  const estCode = (n) => n.startsWith(PRODUIT) || (/^[A-Z]{3}/.test(n) && /[G-Z]/.test(n.slice(0, 3)));
  const codeComplet = (c) => { const n = c.replace(/-/g, ''); return (estCode(n) && n.length === 19) || (/^[0-9A-F]{32}$/.test(n)); };

  async function connecter(code, memoriser) {
    if (code.replace(/-/g, '') === CODE_DEMO) return ouvrirDemo();
    const { statut, corps } = await appel('/connexion', { method: 'POST', body: JSON.stringify({ code, produit: PRODUIT }) });
    if (statut === 401) throw new Error('Clé ou code inconnu. Copie-le depuis l\'e-mail reçu après ton achat.');
    if (statut !== 200) throw new Error(corps?.erreur || 'Le service ne répond pas. Réessaie dans un instant.');
    // Clé d'un autre template : ne jamais écrire nos données dans son espace.
    if (corps.produit !== PRODUIT) throw new Error('Cette clé ouvre un autre template QME : utilise la page qm-engineering.fr/connexion/.');
    session.code = code; session.jeton = corps.jeton; session.demo = false; session.memoriser = memoriser;
    stock.suppr(CLE_CODE);
    stock.ecrire(CLE_CODE, code, !memoriser);
    chargerDepuisServeur(corps.donnees);
  }

  function chargerDepuisServeur(donnees) {
    const c = stock.lire(CLE_CACHE);
    if (c && c.code === session.code && c.nonEnvoye && (!donnees || c.base === donnees.majLe)) {
      E = normaliser(c.etat); session.base = donnees?.majLe ?? null;
      demarrer(); envoyer();
      return;
    }
    E = donnees ? normaliser(donnees) : null;
    session.base = donnees?.majLe ?? null;
    if (E && (E.moniteurs.length || E.vehicules.length || E.eleves.length)) { cache(false); demarrer(); } else ecranAccueil();
  }

  function ouvrirDemo(memoriser = true) {
    session.demo = true; session.code = null; session.jeton = null;
    if (memoriser) stock.ecrire(CLE_CODE, CODE_DEMO);
    E = stock.lire(CLE_DEMO) ? normaliser(stock.lire(CLE_DEMO)) : donneesDemo();
    cache();
    demarrer();
  }

  function deconnecter(message) {
    stock.suppr(CLE_CODE);
    if (!session.demo) stock.suppr(CLE_CACHE);
    session.code = null; session.jeton = null; session.demo = false; session.base = null; E = null;
    eleveChoisi = null; vehiculeChoisi = null;
    document.body.classList.remove('app');
    ecranConnexion(message);
  }

  // ---------- Données de démonstration (fictives, relatives à aujourd'hui) ----------
  // Générateur pseudo-aléatoire à graine fixe : même démo à chaque ouverture (à date égale).
  function hasard(graine) { let s = graine >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  function donneesDemo() {
    E = etatVide();
    E.ecole = 'Auto-école des Tilleuls (exemple)';
    const t = auj();
    const alea = hasard(57);
    const plages = { 1: '08:00-12:00, 14:00-19:00', 2: '08:00-12:00, 14:00-19:00', 3: '08:00-12:00', 4: '08:00-12:00, 14:00-19:00', 5: '08:00-12:00, 14:00-19:00', 6: '08:00-12:00' };
    const dispos = (sauf = []) => Object.fromEntries(Object.entries(plages).filter(([j]) => !sauf.includes(Number(j))).map(([j, p]) => [j, R.lirePlages(p)]));
    const [karim, sophie, julien] = [
      { id: uid(), nom: 'Karim', couleur: 'bleu', dispos: dispos(), absences: [] },
      { id: uid(), nom: 'Sophie', couleur: 'rouge', dispos: dispos([3]), absences: [{ id: uid(), debut: ajout(t, 3), fin: ajout(t, 5), motif: 'Formation' }] },
      { id: uid(), nom: 'Julien', couleur: 'jaune', dispos: { 2: R.lirePlages('09:00-12:00, 14:00-18:00'), 4: R.lirePlages('14:00-19:00'), 5: R.lirePlages('09:00-12:00, 14:00-18:00'), 6: R.lirePlages('08:00-12:00') }, absences: [] },
    ];
    E.moniteurs.push(karim, sophie, julien);
    const v1 = { id: uid(), nom: 'Citadine 1', immat: 'QA-101-AE', boite: 'manuelle', dateEntree: ajout(t, -700), kmEntree: 18400, coutMensuel: 420, entretienKm: 15000, entretienMois: 12, ctProchain: ajout(t, 18), actif: true, notes: '' };
    const v2 = { id: uid(), nom: 'Citadine 2', immat: 'QB-202-AE', boite: 'manuelle', dateEntree: ajout(t, -400), kmEntree: 6200, coutMensuel: 460, entretienKm: 15000, entretienMois: 12, ctProchain: ajout(t, -4), actif: true, notes: 'Siège passager à régler.' };
    const v3 = { id: uid(), nom: 'Automatique 3', immat: 'QC-303-AE', boite: 'auto', dateEntree: ajout(t, -260), kmEntree: 2100, coutMensuel: 510, entretienKm: 20000, entretienMois: 12, ctProchain: ajout(t, 900), actif: true, notes: '' };
    E.vehicules.push(v1, v2, v3);

    // [nom, boîte, inscription (j), heures achetées, montant, payé, mineur, statut, moniteur préféré]
    const eleves = [
      ['Inès B.', 'manuelle', -70, [20, 5], [1150, 290], [1150, 0], false, 'actif', karim],
      ['Tom R.', 'auto', -60, [13, 7], [780, 420], [780, 0], true, 'actif', julien],
      ['Lucas M.', 'manuelle', -55, [20], [1150], [600, 300], false, 'actif', sophie],
      ['Chloé D.', 'manuelle', -50, [20], [1150], [1150], true, 'actif', karim],
      ['Nathan G.', 'manuelle', -42, [20], [1150], [400], false, 'actif', sophie],
      ['Léna K.', 'auto', -35, [13], [780], [780], false, 'actif', julien],
      ['Hugo P.', 'manuelle', -28, [20], [1150], [1150], false, 'actif', karim],
      ['Sarah T.', 'manuelle', -21, [20], [1150], [500], true, 'actif', sophie],
      ['Yanis F.', 'manuelle', -9, [20], [1150], [300], false, 'actif', karim],
      ['Manon L.', 'auto', -3, [13], [780], [780], false, 'actif', julien],
      ['Lou P.', 'manuelle', -75, [20], [1150], [1150], false, 'termine', sophie],
      ['Adam V.', 'manuelle', -350, [20], [1150], [1150], false, 'termine', karim],
      ['Jade C.', 'auto', -330, [13], [780], [780], true, 'termine', julien],
      ['Rayan H.', 'manuelle', -300, [20], [1150], [1150], false, 'termine', sophie],
      ['Emma S.', 'manuelle', -270, [20], [1150], [1150], false, 'termine', karim],
      ['Noah B.', 'manuelle', -240, [20], [1150], [1150], true, 'termine', sophie],
      ['Zoé M.', 'auto', -210, [13], [780], [780], false, 'termine', julien],
      ['Liam T.', 'manuelle', -180, [20], [1150], [1150], false, 'termine', karim],
      ['Alice R.', 'manuelle', -150, [20], [1150], [1150], false, 'termine', sophie],
      ['Gabin L.', 'manuelle', -120, [20], [1150], [1150], false, 'termine', karim],
    ].map(([nom, boite, j, hs, ms, ps, mineur, statut, pref], k) => {
      const e = { id: uid(), nom, boite, inscription: ajout(t, j), mineur, contact: '', statut, notes: '', competences: {}, pref: pref.id };
      E.eleves.push(e);
      hs.forEach((hh, i) => E.achats.push({ id: uid(), eleveId: e.id, date: ajout(t, i ? j + 40 : j), heures: hh, montant: ms[i], libelle: i ? `${hh} h supplémentaires` : `Forfait ${hh} h` }));
      ps.forEach((p, i) => p > 0 && E.paiements.push({ id: uid(), eleveId: e.id, date: ajout(t, j + i * 21), montant: p, mode: B.modesPaiement[(k + i) % 4] }));
      return e;
    });

    // Leçons simulées de J-365 à J+12 : rythme hebdomadaire par élève, règles réelles de conflit et de disponibilité.
    const rythme = { 'Inès B.': 3, 'Chloé D.': 3, 'Lou P.': 3, 'Adam V.': 3, 'Rayan H.': 3, 'Noah B.': 3, 'Liam T.': 3, 'Gabin L.': 3, 'Nathan G.': 1, 'Léna K.': 1 };
    const creneaux = ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
    const melange = (l) => l.map((x) => [alea(), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    for (let d = -365; d <= 12; d++) {
      const date = ajout(t, d);
      if (!E.reglages.joursOuverts.includes(R.jourSemaine(date))) continue;
      const l0 = R.lundi(date);
      for (const e of melange(E.eleves)) {
        if (e.nom === 'Manon L.' || e.inscription > date || (e.statut === 'termine' && d > -20)) continue;
        const siennes = E.lecons.filter((l) => l.eleveId === e.id && l.statut !== 'annulee');
        if (siennes.some((l) => l.date === date) || siennes.filter((l) => l.date >= l0 && l.date <= date).length >= (rythme[e.nom] || 2) + (d === 0 ? 1 : 0)) continue;
        if (alea() > (d === 0 ? 0.95 : d > 0 ? 0.6 : 0.5)) continue;
        const duree = alea() < 0.12 ? 120 : 60;
        const s = R.soldeEleve(e.id, E, t);
        if (s.aPlanifier < duree / 60 && !(e.nom === 'Inès B.' && d < 0 && s.aPlanifier > -1.5)) continue;
        const mons = [E.moniteurs.find((m) => m.id === e.pref), ...melange(E.moniteurs.filter((m) => m.id !== e.pref))];
        let pose = false;
        for (const m of mons) {
          for (const debut of melange(creneaux)) {
            const v = melange(E.vehicules).find((x) => x.dateEntree <= date && x.boite === e.boite && !R.conflits({ id: 'x', date, debut, duree, vehiculeId: x.id, statut: 'prevue' }, E.lecons).length);
            if (!v) continue;
            const l = { id: uid(), eleveId: e.id, moniteurId: m.id, vehiculeId: v.id, date, debut, duree, statut: 'prevue', note: '' };
            if (R.verifierLecon(l, E).erreurs.length) continue;
            const passee = d < 0 || (d === 0 && R.finMin(l) <= maintenant());
            if (passee) { const x = alea(); l.statut = x < 0.05 ? 'absent' : x < 0.09 ? 'annulee' : 'faite'; }
            E.lecons.push(l);
            pose = true;
            break;
          }
          if (pose) break;
        }
      }
    }
    // Une leçon d'hier non pointée, et Manon (inscrite récemment) n'a encore rien de planifié.
    const hier = E.lecons.filter((l) => l.date < t && l.statut === 'faite').sort((a, b) => b.date.localeCompare(a.date) || b.debut.localeCompare(a.debut))[0];
    if (hier) hier.statut = 'prevue';
    // États forcés pour la démo : Inès a dépassé ses heures achetées, le forfait de Chloé est épuisé.
    const parNom = (n) => E.eleves.find((e) => e.nom === n);
    const ines = parNom('Inès B.'), chloe = parNom('Chloé D.');
    const achatsDe = (e) => E.achats.filter((a) => a.eleveId === e.id);
    const fi = R.soldeEleve(ines.id, E, t).faites;
    if (fi >= 22) { const a = achatsDe(ines)[1]; a.heures = fi - 21; a.libelle = `${a.heures} h supplémentaires`; }
    E.lecons = E.lecons.filter((l) => !(l.eleveId === chloe.id && l.statut === 'prevue'));
    const fc = R.soldeEleve(chloe.id, E, t).faites;
    if (fc > 0) Object.assign(achatsDe(chloe)[0], { heures: fc, libelle: `Forfait ${fc} h` });
    // Compétences cochées au prorata des heures faites, dates réparties.
    for (const e of E.eleves) {
      const s = R.soldeEleve(e.id, E, t);
      const n = e.statut === 'termine' ? E.reglages.competences.length : Math.min(E.reglages.competences.length - 1, Math.floor(s.faites / 2.2));
      E.reglages.competences.slice(0, n).forEach((c, i) => { e.competences[c] = ajout(e.inscription, Math.min(ecart(e.inscription, t), 4 + i * 5)); });
      delete e.pref;
    }
    // Kilométrage fictif, linéaire depuis l'entrée du véhicule (≈ 40 km par jour) : relevés tous les 15 jours.
    const kmA = (v, d) => v.kmEntree + Math.round(Math.max(0, ecart(v.dateEntree, ajout(t, d))) * 40);
    for (const v of E.vehicules) for (let d = -60; d <= 0; d += 15) E.releves.push({ id: uid(), vehiculeId: v.id, date: ajout(t, d), km: kmA(v, d) });
    const interv = (v, type, d, cout, libelle) => E.interventionsV.push({ id: uid(), vehiculeId: v.id, type, date: ajout(t, d), km: type === 'carburant' ? null : kmA(v, d), cout, libelle, prochainCT: null });
    for (const v of E.vehicules) for (let d = -330; d <= -5; d += 30) if (ajout(t, d) >= v.dateEntree) interv(v, 'carburant', d, 180 + Math.round(alea() * 60), 'Carburant du mois');
    interv(v1, 'entretien', -340, 260, 'Révision annuelle');
    interv(v1, 'pneus', -120, 340, 'Deux pneus avant');
    interv(v2, 'entretien', -330, 240, 'Révision');
    interv(v2, 'reparation', -40, 185, 'Rétroviseur moniteur');
    interv(v3, 'entretien', -60, 210, 'Révision');
    return E;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = `${NOM_PRODUIT} · QME`;
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <circle cx="140" cy="150" r="130" fill="#F0EDE6"/>
          <circle cx="140" cy="150" r="88" fill="#141414"/>
          <rect x="128" y="62" width="24" height="176" fill="#F0EDE6"/>
          <rect x="52" y="138" width="176" height="24" fill="#F0EDE6"/>
          <circle cx="140" cy="150" r="30" fill="#D9302A"/>
          <rect x="300" y="20" width="250" height="260" fill="#1D4E89"/>
          <path d="M300 280 A250 250 0 0 1 550 30 V280 Z" fill="#F5B400"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Gestion d'auto-école · planning et élèves</p>
          <h1>Chaque leçon à sa place, chaque heure comptée.</h1>
          <p>Planning par moniteur et par véhicule sans double réservation, forfaits et paiements des élèves, contrôle technique et coût par heure de conduite.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton auto-école</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Tes données sont enregistrées en ligne et te suivent sur tous tes appareils, du bureau à la voiture.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon auto-école</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore d'accès ? <a href="/templates/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
      </section>
    </div>`;
    const champ = $('#code');
    champ.addEventListener('input', () => {
      const pos = champ.selectionStart === champ.value.length;
      champ.value = formaterCode(champ.value);
      if (pos) champ.setSelectionRange(champ.value.length, champ.value.length);
    });
    $('#form-code').addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = formaterCode(champ.value);
      const err = $('#erreur-code');
      const bouton = e.target.querySelector('button[type=submit]');
      if (!codeComplet(code) && code !== CODE_DEMO) { err.textContent = 'Clé incomplète : elle compte 4 blocs de 8 caractères (copie-la depuis l\'e-mail de Gumroad).'; champ.focus(); return; }
      bouton.disabled = true; bouton.textContent = 'Vérification…'; err.textContent = '';
      try { await connecter(code, $('#memoriser').checked); } catch (x) {
        err.textContent = x.message === 'Failed to fetch' ? 'Pas de connexion internet. Réessaie une fois en ligne.' : x.message;
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon auto-école'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  function ecranAccueil() {
    document.title = `Bienvenue · ${NOM_PRODUIT}`;
    const r = B.reglagesDefaut;
    $('#racine').innerHTML = `
      <div class="accueil">
        <div class="accueil-tete"><span class="marque">${MARQUE}</span><span class="surtitre" style="margin:0">Premier lancement</span></div>
        <p class="surtitre">Bienvenue</p>
        <h1>Ton école en trois lignes.</h1>
        <p class="intro">Les moniteurs et les véhicules d'abord : tu ajouteras ensuite les élèves et les leçons. Tout reste modifiable (disponibilités, horaires, compétences suivies).</p>
        <form id="form-accueil" class="accueil-form" novalidate>
          <div class="grille-2">
            <label class="champ">Nom de l'auto-école <small>Facultatif.</small><input name="ecole" maxlength="80" placeholder="Ex. : Auto-école du centre"></label>
            <label class="champ">Horaires d'ouverture <small>Du lundi au samedi par défaut.</small>
              <span class="rang-heures"><input type="time" name="ouverture" value="${r.ouverture}" aria-label="Ouverture"><span>à</span><input type="time" name="fermeture" value="${r.fermeture}" aria-label="Fermeture"></span></label>
            <label class="champ">Moniteurs <small>Prénoms séparés par des virgules.</small><input name="moniteurs" maxlength="200" placeholder="Ex. : Karim, Sophie"></label>
            <label class="champ">Véhicules <small>Libellés séparés par des virgules (pas besoin de la marque).</small><input name="vehicules" maxlength="200" placeholder="Ex. : Citadine 1, Citadine 2"></label>
          </div>
          <p class="aide">Les disponibilités des moniteurs sont réglées sur les horaires d'ouverture ; précise-les ensuite dans l'onglet Moniteurs. Données d'élèves (parfois mineurs) : ne saisis que le nécessaire, voir le Guide.</p>
          <p class="erreur" role="alert"></p>
          <div class="accueil-pied"><span></span><button class="btn primaire" type="submit">Créer mon planning</button></div>
        </form>
      </div>`;
    $('#form-accueil').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const liste = (k) => String(f.get(k) || '').split(',').map((x) => x.trim()).filter(Boolean).slice(0, 30);
      const mon = liste('moniteurs'), veh = liste('vehicules');
      const ouv = String(f.get('ouverture') || ''), fer = String(f.get('fermeture') || '');
      const err = e.target.querySelector('.erreur');
      if (!mon.length) { err.textContent = 'Indique au moins un moniteur.'; e.target.moniteurs.focus(); return; }
      if (!R.estHeure(ouv) || !R.estHeure(fer) || R.minutes(fer) <= R.minutes(ouv)) { err.textContent = 'Horaires d\'ouverture invalides.'; return; }
      E = etatVide();
      E.ecole = String(f.get('ecole') || '').trim();
      Object.assign(E.reglages, { ouverture: ouv, fermeture: fer });
      const dispo = Object.fromEntries(E.reglages.joursOuverts.map((j) => [j, [[R.minutes(ouv), R.minutes(fer)]]]));
      mon.forEach((nom, i) => E.moniteurs.push({ id: uid(), nom, couleur: B.couleurs[i % B.couleurs.length].id, dispos: structuredClone(dispo), absences: [], actif: true }));
      veh.forEach((nom) => E.vehicules.push({ id: uid(), nom, immat: '', boite: 'manuelle', dateEntree: auj(), kmEntree: 0, coutMensuel: 0, entretienKm: null, entretienMois: null, ctProchain: null, actif: true, notes: '' }));
      sauver();
      vue = 'eleves';
      demarrer();
      setTimeout(() => modaleEleve(), 250);
    });
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    planning: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    eleves: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    vehicules: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2.5"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/><rect x="3.5" y="10.8" width="17" height="2.4" fill="currentColor"/><rect x="10.8" y="12" width="2.4" height="8.5" fill="currentColor"/></svg>',
    moniteurs: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2Z" fill="currentColor"/></svg>',
    bilan: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="12" width="4" height="9" fill="currentColor"/><rect x="10" y="6" width="4" height="15" fill="currentColor"/><rect x="17" y="2" width="4" height="19" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['planning', 'Planning'], ['eleves', 'Élèves'], ['vehicules', 'Véhicules'], ['moniteurs', 'Moniteurs'], ['bilan', 'Bilan']];
  const TITRES = { ...Object.fromEntries(ONGLETS), guide: 'Guide' };

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (TITRES[depuisUrl]) vue = depuisUrl;
    if (!plan.date) plan.date = auj();
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><span>Données fictives, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai une clé d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Gestion<br>d'auto-école</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span>${nom}</span></button>`).join('')}</nav>
        <span class="sync" data-etat="ok" role="status"><i></i><b>Enregistré</b></span>
        <button class="btn-icone" data-action="reglages" aria-label="Réglages et sauvegarde" title="Réglages">${ICONES.reglages}</button>
      </div></header>
      <main class="vue" id="vue" tabindex="-1"></main>`;
    majSync(session.demo ? 'demo' : (stock.lire(CLE_CACHE)?.nonEnvoye ? 'attente' : 'ok'));
    rendre();
    proposerEcranAccueil();
  }

  function rendre() {
    if (!E || !$('#vue')) return;
    const onglet = vue === 'guide' ? 'bilan' : vue;
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === onglet) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    document.title = `${TITRES[vue]} · ${NOM_PRODUIT}`;
    $('#vue').innerHTML = { planning: vuePlanning, eleves: vueEleves, vehicules: vueVehicules, moniteurs: vueMoniteurs, bilan: vueBilan, guide: vueGuide }[vue]();
    if (vue === 'eleves') brancherEleves();
    if (vue === 'bilan') brancherGraphique();
  }

  function changerVue(v) {
    vue = v;
    if (v !== 'eleves') eleveChoisi = null;
    if (v !== 'vehicules') vehiculeChoisi = null;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="40" width="56" height="56" fill="#1D4E89"/><circle cx="62" cy="34" r="34" fill="#F5B400"/><path d="M56 96 96 96 96 56Z" fill="#D9302A"/></svg>';
  const videEtat = (titre, texte, actions = '') => `<div class="vide-etat">${FORME_VIDE}<div><h3>${titre}</h3><p>${texte}</p>${actions ? `<div class="actions">${actions}</div>` : ''}</div></div>`;
  const ETAT_LECON = { prevue: ['contour', 'Prévue'], faite: ['bleu', 'Faite'], absent: ['rouge', 'Absent'], annulee: ['gris', 'Annulée'], pointer: ['jaune', 'À pointer'] };
  const etatLecon = (l, t = auj()) => (l.statut === 'prevue' && (l.date < t || (l.date === t && R.finMin(l) <= maintenant())) ? 'pointer' : l.statut);
  const pastilleMon = (m) => `<i class="pm" style="background:${couleur(m?.couleur).hex}"></i>`;

  // ---------- Vue Planning ----------
  function vuePlanning() {
    const t = auj();
    const mode = plan.mode || (estTelephone() ? 'jour' : 'semaine');
    const d = plan.date;
    const l0 = R.lundi(d);
    const titre = mode === 'jour' ? fmtLong(d) : `Semaine du ${fmt(l0, { day: 'numeric', month: 'long' })}`;
    const aPointer = E.lecons.filter((l) => etatLecon(l, t) === 'pointer').length;
    if (!E.moniteurs.length) return `<div class="vue-tete"><div><h1>Planning</h1></div></div>${videEtat('Aucun moniteur', 'Ajoute un moniteur et ses disponibilités pour planifier des leçons.', '<button class="btn primaire" data-action="moniteur-nouveau">Ajouter un moniteur</button>')}`;
    return `
      <div class="vue-tete"><div><p class="surtitre">${mode === 'jour' ? (d === t ? 'Aujourd\'hui' : 'Journée') : 'Semaine'}</p><h1>${esc(titre)}</h1>
        ${aPointer ? `<p><button class="btn lien" data-action="pointer-voir">${pluriel(aPointer, 'leçon passée')} à pointer</button> (faite, absent ou annulée).</p>` : '<p>Une leçon qui chevauche une autre du même moniteur, du même véhicule ou du même élève est refusée.</p>'}</div>
        <div class="actions"><button class="btn primaire" data-action="lecon-nouvelle" data-date="${d}">${ICONES.plus}Leçon</button></div></div>
      <div class="plan-barre">
        <div class="nav-dates"><button class="btn petit" data-action="plan-nav" data-pas="-1" aria-label="${mode === 'jour' ? 'Jour' : 'Semaine'} précédent${mode === 'jour' ? '' : 'e'}">‹</button><button class="btn petit" data-action="plan-auj">Aujourd'hui</button><button class="btn petit" data-action="plan-nav" data-pas="1" aria-label="${mode === 'jour' ? 'Jour' : 'Semaine'} suivant${mode === 'jour' ? '' : 'e'}">›</button>
          <label class="sr-only" for="plan-date">Aller à la date</label><input type="date" id="plan-date" class="petit-date" value="${d}"></div>
        <div class="bascule-btn" role="group" aria-label="Affichage"><button data-action="plan-mode" data-mode="jour" aria-pressed="${mode === 'jour'}">Jour</button><button data-action="plan-mode" data-mode="semaine" aria-pressed="${mode === 'semaine'}">Semaine</button></div>
        ${mode === 'semaine' ? `<div class="bascule-btn" role="group" aria-label="Lignes"><button data-action="plan-axe" data-axe="moniteur" aria-pressed="${plan.axe === 'moniteur'}">Moniteurs</button><button data-action="plan-axe" data-axe="vehicule" aria-pressed="${plan.axe === 'vehicule'}">Véhicules</button></div>` : ''}
      </div>
      ${mode === 'jour' ? vueJour(d) : vueSemaine(l0)}`;
  }

  function carteLecon(l, t) {
    const e = eleve(l.eleveId), m = moniteur(l.moniteurId), v = vehicule(l.vehiculeId);
    const et = etatLecon(l, t);
    const [cl, lib] = ETAT_LECON[et];
    const s = e ? R.soldeEleve(e.id, E, t) : null;
    return `<li class="lecon ${l.statut}" style="--c:${couleur(m?.couleur).hex}">
      <button class="lecon-corps" data-action="lecon-modifier" data-id="${l.id}">
        <span class="lecon-heure"><b>${l.debut}</b><small>${R.hhmm(R.finMin(l))}</small></span>
        <span class="lecon-texte"><b>${esc(e?.nom || 'Élève supprimé')}</b><small>${esc(v?.nom || 'Sans véhicule')}${e?.boite === 'auto' ? ' · boîte auto' : ''}${s ? ` · ${s.restantes < 0 ? `<em>forfait dépassé de ${h(-s.restantes)}</em>` : `${h(s.restantes)} restantes`}` : ''}${l.note ? ` · ${esc(l.note)}` : ''}</small></span>
        <span class="etiquette ${cl}">${lib}</span>
      </button>
      ${l.statut === 'prevue' ? `<div class="lecon-actions"><button class="act" data-action="lecon-statut" data-statut="faite" data-id="${l.id}">Faite</button><button class="act absent" data-action="lecon-statut" data-statut="absent" data-id="${l.id}">Absent</button><button class="act annuler" data-action="lecon-statut" data-statut="annulee" data-id="${l.id}">Annuler</button></div>` : ''}
    </li>`;
  }

  function vueJour(d) {
    const t = auj();
    const lecons = E.lecons.filter((l) => l.date === d).sort((a, b) => a.debut.localeCompare(b.debut));
    const ouvert = E.reglages.joursOuverts.includes(R.jourSemaine(d));
    const total = lecons.filter(R.occupe).reduce((s, l) => s + R.heures(l), 0);
    const mons = actifs(E.moniteurs).filter((m) => lecons.some((l) => l.moniteurId === m.id) || (m.dispos?.[R.jourSemaine(d)] || []).length);
    const autres = E.moniteurs.filter((m) => !mons.includes(m) && lecons.some((l) => l.moniteurId === m.id));
    const groupes = [...mons, ...autres].map((m) => {
      const ls = lecons.filter((l) => l.moniteurId === m.id);
      const abs = R.absentLe(m, d);
      const plages = m.dispos?.[R.jourSemaine(d)] || [];
      return `<section class="groupe-jour" style="--c:${couleur(m.couleur).hex};--t:${couleur(m.couleur).texte}">
        <header><h2>${esc(m.nom)}</h2><span>${abs ? 'Absent' : plages.length ? esc(R.ecrirePlages(plages)) : 'Pas de disponibilité ce jour'} · ${h(ls.filter(R.occupe).reduce((s, l) => s + R.heures(l), 0))}</span>
          <button data-action="lecon-nouvelle" data-date="${d}" data-moniteur="${m.id}" aria-label="Nouvelle leçon avec ${esc(m.nom)}">${ICONES.plus}</button></header>
        ${ls.length ? `<ul class="lecons">${ls.map((l) => carteLecon(l, t)).join('')}</ul>` : `<p class="vide-groupe">${abs ? 'Absent ce jour.' : 'Aucune leçon.'}</p>`}
      </section>`;
    }).join('');
    return `<p class="note">${ouvert ? '' : '<b>Jour de fermeture.</b> '}${pluriel(lecons.filter(R.occupe).length, 'leçon')} · ${h(total)} de conduite.</p>
      <div class="jour-grille">${groupes || videEtat('Aucun moniteur disponible', 'Personne n\'est disponible ce jour-là.')}</div>`;
  }

  function vueSemaine(l0) {
    const t = auj();
    const jours = Array.from({ length: 7 }, (_, i) => ajout(l0, i)).filter((j) => E.reglages.joursOuverts.includes(R.jourSemaine(j)) || E.lecons.some((l) => l.date === j && R.occupe(l)));
    const lignes = plan.axe === 'moniteur' ? actifs(E.moniteurs) : actifs(E.vehicules);
    const cle = plan.axe === 'moniteur' ? 'moniteurId' : 'vehiculeId';
    const lecons = E.lecons.filter((l) => l.date >= l0 && l.date <= ajout(l0, 6) && l.statut !== 'annulee');
    const occ = R.occupation(l0, E);
    const tauxDe = (id) => (plan.axe === 'moniteur' ? occ.moniteurs : occ.vehicules).find((x) => x.id === id);
    if (!lignes.length) return videEtat('Aucun véhicule', 'Ajoute un véhicule pour voir son planning.', '<button class="btn primaire" data-action="vehicule-nouveau">Ajouter un véhicule</button>');
    const tete = `<tr><th scope="col" class="coin">${plan.axe === 'moniteur' ? 'Moniteur' : 'Véhicule'}</th>${jours.map((j) => `<th scope="col" class="${j === t ? 'auj' : ''}"><button data-action="plan-jour" data-date="${j}">${fmt(j, { weekday: 'short', day: 'numeric' })}</button></th>`).join('')}</tr>`;
    const corps = lignes.map((x) => {
      const o = tauxDe(x.id);
      return `<tr><th scope="row" style="--c:${plan.axe === 'moniteur' ? couleur(x.couleur).hex : 'var(--encre)'}"><b>${esc(x.nom)}</b><small>${h(o?.heures || 0)}${o?.taux !== null && o?.taux !== undefined ? ` · ${o.taux} %` : ''}</small></th>${jours.map((j) => {
        const ls = lecons.filter((l) => l[cle] === x.id && l.date === j).sort((a, b) => a.debut.localeCompare(b.debut));
        const abs = plan.axe === 'moniteur' && R.absentLe(x, j);
        return `<td class="${j === t ? 'auj' : ''} ${abs ? 'absent' : ''}">${abs ? '<span class="mention-abs">Absent</span>' : ''}${ls.map((l) => {
          const m = moniteur(l.moniteurId);
          const et = etatLecon(l, t);
          return `<button class="puce-lecon ${et}" style="--c:${couleur(m?.couleur).hex};--t:${couleur(m?.couleur).texte}" data-action="lecon-modifier" data-id="${l.id}" title="${esc(`${l.debut}-${R.hhmm(R.finMin(l))} · ${noms.eleve(l.eleveId)} · ${noms.moniteur(l.moniteurId)} · ${noms.vehicule(l.vehiculeId)}`)}"><b>${l.debut}</b> ${esc(noms.eleve(l.eleveId))}${plan.axe === 'vehicule' ? ` <small>${esc(noms.moniteur(l.moniteurId))}</small>` : ''}</button>`;
        }).join('')}<button class="ajout-cellule" data-action="lecon-nouvelle" data-date="${j}" data-${plan.axe}="${x.id}" aria-label="Nouvelle leçon le ${fmt(j, { weekday: 'long', day: 'numeric' })} · ${esc(x.nom)}">+</button></td>`;
      }).join('')}</tr>`;
    }).join('');
    return `<div class="defile semaine-cadre"><table class="semaine"><thead>${tete}</thead><tbody>${corps}</tbody></table></div>
      <p class="note">Couleur du moniteur ; pastille estompée : leçon faite ; contour pointillé : leçon passée à pointer. Touche un jour pour l'ouvrir en vue jour.</p>`;
  }

  // ---------- Vue Élèves ----------
  function vueEleves() {
    if (eleveChoisi && eleve(eleveChoisi)) return ficheEleve(eleve(eleveChoisi));
    const t = auj();
    const txt = filtreEleves.texte.trim().toLowerCase();
    const liste = E.eleves.filter((e) => (filtreEleves.statut === 'tous' || (filtreEleves.statut === 'termine' ? e.statut === 'termine' : e.statut !== 'termine')) && (!txt || e.nom.toLowerCase().includes(txt))).sort(triNom);
    const nbA = E.eleves.filter((e) => e.statut !== 'termine').length;
    const cartes = liste.map((e) => {
      const s = R.soldeEleve(e.id, E, t);
      const p = R.progression(e, E.reglages.competences);
      const max = Math.max(s.achetees, s.faites + s.planifiees, 1);
      return `<li><button class="eleve" data-action="eleve-ouvrir" data-id="${e.id}">
        <span class="eleve-tete"><b>${esc(e.nom)}</b><span>${e.boite === 'auto' ? '<span class="etiquette contour">Auto</span>' : ''}${e.mineur ? '<span class="etiquette jaune">Mineur</span>' : ''}${e.statut === 'termine' ? '<span class="etiquette gris">Terminé</span>' : ''}</span></span>
        <span class="eleve-chiffres"><span><b class="${s.restantes < 0 ? 'alerte' : ''}">${h(s.restantes)}</b><small>restantes sur ${h(s.achetees)}</small></span><span><b class="${s.du > 0 ? 'alerte' : ''}">${euros(s.du)}</b><small>reste dû</small></span><span><b>${p.acquises}/${p.total}</b><small>compétences</small></span></span>
        <span class="jauge" aria-hidden="true"><i class="faites" style="width:${Math.min(100, (s.faites / max) * 100)}%"></i><i class="planifiees" style="width:${Math.min(100, (s.planifiees / max) * 100)}%"></i></span>
        <span class="eleve-pied">${s.prochaine ? `Prochaine leçon ${quand(s.prochaine.slice(0, 10))} à ${s.prochaine.slice(11)}` : 'Aucune leçon planifiée'}${s.aPointer ? ` · <em>${s.aPointer} à pointer</em>` : ''}</span>
      </button></li>`;
    }).join('');
    return `
      <div class="vue-tete"><div><h1>Élèves</h1><p>${pluriel(nbA, 'élève actif', 'élèves actifs')}. Heures restantes = achetées − faites${E.reglages.decompteAbsence ? ' (absences non excusées comprises)' : ''}. Barre : <b class="cle-bleu">faites</b>, <b class="cle-jaune">planifiées</b>.</p></div>
        <div class="actions"><button class="btn primaire" data-action="eleve-nouveau">${ICONES.plus}Élève</button></div></div>
      <div class="filtres-eleves">
        <div class="bascule-btn" role="group" aria-label="Statut">${[['actif', 'Actifs'], ['termine', 'Terminés'], ['tous', 'Tous']].map(([k, l]) => `<button data-action="eleves-statut" data-statut="${k}" aria-pressed="${filtreEleves.statut === k}">${l}</button>`).join('')}</div>
        <label class="champ recherche"><span class="sr-only">Rechercher un élève</span><input id="recherche-eleve" type="search" placeholder="Rechercher un élève" value="${esc(filtreEleves.texte)}"></label>
      </div>
      <div id="liste-eleves">${liste.length ? `<ul class="eleves">${cartes}</ul>` : (E.eleves.length ? '<p class="note">Aucun élève ne correspond.</p>' : videEtat('Aucun élève', 'Ajoute ton premier élève avec son forfait d\'heures : le solde se met à jour à chaque leçon pointée.', `<button class="btn primaire" data-action="eleve-nouveau">${ICONES.plus}Ajouter un élève</button>`))}</div>`;
  }

  function brancherEleves() {
    const champ = $('#recherche-eleve');
    if (!champ) return;
    champ.addEventListener('input', () => {
      filtreEleves.texte = champ.value;
      const pos = champ.selectionStart;
      rendre();
      const c = $('#recherche-eleve'); c.focus(); c.setSelectionRange(pos, pos);
    });
  }

  function ficheEleve(e) {
    const t = auj();
    const s = R.soldeEleve(e.id, E, t);
    const p = R.progression(e, E.reglages.competences);
    const lecons = E.lecons.filter((l) => l.eleveId === e.id).sort((a, b) => (b.date + b.debut).localeCompare(a.date + a.debut));
    const achats = E.achats.filter((a) => a.eleveId === e.id).sort((a, b) => b.date.localeCompare(a.date));
    const paiements = E.paiements.filter((x) => x.eleveId === e.id).sort((a, b) => b.date.localeCompare(a.date));
    const tuiles = [
      ['Heures restantes', nb(s.restantes), 'h', `${h(s.faites)} faites sur ${h(s.achetees)} achetées`, s.restantes < 0 ? 'var(--rouge)' : 'var(--bleu)', 'rond'],
      ['À planifier', nb(s.aPlanifier), 'h', `${h(s.planifiees)} déjà planifiées`, s.aPlanifier < 0 ? 'var(--rouge)' : 'var(--jaune)', ''],
      ['Reste dû', nb(s.du, 2), '€', `${euros(s.paye)} payés sur ${euros(s.facture)}`, s.du > 0 ? 'var(--rouge)' : 'var(--encre)', ''],
      ['Compétences', p.acquises, `/${p.total}`, `${p.taux} % de la liste suivie`, 'var(--encre)', 'rond'],
    ].map(([lib, v, u, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}<small>${u}</small></b><span>${d}</span></div>`).join('');
    return `
      <button class="btn lien retour" data-action="eleve-fermer">‹ Tous les élèves</button>
      <div class="vue-tete"><div><p class="surtitre">Élève${e.inscription ? ` · inscrit le ${R.dateFr(e.inscription)}` : ''}</p><h1>${esc(e.nom)}</h1>
        <p>${e.boite === 'auto' ? 'Boîte automatique' : 'Boîte manuelle'}${e.mineur ? ' · <b>mineur</b> : informe aussi son représentant légal' : ''}${e.statut === 'termine' ? ' · formation terminée' : ''}${e.contact ? ` · ${esc(e.contact)}` : ''}</p>${e.notes ? `<p class="note">${esc(e.notes)}</p>` : ''}</div>
        <div class="actions"><button class="btn primaire" data-action="lecon-nouvelle" data-eleve="${e.id}">${ICONES.plus}Leçon</button><button class="btn" data-action="achat-nouveau" data-id="${e.id}">+ Heures</button><button class="btn" data-action="paiement-nouveau" data-id="${e.id}">+ Paiement</button><button class="btn" data-action="eleve-modifier" data-id="${e.id}">Modifier</button></div></div>
      <div class="tuiles">${tuiles}</div>
      <div class="fiche-grille">
        <section><h2 class="titre-section">Compétences <span>Coche quand c'est acquis : la date du jour est notée.</span></h2>
          <ul class="competences">${E.reglages.competences.map((c, i) => `<li><label class="case"><input type="checkbox" data-competence="${i}" ${e.competences?.[c] ? 'checked' : ''}> <span>${esc(c)}${e.competences?.[c] ? `<small>acquis le ${R.dateFr(e.competences[c])}</small>` : ''}</span></label></li>`).join('')}</ul>
          <p class="note">Liste générique modifiable dans les réglages : ce n'est pas le livret officiel.</p></section>
        <section><h2 class="titre-section">Achats et paiements</h2>
          <div class="bloc-liste">${achats.map((a) => `<div class="ligne-compte"><span><b>${esc(a.libelle || 'Heures')}</b><small>${R.dateFr(a.date)} · ${h(a.heures)}</small></span><span class="montant">${euros(a.montant)}</span><button class="suppr" data-action="achat-suppr" data-id="${a.id}" aria-label="Supprimer cet achat">×</button></div>`).join('') || '<p class="vide-groupe">Aucun achat d\'heures.</p>'}</div>
          <div class="bloc-liste" style="margin-top:12px">${paiements.map((x) => `<div class="ligne-compte paiement"><span><b>Paiement · ${esc(x.mode || '')}</b><small>${R.dateFr(x.date)}</small></span><span class="montant">${euros(x.montant)}</span><button class="suppr" data-action="paiement-suppr" data-id="${x.id}" aria-label="Supprimer ce paiement">×</button></div>`).join('') || '<p class="vide-groupe">Aucun paiement.</p>'}</div></section>
      </div>
      <h2 class="titre-section">Leçons <span>${pluriel(lecons.filter((l) => l.statut === 'faite').length, 'faite')}, ${pluriel(lecons.filter((l) => l.statut === 'prevue').length, 'prévue')}</span></h2>
      ${lecons.length ? `<div class="bloc-liste">${lecons.map((l) => { const [cl, lib] = ETAT_LECON[etatLecon(l, t)]; return `<button class="ligne-lecon" data-action="lecon-modifier" data-id="${l.id}"><span class="etiquette ${cl}">${lib}</span><span><b>${fmt(l.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · ${l.debut}-${R.hhmm(R.finMin(l))}</b><small>${pastilleMon(moniteur(l.moniteurId))}${esc(noms.moniteur(l.moniteurId))} · ${esc(noms.vehicule(l.vehiculeId))}${l.note ? ` · ${esc(l.note)}` : ''}</small></span></button>`; }).join('')}</div>` : '<p class="note">Aucune leçon pour l\'instant.</p>'}`;
  }

  // ---------- Vue Véhicules ----------
  const ETAT_ECH = { retard: ['rouge', 'Dépassé'], proche: ['jaune', 'Bientôt'], ok: ['bleu', 'À jour'], inconnu: ['contour', 'Non saisi'] };
  const debut12 = (t) => ajout(R.ajoutMois(t, -12), 1);

  function vueVehicules() {
    if (vehiculeChoisi && vehicule(vehiculeChoisi)) return ficheVehicule(vehicule(vehiculeChoisi));
    const t = auj();
    const liste = [...E.vehicules].sort((a, b) => (a.actif === false) - (b.actif === false) || a.nom.localeCompare(b.nom));
    return `
      <div class="vue-tete"><div><h1>Véhicules</h1><p>Kilométrage, contrôle technique, entretien et coût par heure de conduite sur 12 mois. Dates limites du contrôle technique : saisies d'après le procès-verbal.</p></div>
        <div class="actions"><button class="btn primaire" data-action="vehicule-nouveau">${ICONES.plus}Véhicule</button></div></div>
      ${liste.length ? `<div class="vehicules">${liste.map((v) => carteVehicule(v, t)).join('')}</div>` : videEtat('Aucun véhicule', 'Ajoute tes véhicules école : libellé, immatriculation, boîte et date limite du contrôle technique.', `<button class="btn primaire" data-action="vehicule-nouveau">${ICONES.plus}Ajouter un véhicule</button>`)}`;
  }

  function carteVehicule(v, t) {
    const c = R.controle(v, E, t, E.reglages), e = R.entretien(v, E, t, E.reglages), k = R.coutVehicule(v, E, debut12(t), t);
    const ech = (x) => `<span class="etiquette ${ETAT_ECH[x.etat][0]}">${ETAT_ECH[x.etat][1]}</span>`;
    return `<article class="vehicule ${v.actif === false ? 'inactif' : ''}">
      <header><div><h2>${esc(v.nom)}</h2><p>${esc(v.immat || 'Immatriculation non saisie')} · ${v.boite === 'auto' ? 'Automatique' : 'Manuelle'}${v.actif === false ? ' · hors service' : ''}</p></div><button data-action="vehicule-modifier" data-id="${v.id}">Modifier</button></header>
      <dl class="vehicule-chiffres">
        <div><dt>Kilométrage</dt><dd>${nb(R.kmActuel(v, E), 0)} km</dd></div>
        <div><dt>Contrôle technique</dt><dd>${c.date ? `avant le ${R.dateFr(c.date)}` : '–'} ${ech(c)}</dd></div>
        <div><dt>Entretien</dt><dd>${e.etat === 'inconnu' ? 'Intervalle non saisi' : [e.echeanceKm !== null ? `${nb(e.echeanceKm, 0)} km` : '', e.echeanceDate ? `le ${R.dateFr(e.echeanceDate)}` : ''].filter(Boolean).join(' ou ')} ${ech(e)}</dd></div>
        <div><dt>Coût par heure (12 mois)</dt><dd>${k.parHeure === null ? '–' : euros(k.parHeure)} <small>${euros(k.total)} · ${h(k.heures)}</small></dd></div>
      </dl>
      <div class="vehicule-actions"><button class="act" data-action="releve-nouveau" data-id="${v.id}">Relevé km</button><button class="act" data-action="intervention-nouvelle" data-id="${v.id}">Intervention</button><button class="act" data-action="vehicule-ouvrir" data-id="${v.id}">Historique</button></div>
    </article>`;
  }

  function ficheVehicule(v) {
    const t = auj();
    const interv = E.interventionsV.filter((i) => i.vehiculeId === v.id).sort((a, b) => b.date.localeCompare(a.date));
    const releves = E.releves.filter((r) => r.vehiculeId === v.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
    const typeNom = (id) => B.interventions.find((x) => x.id === id)?.nom || id;
    return `
      <button class="btn lien retour" data-action="vehicule-fermer">‹ Tous les véhicules</button>
      <div class="vue-tete"><div><p class="surtitre">Véhicule</p><h1>${esc(v.nom)}</h1><p>${esc(v.immat || '')}${v.notes ? ` · ${esc(v.notes)}` : ''}</p></div>
        <div class="actions"><button class="btn primaire" data-action="intervention-nouvelle" data-id="${v.id}">${ICONES.plus}Intervention</button><button class="btn" data-action="releve-nouveau" data-id="${v.id}">Relevé km</button><button class="btn" data-action="vehicule-modifier" data-id="${v.id}">Modifier</button></div></div>
      <div class="vehicules un">${carteVehicule(v, t)}</div>
      <h2 class="titre-section">Interventions et dépenses <span>${euros(interv.reduce((s, i) => s + Number(i.cout || 0), 0))} au total</span></h2>
      ${interv.length ? `<div class="bloc-liste">${interv.map((i) => `<div class="ligne-compte"><span><b>${esc(typeNom(i.type))}${i.libelle ? ` · ${esc(i.libelle)}` : ''}</b><small>${R.dateFr(i.date)}${i.km ? ` · ${nb(i.km, 0)} km` : ''}${i.prochainCT ? ` · prochain contrôle avant le ${R.dateFr(i.prochainCT)}` : ''}</small></span><span class="montant">${euros(i.cout)}</span><button class="suppr" data-action="intervention-suppr" data-id="${i.id}" aria-label="Supprimer cette intervention">×</button></div>`).join('')}</div>` : '<p class="note">Aucune intervention enregistrée.</p>'}
      <h2 class="titre-section">Derniers relevés kilométriques</h2>
      ${releves.length ? `<div class="bloc-liste">${releves.map((r) => `<div class="ligne-compte"><span><b>${nb(r.km, 0)} km</b><small>${R.dateFr(r.date)}</small></span><span></span><button class="suppr" data-action="releve-suppr" data-id="${r.id}" aria-label="Supprimer ce relevé">×</button></div>`).join('')}</div>` : '<p class="note">Aucun relevé.</p>'}`;
  }

  // ---------- Vue Moniteurs ----------
  function vueMoniteurs() {
    const t = auj();
    const l0 = R.lundi(t);
    const occ = R.occupation(l0, E);
    const liste = [...E.moniteurs].sort((a, b) => (a.actif === false) - (b.actif === false) || a.nom.localeCompare(b.nom));
    const cartes = liste.map((m) => {
      const o = occ.moniteurs.find((x) => x.id === m.id) || { heures: 0, dispo: 0, taux: null };
      const c = couleur(m.couleur);
      const absences = (m.absences || []).filter((a) => (a.fin || a.debut) >= t).sort((a, b) => a.debut.localeCompare(b.debut));
      const aVenir = E.lecons.filter((l) => l.moniteurId === m.id && l.date >= t && l.statut === 'prevue').length;
      return `<article class="moniteur" style="--c:${c.hex};--t:${c.texte}">
        <header><h2>${esc(m.nom)}</h2><button data-action="moniteur-modifier" data-id="${m.id}">Modifier</button></header>
        <div class="occupation"><div><b>${h(o.heures)}</b><small>planifiées cette semaine sur ${h(o.dispo)} disponibles</small></div><span class="jauge"><i class="faites" style="width:${Math.min(100, o.taux || 0)}%"></i></span><small>${o.taux === null ? 'Aucune disponibilité cette semaine' : `Occupation ${o.taux} %`} · ${pluriel(aVenir, 'leçon')} à venir</small></div>
        <ul class="dispos">${B.jours.map((j, i) => { const p = m.dispos?.[i + 1] || []; return `<li class="${p.length ? '' : 'off'}"><b>${j.slice(0, 3)}</b><span>${p.length ? esc(R.ecrirePlages(p)) : '–'}</span></li>`; }).join('')}</ul>
        ${absences.length ? `<p class="absences">${absences.map((a) => `Absent ${a.debut === (a.fin || a.debut) ? `le ${R.dateFr(a.debut)}` : `du ${R.dateFr(a.debut)} au ${R.dateFr(a.fin)}`}${a.motif ? ` (${esc(a.motif)})` : ''}`).join(' · ')}</p>` : ''}
        <div class="vehicule-actions"><button class="act" data-action="moniteur-semaine" data-id="${m.id}">Sa semaine</button><button class="act" data-action="lecon-nouvelle" data-moniteur="${m.id}" data-date="${t}">Nouvelle leçon</button></div>
      </article>`;
    }).join('');
    return `
      <div class="vue-tete"><div><h1>Moniteurs</h1><p>Disponibilités de chaque semaine type et absences : une leçon en dehors est refusée, sauf si tu coches « Forcer ».</p></div>
        <div class="actions"><button class="btn primaire" data-action="moniteur-nouveau">${ICONES.plus}Moniteur</button></div></div>
      ${liste.length ? `<div class="moniteurs">${cartes}</div>` : videEtat('Aucun moniteur', 'Ajoute un moniteur et ses disponibilités.', '<button class="btn primaire" data-action="moniteur-nouveau">Ajouter un moniteur</button>')}`;
  }

  // ---------- Vue Bilan ----------
  function vueBilan() {
    const t = auj();
    const m = R.parMois(E, t, 6);
    const ce = m.at(-1);
    const elevesA = E.eleves.filter((e) => e.statut !== 'termine').map((e) => R.soldeEleve(e.id, E, t));
    const dues = elevesA.reduce((s, x) => s + Math.max(0, x.restantes), 0);
    const aEnc = E.eleves.map((e) => R.soldeEleve(e.id, E, t)).reduce((s, x) => s + Math.max(0, x.du), 0);
    const alertes = R.alertes(E, t);
    const occ = R.occupation(R.lundi(t), E);
    const d12 = debut12(t);
    const couts = actifs(E.vehicules).map((v) => ({ v, k: R.coutVehicule(v, E, d12, t) }));
    const tuiles = [
      ['Heures vendues', nb(ce.vendues), 'h', `en ${fmt(`${ce.mois}-01`, { month: 'long' })}`, 'var(--jaune)', ''],
      ['Heures faites', nb(ce.faites), 'h', `en ${fmt(`${ce.mois}-01`, { month: 'long' })}`, 'var(--bleu)', 'rond'],
      ['Heures dues', nb(dues), 'h', `restantes aux ${pluriel(elevesA.length, 'élève actif', 'élèves actifs')}`, 'var(--encre)', ''],
      ['Reste à encaisser', nb(aEnc, 0), '€', `${euros(ce.encaisse)} encaissés ce mois`, aEnc > 0 ? 'var(--rouge)' : 'var(--encre)', 'rond'],
    ].map(([lib, v, u, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}<small>${u}</small></b><span>${d}</span></div>`).join('');
    const niveau = { retard: 'rouge', proche: 'jaune', info: 'contour' };
    const libNiveau = { retard: 'Urgent', proche: 'À voir', info: 'Info' };
    const meter = (nom, o, c) => `<div class="meter"><span><b>${esc(nom)}</b><small>${h(o.heures)} / ${h(o.dispo)}</small></span><span class="jauge"><i style="width:${Math.min(100, o.taux || 0)}%;background:${c}"></i></span><b class="taux">${o.taux === null ? '–' : `${o.taux} %`}</b></div>`;
    return `
      <div class="vue-tete"><div><h1>Bilan</h1><p>Heures vendues et faites, ce que tu dois encore aux élèves, ce qu'ils te doivent, et ce que coûte une heure de conduite.</p></div>
        <div class="actions"><button class="btn" data-action="vue" data-vue="guide">Guide et règles</button></div></div>
      <div class="tuiles">${tuiles}</div>
      <h2 class="titre-section">Alertes <span>${alertes.length ? pluriel(alertes.length, 'point') + ' à traiter' : ''}</span></h2>
      ${alertes.length ? `<div class="bloc-liste">${alertes.slice(0, 14).map((a) => `<button class="ligne-retard" data-action="alerte" data-type="${a.type}" data-id="${a.id}"><span class="etiquette ${niveau[a.niveau]}">${libNiveau[a.niveau]}</span><span><b>${esc(a.texte)}</b></span></button>`).join('')}${alertes.length > 14 ? `<p class="vide-groupe">Et ${alertes.length - 14} autres.</p>` : ''}</div>` : `<div class="vide-etat petit">${FORME_VIDE}<div><h3>Rien à signaler</h3><p>Contrôles, entretiens, forfaits et paiements sont à jour.</p></div></div>`}
      <h2 class="titre-section">Heures vendues et faites <span>6 derniers mois. Touche une colonne pour le détail.</span></h2>
      <figure class="graphique" id="graphique">
        <div class="graphique-tete"><h2>Heures par mois</h2><div class="legende"><span><i style="background:#F5B400"></i>Vendues</span><span><i style="background:#1D4E89"></i>Faites</span></div></div>
        ${graphiqueMois(m)}
        <div class="infobulle" hidden></div>
        <div class="sr-only"><table><caption>Heures vendues et faites par mois</caption><thead><tr><th>Mois</th><th>Vendues</th><th>Faites</th><th>Encaissé</th></tr></thead><tbody>${m.map((x) => `<tr><td>${fmt(`${x.mois}-01`, { month: 'long', year: 'numeric' })}</td><td>${nb(x.vendues)}</td><td>${nb(x.faites)}</td><td>${euros(x.encaisse)}</td></tr>`).join('')}</tbody></table></div>
      </figure>
      <h2 class="titre-section">Occupation de la semaine <span>Leçons planifiées ou faites ÷ heures d'ouverture (véhicules) ou de disponibilité (moniteurs).</span></h2>
      <div class="occupations">
        <div class="bloc-occ"><h3>Véhicules</h3>${occ.vehicules.map((o) => meter(vehicule(o.id).nom, o, 'var(--encre)')).join('') || '<p class="vide-groupe">Aucun véhicule.</p>'}</div>
        <div class="bloc-occ"><h3>Moniteurs</h3>${occ.moniteurs.map((o) => meter(moniteur(o.id).nom, o, couleur(moniteur(o.id).couleur).hex)).join('') || '<p class="vide-groupe">Aucun moniteur.</p>'}</div>
      </div>
      <h2 class="titre-section">Coût par heure de conduite <span>Du ${R.dateFr(d12)} au ${R.dateFr(t)} : interventions + coût fixe mensuel au prorata, ÷ heures décomptées.</span></h2>
      ${couts.length ? `<div class="defile"><table class="tableau"><thead><tr><th>Véhicule</th><th class="nb">Interventions</th><th class="nb">Coût fixe</th><th class="nb">Heures</th><th class="nb">Coût / heure</th></tr></thead><tbody>${couts.map(({ v, k }) => `<tr><td>${esc(v.nom)}</td><td class="nb">${euros(k.couts)}</td><td class="nb">${euros(k.fixe)}</td><td class="nb">${nb(k.heures)}</td><td class="nb"><b>${k.parHeure === null ? '–' : euros(k.parHeure)}</b></td></tr>`).join('')}</tbody></table></div>` : '<p class="note">Aucun véhicule actif.</p>'}
      <h2 class="titre-section">Exports CSV <span>Point-virgule, pour un tableur.</span></h2>
      <div class="rang-export"><button class="btn petit" data-action="csv-eleves">Élèves et soldes</button><button class="btn petit" data-action="csv-lecons">Leçons des 12 derniers mois</button><button class="btn petit" data-action="csv-vehicules">Véhicules</button></div>`;
  }

  // Graphique en colonnes groupées ; viewBox à la largeur de l'écran (lisible sur téléphone).
  function graphiqueMois(m) {
    const larg = Math.max(320, Math.min(1100, (window.innerWidth || 1100) - 64));
    const haut = 220, g = 34, b = 28, hautU = haut - b - 10;
    const max = Math.max(4, ...m.flatMap((x) => [x.vendues, x.faites]));
    const pas = max <= 20 ? 5 : max <= 60 ? 10 : max <= 150 ? 25 : 50;
    const top = Math.ceil(max / pas) * pas;
    const y = (v) => 10 + hautU - (v / top) * hautU;
    const col = (larg - g) / m.length;
    const bw = Math.min(34, col * 0.32);
    const grilles = Array.from({ length: top / pas + 1 }, (_, i) => i * pas).map((v) => `<line class="grille" x1="${g}" x2="${larg}" y1="${y(v)}" y2="${y(v)}"/><text class="axe" x="${g - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join('');
    const cols = m.map((x, i) => {
      const cx = g + col * i + col / 2;
      const r = (v, dx, c) => `<rect x="${cx + dx}" y="${y(v)}" width="${bw}" height="${Math.max(0, y(0) - y(v))}" fill="${c}" stroke="#141414" stroke-width="${v ? 1.5 : 0}"/>`;
      return `<g class="colonne" data-i="${i}" tabindex="0" aria-label="${fmt(`${x.mois}-01`, { month: 'long' })} : ${nb(x.vendues)} h vendues, ${nb(x.faites)} h faites"><rect class="zone" x="${g + col * i}" y="0" width="${col}" height="${haut}"/>${r(x.vendues, -bw - 1, '#F5B400')}${r(x.faites, 1, '#1D4E89')}<text class="axe" x="${cx}" y="${haut - 8}" text-anchor="middle">${fmt(`${x.mois}-01`, { month: 'short' }).replace('.', '')}</text></g>`;
    }).join('');
    return `<svg viewBox="0 0 ${larg} ${haut}" role="img" aria-label="Heures vendues et faites par mois">${grilles}<line class="base" x1="${g}" x2="${larg}" y1="${y(0)}" y2="${y(0)}"/>${cols}</svg>`;
  }

  function brancherGraphique() {
    const fig = $('#graphique');
    if (!fig) return;
    const bulle = fig.querySelector('.infobulle');
    const m = R.parMois(E, auj(), 6);
    const montrer = (el) => {
      const x = m[Number(el.dataset.i)];
      fig.querySelectorAll('.colonne').forEach((c) => c.classList.toggle('active', c === el));
      bulle.innerHTML = `<b>${fmt(`${x.mois}-01`, { month: 'long', year: 'numeric' })}</b><div><i style="background:#F5B400"></i>Vendues : ${h(x.vendues)}</div><div><i style="background:#1D4E89"></i>Faites : ${h(x.faites)}</div><div>Encaissé : ${euros(x.encaisse)}</div>`;
      bulle.hidden = false;
      const rc = el.getBoundingClientRect(), rf = fig.getBoundingClientRect();
      bulle.style.left = `${Math.max(8, Math.min(rf.width - bulle.offsetWidth - 8, rc.left - rf.left + rc.width / 2 - bulle.offsetWidth / 2))}px`;
      bulle.style.top = '48px';
    };
    fig.querySelectorAll('.colonne').forEach((c) => {
      c.addEventListener('pointerenter', () => montrer(c));
      c.addEventListener('click', () => montrer(c));
      c.addEventListener('focus', () => montrer(c));
    });
    const cacher = () => { bulle.hidden = true; fig.querySelectorAll('.colonne').forEach((c) => c.classList.remove('active')); };
    fig.addEventListener('pointerleave', cacher);
    fig.addEventListener('focusout', cacher);
  }

  // ---------- Vue Guide ----------
  function vueGuide() {
    const C = B.controleTechnique;
    return `
      <button class="btn lien retour" data-action="vue" data-vue="bilan">‹ Bilan</button>
      <div class="vue-tete"><div><h1>Guide</h1><p>Comment l'outil compte, ce qu'il ne fait pas, et les précautions sur les données des élèves.</p></div></div>
      <div class="methodes guide-grille">
        <article class="methode" style="--c:var(--bleu)"><div class="methode-tete"><h2>Planning</h2></div><ol>
          <li><span>Une leçon occupe son créneau [début, fin[ : une leçon de 10:00 à 11:00 et une autre à 11:00 se suivent sans conflit.</span></li>
          <li><span>Refusée si elle chevauche une leçon du même moniteur, du même véhicule ou du même élève (les leçons annulées ne comptent pas).</span></li>
          <li><span>Hors des disponibilités du moniteur, pendant une absence ou hors ouverture : refusée, sauf « Forcer ».</span></li>
          <li><span>Pointage : Faite, Élève absent ou Annulée. Une absence ${E.reglages.decompteAbsence ? 'est' : 'n\'est pas'} décomptée des heures de l'élève (réglage).</span></li></ol></article>
        <article class="methode" style="--c:var(--jaune);--t:var(--encre)"><div class="methode-tete"><h2>Élèves</h2></div><ol>
          <li><span>Heures restantes = heures achetées − heures faites. À planifier = restantes − leçons prévues.</span></li>
          <li><span>Reste dû = total des achats − total des paiements. Les montants sont ceux que tu saisis (aucun tarif proposé, TVA non gérée).</span></li>
          <li><span>Compétences : liste générique d'étapes, modifiable dans les réglages. Ce n'est pas le référentiel ni le livret d'apprentissage officiels : garde le livret de l'élève à jour à part.</span></li></ol></article>
        <article class="methode" style="--c:var(--encre)"><div class="methode-tete"><h2>Véhicules</h2></div><ol>
          <li><span>Kilométrage = plus grand relevé (relevés et interventions). Un relevé incohérent avec les autres est refusé.</span></li>
          <li><span>Entretien : intervalle en km et en mois lu dans le carnet du constructeur ; la première échéance atteinte compte.</span></li>
          <li><span>Coût par heure (12 mois) = (interventions + coût fixe mensuel au prorata des jours) ÷ heures de leçons décomptées avec ce véhicule.</span></li></ol></article>
      </div>
      <h2 class="titre-section">Contrôle technique <span>Repère, pas un conseil juridique.</span></h2>
      <div class="legal">
        <p><b>${esc(C.titre)}</b> (${esc(C.source)}, « vérifié le ${esc(C.verifie)} », consulté le ${esc(C.consulte)}), en substance :</p>
        <ul>${C.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
        <p class="avert">${esc(C.reserve)}</p>
        <p><a href="${C.url}" target="_blank" rel="noopener">Lire la fiche sur service-public.gouv.fr</a>.${E.reglages.periodiciteCT ? ` Périodicité réglée par toi : ${E.reglages.periodiciteCT} mois (proposée après chaque contrôle saisi).` : ' Aucune périodicité réglée : l\'outil ne propose pas de date, il reprend celle que tu saisis.'}</p>
      </div>
      <h2 class="titre-section">Données personnelles des élèves (RGPD)</h2>
      <ul class="limites rgpd">
        <li><b>Le nécessaire seulement</b> : nom (prénom et initiale suffisent souvent), boîte, forfait, paiements, leçons, compétences. Pas de numéro de permis, de pièce d'identité, de données de santé ni d'appréciation personnelle.</li>
        <li><b>Élèves mineurs</b> : leurs données méritent une protection renforcée ; informe aussi leurs représentants légaux de ce que tu enregistres.</li>
        <li><b>Information</b> : dis aux élèves et aux moniteurs quelles données sont tenues et pourquoi (gestion des leçons et des paiements) ; réponds à leurs demandes d'accès ou de suppression.</li>
        <li><b>Durée</b> : supprime (ou exporte puis supprime) les élèves partis une fois la durée utile passée ; fixe cette durée avec tes obligations comptables.</li>
        <li><b>Accès</b> : la clé de licence ouvre toutes les données ; ne la partage qu'avec les personnes qui en ont besoin et déconnecte les appareils partagés.</li>
      </ul>
      <h2 class="titre-section">Limites de la version actuelle</h2>
      <ul class="limites">
        <li><b>Un compte, une clé</b> : pas d'accès séparé pour les moniteurs ni de réservation en ligne par les élèves.</li>
        <li><b>Pas de facturation ni de caisse</b> : les montants servent au suivi ; tes factures et ta comptabilité restent à part.</li>
        <li><b>Pas de lien avec les examens</b> : dates et places d'examen non gérées.</li>
        <li><b>Données texte uniquement</b> : pas de documents ni de photos ; environ 900 Ko par compte (plusieurs milliers de leçons).</li>
      </ul>`;
  }

  // ---------- Modales ----------
  const modale = () => $('#modale');
  function ouvrirModale(titre, corps, pied, auValider) {
    const d = modale();
    d.innerHTML = `<form method="dialog" novalidate><div class="modale-tete"><h2 id="modale-titre">${titre}</h2><button type="button" data-action="fermer" aria-label="Fermer">×</button></div><div class="modale-corps">${corps}</div><div class="modale-pied">${pied}</div></form>`;
    d.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      if (e.submitter?.value === 'annuler') return d.close();
      const err = auValider?.(new FormData(e.target), e.submitter?.value);
      if (typeof err === 'string') { const p = d.querySelector('.erreur'); if (p) { p.textContent = err; p.scrollIntoView({ block: 'nearest' }); } return; }
      if (err === false) return;
      d.close();
    });
    if (!d.open) d.showModal();
    d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),select,textarea')?.focus();
  }
  const PIED = (suppr) => `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${suppr ? '<button class="btn danger gauche" value="suppr">Supprimer</button>' : ''}`;
  const options = (liste, choisi, vide) => `${vide !== undefined ? `<option value="">${vide}</option>` : ''}${liste.map((x) => `<option value="${x.id}" ${x.id === choisi ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}`;
  const nombre = (v) => { const s = String(v ?? '').trim().replace(',', '.').replace(/\s/g, ''); if (s === '') return null; const n = Number(s); return Number.isFinite(n) ? n : NaN; };

  // Modifie l'état avec possibilité d'annuler (instantané complet, restauré par « Annuler »).
  function modifier(fn, message, annulable = true) {
    const avant = structuredClone(E);
    const r = fn();
    if (r === false) return;
    sauver(); rendre();
    toast(message, annulable ? { libelle: 'Annuler', faire: () => { E = avant; sauver(); rendre(); } } : null);
  }

  function modaleLecon(id, pre = {}) {
    const l = id ? lecon(id) : null;
    if (!l && !E.eleves.filter((e) => e.statut !== 'termine').length) { toast('Ajoute d\'abord un élève.'); modaleEleve(); return; }
    if (!l && !actifs(E.moniteurs).length) { toast('Ajoute d\'abord un moniteur.'); modaleMoniteur(); return; }
    const t = auj();
    const v0 = l || { eleveId: pre.eleve || '', moniteurId: pre.moniteur || '', vehiculeId: pre.vehicule || '', date: pre.date || plan.date || t, debut: '', duree: E.reglages.duree, statut: 'prevue', note: '' };
    const el = eleve(v0.eleveId);
    if (!l && el && !v0.vehiculeId) v0.vehiculeId = actifs(E.vehicules).find((v) => v.boite === el.boite)?.id || '';
    if (!l && !v0.moniteurId) v0.moniteurId = actifs(E.moniteurs)[0].id;
    // Premier créneau libre de la journée pour ce moniteur, si aucune heure n'est fixée.
    if (!l && !v0.debut) {
      const m = moniteur(v0.moniteurId);
      const essais = [];
      (m?.dispos?.[R.jourSemaine(v0.date)] || []).forEach(([d, f]) => { for (let x = d; x + Number(v0.duree) <= f; x += 30) essais.push(R.hhmm(x)); });
      v0.debut = essais.find((h0) => !R.verifierLecon({ ...v0, id: 'n', eleveId: v0.eleveId || 'x', debut: h0 }, E).erreurs.length) || essais[0] || E.reglages.ouverture;
    }
    const elevesListe = E.eleves.filter((e) => e.statut !== 'termine' || e.id === v0.eleveId).sort(triNom);
    const durees = [...new Set([30, 45, 60, 90, 120, Number(v0.duree)])].sort((a, b) => a - b);
    const corps = `
      <label class="champ">Élève<select name="eleveId" id="l-eleve">${options(elevesListe, v0.eleveId, 'Choisir…')}</select></label>
      <p class="aide" id="l-solde"></p>
      <div class="grille-2">
        <label class="champ">Moniteur<select name="moniteurId">${options(E.moniteurs.filter((m) => m.actif !== false || m.id === v0.moniteurId), v0.moniteurId)}</select></label>
        <label class="champ">Véhicule<select name="vehiculeId">${options(E.vehicules.filter((v) => v.actif !== false || v.id === v0.vehiculeId).map((v) => ({ ...v, nom: `${v.nom}${v.boite === 'auto' ? ' (auto)' : ''}` })), v0.vehiculeId, 'Sans véhicule')}</select></label>
      </div>
      <div class="grille-3">
        <label class="champ">Date<input type="date" name="date" value="${v0.date}" required></label>
        <label class="champ">Début<input type="time" name="debut" value="${v0.debut}" step="300" required></label>
        <label class="champ">Durée<select name="duree">${durees.map((d) => `<option value="${d}" ${d === Number(v0.duree) ? 'selected' : ''}>${d >= 60 ? `${Math.floor(d / 60)} h${d % 60 ? ` ${d % 60}` : ''}` : `${d} min`}</option>`).join('')}</select></label>
      </div>
      ${l ? `<label class="champ">Statut<select name="statut">${B.statutsLecon.map((s) => `<option value="${s.id}" ${s.id === l.statut ? 'selected' : ''}>${s.nom}</option>`).join('')}</select></label>` : ''}
      <label class="champ">Note <small>Facultatif, court : objectif de la leçon, lieu de rendez-vous.</small><input name="note" maxlength="120" value="${esc(v0.note || '')}"></label>
      <label class="case"><input type="checkbox" name="forcer"> Forcer hors disponibilités ou hors ouverture (jamais en cas de conflit)</label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(l ? 'Modifier la leçon' : 'Nouvelle leçon', corps, PIED(!!l), (f, bouton) => {
      if (bouton === 'suppr') {
        if (!confirm('Supprimer cette leçon ? Pour une leçon décommandée, préfère le statut « Annulée » (elle reste dans l\'historique).')) return false;
        modifier(() => { E.lecons = E.lecons.filter((x) => x.id !== l.id); }, 'Leçon supprimée.');
        return;
      }
      const n = { id: l?.id || uid(), eleveId: f.get('eleveId'), moniteurId: f.get('moniteurId'), vehiculeId: f.get('vehiculeId') || '', date: f.get('date'), debut: f.get('debut'), duree: Number(f.get('duree')), statut: f.get('statut') || l?.statut || 'prevue', note: String(f.get('note') || '').trim() };
      const v = R.verifierLecon(n, E, f.get('forcer') === 'on', noms);
      if (v.erreurs.length) return v.erreurs.join(' ');
      modifier(() => { if (l) Object.assign(l, n); else E.lecons.push(n); plan.date = n.date; }, l ? 'Leçon modifiée.' : `Leçon ajoutée ${quand(n.date)} à ${n.debut}.`);
    });
    const majSolde = () => {
      const e = eleve($('#l-eleve').value);
      const p = $('#l-solde');
      if (!e) { p.hidden = true; return; }
      const s = R.soldeEleve(e.id, E, t);
      p.hidden = false;
      p.innerHTML = `${esc(e.nom)} : ${h(s.restantes)} restantes, ${h(s.aPlanifier)} à planifier${s.du > 0 ? `, reste dû ${euros(s.du)}` : ''} · boîte ${e.boite === 'auto' ? 'automatique' : 'manuelle'}.`;
    };
    $('#l-eleve').addEventListener('change', () => {
      majSolde();
      const e = eleve($('#l-eleve').value);
      const sel = modale().querySelector('[name=vehiculeId]');
      const v = vehicule(sel.value);
      if (e && (!v || v.boite !== e.boite)) { const bon = actifs(E.vehicules).find((x) => x.boite === e.boite); if (bon) sel.value = bon.id; }
    });
    majSolde();
  }

  function rappelRgpd(texte) { return `<p class="aide rgpd">${texte}</p>`; }

  function modaleEleve(id) {
    const e = id ? eleve(id) : null;
    const v = e || { nom: '', boite: 'manuelle', inscription: auj(), mineur: false, contact: '', statut: 'actif', notes: '' };
    const corps = `
      <div class="grille-2">
        <label class="champ">Nom <small>Prénom et initiale suffisent.</small><input name="nom" required maxlength="60" value="${esc(v.nom)}" placeholder="Ex. : Inès B."></label>
        <label class="champ">Boîte<select name="boite">${B.boites.map((b) => `<option value="${b.id}" ${b.id === v.boite ? 'selected' : ''}>${b.nom}</option>`).join('')}</select></label>
        <label class="champ">Inscription<input type="date" name="inscription" value="${v.inscription || ''}"></label>
        <label class="champ">Statut<select name="statut"><option value="actif" ${v.statut !== 'termine' ? 'selected' : ''}>En formation</option><option value="termine" ${v.statut === 'termine' ? 'selected' : ''}>Terminé</option></select></label>
      </div>
      <label class="case"><input type="checkbox" name="mineur" ${v.mineur ? 'checked' : ''}> Élève mineur</label>
      <label class="champ">Contact <small>Facultatif : un téléphone ou un e-mail utile pour les leçons.</small><input name="contact" maxlength="80" value="${esc(v.contact || '')}"></label>
      <label class="champ">Notes <small>Facultatif, factuel et utile aux leçons.</small><input name="notes" maxlength="160" value="${esc(v.notes || '')}"></label>
      ${e ? '' : `<div class="groupe"><h3>Forfait de départ <small>Facultatif.</small></h3><div class="grille-3"><label class="champ">Heures<input name="heures" inputmode="decimal" placeholder="Ex. : 20"></label><label class="champ">Montant (€)<input name="montant" inputmode="decimal"></label><label class="champ">Libellé<input name="libelle" maxlength="60" placeholder="Forfait"></label></div></div>`}
      ${rappelRgpd('Données d\'élèves, parfois mineurs : ne saisis que le nécessaire (pas de numéro de permis, de pièce d\'identité ni de donnée de santé), informe l\'élève et, s\'il est mineur, son représentant légal ; supprime les élèves partis.')}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(e ? 'Modifier l\'élève' : 'Nouvel élève', corps, PIED(!!e), (f, bouton) => {
      if (bouton === 'suppr') {
        const n = E.lecons.filter((l) => l.eleveId === e.id).length;
        if (!confirm(`Supprimer ${e.nom} avec ses ${pluriel(n, 'leçon')}, achats et paiements ?`)) return false;
        modifier(() => {
          E.eleves = E.eleves.filter((x) => x.id !== e.id);
          E.lecons = E.lecons.filter((x) => x.eleveId !== e.id);
          E.achats = E.achats.filter((x) => x.eleveId !== e.id);
          E.paiements = E.paiements.filter((x) => x.eleveId !== e.id);
          eleveChoisi = null;
        }, `${e.nom} supprimé.`);
        return;
      }
      const nom = String(f.get('nom') || '').trim();
      if (!nom) return 'Indique le nom de l\'élève.';
      const n = { nom, boite: f.get('boite'), inscription: f.get('inscription') || null, statut: f.get('statut'), mineur: f.get('mineur') === 'on', contact: String(f.get('contact') || '').trim(), notes: String(f.get('notes') || '').trim() };
      let achat = null;
      if (!e) {
        const hs = nombre(f.get('heures')), mt = nombre(f.get('montant'));
        if (Number.isNaN(hs) || Number.isNaN(mt) || (hs !== null && (hs <= 0 || hs > 200)) || (mt !== null && mt < 0)) return 'Forfait : heures entre 0 et 200, montant positif.';
        if (hs) achat = { id: uid(), date: n.inscription || auj(), heures: hs, montant: mt || 0, libelle: String(f.get('libelle') || '').trim() || `Forfait ${nb(hs)} h` };
      }
      modifier(() => {
        if (e) Object.assign(e, n);
        else { const x = { id: uid(), ...n, competences: {} }; E.eleves.push(x); if (achat) E.achats.push({ ...achat, eleveId: x.id }); eleveChoisi = x.id; vue = 'eleves'; }
      }, e ? 'Élève enregistré.' : `${nom} ajouté.`);
    });
  }

  function modaleAchat(eleveId) {
    const e = eleve(eleveId);
    const corps = `
      <div class="grille-3"><label class="champ">Date<input type="date" name="date" value="${auj()}"></label><label class="champ">Heures<input name="heures" inputmode="decimal" required placeholder="Ex. : 5"></label><label class="champ">Montant (€)<input name="montant" inputmode="decimal" placeholder="Ex. : 250"></label></div>
      <label class="champ">Libellé<input name="libelle" maxlength="60" placeholder="Ex. : 5 h supplémentaires"></label>
      <p class="aide">Le montant est celui de ton tarif : l'outil n'en propose aucun.</p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(`Heures achetées · ${esc(e.nom)}`, corps, PIED(false), (f) => {
      const hs = nombre(f.get('heures')), mt = nombre(f.get('montant')) ?? 0;
      if (!R.estDate(f.get('date'))) return 'Date invalide.';
      if (!hs || Number.isNaN(hs) || hs <= 0 || hs > 200) return 'Heures : entre 0 et 200.';
      if (Number.isNaN(mt) || mt < 0) return 'Montant invalide.';
      modifier(() => { E.achats.push({ id: uid(), eleveId, date: f.get('date'), heures: hs, montant: mt, libelle: String(f.get('libelle') || '').trim() || `${nb(hs)} h` }); }, `${h(hs)} ajoutées à ${e.nom}.`);
    });
  }

  function modalePaiement(eleveId) {
    const e = eleve(eleveId);
    const s = R.soldeEleve(eleveId, E, auj());
    const corps = `
      <div class="grille-3"><label class="champ">Date<input type="date" name="date" value="${auj()}"></label><label class="champ">Montant (€)<input name="montant" inputmode="decimal" required value="${s.du > 0 ? String(s.du).replace('.', ',') : ''}"></label><label class="champ">Mode<select name="mode">${B.modesPaiement.map((m) => `<option>${m}</option>`).join('')}</select></label></div>
      <p class="aide">Reste dû avant ce paiement : ${euros(s.du)}.</p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(`Paiement · ${esc(e.nom)}`, corps, PIED(false), (f) => {
      const mt = nombre(f.get('montant'));
      if (!R.estDate(f.get('date'))) return 'Date invalide.';
      if (!mt || Number.isNaN(mt) || mt <= 0) return 'Montant invalide.';
      modifier(() => { E.paiements.push({ id: uid(), eleveId, date: f.get('date'), montant: mt, mode: f.get('mode') }); }, `Paiement de ${euros(mt)} enregistré.`);
    });
  }

  function modaleMoniteur(id) {
    const m = id ? moniteur(id) : null;
    const v = m || { nom: '', couleur: B.couleurs[E.moniteurs.length % B.couleurs.length].id, dispos: Object.fromEntries(E.reglages.joursOuverts.map((j) => [j, [[R.minutes(E.reglages.ouverture), R.minutes(E.reglages.fermeture)]]])), absences: [], actif: true };
    const t = auj();
    const abs = (v.absences || []).filter((a) => (a.fin || a.debut) >= ajout(t, -30)).sort((a, b) => a.debut.localeCompare(b.debut));
    const corps = `
      <label class="champ">Nom<input name="nom" required maxlength="40" value="${esc(v.nom)}" placeholder="Ex. : Karim"></label>
      <fieldset class="sans-cadre"><legend class="champ">Couleur</legend><div class="pastilles">${B.couleurs.map((c) => `<label title="${c.id}"><input type="radio" name="couleur" value="${c.id}" ${c.id === v.couleur ? 'checked' : ''}><span style="--c:${c.hex}"></span></label>`).join('')}</div></fieldset>
      <div class="groupe"><h3>Disponibilités de la semaine type</h3><p class="aide">Plages séparées par des virgules, par exemple 08:00-12:00, 14:00-19:00. Vide : pas disponible ce jour.</p>
        <div class="dispos-saisie">${B.jours.map((j, i) => `<label class="champ"><span>${j}</span><input name="dispo-${i + 1}" value="${esc(R.ecrirePlages(v.dispos?.[i + 1]))}" placeholder="–"></label>`).join('')}</div></div>
      <div class="groupe"><h3>Absences</h3>
        ${abs.length ? abs.map((a) => `<label class="case"><input type="checkbox" name="abs-suppr" value="${a.id}"> Supprimer : ${R.dateFr(a.debut)}${a.fin && a.fin !== a.debut ? ` au ${R.dateFr(a.fin)}` : ''}${a.motif ? ` (${esc(a.motif)})` : ''}</label>`).join('') : '<p class="note" style="margin:0">Aucune absence à venir.</p>'}
        <div class="grille-3"><label class="champ">Du<input type="date" name="abs-debut"></label><label class="champ">Au<input type="date" name="abs-fin"></label><label class="champ">Motif <small>court, facultatif</small><input name="abs-motif" maxlength="40" placeholder="Ex. : Congés"></label></div></div>
      ${m ? `<label class="case"><input type="checkbox" name="actif" ${m.actif !== false ? 'checked' : ''}> En activité (décoché : masqué du planning, historique conservé)</label>` : ''}
      ${rappelRgpd('Moniteurs : un motif d\'absence court et neutre suffit (« Congés », « Formation ») ; ne note jamais de motif médical.')}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(m ? 'Modifier le moniteur' : 'Nouveau moniteur', corps, PIED(!!m), (f, bouton) => {
      if (bouton === 'suppr') {
        const n = E.lecons.filter((l) => l.moniteurId === m.id).length;
        if (n) { if (!confirm(`${m.nom} a ${pluriel(n, 'leçon')} dans l'historique : le moniteur sera mis hors activité plutôt que supprimé. Continuer ?`)) return false; modifier(() => { m.actif = false; }, `${m.nom} mis hors activité.`); return; }
        if (!confirm(`Supprimer ${m.nom} ?`)) return false;
        modifier(() => { E.moniteurs = E.moniteurs.filter((x) => x.id !== m.id); }, `${m.nom} supprimé.`);
        return;
      }
      const nom = String(f.get('nom') || '').trim();
      if (!nom) return 'Indique le nom du moniteur.';
      const dispos = {};
      try { for (let j = 1; j <= 7; j++) { const p = R.lirePlages(f.get(`dispo-${j}`)); if (p.length) dispos[j] = p; } } catch (x) { return x.message; }
      const ad = f.get('abs-debut'), af = f.get('abs-fin') || ad;
      let absences = (v.absences || []).filter((a) => !f.getAll('abs-suppr').includes(a.id));
      if (ad) {
        if (!R.estDate(ad) || !R.estDate(af) || af < ad) return 'Absence : dates invalides.';
        absences = [...absences, { id: uid(), debut: ad, fin: af, motif: String(f.get('abs-motif') || '').trim() }];
      }
      const n = { nom, couleur: f.get('couleur') || v.couleur, dispos, absences, actif: m ? f.get('actif') === 'on' : true };
      modifier(() => { if (m) Object.assign(m, n); else E.moniteurs.push({ id: uid(), ...n }); }, m ? 'Moniteur enregistré.' : `${nom} ajouté.`);
    });
  }

  function modaleVehicule(id) {
    const v = id ? vehicule(id) : null;
    const x = v || { nom: '', immat: '', boite: 'manuelle', dateEntree: auj(), kmEntree: '', coutMensuel: '', entretienKm: '', entretienMois: '', ctProchain: '', actif: true, notes: '' };
    const corps = `
      <div class="grille-2">
        <label class="champ">Libellé <small>Sans marque : « Citadine 1 ».</small><input name="nom" required maxlength="40" value="${esc(x.nom)}"></label>
        <label class="champ">Immatriculation<input name="immat" maxlength="12" value="${esc(x.immat || '')}" autocapitalize="characters" placeholder="AB-123-CD"></label>
        <label class="champ">Boîte<select name="boite">${B.boites.map((b) => `<option value="${b.id}" ${b.id === x.boite ? 'selected' : ''}>${b.nom}</option>`).join('')}</select></label>
        <label class="champ">Entrée dans l'école<input type="date" name="dateEntree" value="${x.dateEntree || ''}"></label>
        <label class="champ">Kilométrage à l'entrée<input name="kmEntree" inputmode="numeric" value="${x.kmEntree ?? ''}"></label>
        <label class="champ">Coût fixe mensuel (€) <small>Loyer, amortissement, assurance au mois… Facultatif.</small><input name="coutMensuel" inputmode="decimal" value="${x.coutMensuel || ''}"></label>
      </div>
      <div class="groupe"><h3>Entretien <small>Lu dans le carnet du constructeur ; facultatif.</small></h3><div class="grille-2"><label class="champ">Tous les … km<input name="entretienKm" inputmode="numeric" value="${x.entretienKm || ''}"></label><label class="champ">ou tous les … mois<input name="entretienMois" inputmode="numeric" value="${x.entretienMois || ''}"></label></div></div>
      <div class="groupe"><h3>Contrôle technique</h3><label class="champ">Date limite du prochain contrôle <small>Lue sur le procès-verbal du dernier contrôle.</small><input type="date" name="ctProchain" value="${x.ctProchain || ''}"></label>
        <p class="aide">${esc(B.controleTechnique.reserve)}</p></div>
      <label class="champ">Notes<input name="notes" maxlength="120" value="${esc(x.notes || '')}"></label>
      ${v ? `<label class="case"><input type="checkbox" name="actif" ${v.actif !== false ? 'checked' : ''}> En service (décoché : masqué du planning, historique conservé)</label>` : ''}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(v ? 'Modifier le véhicule' : 'Nouveau véhicule', corps, PIED(!!v), (f, bouton) => {
      if (bouton === 'suppr') {
        const n = E.lecons.filter((l) => l.vehiculeId === v.id).length;
        if (n) { if (!confirm(`${v.nom} a ${pluriel(n, 'leçon')} dans l'historique : il sera mis hors service plutôt que supprimé. Continuer ?`)) return false; modifier(() => { v.actif = false; }, `${v.nom} mis hors service.`); return; }
        if (!confirm(`Supprimer ${v.nom} et ses interventions ?`)) return false;
        modifier(() => { E.vehicules = E.vehicules.filter((y) => y.id !== v.id); E.interventionsV = E.interventionsV.filter((i) => i.vehiculeId !== v.id); E.releves = E.releves.filter((r) => r.vehiculeId !== v.id); vehiculeChoisi = null; }, `${v.nom} supprimé.`);
        return;
      }
      const nom = String(f.get('nom') || '').trim();
      if (!nom) return 'Indique un libellé.';
      const vals = ['kmEntree', 'coutMensuel', 'entretienKm', 'entretienMois'].map((k) => nombre(f.get(k)));
      if (vals.some((n) => Number.isNaN(n) || (n !== null && n < 0))) return 'Nombres invalides (kilométrage, coût ou intervalles).';
      const ct = f.get('ctProchain');
      if (ct && !R.estDate(ct)) return 'Date du contrôle technique invalide.';
      const n = { nom, immat: String(f.get('immat') || '').trim().toUpperCase(), boite: f.get('boite'), dateEntree: f.get('dateEntree') || null, kmEntree: vals[0] || 0, coutMensuel: vals[1] || 0, entretienKm: vals[2] || null, entretienMois: vals[3] || null, ctProchain: ct || null, notes: String(f.get('notes') || '').trim(), actif: v ? f.get('actif') === 'on' : true };
      modifier(() => { if (v) Object.assign(v, n); else E.vehicules.push({ id: uid(), ...n }); }, v ? 'Véhicule enregistré.' : `${nom} ajouté.`);
    });
  }

  function modaleReleve(vehiculeId) {
    const v = vehicule(vehiculeId);
    const corps = `<div class="grille-2"><label class="champ">Date<input type="date" name="date" value="${auj()}"></label><label class="champ">Compteur (km)<input name="km" inputmode="numeric" required value="${R.kmActuel(v, E)}"></label></div><p class="erreur" role="alert"></p>`;
    ouvrirModale(`Relevé kilométrique · ${esc(v.nom)}`, corps, PIED(false), (f) => {
      const km = nombre(f.get('km'));
      const d = f.get('date');
      if (!R.estDate(d)) return 'Date invalide.';
      const err = R.releveValide(v, E, d, km);
      if (err) return err;
      modifier(() => { E.releves.push({ id: uid(), vehiculeId, date: d, km }); }, `Relevé de ${nb(km, 0)} km enregistré.`);
    });
  }

  function modaleIntervention(vehiculeId) {
    const v = vehicule(vehiculeId);
    const per = E.reglages.periodiciteCT;
    const corps = `
      <div class="grille-2">
        <label class="champ">Type<select name="type" id="i-type">${B.interventions.map((x) => `<option value="${x.id}">${x.nom}</option>`).join('')}</select></label>
        <label class="champ">Date<input type="date" name="date" id="i-date" value="${auj()}"></label>
        <label class="champ">Kilométrage <small>Facultatif.</small><input name="km" inputmode="numeric"></label>
        <label class="champ">Coût (€)<input name="cout" inputmode="decimal"></label>
      </div>
      <label class="champ">Libellé<input name="libelle" maxlength="80" placeholder="Ex. : Révision, plaquettes avant"></label>
      <div id="i-ct" hidden><label class="champ">Date limite du prochain contrôle <small>Lue sur le procès-verbal.${per ? ` Proposée d'après ta périodicité de ${per} mois : vérifie-la.` : ''}</small><input type="date" name="prochainCT" id="i-prochain"></label></div>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(`Intervention · ${esc(v.nom)}`, corps, PIED(false), (f) => {
      const d = f.get('date');
      if (!R.estDate(d)) return 'Date invalide.';
      const km = nombre(f.get('km')), cout = nombre(f.get('cout'));
      if (Number.isNaN(cout) || (cout !== null && cout < 0)) return 'Coût invalide.';
      if (km !== null) { const err = R.releveValide(v, E, d, km); if (err) return err; }
      const type = f.get('type');
      const pc = type === 'ct' ? (f.get('prochainCT') || null) : null;
      if (pc && (!R.estDate(pc) || pc <= d)) return 'La date limite du prochain contrôle doit suivre la date du contrôle.';
      modifier(() => { E.interventionsV.push({ id: uid(), vehiculeId, type, date: d, km, cout: cout || 0, libelle: String(f.get('libelle') || '').trim(), prochainCT: pc }); }, 'Intervention enregistrée.');
    });
    const maj = () => {
      const ct = $('#i-type').value === 'ct';
      $('#i-ct').hidden = !ct;
      const p = R.proposerCT($('#i-date').value, per);
      if (ct && p && !$('#i-prochain').dataset.touche) $('#i-prochain').value = p;
    };
    $('#i-type').addEventListener('change', maj);
    $('#i-date').addEventListener('change', maj);
    $('#i-prochain').addEventListener('input', (e) => { e.target.dataset.touche = '1'; });
  }

  function modaleReglages() {
    const r = E.reglages;
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const poids = R.taille(E);
    const corps = `
      <label class="champ">Nom de l'auto-école<input name="ecole" maxlength="80" value="${esc(E.ecole)}"></label>
      <fieldset class="sans-cadre"><legend class="champ">Jours d'ouverture</legend><div class="jours-choix">${B.jours.map((j, i) => `<label class="case"><input type="checkbox" name="jour" value="${i + 1}" ${r.joursOuverts.includes(i + 1) ? 'checked' : ''}> ${j.slice(0, 3)}</label>`).join('')}</div></fieldset>
      <div class="grille-3">
        <label class="champ">Ouverture<input type="time" name="ouverture" value="${r.ouverture}"></label>
        <label class="champ">Fermeture<input type="time" name="fermeture" value="${r.fermeture}"></label>
        <label class="champ">Leçon par défaut (min)<input name="duree" inputmode="numeric" value="${r.duree}"></label>
      </div>
      <label class="case"><input type="checkbox" name="decompteAbsence" ${r.decompteAbsence ? 'checked' : ''}> Décompter une absence non excusée des heures de l'élève</label>
      <div class="grille-3">
        <label class="champ">Alerte (jours)<input name="alerteJours" inputmode="numeric" value="${r.alerteJours}"></label>
        <label class="champ">Alerte entretien (km)<input name="alerteKm" inputmode="numeric" value="${r.alerteKm}"></label>
        <label class="champ">Périodicité du contrôle (mois) <small>Facultatif.</small><input name="periodiciteCT" inputmode="numeric" value="${r.periodiciteCT || ''}" placeholder="vide"></label>
      </div>
      <p class="aide">Périodicité du contrôle technique : à vérifier auprès de ton centre de contrôle ; elle sert seulement à proposer la date limite après un contrôle saisi. <button type="button" class="btn lien" data-action="vue" data-vue="guide">Voir le Guide</button></p>
      <label class="champ">Compétences suivies <small>Une par ligne ; liste générique, pas le référentiel officiel.</small><textarea name="competences" rows="8">${esc(r.competences.join('\n'))}</textarea></label>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Exports et sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé.'} Place utilisée : ${Math.max(1, Math.round(poids / 1000))} Ko sur ${TAILLE_MAX / 1000} Ko.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv-eleves">Élèves (CSV)</button><button class="btn petit" type="button" data-action="csv-lecons">Leçons (CSV)</button><button class="btn petit" type="button" data-action="csv-vehicules">Véhicules (CSV)</button><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const n = (k, min, max, vide = false) => { const s = String(f.get(k) || '').trim(); if (vide && !s) return undefined; const v = Number(s); return Number.isInteger(v) && v >= min && v <= max ? v : null; };
      const jours = f.getAll('jour').map(Number);
      const ouv = f.get('ouverture'), fer = f.get('fermeture');
      if (!jours.length) return 'Coche au moins un jour d\'ouverture.';
      if (!R.estHeure(ouv) || !R.estHeure(fer) || R.minutes(fer) <= R.minutes(ouv)) return 'Horaires d\'ouverture invalides.';
      const duree = n('duree', 15, 480), aj = n('alerteJours', 0, 365), ak = n('alerteKm', 0, 100000), per = n('periodiciteCT', 1, 120, true);
      if (duree === null) return 'Durée de leçon : entre 15 et 480 minutes.';
      if (aj === null || ak === null) return 'Alertes : nombres entiers positifs.';
      if (per === null) return 'Périodicité : nombre de mois entre 1 et 120, ou vide.';
      const comp = [...new Set(String(f.get('competences') || '').split('\n').map((x) => x.trim()).filter(Boolean))].slice(0, 40);
      if (!comp.length) return 'Garde au moins une compétence.';
      modifier(() => {
        E.ecole = String(f.get('ecole') || '').trim();
        Object.assign(r, { joursOuverts: jours.sort(), ouverture: ouv, fermeture: fer, duree, decompteAbsence: f.get('decompteAbsence') === 'on', alerteJours: aj, alerteKm: ak, periodiciteCT: per ?? null, competences: comp });
      }, 'Réglages enregistrés.');
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.eleves) || !Array.isArray(d.lecons)) throw new Error();
        if (!confirm(`Remplacer tes données actuelles par cette copie (${pluriel(d.eleves.length, 'élève')}, ${pluriel(d.lecons.length, 'leçon')}) ?`)) return;
        E = normaliser(d); delete E.majLe;
        modale().close(); sauver(); demarrer(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide.'); }
    });
  }

  function telecharger(contenu, nom, type) {
    const blob = new Blob([contenu], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nom;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------- Ajout à l'écran d'accueil ----------
  // Explique comment enregistrer le template comme une application sur téléphone ou tablette.
  const appareil = () => {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
    if (/Android/.test(ua)) return 'android';
    return 'autre';
  };
  const dejaInstalle = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  let inviteInstallation = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); inviteInstallation = e; });
  window.addEventListener('appinstalled', () => { inviteInstallation = null; stock.ecrire(CLE_ACCUEIL, 'installe'); });

  const ETAPES_IOS = `<ol class="etapes-accueil">
      <li>Ouvre cette page dans <b>Safari</b>.</li>
      <li>Touche le bouton <b>Partager</b> (carré avec une flèche vers le haut). S'il n'est pas visible, touche d'abord <b>···</b>.</li>
      <li>Fais défiler et choisis <b>Sur l'écran d'accueil</b>.</li>
      <li>Laisse <b>Ouvrir comme app web</b> activé si l'option s'affiche, puis touche <b>Ajouter</b>.</li>
    </ol>`;
  const ETAPES_ANDROID = `<ol class="etapes-accueil">
      <li>Ouvre cette page dans <b>Chrome</b>.</li>
      <li>Touche le menu <b>⋮</b> en haut à droite.</li>
      <li>Choisis <b>Ajouter à l'écran d'accueil</b> (ou <b>Installer l'application</b>), puis <b>Installer</b>.</li>
    </ol>
    <p class="aide">Autre navigateur : cherche la même option dans son menu.</p>`;

  function modaleEcranAccueil(auto = false) {
    const a = appareil();
    const installable = a !== 'ios' && inviteInstallation;
    const blocs = a === 'ios' ? ETAPES_IOS
      : a === 'android' ? ETAPES_ANDROID
      : `<h3 class="titre-etapes">Sur iPhone ou iPad</h3>${ETAPES_IOS}<h3 class="titre-etapes">Sur Android</h3>${ETAPES_ANDROID}`;
    const corps = `
      <p>Enregistre cet outil sur ton écran d'accueil : il s'ouvre ensuite d'un geste, en plein écran, comme une application, sans rien télécharger dans un magasin d'applications.</p>
      ${installable ? '<div class="rang"><button class="btn primaire" type="button" data-action="installer">Ajouter à l\'écran d\'accueil</button></div><p class="aide">Ou à la main :</p>' : ''}
      ${blocs}
      <p class="aide">Tes données restent les mêmes : l'icône ouvre cette page avec ta clé déjà enregistrée sur cet appareil.${a === 'autre' ? ' Sur ordinateur, la page fonctionne aussi directement dans le navigateur.' : ''}</p>`;
    const pied = auto
      ? '<button class="btn primaire" value="plus-tard">Plus tard</button><button class="btn" value="jamais">Ne plus afficher</button>'
      : '<button class="btn primaire" value="ok">Fermer</button>';
    ouvrirModale('Comme une application', corps, pied, (_, choix) => { if (choix === 'jamais') stock.ecrire(CLE_ACCUEIL, 'masque'); });
  }

  function proposerEcranAccueil() {
    if (dejaInstalle() || stock.lire(CLE_ACCUEIL)) return;
    if (appareil() === 'autre' && !matchMedia('(max-width:720px)').matches) return;
    setTimeout(() => { if (!modale().open && !dejaInstalle()) modaleEcranAccueil(true); }, 900);
  }

  async function installer() {
    if (!inviteInstallation) return;
    const invite = inviteInstallation; inviteInstallation = null;
    if (modale().open) modale().close();
    invite.prompt();
    const { outcome } = await invite.userChoice.catch(() => ({}));
    if (outcome === 'accepted') stock.ecrire(CLE_ACCUEIL, 'installe');
  }

  // ---------- Toast ----------
  let minuterieToast = null;
  function toast(texte, action) {
    const el = $('#toast');
    el.innerHTML = `<span>${esc(texte)}</span>${action ? `<button type="button">${esc(action.libelle)}</button>` : ''}`;
    el.hidden = false;
    if (action) el.querySelector('button').onclick = () => { el.hidden = true; action.faire(); };
    clearTimeout(minuterieToast);
    minuterieToast = setTimeout(() => { el.hidden = true; }, action ? 7000 : 4000);
  }

  // ---------- Actions ----------
  const LIB_STATUT = { faite: 'pointée faite', absent: 'pointée « élève absent »', annulee: 'annulée' };
  function changerStatut(id, statut) {
    const l = lecon(id);
    if (!l) return;
    const e = eleve(l.eleveId);
    modifier(() => { l.statut = statut; }, `Leçon de ${e?.nom || 'l\'élève'} ${LIB_STATUT[statut]}.`);
  }

  function ouvrirAlerte(type, id) {
    if (['ct', 'entretien'].includes(type)) { vehiculeChoisi = id; changerVue('vehicules'); return; }
    eleveChoisi = id; changerVue('eleves');
  }

  function supprimerDe(cle, id, message) { modifier(() => { E[cle] = E[cle].filter((x) => x.id !== id); }, message); }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;
    const t = auj();
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); cache(); eleveChoisi = null; vehiculeChoisi = null; rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': telecharger(JSON.stringify(E, null, 2), `auto-ecole-${t}.json`, 'application/json'); break;
      case 'csv-eleves': telecharger(R.csvEleves(E, t), `eleves-${t}.csv`, 'text/csv;charset=utf-8'); toast(`${pluriel(E.eleves.length, 'élève')} exporté${E.eleves.length > 1 ? 's' : ''} (CSV).`); break;
      case 'csv-lecons': { const d = debut12(t); telecharger(R.csvLecons(E, d, R.ajoutMois(t, 3)), `lecons-${t}.csv`, 'text/csv;charset=utf-8'); toast('Leçons exportées (12 derniers mois et à venir).'); break; }
      case 'csv-vehicules': telecharger(R.csvVehicules(E, t), `vehicules-${t}.csv`, 'text/csv;charset=utf-8'); toast('Véhicules exportés (CSV).'); break;
      case 'fermer': modale().close(); break;
      case 'plan-nav': plan.date = ajout(plan.date, Number(el.dataset.pas) * ((plan.mode || (estTelephone() ? 'jour' : 'semaine')) === 'jour' ? 1 : 7)); rendre(); break;
      case 'plan-auj': plan.date = t; rendre(); break;
      case 'plan-mode': plan.mode = el.dataset.mode; rendre(); break;
      case 'plan-axe': plan.axe = el.dataset.axe; rendre(); break;
      case 'plan-jour': plan.date = el.dataset.date; plan.mode = 'jour'; rendre(); break;
      case 'pointer-voir': { const l = E.lecons.filter((x) => etatLecon(x, t) === 'pointer').sort((a, b) => a.date.localeCompare(b.date))[0]; if (l) { plan.date = l.date; plan.mode = 'jour'; rendre(); } break; }
      case 'lecon-nouvelle': modaleLecon(null, { date: el.dataset.date, moniteur: el.dataset.moniteur, vehicule: el.dataset.vehicule, eleve: el.dataset.eleve }); break;
      case 'lecon-modifier': modaleLecon(id); break;
      case 'lecon-statut': changerStatut(id, el.dataset.statut); break;
      case 'eleve-nouveau': modaleEleve(); break;
      case 'eleve-modifier': modaleEleve(id); break;
      case 'eleve-ouvrir': eleveChoisi = id; rendre(); window.scrollTo({ top: 0 }); break;
      case 'eleve-fermer': eleveChoisi = null; rendre(); break;
      case 'eleves-statut': filtreEleves.statut = el.dataset.statut; rendre(); break;
      case 'achat-nouveau': modaleAchat(id); break;
      case 'paiement-nouveau': modalePaiement(id); break;
      case 'achat-suppr': supprimerDe('achats', id, 'Achat d\'heures supprimé.'); break;
      case 'paiement-suppr': supprimerDe('paiements', id, 'Paiement supprimé.'); break;
      case 'vehicule-nouveau': modaleVehicule(); break;
      case 'vehicule-modifier': modaleVehicule(id); break;
      case 'vehicule-ouvrir': vehiculeChoisi = id; rendre(); window.scrollTo({ top: 0 }); break;
      case 'vehicule-fermer': vehiculeChoisi = null; rendre(); break;
      case 'releve-nouveau': modaleReleve(id); break;
      case 'releve-suppr': supprimerDe('releves', id, 'Relevé supprimé.'); break;
      case 'intervention-nouvelle': modaleIntervention(id); break;
      case 'intervention-suppr': supprimerDe('interventionsV', id, 'Intervention supprimée.'); break;
      case 'moniteur-nouveau': modaleMoniteur(); break;
      case 'moniteur-modifier': modaleMoniteur(id); break;
      case 'moniteur-semaine': plan.mode = 'semaine'; plan.axe = 'moniteur'; plan.date = t; changerVue('planning'); break;
      case 'alerte': ouvrirAlerte(el.dataset.type, id); break;
      default: break;
    }
  });

  document.addEventListener('change', (e) => {
    if (e.target.id === 'plan-date' && R.estDate(e.target.value)) { plan.date = e.target.value; rendre(); return; }
    const i = e.target.dataset?.competence;
    if (i === undefined || !eleveChoisi) return;
    const el = eleve(eleveChoisi);
    const c = E.reglages.competences[Number(i)];
    const coche = e.target.checked;
    modifier(() => { el.competences = { ...(el.competences || {}) }; if (coche) el.competences[c] = auj(); else delete el.competences[c]; }, coche ? `« ${c} » acquis.` : `« ${c} » décoché.`);
  });

  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });

  let largeur = window.innerWidth;
  window.addEventListener('resize', () => { if (Math.abs(window.innerWidth - largeur) > 80 && E && vue === 'bilan' && !modale().open) { largeur = window.innerWidth; rendre(); } });
  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
    if (!modale().open && vue !== 'eleves') rendre();
  });
  window.addEventListener('beforeunload', (e) => { if (etatSync === 'attente' || etatSync === 'envoi') { envoyer(); e.preventDefault(); } });

  // ---------- Démarrage ----------
  async function init() {
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
    const code = stock.lire(CLE_CODE);
    if (new URLSearchParams(location.search).has('demo') && !code) { history.replaceState(null, '', location.pathname); return ouvrirDemo(false); }
    if (new URLSearchParams(location.search).has('demo')) history.replaceState(null, '', location.pathname);
    if (!code) return ecranConnexion();
    if (code === CODE_DEMO) return ouvrirDemo();
    session.code = code;
    try { session.memoriser = localStorage.getItem(CLE_CODE) !== null; } catch { session.memoriser = false; }
    try {
      const { statut, corps } = await appel('/connexion', { method: 'POST', body: JSON.stringify({ code, produit: PRODUIT }) });
      if (statut === 401 || statut === 403) return deconnecter(corps?.erreur || 'Ce code d\'accès n\'est plus valide.');
      if (statut !== 200) throw new Error();
      if (corps.produit !== PRODUIT) return deconnecter('Cette clé ouvre un autre template QME.');
      session.jeton = corps.jeton;
      chargerDepuisServeur(corps.donnees);
    } catch {
      const c = stock.lire(CLE_CACHE);
      if (c && c.code === code && c.etat && c.jeton) {
        E = normaliser(c.etat); session.base = c.base; session.jeton = c.jeton;
        demarrer(); majSync('horsligne');
      } else ecranConnexion('Pas de connexion internet. Réessaie une fois en ligne.');
    }
  }

  // Exposé pour les tests automatisés uniquement (aucune donnée sensible).
  window.__autoEcole = { etat: () => E };
  init();
})();
