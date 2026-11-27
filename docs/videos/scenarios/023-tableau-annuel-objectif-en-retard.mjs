// Vidéo 023 · Tableau de bord annuel et roue de vie · « Vos objectifs de l'année : en avance ou en retard ? »
// Type : service rendu (le gain concret : l'avancement est comparé au rythme de l'année, sans calcul).
// Fiche :
//   Accroche : « Décembre : / vos objectifs de janvier, / tenus ou oubliés ? »
//   Question persistante : « Vos objectifs : en avance ou en retard ? »
//   Déroulé : accroche (0-4 s) → tableau de Camille, tuile « Objectifs 2026 » : fait / attendu à date (4-9 s) →
//   « Objectifs à surveiller » : les objectifs en retard repérés tout seuls (9-12 s) → geste réel : mise à jour de
//   « Voir mes amis plus souvent » (moments par mois 3 → 4, week-end entre amis coché, Enregistrer) (12-20 s) →
//   l'objectif quitte la liste, la tuile de l'année avant / après, tampon (20-25 s) → outro (25-29 s).
//   Résultat montré : l'avancement de l'année recalculé et comparé au rythme attendu, sans tableur.
// Données : démo intégrée du template (« Camille », fictive). Les seules valeurs saisies sont celles de la mise à jour
// (4 moments par mois, case cochée) ; toutes les valeurs de l'habillage (avancements, attendu à date, nombre d'objectifs
// en retard) sont LUES dans l'application, avant et après le geste. L'« attendu à date » dépend du jour du tournage.

export const config = {
  nom: '023-tableau-annuel-objectif-en-retard',
  produit: 'RDV', type: 'service rendu', titre: 'Vos objectifs de l\'année : en avance ou en retard ?',
  app: '/templates/tableau-annuel/?demo',
  largeur: 1280, hauteur: 1600,
  marque: 'QME · Tableau de bord annuel',
  url: 'qm-engineering.fr/templates/tableau-annuel',
  affiche: 2.7,
  musique: 'auto',
  dureeMax: 29,
};

const OBJECTIF = 'Voir mes amis plus souvent';
const DOMAINE = 'Amis et vie sociale';
let ID = '', I_TUILE = 0, I_DOM = 0;
const TUILE = () => `.tuiles > .tuile:nth-child(${I_TUILE})`;
const TUILE_V = () => `${TUILE()} > b`;
const TUILE_ATT = () => `${TUILE()} > span`;
const CARTE = () => `button.carte-ligne[data-id="${ID}"]`;
const CARTE_PCT = () => `${CARTE()} > span.discret`;
const LISTE = 'ul.liste-cartes:has(button.carte-ligne)';
const MODALE = 'dialog#modale[open]';
const CHAMP = `${MODALE} label.champ input`;
const CASE = `${MODALE} label.case input`;
const OK = `${MODALE} button[value="ok"]`;
const DOM_OBJ = () => `table.tableau-dom tbody tr:nth-child(${I_DOM}) td:last-child`;
const taux = (t) => (t.match(/\d+\s*%/) || [t])[0].replace(/\s+/, ' ');
const pct = (t) => t.replace(/\s/g, '').replace('%', ' %');

export async function preparer(v) {
  const { appli, page } = v;
  await v.fermerDialogues();
  const infos = await appli.evaluate(({ obj, dom }) => {
    const tuiles = [...document.querySelectorAll('.tuiles > .tuile')];
    const iT = tuiles.findIndex((t) => /^Objectifs \d{4}$/.test(t.querySelector('.surtitre')?.textContent.trim() || ''));
    const carte = [...document.querySelectorAll('button.carte-ligne[data-action="objectif-maj"]')].find((b) => b.querySelector('b')?.textContent.trim() === obj);
    const lignes = [...document.querySelectorAll('table.tableau-dom tbody tr')];
    const iD = lignes.findIndex((l) => l.querySelector('.nom-dom')?.textContent.trim() === dom);
    return { iT: iT + 1, id: carte?.dataset.id || '', iD: iD + 1, nbRetard: document.querySelectorAll('ul.liste-cartes .pastille.st-retard').length };
  }, { obj: OBJECTIF, dom: DOMAINE });
  if (!infos.iT || !infos.id || !infos.iD) throw new Error(`Démo inattendue : ${JSON.stringify(infos)}`);
  ID = infos.id; I_TUILE = infos.iT; I_DOM = infos.iD; v.nbRetard = infos.nbRetard;
  v.annee0 = pct(await v.lire(TUILE_V()));
  v.attendu = (await v.lire(TUILE_ATT())).replace(/^.*:\s*/, '');
  v.carte0 = await v.lire(CARTE_PCT());
  v.dom0 = await v.lire(DOM_OBJ());
  if (!/^25 %/.test(v.carte0) || v.nbRetard < 2) throw new Error(`Cas de départ inattendu : ${v.carte0} · ${v.nbRetard} en retard`);
  await appli.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  await v.S('cadrer', null);
  await v.S('fenetre', false);
}

