// Vidéo 012 · Budget commun · « Les cadeaux de Noël à deux : moitié-moitié ? »
// Type : paramétrage. Données : démo intégrée du template (couple fictif « Camille et Sami », revenus
// renseignés, répartition par défaut au prorata des revenus).
// Geste réel : nouvelle dépense « Cadeaux de Noël de la famille », 240 €, payée par Sami ; la répartition
// passe à « Égale » puis revient à « Prorata » (part de chacun recalculée en direct), puis la dépense est ajoutée.
// Résultat montré : la part de chacun selon la règle choisie, puis le solde « Sami doit … » recalculé.
// Toutes les valeurs affichées par l'habillage (parts, solde) sont LUES dans l'application réelle.

export const config = {
  nom: '012-budget-commun-regle-par-depense',
  produit: 'BCM', type: 'paramétrage', titre: 'Les cadeaux de Noël à deux : moitié-moitié ?',
  app: '/templates/budget-commun/?demo',
  largeur: 1280, hauteur: 1600,
  marque: 'QME · Budget commun',
  url: 'qm-engineering.fr/templates/budget-commun',
  affiche: 1.0,
  // Musique de la vidéo de présentation QME (« Corporate », litesaturation, licence Pixabay : usage commercial sans attribution).
  musique: { fichier: 'docs/videos/musique/corporate-litesaturation.m4a', bpm: 110, premierTemps: 0.534, debut: 20.170, volume: 0.6 },
};
const T = 60000 / 110; // un temps en ms

const LIBELLE = 'Cadeaux de Noël de la famille';
const MONTANT = '240';
const PAYEUR = 'sam';
const CATEGORIE = 'divers';

const D = 'dialog[open]';
const ONGLET = (vue) => `.onglet[data-vue="${vue}"], [data-action="vue"][data-vue="${vue}"]`;
const TITRE = '.jour-titre h1';
const SOLDE = `${TITRE} mark`;
const NOUVELLE = '.jour-titre [data-action="depense-nouvelle"]';
const M_LIBELLE = `${D} input[name="libelle"]`;
const M_MONTANT = `${D} input[name="montant"]`;
const M_PAYEUR = `${D} select[name="payeur"]`;
const M_CAT = `${D} select[name="categorie"]`;
const MODE = (m) => `${D} .segments label:has(input[value="${m}"])`;
const PARTS = `${D} .participants`;
const BLOC = `${D} fieldset.repartition`;
const QUOTE = (id) => `${D} [data-quote="${id}"]`;
const AJOUTER = `${D} button[value="ok"]`;

export async function preparer(v) {
  const { appli, page } = v;
  await v.fermerDialogues(); // guide d'accueil du premier lancement, hors caméra
  await appli.click('[data-action="vue"][data-vue="soldes"]'); await page.waitForTimeout(400);
  // Contrôle du cas : deux membres, un solde « Sami doit … à Camille », prorata par défaut, revenus différents.
  const titre = await v.lire(TITRE);
  if (!/^Sami doit .+ à Camille\.$/.test(titre)) throw new Error(`Solde de démo inattendu : ${titre}`);
  v.solde0 = await v.lire(SOLDE);
  // Les parts réelles, calculées par l'application dans la vraie fenêtre (puis refermée).
  await appli.click(NOUVELLE); await page.waitForTimeout(300);
  await appli.fill(M_MONTANT, MONTANT); await appli.selectOption(M_PAYEUR, PAYEUR);
  const mode0 = await appli.$eval(`${D} input[name="mode"]:checked`, (i) => i.value);
  await appli.click(MODE('egale')); await page.waitForTimeout(150);
  const egale = [await v.lire(QUOTE('cam')), await v.lire(QUOTE('sam'))];
  await appli.click(MODE('prorata')); await page.waitForTimeout(150);
  const prorata = [await v.lire(QUOTE('cam')), await v.lire(QUOTE('sam'))];
  if (mode0 !== 'prorata' || egale[0] !== egale[1] || prorata[0] === prorata[1]) throw new Error(`Répartition inattendue : ${JSON.stringify({ mode0, egale, prorata })}`);
  // Accroche « l'un gagne moins » : vérifiée sur les parts réelles au prorata (celle du payeur, Sami, est la plus faible).
  const n = (s) => Number(s.replace(/[^\d,]/g, '').replace(',', '.'));
  if (!(n(prorata[1]) < n(prorata[0]))) throw new Error(`Accroche fausse : Sami ne gagne pas moins (${prorata.join(' / ')})`);
  await appli.click(`${D} button[value="annuler"]`); await page.waitForTimeout(300);
  await v.fermerDialogues();
  await v.S('cadrer', null);
  await v.S('fenetre', false);
  await page.waitForTimeout(1500); // fenêtre masquée avant la première image : accroche seule à l'écran
}

