// Tests des règles métier de « Cadeaux reçus et remerciements » (templates/remerciements/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/remerciements/', import.meta.url);
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.CDX;
const B = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));
const AUJ = '2026-11-14';
const nbsp = (s) => s.replace(/[  ]/g, ' ');

function etat({ evenements = [{ id: 'ev', type: 'mariage', nom: 'Mariage', date: '2026-10-17', signature: 'Camille et Hugo', projet: 'notre voyage de noces' }], personnes = [], cadeaux = [], ...reste } = {}) {
  return R.normaliser({ evenements, personnes, cadeaux, ...reste });
}

test('base intégrée : types cohérents avec les règles, 44 modèles originaux, identifiants uniques', () => {
  assert.deepEqual(simple(B.evenements.map((e) => e.id)), simple(R.TYPES_EVENEMENT));
  assert.deepEqual(simple(B.cadeaux.map((e) => e.id).sort()), simple([...R.TYPES_CADEAU].sort()));
  assert.deepEqual(simple(B.statuts.map((e) => e.id)), simple(R.STATUTS));
  assert.deepEqual(simple(B.canaux.map((e) => e.id)), simple(R.CANAUX));
  assert.deepEqual(simple(B.tons.map((e) => e.id)), simple(R.TONS));
  assert.deepEqual(simple(B.etiquettes.map((e) => e.id)), simple(R.FORMATS));
  const tous = Object.values(B.modeles).flat();
  assert.equal(tous.length, 44);
  assert.equal(new Set(tous.map((m) => m.id)).size, tous.length);
  for (const ev of B.evenements) {
    const l = B.modeles[ev.id];
    assert.ok(l, ev.id);
    for (const ton of ev.tons) assert.equal(l.filter((m) => m.ton === ton).length, 2, `${ev.id} ${ton}`);
    for (const m of l) assert.ok(ev.tons.includes(m.ton), m.id);
    for (const c of ev.cadeaux) assert.ok(R.TYPES_CADEAU.includes(c), c);
  }
  for (const m of tous) {
    assert.match(m.texte, /^\{appel\}/, m.id);
    assert.match(m.texte, /\{cadeaux\}/, m.id);
    assert.match(m.texte, /\{signature\}$/, m.id);
    // Blocs bien fermés
    const ouverts = [...m.texte.matchAll(/\{[?!](\w+)\}/g)].map((x) => x[1]);
    const fermes = [...m.texte.matchAll(/\{\/(\w+)\}/g)].map((x) => x[1]);
    assert.deepEqual(ouverts, fermes, m.id);
  }
  // Pas de ton léger pour des obsèques, ni de vocabulaire festif
  assert.ok(!B.evenements.find((e) => e.id === 'obseques').tons.includes('leger'));
  for (const m of B.modeles.obseques) assert.doesNotMatch(m.texte, /joie|bonheur|fête|!/i, m.id);
  // Planches A4 : tout tient dans 210 × 297 mm
  for (const f of B.etiquettes) {
    assert.ok(f.gauche + (f.colonnes - 1) * f.pasX + f.largeur <= 210.01, f.id);
    assert.ok(f.haut + (f.lignes - 1) * f.pasY + f.hauteur <= 297.01, f.id);
  }
});

test('montants : saisie en euros tolérante, formatage français', () => {
  assert.equal(R.lireMontant('50'), 5000);
  assert.equal(R.lireMontant('50,5'), 5050);
  assert.equal(R.lireMontant('50,00 €'), 5000);
  assert.equal(R.lireMontant('1 200'), 120000);
  assert.equal(R.lireMontant('1.200,50'), 120050);
  assert.equal(R.lireMontant('150 euros'), 15000);
  assert.equal(R.lireMontant(''), null);
  assert.equal(R.lireMontant('beaucoup'), null);
  assert.equal(R.lireMontant('-20'), null);
  assert.equal(R.lireMontant('12,345'), null);
  assert.equal(nbsp(R.formatMontant(5000)), '50 €');
  assert.equal(nbsp(R.formatMontant(5050)), '50,50 €');
  assert.equal(nbsp(R.formatMontant(120000)), '1 200 €');
  assert.equal(R.montantCsv(5050), '50,50');
  assert.equal(R.montantCsv(null), '');
});

