// Vidéo 024 · Remboursement de dettes · « Même budget : quel ordre coûte le moins ? »
// Type : réglage (une option, la méthode de remboursement, change le calcul : même budget, mêmes dettes, autres intérêts).
// Fiche :
//   Accroche (dès la 1re image) : « 650 € par mois / sur 6 dettes… / 191 € d'intérêts de trop ? »
//   Bascule (question persistante) : « Même budget : quel ordre coûte le moins ? »
//   Déroulé : accroche (0-3 s) → plan de Camille, méthode boule de neige, intérêts sur tout le plan (3-8 s) → onglet
//   Comparer : même fin, intérêts boule de neige / avalanche lus dans le tableau (8-15 s) → geste réel : « Choisir »
//   sur la ligne Avalanche (15-18 s) → retour au Plan : intérêts avant / après, dette prioritaire du mois, tampon
//   « 191 € d'intérêts en moins » (18-25 s) → outro (25-29 s).
//   Résultat montré : le même budget de 650 € rembourse les mêmes dettes à la même date, avec moins d'intérêts.
// Données : démo intégrée du template (« Camille », fictive). Aucune valeur saisie : le seul geste est le choix de la
// méthode. Toutes les valeurs de l'habillage (budget, nombre de dettes, intérêts, date de fin, écart, dette prioritaire)
// sont LUES dans l'application, avant et après le geste ; l'écart est la différence des deux totaux lus.

export const config = {
  nom: '024-dettes-ordre-avalanche',
  produit: 'DTT', type: 'réglage', titre: 'Même budget, mêmes dettes : quel ordre coûte le moins d\'intérêts ?',
  app: '/templates/dettes/?demo',
  largeur: 1280, hauteur: 1600,
  marque: 'QME · Remboursement de dettes',
  url: 'qm-engineering.fr/templates/dettes',
  affiche: 1.2,
  musique: 'auto',
  dureeMax: 29,
};

