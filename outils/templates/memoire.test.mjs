// Tests des règles métier du planning de mémoire ou de thèse (templates/memoire/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/memoire/', import.meta.url);
const ctx = { window: {}, TextEncoder };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.MMR;
const B = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));

// Projet type : rendu le 15/01/2027, soutenance le 01/02/2027, 20 000 mots, travail du lundi au vendredi.
function exemple(extra = {}) {
  return R.normaliser({
    projet: { type: 'master', titre: 'Mémoire fictif', debut: '2026-07-01', rendu: '2027-01-15', soutenance: '2027-02-01', objectifMots: 20000, motsParPage: 300, joursTravail: [1, 2, 3, 4, 5] },
    sections: [
      { id: 'intro', parent: '', niveau: 2, titre: 'Introduction', statut: 'relu', mots: 1500, objectif: 1600, ordre: 1 },
      { id: 'p1', parent: '', niveau: 1, titre: 'Partie 1', ordre: 2, mots: 200 },
      { id: 'c1', parent: 'p1', niveau: 2, titre: 'Chapitre 1', statut: 'brouillon', mots: 4000, objectif: 4000, ordre: 1 },
      { id: 'c2', parent: 'p1', niveau: 2, titre: 'Chapitre 2', ordre: 2 },
      { id: 's21', parent: 'c2', niveau: 3, titre: 'Section 2.1', statut: 'final', mots: 1300, objectif: 1500, ordre: 1 },
      { id: 's22', parent: 'c2', niveau: 3, titre: 'Section 2.2', statut: 'aecrire', mots: 0, objectif: 1500, ordre: 2 },
      { id: 'conc', parent: '', niveau: 2, titre: 'Conclusion', statut: 'aecrire', objectif: 1200, ordre: 3 },
    ],
    jalons: R.genererJalons(B, 'master'),
    ...extra,
  }, B);
}

test('base : types, jalons, plans complets et cohérents', () => {
  for (const t of Object.keys(B.types)) {
    assert.ok(B.jalons[t]?.length >= 5, `jalons ${t}`);
    assert.ok(B.plans[t]?.length >= 4, `plan ${t}`);
    assert.equal(B.plans[t].reduce((s, x) => s + x[2], 0), 100, `parts du plan ${t}`);
    assert.equal(B.jalons[t].filter((j) => j[3]).length, 1, `un seul jalon de fin de rédaction (${t})`);
    assert.ok(B.jalons[t].some((j) => j[1] === 'rendu' && j[2] === 0), `jalon de rendu (${t})`);
  }
  assert.deepEqual(Object.keys(B.couleursStatut), simple(R.ORDRE_STATUTS));
});

test('normaliser : tolère le vide, les champs inconnus et les arbres cassés', () => {
  const v = R.normaliser(null, B);
  assert.equal(v.projet.type, 'master');
  assert.deepEqual(simple(v.projet.joursTravail), [1, 2, 3, 4, 5]);
  const e = R.normaliser({
    projet: { type: 'inconnu', objectifMots: -5, rendu: '2027-02-30', joursTravail: [9, 1, 1] },
    sections: [
      { id: 'a', parent: 'b', titre: 'A' }, { id: 'b', parent: 'a', titre: 'B' }, // boucle
      { id: 'c', parent: 'zzz', titre: 'C', niveau: 3, statut: 'bof', mots: '12' }, // parent inconnu
      { id: 'd', parent: 'c', titre: 'D' }, { id: 'e', parent: 'd', titre: 'E' }, { id: 'f', parent: 'e', titre: 'F' },
    ],
    refs: [{ titre: 'X', sections: ['c', 'inconnue'], url: 'javascript:alert(1)' }],
    seances: [{ date: '2026-11-01', minutes: 90, section: 'inconnue' }],
    releves: [{ date: '2026-11-02', mots: 10 }, { date: '2026-11-01', mots: 5 }, { date: 'x', mots: 1 }],
  }, B);
  assert.equal(e.projet.type, 'master');
  assert.equal(e.projet.objectifMots, 0);
  assert.equal(e.projet.rendu, '');
  assert.deepEqual(simple(e.projet.joursTravail), [1]);
  const c = e.sections.find((s) => s.id === 'c');
  assert.equal(c.parent, '');
  assert.equal(c.niveau, 2);
  assert.equal(c.statut, 'aecrire');
  assert.equal(c.mots, 12);
  assert.ok(e.sections.filter((s) => ['a', 'b'].includes(s.id)).some((s) => s.parent === ''), 'boucle rompue');
  assert.equal(e.sections.find((s) => s.id === 'f').niveau, 3, 'profondeur plafonnée à la section');
  assert.deepEqual(simple(e.refs[0].sections), ['c']);
  assert.equal(e.refs[0].url, '');
  assert.equal(e.seances[0].section, '');
  assert.deepEqual(simple(e.releves.map((r) => r.date)), ['2026-11-01', '2026-11-02']);
});

