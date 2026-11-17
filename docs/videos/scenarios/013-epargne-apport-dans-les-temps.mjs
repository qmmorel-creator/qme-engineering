// Vidéo 013 · Objectif d'épargne et fonds d'urgence · « Avant : mai 2031. Un clic. Après : mars 2030. »
// Type : avant-après. Données : démo intégrée du template (épargnante fictive « Camille », 5 objectifs).
// Cas : l'objectif « Apport pour l'appartement » est en retard sur sa date visée ; l'alerte du tableau de bord
// propose le versement mensuel nécessaire. Geste réel : clic sur « Passer à … € par mois ».
// Résultat montré : statut, date d'atteinte et total prévu du mois, avant puis après.
// Toutes les valeurs affichées par l'habillage sont LUES dans l'application réelle.
// Dépend de la correction de versementPour (versement déjà fait ce mois-ci déduit) : sans elle, le montant
// conseillé laisse un mois de retard, et jouer() s'arrête en erreur après le clic.

export const config = {
  nom: '013-epargne-apport-dans-les-temps',
  produit: 'EPG', type: 'avant-après', titre: 'Avant : mai 2031. Un clic. Après : mars 2030.',
  app: '/templates/epargne/?demo',
  largeur: 1280, hauteur: 1600,
  marque: 'QME · Objectif d\'épargne',
  url: 'qm-engineering.fr/templates/epargne',
  affiche: 3.0,
  // Musique de la vidéo de présentation QME (« Corporate », litesaturation, licence Pixabay : usage commercial sans attribution).
  musique: { fichier: 'docs/videos/musique/corporate-litesaturation.m4a', bpm: 110, premierTemps: 0.534, debut: 20.170, volume: 0.6 },
};
const T = 60000 / 110; // un temps en ms

const ID = 'apport';
const LIGNE = `button.ligne-objectif[data-id="${ID}"]`;
const L_NOM = `${LIGNE} .lo-nom`;
const L_STATUT = `${LIGNE} .lo-nom .etiquette`;
const L_FIN = `${LIGNE} .lo-fin`;
const ALERTE = `li.alerte:has([data-action="appliquer-necessaire"][data-id="${ID}"])`;
const BOUTON = `${ALERTE} [data-action="appliquer-necessaire"]`;
const TUILE_MOIS = '.tuiles .tuile:nth-child(2)';
const TUILE_MOIS_VAL = `${TUILE_MOIS} b small`;

const moisDe = (fin) => (fin.match(/Atteint en ([^·]+)/) || [])[1]?.trim(); // « Atteint en mai 2031 · visé … » → « mai 2031 »
const viseDe = (fin) => (fin.match(/visé (.+)$/) || [])[1]?.trim();

export async function preparer(v) {
  const { appli, page } = v;
  await v.fermerDialogues(); // guide d'accueil du premier lancement, hors caméra
  await appli.click('[data-action="vue"][data-vue="tableau"]'); await page.waitForTimeout(400);
  v.statut0 = await v.lire(L_STATUT);
  v.fin0 = await v.lire(L_FIN);
  v.prevu0 = (await v.lire(TUILE_MOIS_VAL)).replace(/^\/\s*/, '');
  v.bouton = (await appli.$eval(BOUTON, (b) => b.textContent)).replace(/\s/g, ' ');
  v.montant = (v.bouton.match(/Passer à (.+) par mois/) || [])[1];
  const texte = await appli.innerText('main');
  v.capacite = (texte.replace(/\s/g, ' ').match(/sur ([\d  ]+,\d\d €) possibles/) || [])[1];
  if (!/retard/i.test(v.statut0) || !moisDe(v.fin0) || !viseDe(v.fin0) || !v.montant || !v.capacite) {
    throw new Error(`Cas de démo inattendu : ${JSON.stringify({ statut: v.statut0, fin: v.fin0, bouton: v.bouton, capacite: v.capacite })}`);
  }
  await appli.evaluate(() => window.scrollTo(0, 0));
  await v.S('cadrer', null);
  await v.S('fenetre', false);
}

