// Tests des règles métier du template Candidatures études, stages, alternance (templates/candidatures/regles.js
// et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/candidatures/', import.meta.url);
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.CAN;
const BASE = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));
const eq = (a, b, m) => assert.deepEqual(simple(a), simple(b), m);
const AUJ = '2026-11-14';
const j = (n) => R.ajout(AUJ, n);
const C = (x = {}) => R.normaliserCandidature({ type: 'stage', intitule: 'Stage', organisme: 'Ardelis', ...x }, BASE);
const P = (ref, statut, x = {}) => R.normaliserPiece({ ref, statut, ...x }, BASE);

// Aucune plateforme de candidature nommée, ni dans la base ni dans l'interface (fiche T89).
const MARQUES = /parcoursup|mon ?master|trouver ?mon ?master|e-?candidat|fiche avenir|campus ?france|linkedin|indeed|jobteaser|hellowork|welcome to the jungle|monster|apec\b|france travail|p[oô]le emploi|l'?etudiant\.fr|studyrama|1jeune1solution|la bonne alternance/i;

test('base : types, statuts, pièces, listes de départ, questions, trames cohérents', () => {
  eq(BASE.types.map((t) => t.id), ['formation', 'stage', 'alternance', 'job']);
  eq(BASE.statuts.map((s) => s.id), R.STATUTS);
  eq(BASE.statutsPiece.map((s) => s.id), R.STATUTS_PIECE);
  const ids = BASE.pieces.map((x) => x.id);
  assert.equal(new Set(ids).size, ids.length, 'pièces uniques');
  for (const m of BASE.modeles) for (const id of m.pieces) assert.ok(R.pieceDe(BASE, id), `${m.id} : ${id}`);
  for (const t of R.TYPES) assert.ok(BASE.modeles.some((m) => m.type === t), `liste de départ pour ${t}`);
  for (const t of R.TYPES) assert.ok(R.modeleDe(BASE, R.modeleParDefaut(t)), `modèle par défaut ${t}`);
  const qids = BASE.questions.map((x) => x.id);
  assert.equal(new Set(qids).size, qids.length, 'questions uniques');
  assert.ok(BASE.questions.length >= 30);
  for (const x of BASE.questions) {
    assert.ok(BASE.themes.some((t) => t.id === x.theme), `thème de ${x.id}`);
    assert.ok(x.piste && x.texte.endsWith('?') || x.texte.endsWith('.'), `question ${x.id}`);
    for (const t of x.pour) assert.ok(R.TYPES.includes(t), `type ${t} de ${x.id}`);
  }
  for (const t of R.TYPES) assert.ok(BASE.trames.some((x) => x.type === t), `trame ${t}`);
  for (const tr of BASE.trames) {
    const utilises = new Set([...[tr.objet, ...tr.paragraphes].join(' ').matchAll(/\{([a-z0-9]+)\}/g)].map((m) => m[1]));
    for (const ch of tr.champs) assert.ok(utilises.has(ch.id), `${tr.id} : champ ${ch.id} utilisé`);
    for (const k of utilises) assert.ok(tr.champs.some((ch) => ch.id === k) || ['organisme', 'intitule', 'signature'].includes(k), `${tr.id} : {${k}} déclaré`);
  }
});

test('base : aucune date, aucun calendrier officiel, aucune plateforme nommée', () => {
  const texte = readFileSync(new URL('donnees.js', dossier), 'utf8');
  const sansVersion = JSON.stringify({ ...BASE, version: '' });
  assert.ok(!/\b20\d\d\b/.test(sansVersion), 'aucune année dans la base');
  assert.ok(!/\b\d{1,2}\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\b/i.test(sansVersion), 'aucune date du calendrier');
  assert.ok(!MARQUES.test(texte), 'donnees.js sans marque');
  for (const f of ['app.js', 'index.html', 'manifest.webmanifest']) assert.ok(!MARQUES.test(readFileSync(new URL(f, dossier), 'utf8')), `${f} sans marque`);
  assert.ok(!MARQUES.test(readFileSync(new URL('../../catalogue/candidatures/index.html', import.meta.url), 'utf8')), 'page catalogue sans marque');
});

