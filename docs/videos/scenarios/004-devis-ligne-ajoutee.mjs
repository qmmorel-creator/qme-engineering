// Vidéo 004 · Générateur de devis · « Une ligne de plus sur le devis : tout est à recalculer ? »
// Type : service rendu. Données : démo intégrée du template (entreprise fictive « Atelier Exemple Rénovation »),
// devis brouillon « Rénovation de la salle de bains » (remise globale 5 %, TVA 10 % et 5,5 %, acompte 30 %).
// Geste réel : ajout de « Peinture des plafonds » depuis le catalogue, quantité saisie au clavier, puis aperçu A4.
// Toutes les valeurs affichées par l'habillage (montant de la ligne, totaux) sont LUES dans l'application réelle.

export const config = {
  nom: '004-devis-ligne-ajoutee',
  produit: 'DVS', type: 'service rendu', titre: 'Une ligne ajoutée, le devis recalculé au centime',
  app: '/templates/devis/?demo',
  largeur: 1280, hauteur: 1600,
  marque: 'QME · Générateur de devis',
  url: 'qm-engineering.fr/templates/devis',
  affiche: 1.8,
  // Musique de la vidéo de présentation QME (« Corporate », litesaturation, licence Pixabay : usage commercial sans attribution).
  // 110 BPM, premier temps à 0,534 s ; départ au 36e temps (20,17 s), dans la partie pleine du morceau.
  musique: { fichier: 'docs/videos/musique/corporate-litesaturation.m4a', bpm: 110, premierTemps: 0.534, debut: 20.170, volume: 0.6 },
};
const T = 60000 / 110; // un temps en ms

const OBJET = 'Rénovation de la salle de bains';
const PRESTATION = 'Peinture des plafonds, deux couches';
const RECHERCHE = 'plafond';
const QUANTITE = '14,5';

const OUVRIR = `.ld-ouvrir:has-text("${OBJET}")`;
const TOTAUX = '.carte-totaux #totaux';
const TTC = `${TOTAUX} .total dd`;
const TOTAL_HT = `${TOTAUX} .fort dd`;
const BOUTON_CATALOGUE = '[data-action="ligne-catalogue"]';
const CHERCHE = 'dialog[open] #cherche-cat';
const CHOIX = 'dialog[open] #choix-liste .choix-cat'; // un seul résultat après la recherche (contrôlé dans preparer et après la frappe)
const TERMINE = 'dialog[open] .modale-pied button[value="annuler"]';
const DERNIERE = 'ul.lignes > li:last-child';
const QTE = `${DERNIERE} [data-l="quantite"]`;
const MONTANT = `${DERNIERE} [data-montant] b`;
const APERCU = '.carte-totaux [data-action="apercu"]';
const F_TOTAUX = '.feuille .f-totaux';
const F_TTC = '.feuille .f-totaux .total dd';
const F_LIGNE = '.feuille .f-table tbody tr:last-child';

// Texte des lignes du bloc Totaux, sous forme { libellé: montant }.
const lireTotaux = (appli) => appli.$$eval(`${TOTAUX} dl > div`, (ds) => Object.fromEntries(ds.map((d) => [d.querySelector('dt').textContent.trim(), d.querySelector('dd').textContent.trim()])));

