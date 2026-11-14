// Tests des règles métier du suivi du bébé (templates/bebe/regles.js et donnees.js), et des garde-fous de
// app.js : rien n'est enregistré ni envoyé avant le consentement, produit envoyé à la connexion, aucune norme.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/bebe/', import.meta.url);
const ctx = { window: {}, TextEncoder };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.BBE;
const B = ctx.window.BASE;
const APP = readFileSync(new URL('app.js', dossier), 'utf8');
const simple = (o) => JSON.parse(JSON.stringify(o));
const MAINTENANT = '2026-11-14T15:30';
const ev = (x) => R.normaliserEvenement({ enfantId: 'e1', ...x });
const etat = (evenements = [], extra = {}) => Object.assign(R.etatVide(B), { consentement: { date: '2026-11-14T08:00:00Z', version: '2026-11-14' }, enfants: [R.normaliserEnfant({ id: 'e1', prenom: 'Lou', naissance: '2026-09-03' })], evenements: evenements.map(ev) }, extra);

test('base : aucune norme, aucune marque, aucune courbe de référence', () => {
  const texte = JSON.stringify(B);
  assert.doesNotMatch(texte, /percentile|z-score|\bP3\b|\bP97\b/i);
  assert.doesNotMatch(texte, /\b(mg|posologie|dose)\b/i);
  assert.equal(B.courbes, undefined, 'aucune table de référence intégrée');
  assert.match(B.sources.courbes, /OMS/);
  assert.match(B.sources.courbes, /CC BY-NC-SA 3\.0 IGO/);
  // Les contenus de biberon et les interlocuteurs sont génériques (aucun chiffre, aucune marque).
  assert.doesNotMatch(JSON.stringify(B.contenus) + JSON.stringify(B.interlocuteurs), /\d/);
  // Aucune quantité de lait ni durée de sommeil « recommandée » dans les règles.
  const regles = readFileSync(new URL('regles.js', dossier), 'utf8');
  assert.doesNotMatch(regles.replace(/\/\/.*$/gm, ''), /recommand/i);
});

test('dates et heures : horodatages locaux, minutes, durées', () => {
  assert.equal(R.estHoro('2026-11-14T09:05'), true);
  assert.equal(R.estHoro('2026-11-14 09:05'), false);
  assert.equal(R.estHoro('2026-02-30T09:05'), false);
  assert.equal(R.minutesEntre('2026-11-14T23:40', '2026-11-15T01:10'), 90);
  assert.equal(R.ajoutMinutes('2026-11-14T23:50', 20), '2026-11-15T00:10');
  assert.equal(R.texteDuree(45), '45 min');
  assert.equal(R.texteDuree(65), '1 h 05');
  assert.equal(R.texteDuree(120), '2 h');
  assert.equal(R.ilYa('2026-11-14T13:25', MAINTENANT), 'il y a 2 h 05');
  assert.equal(R.ilYa(MAINTENANT, MAINTENANT), 'à l\'instant');
  assert.equal(R.ilYa('2026-11-10T15:30', MAINTENANT), 'il y a 4 jours');
});

test('âge : jours, semaines, mois, ans', () => {
  assert.equal(R.texteAge('2026-11-14', '2026-11-14'), 'naissance');
  assert.equal(R.texteAge('2026-11-04', '2026-11-14'), '10 jours');
  assert.equal(R.texteAge('2026-10-10', '2026-11-14'), '5 semaines');
  assert.equal(R.texteAge('2026-09-03', '2026-11-14'), '2 mois et 1 semaine');
  assert.equal(R.texteAge('2024-08-08', '2026-11-14'), '2 ans et 3 mois');
  assert.equal(R.texteAge('2027-01-01', '2026-11-14'), '');
});

test('lecture des saisies : poids en kg ou g, cm, ml, durée', () => {
  assert.equal(R.lirePoids('5,46'), 5.46);
  assert.equal(R.lirePoids('5460 g'), 5.46);
  assert.equal(R.lirePoids('3450'), 3.45);
  assert.equal(R.lirePoids('0,1'), null);
  assert.equal(R.lirePoids('abc'), null);
  assert.equal(R.lireTaille('57,5 cm'), 57.5);
  assert.equal(R.lireTaille('5'), null);
  assert.equal(R.lirePc('39,5'), 39.5);
  assert.equal(R.lireMl('120 ml'), 120);
  assert.equal(R.lireMl('0'), null);
  assert.equal(R.lireMl('900'), null);
  assert.equal(R.lireDuree('15'), 15);
  assert.equal(R.lireDuree('1 h 10'), 70);
  assert.equal(R.lireDuree('0:45'), 45);
  assert.equal(R.lireDuree('0'), null);
});

