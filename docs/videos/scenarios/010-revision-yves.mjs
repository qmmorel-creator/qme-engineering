// Vidéo 010 · Planning de révision v2 · vidéo PRIVÉE pour la proposition de partenariat Yves Gautier (coach d'oral
// de concours, non programmée). Type : visite guidée personnalisée (démo concours au prénom du destinataire).
// Données : démo intégrée du template (?demo=concours, candidate fictive au concours d'attaché territorial). Toutes les valeurs affichées par l'habillage
// (retards, jauge, mots-clés retrouvés, série, priorités) sont LUES dans l'application réelle, après chaque geste.
// Durée visée 40 à 45 s (au-delà des 40 s d'un Reel : vidéo envoyée par e-mail, pas publiée).

export const config = {
  nom: '010-revision-yves',
  produit: 'REV', type: 'démonstration', titre: 'Yves, voici la journée d\'une candidate au concours d\'attaché',
  app: '/templates/revision/?demo=concours&prenom=Yves',
  largeur: 1280, hauteur: 1600,
  marque: 'QME · Planning de révision',
  url: 'qm-engineering.fr/templates/revision',
  affiche: 1.8,
  dureeMax: 50,
  // « Corporate », litesaturation, licence Pixabay. Départ au 12e temps (7,08 s) pour tenir ~46 s avant le fondu de 57 s.
  musique: { fichier: 'docs/videos/musique/corporate-litesaturation.m4a', bpm: 110, premierTemps: 0.534, debut: 7.080, volume: 0.6 },
};
const T = 60000 / 110;

const TITRE_JOUR = '.jour-titre h1';
const SOUS = '.jour-titre .sous';
const EXAMEN = '.examen-carte';
const JAUGE = '.examen-carte .jauge';
const ALERTE = '.alerte.rattrapage';
const VOIR_PLAN = '.alerte.rattrapage [data-action="rattrapage"]';
const REPARTIR = 'dialog[open] button[value="ok"]';
const SESSION = '.jour-titre [data-action="session"]';
const COMMENCER = '[data-action="session-suivant"]';
const FEUILLE = '#feuille';
const COMPARER = '[data-action="session-comparer"]';
const COMPARAISON = '.comparaison';
const SUGGERE = '.session-eval .ev.suggere';
const FERMER = '[data-action="session-fermer"]';

const retardsDe = (texte) => Number((texte.match(/(\d+) en retard/) || [0, 0])[1]);

export async function preparer(v) {
  const { appli, page } = v;
  await v.fermerDialogues();
  await page.waitForTimeout(1200);
  await v.fermerDialogues(); // « Comme une application » éventuelle
  v.titre = await v.lire(TITRE_JOUR);
  v.sous = await v.lire(SOUS);
  v.retards = retardsDe(v.sous);
  v.examen = (await v.lire(`${EXAMEN} p:nth-of-type(2)`)).split('·')[0].trim();
  v.compte = await v.lire(`${EXAMEN} .compte`);
  v.jauge = (await v.lire(`${JAUGE} p b`)).trim();
  // Premier chapitre de la session (après rattrapage, même ordre que l'écran) et ses mots-clés réels.
  const etat = await appli.evaluate(() => window.__revision.etat());
  v.serie = await appli.evaluate(() => { const d = new Date(); const t = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; return window.REVR.serie(window.__revision.etat(), t); });
  if (!v.titre.includes('Yves') || v.retards < 9 || !(await appli.$(ALERTE)) || !v.jauge || etat.demoProfil !== 'concours' || v.serie < 10) {
    throw new Error(`Démo inattendue : « ${v.titre} », « ${v.sous} », jauge ${v.jauge}, série ${v.serie}`);
  }
  await v.S('cadrer', null);
  await v.S('fenetre', false);
}

