// Tests des règles métier du planning d'équipe et staffing (templates/planning-equipe/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/planning-equipe/', import.meta.url);
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.EQP;
const BASE = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));
const DEFAUTS = { reglages: BASE.reglages, couleurs: BASE.couleurs, typesAbsence: BASE.typesAbsence };
const LUNDI = '2026-03-02'; // semaine sans férié
const etat = () => {
  const e = R.etatVide(DEFAUTS);
  e.competences = [{ id: 'web', nom: 'Développement web' }, { id: 'ux', nom: 'UX' }];
  e.personnes = [
    R.normaliserPersonne({ id: 'ana', prenom: 'Ana', nom: 'Exemple', role: 'Développeur', competences: ['web'], capacite: 35 }),
    R.normaliserPersonne({ id: 'bob', prenom: 'Bob', nom: 'Exemple', role: 'Designer', competences: ['ux'], capacite: 28, jours: [1, 2, 4, 5] }),
  ];
  e.projets = [
    R.normaliserProjet({ id: 'site', nom: 'Site', besoin: 0 }),
    R.normaliserProjet({ id: 'support', nom: 'Support', type: 'poste', besoin: 35, competences: ['web'] }),
  ];
  return e;
};
const aff = (x) => R.normaliserAffectation({ id: x.id || 'a', personne: 'ana', projet: 'site', debut: LUNDI, fin: R.ajout(LUNDI, 4), heures: 35, ...x });
const abs = (x) => R.normaliserAbsence({ id: x.id || 'x', personne: 'ana', type: 'conges', ...x });

test('dates : lundi, numéro de semaine ISO, semaines du mois', () => {
  assert.equal(R.lundiDe('2026-03-04'), '2026-03-02');
  assert.equal(R.lundiDe('2026-03-08'), '2026-03-02'); // dimanche
  assert.equal(R.numeroSemaine('2026-01-01'), 1);
  assert.equal(R.numeroSemaine('2027-01-01'), 53); // vendredi 1er janvier 2027 : semaine 53 de 2026
  assert.equal(R.numeroSemaine('2026-11-16'), 47);
  assert.deepEqual(simple(R.semainesDuMois('2026-03')), ['2026-02-23', '2026-03-02', '2026-03-09', '2026-03-16', '2026-03-23', '2026-03-30']);
  assert.equal(R.paques(2026), '2026-04-05');
});

test('capacité : temps complet, temps partiel, férié chômé, entrée en cours de semaine', () => {
  const e = etat();
  assert.equal(R.bilanSemaine(e, e.personnes[0], LUNDI).capacite, 35);
  const bob = R.bilanSemaine(e, e.personnes[1], LUNDI);
  assert.equal(bob.capacite, 28);
  assert.equal(bob.jours[2].travail, false); // mercredi non travaillé
  // Semaine du lundi de Pâques 2026 (06/04) : 4 jours sur 5.
  assert.equal(R.bilanSemaine(e, e.personnes[0], '2026-04-06').capacite, 28);
  // Férié décoché : la journée redevient travaillée.
  const e2 = simple(e); e2.reglages.feriesChomes = [];
  assert.equal(R.bilanSemaine(e2, e2.personnes[0], '2026-04-06').capacite, 35);
  // Entrée le mercredi : 3 jours.
  const e3 = simple(e); e3.personnes[0].entree = '2026-03-04';
  assert.equal(R.bilanSemaine(e3, e3.personnes[0], LUNDI).capacite, 21);
  assert.equal(R.bilanSemaine(e3, e3.personnes[0], '2026-02-23').etat, 'inactif');
});

