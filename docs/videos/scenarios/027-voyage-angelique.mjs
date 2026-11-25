// Vidéo 027 · Planificateur de voyage · vidéo PRIVÉE pour le retour d'affiliation d'Angélique Benoit (« Le van à la
// française », non programmée). Elle trouvait la prise en main complexe : la vidéo montre la carte « Premiers pas »
// et ses 3 gestes (voir le jour, noter une dépense, cocher un bagage), sur la démo van au prénom (?demo=van).
// Tutoiement à l'écran : vidéo privée, elle tutoie. Toutes les valeurs affichées sont LUES dans l'application.

export const config = {
  nom: '027-voyage-angelique',
  produit: 'VYG', type: 'démonstration', titre: 'Angélique, la prise en main en 3 gestes',
  app: '/templates/voyage/?demo=van&prenom=Ang%C3%A9lique',
  largeur: 1280, hauteur: 1600,
  marque: 'QME · Planificateur de voyage',
  url: 'qm-engineering.fr/demo/angelique',
  affiche: 1.8,
  dureeMax: 40,
  musique: 'auto',
};

const CARTE = '.demarrage';
const COMPTE = '.demarrage-compte';
const GESTE = (n) => `.demarrage li:nth-child(${n}) .actions button`;
const AUJ = 'article.jour.aujourdhui';
const LIBELLE = 'dialog[open] input[name="libelle"]';
const MONTANT = 'dialog[open] input[name="montant"]';
const TUILE_DEPENSE = '.tuiles .tuile:nth-child(3)';
const TUILE_PREP = '.tuiles .tuile:nth-child(4)';
const CASE = 'label.case:has-text("Laisses, harnais et longe")';

const euros = (t) => (t.match(/([\d\s  ]+)\s?€/) || [0, ''])[1].replace(/\s/g, ' ').trim();
const pourcent = (t) => (t.match(/(\d+)\s?%/) || [0, ''])[1];

export async function preparer(v) {
  const { appli, page } = v;
  await v.fermerDialogues();
  await page.waitForTimeout(1200);
  await v.fermerDialogues();
  v.titre = await v.lire('#demarrage-titre');
  v.compte = await v.lire(COMPTE);
  v.depense = euros(await appli.$eval(TUILE_DEPENSE, (e) => e.innerText));
  v.prep = pourcent(await appli.$eval(TUILE_PREP, (e) => e.innerText));
  if (!v.titre.includes('Angélique') || v.compte !== '0/3' || !v.depense || !v.prep || await appli.$('dialog[open]')) {
    throw new Error(`Démo inattendue : « ${v.titre} », ${v.compte}, ${v.depense} €, ${v.prep} %`);
  }
  await v.S('cadrer', null);
  await v.S('fenetre', false);
  await page.waitForTimeout(1500);
}