test('normalisation : tolérante, liens orphelins supprimés, événement courant, réglages bornés', () => {
  const E = R.normaliser({
    evenements: [{ id: 'a', type: 'inconnu', nom: '  Fête  ' }, { id: 'b', type: 'naissance', date: '2026-02-30' }],
    personnes: [{ id: 'p1', evenement: 'a', nom: 'Famille Martin', statut: 'bizarre', canal: 'pigeon', envoyeLe: '2026-11-01' }, { id: 'p2', evenement: 'zz', nom: 'Orphelin' }],
    cadeaux: [{ id: 'c1', personne: 'p1', type: 'cagnotte', montant: '5000', cagnotte: 'Voyage' }, { id: 'c2', personne: 'p2' }, { id: 'c3', personne: 'p1', type: 'objet', cagnotte: 'ignoré' }],
    reglages: { delaiSemaines: 99, format: 'A9', decalageX: 3.3, decalageY: -40 },
    courant: 'zz',
  });
  assert.equal(E.evenements[0].type, 'autre');
  assert.equal(E.evenements[0].nom, 'Fête');
  assert.equal(E.evenements[1].date, null);
  assert.deepEqual(E.personnes.map((p) => p.id), ['p1']);
  assert.equal(E.personnes[0].statut, 'a-ecrire');
  assert.equal(E.personnes[0].canal, 'poste');
  assert.equal(E.personnes[0].envoyeLe, null);
  assert.deepEqual(E.cadeaux.map((c) => c.id), ['c1', 'c3']);
  assert.equal(E.cadeaux[0].montant, 5000);
  assert.equal(E.cadeaux[1].cagnotte, '');
  assert.equal(E.reglages.delaiSemaines, 26);
  assert.equal(E.reglages.format, '3x8');
  assert.equal(E.reglages.decalageX, 3.5);
  assert.equal(E.reglages.decalageY, -10);
  assert.equal(E.courant, 'a');
  assert.deepEqual(simple(R.normaliser(null).evenements), []);
  assert.equal(R.normaliser(null).courant, null);
});

