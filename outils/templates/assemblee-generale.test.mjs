// Tests des règles métier de « Assemblée générale et vie statutaire » (templates/assemblee-generale/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/assemblee-generale/', import.meta.url);
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.AGS;
const B = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));
const AUJ = '2026-11-14';

// Association de 20 membres votants (16 à jour), une AG le 12/12/2026.
function etat({ membres, regles, reunions = [], mandats = [] } = {}) {
  const m = membres || Array.from({ length: 20 }, (_, i) => ({ id: `m${i + 1}`, nom: `Membre ${String(i + 1).padStart(2, '0')}`, votant: true, cotisation: i < 16 }));
  return R.normaliser({ association: { nom: 'Les Amis du Val', ville: 'Valbrune', signataire: 'Claire Exemple', qualite: 'Présidente' }, membres: m, regles, reunions, mandats });
}
const ag = (extra = {}) => R.normaliserReunion({ id: 'ag', instance: 'ago', date: '2026-12-12', heure: '14:30', lieu: 'salle des fêtes', ...extra });
const ligne = (membre, statut, mandataire = '') => ({ membre, nom: membre, statut, mandataire });

test('base intégrée : étapes, ordres du jour, trames cohérentes', () => {
  for (const cle of ['ag', 'conseil']) {
    const l = B.etapes[cle];
    assert.ok(l.some((e) => e.cle === 'convocation' && e.ancre === 'limite' && e.decalage === 0), cle);
    assert.ok(l.some((e) => e.cle === 'tenue' && e.ancre === 'reunion' && e.decalage === 0), cle);
    for (const e of l) assert.ok(['limite', 'reunion'].includes(e.ancre), e.titre);
  }
  for (const k of ['ago', 'age', 'conseil']) assert.ok(B.ordresDuJour[k].length >= 3, k);
  for (const i of R.INSTANCES) {
    assert.ok(B.trames.convocation.some((t) => t.instances.includes(i)), `convocation ${i}`);
    assert.ok(B.trames.pv.some((t) => t.instances.includes(i)), `pv ${i}`);
  }
  assert.equal(new Set(B.trames.convocation.map((t) => t.id)).size, B.trames.convocation.length);
  // Aucun champ inconnu dans les trames.
  const connus = new Set(Object.keys(R.contexteReunion(etat(), ag(), AUJ)).concat(['president', 'secretaire', 'convoque_le', 'inscrits', 'presents', 'representes', 'excuses', 'quorum_phrase', 'deroulement', 'heure_fin']));
  const trames = [...B.trames.convocation.map((t) => t.texte), B.trames.pouvoir, ...B.trames.pv.map((t) => t.texte)];
  for (const t of trames) for (const [, k] of t.matchAll(/\{[?!/]?([a-z_]+)\}/g)) assert.ok(connus.has(k), k);
});

test('normalisation tolérante : règles de départ non vérifiées, fractions réduites, liens orphelins retirés', () => {
  const e = R.normaliser({ membres: [{ id: 'a', nom: '  Alice  ' }, { id: 'a', nom: 'doublon' }], mandats: [{ membre: 'a', instance: 'bureau', fonction: 'Présidente', debut: '2024-06-01' }, { membre: 'zz' }], regles: { instances: { ago: { quorum: { type: 'fraction', num: 2, den: 8 }, majorite: 'inconnue' } } } });
  assert.equal(e.membres.length, 1);
  assert.equal(e.membres[0].nom, 'Alice');
  assert.equal(e.membres[0].votant, true);
  assert.equal(e.membres[0].cotisation, false);
  assert.equal(e.mandats.length, 1);
  assert.deepEqual(simple(e.regles.instances.ago.quorum), { type: 'fraction', num: 1, den: 4, nombre: 0, comparaison: 'atteint' });
  assert.equal(e.regles.instances.ago.majorite, 'simple');
  for (const i of R.INSTANCES) assert.equal(e.regles.instances[i].verifiee, false, i);
  assert.equal(R.normaliser(null).membres.length, 0);
  const f = R.normaliserFraction({ num: 5, den: 3 });
  assert.deepEqual(simple(f), { num: 1, den: 1 });
});

