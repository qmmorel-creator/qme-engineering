// Tests des règles métier du Kit références et plaquette (templates/references-plaquette/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/references-plaquette/', import.meta.url);
const ctx = { window: {}, TextEncoder };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.KRF;
const B = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));
const P = (o = {}) => R.normaliserProjet(o);
const MOTS15 = 'un deux trois quatre cinq six sept huit neuf dix onze douze treize quatorze quinze';

test('base intégrée : métiers complets, identifiants uniques, aucune valeur chiffrée dans les résultats types', () => {
  const ids = B.metiers.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.length >= 9);
  for (const m of B.metiers) {
    assert.ok(m.types.length >= 5, m.id);
    assert.ok(m.motsCles.length >= 8, m.id);
    assert.ok(m.resultats.length >= 5, m.id);
    for (const r of m.resultats) assert.ok(!/\d/.test(r), `${m.id} : « ${r} » ne doit pas contenir de valeur`);
    for (const q of ['contexte', 'mission', 'resultat']) assert.ok(m.questions[q]?.length > 20, `${m.id}.${q}`);
  }
  assert.equal(B.secteurs.length, 12);
  assert.equal(new Set(B.secteurs.map((s) => s.id)).size, 12);
  assert.ok(B.tailles.every((t) => t.phrase && t.nom));
  assert.deepEqual(simple(B.modeles.map((m) => m.id)), ['plaquette', 'fiches', 'liste']);
  assert.deepEqual(simple(B.accents.map((a) => a.id)), ['bleu', 'rouge', 'jaune', 'encre']);
  assert.equal(B.questionsTemoignage.length, 5);
  // Aucune marque ni référence réelle : la démo et la base ne citent que des noms « Exemple ».
  const texte = readFileSync(new URL('donnees.js', dossier), 'utf8') + readFileSync(new URL('app.js', dossier), 'utf8');
  for (const nom of texte.match(/nom: '([^']+)'/g) || []) assert.ok(!/SARL|SAS\b|Inc\b/.test(nom), nom);
});

test('textes : mots-clés uniques sans casse ni accents, comptage des mots, périodes lisibles', () => {
  assert.deepEqual(simple(R.lireMotsCles('Rénovation, renovation ; Cuisine\n cuisine ,  , Isolation  thermique')), ['Rénovation', 'Cuisine', 'Isolation thermique']);
  assert.equal(R.lireMotsCles(Array.from({ length: 20 }, (_, i) => `m${i}`)).length, 12);
  assert.equal(R.nbMots('  un   deux trois '), 3);
  assert.equal(R.cleTexte('  Économies  d’énergie '), 'economies d energie');
  assert.equal(R.periode({ debut: '2025-03', fin: '2025-06' }), 'mars → juin 2025');
  assert.equal(R.periode({ debut: '2024-11', fin: '2025-02' }), 'novembre 2024 → février 2025');
  assert.equal(R.periode({ debut: '2025-03', fin: '2025-03' }), 'mars 2025');
  assert.equal(R.periode({ debut: '2025-03', fin: '' }), 'depuis mars 2025');
  assert.equal(R.periode({ debut: '', fin: '' }), '');
  assert.equal(R.annee({ debut: '2023-10', fin: '2024-01' }), '2024');
  assert.equal(R.annee({ debut: '2023-10', fin: '' }), '2023');
  assert.equal(R.ajoutMois('2025-01', -2), '2024-11');
  assert.equal(R.ecartMois('2024-11', '2025-11'), 12);
});

test('client affiché : nom seulement avec accord et option, description sinon, jamais vide', () => {
  const p = P({ client: { nom: 'Exemple SA', accord: false, secteur: 'industrie', taille: 'pe', region: 'Bretagne' } });
  assert.equal(R.clientAffiche(p, B), 'Une entreprise de 10 à 49 salariés · Industrie · Bretagne');
  p.client.accord = true;
  assert.equal(R.clientAffiche(p, B), 'Exemple SA');
  assert.equal(R.clientAffiche(p, B, { ...R.OPTIONS_DEFAUT, nomsClients: false }), 'Une entreprise de 10 à 49 salariés · Industrie · Bretagne');
  assert.equal(R.clientAffiche(P({ client: { secteur: 'sante' } }), B), 'Client · Santé et médico-social');
  assert.equal(R.clientAffiche(P({ client: { nom: '', accord: true } }), B), 'Client confidentiel');
  assert.equal(R.clientAffiche(P(), B), 'Client confidentiel');
});