test('indicateurs : reste à remercier, progression, totaux, cagnottes, retards, adresses manquantes', () => {
  const E = etat({
    personnes: [
      { id: 'a', evenement: 'ev', nom: 'Agnès et Paul', statut: 'envoye', envoyeLe: '2026-11-01', adresse: { ligne1: '3 rue des Lilas', cp: '00000', ville: 'Exempleville' } },
      { id: 'b', evenement: 'ev', nom: 'Famille Roux', statut: 'ecrit' },
      { id: 'c', evenement: 'ev', nom: 'Léa', statut: 'a-ecrire', canal: 'message' },
      { id: 'd', evenement: 'ev', nom: 'Sans cadeau' },
    ],
    cadeaux: [
      { personne: 'a', type: 'cagnotte', montant: 10000, cagnotte: 'Voyage de noces', recuLe: '2026-10-17' },
      { personne: 'b', type: 'cagnotte', montant: 5000, cagnotte: 'Voyage de noces', recuLe: '2026-10-17' },
      { personne: 'b', type: 'objet', description: 'la machine à pain', recuLe: '2026-10-17' },
      { personne: 'c', type: 'argent', montant: 3000, recuLe: '2026-11-10' },
    ],
  });
  const ind = R.indicateurs(E, 'ev', AUJ);
  assert.equal(ind.foyers, 4);
  assert.equal(ind.avecCadeau, 3);
  assert.equal(ind.sansCadeau, 1);
  assert.equal(ind.cadeaux, 4);
  assert.equal(ind.envoyes, 1);
  assert.equal(ind.ecrits, 1);
  assert.equal(ind.aEcrire, 1);
  assert.equal(ind.reste, 2);
  assert.equal(ind.progression, 33);
  assert.equal(ind.total, 18000);
  assert.equal(ind.avecMontant, 3);
  assert.deepEqual(simple(ind.cagnottes), [{ nom: 'Voyage de noces', n: 2, total: 15000 }]);
  assert.equal(ind.parType.cagnotte.n, 2);
  // Objectif 6 semaines : 17/10 + 42 j = 28/11 → pas encore en retard ; à 4 semaines : 14/11 → retard demain.
  assert.equal(ind.retard, 0);
  assert.equal(R.dateObjectif(E, E.personnes[1]), '2026-11-28');
  // Cadeau reçu après l'événement : l'objectif part du cadeau.
  assert.equal(R.dateObjectif(E, E.personnes[2]), '2026-12-22');
  const E2 = R.normaliser({ ...E, reglages: { delaiSemaines: 3 } });
  assert.equal(R.indicateurs(E2, 'ev', AUJ).retard, 1);
  assert.equal(R.enRetard(E2, E2.personnes[0], AUJ), false); // déjà envoyé
  // Adresse manquante : Famille Roux (poste) ; Léa (message) n'en a pas besoin.
  assert.equal(ind.sansAdresse, 1);
  assert.equal(R.adresseComplete(E.personnes[0]), true);
  // File : objectif le plus proche d'abord, foyer sans cadeau exclu, envoyé exclu.
  assert.deepEqual(R.aRemercier(E, 'ev').map((p) => p.id), ['b', 'c']);
  assert.equal(R.indicateurs(etat(), 'ev', AUJ).progression, 0);
});

test('messages : phrase des cadeaux, blocs conditionnels, majuscules, projet seulement si argent reçu', () => {
  const E = etat({
    personnes: [{ id: 'a', evenement: 'ev', nom: 'Agnès et Paul', appel: 'Chère Agnès, cher Paul,' }, { id: 'b', evenement: 'ev', nom: 'Famille Roux' }, { id: 'c', evenement: 'ev', nom: 'Rien' }],
    cadeaux: [
      { personne: 'a', type: 'objet', description: 'la machine à pain' },
      { personne: 'a', type: 'cagnotte', montant: 5000, cagnotte: 'Voyage de noces' },
      { personne: 'a', type: 'presence' },
      { personne: 'b', type: 'objet', description: 'le service à thé' },
    ],
  });
  assert.equal(R.phraseCadeaux(B, R.cadeauxDe(E, 'a')), 'la machine à pain, votre participation à la cagnotte « Voyage de noces » et votre présence');
  assert.equal(R.phraseCadeaux(B, []), 'votre attention');
  assert.equal(R.enumerer(['a', 'a', 'b']), 'a et b');
  const ctxA = R.contexteMessage(B, E, E.personnes[0]);
  assert.equal(ctxA.argent, 'oui');
  assert.equal(ctxA.projet, 'notre voyage de noces');
  assert.equal(ctxA.occasion, 'notre mariage');
  const ctxB = R.contexteMessage(B, E, E.personnes[1]);
  assert.equal(ctxB.projet, '');
  assert.equal(ctxB.appel, 'Famille Roux,');
  const mA = R.genererMessage(B, E, 'a', 'mar-ch1');
  assert.match(mA, /^Chère Agnès, cher Paul,\n\nMerci du fond du cœur pour la machine à pain/);
  assert.match(mA, /votre générosité nous aide/);
  assert.match(mA, /nous pourrons nous offrir notre voyage de noces\./);
  assert.match(mA, /Camille et Hugo$/);
  const mB = R.genererMessage(B, E, 'b', 'mar-ch1');
  assert.doesNotMatch(mB, /générosité|voyage|\{|\}/);
  assert.match(mB, /touchés\.\n\nNous avons hâte/);
  // Tous les modèles intégrés se remplissent sans accolade restante ni espace avant ponctuation.
  for (const ev of B.evenements) {
    const E2 = etat({ evenements: [{ id: 'x', type: ev.id, signature: 'Sam', concerne: ev.concerne ? 'maman' : '', projet: 'un vélo' }], personnes: [{ id: 'p', evenement: 'x', nom: 'Léa' }], cadeaux: [{ personne: 'p', type: 'argent', montant: 2000 }] });
    for (const m of B.modeles[ev.id]) {
      const t = R.genererMessage(B, E2, 'p', m.id);
      assert.doesNotMatch(t, /[{}]|[ \t][.,]|[ \t]{2,}|\n{3}/, m.id);
      assert.match(t, /^Léa,\n\n\p{Lu}/u, m.id);
    }
  }
  // Prénom en début de phrase : majuscule ; sans prénom : variante.
  const En = etat({ evenements: [{ id: 'n', type: 'naissance', concerne: 'léo', signature: 'Nina et Malik' }], personnes: [{ id: 'p', evenement: 'n', nom: 'Mamie' }], cadeaux: [{ personne: 'p', type: 'objet', description: 'le doudou' }] });
  assert.match(R.genererMessage(B, En, 'p', 'nai-ch1'), /\n\nLéo et nous vous remercions de tout cœur pour le doudou\. Votre attention pour la naissance de léo/);
  En.evenements[0].concerne = '';
  assert.match(R.genererMessage(B, En, 'p', 'nai-ch1'), /\n\nNous vous remercions de tout cœur pour le doudou\. Votre attention pour cette naissance/);
  assert.equal(R.occasionDe(B, { type: 'naissance', concerne: 'Léo', occasion: '' }), 'la naissance de Léo');
  assert.equal(R.occasionDe(B, { type: 'naissance', concerne: 'Léo', occasion: 'le baptême de Léo' }), 'le baptême de Léo');
  // Ton inconnu ou modèle absent : premier modèle du ton de l'événement.
  assert.ok(R.genererMessage(B, E, 'b', 'inexistant').length > 20);
  assert.equal(R.genererMessage(B, E, 'zz', 'mar-ch1'), '');
});