test('normalisation tolérante', () => {
  const e = R.normaliser({ profil: { prenom: '  Noa ' }, reglages: { alerte: 999, relance: 'x' }, candidatures: [{ type: 'inconnu', statut: 'bof', rang: -2, dates: { limite: '2026-02-30', heure: '25:00' }, pieces: [{ ref: 'cv', statut: 'zz' }, { nom: 'Libre', apres: true }], lien: 'javascript:alert(1)' }] }, BASE);
  assert.equal(e.profil.prenom, 'Noa');
  eq(e.reglages, { alerte: R.ALERTE_DEFAUT, relance: R.RELANCE_DEFAUT });
  const c = e.candidatures[0];
  assert.equal(c.type, 'formation');
  assert.equal(c.statut, 'preparer');
  assert.equal(c.rang, null);
  assert.equal(c.dates.limite, null);
  assert.equal(c.dates.heure, '');
  assert.equal(c.lien, '');
  assert.equal(c.pieces[0].nom, 'CV');
  assert.equal(c.pieces[0].statut, 'afaire');
  assert.equal(c.pieces[1].apres, true);
  assert.equal(R.normaliser(null, BASE).candidatures.length, 0);
  // Pièce type « après acceptation » reprise de la base
  assert.equal(P('convention', 'afaire').apres, true);
});

test('pièces : avancement, après acceptation, cycle de statut', () => {
  const c = C({ pieces: [P('cv', 'prete'), P('lm', 'encours'), P('releves', 'envoyee'), P('convention', 'afaire')] });
  eq(R.avancement(c), { total: 3, pretes: 2, envoyees: 1, manquantes: 1, pct: 67, apres: 1 });
  eq(R.piecesManquantes(c).map((x) => x.ref), ['lm']);
  const acc = { ...c, statut: 'acceptee' };
  assert.equal(R.avancement(acc).total, 4);
  assert.equal(R.avancement(acc).manquantes, 2);
  assert.equal(R.avancement(C({ pieces: [] })).pct, 100);
  eq(['afaire', 'encours', 'prete', 'envoyee'].map(R.pieceSuivante), ['encours', 'prete', 'envoyee', 'afaire']);
  eq(R.piecesDuModele(BASE, 'stage').map((x) => x.ref), ['cv', 'lm', 'releves', 'portfolio', 'responsabilite', 'convention']);
});

test('changement de statut et ses effets', () => {
  const c = C({ pieces: [P('cv', 'prete'), P('lm', 'afaire'), P('convention', 'prete')] });
  const e = R.changerStatut(c, 'envoyee', AUJ);
  assert.equal(e.dates.envoi, AUJ);
  eq(e.pieces.map((x) => x.statut), ['envoyee', 'afaire', 'prete'], 'pièces prêtes envoyées, sauf après acceptation');
  assert.equal(c.statut, 'preparer', 'objet d\'origine intact');
  const deja = R.changerStatut(C({ dates: { envoi: j(-3) } }), 'envoyee', AUJ);
  assert.equal(deja.dates.envoi, j(-3), 'date d\'envoi saisie conservée');
  assert.equal(R.changerStatut(e, 'acceptee', AUJ).dates.recue, AUJ);
  assert.equal(R.changerStatut(e, 'attente', AUJ).dates.recue, AUJ);
  assert.equal(R.changerStatut(e, 'entretien', AUJ).dates.recue, null);
  assert.equal(R.changerStatut(R.changerStatut(e, 'refusee', AUJ), 'preparer', AUJ).dates.recue, null);
  assert.equal(R.changerStatut(e, 'nimporte', AUJ), e);
});