test('quorum : fraction « au moins » et « plus de », nombre, aucun, pouvoirs comptés ou non', () => {
  assert.equal(R.requis({ type: 'fraction', num: 1, den: 4, comparaison: 'atteint' }, 16), 4);
  assert.equal(R.requis({ type: 'fraction', num: 1, den: 4, comparaison: 'atteint' }, 17), 5);
  assert.equal(R.requis({ type: 'fraction', num: 1, den: 2, comparaison: 'plus' }, 16), 9);
  assert.equal(R.requis({ type: 'fraction', num: 1, den: 2, comparaison: 'plus' }, 15), 8);
  assert.equal(R.requis({ type: 'fraction', num: 2, den: 3, comparaison: 'atteint' }, 16), 11);
  assert.equal(R.requis({ type: 'nombre', nombre: 7 }, 16), 7);
  assert.equal(R.requis({ type: 'aucun' }, 16), null);

  // 16 votants à jour ; 3 présents + 2 représentés : 1/4 = 4 requis.
  const E = etat();
  const r = ag({ emargement: [ligne('m1', 'present'), ligne('m2', 'present'), ligne('m3', 'present'), ligne('m4', 'represente', 'm1'), ligne('m5', 'represente', 'm2')] });
  r.emargement = R.construireEmargement(E, r, AUJ);
  const pr = R.presence(E, r, AUJ);
  assert.equal(pr.inscrits, 16);
  assert.equal(pr.presents, 3);
  assert.equal(pr.representes, 2);
  assert.equal(pr.voix, 5);
  let q = R.quorum(E, r, AUJ, pr);
  assert.equal(q.requis, 4);
  assert.equal(q.compte, 5);
  assert.equal(q.atteint, true);
  // Pouvoirs exclus du quorum : 3 < 4.
  E.regles.instances.ago.pouvoirsQuorum = false;
  q = R.quorum(E, r, AUJ);
  assert.equal(q.compte, 3);
  assert.equal(q.atteint, false);
  assert.equal(q.manque, 1);
  // Seconde convocation sans quorum.
  r.convocationNo = 2;
  q = R.quorum(E, r, AUJ);
  assert.equal(q.sansQuorum, true);
  assert.equal(q.atteint, true);
  // Seconde convocation « identique » : même règle qu'en première.
  E.regles.instances.ago.quorum2.type = 'identique';
  assert.equal(R.quorum(E, r, AUJ).requis, 4);
});

test('électeurs : AG = votants à jour ; conseil = mandats en cours (conseil et bureau) ; bureau = mandats de bureau', () => {
  const E = etat({
    membres: [
      { id: 'a', nom: 'Alice', votant: true, cotisation: true },
      { id: 'b', nom: 'Bruno', votant: true, cotisation: false },
      { id: 'c', nom: 'Chloé', votant: false, cotisation: true, categorie: 'Membre d\'honneur' },
      { id: 'd', nom: 'David', votant: true, cotisation: true },
    ],
    mandats: [
      { membre: 'a', instance: 'bureau', fonction: 'Présidente', debut: '2024-06-01', duree: 3 },
      { membre: 'b', instance: 'ca', fonction: 'Administrateur', debut: '2023-06-01', duree: 3 },
      { membre: 'd', instance: 'ca', fonction: 'Administrateur', debut: '2020-06-01', duree: 3 },
    ],
  });
  assert.deepEqual(simple(R.electeurs(E, 'ago', AUJ).map((m) => m.id)), ['a', 'd']);
  assert.deepEqual(simple(R.electeurs(E, 'ca', AUJ).map((m) => m.id).sort()), ['a']);
  assert.deepEqual(simple(R.electeurs(E, 'bureau', AUJ).map((m) => m.id)), ['a']);
  // À la date de la réunion : le mandat de Bruno (fin 01/06/2026) n'était pas échu en mai 2026.
  assert.deepEqual(simple(R.electeurs(E, 'ca', '2026-05-15').map((m) => m.id).sort()), ['a', 'b']);
  assert.deepEqual(simple(R.electeurs(E, 'ca', '2026-07-01').map((m) => m.id).sort()), ['a']);
  const r = R.normaliserReunion({ instance: 'ca', date: '2026-05-15' });
  const em = R.construireEmargement(E, r, AUJ);
  assert.equal(em.find((l) => l.membre === 'a').qualite, 'Présidente');
});

