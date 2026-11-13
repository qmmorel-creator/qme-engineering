// Tests du moteur de MémoFamille (templates/memo-famille/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = { window: {}, TextEncoder, structuredClone };
vm.createContext(ctx);
for (const f of ['../../templates/commun/outils.js', '../../templates/memo-famille/donnees.js', '../../templates/memo-famille/regles.js']) vm.runInContext(readFileSync(new URL(f, import.meta.url), 'utf8'), ctx);
const R = ctx.window.MMF;
const BASE = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));
const types = (t) => simple(R.detecter(t).map((x) => x.type));
// Numéros de test publics ou calculés : aucun ne correspond à une personne réelle.
const CARTE = '4111 1111 1111 1111'; // carte de test Visa (Luhn valide)
const IBAN = 'FR76 3000 6000 0112 3456 7890 189'; // IBAN d'exemple
const NIR = '1 85 05 78 006 048 30'; // clé calculée : 97 − (1850578006048 mod 97) = 30

test('base : catégories et champs cohérents, aucun champ de secret', () => {
  assert.equal(BASE.categories.length, 11);
  for (const c of BASE.categories) {
    const ids = c.champs.map((x) => x.id);
    assert.equal(new Set(ids).size, ids.length, c.id);
    for (const ch of c.champs) {
      assert.ok(['texte', 'long', 'date', 'tel', 'email', 'choix'].includes(ch.type));
      assert.ok(!/mot de passe|code pin|iban|carte bancaire/i.test(ch.libelle), `${c.id}/${ch.id} : champ interdit`);
    }
  }
  assert.match(BASE.securite, /pas un coffre-fort numérique certifié/);
});

test('contrôles : Luhn, IBAN, numéro de sécurité sociale', () => {
  assert.ok(R.luhn('4111111111111111'));
  assert.ok(!R.luhn('4111111111111112'));
  assert.ok(R.estCarte('4111111111111111'));
  assert.ok(R.estCarte('5555555555554444'));
  assert.ok(R.estCarte('378282246310005'));
  assert.ok(!R.estCarte('1234567812345670'), 'Luhn valide mais préfixe d\'aucun réseau');
  assert.ok(R.estIban(IBAN));
  assert.ok(!R.estIban('FR76 3000 6000 0112 3456 7890 188'));
  assert.ok(R.estNir(NIR));
  assert.ok(!R.estNir('1 85 05 78 006 048 31'));
  assert.ok(R.estNir('2 69 05 2A 006 048 ' + String(97 - Number(BigInt('2690519006048') % 97n)).padStart(2, '0')), 'Corse : 2A');
});

test('détection : numéros et mots interdits, sans faux positif sur les numéros courants', () => {
  assert.deepEqual(types(`Carte : ${CARTE}`), ['carte']);
  assert.deepEqual(types(`ma carte 4111-1111-1111-1111 expire`), ['carte']);
  assert.deepEqual(types(`Virements sur ${IBAN}`), ['iban']);
  assert.deepEqual(types(`Sécu ${NIR}`), ['nir']);
  assert.deepEqual(types('Le mot de passe est soleil42'), ['mot']);
  assert.deepEqual(types('MDP: azerty'), ['mot']);
  assert.deepEqual(types('Code PIN du téléphone : 1234'), ['mot']);
  assert.deepEqual(types('Le digicode du hall'), ['mot']);
  assert.deepEqual(types('Code d’alarme dans le tiroir'), ['mot'], 'apostrophe typographique');
  assert.deepEqual(types('Cryptogramme au dos'), ['mot']);
  // Usages légitimes : rien de détecté.
  assert.deepEqual(types('06 12 34 56 78'), []);
  assert.deepEqual(types('Contrat n° 2026-458-7781'), []);
  assert.deepEqual(types('Immatriculation AB-123-CD'), []);
  assert.deepEqual(types('Numéro client 4500123456789'), [], 'numéro long sans Luhn ou préfixe de carte');
  assert.deepEqual(types('Les mots de passe sont dans le gestionnaire de la famille'), ['mot'], 'même pour dire où ils sont : on reformule');
  assert.deepEqual(types('Passeport rangé dans le classeur'), [], '« passe » dans « passeport » n\'est pas un mot de passe');
  assert.deepEqual(types('Pas de login ici ? si : loginx'), ['mot']);
  assert.deepEqual(types(''), []);
});

test('masquage : du mot interdit jusqu\'à la fin de la ligne, numéros remplacés', () => {
  const m = R.masquer(`Banque : ${IBAN}\nmot de passe : soleil42 (à changer)\nAgence du centre`);
  assert.equal(m.retraits, 2);
  assert.equal(m.texte, `Banque : ${R.RETIRE}\n${R.RETIRE}\nAgence du centre`);
  assert.equal(R.masquer('Rien à signaler').retraits, 0);
  const accents = R.masquer('Écrit à côté : code d\'accès 4567, puis rien');
  assert.equal(accents.texte, `Écrit à côté : ${R.RETIRE}`, 'positions correctes malgré les accents');
  assert.match(R.messageRefus(R.detecter(`${CARTE} et mot de passe`)), /un numéro de carte bancaire, un mot de passe/);
});

test('vérification d\'une fiche : champ en cause', () => {
  const f = R.normaliserFiche({ categorie: 'contrats', titre: 'Banque', valeurs: { organisme: 'Banque fictive' }, note: '' }, { n: 0 });
  assert.deepEqual(simple(R.verifierFiche(f)), []);
  f.valeurs.numero = CARTE;
  const v = R.verifierFiche(f);
  assert.equal(v.length, 1);
  assert.equal(v[0].champ, 'Numéro de contrat ou de client');
});

