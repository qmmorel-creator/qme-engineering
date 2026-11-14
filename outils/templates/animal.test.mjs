// Tests des règles métier du suivi d'un animal de compagnie (templates/animal/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/animal/', import.meta.url);
const ctx = { window: {}, TextEncoder };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.ANM;
const B = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));
const AUJ = '2026-11-14';
const chien = (x = {}) => R.normaliserAnimal({ id: 'a1', nom: 'Biscuit', espece: 'chien', naissance: '2022-08-05', ...x });
const soin = (x = {}) => R.normaliserSoin({ id: 's1', animalId: 'a1', type: 'AEX', nom: 'Antiparasitaire externe', intervalle: 1, unite: 'mois', ...x }, B);
const fait = (x = {}) => R.normaliserFait({ soinId: 's1', animalId: 'a1', ...x });
const etat = (extra = {}) => Object.assign(R.etatVide(B), { animaux: [chien()] }, extra);

test('base : aucune durée de soin intégrée, aucune posologie', () => {
  for (const liste of Object.values(B.modeles)) for (const m of liste) assert.equal(m.length, 2, 'un modèle = type et nom seulement');
  // Les données (hors commentaires) ne contiennent ni dose ni durée chiffrée.
  const texte = JSON.stringify(B.modeles) + JSON.stringify(B.types) + JSON.stringify(B.conseils);
  assert.doesNotMatch(texte, /\b(mg|ml|comprimé|dose|posologie)\b/i);
  assert.doesNotMatch(JSON.stringify(B.modeles), /\d/);
  // Les modèles donnent des soins sans intervalle : état « à compléter ».
  const soins = R.soinsModeles(B, 'chat', 'a1');
  assert.equal(soins.length, B.modeles.chat.length);
  assert.ok(soins.every((s) => s.intervalle === 0));
  assert.equal(R.echeanceSoin(soins[0], [], AUJ, 14).etat, 'sans');
  assert.equal(R.soinsModeles(B, 'chien', 'a1', [0, 2]).length, 2);
});

test('dates et intervalles saisis : jours, semaines, mois bornés, ans', () => {
  assert.equal(R.ajoutIntervalle('2026-01-31', 1, 'mois'), '2026-02-28');
  assert.equal(R.ajoutIntervalle('2024-02-29', 1, 'ans'), '2025-02-28');
  assert.equal(R.ajoutIntervalle('2026-11-14', 3, 'semaines'), '2026-12-05');
  assert.equal(R.ajoutIntervalle('2026-11-14', 10, 'jours'), '2026-11-24');
  assert.equal(R.ajoutIntervalle('2026-11-14', 0, 'mois'), null);
  assert.equal(R.texteIntervalle(1, 'ans'), 'tous les ans');
  assert.equal(R.texteIntervalle(3, 'semaines'), 'toutes les 3 semaines');
  assert.equal(R.texteIntervalle(6, 'mois'), 'tous les 6 mois');
  assert.equal(R.texteIntervalle(0, 'mois'), '');
});

test('âge révolu', () => {
  assert.deepEqual(simple(R.age('2022-08-05', AUJ)), { ans: 4, mois: 3, jours: 9 });
  assert.equal(R.texteAge(R.age('2022-08-05', AUJ)), '4 ans et 3 mois');
  assert.equal(R.texteAge(R.age('2025-11-14', AUJ)), '12 mois');
  assert.equal(R.texteAge(R.age('2026-09-20', AUJ)), '1 mois');
  assert.equal(R.texteAge(R.age('2026-11-01', AUJ)), '13 jours');
  assert.equal(R.texteAge(R.age('2024-11-14', AUJ)), '2 ans');
  assert.equal(R.age('2027-01-01', AUJ), null);
  assert.equal(R.age(null, AUJ), null);
});

