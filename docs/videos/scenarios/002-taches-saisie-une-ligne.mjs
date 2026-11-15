// Vidéo 002 · Gestionnaire de tâches · Astuce : touche N, puis une seule ligne de texte remplit projet, criticité,
// durée, heure et date de la tâche.
// Données : démo intégrée du template (utilisatrice fictive « Camille »). Toutes les valeurs affichées par l'habillage
// (pastilles reconnues, compteur de la boîte, méta de la tâche créée) sont LUES dans l'application réelle après le geste.

export const config = {
  nom: '002-taches-saisie-une-ligne',
  produit: 'TCH', type: 'astuce', titre: 'Une tâche complète en une seule ligne',
  app: '/templates/taches/?demo',
  largeur: 1280, hauteur: 1600,
  marque: 'QME · Gestionnaire de tâches',
  url: 'qm-engineering.fr/templates/taches',
  affiche: 1.8,
  // Musique identique au modèle validé (gantt-retard.mjs).
  musique: { fichier: 'docs/videos/musique/corporate-litesaturation.m4a', bpm: 110, premierTemps: 0.534, debut: 20.170, volume: 0.6 },
};
const T = 60000 / 110; // un temps en ms

const TITRE = 'Rappeler Martin';
const LIGNE = `${TITRE} vendredi 10h !haute #Clients 30min`;
const PROJET = 'Clients';
const COMPTEUR = '[data-action="vue"][data-vue="boite"] .compteur';
const ONGLET_BOITE = '[data-action="vue"][data-vue="boite"]';
const MODALE = '#modale';
const CHAMP = '#saisie-modale';
const PUCES = '#form-saisie-modale .puces';
const PUCE = (k) => `${PUCES} .puce:nth-child(${k})`;
const NOUVELLE = `.boite-el:has(button[aria-label="Faite tout de suite : ${TITRE}"])`;

export async function preparer(v) {
  const { appli, page } = v;
  await v.fermerDialogues(); // guide « Comment ça marche » du premier lancement, hors caméra
  await page.waitForTimeout(200);
  // La démo doit contenir le projet « Clients », une boîte non vide, et pas encore la tâche de la vidéo.
  const metas = await appli.$$eval('.tache-meta', (es) => es.map((e) => e.textContent).join(' '));
  if (!metas.includes(PROJET)) throw new Error(`Projet « ${PROJET} » absent de la démo`);
  v.boite0 = await v.lire(COMPTEUR);
  if (!/^\d+$/.test(v.boite0)) throw new Error(`Compteur de la boîte illisible : « ${v.boite0} »`);
  if (await appli.$(NOUVELLE)) throw new Error('La tâche de la vidéo existe déjà dans la démo');
  // Le clavier doit aller à l'application (touche N) : focus dans le cadre, sur le corps de la page.
  await appli.evaluate(() => { document.activeElement?.blur(); document.body.focus(); });
  await v.S('cadrer', null);
  await v.S('fenetre', false);
}

