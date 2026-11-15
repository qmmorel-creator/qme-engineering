// Vidéo 005 · Pack Argent du quotidien · « Un essai devient payant, des courses à noter, et qui doit quoi ? »
// Type : pack. Fil conducteur : le mois de Camille et Sami, en trois templates du pack et trois gestes réels.
//   1. Suivi des abonnements : l'essai gratuit qui finit bientôt est marqué « À résilier » → tuile Économies.
//   2. Budget du foyer : une dépense de courses de 84 € → « Il reste … dans tes enveloppes ».
//   3. Budget commun : les mêmes courses, payées par Sami → « Sami doit … à Camille ».
// Données : démos intégrées des templates (foyer fictif). Toutes les valeurs de l'habillage sont LUES dans l'application.

export const config = {
  nom: '005-pack-argent-mois-a-deux',
  produit: 'PAQ', type: 'pack', titre: 'Le mois de Camille et Sami en trois gestes',
  app: '/templates/abonnements/?demo',
  largeur: 1280, hauteur: 1600,
  marque: 'QME · Pack Argent du quotidien',
  url: 'qm-engineering.fr/templates/abonnements',
  affiche: 3.2,
  // Même musique que le modèle validé (gantt-retard) : « Corporate », litesaturation, licence Pixabay.
  musique: { fichier: 'docs/videos/musique/corporate-litesaturation.m4a', bpm: 110, premierTemps: 0.534, debut: 20.170, volume: 0.6 },
};
const T = 60000 / 110; // un temps en ms

// 1. Suivi des abonnements
const ESSAI_NOM = 'Application de coaching sportif';
const ESSAI = '.decisions > article:nth-of-type(2)';            // contrôlé dans preparer (nom et étiquette)
const ECO = '.tuiles > .tuile:last-child';                        // tuile « Économies »
// 2. Budget du foyer
const RESTE = 'h1 mark';
const ALIM = '[data-action="enveloppe"][data-id="alimentation"]';
// 3. Budget commun
const DOIT = 'h1 mark';
const MONTANT = '84';

// Cadre de la phrase-résultat : du début de la phrase au montant surligné (et un peu après), avec la place de
// l'étiquette avant → après dessous. Le h1 occupe toute la largeur : le cadrer entier donnerait un plan trop large.
const autour = (v, sel) => v.appli.$eval(sel, (e) => { const r = e.getBoundingClientRect();
  return { x: 50, y: r.top - 40, w: r.right + 150 - 50, h: r.height + 160 }; });
const euros = (t) => t.replace(/\s+/g, '\u00a0').trim(); // espaces insécables : « 270,56 € » ne se coupe pas

export async function preparer(v) {
  const { appli } = v;
  await v.fermerDialogues();
  const nom = await v.lire(`${ESSAI} .decision-corps b`);
  const etiquette = await v.lire(`${ESSAI} .etiquette`);
  const surtitre = await v.lire(`${ECO} .surtitre`);
  if (nom !== ESSAI_NOM || !/essai/i.test(etiquette) || !/conomies/i.test(surtitre) || !(await appli.$(`${ESSAI} [data-action="a-resilier"]`)))
    throw new Error(`Démo abonnements inattendue : ${nom} / ${etiquette} / ${surtitre}`);
  await v.S('cadrer', null);
  await v.S('fenetre', false);
}

