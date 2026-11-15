// Vidéo 001 · Planning Gantt · « Une tâche prend 3 jours de retard : la fin du chantier bouge-t-elle ? »
// Type : réponse à une question précise. Données : démo intégrée du template (chantier fictif « Rénovation de cuisine »).
// Toutes les valeurs affichées par l'habillage (marges, dates de fin, écart) sont LUES dans l'application réelle.

export const config = {
  nom: 'gantt-retard',
  app: '/templates/gantt/?demo',
  largeur: 1280, hauteur: 1600,
  marque: 'QME · Planning Gantt',
  url: 'qm-engineering.fr/templates/gantt',
  affiche: 1.8,
};

const tache = (nom) => `[data-ligne]:has(input[data-champ="nom"][value="${nom}"])`;
const PLATRERIE = 'Plâtrerie et reprise des murs';
const POSE = 'Pose des meubles';
const BANDEAU = '.gl-planning span';
const FIN = (texte) => texte.split('→')[1].split('·')[0].trim(); // « 12/10 → 02/12 · ouvrés » → « 02/12 »

// Jours ouvrés (lundi-vendredi) entre deux dates jj/mm de la même année ; aucun férié entre fin novembre et mi-décembre.
function ecartOuvres(de, a, annee = 2026) {
  const d = ([j, m]) => new Date(Date.UTC(annee, m - 1, j));
  let x = d(de.split('/').map(Number)), y = d(a.split('/').map(Number)), n = 0;
  while (x < y) { x = new Date(x.getTime() + 864e5); if (![0, 6].includes(x.getUTCDay())) n++; }
  return n;
}

export async function preparer(v) {
  const { appli, page } = v;
  // Fermer le guide d'accueil (premier lancement), hors caméra.
  await appli.locator('dialog[open] button', { hasText: '×' }).first().click().catch(() => page.keyboard.press('Escape'));
  await page.waitForTimeout(300);
  // Marges réelles, lues dans l'onglet « Chemin critique », puis retour au Gantt.
  await appli.click('button[data-vue="critique"]'); await page.waitForTimeout(300);
  v.marges = await appli.$$eval('table tbody tr', (rs) => Object.fromEntries(rs.map((r) => {
    const c = [...r.cells].map((x) => x.innerText.trim());
    return [c[1].replace(/^◆\s*/, '').replace(/\s*Critique$/i, ''), Number(c[7])];
  })));
  await appli.click('button[data-vue="gantt"]'); await page.waitForTimeout(300);
  if (v.marges[PLATRERIE] == null || v.marges[POSE] !== 0) throw new Error(`Données de démo inattendues : ${JSON.stringify(v.marges)}`);
  await v.S('cadrer', null, 0);
  await v.S('fenetre', false);
}

export async function jouer(v) {
  const { S, son, pause } = v;
  // 0-3 s · Accroche
  son('pop'); setTimeout(() => son('pop'), 450); setTimeout(() => son('pop'), 1000);
  await S('accroche', ['Une tâche prend', '*3 jours* de retard.', '!La fin du chantier *bouge ?*']);
  await pause(700);
  son('whoosh'); await S('accrocheSortie');
  await S('question', 'Un retard décale-t-il *la fin* ?');
  await S('fenetre', true);

  // 3-6 s · Le planning et sa date de fin
  son('whoosh', 0.6);
  await S('cadrer', [BANDEAU, '.gl-planning', tache(PLATRERIE), tache(POSE)], 1100);
  const fin0 = FIN(await v.lire(BANDEAU));
  son('pop'); await S('anneau', 'fin', BANDEAU, { etiquette: `Fin prévue : ${fin0}`, cote: 'dessous', marge: 6 });
  await S('legende', `Un chantier de cuisine, <b>14 tâches</b> liées.`);
  await pause(1600);

  // 6-14 s · Cas 1 : tâche avec de la marge
  await S('legende', `La plâtrerie prend <b>3 jours de plus</b>.`, 'Cas 1');
  await S('anneau', 't', tache(PLATRERIE), { couleur: 'var(--bleu)', pulse: false, marge: 2 });
  await pause(500);
  await v.saisir(`${tache(PLATRERIE)} [data-champ="duree"]`, '6');
  await v.valider();
  await pause(700);
  const fin1 = FIN(await v.lire(BANDEAU));
  await S('couleurRepere', 'fin', 'var(--vert)', fin1 === fin0 ? `Fin : ${fin1} · inchangée` : `Fin : ${fin1}`);
  son('tampon'); son('ding', 0.8);
  await S('tampon', fin1 === fin0 ? 'La fin ne bouge pas' : `Fin : ${fin1}`, `${v.marges[PLATRERIE]} jours de marge absorbent le retard`, 'var(--vert)', 1530);
  await pause(2000);
  await S('tamponFin'); await S('retirer', 't');

  // 14-22 s · Cas 2 : tâche critique
  await S('couleurRepere', 'fin', 'var(--jaune)', `Fin prévue : ${fin1}`);
  await S('legende', `La pose des meubles prend <b>3 jours de plus</b>.`, 'Cas 2');
  await S('anneau', 't', tache(POSE), { couleur: 'var(--bleu)', pulse: false, marge: 2 });
  await pause(500);
  await v.saisir(`${tache(POSE)} [data-champ="duree"]`, '6');
  await v.valider();
  await pause(700);
  const fin2 = FIN(await v.lire(BANDEAU));
  const ecart = ecartOuvres(fin1, fin2);
  await S('couleurRepere', 'fin', 'var(--rouge)', `Fin : ${fin2} · +${ecart} j`);
  son('tampon'); son('alerte', 0.8);
  await S('tampon', `La fin recule de ${ecart} jours`, 'Tâche critique : aucune marge', 'var(--rouge)', 1530);
  await pause(2100);
  await S('tamponFin'); await S('retirer');

  // 22-27 s · Navigation : l'onglet Chemin critique
  await S('legende', `Lesquelles surveiller ? L'onglet <b>Chemin critique</b>.`);
  son('whoosh', 0.6); await S('cadrer', null, 700);
  await v.cliquer('button[data-vue="critique"]');
  await pause(500);
  son('whoosh', 0.6); await S('cadrer', ['.vue-tete h1', '.tuiles'], 1000);
  const finCalc = await v.lire('.tuile:first-child .tuile-date');
  const [nbCrit, nbTot] = (await v.lire('.tuile:nth-child(3) b')).split('/').map((x) => x.trim());
  son('pop'); await S('anneau', 'c1', '.tuile:first-child', { couleur: 'var(--rouge)', etiquette: `Nouvelle fin : ${finCalc}`, cote: 'dessous', pulse: false });
  await pause(1100);
  son('pop'); await S('anneau', 'c2', '.tuile:nth-child(3)', { couleur: 'var(--rouge)', etiquette: `${nbCrit} tâches sur ${nbTot} à surveiller`, cote: 'dessous', pulse: false });
  await pause(1500);
  await S('retirer'); await S('cacherCurseur');

  // 27-30 s · Fin
  son('whoosh'); await S('volet');
  await S('legende', null);
  await S('outro', { titre: 'Planning Gantt', sous: 'Le chemin critique recalculé<br>à chaque saisie.', url: 'Démo gratuite · <b>qm-engineering.fr</b>' });
  son('ding', 0.6);
  await pause(2600);
}