test('recherche : accents, casse, plusieurs mots, classement', () => {
  const c = { n: 0 };
  const fiches = [
    R.normaliserFiche({ id: 'a', categorie: 'prestataires', titre: 'Plombier du quartier', valeurs: { metier: 'Plomberie et chauffage' } }, c),
    R.normaliserFiche({ id: 'b', categorie: 'logement', titre: 'Maison', valeurs: { chauffage: 'Chaudière gaz, entretien annuel par le plombier' } }, c),
    R.normaliserFiche({ id: 'c', categorie: 'animaux', titre: 'Félix', valeurs: { veterinaire: 'Clinique des Lilas' } }, c),
  ];
  assert.deepEqual(simple(R.rechercher(fiches, 'PLOMBIER').map((r) => r.fiche.id)), ['a', 'b'], 'titre d\'abord');
  assert.deepEqual(simple(R.rechercher(fiches, 'chaudiere entretien').map((r) => r.fiche.id)), ['b']);
  assert.deepEqual(simple(R.rechercher(fiches, 'felix').map((r) => r.fiche.id)), ['c']);
  assert.deepEqual(simple(R.rechercher(fiches, 'animaux').map((r) => r.fiche.id)), ['c'], 'nom de catégorie');
  assert.deepEqual(simple(R.rechercher(fiches, 'absent')), []);
  assert.deepEqual(simple(R.rechercher(fiches, '  ')), []);
  assert.deepEqual(simple(R.rechercher(fiches, 'clinique')[0].champs), ['Vétérinaire']);
});

test('revue annuelle et complétude', () => {
  assert.equal(R.aRevoir({ majLe: '2025-10-01' }, '2026-11-13'), true);
  assert.equal(R.aRevoir({ majLe: '2026-06-01' }, '2026-11-13'), false);
  assert.equal(R.aRevoir({ majLe: null }, '2026-11-13'), true);
  const e = R.normaliser({ fiches: [{ categorie: 'contacts', titre: 'X' }, { categorie: 'contacts', titre: 'Y' }] });
  const c = R.completude(e);
  assert.equal(c.find((x) => x.id === 'contacts').nb, 2);
  assert.equal(c.find((x) => x.id === 'animaux').nb, 0);
});

test('dossier : catégories choisies, fiches privées exclues sauf choix explicite', () => {
  const e = R.normaliser({ fiches: [
    { id: 'a', categorie: 'contacts', titre: 'Voisine' }, { id: 'b', categorie: 'contacts', titre: 'Notaire', prive: true },
    { id: 'c', categorie: 'logement', titre: 'Maison' }, { id: 'd', categorie: 'contacts', titre: 'Ancien collègue' },
  ] });
  const d = R.dossier(e, { categories: ['contacts'], exclues: ['d'], prives: [] });
  assert.deepEqual(simple(d.map((g) => g.categorie.id)), ['contacts']);
  assert.deepEqual(simple(d[0].fiches.map((f) => f.id)), ['a']);
  const d2 = R.dossier(e, { categories: ['contacts', 'logement'], exclues: [], prives: ['b'] });
  assert.deepEqual(simple(d2.flatMap((g) => g.fiches.map((f) => f.id))), ['d', 'b', 'a', 'c']);
  assert.deepEqual(simple(R.dossier(e, { categories: [], exclues: [], prives: [] })), []);
});

test('normalisation : nettoyage des informations sensibles à l\'import, champs inconnus écartés', () => {
  const e = R.normaliser({ fiches: [
    { categorie: 'contrats', titre: 'Banque', valeurs: { numero: CARTE, type: 'Inventé', echeance: '2026-02-30', organisme: 'Banque fictive', inconnu: 'x' }, note: 'mot de passe : abc\nAgence centre' },
    { categorie: 'zzz', titre: '' },
  ], reglages: { revueJours: 5 } });
  assert.equal(e.retraits, 2);
  const f = e.fiches[0];
  assert.equal(f.valeurs.numero, R.RETIRE);
  assert.equal(f.valeurs.type, undefined);
  assert.equal(f.valeurs.echeance, undefined);
  assert.equal(f.valeurs.inconnu, undefined);
  assert.equal(f.note, `${R.RETIRE}\nAgence centre`);
  assert.equal(e.fiches[1].categorie, 'consignes');
  assert.equal(e.fiches[1].titre, 'Situation');
  assert.equal(e.reglages.revueJours, 365);
  const deux = R.normaliser(simple(e));
  assert.equal(deux.retraits, 0, 'idempotent : plus rien à retirer');
  assert.deepEqual(simple(deux.fiches), simple(e.fiches));
});

test('export CSV : une ligne par champ rempli', () => {
  const e = R.normaliser({ fiches: [{ categorie: 'contacts', titre: 'Voisine', valeurs: { telephone: '06 00 00 00 00', relation: 'Voisine; amie' }, note: 'Garde le chat', majLe: '2026-11-01' }, { categorie: 'animaux', titre: 'Félix' }] });
  const c = R.csvFiches(e.fiches);
  assert.equal(c.length, 5);
  assert.deepEqual(simple(c[1]), ['Contacts importants', 'Voisine', 'Relation ou rôle', 'Voisine; amie', 'non', '2026-11-01']);
  assert.deepEqual(simple(c[4]), ['Animaux', 'Félix', '', '', 'non', '']);
});