test('événements : tétée au minuteur, durée, fin, normalisation tolérante', () => {
  const t = ev({ type: 'repas', mode: 'sein', cote: 'G', debut: '2026-11-14T15:10' });
  assert.equal(R.enCours(t), true);
  assert.equal(R.dureeMinutes(t, MAINTENANT), 20);
  const t2 = ev({ type: 'repas', mode: 'sein', cote: 'D', debut: '2026-11-14T12:00', fin: '2026-11-14T12:14' });
  assert.equal(R.enCours(t2), false);
  assert.equal(R.dureeMinutes(t2, MAINTENANT), 14);
  // Fin avant le début : ignorée.
  assert.equal(ev({ type: 'sommeil', debut: '2026-11-14T12:00', fin: '2026-11-14T11:00' }).fin, null);
  const n = R.normaliser({ enfants: [{ prenom: '' }], evenements: [{ type: 'inconnu', debut: 'x' }, { type: 'repas', mode: 'biberon', ml: '9999', debut: '2026-11-14T10:00' }], rdv: 'non', consentement: { version: '1' } }, B);
  assert.equal(n.enfants[0].prenom, 'Bébé');
  assert.equal(n.evenements[0].type, 'note');
  assert.equal(n.evenements[1].ml, 500);
  assert.deepEqual(simple(n.rdv), []);
  assert.equal(n.consentement, null, 'un consentement sans date est invalide');
  assert.equal(R.consentementValide(null), false);
  assert.equal(R.consentementValide({ date: '2026-11-14T08:00:00Z', version: '2026-11-14' }), true);
  assert.match(R.libelle(t, MAINTENANT), /Tétée · côté gauche · en cours/);
  assert.equal(R.libelle(ev({ type: 'couche', debut: MAINTENANT, pipi: true, selle: true })), 'Couche · pipi et selle');
});

test('résumé du jour : sommeil à cheval sur minuit, en cours, couches et repas', () => {
  const e = etat([
    { type: 'sommeil', debut: '2026-11-13T22:00', fin: '2026-11-14T03:00' },
    { type: 'repas', mode: 'sein', cote: 'G', debut: '2026-11-14T03:05', fin: '2026-11-14T03:20' },
    { type: 'repas', mode: 'biberon', ml: 120, debut: '2026-11-14T07:00' },
    { type: 'repas', mode: 'biberon', ml: 90, debut: '2026-11-14T11:00' },
    { type: 'couche', pipi: true, selle: false, debut: '2026-11-14T03:20' },
    { type: 'couche', pipi: true, selle: true, debut: '2026-11-14T07:15' },
    { type: 'sommeil', debut: '2026-11-14T14:30' }, // en cours
  ]);
  const r = R.resumeJour(e, 'e1', '2026-11-14', MAINTENANT);
  assert.equal(r.sommeilMin, 180 + 60, '3 h après minuit + 1 h en cours');
  assert.equal(r.sommeils, 1, 'seul le sommeil commencé ce jour est compté comme sommeil du jour');
  assert.equal(r.repas, 3);
  assert.equal(r.tetees, 1);
  assert.equal(r.minutesSein, 15);
  assert.equal(r.ml, 210);
  assert.equal(r.couches, 2);
  assert.equal(r.pipi, 2);
  assert.equal(r.selles, 1);
  const veille = R.resumeJour(e, 'e1', '2026-11-13', MAINTENANT);
  assert.equal(veille.sommeilMin, 120);
});

test('résumé de période : moyennes sur les jours notés, jour en cours exclu', () => {
  const e = etat([
    { type: 'couche', pipi: true, debut: '2026-11-12T10:00' },
    { type: 'couche', pipi: true, debut: '2026-11-12T12:00' },
    { type: 'couche', pipi: true, debut: '2026-11-13T10:00' },
    { type: 'couche', pipi: true, debut: '2026-11-14T10:00' }, // aujourd'hui : non compté dans la moyenne
  ]);
  const p = R.resumePeriode(e, 'e1', '2026-11-14', 7, MAINTENANT);
  assert.equal(p.jours.length, 7);
  assert.equal(p.jours[0].jour, '2026-11-08');
  assert.equal(p.joursNotes, 2, 'les jours sans saisie ne comptent pas comme zéro');
  assert.equal(p.moyennes.couches, 1.5);
  assert.equal(p.totaux.couches, 4);
  const vide = R.resumePeriode(etat(), 'e1', '2026-11-14', 7, MAINTENANT);
  assert.equal(vide.moyennes.couches, null);
});