const SOUS = '.plan-tete .sous';
const PRIO = '.plan-tete li:has(.etiquette.jaune)';
const ONGLET = (v) => `.onglet[data-vue="${v}"]`;
const TABLE = 'table.tableau.comparaison';
const LIGNE = (n) => `${TABLE} tbody tr:nth-child(${n})`;
const INT = (n) => `${LIGNE(n)} td:nth-child(4)`;
const CHOISIR_AVA = `${LIGNE(2)} button[data-action="methode"][data-id="avalanche"]`;
const centimes = (t) => Math.round(parseFloat(t.replace(/[^\d,]/g, '').replace(',', '.')) * 100);
const euros = (c) => `${Math.round(c / 100).toLocaleString('fr-FR').replace(/\s/g, ' ')} €`;
const interetsDe = (sous) => (sous.match(/([\d\s  ]+€) d'intérêts/) || [])[1]?.replace(/[\s  ]+/g, ' ').trim();

export async function preparer(v) {
  const { appli, page } = v;
  await v.fermerDialogues();
  // Plan : méthode boule de neige, budget et nombre de dettes
  v.sous0 = await v.lire(SOUS);
  v.int0 = interetsDe(v.sous0);
  v.budget = (v.sous0.match(/([\d\s  ,]+€) par mois/) || [])[1]?.replace(/,00/, '').replace(/[\s  ]+/g, ' ').trim();
  const methode0 = await appli.evaluate(() => document.querySelector('[data-action="methode"][aria-checked="true"]')?.dataset.id);
  v.prio0 = (await v.lire(`${PRIO} b`)).trim();
  // Comparer : les deux lignes du tableau
  await appli.click(ONGLET('comparer'));
  await page.waitForTimeout(400);
  const lignes = await appli.evaluate((t) => [...document.querySelectorAll(`${t} tbody tr`)].map((r) => [...r.children].map((c) => c.textContent.replace(/\s+/g, ' ').trim())), TABLE);
  await appli.click(ONGLET('dettes'));
  await page.waitForTimeout(300);
  v.nbDettes = await appli.evaluate(() => (document.querySelector('.vue-dettes h1 + p, .vue-dettes p')?.textContent.match(/(\d+) dettes/) || [])[1]);
  await appli.click(ONGLET('plan'));
  await page.waitForTimeout(400);
  const [b, a] = lignes;
  if (methode0 !== 'boule' || !b?.[0].startsWith('Boule') || !a?.[0].startsWith('Avalanche') || !/Ton plan/i.test(b[6])) throw new Error(`Démo inattendue : ${methode0} · ${JSON.stringify(lignes)}`);
  v.finB = b[1]; v.finA = a[1]; v.intB = b[3]; v.intA = a[3];
  v.ecart = centimes(v.intB) - centimes(v.intA);
  if (!(v.ecart > 5000) || v.finA !== v.finB || !v.nbDettes || !v.budget || !v.int0) throw new Error(`Cas inattendu : ${v.intB} / ${v.intA} · ${v.finB} / ${v.finA} · ${v.nbDettes} dettes · ${v.budget}`);
  v.ecartTxt = euros(v.ecart);
  await appli.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  await v.S('cadrer', null);
  await v.S('fenetre', false);
  await page.waitForTimeout(1500);
}

export async function jouer(v) {
  const { S, son, pause } = v;
  const temps = async (n = 1) => { for (let i = 0; i < n; i++) await v.temps(); };
  const nb = (t) => t.replace(/ /g, '_');

  // Accroche entière dès la première image (couleur dominante : jaune), un seul son d'entrée
  son('whoosh', 0.6);
  await S('accroche', [`${nb(v.budget)} par mois`, `sur ${v.nbDettes} dettes…`, `*${nb(v.ecartTxt)}* d'intérêts`, 'de trop ?'], 0);
  await temps(5);
  son('whoosh'); await S('accrocheSortie');
  await S('question', 'Même budget : *quel_ordre* coûte le moins ?');
  await v.temps(); son('whoosh', 0.7); await S('fenetre', true);

  // Le plan de Camille : boule de neige, intérêts lus dans l'application
  await v.temps(); son('zoom'); await S('cadrer', ['.plan-tete h1', SOUS], { max: 2.6, marge: 30 });
  son('pop'); await S('anneau', 's0', SOUS, { couleur: 'var(--rouge)', etiquette: `${v.int0} d'intérêts`, cote: 'dessous', marge: 6 });
  await S('legende', 'Boule de neige : <b>le plus petit solde</b> d\'abord.');
  await temps(3);
  await S('retirer', 's0');

  // Geste réel : onglet Comparer
  await S('suivre', 2.2);
  await v.cliquer(ONGLET('comparer'), { ms: 520 });
  await pause(300);
  son('glisse', 0.5); await S('cadrer', [`${LIGNE(1)} th`, INT(1), INT(2), `${LIGNE(1)} td:nth-child(2)`], { max: 2.6, marge: 30 });
  await S('legende', `Même budget, même fin : <b>${v.finB}</b>.`);
  son('pop'); await S('anneau', 'b', INT(1), { couleur: 'var(--rouge)', etiquette: 'boule de neige', cote: 'dessus', marge: 6 });
  await temps(2);
  await S('flash', INT(2), 'var(--jaune)');
  son('pop'); await S('anneau', 'a', INT(2), { couleur: 'var(--vert)', marge: 6 });
  await S('legende', 'Avalanche : <b>le taux le plus élevé</b> d\'abord.');
  await temps(3);
  await S('retirer');

  // Geste réel : choisir l'avalanche
  await S('suivre', 2.3);
  await v.cliquer(CHOISIR_AVA, { ms: 480 });
  await pause(300);
  const choisie = await v.appli.evaluate((sel) => /Ton plan/i.test(document.querySelector(sel)?.textContent || ''), LIGNE(2));
  if (!choisie) throw new Error('Le choix de l\'avalanche n\'a pas été pris en compte');
  await v.cliquer(ONGLET('plan'), { ms: 520 });
  await pause(300);

  // Résultat relu après le geste
  const sous1 = await v.lire(SOUS);
  const int1 = interetsDe(sous1);
  const prio1 = (await v.lire(`${PRIO} b`)).trim();
  if (!int1 || int1 === v.int0 || centimes(int1) > centimes(v.int0)) throw new Error(`Rien n'a changé : ${v.int0} → ${int1}`);
  son('dezoom', 0.5); await S('cadrer', ['.plan-tete h1', SOUS, PRIO], { max: 2.4, marge: 30 });
  await S('flash', SOUS, 'var(--jaune)');
  son('pop'); await S('avantApres', 'i', SOUS, v.int0, int1, { couleur: 'var(--vert)', cote: 'dessous', note: 'intérêts' });
  son('pop'); await S('anneau', 'p', PRIO, { couleur: 'var(--jaune)', etiquette: 'priorité du mois', cote: 'dessus', marge: 4 });
  await S('legende', prio1 !== v.prio0 ? `Ce mois-ci, le surplus va à la <b>${prio1}</b>.` : 'Même budget, <b>autre ordre</b>.');
  await temps(3);
  son('eclat'); await S('eclat', SOUS, ['var(--jaune)', 'var(--bleu)', 'var(--rouge)']);
  await v.temps(); son('tampon'); son('ding', 0.7);
  await S('tampon', `${v.ecartTxt} en moins`, 'même budget, même date de fin', 'var(--vert)');
  await temps(3);
  await S('tamponFin'); await S('retirer'); await S('cacherCurseur');

  // Fin
  await v.temps(); son('whoosh'); await S('volet');
  await S('legende', null);
  await S('outro', { titre: 'Remboursement de dettes', sous: 'Le bon ordre,<br>calculé avec vos chiffres.', url: 'Essai gratuit 14 jours · <b>qm-engineering.fr</b>' });
  son('ding', 0.6);
  await temps(4);
}
