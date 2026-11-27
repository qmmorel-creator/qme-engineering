// Vidéo 010 · Planning d'équipe et staffing · « Avant : Hugo à 120 %. Un geste. Après : plus personne en surcharge. »
// Type : avant-après (état initial du tableau de bord, un geste réel dans le planning, état final côte à côte).
// Accroche : « Avant : Hugo à 120 %. Un seul geste. » Question persistante : « Une surcharge réglée en un geste ».
// Déroulé : accroche (0-4 s) → tableau de bord, tuile « En surcharge » et barre de Hugo (4-11 s) → Planning,
// clic sur « Maintenance des sites » de Hugo, personne changée pour Julien, aperçu en direct (11-22 s) →
// Enregistrer, total de Hugo 120 % → 100 % (22-26 s) → tableau de bord : surcharge 1 → 0, Julien 60 % → 80 %,
// tampon (26-33 s) → outro.
// Données : démo intégrée du template (« Agence Exemple », personnes et clients fictifs). Toutes les valeurs
// affichées par l'habillage sont LUES dans l'application réelle, avant et après le geste.

export const config = {
  nom: '010-planning-equipe-surcharge',
  produit: 'EQP', type: 'avant-après', titre: 'Avant : Hugo à 120 %. Un geste. Après : plus personne en surcharge.',
  app: '/templates/planning-equipe/?demo',
  largeur: 1280, hauteur: 1600,
  marque: 'QME · Planning d\'équipe',
  url: 'qm-engineering.fr/templates/planning-equipe',
  affiche: 1.8,
  // Musique de la vidéo de présentation QME (« Corporate », litesaturation, licence Pixabay : usage commercial sans attribution).
  musique: { fichier: 'docs/videos/musique/corporate-litesaturation.m4a', bpm: 110, premierTemps: 0.534, debut: 20.170, volume: 0.6 },
};
const T = 60000 / 110; // un temps en ms

const ONGLET = (vue) => `nav button[data-action="vue"][data-vue="${vue}"]`;
const BARRE = (id) => `button.barre-pers[data-id="${id}"]`;
const VAL = (id) => `${BARRE(id)} .bp-val b`;
const LIGNE_HUGO = 'tr:has(th [data-action="personne"][data-id="hugo"])';
const TOTAL_HUGO = `${LIGNE_HUGO} td.pl-total`;
const MAINT = `${LIGNE_HUGO} td:nth-child(2) [data-action="affectation"][aria-label^="Maintenance des sites"]`;
const PERSONNE = 'dialog[open] select[name="personne"]';
const APERCU = 'dialog[open] #apercu-aff';
const ENREGISTRER = 'dialog[open] button[value="ok"]';
let SURCH = ''; // tuile « En surcharge », retrouvée par son titre dans preparer

// La vraie souris quitte l'application (bas du studio, hors fenêtre) : sinon les infobulles de survol
// de l'application (data-info) restent ouvertes sur le résultat.
const ecarter = async (v) => { await v.page.mouse.move(540, 1900); await v.page.waitForTimeout(80); };
const net = (s) => String(s || '').replace(/\s+/g, ' ').trim().replace(/ %/g, '\u00a0%'); // espace insécable avant %

