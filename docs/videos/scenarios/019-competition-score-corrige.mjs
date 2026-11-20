// Vidéo 019 · Gestion de compétition sportive · « Une charge corrigée : le général bouge-t-il ? »
// Type : question (la réponse à une question précise, prouvée à l'écran).
// Fiche :
//   Accroche : « Feuille du juge corrigée : / 107 kg → 113 kg. / Tout le classement à refaire ? »
//   Question persistante : « Une charge corrigée : le général bouge-t-il ? »
//   Déroulé : accroche (0-4 s) → vue Scores, épreuve 3 « Charge maximale », Élite hommes (4-8 s) → ligne de
//   Nathan Benali : charge et rang lus (8-11 s) → saisie réelle de la charge corrigée, Entrée, le rang de l'épreuve
//   se recalcule (11-17 s) → onglet Classement, la ligne de Nathan : rang général et total avant / après (17-24 s)
//   → tampon → outro (24-29 s).
//   Résultat montré : rang à l'épreuve et rang général recalculés aussitôt, sans calcul à la main.
// Données : démo intégrée du template (« Défi d'hiver Exemple », participants fictifs). La seule valeur saisie est la
// charge corrigée (113) ; toutes les autres valeurs de l'habillage (charge d'origine, rangs, totaux) sont LUES dans
// l'application, avant et après le geste.
// Bandeau de démo : il affiche encore « Bientôt en vente » alors que le template est en vente (constat du 20/11/2026,
// commun à de nombreux templates) ; la caméra cadre sous le bandeau, rien n'est masqué ni modifié dans la page.

export const config = {
  nom: '019-competition-score-corrige',
  produit: 'CMP', type: 'question', titre: 'Une charge corrigée : le général bouge-t-il ?',
  app: '/templates/competition/?demo',
  largeur: 1280, hauteur: 1600,
  marque: 'QME · Gestion de compétition',
  url: 'qm-engineering.fr/templates/competition',
  affiche: 4.6,
  musique: 'auto',
  dureeMax: 29,
};

const ATHLETE = 'Nathan Benali';
const NOUVELLE = '113';
const EPREUVE = 'Charge maximale';
const CAT = 'eh'; // Élite hommes

const ONGLET = (vue) => `nav.onglets button.onglet[data-vue="${vue}"]`;
let ID = '';
const LIGNE = () => `li.ligne-score[data-p="${ID}"]`;
const CHAMP = () => `${LIGNE()} input[data-s="valeur"]`;
const RANG_EP = () => `${LIGNE()} .ls-rang > b`;
const NOM_EP = () => `${LIGNE()} .ls-nom > b`;
const TR = () => `table.tableau-classement tr:has(button[data-id="${ID}"])`;
const RANG_G = () => `${TR()} td:first-child > b`;
const TOTAL_G = () => `${TR()} td.total > b`;
// Zone principale, sous le bandeau de démo (y > 120) : plan d'entrée sans le bandeau.
const ZONE_ENTREE = { x: 0, y: 130, w: 1280, h: 1100 };
// Rectangle qui englobe des éléments de l'application (union de leurs boîtes), avec une marge verticale en lignes.
const zone = (v, sels) => v.appli.evaluate((l) => {
  const r = l.flatMap((s) => [...document.querySelectorAll(s)]).map((e) => e.getBoundingClientRect());
  const x = Math.min(...r.map((q) => q.left)), y = Math.min(...r.map((q) => q.top));
  return { x, y, w: Math.max(...r.map((q) => q.right)) - x, h: Math.max(...r.map((q) => q.bottom)) - y };
}, sels);
// Colonnes charge, statut, validé et rang de la ligne de l'athlète et de ses deux voisines.
const ZONE_LIGNE = () => [`li.ligne-score:has(+ ${LIGNE()}) input[data-s="valeur"]`, `${LIGNE()} .ls-rang`, `${LIGNE()} + li.ligne-score .ls-rang`];
// Classement : colonnes rang et participant du podium, puis colonnes É3 et total.
const ZONE_RANGS = ['table.tableau-classement tbody tr:nth-child(-n+3) td:nth-child(1)', 'table.tableau-classement tbody tr:nth-child(-n+3) td:nth-child(2)'];
const ZONE_TOTAUX = ['table.tableau-classement tbody tr:nth-child(-n+3) td:nth-child(5)', 'table.tableau-classement tbody tr:nth-child(-n+3) td.total'];

export async function preparer(v) {
  const { appli, page } = v;
  await v.fermerDialogues();
  // Le cas existe : le classement de départ, puis la ligne de l'épreuve 3.
  await appli.click(ONGLET('classement')); await page.waitForTimeout(400);
  ID = await appli.evaluate((nom) => [...document.querySelectorAll('table.tableau-classement button.lien-nom')].find((b) => b.textContent.trim() === nom)?.dataset.id || '', ATHLETE);
  if (!ID) throw new Error(`${ATHLETE} absent du classement Élite hommes.`);
  v.rangG0 = await v.lire(RANG_G()); v.totalG0 = await v.lire(TOTAL_G());
  if (v.rangG0 !== '3e') throw new Error(`Rang général de départ inattendu : ${v.rangG0}`);
  await appli.click(ONGLET('scores')); await page.waitForTimeout(400);
  const ep = await appli.$eval('button[data-action="choisir-ep"][aria-pressed="true"]', (b) => b.textContent.trim());
  const cat = await appli.$eval('button[data-action="choisir-cat-score"][aria-pressed="true"]', (b) => b.dataset.cat);
  if (!ep.includes(EPREUVE) || cat !== CAT) throw new Error(`Vue Scores inattendue : ${ep} · ${cat}`);
  v.charge0 = await v.lire(CHAMP()); v.rangE0 = await v.lire(RANG_EP());
  if (v.charge0 !== '107' || v.rangE0 !== '4e') throw new Error(`Ligne de départ inattendue : ${v.charge0} · ${v.rangE0}`);
  await appli.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  await v.S('cadrer', ZONE_ENTREE);
  await v.S('fenetre', false);
}

