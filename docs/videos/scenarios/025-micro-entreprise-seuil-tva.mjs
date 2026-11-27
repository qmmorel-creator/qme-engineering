// Vidéo 025 · Livre recettes-dépenses micro-entreprise · « Ce devis : sous le seuil de TVA, ou au-dessus ? »
// Type : avant-après (état initial des seuils, un geste réel, état final côte à côte).
// Fiche :
//   Accroche (dès la 1re image, accent bleu) : « Seuil de TVA : / plus que 4 313 €. / Devis : 4 800 €. »
//   Bascule (question persistante) : « Ce devis : sous le seuil, ou au-dessus ? »
//   Déroulé : accroche (0-3 s) → écran Seuils : prestations de services à 88 % du seuil de franchise de TVA, reste
//   lu dans la jauge (3-8 s) → geste réel : onglet Recettes, « + Recette », montant tapé, client, nature, catégorie
//   « Prestations de services », Ajouter (8-17 s) → l'alerte du livre passe à 101 %, clic sur « Voir les seuils »
//   (17-20 s) → jauge avant / après, état « Seuil de base dépassé », tampon rouge (20-25 s) → outro (25-29 s).
//   Résultat montré : le livre tient le compte du seuil à chaque recette et prévient dès 80 %.
// Données : démo intégrée du template (atelier de céramique fictif). Seule valeur saisie : l'encaissement de 4 800 €
// tapé à l'écran. Toutes les autres valeurs de l'habillage (reste, pourcentages, chiffre d'affaires des services, état)
// sont LUES dans l'application, avant et après le geste ; preparer échoue si la démo ne contient pas le cas.

export const config = {
  nom: '025-micro-entreprise-seuil-tva',
  produit: 'MCE', type: 'avant-après', titre: 'Ce devis : sous le seuil de franchise de TVA, ou au-dessus ?',
  app: '/templates/micro-entreprise/?demo',
  largeur: 1280, hauteur: 1600,
  marque: 'QME · Livre recettes-dépenses',
  url: 'qm-engineering.fr/templates/micro-entreprise',
  affiche: 1.2,
  musique: 'auto',
  dureeMax: 29,
};

const MONTANT = '4800';
const CLIENT = 'Comité d\'entreprise (exemple)';
const NATURE = 'Atelier team building';
const ONGLET = (v) => `.onglet[data-vue="${v}"]`;
// Jauge « Dont prestations de services » de la carte « Franchise de TVA »
const JB = '.seuils .carte-seuil:nth-child(1) .jauge-bloc:nth-of-type(2)';
const J_VAL = `${JB} .jauge-val b`;
const J_PCT = `${JB} .jauge-val span`;
const J_ETAT = `${JB} .jauge-tete .etiquette`;
const J_RESTE = `${JB} .jauge-legende span:last-child`;
const J_BARRE = `${JB} .jauge`;
const NOUVELLE = '.vue-tete [data-action="ecriture-nouvelle"][data-type="recettes"]';
const M = (n) => `#modale [name="${n}"]`;
const M_AJOUTER = '#modale button[value="ok"]';
const ALERTE = '.alerte-lien';
const TUILES = '.tuiles';
const nombre = (t) => Number(String(t).replace(/[^\d]/g, ''));
const texte = (v, sel) => v.appli.$eval(sel, (e) => e.textContent);
// Vraie molette jusqu'à l'élément (la page a défilé pendant la saisie).
async function defilerVers(v, sel, haut = 300) {
  const { appli, page, pause } = v;
  const dy = await appli.$eval(sel, (e, h) => e.getBoundingClientRect().top - h, haut);
  if (Math.abs(dy) < 40) return;
  const pas = Math.max(1, Math.round(Math.abs(dy) / 220));
  for (let i = 0; i < pas; i++) { await page.mouse.wheel(0, dy / pas); await pause(40); }
  await pause(300);
}
const propre = (t) => String(t).replace(/[\s  ]+/g, ' ').trim();

async function jaugeServices(v) {
  const titre = propre(await v.lire(`${JB} .jauge-tete b`));
  if (!/prestations de services/i.test(titre)) throw new Error(`Jauge inattendue : ${titre}`);
  return {
    val: propre(await v.lire(J_VAL)),
    pct: propre(await v.lire(J_PCT)).match(/\d+\s?%/)?.[0].replace(/\s/, ' '),
    etat: propre(await v.lire(J_ETAT)),
    reste: propre(await v.lire(J_RESTE)).replace(/^Reste\s*/, ''),
  };
}

export async function preparer(v) {
  const { appli, page } = v;
  await v.fermerDialogues();
  await appli.click(ONGLET('seuils'));
  await page.waitForTimeout(500);
  v.j0 = await jaugeServices(v);
  // Le cas : services « Proche » du seuil de base, un reste inférieur au montant saisi, sans atteindre le seuil majoré
  const majore = nombre((await v.lire(`${JB} .jauge-legende span:nth-child(2)`)).replace(/^Majoré/, ''));
  const apres = nombre(v.j0.val) + Number(MONTANT);
  if (!/proche/i.test(v.j0.etat) || !(nombre(v.j0.reste) > 0 && nombre(v.j0.reste) < Number(MONTANT)) || !(apres < majore)) {
    throw new Error(`Démo inattendue : ${JSON.stringify(v.j0)} · majoré ${majore}`);
  }
  await appli.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  await v.S('cadrer', null);
  await v.S('fenetre', false);
  await page.waitForTimeout(1500);
}

