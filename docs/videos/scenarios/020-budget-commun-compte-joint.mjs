// Vidéo 020 · Gestion Dépenses Communes · « Compte joint : combien chacun doit-il verser ? »
// Type : mode de fonctionnement (mode « compte commun », ajouté le 20/11/2026). Données : démo intégrée
// `?demo=compte` (couple fictif « Camille et Sami », clé au prorata des revenus, forfait téléphone de Sami
// payé par le compte : charge personnelle ; ce mois-ci Camille a versé, Sami pas encore).
// Geste réel : Sami touche « C'est fait » dans l'encadré « À verser » ; le versement est noté.
// Résultat montré : le versement de chacun (part au prorata + charge personnelle), puis « Versements faits »
// et le solde estimé du compte qui repasse au-dessus de zéro.
// Toutes les valeurs affichées par l'habillage sont LUES dans l'application réelle.

export const config = {
  nom: '020-budget-commun-compte-joint',
  produit: 'BCM', type: 'fonctionnement', titre: 'Compte joint : combien chacun doit-il verser ?',
  app: '/templates/budget-commun/?demo=compte',
  largeur: 1280, hauteur: 1600,
  marque: 'QME · Gestion Dépenses Communes',
  url: 'qm-engineering.fr/templates/budget-commun',
  affiche: 2.2,
  musique: 'auto',
  dureeMax: 29,
};
const T = 60000 / 110;

const TITRE = '.jour-titre h1';
const CARTES = '.soldes';
const CARTE = (n) => `.soldes li:nth-child(${n})`;
const MONTANT = (n) => `${CARTE(n)} .solde-montant`;
const A_VERSER = '.equilibre-carte';
const FAIT_SAM = '[data-action="versement-fait"][data-id="sam"]';
const ESTIME = '.deux-colonnes > section:nth-child(2) .calcul-ligne.total b';
const LIGNE_ESTIME = '.deux-colonnes > section:nth-child(2) .calcul-ligne.total';
const COUVRIR = '#form-alim .calcul-ligne.total b';

export async function preparer(v) {
  const { appli, page } = v;
  await v.fermerDialogues(); // guide du premier lancement, hors caméra
  await page.waitForTimeout(1200);
  await v.fermerDialogues(); // « Comme une application » éventuelle
  // Contrôle du cas : onglet Compte, Sami doit encore verser, Camille a versé, solde estimé négatif.
  if (!(await appli.$('.onglet[data-vue="compte"][aria-current="page"]'))) throw new Error('Onglet Compte absent : démo du mode compte non ouverte.');
  const titre = await v.lire(TITRE);
  if (!/^Sami verse .+ sur le compte\.$/.test(titre)) throw new Error(`Titre inattendu : ${titre}`);
  if (!(await appli.$(FAIT_SAM)) || await appli.$('[data-action="versement-fait"][data-id="cam"]')) throw new Error('État des versements inattendu.');
  v.cam = await v.lire(MONTANT(1)); v.sam = await v.lire(MONTANT(2));
  v.pCam = await v.lire(`${CARTE(1)} p`); v.pSam = await v.lire(`${CARTE(2)} p`);
  v.couvrir = await v.lire(COUVRIR);
  v.estime0 = await v.lire(ESTIME);
  if (!/^−/.test(v.estime0)) throw new Error(`Solde estimé attendu négatif avant le versement : ${v.estime0}`);
  if (!/charges personnelles/.test(v.pSam)) throw new Error('Charge personnelle de Sami absente.');
  await v.S('cadrer', null);
  await v.S('fenetre', false);
}

export async function jouer(v) {
  const { S, son, pause } = v;
  const temps = (n = 1) => pause(n * T);
  const pct = (p) => (p.match(/\(([\d,]+ %)\)/) || [])[1] || '';

  // Accroche (un seul son d'entrée)
  son('whoosh', 0.6);
  await S('accroche', ['Compte joint :', 'combien chacun', '!doit *verser* ?'], T / 2);
  await v.temps();
  son('whoosh'); await S('accrocheSortie');
  await S('question', 'Charges − solde, *au prorata*.');
  await v.temps(); son('whoosh', 0.7); await S('fenetre', true);

  // Ce qu'il faut couvrir, puis la part de chacun
  await v.temps(); son('zoom'); await S('cadrer', [CARTE(1), CARTE(2)], { max: 3.2, marge: 24 });
  await S('legende', `À couvrir ce mois-ci : <b>${v.couvrir}</b>.`);
  await temps(1);
  son('pop'); await S('anneau', 'c', MONTANT(1), { couleur: 'var(--bleu)', etiquette: `${pct(v.pCam)} des revenus`, cote: 'dessus', marge: 6 });
  await temps(0.5);
  son('pop'); await S('anneau', 's', MONTANT(2), { couleur: 'var(--jaune)', etiquette: `${pct(v.pSam)} + son forfait`, cote: 'dessous', marge: 6 });
  await S('legende', 'Au prorata, <b>plus ses charges perso</b>.');
  await temps(2);
  await S('retirer');

  // Geste réel : Sami a fait son virement
  await S('suivre', 2.2);
  await v.temps(); await S('legende', `Sami vire <b>${v.sam}</b>.`);
  await v.cliquer(FAIT_SAM, { ms: 560 });
  await pause(250);
  const titre1 = await v.lire(TITRE);
  if (!/faits\.$/.test(titre1)) throw new Error(`Titre après versement inattendu : ${titre1}`);
  son('dezoom', 0.6); await S('cadrer', TITRE, { max: 1.9, marge: 40 });
  await S('flash', TITRE, 'var(--vert)');
  await S('legende', 'Le versement est <b>noté</b>.');
  await temps(1.5);

  // Effet global : le solde estimé du compte
  const estime1 = await v.lire(ESTIME);
  if (estime1 === v.estime0 || /^−/.test(estime1)) throw new Error(`Solde estimé inattendu après versement : ${estime1}`);
  son('glisse', 0.6); await S('cadrer', LIGNE_ESTIME, { max: 2.1, marge: 50 });
  await v.temps();
  await S('flash', ESTIME, 'var(--jaune)');
  son('pop'); await S('avantApres', 'e', ESTIME, v.estime0, estime1, { couleur: 'var(--vert)', cote: 'dessous', note: 'solde estimé' });
  await S('eclat', ESTIME, ['var(--jaune)', 'var(--bleu)', 'var(--rouge)']);
  await S('legende', 'Le compte <b>repasse au vert</b>.');
  await temps(1.5);
  await v.temps(); son('tampon'); son('ding', 0.7);
  await S('tampon', 'Chacun sa part', `Camille ${v.cam} · Sami ${v.sam}`, 'var(--vert)');
  await temps(1.6);
  await S('tamponFin'); await S('retirer'); await S('cacherCurseur');

  // Fin
  await v.temps(); son('whoosh'); await S('volet');
  await S('legende', null);
  await S('outro', { titre: 'Gestion Dépenses Communes', sous: 'Compte joint : le versement<br>de chacun, chaque mois.', url: 'Essai gratuit · <b>qm-engineering.fr</b>' });
  son('ding', 0.6);
  await temps(2.5);
}