export async function jouer(v) {
  const { S, son, pause, page } = v;
  const temps = (n = 1) => pause(n * T);

  // Accroche : le problème (un seul son d'entrée)
  son('whoosh', 0.6);
  await S('accroche', ['Date, heure, projet,', 'durée, priorité :', '*5_champs* par tâche ?'], T / 2);
  await v.temps();
  son('whoosh'); await S('accrocheSortie');
  await S('question', 'Une tâche en *une ligne*');
  await v.temps(); son('whoosh', 0.7); await S('fenetre', true);

  // Repère : la boîte de réception et son compteur
  await v.temps(); son('zoom'); await S('cadrer', ONGLET_BOITE, { max: 2.4, marge: 220 });
  await v.temps(); son('pop'); await S('anneau', 'b', ONGLET_BOITE, { etiquette: `Boîte : ${v.boite0}`, cote: 'dessous', marge: 6 });
  await S('legende', 'Astuce : la touche <b>N</b>, depuis n\'importe quel écran.');
  await temps(1.5);
  await S('retirer', 'b');

  // Le geste : touche N (vrai clavier), la saisie rapide s'ouvre
  await v.temps();
  await S('touche', 'N'); son('touche'); await page.keyboard.press('n');
  await pause(250);
  if (!(await v.appli.$('#modale[open]'))) throw new Error('La touche N n\'a pas ouvert la saisie rapide');
  son('zoom'); await S('cadrer', '#form-saisie-modale', { max: 2.6, marge: 24 });
  await S('legende', 'Une phrase, <b>en français courant</b>.');

  // Frappe réelle ; l'application reconnaît chaque élément au fil de la frappe
  await v.saisir(CHAMP, LIGNE, { ms: 450 });
  const puces = await v.appli.$$eval(`${PUCES} .puce`, (es) => es.map((e) => e.textContent.trim()));
  if (puces.length < 6 || puces[0] !== TITRE) throw new Error(`Pastilles inattendues : ${JSON.stringify(puces)}`);
  v.puces = puces;
  // Le curseur s'écarte des pastilles pour les laisser lisibles.
  const loin = await S('pointeur', '#form-saisie-modale label.case', 0.85, 0.5);
  await S('curseurVers', loin.x, loin.y, 400);
  await v.temps();
  await S('flash', PUCES, 'var(--jaune)');
  await S('legende', `<b>${puces.length - 1} informations</b> reconnues.`);
  const couleurs = ['var(--rouge)', 'var(--bleu)', 'var(--vert)', 'var(--jaune)', 'var(--rose)'];
  for (let k = 2; k <= puces.length; k++) {
    await v.temps(2); son('pop', 0.7); await S('souligner', `p${k}`, PUCE(k), couleurs[(k - 2) % couleurs.length]);
  }
  await temps(1.5);
  await S('retirer');

  // Entrée : la tâche part dans la boîte
  await S('legende', '<b>Entrée</b> : la tâche part dans la boîte.');
  await v.temps(); await v.valider();
  await pause(300);
  await v.temps(); await S('touche', 'Échap'); son('touche'); await page.keyboard.press('Escape');
  await pause(200);
  son('dezoom'); await S('cadrer', ONGLET_BOITE, { max: 2.8, marge: 130 });
  const boite1 = await v.lire(COMPTEUR);
  if (Number(boite1) !== Number(v.boite0) + 1) throw new Error(`Compteur de la boîte : ${v.boite0} → ${boite1}`);
  v.boite1 = boite1;
  await v.temps();
  await S('flash', ONGLET_BOITE, 'var(--ciel)');
  son('pop'); await S('avantApres', 'c', COMPTEUR, v.boite0, boite1, { couleur: 'var(--bleu)', cote: 'dessous', note: 'une tâche de plus' });
  await temps(2.5);
  await S('retirer', 'c');

  // Ouvrir la boîte : la tâche est rangée, tout est rempli
  await S('legende', 'Dans la boîte de réception :');
  son('zoom', 0.7); await S('suivre', 2.0);
  await v.cliquer(ONGLET_BOITE, { ms: 450 });
  await pause(200);
  if (!(await v.appli.$(NOUVELLE))) throw new Error('Tâche absente de la boîte après la saisie');
  const meta = await v.appli.$$eval(`${NOUVELLE} .tache-meta > span`, (es) => es.map((e) => e.textContent.trim()));
  v.meta = meta;
  son('zoom'); await S('cadrer', [`${NOUVELLE} .tache-corps b`, `${NOUVELLE} .tache-meta`], { max: 2.8, marge: 70 });
  await v.temps();
  await S('flash', NOUVELLE, 'var(--vert)');
  const resume = meta.filter((m) => !m.startsWith('saisie')).join(' · ');
  son('pop'); await S('anneau', 'n', `${NOUVELLE} .tache-meta`, { couleur: 'var(--vert)', etiquette: resume, cote: 'dessous', pulse: false, marge: 6 });
  await v.temps(); son('eclat'); await S('eclat', NOUVELLE, ['var(--vert)', 'var(--jaune)', 'var(--bleu)']);
  await v.temps(); son('tampon'); son('ding', 0.7);
  const crit = puces.find((p) => p.startsWith('Criticité')) || '';
  await S('tampon', 'Une ligne, une tâche complète', `${resume} · ${crit.toLowerCase()}`, 'var(--vert)');
  await temps(2.6);
  await S('tamponFin'); await S('retirer'); await S('cacherCurseur');

  // Fin
  await v.temps(); son('whoosh'); await S('volet');
  await S('legende', null);
  await S('outro', { titre: 'Gestionnaire de tâches', sous: 'Notez vite : une ligne,<br>la tâche est remplie.', url: 'Démo gratuite · <b>qm-engineering.fr</b>' });
  son('ding', 0.6);
  await temps(4);
}
