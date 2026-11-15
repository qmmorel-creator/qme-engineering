// Vidéo 008 · CRM freelance · « Par qui commencer aujourd'hui ? »
// Type : interface (navigation entre les vues Aujourd'hui, Factures avec le filtre « En retard », Chiffres).
// Données : démo intégrée du template (clients fictifs). Toutes les valeurs affichées par l'habillage
// (nombre de relances, retards, montant en retard, part du facturé) sont LUES dans l'application réelle.

export const config = {
  nom: '008-crm-priorite-du-jour',
  produit: 'CRM', type: 'interface', titre: 'Par qui commencer aujourd\'hui ?',
  app: '/templates/crm/?demo',
  largeur: 1280, hauteur: 1600,
  marque: 'QME · CRM freelance',
  url: 'qm-engineering.fr/templates/crm',
  affiche: 1.8,
  // Musique de la vidéo de présentation QME (« Corporate », litesaturation, licence Pixabay : usage commercial sans attribution).
  musique: { fichier: 'docs/videos/musique/corporate-litesaturation.m4a', bpm: 110, premierTemps: 0.534, debut: 20.170, volume: 0.6 },
};
const T = 60000 / 110; // un temps en ms

const TITRE = '.jour-titre h1';
const SOUS = '.jour-titre .sous';
const CARTE1 = '.cartes .carte:first-child';
const RETARD1 = `${CARTE1} .etiquette.rouge`;
const ONGLET = (vue) => `button[data-action="vue"][data-vue="${vue}"]`;
const PUCE_RETARD = 'button[data-action="filtre-docs"][data-id="retard"]';
const LISTE = '.liste-cadre';
const TUILE_RETARD = '.tuiles .tuile:nth-child(3)';
const CLIENT1 = 'table.clients tbody tr:first-child';

export async function preparer(v) {
  const { appli, page } = v;
  await v.fermerDialogues(); // guide d'accueil du premier lancement, hors caméra
  // Contrôle du cas : la première relance du jour est en retard, et son client est celui des factures en retard
  // et le premier du tableau « Par client ».
  const entreprise1 = (await appli.$eval(`${CARTE1} .carte-meta-haut`, (e) => e.firstChild.textContent.trim()));
  const retard1 = await appli.$(RETARD1);
  const facturesRetard = await appli.$$eval('.doc-ligne', (ls) => ls.filter((l) => l.querySelector('.etiquette.rouge')).map((l) => l.querySelector('.doc-objet b').textContent.trim()));
  await appli.click(ONGLET('chiffres')); await page.waitForTimeout(300);
  const client1 = await appli.$eval(`${CLIENT1} td:first-child b`, (e) => e.textContent.trim());
  await appli.click(ONGLET('aujourdhui')); await page.waitForTimeout(300);
  const filtre = await appli.$eval('.jour-titre h1', (e) => e.textContent);
  if (!retard1 || !facturesRetard.length || facturesRetard.some((n) => n !== entreprise1) || client1 !== entreprise1 || !/relance/.test(filtre)) {
    throw new Error(`Données de démo inattendues : ${JSON.stringify({ entreprise1, retard1: !!retard1, facturesRetard, client1, filtre })}`);
  }
  v.entreprise = entreprise1;
  await v.S('cadrer', null);
  await v.S('fenetre', false);
}