// Changement de template derrière le volet, la fenêtre sortie pendant le chargement.
// v.ouvrir n'est pas utilisé ici : son fermerDialogues clique le bouton « Fermer » du guide par Playwright ; quand ce
// bouton n'est pas visible dans la page du studio (fenêtre sortie, ou hors du cadre zoomé), chaque clic attend 30 s
// avant d'échouer en silence (3 essais : 90 s figées dans la vidéo, guide resté ouvert). On fait donc la même chose
// que v.ouvrir (S.changerApp puis nouveau cadre), et le guide est fermé par son propre bouton, déclenché dans la page.
async function changer(v, slug, question) {
  v.son('whoosh');
  await Promise.all([v.S('volet'), v.S('fenetre', false), v.S('legende', null)]);
  await v.S('changerApp', `/templates/${slug}/?demo`, { url: `qm-engineering.fr/templates/${slug}` });
  v.appli = v.page.frames().find((f) => f !== v.page.mainFrame());
  // Le guide du premier lancement s'ouvre ~300 ms après l'initialisation : on l'attend, puis on le ferme.
  for (let i = 0; i < 40 && !(await v.appli.$('dialog[open]')); i++) await v.pause(100);
  await v.appli.evaluate(() => document.querySelector('dialog[open] [data-action="fermer"]')?.click());
  await v.pause(250);
  if (await v.appli.$('dialog[open]')) throw new Error(`Guide de ${slug} resté ouvert`);
  await v.S('question', question);
  await v.S('cadrer', await autour(v, 'h1 mark'), { max: 2.2, marge: 30 });
  v.son('whoosh', 0.7); await v.S('fenetre', true);
}
async function formulaireOuvert(v) {
  const titre = await v.appli.$eval('dialog[open] h2', (e) => e.textContent).catch(() => null);
  if (titre !== 'Nouvelle dépense') throw new Error(`Formulaire non ouvert (${titre})`);
}

// Contrôles après chaque changement de template (lèvent une erreur si la démo n'a pas le cas attendu).
async function verifierBudget(v) {
  const h1 = await v.lire('h1');
  if (!/Il reste/.test(h1) || !(await v.appli.$(ALIM)) || !(await v.appli.$('[data-action="operation"]')))
    throw new Error(`Démo budget inattendue : ${h1}`);
}
async function verifierCommun(v) {
  const h1 = await v.lire('h1');
  if (!/^Sami doit .* à Camille/.test(h1.replace(/\s+/g, ' ')) || !(await v.appli.$('[data-action="depense-nouvelle"]')))
    throw new Error(`Démo budget commun inattendue : ${h1}`);
}