export async function jouer(v) {
  const { S, son, pause, appli } = v;

  son('whoosh', 0.6);
  await S('accroche', ['Angélique,', 'la prise en main', 'en *3 gestes*.'], 0);
  await v.temps(); await v.temps();
  son('whoosh'); await S('accrocheSortie');
  await S('fenetre', true);

  // La carte d'accueil
  await v.temps(); son('zoom'); await S('cadrer', CARTE, { max: 1.6, marge: 30 });
  await S('legende', 'Un voyage en van déjà rempli, <b>3 gestes</b> pour s\'y retrouver.');
  await pause(1400);

  // Geste 1 : le programme du jour
  await S('suivre', 1.9);
  await v.cliquer(GESTE(1), { ms: 520 });
  await S('cacherCurseur'); await pause(250);
  son('zoom', 0.7); await S('cadrer', AUJ, { max: 1.9, marge: 30 });
  son('pop'); await S('anneau', 'j', AUJ, { couleur: 'var(--bleu)', etiquette: 'Aujourd\'hui', cote: 'dessus', marge: 6 });
  await S('legende', '<b>1.</b> Le jour J : la route, les balades, la nuit.');
  await pause(1500); await S('retirer'); await S('legende', null);

  // Geste 2 : une dépense
  son('whoosh', 0.5); await S('cadrer', null);
  await appli.evaluate(() => document.querySelector('.onglets [data-vue="apercu"]').click());
  await pause(300);
  son('zoom', 0.6); await S('suivre', 1.9);
  await v.cliquer(GESTE(2), { ms: 480 });
  await pause(200);
  son('zoom', 0.6); await S('cadrer', 'dialog[open] .modale-corps', { max: 1.7, marge: 30 });
  await v.saisir(LIBELLE, 'Croquettes', { ms: 420, rapide: true });
  await v.saisir(MONTANT, '32', { ms: 380, rapide: true });
  await appli.selectOption('dialog[open] select[name="poste"]', 'courses');
  await appli.focus(MONTANT);
  await v.valider();
  await S('cacherCurseur'); await pause(300);
  const apres = euros(await appli.$eval(TUILE_DEPENSE, (e) => e.innerText));
  if (!apres || apres === v.depense) throw new Error(`Dépense non comptée : ${v.depense} → ${apres}`);
  son('dezoom'); await S('cadrer', TUILE_DEPENSE, { max: 2.0, marge: 40 });
  await S('flash', TUILE_DEPENSE, 'var(--jaune)');
  son('pop'); await S('avantApres', 'd', TUILE_DEPENSE, `${v.depense} €`, `${apres} €`, { couleur: 'var(--jaune)', cote: 'dessous' });
  await S('legende', '<b>2.</b> Une dépense notée, le budget suit tout seul.');
  await pause(1500); await S('retirer'); await S('legende', null);

  // Geste 3 : un bagage coché
  await S('suivre', 1.9);
  await v.cliquer(GESTE(3), { ms: 480 });
  await pause(200);
  // Sélecteur CSS stable pour le studio : l'identifiant de la case, lu dans l'application à partir de son libellé.
  const idCase = await appli.$eval(`${CASE} input`, (i) => i.dataset.id);
  const CASE_CSS = `input[data-type="bagage"][data-id="${idCase}"]`;
  const LIGNE = `label.case:has(${CASE_CSS})`;
  await appli.$eval(CASE_CSS, (i) => i.closest('section').scrollIntoView({ block: 'center' }));
  await pause(200);
  son('zoom', 0.6); await S('cadrer', LIGNE, { max: 2.0, marge: 80 });
  await v.cliquer(CASE_CSS, { ms: 420 });
  await S('cacherCurseur'); await pause(250);
  if (!(await appli.$eval(CASE_CSS, (i) => i.checked))) throw new Error('Case non cochée');
  await S('legende', '<b>3.</b> Les affaires du van et des chiens, cochées.');
  await pause(900);

  // Retour : 3/3
  await appli.evaluate(() => document.querySelector('.onglets [data-vue="apercu"]').click());
  await pause(300);
  const compte = await v.lire(COMPTE);
  const prep = pourcent(await appli.$eval(TUILE_PREP, (e) => e.innerText));
  if (compte !== '3/3') throw new Error(`Compteur inattendu : ${compte}`);
  son('zoom'); await S('cadrer', CARTE, { max: 1.6, marge: 30 });
  await S('flash', CARTE, 'var(--vert)');
  son('tampon'); son('ding', 0.7);
  await S('tampon', 'Prise en main : 3/3', `Préparation ${v.prep} % → ${prep} %`, 'var(--vert)');
  await pause(1600); await S('tamponFin'); await S('legende', null);

  // Fin
  await v.temps(); son('whoosh'); await S('volet');
  await S('outro', { titre: 'Planificateur de voyage', sous: 'Ta démo en van, à ton prénom :<br>qm-engineering.fr/demo/angelique', url: 'Démo gratuite · <b>qm-engineering.fr</b>' });
  son('ding', 0.6);
  await pause(2500);
}