test('modèles personnels : ajoutés à leur type d\'événement ou à tous', () => {
  const E = etat({ modelesPerso: [{ id: 'p-1', evenement: 'tous', ton: 'bref', nom: 'Le mien', texte: '{appel} Merci pour {cadeaux}. {signature}' }, { id: 'p-2', evenement: 'obseques', ton: 'sobre', texte: 'x' }, { id: 'p-3', texte: '' }] });
  assert.equal(E.modelesPerso.length, 2);
  const l = R.modelesPour(B, E, 'mariage', 'bref');
  assert.deepEqual(simple(l.map((m) => m.id)), ['mar-br1', 'mar-br2', 'p-1']);
  assert.equal(l[2].perso, true);
  assert.equal(R.modelesPour(B, E, 'mariage').length, 9);
  assert.equal(R.modelesPour(B, E, 'obseques').length, 8);
});

test('import d\'une liste collée : séparateurs, en-tête, montants, regroupement, types devinés', () => {
  const tsv = 'Nom\tCadeau\tMontant\tAdresse\tCP\tVille\nTante Agnès et Paul\tla machine à pain\t\t3 rue des Lilas\t00000\tExempleville\nFamille Roux\tcagnotte\t50\nfamille roux\tle service à thé\nLéa\tchèque\t30 €\nMarc\t\tbeaucoup\n\t\t\nSophie';
  const r = R.analyserListe(tsv);
  assert.equal(r.foyers.length, 5);
  assert.equal(r.nbCadeaux, 4);
  const [agnes, roux, lea, marc, sophie] = r.foyers;
  assert.equal(agnes.adresse.ville, 'Exempleville');
  assert.deepEqual(simple(roux.cadeaux), [{ type: 'cagnotte', description: '', montant: 5000 }, { type: 'objet', description: 'le service à thé', montant: null }]);
  assert.equal(lea.cadeaux[0].type, 'argent');
  assert.equal(lea.cadeaux[0].montant, 3000);
  assert.equal(marc.cadeaux.length, 0);
  assert.equal(sophie.cadeaux.length, 0);
  assert.equal(r.erreurs.length, 1);
  assert.match(r.erreurs[0], /beaucoup/);
  // Une colonne : un nom par ligne (comme la liste d'invités du mariage).
  assert.deepEqual(simple(R.analyserListe('Léa\nMarc\n\nLéa').foyers.map((f) => f.nom)), ['Léa', 'Marc']);
  // Points-virgules
  const pv = R.analyserListe('Jules ; bouquet de fleurs ; ; 1 place du Marché ; 00001 ; Bourg-Exemple');
  assert.equal(pv.foyers[0].cadeaux[0].type, 'fleurs');
  assert.equal(pv.foyers[0].adresse.ligne1, '1 place du Marché');
  assert.equal(R.deviner('', 2000), 'argent');
  assert.equal(R.deviner('un coffret week-end', null), 'bon');
  assert.equal(R.deviner('don à la recherche', null), 'don');
});