test('charge : heures par semaine réparties sur les jours travaillés, taux et états', () => {
  const e = etat();
  e.affectations = [aff({ heures: 21 })];
  let b = R.bilanSemaine(e, e.personnes[0], LUNDI);
  assert.equal(b.charge, 21);
  assert.equal(Math.round(b.taux * 100), 60);
  assert.equal(b.etat, 'disponible');
  assert.equal(b.libre, 14);
  assert.equal(b.parProjet.site, 21);
  e.affectations.push(aff({ id: 'b', projet: 'support', heures: 10 }));
  b = R.bilanSemaine(e, e.personnes[0], LUNDI);
  assert.equal(b.etat, 'plein'); // 31/35 = 89 %
  e.affectations.push(aff({ id: 'c', projet: 'support', heures: 7 }));
  b = R.bilanSemaine(e, e.personnes[0], LUNDI);
  assert.equal(b.charge, 38);
  assert.equal(b.etat, 'surcharge');
  // Affectation qui commence le jeudi : 2 jours sur 5.
  const e2 = etat(); e2.affectations = [aff({ debut: R.ajout(LUNDI, 3), fin: R.ajout(LUNDI, 30), heures: 35 })];
  assert.equal(R.bilanSemaine(e2, e2.personnes[0], LUNDI).charge, 14);
  // Projet en pause : ses affectations ne comptent plus.
  e2.projets[0].statut = 'pause';
  assert.equal(R.bilanSemaine(e2, e2.personnes[0], LUNDI).charge, 0);
  // Seuil de surcharge réglable.
  const e3 = etat(); e3.affectations = [aff({ heures: 37 })];
  assert.equal(R.bilanSemaine(e3, e3.personnes[0], LUNDI).etat, 'surcharge');
  e3.reglages.seuilSurcharge = 110;
  assert.equal(R.bilanSemaine(e3, e3.personnes[0], LUNDI).etat, 'plein');
});

test('absences : capacité réduite, demi-journée, affectation pendant une absence signalée', () => {
  const e = etat();
  e.absences = [abs({ debut: R.ajout(LUNDI, 3), fin: R.ajout(LUNDI, 4) })]; // jeudi et vendredi
  e.affectations = [aff({ heures: 14 })];
  const b = R.bilanSemaine(e, e.personnes[0], LUNDI);
  assert.equal(b.capacite, 21);
  assert.equal(b.joursAbsents, 2);
  assert.equal(b.chargeAbsence, 5.6); // 14 h / 5 jours × 2 jours
  assert.equal(b.absences.length, 1);
  // Demi-journée seule.
  const e2 = etat(); e2.absences = [abs({ debut: LUNDI, fin: LUNDI, demiFin: true })];
  assert.equal(R.bilanSemaine(e2, e2.personnes[0], LUNDI).capacite, 31.5);
  // Absente toute la semaine sans affectation : état « absent ».
  const e3 = etat(); e3.absences = [abs({ debut: LUNDI, fin: R.ajout(LUNDI, 6), type: 'formation' })];
  assert.equal(R.bilanSemaine(e3, e3.personnes[0], LUNDI).etat, 'absent');
  // Avec une affectation : surcharge (capacité nulle).
  e3.affectations = [aff({ heures: 7 })];
  assert.equal(R.bilanSemaine(e3, e3.personnes[0], LUNDI).etat, 'surcharge');
  const al = R.alertes(e3, LUNDI, 1);
  assert.deepEqual(simple(al.filter((x) => x.personne).map((x) => x.type)), ['surcharge', 'absence']);
});

test('couverture d\'un poste : besoin, couvert hors absences, trou et compétence manquante', () => {
  const e = etat();
  e.affectations = [aff({ projet: 'support', heures: 35 })];
  let c = R.couverture(e, e.projets[1], LUNDI);
  assert.equal(c.besoin, 35);
  assert.equal(c.couvert, 35);
  assert.equal(c.trou, false);
  e.absences = [abs({ debut: LUNDI, fin: LUNDI })];
  c = R.couverture(e, e.projets[1], LUNDI);
  assert.equal(c.affecte, 35);
  assert.equal(c.couvert, 28);
  assert.equal(c.manque, 7);
  assert.equal(c.trou, true);
  // Semaine avec férié : besoin au prorata des jours d'ouverture.
  assert.equal(R.couverture(e, e.projets[1], '2026-04-06').besoin, 28);
  // Bob n'a pas la compétence « web » demandée par le poste.
  e.affectations.push(aff({ id: 'b', personne: 'bob', projet: 'support', heures: 7 }));
  c = R.couverture(e, e.projets[1], LUNDI);
  assert.deepEqual(simple(c.competences), [{ personne: 'bob', manquantes: ['web'], affectation: 'b' }]);
  // Poste terminé ou hors de ses dates : aucun besoin.
  e.projets[1].fin = R.ajout(LUNDI, -1);
  assert.equal(R.couverture(e, e.projets[1], LUNDI).besoin, 0);
});

