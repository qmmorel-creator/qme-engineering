// Tests des règles métier du planning de révision (templates/revision/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/revision/', import.meta.url);
const ctx = { window: {}, TextEncoder, structuredClone };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.REVR;
const B = ctx.window.BASE;
const T = '2026-11-16';

function etat(chargeMax = 8) {
  return { reglages: { intervalles: [...B.intervalles], chargeMax }, matieres: [], chapitres: [], blancs: {}, focus: {} };
}
let n = 0;
function chapitre(e, matiereId, appris, extra = {}) {
  const c = { id: `c${n++}`, matiereId, titre: `Chapitre ${n}`, appris, etape: 0, prochaine: null, finale: false, finaleFaite: false, historique: [], motsCles: '' };
  if (appris) R.planifier(e, c, appris, 0);
  Object.assign(c, extra);
  e.chapitres.push(c);
  return c;
}

test('les intervalles par défaut restent J+1, J+3, J+7, J+14, J+30', () => {
  assert.deepEqual([...B.intervalles], [1, 3, 7, 14, 30]);
});

test('planification : première révision le lendemain, rien le jour de l\'examen ni après', () => {
  const e = etat();
  e.matieres.push({ id: 'm', nom: 'Biochimie', examen: '2026-11-20' });
  const c = chapitre(e, 'm', T);
  assert.equal(c.prochaine, '2026-11-17');
  R.appliquerEvaluation(e, c, 'moyen', '2026-11-17');
  assert.equal(c.prochaine, '2026-11-19', 'J+3 tomberait le jour de l\'examen : ramené à la veille');
  R.appliquerEvaluation(e, c, 'moyen', '2026-11-19');
  assert.equal(c.prochaine, null);
});

test('jauge : la projection augmente le nombre de chapitres solides et compte les chapitres à venir', () => {
  const e = etat();
  e.matieres.push({ id: 'm', nom: 'Anatomie', examen: R.ajout(T, 30) });
  for (let i = 0; i < 4; i++) chapitre(e, 'm', R.ajout(T, -1));
  chapitre(e, 'm', null);
  const j = R.jauge(e, 'm', T);
  assert.equal(j.total, 5);
  assert.equal(j.aVenir, 1);
  assert.equal(j.solidesAujourdhui, 0);
  assert.equal(j.solidesJourJ, 4, 'J+1, J+3 et J+7 tiennent dans les 30 jours');
  assert.equal(j.jours, 30);
  assert.ok(j.revisions >= 12);
  assert.equal(e.chapitres[0].historique.length, 0, 'la simulation ne modifie pas l\'état');
});

test('jauge : sans date d\'examen, pas de projection', () => {
  const e = etat();
  e.matieres.push({ id: 'm', nom: 'Anglais', examen: null });
  chapitre(e, 'm', T);
  assert.equal(R.jauge(e, 'm', T).solidesJourJ, null);
});

test('rattrapage : répartit les retards sans dépasser la charge, examen proche d\'abord', () => {
  const e = etat(3);
  e.matieres.push({ id: 'a', nom: 'A', examen: R.ajout(T, 3) }, { id: 'b', nom: 'B', examen: null });
  for (let i = 0; i < 4; i++) chapitre(e, 'b', '2026-11-01', { prochaine: R.ajout(T, -5 + i) });
  for (let i = 0; i < 2; i++) chapitre(e, 'a', '2026-11-01', { prochaine: R.ajout(T, -1) });
  chapitre(e, 'b', '2026-11-01', { prochaine: T }); // déjà prévu aujourd'hui
  const plan = R.planRattrapage(e, T);
  assert.equal(plan.affectations.length, 6);
  const premiers = plan.affectations.slice(0, 2).map((a) => e.chapitres.find((c) => c.id === a.id).matiereId);
  assert.deepEqual([...premiers], ['a', 'a']);
  assert.deepEqual(JSON.parse(JSON.stringify(plan.jours.map((j) => [j.date, j.n]))), [[T, 2], [R.ajout(T, 1), 3], [R.ajout(T, 2), 1]]);
  R.appliquerRattrapage(e, plan);
  assert.ok(e.chapitres.every((c) => c.prochaine >= T));
});

test('rattrapage : jamais le jour de l\'examen, même si tout est plein', () => {
  const e = etat(2);
  e.matieres.push({ id: 'a', nom: 'A', examen: R.ajout(T, 2) });
  for (let i = 0; i < 6; i++) chapitre(e, 'a', '2026-11-01', { prochaine: R.ajout(T, -1) });
  const plan = R.planRattrapage(e, T);
  assert.ok(plan.affectations.every((a) => a.date < R.ajout(T, 2)));
});