export async function jouer(v) {
  const { S, son, pause, appli } = v;
  const temps = (n = 1) => pause(n * T);

  // Accroche personnalisée : un seul son d'entrée
  son('whoosh', 0.6);
  await S('accroche', ['Yves,', 'la journée d\'une', 'candidate au *concours*.'], T / 2);
  await v.temps();
  son('whoosh'); await S('accrocheSortie');
  await S('question', 'Les écrits *jusqu\'au jour J*');
  await v.temps(); son('whoosh', 0.7); await S('fenetre', true);

  // 1. Aujourd'hui : un week-end chargé, des retards
  await v.temps(); son('zoom'); await S('cadrer', ['.jour-titre h1', SOUS], { max: 2.2, marge: 60 });
  await v.temps(); son('pop');
  await S('anneau', 'r', SOUS, { couleur: 'var(--rouge)', etiquette: `${v.retards} en retard`, cote: 'dessous', marge: 6 });
  await S('legende', `Un week-end sans réviser : <b>${v.retards} révisions</b> en retard.`);
  await temps(2); await S('retirer');

  // 2. Jauge « Prêt pour le jour J »
  await v.temps(); son('zoom'); await S('cadrer', EXAMEN, { max: 2.2, marge: 40 });
  await v.temps(); son('pop');
  await S('anneau', 'j', JAUGE, { couleur: 'var(--jaune)', cote: 'dessous', marge: 6 });
  await S('legende', `${v.examen}, ${v.compte} : <b>${v.jauge}</b> chapitres solides le jour J.`);
  await temps(2); await S('retirer');

  // 3. Plan de rattrapage en un geste
  await v.temps(); await S('legende', 'Les retards, <b>répartis en un geste</b>.');
  son('zoom', 0.7); await S('suivre', 2.0);
  await v.cliquer(VOIR_PLAN, { ms: 560 });
  await pause(250);
  son('zoom', 0.6); await S('cadrer', 'dialog[open] .modale-corps', { max: 1.8, marge: 30 });
  await temps(1.5);
  await S('suivre', 1.8);
  await v.cliquer(REPARTIR, { ms: 520 });
  await S('cacherCurseur');
  await pause(300);
  const apres = await v.lire(SOUS);
  const toast = await v.lire('.toast');
  if (retardsDe(apres) !== 0 || !toast.startsWith('Retards répartis')) throw new Error(`Rattrapage non appliqué : ${apres} / ${toast}`);
  son('dezoom'); await S('cadrer', ['.jour-titre h1', SOUS], { max: 2.2, marge: 60 });
  await S('flash', SOUS, 'var(--vert)');
  son('pop'); await S('avantApres', 'a', SOUS, `${v.retards} en retard`, '0 en retard', { couleur: 'var(--vert)', cote: 'dessous', note: toast.replace(/\s*Annuler$/, '') });
  await v.temps(); son('tampon'); son('ding', 0.7);
  await S('tampon', 'Plus de mur de retards', toast.replace(/\s*Annuler$/, ''), 'var(--vert)');
  await temps(2); await S('tamponFin'); await S('retirer');

  // 4. Session guidée : feuille blanche comparée aux mots-clés
  await v.temps(); await S('legende', 'La session guidée : <b>minuteur et feuille blanche</b>.');
  son('zoom', 0.7); await S('suivre', 2.0);
  await v.cliquer(SESSION, { ms: 560 });
  await pause(200);
  await v.cliquer(COMMENCER, { ms: 520 });
  await pause(200);
  const chapitre = await v.lire('.session-chapitre h2');
  const cles = await appli.evaluate((t) => window.__revision.etat().chapitres.find((c) => c.titre === t)?.motsCles || '', chapitre);
  const liste = cles.split(',').map((x) => x.trim()).filter(Boolean);
  if (liste.length < 4) throw new Error(`Mots-clés insuffisants pour « ${chapitre} » : ${cles}`);
  const souvenir = liste.slice(0, 3);
  son('zoom', 0.6); await S('cadrer', ['.session-chapitre h2', FEUILLE], { max: 1.9, marge: 40 });
  await v.saisir(FEUILLE, `${souvenir.join(', ')}…`, { ms: 480, rapide: true });
  await v.cliquer(COMPARER, { ms: 480 });
  await pause(250);
  const score = (await v.lire(`${COMPARAISON} p b`)).trim();
  if (score !== `${souvenir.length}/${liste.length}`) throw new Error(`Comparaison inattendue : ${score}`);
  son('zoom', 0.6); await S('cadrer', [COMPARAISON, '.session-eval'], { max: 1.9, marge: 40 });
  await S('flash', COMPARAISON, 'var(--ciel)');
  son('pop'); await S('anneau', 'c', `${COMPARAISON} p:first-child`, { couleur: 'var(--bleu)', etiquette: `${score} retrouvés`, cote: 'dessus', marge: 6 });
  const suggere = { difficile: 'Difficile', moyen: 'Moyen', facile: 'Facile' }[await appli.$eval(SUGGERE, (b) => b.dataset.eval)];
  if (!suggere) throw new Error('Aucune évaluation suggérée');
  await S('legende', `« ${chapitre} » : <b>${score}</b> de mémoire, suggestion <b>${suggere}</b>.`);
  await temps(1.5); await S('retirer');
  await S('suivre', 1.9);
  await v.cliquer(SUGGERE, { ms: 480 });
  await pause(200);
  const suivant = await v.lire('.session-tete .surtitre');
  if (!/Chapitre 2 sur/.test(suivant)) throw new Error(`Évaluation non enregistrée : ${suivant}`);
  await v.cliquer(FERMER, { ms: 480 });
  await S('cacherCurseur');
  await pause(300);

  // 5. Bilan : régularité
  await appli.evaluate(() => document.querySelector('[data-vue="bilan"]').click());
  await pause(300);
  const serie = await appli.$eval('.tuile b', (b) => `${b.firstChild.textContent.trim()} ${b.querySelector('small')?.textContent.trim() || ''}`.trim());
  son('zoom'); await S('cadrer', '.regularite', { max: 1.6, marge: 30 });
  await v.temps(); son('eclat'); await S('eclat', '.paliers', ['var(--jaune)', 'var(--rouge)', 'var(--bleu)']);
  await S('legende', `Série en cours : <b>${serie}</b>, image de la semaine à partager.`);
  await temps(2);
  await S('retirer');

  // Fin
  await v.temps(); son('whoosh'); await S('volet');
  await S('legende', null);
  await S('outro', { titre: 'Planning de révision', sous: 'Pour vos candidats, des écrits à l\'oral.<br>Votre démo : qm-engineering.fr/demo/yves', url: 'Démo gratuite · <b>qm-engineering.fr</b>' });
  son('ding', 0.6);
  await temps(4);
}