export async function preparer(v) {
  const { appli, page } = v;
  await v.fermerDialogues();
  const i = await appli.$$eval('.tuiles > .tuile', (ts) => ts.findIndex((t) => /en surcharge/i.test(t.querySelector('.surtitre')?.textContent || '')));
  if (i < 0) throw new Error('Tuile « En surcharge » absente');
  SURCH = `.tuiles > .tuile:nth-child(${i + 1})`;
  v.s0 = net(await v.lire(`${SURCH} b`));
  v.s0nom = net(await v.lire(`${SURCH} > span`));
  v.h0 = net(await v.lire(VAL('hugo')));
  v.j0 = net(await v.lire(VAL('julien')));
  // Le cas doit exister : Hugo seul en surcharge, Maintenance des sites sur sa semaine, Julien avec de la place.
  await appli.click(ONGLET('planning')); await page.waitForTimeout(300);
  const maint = await appli.$(MAINT);
  const tot = net(await v.lire(`${TOTAL_HUGO} b`));
  if (v.s0 !== '1' || !/Hugo/.test(v.s0nom) || !/^120/.test(v.h0) || !/^60/.test(v.j0) || !maint || !/^120/.test(tot)) {
    throw new Error(`Données de démo inattendues : ${JSON.stringify({ s0: v.s0, s0nom: v.s0nom, h0: v.h0, j0: v.j0, maint: !!maint, tot })}`);
  }
  // Champs de date en français (piège 8)
  await appli.click(MAINT); await page.waitForTimeout(300);
  const ap = net(await v.lire(APERCU));
  if (!/Hugo/.test(ap) || !/120/.test(ap)) throw new Error(`Aperçu inattendu : ${ap}`);
  await appli.click('dialog[open] button[value="annuler"]'); await page.waitForTimeout(200);
  await v.fermerDialogues();
  await appli.click(ONGLET('tableau')); await page.waitForTimeout(300);
  await v.S('cadrer', null);
  await v.S('fenetre', false);
}