test('émargement : statuts conservés, lignes saisies gardées si le membre n\'est plus éligible', () => {
  const E = etat();
  const r = ag({ emargement: [ligne('m1', 'present'), ligne('m20', 'excuse')] });
  const em = R.construireEmargement(E, r, AUJ);
  assert.equal(em.length, 17); // 16 votants à jour + m20 (non à jour mais excusé, gardé)
  assert.equal(em.find((l) => l.membre === 'm1').statut, 'present');
  assert.equal(em.find((l) => l.membre === 'm2').statut, 'absent');
  assert.equal(em.find((l) => l.membre === 'm2').nom, 'Membre 02');
  for (let i = 1; i < em.length; i++) assert.ok(em[i - 1].nom.localeCompare(em[i].nom, 'fr') <= 0);
});

test('pouvoirs : plafond par mandataire, mandataire absent, sans mandataire, pouvoirs non admis', () => {
  const E = etat();
  E.regles.instances.ago.pouvoirs = { autorises: true, plafond: 2 };
  const r = ag({ emargement: [ligne('m1', 'present'), ligne('m2', 'represente', 'm1'), ligne('m3', 'represente', 'm1'), ligne('m4', 'represente', 'm1'), ligne('m5', 'represente', 'm6'), ligne('m6', 'absent'), ligne('m7', 'represente', ''), ligne('m8', 'represente', 'm8')] });
  const p = R.pouvoirs(E, r, r.emargement);
  assert.deepEqual(simple(p.valides.map((x) => x.membre)), ['m2', 'm3']);
  assert.deepEqual(simple(p.refuses.map((x) => [x.membre, x.raison])), [['m4', 'plafond'], ['m5', 'mandataire-absent'], ['m7', 'sans-mandataire'], ['m8', 'soi-meme']]);
  // Plafond 0 : sans limite.
  E.regles.instances.ago.pouvoirs.plafond = 0;
  assert.equal(R.pouvoirs(E, r, r.emargement).valides.length, 3);
  // Pouvoirs non admis.
  E.regles.instances.ago.pouvoirs.autorises = false;
  const p2 = R.pouvoirs(E, r, r.emargement);
  assert.equal(p2.valides.length, 0);
  assert.ok(p2.refuses.every((x) => x.raison === 'non-admis'));
});

