// Tests des règles métier du template Suivi de candidatures (templates/candidatures/regles.js et donnees.js) :
// modèles Études et stages, Emploi, Appels d'offres et plateformes (fusion du 22/11/2026 avec le suivi des appels
// d'offres, dont les tests utiles sont repris ici), données de l'ancien CAN et copie de l'ancien CND lues sans perte.
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

test('base : modèles, types, statuts, pièces, listes de départ, questions, trames cohérents', () => {
  eq(BASE.types.map((t) => t.id), R.TYPES);
  eq(BASE.usages.map((u) => u.id), R.USAGES);
  for (const u of BASE.usages) for (const t of u.types) assert.equal(R.familleDe(BASE, t), u.id, `${t} dans ${u.id}`);
  eq(BASE.usages.flatMap((u) => u.types).sort(), [...R.TYPES].sort(), 'chaque type dans un seul modèle');
  eq(BASE.statuts.map((s) => s.id), R.STATUTS);
  eq(BASE.statutsPiece.map((s) => s.id), R.STATUTS_PIECE);
  eq(R.statutsDe(BASE, 'etudes'), ['preparer', 'envoyee', 'entretien', 'attente', 'acceptee', 'refusee', 'retiree']);
  eq(R.statutsDe(BASE, 'emploi'), ['preparer', 'envoyee', 'entretien', 'acceptee', 'refusee', 'retiree']);
  eq(R.statutsDe(BASE, 'offres'), ['reperee', 'preparer', 'envoyee', 'entretien', 'acceptee', 'refusee', 'retiree', 'sanssuite', 'nogo']);
  assert.equal(R.nomStatut(BASE, 'envoyee', 'offres'), 'Déposée');
  assert.equal(R.nomStatut(BASE, 'acceptee', 'offres', true), 'Gagnée');
  assert.equal(R.nomStatut(BASE, 'envoyee', 'etudes'), 'Envoyée');
  const ids = BASE.pieces.map((x) => x.id);
  assert.equal(new Set(ids).size, ids.length, 'pièces uniques');
  for (const m of BASE.modeles) for (const id of m.pieces) assert.ok(R.pieceDe(BASE, id), `${m.id} : ${id}`);
  const nonOffres = R.TYPES.filter((t) => R.familleDe(BASE, t) !== 'offres');
  for (const t of nonOffres) assert.ok(BASE.modeles.some((m) => m.type === t), `liste de départ pour ${t}`);
  for (const t of nonOffres) assert.ok(R.modeleDe(BASE, R.modeleParDefaut(t)), `modèle par défaut ${t}`);
  for (const t of R.TYPES.filter((x) => R.familleDe(BASE, x) === 'offres')) {
    const ty = R.typeDe(BASE, t);
    assert.ok(BASE.dossiers.some((d) => d.id === ty.dossier), `modèle de dossier de ${t}`);
    assert.ok(Number.isInteger(ty.relance) && ty.relance > 0, `délai de relance de ${t}`);
  }
  const qids = BASE.questions.map((x) => x.id);
  assert.equal(new Set(qids).size, qids.length, 'questions uniques');
  assert.ok(BASE.questions.length >= 30);
  for (const x of BASE.questions) {
    assert.ok(BASE.themes.some((t) => t.id === x.theme), `thème de ${x.id}`);
    assert.ok(x.piste && x.texte.endsWith('?') || x.texte.endsWith('.'), `question ${x.id}`);
    for (const t of x.pour) assert.ok(nonOffres.includes(t), `type ${t} de ${x.id}`);
  }
  for (const t of nonOffres) assert.ok(BASE.trames.some((x) => x.type === t), `trame ${t}`);
  for (const tr of BASE.trames) {
    const utilises = new Set([...[tr.objet, ...tr.paragraphes].join(' ').matchAll(/\{([a-z0-9]+)\}/g)].map((m) => m[1]));
    for (const ch of tr.champs) assert.ok(utilises.has(ch.id), `${tr.id} : champ ${ch.id} utilisé`);
    for (const k of utilises) assert.ok(tr.champs.some((ch) => ch.id === k) || ['organisme', 'intitule', 'signature'].includes(k), `${tr.id} : {${k}} déclaré`);
  }
  // Appels d'offres : grille et modèles de dossiers, sans référence réglementaire (repris du suivi des appels d'offres).
  assert.equal(BASE.criteres.length, 8);
  assert.equal(new Set(BASE.criteres.map((c) => c.id)).size, 8);
  assert.ok(BASE.criteres.filter((c) => c.eliminatoire).length >= 2);
  const typesPieces = new Set(BASE.typesPieces.map((t) => t.id));
  for (const m of BASE.dossiers) for (const p of m.pieces) {
    assert.ok(Number.isInteger(p.delai) && p.delai >= 0 && p.delai <= 30, `${m.id} : ${p.libelle}`);
    if (p.type) assert.ok(typesPieces.has(p.type), `type ${p.type}`);
  }
  const texte = JSON.stringify({ criteres: BASE.criteres, dossiers: BASE.dossiers, typesPieces: BASE.typesPieces, motifs: BASE.motifsPerte });
  assert.ok(!/\b(article|décret|arrêté|code de la commande|DC ?[1-4]|ATTRI|\bR\.? ?2\d{3})/i.test(texte), 'pas de référence réglementaire');
  assert.ok(BASE.dossiers.find((m) => m.id === 'public').description.includes('règlement de la consultation'));
  for (const n of ['limite', 'depot', 'piece', 'questions', 'decision', 'entretien', 'reponse', 'relance', 'validite']) assert.match(BASE.couleurs[n], /^#[0-9A-F]{6}$/i, `couleur ${n}`);
});

test('base : aucune date, aucun calendrier officiel, aucune plateforme nommée', () => {
  const texte = readFileSync(new URL('donnees.js', dossier), 'utf8');
  const sansVersion = JSON.stringify({ ...BASE, version: '' });
  assert.ok(!/\b20\d\d\b/.test(sansVersion), 'aucune année dans la base');
  assert.ok(!/\b\d{1,2}\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\b/i.test(sansVersion), 'aucune date du calendrier');
  assert.ok(!MARQUES.test(texte), 'donnees.js sans marque');
  for (const f of ['app.js', 'index.html', 'manifest.webmanifest']) assert.ok(!MARQUES.test(readFileSync(new URL(f, dossier), 'utf8')), `${f} sans marque`);
  // Le bloc <nav class="reseaux"> du site (liens de QME vers ses propres comptes LinkedIn et Instagram) est exclu :
  // la règle porte sur le produit et le texte de sa page, pas sur ces liens communs à toutes les pages.
  const page = readFileSync(new URL('../../catalogue/candidatures/index.html', import.meta.url), 'utf8');
  const pageSansReseaux = page.replace(/<nav class="reseaux"[^>]*>[\s\S]*?<\/nav>/g, '');
  assert.ok(pageSansReseaux.length < page.length, 'bloc <nav class="reseaux"> trouvé et retiré');
  assert.ok(!MARQUES.test(pageSansReseaux), 'page catalogue sans marque');
});

test('normalisation tolérante', () => {
  const e = R.normaliser({ profil: { prenom: '  Noa ' }, reglages: { alerte: 999, relance: 'x' }, candidatures: [{ type: 'inconnu', statut: 'bof', rang: -2, dates: { limite: '2026-02-30', heure: '25:00' }, pieces: [{ ref: 'cv', statut: 'zz' }, { nom: 'Libre', apres: true }], lien: 'javascript:alert(1)' }] }, BASE);
  assert.equal(e.profil.prenom, 'Noa');
  eq(e.reglages, R.REGLAGES_DEFAUT);
  assert.equal(e.usage, 'etudes', 'données sans modèle : études et stages');
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
  eq(['afaire', 'encours', 'prete', 'envoyee', 'sansobjet'].map(R.pieceSuivante), ['encours', 'prete', 'envoyee', 'afaire', 'afaire']);
  const so = C({ pieces: [P('cv', 'prete'), P('lm', 'sansobjet')] });
  eq([R.avancement(so).total, R.avancement(so).pct], [1, 100], 'pièce sans objet non comptée');
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
  const csv = R.versCsv([c], { nomType: () => 'Stage', nomStatut: (x) => (x.statut === 'entretien' ? 'Entretien' : '?') });
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

test('export .ics : lignes pliées à 75 octets sans couper un accent ni un emoji (audit du 22/11/2026)', () => {
  const c = C({ id: 'ics', organisme: 'École 😀 Supérieure « Data » ; Lyon, '.repeat(5), statut: 'entretien', dates: { entretien: '2026-12-01', heure: '14:00' } });
  const ics = R.versIcs(R.evenements([c], '2026-11-22'), { nomNature: (e) => e.nature }, '20261122T000000Z');
  for (const l of ics.split('\r\n')) assert.ok(Buffer.byteLength(l, 'utf8') <= 75, l);
  assert.doesNotMatch(ics, /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/);
  // Dépliée, la ligne SUMMARY redonne le texte complet.
  const deplie = ics.replace(/\r\n /g, '');
  assert.ok(deplie.includes('École 😀 Supérieure « Data » \\; Lyon\\, '));
});

// ---------- Fusion du 22/11/2026 : modèles Emploi et Appels d'offres, migration ----------
const O = (x = {}) => R.normaliserCandidature({ id: 'c1', type: 'public', intitule: 'Formation des encadrants', organisme: 'Acheteur Exemple', statut: 'reperee', creeLe: '2026-11-02', ...x, dates: { limite: '2026-11-20', heureLimite: '12:00', ...(x.dates || {}) } }, BASE);
const DOSSIERS = R.etatVide(BASE).dossiers;

test('données d\'un ancien compte Candidatures lues sans perte (modèle Études et stages)', () => {
  const ancien = { version: 1, profil: { prenom: 'Noa', signature: 'Noa L.', campagne: 'Rentrée' }, reglages: { alerte: 10, relance: 14 }, tutorielVu: true, majLe: 'x',
    candidatures: [{ id: 'a', type: 'formation', intitule: 'Master', organisme: 'Univ', ville: 'Lyon', contact: 'Scolarité', lien: 'https://exemple.org', statut: 'attente', rang: 2,
      dates: { limite: '2026-11-01', envoi: '2026-10-30', entretien: '2026-11-10', heure: '10:30', reponse: '2026-12-01', recue: '2026-11-15' },
      pieces: [{ id: 'p1', ref: 'cv', nom: 'CV', statut: 'envoyee', apres: false, precision: 'une page' }, { id: 'p2', ref: 'confirmation', nom: 'Confirmation d\'inscription', statut: 'afaire', apres: true, precision: '' }],
      relances: [{ id: 'r1', date: '2026-11-11', canal: 'telephone', note: 'merci' }],
      entretien: { format: 'visio', lieu: 'lien', questions: [{ id: 'q1', ref: 'pres1', texte: 'Présente-toi en deux minutes.', notes: 'ok', prete: true }], notes: 'notes' },
      lettre: { trame: 'formation', champs: { situation: 'en L3' }, texte: '' }, motif: '2e sur la liste', note: 'note', creeLe: '2026-10-01' }] };
  const e = R.normaliser(ancien, BASE);
  assert.equal(e.usage, 'etudes');
  eq(e.profil, ancien.profil);
  assert.equal(e.reglages.alerte, 10); assert.equal(e.reglages.relance, 14);
  assert.equal(e.majLe, 'x');
  const c = e.candidatures[0];
  const a = ancien.candidatures[0];
  for (const k of ['id', 'type', 'intitule', 'organisme', 'ville', 'contact', 'lien', 'statut', 'rang', 'motif', 'note', 'creeLe']) assert.equal(c[k], a[k], k);
  for (const k of Object.keys(a.dates)) assert.equal(c.dates[k], a.dates[k], `date ${k}`);
  eq(c.pieces.map((x) => [x.id, x.ref, x.nom, x.statut, x.apres, x.precision]), a.pieces.map((x) => [x.id, x.ref, x.nom, x.statut, x.apres, x.precision]));
  eq(c.relances, a.relances);
  eq(c.entretien, a.entretien);
  eq(c.lettre, a.lettre);
  // Relire des données déjà normalisées ne change rien.
  eq(R.normaliser(simple(e), BASE), e);
});

test('modèle Emploi : types, pièces de départ, trame, questions, statuts', () => {
  eq(R.usageDe(BASE, 'emploi').types, ['offre', 'spontanee']);
  eq(R.piecesDuModele(BASE, R.modeleParDefaut('offre')).map((x) => x.ref), ['cv', 'lm', 'references', 'diplome', 'travail', 'pretentions']);
  assert.equal(R.trameConseillee(BASE, C({ type: 'offre' })), 'offre');
  assert.equal(R.trameConseillee(BASE, C({ type: 'spontanee' })), 'spontanee');
  const qs = R.questionsPour(BASE, 'offre').flatMap((g) => g.questions.map((q) => q.id));
  assert.ok(qs.includes('emp2') && qs.includes('mot2') && !qs.includes('mot1'));
  // Liste d'attente propre aux études : convertie en « envoyée » pour une offre d'emploi.
  assert.equal(C({ type: 'offre', statut: 'attente' }).statut, 'envoyee');
  const l = R.composerLettre(C({ type: 'offre', intitule: 'Chargée de communication', organisme: 'Atelier Norval', lettre: { trame: 'offre', champs: { situation: 'en agence' } } }), R.trameDe(BASE, 'offre'), { signature: 'C. D.' });
  assert.ok(l.texte.startsWith('Objet : Candidature au poste de Chargée de communication'));
  // Relance au réglage général (pas de délai propre au type).
  eq(R.relance(C({ type: 'offre', statut: 'envoyee', dates: { envoi: j(-12) } }), AUJ, 10, BASE).date, j(-2));
});

test('dates : lundi, échéance avancée au vendredi si week-end', () => {
  assert.equal(R.ajout('2026-10-30', 3), '2026-11-02');
  assert.equal(R.ajout('2026-03-28', 2), '2026-03-30');
  assert.equal(R.jourSemaine('2026-11-16'), 0); // lundi
  assert.equal(R.lundi('2026-11-15'), '2026-11-09');
  assert.equal(R.ouvreAvant('2026-11-14'), '2026-11-13'); // samedi → vendredi
  assert.equal(R.ouvreAvant('2026-11-15'), '2026-11-13'); // dimanche → vendredi
  assert.equal(R.ouvreAvant('2026-11-16'), '2026-11-16');
});

test('grille go/no-go : score pondéré, seuils, éliminatoire, grille partielle', () => {
  const K = BASE.criteres;
  const tout = (n) => Object.fromEntries(K.map((c) => [c.id, n]));
  eq(R.scoreGrille(K, {}), { pct: null, notes: 0, total: 8, complet: false, eliminatoires: [], recommandation: null });
  assert.equal(R.scoreGrille(K, tout(3)).pct, 100);
  assert.equal(R.scoreGrille(K, tout(3)).recommandation, 'go');
  assert.equal(R.scoreGrille(K, tout(2)).pct, 67);
  assert.equal(R.scoreGrille(K, tout(1)).recommandation, 'nogo');
  const moitie = { metier: 1, capacite: 1, temps: 2, references: 1, rentabilite: 2, chances: 1, client: 3, strategie: 1 };
  assert.equal(R.scoreGrille(K, moitie).recommandation, 'discuter');
  assert.equal(R.scoreGrille(K, moitie, { go: 80, discuter: 60 }).recommandation, 'nogo');
  const elim = R.scoreGrille(K, { ...tout(3), temps: 0 });
  eq([elim.recommandation, elim.eliminatoires], ['nogo', ['temps']]);
  assert.equal(R.scoreGrille(K, { capacite: 0 }).recommandation, 'nogo');
  const part = R.scoreGrille(K, { metier: 3, references: 1 });
  eq([part.pct, part.recommandation], [Math.round((9 + 2) / 15 * 100), null]);
  const sansStrategie = K.map((c) => (c.id === 'strategie' ? { ...c, poids: 0 } : c));
  assert.equal(R.scoreGrille(sansStrategie, { ...tout(3), strategie: 0 }).pct, 100, 'poids 0 : critère ignoré');
  assert.ok(R.scoreGrille(sansStrategie, tout(3)).complet, 'critère ignoré non exigé');
});

test('appels d\'offres : go crée les pièces du modèle de dossier, no-go écarte, sans modifier l\'original', () => {
  const c = O();
  const go = R.decider(c, 'go', { date: '2026-11-03', pieces: R.piecesDuDossier(DOSSIERS, BASE, 'public', 'Alex') });
  assert.equal(go.statut, 'preparer');
  assert.equal(go.pieces.length, BASE.dossiers[0].pieces.length);
  eq([go.pieces[0].nom, go.pieces[0].delai, go.pieces[0].statut, go.pieces[0].responsable], [BASE.dossiers[0].pieces[0].libelle, 14, 'afaire', 'Alex']);
  eq(go.decision, { choix: 'go', date: '2026-11-03', motif: '' });
  eq([c.statut, c.pieces.length], ['reperee', 0]);
  const deja = R.decider(O({ pieces: [{ nom: 'Pièce', delai: 1, statut: 'prete' }] }), 'go', { date: '2026-11-03', pieces: R.piecesDuDossier(DOSSIERS, BASE, 'public') });
  assert.equal(deja.pieces.length, 1, 'pièces existantes gardées');
  const non = R.decider(c, 'nogo', { date: '2026-11-03', motif: 'Hors métier' });
  eq([non.statut, non.decision], ['nogo', { choix: 'nogo', date: '2026-11-03', motif: 'Hors métier' }]);
  assert.ok(!R.estActive(non) && !R.estGo(non) && !R.classable(non));
  assert.equal(R.piecesDuDossier(DOSSIERS, BASE, 'autre').length, BASE.dossiers.find((d) => d.id === 'directe').pieces.length, 'autre appel : modèle de la consultation directe');
  // Statut d'appel d'offres sur un type d'études : ramené à un statut du modèle.
  eq(['reperee', 'nogo', 'sanssuite'].map((s) => C({ type: 'stage', statut: s }).statut), ['preparer', 'retiree', 'refusee']);
});

test('rétroplanning : échéance à rebours, avancée au vendredi, date fixée à la main, dépôt visé', () => {
  const lim = '2026-11-20'; // vendredi
  assert.equal(R.echeancePiece({ delai: 0 }, lim), lim);
  assert.equal(R.echeancePiece({ delai: 3 }, lim), '2026-11-17');
  assert.equal(R.echeancePiece({ delai: 6 }, lim), '2026-11-13'); // samedi 14 → vendredi 13
  assert.equal(R.echeancePiece({ delai: 7 }, lim), '2026-11-13'); // dimanche 13 → vendredi 13
  assert.equal(R.echeancePiece({ delai: 4, echeance: '2026-11-18' }, lim), '2026-11-18');
  assert.equal(R.echeancePiece({ delai: 4 }, null), null);
  assert.equal(R.echeancePiece({ delai: null }, lim), null, 'pièce d\'études sans délai : pas d\'échéance');
  assert.equal(R.depotVise(O({ dates: { limite: lim } }), 1), '2026-11-19');
  assert.equal(R.depotVise(O({ dates: { limite: lim } }), 0), lim);
  assert.equal(R.depotVise(O({ dates: { limite: '2026-11-16' } }), 1), '2026-11-15', 'le dépôt visé n\'est pas avancé au vendredi');
  assert.equal(R.depotVise(O({ dates: { limite: null } }), 1), null);
});

test('état des pièces et de la bibliothèque : retard, bientôt, prête, sans objet, validité', () => {
  const biblio = [{ id: 'b1', valideJusquau: '2026-11-18' }, { id: 'b2', valideJusquau: '2026-11-05' }, { id: 'b3', valideJusquau: '2027-01-31' }, { id: 'b4', valideJusquau: null }];
  const c = O({ statut: 'preparer' });
  const t = '2026-11-10';
  const pc = (x) => R.normaliserPiece(x, BASE);
  eq([R.etatPiece(pc({ delai: 14 }), c, t, biblio).etat, R.etatPiece(pc({ delai: 14 }), c, t, biblio).retard], ['retard', 4]); // échéance 06/11
  assert.equal(R.etatPiece(pc({ delai: 9 }), c, t, biblio).etat, 'bientot');
  assert.equal(R.etatPiece(pc({ delai: 3, statut: 'encours' }), c, t, biblio).etat, 'encours');
  assert.equal(R.etatPiece(pc({ delai: 3 }), c, t, biblio).etat, 'afaire');
  assert.equal(R.etatPiece(pc({ delai: 14, statut: 'pret' }), c, t, biblio).etat, 'prete', 'statut « pret » de l\'ancien suivi lu « prete »');
  assert.equal(R.etatPiece(pc({ delai: 14, statut: 'sansobjet' }), c, t, biblio).etat, 'sansobjet');
  assert.equal(R.etatPiece(pc({ delai: 3, statut: 'prete', biblio: 'b1' }), c, t, biblio).alerte, 'expire-avant');
  assert.equal(R.etatPiece(pc({ delai: 3, statut: 'prete', biblio: 'b2' }), c, t, biblio).alerte, 'expiree');
  assert.equal(R.etatPiece(pc({ delai: 3, statut: 'prete', biblio: 'b3' }), c, t, biblio).alerte, null);
  assert.equal(R.etatPiece(pc({ delai: 3, statut: 'prete', biblio: 'b4' }), c, t, biblio).alerte, null);
  eq(R.etatBiblio(biblio[0], t, 30), { etat: 'bientot', jours: 8 });
  eq(R.etatBiblio(biblio[1], t, 30), { etat: 'expiree', jours: -5 });
  assert.equal(R.etatBiblio(biblio[2], t, 30).etat, 'valide');
  assert.equal(R.etatBiblio(biblio[3], t, 30).etat, 'sansdate');
  assert.equal(R.etatBiblio(null, t), null);
  eq(R.aRenouveler(biblio, t, 30).map((x) => x.b.id), ['b2', 'b1']);
});

test('appels d\'offres : dépôt, relances au délai du type puis au réglage, date fixée, résultat', () => {
  let c = R.decider(O({ type: 'plateforme' }), 'go', { date: '2026-11-03', pieces: R.piecesDuDossier(DOSSIERS, BASE, 'plateforme') });
  c.pieces[0].statut = 'sansobjet';
  c = R.deposer(c, { date: '2026-11-19', montantOffre: '12 500', valable: '2027-02-01' });
  eq([c.statut, c.dates.envoi, c.montantOffre, c.dates.valable], ['envoyee', '2026-11-19', 12500, '2027-02-01']);
  eq(c.pieces.map((x) => x.statut), ['sansobjet', 'envoyee', 'envoyee', 'envoyee', 'envoyee'], 'pièces utiles envoyées au dépôt');
  assert.ok(R.estDepose(c));
  // Plateforme : première relance 5 jours après le dépôt, puis le réglage (10 jours) après chaque relance.
  eq(R.relance(c, '2026-11-22', 10, BASE), { date: '2026-11-24', raison: 'delai', due: false, jours: 3 });
  c = R.noterRelance(c, { date: '2026-11-24', note: 'Analyse en cours' });
  assert.equal(R.relance(c, '2026-11-25', 10, BASE).date, '2026-12-04');
  // Date fixée à la main, oubliée à la relance suivante.
  c.dates.relancer = '2026-11-28';
  eq(R.relance(c, '2026-11-25', 10, BASE), { date: '2026-11-28', raison: 'prevue', due: false, jours: 1 });
  assert.equal(R.noterRelance(c, { date: '2026-11-26' }).dates.relancer, null);
  assert.equal(R.relance(O({ type: 'public', statut: 'envoyee', dates: { envoi: '2026-11-01' } }), '2026-11-22', 10, BASE).date, '2026-12-01', 'marché public : 30 jours');
  const g = R.cloturer(c, 'acceptee', { date: '2027-01-10', montantObtenu: '11800' });
  eq([g.statut, g.dates.recue, g.montantObtenu, g.dates.relancer, R.relance(g, '2027-01-20', 10, BASE)], ['acceptee', '2027-01-10', 11800, null, null]);
  const p = R.cloturer(c, 'refusee', { date: '2027-01-10', place: '2' });
  eq([p.motifPerte, p.place, p.montantObtenu], ['inconnu', 2, null]);
  assert.equal(R.cloturer(c, 'refusee', { date: '2027-01-10', motifPerte: 'prix' }).motifPerte, 'prix');
  assert.equal(R.cloturer(c, 'sanssuite', { date: '2027-01-10' }).statut, 'sanssuite');
  eq([R.ajouterTemps(1, 0.5), R.ajouterTemps(0.25, -1), R.ajouterTemps(2.5, 0.1)], [1.5, 0, 2.5]);
  // Message de relance d'un appel d'offres.
  const m = R.messageRelance(BASE, c, { signature: 'Alex' }, (d) => d);
  assert.ok(m.includes('notre offre pour « Formation des encadrants »') && m.includes('2026-11-19'));
});

test('appels d\'offres : échéances (décision, questions, pièces, dépôt, validité), regroupement des pièces', () => {
  const t = '2026-11-10';
  const rg = { alerte: 7, relance: 10, marge: 1, decision: 7 };
  const prep = R.decider(O({ id: 'p', dates: { limite: '2026-11-13' } }), 'go', { date: '2026-11-01', pieces: [{ nom: 'A', delai: 5 }, { nom: 'B', delai: 1 }, { nom: 'C', delai: 0, statut: 'prete' }].map((x) => R.normaliserPiece(x, BASE)) });
  const veille = O({ id: 'v', dates: { limite: '2026-11-25', questions: '2026-11-15' } });
  const dep = O({ id: 'd', statut: 'envoyee', dates: { envoi: '2026-10-01', valable: '2026-11-16', relancer: '2026-11-08' } });
  const evs = R.evenements([prep, veille, dep], t, rg, { base: BASE });
  eq(evs.map((x) => `${x.cand.id}:${x.nature}:${x.date}`), [
    'p:piece:2026-11-06', // A : 13/11 − 5 = dimanche 08/11 → vendredi 06/11
    'd:relance:2026-11-10', // date fixée dépassée : due aujourd'hui
    'p:depot:2026-11-12',
    'p:piece:2026-11-12', // B
    'p:limite:2026-11-13',
    'v:questions:2026-11-15',
    'v:decision:2026-11-18', // 7 jours avant la date limite
    'd:validite:2026-11-16',
    'v:limite:2026-11-25',
  ].sort((a, b) => a.split(':')[2].localeCompare(b.split(':')[2]) || ['limite', 'depot', 'piece', 'questions', 'decision', 'entretien', 'reponse', 'relance', 'validite'].indexOf(a.split(':')[1]) - ['limite', 'depot', 'piece', 'questions', 'decision', 'entretien', 'reponse', 'relance', 'validite'].indexOf(b.split(':')[1])));
  assert.ok(!evs.some((x) => x.nature === 'piece' && x.piece.nom === 'C'), 'pièce prête absente');
  assert.equal(R.evenementsDe(O({ dates: { limite: '2026-11-12' } }), t, rg, BASE).find((x) => x.nature === 'decision').date, t, 'décision en retard ramenée à aujourd\'hui');
  assert.ok(!R.evenementsDe(O({ dates: { limite: '2026-11-01' } }), t, rg, BASE).some((x) => x.nature === 'decision'), 'date passée : plus de décision');
  assert.ok(!R.evenementsDe(prep, t, { ...rg, marge: 0 }, BASE).some((x) => x.nature === 'depot'), 'sans marge : pas de dépôt visé distinct');
  // Deux pièces du même dossier à la même échéance : un seul événement.
  const deux = R.decider(O({ id: 'q', dates: { limite: '2026-11-20' } }), 'go', { date: t, pieces: [{ nom: 'X', delai: 2 }, { nom: 'Y', delai: 2 }].map((x) => R.normaliserPiece(x, BASE)) });
  const g = R.regrouperPieces(R.evenements([deux], t, rg, { base: BASE }));
  const pieces = g.filter((x) => x.nature === 'piece');
  eq([pieces.length, pieces[0].pieces.map((x) => x.nom)], [1, ['X', 'Y']]);
});

test('calendrier : grille du mois du lundi au dimanche', () => {
  const g = R.grilleMois('2026-11');
  eq([g[0][0], g.at(-1)[6], g.length], ['2026-10-26', '2026-12-06', 6]);
  assert.equal(R.grilleMois('2027-02').length, 4); // février 2027 commence un lundi
  assert.equal(R.moisSuivant('2026-12', 1), '2027-01');
  assert.equal(R.moisSuivant('2026-01', -1), '2025-12');
});

test('statistiques des appels d\'offres : taux de go, de réussite, montants, temps, par type, par motif, par mois', () => {
  const X = (o) => O({ ...o, dates: { limite: null, ...o.dates } });
  const L = [
    X({ type: 'public', statut: 'acceptee', creeLe: '2026-03-01', dates: { envoi: '2026-03-20', recue: '2026-05-02' }, montantObtenu: 20000, temps: 10 }),
    X({ type: 'public', statut: 'refusee', creeLe: '2026-04-01', dates: { envoi: '2026-04-20', recue: '2026-06-01' }, motifPerte: 'prix', temps: 8 }),
    X({ type: 'plateforme', statut: 'acceptee', creeLe: '2026-09-01', dates: { envoi: '2026-09-02', recue: '2026-09-10' }, montantOffre: 5000, temps: 2 }),
    X({ type: 'plateforme', statut: 'refusee', creeLe: '2026-10-01', dates: { envoi: '2026-10-02', recue: '2026-10-20' }, temps: 1 }),
    X({ type: 'prive', statut: 'sanssuite', creeLe: '2026-05-01', dates: { envoi: '2026-05-15', recue: '2026-07-01' }, temps: 4 }),
    X({ type: 'prive', statut: 'envoyee', creeLe: '2026-10-15', dates: { envoi: '2026-11-01' }, temps: 5 }),
    X({ type: 'public', statut: 'nogo', creeLe: '2026-10-20', temps: 0.5 }),
    X({ type: 'public', statut: 'reperee', creeLe: '2026-11-10' }),
    X({ type: 'prive', statut: 'retiree', creeLe: '2026-08-01', temps: 2 }),
  ];
  const s = R.statistiques(L, { types: BASE.types.filter((t) => t.famille === 'offres'), motifs: BASE.motifsPerte, aujourdhui: '2026-11-14', mois: 12 });
  const g = s.global;
  eq([g.total, g.decidees, g.go, g.nogo, g.deposees, g.gagnees, g.perdues, g.sansSuite, g.enAttente, g.abandons], [9, 8, 7, 1, 6, 2, 2, 1, 1, 1]);
  assert.equal(g.tauxGo, 7 / 8);
  assert.equal(g.tauxReussite, 0.5, 'sans suite et en attente exclus');
  assert.equal(g.montantGagne, 25000, 'montant de l\'offre à défaut du montant obtenu');
  eq([g.montantMoyen, g.temps, g.tempsMoyen, g.heuresParGain, g.euroParHeure], [12500, 32.5, 4.6, 16, Math.round(25000 / 32)]);
  const pub = s.parType.find((x) => x.id === 'public');
  eq([pub.total, pub.tauxReussite], [4, 0.5]);
  assert.equal(s.parType.find((x) => x.id === 'directe'), undefined, 'type sans consultation absent');
  eq(s.parMotif.map((m) => [m.id, m.n]), [['prix', 1], ['inconnu', 1]]);
  eq([s.parMois.length, s.parMois[0].mois, s.parMois.at(-1).mois], [12, '2025-12', '2026-11']);
  eq(s.parMois.find((m) => m.mois === '2026-09'), { mois: '2026-09', deposees: 1, gagnees: 1, perdues: 0 });
  const r = R.statistiques(L, { depuis: '2026-09-01' }).global;
  eq([r.total, r.tauxReussite], [5, 0.5]);
  const vide = R.statistiques([], {}).global;
  eq([vide.tauxReussite, vide.tauxGo, vide.euroParHeure], [null, null, null]);
});

test('export CSV avec les colonnes des appels d\'offres : référence, score, montants, temps', () => {
  const c = R.decider(O({ intitule: 'Mission « test » ; lot 2', reference: 'R-2', grille: Object.fromEntries(BASE.criteres.map((k) => [k.id, 3])), temps: 2.5, montantEstime: 9000 }), 'go', { date: '2026-11-03', pieces: R.piecesDuDossier(DOSSIERS, BASE, 'directe') });
  c.pieces[0].statut = 'prete';
  const lignes = R.versCsv([c], { nomType: () => 'Marché public', nomStatut: () => 'En préparation', offres: true, criteres: BASE.criteres, nomMotif: () => '' }).split('\r\n');
  assert.equal(lignes.length, 2);
  assert.ok(lignes[0].endsWith(';Référence;Source;Score go/no-go (%);Montant estimé;Montant de l\'offre;Montant obtenu;Motif de perte;Temps passé (h)'));
  assert.ok(lignes[1].includes('"Mission « test » ; lot 2";Acheteur Exemple'));
  assert.ok(lignes[1].includes(';1/5;'));
  assert.ok(lignes[1].endsWith(';R-2;Veille sur les profils d\'acheteurs;100;9000;;;;2,5') || lignes[1].endsWith(';R-2;;100;9000;;;;2,5'), lignes[1]);
});

test('copie exportée de l\'ancien suivi des appels d\'offres : convertie sans perte', () => {
  const cnd = {
    version: 1, tutorielVu: true,
    reglages: { monNom: 'Alex', marge: 2, horizon: 10, delaiDecision: 5, intervalleRelance: 15, seuilBiblio: 20, seuilGo: 70, seuilDiscuter: 50 },
    criteres: BASE.criteres.map((k) => ({ ...k, poids: k.id === 'client' ? 0 : k.poids })),
    modeles: [{ id: 'public', nom: 'Marché public', description: 'Mon modèle', pieces: [{ libelle: 'Mémoire', delai: 4, type: 'methode' }] }],
    biblio: [{ id: 'b1', type: 'assurance', titre: 'RC pro', reference: 'Dossier > rc.pdf', emisLe: '2026-01-01', valideJusquau: '2026-12-31', note: 'n' }],
    consultations: [
      { id: 'c1', titre: 'Audit', acheteur: 'Ville', type: 'public', source: 'Alerte par e-mail', reference: 'A-1', lien: 'Dossier partagé > Audit', reperee: '2026-10-01', dateLimite: '2026-11-20', heureLimite: '14:00', dateQuestions: '2026-11-10',
        montantEstime: 30000, notes: { metier: 3, capacite: 2 }, commentaire: 'Visite faite', statut: 'deposee', decision: { choix: 'go', date: '2026-10-03' },
        pieces: [{ id: 'pc1', libelle: 'Mémoire', delai: 4, type: 'methode', statut: 'pret', responsable: 'Sam', biblio: null, echeance: '2026-11-15' }, { id: 'pc2', libelle: 'DC', delai: 2, type: null, statut: 'sansobjet', responsable: '', biblio: 'b1', echeance: null }],
        depot: '2026-11-19', relancerLe: '2026-12-19', relances: [{ date: '2026-11-21', note: 'Appel' }], offreValable: '2027-03-01', montantOffre: 28000, resultat: null, temps: 12.5 },
      { id: 'c2', titre: 'Formation', acheteur: 'Client', type: 'plateforme', reperee: '2026-06-01', statut: 'perdue', decision: { choix: 'go', date: '2026-06-02' }, pieces: [], relances: [], depot: '2026-06-05',
        resultat: { date: '2026-06-20', motif: 'prix', rang: 2, note: 'Trop cher' }, temps: 1 },
      { id: 'c3', titre: 'Coaching', acheteur: 'Client', type: 'directe', reperee: '2026-05-01', statut: 'gagnee', pieces: [], relances: [], depot: '2026-05-03', montantOffre: 5000, resultat: { date: '2026-05-10', montant: 4800 } },
      { id: 'c4', titre: 'AMO', acheteur: 'Hôpital', type: 'inconnu', reperee: '2026-04-01', statut: 'nogo', decision: { choix: 'nogo', date: '2026-04-02', motif: 'Hors métier' }, pieces: [], relances: [] },
      { id: 'c5', titre: 'QVT', acheteur: 'Asso', type: 'prive', reperee: '2026-03-01', statut: 'abandon', pieces: [], relances: [] },
    ],
  };
  const e = R.normaliser(simple(cnd), BASE);
  assert.equal(e.usage, 'offres');
  assert.equal(e.tutorielVu, true);
  eq([e.profil.prenom, e.reglages.marge, e.reglages.alerte, e.reglages.decision, e.reglages.relance, e.reglages.renouveler, e.reglages.seuilGo, e.reglages.seuilDiscuter], ['Alex', 2, 10, 5, 15, 20, 70, 50]);
  assert.equal(e.criteres.find((k) => k.id === 'client').poids, 0, 'poids modifiés gardés');
  eq(e.dossiers.find((d) => d.id === 'public').pieces, [{ libelle: 'Mémoire', delai: 4, type: 'methode' }]);
  assert.equal(e.dossiers.find((d) => d.id === 'public').description, 'Mon modèle');
  assert.equal(e.dossiers.length, BASE.dossiers.length, 'modèles absents complétés par ceux de la base');
  eq(e.biblio[0], cnd.biblio[0]);
  const [c1, c2, c3, c4, c5] = e.candidatures;
  eq([c1.id, c1.type, c1.intitule, c1.organisme, c1.source, c1.reference, c1.statut, c1.creeLe], ['c1', 'public', 'Audit', 'Ville', 'Alerte par e-mail', 'A-1', 'envoyee', '2026-10-01']);
  eq([c1.dates.limite, c1.dates.heureLimite, c1.dates.questions, c1.dates.envoi, c1.dates.valable, c1.dates.relancer], ['2026-11-20', '14:00', '2026-11-10', '2026-11-19', '2027-03-01', '2026-12-19']);
  eq([c1.montantEstime, c1.montantOffre, c1.temps, c1.grille, c1.decision], [30000, 28000, 12.5, { metier: 3, capacite: 2 }, { choix: 'go', date: '2026-10-03', motif: '' }]);
  eq(c1.pieces.map((p) => [p.id, p.nom, p.delai, p.type, p.statut, p.responsable, p.biblio, p.echeance]), [['pc1', 'Mémoire', 4, 'methode', 'prete', 'Sam', null, '2026-11-15'], ['pc2', 'DC', 2, null, 'sansobjet', '', 'b1', null]]);
  eq(c1.relances.map((r) => [r.date, r.note]), [['2026-11-21', 'Appel']]);
  assert.equal(c1.note, 'Où trouver le dossier : Dossier partagé > Audit\nVisite faite', 'emplacement libre gardé dans les notes');
  eq([c2.statut, c2.motifPerte, c2.place, c2.motif, c2.dates.recue, c2.dates.relancer], ['refusee', 'prix', 2, 'Trop cher', '2026-06-20', null]);
  eq([c3.statut, c3.montantObtenu, c3.montantOffre], ['acceptee', 4800, 5000]);
  eq([c4.statut, c4.type, c4.decision.motif], ['nogo', 'autre', 'Hors métier']);
  assert.equal(c5.statut, 'retiree');
  // Les statistiques retrouvent les mêmes résultats que l'ancien bilan.
  const g = R.statistiques(e.candidatures, {}).global;
  eq([g.gagnees, g.perdues, g.nogo, g.abandons, g.deposees, g.montantGagne], [1, 1, 1, 1, 3, 4800]);
});
