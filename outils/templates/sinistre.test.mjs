// Tests des règles métier du dossier sinistre habitation (templates/sinistre/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/sinistre/', import.meta.url);
globalThis.window = globalThis.window || {};
vm.runInThisContext(readFileSync(new URL('donnees.js', dossier), 'utf8'));
vm.runInThisContext(readFileSync(new URL('regles.js', dossier), 'utf8'));
const R = globalThis.window.REGLES;
const B = globalThis.window.BASE;
let n = 0;
const uid = () => `id${++n}`;

const dos = (o = {}) => R.normaliserDossier({ id: 'd1', type: 'eau', survenu: '2026-11-09', decouvert: '2026-11-10', ...o });
const bien = (o = {}) => ({ id: uid(), piece: 'Séjour', categorie: 'mobilier', designation: 'Canapé', ...o });

test('base intégrée : types, justificatifs et mesures cohérents, sources officielles datées', () => {
  assert.deepEqual(B.types.map((t) => t.code), ['eau', 'incendie', 'climat', 'vol', 'glace', 'autre']);
  for (const t of B.types) {
    for (const j of t.justificatifs) assert.ok(B.justificatifs[j], `justificatif inconnu ${j}`);
    for (const m of t.mesures) assert.ok(B.mesures[m], `mesure inconnue ${m}`);
    assert.ok(B.delais[t.delai], `délai inconnu ${t.delai}`);
  }
  const ids = new Set(B.sources.map((s) => s.id));
  for (const d of Object.values(B.delais)) assert.ok(ids.has(d.source), `source manquante ${d.source}`);
  for (const r of B.reperes) assert.ok(ids.has(r.source), `source manquante ${r.source}`);
  for (const s of B.sources) {
    assert.match(s.url, /^https:\/\/(www\.)?(legifrance|service-public)\.gouv\.fr\//);
    assert.match(s.verifie, /^\d{2}\/\d{2}\/\d{4}$/);
  }
  assert.ok(B.categories.length >= 9 && B.categories.every((c) => c.biens.length >= 6));
  assert.equal(B.etapes.length, 7);
  // Aucun taux de vétusté par défaut : aucun barème imposé.
  assert.deepEqual(R.etatVide().reglages.vetuste, {});
});

test('jours fériés et jours ouvrés calculés (Pâques, Ascension, Pentecôte, week-ends)', () => {
  assert.equal(R.paques(2026), '2026-04-05');
  assert.equal(R.paques(2027), '2027-03-28');
  assert.equal(R.paques(2030), '2030-04-21');
  assert.ok(R.estFerie('2026-05-14')); // Ascension
  assert.ok(R.estFerie('2026-05-25')); // lundi de Pentecôte
  assert.ok(!R.estOuvre('2026-11-11'));
  assert.ok(!R.estOuvre('2026-11-14')); // samedi
  // Vendredi 6/11 + 5 jours ouvrés : lundi 9, mardi 10, (11 férié), jeudi 12, vendredi 13, lundi 16.
  assert.equal(R.ajoutOuvres('2026-11-06', 5), '2026-11-16');
  // Jeudi 24/12 + 2 jours ouvrés : (25 férié, 26-27 week-end) lundi 28, mardi 29.
  assert.equal(R.ajoutOuvres('2026-12-24', 2), '2026-12-29');
  assert.equal(R.ajoutMois('2024-02-29', 24), '2026-02-28');
});

test('échéances : déclaration (5 j ouvrés depuis la découverte), vol (2 j), prescription 2 ans', () => {
  const d = dos();
  const e = R.echeances(d, '2026-11-12');
  const decl = e.find((x) => x.code === 'declaration');
  assert.equal(decl.date, '2026-11-18'); // 10/11 (mardi) → 12, 13, 16, 17, 18 (11 férié)
  assert.equal(decl.etat, 'proche');
  assert.equal(e.find((x) => x.code === 'prescription').date, '2028-11-09');
  assert.equal(R.echeances(dos({ type: 'vol' }), '2026-11-12').find((x) => x.code === 'declaration').date, '2026-11-13');
  // Dépassée, puis faite une fois la date de déclaration saisie.
  assert.equal(R.echeances(d, '2026-11-20').find((x) => x.code === 'declaration').etat, 'depassee');
  assert.equal(R.echeances(dos({ declareLe: '2026-11-11' }), '2026-11-20').find((x) => x.code === 'declaration').etat, 'faite');
  assert.equal(R.echeancesActives(dos({ declareLe: '2026-11-11' }), '2026-11-20').some((x) => x.code === 'declaration'), false);
});

test('échéances : catastrophe naturelle (30 jours après l\'arrêté) et prescription sécheresse 5 ans', () => {
  const sans = R.echeances(dos({ type: 'climat', catnat: true, sousType: 'Inondation' }), '2026-11-12');
  assert.equal(sans.find((x) => x.code === 'declaration'), undefined);
  assert.equal(sans.find((x) => x.code === 'catnat').date, null);
  assert.match(sans.find((x) => x.code === 'catnat').attente, /Journal officiel/);
  assert.equal(sans.find((x) => x.code === 'prescription').date, '2028-11-09');
  const avec = R.echeances(dos({ type: 'climat', catnat: true, sousType: 'Inondation', arreteLe: '2026-12-01' }), '2026-11-12');
  assert.equal(avec.find((x) => x.code === 'catnat').date, '2026-12-31');
  const sech = R.echeances(dos({ type: 'climat', catnat: true, sousType: 'Sécheresse (fissures)' }), '2026-11-12');
  assert.equal(sech.find((x) => x.code === 'prescription').date, '2031-11-09');
  // Tempête sans catastrophe naturelle : délai de droit commun.
  assert.equal(R.echeances(dos({ type: 'climat', sousType: 'Tempête' }), '2026-11-12').find((x) => x.code === 'declaration').date, '2026-11-18');
});

test('échéances personnelles triées, faites en dernier', () => {
  const d = dos({ declareLe: '2026-11-10', echeances: [{ id: 'a', libelle: 'Expert', date: '2026-11-20' }, { id: 'b', libelle: 'Devis', date: '2026-11-14', fait: true }] });
  const e = R.echeances(d, '2026-11-12');
  // Faites en dernier, chacune à sa date : « Devis » (14/11) avant la déclaration (18/11).
  assert.deepEqual(e.map((x) => x.code === 'perso' ? x.libelle : x.code), ['Expert', 'prescription', 'Devis', 'declaration']);
});

test('vétusté : saisie sur le bien, sinon taux de catégorie × âge, plafond ; 0 sans taux', () => {
  const reg = { vetuste: { mobilier: 10 }, plafondVetuste: 60 };
  assert.deepEqual(R.vetuste(bien({ vetuste: 25 }), reg, '2026-11-09'), { taux: 25, source: 'saisie' });
  const v = R.vetuste(bien({ achatLe: '2022-11-09' }), reg, '2026-11-09');
  assert.equal(v.source, 'categorie');
  assert.equal(v.taux, 40);
  assert.equal(R.vetuste(bien({ achatLe: '2010-01-01' }), reg, '2026-11-09').taux, 60);
  assert.equal(R.vetuste(bien({ achatLe: '2020-01-01', categorie: 'informatique' }), reg, '2026-11-09').taux, 0);
  assert.equal(R.vetuste(bien(), reg, '2026-11-09').source, 'age-inconnu');
  assert.equal(R.vetuste(bien({ vetuste: 140 }), reg).taux, 100);
});

test('montants : réparation, remplacement moins vétusté, valeur actuelle, montant déclaré', () => {
  const reg = { vetuste: { mobilier: 10 } };
  const rep = R.montants(bien({ reparable: 'oui', coutReparation: 300, prixAchat: 900 }), reg, '2026-11-09');
  assert.equal(rep.methode, 'reparation');
  assert.equal(rep.estime, 300);
  const remp = R.montants(bien({ reparable: 'non', achatLe: '2024-11-09', prixAchat: 900, coutRemplacement: 1000 }), reg, '2026-11-09');
  assert.equal(remp.methode, 'remplacement');
  assert.equal(remp.vetuste.taux, 20);
  assert.equal(remp.vetusteMontant, 200);
  assert.equal(remp.estime, 800);
  assert.equal(remp.declare, 800);
  assert.equal(R.montants(bien({ prixAchat: 500 }), {}).estime, 500); // prix d'achat à défaut de remplacement
  const val = R.montants(bien({ valeurEstimee: 180, vetuste: 50 }), {});
  assert.equal(val.methode, 'valeur');
  assert.equal(val.estime, 180); // la vétusté ne s'ajoute pas à une valeur actuelle
  assert.equal(R.montants(bien({ valeurEstimee: 120, montantDeclare: 150 }), {}).declare, 150);
  const vide = R.montants(bien(), {});
  assert.equal(vide.estime, null);
  assert.match(vide.detail, /à saisir/);
  // Méthode forcée.
  assert.equal(R.montants(bien({ methode: 'reparation', coutReparation: 90, prixAchat: 500 }), {}).estime, 90);
  assert.equal(R.montants(bien({ coutRemplacement: 99.99, vetuste: 33 }), {}).estime, 66.99);
});

test('totaux : estimé, déclaré, vétusté, biens à chiffrer, indemnisation et reste à verser', () => {
  const d = dos({ dommages: [bien({ coutRemplacement: 1000, vetuste: 20 }), bien({ coutReparation: 200, reparable: 'oui', categorie: 'revetements', piece: 'Couloir' }), bien({ montantDeclare: 50, valeurEstimee: 40 }), bien()],
    indemnisation: { proposition: 900, franchise: 150, versements: [{ id: 'v', date: '2026-11-11', montant: 500 }] } });
  const t = R.totaux(d, {});
  assert.equal(t.nombre, 4);
  assert.equal(t.aChiffrer, 1);
  assert.equal(t.estime, 1040);
  assert.equal(t.declare, 1050);
  assert.equal(t.vetuste, 200);
  assert.equal(t.reconnu, 900);
  assert.equal(t.net, 750);
  assert.equal(t.verse, 500);
  assert.equal(t.resteAVerser, 250);
  assert.equal(t.ecart, 150);
  assert.equal(t.parCategorie.mobilier, 850);
  assert.equal(t.parPiece.Couloir, 200);
  assert.equal(R.totaux(dos({ indemnisation: { proposition: 600, franchise: 150, franchiseIncluse: true } })).net, 600);
  assert.equal(R.totaux(dos()).reconnu, null);
});

test('statut et progression déduits de la chronologie', () => {
  assert.equal(R.statut(dos()), 'a-declarer');
  assert.equal(R.statut(dos({ declareLe: '2026-11-11' })), 'declare');
  const ev = (type, date) => ({ id: uid(), type, date });
  assert.equal(R.statut(dos({ evenements: [ev('decouverte', '2026-11-10'), ev('declaration', '2026-11-11'), ev('expertise', '2026-11-20')] })), 'expertise');
  assert.equal(R.statut(dos({ evenements: [ev('declaration', '2026-11-11'), ev('proposition', '2026-12-01'), ev('contestation', '2026-12-03')] })), 'conteste');
  assert.equal(R.statut(dos({ evenements: [ev('proposition', '2026-12-01'), ev('contestation', '2026-12-03'), ev('acceptation', '2026-12-20')] })), 'accepte');
  assert.equal(R.statut(dos({ evenements: [ev('cloture', '2027-01-10'), ev('reparation', '2027-01-05')] })), 'clos');
  assert.equal(R.statut(dos({ evenements: [ev('autre', '2026-11-12')] })), 'a-declarer');
  assert.equal(R.progression(dos()), 0);
  assert.equal(R.progression(dos({ evenements: [ev('decouverte', '2026-11-10')] })), 14);
  assert.equal(R.progression(dos({ evenements: [ev('cloture', '2027-01-10')] })), 100);
  // Prescription « faite » quand le dossier est clos.
  assert.equal(R.echeances(dos({ declareLe: '2026-11-10', evenements: [ev('cloture', '2027-01-10')] }), '2027-02-01').find((x) => x.code === 'prescription').etat, 'faite');
});

test('justificatifs initiaux selon le type et bilan par statut', () => {
  const p = R.preuvesInitiales('vol', uid);
  assert.ok(p.some((x) => x.code === 'plainte'));
  assert.ok(!p.some((x) => x.code === 'constat-eau'));
  assert.ok(p.every((x) => x.statut === 'a-fournir' && Array.isArray(x.photos)));
  assert.ok(R.preuvesInitiales('eau', uid).some((x) => x.code === 'constat-eau'));
  const b = R.bilanPreuves([{ statut: 'recu' }, { statut: 'verifie' }, { statut: 'manquant' }, { statut: 'a-fournir' }, { statut: 'refuse' }]);
  assert.equal(b.total, 5);
  assert.equal(b.collectees, 2);
  assert.equal(b.aTraiter, 3);
});

test('recherche des dommages sans accents ni casse, par pièce et catégorie', () => {
  const l = [bien({ designation: 'Télévision', piece: 'Séjour', categorie: 'electronique' }), bien({ designation: 'Parquet chêne', piece: 'Séjour', categorie: 'revetements' }), bien({ designation: 'Lit', piece: 'Chambre' })];
  assert.equal(R.filtrerDommages(l, { texte: 'television' }).length, 1);
  assert.equal(R.filtrerDommages(l, { texte: 'CHENE' }).length, 1);
  assert.equal(R.filtrerDommages(l, { piece: 'Séjour' }).length, 2);
  assert.equal(R.filtrerDommages(l, { categorie: 'mobilier' }).length, 1);
});

test('courriers : champs remplis, champs vides signalés « [à compléter] »', () => {
  assert.equal(R.remplir('Contrat {{contrat}} du {{survenu}}', { contrat: 'X1', survenu: '' }), 'Contrat X1 du [à compléter]');
  for (const c of B.courriers) {
    const texte = R.remplir(c.texte, {});
    assert.ok(!/\{\{/.test(texte), `champ non remplacé dans ${c.code}`);
  }
});

test('exports CSV : en-têtes, point-virgule, guillemets, montants à la française', () => {
  const d = dos({ dommages: [bien({ id: 'b1', designation: 'Canapé "3 places"; tissu', coutRemplacement: 1000.5, vetuste: 10, commentaire: 'ligne 1\nligne 2' })],
    preuves: [{ id: 'p1', libelle: 'Facture', type: 'facture', statut: 'recu', dommageId: 'b1', photos: ['x'] }],
    evenements: [{ id: 'e1', type: 'declaration', date: '2026-11-11', description: 'En ligne' }] });
  const c = R.csvDommages(d, {});
  assert.ok(c.startsWith('﻿Pièce;Catégorie;Désignation'));
  assert.ok(c.includes('"Canapé ""3 places""; tissu"'));
  assert.ok(c.includes('1000,5;10;100,05;Remplacement;900,45;900,45'));
  assert.ok(c.includes('"ligne 1\nligne 2"'));
  const p = R.csvPreuves(d);
  assert.ok(p.includes('Facture;Facture;Reçu;;"Canapé ""3 places""; tissu"'));
  assert.ok(p.trim().endsWith(';1;'));
  assert.ok(R.csvChronologie(d).includes('11/11/2026;Déclaration à l\'assureur;En ligne;0'));
});

test('normalisation : état vide, copie partielle, dossier actif, champs manquants', () => {
  assert.deepEqual(R.normaliser(null).dossiers, []);
  const e = R.normaliser({ dossiers: [{ id: 'a', type: 'eau', dommages: [{ id: 'x' }], preuves: [{ id: 'p' }] }, { nope: true }], actif: 'zz' });
  assert.equal(e.dossiers.length, 1);
  assert.equal(e.actif, 'a');
  assert.equal(e.dossiers[0].dommages[0].reparable, 'inconnu');
  assert.deepEqual(e.dossiers[0].preuves[0].photos, []);
  assert.equal(e.dossiers[0].preuves[0].statut, 'a-fournir');
  assert.deepEqual(e.dossiers[0].indemnisation.versements, []);
  assert.equal(R.normaliserDossier({ id: 'b', survenu: '2026-02-30' }).survenu, null);
  assert.ok(R.taille(e) > 100);
});