test('saisie : poids en kg ou en g, nombres à la française', () => {
  assert.equal(R.lirePoids('4,25'), 4.25);
  assert.equal(R.lirePoids('4.25 kg'), 4.25);
  assert.equal(R.lirePoids('850 g'), 0.85);
  assert.equal(R.lirePoids('0'), null);
  assert.equal(R.lirePoids('-3'), null);
  assert.equal(R.lirePoids('500'), null); // invraisemblable en kg
  assert.equal(R.lirePoids('abc'), null);
  assert.equal(R.lireNombre('1 234,5'), 1234.5);
  assert.equal(R.lireNombre(''), null);
});

test('échéance : dernier soin fait + intervalle saisi', () => {
  const s = soin();
  const e = R.echeanceSoin(s, [fait({ id: 'f1', date: '2026-10-20' }), fait({ id: 'f2', date: '2026-09-20' })], AUJ, 14);
  assert.equal(e.dernier, '2026-10-20');
  assert.equal(e.prochaine, '2026-11-20');
  assert.equal(e.jours, 6);
  assert.equal(e.etat, 'proche');
  assert.equal(e.origine, 'intervalle');
  assert.equal(e.nombre, 2);
  // En retard.
  assert.equal(R.echeanceSoin(s, [fait({ date: '2026-10-01' })], AUJ, 14).etat, 'retard');
  // À jour (hors de la fenêtre).
  assert.equal(R.echeanceSoin(soin({ intervalle: 3 }), [fait({ date: '2026-10-01' })], AUJ, 14).etat, 'ok');
  // Échéance aujourd'hui : bientôt, pas en retard.
  const a = R.echeanceSoin(s, [fait({ date: '2026-10-14' })], AUJ, 14);
  assert.equal(a.jours, 0);
  assert.equal(a.etat, 'proche');
});

test('échéance : date fixée par le vétérinaire sur le dernier soin fait, prioritaire', () => {
  const s = soin({ type: 'VAC', nom: 'Vaccin', intervalle: 1, unite: 'ans' });
  const e = R.echeanceSoin(s, [fait({ date: '2026-05-02', prochaine: '2027-03-01' })], AUJ, 14);
  assert.equal(e.prochaine, '2027-03-01');
  assert.equal(e.origine, 'veterinaire');
  // Une date antérieure au soin est ignorée.
  assert.equal(R.echeanceSoin(s, [fait({ date: '2026-05-02', prochaine: '2026-04-01' })], AUJ, 14).prochaine, '2027-05-02');
  // Seul le DERNIER soin fait compte : une date fixée sur un soin plus ancien est remplacée.
  const e2 = R.echeanceSoin(s, [fait({ id: 'x', date: '2025-05-02', prochaine: '2026-12-01' }), fait({ id: 'y', date: '2026-05-02' })], AUJ, 14);
  assert.equal(e2.prochaine, '2027-05-02');
});

test('échéance sans soin fait : dernière fois connue, prochaine date notée, sinon à compléter', () => {
  assert.equal(R.echeanceSoin(soin({ depuis: '2026-10-01' }), [], AUJ, 14).prochaine, '2026-11-01');
  const p = R.echeanceSoin(soin({ intervalle: 0, prochaine: '2026-12-10' }), [], AUJ, 14);
  assert.equal(p.prochaine, '2026-12-10');
  assert.equal(p.origine, 'saisie');
  assert.equal(R.echeanceSoin(soin({ intervalle: 0 }), [], AUJ, 14).etat, 'sans');
  assert.equal(R.echeanceSoin(soin({ depuis: null }), [], AUJ, 14).etat, 'sans');
  // Intervalle vide après un soin fait : à compléter.
  assert.equal(R.echeanceSoin(soin({ intervalle: 0 }), [fait({ date: '2026-10-01' })], AUJ, 14).etat, 'sans');
  // En pause : jamais d'alerte.
  assert.equal(R.echeanceSoin(soin({ actif: false }), [fait({ date: '2026-01-01' })], AUJ, 14).etat, 'pause');
  // Les soins faits d'un autre soin ne comptent pas.
  assert.equal(R.echeanceSoin(soin(), [fait({ soinId: 'autre', date: '2026-11-10' })], AUJ, 14).etat, 'sans');
});