test('témoignage et montant : imprimés seulement avec accord et option', () => {
  const p = P({ temoignage: { texte: 'Très bien.', auteur: 'Gérant', accord: false }, montant: '12 000 € HT', afficherMontant: true });
  assert.equal(R.temoignageVisible(p), false);
  p.temoignage.accord = true;
  assert.equal(R.temoignageVisible(p), true);
  assert.equal(R.temoignageVisible(p, { ...R.OPTIONS_DEFAUT, temoignages: false }), false);
  assert.equal(R.montantVisible(p), false, 'montants masqués par défaut dans une sélection');
  assert.equal(R.montantVisible(p, { ...R.OPTIONS_DEFAUT, montants: true }), true);
  p.afficherMontant = false;
  assert.equal(R.montantVisible(p, { ...R.OPTIONS_DEFAUT, montants: true }), false);
});

test('complétude : pondérations, total 100, niveaux', () => {
  assert.equal(R.CRITERES.reduce((t, c) => t + c[1], 0), 100);
  const vide = R.completude(P());
  assert.equal(vide.score, 0);
  assert.equal(vide.niveau, 'brouillon');
  assert.equal(vide.manques.length, R.CRITERES.length);
  const complet = P({
    titre: 'Délai divisé par trois', client: { secteur: 'btp' }, contexte: MOTS15, mission: MOTS15,
    resultats: [{ valeur: '÷3', libelle: 'délai' }], debut: '2025-01', motsCles: ['a', 'b'],
    temoignage: { texte: 'Bien', accord: true }, visuel: 'data:image/png;base64,AAAA',
  });
  assert.equal(R.completude(complet).score, 100);
  assert.equal(R.completude(complet).niveau, 'pret');
  // Un résultat sans chiffre ne compte pas comme résultat chiffré.
  const sansChiffre = P({ ...complet, resultats: [{ valeur: 'beaucoup', libelle: 'mieux' }] });
  assert.equal(R.completude(sansChiffre).score, 80);
  assert.ok(R.completude(sansChiffre).manques.some((m) => m.id === 'resultat'));
  // Contexte trop court : 14 mots.
  const court = P({ ...complet, contexte: MOTS15.split(' ').slice(0, 14).join(' ') });
  assert.equal(R.completude(court).score, 85);
  assert.equal(R.completude(P({ titre: 'Titre', contexte: MOTS15, mission: MOTS15, resultats: [{ valeur: '3' }] })).niveau, 'correct');
});

test('alertes de confidentialité : nom sans accord, témoignage sans accord, coordonnées, montant', () => {
  const ids = (p) => R.alertes(p).map((a) => a.id);
  assert.deepEqual(simple(ids(P({ titre: 'Rien à signaler' }))), []);
  assert.ok(ids(P({ client: { nom: 'Exemple', accord: false } })).includes('nom-sans-accord'));
  assert.ok(!ids(P({ client: { nom: 'Exemple', accord: true } })).includes('nom-sans-accord'));
  assert.ok(ids(P({ temoignage: { texte: 'Super', accord: false } })).includes('temoignage-sans-accord'));
  assert.ok(ids(P({ mission: 'Contact : jean.exemple@exemple.fr' })).includes('coordonnees'));
  assert.ok(ids(P({ contexte: 'Appeler le 06 12 34 56 78' })).includes('coordonnees'));
  assert.ok(ids(P({ temoignage: { texte: 'Joignable au +33 6 12 34 56 78', accord: true } })).includes('coordonnees'));
  assert.ok(!ids(P({ mission: '120 bénévoles, 2 000 m², budget 15 000 €' })).includes('coordonnees'), 'des chiffres ordinaires ne sont pas un téléphone');
  assert.ok(ids(P({ montant: '5 k€', afficherMontant: true })).includes('montant'));
  assert.ok(ids(P({ resultats: [{ valeur: 'net', libelle: 'mieux' }] })).includes('resultat-sans-chiffre'));
});