test('import dans un événement : sans doublon, adresse complétée, foyer déjà remercié rouvert', () => {
  const E = etat({ personnes: [{ id: 'a', evenement: 'ev', nom: 'Tante Agnès et Paul', statut: 'envoye', envoyeLe: '2026-11-01' }, { id: 'z', evenement: 'autre', nom: 'Léa' }] });
  const r = R.analyserListe('Tante Agnès et Paul\tle vase\t\t3 rue des Lilas\t00000\tExempleville\nLéa\tle livre');
  const { E: N, crees, completes, cadeaux } = R.importer(E, 'ev', r.foyers, AUJ);
  assert.equal(crees, 1);
  assert.equal(completes, 1);
  assert.equal(cadeaux, 2);
  const agnes = N.personnes.find((p) => p.id === 'a');
  assert.equal(agnes.adresse.ligne1, '3 rue des Lilas');
  assert.equal(agnes.statut, 'a-ecrire');
  assert.equal(N.personnes.filter((p) => p.evenement === 'ev').length, 2);
  assert.equal(N.cadeaux.every((c) => c.recuLe === AUJ), true);
  assert.equal(E.personnes.length, 1); // état d'origine intact (« autre » n'existe pas : foyer orphelin retiré)
});

test('étiquettes : positions sur la planche, départ décalé, planches suivantes, lignes d\'adresse', () => {
  const ps = Array.from({ length: 30 }, (_, i) => R.normaliserPersonne({ id: `p${i}`, nom: `Foyer ${i}`, adresse: { ligne1: `${i} rue Exemple`, cp: '00000', ville: 'Exempleville' } }));
  const r = R.etiquettes(B, ps, '3x8', 5);
  assert.equal(r.parPlanche, 24);
  assert.equal(r.planches.length, 2);
  assert.equal(r.planches[0].length, 20);
  assert.equal(r.planches[1].length, 10);
  assert.deepEqual(simple(r.planches[0][0]), { position: 5, x: 70, y: 37.5, largeur: 70, hauteur: 37, lignes: ['Foyer 0', '0 rue Exemple', '00000 Exempleville'], id: 'p0' });
  assert.equal(r.planches[1][0].position, 1);
  const r2 = R.etiquettes(B, ps.slice(0, 2), '2x7', 99, { x: 1, y: -0.5 });
  assert.equal(r2.planches[0][0].position, 14);
  assert.deepEqual([r2.planches[0][0].x, r2.planches[0][0].y], [107.25, 243.25]);
  assert.equal(r2.planches[1][0].position, 1);
  assert.equal(R.etiquettes(B, [], 'inconnu').format.id, '3x8');
  const p = R.normaliserPersonne({ nom: 'Tante Agnès', adresse: { destinataire: 'Mme et M. Exemple', ligne1: '3 rue des Lilas', ligne2: 'Bât. B', ville: 'Exempleville', pays: 'Belgique' } });
  assert.deepEqual(simple(R.lignesAdresse(p)), ['Mme et M. Exemple', '3 rue des Lilas', 'Bât. B', 'Exempleville', 'Belgique']);
});