test('état du moment : dernier repas, dernier côté, sommeil en cours, éveil', () => {
  const e = etat([
    { type: 'repas', mode: 'sein', cote: 'D', debut: '2026-11-14T12:00', fin: '2026-11-14T12:15' },
    { type: 'repas', mode: 'biberon', ml: 100, debut: '2026-11-14T14:00' },
    { type: 'sommeil', debut: '2026-11-14T12:20', fin: '2026-11-14T13:40' },
    { type: 'couche', pipi: true, debut: '2026-11-14T14:10' },
  ]);
  const s = R.etatDuMoment(e, 'e1', MAINTENANT);
  assert.equal(s.repas.mode, 'biberon');
  assert.equal(s.dernierCote, 'D');
  assert.equal(s.sommeilEnCours, null);
  assert.equal(s.reveilDepuis, '2026-11-14T13:40');
  assert.equal(s.couche.debut, '2026-11-14T14:10');
  e.evenements.push(ev({ type: 'sommeil', debut: '2026-11-14T15:00' }));
  assert.ok(R.etatDuMoment(e, 'e1', MAINTENANT).sommeilEnCours);
});

test('mesures : listes par grandeur, écart avec la précédente, sans référence', () => {
  const e = etat([
    { type: 'mesure', debut: '2026-09-03T10:00', poids: 3.35, taille: 49 },
    { type: 'mesure', debut: '2026-10-15T10:00', poids: 4.62 },
    { type: 'mesure', debut: '2026-11-12T10:00', poids: 5.46, taille: 57.5 },
  ]);
  const p = R.mesures(e, 'e1', 'poids');
  assert.deepEqual(p.map((x) => x.valeur), [3.35, 4.62, 5.46]);
  const s = R.statsMesure(p);
  assert.equal(s.ecart, 0.84);
  assert.equal(s.jours, 28);
  assert.equal(R.mesures(e, 'e1', 'pc').length, 0);
  assert.equal(R.statsMesure([]).dernier, null);
  assert.equal(typeof R.percentile, 'undefined');
});

test('fusion de deux appareils : union, dernière modification, suppressions, données effacées', () => {
  const base = etat([]);
  const a = simple(base), b = simple(base);
  a.evenements = [{ ...ev({ id: 'x1', type: 'couche', debut: '2026-11-14T10:00', pipi: true }), maj: 10 }, { ...ev({ id: 'x2', type: 'note', debut: '2026-11-14T10:00', texte: 'A' }), maj: 30 }];
  b.evenements = [{ ...ev({ id: 'x3', type: 'couche', debut: '2026-11-14T11:00', selle: true }), maj: 20 }, { ...ev({ id: 'x2', type: 'note', debut: '2026-11-14T10:00', texte: 'B' }), maj: 20 }];
  let f = R.fusionner(a, b);
  assert.deepEqual(simple(f.evenements.map((x) => x.id).sort()), ['x1', 'x2', 'x3']);
  assert.equal(f.evenements.find((x) => x.id === 'x2').texte, 'A', 'la modification la plus récente gagne');
  // Suppression sur un appareil : l'autre ne fait pas réapparaître l'élément.
  a.supprimes = { x3: 25 };
  f = R.fusionner(a, b);
  assert.ok(!f.evenements.some((x) => x.id === 'x3'));
  // Mais une modification postérieure à la suppression la garde.
  b.evenements[0].maj = 40;
  assert.ok(R.fusionner(a, b).evenements.some((x) => x.id === 'x3'));
  // Espace effacé depuis un autre appareil (sans consentement) : rien n'est fusionné ni ressuscité.
  const efface = R.etatVide(B);
  assert.equal(R.fusionner(a, efface), efface);
});

test('suppression d\'un enfant : ses saisies et rendez-vous partent, marqués pour la fusion', () => {
  const e = etat([{ id: 'v1', type: 'note', texte: 'x', debut: MAINTENANT }], { rdv: [R.normaliserRdv({ id: 'r1', enfantId: 'e1', quand: '2026-11-20T10:00' })] });
  const f = R.supprimerEnfant(e, 'e1', 99);
  assert.equal(f.enfants.length, 0);
  assert.equal(f.evenements.length, 0);
  assert.equal(f.rdv.length, 0);
  assert.deepEqual(simple(f.supprimes), { e1: 99, v1: 99, r1: 99 });
});

