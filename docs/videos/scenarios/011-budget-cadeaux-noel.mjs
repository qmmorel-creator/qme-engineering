// Vidéo 011 · Mon Budget · « 380 € de cadeaux de Noël sur un mois déjà plein ? »
// Type : problème (angle « problème vécu », sur le modèle du Reel du 13/11/2026 : douleur concrète puis récit).
// Données : démo intégrée du template (foyer fictif « Camille et Sami »). L'enveloppe « Cadeaux et fêtes »
// reçoit 80 € par mois avec report du reste : au mois en cours, elle contient l'enveloppe + le report.
// Geste réel : saisie d'une dépense de 380 € « Cadeaux de Noël » dans Cadeaux et fêtes, depuis le tableau de bord.
// Résultat montré : le reste du mois baisse, mais l'enveloppe couvre la dépense (aucun dépassement).
// Toutes les valeurs affichées par l'habillage (enveloppe, report, restes) sont LUES dans l'application réelle.

export const config = {
  nom: '011-budget-cadeaux-noel',
  produit: 'BDG', type: 'problème', titre: '380 € de cadeaux de Noël sur un mois déjà plein ?',
  app: '/templates/budget/?demo',
  largeur: 1280, hauteur: 1600,
  marque: 'QME · Mon Budget',
  url: 'qm-engineering.fr/templates/budget',
  affiche: 3.1,
  // Musique de la vidéo de présentation QME (« Corporate », litesaturation, licence Pixabay : usage commercial sans attribution).
  musique: { fichier: 'docs/videos/musique/corporate-litesaturation.m4a', bpm: 110, premierTemps: 0.534, debut: 20.170, volume: 0.6 },
};
const T = 60000 / 110; // un temps en ms

const MONTANT = '380';
const LIBELLE = 'Cadeaux de Noël';
const CAT = 'cadeaux';
const SOUS = "Fêtes de fin d'année";

const ONGLET = (vue) => `.onglet[data-vue="${vue}"]`;
const ENV = `li.env:has(button.env-tete[data-id="${CAT}"])`;
const ENV_RESTE = `${ENV} .env-tete > b`;
const ENV_DETAIL = `${ENV} .env-detail`;
const ENV_NOM = `${ENV} .env-nom`;
const RESTE_MOIS = '.entete-mois h1 mark';
const ENTETE = '.entete-mois';
const DEPENSE = '.vue-tete [data-action="operation"][data-type="depense"]';
const M_MONTANT = '#modale input[name="montant"]';
const M_CAT = '#modale select[name="categorie"]';
const M_SOUS = '#modale select[name="sous"]';
const M_LIBELLE = '#modale input[name="libelle"]';
const M_AJOUTER = '#modale button[value="ok"]';
const ALERTE = `.liste-alertes button[data-id="${CAT}"]`;

const eurCourt = (s) => s.replace(/,00\s*€/, ' €'); // « 415,00 € » → « 415 € »

// Défilement réel à la molette, vers le bas ou vers le haut, jusqu'à placer l'élément à `haut` px du bord.
async function defilerVers(v, sel, haut = 420) {
  const { appli, page, pause } = v;
  const dy = await appli.$eval(sel, (e, h) => e.getBoundingClientRect().top - h, haut);
  if (Math.abs(dy) < 40) return;
  const pas = Math.max(1, Math.round(Math.abs(dy) / 220));
  for (let i = 0; i < pas; i++) { await page.mouse.wheel(0, dy / pas); await pause(40); }
  await pause(300);
}

// Rectangle serré autour du TEXTE du nom et du détail de l'enveloppe (les blocs, eux, font toute la largeur).
const zoneTexte = (v) => v.appli.evaluate(([a, b]) => {
  const r = [a, b].map((s) => { const g = document.createRange(); g.selectNodeContents(document.querySelector(s)); return g.getBoundingClientRect(); });
  const x = Math.min(...r.map((q) => q.left)), y = Math.min(...r.map((q) => q.top));
  return { x, y, w: Math.max(...r.map((q) => q.right)) - x, h: Math.max(...r.map((q) => q.bottom)) - y };
}, [`${ENV_NOM} > b`, ENV_DETAIL]);
const NOM = `${ENV_NOM} > b`;

