// Vidéo 018 · Essai gratuit · « Essayer avant d'acheter ? 14 jours, sans carte, et vous gardez vos données. »
// Type : processus (publication exceptionnelle du 19/11/2026, lancement de l'essai gratuit).
// Parcours RÉEL, servi par le serveur local (site + API + application) :
//   1. page /essai/ : prénom, e-mail, accord, « Lancer mon essai gratuit » → code d'essai affiché ;
//   2. « Ouvrir mon template » → Budget du foyer, bandeau « Essai gratuit · encore 14 jours » ;
//   3. 14 jours plus tard (hors caméra : données d'exemple de la démo enregistrées dans l'essai, horloge du serveur
//      local avancée de 15 jours) → bandeau « Essai terminé », un clic sur « + Dépense » ouvre « Lecture seule » ;
//   4. « J'ai acheté » → clé de licence (clé de TEST du serveur local, QME_LICENCES_TEST=1) → données reprises.
// Rendu : QME_LICENCES_TEST=1 node docs/videos/moteur.mjs docs/videos/scenarios/018-essai-gratuit.mjs
// Toutes les valeurs de l'habillage sont lues dans les pages.

export const config = {
  nom: '018-essai-gratuit',
  produit: 'BDG', type: 'processus', titre: 'Essayer 14 jours sans carte, et garder ses données',
  app: '/essai/?t=budget',
  largeur: 1280, hauteur: 1600,
  marque: 'QME · Essai gratuit',
  url: 'qm-engineering.fr/essai',
  affiche: 2.5,
  musique: 'auto',
  dureeMax: 40,
};
const PORT = Number(process.env.PORT_VIDEO || 8897);
const BDG = 9; // rang de BDG dans PRODUITS (clé de test 0E55A109-…), contrôlé dans preparer
const CLE = `0E55A1${BDG.toString(16).toUpperCase().padStart(2, '0')}-00000000-00000000-00000000`;
let donneesDemo = null;

const decaler = (jours) => fetch(`http://localhost:${PORT}/__dev/decalage?jours=${jours}`);

// Attend une condition dans l'application en laissant le temps de la vidéo s'écouler (image par image).
async function attendreQue(v, test, { max = 4000, pas = 100, quoi = 'condition' } = {}) {
  for (let t = 0; t < max; t += pas) {
    if (await v.appli.evaluate(test).catch(() => false)) return;
    await v.pause(pas);
  }
  throw new Error(`Attente trop longue : ${quoi}`);
}
// Cadre du texte du bandeau d'essai (partie gauche, lisible) et du haut de l'application.
const cadreBandeau = (v) => v.appli.$eval('.qme-essai-txt', (e) => { const r = e.getBoundingClientRect();
  return { x: 0, y: 0, w: Math.min(r.right + 24, 760), h: r.bottom + 90 }; });
const barre = (v, texte) => v.page.evaluate((t) => { document.querySelector('#url').textContent = t; }, texte);

export async function preparer(v) {
  await decaler(0);
  const { PRODUITS } = await import('../../../netlify/lib/templates-acces.mjs');
  if (Object.keys(PRODUITS).indexOf('BDG') !== BDG) throw new Error('Rang de BDG changé : mettre à jour la clé de test');
  // Données d'exemple du Budget du foyer (démo intégrée, foyer fictif), lues dans une page à part puis effacées.
  const p = await v.page.context().newPage();
  await p.goto(`http://localhost:${PORT}/templates/budget/?demo`);
  for (let i = 0; i < 30 && !donneesDemo; i++) {
    donneesDemo = await p.evaluate(() => JSON.parse(localStorage.getItem('qme-bdg-demo') || 'null'));
    if (!donneesDemo) await p.waitForTimeout(100);
  }
  await p.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('qme-bdg-')) localStorage.removeItem(k); });
  await p.close();
  if (!donneesDemo) throw new Error('Démo du budget introuvable');
  // Page /essai/ : formulaire présent, Budget du foyer présélectionné.
  const choisi = await v.appli.$eval('select[name="produit"]', (s) => s.selectedOptions[0].textContent);
  if (!/Budget du foyer/.test(choisi)) throw new Error(`Template présélectionné inattendu : ${choisi}`);
  await v.S('cadrer', null);
  await v.S('fenetre', false);
}