test('relances : délai sans nouvelles, réponse attendue dépassée, remerciement', () => {
  // Stage envoyé il y a 12 jours, délai 10 : relance due.
  const s = C({ statut: 'envoyee', dates: { envoi: j(-12) } });
  const r = R.relance(s, AUJ, 10);
  assert.equal(r.raison, 'delai'); assert.ok(r.due); assert.equal(r.jours, 12); assert.equal(r.date, j(-2));
  // Relance faite il y a 3 jours : la prochaine dans 7 jours.
  const s2 = C({ statut: 'envoyee', dates: { envoi: j(-12) }, relances: [{ date: j(-3), canal: 'email' }] });
  const r2 = R.relance(s2, AUJ, 10);
  assert.ok(!r2.due); assert.equal(r2.date, j(7));
  // Formation : seulement après la date de réponse annoncée.
  const f = C({ type: 'formation', statut: 'envoyee', dates: { envoi: j(-40) } });
  assert.equal(R.relance(f, AUJ, 10), null);
  const f2 = C({ type: 'formation', statut: 'envoyee', dates: { envoi: j(-40), reponse: j(-2) } });
  eq(R.relance(f2, AUJ, 10), { date: j(-1), raison: 'reponse', due: true, jours: 2 });
  // Date de réponse à venir : on attend, même hors formation.
  assert.equal(R.relance(C({ statut: 'envoyee', dates: { envoi: j(-30), reponse: j(5) } }), AUJ, 10), null);
  // Entretien passé sans message depuis : remerciement ; à venir : rien.
  const en = C({ statut: 'entretien', dates: { envoi: j(-20), entretien: j(-1) } });
  assert.equal(R.relance(en, AUJ, 10).raison, 'remerciement');
  const apresMerci = R.relance({ ...en, relances: [{ id: 'r', date: j(-1), canal: 'email', note: '' }] }, AUJ, 10);
  eq([apresMerci.raison, apresMerci.due, apresMerci.date], ['delai', false, j(9)], 'après le remerciement, délai ordinaire');
  assert.equal(R.relance(C({ statut: 'entretien', dates: { envoi: j(-20), entretien: j(2) } }), AUJ, 10), null);
  // Réponse reçue ou statut final : rien.
  // Liste d'attente : le délai part de la mise en attente ; la date de réponse définitive passée déclenche la relance.
  const att = R.relance(C({ statut: 'attente', dates: { envoi: j(-30), recue: j(-1) } }), AUJ, 10);
  eq([att.raison, att.due, att.date], ['delai', false, j(9)]);
  assert.equal(R.relance(C({ type: 'formation', statut: 'attente', dates: { envoi: j(-30), recue: j(-10), reponse: j(-1) } }), AUJ, 10).raison, 'reponse');
  assert.equal(R.relance(C({ statut: 'acceptee', dates: { envoi: j(-30), recue: j(-1) } }), AUJ, 10), null);
  assert.equal(R.relance(C({ statut: 'refusee', dates: { envoi: j(-30) } }), AUJ, 10), null);
  assert.equal(R.relance(C({ statut: 'preparer' }), AUJ, 10), null);
});

test('échéances : natures, niveaux, tri, à envoyer', () => {
  const a = C({ id: 'a', statut: 'preparer', dates: { limite: j(2) }, pieces: [P('cv', 'afaire')] });
  const b = C({ id: 'b', statut: 'preparer', dates: { limite: j(-1) } });
  const c = C({ id: 'c', statut: 'entretien', dates: { envoi: j(-10), entretien: j(2), heure: '09:00', reponse: j(20) } });
  const d = C({ id: 'd', statut: 'envoyee', dates: { envoi: j(-15) } });
  const e = C({ id: 'e', statut: 'preparer', dates: { limite: j(40) } });
  const f = C({ id: 'f', statut: 'acceptee', dates: { envoi: j(-20), entretien: j(5), recue: j(-2) } });
  const evs = R.evenements([a, b, c, d, e, f], AUJ, { alerte: 7, relance: 10 });
  eq(evs.map((x) => `${x.cand.id}:${x.nature}:${x.niveau}`), ['b:limite:depasse', 'd:relance:urgent', 'a:limite:urgent', 'c:entretien:urgent', 'c:reponse:loin', 'e:limite:loin']);
  assert.equal(evs.find((x) => x.nature === 'entretien').heure, '09:00');
  assert.equal(R.evenements([a, b, c, d, e], AUJ, {}, { horizon: 14 }).length, 4);
  eq(R.aEnvoyer([a, b, c, d, e], AUJ, { alerte: 7 }).map((x) => [x.cand.id, x.jours]), [['b', -1], ['a', 2]]);
  eq(R.parMois([{ date: '2026-11-20' }, { date: '2026-11-30' }, { date: '2026-12-01' }]).map((g) => [g.mois, g.liste.length]), [['2026-11', 2], ['2026-12', 1]]);
  assert.equal(R.niveau(5, 7), 'proche');
  assert.equal(R.niveau(8, 7), 'loin');
});