test('alertes regroupées sur plusieurs semaines, plafonds de durée paramétrables', () => {
  const e = etat();
  e.affectations = [aff({ heures: 50, fin: R.ajout(LUNDI, 20) })];
  const al = R.alertes(e, LUNDI, 4);
  const sur = al.find((x) => x.type === 'surcharge');
  assert.equal(sur.semaines, 3);
  assert.equal(sur.debut, LUNDI);
  assert.equal(sur.fin, R.ajout(LUNDI, 14));
  assert.ok(al.some((x) => x.type === 'plafond' && x.valeur === 50));
  assert.ok(!al.some((x) => x.type === 'moyenne')); // 3 semaines sur 12 : moyenne 12,5 h
  e.reglages.plafondSemaine = 0;
  assert.ok(!R.alertes(e, LUNDI, 4).some((x) => x.type === 'plafond'));
  // Moyenne sur 12 semaines au-delà de 44 h.
  const e2 = etat(); e2.affectations = [aff({ heures: 46, debut: '2026-01-05', fin: '2026-06-30' })];
  assert.equal(R.moyenne12(e2, e2.personnes[0], '2026-03-30'), 46);
  assert.ok(R.alertes(e2, '2026-03-30', 1).some((x) => x.type === 'moyenne'));
  // Le support sans personne : trou de 35 h chaque semaine.
  assert.ok(R.alertes(etat(), LUNDI, 2).some((x) => x.type === 'trou' && x.semaines === 2 && x.valeur === 35));
});

test('qui est disponible : tri par heures libres, filtre par compétence et par heures', () => {
  const e = etat();
  e.affectations = [aff({ heures: 30 })];
  let d = R.disponibles(e, LUNDI);
  assert.deepEqual(simple(d.map((x) => x.personne.id)), ['bob', 'ana']);
  assert.equal(d[0].bilan.libre, 28);
  d = R.disponibles(e, LUNDI, { competence: 'web' });
  assert.deepEqual(simple(d.map((x) => x.personne.id)), ['ana']);
  d = R.disponibles(e, LUNDI, { heuresMin: 10 });
  assert.deepEqual(simple(d.map((x) => [x.personne.id, x.disponible])), [['bob', true], ['ana', false]]);
  const eq = R.equipeSemaine(e, LUNDI);
  assert.equal(eq.capacite, 63);
  assert.equal(eq.charge, 30);
});

test('aperçu d\'une affectation : semaines, surcharges, absences et compétences', () => {
  const e = etat();
  e.affectations = [aff({ heures: 30, fin: R.ajout(LUNDI, 13) })];
  e.absences = [abs({ debut: R.ajout(LUNDI, 7), fin: R.ajout(LUNDI, 8) })];
  const ap = R.apercuAffectation(e, aff({ id: 'n', projet: 'support', heures: 10, fin: R.ajout(LUNDI, 13) }));
  assert.equal(ap.semaines.length, 2);
  assert.equal(ap.surcharges, 2);
  assert.equal(ap.absences.length, 1);
  assert.deepEqual(simple(ap.manquantes), []);
  const ap2 = R.apercuAffectation(e, aff({ id: 'n', personne: 'bob', projet: 'support', heures: 5 }));
  assert.deepEqual(simple(ap2.manquantes), ['web']);
  assert.equal(R.apercuAffectation(e, { ...aff({ id: 'n' }), fin: '2026-01-01' }), null);
});

