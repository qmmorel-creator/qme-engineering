// Tests des règles métier du suivi des appels d'offres et candidatures (templates/appels-offres/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/appels-offres/', import.meta.url);
globalThis.window = {};
vm.runInThisContext(readFileSync(new URL('donnees.js', dossier), 'utf8'));
vm.runInThisContext(readFileSync(new URL('regles.js', dossier), 'utf8'));
const R = globalThis.window.CND_REGLES;
const B = globalThis.window.BASE;

const consultation = (o = {}) => ({ id: 'c1', titre: 'Formation des encadrants', acheteur: 'Acheteur Exemple', type: 'public', reperee: '2026-11-02',
  dateLimite: '2026-11-20', heureLimite: '12:00', notes: {}, statut: 'reperee', pieces: [], relances: [], temps: 0, ...o });

test('base intégrée : statuts, types, grille, modèles et pièces cohérents, sans référence réglementaire datée', () => {
  assert.equal(B.statuts.length, 8);
  for (const t of B.types) {
    assert.ok(B.modeles.some((m) => m.id === t.modele), `modèle ${t.modele}`);
    assert.ok(Number.isInteger(t.relance) && t.relance > 0);
  }
  assert.equal(B.criteres.length, 8);
  assert.equal(new Set(B.criteres.map((c) => c.id)).size, 8);
  assert.ok(B.criteres.filter((c) => c.eliminatoire).length >= 2);
  const typesPieces = new Set(B.typesPieces.map((t) => t.id));
  for (const m of B.modeles) for (const p of m.pieces) {
    assert.ok(Number.isInteger(p.delai) && p.delai >= 0 && p.delai <= 30, `${m.id} : ${p.libelle}`);
    if (p.type) assert.ok(typesPieces.has(p.type), `type ${p.type}`);
  }
  // Aucune référence à un article, un décret, un formulaire officiel numéroté ni une année de texte.
  const texte = JSON.stringify(B);
  assert.ok(!/\b(article|décret|arrêté|code de la commande|DC ?[1-4]|ATTRI|\bR\.? ?2\d{3})/i.test(texte), 'pas de référence réglementaire');
  assert.ok(!/\b20\d\d\b/.test(texte), 'aucune année en base');
  assert.ok(B.modeles.find((m) => m.id === 'public').description.includes('règlement de la consultation'));
});

test('dates : jours, lundi, échéance avancée au vendredi si week-end', () => {
  assert.equal(R.plusJours('2026-10-30', 3), '2026-11-02');
  assert.equal(R.plusJours('2026-03-28', 2), '2026-03-30');
  assert.equal(R.jourSemaine('2026-11-16'), 0); // lundi
  assert.equal(R.lundi('2026-11-15'), '2026-11-09');
  assert.equal(R.ouvreAvant('2026-11-14'), '2026-11-13'); // samedi → vendredi
  assert.equal(R.ouvreAvant('2026-11-15'), '2026-11-13'); // dimanche → vendredi
  assert.equal(R.ouvreAvant('2026-11-16'), '2026-11-16');
});

test('grille go/no-go : score pondéré, seuils, éliminatoire, grille partielle', () => {
  const C = B.criteres;
  const tout = (n) => Object.fromEntries(C.map((c) => [c.id, n]));
  assert.deepEqual(R.scoreGrille(C, {}), { pct: null, notes: 0, total: 8, complet: false, eliminatoires: [], recommandation: null });
  assert.equal(R.scoreGrille(C, tout(3)).pct, 100);
  assert.equal(R.scoreGrille(C, tout(3)).recommandation, 'go');
  assert.equal(R.scoreGrille(C, tout(2)).pct, 67); // 2/3
  assert.equal(R.scoreGrille(C, tout(2)).recommandation, 'go');
  assert.equal(R.scoreGrille(C, tout(1)).pct, 33);
  assert.equal(R.scoreGrille(C, tout(1)).recommandation, 'nogo');
  // 50 % : à discuter avec les seuils par défaut, no-go avec un seuil plus exigeant.
  const moitie = { ...tout(2), metier: 1, capacite: 1, temps: 2, references: 1, rentabilite: 2, chances: 1, client: 3, strategie: 1 };
  const s = R.scoreGrille(C, moitie);
  assert.equal(s.pct, Math.round((1 * 3 + 1 * 3 + 2 * 2 + 1 * 2 + 2 * 2 + 1 * 2 + 3 + 1) / 48 * 100));
  assert.equal(s.recommandation, 'discuter');
  assert.equal(R.scoreGrille(C, moitie, { go: 80, discuter: 60 }).recommandation, 'nogo');
  // Un critère éliminatoire à 0 donne un no-go, même avec un bon score et une grille incomplète.
  const elim = R.scoreGrille(C, { ...tout(3), temps: 0 });
  assert.equal(elim.recommandation, 'nogo');
  assert.deepEqual(elim.eliminatoires, ['temps']);
  assert.equal(R.scoreGrille(C, { capacite: 0 }).recommandation, 'nogo');
  // Partielle sans éliminatoire : score affiché, pas de recommandation.
  const part = R.scoreGrille(C, { metier: 3, references: 1 });
  assert.equal(part.pct, Math.round((9 + 2) / 15 * 100));
  assert.equal(part.recommandation, null);
  // Poids 0 : critère ignoré.
  const sansStrategie = C.map((c) => (c.id === 'strategie' ? { ...c, poids: 0 } : c));
  assert.equal(R.scoreGrille(sansStrategie, { ...tout(3), strategie: 0 }).pct, 100);
});

