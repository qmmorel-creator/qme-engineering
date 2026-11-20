// Vidéo « écran » (skill video-ecran) : une influenceuse regarde le Sankey du Budget du foyer pour savoir où part son
// argent. Capture d'écran d'un PC Windows, voix féminine ElevenLabs à la première personne (texte : `voix` ci-dessous).
// Données de démo fictives ; montants lus et contrôlés dans l'application avant le tournage.
//   node docs/videos/moteur.mjs docs/videos/scenarios/ecran-001-budget-ou-part-argent.mjs
//   node docs/videos/voix.mjs texte docs/videos/scenarios/ecran-001-budget-ou-part-argent.mjs
//   node docs/videos/voix.mjs mixer docs/videos/scenarios/ecran-001-budget-ou-part-argent.mjs <voix.mp3>
export const config = {
  nom: 'ecran-001-budget-ou-part-argent',
  produit: 'BDG', type: 'écran', titre: 'Où part mon argent ce mois-ci ?',
  ecran: 'ordinateur', app: '/templates/budget/?demo', heure: '2026-11-20T21:14:00+01:00',
  barre: 'qm-engineering.fr/templates/budget/', onglet: 'Budget du foyer · QME',
  // Rien ne trahit la démo à l'écran : bandeau masqué, pastille d'état « Enregistré » (fichiers servis, dépôt inchangé).
  css: '.bandeau-demo{display:none !important}',
  remplacer: [{ url: '**/templates/budget/app.js*', de: "demo: 'Démo locale'", vers: "demo: 'Enregistré'" }],
  ambiance: 'bureau', micro: 'telephone', affiche: 6,
};

// Montants dits par la voix : contrôlés dans le Sankey avant le tournage (preparer).
const ATTENDU = { Logement: '1 174,00 €', 'Restaurants et sorties': '245,00 €', 'Non dépensé': '1 059,54 €' };

export const voix = [
  { a: 'debut', decalage: 0.15, texte: "Ce mois-ci, je voulais enfin savoir où part mon argent." },
  { a: 'sankey', decalage: 0.3, texte: "Tout est là : ce qui rentre à gauche, et où ça part à droite." },
  { a: 'logement', decalage: 0.5, texte: "Le logement, sans surprise : mille cent soixante-quatorze euros." },
  { a: 'restos', decalage: 0.5, texte: "Les restos et les sorties… deux cent quarante-cinq euros. Ah oui, quand même." },
  { a: 'reste', decalage: 0.5, texte: "Et il me reste mille soixante euros. Ça, ça fait du bien." },
];

const noeud = (nom) => `.sankey .noeud[data-info^="${nom}|"] rect`;

export async function preparer(v) {
  await v.attendre('.sankey');
  await v.fermerDialogues();
  await v.pause(600);
  for (const [nom, montant] of Object.entries(ATTENDU)) {
    // Espaces insécables (fines) du format français ramenées à une espace simple avant comparaison.
    const info = (await v.app.locator(`.sankey .noeud[data-info^="${nom}|"]`).first().getAttribute('data-info')).replace(/[\u00a0\u202f]/g, ' ');
    if (info !== `${nom}|${montant}`) throw new Error(`Sankey : « ${info} » au lieu de « ${nom}|${montant} » : mettre à jour la voix.`);
  }
  await v.app.evaluate(() => window.scrollTo(0, 0));
}

export async function jouer(v) {
  v.repere('debut');
  await v.pause(700);
  await v.survoler('.tuile:nth-child(2)', { fx: 0.4, ms: 900 }); // le regard va sur les dépenses
  await v.pause(1700);
  v.repere('sankey');
  await v.glisserVers('.sankey', { marge: 8, gestes: 2 });
  await v.survoler(noeud('Salaire Camille'), { fx: 0.7, ms: 800 });
  await v.pause(600);
  await v.survoler(noeud('Besoins'), { ms: 900 });
  await v.pause(900);
  v.repere('logement');
  await v.toucher(noeud('Logement'), { ms: 800 });
  await v.pause(3600);
  v.repere('restos');
  await v.toucher(noeud('Restaurants et sorties'), { ms: 750 });
  await v.pause(4300);
  v.repere('reste');
  await v.toucher(noeud('Non dépensé'), { fx: 0.6, ms: 900 });
  await v.pause(3600);
}