test('majorités : simple, absolue des présents, deux tiers, unanimité ; quorum non atteint ; décompte invalide', () => {
  const E = etat();
  const em = Array.from({ length: 10 }, (_, i) => ligne(`m${i + 1}`, 'present'));
  const r = ag({ emargement: em, points: [{ id: 'p', titre: 'Comptes', vote: true }] });
  const pr = R.presence(E, r, AUJ);
  const qu = R.quorum(E, r, AUJ, pr);
  assert.equal(pr.voix, 10);
  const vote = (majorite, pour, contre, abstention) => R.resultat(E, r, R.normaliserPoint({ titre: 'x', vote: true, majorite, pour, contre, abstention }), pr, qu);
  // Simple : plus de pour que de contre, abstentions exclues.
  assert.equal(vote('simple', 4, 3, 3).statut, 'adoptee');
  assert.equal(vote('simple', 4, 4, 2).statut, 'rejetee');
  assert.equal(vote('simple', 4, 3, 3).requis, 4);
  // Absolue des présents et représentés : plus de 5 sur 10.
  assert.equal(vote('absolue', 5, 0, 5).statut, 'rejetee');
  assert.equal(vote('absolue', 6, 0, 4).statut, 'adoptee');
  // Deux tiers des exprimés : 6 pour, 3 contre = 2/3 tout juste (« au moins »).
  assert.equal(vote('deux-tiers', 6, 3, 1).statut, 'adoptee');
  assert.equal(vote('deux-tiers', 5, 3, 2).statut, 'rejetee');
  // Unanimité des présents : une abstention empêche.
  assert.equal(vote('unanimite', 10, 0, 0).statut, 'adoptee');
  assert.equal(vote('unanimite', 9, 0, 1).statut, 'rejetee');
  // Aucune voix exprimée : rejetée (base nulle).
  assert.equal(vote('simple', 0, 0, 10).statut, 'rejetee');
  // Plus de voix que de votants.
  assert.equal(vote('simple', 8, 3, 0).statut, 'invalide');
  // Point sans décompte, point sans vote.
  assert.equal(vote('simple', null, null, null).statut, 'non-vote');
  assert.equal(R.resultat(E, r, R.normaliserPoint({ titre: 'Info', vote: false }), pr, qu).statut, 'sans-vote');
  // Majorité par défaut de l'instance : AG extraordinaire en deux tiers.
  const age = R.normaliserReunion({ instance: 'age', date: '2026-12-12', emargement: em });
  const x = R.resultat(E, age, R.normaliserPoint({ titre: 'Statuts', vote: true, pour: 6, contre: 4, abstention: 0 }), R.presence(E, age, AUJ), { atteint: true });
  assert.equal(x.majorite.id, 'deux-tiers');
  assert.equal(x.statut, 'rejetee');
  // Quorum non atteint : délibération impossible.
  const peu = ag({ emargement: [ligne('m1', 'present'), ligne('m2', 'present')] });
  peu.emargement = R.construireEmargement(E, peu, AUJ);
  const pr2 = R.presence(E, peu, AUJ);
  const qu2 = R.quorum(E, peu, AUJ, pr2);
  assert.equal(qu2.atteint, false);
  assert.equal(R.resultat(E, peu, R.normaliserPoint({ titre: 'x', vote: true, pour: 2, contre: 0, abstention: 0 }), pr2, qu2).statut, 'sans-quorum');
});

test('textes des règles', () => {
  const E = etat();
  assert.equal(R.texteQuorum(E, 'ago', E.regles.instances.ago.quorum), 'au moins le quart des membres votants présents ou représentés');
  assert.equal(R.texteQuorum(E, 'ca', E.regles.instances.ca.quorum), 'au moins la moitié des membres présents');
  assert.equal(R.texteQuorum(E, 'ago', { type: 'nombre', nombre: 12 }), 'au moins 12 membres présents ou représentés');
  assert.equal(R.texteMajorite(R.majorite(E, 'simple')), 'plus de la moitié des suffrages exprimés (pour et contre)');
  assert.equal(R.texteMajorite(R.majorite(E, 'deux-tiers')), 'au moins les deux tiers des suffrages exprimés (pour et contre)');
  assert.equal(R.texteMajorite(R.majorite(E, 'unanimite')), 'la totalité des présents et représentés');
  assert.equal(R.texteMajorite({ base: 'exprimes', num: 3, den: 5, comparaison: 'atteint' }), 'au moins 3/5 des suffrages exprimés (pour et contre)');
});

