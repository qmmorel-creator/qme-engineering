// Tests des règles métier du préparateur d'appel découverte (templates/appel-decouverte/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/appel-decouverte/', import.meta.url);
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.APD;
const B = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));
// Les tableaux viennent d'un autre contexte (vm) : comparer leurs copies JSON.
const eq = (a, b, m) => assert.deepEqual(simple(a), simple(b), m);
const AUJ = '2026-11-13';
const appel = (extra = {}) => R.normaliserAppel({ id: 'x', organisation: 'Organisation test', fonction: 'Direction', date: AUJ, duree: 30, ...extra }, AUJ);
const qs = (phases) => phases.map((p, i) => ({ id: `q${i}`, phase: p, texte: `Question ${i}`, posee: false, reponse: '' }));

test('base : au moins 60 questions, 7 phases, 20 objections, identifiants uniques', () => {
  eq(simple(B.phases.map((p) => p.id)), ['ouverture', 'situation', 'probleme', 'impact', 'decision', 'delais', 'conclusion']);
  assert.equal(B.phases.reduce((s, p) => s + p.poids, 0), 100);
  const toutes = Object.values(B.questions).flat();
  assert.ok(toutes.length >= 60, `${toutes.length} questions`);
  for (const p of B.phases) assert.ok(B.questions[p.id].length >= 8, `phase ${p.id}`);
  assert.equal(new Set(toutes.map((q) => q.id)).size, toutes.length);
  assert.ok(B.objections.length >= 20);
  assert.equal(new Set(B.objections.map((o) => o.id)).size, B.objections.length);
  const cats = new Set(B.categoriesObjections.map((c) => c.id));
  for (const o of B.objections) { assert.ok(cats.has(o.cat), o.id); assert.ok(o.piste.length > 20 && o.relance.endsWith('?'), o.id); }
  for (const q of toutes) assert.ok(!q.signal || R.SIGNAUX.includes(q.signal), q.id);
  // Chaque phase a au moins une question essentielle ; chaque signal est éclairé par au moins 3 questions.
  for (const p of B.phases) assert.ok(B.questions[p.id].some((q) => q.essentielle), p.id);
  for (const s of R.SIGNAUX) assert.ok(toutes.filter((q) => q.signal === s).length >= 3, s);
});