test('décision : go crée les pièces du modèle, no-go clôt avec le motif, sans modifier l\'original', () => {
  const c = consultation();
  const go = R.decider(c, 'go', { date: '2026-11-03', modele: B.modeles[0] });
  assert.equal(go.statut, 'preparation');
  assert.equal(go.pieces.length, B.modeles[0].pieces.length);
  assert.deepEqual(go.pieces[0], { id: 'pc1', libelle: B.modeles[0].pieces[0].libelle, delai: 14, type: null, statut: 'afaire', responsable: '', biblio: null, echeance: null });
  assert.equal(c.statut, 'reperee');
  assert.equal(c.pieces.length, 0);
  const deja = R.decider({ ...c, pieces: [{ id: 'x', libelle: 'Pièce', delai: 1, statut: 'pret' }] }, 'go', { date: '2026-11-03', modele: B.modeles[0] });
  assert.equal(deja.pieces.length, 1, 'pièces existantes gardées');
  const non = R.decider(c, 'nogo', { date: '2026-11-03', motif: 'Hors métier' });
  assert.equal(non.statut, 'nogo');
  assert.deepEqual(non.decision, { choix: 'nogo', date: '2026-11-03', motif: 'Hors métier' });
  assert.ok(R.estFini(non) && !R.estGo(non));
});

test('rétroplanning : échéance à rebours, avancée au vendredi, date fixée à la main, dépôt visé', () => {
  const lim = '2026-11-20'; // vendredi
  assert.equal(R.echeancePiece({ delai: 0 }, lim), lim);
  assert.equal(R.echeancePiece({ delai: 3 }, lim), '2026-11-17');
  assert.equal(R.echeancePiece({ delai: 6 }, lim), '2026-11-13'); // samedi 14 → vendredi 13
  assert.equal(R.echeancePiece({ delai: 7 }, lim), '2026-11-13'); // dimanche 13 → vendredi 13
  assert.equal(R.echeancePiece({ delai: 4, echeance: '2026-11-18' }, lim), '2026-11-18');
  assert.equal(R.echeancePiece({ delai: 4 }, ''), null);
  assert.equal(R.depotVise({ dateLimite: lim }, 1), '2026-11-19');
  assert.equal(R.depotVise({ dateLimite: lim }, 0), lim);
  assert.equal(R.depotVise({ dateLimite: '2026-11-16' }, 1), '2026-11-15', 'le dépôt visé n\'est pas avancé au vendredi');
  assert.equal(R.depotVise({ dateLimite: '' }, 1), null);
});