export async function jouer(v) {
  const { S, son, pause } = v;
  const temps = async (n = 1) => { for (let i = 0; i < n; i++) await v.temps(); };

  // Accroche : le problème vécu, un seul son d'entrée
  son('whoosh', 0.6);
  await S('accroche', ['Décembre :', 'vos objectifs de janvier,', '!*tenus* ou oubliés ?'], 260);
  await temps(2);
  son('whoosh'); await S('accrocheSortie');
  await S('question', 'Vos objectifs : *en_avance* ou *en_retard* ?');
  await v.temps(); son('whoosh', 0.7); await S('fenetre', true);

  // La tuile de l'année : fait / attendu à date, lus dans l'application
  await v.temps(); son('zoom'); await S('cadrer', TUILE(), { max: 2.6, marge: 40 });
  son('pop'); await S('anneau', 't0', TUILE_V(), { couleur: 'var(--rouge)', etiquette: `${v.annee0} faits`, cote: 'droite', marge: 6 });
  await S('legende', `Fait : <b>${v.annee0}</b>. Attendu à cette date : <b>${v.attendu}</b>.`);
  await temps(2);
  await S('retirer', 't0');

  // Les objectifs en retard, repérés tout seuls
  son('glisse', 0.5); await S('cadrer', LISTE, { max: 2.2, marge: 30 });
  await S('legende', `<b>${v.nbRetard} objectifs</b> en retard sur le rythme de l'année.`);
  await temps(2);

  // Geste réel : la mise à jour de l'objectif
  await S('suivre', 2.3);
  await v.cliquer(CARTE(), { ms: 520 });
  await pause(300);
  await S('cadrer', `${MODALE} form`, { max: 2.4, marge: 30 });
  await S('legende', `Ce mois-ci : <b>4 moments</b> entre amis, et le week-end réservé.`);
  await S('suivre', 2.4);
  await v.saisir(CHAMP, '4', { ms: 450 });
  await v.cliquer(CASE, { ms: 450 });
  await v.cliquer(OK, { ms: 450 });
  await pause(350);

  // Résultat : relu après le geste
  const annee1 = pct(await v.lire(TUILE_V()));
  const dom1 = await v.lire(DOM_OBJ());
  const resteCarte = await v.appli.$(CARTE());
  if (annee1 === v.annee0 || dom1 === v.dom0 || resteCarte) throw new Error(`Rien n'a changé : ${annee1} · ${dom1} · carte ${!!resteCarte}`);
  son('dezoom', 0.5); await S('cadrer', DOM_OBJ(), { max: 2.6, marge: 60 });
  await S('flash', DOM_OBJ(), 'var(--jaune)');
  son('pop'); await S('avantApres', 'd', DOM_OBJ(), taux(v.dom0), taux(dom1), { couleur: 'var(--bleu)', cote: 'dessous', note: 'objectif' });
  await S('legende', 'Objectif atteint : <b>il quitte la liste</b> des retards.');
  await temps(2);
  await S('retirer', 'd');
  son('glisse', 0.5); await S('cadrer', TUILE(), { max: 2.6, marge: 40 });
  await S('flash', TUILE(), 'var(--jaune)');
  son('pop'); await S('avantApres', 'a', TUILE_V(), v.annee0, annee1, { couleur: 'var(--rouge)', cote: 'dessous', note: 'l\'année' });
  await S('legende', `Attendu : <b>${v.attendu}</b>. L'écart se resserre.`);
  await v.temps();
  son('eclat'); await S('eclat', TUILE_V(), ['var(--jaune)', 'var(--bleu)', 'var(--rouge)']);
  await v.temps(); son('tampon'); son('ding', 0.7);
  await S('tampon', `${v.annee0} → ${annee1}`, 'le rythme de l\'année, calculé pour vous', 'var(--vert)');
  await temps(2);
  await S('tamponFin'); await S('retirer'); await S('cacherCurseur');

  // Fin
  await v.temps(); son('whoosh'); await S('volet');
  await S('legende', null);
  await S('outro', { titre: 'Tableau de bord annuel', sous: 'Vos objectifs comparés<br>au rythme de l\'année.', url: 'Essai gratuit 14 jours · <b>qm-engineering.fr</b>' });
  son('ding', 0.6);
  await temps(4);
}