export async function jouer(v) {
  const { S, son, pause } = v;
  const temps = (n = 1) => pause(n * T);

  // Accroche
  son('whoosh', 0.6);
  await S('accroche', ['Avant : Hugo', '!à *120_%* cette semaine.', 'Un *seul* geste.'], T / 2);
  await v.temps();
  son('whoosh'); await S('accrocheSortie');
  await S('question', 'Une surcharge réglée *en un geste*');
  await v.temps(); son('whoosh', 0.7); await S('fenetre', true);

  // AVANT : la tuile et la barre de Hugo
  await v.temps(); son('zoom'); await S('cadrer', [SURCH, BARRE('hugo')], { max: 2.2, marge: 60 });
  await S('legende', '<b>Avant</b> : une personne en surcharge.', 'Avant');
  son('pop'); await S('anneau', 's', SURCH, { couleur: 'var(--rouge)', etiquette: `En surcharge : ${v.s0}`, cote: 'dessous', pulse: false });
  await temps(1);
  son('pop'); await S('anneau', 'h', BARRE('hugo'), { couleur: 'var(--rouge)', etiquette: `Hugo : ${v.h0}`, cote: 'dessous', pulse: false });
  await temps(2);
  await S('retirer');

  // LE GESTE : dans le planning, la maintenance passe à Julien
  await v.temps(); await S('legende', 'Sa maintenance passe à <b>Julien</b>, qui a de la place.');
  son('dezoom', 0.6); await S('suivre', 1.8);
  await v.cliquer(ONGLET('planning'), { ms: 560 });
  await v.temps();
  await S('suivre', 2.3);
  await v.cliquer(MAINT, { ms: 600, fx: 0.4 });
  await temps(1);
  await S('cacherCurseur');
  son('zoom', 0.6); await S('cadrer', [PERSONNE, APERCU], { max: 2.2, marge: 50 });
  const apAvant = net(await v.lire(APERCU));
  await S('anneau', 'a', APERCU, { couleur: 'var(--rouge)', etiquette: 'Hugo : surcharge', cote: 'dessous', pulse: false });
  await temps(1.5);
  await S('retirer', 'a');
  await v.viser(PERSONNE, { ms: 450 });
  await S('appui'); son('clic');
  await v.appli.selectOption(PERSONNE, 'julien');
  await S('touche', 'Julien Michel');
  await v.page.waitForTimeout(250);
  const apApres = net(await v.lire(APERCU));
  if (apApres === apAvant || !/Julien/.test(apApres) || !/pas de surcharge/i.test(apApres)) throw new Error(`Aperçu après choix : ${apApres}`);
  const julienSem = net(await v.lire(`${APERCU} .mois-case b`));
  await S('cacherCurseur');
  son('pop'); await S('anneau', 'a', APERCU, { couleur: 'var(--vert)', etiquette: `Julien : ${julienSem}, pas de surcharge`, cote: 'dessous', pulse: false });
  await temps(2);
  await S('retirer', 'a');
  await S('suivre', 2.2);
  await v.cliquer(ENREGISTRER, { ms: 520 });
  await S('cacherCurseur'); await ecarter(v);

  // Effet local : le total de Hugo
  const h1tot = net(await v.lire(`${TOTAL_HUGO} b`));
  if (/^120/.test(h1tot)) throw new Error(`Total de Hugo inchangé : ${h1tot}`);
  son('glisse', 0.6); await S('cadrer', TOTAL_HUGO, { max: 2.4, marge: 140 });
  await S('flash', TOTAL_HUGO, 'var(--vert)');
  son('pop'); await S('avantApres', 't', `${TOTAL_HUGO} b`, v.h0, h1tot, { couleur: 'var(--vert)', cote: 'dessous', note: 'Hugo cette semaine' });
  await temps(2.5);
  await S('retirer', 't');

  // APRÈS : retour au tableau de bord
  await v.temps(); await S('legende', '<b>Après</b> : le tableau de bord suit.', 'Après');
  son('dezoom'); await S('suivre', 1.6, 0.15);
  await v.cliquer(ONGLET('tableau'), { ms: 560 });
  await S('cacherCurseur'); await ecarter(v);
  const s1 = net(await v.lire(`${SURCH} b`));
  const h1 = net(await v.lire(VAL('hugo')));
  const j1 = net(await v.lire(VAL('julien')));
  if (s1 === v.s0 || h1 === v.h0 || j1 === v.j0) throw new Error(`Tableau de bord inchangé : ${v.s0}→${s1}, ${v.h0}→${h1}, ${v.j0}→${j1}`);
  son('zoom'); await S('cadrer', [SURCH, BARRE('hugo')], { max: 2.2, marge: 60 });
  await v.temps();
  await S('flash', SURCH, 'var(--vert)');
  son('pop'); await S('avantApres', 's', `${SURCH} b`, v.s0, s1, { couleur: 'var(--vert)', cote: 'dessous', note: 'en surcharge' });
  await temps(1);
  son('pop'); await S('avantApres', 'h', VAL('hugo'), v.h0, h1, { couleur: 'var(--vert)', cote: 'dessous', note: 'Hugo' });
  await temps(1.5);
  await S('retirer');
  son('glisse', 0.5); await S('cadrer', BARRE('julien'), { max: 2.4, marge: 90 });
  son('pop'); await S('avantApres', 'j', VAL('julien'), v.j0, j1, { couleur: 'var(--bleu)', cote: 'dessous', note: 'Julien' });
  await temps(1.5);
  await S('retirer', 'j');
  son('dezoom', 0.6); await S('cadrer', SURCH, { max: 2.4, marge: 120 });
  son('trait', 0.6); await S('souligner', 'u', `${SURCH} b`, 'var(--vert)');
  son('eclat'); await S('eclat', SURCH, ['var(--vert)', 'var(--jaune)', 'var(--bleu)']);
  await v.temps(); son('tampon'); son('ding', 0.7);
  await S('tampon', 'Plus personne en surcharge', `Hugo ${v.h0} → ${h1} · Julien ${v.j0} → ${j1}`, 'var(--vert)');
  await temps(3);
  await S('tamponFin'); await S('retirer');

  // Fin
  await v.temps(); son('whoosh'); await S('volet');
  await S('legende', null);
  await S('outro', { titre: 'Planning d\'équipe', sous: 'Qui est trop chargé,<br>qui peut prendre.', url: 'Démo gratuite · <b>qm-engineering.fr</b>' });
  son('ding', 0.6);
  await temps(4);
}