export async function jouer(v) {
  const { S, son, pause, appli } = v;
  const temps = async (n = 1) => { for (let i = 0; i < n; i++) await v.temps(); };
  const nb = (t) => t.replace(/ /g, '_');
  const montantTxt = `${Number(MONTANT).toLocaleString('fr-FR').replace(/\s/g, ' ')} €`;

  // Accroche entière dès la première image (couleur dominante : bleu), un seul son d'entrée
  son('whoosh', 0.6);
  await S('accroche', ['Seuil de TVA :', `^plus que *${nb(v.j0.reste)}*.`, `^Devis : *${nb(montantTxt)}*.`], 0);
  await temps(4);
  son('whoosh'); await S('accrocheSortie');
  await S('question', 'Ce devis : *sous_le_seuil*, ou au-dessus ?');
  await v.temps(); son('whoosh', 0.7); await S('fenetre', true);

  // Avant : la jauge des prestations de services
  await v.temps(); son('zoom'); await S('cadrer', JB, { max: 2.4, marge: 30 });
  son('pop'); await S('anneau', 'r0', J_RESTE, { couleur: 'var(--bleu)', etiquette: `reste ${v.j0.reste}`, cote: 'dessous', marge: 6 });
  await S('legende', `Services : <b>${v.j0.pct}</b> du seuil de franchise de TVA.`);
  await temps(2);
  await S('retirer', 'r0');

  // Geste réel : saisir l'encaissement du devis
  await S('legende', `Le devis est réglé : <b>${montantTxt}</b> à noter.`);
  await S('suivre', 2.2);
  await v.cliquer(ONGLET('recettes'), { ms: 500 });
  await pause(250);
  await v.cliquer(NOUVELLE, { ms: 500 });
  await pause(250);
  await v.saisir(M('montant'), MONTANT, { ms: 450 });
  await v.saisir(M('tiers'), CLIENT, { ms: 380, rapide: true });
  await v.saisir(M('nature'), NATURE, { ms: 380, rapide: true });
  await v.viser(M('categorie'), { ms: 380 });
  son('clic'); await appli.selectOption(M('categorie'), 'bic'); await pause(150);
  const choix = await appli.$eval(M('categorie'), (s) => s.selectedOptions[0].textContent.trim());
  if (!/Prestations de services/.test(choix)) throw new Error(`Catégorie choisie inattendue : ${choix}`);
  await S('flash', M('categorie'), 'var(--jaune)');
  await v.temps();
  await v.cliquer(M_AJOUTER, { ms: 420 });
  await pause(300);

  // L'alerte du livre change aussitôt
  await S('cadrer', null);
  await defilerVers(v, TUILES, 260);
  const alerte = propre(await texte(v, ALERTE));
  const pctAlerte = alerte.match(/(\d+)\s?% du seuil de franchise de TVA/)?.[1];
  if (!pctAlerte || Number(pctAlerte) < 100) throw new Error(`Alerte inattendue : ${alerte}`);
  son('dezoom', 0.5); await S('cadrer', ALERTE, { max: 2.4, marge: 30 });
  await S('flash', ALERTE, 'var(--rouge)');
  await S('legende', `L'alerte passe à <b>${pctAlerte} %</b>.`);
  await temps(2);
  await S('suivre', 2.2);
  await v.cliquer(`${ALERTE} u`, { ms: 480 });
  await pause(300);

  // Après : la même jauge, relue
  const j1 = await jaugeServices(v);
  if (j1.val === v.j0.val || nombre(j1.val) !== nombre(v.j0.val) + Number(MONTANT) || /proche|sous/i.test(j1.etat)) {
    throw new Error(`Résultat inattendu : ${JSON.stringify(v.j0)} → ${JSON.stringify(j1)}`);
  }
  son('zoom', 0.6); await S('cadrer', JB, { max: 2.4, marge: 30 });
  await S('flash', J_BARRE, 'var(--rouge)');
  son('pop'); await S('avantApres', 'v', J_VAL, v.j0.val, j1.val, { couleur: 'var(--rouge)', cote: 'dessous', note: 'services' });
  son('alerte', 0.6); await S('anneau', 'e', J_ETAT, { couleur: 'var(--rouge)', etiquette: `${v.j0.pct} → ${j1.pct}`, cote: 'dessus', marge: 4 });
  await S('secouer', 'e');
  await S('legende', `<b>${j1.etat.charAt(0) + j1.etat.slice(1).toLowerCase()}</b> : le livre le signale.`);
  await temps(3);
  await v.temps(); son('tampon');
  await S('tampon', 'Repéré à la saisie', 'alerte dès 80 % du seuil', 'var(--bleu)');
  await temps(2);
  await S('tamponFin'); await S('retirer'); await S('cacherCurseur');

  // Fin
  await v.temps(); son('whoosh'); await S('volet');
  await S('legende', null);
  await S('outro', { titre: 'Livre recettes-dépenses', sous: 'Vos seuils comptés<br>à chaque recette.', url: 'Essai gratuit 14 jours · <b>qm-engineering.fr</b>' });
  son('ding', 0.6);
  await temps(4);
}