export async function jouer(v) {
  const { S, son, pause } = v;
  const T = 60000 / 110;
  const temps = (n = 1) => pause(n * T);

  // Accroche
  son('whoosh', 0.6);
  await S('accroche', ['Essayer *avant* d’acheter ?', '*14_jours* gratuits,', 'sans carte bancaire.'], T / 2);
  await v.temps();
  son('whoosh'); await S('accrocheSortie');
  await S('question', '1 · Lancez l’*essai*');
  await v.temps(); son('whoosh', 0.7); await S('fenetre', true);

  // 1. Formulaire /essai/
  son('zoom'); await S('cadrer', '#essai-form', { max: 1.9, marge: 30 });
  await S('legende', 'Votre e-mail suffit. <b>Aucune carte.</b>', '1/4');
  await S('suivre', 2.1);
  await v.saisir('input[name="prenom"]', 'Camille', { ms: 450, rapide: true });
  await v.saisir('input[name="email"]', 'camille@exemple.fr', { ms: 380, rapide: true });
  await v.cliquer('input[name="consentement"]', { ms: 420, fx: 0.5, fy: 0.5 });
  await v.cliquer('#essai-form button[type="submit"]', { ms: 420 });
  await attendreQue(v, () => !document.getElementById('essai-pret').hidden, { quoi: 'code d’essai' });
  const code = await v.lire('#essai-code');
  if (!/^BDG-/.test(code)) throw new Error(`Code inattendu : ${code}`);
  const fin = await v.lire('#essai-fin');
  son('zoom'); await S('cadrer', '#essai-pret', { max: 2.0, marge: 30 });
  son('pop'); await S('anneau', 'code', '#essai-code', { couleur: 'var(--jaune)', etiquette: 'votre code', cote: 'dessus' });
  await S('legende', `Accès complet jusqu’au <b>${fin}</b>.`, '1/4');
  await temps(1.5);
  await S('retirer');

  // 2. L'application s'ouvre avec le code
  await S('suivre', 2.0);
  await v.cliquer('#essai-ouvrir', { ms: 450 });
  await attendreQue(v, () => !!document.querySelector('.qme-essai[data-etat="actif"]'), { quoi: 'bandeau d’essai' });
  await barre(v, 'qm-engineering.fr/templates/budget');
  await v.fermerDialogues();
  await S('question', '2 · Utilisez-le *14_jours*');
  const bandeau = await v.lire('.qme-essai .qme-essai-txt');
  if (!/encore 14 jours/.test(bandeau)) throw new Error(`Bandeau inattendu : ${bandeau}`);
  son('zoom'); await S('cadrer', await cadreBandeau(v), { max: 2.4, marge: 10 });
  son('pop'); await S('anneau', 'b1', '.qme-essai .qme-essai-txt', { couleur: 'var(--jaune)', etiquette: 'encore 14 jours', cote: 'dessous', marge: 4 });
  await S('legende', 'Toutes les fonctions, <b>sur tous vos appareils</b>.', '2/4');
  await temps(1.5);
  await S('retirer');

  // 3. Quatorze jours plus tard (derrière le volet) : l'essai a servi (données d'exemple de la démo), il est terminé.
  await v.temps(); son('whoosh');
  await Promise.all([v.S('volet'), v.S('fenetre', false), v.S('legende', null)]);
  await S('question', '3 · *14_jours* plus tard');
  const ecrit = await v.appli.evaluate(async ({ code, donnees }) => {
    const r = await fetch('/api/templates/donnees', { method: 'PUT', headers: { 'content-type': 'application/json', 'x-code': code }, body: JSON.stringify({ donnees: { ...donnees, tutorielVu: true }, base: null }) });
    return r.status;
  }, { code, donnees: donneesDemo });
  if (ecrit !== 200) throw new Error(`Données d'essai non enregistrées (${ecrit})`);
  await decaler(15);
  await v.appli.evaluate(() => location.reload());
  await attendreQue(v, () => !!document.querySelector('.qme-essai[data-etat="termine"]') && !!document.querySelector('h1 mark'), { quoi: 'essai terminé' });
  await v.fermerDialogues();
  const reste = (await v.lire('h1 mark')).replace(/\s+/g, ' ');
  await S('cadrer', await cadreBandeau(v), { max: 2.4, marge: 10 });
  son('whoosh', 0.7); await S('fenetre', true);
  await S('legende', 'Essai terminé : vos données restent <b>lisibles 30 jours</b>.', '3/4');
  son('pop'); await S('anneau', 'b2', '.qme-essai .qme-essai-txt', { couleur: 'var(--rouge)', etiquette: 'lecture seule', cote: 'dessous', marge: 4 });
  await temps(1.5);
  await S('retirer');
  await S('suivre', 2.2);
  await v.cliquer('[data-action="operation"][data-type="depense"]', { ms: 480 });
  await attendreQue(v, () => !!document.querySelector('.qme-essai-dlg[open]'), { quoi: 'fenêtre lecture seule' });
  const titre = await v.lire('.qme-essai-dlg[open] h2');
  if (titre !== 'Lecture seule') throw new Error(`Fenêtre inattendue : ${titre}`);
  son('alerte', 0.5); await S('cadrer', '.qme-essai-dlg[open]', { max: 2.0, marge: 24 });
  await S('legende', 'Plus de modification. <b>Rien n’est prélevé.</b>', '3/4');
  await temps(1.5);

  // 4. Achat : la clé reçue de Gumroad reprend les données de l'essai
  await S('question', '4 · Vous *continuez* ?');
  await S('suivre', 2.2);
  await v.cliquer('.qme-essai-dlg[open] [data-qme="achete"]', { ms: 420 });
  await attendreQue(v, () => !!document.querySelector('.qme-essai-dlg[open] input[name="cle"]'), { quoi: 'fenêtre « J’ai acheté »' });
  son('zoom', 0.6); await S('cadrer', '.qme-essai-dlg[open]', { max: 2.0, marge: 30 });
  await S('legende', 'La clé reçue après l’achat <b>(achat unique)</b>.', '4/4');
  await v.saisir('.qme-essai-dlg[open] input[name="cle"]', CLE, { ms: 420, rapide: true });
  await v.cliquer('.qme-essai-dlg[open] button[type="submit"]', { ms: 420 });
  await attendreQue(v, () => !document.querySelector('.qme-essai') && !!document.querySelector('h1 mark') && !document.querySelector('dialog[open]'), { max: 6000, quoi: 'espace acheté' });
  const reste2 = (await v.lire('h1 mark')).replace(/\s+/g, ' ');
  if (reste2 !== reste) throw new Error(`Données non reprises : ${reste} → ${reste2}`);
  son('dezoom'); await S('cadrer', 'h1', { max: 1.9, marge: 30 });
  await S('flash', 'h1 mark', 'var(--vert)');
  son('eclat'); await S('eclat', 'h1 mark', ['var(--vert)', 'var(--jaune)', 'var(--bleu)']);
  await S('legende', null);
  await v.temps(); son('tampon'); son('ding', 0.7);
  await S('tampon', 'Données reprises', 'tout ce que vous aviez saisi', 'var(--vert)');
  await temps(1.6);
  await S('tamponFin'); await S('retirer'); await S('cacherCurseur');

  // Fin
  await v.temps(); son('whoosh'); await S('volet');
  await S('legende', null);
  await S('outro', { titre: 'Essai gratuit 14 jours', sous: 'Sans carte bancaire.<br>Vos données vous suivent si vous achetez.', url: '<b>qm-engineering.fr/essai</b>' });
  son('ding', 0.6);
  await decaler(0);
  v.valeurs = { code, fin, bandeau, reste, reste2, titre };
  console.log('Valeurs lues :', JSON.stringify(v.valeurs));
  await temps(3);
}