export async function jouer(v) {
  const { S, son, pause } = v;
  const temps = (n = 1) => pause(n * T);

  // Accroche
  son('whoosh', 0.6);
  await S('accroche', ['Un essai devient *payant*,', 'des courses à noter,', '!et *qui_doit_quoi ?*'], T / 2);
  await v.temps();
  son('whoosh'); await S('accrocheSortie');
  await S('question', '1 · Vos *abonnements*');
  await v.temps(); son('whoosh', 0.7); await S('fenetre', true);

  // 1. Abonnements : l'essai qui finit bientôt
  son('zoom'); await S('cadrer', ESSAI, { max: 2.3, marge: 40 });
  const limite = (await v.lire(`${ESSAI} .decision-titre`)).replace(/^À décider avant le\s*/, '').replace(/\s*\d{4}$/, '');
  await S('legende', `L'essai devient payant le <b>${limite}</b>.`, '1/3');
  await v.temps();
  await S('suivre', 2.3);
  const eco0 = euros(await v.lire(`${ECO} b`));
  await v.cliquer(`${ESSAI} [data-action="a-resilier"]`, { ms: 520 });
  await S('flash', ESSAI, 'var(--ciel)');
  son('zoom'); await S('cadrer', ECO, { max: 2.4, marge: 60 });
  const eco1 = euros(await v.lire(`${ECO} b`));
  if (eco1 === eco0) throw new Error('La tuile Économies n\'a pas changé');
  await S('flash', ECO, 'var(--vert)');
  son('pop'); await S('avantApres', 'eco', `${ECO} b`, eco0, eco1, { couleur: 'var(--vert)', cote: 'dessous', note: 'par an, décidé à temps' });
  await temps(1.5);
  await S('retirer');

  // 2. Budget du foyer : les courses
  await v.temps(); await changer(v, 'budget', '2 · Votre *budget* du mois');
  await verifierBudget(v);
  const reste0 = euros(await v.lire(RESTE));
  await S('legende', `Les courses : <b>${MONTANT} €</b>.`, '2/3');
  son('zoom', 0.7); await S('suivre', 2.2);
  await v.cliquer('[data-action="operation"][data-type="depense"]', { ms: 480 });
  await formulaireOuvert(v);
  await v.saisir('dialog[open] input[name="montant"]', MONTANT, { ms: 450 });
  await v.viser('dialog[open] select[name="categorie"]', { ms: 380 });
  await v.appli.focus('dialog[open] select[name="categorie"]');
  await S('touche', 'A'); son('touche'); await v.page.keyboard.type('a'); await pause(200);
  const cat = await v.appli.$eval('dialog[open] select[name="categorie"]', (s) => s.selectedOptions[0].textContent);
  if (cat !== 'Alimentation') throw new Error(`Catégorie inattendue : ${cat}`);
  await v.cliquer('dialog[open] button[value="ok"]', { ms: 450 });
  son('dezoom'); await S('cadrer', await autour(v, 'h1 mark'), { max: 2.2, marge: 30 });
  const reste1 = euros(await v.lire(RESTE));
  const alim = await v.lire(`${ALIM} .etiquette`);
  if (reste1 === reste0) throw new Error('« Il reste » n\'a pas changé');
  await S('flash', RESTE, 'var(--jaune)');
  son('pop'); await S('avantApres', 'reste', RESTE, reste0, reste1, { couleur: 'var(--bleu)', cote: 'dessous', note: `Alimentation : ${alim.toLowerCase()}` });
  son('trait', 0.6); await S('souligner', 's', RESTE, 'var(--bleu)');
  await temps(1.5);
  await S('retirer');

  // 3. Budget commun : qui a payé les courses
  await v.temps(); await changer(v, 'budget-commun', '3 · Vos comptes *à deux*');
  await verifierCommun(v);
  const doit0 = euros(await v.lire(DOIT));
  await S('legende', `Sami a payé les courses.`, '3/3');
  son('zoom', 0.7); await S('suivre', 2.2);
  await v.cliquer('[data-action="depense-nouvelle"]', { ms: 480 });
  await formulaireOuvert(v);
  await v.saisir('dialog[open] input[name="libelle"]', 'Courses', { ms: 420 });
  await v.saisir('dialog[open] input[name="montant"]', MONTANT, { ms: 380 });
  await v.viser('dialog[open] select[name="payeur"]', { ms: 380 });
  await v.appli.focus('dialog[open] select[name="payeur"]');
  await S('touche', 'S'); son('touche'); await v.page.keyboard.type('s'); await pause(200);
  const payeur = await v.appli.$eval('dialog[open] select[name="payeur"]', (s) => s.selectedOptions[0].textContent);
  const mode = await v.lire('dialog[open] input[name="mode"]:checked + span');
  if (payeur !== 'Sami') throw new Error(`Payeur inattendu : ${payeur}`);
  await v.cliquer('dialog[open] button[value="ok"]', { ms: 450 });
  son('dezoom'); await S('cadrer', await autour(v, 'h1 mark'), { max: 2.2, marge: 30 });
  const doit1 = euros(await v.lire(DOIT));
  if (doit1 === doit0) throw new Error('Le solde n\'a pas changé');
  await S('flash', DOIT, 'var(--vert)');
  son('pop'); await S('avantApres', 'doit', DOIT, doit0, doit1, { couleur: 'var(--vert)', cote: 'dessous', note: `réparti au ${mode.toLowerCase()} des revenus` });
  son('eclat'); await S('eclat', DOIT, ['var(--vert)', 'var(--jaune)', 'var(--bleu)']);
  await v.temps(); son('tampon'); son('ding', 0.7);
  await S('tampon', `Sami doit ${doit1}`, 'soldes recalculés, au centime près', 'var(--vert)');
  await temps(1.6);
  await S('tamponFin'); await S('retirer'); await S('cacherCurseur');

  // Fin
  await v.temps(); son('whoosh'); await S('volet');
  await S('legende', null);
  await S('outro', { titre: 'Pack Argent du quotidien', sous: 'Abonnements, budget, comptes à deux :<br>l’argent du mois tenu.', url: 'Démo gratuite · <b>qm-engineering.fr</b>' });
  son('ding', 0.6);
  v.valeurs = { limite, eco0, eco1, reste0, reste1, alim, doit0, doit1, mode, payeur, cat };
  console.log('Valeurs lues :', JSON.stringify(v.valeurs));
  await temps(3);
}