export async function jouer(v) {
  const { S, son, pause } = v;
  const temps = (n = 1) => pause(n * T);

  // Accroche : un seul son d'entrée
  son('whoosh', 0.6);
  await S('accroche', ['Des relances,', 'des factures en retard.', '!Par qui *commencer_?*'], T / 2);
  await v.temps();
  son('whoosh'); await S('accrocheSortie');
  await S('question', 'Par qui *commencer* aujourd\'hui ?');
  await v.temps(); son('whoosh', 0.7); await S('fenetre', true);

  // Écran 1 : Aujourd'hui
  await v.temps(); son('zoom'); await S('cadrer', TITRE, { max: 2.3, marge: 60 });
  const nbRelances = (await v.lire(`${TITRE} mark`));
  const enRetard = (await v.lire(`${SOUS} b`));
  await v.temps(); son('pop');
  await S('anneau', 'j', `${TITRE} mark`, { etiquette: `${nbRelances} · dont ${enRetard}`, cote: 'dessous', marge: 6 });
  await S('legende', `L'écran <b>Aujourd'hui</b> liste qui relancer.`);
  await temps(2.5);
  await S('retirer', 'j');
  await v.temps(); son('zoom', 0.7); await S('cadrer', [`${CARTE1} .carte-meta-haut`, `${CARTE1} h3`], { max: 2.5, marge: 60 });
  const retard = await v.lire(RETARD1);
  const action1 = await v.lire(`${CARTE1} h3`);
  await v.temps(); await S('flash', CARTE1, 'var(--rose)');
  son('pop'); await S('anneau', 'r', RETARD1, { couleur: 'var(--rouge)', etiquette: `En tête : ${(retard.match(/(\d+)\s*j/) || [])[1]} j de retard`, cote: 'dessus', marge: 6 });
  await S('legende', `Les retards en tête : <b>${action1.split('·')[0].trim().toLowerCase()}</b>.`);
  await temps(2.5);
  await S('retirer');

  // Écran 2 : Factures, filtre « En retard »
  await v.temps(); await S('legende', `Combien en retard ? L'onglet <b>Factures</b>.`);
  son('dezoom'); await S('suivre', 1.5, 0.15);
  await v.cliquer(ONGLET('factures'), { ms: 520 });
  await v.temps(2);
  await v.cliquer(PUCE_RETARD, { ms: 480 });
  const lignes = await v.appli.$$eval(`${LISTE} .doc-ligne`, (ls) => ls.map((l) => l.querySelector('.doc-objet b').textContent.trim()));
  if (!lignes.length || lignes.some((n) => n !== v.entreprise)) throw new Error(`Filtre « En retard » inattendu : ${JSON.stringify(lignes)}`);
  son('zoom'); await S('cadrer', [TUILE_RETARD, PUCE_RETARD, `${LISTE} .doc-ligne:last-child .doc-objet`], { max: 2.2, marge: 30 });
  const montant = await v.lire(`${TUILE_RETARD} b`);
  const detail = await v.lire(`${TUILE_RETARD} span`);
  await v.temps();
  await S('flash', LISTE, 'var(--rose)');
  son('pop'); await S('anneau', 'm', TUILE_RETARD, { couleur: 'var(--rouge)', etiquette: `${montant} en retard`, cote: 'dessous', pulse: false, marge: 6 });
  son('trait', 0.6); await S('souligner', 's', `${TUILE_RETARD} b`, 'var(--rouge)');
  await S('legende', `${detail.replace(/\.$/, '')}, <b>un seul client</b>.`);
  await temps(2.5);
  await S('retirer');

  // Écran 3 : Chiffres, tableau par client
  await v.temps(); await S('legende', `Et ce client pèse combien ? <b>Chiffres</b>.`);
  son('dezoom'); await S('suivre', 1.5, 0.15);
  await v.cliquer(ONGLET('chiffres'), { ms: 520 });
  son('zoom'); await S('cadrer', ['table.clients thead th:first-child', `${CLIENT1} td:first-child b`, `${CLIENT1} td:nth-child(4)`], { max: 2.3, marge: 30 });
  const part = await v.lire(`${CLIENT1} td:last-child small`);
  const reste = await v.lire(`${CLIENT1} td:nth-child(4)`);
  await v.temps();
  await S('flash', CLIENT1, 'var(--ciel)');
  son('pop'); await S('anneau', 'p', `${CLIENT1} td:first-child b`, { couleur: 'var(--bleu)', etiquette: `1er client : ${part} du facturé`, cote: 'dessous', pulse: false, marge: 6 });
  await v.temps(2);
  son('pop'); await S('anneau', 'm', `${CLIENT1} td:nth-child(4)`, { couleur: 'var(--rouge)', etiquette: `${reste} dus`, cote: 'dessous', pulse: false, marge: 2 });
  await v.temps(); son('tampon'); son('ding', 0.7);
  await S('tampon', 'Priorité du jour', v.entreprise, 'var(--rouge)');
  await temps(2.6);
  await S('tamponFin'); await S('retirer'); await S('cacherCurseur');

  // Fin
  await v.temps(); son('whoosh'); await S('volet');
  await S('legende', null);
  await S('outro', { titre: 'CRM freelance', sous: 'Chaque matin, qui relancer<br>et ce qui reste à encaisser.', url: 'Démo gratuite · <b>qm-engineering.fr</b>' });
  son('ding', 0.6);
  await temps(4);
}