test('plan : arbre, mots, objectifs et statut agrégé', () => {
  const e = exemple();
  assert.deepEqual(simple(R.arbre(e).map((x) => `${x.prof}:${x.s.id}`)), ['0:intro', '0:p1', '1:c1', '1:c2', '2:s21', '2:s22', '0:conc']);
  assert.equal(R.motsSection(e, 'c2'), 1300);
  assert.equal(R.motsSection(e, 'p1'), 200 + 4000 + 1300);
  assert.equal(R.totalMots(e), 1500 + 5500);
  assert.equal(R.objectifSection(e, 'c2'), 3000);
  assert.equal(R.objectifSection(e, 'p1'), 7000);
  assert.equal(R.statutAgrege(e, 'c2'), 'aecrire');
  assert.equal(R.statutAgrege(e, 'intro'), 'relu');
  assert.deepEqual(simple(R.motsParStatut(e, 'p1')), { aecrire: 200, brouillon: 4000, relu: 0, final: 1300 });
});

test('avancement par statut : pondéré par les mots visés, sinon à parts égales', () => {
  const e = exemple();
  const a = R.avancement(e);
  assert.equal(a.pondere, true);
  assert.equal(a.nb, 5);
  // (1600×0,8 + 4000×0,5 + 1500×1 + 1500×0 + 1200×0) / 9800
  assert.ok(Math.abs(a.part - (1280 + 2000 + 1500) / 9800) < 1e-9);
  assert.deepEqual(simple(a.parStatut), { aecrire: 2, brouillon: 1, relu: 1, final: 1 });
  const sans = R.modifierSection(e, 'conc', { objectif: 0 });
  assert.equal(R.avancement(sans).pondere, false);
  assert.ok(Math.abs(R.avancement(sans).part - (0.8 + 0.5 + 1 + 0 + 0) / 5) < 1e-9);
  assert.equal(R.avancement(e, 'c2').part, 0.5);
  assert.equal(R.avancement(R.etatVide(B)).part, 0);
});

test('plan : ajout, déplacement, changement de parent sans boucle, suppression', () => {
  let e = exemple();
  e = R.ajouterSection(e, { id: 's23', parent: 'c2', titre: 'Section 2.3' });
  const s23 = e.sections.find((s) => s.id === 's23');
  assert.equal(s23.niveau, 3);
  assert.equal(s23.ordre, 3);
  e = R.deplacerSection(e, 's23', -1);
  assert.deepEqual(simple(R.enfants(e, 'c2').map((s) => s.id)), ['s21', 's23', 's22']);
  assert.equal(R.deplacerSection(e, 's21', -1), e, 'premier : rien ne bouge');
  // Placer la partie sous un de ses descendants est refusé.
  const refus = R.modifierSection(e, 'p1', { parent: 's21' });
  assert.equal(refus.sections.find((s) => s.id === 'p1').parent, '');
  // Le chapitre 2 passe à la racine : niveaux recalculés, ordre en fin de liste.
  const r = R.modifierSection(e, 'c2', { parent: '' });
  assert.equal(r.sections.find((s) => s.id === 'c2').niveau, 2);
  assert.equal(R.enfants(r, '').at(-1).id, 'c2');
  e = { ...e, seances: [R.normaliserSeance({ id: 'x', date: '2026-11-10', minutes: 60, section: 's22' })], refs: [R.normaliserRef({ id: 'r', titre: 'T', sections: ['s22', 'intro'] })] };
  const sup = R.supprimerSection(e, 'c2');
  assert.ok(!sup.sections.some((s) => ['c2', 's21', 's22', 's23'].includes(s.id)));
  assert.equal(sup.seances[0].section, '');
  assert.deepEqual(simple(sup.refs[0].sections), ['intro']);
});