const jeu = () => [
  P({ id: 'a', titre: 'Salle de bains', type: 'Salle de bains', client: { secteur: 'particuliers' }, debut: '2025-01', fin: '2025-02', motsCles: ['rénovation', 'salle de bains'], resultats: [{ valeur: '6 m²', libelle: 'rénovés' }] }),
  P({ id: 'b', titre: 'Cuisine ouverte', type: 'Cuisine', client: { secteur: 'particuliers' }, debut: '2023-05', fin: '2023-06', motsCles: ['Rénovation', 'cuisine'], temoignage: { texte: 'Parfait', accord: true }, avant: true }),
  P({ id: 'c', titre: 'Bureaux réaménagés', type: 'Rénovation complète', client: { secteur: 'services' }, debut: '2024-09', fin: '2024-12', motsCles: ['bureaux'], mission: 'Isolation des combles et électricité refaite.' }),
];

test('filtres et tri : mises en avant d’abord, recherche sans accents, combinaisons', () => {
  const ps = jeu();
  assert.deepEqual(simple(R.filtrer(ps).map((p) => p.id)), ['b', 'a', 'c']);
  assert.deepEqual(simple(R.filtrer(ps, { motCle: 'renovation' }).map((p) => p.id)), ['b', 'a']);
  assert.deepEqual(simple(R.filtrer(ps, { secteur: 'services' }).map((p) => p.id)), ['c']);
  assert.deepEqual(simple(R.filtrer(ps, { annee: '2025' }).map((p) => p.id)), ['a']);
  assert.deepEqual(simple(R.filtrer(ps, { chiffre: true }).map((p) => p.id)), ['a']);
  assert.deepEqual(simple(R.filtrer(ps, { temoignage: true }).map((p) => p.id)), ['b']);
  assert.deepEqual(simple(R.filtrer(ps, { q: 'ELECTRICITE combles' }, B).map((p) => p.id)), ['c']);
  assert.deepEqual(simple(R.filtrer(ps, { q: 'cuisine', secteur: 'services' }).map((p) => p.id)), []);
  assert.equal(R.filtrer(ps, { aCompleter: true }).length, 3);
  assert.deepEqual(simple(R.motsCles(ps)), [{ mot: 'rénovation', n: 2 }, { mot: 'bureaux', n: 1 }, { mot: 'cuisine', n: 1 }, { mot: 'salle de bains', n: 1 }]);
  assert.deepEqual(simple(R.annees(ps)), ['2025', '2024', '2023']);
});

test('pertinence pour un prospect : secteur, type, mots-clés, texte, récence, raisons', () => {
  const [a, b, c] = jeu();
  const crit = { secteur: 'particuliers', type: 'Cuisine', motsCles: ['rénovation', 'cuisine', 'électricité'] };
  const pb = R.pertinence(b, crit, '2025-03');
  // secteur 30 + type 15 + 2 mots-clés 30 + témoignage 4 + mise en avant 2 ; 22 mois → récence 2.
  assert.equal(pb.score, 83);
  assert.ok(pb.raisons.includes('même secteur'));
  assert.ok(pb.raisons.some((r) => r.startsWith('mots-clés : rénovation, cuisine')));
  const pa = R.pertinence(a, crit, '2025-03');
  assert.equal(pa.score, 30 + 15 + 5 + 4); // secteur, 1 mot-clé, résultat chiffré, récente
  const pc = R.pertinence(c, crit, '2025-03');
  assert.equal(pc.score, 10 + 4); // « rénovation » (type) et « électricité » (mission) cités dans le texte, récente
  assert.ok(pc.raisons.includes('cité dans le texte : rénovation, électricité'));
  assert.equal(R.pertinence(c, {}, null).score, 0);
  const s = R.suggerer(jeu(), crit, '2025-03', ['a']);
  assert.deepEqual(simple(s.map((x) => x.p.id)), ['b', 'c']);
  // Le score est borné à 100.
  const max = P({ client: { secteur: 'x' }, type: 't', motsCles: ['a', 'b', 'c', 'd'], resultats: [{ valeur: '1' }], temoignage: { texte: 'x', accord: true }, fin: '2025-01', avant: true });
  assert.equal(R.pertinence(max, { secteur: 'x', type: 'T', motsCles: 'a, b, c, d' }, '2025-02').score, 100);
});

