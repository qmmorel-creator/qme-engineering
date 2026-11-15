// Gestion de classe QME : classes et groupes, élèves (prénom et initiale ou pseudonyme), évaluations sur
// barème libre ramenées sur 20, coefficients, notes spéciales, moyennes et statistiques, compétences sur
// l'échelle à 4 échelons, banque d'appréciations, bulletins imprimables, export CSV.
// Données synchronisées par clé de licence ou code d'accès. Aucune connexion à une application externe.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.CSE;
  const API = '/api/templates';
  const PRODUIT = 'CSE';
  const CLE_CODE = 'qme-cse-code';
  const CLE_CACHE = 'qme-cse-cache';
  const CLE_DEMO = 'qme-cse-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-cse-ecran-accueil';

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
  const { ajout, versDate, ecart } = R;
  const auj = () => R.iso(new Date());
  const fmt = (s, o = { day: 'numeric', month: 'short', year: 'numeric' }) => versDate(s).toLocaleDateString('fr-FR', o);
  const dateLongue = (s) => fmt(s, { day: 'numeric', month: 'long', year: 'numeric' });
  const dateCourte = (s) => fmt(s, { day: 'numeric', month: 'short' });
  const dec = () => E.reglages.decimales;
  const moy = (n) => R.fmtNote(n, dec());
  const nb = (n) => Number(n).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
  const quand = (s) => { const n = ecart(s, auj()); return n === 0 ? 'aujourd\'hui' : n === 1 ? 'hier' : n === -1 ? 'demain' : n > 0 ? `il y a ${pluriel(n, 'jour')}` : `dans ${pluriel(-n, 'jour')}`; };
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'bord';
  const filtre = { classe: '', periode: '' };
  let annulation = null;

  const etatVide = () => ({ ...R.etatVide(B), tutorielVu: false });
  const normaliser = (d) => R.normaliser(d, B);
  const annee = () => E.annees.find((a) => a.id === E.anneeId) || null;
  const classesAnnee = () => E.classes.filter((c) => c.anneeId === E.anneeId); // dans l'ordre de création
  const classe = (id) => E.classes.find((c) => c.id === id);
  const eleve = (id) => E.eleves.find((e) => e.id === id);
  const evaluation = (id) => E.evaluations.find((e) => e.id === id);
  const competence = (id) => E.competences.find((c) => c.id === id);
  const nomClasse = (c) => (c ? `${c.nom}${c.matiere ? ` · ${c.matiere}` : ''}` : 'Classe supprimée');
  // Classe choisie (si elle existe dans l'année), sinon la première.
  const classeChoisie = () => { const l = classesAnnee(); return (l.find((c) => c.id === filtre.classe) || l[0])?.id || ''; };
  const periodeCourante = () => { const a = annee(); return a ? R.periodeDe(a, auj()) : null; };
  // Période choisie : un identifiant de période, ou « annee » (vues Notes et Compétences).
  const periodeChoisie = (annuelle = true) => {
    const ps = R.bornes(annee());
    if (filtre.periode === 'annee' && annuelle) return 'annee';
    return (ps.find((p) => p.id === filtre.periode) || periodeCourante() || ps[0])?.id || '';
  };
  const periode = (id) => R.bornes(annee()).find((p) => p.id === id);
  const evalsVue = (cid, pid) => (pid === 'annee' ? R.evalsDe(E, cid) : R.evalsPeriode(E, cid, annee(), pid));

  function retenir() { annulation = structuredClone(E); }
  function annuler() {
    if (!annulation) return;
    E = annulation; annulation = null;
    sauver(); rendre();
    if (modale().open) modale().close();
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
        const vu = E.tutorielVu;
        E = normaliser(corps.donnees);
        if (vu) E.tutorielVu = true;
        session.base = corps.donnees.majLe;
        cache(false);
        rendre();
        toast('Un autre appareil a modifié tes classes entre-temps : sa version est affichée. Refais ta dernière saisie si elle manque.');
      } else if (statut === 401) {
        deconnecter('Ce code d\'accès n\'est plus valide.');
        return;
      } else if (statut === 413) {
        toast('Trop de données pour un seul compte : exporte puis efface une année terminée (onglet Classes).');
        throw new Error('413');
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
  // Code interne (CSE-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
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
    session.code = null; session.jeton = null; session.demo = false; session.base = null; E = null;
    document.body.classList.remove('app');
    ecranConnexion(message);
  }

  // ---------- Données de démonstration ----------
  // Enseignant fictif de mathématiques : deux classes de collège et un groupe de lycée, élèves aux prénoms
  // fictifs suivis d'une initiale. Dates relatives à aujourd'hui (fin du 1er trimestre dans 16 jours) et
  // tous les états : notes à saisir (récentes et anciennes), évaluation à venir, ABS, NN, dispensé, bonus
  // retenu ou non, barèmes sur 10, 20 et 40, évaluation de compétences sans note, appréciations en partie
  // rédigées. Notes déterministes (même démo à chaque ouverture du jour).
  const PRENOMS = ['Adam', 'Alice', 'Amir', 'Anna', 'Arthur', 'Basile', 'Camille', 'Chloé', 'Clément', 'Elsa', 'Émile', 'Gabin', 'Hugo', 'Inès', 'Jade', 'Jules', 'Léa', 'Léon', 'Lina', 'Louise', 'Lucas', 'Maël', 'Manon', 'Mila', 'Nathan', 'Nina', 'Noé', 'Paul', 'Rose', 'Sacha', 'Sami', 'Théo', 'Yanis', 'Zoé'];
  function donneesDemo() {
    const e = etatVide();
    const t = auj();
    const j = (n) => ajout(t, n);
    const sc = R.anneeScolaire(t);
    const debut = ecart(sc.debut, t) >= 60 ? sc.debut : j(-75);
    const p1 = j(16), p2 = ajout(p1, 105), p3 = ajout(p2, 105);
    const an = R.normaliserAnnee({ id: uid(), nom: sc.nom, debut, periodes: [{ nom: 'Trimestre 1', fin: p1 }, { nom: 'Trimestre 2', fin: p2 }, { nom: 'Trimestre 3', fin: p3 }] });
    e.annees.push(an); e.anneeId = an.id;
    e.reglages.rgpdLu = null;
    const comp = (code) => e.competences.find((c) => c.code === code)?.id;
    const vari = (k, amp) => Math.sin(k * 2.17 + 0.5) * amp;
    const lettres = 'ABCDEFGHJKLMNOPRSTV';
    let k0 = 0;
    const nouvelleClasse = (nom, matiere, type, effectif, decal) => {
      const c = R.normaliserClasse({ id: uid(), anneeId: an.id, nom, matiere, type });
      e.classes.push(c);
      const els = [];
      for (let i = 0; i < effectif; i++) {
        const p = PRENOMS[(i * 7 + decal) % PRENOMS.length];
        const el = R.normaliserEleve({ id: uid(), classeId: c.id, nom: `${p} ${lettres[(i * 5 + decal) % lettres.length]}.` });
        el.niveau = 6.5 + ((i * 37 + decal * 11) % 23) * 0.5; // aptitude fictive entre 6,5 et 17,5
        e.eleves.push(el); els.push(el);
      }
      return { c, els };
    };
    // Évaluation : notes calculées pour chaque élève ; exceptions forcées par index.
    const evalue = (cl, x, { manquantes = [], speciales = {}, niveaux = null } = {}) => {
      const ev = { id: uid(), classeId: cl.c.id, coef: 1, bareme: 20, notes: {}, niveaux: {}, competences: [], ...x };
      cl.els.forEach((el, i) => {
        k0++;
        if (ev.date > t || manquantes.includes(i)) return;
        if (speciales[i]) { ev.notes[el.id] = speciales[i]; return; }
        if (ev.bareme > 0) {
          const s = Math.min(20, Math.max(1, el.niveau + vari(k0, 3.2) + (x.facile || 0)));
          ev.notes[el.id] = Math.round((s / 20) * ev.bareme * 2) / 2;
        }
        if (ev.competences.length && (niveaux === null || niveaux.includes(i))) {
          ev.niveaux[el.id] = {};
          ev.competences.forEach((cid, m) => { ev.niveaux[el.id][cid] = Math.min(4, Math.max(1, Math.round((el.niveau - 2) / 3.8 + vari(k0 + m * 3, 0.6)))); });
        }
      });
      delete ev.facile;
      e.evaluations.push(R.normaliserEvaluation(ev));
    };

    const c4 = nouvelleClasse('4e B', 'Mathématiques', 'classe', 24, 0);
    evalue(c4, { titre: 'Nombres relatifs', date: j(-62), competences: [comp('D1.3')] }, { speciales: { 4: 'ABS' } });
    evalue(c4, { titre: 'Calcul mental', date: j(-48), bareme: 10, coef: 0.5, facile: 1 }, { speciales: { 9: 'NN' } });
    evalue(c4, { titre: 'Défi : énigmes logiques', date: j(-41), bareme: 10, bonus: true, facile: 2 });
    evalue(c4, { titre: 'Fractions', date: j(-34), coef: 2, competences: [comp('D1.3'), comp('D2')] }, { speciales: { 4: 'ABS', 15: 'DISP' } });
    evalue(c4, { titre: 'Puissances', date: j(-9), bareme: 40, coef: 2, competences: [comp('D1.3'), comp('D4')] }, { manquantes: [2, 11, 19] });
    evalue(c4, { titre: 'Exposé : un problème de la vie courante', date: j(-2), bareme: 0, competences: [comp('D1.1'), comp('D2'), comp('D3')] }, { niveaux: [0, 1, 3, 5, 6, 8, 10, 12, 13, 14, 16, 18, 20, 22] });
    evalue(c4, { titre: 'Théorème de Pythagore', date: j(6), coef: 2, competences: [comp('D1.3')] });

    const c3 = nouvelleClasse('3e A', 'Mathématiques', 'classe', 22, 3);
    evalue(c3, { titre: 'Arithmétique', date: j(-57), competences: [comp('D1.3')] });
    evalue(c3, { titre: 'Calcul littéral', date: j(-40), coef: 2 }, { speciales: { 6: 'ABS', 7: 'ABS' } });
    evalue(c3, { titre: 'Brevet blanc : partie calcul', date: j(-24), bareme: 40, coef: 2, competences: [comp('D1.3'), comp('D4')] }, { manquantes: [5, 17] });
    evalue(c3, { titre: 'Calcul mental', date: j(-12), bareme: 10, coef: 0.5, facile: 1 });
    evalue(c3, { titre: 'Fonctions', date: j(3), coef: 2 });

    const c2 = nouvelleClasse('2nde · groupe 2', 'Mathématiques', 'groupe', 12, 5);
    evalue(c2, { titre: 'Ensembles de nombres', date: j(-45), coef: 1 });
    evalue(c2, { titre: 'Vecteurs', date: j(-20), coef: 2 }, { speciales: { 3: 'ABS' } });
    evalue(c2, { titre: 'Interrogation : équations', date: j(-6), bareme: 10, coef: 0.5 });

    // Appréciations du 1er trimestre déjà rédigées pour une partie de la 4e B (banque de phrases).
    const pc = R.periodeDe(an, t);
    const mp = R.moyennesPeriode(e, c4.c.id, an, pc.id);
    c4.els.slice(0, 15).forEach((el, i) => {
      const n = R.niveauSuggere(mp.par[el.id]) || 3;
      const ph = (axe) => { const l = e.banque.filter((b) => b.axe === axe && b.niveau === n); return l.length ? R.composer(l[i % l.length].texte, el) : ''; };
      const tx = [ph('resultats'), ph('travail'), ph('conseil')].filter(Boolean).join(' ');
      Object.assign(e, R.ecrireAppreciation(e, el.id, pc.id, tx));
    });
    e.eleves.forEach((el) => { delete el.niveau; });
    return e;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Gestion de classe · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="20" y="20" width="120" height="120" fill="#1D4E89"/>
          <circle cx="220" cy="80" r="60" fill="#F5B400"/>
          <rect x="20" y="160" width="120" height="120" fill="none" stroke="#141414" stroke-width="4" stroke-dasharray="10 8"/>
          <path d="M160 280 L160 160 A120 120 0 0 1 280 280 Z" fill="#D9302A"/>
          <rect x="320" y="150" width="210" height="130" fill="#141414"/>
          <rect x="338" y="168" width="174" height="94" fill="#F0EDE6"/>
          <rect x="356" y="186" width="70" height="12" fill="#1D4E89"/>
          <rect x="356" y="212" width="120" height="12" fill="#D9302A"/>
          <rect x="356" y="238" width="96" height="12" fill="#F5B400"/>
          <circle cx="470" cy="80" r="44" fill="none" stroke="#141414" stroke-width="4"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Gestion de classe</p>
          <h1>Tes classes, de la note au bulletin.</h1>
          <p>Évaluations sur tous les barèmes, moyennes pondérées, compétences sur quatre niveaux, appréciations composées en quelques clics et bulletins prêts pour le conseil de classe.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ta gestion de classe</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Tes classes sont enregistrées en ligne et te suivent sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mes classes</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore d'accès ? <a href="/catalogue/gestion-classe/">Voir la gestion de classe</a>. La démo, avec des élèves fictifs, reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mes classes'; champ.focus();
      }
    });
  }

  // ---------- Avertissement données d'élèves ----------
  const TEXTE_RGPD = `<p><b>Outil personnel de préparation.</b> Tes classes sont hébergées en ligne par QME, liées à ta clé. Avant d'y saisir des données réelles d'élèves, <b>vérifie avec ton établissement</b> (et, si besoin, le délégué à la protection des données de ton académie) que cet usage est possible. Cet outil ne remplace pas le logiciel de vie scolaire officiel de ton établissement.</p>
    <p>Il est conçu pour en savoir le moins possible : pour chaque élève, seulement un <b>prénom et l'initiale du nom, ou un pseudonyme</b> ; aucune date de naissance, adresse, photo, coordonnée, information de santé, de handicap ou de famille. N'en écris pas non plus dans les remarques ni dans les appréciations. En fin d'année, efface les élèves et les notes (onglet Classes) après avoir gardé l'export.</p>`;

  // ---------- Rendu : premier lancement ----------
  const accueilVide = () => ({ etape: 1, lu: false, decoupage: 'trimestres', classe: '', matiere: '', type: 'classe', eleves: '' });
  let accueil = accueilVide();
  const optionsMatieres = () => `<datalist id="matieres">${B.matieres.map((m) => `<option value="${esc(m)}">`).join('')}</datalist>`;

  function ecranAccueil(erreur = '') {
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    const an = R.anneeScolaire(auj());
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>Tes classes, de la note au bulletin.</h1>
        <p class="intro">Tu crées tes classes et tes groupes, tu saisis les notes au clavier ou sur ton téléphone : les moyennes, les statistiques, le bilan des compétences et les bulletins se calculent tout seuls.</p>
        <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
        <section class="rgpd" aria-labelledby="rgpd-titre"><h2 id="rgpd-titre">Avant de commencer : données d'élèves</h2>${TEXTE_RGPD}
          <label class="case"><input type="checkbox" id="a-lu" ${a.lu ? 'checked' : ''}> J'ai compris : je vérifie avec mon établissement avant de saisir des données réelles.</label></section>
        <p class="erreur" role="alert">${esc(erreur)}</p>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      corps = `
        <p class="surtitre">Étape 2</p>
        <h1>Ton année et ta première classe</h1>
        <p class="intro">Les autres classes et groupes s'ajoutent ensuite dans l'onglet Classes. Les dates de fin de période sont des propositions : ajuste-les à celles de ton établissement.</p>
        <div class="form-accueil">
          <fieldset><legend>Année ${esc(an.nom)} découpée en</legend>
            <div class="choix-statut deux">${B.decoupages.map((d) => `<label><input type="radio" name="a-decoupage" value="${d.code}" ${a.decoupage === d.code ? 'checked' : ''}><span>${esc(d.nom)}</span></label>`).join('')}</div></fieldset>
          <div class="rang-champs">
            <label class="champ">Classe ou groupe<small>Ex. : 4e B, 2nde groupe 2.</small><input id="a-classe" value="${esc(a.classe)}" maxlength="40" placeholder="4e B"></label>
            <label class="champ">Matière<small>Facultatif.</small><input id="a-matiere" list="matieres" value="${esc(a.matiere)}" maxlength="40" placeholder="Mathématiques"></label>
          </div>
          ${optionsMatieres()}
          <label class="champ">Élèves<small>Facultatif : un par ligne, <b>prénom et initiale du nom, ou pseudonyme</b>. Tu peux coller une liste.</small><textarea id="a-eleves" rows="6" placeholder="Léa M.&#10;Hugo T.">${esc(a.eleves)}</textarea></label>
          <p class="erreur" role="alert">${esc(erreur)}</p>
        </div>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Créer mes classes</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    const lier = (sel, cle) => $(sel)?.addEventListener('input', (e) => { accueil[cle] = e.target.value; });
    lier('#a-classe', 'classe'); lier('#a-matiere', 'matiere'); lier('#a-eleves', 'eleves');
    $('#a-lu')?.addEventListener('change', (e) => { accueil.lu = e.target.checked; });
    document.querySelectorAll('[name=a-decoupage]').forEach((el) => el.addEventListener('change', () => { accueil.decoupage = el.value; }));
  }

  function terminerAccueil() {
    const a = accueil;
    if (!a.classe.trim()) return ecranAccueil('Indique le nom de ta première classe ou de ton groupe.');
    const sc = R.anneeScolaire(auj());
    E = etatVide();
    const an = R.normaliserAnnee({ id: uid(), nom: sc.nom, debut: sc.debut, periodes: R.periodesParDefaut(B, a.decoupage, sc.debut) });
    E.annees.push(an); E.anneeId = an.id;
    E.reglages.rgpdLu = auj();
    const c = R.normaliserClasse({ id: uid(), anneeId: an.id, nom: a.classe, matiere: a.matiere, type: a.type });
    E.classes.push(c);
    for (const nom of R.lireListe(a.eleves)) E.eleves.push(R.normaliserEleve({ id: uid(), classeId: c.id, nom }));
    filtre.classe = c.id;
    accueil = accueilVide();
    vue = 'notes';
    sauver();
    demarrer();
    toast('Tes classes sont prêtes. Vérifie les dates des périodes dans l\'onglet Classes.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    aide: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.3 9.4a2.8 2.8 0 1 1 3.9 2.6c-.8.4-1.2.9-1.2 1.7v.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17.4" r="1.4" fill="currentColor"/></svg>',
    bord: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    notes: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="13" width="4" height="8" fill="currentColor"/><rect x="10" y="7" width="4" height="14" fill="none" stroke="currentColor" stroke-width="2"/><rect x="17" y="3" width="4" height="18" fill="currentColor"/></svg>',
    competences: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    bulletins: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21 2 4h20Z" fill="currentColor"/></svg>',
    classes: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21V5a16 16 0 0 1 16 16Z" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['bord', 'Tableau de bord'], ['notes', 'Notes'], ['competences', 'Compétences'], ['bulletins', 'Bulletins'], ['classes', 'Classes']];
  const AVERTISSEMENT = '<p class="mention avertissement">Outil personnel de préparation : il ne remplace pas le logiciel de vie scolaire de ton établissement. Élèves en prénom et initiale ou pseudonyme seulement ; aucune donnée sensible dans les remarques ni les appréciations. Données hébergées en ligne : vérifie avec ton établissement avant de saisir des données réelles. Moyennes calculées selon les règles affichées (barème ramené sur 20, coefficients, notes spéciales non comptées).</p>';
  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="0" width="56" height="56" fill="#1D4E89"/><circle cx="62" cy="62" r="34" fill="#F5B400"/><path d="M0 96 0 56 A40 40 0 0 1 40 96Z" fill="#D9302A"/></svg>';
  const videEtat = (titre, texte, actions = '') => `<div class="vide-etat">${FORME_VIDE}<div><h3>${titre}</h3><p>${texte}</p>${actions ? `<div class="actions">${actions}</div>` : ''}</div></div>`;
  const pastilleNiveau = (n, titre = '') => (n ? `<span class="niv n${n}" title="${esc(titre || B.niveaux[n - 1].nom)}">${n}</span>` : '<span class="niv vide" title="Non évaluée">–</span>');
  const SPECIAL_NOM = Object.fromEntries(B.speciales.map((s) => [s.code, s.nom]));
  const celluleNote = (v) => (R.estSpeciale(v) ? `<span class="speciale" title="${esc(SPECIAL_NOM[v])}">${v}</span>` : R.estNote(v) ? nb(v) : '<span class="manque">·</span>');

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/gestion-classe/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Élèves fictifs, gardés sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Gestion de<br>classe</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}${id === 'bord' ? '<span class="long">Tableau de bord</span><span class="court">Accueil</span>' : `<span>${nom}</span>`}</button>`).join('')}</nav>
        <span class="sync" data-etat="ok" role="status"><i></i><b>Enregistré</b></span>
        <button class="btn-icone" data-action="tutoriel" aria-label="Comment ça marche" title="Comment ça marche">${ICONES.aide}</button>
        <button class="btn-icone" data-action="reglages" aria-label="Réglages et sauvegarde" title="Réglages">${ICONES.reglages}</button>
      </div></header>
      <main class="vue" id="vue" tabindex="-1"></main>`;
    majSync(session.demo ? 'demo' : (stock.lire(CLE_CACHE)?.nonEnvoye ? 'attente' : 'ok'));
    rendre();
    premiersPas();
  }

  function rendre() {
    if (!E || !$('#vue')) return;
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    document.title = `${Object.fromEntries(ONGLETS)[vue]} · Gestion de classe`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { bord: vueBord, notes: vueNotes, competences: vueCompetences, bulletins: vueBulletins, classes: vueClasses }[vue]();
    brancherInfobulles();
    $('#filtre-classe')?.addEventListener('change', (e) => { filtre.classe = e.target.value; rendre(); });
    $('#filtre-periode')?.addEventListener('change', (e) => { filtre.periode = e.target.value; rendre(); });
    $('#filtre-annee')?.addEventListener('change', (e) => { if (e.target.value === '+') { e.target.value = E.anneeId; modaleAnnee(null); return; } E.anneeId = e.target.value; filtre.classe = ''; filtre.periode = ''; sauver(); rendre(); });
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  // Sélecteurs communs : classe, période (avec « Toute l'année » si demandé), année.
  function choixClasse() {
    const l = classesAnnee();
    if (!l.length) return '';
    const cid = classeChoisie();
    return `<label class="champ choix-classe"><span class="sr-only">Classe</span><select id="filtre-classe">${l.map((c) => `<option value="${c.id}" ${c.id === cid ? 'selected' : ''}>${esc(nomClasse(c))}</option>`).join('')}</select></label>`;
  }
  function choixPeriode(annuelle = true) {
    const ps = R.bornes(annee());
    if (!ps.length) return '';
    const pid = periodeChoisie(annuelle);
    return `<label class="champ choix-periode"><span class="sr-only">Période</span><select id="filtre-periode">${ps.map((p) => `<option value="${p.id}" ${p.id === pid ? 'selected' : ''}>${esc(p.nom)}</option>`).join('')}${annuelle ? `<option value="annee" ${pid === 'annee' ? 'selected' : ''}>Toute l'année</option>` : ''}</select></label>`;
  }
  function choixAnnee() {
    const l = [...E.annees].sort((a, b) => b.debut.localeCompare(a.debut));
    return `<label class="champ choix-annee"><span class="sr-only">Année scolaire</span><select id="filtre-annee">${l.map((a) => `<option value="${a.id}" ${a.id === E.anneeId ? 'selected' : ''}>Année ${esc(a.nom)}</option>`).join('')}<option value="+">Nouvelle année…</option></select></label>`;
  }
  const sansAnnee = (titre) => `${titre}${videEtat('Aucune année scolaire', 'Crée ton année : ses périodes (trimestres ou semestres) servent au calcul des moyennes.', `<button class="btn primaire" data-action="annee">${ICONES.plus}Nouvelle année</button>`)}${AVERTISSEMENT}`;
  const sansClasse = (titre) => `${titre}${videEtat('Aucune classe cette année', 'Ajoute une classe ou un groupe, puis ses élèves.', `<button class="btn primaire" data-action="classe">${ICONES.plus}Nouvelle classe</button>`)}${AVERTISSEMENT}`;
  const sansEleve = (titre, cid) => `${titre}${videEtat('Aucun élève dans cette classe', 'Ajoute les élèves : prénom et initiale du nom, ou pseudonyme. Tu peux coller une liste.', `<button class="btn primaire" data-action="eleves" data-classe="${cid}">${ICONES.plus}Ajouter des élèves</button>`)}${AVERTISSEMENT}`;
  const blocRgpd = () => (E.reglages.rgpdLu ? '' : `<section class="rgpd" aria-labelledby="rgpd-bord"><h2 id="rgpd-bord">Données d'élèves : à lire avant de commencer</h2>${TEXTE_RGPD}<div class="rang" style="margin-top:10px"><button class="btn petit" data-action="rgpd-lu">J'ai compris</button></div></section>`);

  // ---------- Tableau de bord ----------
  function vueBord() {
    const a = annee();
    const titre = `<div class="vue-tete"><div><h1>Tableau de bord</h1><p>${a ? `Année ${esc(a.nom)}${periodeCourante() ? ` · ${esc(periodeCourante().nom)} jusqu'au ${dateLongue(periodeCourante().fin)}` : ''}` : 'Ce qui reste à saisir et à rédiger.'}</p></div>
        <div class="actions">${E.annees.length ? choixAnnee() : ''}<button class="btn primaire" data-action="evaluation">${ICONES.plus}Nouvelle évaluation</button></div></div>`;
    if (!a) return sansAnnee(`${titre}${blocRgpd()}`);
    const cls = classesAnnee();
    if (!cls.length) return sansClasse(`${titre}${blocRgpd()}`);
    const t = auj();
    const p = periodeCourante();
    const af = R.aFaire(E, a, t, E.reglages.alerteJours);
    const nbEleves = cls.reduce((s, c) => s + R.elevesDe(E, c.id).length, 0);
    const nbEvals = p ? cls.reduce((s, c) => s + R.evalsPeriode(E, c.id, a, p.id).length, 0) : 0;
    const aSaisir = af.filter((x) => x.type === 'notes').reduce((s, x) => s + x.nb, 0);
    const tuiles = [
      ['Classes', String(cls.length), `dont ${pluriel(cls.filter((c) => c.type === 'groupe').length, 'groupe')}`, 'var(--bleu)', 'rond'],
      ['Élèves', String(nbEleves), 'prénom et initiale', 'var(--jaune)', ''],
      ['Évaluations', String(nbEvals), p ? `au ${p.nom.toLowerCase()}` : 'cette période', 'var(--encre)', ''],
      ['Notes à saisir', String(aSaisir), aSaisir ? 'dans des évaluations passées' : 'tout est saisi', 'var(--rouge)', 'rond'],
    ].map(([lib, v, d, col, f]) => `<div class="tuile ${f}" style="--c:${col}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`).join('');
    return `${titre}${blocRgpd()}
      <div class="tuiles">${tuiles}</div>
      <div class="colonnes-apercu">
        <section>
          <h2 class="titre-section">À faire <span>${pluriel(af.length, 'élément')}</span></h2>
          ${af.length ? `<ul class="alertes-liste">${af.map(ligneAFaire).join('')}</ul>` : '<div class="vide-etat petit"><div><h3>Rien en attente</h3><p>Les notes à saisir, les évaluations des 14 prochains jours et les appréciations à rédiger avant la fin de la période apparaissent ici.</p></div></div>'}
        </section>
        <section>
          <h2 class="titre-section">Mes classes${p ? ` <span>${esc(p.nom)}</span>` : ''}</h2>
          <ul class="mini-classes">${cls.map(miniClasse).join('')}</ul>
        </section>
      </div>
      ${AVERTISSEMENT}`;
  }

  function ligneAFaire(x) {
    const c = classe(x.classeId);
    const ev = x.evalId ? evaluation(x.evalId) : null;
    let titreL, detail, bouton;
    if (x.type === 'notes') { titreL = ev.titre; detail = `${nomClasse(c)} · ${pluriel(x.nb, 'note manquante', 'notes manquantes')} · ${quand(ev.date)}`; bouton = `<button class="btn petit" data-action="saisie" data-id="${ev.id}">Saisir</button>`; }
    else if (x.type === 'avenir') { titreL = ev.titre; detail = `${nomClasse(c)} · à venir ${quand(ev.date)}${ev.bareme ? ` · sur ${nb(ev.bareme)}, coef. ${nb(ev.coef)}` : ' · compétences'}`; bouton = `<button class="btn petit" data-action="evaluation" data-id="${ev.id}">Voir</button>`; }
    else { titreL = 'Appréciations à rédiger'; detail = `${nomClasse(c)} · ${pluriel(x.nb, 'élève')} sans appréciation · fin de période ${quand(x.date)}`; bouton = `<button class="btn petit" data-action="aller-bulletins" data-classe="${c.id}">Rédiger</button>`; }
    const etiq = { retard: '<span class="etiquette rouge">En retard</span>', proche: '<span class="etiquette jaune">À faire</span>', avenir: '<span class="etiquette ciel">À venir</span>' }[x.etat];
    return `<li class="${x.etat}"><span class="date-pastille ${x.etat === 'retard' ? 'alerte' : ''}"><b>${versDate(x.date).getDate()}</b>${fmt(x.date, { month: 'short' }).replace('.', '')}</span>
      <div class="lien-ligne"><b>${esc(titreL)}</b><span>${esc(detail)}</span></div>
      <span class="alerte-droite">${etiq}${bouton}</span></li>`;
  }

  function miniClasse(c) {
    const a = annee(), p = periodeCourante();
    const els = R.elevesDe(E, c.id);
    const mp = p ? R.moyennesPeriode(E, c.id, a, p.id) : null;
    const s = mp?.stats;
    const appr = p ? els.filter((el) => R.appreciationDe(E, el.id, p.id)).length : 0;
    return `<li><button class="lien-ligne" data-action="aller-notes" data-classe="${c.id}"><b>${esc(c.nom)} ${c.type === 'groupe' ? '<span class="etiquette sable">Groupe</span>' : ''}</b><span>${esc(c.matiere || 'Matière non précisée')} · ${pluriel(els.length, 'élève')} · ${pluriel(mp ? mp.evals.length : 0, 'évaluation')}</span>
      <span class="mc-chiffres">${s && s.n ? `Moyenne <b>${moy(s.moyenne)}</b> · médiane ${moy(s.mediane)} · de ${moy(s.min)} à ${moy(s.max)}` : 'Pas encore de moyenne'}</span>
      <span>${els.length ? `Appréciations : ${appr} / ${els.length}` : 'Aucun élève'}</span></button></li>`;
  }

  function brancherInfobulles() {
    document.querySelectorAll('.graphique').forEach((fig) => {
      const bulle = fig.querySelector('.infobulle');
      if (!bulle) return;
      const montrer = (el) => {
        fig.querySelectorAll('[data-info]').forEach((x) => x.classList.toggle('survol', x === el));
        bulle.innerHTML = el.dataset.info;
        bulle.hidden = false;
        const re = el.getBoundingClientRect(), rf = fig.getBoundingClientRect();
        let x = re.left - rf.left + re.width / 2 - bulle.offsetWidth / 2;
        x = Math.min(Math.max(8, x), rf.width - bulle.offsetWidth - 8);
        let y = re.top - rf.top - bulle.offsetHeight - 8;
        if (y < 4) y = re.bottom - rf.top + 8;
        bulle.style.left = `${x}px`;
        bulle.style.top = `${y}px`;
      };
      const cacher = () => { bulle.hidden = true; fig.querySelectorAll('.survol').forEach((x) => x.classList.remove('survol')); };
      fig.querySelectorAll('[data-info]').forEach((el) => {
        el.addEventListener('pointerenter', () => montrer(el));
        el.addEventListener('focus', () => montrer(el));
        el.addEventListener('blur', cacher);
      });
      fig.addEventListener('pointerleave', cacher);
    });
  }

  // ---------- Notes ----------
  function vueNotes() {
    const titre = (cid) => `<div class="vue-tete"><div><h1>Notes</h1><p>Chaque note est ramenée sur 20 et pondérée par le coefficient de l'évaluation. ABS, NN et dispensé ne comptent pas ; une évaluation bonus ne compte que si elle fait monter la moyenne.</p></div>
        <div class="actions">${choixClasse()}${choixPeriode()}${cid ? `<button class="btn" data-action="csv-classe">Export CSV</button><button class="btn primaire" data-action="evaluation" data-classe="${cid}">${ICONES.plus}Nouvelle évaluation</button>` : ''}</div></div>`;
    if (!annee()) return sansAnnee(titre(''));
    const cid = classeChoisie();
    if (!cid) return sansClasse(titre(''));
    const els = R.elevesDe(E, cid);
    if (!els.length) return sansEleve(titre(cid), cid);
    const a = annee();
    const pid = periodeChoisie();
    const evs = evalsVue(cid, pid);
    const moyEl = (id) => (pid === 'annee' ? R.moyenneAnnuelle(E, cid, a, id) : R.moyenneEleve(evs, id).moyenne);
    const par = Object.fromEntries(els.map((el) => [el.id, moyEl(el.id)]));
    const s = R.stats(Object.values(par));
    const tuiles = [
      ['Moyenne de classe', moy(s.moyenne), s.n ? `sur ${pluriel(s.n, 'élève')} noté${s.n > 1 ? 's' : ''}` : 'pas encore de note', 'var(--bleu)', 'rond'],
      ['Médiane', moy(s.mediane), 'la moitié au-dessus', 'var(--jaune)', ''],
      ['Plus basse · plus haute', s.n ? `${moy(s.min)} · ${moy(s.max)}` : '–', 'moyennes des élèves', 'var(--rouge)', 'rond'],
      ['Évaluations', String(evs.length), pid === 'annee' ? 'sur l\'année' : `au ${periode(pid)?.nom.toLowerCase() || ''}`, 'var(--encre)', ''],
    ].map(([lib, v, d, col, f]) => `<div class="tuile ${f}" style="--c:${col}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`).join('');
    const t = auj();
    const statsEv = Object.fromEntries(evs.map((e) => [e.id, R.statsEvaluation(e, els)]));
    const tete = evs.map((e) => `<th class="col-ev ${e.date > t ? 'futur' : ''}"><button class="lien-ev" data-action="saisie" data-id="${e.id}" title="Saisir les notes de « ${esc(e.titre)} »"><b>${esc(e.titre)}</b><span>${dateCourte(e.date)}${e.bareme ? ` · /${nb(e.bareme)} · coef. ${nb(e.coef)}` : ' · compétences'}${e.bonus ? ' · bonus' : ''}</span></button></th>`).join('');
    const lignes = els.map((el) => {
      const bonusR = pid === 'annee' ? [] : R.moyenneEleve(evs, el.id).bonusRetenus;
      return `<tr><th scope="row"><button class="lien-eleve" data-action="eleve" data-id="${el.id}">${esc(el.nom)}</button></th>${evs.map((e) => `<td class="nb ${e.bonus ? (bonusR.includes(e.id) ? 'bonus-oui' : 'bonus-non') : ''}">${e.bareme ? celluleNote(e.notes[el.id]) : (Object.keys(e.niveaux[el.id] || {}).length ? '<span class="manque" title="Compétences évaluées">✓</span>' : '<span class="manque">·</span>')}</td>`).join('')}<td class="nb moy">${moy(par[el.id])}</td></tr>`;
    }).join('');
    const pied = `<tr><th scope="row">Moyenne de la classe</th>${evs.map((e) => `<td class="nb">${e.bareme ? moy(statsEv[e.id].moyenne) : ''}</td>`).join('')}<td class="nb moy">${moy(s.moyenne)}</td></tr>`;
    const grille = evs.length ? `<div class="defile grille-notes"><table class="tableau carnet"><thead><tr><th scope="col">Élève</th>${tete}<th scope="col" class="nb">${pid === 'annee' ? 'Moyenne annuelle' : 'Moyenne'}</th></tr></thead><tbody>${lignes}</tbody><tfoot>${pied}</tfoot></table></div>
      <p class="legende-notes"><span><span class="speciale">ABS</span> absent</span><span><span class="speciale">NN</span> non noté</span><span><span class="speciale">DISP</span> dispensé</span><span><span class="manque">·</span> pas encore saisi</span><span><span class="pastille-bonus oui"></span> bonus retenu</span><span><span class="pastille-bonus"></span> bonus non retenu</span></p>`
      : videEtat('Aucune évaluation sur cette période', 'Crée une évaluation : date, barème (sur 10, 20, 40…), coefficient, compétences évaluées.', `<button class="btn primaire" data-action="evaluation" data-classe="${cid}">${ICONES.plus}Nouvelle évaluation</button>`);
    // Répartition des moyennes (un seul jeu de données : barres bleues, valeurs affichées, tableau).
    const rep = R.repartition(Object.values(par));
    const maxR = Math.max(1, ...rep.map((r) => r.n));
    const graph = `<figure class="graphique"><figcaption class="sr-only">Répartition des moyennes des élèves par tranche</figcaption><div class="projection six">${rep.map((r) => `<div class="col-proj" tabindex="0" data-info="<b>${esc(r.nom)}</b>${pluriel(r.n, 'élève')}${s.n ? ` · ${Math.round(r.n / s.n * 100)} %` : ''}"><span class="cp-val">${r.n || ''}</span><span class="cp-zone"><span class="cp-barre" style="height:${r.n / maxR * 100}%"></span></span><span class="cp-mois">${esc(r.nom)}</span></div>`).join('')}</div><div class="infobulle" hidden></div>
      <details class="tableau-details"><summary>Voir le tableau</summary><table class="tableau petit"><thead><tr><th>Moyenne</th><th class="nb">Élèves</th></tr></thead><tbody>${rep.map((r) => `<tr><td>${esc(r.nom)}</td><td class="nb">${r.n}</td></tr>`).join('')}</tbody></table></details></figure>`;
    const listeEv = evs.length ? `<ul class="liste-evals">${[...evs].reverse().map((e) => { const se = statsEv[e.id]; const sp = Object.entries(se.speciales).filter(([, n]) => n).map(([k, n]) => `${n} ${k}`).join(', '); return `<li class="${e.date > t ? 'futur' : se.manquantes ? 'incomplet' : ''}"><button class="lien-ligne" data-action="evaluation" data-id="${e.id}"><b>${esc(e.titre)}${e.bonus ? ' <span class="etiquette jaune">Bonus</span>' : ''}${e.bareme ? '' : ' <span class="etiquette ciel">Compétences</span>'}</b><span>${dateLongue(e.date)}${e.bareme ? ` · sur ${nb(e.bareme)} · coef. ${nb(e.coef)}` : ''}${e.competences.length ? ` · ${pluriel(e.competences.length, 'compétence')}` : ''}</span><span>${e.date > t ? 'À venir' : e.bareme ? `Moyenne ${moy(se.moyenne)} · de ${moy(se.min)} à ${moy(se.max)}${sp ? ` · ${sp}` : ''}${se.manquantes ? ` · <b class="negatif">${pluriel(se.manquantes, 'note manquante', 'notes manquantes')}</b>` : ''}` : 'Évaluation de compétences, sans note'}</span></button><button class="btn petit" data-action="saisie" data-id="${e.id}">${e.bareme ? 'Saisir' : 'Positionner'}</button></li>`; }).join('')}</ul>` : '';
    return `${titre(cid)}<div class="tuiles">${tuiles}</div>
      <h2 class="titre-section">Carnet de notes <span>${esc(nomClasse(classe(cid)))} · notes sur le barème de chaque évaluation</span></h2>${grille}
      <div class="colonnes-graph"><section><h2 class="titre-section">Répartition des moyennes <span>sur 20</span></h2>${graph}</section>
      <section><h2 class="titre-section">Évaluations <span>${pluriel(evs.length, 'évaluation')}</span></h2>${listeEv || '<p class="aide">Aucune évaluation sur cette période.</p>'}</section></div>
      ${AVERTISSEMENT}`;
  }

  // ---------- Compétences ----------
  function vueCompetences() {
    const titre = `<div class="vue-tete"><div><h1>Compétences</h1><p>Chaque compétence associée à une évaluation se positionne sur quatre échelons. Le bilan est la moyenne des positionnements de la période, arrondie.</p></div>
        <div class="actions">${choixClasse()}${choixPeriode()}<button class="btn" data-action="referentiel">Référentiel</button></div></div>`;
    if (!annee()) return sansAnnee(titre);
    const cid = classeChoisie();
    if (!cid) return sansClasse(titre);
    const els = R.elevesDe(E, cid);
    if (!els.length) return sansEleve(titre, cid);
    const pid = periodeChoisie();
    const evs = evalsVue(cid, pid);
    const cs = R.competencesVues(E, evs);
    const legende = `<p class="legende-niv">${B.niveaux.map((n) => `<span>${pastilleNiveau(n.n)} ${esc(n.nom)}</span>`).join('')}</p>`;
    let corps;
    if (!cs.length) corps = videEtat('Aucune compétence évaluée sur cette période', 'Associe des compétences du référentiel à une évaluation, puis positionne chaque élève dans la saisie.', `<button class="btn primaire" data-action="evaluation" data-classe="${cid}">${ICONES.plus}Nouvelle évaluation</button>`);
    else {
      const bil = Object.fromEntries(els.map((el) => [el.id, Object.fromEntries(cs.map((c) => [c.id, R.bilanCompetence(evs, el.id, c.id)]))]));
      const tete = cs.map((c) => `<th class="col-comp" title="${esc(c.nom)}"><b>${esc(c.code || '')}</b><span>${esc(c.nom)}</span></th>`).join('');
      const lignes = els.map((el) => `<tr><th scope="row"><button class="lien-eleve" data-action="eleve" data-id="${el.id}">${esc(el.nom)}</button></th>${cs.map((c) => { const b = bil[el.id][c.id]; return `<td>${pastilleNiveau(b.niveau, b.niveau ? `${B.niveaux[b.niveau - 1].nom} · ${pluriel(b.nb, 'positionnement')}` : '')}</td>`; }).join('')}</tr>`).join('');
      const pied = `<tr><th scope="row">Satisfaisante ou mieux</th>${cs.map((c) => { const l = els.map((el) => bil[el.id][c.id].niveau).filter(Boolean); return `<td class="nb">${l.length ? `${l.filter((n) => n >= 3).length} / ${l.length}` : '–'}</td>`; }).join('')}</tr>`;
      corps = `<div class="defile grille-notes"><table class="tableau carnet competences"><thead><tr><th scope="col">Élève</th>${tete}</tr></thead><tbody>${lignes}</tbody><tfoot>${pied}</tfoot></table></div>`;
    }
    const src = B.source;
    return `${titre}${legende}${corps}
      <h2 class="titre-section">Référentiel <span>${pluriel(E.competences.length, 'compétence')} · modifiable</span></h2>
      <ul class="referentiel">${E.competences.map((c) => `<li><b>${esc(c.code)}</b><span>${esc(c.nom)}</span><small>${esc(c.domaine)}</small></li>`).join('')}</ul>
      <p class="mention">Échelle à quatre échelons et domaines du socle commun : ${esc(src.titre)} (${esc(src.editeur)}), ${esc(src.vigueur)}, consultés sur Légifrance le ${esc(src.consulte)}. Les intitulés des composantes sont repris de ces articles ; le reste du référentiel est le tien.</p>
      ${AVERTISSEMENT}`;
  }

  // ---------- Bulletins ----------
  function vueBulletins() {
    const titre = (cid) => `<div class="vue-tete"><div><h1>Bulletins</h1><p>L'appréciation de chaque élève se compose à partir de la banque de phrases, puis se modifie librement. Le bulletin reprend la moyenne, les évaluations, les compétences et l'appréciation.</p></div>
        <div class="actions">${choixClasse()}${choixPeriode(false)}${cid ? `<button class="btn" data-action="banque">Banque de phrases</button><button class="btn primaire" data-action="imprimer-classe">Imprimer la classe</button>` : ''}</div></div>`;
    if (!annee()) return sansAnnee(titre(''));
    const cid = classeChoisie();
    if (!cid) return sansClasse(titre(''));
    const els = R.elevesDe(E, cid);
    if (!els.length) return sansEleve(titre(cid), cid);
    const pid = periodeChoisie(false);
    const mp = R.moyennesPeriode(E, cid, annee(), pid);
    const faites = els.filter((el) => R.appreciationDe(E, el.id, pid)).length;
    const p = periode(pid);
    const max = E.reglages.longueurAppreciation;
    return `${titre(cid)}
      <div class="progression"><div><b>${faites} / ${els.length}</b> appréciations rédigées · ${esc(p.nom)}, jusqu'au ${dateLongue(p.fin)}</div><span class="piste"><span style="width:${els.length ? faites / els.length * 100 : 0}%"></span></span></div>
      <ul class="bulletins">${els.map((el) => {
        const tx = R.appreciationDe(E, el.id, pid);
        const m = mp.par[el.id];
        return `<li class="${tx ? '' : 'a-rediger'}"><div class="bu-tete"><b>${esc(el.nom)}</b><span class="bu-moy">${moy(m)}<small> / 20</small></span></div>
          <p class="bu-texte">${tx ? esc(tx) : '<span class="etiquette jaune">À rédiger</span>'}</p>
          ${tx && tx.length > max ? `<p class="bu-long">${tx.length} caractères (conseillé : ${max})</p>` : ''}
          <div class="rang"><button class="btn petit ${tx ? '' : 'primaire'}" data-action="appreciation" data-id="${el.id}">${tx ? 'Modifier' : 'Rédiger'}</button><button class="btn petit" data-action="bulletin" data-id="${el.id}">Bulletin</button></div></li>`;
      }).join('')}</ul>
      ${AVERTISSEMENT}`;
  }

  // ---------- Classes ----------
  function vueClasses() {
    const a = annee();
    const titre = `<div class="vue-tete"><div><h1>Classes</h1><p>Années, périodes, classes et groupes, élèves. En fin d'année, exporte puis efface les élèves et les notes : la structure reste pour l'année suivante.</p></div>
        <div class="actions">${E.annees.length ? choixAnnee() : ''}${a ? `<button class="btn primaire" data-action="classe">${ICONES.plus}Nouvelle classe</button>` : ''}</div></div>`;
    if (!a) return sansAnnee(titre);
    const cls = classesAnnee();
    const ps = R.bornes(a);
    const pc = periodeCourante();
    const nbEl = cls.reduce((s, c) => s + R.elevesDe(E, c.id, true).length, 0);
    return `${titre}
      <section class="annee-carte"><div class="an-tete"><div><p class="surtitre">Année scolaire</p><h2>${esc(a.nom)}</h2><span>Du ${dateLongue(a.debut)} au ${ps.length ? dateLongue(ps[ps.length - 1].fin) : '…'}</span></div>
        <div class="rang"><button class="btn petit" data-action="annee" data-id="${a.id}">Modifier l'année</button><button class="btn petit" data-action="annee">Nouvelle année</button></div></div>
        <ol class="periodes">${ps.map((p) => `<li class="${pc && pc.id === p.id ? 'actif' : ''}"><b>${esc(p.nom)}</b><span>${dateCourte(p.debut)} → ${dateCourte(p.fin)}</span>${pc && pc.id === p.id ? '<span class="etiquette jaune">En cours</span>' : ''}</li>`).join('')}</ol></section>
      ${cls.length ? `<ul class="classes">${cls.map(carteClasse).join('')}</ul>` : videEtat('Aucune classe cette année', 'Ajoute une classe ou un groupe, puis ses élèves.', `<button class="btn primaire" data-action="classe">${ICONES.plus}Nouvelle classe</button>`)}
      <section class="fin-annee"><h2 class="titre-section">Fin d'année <span>${pluriel(nbEl, 'élève')} cette année</span></h2>
        <p class="aide">Avant d'effacer, garde une copie : <b>Export CSV</b> (toutes les notes, pour un tableur) ou <b>Télécharger une copie</b> (sauvegarde complète, dans les Réglages). L'effacement supprime les élèves, leurs notes, leurs positionnements et leurs appréciations de l'année ${esc(a.nom)} ; les classes, les évaluations (vides), le référentiel et la banque de phrases restent.</p>
        <div class="rang"><button class="btn petit" data-action="csv-tout">Export CSV de toutes les notes</button><button class="btn petit" data-action="exporter">Télécharger une copie</button><button class="btn petit danger" data-action="effacer-annee">Effacer élèves et notes de ${esc(a.nom)}</button><button class="btn petit danger" data-action="supprimer-annee">Supprimer l'année</button></div></section>
      <section class="rgpd"><h2>Données d'élèves</h2>${TEXTE_RGPD}</section>
      ${AVERTISSEMENT}`;
  }

  function carteClasse(c) {
    const els = R.elevesDe(E, c.id, true);
    const actifs = els.filter((e) => e.actif !== false);
    const nbEv = R.evalsDe(E, c.id).length;
    return `<li class="classe-carte"><div class="cl-tete"><div><b>${esc(c.nom)}</b><small>${esc(c.matiere || 'Matière non précisée')}</small></div>${c.type === 'groupe' ? '<span class="etiquette sable">Groupe</span>' : '<span class="etiquette ciel">Classe</span>'}</div>
      <div class="vt-chiffres"><div><b>${actifs.length}</b><span>élève${actifs.length > 1 ? 's' : ''}${els.length > actifs.length ? ` (+${els.length - actifs.length} parti${els.length - actifs.length > 1 ? 's' : ''})` : ''}</span></div><div><b>${nbEv}</b><span>évaluation${nbEv > 1 ? 's' : ''}</span></div><div><b>${moy(R.stats(actifs.map((el) => R.moyenneAnnuelle(E, c.id, annee(), el.id))).moyenne)}</b><span>moyenne annuelle</span></div></div>
      ${actifs.length ? `<details class="cl-eleves"><summary>Voir les élèves</summary><p>${actifs.map((e) => esc(e.nom)).join(' · ')}</p></details>` : '<p class="aide">Aucun élève : ajoute-les (prénom et initiale, ou pseudonyme).</p>'}
      <div class="rang vt-actions"><button class="btn petit" data-action="eleves" data-classe="${c.id}">Élèves</button><button class="btn petit" data-action="aller-notes" data-classe="${c.id}">Notes</button><button class="btn petit" data-action="classe" data-id="${c.id}">Modifier</button></div></li>`;
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
    d.classList.remove('large');
    if (!d.open) d.showModal();
    if (!estTel()) d.querySelector('.modale-corps input:not([type=hidden]):not([type=radio]):not([type=checkbox]),.modale-corps select,.modale-corps textarea')?.focus();
  }
  const PIED = (suppr) => `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${suppr ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`;
  function enregistrer(liste, objet, message) {
    retenir();
    const i = E[liste].findIndex((x) => x.id === objet.id);
    if (i >= 0) E[liste][i] = objet; else E[liste].push(objet);
    sauver(); rendre();
    toast(message, { libelle: 'Annuler', faire: annuler });
  }
  function remplacer(nouvel, message) {
    retenir();
    E = nouvel;
    sauver(); rendre();
    toast(message, { libelle: 'Annuler', faire: annuler });
  }
  const optionsClasses = (val) => classesAnnee().map((c) => `<option value="${c.id}" ${c.id === val ? 'selected' : ''}>${esc(nomClasse(c))}</option>`).join('');

  // Année scolaire : nom, début, périodes (nom et date de fin), reprise des classes d'une autre année.
  function modaleAnnee(id) {
    const a = id ? E.annees.find((x) => x.id === id) : null;
    const sc = R.anneeScolaire(auj());
    const existe = E.annees.some((x) => x.nom === sc.nom);
    const suiv = existe ? { nom: `${Number(sc.nom.slice(0, 4)) + 1}-${Number(sc.nom.slice(0, 4)) + 2}`, debut: `${Number(sc.nom.slice(0, 4)) + 1}-09-01` } : sc;
    const x = a || { nom: suiv.nom, debut: suiv.debut };
    let periodes = a ? R.bornes(a).map((p) => ({ id: p.id, nom: p.nom, fin: p.fin })) : R.periodesParDefaut(B, 'trimestres', x.debut);
    const autres = E.annees.filter((y) => y.id !== a?.id);
    const corps = `<div class="rang-champs"><label class="champ">Nom<input name="nom" maxlength="30" value="${esc(x.nom)}"></label><label class="champ">Début<input type="date" name="debut" value="${x.debut}"></label></div>
      ${a ? '' : `<fieldset class="champ"><legend>Découpage <small>Propose des périodes, à ajuster.</small></legend><div class="choix-statut deux">${B.decoupages.map((d) => `<label><input type="radio" name="decoupage" value="${d.code}" ${d.code === 'trimestres' ? 'checked' : ''}><span>${esc(d.nom)}</span></label>`).join('')}</div></fieldset>`}
      <fieldset class="champ cadre-champs"><legend>Périodes <small>Chaque période va du lendemain de la précédente à sa date de fin. Les évaluations sont rangées selon leur date.</small></legend><ul class="plan-edit periodes-edit"></ul>
        <div class="rang"><button type="button" class="btn petit" data-action="periode-ajout">${ICONES.plus}Ajouter une période</button></div></fieldset>
      ${!a && autres.length ? `<label class="champ">Reprendre les classes de<small>Noms, matières et types seulement : ni élèves ni notes.</small><select name="reprendre"><option value="">Ne rien reprendre</option>${autres.map((y) => `<option value="${y.id}">${esc(y.nom)}</option>`).join('')}</select></label>` : ''}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(a ? 'Modifier l\'année' : 'Nouvelle année', corps, PIED(false), (fd) => {
      const debut = fd.get('debut');
      if (!R.estDate(debut)) return 'Date de début illisible.';
      const ps = periodes.filter((p) => String(p.nom).trim());
      if (!ps.length) return 'Ajoute au moins une période.';
      if (ps.some((p) => !R.estDate(p.fin))) return 'Chaque période a besoin d\'une date de fin.';
      if (ps.some((p) => p.fin < debut)) return 'Une période finit avant le début de l\'année.';
      if (new Set(ps.map((p) => p.fin)).size !== ps.length) return 'Deux périodes ont la même date de fin.';
      const n = R.normaliserAnnee({ id: a?.id || uid(), nom: fd.get('nom') || x.nom, debut, periodes: ps });
      retenir();
      if (a) E.annees = E.annees.map((y) => (y.id === a.id ? n : y));
      else { E.annees.push(n); E.anneeId = n.id; if (fd.get('reprendre')) E = R.reprendreClasses(E, fd.get('reprendre'), n.id); filtre.classe = ''; filtre.periode = ''; }
      sauver(); rendre();
      toast(a ? 'Année enregistrée : les moyennes sont recalculées.' : `Année ${n.nom} créée.`, { libelle: 'Annuler', faire: annuler });
      return undefined;
    });
    const dessiner = () => {
      const ul = modale().querySelector('.periodes-edit');
      ul.innerHTML = periodes.map((p, i) => `<li class="plan-ligne"><div class="rang-champs"><label class="champ pl-nom">Nom<input data-p="${i}" data-k="nom" value="${esc(p.nom)}" maxlength="40"></label><label class="champ">Fin<input type="date" data-p="${i}" data-k="fin" value="${p.fin}"></label><button type="button" class="btn-suppr" data-action="periode-suppr" data-i="${i}" aria-label="Retirer ${esc(p.nom)}">×</button></div></li>`).join('');
      ul.querySelectorAll('[data-p]').forEach((el) => el.addEventListener('input', () => { periodes[Number(el.dataset.p)][el.dataset.k] = el.value; }));
    };
    dessiner();
    modale().querySelectorAll('[name=decoupage]').forEach((el) => el.addEventListener('change', () => { periodes = R.periodesParDefaut(B, el.value, modale().querySelector('[name=debut]').value || x.debut); dessiner(); }));
    editionListe = (action, i) => {
      if (action === 'periode-suppr') { periodes.splice(Number(i), 1); dessiner(); }
      if (action === 'periode-ajout') { const der = periodes[periodes.length - 1]?.fin; periodes.push({ id: uid(), nom: `Période ${periodes.length + 1}`, fin: der ? ajout(der, 90) : ajout(x.debut, 90) }); dessiner(); }
    };
  }
  let editionListe = null;

  function modaleClasse(id) {
    if (!annee()) return modaleAnnee(null);
    const c = id ? classe(id) : null;
    if (id && !c) return;
    const x = c || { nom: '', matiere: '', type: 'classe' };
    const corps = `<div class="rang-champs"><label class="champ">Nom<small>Ex. : 4e B, 1re spécialité, 2nde groupe 2.</small><input name="nom" maxlength="40" value="${esc(x.nom)}" required></label>
        <label class="champ">Matière<small>Facultatif.</small><input name="matiere" list="matieres" maxlength="40" value="${esc(x.matiere)}"></label></div>${optionsMatieres()}
      <fieldset class="champ"><legend>Type <small>Un groupe (demi-classe, option, accompagnement) a sa propre liste d'élèves.</small></legend>
        <div class="choix-statut deux"><label><input type="radio" name="type" value="classe" ${x.type !== 'groupe' ? 'checked' : ''}><span>Classe entière</span></label><label><input type="radio" name="type" value="groupe" ${x.type === 'groupe' ? 'checked' : ''}><span>Groupe</span></label></div></fieldset>
      ${c ? '' : `<label class="champ">Élèves<small>Facultatif : un par ligne, prénom et initiale du nom, ou pseudonyme.</small><textarea name="eleves" rows="5" placeholder="Léa M.&#10;Hugo T."></textarea></label>`}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(c ? 'Modifier la classe' : 'Nouvelle classe', corps, PIED(!!c), (fd, choix) => {
      if (choix === 'supprimer') {
        const n = R.elevesDe(E, c.id, true).length, ne = R.evalsDe(E, c.id).length;
        if (!confirm(`Supprimer « ${c.nom} »${n || ne ? `, ses ${pluriel(n, 'élève')} et ses ${pluriel(ne, 'évaluation')}` : ''} ?`)) return '';
        remplacer(R.supprimerClasse(E, c.id), 'Classe supprimée.');
        return undefined;
      }
      if (!String(fd.get('nom')).trim()) return 'Indique le nom de la classe.';
      const n = R.normaliserClasse({ ...(c || {}), id: c?.id || uid(), anneeId: c?.anneeId || E.anneeId, nom: fd.get('nom'), matiere: fd.get('matiere'), type: fd.get('type') });
      retenir();
      if (c) E.classes = E.classes.map((y) => (y.id === c.id ? n : y)); else E.classes.push(n);
      const noms = c ? [] : R.lireListe(fd.get('eleves'));
      for (const nom of noms) E.eleves.push(R.normaliserEleve({ id: uid(), classeId: n.id, nom }));
      filtre.classe = n.id;
      sauver(); rendre();
      toast(c ? 'Classe enregistrée.' : `Classe ajoutée${noms.length ? ` avec ${pluriel(noms.length, 'élève')}` : ''}.`, { libelle: 'Annuler', faire: annuler });
      return undefined;
    });
  }

  // Élèves d'une classe : ajout par liste collée, renommage, remarque, départ, suppression.
  function modaleEleves(classeId) {
    const c = classe(classeId);
    if (!c) return;
    let liste = R.elevesDe(E, c.id, true).map((e) => ({ ...e }));
    const supprimes = [];
    const corps = `<p class="aide"><b>Prénom et initiale du nom, ou pseudonyme</b> : rien de plus. Les remarques sont facultatives et <b>ne doivent contenir aucune donnée sensible</b> (santé, handicap, situation familiale, comportement en dehors de la classe…).</p>
      <ul class="plan-edit eleves-edit"></ul>
      <label class="champ">Ajouter des élèves<small>Un par ligne : tu peux coller une liste.</small><textarea name="ajout" rows="4" placeholder="Léa M.&#10;Hugo T."></textarea></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(`Élèves · ${esc(c.nom)}`, corps, PIED(false), (fd) => {
      if (liste.some((e) => !String(e.nom).trim())) return 'Chaque élève a besoin d\'un prénom ou d\'un pseudonyme.';
      retenir();
      let n = E;
      for (const id of supprimes) n = R.supprimerEleve(n, id);
      const maj = new Map(liste.map((e) => [e.id, R.normaliserEleve({ ...e, classeId: c.id })]));
      n = { ...n, eleves: n.eleves.map((e) => maj.get(e.id) || e) };
      const noms = R.lireListe(fd.get('ajout')).filter((x) => !liste.some((e) => R.plat(e.nom) === R.plat(x)));
      for (const nom of noms) n.eleves.push(R.normaliserEleve({ id: uid(), classeId: c.id, nom }));
      E = n;
      sauver(); rendre();
      toast(`Élèves enregistrés${noms.length ? ` : ${pluriel(noms.length, 'ajout')}` : ''}${supprimes.length ? `, ${pluriel(supprimes.length, 'suppression')}` : ''}.`, { libelle: 'Annuler', faire: annuler });
      return undefined;
    });
    modale().classList.add('large');
    const dessiner = () => {
      const ul = modale().querySelector('.eleves-edit');
      ul.innerHTML = liste.length ? liste.map((e, i) => `<li class="plan-ligne eleve-ligne ${e.actif === false ? 'parti' : ''}"><div class="rang-champs"><label class="champ pl-nom">Élève<input data-p="${i}" data-k="nom" value="${esc(e.nom)}" maxlength="40"></label><label class="champ">Remarque<input data-p="${i}" data-k="remarque" value="${esc(e.remarque)}" maxlength="200" placeholder="Facultatif"></label><button type="button" class="btn-suppr" data-action="eleve-suppr" data-i="${i}" aria-label="Supprimer ${esc(e.nom)}">×</button></div>
        <label class="case"><input type="checkbox" data-p="${i}" data-k="parti" ${e.actif === false ? 'checked' : ''}> Parti(e) de la classe (gardé dans les exports, sorti des moyennes et des bulletins)</label></li>`).join('') : '<li class="aide">Aucun élève pour l\'instant.</li>';
      ul.querySelectorAll('[data-p]').forEach((el) => el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', () => { const o = liste[Number(el.dataset.p)]; if (el.dataset.k === 'parti') o.actif = !el.checked; else o[el.dataset.k] = el.value; }));
    };
    dessiner();
    editionListe = (action, i) => {
      if (action !== 'eleve-suppr') return;
      const e = liste[Number(i)];
      if (!confirm(`Supprimer ${e.nom} et toutes ses notes ? Pour garder son historique, coche plutôt « Parti(e) de la classe ».`)) return;
      supprimes.push(e.id); liste.splice(Number(i), 1); dessiner();
    };
  }

  function modaleEleve(id) {
    const el = eleve(id);
    if (!el) return;
    const c = classe(el.classeId), a = annee();
    const lignes = R.bornes(a).map((p) => { const m = R.moyenneEleve(R.evalsPeriode(E, c.id, a, p.id), el.id).moyenne; return `<tr><td>${esc(p.nom)}</td><td class="nb">${moy(m)}</td><td>${R.appreciationDe(E, el.id, p.id) ? 'rédigée' : '–'}</td></tr>`; }).join('');
    const corps = `<p><b>${esc(el.nom)}</b> · ${esc(nomClasse(c))}</p>
      <table class="tableau petit"><thead><tr><th>Période</th><th class="nb">Moyenne</th><th>Appréciation</th></tr></thead><tbody>${lignes}<tr><td><b>Année</b></td><td class="nb"><b>${moy(R.moyenneAnnuelle(E, c.id, a, el.id))}</b></td><td></td></tr></tbody></table>
      ${el.remarque ? `<p class="aide">Remarque : ${esc(el.remarque)}</p>` : ''}`;
    ouvrirModale('Élève', corps, '<button class="btn primaire" value="annuler">Fermer</button><button class="btn" value="bulletin">Bulletin</button><button class="btn" value="eleves">Modifier la liste</button>', (_, choix) => {
      if (choix === 'bulletin') { setTimeout(() => modaleBulletin(el.id), 0); return undefined; }
      if (choix === 'eleves') { setTimeout(() => modaleEleves(c.id), 0); return undefined; }
      return undefined;
    });
  }

  // Évaluation : titre, date, barème, coefficient, bonus, compétences.
  function modaleEvaluation(id, classeId) {
    if (!classesAnnee().length && !id) return toast('Ajoute d\'abord une classe (onglet Classes).');
    const e = id ? evaluation(id) : null;
    if (id && !e) return;
    const cid = e?.classeId || (classeId && classe(classeId) ? classeId : classeChoisie());
    const x = e || { titre: '', date: auj(), bareme: 20, coef: 1, bonus: false, competences: [] };
    const nbNotes = e ? Object.keys(e.notes).length : 0;
    const corps = `${e ? `<p class="aide">${esc(nomClasse(classe(cid)))} · ${pluriel(nbNotes, 'note saisie', 'notes saisies')}${e.competences.length ? ` · ${pluriel(Object.keys(e.niveaux).length, 'élève positionné', 'élèves positionnés')}` : ''}</p>` : `<label class="champ">Classe<select name="classeId">${optionsClasses(cid)}</select></label>`}
      <label class="champ">Titre<input name="titre" maxlength="80" value="${esc(x.titre)}" placeholder="Ex. : Fractions, contrôle 2" required></label>
      <div class="rang-champs"><label class="champ">Date<small>Range l'évaluation dans sa période.</small><input type="date" name="date" value="${x.date}"></label><label class="champ">Coefficient<small>0,5 · 1 · 2…</small><input name="coef" inputmode="decimal" value="${nb(x.coef)}"></label></div>
      <label class="case"><input type="checkbox" name="notee" ${x.bareme > 0 ? 'checked' : ''}> Évaluation notée (sinon : compétences seulement)</label>
      <div class="rang-champs" data-notee ${x.bareme > 0 ? '' : 'hidden'}><label class="champ">Noté sur<small>Ramené sur 20 pour les moyennes.</small><input name="bareme" inputmode="decimal" value="${x.bareme > 0 ? nb(x.bareme) : 20}"></label>
        <label class="case champ-case"><input type="checkbox" name="bonus" ${x.bonus ? 'checked' : ''}> Bonus : comptée seulement si elle fait monter la moyenne</label></div>
      <fieldset class="champ cadre-champs"><legend>Compétences évaluées <small>Facultatif. Chaque élève se positionne ensuite sur quatre échelons.</small></legend><div class="cases-ops">${E.competences.map((c) => `<label class="case"><input type="checkbox" name="comp" value="${c.id}" ${x.competences.includes(c.id) ? 'checked' : ''}> <span><b>${esc(c.code)}</b> ${esc(c.nom)}</span></label>`).join('') || '<p class="aide">Référentiel vide : ajoute des compétences (onglet Compétences, Référentiel).</p>'}</div></fieldset>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(e ? 'Modifier l\'évaluation' : 'Nouvelle évaluation', corps, `${e ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="saisie">Saisir les notes</button>' : '<button class="btn primaire" value="saisie">Créer et saisir les notes</button><button class="btn" value="ok">Créer</button>'}<button class="btn" value="annuler">Annuler</button>${e ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`, (fd, choix) => {
      if (choix === 'supprimer') {
        if (!confirm(`Supprimer « ${e.titre} »${nbNotes ? ` et ses ${pluriel(nbNotes, 'note')}` : ''} ?`)) return '';
        retenir(); E.evaluations = E.evaluations.filter((y) => y.id !== e.id); sauver(); rendre();
        toast('Évaluation supprimée.', { libelle: 'Annuler', faire: annuler });
        return undefined;
      }
      if (!String(fd.get('titre')).trim()) return 'Donne un titre à l\'évaluation.';
      if (!R.estDate(fd.get('date'))) return 'Date illisible.';
      const coef = R.lireNombre(fd.get('coef'));
      if (coef === null) return 'Coefficient illisible : écris par exemple 1 ou 0,5.';
      const notee = !!fd.get('notee');
      const bareme = notee ? R.lireNombre(fd.get('bareme')) : 0;
      if (notee && !bareme) return 'Barème illisible : écris par exemple 20, 10 ou 40.';
      if (e && notee && Object.values(e.notes).some((v) => R.estNote(v) && v > bareme)) return `Des notes déjà saisies dépassent ${nb(bareme)} : corrige-les d'abord.`;
      const n = R.normaliserEvaluation({ ...(e || { notes: {}, niveaux: {} }), id: e?.id || uid(), classeId: e?.classeId || fd.get('classeId'), titre: fd.get('titre'), date: fd.get('date'), coef, bareme, bonus: notee && !!fd.get('bonus'), competences: fd.getAll('comp') });
      if (!notee) n.notes = {};
      enregistrer('evaluations', n, e ? 'Évaluation enregistrée.' : 'Évaluation créée.');
      if (choix === 'saisie') setTimeout(() => modaleSaisie(n.id), 0);
      return undefined;
    });
    const d = modale();
    d.querySelector('[name=notee]').addEventListener('change', (ev) => { d.querySelector('[data-notee]').hidden = !ev.target.checked; });
  }

  // Saisie rapide : notes au clavier (Entrée → élève suivant) et positionnement des compétences.
  function modaleSaisie(id) {
    const e = evaluation(id);
    if (!e) return;
    const c = classe(e.classeId);
    const els = R.elevesDe(E, c.id);
    if (!els.length) return toast('Ajoute d\'abord les élèves de cette classe.');
    const notes = { ...e.notes };
    const niveaux = structuredClone(e.niveaux);
    const comps = e.competences.map(competence).filter(Boolean);
    let mode = e.bareme > 0 ? 'notes' : 'competences';
    let compId = comps[0]?.id || '';
    const saisies = Object.fromEntries(els.map((el) => [el.id, R.estNote(notes[el.id]) ? nb(notes[el.id]) : notes[el.id] || '']));
    const corps = `<p class="aide">${esc(nomClasse(c))} · ${dateLongue(e.date)}${e.bareme ? ` · sur ${nb(e.bareme)} · coef. ${nb(e.coef)}${e.bonus ? ' · bonus' : ''}` : ' · compétences seulement'}<br>${e.bareme ? 'Tape la note puis <b>Entrée</b> (ou la flèche suivante sur téléphone) : le curseur passe à l\'élève suivant. <b>a</b> = absent, <b>n</b> = non noté, <b>d</b> = dispensé.' : 'Touche un échelon pour chaque élève.'}</p>
      ${e.bareme && comps.length ? `<div class="choix-statut deux" role="radiogroup" aria-label="Mode de saisie"><label><input type="radio" name="mode" value="notes" ${mode === 'notes' ? 'checked' : ''}><span>Notes</span></label><label><input type="radio" name="mode" value="competences"><span>Compétences</span></label></div>` : ''}
      <div data-zone></div>
      <p class="apercu" data-stats></p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(`Saisie · ${esc(e.titre)}`, corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', () => {
      const n = {};
      for (const el of els) {
        const r = R.lireNote(saisies[el.id], e.bareme, B);
        if (r.erreur) return `${el.nom} : ${r.erreur}`;
        if (!r.vide) n[el.id] = r.valeur;
      }
      // Les notes d'élèves partis restent.
      for (const [k, v] of Object.entries(e.notes)) if (!els.some((el) => el.id === k)) n[k] = v;
      const ev2 = R.normaliserEvaluation({ ...e, notes: e.bareme ? n : {}, niveaux });
      enregistrer('evaluations', ev2, 'Saisie enregistrée : les moyennes sont recalculées.');
      return undefined;
    });
    const d = modale();
    d.classList.add('large');
    const zone = d.querySelector('[data-zone]');
    const majStats = () => {
      if (mode !== 'notes') { const nbp = els.filter((el) => niveaux[el.id]?.[compId]).length; d.querySelector('[data-stats]').textContent = `${nbp} / ${els.length} élèves positionnés sur cette compétence.`; return; }
      const v = []; let err = 0, vides = 0;
      for (const el of els) { const r = R.lireNote(saisies[el.id], e.bareme, B); if (r.erreur) err++; else if (r.vide) vides++; else if (R.estNote(r.valeur)) v.push(R.sur20(r.valeur, e.bareme)); }
      const s = R.stats(v);
      d.querySelector('[data-stats]').textContent = `${s.n ? `Moyenne ${moy(s.moyenne)} / 20 · médiane ${moy(s.mediane)} · ` : ''}${pluriel(v.length, 'note')} · ${vides} à saisir${err ? ` · ${pluriel(err, 'saisie illisible', 'saisies illisibles')}` : ''}`;
    };
    const dessiner = () => {
      if (mode === 'notes') {
        zone.innerHTML = `<ol class="saisie-liste">${els.map((el, i) => `<li data-eleve="${el.id}"><label for="n-${i}">${esc(el.nom)}</label><span class="saisie-champ"><input id="n-${i}" data-i="${i}" value="${esc(saisies[el.id])}" inputmode="decimal" enterkeyhint="next" autocomplete="off" aria-describedby="s20-${i}"><small id="s20-${i}" data-s20></small></span><span class="saisie-codes">${B.speciales.map((s) => `<button type="button" class="code" data-code="${s.code}" data-i="${i}" title="${esc(s.nom)}">${s.code === 'DISP' ? 'Disp.' : s.code}</button>`).join('')}</span></li>`).join('')}</ol>`;
        const champs = [...zone.querySelectorAll('input')];
        const verifier = (inp) => {
          const el = els[Number(inp.dataset.i)];
          const r = R.lireNote(inp.value, e.bareme, B);
          const li = inp.closest('li');
          li.classList.toggle('invalide', !!r.erreur);
          li.querySelector('[data-s20]').textContent = r.erreur ? r.erreur : R.estNote(r.valeur) && e.bareme !== 20 ? `${moy(R.sur20(r.valeur, e.bareme))} / 20` : '';
          saisies[el.id] = inp.value;
        };
        champs.forEach((inp) => {
          verifier(inp);
          inp.addEventListener('input', () => { verifier(inp); majStats(); });
          inp.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter' || (ev.key === 'ArrowDown' && !ev.altKey)) { ev.preventDefault(); const s = champs[Number(inp.dataset.i) + 1]; if (s) { s.focus(); s.select(); } else d.querySelector('.modale-pied .primaire').focus(); }
            if (ev.key === 'ArrowUp') { ev.preventDefault(); const s = champs[Number(inp.dataset.i) - 1]; if (s) { s.focus(); s.select(); } }
          });
        });
        zone.querySelectorAll('.code').forEach((b) => b.addEventListener('click', () => { const inp = champs[Number(b.dataset.i)]; inp.value = inp.value.toUpperCase() === b.dataset.code ? '' : b.dataset.code; verifier(inp); majStats(); const s = champs[Number(b.dataset.i) + 1]; if (s && !estTel()) s.focus(); }));
        if (!estTel()) { const premier = champs.find((x) => !x.value) || champs[0]; premier?.focus(); }
      } else {
        zone.innerHTML = `${comps.length > 1 ? `<label class="champ">Compétence<select data-comp>${comps.map((k) => `<option value="${k.id}" ${k.id === compId ? 'selected' : ''}>${esc(k.code)} · ${esc(k.nom)}</option>`).join('')}</select></label>` : comps.length ? `<p><b>${esc(comps[0].code)}</b> ${esc(comps[0].nom)}</p>` : '<p class="aide">Aucune compétence associée : modifie l\'évaluation pour en choisir.</p>'}
          <ol class="saisie-liste niveaux-liste">${comps.length ? els.map((el) => `<li><span class="nom">${esc(el.nom)}</span><span class="choix-niveaux" role="radiogroup" aria-label="${esc(el.nom)}">${B.niveaux.map((n) => `<button type="button" class="niv-btn n${n.n}" data-eleve="${el.id}" data-n="${n.n}" aria-pressed="${niveaux[el.id]?.[compId] === n.n}" title="${esc(n.nom)}">${n.n}</button>`).join('')}</span></li>`).join('') : ''}</ol>
          ${comps.length ? `<p class="legende-niv">${B.niveaux.map((n) => `<span>${pastilleNiveau(n.n)} ${esc(n.court)}</span>`).join('')}</p>` : ''}`;
        zone.querySelector('[data-comp]')?.addEventListener('change', (ev) => { compId = ev.target.value; dessiner(); });
        zone.querySelectorAll('.niv-btn').forEach((b) => b.addEventListener('click', () => {
          const el = b.dataset.eleve, n = Number(b.dataset.n);
          niveaux[el] = niveaux[el] || {};
          if (niveaux[el][compId] === n) delete niveaux[el][compId]; else niveaux[el][compId] = n;
          if (!Object.keys(niveaux[el]).length) delete niveaux[el];
          b.parentElement.querySelectorAll('.niv-btn').forEach((x) => x.setAttribute('aria-pressed', String(niveaux[el]?.[compId] === Number(x.dataset.n))));
          majStats();
        }));
      }
      majStats();
    };
    d.querySelectorAll('[name=mode]').forEach((r) => r.addEventListener('change', () => { mode = r.value; dessiner(); }));
    dessiner();
  }

  // Appréciation : banque de phrases filtrée par niveau, composition, longueur, élève suivant.
  function modaleAppreciation(eleveId) {
    const el = eleve(eleveId);
    if (!el) return;
    const pid = periodeChoisie(false);
    const p = periode(pid);
    const c = classe(el.classeId);
    const mp = R.moyennesPeriode(E, c.id, annee(), pid);
    const m = mp.par[el.id];
    const suggere = R.niveauSuggere(m);
    let niv = suggere || 0;
    const max = E.reglages.longueurAppreciation;
    const comps = R.competencesVues(E, mp.evals).map((k) => ({ k, b: R.bilanCompetence(mp.evals, el.id, k.id) })).filter((x) => x.b.niveau);
    const corps = `<div class="ap-resume"><div><b>${esc(el.nom)}</b><span>${esc(nomClasse(c))} · ${esc(p.nom)}</span></div><div class="ap-moy"><b>${moy(m)}</b><span>classe ${moy(mp.stats.moyenne)}</span></div></div>
      ${comps.length ? `<p class="ap-comps">${comps.map(({ k, b }) => `<span>${pastilleNiveau(b.niveau)} ${esc(k.code || k.nom)}</span>`).join('')}</p>` : ''}
      <label class="champ">Appréciation<small>Ni donnée de santé, ni situation familiale, ni information sensible. <span data-compte></span></small><textarea name="texte" rows="4" maxlength="2000">${esc(R.appreciationDe(E, el.id, pid))}</textarea></label>
      <fieldset class="champ"><legend>Banque de phrases <small>Touche une phrase pour l'ajouter.${suggere ? ` Niveau proposé d'après la moyenne : ${suggere}.` : ''}</small></legend>
        <div class="filtres" role="group" aria-label="Niveau des phrases">${[[0, 'Tous'], [1, '1 · difficultés'], [2, '2 · fragile'], [3, '3 · satisfaisant'], [4, '4 · très bien']].map(([k, l]) => `<button type="button" class="filtre" data-niv="${k}" aria-pressed="${niv === k}">${l}</button>`).join('')}</div>
        <div data-phrases class="phrases"></div></fieldset>
      <p class="erreur" role="alert"></p>`;
    const autres = R.elevesDe(E, c.id);
    const i = autres.findIndex((x) => x.id === el.id);
    const suivant = autres[i + 1];
    ouvrirModale('Appréciation', corps, `<button class="btn primaire" value="ok">Enregistrer</button>${suivant ? '<button class="btn" value="suivant">Enregistrer et élève suivant</button>' : ''}<button class="btn" value="annuler">Annuler</button>`, (fd, choix) => {
      retenir();
      E = R.ecrireAppreciation(E, el.id, pid, fd.get('texte'));
      sauver(); rendre();
      if (choix === 'suivant' && suivant) { setTimeout(() => modaleAppreciation(suivant.id), 0); toast(`Appréciation de ${el.nom} enregistrée.`, { libelle: 'Annuler', faire: annuler }); return undefined; }
      toast('Appréciation enregistrée.', { libelle: 'Annuler', faire: annuler });
      return undefined;
    });
    const d = modale();
    d.classList.add('large');
    const ta = d.querySelector('[name=texte]');
    const compte = () => { const l = ta.value.length; d.querySelector('[data-compte]').textContent = `${l} / ${max} caractères conseillés`; d.querySelector('[data-compte]').classList.toggle('negatif', l > max); };
    const phrases = () => {
      d.querySelector('[data-phrases]').innerHTML = B.axes.map((ax) => { const l = E.banque.filter((b) => b.axe === ax.code && (!niv || b.niveau === niv)); return l.length ? `<div class="axe"><p class="surtitre">${esc(ax.nom)}</p>${l.map((b) => `<button type="button" class="phrase n${b.niveau}" data-phrase="${b.id}"><span class="niv n${b.niveau}" aria-hidden="true">${b.niveau}</span>${esc(R.composer(b.texte, el))}</button>`).join('')}</div>` : ''; }).join('') || '<p class="aide">Aucune phrase à ce niveau : complète la banque (bouton « Banque de phrases »).</p>';
      d.querySelectorAll('[data-phrase]').forEach((b) => b.addEventListener('click', () => { const ph = E.banque.find((x) => x.id === b.dataset.phrase); ta.value = R.ajouterPhrase(ta.value, R.composer(ph.texte, el)); compte(); if (!estTel()) ta.focus(); }));
    };
    d.querySelectorAll('[data-niv]').forEach((b) => b.addEventListener('click', () => { niv = Number(b.dataset.niv); d.querySelectorAll('[data-niv]').forEach((x) => x.setAttribute('aria-pressed', String(Number(x.dataset.niv) === niv))); phrases(); }));
    ta.addEventListener('input', compte);
    compte(); phrases();
  }

  // Bulletin d'un élève : aperçu, impression, texte à copier.
  function modaleBulletin(eleveId) {
    const el = eleve(eleveId);
    if (!el) return;
    const pid = periodeChoisie(false);
    const b = R.bulletin(E, B, el.id, pid);
    if (!b) return toast('Bulletin indisponible : vérifie la classe et la période.');
    const corps = `<p>Le bulletin de <b>${esc(el.nom)}</b> pour la période « ${esc(b.periode.nom)} », à imprimer ou à copier dans le logiciel de ton établissement.</p><pre class="apercu-histo">${esc(R.texteBulletin(b, dec()))}</pre>`;
    ouvrirModale('Bulletin', corps, '<button class="btn primaire" value="imprimer">Imprimer</button><button class="btn" value="copier">Copier le texte</button><button class="btn" value="annuler">Fermer</button>', (_, choix) => {
      if (choix === 'imprimer') { imprimer([b]); return undefined; }
      if (choix === 'copier') {
        navigator.clipboard?.writeText(R.texteBulletin(b, dec())).then(() => toast('Bulletin copié.'), () => toast('Copie impossible : sélectionne le texte à la main.'));
        modale().dataset.garder = '1';
      }
      return undefined;
    });
  }

  function pageBulletin(b) {
    const lib = (n) => (R.estSpeciale(n) ? SPECIAL_NOM[n] : R.estNote(n) ? nb(n) : '–');
    return `<section class="bulletin-page"><header class="imp-tete"><div><p class="surtitre">Bulletin · ${esc(b.periode.nom)} · ${esc(b.annee.nom)}</p><h1>${esc(b.eleve.nom)}</h1><p>${esc(nomClasse(b.classe))}</p></div>
        <div class="imp-km"><b>${moy(b.moyenne)} / 20</b><span>classe : ${moy(b.classeStats.moyenne)} (de ${moy(b.classeStats.min)} à ${moy(b.classeStats.max)})</span></div></header>
      <table class="tableau"><thead><tr><th>Date</th><th>Évaluation</th><th class="nb">Note</th><th class="nb">Sur 20</th><th class="nb">Coef.</th><th class="nb">Classe</th></tr></thead>
      <tbody>${b.evals.map((e) => `<tr><td>${dateCourte(e.date)}</td><td>${esc(e.titre)}${e.bonus ? (e.bonusRetenu ? ' · bonus retenu' : ' · bonus non retenu') : ''}</td><td class="nb">${e.bareme ? `${lib(e.note)} / ${nb(e.bareme)}` : 'compétences'}</td><td class="nb">${e.s20 === null ? '' : moy(e.s20)}</td><td class="nb">${e.bareme ? nb(e.coef) : ''}</td><td class="nb">${e.bareme ? moy(e.moyenneClasse) : ''}</td></tr>`).join('') || '<tr><td colspan="6">Aucune évaluation sur la période.</td></tr>'}</tbody></table>
      ${b.competences.length ? `<h2 class="imp-sous">Compétences</h2><ul class="imp-comps">${b.competences.map((c) => `<li>${pastilleNiveau(c.niveau)}<span><b>${esc(c.competence.code)}</b> ${esc(c.competence.nom)}</span><em>${c.niveau ? esc(B.niveaux[c.niveau - 1].nom) : 'non évaluée'}</em></li>`).join('')}</ul>` : ''}
      <h2 class="imp-sous">Appréciation</h2><p class="imp-appreciation">${b.appreciation ? esc(b.appreciation) : '<i>À rédiger.</i>'}</p>
      <p class="mention">Document de préparation établi le ${dateLongue(auj())} à partir du carnet tenu par l'enseignant. Le bulletin officiel est celui de l'établissement.</p></section>`;
  }

  function imprimer(liste) {
    const el = $('#impression');
    el.innerHTML = liste.map(pageBulletin).join('');
    el.hidden = false;
    document.body.classList.add('imprime');
    if (modale().open) modale().close();
    const fin = () => { document.body.classList.remove('imprime'); el.hidden = true; window.removeEventListener('afterprint', fin); };
    window.addEventListener('afterprint', fin);
    setTimeout(() => { window.print(); setTimeout(fin, 500); }, 50);
  }
  function imprimerClasse() {
    const cid = classeChoisie(), pid = periodeChoisie(false);
    const l = R.elevesDe(E, cid).map((el) => R.bulletin(E, B, el.id, pid)).filter(Boolean);
    if (!l.length) return toast('Aucun élève dans cette classe.');
    imprimer(l);
  }

  // Référentiel de compétences : code, intitulé, domaine ; reprise du socle ou de l'exemple.
  function modaleReferentiel() {
    let liste = E.competences.map((c) => ({ ...c }));
    const src = B.source;
    const corps = `<p class="aide">Les compétences cochées dans une évaluation se positionnent sur l'échelle : ${B.niveaux.map((n) => esc(n.nom.toLowerCase())).join(', ')}. Ajoute, renomme ou retire librement ; une compétence retirée disparaît des évaluations.</p>
      <ul class="plan-edit ref-edit"></ul>
      <div class="rang"><button type="button" class="btn petit" data-action="ref-ajout">${ICONES.plus}Ajouter une compétence</button>${B.referentiels.map((r) => `<button type="button" class="btn petit" data-action="ref-base" data-i="${r.code}">Reprendre : ${esc(r.code === 'socle' ? 'socle commun' : 'exemple générique')}</button>`).join('')}</div>
      <p class="mention">Socle commun : ${esc(src.resume)} Source : ${esc(src.titre)}, ${esc(src.editeur)} (${esc(src.url)}), ${esc(src.vigueur)}, consulté le ${esc(src.consulte)}.</p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Référentiel de compétences', corps, PIED(false), () => {
      const l = liste.filter((c) => String(c.nom).trim()).map(R.normaliserCompetence);
      const ids = new Set(l.map((c) => c.id));
      retenir();
      E.competences = l;
      E.evaluations = E.evaluations.map((ev) => ({ ...ev, competences: ev.competences.filter((x) => ids.has(x)) }));
      sauver(); rendre();
      toast('Référentiel enregistré.', { libelle: 'Annuler', faire: annuler });
      return undefined;
    });
    modale().classList.add('large');
    const dessiner = () => {
      const ul = modale().querySelector('.ref-edit');
      ul.innerHTML = liste.map((c, i) => `<li class="plan-ligne"><div class="rang-champs"><label class="champ ref-code">Code<input data-p="${i}" data-k="code" value="${esc(c.code)}" maxlength="12"></label><label class="champ pl-nom">Intitulé<input data-p="${i}" data-k="nom" value="${esc(c.nom)}" maxlength="120"></label><label class="champ">Domaine<input data-p="${i}" data-k="domaine" value="${esc(c.domaine)}" maxlength="60"></label><button type="button" class="btn-suppr" data-action="ref-suppr" data-i="${i}" aria-label="Retirer ${esc(c.nom)}">×</button></div></li>`).join('') || '<li class="aide">Référentiel vide.</li>';
      ul.querySelectorAll('[data-p]').forEach((el) => el.addEventListener('input', () => { liste[Number(el.dataset.p)][el.dataset.k] = el.value; }));
    };
    dessiner();
    editionListe = (action, i) => {
      if (action === 'ref-suppr') { liste.splice(Number(i), 1); dessiner(); }
      if (action === 'ref-ajout') { liste.push({ id: uid(), code: `C${liste.length + 1}`, nom: 'Nouvelle compétence', domaine: '' }); dessiner(); modale().querySelector('.ref-edit li:last-child .pl-nom input')?.focus(); }
      if (action === 'ref-base' && confirm('Remplacer le référentiel par celui proposé ? Les compétences retirées disparaîtront des évaluations à l\'enregistrement.')) { liste = R.referentiel(B, i); dessiner(); }
    };
  }

  // Banque d'appréciations : phrases par axe et niveau, {prenom} remplacé à l'insertion.
  function modaleBanque() {
    let liste = E.banque.map((b) => ({ ...b }));
    const corps = `<p class="aide">Phrases types rédigées pour l'outil, à adapter à ta façon d'écrire. <b>{prenom}</b> est remplacé par le prénom de l'élève. Niveau 1 : difficultés · 4 : très bons résultats.</p>
      <ul class="plan-edit banque-edit"></ul>
      <div class="rang"><button type="button" class="btn petit" data-action="banque-ajout">${ICONES.plus}Ajouter une phrase</button><button type="button" class="btn petit" data-action="banque-defaut">Reprendre la banque proposée</button></div>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Banque de phrases', corps, PIED(false), () => {
      retenir();
      E.banque = liste.filter((b) => String(b.texte).trim()).map(R.normaliserPhrase);
      sauver(); rendre();
      toast('Banque de phrases enregistrée.', { libelle: 'Annuler', faire: annuler });
      return undefined;
    });
    modale().classList.add('large');
    const dessiner = () => {
      const ul = modale().querySelector('.banque-edit');
      ul.innerHTML = liste.map((b, i) => `<li class="plan-ligne"><div class="rang-champs"><label class="champ">Axe<select data-p="${i}" data-k="axe">${B.axes.map((a) => `<option value="${a.code}" ${a.code === b.axe ? 'selected' : ''}>${esc(a.nom)}</option>`).join('')}</select></label><label class="champ ref-code">Niveau<select data-p="${i}" data-k="niveau">${[1, 2, 3, 4].map((n) => `<option ${n === b.niveau ? 'selected' : ''}>${n}</option>`).join('')}</select></label><button type="button" class="btn-suppr" data-action="banque-suppr" data-i="${i}" aria-label="Retirer la phrase">×</button></div>
        <label class="champ"><span class="sr-only">Phrase</span><input data-p="${i}" data-k="texte" value="${esc(b.texte)}" maxlength="300"></label></li>`).join('');
      ul.querySelectorAll('[data-p]').forEach((el) => el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => { liste[Number(el.dataset.p)][el.dataset.k] = el.dataset.k === 'niveau' ? Number(el.value) : el.value; }));
    };
    dessiner();
    editionListe = (action, i) => {
      if (action === 'banque-suppr') { liste.splice(Number(i), 1); dessiner(); }
      if (action === 'banque-ajout') { liste.unshift({ id: uid(), axe: 'resultats', niveau: 3, texte: '' }); dessiner(); modale().querySelector('.banque-edit li:first-child input')?.focus(); }
      if (action === 'banque-defaut' && confirm('Remplacer ta banque par la banque proposée ?')) { liste = R.banqueDefaut(B); dessiner(); }
    };
  }

  function effacerAnnee() {
    const a = annee();
    if (!a) return;
    const n = E.eleves.filter((e) => classesAnnee().some((c) => c.id === e.classeId)).length;
    if (!n) return toast('Aucun élève à effacer cette année.');
    const r = prompt(`Effacer les ${pluriel(n, 'élève')} de ${a.nom}, leurs notes, positionnements et appréciations ? Les classes et les évaluations restent. As-tu gardé l'export ?\nÉcris EFFACER pour confirmer.`);
    if (String(r || '').trim().toUpperCase() !== 'EFFACER') return toast('Rien n\'a été effacé.');
    remplacer(R.effacerAnnee(E, a.id), `Élèves et notes de ${a.nom} effacés.`);
  }
  function supprimerAnnee() {
    const a = annee();
    if (!a) return;
    const r = prompt(`Supprimer l'année ${a.nom} entière : périodes, classes, élèves, évaluations et notes ?\nÉcris SUPPRIMER pour confirmer.`);
    if (String(r || '').trim().toUpperCase() !== 'SUPPRIMER') return toast('Rien n\'a été supprimé.');
    remplacer(R.supprimerAnnee(E, a.id), `Année ${a.nom} supprimée.`);
  }

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const r = E.reglages;
    const src = B.source;
    const ko = Math.round(R.taille(E) / 1000);
    const corps = `
      <div class="groupe" style="border:0;padding:0"><h3>Affichage et alertes</h3>
        <div class="rang-champs"><label class="champ">Décimales des moyennes<select name="decimales"><option value="2" ${r.decimales === 2 ? 'selected' : ''}>2 (12,35)</option><option value="1" ${r.decimales === 1 ? 'selected' : ''}>1 (12,4)</option></select></label><label class="champ">Longueur conseillée d'une appréciation<input name="longueurAppreciation" inputmode="numeric" value="${r.longueurAppreciation}"></label><label class="champ">Appréciations à rédiger (jours avant la fin de période)<input name="alerteJours" inputmode="numeric" value="${r.alerteJours}"></label></div></div>
      <div class="groupe"><h3>Données d'élèves <span class="etiquette jaune">À lire</span></h3>${TEXTE_RGPD.replace(/<p>/g, '<p class="aide">')}</div>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Exporter</h3><p class="aide">Toutes les notes, une ligne par note (année, classe, période, élève, évaluation, barème, coefficient, note sur 20), pour un tableur (CSV).</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv-tout">Exporter en CSV</button></div></div>
      <div class="groupe"><h3>Sauvegarde et reprise</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : `Tes classes sont enregistrées en ligne avec ta clé (${ko} Ko utilisés sur environ 900). Garde aussi une copie complète sur ton ordinateur, pour la reprendre plus tard.`}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Comment ça marche</h3><p class="aide">Les grands principes de la gestion de classe, en une page.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="tutoriel">Revoir le guide</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute la gestion de classe à ton écran d'accueil pour l'ouvrir comme une application et saisir les notes en salle.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">Domaines du socle commun et échelle à quatre échelons : ${esc(src.titre)}, ${esc(src.editeur)} (${esc(src.url)}), ${esc(src.vigueur)}, consultés le ${esc(src.consulte)}. Banque de phrases, exemple de référentiel et dates de périodes proposées : rédigés pour QME (version ${B.version}), à adapter. Aucun calendrier scolaire intégré. Aucune connexion au logiciel de vie scolaire ni à une autre application.</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const l = R.lireNombre(fd.get('longueurAppreciation')), j = R.lireNombre(fd.get('alerteJours'));
      if (l === null || l < 80 || l > 2000) return 'Longueur d\'appréciation : un nombre entre 80 et 2000.';
      if (j === null || j > 120) return 'Jours avant la fin de période : un nombre entre 0 et 120.';
      E.reglages = R.normaliserReglages({ ...r, decimales: Number(fd.get('decimales')), longueurAppreciation: l, alerteJours: j }, B.reglages);
      sauver(); rendre();
      toast('Réglages enregistrés.');
      return undefined;
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const donnees = JSON.parse(await fichier.text());
        if (!Array.isArray(donnees.classes) || !Array.isArray(donnees.eleves)) throw new Error();
        if (!confirm(`Remplacer tes données actuelles par cette copie (${pluriel(donnees.classes.length, 'classe')}, ${pluriel(donnees.eleves.length, 'élève')}) ?`)) return;
        retenir();
        const vu = E.tutorielVu;
        E = normaliser(donnees); delete E.majLe;
        E.tutorielVu = vu;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.', { libelle: 'Annuler', faire: annuler });
      } catch { toast('Ce fichier n\'est pas une copie valide de la gestion de classe.'); }
    });
  }

  function telecharger(contenu, typeMime, nom) {
    const blob = new Blob([contenu], { type: typeMime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nom;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const fichier = (s) => R.plat(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `gestion-classe-${auj()}.json`);
  const exporterCsvTout = () => telecharger(R.csvTout(E), 'text/csv;charset=utf-8', `notes-${auj()}.csv`);
  function exporterCsvClasse() {
    const cid = classeChoisie();
    const pid = periodeChoisie();
    const a = annee();
    if (!cid) return;
    const pids = pid === 'annee' ? R.bornes(a).map((p) => p.id) : [pid];
    const contenu = pids.map((p) => R.csvClasse(E, cid, a, p)).map((x, i) => (i ? x.replace(/^﻿/, `\r\n${periode(pids[i]).nom}\r\n`) : pid === 'annee' ? x.replace(/^﻿/, `﻿${periode(pids[0]).nom}\r\n`) : x)).join('');
    telecharger(contenu, 'text/csv;charset=utf-8', `notes-${fichier(classe(cid).nom)}-${pid === 'annee' ? fichier(a.nom) : fichier(periode(pid).nom)}.csv`);
  }

  // ---------- Comment ça marche ----------
  // Guide des grands principes : s'ouvre seul une fois par compte (E.tutorielVu, synchronisé avec les
  // données), puis reste accessible par le bouton « ? » de l'en-tête et par les réglages.
  function modaleTutoriel(auto = false) {
    const r = E.reglages;
    const blocs = [
      ['rose', 'Prépare ton année', `Dans <b>Classes</b>, l'année est découpée en périodes dont tu ajustes les dates à celles de ton établissement. Ajoute tes classes et tes groupes, puis leurs élèves&nbsp;: un prénom et l'initiale du nom, ou un pseudonyme, rien de plus.`],
      ['beurre', 'Note tes évaluations', `Chaque évaluation a son barème (sur 10, 20, 40…) et son coefficient. Chaque note est ramenée sur 20, puis pondérée. <b>ABS</b>, <b>NN</b> et dispensé ne comptent pas&nbsp;; une évaluation bonus ne compte que si elle fait monter la moyenne. Moyennes, médiane et répartition se calculent seules.`],
      ['ciel', 'Positionne les compétences', `Associe des compétences du référentiel à une évaluation, puis place chaque élève sur l'un des quatre échelons. Le bilan de la période est la moyenne de ses positionnements, arrondie. Le référentiel se modifie librement.`],
      ['sable', 'Rédige les bulletins', `Dans <b>Bulletins</b>, compose chaque appréciation à partir de la banque de phrases, puis retouche-la (${r.longueurAppreciation}&nbsp;caractères conseillés). Le <b>Tableau de bord</b> te rappelle les notes à saisir, les évaluations des 14 prochains jours et les appréciations à rédiger, dès ${pluriel(r.alerteJours, 'jour')} avant la fin de la période.`],
    ];
    const corps = `
      <p>Les moyennes, les statistiques, le bilan des compétences et les bulletins se calculent tout seuls. Ton rôle&nbsp;: créer tes évaluations, saisir les notes et les positionnements, puis rédiger les appréciations.</p>
      <ol class="tuto">${blocs.map(([t, titre, texte]) => `<li style="--f:var(--${t});--t:var(--${t === 'sable' ? 'encre' : `${t}-texte`})"><b>${titre}</b><span>${texte}</span></li>`).join('')}</ol>
      <p class="aide">Avant de saisir de vraies données d'élèves, vérifie avec ton établissement que cet usage est possible. En fin d'année, exporte puis efface élèves et notes (onglet <b>Classes</b>). ${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes classes sont enregistrées en ligne avec ta clé&nbsp;: tu les retrouves sur tous tes appareils.'} Ce guide reste accessible avec le bouton <b>?</b> en haut de l'écran et dans les réglages.</p>`;
    // Classe tout juste créée : pas encore d'évaluation (ni, parfois, d'élève).
    const c = auto && !E.evaluations.length && E.classes[0];
    const sansEleve = c && !R.elevesDe(E, c.id).length;
    const pied = !c
      ? `<button class="btn primaire" value="ok">${auto ? 'C\'est parti' : 'Compris'}</button>`
      : `<button class="btn primaire" value="${sansEleve ? 'eleves' : 'evaluation'}">${sansEleve ? 'Ajouter mes élèves' : 'Créer ma première évaluation'}</button><button class="btn" value="ok">Fermer</button>`;
    ouvrirModale('Comment ça marche', corps, pied, (_, choix) => {
      if (choix === 'eleves') setTimeout(() => modaleEleves(c.id), 0);
      if (choix === 'evaluation') setTimeout(() => modaleEvaluation(null, c.id), 0);
    });
  }

  // Premier lancement : le guide d'abord, puis (sur téléphone) la fenêtre « Comme une application ».
  function premiersPas() {
    if (E.tutorielVu) return proposerEcranAccueil();
    setTimeout(() => {
      if (!E || E.tutorielVu || modale().open) return;
      E.tutorielVu = true; sauver();
      modaleTutoriel(true);
      modale().addEventListener('close', proposerEcranAccueil, { once: true });
    }, 300);
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
      <p>Enregistre ta gestion de classe sur ton écran d'accueil : elle s'ouvre ensuite d'un geste, en plein écran, comme une application, sans rien télécharger dans un magasin d'applications.</p>
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
  const LISTES = ['periode-', 'eleve-suppr', 'ref-', 'banque-'];
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;
    // Les boutons propres aux listes modifiables d'une modale sont gérés par la modale elle-même.
    if (LISTES.some((p) => action.startsWith(p))) { if (editionListe && modale().open) editionListe(action, el.dataset.i); return; }
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { const vu = E.tutorielVu; stock.suppr(CLE_DEMO); E = donneesDemo(); E.tutorielVu = vu; cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'accueil-suivant': if (!accueil.lu) { ecranAccueil('Coche la case pour confirmer que tu as lu l\'avertissement sur les données d\'élèves.'); break; } accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'tutoriel': modaleTutoriel(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv-tout': exporterCsvTout(); break;
      case 'csv-classe': exporterCsvClasse(); break;
      case 'fermer': modale().close(); break;
      case 'rgpd-lu': E.reglages.rgpdLu = auj(); sauver(); rendre(); break;
      case 'annee': modaleAnnee(id || null); break;
      case 'classe': modaleClasse(id || null); break;
      case 'eleves': modaleEleves(el.dataset.classe); break;
      case 'eleve': modaleEleve(id); break;
      case 'evaluation': modaleEvaluation(id || null, el.dataset.classe); break;
      case 'saisie': modaleSaisie(id); break;
      case 'appreciation': modaleAppreciation(id); break;
      case 'bulletin': modaleBulletin(id); break;
      case 'imprimer-classe': imprimerClasse(); break;
      case 'referentiel': modaleReferentiel(); break;
      case 'banque': modaleBanque(); break;
      case 'effacer-annee': effacerAnnee(); break;
      case 'supprimer-annee': supprimerAnnee(); break;
      case 'aller-notes': filtre.classe = el.dataset.classe; changerVue('notes'); break;
      case 'aller-bulletins': filtre.classe = el.dataset.classe; filtre.periode = ''; changerVue('bulletins'); break;
      default: break;
    }
  });

  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });
  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
    if (!modale().open) rendre(); // la date du jour a pu changer
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
  window.__classe = { etat: () => E, regles: R };
  init();
})();