test('import : matières en titre, puces et numéros retirés, doublons ignorés', () => {
  const texte = `BIOCHIMIE
1. Les glucides
2) Les lipides
- Les lipides
Chapitre 3 : Enzymologie

# Anatomie
• Ostéologie du membre supérieur
Physiologie :
  a. Le cœur
  b. La respiration`;
  const g = R.analyserProgramme(texte);
  assert.deepEqual([...g.map((x) => x.matiere)], ['Biochimie', 'Anatomie', 'Physiologie']);
  assert.deepEqual([...g[0].chapitres], ['Les glucides', 'Les lipides', 'Enzymologie']);
  assert.deepEqual([...g[2].chapitres], ['Le cœur', 'La respiration']);
});

test('import : un mot qui commence comme un préfixe (Chimie, Leçon, Partie civile) garde toutes ses lettres', () => {
  assert.equal(R.nettoyerLigne('Chimie organique'), 'Chimie organique');
  assert.equal(R.nettoyerLigne('Choisir sa question'), 'Choisir sa question');
  assert.equal(R.nettoyerLigne('Leçon inaugurale'), 'Leçon inaugurale');
  assert.equal(R.nettoyerLigne('Partie civile'), 'Partie civile');
  assert.equal(R.nettoyerLigne('Chromosomes et méiose'), 'Chromosomes et méiose');
  assert.equal(R.nettoyerLigne('1789 : la Révolution'), '1789 : la Révolution');
  // Les vrais préfixes restent retirés.
  assert.equal(R.nettoyerLigne('Ch. 4 - Ondes'), 'Ondes');
  assert.equal(R.nettoyerLigne('UE1 Biochimie'), 'Biochimie');
  assert.equal(R.nettoyerLigne('Chapitre IV – Optique'), 'Optique');
  assert.equal(R.nettoyerLigne('Thème : Mondialisation'), 'Mondialisation');
  const g = R.analyserProgramme('CHIMIE\n1. Atomistique\nCHRONOLOGIE :\nLa guerre froide');
  assert.deepEqual([...g.map((x) => x.matiere)], ['Chimie', 'Chronologie']);
});

test('import : sans titre de matière, un seul groupe sans matière', () => {
  const g = R.analyserProgramme('La conscience\nL\'inconscient\n\nLe devoir');
  assert.equal(g.length, 1);
  assert.equal(g[0].matiere, null);
  assert.equal(g[0].chapitres.length, 3);
});

test('feuille blanche : mots-clés retrouvés malgré accents, pluriels et casse', () => {
  const r = R.comparerRappel('Les ENZYMES abaissent l\'énergie d\'activation ; Michaelis et la constante Km', 'enzyme, énergie d\'activation, Michaelis-Menten, inhibition compétitive, Km');
  assert.deepEqual([...r.trouves], ['enzyme', 'énergie d\'activation', 'Km']);
  assert.deepEqual([...r.manques], ['Michaelis-Menten', 'inhibition compétitive']);
  assert.equal(r.taux, 0.6);
  assert.equal(r.suggestion, 'moyen');
  assert.equal(R.comparerRappel('texte', '').suggestion, null);
});

test('force du souvenir : 100 % le jour même, 90 % le jour prévu de la révision', () => {
  const e = etat();
  e.matieres.push({ id: 'm', nom: 'M', examen: null });
  const c = chapitre(e, 'm', T);
  assert.equal(R.forceSouvenir(e, c, T), 100);
  assert.equal(R.forceSouvenir(e, c, c.prochaine), 90);
  assert.equal(R.forceSouvenir(e, chapitre(e, 'm', null), T), null);
});

test('examens blancs : J-10 et J-4, dus quand la date est passée et pas encore faits', () => {
  const e = etat();
  e.matieres.push({ id: 'm', nom: 'M', examen: R.ajout(T, 4) }, { id: 'x', nom: 'X', examen: null });
  const b = R.examensBlancs(e, T);
  assert.equal(b.length, 2);
  assert.deepEqual([...b.map((x) => x.du)], [true, true]);
  e.blancs[b[0].cle] = 'fait';
  assert.equal(R.examensBlancs(e, T).filter((x) => x.du).length, 1);
  e.reglages.examensBlancs = false;
  assert.equal(R.examensBlancs(e, T).length, 0);
});

test('série et paliers', () => {
  const e = etat();
  e.matieres.push({ id: 'm', nom: 'M', examen: null });
  const c = chapitre(e, 'm', '2026-11-01');
  for (let i = 0; i < 8; i++) c.historique.push({ date: R.ajout(T, -i), eval: 'moyen', etape: 0 });
  c.historique.push({ date: R.ajout(T, -12), eval: 'moyen', etape: 0 });
  assert.equal(R.serie(e, T), 8);
  assert.equal(R.meilleureSerie(e), 8);
  const p = R.paliers(8, 8);
  assert.deepEqual([...p.atteints], [3, 7]);
  assert.equal(p.prochain, 14);
});