test('sélection : ordre, références supprimées ignorées, sélection par défaut, pages A4', () => {
  assert.deepEqual(simple(R.deplacer(['a', 'b', 'c'], 'c', -1)), ['a', 'c', 'b']);
  assert.deepEqual(simple(R.deplacer(['a', 'b', 'c'], 'a', -1)), ['a', 'b', 'c']);
  assert.deepEqual(simple(R.deplacer(['a', 'b', 'c'], 'z', 1)), ['a', 'b', 'c']);
  const E = R.normaliser({ projets: jeu(), selections: [{ id: 's', nom: 'Prospect', projets: ['c', 'zz', 'a', 'c'] }] });
  assert.deepEqual(simple(E.selections[0].projets), ['c', 'a'], 'identifiant inconnu retiré, doublon retiré');
  assert.deepEqual(simple(R.projetsSelection(E, { projets: ['a', 'disparu', 'b'] }).map((p) => p.id)), ['a', 'b']);
  assert.deepEqual(simple(R.selectionParDefaut(E).projets), ['b']);
  E.projets.forEach((p) => { p.avant = false; });
  assert.deepEqual(simple(R.selectionParDefaut(E).projets), ['a', 'c', 'b'], 'sans mise en avant : les plus récentes');
  const ids = ['1', '2', '3', '4', '5'];
  assert.deepEqual(simple(R.pagesPlaquette(ids, 'plaquette')).map((p) => p.type), ['couverture', 'refs', 'refs', 'refs']);
  assert.deepEqual(simple(R.pagesPlaquette(ids, 'plaquette')[3].refs), ['5']);
  assert.equal(R.pagesPlaquette(ids, 'fiches').length, 5);
  assert.equal(R.pagesPlaquette(ids, 'fiches')[0].premiere, true);
  assert.equal(R.pagesPlaquette(Array.from({ length: 15 }, (_, i) => String(i)), 'liste').length, 2);
  assert.equal(R.pagesPlaquette([], 'liste').length, 1);
  assert.equal(R.pagesPlaquette([], 'plaquette').length, 1);
});

test('textes à copier : référence, sélection, demande de témoignage', () => {
  const p = P({ titre: 'Cuisine', type: 'Cuisine', client: { nom: 'Famille Exemple', accord: false, secteur: 'particuliers', taille: 'particulier' }, debut: '2025-01', fin: '2025-02', contexte: 'Cuisine fermée.', mission: 'Cloison abattue.', resultats: [{ valeur: '+8 m²', libelle: 'de pièce de vie' }], temoignage: { texte: 'Merci', auteur: 'Les propriétaires', accord: true }, montant: '9 000 €', afficherMontant: true });
  const t = R.texteReference(p, B);
  assert.ok(t.startsWith('Cuisine\nUn particulier · Cuisine · janvier → février 2025'), t);
  assert.equal(R.descriptionClient({ taille: 'association', secteur: 'associations', region: 'Bretagne' }, B), 'Une association · Bretagne');
  assert.ok(!t.includes('Famille Exemple'));
  assert.ok(!t.includes('9 000'));
  assert.ok(t.includes('- +8 m² de pièce de vie'));
  assert.ok(t.includes('« Merci » (Les propriétaires)'));
  const E = R.normaliser({ profil: { nom: 'Atelier Exemple', coordonnees: 'contact@exemple.fr' }, projets: [p], selections: [{ id: 's', intro: 'Bonjour,', projets: [p.id], options: { montants: true } }] });
  const ts = R.texteSelection(E, E.selections[0], B);
  assert.ok(ts.startsWith('Bonjour,\n\n1. Cuisine'));
  assert.ok(ts.includes('9 000 €'));
  assert.ok(ts.endsWith('Atelier Exemple\ncontact@exemple.fr'));
  const d = R.texteDemandeTemoignage(p, B);
  assert.ok(d.includes('« Cuisine »'));
  assert.ok(d.includes('5. Puis-je citer'));
});