test('fusion des saisies de deux managers', () => {
  const base = etat();
  base.affectations = [aff({ id: 'a1' }), aff({ id: 'a2', heures: 7 })];
  const local = simple(base);
  local.affectations[0].heures = 20;                        // modifiée ici
  local.affectations = local.affectations.filter((a) => a.id !== 'a2'); // supprimée ici
  local.affectations.push(aff({ id: 'a3', heures: 3 }));   // ajoutée ici
  const serveur = simple(base);
  serveur.affectations.push(aff({ id: 'b1', heures: 4 }));  // ajoutée par l'autre manager
  serveur.personnes[1].capacite = 21;                       // modifiée par l'autre manager
  serveur.entreprise = 'Autre nom';
  const f = R.fusionner(base, local, serveur);
  assert.deepEqual(simple(f.affectations.map((a) => [a.id, a.heures]).sort()), [['a1', 20], ['a3', 3], ['b1', 4]]);
  assert.equal(f.personnes[1].capacite, 21);
  assert.equal(f.entreprise, 'Autre nom'); // pas changé ici : la version du serveur reste
  local.entreprise = 'Mon nom';
  assert.equal(R.fusionner(base, local, serveur).entreprise, 'Mon nom');
});

test('normalisation tolérante et réglages bornés', () => {
  const n = R.normaliser({ personnes: [{ prenom: ' Zoé ', capacite: 200, jours: [9, 1, 1] }], projets: [{ nom: 'X', debut: '2026-05-10', fin: '2026-05-01', couleur: 42 }], affectations: [{ debut: 'nimporte' }], reglages: { seuilSurcharge: 5, plafondSemaine: '' } }, DEFAUTS);
  assert.equal(n.personnes[0].prenom, 'Zoé');
  assert.equal(n.personnes[0].capacite, 80);
  assert.deepEqual(simple(n.personnes[0].jours), [1]);
  assert.equal(n.projets[0].fin, '2026-05-10');
  assert.equal(n.projets[0].couleur, 6);
  assert.equal(n.affectations[0].debut, '2026-01-05');
  assert.equal(n.reglages.seuilSurcharge, 50);
  assert.equal(n.reglages.plafondSemaine, 48);
  assert.equal(n.reglages.feriesChomes.length, 11);
  assert.deepEqual(simple(R.normaliser(null, DEFAUTS).personnes), []);
  // Base intégrée : 6 secteurs complets, compétences des postes présentes dans leur secteur.
  assert.equal(BASE.secteurs.length, 6);
  for (const s of BASE.secteurs) for (const [, h, c] of s.postes) { assert.ok(h > 0); assert.ok(s.competences.includes(c), `${s.id} : ${c}`); }
  assert.equal(BASE.couleurs.length, 7);
  assert.ok(BASE.typesAbsence.every((t) => !/maladie|santé/i.test(t.nom)));
});

test('RGPD : export, effacement et suppression d\'une personne ; exports CSV', () => {
  const e = etat();
  e.affectations = [aff({ note: 'Note' })];
  e.absences = [abs({ debut: LUNDI, fin: LUNDI, note: 'Note' })];
  const d = R.donneesPersonne(e, 'ana', LUNDI, BASE.typesAbsence);
  assert.equal(d.personne.prenom, 'Ana');
  assert.deepEqual(simple(d.personne.competences), ['Développement web']);
  assert.equal(d.absences[0].type, 'Congés');
  const ef = R.effacerPersonne(e, 'ana', 1);
  assert.equal(ef.personnes[0].prenom, 'Personne');
  assert.equal(ef.affectations[0].note, '');
  assert.equal(ef.absences[0].note, '');
  assert.equal(ef.affectations.length, 1);
  const su = R.supprimerPersonne(e, 'ana');
  assert.equal(su.personnes.length, 1);
  assert.equal(su.affectations.length, 0);
  assert.equal(su.absences.length, 0);
  const csv = R.affectationsCsv(e);
  assert.ok(csv.startsWith('﻿Prénom;Nom;Rôle;Projet ou poste'));
  assert.ok(csv.includes('Ana;Exemple;Développeur;Site;Projet;2026-03-02;2026-03-06;35'));
  const ch = R.chargeCsv(e, LUNDI, 2);
  assert.ok(ch.split('\r\n')[1].startsWith('Ana;Exemple;Développeur;35;28;0;35'), ch);
});
