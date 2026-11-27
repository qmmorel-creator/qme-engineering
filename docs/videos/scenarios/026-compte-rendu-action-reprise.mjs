// Vidéo 026 · Compte rendu et plan d'actions · « Une action en retard : la réunion suivante l'a-t-elle oubliée ? »
// Type : démonstration (une fonctionnalité de bout en bout : la reprise des actions ouvertes d'une série).
// Fiche :
//   Accroche (dès la 1re image, accent rouge) : « Une action / en retard de 6 jours. / Personne ne l'a revue. »
//   Bascule (question persistante) : « La réunion suivante l'a-t-elle oubliée ? »
//   Déroulé : accroche (0-3 s) → écran Réunions, carte du comité : 4 actions ouvertes, 1 en retard (3-7 s) → geste réel :
//   « Réunion suivante », la fenêtre annonce les actions reprises, « Créer la réunion » (7-13 s) → le nouveau compte rendu
//   s'ouvre sur le suivi : l'action en retard en tête (13-18 s) → geste réel : elle est cochée « Fait », le compteur
//   passe de 4 à 3 ouvertes (18-23 s) → tampon (23-25 s) → outro (25-29 s).
// Données : démo intégrée du template (comité de pilotage fictif). Aucune valeur saisie : tous les chiffres de l'habillage
// (actions ouvertes, retard, compteur du suivi, avant et après) sont LUS dans l'application ; preparer échoue si la
// démo ne contient pas le cas (une action en retard reprise par la réunion suivante du comité).

export const config = {
  nom: '026-compte-rendu-action-reprise',
  produit: 'CRA', type: 'démonstration', titre: 'Une action en retard : la réunion suivante l\'a-t-elle oubliée ?',
  app: '/templates/compte-rendu/?demo',
  largeur: 1280, hauteur: 1600,
  marque: 'QME · Compte rendu et plan d\'actions',
  url: 'qm-engineering.fr/templates/compte-rendu',
  affiche: 1.2,
  musique: 'auto',
  dureeMax: 29,
};

const SERIE = 'Comité de pilotage · refonte du site';
const propre = (t) => String(t).replace(/[\s  ]+/g, ' ').trim();
const nb = (t) => propre(t).replace(/ /g, '_');
const MODALE_AIDE = '#aide-reunion';
const CREER = '#modale button[value="ok"]';
const SUIVI = '.bloc-suivi';
const SUIVI_COMPTE = '.bloc-suivi .bloc-titre span';
const RETARD = '.bloc-suivi .action[data-etat="retard"]';

export async function preparer(v) {
  const { appli, page } = v;
  await v.fermerDialogues();
  await page.waitForTimeout(400);
  // Carte de la série « Comité de pilotage » : identifiant lu dans la page (généré à chaque démo)
  const id = await appli.evaluate((nom) => {
    const c = [...document.querySelectorAll('article.serie')].find((a) => a.querySelector('h2')?.textContent.trim() === nom);
    return c?.querySelector('[data-action="reunion-nouvelle"][data-serie]')?.dataset.serie || null;
  }, SERIE);
  if (!id) throw new Error('Série du comité absente de la démo');
  v.carte = `article.serie:has([data-serie="${id}"])`;
  v.suivante = `${v.carte} [data-action="reunion-nouvelle"][data-serie="${id}"]`;
  v.chiffres = `${v.carte} .serie-chiffres`;
  v.ouvertes = propre(await v.lire(`${v.carte} .serie-chiffres div:nth-child(2) b`));
  v.enRetard = propre(await v.lire(`${v.carte} .serie-chiffres div:nth-child(3) b`));
  if (!(Number(v.ouvertes) >= 2 && Number(v.enRetard) >= 1)) throw new Error(`Démo inattendue : ${v.ouvertes} ouvertes, ${v.enRetard} en retard`);
  // Le retard de l'action la plus en retard, lu dans le compte rendu précédent du comité (hors caméra, sans rien modifier)
  await appli.click(`${v.carte} [data-action="ouvrir-reunion"] >> nth=0`);
  await page.waitForTimeout(500);
  const retards = await appli.$$eval('.action[data-etat="retard"] .ech', (l) => l.map((e) => e.textContent.trim()));
  const jours = retards.map((t) => Number((t.match(/(\d+)\s*jours?/) || [])[1] || 0));
  v.jours = Math.max(0, ...jours);
  if (!v.jours) throw new Error(`Aucun retard lisible : ${JSON.stringify(retards)}`);
  await appli.click('[data-action="vue"]:has-text("Réunions")');
  await page.waitForTimeout(400);
  await appli.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  await v.S('cadrer', null);
  await v.S('fenetre', false);
  await page.waitForTimeout(1500);
}