test('effacement : un événement entier, ou les adresses des foyers déjà remerciés', () => {
  const E = etat({
    evenements: [{ id: 'ev', type: 'mariage' }, { id: 'ev2', type: 'naissance' }],
    personnes: [
      { id: 'a', evenement: 'ev', nom: 'A', statut: 'envoye', adresse: { ligne1: '1 rue', ville: 'X' } },
      { id: 'b', evenement: 'ev', nom: 'B', adresse: { ligne1: '2 rue', ville: 'X' } },
      { id: 'c', evenement: 'ev2', nom: 'C', statut: 'envoye', adresse: { ligne1: '3 rue', ville: 'X' } },
    ],
    cadeaux: [{ personne: 'a' }, { personne: 'b' }, { personne: 'c' }],
    courant: 'ev',
  });
  const { E: N1, n } = R.effacerAdresses(E, 'ev');
  assert.equal(n, 1);
  assert.equal(N1.personnes.find((p) => p.id === 'a').adresse.ligne1, '');
  assert.equal(N1.personnes.find((p) => p.id === 'b').adresse.ligne1, '2 rue');
  assert.equal(N1.personnes.find((p) => p.id === 'c').adresse.ligne1, '3 rue');
  assert.equal(R.effacerAdresses(N1, 'ev').n, 0);
  const N2 = R.sansEvenement(E, 'ev');
  assert.deepEqual(N2.evenements.map((e) => e.id), ['ev2']);
  assert.deepEqual(N2.personnes.map((p) => p.id), ['c']);
  assert.equal(N2.cadeaux.length, 1);
  assert.equal(N2.courant, 'ev2');
  assert.equal(R.sansEvenement(N2, 'ev2').courant, null);
});

test('total reçu : un don à une association est compté dans son type, pas dans le total', () => {
  const E = etat({ evenements: [{ id: 'o', type: 'obseques' }], personnes: [{ id: 'a', evenement: 'o', nom: 'A' }], cadeaux: [{ personne: 'a', type: 'don', montant: 8000 }, { personne: 'a', type: 'fleurs', montant: 4000 }] });
  const ind = R.indicateurs(E, 'o', AUJ);
  assert.equal(ind.total, 4000);
  assert.equal(ind.avecMontant, 1);
  assert.equal(ind.parType.don.total, 8000);
});

test('CSV : une ligne par cadeau, foyer sans cadeau inclus, point-virgule, BOM, montants à virgule', () => {
  const E = etat({
    personnes: [{ id: 'a', evenement: 'ev', nom: 'Roux; famille', statut: 'envoye', envoyeLe: '2026-11-02', adresse: { ligne1: '2 rue "Haute"', cp: '00000', ville: 'X' } }, { id: 'b', evenement: 'ev', nom: 'Berthe' }],
    cadeaux: [{ personne: 'a', type: 'cagnotte', montant: 5050, cagnotte: 'Voyage', recuLe: '2026-10-17' }, { personne: 'a', type: 'objet', description: 'le vase' }],
  });
  const csv = R.csvEvenement(B, E, 'ev');
  assert.ok(csv.startsWith('﻿Foyer;Destinataire;Adresse'));
  const l = csv.trim().split('\r\n');
  assert.equal(l.length, 4);
  assert.match(l[1], /^Berthe;/);
  assert.match(l[2], /^"Roux; famille";;"2 rue ""Haute""";;00000;X;;votre participation à la cagnotte;Cagnotte;50,50;Voyage;2026-10-17;Envoyé;Carte par la poste;2026-11-02$/);
  assert.match(l[3], /le vase;Objet;;;;Envoyé/);
});
