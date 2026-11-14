// Entretiens annuels et professionnels QME : échéances calculées par salarié (annuel, entretien de parcours
// professionnel, état des lieux des 8 ans, cas particuliers), trames par thème, préparation par le salarié,
// compte rendu imprimable, objectifs SMART suivis d'une année sur l'autre, demandes de formation, RGPD.
// Données synchronisées par clé de licence ou code d'accès. Aucun envoi d'e-mail, aucun lien vers un logiciel RH.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.ENP;
  const API = '/api/templates';
  const PRODUIT = 'ENP';
  const CLE_CODE = 'qme-enp-code';
  const CLE_CACHE = 'qme-enp-cache';
  const CLE_DEMO = 'qme-enp-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-enp-ecran-accueil';

  // ---------- Outils ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => R.nouvelId();
  const pluriel = (n, s, p) => `${n} ${n > 1 ? (p || s + 's') : s}`;
  const stock = {
    lire(cle) { try { const v = localStorage.getItem(cle) ?? sessionStorage.getItem(cle); return v ? JSON.parse(v) : null; } catch { return null; } },
    ecrire(cle, v, session = false) { try { (session ? sessionStorage : localStorage).setItem(cle, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
    suppr(cle) { try { localStorage.removeItem(cle); sessionStorage.removeItem(cle); } catch { /* idem */ } },
  };
  const { ajout, ajoutMois, ajoutAns, versDate, ecart } = R;
  const auj = () => R.iso(new Date());
  const fmt = (s, o = { weekday: 'short', day: 'numeric', month: 'short' }) => versDate(s).toLocaleDateString('fr-FR', o);
  const dateLongue = (s) => fmt(s, { day: 'numeric', month: 'long', year: 'numeric' });
  const dateCourte = (s) => fmt(s, s.slice(0, 4) === auj().slice(0, 4) ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '');
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;
  const quand = (n) => (n === 0 ? 'aujourd\'hui' : n === 1 ? 'demain' : n === -1 ? 'hier' : n > 0 ? (n > 60 ? `dans ${Math.round(n / 30)} mois` : `dans ${n} jours`) : (-n > 60 ? `il y a ${Math.round(-n / 30)} mois` : `il y a ${-n} jours`));

  const typeB = (id) => B.types.find((t) => t.id === id) || B.types[0];
  const nomType = (id) => typeB(id).nom;
  const courtType = (id) => typeB(id).court;
  const nomMotif = (id) => (B.motifs.find((m) => m.id === id) || { nom: '' }).nom;
  const nomAbsence = (id) => (B.absences.find((a) => a.id === id) || { nom: 'Absence' }).nom;
  const nature = (id) => B.natures.find((n) => n.id === id) || B.natures[2];
  const nomStatutF = (id) => (B.statutsFormation.find((s) => s.id === id) || { nom: id }).nom;
  const nomStatutO = (id) => (B.statutsObjectif.find((s) => s.id === id) || { nom: id }).nom;
  const nomOrigine = (id) => (B.origines.find((o) => o.id === id) || { nom: '' }).nom;
  const COULEUR_TYPE = { annuel: 'ciel', epp: 'beurre', bilan: 'rose' };
  const ETIQ_ECH = { retard: ['rouge', 'En retard'], bientot: ['jaune', 'À venir'], planifie: ['ciel', 'Planifié'], ok: ['', 'À jour'] };
  const ETIQ_F = { demandee: 'jaune', acceptee: 'ciel', planifiee: 'ciel', realisee: 'vert', reportee: 'sable', refusee: 'rose' };
  const ETIQ_O = { 'en-cours': 'jaune', atteint: 'vert', partiel: 'ciel', 'non-atteint': 'rose', abandonne: 'sable' };
  // Libellé d'une échéance : « Parcours pro · retour d'absence ».
  const libEcheance = (e) => `${courtType(e.type)}${e.motif && !['periodique', 'premier'].includes(e.motif) ? ` · ${nomMotif(e.motif).toLowerCase()}` : e.motif === 'premier' ? ' · premier' : ''}`;

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'echeances';
  let fiche = null; // salarié ouvert
  let ouvert = null; // entretien ouvert
  const filtre = { salaries: 'presents', q: '', entretiens: 'avenir', trame: 'annuel', objectifs: 'en-cours', salarieObj: 'tous', formations: 'attente' };
  let annulation = null;

  const normaliser = (d) => R.normaliser(d, auj());
  const salarie = (id) => E.salaries.find((s) => s.id === id);
  const entretien = (id) => E.entretiens.find((e) => e.id === id);
  const objectif = (id) => E.objectifs.find((o) => o.id === id);
  const formation = (id) => E.formations.find((f) => f.id === id);
  const prenom = (sid) => salarie(sid)?.prenom || '—';

  function retenir() { annulation = structuredClone(E); }
  function annuler() {
    if (!annulation) return;
    E = annulation; annulation = null;
    sauver(); rendre();
    toast('Modification annulée.');
  }

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
        toast('Un autre appareil a modifié le suivi entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
      } else if (statut === 401) {
        deconnecter('Ce code d\'accès n\'est plus valide.');
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
        if (!modale().open && !saisieEnCours()) rendre();
      }
    } catch { majSync('horsligne'); }
  }
  // Une zone de texte de l'entretien a le focus : ne pas redessiner sous les doigts.
  const saisieEnCours = () => document.activeElement && document.activeElement.matches?.('#vue textarea, #vue input');

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
  // Code interne (ENP-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
  // 3 lettres dont au moins une hors de A–F, ce qu'une clé Gumroad hexadécimale ne peut pas être.
  const estCodeInterne = (n) => /^[A-Z]{3}/.test(n) && /[G-Z]/.test(n.slice(0, 3));
  function formaterCode(v) {
    const n = v.toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (n === 'DEMO' || 'DEMO'.startsWith(n)) return n;
    if (estCodeInterne(n)) { const r = n.slice(0, 19); return [r.slice(0, 3), r.slice(3, 7), r.slice(7, 11), r.slice(11, 15), r.slice(15, 19)].filter(Boolean).join('-'); }
    const l = n.slice(0, 32);
    return [l.slice(0, 8), l.slice(8, 16), l.slice(16, 24), l.slice(24, 32)].filter(Boolean).join('-');
  }
  const codeComplet = (c) => { const n = c.replace(/-/g, ''); return (estCodeInterne(n) && n.length === 19) || (/^[0-9A-F]{32}$/.test(n)); };

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
    if (E) { cache(false); demarrer(); } else ecranAccueil();
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
    session.code = null; session.jeton = null; session.demo = false; session.base = null; E = null; fiche = null; ouvert = null;
    document.body.classList.remove('app');
    ecranConnexion(message);
  }

  // ---------- Données de démonstration ----------
  // PME fictive « Atelier Exemple », 8 salariés à des dates relatives à aujourd'hui : état des lieux et annuel
  // planifiés le même jour, EPP en retard, retour de congé parental, visite de mi-carrière, année des 59 ans,
  // premier EPP à venir, compte rendu à finaliser, entretien réalisé complet, salariée sortie à effacer.
  function donneesDemo() {
    const t = auj();
    const an = Number(t.slice(0, 4));
    const e = R.etatVide();
    e.entreprise = 'Atelier Exemple (fictif)';
    e.effectif50 = true;
    const S = (id, prenom, poste, service, manager, entree, extra = {}) => { e.salaries.push(R.normaliserSalarie({ id, prenom, poste, service, manager, entree, ...extra }, t)); };
    S('camille', 'Camille R.', 'Cheffe d\'atelier', 'Production', 'Direction', ajout(ajoutAns(t, -8), 20), { anneeNaissance: an - 44 });
    S('julien', 'Julien B.', 'Technicien de maintenance', 'Maintenance', 'Cheffe d\'atelier', ajoutMois(ajoutAns(t, -7), 2));
    S('ines', 'Inès K.', 'Assistante commerciale', 'Commercial', 'Responsable commercial', ajoutAns(t, -4), { absences: [{ id: 'abs1', type: 'parental', debut: ajoutMois(t, -11), retour: ajout(t, 25) }] });
    S('thomas', 'Thomas L.', 'Chargé d\'affaires', 'Commercial', 'Responsable commercial', ajoutAns(ajoutMois(t, -2), -2), { forfaitJours: true });
    S('sarah', 'Sarah M.', 'Comptable', 'Administration', 'Direction', ajoutMois(t, -5));
    S('marc', 'Marc D.', 'Magasinier', 'Logistique', 'Responsable logistique', ajoutAns(t, -20), { anneeNaissance: an - 59, visiteMiCarriere: null });
    S('lucas', 'Lucas P.', 'Opérateur de production', 'Production', 'Cheffe d\'atelier', ajout(ajoutMois(t, -11), -10));
    S('nadia', 'Nadia F.', 'Préparatrice de commandes', 'Logistique', 'Responsable logistique', ajoutAns(t, -7), { sortie: ajoutMois(t, -14) });
    S('yanis', 'Yanis T.', 'Dessinateur projeteur', 'Bureau d\'études', 'Direction', ajoutAns(t, -12), { anneeNaissance: an - 45, visiteMiCarriere: ajout(t, -40) });

    const ENT = (salarieId, type, date, statut, extra = {}) => { const x = R.normaliserEntretien({ id: `${salarieId}-${type}-${date}`, salarie: salarieId, type, date, statut, ...extra }); e.entretiens.push(x); return x; };
    const H = (sid, type, date, motif = 'periodique') => ENT(sid, type, date, 'realise', { historique: true, motif });
    // Camille : EPP passés, annuel de l'an dernier, état des lieux et annuel planifiés le même jour.
    const cEntree = e.salaries[0].entree;
    H('camille', 'epp', ajoutMois(cEntree, 11), 'premier');
    H('camille', 'epp', ajoutAns(ajoutMois(cEntree, 11), 4));
    H('camille', 'annuel', ajout(ajoutAns(t, -1), 6));
    ENT('camille', 'annuel', ajout(t, 9), 'prevu', { heure: '09:30' });
    ENT('camille', 'bilan', ajout(t, 9), 'prevu', { heure: '14:00', motif: 'periodique' });
    // Julien : un seul EPP il y a longtemps (en retard) ; annuel prévu il y a 3 jours, compte rendu à finaliser.
    H('julien', 'epp', ajoutMois(ajoutAns(t, -7), 13), 'premier');
    H('julien', 'annuel', ajoutMois(t, -12));
    ENT('julien', 'annuel', ajout(t, -3), 'prevu', { heure: '10:00', preparation: 'Année chargée avec le remplacement de la presse 4.\nJe voudrais me former aux automatismes (automates programmables).\nLes astreintes du samedi pèsent un peu.', reponses: { an1: 'Mise en service de la presse 4 sans arrêt de production ; plan de graissage refait.', an2: 'Pièces détachées en retard au printemps.' } });
    // Inès : EPP il y a 2 ans, en congé parental, retour dans 25 jours.
    H('ines', 'epp', ajoutMois(ajoutAns(t, -4), 11), 'premier');
    H('ines', 'epp', ajoutAns(t, -2));
    H('ines', 'annuel', ajoutMois(t, -13));
    // Thomas : premier EPP réalisé il y a un an ; annuel réalisé il y a 2 mois, compte rendu complet.
    ENT('thomas', 'epp', ajoutAns(ajoutMois(t, -2), -1), 'realise', { motif: 'premier', copieRemiseLe: ajout(ajoutAns(ajoutMois(t, -2), -1), 3), reponses: { pp1: 'Prospection, chiffrage, suivi de chantier client.', pp8: 'Négociation commerciale.', pp10: 'Responsable d\'un secteur.', pp13: 'Compte activé.', pp14: 'Information donnée.', pp15: 'Information donnée.' } });
    const eThomas = ENT('thomas', 'annuel', ajoutMois(t, -2), 'realise', { reponses: {
      an1: 'Deux nouveaux comptes industriels ; refonte des fiches produits ; salon régional préparé seul.',
      an2: 'Délais de réponse aux devis trop longs en période de pointe.',
      an7: 'Chiffrage, relation client, présentation technique.',
      an9: 'Négociation des remises et des délais.',
      an10: 'Charge forte au printemps, correcte le reste de l\'année.',
      an16: 'Zone Sud, devis en 48 h, préparation du salon.',
      fj1: 'Pics en mars-avril ; jours de repos pris.',
      fj2: 'Repos respectés hors semaine du salon.',
      an18: 'Bonne année, besoin d\'un appui sur les devis complexes.',
      an19: 'Objectifs largement tenus ; priorité au délai de réponse.',
    }, synthese: 'Année solide. Objectif clients partiellement atteint (9 sur 12), reconduit. Nouvel objectif sur le délai de réponse aux devis. Formation négociation acceptée.' });
    // Marc : EPP il y a 3 ans, état des lieux il y a 2 ans ; 59 ans cette année.
    H('marc', 'epp', ajoutAns(t, -3));
    H('marc', 'bilan', ajoutAns(t, -2));
    H('marc', 'annuel', ajout(ajoutMois(t, -10), 4));
    // Lucas : premier EPP à venir (moins d'un an d'ancienneté).
    // Yanis : visite de mi-carrière il y a 40 jours, EPP dans les 2 mois ; dernier EPP il y a 2 ans.
    H('yanis', 'epp', ajoutAns(t, -2));
    H('yanis', 'bilan', ajoutAns(t, -4));
    H('yanis', 'annuel', ajout(ajoutMois(t, -11), 12));
    // Nadia : sortie il y a 14 mois.
    H('nadia', 'epp', ajoutAns(t, -4));

    const O = (x) => { const o = R.normaliserObjectif(x, t); e.objectifs.push(o); return o; };
    const ancien = O({ id: 'o-thomas-1', salarie: 'thomas', intitule: 'Développer le portefeuille clients de la zone Sud', indicateur: 'Nouveaux clients actifs (au moins une commande)', cible: '12', moyens: 'Deux jours de prospection par mois, fichier salon', lien: 'Plan commercial de l\'atelier', creeLe: ajoutMois(t, -14), echeance: ajoutMois(t, -2), avancement: 75, statut: 'partiel', bilan: '9 nouveaux clients sur 12.', bilanLe: eThomas.date });
    O({ ...R.reporter(ancien, { auj: eThomas.date, echeance: ajoutMois(t, 10), entretien: eThomas.id }), intitule: 'Développer le portefeuille clients de la zone Sud (suite)', cible: '6 de plus', avancement: 30 });
    O({ salarie: 'thomas', entretien: eThomas.id, intitule: 'Répondre aux demandes de devis en 48 heures ouvrées', indicateur: 'Délai moyen entre demande et envoi du devis', cible: '48 h', moyens: 'Modèles de devis, appui du bureau d\'études sur les cas complexes', lien: 'Satisfaction client et taux de transformation', creeLe: eThomas.date, echeance: ajoutMois(t, 6), avancement: 40 });
    O({ salarie: 'julien', intitule: 'Mettre à jour les gammes de maintenance préventive des 6 presses', indicateur: 'Gammes revues et validées', cible: '6 sur 6', moyens: 'Une demi-journée par semaine', lien: 'Réduire les arrêts non planifiés', creeLe: ajoutMois(t, -12), echeance: ajout(t, -20), avancement: 80 });
    O({ salarie: 'camille', intitule: 'Former deux opérateurs au réglage de la ligne 2', indicateur: 'Opérateurs autonomes au réglage', cible: '2', moyens: 'Binômes sur 3 mois, fiche de réglage', lien: 'Polyvalence de l\'équipe', creeLe: ajout(ajoutAns(t, -1), 6), echeance: ajout(t, 30), avancement: 50 });
    O({ salarie: 'lucas', intitule: 'Être plus autonome', creeLe: ajoutMois(t, -6), echeance: ajoutMois(t, 18), avancement: 20 });

    const F = (x) => e.formations.push(R.normaliserFormation(x, t));
    F({ salarie: 'camille', intitule: 'Management d\'une équipe de production', nature: 'developpement', dispositif: 'Plan de développement des compétences', origine: 'entretien', statut: 'realisee', demandeLe: ajoutAns(t, -4), dateRealisee: ajoutAns(t, -3) });
    F({ salarie: 'camille', intitule: 'Sauveteur secouriste du travail (recyclage)', nature: 'obligatoire', dispositif: 'Plan de développement des compétences', origine: 'manager', statut: 'realisee', demandeLe: ajoutMois(t, -15), dateRealisee: ajoutAns(t, -1) });
    F({ salarie: 'julien', intitule: 'Habilitation électrique (recyclage)', nature: 'obligatoire', dispositif: 'Plan de développement des compétences', origine: 'manager', statut: 'realisee', demandeLe: ajoutMois(t, -27), dateRealisee: ajoutAns(t, -2) });
    F({ salarie: 'julien', intitule: 'Automatismes industriels, niveau 1', nature: 'developpement', dispositif: 'Plan de développement des compétences', origine: 'salarie', statut: 'demandee', demandeLe: ajout(t, -90) });
    F({ salarie: 'thomas', entretien: eThomas.id, intitule: 'Négociation commerciale', nature: 'developpement', dispositif: 'Plan de développement des compétences', origine: 'entretien', statut: 'acceptee', demandeLe: eThomas.date });
    F({ salarie: 'thomas', intitule: 'Anglais professionnel (certification)', nature: 'certifiante', dispositif: 'CPF avec abondement de l\'employeur', origine: 'salarie', statut: 'planifiee', demandeLe: ajoutMois(t, -4), datePrevue: ajout(t, 40) });
    F({ salarie: 'ines', intitule: 'Nouvelle version du logiciel de gestion commerciale', nature: 'adaptation', dispositif: 'Plan de développement des compétences', origine: 'salarie', statut: 'demandee', demandeLe: ajout(t, -10), commentaire: 'À prévoir dès le retour.' });
    F({ salarie: 'marc', intitule: 'Devenir tuteur en entreprise', nature: 'developpement', dispositif: 'Plan de développement des compétences', origine: 'entretien', statut: 'reportee', demandeLe: ajoutMois(t, -8), commentaire: 'Reportée faute de remplaçant.' });
    F({ salarie: 'yanis', intitule: 'Modélisation 3D avancée', nature: 'certifiante', dispositif: 'CPF', origine: 'salarie', statut: 'realisee', demandeLe: ajoutAns(t, -3), dateRealisee: ajoutMois(ajoutAns(t, -2), -6) });
    return e;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Entretiens annuels et professionnels · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <circle cx="80" cy="80" r="60" fill="#1D4E89"/>
          <rect x="160" y="20" width="120" height="120" fill="#F5B400"/>
          <path d="M20 280 L20 160 A120 120 0 0 1 140 280 Z" fill="#D9302A"/>
          <rect x="160" y="160" width="120" height="120" fill="none" stroke="#141414" stroke-width="4" stroke-dasharray="10 8"/>
          <circle cx="430" cy="150" r="130" fill="#F0EDE6"/>
          <path d="M430 150 L430 20 A130 130 0 0 1 560 150 Z" fill="#141414"/>
          <circle cx="430" cy="150" r="40" fill="#F5B400"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Entretiens annuels et professionnels</p>
          <h1>Aucun entretien oublié.</h1>
          <p>Les échéances de chaque salarié se calculent seules : entretien annuel, entretien de parcours professionnel, état des lieux des 8 ans. La trame est prête, le compte rendu s'imprime, les objectifs et les formations se suivent d'une année sur l'autre.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton suivi</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Tes entretiens sont enregistrés en ligne et te suivent sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon suivi</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore de suivi ? <a href="/templates/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon suivi'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  let accueil = { etape: 1, entreprise: '', effectif50: false, annuelActif: true, eppMois: 48 };

  function ecranAccueil() {
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>Les entretiens de chaque salarié, à jour.</h1>
        <p class="intro">Tu ajoutes tes salariés (prénom et initiale, poste, date d'entrée) et l'historique des derniers entretiens : les échéances se calculent seules. Les trames (${Object.values(B.trames).flat().reduce((s, t) => s + t.questions.length, 0)} questions par thème) sont prêtes.</p>
        <label class="champ" style="max-width:360px">Nom de l'entreprise ou du service <small>Facultatif, affiché sur les comptes rendus imprimés.</small>
          <input id="entreprise" value="${esc(a.entreprise)}" autocomplete="organization" maxlength="60">
        </label>
        <label class="case" style="margin-top:14px"><input type="checkbox" id="effectif50" ${a.effectif50 ? 'checked' : ''}> L'entreprise compte au moins 50 salariés <small class="aide">(contrôle de l'abondement CPF à l'état des lieux)</small></label>
        <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      corps = `
        <p class="surtitre">Étape 2</p>
        <h1>Tes périodicités</h1>
        <p class="intro">Valeurs légales par défaut, relevées le 14/11/2026. Un accord collectif peut prévoir un entretien de parcours professionnel plus fréquent : tout se change ensuite dans les réglages.</p>
        <div class="groupe">
          <label class="case"><input type="checkbox" id="annuelActif" ${a.annuelActif ? 'checked' : ''}> Suivre aussi l'entretien annuel (tous les 12 mois)</label>
          <p class="aide">Pas d'obligation légale générale : à garder si l'entreprise ou la convention le pratique.</p>
        </div>
        <label class="champ" style="max-width:360px;margin-top:16px">Entretien de parcours professionnel tous les
          <select id="eppMois">${[48, 36, 24, 12].map((m) => `<option value="${m}" ${m === a.eppMois ? 'selected' : ''}>${m / 12} an${m > 12 ? 's' : ''}${m === 48 ? ' (règle légale, au plus)' : ' (accord collectif)'}</option>`).join('')}</select>
        </label>
        <ol class="conseils" style="margin-top:24px">${['epp', 'bilan', 'transition'].map((k) => B.reperes[k]).map((r) => `<li><b>${esc(r.titre)}</b><span>${esc(r.texte)}</span><small class="source">${esc(r.source)}</small></li>`).join('')}</ol>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Créer mon suivi</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    $('#entreprise')?.addEventListener('input', (e) => { accueil.entreprise = e.target.value; });
    $('#effectif50')?.addEventListener('change', (e) => { accueil.effectif50 = e.target.checked; });
    $('#annuelActif')?.addEventListener('change', (e) => { accueil.annuelActif = e.target.checked; });
    $('#eppMois')?.addEventListener('change', (e) => { accueil.eppMois = Number(e.target.value); });
  }

  function terminerAccueil() {
    E = R.etatVide();
    E.entreprise = accueil.entreprise.trim();
    E.effectif50 = accueil.effectif50;
    E.reglages = R.normaliserReglages({ ...E.reglages, annuelActif: accueil.annuelActif, eppMois: accueil.eppMois });
    accueil = { etape: 1, entreprise: '', effectif50: false, annuelActif: true, eppMois: 48 };
    vue = 'salaries'; fiche = null; ouvert = null;
    sauver();
    demarrer();
    toast('Ton suivi est prêt. Ajoute ton premier salarié.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    echeances: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    salaries: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" fill="currentColor"/><rect x="3" y="10" width="18" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="16" width="18" height="4" fill="currentColor"/></svg>',
    entretiens: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    objectifs: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2Z" fill="currentColor"/></svg>',
    formations: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21V3a18 18 0 0 1 18 18Z" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
    gauche: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M15 4 7 12l8 8" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
    coche: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="m5 12 5 5 9-10" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
  };
  const COURTS = { echeances: 'Échéances' };
  const ONGLETS = [['echeances', 'Échéances'], ['salaries', 'Salariés'], ['entretiens', 'Entretiens'], ['objectifs', 'Objectifs'], ['formations', 'Formations']];
  const AVERTISSEMENT = '<p class="mention avertissement">Outil d\'aide à l\'organisation : il ne remplace pas un conseil juridique. Les périodicités légales sont datées (relevé du 14/11/2026), sourcées et modifiables ; ta convention collective, tes accords et les textes font foi. Données minimales : prénom et initiale, poste, dates, aucune donnée de santé ni de salaire.</p>';

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/entretiens-annuels/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Données d\'exemple fictives, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Entretiens<br>annuels et pro</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span class="long">${nom}</span>${COURTS[id] ? `<span class="court">${COURTS[id]}</span>` : ''}</button>`).join('')}</nav>
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
    if (fiche && !salarie(fiche)) fiche = null;
    if (ouvert && !entretien(ouvert)) ouvert = null;
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const titres = Object.fromEntries(ONGLETS);
    const titre = vue === 'salaries' && fiche ? salarie(fiche).prenom : vue === 'entretiens' && ouvert ? `${courtType(entretien(ouvert).type)} · ${prenom(entretien(ouvert).salarie)}` : titres[vue];
    document.title = `${titre} · Entretiens annuels et professionnels`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = {
      echeances: vueEcheances,
      salaries: () => (fiche ? vueFiche(salarie(fiche)) : vueSalaries()),
      entretiens: () => (ouvert ? vueEntretien(entretien(ouvert)) : vueEntretiens()),
      objectifs: vueObjectifs,
      formations: vueFormations,
    }[vue]();
    const q = $('#recherche');
    if (q) q.addEventListener('input', (e) => { filtre.q = e.target.value; const pos = e.target.selectionStart; rendre(); const n = $('#recherche'); n.focus(); n.setSelectionRange(pos, pos); });
  }

  function changerVue(v, { fiche: f = null, ouvert: o = null } = {}) {
    vue = v; fiche = f; ouvert = o;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><circle cx="34" cy="34" r="34" fill="#F5B400"/><rect x="40" y="40" width="56" height="56" fill="#1D4E89"/><path d="M0 96 0 56 A40 40 0 0 1 40 96Z" fill="#D9302A"/></svg>';

  // ---------- Petits composants ----------
  function etiquetteEcheance(ech, t) {
    const [cl, lib] = ETIQ_ECH[ech.statut];
    if (ech.statut === 'planifie') return `<span class="etiquette ciel">Prévu ${quand(ecart(t, ech.datePrevue)) === 'aujourd\'hui' ? 'aujourd\'hui' : `le ${dateCourte(ech.datePrevue)}`}</span>`;
    if (ech.statut === 'retard') return `<span class="etiquette rouge">En retard · ${quand(ecart(t, ech.date))}</span>`;
    if (ech.statut === 'bientot') return `<span class="etiquette jaune">${quand(ecart(t, ech.date)).replace(/^d/, 'D')}</span>`;
    return `<span class="etiquette ${cl}">${lib}</span>`;
  }
  const pastilleType = (type) => `<span class="etiquette ${COULEUR_TYPE[type]}">${esc(courtType(type))}</span>`;
  function barre(pct) { return `<span class="progres" role="img" aria-label="${pct} %"><span style="width:${pct}%"></span></span>`; }
  function puceSmart(o) {
    const c = R.controleSmart(o);
    const noms = { S: 'Spécifique', M: 'Mesurable', A: 'Atteignable (moyens)', R: 'Relié au poste ou à l\'équipe', T: 'Temporel (échéance)' };
    return `<span class="smart" aria-label="Contrôle SMART : ${c.ok ? 'complet' : `manque ${c.manque.map((k) => noms[k].toLowerCase()).join(', ')}`}">${'SMART'.split('').map((k) => `<abbr class="${c[k] ? 'ok' : 'manque'}" title="${noms[k]}${c[k] ? '' : ' : à préciser'}">${k}</abbr>`).join('')}</span>`;
  }

  // Ligne d'échéance (tableau de bord, fiche) : salarié, type, date, statut, action.
  function ligneEcheance(ech, t, { avecNom = true } = {}) {
    const s = salarie(ech.salarie);
    const detail = ech.motif === 'retour' ? `retour de ${nomAbsence(ech.typeAbsence).toLowerCase()} le ${dateCourte(ech.date)}`
      : ech.motif === 'mi-carriere' ? `visite de mi-carrière le ${dateCourte(ech.depuis)}, entretien avant le ${dateCourte(ech.date)}`
      : ech.motif === 'fin-carriere' ? `dans l'année des 59 ans, avant le ${dateCourte(ech.date)} (repère approché)`
      : `échéance ${dateLongue(ech.date)}${ech.depuis ? ` · dernier le ${dateCourte(ech.depuis)}` : ech.motif === 'premier' ? ' · un an après l\'entrée' : ech.type !== 'annuel' ? ' · depuis l\'entrée' : ''}`;
    const action = ech.prevu
      ? `<button class="btn petit" data-action="ouvrir-entretien" data-id="${ech.prevu}">Ouvrir</button>`
      : `<button class="btn petit primaire" data-action="planifier" data-id="${ech.salarie}" data-type="${ech.type === 'epp' && ech.statut !== 'ok' ? 'epp' : ech.type}" data-motif="${ech.motif || ''}">Planifier</button>`;
    return `<li class="ligne-transverse ligne-echeance st-${ech.statut}">
      <button class="lien-ligne" data-action="fiche" data-id="${ech.salarie}"><b>${avecNom ? `${esc(s.prenom)} · ` : ''}${esc(libEcheance(ech))}</b><span>${esc(detail)}</span></button>
      <span class="lt-droite">${etiquetteEcheance(ech, t)}${action}</span>
    </li>`;
  }

  // ---------- Échéances (tableau de bord) ----------
  function vueEcheances() {
    const t = auj();
    if (!E.salaries.length) {
      return `<div class="vue-tete"><div><h1>Échéances</h1><p>Aucun salarié pour l'instant.</p></div></div>
        <div class="vide-etat">${FORME_VIDE}<div><h3>Ajoute ton premier salarié</h3><p>Prénom et initiale, poste, date d'entrée, et la date du dernier entretien déjà tenu : ses échéances se calculent aussitôt.</p><div class="actions"><button class="btn primaire" data-action="nouveau-salarie">${ICONES.plus}Un salarié</button></div></div></div>${AVERTISSEMENT}`;
    }
    const ind = R.indicateurs(E, t);
    const toutes = R.echeances(E, t);
    const aTraiter = toutes.filter((e) => e.statut !== 'ok');
    const finaliser = R.aFinaliser(E, t);
    const effacer = R.aEffacer(E, t);
    // États des lieux dans les 18 mois : contrôle projeté à la date d'échéance (ou prévue).
    const bilans = toutes.filter((e) => e.type === 'bilan' && (e.datePrevue || e.date) <= ajoutMois(t, 18)).map((e) => ({ e, c: R.controleBilan(salarie(e.salarie), E, e.datePrevue || e.date) })).filter((x) => !x.c.entretiensOk || !x.c.formationOk);
    const fAttente = E.formations.filter((f) => R.formationEnAttente(f) && salarie(f.salarie) && R.estPresent(salarie(f.salarie), t));
    const tuiles = [
      ['En retard', ind.retard, ind.retard ? 'échéances dépassées sans entretien prévu' : 'aucune échéance dépassée', 'var(--rouge)', 'rond', 'filtre-ech', 'retard'],
      ['À venir', ind.bientot, `échéances dans les ${E.reglages.fenetreJours} jours`, 'var(--jaune)', '', 'filtre-ech', 'bientot'],
      ['Planifiés', ind.planifie, 'entretiens prévus à venir', 'var(--bleu)', '', 'vue-entretiens', 'avenir'],
      ['À finaliser', ind.aFinaliser, ind.aFinaliser ? 'entretiens passés, compte rendu à compléter' : 'tous les comptes rendus sont faits', 'var(--encre)', 'rond', 'vue-entretiens', 'finaliser'],
    ].map(([lib, v, d, c, f, action, cible]) => `<button class="tuile ${f}" style="--c:${c}" data-action="${action}" data-filtre="${cible}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></button>`).join('');
    return `
      <div class="vue-tete"><div><h1>${E.entreprise ? esc(E.entreprise) : 'Échéances'}</h1><p>${pluriel(ind.presents, 'salarié présent', 'salariés présents')}. Ce qui est en retard, ce qui arrive, ce qui est prévu. « Planifier » fixe la date et ouvre la trame.</p></div>
        <div class="actions"><button class="btn primaire" data-action="planifier">${ICONES.plus}Planifier un entretien</button><button class="btn" data-action="nouveau-salarie">${ICONES.plus}Salarié</button></div></div>
      <div class="tuiles">${tuiles}</div>
      ${effacer.length ? `<div class="alerte-rgpd"><div><b>${pluriel(effacer.length, 'salarié sorti', 'salariés sortis')} depuis plus de ${pluriel(E.reglages.effacementMois, 'mois', 'mois')}</b><span>${effacer.map((s) => esc(s.prenom)).join(', ')} : exporte si besoin, puis efface ${effacer.length > 1 ? 'ces fiches' : 'cette fiche'} (les comptes rendus signés se gardent dans le dossier du personnel, selon tes règles de conservation).</span></div><button class="btn petit" data-action="effacer-sortis">Effacer</button></div>` : ''}
      ${bilans.length ? `<section class="alertes-bilan"><h2 class="titre-section">États des lieux à surveiller <span>Contrôle projeté à la date de l'état des lieux</span></h2><ul class="liste-taches">${bilans.map(({ e, c }) => `<li class="ligne-transverse st-${c.risqueAbondement ? 'retard' : 'bientot'}"><button class="lien-ligne" data-action="fiche" data-id="${e.salarie}"><b>${esc(prenom(e.salarie))} · état des lieux ${e.datePrevue ? `prévu le ${dateCourte(e.datePrevue)}` : `au ${dateCourte(e.date)}`}</b><span>${[!c.entretiensOk ? `${pluriel(c.manques.length, 'écart')} entre entretiens de parcours (attendu le ${dateCourte(c.manques[0].attendu)})` : '', !c.formationOk ? 'aucune formation non obligatoire sur la période' : ''].filter(Boolean).join(' · ')}</span></button><span class="lt-droite">${c.risqueAbondement ? '<button class="etiquette rouge repere" data-action="repere" data-r="abondement">Risque 3 000 € CPF</button>' : '<span class="etiquette jaune">À compléter</span>'}</span></li>`).join('')}</ul></section>` : ''}
      <div class="colonnes-apercu">
        <section>
          <h2 class="titre-section">À traiter <span>${aTraiter.length ? 'Les retards d\'abord' : ''}</span></h2>
          ${aTraiter.length ? `<ul class="liste-taches">${aTraiter.slice(0, 12).map((e) => ligneEcheance(e, t)).join('')}</ul>${aTraiter.length > 12 ? `<button class="btn lien" data-action="vue" data-vue="salaries">Voir les ${aTraiter.length} échéances par salarié</button>` : ''}` : '<div class="vide-etat petit"><div><h3>Tout est à jour</h3><p>Les échéances en retard, à venir ou planifiées apparaissent ici.</p></div></div>'}
        </section>
        <section>
          <h2 class="titre-section">À finaliser</h2>
          ${finaliser.length ? `<ul class="liste-taches">${finaliser.map((x) => `<li class="ligne-transverse st-retard"><button class="lien-ligne" data-action="ouvrir-entretien" data-id="${x.id}"><b>${esc(prenom(x.salarie))} · ${esc(courtType(x.type))}</b><span>Prévu le ${dateCourte(x.date)} (${quand(ecart(t, x.date))}) : compte rendu à compléter</span></button><span class="lt-droite"><button class="btn petit" data-action="ouvrir-entretien" data-id="${x.id}">Compléter</button></span></li>`).join('')}</ul>` : '<div class="vide-etat petit"><div><h3>Rien à finaliser</h3><p>Un entretien prévu dont la date est passée attend ici son compte rendu.</p></div></div>'}
          <h2 class="titre-section">Formations en attente <span>${fAttente.length ? pluriel(fAttente.length, 'demande') : ''}</span></h2>
          ${fAttente.length ? `<ul class="liste-taches">${fAttente.slice(0, 5).map((f) => ligneFormation(f, t)).join('')}</ul>${fAttente.length > 5 ? '<button class="btn lien" data-action="vue" data-vue="formations">Toutes les demandes</button>' : ''}` : '<div class="vide-etat petit"><div><h3>Aucune demande en attente</h3><p>Les demandes de formation notées en entretien ou en cours d\'année attendent ici une réponse.</p></div></div>'}
        </section>
      </div>
      ${AVERTISSEMENT}`;
  }

  // ---------- Salariés ----------
  function prochaines(s, t) {
    return R.echeancesSalarie(s, E, t).map((e) => `<span class="cp-ech st-${e.statut}"><b>${esc(libEcheance(e))}</b>${etiquetteEcheance(e, t)}</span>`).join('');
  }
  function carteSalarie(s, t) {
    const present = R.estPresent(s, t);
    const ech = R.echeancesSalarie(s, E, t);
    const pire = ech.find((e) => e.statut === 'retard') ? 'retard' : ech.find((e) => e.statut === 'bientot') ? 'bientot' : '';
    return `<li class="carte-personne carte-salarie ${present ? '' : 'fini'} ${pire ? `pire-${pire}` : ''}">
      <button class="cp-corps" data-action="fiche" data-id="${s.id}">
        <span class="cp-tete"><span class="etiquette ${present ? 'ciel' : 'sable'}">${present ? esc(s.service || 'Salarié') : 'Sorti'}</span><span class="cp-pos">${present ? `Entré le ${dateCourte(s.entree)}` : `Sorti le ${dateCourte(s.sortie)}`}</span></span>
        <b>${esc(s.prenom)}</b>
        <span class="cp-detail">${esc(s.poste || 'Poste à préciser')}${s.manager ? ` · ${esc(s.manager)}` : ''}</span>
        ${present ? `<span class="cp-echeances">${prochaines(s, t)}</span>` : '<span class="cp-detail">Plus d\'échéance : fiche à effacer après le délai de conservation.</span>'}
      </button>
    </li>`;
  }

  function vueSalaries() {
    const t = auj();
    const q = filtre.q.trim().toLowerCase();
    const garde = (s, f = filtre.salaries) => (f === 'tous' || (f === 'presents') === R.estPresent(s, t));
    const nb = (f) => E.salaries.filter((s) => garde(s, f)).length;
    const rang = (s) => { const l = R.echeancesSalarie(s, E, t); return l.some((e) => e.statut === 'retard') ? 0 : l.some((e) => e.statut === 'bientot') ? 1 : 2; };
    const liste = E.salaries.filter((s) => garde(s) && (!q || `${s.prenom} ${s.poste} ${s.service} ${s.manager}`.toLowerCase().includes(q))).sort((a, b) => rang(a) - rang(b) || a.prenom.localeCompare(b.prenom, 'fr'));
    return `
      <div class="vue-tete"><div><h1>Salariés</h1><p>Une fiche par salarié : ses échéances, ses entretiens, ses objectifs et ses demandes de formation.</p></div>
        <div class="actions"><button class="btn primaire" data-action="nouveau-salarie">${ICONES.plus}Salarié</button></div></div>
      <div class="outils-liste">
        <div class="filtres" role="group" aria-label="Filtrer les salariés">${[['presents', 'Présents'], ['sortis', 'Sortis'], ['tous', 'Tous']].map(([id, lib]) => `<button class="filtre" data-action="filtre" data-cle="salaries" data-filtre="${id}" aria-pressed="${filtre.salaries === id}">${lib} <small>${nb(id)}</small></button>`).join('')}</div>
        <label class="champ recherche"><span class="sr-only">Rechercher</span><input id="recherche" type="search" placeholder="Rechercher un prénom, un poste" value="${esc(filtre.q)}"></label>
      </div>
      ${liste.length ? `<ul class="cartes-personnes">${liste.map((s) => carteSalarie(s, t)).join('')}</ul>` : `<div class="vide-etat">${FORME_VIDE}<div><h3>${E.salaries.length ? 'Aucun salarié ne correspond' : 'Aucun salarié'}</h3><p>${E.salaries.length ? 'Change le filtre ou la recherche.' : 'Ajoute un salarié : prénom et initiale, poste, date d\'entrée.'}</p><div class="actions"><button class="btn primaire" data-action="nouveau-salarie">${ICONES.plus}Un salarié</button></div></div></div>`}
      <p class="mention" style="margin-top:20px">Données minimales : prénom et initiale du nom, poste, service, manager, dates. Ne saisis ni donnée de santé, ni salaire, ni adresse, ni numéro d'identification.</p>`;
  }

  function vueFiche(s) {
    const t = auj();
    const present = R.estPresent(s, t);
    const ech = R.echeancesSalarie(s, E, t);
    const epp = ech.find((e) => e.type === 'epp');
    const ents = R.entretiensDe(E.entretiens, s.id).reverse();
    const objs = E.objectifs.filter((o) => o.salarie === s.id).sort((a, b) => (a.statut === 'en-cours' ? 0 : 1) - (b.statut === 'en-cours' ? 0 : 1) || b.creeLe.localeCompare(a.creeLe));
    const forms = E.formations.filter((f) => f.salarie === s.id).sort((a, b) => b.demandeLe.localeCompare(a.demandeLe));
    const age = s.anneeNaissance ? Number(t.slice(0, 4)) - s.anneeNaissance : null;
    return `
      <button class="btn lien retour" data-action="vue" data-vue="salaries">${ICONES.gauche}Tous les salariés</button>
      <div class="vue-tete fiche-tete"><div>
          <p class="surtitre">${present ? `Entré le ${dateLongue(s.entree)}` : `Sorti le ${dateLongue(s.sortie)}`}</p>
          <h1>${esc(s.prenom)}</h1>
          <p>${esc([s.poste, s.service].filter(Boolean).join(' · ') || 'Poste à préciser')}${s.manager ? `<br>Manager : ${esc(s.manager)}` : ''}${age ? `<br>Année de ses ${age} ans` : ''}${s.forfaitJours ? '<br>Forfait annuel en jours' : ''}${s.visiteMiCarriere ? `<br>Visite de mi-carrière le ${dateLongue(s.visiteMiCarriere)}` : ''}</p>
          ${s.note ? `<p class="note-fiche">${esc(s.note)}</p>` : ''}
        </div>
        <div class="actions">
          ${present ? `<button class="btn primaire" data-action="planifier" data-id="${s.id}">${ICONES.plus}Planifier</button>` : ''}
          <button class="btn" data-action="modifier-salarie" data-id="${s.id}">Modifier</button>
        </div></div>
      ${present ? `<h2 class="titre-section">Échéances</h2><ul class="liste-taches">${ech.map((e) => ligneEcheance(e, t, { avecNom: false })).join('')}</ul>
        ${epp?.autres?.length ? `<p class="aide">Autres échéances de parcours professionnel : ${epp.autres.map((a) => `${esc(nomMotif(a.motif).toLowerCase())} (${dateCourte(a.date)})`).join(' · ')}.</p>` : ''}` : ''}
      <div class="titre-section titre-avec-action"><h2>Entretiens <span>${pluriel(ents.length, 'entretien')}</span></h2><div class="actions">${present ? `<button class="btn petit" data-action="planifier" data-id="${s.id}" data-historique="1">${ICONES.plus}Entretien passé</button>` : ''}</div></div>
      ${ents.length ? `<ul class="liste-taches">${ents.map((x) => ligneEntretien(x, t, { avecNom: false })).join('')}</ul>` : '<p class="aide">Aucun entretien noté. Saisis d\'abord le dernier entretien de parcours professionnel et le dernier état des lieux déjà tenus (« Entretien passé ») : les échéances en partent.</p>'}
      <div class="titre-section titre-avec-action"><h2>Objectifs</h2><button class="btn petit" data-action="nouvel-objectif" data-id="${s.id}">${ICONES.plus}Objectif</button></div>
      ${objs.length ? `<ul class="liste-objectifs">${objs.map((o) => ligneObjectif(o, t, { avecNom: false })).join('')}</ul>` : '<p class="aide">Aucun objectif. Ils se fixent en entretien annuel et se revoient au suivant.</p>'}
      <div class="titre-section titre-avec-action"><h2>Formations</h2><button class="btn petit" data-action="nouvelle-formation" data-id="${s.id}">${ICONES.plus}Demande</button></div>
      ${forms.length ? `<ul class="liste-taches">${forms.map((f) => ligneFormation(f, t, { avecNom: false })).join('')}</ul>` : '<p class="aide">Aucune demande de formation.</p>'}
      <div class="titre-section titre-avec-action"><h2>Absences longues <span>Celles qui ouvrent un entretien au retour</span></h2><button class="btn petit" data-action="nouvelle-absence" data-id="${s.id}">${ICONES.plus}Absence</button></div>
      ${s.absences.length ? `<ul class="liste-taches">${s.absences.map((b) => `<li class="ligne-transverse"><button class="lien-ligne" data-action="absence" data-id="${s.id}" data-absence="${b.id}"><b>${esc(nomAbsence(b.type))}</b><span>${b.debut ? `du ${dateCourte(b.debut)} ` : ''}${b.retour ? `· retour le ${dateCourte(b.retour)}` : '· retour à préciser'}</span></button></li>`).join('')}</ul>` : '<p class="aide">Congé de maternité, parental, de proche aidant, sabbatique, arrêt longue maladie… : un entretien de parcours professionnel est proposé au retour si aucun n\'a eu lieu dans les 12 mois précédents. Seuls le type et les dates sont notés.</p>'}
      <div class="pied-fiche">
        <div class="rang"><button class="btn" data-action="export-salarie" data-id="${s.id}" data-format="texte">Exporter ses données (texte)</button><button class="btn" data-action="export-salarie" data-id="${s.id}" data-format="json">Exporter (JSON)</button><button class="btn danger" data-action="effacer-salarie" data-id="${s.id}">Effacer ce salarié</button></div>
        <p class="mention">Droit d'accès : l'export rassemble tout ce qui concerne ${esc(s.prenom)} dans cet outil. L'effacement supprime sa fiche, ses entretiens, ses objectifs et ses demandes de formation (annulable quelques secondes).</p>
      </div>`;
  }

  // ---------- Entretiens ----------
  function ligneEntretien(x, t, { avecNom = true } = {}) {
    const passe = x.statut === 'prevu' && x.date < t;
    const etiq = x.statut === 'realise'
      ? (x.historique ? '<span class="etiquette sable">Historique</span>' : `<span class="etiquette vert">Réalisé</span>${x.type !== 'annuel' ? (x.copieRemiseLe ? '' : '<span class="etiquette jaune">Copie à remettre</span>') : ''}`)
      : passe ? '<span class="etiquette rouge">À finaliser</span>' : `<span class="etiquette ciel">Prévu ${quand(ecart(t, x.date))}</span>`;
    const nbRep = Object.keys(x.reponses).length;
    return `<li class="ligne-transverse st-${x.statut === 'realise' ? 'fait' : passe ? 'retard' : 'avenir'}">
      <button class="lien-ligne" data-action="ouvrir-entretien" data-id="${x.id}"><b>${avecNom ? `${esc(prenom(x.salarie))} · ` : ''}${esc(nomType(x.type))}${x.motif && x.motif !== 'periodique' ? ` · ${esc(nomMotif(x.motif).toLowerCase())}` : ''}</b><span>${fmt(x.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}${x.heure ? ` à ${x.heure.replace(':', ' h ')}` : ''}${x.historique ? ' · noté pour l\'historique' : nbRep ? ` · ${pluriel(nbRep, 'réponse')}` : ''}</span></button>
      <span class="lt-droite">${pastilleType(x.type)}${etiq}</span>
    </li>`;
  }

  function vueEntretiens() {
    const t = auj();
    const presents = new Set(E.salaries.map((s) => s.id));
    const tous = E.entretiens.filter((x) => presents.has(x.salarie));
    const groupes = {
      avenir: tous.filter((x) => x.statut === 'prevu' && x.date >= t).sort((a, b) => (a.date + a.heure).localeCompare(b.date + b.heure)),
      finaliser: tous.filter((x) => x.statut === 'prevu' && x.date < t).sort((a, b) => a.date.localeCompare(b.date)),
      realises: tous.filter((x) => x.statut === 'realise').sort((a, b) => b.date.localeCompare(a.date)),
    };
    const f = filtre.entretiens;
    const filtres = [['avenir', 'À venir', groupes.avenir.length], ['finaliser', 'À finaliser', groupes.finaliser.length], ['realises', 'Réalisés', groupes.realises.length], ['trames', 'Trames', '']];
    const entete = `
      <div class="vue-tete"><div><h1>Entretiens</h1><p>Planifie, envoie le questionnaire de préparation, mène l'entretien avec la trame, puis imprime le compte rendu.</p></div>
        <div class="actions"><button class="btn primaire" data-action="planifier">${ICONES.plus}Planifier</button></div></div>
      <div class="filtres" role="group" aria-label="Filtrer les entretiens">${filtres.map(([id, lib, n]) => `<button class="filtre" data-action="filtre" data-cle="entretiens" data-filtre="${id}" aria-pressed="${f === id}">${lib}${n !== '' ? ` <small>${n}</small>` : ''}</button>`).join('')}</div>`;
    if (f === 'trames') return entete + vueTrames();
    const l = groupes[f] || [];
    const vides = { avenir: ['Aucun entretien prévu', 'Planifie un entretien depuis une échéance ou avec le bouton « Planifier ».'], finaliser: ['Rien à finaliser', 'Un entretien prévu dont la date est passée apparaît ici jusqu\'à ce que tu le marques réalisé.'], realises: ['Aucun entretien réalisé', 'Les comptes rendus terminés et l\'historique saisi apparaissent ici.'] };
    return `${entete}<div style="margin-top:16px">${l.length ? `<ul class="liste-taches">${l.map((x) => ligneEntretien(x, t)).join('')}</ul>` : `<div class="vide-etat">${FORME_VIDE}<div><h3>${vides[f][0]}</h3><p>${vides[f][1]}</p></div></div>`}</div>`;
  }

  function vueTrames() {
    const type = filtre.trame;
    const masque = new Set(E.questionsMasquees);
    const perso = E.questionsPerso[type] || [];
    const ligneQ = (x, perso2 = false) => `<li class="ligne-question ${masque.has(x.id) ? 'masquee' : ''}"><span>${esc(x.texte)}</span>${perso2 ? `<button class="btn petit" data-action="retirer-question" data-q="${x.id}">Retirer</button>` : `<button class="btn petit" data-action="masquer-question" data-q="${x.id}" aria-pressed="${masque.has(x.id)}">${masque.has(x.id) ? 'Afficher' : 'Masquer'}</button>`}</li>`;
    const auto = { objectifs: 'Revue des objectifs de la période (automatique)', 'nouveaux-objectifs': 'Nouveaux objectifs SMART (automatique)', formations: 'Demandes de formation (automatique)', controle: 'Contrôle des 8 ans : entretiens et formations (automatique)' };
    return `
      <div class="choix-statut choix-sens" role="group" aria-label="Trame" style="margin-top:16px">${B.types.map((x) => `<button type="button" data-action="filtre" data-cle="trame" data-filtre="${x.id}" aria-pressed="${type === x.id}"><span>${esc(x.court)}</span></button>`).join('')}</div>
      <p class="aide" style="margin:12px 0">${esc(typeB(type).desc)} Les questions masquées n'apparaissent plus dans les nouveaux entretiens ni dans le questionnaire ; les réponses déjà saisies restent.</p>
      ${B.trames[type].map((th) => `<section class="theme-trame"><h3 class="titre-phase">${esc(th.nom)}${th.auto ? `<span>${esc(auto[th.auto])}</span>` : ''}</h3><ul class="liste-questions">${th.questions.map((x) => ligneQ(x)).join('')}</ul></section>`).join('')}
      <section class="theme-trame"><h3 class="titre-phase">Questions de l'entreprise <span>Ajoutées avant la conclusion</span></h3>
        ${perso.length ? `<ul class="liste-questions">${perso.map((x) => ligneQ(x, true)).join('')}</ul>` : '<p class="aide">Aucune question ajoutée pour cette trame.</p>'}
        <form class="rang ajout-question" data-type="${type}"><label class="champ" style="flex:1 1 260px"><span class="sr-only">Nouvelle question</span><input name="question" maxlength="300" placeholder="Ex. : Que penses-tu du nouvel outil de planification ?"></label><button class="btn petit primaire" type="submit">${ICONES.plus}Ajouter</button></form>
      </section>
      <h2 class="titre-section">Thèmes complémentaires <span>Ajoutés selon le motif de l'entretien</span></h2>
      ${Object.values(B.complements).map((th) => `<section class="theme-trame"><h3 class="titre-phase">${esc(th.nom)}<span>${th.id === 'forfait-jours' ? 'Entretien annuel des salariés au forfait jours' : `Entretien de parcours : ${esc(nomMotif(th.id).toLowerCase())}`}</span></h3><ul class="liste-questions">${th.questions.map((x) => ligneQ(x)).join('')}</ul></section>`).join('')}
      <h2 class="titre-section">Repères réglementaires <span>Droit du travail français, datés et à vérifier</span></h2>
      <ol class="conseils">${Object.values(B.reperes).map((r) => `<li><b>${esc(r.titre)}</b><span>${esc(r.texte)}</span><small class="source">${esc(r.source)}</small></li>`).join('')}</ol>
      ${AVERTISSEMENT}`;
  }

  // Éditeur d'un entretien : préparation, trame, blocs automatiques, synthèse, réalisation.
  function vueEntretien(x) {
    const t = auj();
    const s = salarie(x.salarie);
    const themes = R.themesEntretien(x, s, E, B);
    const passe = x.statut === 'prevu' && x.date < t;
    const verrou = x.historique;
    const zone = (id, valeur, lib, rows = 3) => `<label class="champ question"><span>${esc(lib)}</span><textarea data-rep="${id}" rows="${rows}" ${verrou ? '' : ''}>${esc(valeur || '')}</textarea></label>`;
    const blocAuto = (th) => {
      if (th.auto === 'objectifs') {
        const l = R.objectifsARevoir(E.objectifs, x.salarie, x);
        return `<div class="bloc-auto"><p class="surtitre">Objectifs à revoir</p>${l.length ? `<ul class="liste-objectifs revue">${l.map((o) => `<li class="revue-objectif">
          <div class="ro-tete"><b>${esc(o.intitule)}</b>${puceSmart(o)}</div>
          <span class="aide">${o.cible ? `Cible : ${esc(o.cible)}${o.indicateur ? ` (${esc(o.indicateur)})` : ''} · ` : ''}${o.echeance ? `échéance ${dateCourte(o.echeance)} · ` : ''}avancement ${o.avancement} %</span>
          <div class="ro-champs"><label class="champ"><span>Bilan</span><select data-obj-statut="${o.id}">${B.statutsObjectif.map((st) => `<option value="${st.id}" ${o.statut === st.id ? 'selected' : ''}>${esc(st.nom)}</option>`).join('')}</select></label>
          <label class="champ"><span>Commentaire</span><input data-obj-bilan="${o.id}" value="${esc(o.bilan)}" maxlength="600" placeholder="Ce qui a été atteint, ce qui manque"></label></div>
          ${o.statut !== 'en-cours' && !E.objectifs.some((y) => y.reportDe === o.id) ? `<button class="btn petit" data-action="reporter-objectif" data-id="${o.id}" data-entretien="${x.id}">Reconduire l'an prochain</button>` : ''}
        </li>`).join('')}</ul>` : '<p class="aide">Aucun objectif en cours pour cette période.</p>'}</div>`;
      }
      if (th.auto === 'nouveaux-objectifs') {
        const l = R.objectifsFixes(E.objectifs, x.id);
        return `<div class="bloc-auto"><p class="surtitre">Objectifs fixés dans cet entretien</p>${l.length ? `<ul class="liste-objectifs">${l.map((o) => ligneObjectif(o, t, { avecNom: false })).join('')}</ul>` : '<p class="aide">Aucun pour l\'instant. Un bon objectif dit quoi, comment on le mesure, avec quels moyens, pourquoi, et pour quand.</p>'}<button class="btn petit primaire" data-action="nouvel-objectif" data-id="${x.salarie}" data-entretien="${x.id}">${ICONES.plus}Objectif</button></div>`;
      }
      if (th.auto === 'formations') {
        const l = E.formations.filter((f) => f.salarie === x.salarie && (f.entretien === x.id || R.formationEnAttente(f) || f.statut === 'planifiee'));
        const depuis = R.eppRealises(E.entretiens, x.salarie).filter((y) => y.id !== x.id && y.date < x.date).pop();
        const suivies = E.formations.filter((f) => f.salarie === x.salarie && f.statut === 'realisee' && (!depuis || (f.dateRealisee && f.dateRealisee >= depuis.date)));
        return `<div class="bloc-auto"><p class="surtitre">Formations</p>
          ${x.type !== 'annuel' ? `<p class="aide">Suivies ${depuis ? `depuis le dernier entretien de parcours (${dateCourte(depuis.date)})` : 'depuis l\'entrée'} : ${suivies.length ? suivies.map((f) => `${esc(f.intitule)} (${esc(nature(f.nature).court.toLowerCase())}, ${f.dateRealisee ? dateCourte(f.dateRealisee) : 'date ?'})`).join(' · ') : 'aucune notée'}.</p>` : ''}
          ${l.length ? `<ul class="liste-taches">${l.map((f) => ligneFormation(f, t, { avecNom: false })).join('')}</ul>` : '<p class="aide">Aucune demande en cours.</p>'}
          <button class="btn petit primaire" data-action="nouvelle-formation" data-id="${x.salarie}" data-entretien="${x.id}">${ICONES.plus}Demande de formation</button></div>`;
      }
      if (th.auto === 'controle') {
        const c = R.controleBilan(s, E, x.date, x.id);
        return `<div class="bloc-auto controle-bilan"><p class="surtitre">Contrôle du ${dateCourte(c.debut)} au ${dateCourte(c.fin)}</p>
          <ul class="controle">
            <li class="${c.entretiensOk ? 'ok' : 'ko'}"><b>${c.entretiensOk ? 'Entretiens de parcours tenus' : `${pluriel(c.manques.length, 'écart')} entre entretiens`}</b><span>${c.epp.length ? `Réalisés : ${c.epp.map(dateCourte).join(', ')}` : 'Aucun entretien de parcours noté sur la période'}${c.manques.length ? ` · attendu le ${c.manques.map((m) => dateCourte(m.attendu)).join(', ')}` : ''}</span></li>
            <li class="${c.formationOk ? 'ok' : 'ko'}"><b>${c.formationOk ? `${pluriel(c.nonObligatoires.length, 'formation non obligatoire', 'formations non obligatoires')}` : 'Aucune formation non obligatoire'}</b><span>${c.formations.length ? c.formations.map((f) => `${esc(f.intitule)} (${esc(nature(f.nature).court.toLowerCase())})`).join(' · ') : 'Aucune formation réalisée notée sur la période'}</span></li>
            <li class="${c.certifications.length ? 'ok' : ''}"><b>${c.certifications.length ? pluriel(c.certifications.length, 'certification') : 'Aucune certification notée'}</b><span>Formation certifiante ou VAE réalisée sur la période.</span></li>
          </ul>
          <fieldset class="champ"><legend>Progression salariale ou professionnelle sur la période</legend><div class="choix-statut choix-2">${[['oui', 'Oui'], ['non', 'Non']].map(([v, l]) => `<label><input type="radio" name="progression" data-champ="progression" value="${v}" ${x.progression === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>
          ${E.effectif50 ? (c.risqueAbondement ? '<p class="alerte-ligne"><b>Risque d\'abondement de 3 000 € au CPF</b> (entreprise d\'au moins 50 salariés) : un critère manque. <button class="btn lien" data-action="repere" data-r="abondement">Voir le repère</button></p>' : '<p class="aide">Les deux critères sont réunis : pas d\'abondement correctif selon le repère légal.</p>') : '<p class="aide">Entreprise de moins de 50 salariés (réglage) : pas d\'abondement correctif, mais un manquement peut être reproché en cas de litige.</p>'}</div>`;
      }
      return '';
    };
    const nomTypeX = nomType(x.type);
    const aCopier = R.questionnaire(x, s, themes, { entreprise: E.entreprise, nomType: nomTypeX });
    return `
      <button class="btn lien retour" data-action="retour-entretiens">${ICONES.gauche}Tous les entretiens</button>
      <div class="vue-tete fiche-tete"><div>
          <p class="surtitre">${esc(nomTypeX)}${x.motif && x.motif !== 'periodique' ? ` · ${esc(nomMotif(x.motif).toLowerCase())}` : ''}</p>
          <h1>${esc(s.prenom)}</h1>
          <p>${esc([s.poste, s.service].filter(Boolean).join(' · '))}<br>${x.statut === 'realise' ? 'Réalisé' : 'Prévu'} le <b>${dateLongue(x.date)}</b>${x.heure ? ` à ${x.heure.replace(':', ' h ')}` : ''}${s.manager ? ` · avec ${esc(s.manager.toLowerCase())}` : ''}</p>
          <p class="etiquettes-tete">${pastilleType(x.type)}${x.statut === 'realise' ? (x.historique ? '<span class="etiquette sable">Historique</span>' : '<span class="etiquette vert">Réalisé</span>') : passe ? '<span class="etiquette rouge">À finaliser</span>' : '<span class="etiquette ciel">Prévu</span>'}${x.modifieApresRemise ? '<span class="etiquette jaune">Modifié après remise de la copie</span>' : ''}</p>
        </div>
        <div class="actions">
          <button class="btn" data-action="modifier-entretien" data-id="${x.id}">Modifier</button>
          ${verrou ? '' : `<button class="btn" data-action="imprimer-entretien" data-id="${x.id}">Imprimer</button>`}
        </div></div>
      ${verrou ? `<div class="bloc-auto"><p>Entretien noté pour l'historique : il compte pour le calcul des échéances. Ajoute une note si utile.</p></div>${zone('note', x.reponses.note, 'Note', 3)}` : `
      ${x.type === 'epp' || x.type === 'bilan' ? '<p class="mention avertissement-epp">Entretien de parcours professionnel : il porte sur les compétences, le parcours et les souhaits d\'évolution, pas sur l\'évaluation du travail.</p>' : ''}
      <section class="preparation">
        <h2 class="titre-section">Préparation du salarié</h2>
        <p class="aide">Copie le questionnaire et envoie-le au salarié par ton canal habituel (e-mail, message, papier) quelques jours avant. Colle ensuite ses notes ci-dessous.</p>
        <div class="rang"><button class="btn primaire petit" data-action="copier-questionnaire" data-id="${x.id}">Copier le questionnaire</button><details class="apercu-questionnaire"><summary>Voir le texte</summary><pre>${esc(aCopier)}</pre></details></div>
        <label class="champ question"><span>Notes du salarié (collées)</span><textarea data-champ="preparation" rows="4" placeholder="Colle ici les réponses du salarié">${esc(x.preparation)}</textarea></label>
      </section>
      <h2 class="titre-section">Compte rendu</h2>
      ${themes.map((th, i) => `<section class="theme-entretien"><h3 class="titre-phase"><span class="num">${i + 1}</span>${esc(th.nom)}${th.complement ? '<span>Thème complémentaire</span>' : ''}</h3>${blocAuto(th)}${th.questions.map((q) => zone(q.id, x.reponses[q.id], q.texte)).join('')}</section>`).join('')}
      <section class="theme-entretien"><h3 class="titre-phase">Synthèse</h3><label class="champ question"><span>Synthèse du manager : points clés, décisions, suites</span><textarea data-champ="synthese" rows="4">${esc(x.synthese)}</textarea></label></section>
      <div class="pied-entretien">
        ${x.type !== 'annuel' ? `<label class="champ" style="max-width:260px">Copie remise au salarié le<input type="date" data-champ="copieRemiseLe" value="${x.copieRemiseLe || ''}"></label>` : ''}
        <div class="rang">${x.statut === 'prevu' ? `<button class="btn primaire" data-action="realiser" data-id="${x.id}">${ICONES.coche}Marquer comme réalisé</button>` : `<button class="btn" data-action="rouvrir" data-id="${x.id}">Repasser en prévu</button>`}<button class="btn" data-action="imprimer-entretien" data-id="${x.id}">Imprimer le compte rendu</button></div>
      </div>`}
      <div class="pied-fiche"><button class="btn danger" data-action="supprimer-entretien" data-id="${x.id}">Supprimer cet entretien</button></div>`;
  }

  // ---------- Objectifs ----------
  function ligneObjectif(o, t, { avecNom = true } = {}) {
    const echu = R.objectifEchu(o, t);
    const chaine = R.chaineObjectif(E.objectifs, o.id);
    return `<li class="ligne-objectif ${o.statut}">
      <button class="lien-ligne" data-action="objectif" data-id="${o.id}"><b>${avecNom ? `${esc(prenom(o.salarie))} · ` : ''}${esc(o.intitule)}</b><span>${o.cible ? `Cible ${esc(o.cible)} · ` : ''}${o.echeance ? `échéance ${dateCourte(o.echeance)}` : 'sans échéance'}${chaine.length > 1 ? ` · suivi depuis ${chaine[0].creeLe.slice(0, 4)}` : ''}${o.bilan ? ` · ${esc(o.bilan)}` : ''}</span></button>
      <span class="lo-droite">${puceSmart(o)}${o.statut === 'en-cours' ? `<span class="lo-avance">${barre(o.avancement)}<small>${o.avancement} %</small></span>` : ''}<span class="etiquette ${echu ? 'rouge' : ETIQ_O[o.statut]}">${echu ? 'Échu, bilan à faire' : esc(nomStatutO(o.statut))}</span></span>
    </li>`;
  }

  function vueObjectifs() {
    const t = auj();
    const presents = E.salaries.filter((s) => R.estPresent(s, t));
    const parSal = (o) => filtre.salarieObj === 'tous' || o.salarie === filtre.salarieObj;
    const garde = (o, f = filtre.objectifs) => f === 'tous' || (f === 'en-cours' && o.statut === 'en-cours') || (f === 'echus' && R.objectifEchu(o, t)) || (f === 'clos' && o.statut !== 'en-cours') || (f === 'a-preciser' && !R.controleSmart(o).ok && o.statut === 'en-cours');
    const base = E.objectifs.filter((o) => salarie(o.salarie) && parSal(o));
    const l = base.filter((o) => garde(o)).sort((a, b) => (a.echeance || '9999').localeCompare(b.echeance || '9999'));
    const bilan = R.bilanObjectifs(base).slice(0, 3);
    return `
      <div class="vue-tete"><div><h1>Objectifs</h1><p>Fixés en entretien, suivis en cours d'année, revus à l'entretien suivant. Le contrôle SMART signale ce qui reste flou.</p></div>
        <div class="actions"><button class="btn primaire" data-action="nouvel-objectif">${ICONES.plus}Objectif</button><button class="btn" data-action="csv-objectifs">CSV</button></div></div>
      ${bilan.length ? `<div class="tuiles tuiles-3">${bilan.map((b) => `<div class="tuile" style="--c:var(--bleu)"><p class="surtitre">Fixés en ${b.annee}</p><b>${b.total}</b><span>${b['en-cours']} en cours · ${pluriel(b.atteint, 'atteint')} · ${pluriel(b.partiel, 'partiel')}${b.tauxAtteinte !== null ? ` · ${b.tauxAtteinte} % d'atteinte` : ''}</span></div>`).join('')}</div>` : ''}
      <div class="outils-liste">
        <div class="filtres" role="group" aria-label="Filtrer les objectifs">${[['en-cours', 'En cours'], ['echus', 'Échus'], ['a-preciser', 'À préciser'], ['clos', 'Clos'], ['tous', 'Tous']].map(([id, lib]) => `<button class="filtre" data-action="filtre" data-cle="objectifs" data-filtre="${id}" aria-pressed="${filtre.objectifs === id}">${lib} <small>${base.filter((o) => garde(o, id)).length}</small></button>`).join('')}</div>
        <label class="champ recherche"><span class="sr-only">Salarié</span><select data-filtre-select="salarieObj"><option value="tous">Tous les salariés</option>${presents.map((s) => `<option value="${s.id}" ${filtre.salarieObj === s.id ? 'selected' : ''}>${esc(s.prenom)}</option>`).join('')}</select></label>
      </div>
      ${l.length ? `<ul class="liste-objectifs">${l.map((o) => ligneObjectif(o, t)).join('')}</ul>` : `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun objectif ici</h3><p>Change de filtre, ou fixe un objectif : quoi, comment on le mesure, avec quels moyens, pourquoi, pour quand.</p></div></div>`}
      <p class="mention" style="margin-top:16px">SMART : <b>S</b>pécifique (intitulé précis), <b>M</b>esurable (indicateur et cible), <b>A</b>tteignable (moyens), <b>R</b>elié au poste ou à l'équipe, <b>T</b>emporel (échéance dans les 18 mois). Contrôle indicatif.</p>`;
  }

  // ---------- Formations ----------
  function ligneFormation(f, t, { avecNom = true } = {}) {
    const sansRep = R.formationSansReponse(f, t);
    const n = nature(f.nature);
    const date = f.statut === 'realisee' && f.dateRealisee ? `réalisée le ${dateCourte(f.dateRealisee)}` : f.datePrevue ? `prévue le ${dateCourte(f.datePrevue)}` : `demandée le ${dateCourte(f.demandeLe)}`;
    return `<li class="ligne-transverse ligne-formation">
      <button class="lien-ligne" data-action="formation" data-id="${f.id}"><b>${avecNom ? `${esc(prenom(f.salarie))} · ` : ''}${esc(f.intitule)}</b><span>${esc(n.court)} · ${date}${f.dispositif ? ` · ${esc(f.dispositif)}` : ''}</span></button>
      <span class="lt-droite"><span class="etiquette ${sansRep ? 'rouge' : ETIQ_F[f.statut]}">${sansRep ? `Sans réponse · ${quand(ecart(t, f.demandeLe))}` : esc(nomStatutF(f.statut))}</span></span>
    </li>`;
  }

  function vueFormations() {
    const t = auj();
    const l0 = E.formations.filter((f) => salarie(f.salarie));
    const ind = R.indicateursFormations(l0, t);
    const garde = (f, k = filtre.formations) => k === 'toutes' || (k === 'attente' && R.formationEnAttente(f)) || (k === 'planifiees' && f.statut === 'planifiee') || (k === 'realisees' && f.statut === 'realisee') || (k === 'refusees' && f.statut === 'refusee');
    const l = l0.filter((f) => garde(f)).sort((a, b) => (a.datePrevue || a.dateRealisee || a.demandeLe).localeCompare(b.datePrevue || b.dateRealisee || b.demandeLe) * (filtre.formations === 'realisees' ? -1 : 1));
    return `
      <div class="vue-tete"><div><h1>Formations</h1><p>Les demandes notées en entretien ou en cours d'année, jusqu'à leur réalisation. La nature (obligatoire ou non) compte pour l'état des lieux des 8 ans.</p></div>
        <div class="actions"><button class="btn primaire" data-action="nouvelle-formation">${ICONES.plus}Demande</button><button class="btn" data-action="csv-formations">CSV</button></div></div>
      <div class="tuiles tuiles-3">
        <div class="tuile ${ind.sansReponse ? 'rond' : ''}" style="--c:var(--jaune)"><p class="surtitre">En attente</p><b>${ind.attente}</b><span>${ind.sansReponse ? `dont ${ind.sansReponse} sans réponse depuis plus de 60 jours` : 'demandées, acceptées ou reportées'}</span></div>
        <div class="tuile" style="--c:var(--bleu)"><p class="surtitre">Planifiées</p><b>${ind.planifiee}</b><span>avec une date prévue</span></div>
        <div class="tuile" style="--c:var(--encre)"><p class="surtitre">Réalisées</p><b>${ind.realisee}</b><span>${pluriel(ind.refusee, 'refus', 'refus')}</span></div>
      </div>
      <div class="filtres" role="group" aria-label="Filtrer les formations">${[['attente', 'En attente'], ['planifiees', 'Planifiées'], ['realisees', 'Réalisées'], ['refusees', 'Refusées'], ['toutes', 'Toutes']].map(([id, lib]) => `<button class="filtre" data-action="filtre" data-cle="formations" data-filtre="${id}" aria-pressed="${filtre.formations === id}">${lib} <small>${l0.filter((f) => garde(f, id)).length}</small></button>`).join('')}</div>
      <div style="margin-top:16px">${l.length ? `<ul class="liste-taches">${l.map((f) => ligneFormation(f, t)).join('')}</ul>` : `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucune formation ici</h3><p>Note une demande depuis un entretien ou avec le bouton « Demande ».</p></div></div>`}</div>
      <p class="mention" style="margin-top:16px">Mêmes natures que la matrice de compétences QME : obligatoire pour le poste, adaptation, développement, certifiante, VAE, bilan de compétences. Export CSV pour ton plan de développement des compétences.</p>`;
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
      if (typeof err === 'string') { const p = d.querySelector('.erreur'); if (p) p.textContent = err; return; }
      if (d.dataset.garder) { delete d.dataset.garder; return; }
      d.close();
    });
    if (!d.open) d.showModal();
    if (!estTel()) d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),select,textarea')?.focus();
  }
  const PIED_STD = '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>';
  const optionsSalaries = (v) => E.salaries.filter((s) => R.estPresent(s, auj()) || s.id === v).map((s) => `<option value="${s.id}" ${s.id === v ? 'selected' : ''}>${esc(s.prenom)}${s.poste ? ` · ${esc(s.poste)}` : ''}</option>`).join('');

  function modaleSalarie(id) {
    const t = auj();
    const s = id ? salarie(id) : null;
    if (id && !s) return;
    const v = s || { prenom: '', poste: '', service: '', manager: '', entree: '', sortie: null, anneeNaissance: null, visiteMiCarriere: null, forfaitJours: false, note: '' };
    const corps = `
      <label class="champ">Prénom et initiale du nom<small>Données minimales : « Camille D. ». Un nom complet est raccourci automatiquement.</small><input name="prenom" required maxlength="60" value="${esc(v.prenom)}" placeholder="Ex. : Camille D." autocomplete="off"></label>
      <p class="aide" id="apercu-nom" hidden></p>
      <div class="rang-champs">
        <label class="champ">Poste<input name="poste" maxlength="80" value="${esc(v.poste)}" placeholder="Ex. : Technicienne de maintenance"></label>
        <label class="champ">Service<input name="service" maxlength="60" value="${esc(v.service)}" placeholder="Ex. : Production"></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Manager<small>Fonction ou prénom</small><input name="manager" maxlength="60" value="${esc(v.manager)}" placeholder="Ex. : Responsable de production"></label>
        <label class="champ">Date d'entrée<small>Point de départ des échéances</small><input type="date" name="entree" value="${v.entree}" required></label>
      </div>
      ${s ? '' : `<fieldset class="champ cadre-champs"><legend>Historique <small>Facultatif : derniers entretiens déjà tenus, hors de cet outil.</small></legend>
        <div class="rang-champs">
          <label class="champ">Dernier entretien professionnel ou de parcours<input type="date" name="dernierEpp"></label>
          <label class="champ">Dernier état des lieux<input type="date" name="dernierBilan"></label>
          <label class="champ">Dernier entretien annuel<input type="date" name="dernierAnnuel"></label>
        </div></fieldset>`}
      <details class="plus-tard" ${v.anneeNaissance || v.visiteMiCarriere || v.forfaitJours || v.sortie ? 'open' : ''}><summary>Cas particuliers</summary>
        <div class="rang-champs">
          <label class="champ">Année de naissance<small>Facultative : seulement pour les repères de 45 et 60 ans.</small><input type="number" name="anneeNaissance" min="1930" max="2015" value="${v.anneeNaissance ?? ''}" inputmode="numeric"></label>
          <label class="champ">Visite de mi-carrière le<small>Date seulement, jamais son contenu.</small><input type="date" name="visiteMiCarriere" value="${v.visiteMiCarriere || ''}"></label>
        </div>
        <label class="case"><input type="checkbox" name="forfaitJours" ${v.forfaitJours ? 'checked' : ''}> Salarié au forfait annuel en jours (thème « Charge de travail » ajouté à l'entretien annuel)</label>
        <label class="champ" style="margin-top:12px">Date de sortie<small>Les échéances s'arrêtent ; l'effacement est proposé après ${pluriel(E.reglages.effacementMois, 'mois', 'mois')}.</small><input type="date" name="sortie" value="${v.sortie || ''}"></label>
      </details>
      <label class="champ">Note<small>Facultative. Aucune donnée sensible (santé, salaire, vie privée).</small><input name="note" maxlength="300" value="${esc(v.note)}"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(s ? 'Modifier le salarié' : 'Nouveau salarié', corps, s ? PIED_STD : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const nom = R.nomMinimal(f.get('prenom'));
      if (!nom) return 'Indique au moins un prénom.';
      const entree = String(f.get('entree') || '');
      if (!R.estDate(entree)) return 'Indique la date d\'entrée.';
      const sortie = String(f.get('sortie') || '');
      if (sortie && sortie < entree) return 'La date de sortie précède la date d\'entrée.';
      const a = String(f.get('anneeNaissance') || '').trim();
      if (a && !(Number(a) >= 1930 && Number(a) <= 2015)) return 'Année de naissance entre 1930 et 2015, ou vide.';
      const champs = { prenom: nom, poste: String(f.get('poste') || '').trim(), service: String(f.get('service') || '').trim(), manager: String(f.get('manager') || '').trim(), entree, sortie: sortie || null, anneeNaissance: a ? Number(a) : null, visiteMiCarriere: String(f.get('visiteMiCarriere') || '') || null, forfaitJours: f.get('forfaitJours') === 'on', note: String(f.get('note') || '').trim() };
      retenir();
      if (s) {
        Object.assign(s, R.normaliserSalarie({ ...s, ...champs }, t));
        sauver(); rendre();
        toast(`Fiche de ${nom} enregistrée.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      const ns = R.normaliserSalarie({ id: uid(), ...champs }, t);
      E.salaries.push(ns);
      const hist = [['epp', 'dernierEpp'], ['bilan', 'dernierBilan'], ['annuel', 'dernierAnnuel']];
      let n = 0;
      for (const [type, cle] of hist) {
        const d = String(f.get(cle) || '');
        if (R.estDate(d) && d <= t) { E.entretiens.push(R.normaliserEntretien({ id: uid(), salarie: ns.id, type, date: d, statut: 'realise', historique: true, motif: 'periodique' })); n++; }
      }
      sauver();
      changerVue('salaries', { fiche: ns.id });
      toast(`${nom} ajouté${n ? ` avec ${pluriel(n, 'entretien')} d'historique` : ''}.`, { libelle: 'Annuler', faire: annuler });
    });
    const d = modale();
    const champ = d.querySelector('[name=prenom]');
    champ.addEventListener('input', () => {
      const n = R.nomMinimal(champ.value);
      const a = d.querySelector('#apercu-nom');
      a.hidden = !n || n === champ.value.trim();
      a.textContent = `Sera enregistré : « ${n} ».`;
    });
  }

  function modaleAbsence(sid, aid) {
    const s = salarie(sid);
    if (!s) return;
    const b = aid ? s.absences.find((x) => x.id === aid) : null;
    const v = b || { type: 'parental', debut: '', retour: '' };
    const corps = `
      <label class="champ">Type d'absence<small>Seules les absences après lesquelles un entretien de parcours est proposé. Aucun détail médical ni personnel.</small><select name="type">${B.absences.map((a) => `<option value="${a.id}" ${a.id === v.type ? 'selected' : ''}>${esc(a.nom)}</option>`).join('')}</select></label>
      <div class="rang-champs">
        <label class="champ">Début<input type="date" name="debut" value="${v.debut || ''}"></label>
        <label class="champ">Reprise (prévue ou effective)<input type="date" name="retour" value="${v.retour || ''}"></label>
      </div>
      <p class="aide">Au retour, un entretien de parcours professionnel est dû si aucun n'a eu lieu dans les 12 mois précédant la reprise. Il peut aussi se tenir avant la reprise, à la demande du salarié. ${esc(B.reperes.cas.source)}</p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(b ? 'Modifier l\'absence' : 'Nouvelle absence', corps, b ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn danger" value="suppr">Supprimer</button><button class="btn" value="annuler">Annuler</button>' : PIED_STD, (f, choix) => {
      retenir();
      if (choix === 'suppr') { s.absences = s.absences.filter((x) => x.id !== aid); sauver(); rendre(); toast('Absence supprimée.', { libelle: 'Annuler', faire: annuler }); return; }
      const debut = String(f.get('debut') || ''), retour = String(f.get('retour') || '');
      if (!debut && !retour) return 'Indique au moins la date de reprise.';
      if (debut && retour && retour < debut) return 'La reprise précède le début.';
      const nb = { id: aid || uid(), type: String(f.get('type')), debut: debut || null, retour: retour || null };
      s.absences = b ? s.absences.map((x) => (x.id === aid ? nb : x)) : [...s.absences, nb];
      Object.assign(s, R.normaliserSalarie(s, auj()));
      sauver(); rendre(); toast('Absence enregistrée.', { libelle: 'Annuler', faire: annuler });
    });
  }

  // Planifier un entretien (ou noter un entretien passé pour l'historique).
  function modalePlanifier({ sid = null, type = null, motif = null, historique = false } = {}) {
    const t = auj();
    const presents = E.salaries.filter((s) => R.estPresent(s, t));
    if (!presents.length) { modaleSalarie(null); return; }
    const s0 = sid ? salarie(sid) : presents[0];
    const ech = R.echeancesSalarie(s0, E, t);
    const tp = type || (ech.find((e) => e.statut !== 'ok' && e.statut !== 'planifie') || ech[0] || { type: 'annuel' }).type;
    const m = motif || (ech.find((e) => e.type === tp)?.motif) || 'periodique';
    const dateProp = historique ? '' : ajout(t, 7);
    const corps = `
      <label class="champ">Salarié<select name="salarie">${optionsSalaries(s0.id)}</select></label>
      <fieldset class="champ"><legend>Type</legend><div class="choix-statut choix-3">${B.types.map((x) => `<label><input type="radio" name="type" value="${x.id}" ${x.id === tp ? 'checked' : ''}><span>${esc(x.court)}</span></label>`).join('')}</div></fieldset>
      <label class="champ" id="champ-motif" ${tp === 'annuel' ? 'hidden' : ''}>Motif<select name="motif">${B.motifs.map((x) => `<option value="${x.id}" ${x.id === (m === 'premier' && tp !== 'epp' ? 'periodique' : m) ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label>
      <div class="rang-champs">
        <label class="champ">Date<input type="date" name="date" value="${dateProp}" required></label>
        <label class="champ">Heure<small>Facultative</small><input type="time" name="heure" ${historique ? 'disabled' : ''}></label>
      </div>
      <label class="case"><input type="checkbox" name="historique" ${historique ? 'checked' : ''}> Entretien déjà tenu, noté pour l'historique (sans compte rendu)</label>
      <p class="aide" id="aide-planif"></p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(historique ? 'Entretien passé' : 'Planifier un entretien', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const date = String(f.get('date') || '');
      if (!R.estDate(date)) return 'Indique la date.';
      const hist = f.get('historique') === 'on';
      if (hist && date > t) return 'Un entretien de l\'historique est déjà passé : choisis une date d\'aujourd\'hui ou d\'avant.';
      const sid2 = String(f.get('salarie'));
      const s = salarie(sid2);
      if (date < s.entree) return 'La date précède l\'entrée du salarié.';
      const type2 = String(f.get('type'));
      const x = R.normaliserEntretien({ id: uid(), salarie: sid2, type: type2, motif: String(f.get('motif') || 'periodique'), date, heure: hist ? '' : String(f.get('heure') || ''), statut: hist ? 'realise' : 'prevu', historique: hist });
      retenir();
      E.entretiens.push(x);
      sauver();
      if (hist) { rendre(); toast(`${nomType(type2)} du ${dateCourte(date)} noté pour ${s.prenom}.`, { libelle: 'Annuler', faire: annuler }); return; }
      changerVue('entretiens', { ouvert: x.id });
      toast(`${nomType(type2)} de ${s.prenom} prévu le ${dateCourte(date)}. Copie le questionnaire pour sa préparation.`, { libelle: 'Annuler', faire: annuler });
    });
    const d = modale();
    const maj = () => {
      const ty = d.querySelector('[name=type]:checked').value;
      d.querySelector('#champ-motif').hidden = ty === 'annuel';
      const s = salarie(d.querySelector('[name=salarie]').value);
      const e = R.echeancesSalarie(s, E, t).find((y) => y.type === ty);
      d.querySelector('#aide-planif').textContent = e ? `Échéance ${courtType(ty).toLowerCase()} de ${s.prenom} : ${dateLongue(e.date)}${e.motif && e.motif !== 'periodique' ? ` (${nomMotif(e.motif).toLowerCase()})` : ''}.` : '';
      if (e && ty !== 'annuel') d.querySelector('[name=motif]').value = e.motif || 'periodique';
    };
    d.querySelectorAll('[name=type],[name=salarie]').forEach((el) => el.addEventListener('change', maj));
    d.querySelector('[name=historique]').addEventListener('change', (e) => { d.querySelector('[name=heure]').disabled = e.target.checked; });
    maj();
  }

  function modaleModifierEntretien(id) {
    const x = entretien(id);
    if (!x) return;
    const corps = `
      <fieldset class="champ"><legend>Type</legend><div class="choix-statut choix-3">${B.types.map((y) => `<label><input type="radio" name="type" value="${y.id}" ${y.id === x.type ? 'checked' : ''}><span>${esc(y.court)}</span></label>`).join('')}</div></fieldset>
      <label class="champ" id="champ-motif" ${x.type === 'annuel' ? 'hidden' : ''}>Motif<select name="motif">${B.motifs.map((y) => `<option value="${y.id}" ${y.id === x.motif ? 'selected' : ''}>${esc(y.nom)}</option>`).join('')}</select></label>
      <div class="rang-champs">
        <label class="champ">Date<input type="date" name="date" value="${x.date}" required></label>
        <label class="champ">Heure<input type="time" name="heure" value="${x.heure}"></label>
      </div>
      ${x.historique ? '' : `<fieldset class="champ cadre-champs"><legend>Thèmes complémentaires <small>En plus de ceux du motif.</small></legend><div class="profils-cases">${Object.values(B.complements).map((c) => `<label class="case"><input type="checkbox" name="complements" value="${c.id}" ${x.complements.includes(c.id) ? 'checked' : ''}> <span>${esc(c.nom)}</span></label>`).join('')}</div></fieldset>`}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Modifier l\'entretien', corps, PIED_STD, (f) => {
      const date = String(f.get('date') || '');
      if (!R.estDate(date)) return 'Indique la date.';
      if (x.historique && date > auj()) return 'Un entretien de l\'historique est déjà passé.';
      retenir();
      Object.assign(x, R.normaliserEntretien({ ...x, type: String(f.get('type')), motif: String(f.get('motif') || 'periodique'), date, heure: String(f.get('heure') || ''), complements: x.historique ? [] : f.getAll('complements').map(String) }));
      sauver(); rendre(); toast('Entretien modifié.', { libelle: 'Annuler', faire: annuler });
    });
    const d = modale();
    d.querySelectorAll('[name=type]').forEach((el) => el.addEventListener('change', () => { d.querySelector('#champ-motif').hidden = d.querySelector('[name=type]:checked').value === 'annuel'; }));
  }

  function modaleObjectif(id, { sid = null, entretienId = null } = {}) {
    const t = auj();
    const o = id ? objectif(id) : null;
    if (id && !o) return;
    const ent = entretienId ? entretien(entretienId) : null;
    const debut = ent ? ent.date : t;
    const v = o || { salarie: sid || E.salaries.find((s) => R.estPresent(s, t))?.id, intitule: '', indicateur: '', cible: '', moyens: '', lien: '', echeance: ajoutMois(debut, 12), avancement: 0, statut: 'en-cours', bilan: '', creeLe: debut };
    if (!v.salarie) { modaleSalarie(null); return; }
    const chaine = o ? R.chaineObjectif(E.objectifs, o.id) : [];
    const corps = `
      <label class="champ">Salarié<select name="salarie" ${o || ent ? 'disabled' : ''}>${optionsSalaries(v.salarie)}</select></label>
      <label class="champ">Objectif<small>Un verbe d'action et un résultat précis.</small><input name="intitule" maxlength="200" required value="${esc(v.intitule === 'Objectif' ? '' : v.intitule)}" placeholder="Ex. : Réduire le délai de réponse aux demandes de devis"></label>
      <div class="rang-champs">
        <label class="champ">Indicateur<small>Comment on le mesure</small><input name="indicateur" maxlength="160" value="${esc(v.indicateur)}" placeholder="Ex. : Délai moyen"></label>
        <label class="champ">Cible<input name="cible" maxlength="80" value="${esc(v.cible)}" placeholder="Ex. : 48 h"></label>
      </div>
      <label class="champ">Moyens<small>Ce qui rend l'objectif atteignable</small><input name="moyens" maxlength="300" value="${esc(v.moyens)}" placeholder="Ex. : Modèles de devis, appui du bureau d'études"></label>
      <label class="champ">Pourquoi c'est important<small>Lien au poste, à l'équipe ou à l'entreprise</small><input name="lien" maxlength="200" value="${esc(v.lien)}" placeholder="Ex. : Satisfaction client"></label>
      <div class="rang-champs">
        <label class="champ">Échéance<input type="date" name="echeance" value="${v.echeance || ''}"></label>
        <label class="champ">Avancement (%)<input type="number" name="avancement" min="0" max="100" step="5" value="${v.avancement}" inputmode="numeric"></label>
      </div>
      <p class="aide smart-direct" id="smart-direct"></p>
      ${o ? `<div class="rang-champs">
        <label class="champ">Statut<select name="statut">${B.statutsObjectif.map((st) => `<option value="${st.id}" ${st.id === v.statut ? 'selected' : ''}>${esc(st.nom)}</option>`).join('')}</select></label>
        <label class="champ">Bilan<input name="bilan" maxlength="600" value="${esc(v.bilan)}" placeholder="Ce qui a été atteint, ce qui manque"></label>
      </div>` : ''}
      ${chaine.length > 1 ? `<p class="aide">Suivi d'une année sur l'autre : ${chaine.map((c) => `${c.creeLe.slice(0, 4)} (${esc(nomStatutO(c.statut).toLowerCase())}${c.avancement && c.statut === 'en-cours' ? `, ${c.avancement} %` : ''})`).join(' → ')}</p>` : ''}
      <p class="erreur" role="alert"></p>`;
    const pied = o
      ? `<button class="btn primaire" value="ok">Enregistrer</button>${!E.objectifs.some((y) => y.reportDe === o.id) ? '<button class="btn" value="reporter">Reconduire</button>' : ''}<button class="btn danger" value="suppr">Supprimer</button><button class="btn" value="annuler">Annuler</button>`
      : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(o ? 'Objectif' : 'Nouvel objectif', corps, pied, (f, choix) => {
      if (choix === 'suppr') {
        if (!confirm('Supprimer cet objectif ? Les objectifs qui le reconduisent restent.')) return '';
        retenir(); E.objectifs = E.objectifs.filter((y) => y.id !== o.id); E.objectifs.forEach((y) => { if (y.reportDe === o.id) y.reportDe = null; });
        sauver(); rendre(); toast('Objectif supprimé.', { libelle: 'Annuler', faire: annuler }); return;
      }
      const intitule = String(f.get('intitule') || '').trim();
      if (!intitule) return 'Écris l\'objectif.';
      const champs = { intitule, indicateur: String(f.get('indicateur') || ''), cible: String(f.get('cible') || ''), moyens: String(f.get('moyens') || ''), lien: String(f.get('lien') || ''), echeance: String(f.get('echeance') || '') || null, avancement: Number(f.get('avancement') || 0) };
      retenir();
      if (o) {
        Object.assign(o, R.normaliserObjectif({ ...o, ...champs, statut: String(f.get('statut') || o.statut), bilan: String(f.get('bilan') || '') }, t));
        if (o.statut !== 'en-cours' && !o.bilanLe) o.bilanLe = t;
        if (o.statut === 'en-cours') o.bilanLe = null;
        if (choix === 'reporter') reconduire(o, null);
        sauver(); rendre(); toast(choix === 'reporter' ? 'Objectif reconduit sur 12 mois.' : 'Objectif enregistré.', { libelle: 'Annuler', faire: annuler });
        return;
      }
      E.objectifs.push(R.normaliserObjectif({ id: uid(), salarie: ent ? ent.salarie : String(f.get('salarie')), entretien: ent ? ent.id : null, creeLe: debut, ...champs }, t));
      sauver(); rendre(); toast('Objectif ajouté.', { libelle: 'Annuler', faire: annuler });
    });
    const d = modale();
    const majSmart = () => {
      const fd = new FormData(d.querySelector('form'));
      const c = R.controleSmart(R.normaliserObjectif({ intitule: fd.get('intitule'), indicateur: fd.get('indicateur'), cible: fd.get('cible'), moyens: fd.get('moyens'), lien: fd.get('lien'), echeance: fd.get('echeance'), creeLe: v.creeLe }, t));
      const noms = { S: 'un intitulé plus précis (4 mots au moins)', M: 'un indicateur et une cible', A: 'les moyens', R: 'le lien au poste ou à l\'équipe', T: 'une échéance dans les 18 mois' };
      d.querySelector('#smart-direct').innerHTML = c.ok ? '<b>SMART complet.</b>' : `<b>À préciser :</b> ${c.manque.map((k) => noms[k]).join(', ')}.`;
    };
    d.querySelector('form').addEventListener('input', majSmart);
    majSmart();
  }

  // Reconduit un objectif clos (ou le clôt « partiellement atteint » s'il était en cours) sur 12 mois.
  function reconduire(o, entretienId) {
    const ent = entretienId ? entretien(entretienId) : null;
    const debut = ent ? ent.date : auj();
    if (o.statut === 'en-cours') { o.statut = 'partiel'; o.bilanLe = debut; }
    E.objectifs.push(R.reporter(o, { auj: debut, echeance: ajoutMois(debut, 12), entretien: ent ? ent.id : null }));
  }

  function modaleFormation(id, { sid = null, entretienId = null } = {}) {
    const t = auj();
    const fo = id ? formation(id) : null;
    if (id && !fo) return;
    const ent = entretienId ? entretien(entretienId) : null;
    const v = fo || { salarie: sid || E.salaries.find((s) => R.estPresent(s, t))?.id, intitule: '', nature: 'developpement', dispositif: B.dispositifs[0], origine: ent ? 'entretien' : 'salarie', statut: 'demandee', demandeLe: ent ? ent.date : t, datePrevue: null, dateRealisee: null, commentaire: '' };
    if (!v.salarie) { modaleSalarie(null); return; }
    const corps = `
      <label class="champ">Salarié<select name="salarie" ${fo || ent ? 'disabled' : ''}>${optionsSalaries(v.salarie)}</select></label>
      <label class="champ">Formation<input name="intitule" maxlength="160" required value="${esc(v.intitule === 'Formation' ? '' : v.intitule)}" placeholder="Ex. : Automatismes industriels, niveau 1"></label>
      <div class="rang-champs">
        <label class="champ">Nature<small>Compte pour l'état des lieux des 8 ans</small><select name="nature">${B.natures.map((n) => `<option value="${n.id}" ${n.id === v.nature ? 'selected' : ''} title="${esc(n.desc)}">${esc(n.nom)}</option>`).join('')}</select></label>
        <label class="champ">Dispositif<select name="dispositif">${B.dispositifs.map((d2) => `<option ${d2 === v.dispositif ? 'selected' : ''}>${esc(d2)}</option>`).join('')}</select></label>
      </div>
      <p class="aide" id="aide-nature"></p>
      <div class="rang-champs">
        <label class="champ">Origine<select name="origine">${B.origines.map((x) => `<option value="${x.id}" ${x.id === v.origine ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label>
        <label class="champ">Statut<select name="statut">${B.statutsFormation.map((x) => `<option value="${x.id}" ${x.id === v.statut ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Demandée le<input type="date" name="demandeLe" value="${v.demandeLe}"></label>
        <label class="champ">Prévue le<input type="date" name="datePrevue" value="${v.datePrevue || ''}"></label>
        <label class="champ">Réalisée le<input type="date" name="dateRealisee" value="${v.dateRealisee || ''}"></label>
      </div>
      <label class="champ">Commentaire<input name="commentaire" maxlength="400" value="${esc(v.commentaire)}"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(fo ? 'Demande de formation' : 'Nouvelle demande de formation', corps, fo ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn danger" value="suppr">Supprimer</button><button class="btn" value="annuler">Annuler</button>' : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>', (f, choix) => {
      if (choix === 'suppr') { retenir(); E.formations = E.formations.filter((y) => y.id !== fo.id); sauver(); rendre(); toast('Demande supprimée.', { libelle: 'Annuler', faire: annuler }); return; }
      const intitule = String(f.get('intitule') || '').trim();
      if (!intitule) return 'Indique la formation.';
      const statut = String(f.get('statut'));
      let dateRealisee = String(f.get('dateRealisee') || '') || null;
      if (statut === 'realisee' && !dateRealisee) dateRealisee = t;
      const champs = { intitule, nature: String(f.get('nature')), dispositif: String(f.get('dispositif') || ''), origine: String(f.get('origine')), statut, demandeLe: String(f.get('demandeLe') || '') || t, datePrevue: String(f.get('datePrevue') || '') || null, dateRealisee, commentaire: String(f.get('commentaire') || '') };
      retenir();
      if (fo) Object.assign(fo, R.normaliserFormation({ ...fo, ...champs }, t));
      else E.formations.push(R.normaliserFormation({ id: uid(), salarie: ent ? ent.salarie : String(f.get('salarie')), entretien: ent ? ent.id : null, ...champs }, t));
      sauver(); rendre(); toast(fo ? 'Demande enregistrée.' : 'Demande de formation ajoutée.', { libelle: 'Annuler', faire: annuler });
    });
    const d = modale();
    const maj = () => { const n = nature(d.querySelector('[name=nature]').value); d.querySelector('#aide-nature').textContent = `${n.desc} ${n.nonObligatoire ? 'Compte comme formation non obligatoire à l\'état des lieux.' : 'Ne compte pas comme formation non obligatoire à l\'état des lieux.'}`; };
    d.querySelector('[name=nature]').addEventListener('change', maj);
    maj();
  }

  function modaleRepere(r) {
    const x = B.reperes[r];
    if (!x) return;
    ouvrirModale(esc(x.titre), `<p>${esc(x.texte)}</p><p class="mention source">${esc(x.source)}</p><p class="mention">Outil d'aide : il ne remplace pas un conseil juridique. Ta convention collective et les textes font foi.</p>`, '<button class="btn primaire" value="ok">Fermer</button>');
  }

  // ---------- Actions sur les entretiens ----------
  function realiser(id) {
    const x = entretien(id);
    if (!x) return;
    const t = auj();
    const vide = Object.keys(x.reponses).length === 0 && !x.synthese;
    if (vide && !confirm('Aucune réponse n\'est saisie. Marquer quand même cet entretien comme réalisé ?')) return;
    retenir();
    x.statut = 'realise';
    if (x.date > t) x.date = t;
    sauver(); rendre();
    toast(`Entretien réalisé${x.type !== 'annuel' ? ' : imprime le compte rendu et note la date de remise de la copie' : ''}.`, { libelle: 'Annuler', faire: annuler });
  }

  async function copierQuestionnaire(id) {
    const x = entretien(id);
    if (!x) return;
    const s = salarie(x.salarie);
    const txt = R.questionnaire(x, s, R.themesEntretien(x, s, E, B), { entreprise: E.entreprise, nomType: nomType(x.type) });
    let ok = false;
    try { await navigator.clipboard.writeText(txt); ok = true; } catch {
      const z = document.createElement('textarea');
      z.value = txt; z.setAttribute('readonly', ''); z.style.position = 'fixed'; z.style.opacity = '0';
      document.body.appendChild(z); z.select();
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      z.remove();
    }
    toast(ok ? 'Questionnaire copié : colle-le dans un e-mail ou un message au salarié.' : 'Copie impossible ici : ouvre « Voir le texte » et sélectionne-le.');
  }

  // Saisie dans l'éditeur d'entretien : enregistrée sans redessiner la page.
  function saisieEntretien(el) {
    const x = ouvert && entretien(ouvert);
    if (!x) return;
    if (el.dataset.rep) {
      const v = el.value.slice(0, 4000);
      if (v.trim()) x.reponses[el.dataset.rep] = v; else delete x.reponses[el.dataset.rep];
    } else if (el.dataset.champ === 'progression') {
      x.progression = el.value;
    } else if (el.dataset.champ === 'copieRemiseLe') {
      x.copieRemiseLe = R.estDate(el.value) ? el.value : null;
      x.modifieApresRemise = false;
    } else if (el.dataset.champ) {
      x[el.dataset.champ] = el.value.slice(0, el.dataset.champ === 'preparation' ? 8000 : 4000);
    } else if (el.dataset.objBilan) {
      const o = objectif(el.dataset.objBilan);
      if (o) o.bilan = el.value.slice(0, 600);
    } else return;
    if (x.statut === 'realise' && x.copieRemiseLe && el.dataset.champ !== 'copieRemiseLe') x.modifieApresRemise = true;
    sauver();
  }

  // ---------- Compte rendu imprimable ----------
  function imprimerEntretien(id) {
    const x = entretien(id);
    if (!x) return;
    const s = salarie(x.salarie);
    const themes = R.themesEntretien(x, s, E, B);
    const revus = R.objectifsARevoir(E.objectifs, x.salarie, x);
    const fixes = R.objectifsFixes(E.objectifs, x.id);
    const forms = E.formations.filter((f) => f.salarie === x.salarie && (f.entretien === x.id || (x.type !== 'annuel' && (R.formationEnAttente(f) || f.statut === 'planifiee'))));
    const rep = (q) => (x.reponses[q.id] ? esc(x.reponses[q.id]).replace(/\n/g, '<br>') : '<span class="vide">—</span>');
    const tabObj = (l, avecBilan) => `<table><thead><tr><th>Objectif</th><th>Indicateur · cible</th><th>Échéance</th>${avecBilan ? '<th>Bilan</th>' : '<th>Moyens</th>'}</tr></thead><tbody>${l.map((o) => `<tr><td>${esc(o.intitule)}</td><td>${esc([o.indicateur, o.cible].filter(Boolean).join(' · ') || '—')}</td><td>${o.echeance ? dateCourte(o.echeance) : '—'}</td><td>${avecBilan ? `${esc(nomStatutO(o.statut))}${o.bilan ? ` : ${esc(o.bilan)}` : ''}` : esc(o.moyens || '—')}</td></tr>`).join('')}</tbody></table>`;
    let ctrl = '';
    if (x.type === 'bilan') {
      const c = R.controleBilan(s, E, x.date, x.id);
      ctrl = `<h2>Contrôle des ${E.reglages.bilanAns} dernières années (${dateCourte(c.debut)} au ${dateCourte(c.fin)})</h2><table><tbody>
        <tr><th>Entretiens de parcours professionnel</th><td>${c.epp.length ? c.epp.map(dateCourte).join(', ') : 'aucun noté'}${c.manques.length ? ` · écarts : attendu le ${c.manques.map((m) => dateCourte(m.attendu)).join(', ')}` : ' · sans écart'}</td></tr>
        <tr><th>Formations réalisées</th><td>${c.formations.length ? c.formations.map((f) => `${esc(f.intitule)} (${esc(nature(f.nature).court.toLowerCase())})`).join(' ; ') : 'aucune notée'}</td></tr>
        <tr><th>Certifications</th><td>${c.certifications.length ? c.certifications.map((f) => esc(f.intitule)).join(' ; ') : 'aucune notée'}</td></tr>
        <tr><th>Progression salariale ou professionnelle</th><td>${x.progression === 'oui' ? 'Oui' : x.progression === 'non' ? 'Non' : 'Non renseignée'}</td></tr></tbody></table>`;
    }
    let el = $('#impression');
    if (!el) { el = document.createElement('div'); el.id = 'impression'; document.body.appendChild(el); }
    el.innerHTML = `
      <header><p>${esc(E.entreprise || 'Entretiens annuels et professionnels')} · compte rendu</p><h1>${esc(nomType(x.type))}${x.motif && x.motif !== 'periodique' ? ` · ${esc(nomMotif(x.motif).toLowerCase())}` : ''}</h1>
      <p><b>${esc(s.prenom)}</b>${s.poste ? ` · ${esc(s.poste)}` : ''}${s.service ? ` · ${esc(s.service)}` : ''}${s.manager ? ` · Manager : ${esc(s.manager)}` : ''}</p>
      <p>Entretien ${x.statut === 'realise' ? 'réalisé' : 'prévu'} le ${dateLongue(x.date)}${x.heure ? ` à ${x.heure.replace(':', ' h ')}` : ''} · entré le ${dateLongue(s.entree)}</p></header>
      ${x.type !== 'annuel' ? '<p class="mention">Entretien de parcours professionnel : compétences, parcours et souhaits d\'évolution ; il ne porte pas sur l\'évaluation du travail.</p>' : ''}
      ${ctrl}
      ${themes.map((th) => {
        let bloc = '';
        if (th.auto === 'objectifs' && revus.length) bloc = tabObj(revus, true);
        if (th.auto === 'nouveaux-objectifs' && fixes.length) bloc = tabObj(fixes, false);
        if (th.auto === 'formations' && forms.length) bloc = `<table><thead><tr><th>Formation</th><th>Nature</th><th>Dispositif</th><th>Statut</th></tr></thead><tbody>${forms.map((f) => `<tr><td>${esc(f.intitule)}</td><td>${esc(nature(f.nature).court)}</td><td>${esc(f.dispositif || '—')}</td><td>${esc(nomStatutF(f.statut))}</td></tr>`).join('')}</tbody></table>`;
        if (!bloc && !th.questions.length) return '';
        return `<h2>${esc(th.nom)}</h2>${bloc}${th.questions.length ? `<table class="qr"><tbody>${th.questions.map((q) => `<tr><th>${esc(q.texte)}</th><td>${rep(q)}</td></tr>`).join('')}</tbody></table>` : ''}`;
      }).join('')}
      ${x.synthese ? `<h2>Synthèse</h2><p>${esc(x.synthese).replace(/\n/g, '<br>')}</p>` : ''}
      ${x.type !== 'annuel' ? `<p>Copie remise au salarié le : ${x.copieRemiseLe ? dateLongue(x.copieRemiseLe) : '………………'}</p>` : ''}
      <p class="signatures"><span>Le salarié · date et signature</span><span>Le manager · date et signature</span></p>
      <p class="mention">Document interne et confidentiel : à remettre au salarié et à classer dans le dossier du personnel. Données minimales.</p>`;
    document.body.classList.add('impr-fiche');
    if (modale().open) modale().close();
    setTimeout(() => window.print(), 50);
  }
  window.addEventListener('afterprint', () => { document.body.classList.remove('impr-fiche'); });

  // ---------- RGPD ----------
  function texteSalarie(sid) {
    const d = R.donneesSalarie(E, sid);
    const s = d.salarie;
    const l = [`Données de ${s.prenom} dans le suivi des entretiens${E.entreprise ? ` (${E.entreprise})` : ''}, export du ${dateLongue(auj())}`, ''];
    l.push(`Poste : ${s.poste || '—'} · Service : ${s.service || '—'} · Manager : ${s.manager || '—'}`);
    l.push(`Entrée : ${dateLongue(s.entree)}${s.sortie ? ` · Sortie : ${dateLongue(s.sortie)}` : ''}${s.anneeNaissance ? ` · Année de naissance : ${s.anneeNaissance}` : ''}${s.visiteMiCarriere ? ` · Visite de mi-carrière : ${dateLongue(s.visiteMiCarriere)}` : ''}${s.forfaitJours ? ' · Forfait jours' : ''}`);
    if (s.note) l.push(`Note : ${s.note}`);
    if (s.absences.length) l.push('', 'ABSENCES', ...s.absences.map((b) => `- ${nomAbsence(b.type)}${b.debut ? ` du ${dateCourte(b.debut)}` : ''}${b.retour ? ` · reprise le ${dateCourte(b.retour)}` : ''}`));
    l.push('', 'ENTRETIENS');
    for (const x of d.entretiens.sort((a, b) => a.date.localeCompare(b.date))) {
      l.push(`- ${nomType(x.type)} du ${dateLongue(x.date)} (${x.historique ? 'historique' : x.statut === 'realise' ? 'réalisé' : 'prévu'})`);
      const qs = [...Object.values(B.trames).flat(), ...Object.values(B.complements)].flatMap((t) => t.questions);
      for (const [k, v] of Object.entries(x.reponses)) l.push(`    ${(qs.find((q) => q.id === k) || (E.questionsPerso[x.type] || []).find((q) => q.id === k) || { texte: k === 'note' ? 'Note' : k }).texte} : ${v.replace(/\n/g, ' ')}`);
      if (x.preparation) l.push(`    Préparation : ${x.preparation.replace(/\n/g, ' ')}`);
      if (x.synthese) l.push(`    Synthèse : ${x.synthese.replace(/\n/g, ' ')}`);
    }
    l.push('', 'OBJECTIFS', ...d.objectifs.map((o) => `- ${o.intitule} · ${nomStatutO(o.statut)} · ${o.avancement} %${o.echeance ? ` · échéance ${dateCourte(o.echeance)}` : ''}${o.bilan ? ` · ${o.bilan}` : ''}`));
    l.push('', 'FORMATIONS', ...d.formations.map((f) => `- ${f.intitule} · ${nature(f.nature).nom} · ${nomStatutF(f.statut)} · demandée le ${dateCourte(f.demandeLe)}${f.dateRealisee ? ` · réalisée le ${dateCourte(f.dateRealisee)}` : ''}`));
    return l.join('\n');
  }
  function exporterSalarie(sid, format) {
    const s = salarie(sid);
    if (!s) return;
    const nom = s.prenom.toLowerCase().replace(/[^a-z0-9àâäéèêëîïôöùûüç]+/g, '-').replace(/-+$/, '');
    if (format === 'json') telecharger(JSON.stringify(R.donneesSalarie(E, sid), null, 2), 'application/json', `entretiens-${nom}-${auj()}.json`);
    else telecharger('﻿' + texteSalarie(sid), 'text/plain;charset=utf-8', `entretiens-${nom}-${auj()}.txt`);
  }
  function effacerSalarie(sid) {
    const s = salarie(sid);
    if (!s) return;
    const d = R.donneesSalarie(E, sid);
    if (!confirm(`Effacer ${s.prenom} et tout ce qui le concerne (${pluriel(d.entretiens.length, 'entretien')}, ${pluriel(d.objectifs.length, 'objectif')}, ${pluriel(d.formations.length, 'demande')} de formation) ?`)) return;
    retenir();
    E = R.sansSalarie(E, sid);
    fiche = null;
    sauver(); changerVue('salaries');
    toast(`${s.prenom} effacé.`, { libelle: 'Annuler', faire: annuler });
  }
  function effacerSortis() {
    const l = R.aEffacer(E, auj());
    if (!l.length || !confirm(`Effacer ${l.map((s) => s.prenom).join(', ')} et tout ce qui les concerne ?`)) return;
    retenir();
    for (const s of l) E = R.sansSalarie(E, s.id);
    sauver(); rendre();
    toast(`${pluriel(l.length, 'fiche effacée', 'fiches effacées')}.`, { libelle: 'Annuler', faire: annuler });
  }

  // ---------- Réglages ----------
  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const r = E.reglages;
    const nbQ = Object.values(B.trames).flat().concat(Object.values(B.complements)).reduce((s, t) => s + t.questions.length, 0);
    const corps = `
      <label class="champ">Entreprise ou service<small>Facultatif, affiché sur les comptes rendus.</small><input name="entreprise" maxlength="60" value="${esc(E.entreprise)}"></label>
      <label class="case"><input type="checkbox" name="effectif50" ${E.effectif50 ? 'checked' : ''}> Entreprise d'au moins 50 salariés (contrôle de l'abondement CPF de 3 000 €)</label>
      <div class="groupe"><h3>Périodicités</h3><p class="aide">Valeurs légales par défaut (relevé du 14/11/2026, service-public.gouv.fr F32040). Ta convention ou un accord collectif peut prévoir plus court pour l'entretien de parcours.</p>
        <label class="case"><input type="checkbox" name="annuelActif" ${r.annuelActif ? 'checked' : ''}> Suivre l'entretien annuel</label>
        <div class="rang-champs">
          <label class="champ">Annuel tous les (mois)<input type="number" name="annuelMois" min="1" max="36" value="${r.annuelMois}"></label>
          <label class="champ">Premier entretien de parcours après l'entrée (mois)<input type="number" name="premierEppMois" min="1" max="24" value="${r.premierEppMois}"></label>
        </div>
        <div class="rang-champs">
          <label class="champ">Entretien de parcours tous les (mois)<small>48 au plus selon la loi</small><input type="number" name="eppMois" min="6" max="72" value="${r.eppMois}"></label>
          <label class="champ">État des lieux tous les (ans)<input type="number" name="bilanAns" min="2" max="12" value="${r.bilanAns}"></label>
        </div>
        <div class="rang-champs">
          <label class="champ">« À venir » : échéance dans les (jours)<input type="number" name="fenetreJours" min="7" max="180" value="${r.fenetreJours}"></label>
          <label class="champ">Tolérance du contrôle des 8 ans (mois)<input type="number" name="toleranceMois" min="0" max="12" value="${r.toleranceMois}"></label>
        </div>
        <div class="rang"><button class="btn petit" type="button" data-action="defauts">Rétablir les valeurs légales</button></div></div>
      <label class="champ">Proposer d'effacer un salarié sorti après (mois)<small>0 à 120. Garde les comptes rendus signés dans le dossier du personnel selon tes règles de conservation.</small><input type="number" name="effacementMois" min="0" max="120" value="${r.effacementMois}"></label>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Exporter</h3><p class="aide">Aucun envoi automatique ni lien vers un logiciel RH : exporte en tableur, ou imprime un compte rendu depuis l'entretien (impression ou PDF).</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv-echeances">Échéances en CSV</button><button class="btn petit" type="button" data-action="csv-objectifs">Objectifs en CSV</button><button class="btn petit" type="button" data-action="csv-formations">Formations en CSV</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>Données personnelles</h3><p class="mention">Tu es responsable des données que tu saisis sur tes salariés. Cet outil est conçu pour le minimum : prénom et initiale, poste, service, manager, dates. N'y mets ni donnée de santé (seulement la date d'une visite), ni salaire, ni motif personnel. Chaque fiche s'exporte (droit d'accès) et s'efface ; informe les salariés selon tes règles internes. ${esc(B.reperes.rgpd.source)}</p></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">Trames : ${nbQ} questions originales (base intégrée version ${B.version}, rédigée pour QME). Repères réglementaires datés : onglet Entretiens, Trames. ${esc(B.reperes.epp.source)}</p></div>`;
    ouvrirModale('Réglages', corps, PIED_STD, (f) => {
      const n = (k) => Number(f.get(k));
      const nr = R.normaliserReglages({ annuelActif: f.get('annuelActif') === 'on', annuelMois: n('annuelMois'), premierEppMois: n('premierEppMois'), eppMois: n('eppMois'), bilanAns: n('bilanAns'), fenetreJours: n('fenetreJours'), effacementMois: n('effacementMois'), toleranceMois: n('toleranceMois') });
      if (n('eppMois') > 48 && !confirm('Au-delà de 48 mois, la périodicité dépasse le maximum légal relevé. Garder cette valeur ?')) return '';
      E.entreprise = String(f.get('entreprise') || '').trim();
      E.effectif50 = f.get('effectif50') === 'on';
      E.reglages = nr;
      sauver(); rendre(); toast('Réglages enregistrés.');
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.salaries)) throw new Error();
        if (!confirm(`Remplacer ton suivi actuel par cette copie (${pluriel(d.salaries.length, 'salarié')}) ?`)) return;
        E = normaliser(d); delete E.majLe; fiche = null; ouvert = null;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide du suivi.'); }
    });
  }

  function telecharger(contenu, type, nom) {
    const blob = new Blob([contenu], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nom;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `entretiens-${auj()}.json`);
  const CSV = 'text/csv;charset=utf-8';
  function csvEcheances() {
    const t = auj();
    telecharger(R.versCsv(['Salarié', 'Poste', 'Échéance', 'Motif', 'Date', 'Statut', 'Entretien prévu le'], R.echeances(E, t).map((e) => [prenom(e.salarie), salarie(e.salarie).poste, nomType(e.type), e.motif ? nomMotif(e.motif) : '', e.date, ETIQ_ECH[e.statut][1], e.datePrevue || ''])), CSV, `entretiens-echeances-${t}.csv`);
  }
  function csvObjectifs() {
    telecharger(R.versCsv(['Salarié', 'Objectif', 'Indicateur', 'Cible', 'Moyens', 'Pourquoi', 'Créé le', 'Échéance', 'Avancement (%)', 'Statut', 'Bilan', 'SMART à préciser', 'Reconduit de'], E.objectifs.filter((o) => salarie(o.salarie)).map((o) => [prenom(o.salarie), o.intitule, o.indicateur, o.cible, o.moyens, o.lien, o.creeLe, o.echeance || '', o.avancement, nomStatutO(o.statut), o.bilan, R.controleSmart(o).manque.join(''), o.reportDe ? (objectif(o.reportDe)?.creeLe.slice(0, 4) || 'oui') : ''])), CSV, `entretiens-objectifs-${auj()}.csv`);
  }
  function csvFormations() {
    telecharger(R.versCsv(['Salarié', 'Formation', 'Nature', 'Non obligatoire', 'Dispositif', 'Origine', 'Statut', 'Demandée le', 'Prévue le', 'Réalisée le', 'Commentaire'], E.formations.filter((f) => salarie(f.salarie)).map((f) => [prenom(f.salarie), f.intitule, nature(f.nature).nom, nature(f.nature).nonObligatoire ? 'oui' : 'non', f.dispositif, nomOrigine(f.origine), nomStatutF(f.statut), f.demandeLe, f.datePrevue || '', f.dateRealisee || '', f.commentaire])), CSV, `entretiens-formations-${auj()}.csv`);
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
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); fiche = null; ouvert = null; cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'accueil-suivant': accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'filtre-ech': changerVue('salaries'); break;
      case 'vue-entretiens': filtre.entretiens = el.dataset.filtre; changerVue('entretiens'); break;
      case 'retour-entretiens': changerVue('entretiens'); break;
      case 'fiche': if (modale().open) modale().close(); changerVue('salaries', { fiche: id }); break;
      case 'ouvrir-entretien': changerVue('entretiens', { ouvert: id }); break;
      case 'reglages': modaleReglages(); break;
      case 'defauts': { const d = modale(); for (const [k, v] of Object.entries(R.DEFAUTS)) { const c = d.querySelector(`[name=${k}]`); if (!c) continue; if (c.type === 'checkbox') c.checked = v; else c.value = v; } toast('Valeurs légales remises : enregistre pour les appliquer.'); break; }
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv-echeances': csvEcheances(); break;
      case 'csv-objectifs': csvObjectifs(); break;
      case 'csv-formations': csvFormations(); break;
      case 'fermer': modale().close(); break;
      case 'nouveau-salarie': modaleSalarie(null); break;
      case 'modifier-salarie': modaleSalarie(id); break;
      case 'nouvelle-absence': modaleAbsence(id, null); break;
      case 'absence': modaleAbsence(id, el.dataset.absence); break;
      case 'planifier': modalePlanifier({ sid: id || null, type: el.dataset.type || null, motif: el.dataset.motif || null, historique: el.dataset.historique === '1' }); break;
      case 'modifier-entretien': modaleModifierEntretien(id); break;
      case 'supprimer-entretien': { const x = entretien(id); if (x && confirm(`Supprimer cet entretien (${nomType(x.type).toLowerCase()} du ${dateCourte(x.date)}) et ses réponses ? Les objectifs et formations notés restent.`)) { retenir(); E.entretiens = E.entretiens.filter((y) => y.id !== id); sauver(); changerVue('entretiens'); toast('Entretien supprimé.', { libelle: 'Annuler', faire: annuler }); } break; }
      case 'realiser': realiser(id); break;
      case 'rouvrir': { const x = entretien(id); if (x) { retenir(); x.statut = 'prevu'; sauver(); rendre(); toast('Entretien repassé en prévu.', { libelle: 'Annuler', faire: annuler }); } break; }
      case 'imprimer-entretien': imprimerEntretien(id); break;
      case 'copier-questionnaire': copierQuestionnaire(id); break;
      case 'nouvel-objectif': modaleObjectif(null, { sid: id || null, entretienId: el.dataset.entretien || null }); break;
      case 'objectif': modaleObjectif(id); break;
      case 'reporter-objectif': { const o = objectif(id); if (o) { retenir(); reconduire(o, el.dataset.entretien); sauver(); rendre(); toast('Objectif reconduit : il apparaît dans les objectifs fixés.', { libelle: 'Annuler', faire: annuler }); } break; }
      case 'nouvelle-formation': modaleFormation(null, { sid: id || null, entretienId: el.dataset.entretien || null }); break;
      case 'formation': modaleFormation(id); break;
      case 'repere': modaleRepere(el.dataset.r); break;
      case 'filtre': filtre[el.dataset.cle] = el.dataset.filtre; rendre(); break;
      case 'masquer-question': { const q = el.dataset.q; retenir(); E.questionsMasquees = E.questionsMasquees.includes(q) ? E.questionsMasquees.filter((x) => x !== q) : [...E.questionsMasquees, q]; sauver(); rendre(); break; }
      case 'retirer-question': { retenir(); const ty = filtre.trame; E.questionsPerso[ty] = E.questionsPerso[ty].filter((x) => x.id !== el.dataset.q); sauver(); rendre(); toast('Question retirée.', { libelle: 'Annuler', faire: annuler }); break; }
      case 'export-salarie': exporterSalarie(id, el.dataset.format); break;
      case 'effacer-salarie': effacerSalarie(id); break;
      case 'effacer-sortis': effacerSortis(); break;
      default: break;
    }
  });

  document.addEventListener('input', (e) => { if (e.target.closest('#vue') && (e.target.dataset.rep || e.target.dataset.champ || e.target.dataset.objBilan)) saisieEntretien(e.target); });
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.objStatut) {
      const o = objectif(el.dataset.objStatut);
      const x = ouvert && entretien(ouvert);
      if (!o) return;
      retenir();
      o.statut = el.value;
      o.bilanLe = o.statut === 'en-cours' ? null : (x ? x.date : auj());
      if (o.statut === 'atteint') o.avancement = 100;
      sauver(); const y = window.scrollY; rendre(); window.scrollTo({ top: y });
    } else if (el.dataset.filtreSelect) {
      filtre[el.dataset.filtreSelect] = el.value; rendre();
    } else if (el.closest('#vue') && (el.dataset.champ === 'progression' || el.dataset.champ === 'copieRemiseLe')) {
      saisieEntretien(el);
    }
  });
  document.addEventListener('submit', (e) => {
    const f = e.target.closest('.ajout-question');
    if (!f) return;
    e.preventDefault();
    const texte = String(new FormData(f).get('question') || '').trim().slice(0, 300);
    if (!texte) return;
    retenir();
    E.questionsPerso[f.dataset.type] = [...(E.questionsPerso[f.dataset.type] || []), { id: `p-${uid()}`, texte }];
    sauver(); rendre();
    toast('Question ajoutée à la trame.', { libelle: 'Annuler', faire: annuler });
  });

  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });
  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
    if (!modale().open && !saisieEnCours()) rendre(); // la date du jour a pu changer
  });
  window.addEventListener('beforeunload', (e) => { if (etatSync === 'attente' || etatSync === 'envoi') { envoyer(); e.preventDefault(); } });

  // ---------- Démarrage ----------
  async function init() {
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
    const code = stock.lire(CLE_CODE);
    if (new URLSearchParams(location.search).has('demo') && code !== CODE_DEMO && !code) { history.replaceState(null, '', location.pathname); return ouvrirDemo(false); }
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
  window.__entretiens = { etat: () => E, regles: R };
  init();
})();