export async function jouer(v) {
  const { S, son, pause, appli } = v;
  const temps = (n = 1) => pause(n * T);
  const court = (s) => s.replace(/,00\s*€/, ' €');

  // Accroche (un seul son d'entrée)
  // Accroche retravaillée le 20/11/2026 : le vrai problème (une règle injuste), visible dès la première image.
  son('whoosh', 0.6);
  await S('accroche', ['240_€ de cadeaux,', 'moitié-moitié…', '!alors que l\'un', '!gagne *moins* ?'], 0);
  await pause(2600);
  son('whoosh'); await S('accrocheSortie');
  await S('question', 'Chaque dépense, *sa règle* de partage.');
  await v.temps(); son('whoosh', 0.7); await S('fenetre', true);

  // Le solde de départ
  await v.temps(); son('zoom'); await S('cadrer', TITRE, { max: 2.0, marge: 40 });
  await S('anneau', 's0', SOLDE, { couleur: 'var(--bleu)', etiquette: 'solde actuel', cote: 'dessous', marge: 6 });
  await S('legende', `Sami achète les cadeaux : <b>${MONTANT} €</b>.`);
  await temps(1);
  await S('retirer', 's0');

  // Saisie réelle de la dépense
  await S('suivre', 2.2);
  await v.cliquer(NOUVELLE, { ms: 520 });
  await pause(250);
  await v.saisir(M_LIBELLE, LIBELLE, { ms: 420, rapide: true });
  await v.saisir(M_MONTANT, MONTANT, { ms: 380 });
  await v.viser(M_PAYEUR, { ms: 380 });
  son('clic'); await appli.selectOption(M_PAYEUR, PAYEUR); await pause(150);
  await S('flash', M_PAYEUR, 'var(--jaune)');
  await v.viser(M_CAT, { ms: 360 });
  son('clic'); await appli.selectOption(M_CAT, CATEGORIE); await pause(150);

  // Règle 1 : à parts égales
  await v.temps(); await S('legende', 'À parts égales ?');
  await v.cliquer(MODE('egale'), { ms: 460 });
  await pause(200);
  const e = [await v.lire(QUOTE('cam')), await v.lire(QUOTE('sam'))];
  if (e[0] !== e[1]) throw new Error(`Parts égales inattendues : ${e}`);
  son('dezoom', 0.6); await S('cadrer', BLOC, { max: 2.2, marge: 30 });
  await S('flash', PARTS, 'var(--ciel)');
  await S('legende', `À parts égales : <b>${court(e[0])}</b> chacun.`);
  await temps(2);

  // Règle 2 : au prorata des revenus
  await S('suivre', 2.2);
  await v.cliquer(MODE('prorata'), { ms: 460 });
  await pause(200);
  const p = [await v.lire(QUOTE('cam')), await v.lire(QUOTE('sam'))];
  if (p[0] === p[1] || p[0] === e[0]) throw new Error(`Prorata inattendu : ${p}`);
  son('dezoom', 0.6); await S('cadrer', BLOC, { max: 2.2, marge: 30 });
  await S('flash', PARTS, 'var(--jaune)');
  son('pop'); await S('avantApres', 'qc', QUOTE('cam'), e[0], p[0], { couleur: 'var(--bleu)', cote: 'dessus' });
  await S('avantApres', 'qs', QUOTE('sam'), e[1], p[1], { couleur: 'var(--bleu)', cote: 'dessous' });
  await S('legende', 'Au prorata des revenus : <b>chacun selon ses moyens</b>.');
  await temps(2.5);
  await S('retirer');

  // Ajout de la dépense : le solde suit la règle choisie
  await S('suivre', 2.2);
  await v.cliquer(AJOUTER, { ms: 460 });
  await pause(120);
  son('dezoom', 0.6); await S('cadrer', TITRE, { max: 2.0, marge: 40 });
  const solde1 = await v.lire(SOLDE);
  if (solde1 === v.solde0) throw new Error('Le solde n\'a pas changé.');
  await v.temps();
  await S('flash', SOLDE, 'var(--jaune)');
  son('pop'); await S('avantApres', 's', SOLDE, v.solde0, solde1, { couleur: 'var(--vert)', cote: 'dessous', note: 'solde à jour' });
  son('trait', 0.6); await S('souligner', 'u', SOLDE, 'var(--vert)');
  await S('legende', 'Le solde suit la règle de <b>chaque dépense</b>.');
  await temps(1);
  await v.temps(); son('tampon'); son('ding', 0.7);
  await S('tampon', 'Partagé selon vos règles', `Prorata · Sami doit ${court(solde1)}`, 'var(--vert)');
  await temps(1.8);
  await S('tamponFin'); await S('retirer'); await S('cacherCurseur');

  // Fin
  await v.temps(); son('whoosh'); await S('volet');
  await S('legende', null);
  await S('outro', { titre: 'Budget commun', sous: 'À parts égales, au prorata, en parts :<br>une règle par dépense.', url: 'Démo gratuite · <b>qm-engineering.fr</b>' });
  son('ding', 0.6);
  await temps(3);
}