test('classement des vœux par type', () => {
  const l = [
    C({ id: 'f1', type: 'formation', rang: 1 }), C({ id: 'f2', type: 'formation', rang: 2 }), C({ id: 'f3', type: 'formation' }),
    C({ id: 's1', type: 'stage', rang: 1 }), C({ id: 'f4', type: 'formation', rang: 3, statut: 'refusee' }),
  ];
  const ordre = (liste, t) => R.classement(liste, t).classees.map((c) => c.id);
  eq(ordre(l, 'formation'), ['f1', 'f2'], 'refusée hors classement');
  eq(R.classement(l, 'formation').autres.map((c) => c.id), ['f3']);
  const l2 = R.deplacer(l, 'f2', -1);
  eq(ordre(l2, 'formation'), ['f2', 'f1']);
  eq(ordre(l2, 'stage'), ['s1'], 'autres types intacts');
  const l3 = R.deplacer(l2, 'f3', 0);
  eq(ordre(l3, 'formation'), ['f2', 'f1', 'f3'], 'non classée ajoutée en dernier');
  eq(ordre(R.deplacer(l3, 'f3', -5), 'formation'), ['f3', 'f2', 'f1'], 'borné en tête');
  const l4 = R.retirerDuClassement(l3, 'f1');
  eq(ordre(l4, 'formation'), ['f2', 'f3']);
  eq(l4.filter((c) => c.type === 'formation' && c.rang).map((c) => c.rang).sort(), [1, 2], 'rangs resserrés');
  assert.equal(l4.find((c) => c.id === 'f4').rang, null, 'refusée sans rang');
  const trous = [C({ id: 'x', type: 'job', rang: 2 }), C({ id: 'y', type: 'job', rang: 5 })];
  eq(R.resserrer(trous).map((c) => c.rang), [1, 2]);
  eq(R.deplacer(l, 'f4', -1).map((c) => c.rang), l.map((c) => c.rang), 'refusée non déplaçable');
});

test('bilan et tri', () => {
  const l = [
    C({ statut: 'preparer', dates: { limite: j(3) }, pieces: [P('cv', 'afaire'), P('lm', 'prete')] }),
    C({ statut: 'envoyee', dates: { envoi: j(-20) } }),
    C({ statut: 'acceptee' }), C({ statut: 'refusee' }), C({ statut: 'attente' }),
    C({ statut: 'entretien', dates: { entretien: j(1), envoi: j(-5) } }),
  ];
  const b = R.bilan(l, AUJ, { alerte: 7, relance: 10 });
  assert.equal(b.total, 6); assert.equal(b.actives, 4); assert.equal(b.aEnvoyer, 1); assert.equal(b.entretiens, 1);
  assert.equal(b.relances, 1); assert.equal(b.manquantes, 1); assert.equal(b.reponses, 3); assert.equal(b.envoyees, 5);
  const tri = R.trier(l, AUJ).map((c) => c.statut);
  eq(tri.slice(0, 4).sort(), ['entretien', 'envoyee', 'preparer', 'attente'].sort());
  eq(tri.slice(4), ['acceptee', 'refusee']);
});

test('recherche sans accents ni pluriel', () => {
  const l = [C({ organisme: 'Université de Sorvanne', ville: 'Lyon', intitule: 'Master économie' }), C({ organisme: 'Ardelis', pieces: [P('portfolio', 'afaire')] })];
  assert.equal(R.rechercher(l, 'universite lyon').length, 1);
  assert.equal(R.rechercher(l, 'economies').length, 1);
  assert.equal(R.rechercher(l, 'portfolio').length, 1);
  assert.equal(R.rechercher(l, '').length, 2);
});

test('lettre : trame remplie, champs manquants signalés, signature', () => {
  const tr = R.trameDe(BASE, 'stage');
  const c = C({ intitule: 'Stage analyste', organisme: 'Ardelis', lettre: { trame: 'stage', champs: { situation: 'en licence', periode: 'de six mois' } } });
  const l = R.composerLettre(c, tr, { signature: 'Noa Lefèvre' });
  assert.ok(l.texte.startsWith('Objet : Candidature pour un stage : Stage analyste'));
  assert.ok(l.texte.includes('Actuellement en licence, je recherche un stage de six mois.'));
  assert.ok(l.texte.includes('[à compléter : interet]'));
  assert.ok(l.texte.trim().endsWith('Noa Lefèvre'));
  eq(l.manquants.map((m) => m.id).sort(), ['apprendre', 'competence', 'interet']);
  const sans = R.composerLettre(C({ organisme: '', lettre: { trame: 'job' } }), R.trameDe(BASE, 'job'), {});
  assert.ok(sans.manquants.some((m) => m.id === 'organisme'));
  assert.ok(sans.manquants.some((m) => m.id === 'signature'));
  assert.equal(R.trameConseillee(BASE, C({ type: 'alternance' })), 'alternance');
  assert.equal(R.composerLettre(c, null).texte, '');
});