test('état des pièces et de la bibliothèque : retard, bientôt, prête, sans objet, validité', () => {
  const biblio = [
    { id: 'b1', valideJusquau: '2026-11-18' }, // expire avant la date limite
    { id: 'b2', valideJusquau: '2026-11-05' }, // déjà expirée
    { id: 'b3', valideJusquau: '2027-01-31' },
    { id: 'b4', valideJusquau: '' },
  ];
  const c = consultation({ statut: 'preparation' });
  const t = '2026-11-10';
  assert.equal(R.etatPiece({ delai: 14, statut: 'afaire' }, c, t, biblio).etat, 'retard');
  assert.equal(R.etatPiece({ delai: 14, statut: 'afaire' }, c, t, biblio).retard, 4); // échéance 06/11
  assert.equal(R.etatPiece({ delai: 9, statut: 'afaire' }, c, t, biblio).etat, 'bientot'); // 11/11
  assert.equal(R.etatPiece({ delai: 3, statut: 'encours' }, c, t, biblio).etat, 'encours');
  assert.equal(R.etatPiece({ delai: 3, statut: 'afaire' }, c, t, biblio).etat, 'afaire');
  assert.equal(R.etatPiece({ delai: 14, statut: 'pret' }, c, t, biblio).etat, 'pret');
  assert.equal(R.etatPiece({ delai: 14, statut: 'sansobjet' }, c, t, biblio).etat, 'sansobjet');
  assert.equal(R.etatPiece({ delai: 3, statut: 'pret', biblio: 'b1' }, c, t, biblio).alerte, 'expire-avant');
  assert.equal(R.etatPiece({ delai: 3, statut: 'pret', biblio: 'b2' }, c, t, biblio).alerte, 'expiree');
  assert.equal(R.etatPiece({ delai: 3, statut: 'pret', biblio: 'b3' }, c, t, biblio).alerte, null);
  assert.equal(R.etatPiece({ delai: 3, statut: 'pret', biblio: 'b4' }, c, t, biblio).alerte, null);
  assert.deepEqual(R.etatBiblio(biblio[0], t, 30), { etat: 'bientot', jours: 8 });
  assert.deepEqual(R.etatBiblio(biblio[1], t, 30), { etat: 'expiree', jours: -5 });
  assert.equal(R.etatBiblio(biblio[2], t, 30).etat, 'valide');
  assert.equal(R.etatBiblio(biblio[3], t, 30).etat, 'sansdate');
  assert.equal(R.etatBiblio(null, t), null);
  const av = R.avancement({ pieces: [{ statut: 'pret' }, { statut: 'afaire' }, { statut: 'sansobjet' }, { statut: 'pret' }] });
  assert.deepEqual(av, { prets: 2, utiles: 3, pct: 67 });
  assert.deepEqual(R.avancement({ pieces: [] }), { prets: 0, utiles: 0, pct: 0 });
});

test('dépôt, relances et résultat', () => {
  let c = R.decider(consultation(), 'go', { date: '2026-11-03', modele: B.modeles[2] });
  c = R.deposer(c, { date: '2026-11-19', delaiRelance: 30, montantOffre: '12500' });
  assert.equal(c.statut, 'deposee');
  assert.equal(c.depot, '2026-11-19');
  assert.equal(c.relancerLe, '2026-12-19');
  assert.equal(c.montantOffre, 12500);
  assert.ok(R.estDepose(c));
  c = R.noterRelance(c, { date: '2026-12-21', note: 'Analyse en cours', intervalle: 15 });
  assert.equal(c.relances.length, 1);
  assert.equal(c.relancerLe, '2027-01-05');
  const g = R.cloturer(c, 'gagnee', { date: '2027-01-10', montant: '11800' });
  assert.deepEqual(g.resultat, { date: '2027-01-10', montant: 11800 });
  assert.equal(g.relancerLe, null);
  const p = R.cloturer(c, 'perdue', { date: '2027-01-10', rang: '2' });
  assert.deepEqual(p.resultat, { date: '2027-01-10', motif: 'inconnu', rang: 2 });
  assert.equal(R.cloturer(c, 'perdue', { date: '2027-01-10', motif: 'prix' }).resultat.motif, 'prix');
  assert.equal(R.ajouterTemps(1, 0.5), 1.5);
  assert.equal(R.ajouterTemps(0.25, -1), 0);
  assert.equal(R.ajouterTemps('2,5'.replace(',', '.'), 0.1), 2.5); // arrondi au quart d'heure
});