export async function preparer(v) {
  const { appli, page } = v;
  await v.fermerDialogues(); // guide d'accueil du premier lancement, hors caméra
  // Contrôle du cas : l'enveloppe existe, avec report, rien de dépensé, et elle couvre la dépense saisie.
  await appli.click(ONGLET('enveloppes')); await page.waitForTimeout(400);
  const detail = (await v.lire(ENV_DETAIL)).replace(/\s/g, ' ');
  const m = detail.match(/^0,00 € dépensés sur ([\d ]+,\d\d €) \(enveloppe ([\d ]+,\d\d €) \+ report ([\d ]+,\d\d €)\)$/);
  if (!m) throw new Error(`Enveloppe Cadeaux et fêtes inattendue : ${detail}`);
  const dispo = Number(m[1].replace(/[^\d,]/g, '').replace(',', '.'));
  if (dispo < Number(MONTANT) || dispo - Number(MONTANT) > 80) throw new Error(`Montant disponible inadapté au cas : ${m[1]}`);
  v.dispo = m[1]; v.mensuel = m[2]; v.report = m[3];
  v.reste0 = await v.lire(ENV_RESTE);
  // Le sous-choix existe dans la vraie liste.
  await appli.click(ONGLET('mois')); await page.waitForTimeout(400);
  v.mois0 = await v.lire(RESTE_MOIS);
  if (await appli.$(ALERTE)) throw new Error('Cadeaux et fêtes est déjà dans « À surveiller ».');
  // Écran de départ : Enveloppes, l'enveloppe Cadeaux et fêtes en vue.
  await appli.click(ONGLET('enveloppes')); await page.waitForTimeout(400);
  await appli.$eval(ENV, (e) => e.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(200);
  await v.S('cadrer', null);
  await v.S('fenetre', false);
}

export async function jouer(v) {
  const { S, son, pause, appli } = v;
  const temps = (n = 1) => pause(n * T);

  // Accroche : le problème vécu (un seul son d'entrée)
  son('whoosh', 0.6);
  await S('accroche', ['Décembre :', `${MONTANT}_€ de cadeaux`, '!sur un mois *déjà plein*.'], T / 2);
  await v.temps();
  son('whoosh'); await S('accrocheSortie');
  await S('question', 'Les cadeaux de Noël : *où trouver l\'argent* ?');
  await v.temps(); son('whoosh', 0.7); await S('fenetre', true);

  // L'enveloppe mise de côté, lue dans l'application
  await v.temps(); son('zoom'); await S('cadrer', await zoneTexte(v), { max: 2.6, marge: 40 });
  await v.temps(); son('pop');
  await S('anneau', 'env', NOM, { couleur: 'var(--vert)', etiquette: `${eurCourt(v.dispo)} prêts`, cote: 'dessus', marge: 6 });
  await S('legende', `<b>${eurCourt(v.mensuel)}</b> mis de côté chaque mois, avec report.`);
  await temps(2);
  await S('retirer', 'env');

  // Retour au tableau de bord : le reste du mois avant la dépense
  await v.temps(); await S('legende', 'Les achats sont faits. On les note.');
  son('dezoom', 0.6); await S('suivre', 1.8);
  await v.cliquer(ONGLET('mois'), { ms: 520 });
  await pause(300);
  son('zoom', 0.7); await S('cadrer', ENTETE, { max: 2.2, marge: 40 });
  await S('anneau', 'm0', RESTE_MOIS, { couleur: 'var(--bleu)', etiquette: 'reste du mois', cote: 'dessous', marge: 6 });
  await temps(1);
  await S('retirer', 'm0');

  // Saisie réelle de la dépense
  await S('suivre', 2.2);
  await v.cliquer(DEPENSE, { ms: 520 });
  await pause(250);
  await v.saisir(M_MONTANT, MONTANT, { ms: 420 });
  await v.temps(2);
  await v.viser(M_CAT, { ms: 420 });
  son('clic'); await appli.selectOption(M_CAT, CAT); await pause(150);
  await S('flash', M_CAT, 'var(--jaune)');
  await v.viser(M_SOUS, { ms: 380 });
  son('clic'); await appli.selectOption(M_SOUS, { label: SOUS }); await pause(150);
  const choix = await appli.$eval(M_CAT, (s) => s.selectedOptions[0].textContent.trim());
  if (!/Cadeaux/.test(choix)) throw new Error(`Catégorie choisie inattendue : ${choix}`);
  await v.saisir(M_LIBELLE, LIBELLE, { ms: 380, rapide: true });
  await v.temps(2);
  await v.cliquer(M_AJOUTER, { ms: 420 });
  await pause(200);
  son('dezoom', 0.6); await S('cadrer', null);
  await defilerVers(v, ENTETE, 260); // vraie molette : retour au « Il reste … » en haut du tableau de bord

  // Effet global : le reste du mois baisse
  const mois1 = await v.lire(RESTE_MOIS);
  if (mois1 === v.mois0) throw new Error('Le reste du mois n\'a pas changé.');
  son('dezoom', 0.6); await S('cadrer', ENTETE, { max: 2.2, marge: 40 });
  await S('flash', RESTE_MOIS, 'var(--jaune)');
  son('pop'); await S('avantApres', 'm', RESTE_MOIS, v.mois0, mois1, { couleur: 'var(--bleu)', cote: 'dessous', note: 'reste du mois' });
  await S('legende', 'Le mois encaisse. Et l\'enveloppe ?');
  await temps(2);
  await S('retirer', 'm');

  // L'enveloppe : la dépense est couverte, sans dépassement
  son('dezoom', 0.6); await S('suivre', 1.8);
  await v.cliquer(ONGLET('enveloppes'), { ms: 520 });
  await pause(200);
  await S('cadrer', null);
  await defilerVers(v, ENV);
  const reste1 = await v.lire(ENV_RESTE);
  const detail1 = (await v.lire(ENV_DETAIL)).replace(/\s/g, ' ');
  const statut = await appli.$eval(ENV, (e) => e.className);
  if (reste1 === v.reste0 || /de trop/.test(reste1) || /depasse/.test(statut) || !detail1.startsWith(`${MONTANT},00 € dépensés`)) {
    throw new Error(`Enveloppe après saisie inattendue : ${reste1} · ${detail1} · ${statut}`);
  }
  const restant = eurCourt(reste1.replace(/ restants$/, ''));
  son('zoom'); await S('cadrer', await zoneTexte(v), { max: 2.6, marge: 40 });
  await v.temps();
  await S('flash', NOM, 'var(--ciel)');
  son('pop'); await S('anneau', 'e', NOM, { couleur: 'var(--vert)', etiquette: `${restant} restants, aucun dépassement`, cote: 'dessus', marge: 6 });
  await S('legende', `<b>${MONTANT} €</b> dépensés sur <b>${eurCourt(v.dispo)}</b> mis de côté.`);
  await temps(1);
  son('eclat'); await S('eclat', NOM, ['var(--vert)', 'var(--jaune)', 'var(--bleu)']);
  await v.temps(); son('tampon'); son('ding', 0.7);
  await S('tampon', 'Déjà mis de côté', `${MONTANT} € couverts · ${restant} restants`, 'var(--vert)');
  await temps(1.8);
  await S('tamponFin'); await S('retirer'); await S('cacherCurseur');

  // Fin
  await v.temps(); son('whoosh'); await S('volet');
  await S('legende', null);
  await S('outro', { titre: 'Mon Budget', sous: 'Les grosses dépenses de l\'année,<br>mises de côté mois après mois.', url: 'Démo gratuite · <b>qm-engineering.fr</b>' });
  son('ding', 0.6);
  await temps(3);
}