test('alertes : soins en retard puis bientôt, pesée à faire, animaux partis exclus', () => {
  const e = etat({
    animaux: [chien(), chien({ id: 'a2', nom: 'Ancien', actif: false })],
    soins: [soin(), soin({ id: 's2', nom: 'Vermifuge', type: 'VER', intervalle: 3 }), soin({ id: 's3', animalId: 'a2' })],
    faits: [fait({ date: '2026-09-01' }), fait({ soinId: 's2', date: '2026-08-20' }), fait({ soinId: 's3', animalId: 'a2', date: '2025-01-01' })],
    pesees: [R.normaliserPesee({ animalId: 'a1', date: '2026-08-01', poids: 18.2 })],
  });
  const al = R.alertes(e, AUJ);
  assert.deepEqual(simple(al.map((a) => [a.type, a.etat, a.refId])), [['soin', 'retard', 's1'], ['pesee', 'proche', 'pesee'], ['soin', 'proche', 's2']]);
  assert.match(al[0].detail, /en retard de 44 jours/);
  // Rappel de pesée désactivé.
  e.reglages.peseeJours = 0;
  assert.equal(R.alertes(e, AUJ).filter((a) => a.type === 'pesee').length, 0);
});

test('poids : statistiques factuelles, sans interprétation', () => {
  const e = etat({ pesees: [['2026-05-01', 18], ['2026-08-10', 18.6], ['2026-11-01', 18.3], ['2026-12-01', 99]].map(([date, poids]) => R.normaliserPesee({ animalId: 'a1', date, poids })) });
  const l = R.pesees(e, 'a1');
  assert.equal(l.length, 4);
  const s = R.statsPoids(l, AUJ); // la pesée future est ignorée
  assert.equal(s.nombre, 3);
  assert.equal(s.dernier.poids, 18.3);
  assert.equal(s.variation, -0.3);
  assert.equal(s.variationPct, -1.6);
  assert.equal(s.sur90, 0.3); // pesée connue 90 jours avant le 01/11 (au 03/08) : celle du 01/05, 18 kg
  assert.equal(s.min, 18);
  assert.equal(s.max, 18.6);
  assert.equal(R.poidsAu(l, '2026-08-09'), 18);
  assert.equal(R.poidsAu(l, '2026-04-01'), null);
  assert.equal(R.statsPoids([], AUJ).dernier, null);
});

test('frais : saisies, coût des soins faits et des visites, par catégorie', () => {
  const e = etat({
    soins: [soin(), soin({ id: 's2', type: 'TOI', nom: 'Toilettage' })],
    faits: [fait({ id: 'f1', date: '2026-10-20', cout: 18 }), fait({ id: 'f2', soinId: 's2', date: '2026-10-01', cout: 45 }), fait({ id: 'f3', date: '2026-09-20', cout: 0 })],
    visites: [R.normaliserVisite({ id: 'v1', animalId: 'a1', date: '2026-07-03', motif: 'Contrôle', cout: 55 })],
    depenses: [R.normaliserDepense({ id: 'd1', animalId: 'a1', date: '2026-11-02', categorie: 'ALI', montant: '46,90' }, B), R.normaliserDepense({ id: 'd2', animalId: '', date: '2026-11-03', categorie: 'ACC', montant: 15 }, B), R.normaliserDepense({ id: 'd3', animalId: 'a1', date: '2025-06-01', categorie: 'ASS', montant: 100 }, B)],
  });
  const l = R.lignesFrais(e, B);
  assert.equal(l.length, 6); // le soin fait à 0 € n'est pas une ligne
  assert.deepEqual(simple(l.map((x) => x.id)), ['d2', 'd1', 'f1', 'f2', 'v1', 'd3']);
  const f = R.frais(e, B, null, '2025-11-15', AUJ);
  assert.equal(f.total, 179.9);
  assert.deepEqual(simple(f.parCategorie), { ACC: 15, ALI: 46.9, SOI: 18, TOI: 45, VET: 55 });
  // Un animal seul : sans les dépenses communes ; « commun » : seulement elles.
  assert.equal(R.frais(e, B, 'a1', '2025-11-15', AUJ).total, 164.9);
  assert.equal(R.frais(e, B, 'commun', '2025-11-15', AUJ).total, 15);
  // Coût annuel = 12 derniers mois.
  assert.equal(R.coutAnnuel(e, B, null, AUJ), 179.9);
  // Coût mensuel : sur la période effective (depuis la première ligne), 1 mois au moins.
  const tout = R.frais(e, B, null, '1900-01-01', AUJ);
  assert.equal(tout.total, 279.9);
  assert.equal(tout.mois, R.arrondi((R.ecart('2025-06-01', AUJ) + 1) / (365.25 / 12), 2));
  assert.equal(R.frais(e, B, null, '2026-11-01', AUJ).mois, 1);
});