test('à faire : décisions, questions, pièces, dépôt, relances, validité et bibliothèque, retards en tête', () => {
  const t = '2026-11-10';
  const prep = R.decider(consultation({ id: 'p', dateLimite: '2026-11-13' }), 'go', { date: '2026-11-01', modele: { pieces: [{ libelle: 'A', delai: 5 }, { libelle: 'B', delai: 1 }, { libelle: 'C', delai: 0 }] } });
  prep.pieces[2].statut = 'pret';
  const veille = consultation({ id: 'v', dateLimite: '2026-11-25', dateQuestions: '2026-11-15' });
  const dep = { ...consultation({ id: 'd', statut: 'deposee', depot: '2026-10-01', relancerLe: '2026-11-08', offreValable: '2026-11-16' }) };
  const vieille = consultation({ id: 'x', dateLimite: '2026-11-01' }); // date passée : plus de décision proposée
  const loin = consultation({ id: 'l', dateLimite: '2026-12-30' });
  const biblio = [{ id: 'b1', titre: 'Assurance', valideJusquau: '2026-11-30' }, { id: 'b2', titre: 'Fiscale', valideJusquau: '2026-11-01' }, { id: 'b3', titre: 'CV', valideJusquau: '' }];
  const items = R.aFaire([prep, veille, dep, vieille, loin], biblio, t, { horizon: 7, marge: 1, delaiDecision: 7, seuilBiblio: 30 });
  const resume = items.map((x) => `${x.genre}:${x.c?.id || x.b.id}:${x.date}:${x.retard}`);
  assert.deepEqual(resume, [
    'biblio:b2:2026-11-01:9', // expirée depuis 9 jours
    'piece:p:2026-11-06:4', // A : 13/11 − 5 = dimanche 08/11 → vendredi 06/11
    'relance:d:2026-11-08:2',
    'depot:p:2026-11-12:0', // date limite moins un jour de marge
    'piece:p:2026-11-12:0', // B
    'questions:v:2026-11-15:0',
    'validite:d:2026-11-16:0',
    'biblio:b1:2026-11-30:0', // moins de 30 jours de validité
  ]);
  // Contrôles explicites.
  assert.equal(items[1].piece.libelle, 'A');
  assert.ok(items.slice(0, 3).every((x) => x.retard > 0) && items.slice(3).every((x) => !x.retard), 'retards en tête');
  assert.ok(!items.some((x) => x.c?.id === 'x' || x.c?.id === 'l'), 'consultation passée ou lointaine absente');
  // Décision à prendre 7 jours avant la date limite (25/11 → 18/11) : hors de l'horizon de 7 jours, puis dedans.
  assert.ok(!items.some((x) => x.genre === 'decision'));
  const plus = R.aFaire([veille, vieille], [], t, { horizon: 8, delaiDecision: 7 });
  assert.deepEqual(plus.map((x) => `${x.genre}:${x.date}`), ['questions:2026-11-15', 'decision:2026-11-18']);
  const urgente = R.aFaire([consultation({ dateLimite: '2026-11-12' })], [], t, { delaiDecision: 7 });
  assert.equal(urgente[0].date, t, 'décision en retard ramenée à aujourd\'hui');
  assert.ok(items.some((x) => x.genre === 'depot' && x.date === '2026-11-12'));
  assert.ok(items.some((x) => x.genre === 'validite' && x.date === '2026-11-16'));
  assert.ok(items.some((x) => x.genre === 'biblio' && x.b.id === 'b1'));
  assert.ok(!items.some((x) => x.genre === 'biblio' && x.b.id === 'b3'));
  assert.ok(!items.some((x) => x.genre === 'piece' && x.piece.libelle === 'C'), 'pièce prête absente');
  // Regroupement des pièces par dossier.
  const g = R.regrouperPieces(items);
  const pieces = g.filter((x) => x.genre === 'pieces');
  assert.equal(pieces.length, 1);
  assert.equal(pieces[0].pieces.length, 2);
  assert.equal(pieces[0].retards, 1);
  assert.equal(pieces[0].retard, 4);
  assert.equal(g.length, items.length - 1);
});

test('calendrier : grille du mois du lundi au dimanche, événements des consultations en cours', () => {
  const g = R.grilleMois('2026-11');
  assert.equal(g[0][0], '2026-10-26');
  assert.equal(g.at(-1)[6], '2026-12-06');
  assert.equal(g.length, 6);
  assert.equal(R.grilleMois('2027-02').length, 4); // février 2027 commence un lundi
  assert.equal(R.moisSuivant('2026-12', 1), '2027-01');
  assert.equal(R.moisSuivant('2026-01', -1), '2025-12');
  const ev = R.evenements([
    consultation({ id: 'a', statut: 'preparation', dateLimite: '2026-11-20', dateQuestions: '2026-11-12' }),
    consultation({ id: 'b', statut: 'deposee', dateLimite: '2026-11-05', relancerLe: '2026-11-25' }),
    consultation({ id: 'c', statut: 'gagnee', dateLimite: '2026-11-10' }),
  ], '2026-11-01', '2026-11-30', 1);
  assert.deepEqual(ev.map((x) => `${x.date}:${x.genre}:${x.c.id}`), ['2026-11-12:questions:a', '2026-11-19:depot:a', '2026-11-20:limite:a', '2026-11-25:relance:b']);
});