test('plan de départ : parties, chapitres et mots visés arrondis', () => {
  const p = R.genererPlan(B, 'master', 20000);
  const e = R.normaliser({ sections: p }, B);
  const racine = R.enfants(e, '');
  assert.deepEqual(simple(racine.map((s) => s.titre)), ['Introduction', 'Partie 1 · Cadre théorique', 'Partie 2 · Étude', 'Conclusion', 'Bibliographie et annexes']);
  assert.equal(racine[1].niveau, 1);
  assert.equal(R.enfants(e, racine[1].id).length, 2);
  assert.equal(R.enfants(e, racine[1].id)[0].niveau, 2);
  assert.equal(racine[0].objectif, 1600);
  assert.equal(R.objectifSection(e, racine[1].id), 3600 + 2000);
  assert.equal(R.feuilles(e).reduce((t, s) => t + s.objectif, 0), 20000);
  assert.ok(R.genererPlan(B, 'pfe', 0).every((s) => s.objectif === 0));
});

test('rétroplanning : dates depuis le rendu et la soutenance, statuts', () => {
  const e = exemple();
  const { jalons, facteur } = R.retroplanning(e);
  assert.equal(facteur, 1);
  const parNom = (n) => jalons.find((j) => j.nom === n);
  assert.equal(parNom('Rendu du mémoire').quand, '2027-01-15');
  assert.equal(parNom('Premier jet complet').quand, '2026-12-16');
  assert.equal(parNom('Soutenance').quand, '2027-02-01');
  assert.equal(parNom('Répétition de la soutenance').quand, '2027-01-29');
  assert.ok(jalons.every((j, i) => i === 0 || jalons[i - 1].quand <= j.quand), 'triés par date');
  assert.equal(R.statutJalon(parNom('Premier jet complet'), '2026-12-17'), 'retard');
  assert.equal(R.statutJalon(parNom('Premier jet complet'), '2026-12-05'), 'proche');
  assert.equal(R.statutJalon(parNom('Premier jet complet'), '2026-11-14'), 'avenir');
  assert.equal(R.statutJalon({ ...parNom('Premier jet complet'), fait: '2026-12-10' }, '2027-01-01'), 'fait');
  // Sans soutenance : les jalons qui en dépendent n'ont pas de date.
  const sans = R.retroplanning(R.normaliser({ ...simple(e), projet: { ...e.projet, soutenance: '' } }, B));
  assert.equal(sans.jalons.find((j) => j.nom === 'Soutenance').quand, '');
  assert.equal(R.statutJalon(sans.jalons.find((j) => j.nom === 'Soutenance'), '2026-11-14'), 'sansdate');
});

test('rétroplanning : modèle resserré quand le temps manque, date fixée prioritaire', () => {
  // 82 jours disponibles pour un modèle de 165 jours : facteur 82/165.
  const e = R.normaliser({ ...simple(exemple()), projet: { ...exemple().projet, debut: '2026-10-25' } }, B);
  const r = R.retroplanning(e);
  assert.ok(Math.abs(r.facteur - 82 / 165) < 1e-9);
  assert.equal(r.jalons[0].quand, '2026-10-25', 'le premier jalon tombe à la date de début');
  assert.equal(r.jalons.find((j) => j.nom === 'Rendu du mémoire').quand, '2027-01-15');
  assert.ok(r.jalons.every((j) => !j.quand || j.quand >= '2026-10-25'));
  const fixe = R.normaliser({ ...simple(e), jalons: e.jalons.map((j) => (j.nom === 'Premier jet complet' ? { ...j, ancre: 'date', date: '2026-12-20' } : j)) }, B);
  assert.equal(R.retroplanning(fixe).jalons.find((j) => j.nom === 'Premier jet complet').quand, '2026-12-20');
  assert.equal(R.echeanceRedaction(fixe).date, '2026-12-20');
});