test('messages de relance', () => {
  const c = C({ type: 'formation', intitule: 'Master X', organisme: 'Institut Kerval', dates: { envoi: '2026-10-25' } });
  const m = R.messageRelance(BASE, c, { prenom: 'Noa' }, (d) => `le ${d}`);
  assert.ok(m.includes('formation Master X'));
  assert.ok(m.includes('le 2026-10-25'));
  assert.ok(m.trim().endsWith('Noa'));
  const merci = R.messageRelance(BASE, C({ intitule: 'Stage', organisme: 'Ardelis', dates: { entretien: '2026-11-12' } }), { signature: 'N. L.' }, (d) => d, 'remerciement');
  assert.ok(merci.startsWith('Bonjour,\n\nMerci pour l\'entretien du 2026-11-12'));
  assert.ok(!/\{[a-z]+\}/.test(merci));
});

test('entretien : questions par type, préparation', () => {
  const st = R.questionsPour(BASE, 'stage').flatMap((g) => g.questions.map((q) => q.id));
  assert.ok(st.includes('mot3') && !st.includes('mot1') && st.includes('pres1'));
  const fo = R.questionsPour(BASE, 'formation').flatMap((g) => g.questions.map((q) => q.id));
  assert.ok(fo.includes('mot1') && !fo.includes('mot2'));
  const c = C({ entretien: { questions: [{ ref: 'pres1', notes: 'Une phrase assez longue pour compter.' }, { ref: 'mot3', prete: true }, { ref: 'qua2' }, { texte: '' }] } });
  assert.equal(c.entretien.questions.length, 3, 'question vide écartée');
  eq(R.preparation(c), { total: 3, pretes: 2 });
});

test('secrets refusés dans les champs libres', () => {
  assert.equal(R.contientSecret('mot de passe : azerty'), 'secret');
  assert.equal(R.contientSecret('MDP=abc'), 'secret');
  assert.equal(R.contientSecret('Identifiant de connexion : noa.l'), 'secret');
  assert.equal(R.contientSecret('4970 1012 3456 7890'), 'numero');
  assert.equal(R.contientSecret('Service des admissions, bureau 204'), '');
  assert.equal(R.contientSecret('Rentrée 2027, 3 vœux'), '');
});

test('exports CSV et calendrier', () => {
  const c = C({ id: 'k1', intitule: 'Stage; "data"', organisme: 'Ardelis', statut: 'entretien', rang: 1, dates: { limite: j(-5), envoi: j(-4), entretien: '2026-11-20', heure: '23:30' }, pieces: [P('cv', 'envoyee'), P('lm', 'afaire')] });
  const csv = R.versCsv([c], { nomType: () => 'Stage', nomStatut: () => 'Entretien' });
  assert.ok(csv.startsWith('﻿Rang;Type;Intitulé'));
  assert.ok(csv.includes('"Stage; ""data"""'));
  assert.ok(csv.includes('2026-11-20 23:30'));
  assert.ok(csv.includes(';1/2;Lettre de motivation;'));
  const evs = R.evenements([c, C({ id: 'k2', statut: 'preparer', dates: { limite: '2026-12-01' } })], AUJ, {});
  const ics = R.versIcs(evs, { nomNature: (e) => e.nature }, '20261114T120000Z');
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0'));
  assert.ok(ics.includes('DTSTART:20261120T233000\r\nDTEND:20261120T235900'));
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20261201\r\nDTEND;VALUE=DATE:20261202'));
  assert.ok(ics.includes('SUMMARY:entretien · Ardelis'));
  assert.ok(ics.includes('Stage\\; "data"'));
  assert.ok(ics.trim().endsWith('END:VCALENDAR'));
  for (const ligne of ics.split('\r\n')) assert.ok(ligne.length <= 75, `ligne pliée : ${ligne}`);
});