test('visuels : format, poids, nombre et taille totale contrôlés', () => {
  const petit = 'data:image/jpeg;base64,' + 'A'.repeat(4000);
  const lourd = 'data:image/jpeg;base64,' + 'A'.repeat(Math.ceil(R.MAX_VISUEL * 4 / 3) + 8);
  const E = R.normaliser({ projets: [{ id: 'x' }] });
  assert.equal(R.refusVisuel(E, 'x', petit), null);
  assert.match(R.refusVisuel(E, 'x', 'data:text/html;base64,AAAA'), /Format/);
  assert.match(R.refusVisuel(E, 'x', lourd), /trop lourde/);
  E.projets = Array.from({ length: R.MAX_VISUELS }, (_, i) => P({ id: `p${i}`, visuel: petit }));
  E.projets.push(P({ id: 'nouveau' }));
  assert.match(R.refusVisuel(E, 'nouveau', petit), /au plus/);
  assert.equal(R.refusVisuel(E, 'p0', petit), null, 'remplacer un visuel existant reste possible');
  // Normalisation : visuel invalide ou trop lourd retiré, légende retirée avec lui.
  assert.equal(P({ visuel: 'javascript:alert(1)', legende: 'x' }).visuel, '');
  assert.equal(P({ visuel: 'javascript:alert(1)', legende: 'x' }).legende, '');
  assert.equal(P({ visuel: lourd }).visuel, '');
  assert.equal(R.octetsDataUrl('data:image/png;base64,AAAA'), 3);
  // Taille totale : au-delà de la limite, refus.
  const gros = R.normaliser({ projets: [{ id: 'g', contexte: 'x'.repeat(1500) }] });
  for (let i = 0; i < 600; i++) gros.projets.push(P({ id: `t${i}`, contexte: 'x'.repeat(1500) }));
  assert.match(R.refusVisuel(gros, 'g', petit), /presque plein/);
});

test('couverture générée stable, statistiques, duplication', () => {
  const p = P({ id: 'abc', type: 'Cuisine' });
  assert.deepEqual(simple(R.couverture(p, B)), simple(R.couverture(P({ id: 'abc', type: 'cuisine' }), B)));
  assert.ok(B.accents.some((a) => a.id === R.couverture(p, B).accent));
  assert.ok(B.formes.includes(R.couverture(p, B).forme));
  const E = R.normaliser({ projets: jeu() });
  const st = R.statistiques(E);
  assert.equal(st.total, 3);
  assert.equal(st.chiffres, 1);
  assert.equal(st.temoignages, 1);
  assert.equal(st.secteurs, 2);
  assert.equal(st.depuis, '2023');
  const d = R.dupliquer(E.projets[1]);
  assert.notEqual(d.id, E.projets[1].id);
  assert.equal(d.titre, 'Cuisine ouverte (copie)');
  assert.equal(d.avant, false);
});

test('normalisation tolérante et export CSV', () => {
  const E = R.normaliser({ profil: { accent: 'violet', chiffres: [{ valeur: '8 ans', libelle: 'expérience' }, {}, {}, {}, { valeur: '5' }] }, projets: [{ id: 'a', debut: '2025-13', resultats: [{}, { valeur: '1' }, { valeur: '2' }, { valeur: '3' }, { valeur: '4' }, { valeur: '5' }] }, { id: 'a' }], selections: [{ modele: 'inconnu', options: { montants: 'oui' } }] });
  assert.equal(E.profil.accent, 'bleu');
  assert.equal(E.profil.chiffres.length, 2);
  assert.equal(E.projets[0].debut, '');
  assert.equal(E.projets[0].resultats.length, R.MAX_RESULTATS);
  assert.notEqual(E.projets[0].id, E.projets[1].id, 'identifiants en double renommés');
  assert.equal(E.selections[0].modele, 'plaquette');
  assert.equal(E.selections[0].options.montants, false);
  assert.deepEqual(simple(R.normaliser(null)), simple(R.etatVide()));
  const csv = R.versCsv(R.normaliser({ projets: [{ titre: 'Titre; avec "guillemets"', client: { nom: 'Exemple', accord: false, secteur: 'btp' }, motsCles: ['a', 'b'] }] }), B);
  assert.ok(csv.startsWith('﻿Titre;Type de mission'));
  assert.ok(csv.includes('"Titre; avec ""guillemets"""'));
  assert.ok(csv.includes(';Exemple;non;Client · BTP et immobilier;BTP et immobilier;'));
  assert.ok(csv.includes(';a, b;'));
});