export async function preparer(v) {
  const { appli, page } = v;
  await v.fermerDialogues(); // guide d'accueil du premier lancement, hors caméra
  await appli.click(OUVRIR); await page.waitForTimeout(500);
  const titre = await v.lire('.edition-titre h1');
  const objet = await v.lire('[data-d="objet"]');
  const brouillon = await appli.$('.statut[data-statut="brouillon"][aria-pressed="true"]');
  if (objet !== OBJET || !brouillon) throw new Error(`Devis de démo inattendu : ${titre} · ${objet}`);
  const designations = await appli.$$eval('ul.lignes textarea[data-l="designation"]', (t) => t.map((x) => x.value));
  if (designations.includes(PRESTATION)) throw new Error('La ligne « plafonds » est déjà sur le devis de démo.');
  // Le catalogue contient bien la prestation, avec un prix (vérifié dans la vraie fenêtre, puis refermée).
  await appli.click(BOUTON_CATALOGUE); await page.waitForTimeout(300);
  await appli.fill('#cherche-cat', RECHERCHE); await page.waitForTimeout(200);
  const choix = await appli.$$eval('dialog[open] .choix-cat', (b) => b.map((x) => x.innerText.replace(/\s+/g, ' ')));
  if (choix.length !== 1 || !choix[0].includes(PRESTATION) || choix[0].includes('sans prix')) throw new Error(`Catalogue inattendu : ${JSON.stringify(choix)}`);
  await appli.click(TERMINE); await page.waitForTimeout(300);
  const t = await lireTotaux(appli);
  if (!t['Total TTC'] || !Object.keys(t).some((k) => k.startsWith('Remise globale')) || Object.keys(t).filter((k) => k.startsWith('TVA')).length < 2) {
    throw new Error(`Totaux inattendus : ${JSON.stringify(t)}`);
  }
  await appli.evaluate(() => window.scrollTo(0, 0));
  await v.S('cadrer', null);
  await v.S('fenetre', false);
}