export async function jouer(v) {
  const { S, son, pause, appli } = v;
  const temps = async (n = 1) => { for (let i = 0; i < n; i++) await v.temps(); };

  // Accroche : le problème vécu, un seul son d'entrée
  son('whoosh', 0.6);
  await S('accroche', ['Feuille du juge corrigée :', `${v.charge0}_kg → ${NOUVELLE}_kg.`, '!Tout le *classement* à refaire ?'], 260);
  await temps(2);
  son('whoosh'); await S('accrocheSortie');
  await S('question', 'Une charge corrigée : *le général bouge-t-il* ?');
  await v.temps(); son('whoosh', 0.7); await S('fenetre', true);

  // La ligne de l'athlète : charge et rang lus dans l'application
  await v.temps(); son('zoom'); await S('cadrer', await zone(v, ZONE_LIGNE()), { max: 2.6, marge: 30 });
  son('pop'); await S('anneau', 'c0', CHAMP(), { couleur: 'var(--jaune)', etiquette: ATHLETE, cote: 'dessus', marge: 4 });
  await S('anneau', 'r0', RANG_EP(), { couleur: 'var(--bleu)', etiquette: `${v.rangE0} à l'épreuve`, cote: 'dessus', marge: 6 });
  await S('legende', `${ATHLETE} : <b>${v.charge0} kg</b> notés, <b>${NOUVELLE} kg</b> validés.`);
  await temps(2);
  await S('retirer', 'r0'); await S('retirer', 'c0');

  // Geste réel : la charge corrigée, Entrée
  await S('suivre', 2.4);
  await v.saisir(CHAMP(), NOUVELLE, { ms: 480 });
  await v.valider();
  await pause(250);
  const rangE1 = await v.lire(RANG_EP());
  if (rangE1 === v.rangE0) throw new Error('Le rang de l\'épreuve n\'a pas changé.');
  await S('cadrer', await zone(v, ZONE_LIGNE()), { max: 2.6, marge: 30 });
  await S('flash', RANG_EP(), 'var(--jaune)');
  son('pop'); await S('avantApres', 'r', RANG_EP(), v.rangE0, rangE1, { couleur: 'var(--bleu)', cote: 'dessus', note: 'à l\'épreuve' });
  await S('legende', 'Rang de l\'épreuve recalculé. <b>Et le général ?</b>');
  await temps(2);
  await S('retirer', 'r');

  // Le classement général : rang et total lus après le geste
  son('dezoom', 0.6); await S('suivre', 1.8);
  await v.cliquer(ONGLET('classement'), { ms: 520 });
  await pause(300);
  const rangG1 = await v.lire(RANG_G()), totalG1 = await v.lire(TOTAL_G());
  if (rangG1 === v.rangG0 || totalG1 === v.totalG0) throw new Error(`Classement général inchangé : ${rangG1} · ${totalG1}`);
  son('zoom'); await S('cadrer', await zone(v, ZONE_RANGS), { max: 2.6, marge: 30 });
  await S('flash', TR(), 'var(--jaune)');
  son('pop'); await S('avantApres', 'g', RANG_G(), v.rangG0, rangG1, { couleur: 'var(--bleu)', cote: 'dessous', note: 'au général' });
  await S('legende', `<b>${ATHLETE}</b> passe devant.`);
  await temps(2);
  await S('retirer', 'g');
  son('glisse', 0.5); await S('cadrer', await zone(v, ZONE_TOTAUX), { max: 2.6, marge: 30 });
  son('pop'); await S('avantApres', 't', TOTAL_G(), v.totalG0, totalG1, { couleur: 'var(--rouge)', cote: 'dessous', note: 'total' });
  await S('legende', 'Somme des rangs : le total le plus bas gagne.');
  await v.temps();
  son('eclat'); await S('eclat', TOTAL_G(), ['var(--jaune)', 'var(--bleu)', 'var(--rouge)']);
  await v.temps(); son('tampon'); son('ding', 0.7);
  await S('tampon', `${rangG1} au général`, `total ${v.totalG0} → ${totalG1}, sans calcul`, 'var(--vert)');
  await temps(2);
  await S('tamponFin'); await S('retirer'); await S('cacherCurseur');

  // Fin
  await v.temps(); son('whoosh'); await S('volet');
  await S('legende', null);
  await S('outro', { titre: 'Gestion de compétition sportive', sous: 'Un score saisi,<br>le classement déjà à jour.', url: 'Démo gratuite · <b>qm-engineering.fr</b>' });
  son('ding', 0.6);
  await temps(5);
}