test('rendez-vous à venir et passés', () => {
  const e = etat([], { rdv: [
    R.normaliserRdv({ id: 'r1', enfantId: 'e1', quand: '2026-11-19T10:30', motif: 'Consultation' }),
    R.normaliserRdv({ id: 'r2', enfantId: 'e1', quand: '2026-10-15T10:00', fait: true }),
    R.normaliserRdv({ id: 'r3', enfantId: 'e1', quand: '2026-11-14T09:00' }),
  ] });
  assert.deepEqual(R.rdvAVenir(e, 'e1', MAINTENANT).map((r) => r.id), ['r3', 'r1']);
  assert.deepEqual(R.rdvPasses(e, 'e1', MAINTENANT).map((r) => r.id), ['r2']);
});

test('récapitulatif : jours non notés, mesures, questions, mention', () => {
  const e = etat([
    { type: 'couche', pipi: true, debut: '2026-11-13T10:00' },
    { type: 'mesure', debut: '2026-11-12T10:00', poids: 5.46 },
    { type: 'note', debut: '2026-11-13T18:00', texte: 'Premier sourire.' },
  ], { rdv: [R.normaliserRdv({ id: 'r1', enfantId: 'e1', quand: '2026-11-19T10:30', avec: 'PMI', questions: 'Biberons ?' })] });
  const c = R.recap(e, e.enfants[0], '2026-11-11', '2026-11-14', MAINTENANT);
  const t = R.texteRecap(c);
  assert.match(t, /Récapitulatif de Lou \(2 mois et 1 semaine\)/);
  assert.match(t, /11\/11\/2026 · non noté/);
  assert.match(t, /poids 5,46 kg le 12\/11\/2026/);
  assert.match(t, /Premier sourire/);
  assert.match(t, /Questions à poser : Biberons \?/);
  assert.match(t, /Ne remplace ni le carnet de santé ni l'avis du médecin/);
});

test('export CSV : en-têtes, rendez-vous, formules neutralisées', () => {
  const e = etat([{ type: 'note', debut: MAINTENANT, texte: '=1+1' }, { type: 'repas', mode: 'biberon', ml: 90, contenu: 'Lait maternel', debut: '2026-11-14T10:00' }], { rdv: [R.normaliserRdv({ enfantId: 'e1', quand: '2026-11-19T10:30', avec: 'PMI' })] });
  const csv = R.csv(e, MAINTENANT);
  assert.ok(csv.startsWith('﻿Date;Heure;Enfant;Type'));
  assert.match(csv, /'=1\+1/);
  assert.match(csv, /14\/11\/2026;10:00;Lou;biberon;Lait maternel;;;90/);
  assert.match(csv, /rendez-vous;PMI/);
});

test('app.js : rien n\'est enregistré ni envoyé avant le consentement', () => {
  // sauver() et envoyer() refusent tant que le consentement n'est pas valide.
  assert.match(APP, /function sauver\(\) \{\s*if \(!E \|\| !R\.consentementValide\(E\.consentement\)\) return;/);
  assert.match(APP, /async function envoyer\(\) \{\s*if \(session\.demo \|\| !E \|\| !R\.consentementValide\(E\.consentement\)\) return;/);
  // Premier lancement : cache local supprimé et écran de consentement, état vide (null).
  assert.match(APP, /else \{ E = null; stock\.suppr\(CLE_CACHE\); ecranConsentement\(\); \}/);
  // L'état n'est créé qu'après le consentement, au moment du premier enfant.
  const i = APP.indexOf('function ecranPremierEnfant');
  assert.ok(APP.indexOf('E.consentement = accueil.consentement;', i) > i);
  // Effacement depuis un autre appareil : retour à l'écran de consentement.
  assert.match(APP, /function donneesEffacees\(\)[\s\S]*?ecranConsentement\(/);
  // Démo : consentement simulé, jamais envoyé.
  assert.match(APP, /demo: true \}/);
  // Version du consentement enregistrée.
  assert.match(APP, /VERSION_CONSENTEMENT = '\d{4}-\d{2}-\d{2}'/);
});

test('app.js : produit envoyé dans les deux appels à /connexion (code administrateur)', () => {
  const appels = APP.match(/appel\('\/connexion', \{[^}]*\}\)/g) || [];
  assert.equal(appels.length, 2);
  for (const a of appels) assert.match(a, /produit: PRODUIT/);
  assert.match(APP, /const PRODUIT = 'BBE';/);
  assert.match(APP, /qme-bbe-code/);
  assert.match(APP, /class="bientot-demo" href="\/catalogue\/bebe\/"/);
  assert.match(APP, /qme-bbe-ecran-accueil/);
});