test('mandats : échéance calculée, états, renouvellement, 29 février', () => {
  assert.equal(R.ajoutAnnees('2024-02-29', 1), '2025-02-28');
  assert.equal(R.ajoutAnnees('2024-06-15', 3), '2027-06-15');
  const m = R.normaliserMandat({ membre: 'a', debut: '2023-12-01', duree: 3 });
  assert.equal(R.finMandat(m), '2026-12-01');
  assert.equal(R.etatMandat(m, AUJ, 90), 'a-renouveler');
  assert.equal(R.etatMandat(m, AUJ, 10), 'en-cours');
  assert.equal(R.etatMandat(m, '2026-12-02', 90), 'echu');
  assert.equal(R.etatMandat(R.normaliserMandat({ membre: 'a', debut: '2027-01-01', duree: 3 }), AUJ), 'a-venir');
  assert.equal(R.etatMandat(R.normaliserMandat({ membre: 'a', debut: '2020-01-01', duree: 0 }), AUJ), 'en-cours');
  assert.equal(R.finMandat(R.normaliserMandat({ membre: 'a', debut: '2020-01-01', duree: 3, fin: '2023-04-30' })), '2023-04-30');
  const E = etat({ mandats: [{ id: 'x', membre: 'm1', instance: 'bureau', fonction: 'Trésorière', debut: '2023-12-01', duree: 3 }] });
  const { E: E2, nouveau } = R.renouveler(E, 'x', '2026-12-12');
  assert.equal(E2.mandats.length, 2);
  assert.equal(E2.mandats[0].closLe, '2026-12-12');
  assert.equal(R.etatMandat(E2.mandats[0], '2026-12-13'), 'clos');
  assert.equal(nouveau.debut, '2026-12-12');
  assert.equal(R.finMandat(nouveau), '2029-12-12');
  assert.equal(nouveau.fonction, 'Trésorière');
  assert.equal(E.mandats.length, 1, 'état d\'origine intact');
  // Mandats à renouveler à l'AG du 12/12/2026 : échéance au plus tard un mois après.
  const E3 = etat({ mandats: [
    { id: 'a', membre: 'm1', debut: '2023-12-01', duree: 3 },
    { id: 'b', membre: 'm2', debut: '2024-01-10', duree: 3, fin: '2027-01-10' },
    { id: 'c', membre: 'm3', debut: '2025-06-01', duree: 3 },
  ] });
  assert.deepEqual(simple(R.mandatsARenouveler(E3, ag()).map((x) => x.id)), ['a', 'b']);
});

test('rétroplanning : dates depuis la limite de convocation et la réunion, états', () => {
  const E = etat();
  E.regles.instances.ago.delai = 15;
  const r = R.nouvelleReunion(B, E, { instance: 'ago', date: '2026-12-12' });
  assert.equal(R.dateLimiteConvocation(E, r), '2026-11-27');
  const l = R.etapesDatees(E, r, AUJ);
  const conv = l.find((e) => e.cle === 'convocation');
  assert.equal(conv.date, '2026-11-27');
  assert.equal(l.find((e) => e.cle === 'tenue').date, '2026-12-12');
  assert.equal(l.find((e) => e.cle === 'pv').date, '2026-12-27');
  assert.equal(l.find((e) => e.cle === 'date').etat, 'retard'); // 28/10, déjà passé
  assert.equal(l.find((e) => e.cle === 'rapports').etat, 'bientot'); // 20/11, dans la semaine
  assert.equal(conv.etat, 'a-venir');
  for (let i = 1; i < l.length; i++) assert.ok(l[i - 1].date <= l[i].date);
  // Convocation.
  assert.equal(R.etatConvocation(E, r, AUJ).etat, 'a-envoyer');
  assert.equal(R.etatConvocation(E, r, '2026-11-28').etat, 'retard');
  r.convoqueLe = '2026-11-25';
  assert.equal(R.etatConvocation(E, r, AUJ).etat, 'envoyee');
  r.convoqueLe = '2026-11-30';
  assert.equal(R.etatConvocation(E, r, AUJ).etat, 'tardive');
  // Ordre du jour type et trame selon l'instance.
  assert.ok(r.points.length >= 5);
  assert.ok(r.points.some((p) => p.vote));
  const ca = R.nouvelleReunion(B, E, { instance: 'ca', date: '2026-12-01' });
  assert.equal(ca.trame, 'conseil');
  assert.equal(ca.etapes.length, B.etapes.conseil.length);
});