test('base : aucune marque ni contenu tiers, aucun lien externe', () => {
  const tout = readFileSync(new URL('donnees.js', dossier), 'utf8') + readFileSync(new URL('app.js', dossier), 'utf8');
  for (const m of ['Salesforce', 'HubSpot', 'Pipedrive', 'LinkedIn', 'Zoom', 'Teams', 'Google', 'Gmail', 'Outlook', 'WhatsApp', 'Calendly', 'SPIN', 'BANT', 'Sandler', 'CNR', 'Vensolair', 'Nexora']) {
    assert.ok(!new RegExp(`\\b${m}\\b`).test(tout), `marque ou méthode déposée trouvée : ${m}`);
  }
  assert.ok(!/mailto:|tel:|https?:\/\/(?!qm-engineering)/.test(tout.replace(/https:\/\/qm-engineering\.fr[^\s'"`]*/g, '')), 'lien externe trouvé');
});

test('qualification : règle explicite des points et des niveaux', () => {
  eq(simple(R.POINTS), { inconnu: 0, non: 0, partiel: 1, oui: 2 });
  const q = (besoin, budget, decideur, echeance) => R.qualification({ besoin: { niveau: besoin }, budget: { niveau: budget }, decideur: { niveau: decideur }, echeance: { niveau: echeance } });
  assert.equal(q('oui', 'oui', 'oui', 'oui').total, 8);
  assert.equal(q('oui', 'oui', 'oui', 'oui').niveau, 'qualifie');
  assert.equal(q('oui', 'oui', 'partiel', 'partiel').niveau, 'qualifie'); // 6 points, besoin oui
  assert.equal(q('partiel', 'oui', 'oui', 'oui').total, 7);
  assert.equal(q('partiel', 'oui', 'oui', 'oui').niveau, 'a-creuser'); // 7 points mais besoin pas explicite
  assert.equal(q('oui', 'partiel', 'partiel', 'inconnu').niveau, 'a-creuser'); // 4 points
  assert.equal(q('oui', 'partiel', 'inconnu', 'inconnu').niveau, 'a-creuser'); // 3 points : seuil
  assert.equal(q('partiel', 'partiel', 'inconnu', 'non').niveau, 'froid'); // 2 points
  assert.equal(q('non', 'oui', 'oui', 'oui').niveau, 'hors-cible'); // pas de besoin : hors cible quel que soit le reste
  assert.equal(R.qualification({}).niveau, 'froid');
  eq(simple(R.qualification({}).inconnus), ['besoin', 'budget', 'decideur', 'echeance']);
  // Valeurs inattendues ramenées à « inconnu » ; chaîne simple acceptée.
  assert.equal(R.qualification({ besoin: 'oui', budget: { niveau: 'peut-être' } }).total, 2);
});

test('préparation et état d\'un appel', () => {
  const vide = appel({ fonction: '' });
  eq(simple(R.preparation(vide).manques), ['objectif', 'fonction', 'questions']);
  assert.equal(R.etat(vide, AUJ), 'a-preparer');
  const pret = appel({ objectif: 'Comprendre le besoin', questions: qs(['ouverture', 'situation', 'conclusion']) });
  assert.ok(R.preparation(pret).pret);
  assert.equal(R.etat(pret, AUJ), 'pret'); // le jour même : encore à venir
  assert.equal(R.etat({ ...pret, date: '2026-11-12' }, AUJ), 'a-cloturer');
  assert.equal(R.etat({ ...pret, statut: 'fait', date: '2026-11-12' }, AUJ), 'fait');
  assert.equal(R.etat({ ...pret, statut: 'annule' }, AUJ), 'annule');
});

test('prochaine étape : en retard, du jour, faite, sans date', () => {
  const fait = (prochaine) => appel({ statut: 'fait', date: '2026-11-01', prochaine });
  assert.ok(R.etapeEnRetard(fait({ texte: 'Envoyer la note', date: '2026-11-12' }), AUJ));
  assert.ok(!R.etapeEnRetard(fait({ texte: 'Envoyer la note', date: AUJ }), AUJ)); // aujourd'hui : pas encore en retard
  assert.ok(!R.etapeEnRetard(fait({ texte: 'Envoyer la note', date: '2026-11-12', faite: true }), AUJ));
  assert.ok(!R.etapeEnRetard(fait({ texte: '', date: '2026-11-12' }), AUJ));
  assert.ok(!R.etapeEnRetard({ ...fait({ texte: 'X', date: '2026-11-12' }), statut: 'annule' }, AUJ));
  assert.ok(R.sansEtapeDatee(fait({ texte: 'Rappeler', date: null })));
  assert.ok(R.sansEtapeDatee(fait({ texte: '', date: null })));
  assert.ok(!R.sansEtapeDatee(fait({ texte: 'Rappeler', date: '2026-12-01' })));
});

test('classement de la liste et compteurs', () => {
  const prete = { objectif: 'O', questions: qs(['ouverture', 'situation', 'conclusion']) };
  const liste = [
    appel({ id: 'demain', date: '2026-11-14', ...prete }),
    appel({ id: 'auj', date: AUJ, heure: '14:00', ...prete }),
    appel({ id: 'auj-matin', date: AUJ, heure: '09:00' }),
    appel({ id: 'loin', date: '2026-12-20', ...prete }),
    appel({ id: 'hier', date: '2026-11-12', ...prete }),
    appel({ id: 'fait-retard', date: '2026-11-01', statut: 'fait', prochaine: { texte: 'Relancer', date: '2026-11-10' }, signaux: { besoin: 'oui', budget: 'oui', decideur: 'oui', echeance: 'oui' } }),
    appel({ id: 'fait-recent', date: '2026-11-11', statut: 'fait', prochaine: { texte: 'Proposition', date: '2026-11-20' } }),
    appel({ id: 'annule', date: '2026-11-05', statut: 'annule' }),
  ];
  const c = R.classer(liste, AUJ);
  eq(c.aVenir.map((a) => a.id), ['auj-matin', 'auj', 'demain', 'loin']);
  eq(c.aCloturer.map((a) => a.id), ['hier']);
  eq(c.faits.map((a) => a.id), ['fait-recent', 'fait-retard']);
  eq(c.enRetard.map((a) => a.id), ['fait-retard']);
  eq(c.annules.map((a) => a.id), ['annule']);
  const n = R.compteurs(liste, AUJ);
  assert.equal(n.aPreparer, 1);
  assert.equal(n.prets, 3);
  assert.equal(n.semaine, 3); // aujourd'hui (2) et demain ; pas le 20/12
  assert.equal(n.enRetard, 1);
  assert.equal(n.aCloturer, 1);
  assert.equal(n.qualifies, 1);
});

test('plan minuté : répartition au prorata, somme exacte, plus fort reste', () => {
  const toutes = qs(B.phases.map((p) => p.id));
  const p = R.plan(toutes, 30, B.phases);
  // Bruts : 3 ; 7,5 ; 6 ; 4,5 ; 4,5 ; 1,5 ; 3 → planchers 28, les 2 minutes restantes vont aux premiers ,5.
  eq(p.phases.map((l) => l.minutes), [3, 8, 6, 5, 4, 1, 3]);
  assert.equal(p.phases.reduce((s, l) => s + l.minutes, 0), 30);
  eq(p.phases.map((l) => l.debut), [0, 3, 11, 17, 22, 26, 27]);
  assert.equal(p.phases.at(-1).fin, 30);
  for (const d of [15, 20, 45, 60, 90, 7]) assert.equal(R.plan(toutes, d, B.phases).phases.reduce((s, l) => s + l.minutes, 0), d, `durée ${d}`);
  // Durée courte : chaque phase garde au moins 1 minute.
  assert.ok(R.plan(toutes, 7, B.phases).phases.every((l) => l.minutes === 1));
  // Seules les phases qui ont des questions reçoivent du temps.
  const deux = R.plan(qs(['ouverture', 'conclusion', 'conclusion']), 20, B.phases);
  eq(deux.phases.map((l) => [l.phase, l.minutes, l.nb]), [['ouverture', 10, 1], ['conclusion', 10, 2]]);
  assert.equal(deux.phases[1].parQuestion, 5);
});

test('plan minuté : capacité, alertes et phase en cours', () => {
  assert.equal(R.plan([], 30, B.phases).alerte, 'vide');
  assert.equal(R.plan(qs(Array(15).fill('situation')), 30, B.phases).alerte, null); // 15 questions = 30 min
  assert.equal(R.plan(qs(Array(16).fill('situation')), 30, B.phases).alerte, 'trop');
  assert.equal(R.plan(qs(['situation']), 30, B.phases).capacite, 15);
  const p = R.plan(qs(B.phases.map((x) => x.id)), 30, B.phases);
  assert.equal(R.phaseA(p, 0).phase, 'ouverture');
  assert.equal(R.phaseA(p, 2.9).phase, 'ouverture');
  assert.equal(R.phaseA(p, 3).phase, 'situation');
  assert.equal(R.phaseA(p, 29).phase, 'conclusion');
  assert.ok(R.phaseA(p, 31).depasse);
  assert.equal(R.phaseA(R.plan([], 30, B.phases), 3), null);
});

test('questions : regroupement, déplacement dans la phase, ajout sans doublon, avancement', () => {
  let l = [
    { id: 'a', phase: 'situation' }, { id: 'b', phase: 'ouverture' }, { id: 'c', phase: 'situation' }, { id: 'd', phase: 'situation' },
  ];
  eq(R.parPhase(l, B.phases).map((g) => [g.phase.id, g.questions.map((q) => q.id).join('')]), [['ouverture', 'b'], ['situation', 'acd']]);
  l = R.deplacer(l, 'c', -1); // saute la question d'une autre phase
  eq(l.map((q) => q.id), ['c', 'b', 'a', 'd']);
  eq(R.deplacer(l, 'c', -1).map((q) => q.id), ['c', 'b', 'a', 'd']); // déjà en tête
  eq(R.deplacer(l, 'd', 1).map((q) => q.id), ['c', 'b', 'a', 'd']); // déjà en fin
  eq(R.deplacer(l, 'a', 1).map((q) => q.id), ['c', 'b', 'd', 'a']);
  let qq = R.ajouterQuestion([], { ref: 'si-01', texte: ' Comment ? ', phase: 'situation' }, 'n1');
  qq = R.ajouterQuestion(qq, { ref: 'si-01', texte: 'Comment ?', phase: 'situation' }, 'n2');
  qq = R.ajouterQuestion(qq, { texte: 'Perso', phase: 'impact' }, 'n3');
  eq(simple(qq.map((q) => [q.id, q.texte, q.ref])), [['n1', 'Comment ?', 'si-01'], ['n3', 'Perso', null]]);
  eq(simple(R.avancement([{ posee: true }, { posee: false }, { posee: true }])), { posees: 2, total: 3, pourcent: 67 });
  assert.equal(R.avancement([]).pourcent, 0);
});

test('conservation RGPD : appels à effacer après 36 mois sans activité', () => {
  const liste = [
    appel({ id: 'vieux', statut: 'fait', date: '2023-10-01' }),
    appel({ id: 'vieux-annule', statut: 'annule', date: '2023-01-15' }),
    appel({ id: 'vieux-etape-recente', statut: 'fait', date: '2023-10-01', prochaine: { texte: 'Relance', date: '2024-02-01', faite: true } }),
    appel({ id: 'vieux-etape-ouverte', statut: 'fait', date: '2023-01-01', prochaine: { texte: 'Relance', date: '2023-02-01' } }),
    appel({ id: 'limite', statut: 'fait', date: '2023-11-13' }),
    appel({ id: 'prevu-vieux', statut: 'prevu', date: '2023-01-01' }),
    appel({ id: 'recent', statut: 'fait', date: '2026-10-01' }),
  ];
  eq(R.aEffacer(liste, AUJ, 36).map((a) => a.id), ['vieux', 'vieux-annule']);
  assert.equal(R.derniereActivite(liste[2]), '2024-02-01');
  eq(R.aEffacer(liste, AUJ, 12).map((a) => a.id), ['vieux', 'vieux-annule', 'vieux-etape-recente', 'limite']);
});

test('compte rendu : texte complet, sans données vides', () => {
  const a = appel({
    organisation: 'Fabricant de pièces', secteur: 'Industrie', taille: 'me', prenom: 'Claire', fonction: 'Direction de production', canal: 'visio', duree: 45, date: '2026-11-02',
    objectif: 'Comprendre les arrêts de ligne',
    synthese: 'Besoin réel, décision en comité.',
    questions: [{ id: '1', phase: 'probleme', texte: 'Qu\'est-ce qui coince ?', posee: true, reponse: 'Les changements de série.' }, { id: '2', phase: 'situation', texte: 'Non posée', posee: false, reponse: 'ignorée' }, { id: '3', phase: 'situation', texte: 'Posée sans réponse', posee: true }],
    hypotheses: [{ texte: 'Ils ont un outil maison', resultat: 'confirmee' }, { texte: '', resultat: 'infirmee' }],
    signaux: { besoin: { niveau: 'oui', note: 'arrêts chaque semaine' }, budget: { niveau: 'partiel' }, decideur: { niveau: 'oui' }, echeance: { niveau: 'oui' } },
    objections: [{ texte: 'Je dois en parler à ma direction.', note: 'Comité le 20.' }],
    prochaine: { texte: 'Envoyer la proposition', date: '2026-11-20' },
  });
  const t = R.compteRendu(a, B);
  assert.match(t, /^Compte rendu · appel découverte du lundi 2 novembre 2026/);
  assert.match(t, /Organisation : Fabricant de pièces \(Industrie, 50 à 249 salariés\)/);
  assert.match(t, /Interlocuteur : Claire, Direction de production/);
  assert.match(t, /Format : Visio, 45 min/);
  assert.match(t, /Qualification : 7\/8, qualifié/);
  assert.match(t, /- Besoin : Explicite et prioritaire \(arrêts chaque semaine\)/);
  assert.match(t, /Problème\n- Qu'est-ce qui coince \? Les changements de série\./);
  assert.ok(!t.includes('ignorée') && !t.includes('Posée sans réponse'));
  assert.match(t, /- Ils ont un outil maison : confirmée/);
  assert.match(t, /Objections entendues\n- Je dois en parler à ma direction\. Comité le 20\./);
  assert.match(t, /Prochaine étape : Envoyer la proposition, le vendredi 20 novembre 2026$/);
  assert.ok(!/mailto|https?:/.test(t));
  const minimal = R.compteRendu(appel({ prenom: '', fonction: '', taille: '', secteur: '' }), B);
  assert.ok(!minimal.includes('Interlocuteur') && !minimal.includes('()'));
  assert.match(minimal, /Prochaine étape : à définir$/);
});

test('dates et durées : formats français', () => {
  assert.equal(R.dateLongue('2026-11-13'), 'vendredi 13 novembre 2026');
  assert.equal(R.dateLongue('2026-12-01', { jour: false, annee: false }), '1er décembre');
  assert.equal(R.dateLongue('2026-02-30'), '');
  assert.equal(R.duree(45), '45 min');
  assert.equal(R.duree(60), '1 h');
  assert.equal(R.duree(90), '1 h 30');
  assert.equal(R.chrono(65), '01:05');
  assert.equal(R.chrono(3725), '1:02:05');
  assert.equal(R.ajoutMois('2026-03-31', -1), '2026-02-28');
  assert.ok(R.estHeure('09:30') && !R.estHeure('24:00') && !R.estHeure('9:30'));
});

test('normalisation tolérante des anciennes données', () => {
  const e = R.normaliser({ prenom: 'Sam', reglages: { dureeDefaut: 'x' }, appels: [{ organisation: 'A'.repeat(300), date: 'hier', heure: '25:00', duree: 9999, canal: 'fax', statut: '??', signaux: { besoin: 'oui', budget: { niveau: 'bof' } }, hypotheses: [{ texte: 'H', resultat: 'zz' }], questions: [{ texte: 'Q' }], prochaine: 'texte' }], mesQuestions: [{ texte: 'Ma question', phase: 'impact' }] }, AUJ);
  const a = e.appels[0];
  assert.equal(e.reglages.dureeDefaut, 30);
  assert.equal(a.organisation.length, 120);
  assert.equal(a.date, AUJ);
  assert.equal(a.heure, '');
  assert.equal(a.duree, 240);
  assert.equal(a.canal, 'telephone');
  assert.equal(a.statut, 'prevu');
  assert.equal(a.signaux.besoin.niveau, 'oui');
  assert.equal(a.signaux.budget.niveau, 'inconnu');
  assert.equal(a.signaux.echeance.niveau, 'inconnu');
  assert.equal(a.hypotheses[0].resultat, 'a-verifier');
  assert.equal(a.questions[0].posee, false);
  eq(simple(a.prochaine), { texte: '', date: null, faite: false });
  assert.equal(e.mesQuestions[0].phase, 'impact');
  eq(simple(R.normaliser(null, AUJ)), simple(R.etatVide()));
});