export async function jouer(v) {
  const { S, son, pause, page, appli } = v;
  const temps = (n = 1) => pause(n * T);

  // Accroche : un mot par demi-temps (un seul son d'entrée, pas un par mot)
  const lignes = ['Le client ajoute', 'une ligne au devis.', '!Tout est à *recalculer ?*'];
  son('whoosh', 0.6);
  await S('accroche', lignes, T / 2);
  await v.temps();
  son('whoosh'); await S('accrocheSortie');
  await S('question', 'Une ligne de plus : le *total* suit ?');
  await v.temps(); son('whoosh', 0.7); await S('fenetre', true);

  // Le total de départ, lu dans l'application
  await v.temps(); son('zoom'); await S('cadrer', TOTAUX, { max: 2.3, marge: 60 });
  const avant = await lireTotaux(appli);
  const ttc0 = avant['Total TTC'];
  await v.temps(); son('pop'); await S('anneau', 'ttc', `${TOTAUX} .total`, { etiquette: `Total TTC : ${ttc0}`, cote: 'dessous', marge: 6 });
  await S('legende', `Remise de <b>5 %</b>, deux taux de TVA, un acompte.`);
  await temps(1);
  await S('retirer', 'ttc');

  // Vraie molette : on descend jusqu'aux lignes du devis
  await v.temps(); await S('legende', `Le client veut aussi <b>le plafond</b>.`);
  son('dezoom', 0.7); await S('suivre', 1.6, 0.2);
  const p = await v.viser('.bloc:has(ul.lignes) h2', { ms: 520 });
  const c = await S('versToile', p.x, p.y);
  await page.mouse.move(c.x, c.y);
  son('glisse', 0.5);
  for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 170); await pause(45); }
  await pause(350);

  // Ajout depuis le catalogue : clic, recherche au clavier, choix, Terminé
  son('zoom', 0.7); await S('suivre', 2.2);
  await v.cliquer(BOUTON_CATALOGUE, { ms: 520 });
  await pause(250);
  await v.saisir(CHERCHE, RECHERCHE, { ms: 420 });
  await v.temps(2);
  const resultats = await appli.$$eval(CHOIX, (b) => b.map((x) => x.innerText));
  if (resultats.length !== 1 || !resultats[0].includes(PRESTATION)) throw new Error(`Recherche inattendue : ${JSON.stringify(resultats)}`);
  await v.cliquer(CHOIX, { ms: 480 });
  await v.temps(2);
  await v.cliquer(TERMINE, { ms: 480 });
  await pause(250);
  const ajoutee = await appli.$eval(`${DERNIERE} textarea[data-l="designation"]`, (t) => t.value);
  if (ajoutee !== PRESTATION) throw new Error(`Ligne ajoutée inattendue : ${ajoutee}`);
  const montant1 = await v.lire(MONTANT);

  // Quantité réelle au clavier
  await v.temps(); await S('legende', `<b>${QUANTITE} m²</b> de plafond.`);
  await v.saisir(QTE, QUANTITE, { ms: 480 });
  await v.temps(2); await v.valider();
  const montant2 = await v.lire(MONTANT);
  if (montant2 === montant1) throw new Error('Le montant de la ligne n\'a pas changé.');
  son('dezoom', 0.6); await S('cadrer', DERNIERE, { max: 2.2, marge: 40 });
  await S('flash', DERNIERE, 'var(--ciel)');
  son('pop'); await S('avantApres', 'l', MONTANT, montant1, montant2, { couleur: 'var(--bleu)', cote: 'dessus', note: 'total de la ligne' });
  await temps(2);
  await S('retirer', 'l');

  // Le bloc Totaux, recalculé
  const apres = await lireTotaux(appli);
  const ttc1 = apres['Total TTC'];
  const cleRemise = Object.keys(apres).find((k) => k.startsWith('Remise globale'));
  const cleTva = Object.keys(apres).find((k) => k.startsWith('TVA 10'));
  if (ttc1 === ttc0 || apres[cleRemise] === avant[cleRemise] || !cleTva || apres[cleTva] === avant[Object.keys(avant).find((k) => k.startsWith('TVA 10'))]) {
    throw new Error(`Totaux non recalculés : ${JSON.stringify({ avant, apres })}`);
  }
  await v.temps(); son('zoom'); await S('cadrer', TOTAUX, { max: 2.3, marge: 60 });
  await v.temps();
  await S('flash', TOTAUX, 'var(--jaune)');
  son('pop'); await S('avantApres', 'ttc', TTC, ttc0, ttc1, { couleur: 'var(--vert)', cote: 'dessous' });
  son('trait', 0.6); await S('souligner', 's', `${TOTAUX} .total`, 'var(--vert)');
  await S('legende', `Remise, TVA par taux, acompte : <b>tout suit</b>.`);
  await temps(1);
  son('eclat'); await S('eclat', `${TOTAUX} .total`, ['var(--vert)', 'var(--jaune)', 'var(--bleu)']);
  await v.temps(); son('tampon'); son('ding', 0.7);
  await S('tampon', 'Recalculé au centime', `Total HT ${apres['Total HT']} · TTC ${ttc1}`, 'var(--vert)');
  await temps(1.6);
  await S('tamponFin'); await S('retirer');

  // Le devis prêt : aperçu A4
  await v.temps(); await S('legende', `Un clic : le devis <b>prêt à imprimer</b>.`);
  son('zoom', 0.6); await S('suivre', 2.0);
  await v.cliquer(APERCU, { ms: 520 });
  await pause(300);
  const fTtc = await v.lire(F_TTC);
  const fLigne = await appli.$eval(F_LIGNE, (r) => r.innerText.replace(/\s+/g, ' '));
  if (fTtc !== ttc1 || !fLigne.includes(PRESTATION)) throw new Error(`Aperçu inattendu : ${fTtc} · ${fLigne}`);
  son('dezoom', 0.6); await S('cadrer', [F_LIGNE, F_TOTAUX], { max: 2.4, marge: 30 });
  await S('flash', F_LIGNE, 'var(--ciel)');
  son('pop'); await S('anneau', 'fl', F_LIGNE, { couleur: 'var(--bleu)', etiquette: 'La ligne ajoutée', cote: 'dessus', pulse: false, marge: 4 });
  await v.temps();
  await S('retirer', 'fl');
  son('zoom'); await S('cadrer', F_TOTAUX, { max: 2.4, marge: 30 });
  await S('flash', `${F_TOTAUX} .total`, 'var(--vert)');
  son('trait', 0.6); await S('souligner', 's2', `${F_TOTAUX} .total`, 'var(--vert)');
  await v.temps(); son('tampon'); son('ding', 0.6);
  await S('tampon', 'Prêt à envoyer', 'Imprimé en A4 ou enregistré en PDF', 'var(--vert)');
  await temps(1.8);
  await S('tamponFin'); await S('retirer'); await S('cacherCurseur');

  // Fin
  await v.temps(); son('whoosh'); await S('volet');
  await S('legende', null);
  await S('outro', { titre: 'Générateur de devis', sous: 'Des totaux justes au centime,<br>à chaque ligne ajoutée.', url: 'Démo gratuite · <b>qm-engineering.fr</b>' });
  son('ding', 0.6);
  await temps(3);
}