test('jours de travail et n-ième jour de travail', () => {
  const lv = [1, 2, 3, 4, 5];
  assert.equal(R.joursTravail('2026-11-16', '2026-11-22', lv), 5); // lundi → dimanche
  assert.equal(R.joursTravail('2026-11-14', '2026-11-15', lv), 0); // week-end
  assert.equal(R.joursTravail('2026-11-14', '2026-11-15', [0, 6]), 2);
  assert.equal(R.joursTravail('2026-11-20', '2026-11-16', lv), 0);
  assert.equal(R.nemeJourTravail('2026-11-13', 1, lv), '2026-11-16'); // vendredi → lundi
  assert.equal(R.nemeJourTravail('2026-11-16', 5, lv), '2026-11-23');
});

test('rythme nécessaire : mots restants par jour de travail jusqu\'à la fin de la rédaction', () => {
  const e = exemple();
  const r = R.rythme(e, '2026-11-16');
  assert.equal(r.total, 7000);
  assert.equal(r.restants, 13000);
  assert.equal(r.echeance.date, '2026-12-16');
  assert.equal(r.jours, R.joursTravail('2026-11-16', '2026-12-16', [1, 2, 3, 4, 5]));
  assert.equal(r.jours, 23);
  assert.equal(r.parJour, Math.ceil(13000 / 23));
  assert.ok(Math.abs(r.pages - 7000 / 300) < 1e-9);
  // Jalon de fin fait : l'échéance devient la date de rendu.
  const fait = R.normaliser({ ...simple(e), jalons: e.jalons.map((j) => (j.fin ? { ...j, fait: '2026-11-10' } : j)) }, B);
  assert.equal(R.rythme(fait, '2026-11-16').echeance.date, '2027-01-15');
  // Échéance dépassée.
  const tard = R.rythme(e, '2026-12-20');
  assert.equal(tard.jours, 0);
  assert.equal(tard.parJour, null);
  assert.equal(tard.depasse, true);
  // Objectif atteint.
  const ok = R.rythme(R.modifierSection(e, 'conc', { mots: 13000 }), '2026-11-16');
  assert.equal(ok.atteint, true);
  assert.equal(ok.parJour, null);
});

test('relevés : un par jour, inutile si rien ne change ; rythme réel et projection', () => {
  let e = exemple();
  e = R.noterReleve(e, '2026-11-02');
  e = R.noterReleve(e, '2026-11-03');
  assert.equal(e.releves.length, 1, 'pas de relevé identique au précédent');
  e = R.modifierSection(e, 'conc', { mots: 500 });
  e = R.noterReleve(e, '2026-11-03');
  e = R.modifierSection(e, 'conc', { mots: 600 });
  e = R.noterReleve(e, '2026-11-03');
  assert.deepEqual(simple(e.releves), [{ date: '2026-11-02', mots: 7000 }, { date: '2026-11-03', mots: 7600 }]);
  assert.equal(R.valeurAu(e.releves, '2026-11-01'), null);
  assert.equal(R.valeurAu(e.releves, '2026-11-10').mots, 7600);
  // Le 16/11 : base = relevé du 02/11 (au plus tard le 02/11), 10 jours de travail du 03 au 16/11, +600 mots.
  const r = R.rythme(e, '2026-11-16');
  assert.ok(Math.abs(r.reel - 60) < 1e-9);
  assert.equal(r.projection, R.nemeJourTravail('2026-11-16', Math.ceil(12400 / 60), [1, 2, 3, 4, 5]));
  assert.equal(r.enRetard, true);
  const c = R.courbe(e, '2026-11-16');
  assert.deepEqual(simple(c.at(-1)), { date: '2026-11-16', mots: 7600 });
  assert.equal(R.courbe(R.etatVide(B), '2026-11-16').length, 1);
});