export async function jouer(v) {
  const { S, son, pause, appli } = v;
  const temps = async (n = 1) => { for (let i = 0; i < n; i++) await v.temps(); };
  const joursTxt = `${v.jours}_jours`;

  // Accroche entière dès la première image (couleur dominante : rouge), un seul son d'entrée
  son('whoosh', 0.6);
  await S('accroche', ['Une action', `!en retard de *${joursTxt}*.`, 'Personne ne l\'a revue.'], 0);
  await temps(4);
  son('whoosh'); await S('accrocheSortie');
  await S('question', 'La réunion suivante *l\'a_oubliée* ?');
  await v.temps(); son('whoosh', 0.7); await S('fenetre', true);

  // La série du comité : actions ouvertes, dont une en retard
  await v.temps(); son('zoom'); await S('cadrer', v.carte, { max: 2.2, marge: 24 });
  son('pop'); await S('anneau', 'r0', `${v.chiffres} div:nth-child(3)`, { couleur: 'var(--rouge)', etiquette: `${v.enRetard} en retard`, cote: 'dessous', marge: 6 });
  await S('legende', `Comité de pilotage : <b>${v.ouvertes} actions</b> encore ouvertes.`);
  await temps(2);
  await S('retirer', 'r0');

  // Geste réel : préparer la réunion suivante
  await S('legende', 'Prochain comité : <b>Réunion suivante</b>.');
  await S('suivre', 2.2);
  await v.cliquer(v.suivante, { ms: 520 });
  await pause(350);
  const aide = propre(await v.lire(MODALE_AIDE));
  const reprises = (aide.match(/(\d+)\s+actions? ouvertes? reprises/) || [])[1];
  if (reprises !== v.ouvertes) throw new Error(`Fenêtre inattendue : ${aide}`);
  son('zoom', 0.5); await S('cadrer', ['#modale .modale-corps', CREER], { max: 2.2, marge: 24 });
  await S('flash', MODALE_AIDE, 'var(--jaune)');
  await S('legende', `<b>${reprises} actions ouvertes</b> reprises d'office.`);
  await temps(2);
  await S('suivre', 2.2);
  await v.cliquer(CREER, { ms: 450 });
  await pause(400);

  // Le nouveau compte rendu s'ouvre sur le suivi : l'action en retard en tête
  const compte0 = propre(await v.lire(SUIVI_COMPTE));
  const ech = propre(await v.lire(`${RETARD} .ech`));
  const quoi = propre(await v.lire(`${RETARD} .action-texte`));
  if (!new RegExp(`${v.jours}\\s*jours?`).test(ech) || !/^\d+ encore ouvertes? sur \d+$/.test(compte0)) {
    throw new Error(`Suivi inattendu : ${compte0} · ${ech}`);
  }
  son('dezoom', 0.5); await S('cadrer', SUIVI, { max: 2.2, marge: 20 });
  await S('flash', RETARD, 'var(--rouge)');
  son('alerte', 0.5); await S('anneau', 'r1', `${RETARD} .ech`, { couleur: 'var(--rouge)', etiquette: 'reprise en tête', cote: 'dessous', marge: 4 });
  await S('legende', `En tête du suivi : <b>${quoi}</b>.`);
  await temps(3);
  await S('retirer', 'r1');

  // Geste réel : l'action est faite, on la coche
  const idAction = await appli.$eval(`${RETARD} [data-action="statut"]`, (b) => b.dataset.id);
  const COCHE = `.bloc-suivi [data-action="statut"][data-id="${idAction}"]`;
  await S('legende', 'Faite pendant la réunion : <b>une coche</b>.');
  await S('suivre', 2.4);
  await v.cliquer(COCHE, { ms: 480 });
  await pause(350);
  const compte1 = propre(await v.lire(SUIVI_COMPTE));
  const statut = await appli.$eval(`.bloc-suivi .action:has([data-id="${idAction}"])`, (li) => li.dataset.statut);
  const n0 = Number(compte0.match(/^\d+/)[0]), n1 = Number(compte1.match(/^\d+/)[0]);
  if (statut !== 'fait' || n1 !== n0 - 1) throw new Error(`Résultat inattendu : ${compte0} → ${compte1} (${statut})`);
  son('zoom', 0.6); await S('cadrer', `${SUIVI} .bloc-titre`, { max: 2.4, marge: 30 });
  await S('flash', SUIVI_COMPTE, 'var(--jaune)');
  son('pop'); await S('avantApres', 'c', SUIVI_COMPTE, `${n0} ouvertes`, `${n1} ouvertes`, { couleur: 'var(--rouge)', cote: 'dessous', note: 'suivi' });
  await S('legende', `Il en reste <b>${n1}</b>, elles reviendront au prochain comité.`);
  await temps(3);
  await v.temps(); son('tampon');
  await S('tampon', 'Aucune action perdue', 'reprise jusqu\'à ce qu\'elle soit faite', 'var(--rouge)');
  await temps(2);
  await S('tamponFin'); await S('retirer'); await S('cacherCurseur');

  // Fin
  await v.temps(); son('whoosh'); await S('volet');
  await S('legende', null);
  await S('outro', { titre: 'Compte rendu et plan d\'actions', sous: 'Les actions ouvertes<br>reviennent d\'elles-mêmes.', url: 'Essai gratuit 14 jours · <b>qm-engineering.fr</b>' });
  son('ding', 0.6);
  await temps(4);
}