test('convocation, pouvoir et procès-verbal remplis', () => {
  const E = etat();
  const r = R.nouvelleReunion(B, E, { instance: 'ago', date: '2026-12-12', heure: '14:30', lieu: 'salle des fêtes de Valbrune' });
  const c = R.texteConvocation(B, E, r, AUJ);
  assert.match(c, /^Les Amis du Val/);
  assert.match(c, /samedi 12 décembre 2026 à 14 h 30, salle des fêtes de Valbrune/);
  assert.match(c, /1\. Accueil, émargement/);
  assert.match(c, /chaque membre peut détenir au plus 2 pouvoirs/);
  assert.match(c, /que si au moins le quart des membres votants sont présents ou représentés\./);
  assert.match(c, /Seuls les membres à jour de leur cotisation/);
  assert.doesNotMatch(c, /\{|\}/);
  assert.doesNotMatch(c, /seconde convocation/);
  r.convocationNo = 2;
  assert.match(R.texteConvocation(B, E, r, AUJ), /seconde convocation/);
  // Pouvoirs non admis : pas de phrase.
  E.regles.instances.ago.pouvoirs.autorises = false;
  assert.doesNotMatch(R.texteConvocation(B, E, r, AUJ), /pouvoir joint/);
  assert.match(R.textePouvoir(B, E, r, AUJ), /Bon pour pouvoir/);
  assert.equal(R.heureTexte('09:00'), '09 h');
  assert.equal(R.dateTexte('2026-12-01'), '1er décembre 2026');

  const E2 = etat();
  const r2 = ag({ president: 'Claire Exemple', secretaire: 'Marc Exemple', heureFin: '17:00', convoqueLe: '2026-11-20',
    emargement: [ligne('m1', 'present'), ligne('m2', 'present'), ligne('m3', 'present'), ligne('m4', 'present'), ligne('m5', 'represente', 'm1'), ligne('m6', 'excuse')],
    points: [{ titre: 'Rapport moral', vote: true, resolution: 'L\'assemblée approuve le rapport moral.', pour: 5, contre: 0, abstention: 0, notes: 'La présidente présente le bilan.' }, { titre: 'Questions diverses', vote: false }] });
  r2.emargement = R.construireEmargement(E2, r2, AUJ);
  const pv = R.textePV(B, E2, r2, AUJ);
  assert.match(pv, /Procès-verbal de l'assemblée générale ordinaire/);
  assert.match(pv, /Membres votants : 16\. Présents : 4\. Représentés : 1\. Excusés : Membre 06\./);
  assert.match(pv, /Le quorum \(au moins le quart des membres votants présents ou représentés, soit 4 sur 16\) est atteint/);
  assert.match(pv, /pour 5, contre 0, abstentions 0\. La résolution est adoptée\./);
  assert.match(pv, /La présidente présente le bilan\./);
  assert.match(pv, /séance est levée à 17 h/);
  assert.doesNotMatch(pv, /\{|\}/);
});

test('membres : liste collée, import sans doublon, cotisations remises à zéro, suppression RGPD', () => {
  const a = R.analyserListe('Nom;Catégorie;E-mail;Cotisation\nAlice Exemple;Membre actif;alice@asso.example;oui\nBruno Exemple\t\tbruno@asso.example\tnon\n;;\nChloé Exemple;Membre d\'honneur');
  assert.equal(a.membres.length, 3);
  assert.equal(a.erreurs.length, 1);
  assert.deepEqual(simple(a.membres[0]), { nom: 'Alice Exemple', email: 'alice@asso.example', categorie: 'Membre actif', cotisation: true });
  assert.equal(a.membres[1].cotisation, false);
  assert.equal(a.membres[2].categorie, 'Membre d\'honneur');
  const E = R.normaliser({ membres: [{ id: 'x', nom: 'alice exemple' }] });
  const r = R.importer(E, a.membres);
  assert.equal(r.crees, 2);
  assert.equal(r.completes, 1);
  assert.equal(r.E.membres.find((m) => m.id === 'x').email, 'alice@asso.example');
  assert.equal(r.E.membres.find((m) => m.id === 'x').cotisation, true);
  const z = R.cotisationsAZero(r.E);
  assert.equal(z.n, 1);
  assert.ok(z.E.membres.every((m) => !m.cotisation));
  // Suppression : fiche, mandats, réunions à venir ; PV passés intacts.
  const E2 = etat({ mandats: [{ membre: 'm1', debut: '2025-01-01' }], reunions: [
    { id: 'passee', instance: 'ago', date: '2025-12-13', emargement: [ligne('m1', 'present'), ligne('m2', 'represente', 'm1')] },
    { id: 'future', instance: 'ago', date: '2026-12-12', emargement: [ligne('m1', 'present'), ligne('m2', 'represente', 'm1')] },
  ] });
  const E3 = R.supprimerMembre(E2, 'm1', AUJ);
  assert.equal(E3.membres.length, 19);
  assert.equal(E3.mandats.length, 0);
  assert.equal(R.reunion(E3, 'passee').emargement.length, 2);
  assert.equal(R.reunion(E3, 'future').emargement.length, 1);
  assert.equal(R.reunion(E3, 'future').emargement[0].mandataire, '');
});

test('réunions : états, prochaine, archive par année ; indicateurs', () => {
  const E = etat({ reunions: [
    { id: 'a', instance: 'ago', date: '2025-12-13', pvSigneLe: '2025-12-20' },
    { id: 'b', instance: 'ca', date: '2026-09-15' },
    { id: 'c', instance: 'ago', date: '2026-12-12' },
    { id: 'd', instance: 'bureau', date: '2026-11-20' },
  ], mandats: [
    { membre: 'm1', instance: 'bureau', debut: '2023-12-01', duree: 3 },
    { membre: 'm2', instance: 'bureau', debut: '2022-06-01', duree: 3 },
    { membre: 'm3', instance: 'ca', debut: '2025-12-13', duree: 3 },
  ] });
  E.reunions.forEach((r) => { r.etapes = R.etapesBase(B, r.instance); });
  assert.equal(R.etatReunion(R.reunion(E, 'a'), AUJ), 'archivee');
  assert.equal(R.etatReunion(R.reunion(E, 'b'), AUJ), 'pv-a-faire');
  assert.equal(R.etatReunion(R.reunion(E, 'c'), AUJ), 'a-venir');
  assert.equal(R.prochaine(E, AUJ).id, 'd');
  assert.equal(R.prochaine(E, AUJ, (r) => R.estAG(r.instance)).id, 'c');
  assert.deepEqual(simple(R.parAnnee(E).map(([a, l]) => [a, l.map((r) => r.id)])), [['2026', ['b', 'd', 'c']], ['2025', ['a']]]);
  const i = R.indicateurs(E, AUJ);
  assert.equal(i.votants, 20);
  assert.equal(i.aJour, 16);
  assert.equal(i.aRenouveler, 1);
  assert.equal(i.echus, 1);
  assert.equal(i.pvAFaire, 1);
  assert.equal(i.prochaine.id, 'd');
  assert.ok(i.etapesRetard > 0);
  assert.equal(i.reglesAVerifier.length, 4);
});

test('CSV : point-virgule, BOM, guillemets', () => {
  const E = etat({ membres: [{ id: 'a', nom: 'Alice "Lili" Exemple', categorie: 'Membre actif', cotisation: true, email: 'alice@asso.example' }], mandats: [{ membre: 'a', instance: 'bureau', fonction: 'Présidente', debut: '2024-06-01', duree: 3 }],
    reunions: [{ instance: 'ago', date: '2025-12-13', emargement: [ligne('a', 'present')], points: [{ titre: 'Comptes; exercice', vote: true, pour: 1, contre: 0, abstention: 0 }] }] });
  const c = R.csvMembres(E, AUJ);
  assert.ok(c.startsWith('﻿Nom;Catégorie;Votant'));
  assert.match(c, /"Alice ""Lili"" Exemple";Membre actif;oui;oui;alice@asso\.example;;Présidente \(bureau\)/);
  assert.match(R.csvMandats(E, AUJ), /Présidente;Bureau;2024-06-01;3;2027-06-01;;en-cours/);
  assert.match(R.csvArchive(E, AUJ), /2025-12-13;Assemblée générale ordinaire;1;1;1;0;atteint;;"Comptes; exercice";Majorité simple;1;0;0;adoptee/);
});