export async function jouer(v) {
  const { S, son, pause } = v;
  const temps = (n = 1) => pause(n * T);
  const court = (s) => s.replace(/,00\s*€/, ' €').replace(/\s/g, '\u00a0'); // espaces insécables : « 1 400 € » sur une ligne

  // Accroche (un seul son d'entrée)
  son('whoosh', 0.6);
  await S('accroche', [`Avant : ${moisDe(v.fin0).replace(' ', '_')}.`, 'Un clic.', `!Après : *${viseDe(v.fin0).replace(' ', '_')}*.`], T / 2);
  await v.temps();
  son('whoosh'); await S('accrocheSortie');
  await S('question', 'Combien épargner pour *tenir la date* ?');
  await v.temps(); son('whoosh', 0.7); await S('fenetre', true);

  // AVANT : l'objectif en retard
  await v.temps(); son('zoom'); await S('cadrer', L_NOM, { max: 2.6, marge: 60 });
  son('pop'); await S('anneau', 'a0', L_STATUT, { couleur: 'var(--rouge)', etiquette: 'avant', cote: 'dessous', marge: 6 });
  await S('legende', `L'apport pour l'appartement est <b>en retard</b>.`);
  await temps(2);
  await S('retirer', 'a0');
  son('glisse', 0.5); await S('cadrer', L_FIN, { max: 2.6, marge: 60 });
  son('pop'); await S('anneau', 'a', L_FIN, { couleur: 'var(--rouge)', etiquette: 'avant', cote: 'dessous', marge: 6 });
  await S('legende', `Visé <b>${viseDe(v.fin0)}</b>, atteint <b>${moisDe(v.fin0)}</b>.`);
  await temps(2);
  await S('retirer', 'a');

  // Le montant nécessaire, calculé par l'application
  await S('suivre', 2.0);
  await v.viser(BOUTON, { ms: 560 });
  son('zoom', 0.6); await S('cadrer', BOUTON, { max: 2.6, marge: 110 });
  await S('flash', BOUTON, 'var(--jaune)');
  await S('legende', `L'outil calcule ce qu'il faut : <b>${court(v.montant)}</b> par mois.`);
  await temps(2);

  // Le geste : un clic
  await S('suivre', 2.2);
  await v.cliquer(BOUTON, { ms: 380 });
  await pause(250);

  // APRÈS : statut et date d'atteinte
  const statut1 = await v.lire(L_STATUT);
  const fin1 = await v.lire(L_FIN);
  if (/retard/i.test(statut1) || moisDe(fin1) === moisDe(v.fin0)) throw new Error(`Après le clic, l'objectif n'est pas dans les temps : ${statut1} · ${fin1}`);
  son('dezoom', 0.6); await S('cadrer', L_NOM, { max: 2.6, marge: 60 });
  await v.temps();
  await S('flash', L_STATUT, 'var(--ciel)');
  son('pop'); await S('avantApres', 's', L_STATUT, v.statut0, statut1, { couleur: 'var(--vert)', cote: 'dessous' });
  await S('legende', 'Après : <b>dans les temps</b>.');
  await temps(2);
  await S('retirer');
  son('glisse', 0.5); await S('cadrer', L_FIN, { max: 2.6, marge: 60 });
  await S('flash', L_FIN, 'var(--ciel)');
  son('pop'); await S('avantApres', 'f', L_FIN, moisDe(v.fin0), moisDe(fin1), { couleur: 'var(--vert)', cote: 'dessous', note: 'date d\'atteinte' });
  son('trait', 0.6); await S('souligner', 'u', L_FIN, 'var(--vert)');
  await S('legende', `Atteint en <b>${moisDe(fin1)}</b>, la date visée.`);
  await temps(2);
  await S('retirer');

  // Le mois : le prévu augmente, sous la capacité d'épargne
  const prevu1 = (await v.lire(TUILE_MOIS_VAL)).replace(/^\/\s*/, '');
  if (prevu1 === v.prevu0) throw new Error('Le total prévu du mois n\'a pas changé.');
  son('zoom', 0.6); await S('cadrer', TUILE_MOIS, { max: 2.4, marge: 40 });
  await S('flash', TUILE_MOIS, 'var(--jaune)');
  son('pop'); await S('avantApres', 'm', TUILE_MOIS_VAL, v.prevu0, prevu1, { couleur: 'var(--bleu)', cote: 'dessous', note: 'prévu ce mois-ci' });
  await S('legende', `Toujours sous votre capacité d'épargne : <b>${court(v.capacite)}</b>.`);
  await temps(1.5);
  son('eclat'); await S('eclat', TUILE_MOIS, ['var(--vert)', 'var(--jaune)', 'var(--bleu)']);
  await v.temps(); son('tampon'); son('ding', 0.7);
  await S('tampon', 'Dans les temps', `${moisDe(fin1)} · ${court(v.montant)} par mois`, 'var(--vert)');
  await temps(1.8);
  await S('tamponFin'); await S('retirer'); await S('cacherCurseur');

  // Fin
  await v.temps(); son('whoosh'); await S('volet');
  await S('legende', null);
  await S('outro', { titre: 'Objectif d\'épargne', sous: 'La date visée,<br>et le montant pour la tenir.', url: 'Démo gratuite · <b>qm-engineering.fr</b>' });
  son('ding', 0.6);
  await temps(3);
}