test('frais par mois et par année', () => {
  const e = etat({ depenses: [['2026-11-02', 10], ['2026-10-31', 20], ['2025-12-01', 5], ['2025-11-30', 7], ['2024-03-01', 3], ['2026-11-20', 99]].map(([date, montant], i) => R.normaliserDepense({ id: `d${i}`, animalId: 'a1', date, categorie: 'ALI', montant }, B)) });
  const m = R.fraisParMois(e, B, null, AUJ, 12);
  assert.equal(m.length, 12);
  assert.equal(m[0].mois, '2025-12');
  assert.equal(m[0].total, 5);
  assert.equal(m.at(-1).total, 10); // la dépense future du 20/11 est exclue
  assert.equal(m.at(-2).total, 20);
  assert.deepEqual(simple(R.fraisParAn(e, B, null, AUJ)), [{ annee: 2024, total: 3 }, { annee: 2025, total: 12 }, { annee: 2026, total: 30 }]);
  assert.deepEqual(simple(R.fraisParAn(R.etatVide(B), B, null, AUJ)), []);
});

test('traitements en cours notés lors des visites', () => {
  const e = etat({ visites: [
    R.normaliserVisite({ id: 'v1', animalId: 'a1', date: '2026-11-08', traitement: 'Selon l\'ordonnance', finTraitement: '2026-11-22' }),
    R.normaliserVisite({ id: 'v2', animalId: 'a1', date: '2026-10-01', traitement: 'Terminé', finTraitement: '2026-10-10' }),
    R.normaliserVisite({ id: 'v3', animalId: 'a1', date: '2026-11-10', traitement: '', finTraitement: '2026-12-01' }),
  ] });
  assert.deepEqual(simple(R.traitementsEnCours(e, 'a1', AUJ).map((v) => v.id)), ['v1']);
  assert.deepEqual(simple(R.traitementsEnCours(e, 'a1', '2026-11-23').map((v) => v.id)), []);
});

test('synthèse d\'un animal : soins triés, pire état, prochain soin', () => {
  const e = etat({
    soins: [soin({ id: 's1', intervalle: 6 }), soin({ id: 's2', nom: 'Dents', intervalle: 0 }), soin({ id: 's3', nom: 'Vaccin', intervalle: 1, unite: 'ans' })],
    faits: [fait({ soinId: 's1', date: '2026-10-01' }), fait({ soinId: 's3', date: '2025-11-20' })],
  });
  const s = R.syntheseAnimal(e, e.animaux[0], AUJ);
  assert.deepEqual(simple(s.soins.map((x) => [x.soin.id, x.etat])), [['s3', 'proche'], ['s1', 'ok'], ['s2', 'sans']]);
  assert.equal(s.pire, 'proche');
  assert.equal(s.prochain.soin.id, 's3');
  assert.equal(R.texteAge(s.age), '4 ans et 3 mois');
});