test('journal : séances, mots ajoutés à la section, bilan de la semaine', () => {
  let e = exemple();
  e = R.ajouterSeance(e, { id: 'a', date: '2026-11-12', minutes: 90, mots: 400, section: 's22' }, true);
  e = R.ajouterSeance(e, { id: 'b', date: '2026-11-02', minutes: 45, mots: 0, section: 'c1' }, true);
  e = R.ajouterSeance(e, { id: 'c', date: '2026-11-13', minutes: 30, mots: 200, section: 's22' }, false);
  assert.equal(e.sections.find((s) => s.id === 's22').mots, 400);
  assert.deepEqual(simple(e.seances.map((s) => s.id)), ['b', 'a', 'c']);
  const b = R.bilanSeances(e, '2026-11-14');
  assert.equal(b.semaine, 120);
  assert.equal(b.seancesSemaine, 2);
  assert.equal(b.motsSemaine, 600);
  assert.equal(b.minutes, 165);
  assert.equal(b.parSection[0].id, 's22');
});

test('directeur : actions ouvertes, prochain rendez-vous, ordre du jour', () => {
  let e = exemple({
    rdv: [
      { id: 'r1', date: '2026-10-01', points: 'Plan', actions: [{ id: 'a1', texte: 'Lire Dubreuil 2019', echeance: '2026-10-15' }, { id: 'a2', texte: 'Revoir la problématique', faite: '2026-10-10' }] },
      { id: 'r2', date: '2026-11-05', points: 'Chapitre 1', actions: [{ id: 'a3', texte: 'Réécrire la section 1.2', echeance: '2026-11-30' }] },
      { id: 'r3', date: '2026-11-26', points: 'Valider le questionnaire\n- Calendrier des entretiens' },
    ],
  });
  const avant = R.noterReleve(R.modifierSection(e, 'c1', { mots: 3000 }), '2026-11-05');
  e = R.noterReleve({ ...e, releves: avant.releves }, '2026-11-14');
  const ouv = R.actionsOuvertes(e, '2026-11-14');
  assert.deepEqual(simple(ouv.map((a) => a.id)), ['a1', 'a3']);
  assert.equal(ouv[0].retard, true);
  assert.equal(ouv[1].retard, false);
  assert.equal(R.prochainRdv(e, '2026-11-14').id, 'r3');
  assert.equal(R.rdvPasses(e, '2026-11-14').length, 2);
  const t = R.ordreDuJour(e, '2026-11-14');
  assert.match(t, /Point d'avancement du 26 novembre 2026 · Mémoire fictif/);
  assert.match(t, /7 000 mots sur 20 000 visés \(35 %\), \+1 000 depuis le rendez-vous du 5 novembre 2026/);
  assert.match(t, /Plan : 1 final, 1 relu, 1 brouillon, 2 à écrire\./);
  assert.match(t, /- \[en cours\] Réécrire la section 1\.2 \(pour le 30 novembre 2026\)/);
  assert.match(t, /Autres actions encore ouvertes :\n- Lire Dubreuil 2019/);
  assert.match(t, /Points que je souhaite aborder :\n- Valider le questionnaire\n- Calendrier des entretiens/);
  assert.match(t, /Prochains jalons :\n- 21 novembre 2026 : Premier jet de la moitié des chapitres\n- 16 décembre 2026 : Premier jet complet/);
});

test('bibliographie : auteurs, initiales, citation, référence auteur-date', () => {
  assert.deepEqual(simple(R.parserAuteurs('Martin, Claire ; Dubois, Jean-Pierre')), [{ nom: 'Martin', prenom: 'Claire' }, { nom: 'Dubois', prenom: 'Jean-Pierre' }]);
  assert.deepEqual(simple(R.parserAuteurs('Observatoire fictif des pratiques')), [{ nom: 'Observatoire fictif des pratiques', prenom: '' }]);
  assert.equal(R.initiales('Jean-Pierre'), 'J.-P.');
  assert.equal(R.initiales('marie claire'), 'M. C.');
  const r1 = R.normaliserRef({ auteurs: 'Martin, Claire', annee: '2021', titre: 'Apprendre en îlots.', source: 'Revue fictive de pédagogie, 12(3), 45-60' });
  assert.equal(R.referenceTexte(r1), 'Martin, C. (2021). Apprendre en îlots. Revue fictive de pédagogie, 12(3), 45-60.');
  assert.equal(R.citation(r1), '(Martin, 2021)');
  const r2 = R.normaliserRef({ auteurs: 'Martin, Claire; Dubois, Paul', titre: 'Sans date', url: 'https://exemple.org/a', consulte: '2026-11-14' });
  assert.equal(R.citation(r2), '(Martin et Dubois, s. d.)');
  assert.equal(R.referenceTexte(r2), 'Martin, C. et Dubois, P. (s. d.). Sans date. https://exemple.org/a (consulté le 14/11/2026)');
  const r3 = R.normaliserRef({ auteurs: 'Arnal, B.; Roux, C.; Petit, D.', annee: '2019', titre: 'T' });
  assert.equal(R.citation(r3), '(Arnal et al., 2019)');
  assert.match(R.referenceTexte(r3), /^Arnal, B\., Roux, C\. et Petit, D\. \(2019\)\. T\.$/);
  const r4 = R.normaliserRef({ titre: 'Rapport anonyme', annee: '2020' });
  assert.equal(R.referenceTexte(r4), 'Rapport anonyme. (2020).');
});

test('bibliographie : tri par auteur puis année, suffixes a et b, export texte', () => {
  const refs = [
    { id: '1', auteurs: 'Martin, Claire', annee: '2021', titre: 'Zèbres' },
    { id: '2', auteurs: 'Écrin, Anne', annee: '2018', titre: 'Accents' },
    { id: '3', auteurs: 'Martin, Claire', annee: '2021', titre: 'Abeilles' },
    { id: '4', auteurs: 'Martin, Claire', annee: '2015', titre: 'Plus ancien' },
  ].map(R.normaliserRef);
  const b = R.bibliographie(refs);
  assert.deepEqual(simple(b.map((x) => x.ref.id)), ['2', '4', '3', '1']);
  assert.deepEqual(simple(b.map((x) => x.suffixe)), ['', '', 'a', 'b']);
  assert.equal(b[2].citation, '(Martin, 2021a)');
  assert.match(b[3].texte, /\(2021b\)/);
  const t = R.bibliographieTexte(refs);
  assert.equal(t.split('\n\n').length, 4);
  assert.ok(t.startsWith('Écrin, A. (2018). Accents.'));
});

test('CSV : séparateur point-virgule, formules neutralisées, BOM', () => {
  assert.equal(R.champCsv('=SOMME(A1)'), '\'=SOMME(A1)');
  assert.equal(R.champCsv('a;b'), '"a;b"');
  const e = exemple();
  const plan = R.csvPlan(e);
  assert.ok(plan.startsWith('﻿Niveau;Titre;Statut;Mots'));
  assert.match(plan, /Partie;Partie 1;À écrire;5500;7000;/);
  assert.match(plan, /Section;    Section 2\.1;Final;1300;1500;/);
  e.refs = [R.normaliserRef({ auteurs: 'Martin, Claire', annee: '2021', titre: 'T', sections: ['c1'] })];
  assert.match(R.csvBiblio(e), /Martin, C\. \(2021\)\. T\.;\(Martin, 2021\);Martin, Claire;2021;T;;Article;;;À lire;Chapitre 1;/);
  assert.ok(R.csvSeances(e).startsWith('﻿Date;Durée'));
  assert.ok(R.csvActions(e).startsWith('﻿Rendez-vous;Action'));
});