test('statistiques : taux de go, de réussite, montants, temps, par type, par motif, par mois', () => {
  const L = [
    { type: 'public', statut: 'gagnee', reperee: '2026-03-01', depot: '2026-03-20', resultat: { date: '2026-05-02', montant: 20000 }, temps: 10 },
    { type: 'public', statut: 'perdue', reperee: '2026-04-01', depot: '2026-04-20', resultat: { date: '2026-06-01', motif: 'prix' }, temps: 8 },
    { type: 'plateforme', statut: 'gagnee', reperee: '2026-09-01', depot: '2026-09-02', montantOffre: 5000, resultat: { date: '2026-09-10' }, temps: 2 },
    { type: 'plateforme', statut: 'perdue', reperee: '2026-10-01', depot: '2026-10-02', resultat: { date: '2026-10-20' }, temps: 1 },
    { type: 'prive', statut: 'sanssuite', reperee: '2026-05-01', depot: '2026-05-15', resultat: { date: '2026-07-01' }, temps: 4 },
    { type: 'prive', statut: 'deposee', reperee: '2026-10-15', depot: '2026-11-01', temps: 5 },
    { type: 'public', statut: 'nogo', reperee: '2026-10-20', temps: 0.5 },
    { type: 'public', statut: 'reperee', reperee: '2026-11-10', temps: 0 },
    { type: 'prive', statut: 'abandon', reperee: '2026-08-01', temps: 2 },
  ];
  const s = R.statistiques(L, { types: B.types, motifs: B.motifsPerte, aujourdhui: '2026-11-14', mois: 12 });
  const g = s.global;
  assert.equal(g.total, 9);
  assert.equal(g.decidees, 8);
  assert.equal(g.go, 7);
  assert.equal(g.nogo, 1);
  assert.equal(g.deposees, 6);
  assert.equal(g.gagnees, 2);
  assert.equal(g.perdues, 2);
  assert.equal(g.sansSuite, 1);
  assert.equal(g.enAttente, 1);
  assert.equal(g.abandons, 1);
  assert.equal(g.tauxGo, 7 / 8);
  assert.equal(g.tauxReussite, 0.5, 'sans suite et en attente exclus');
  assert.equal(g.montantGagne, 25000, 'montant de l\'offre à défaut du montant attribué');
  assert.equal(g.montantMoyen, 12500);
  assert.equal(g.temps, 32.5);
  assert.equal(g.tempsMoyen, 4.6); // 32 h sur 7 go
  assert.equal(g.heuresParGain, 16);
  assert.equal(g.euroParHeure, Math.round(25000 / 32));
  const pub = s.parType.find((x) => x.id === 'public');
  assert.equal(pub.total, 4);
  assert.equal(pub.tauxReussite, 0.5);
  assert.equal(s.parType.find((x) => x.id === 'directe'), undefined, 'type sans consultation absent');
  assert.deepEqual(s.parMotif.map((m) => [m.id, m.n]), [['prix', 1], ['inconnu', 1]]);
  assert.equal(s.parMois.length, 12);
  assert.equal(s.parMois[0].mois, '2025-12');
  assert.equal(s.parMois.at(-1).mois, '2026-11');
  assert.deepEqual(s.parMois.find((m) => m.mois === '2026-09'), { mois: '2026-09', deposees: 1, gagnees: 1, perdues: 0 });
  // Période : seules les consultations repérées depuis la date.
  const r = R.statistiques(L, { depuis: '2026-09-01' }).global;
  assert.equal(r.total, 5);
  assert.equal(r.tauxReussite, 0.5);
  // Aucun résultat : taux nuls plutôt que zéro.
  const vide = R.statistiques([], {}).global;
  assert.equal(vide.tauxReussite, null);
  assert.equal(vide.tauxGo, null);
  assert.equal(vide.euroParHeure, null);
});

test('export CSV : point-virgule, champs protégés, score et avancement', () => {
  const c = R.decider(consultation({ titre: 'Mission « test » ; lot 2', notes: Object.fromEntries(B.criteres.map((k) => [k.id, 3])), temps: 2.5 }), 'go', { date: '2026-11-03', modele: B.modeles[3] });
  c.pieces[0].statut = 'pret';
  const lignes = R.csv([c], B).split('\r\n');
  assert.equal(lignes.length, 2);
  assert.ok(lignes[0].startsWith('Intitulé;Acheteur ou client;Type;Statut'));
  assert.ok(lignes[1].startsWith('"Mission « test » ; lot 2";Acheteur Exemple;Marché public;En préparation'));
  assert.ok(lignes[1].includes(';100;'));
  assert.ok(lignes[1].includes(';2,5;1/5'));
});