test('carnet imprimable : soins, poids, historique, montants masqués par défaut', () => {
  const e = etat({
    animaux: [chien({ identification: 'Puce 250 (fictive)', veterinaire: 'Clinique fictive', race: 'Croisé', sexe: 'M' })],
    soins: [soin()], faits: [fait({ date: '2026-10-20', cout: 18, par: 'Maison' })],
    pesees: [R.normaliserPesee({ animalId: 'a1', date: '2026-11-01', poids: 18.3 })],
    visites: [R.normaliserVisite({ animalId: 'a1', date: '2026-11-08', motif: 'Contrôle', traitement: 'Selon l\'ordonnance', finTraitement: '2026-11-22', cout: 55 })],
  });
  const c = R.carnet(e, B, e.animaux[0], AUJ);
  assert.equal(c.historique.length, 2);
  assert.equal(c.historique[0].type, 'Visite');
  assert.equal(c.historique[0].montant, undefined);
  assert.equal(R.carnet(e, B, e.animaux[0], AUJ, { montants: true }).historique[1].montant, 18);
  const t = R.texteCarnet(c, AUJ);
  assert.match(t, /Carnet de suivi · Biscuit/);
  assert.match(t, /Chien · Croisé · mâle · né\(e\) le 05\/08\/2022 \(4 ans et 3 mois\)/);
  assert.match(t, /Identification : Puce 250 \(fictive\)/);
  assert.match(t, /Antiparasitaire externe : dernier le 20\/10\/2026 · prochain le 20\/11\/2026/);
  assert.match(t, /Dernière pesée : 18,3 kg le 01\/11\/2026/);
  assert.match(t, /Traitement noté : Selon l'ordonnance \(jusqu'au 22\/11\/2026\)/);
  assert.match(t, /Ne remplace ni le carnet de santé ni l'avis du vétérinaire/);
  assert.doesNotMatch(t, /€/);
});

test('CSV : séparateur point-virgule, BOM, formules neutralisées, dépenses communes', () => {
  const e = etat({ depenses: [R.normaliserDepense({ animalId: '', date: '2026-11-02', categorie: 'ACC', montant: 15.5, libelle: '=SOMME(A1)' }, B)], pesees: [R.normaliserPesee({ animalId: 'a1', date: '2026-11-01', poids: 4.25 })] });
  const csv = R.csvFrais(e, B);
  assert.ok(csv.startsWith('﻿Date;Animal;Catégorie;Libellé;Montant\r\n'));
  assert.match(csv, /02\/11\/2026;Commun;Accessoires, litière, jouets;'=SOMME\(A1\);15,5/);
  assert.match(R.csvPoids(e), /01\/11\/2026;Biscuit;4,25/);
});

test('normalisation tolérante et suppressions en cascade', () => {
  const n = R.normaliser({ animaux: [{ id: 'a1', nom: '  Rex ', espece: 'dragon', sexe: 'X' }], soins: [{ id: 's1', animalId: 'a1', type: 'ZZZ', intervalle: '3', unite: 'lustres' }], pesees: [{ animalId: 'a1', date: '2026-01-01', poids: 'abc' }, { animalId: 'a1', date: '2026-02-01', poids: '4,2' }], reglages: { alerteJours: 9999 } }, B);
  assert.equal(n.animaux[0].nom, 'Rex');
  assert.equal(n.animaux[0].espece, 'chien');
  assert.equal(n.animaux[0].sexe, '');
  assert.equal(n.soins[0].type, 'AUT');
  assert.equal(n.soins[0].intervalle, 3);
  assert.equal(n.soins[0].unite, 'mois');
  assert.equal(n.pesees.length, 1);
  assert.equal(n.pesees[0].poids, 4.2);
  assert.equal(n.reglages.alerteJours, 180);
  assert.equal(n.reglages.peseeJours, B.reglages.peseeJours);
  assert.deepEqual(simple(R.normaliser(null, B)), simple(R.etatVide(B)));
  const e = etat({ soins: [soin()], faits: [fait({ date: '2026-10-01' })], depenses: [R.normaliserDepense({ animalId: '', montant: 3 }, B), R.normaliserDepense({ animalId: 'a1', montant: 3 }, B)] });
  const sansSoin = R.supprimerSoin(e, 's1');
  assert.equal(sansSoin.soins.length + sansSoin.faits.length, 0);
  const sansAnimal = R.supprimerAnimal(e, 'a1');
  assert.equal(sansAnimal.animaux.length, 0);
  assert.equal(sansAnimal.depenses.length, 1); // la dépense commune reste
  assert.ok(R.taille(e) > 100);
});