test('bilan de semaine : révisions, jours, taux et minutes de concentration', () => {
  const e = etat();
  e.matieres.push({ id: 'm', nom: 'M', examen: null });
  const c = chapitre(e, 'm', '2026-11-01');
  c.historique.push({ date: T, eval: 'facile' }, { date: R.ajout(T, -1), eval: 'difficile' }, { date: R.ajout(T, -9), eval: 'moyen' });
  e.focus = { [T]: 50, [R.ajout(T, -2)]: 25, [R.ajout(T, -8)]: 99 };
  const s = R.bilanSemaine(e, T);
  assert.equal(s.revisions, 2);
  assert.equal(s.jours, 2);
  assert.equal(s.taux, 50);
  assert.equal(s.minutes, 75);
  assert.equal(s.parJour.length, 7);
});

test('export .ics : une séance par jour avec rappel, examens en journée entière, lignes ≤ 75 octets', () => {
  const e = etat();
  e.matieres.push({ id: 'm', nom: 'Biochimie, enzymes; métabolisme', examen: R.ajout(T, 20) });
  chapitre(e, 'm', T, { titre: 'Un titre très long '.repeat(6) });
  const ics = R.exportIcs(e, T, { heure: '18:30' });
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(ics.includes(`DTSTART:${R.ajout(T, 1).replace(/-/g, '')}T183000`));
  assert.ok(ics.includes('TRIGGER:PT0M'));
  assert.ok(ics.includes('Biochimie\\, enzymes\\; métabolisme'));
  assert.ok(ics.includes(`DTSTART;VALUE=DATE:${R.ajout(T, 20).replace(/-/g, '')}`));
  for (const l of ics.split('\r\n')) assert.ok(new TextEncoder().encode(l).length <= 75, l);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, (ics.match(/END:VEVENT/g) || []).length);
});

test('pack : rapprochement des matières par le nom', () => {
  assert.ok(R.memeMatiere('Biochimie', 'BIOCHIMIE'));
  assert.ok(R.memeMatiere('UE1 Biochimie', 'Biochimie'));
  assert.ok(R.memeMatiere('Histoire-géographie', 'Histoire géographie'));
  assert.ok(!R.memeMatiere('Physique', 'Physiologie'));
  assert.ok(!R.memeMatiere('Chimie', 'Biochimie'));
});

test('pack Notes : moyenne sur 20, poids du coefficient, priorité', () => {
  const e = etat();
  e.matieres.push({ id: 'b', nom: 'Biochimie' }, { id: 'a', nom: 'Anatomie' }, { id: 's', nom: 'SHS' });
  const notes = {
    matieres: [{ id: 'nb', nom: 'Biochimie', coef: 4 }, { id: 'na', nom: 'Anatomie', coef: 2 }, { id: 'ns', nom: 'Sciences humaines', coef: 2 }],
    notes: [
      { matiere: 'nb', valeur: 9, sur: 20, coef: 1 }, { matiere: 'nb', valeur: 22, sur: 40, coef: 1 },
      { matiere: 'na', valeur: 15, sur: 20, coef: 1 }, { matiere: 'na', prevue: true, date: '2026-12-01', sur: 20, coef: 1 },
      { matiere: 'nb', lettre: 'A', sur: 20, coef: 1 },
    ],
  };
  const p = R.prioritesNotes(e, notes);
  assert.equal(p.length, 2);
  assert.equal(p[0].matiereId, 'b');
  assert.equal(p[0].moyenne, 10);
  assert.equal(p[0].poids, 0.5);
  assert.equal(p[1].prochaine, '2026-12-01');
});

test('pack Planner : créneaux libres entre les blocs et les séries', () => {
  const planner = {
    reglages: { debut: 8 * 60, fin: 20 * 60 },
    blocs: [{ date: T, debut: 8 * 60, duree: 240 }, { date: T, debut: 14 * 60, duree: 120 }],
    series: [{ jours: [0], debut: 17 * 60, duree: 60, depuis: '2026-01-01', jusqua: null, exceptions: {} }], // lundi
  };
  const l = R.creneauxLibres(planner, T);
  assert.deepEqual(JSON.parse(JSON.stringify(l.map((c) => [c.debut / 60, c.fin / 60]))), [[12, 14], [16, 17], [18, 20]]);
  assert.deepEqual(JSON.parse(JSON.stringify(R.creneauxLibres(planner, T, { depuis: 19 * 60 }).map((c) => [c.debut / 60, c.fin / 60]))), [[19, 20]]);
});

test('pack Habitudes : pas de conclusion sous 10 jours ni sous 3 jours par groupe', () => {
  const e = etat();
  e.matieres.push({ id: 'm', nom: 'M' });
  const c = chapitre(e, 'm', '2026-10-01');
  const journal = {};
  for (let i = 0; i < 12; i++) {
    const d = R.ajout(T, -i);
    c.historique.push({ date: d, eval: i % 2 ? 'difficile' : 'facile' });
    journal[d] = { 'sommeil-heures': i % 2 ? 6 : 8 };
  }
  const s = R.sommeilEtReussite(e, { journal });
  assert.ok(s.suffisant);
  assert.equal(s.court.taux, 0);
  assert.equal(s.long.taux, 100);
  assert.equal(R.sommeilEtReussite(e, { journal: {} }).suffisant, false);
});
