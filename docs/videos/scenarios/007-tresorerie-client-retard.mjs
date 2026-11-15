// Vidéo 007 · Trésorerie prévisionnelle 12 mois · « Un client paie 3 mois plus tard : le compte tient-il ? »
// Type : problème. Données : démo intégrée du template (atelier de menuiserie fictif « Atelier Exemple »).
// Geste 1 : le solde du chantier de l'école (encaissement ponctuel) glisse de 3 mois → découvert prévu.
// Geste 2 : l'achat de la machine (décaissement ponctuel) est reporté → le compte reste au-dessus du seuil.
// Toutes les valeurs affichées par l'habillage (mois, montant, titre, point bas) sont LUES dans l'application réelle.
//
// Rendu : lancer le moteur avec LANG=fr_FR.UTF-8 LANGUAGE=fr, sinon Chromium affiche le champ « mois »
// en anglais (« April 2027 ») ; preparer() refuse de tourner sans.

export const config = {
  nom: '007-tresorerie-client-retard',
  produit: 'TRS', type: 'problème', titre: 'Un client paie 3 mois plus tard : le compte tient-il ?',
  app: '/templates/tresorerie/?demo',
  largeur: 1280, hauteur: 1600,
  marque: 'QME · Trésorerie prévisionnelle',
  url: 'qm-engineering.fr/templates/tresorerie',
  affiche: 1.8,
  // Musique de la vidéo de présentation QME (« Corporate », litesaturation, licence Pixabay : usage commercial sans attribution).
  musique: { fichier: 'docs/videos/musique/corporate-litesaturation.m4a', bpm: 110, premierTemps: 0.534, debut: 20.170, volume: 0.6 },
};
const T = 60000 / 110; // un temps en ms

const ECOLE = "Solde du chantier de l'école";
const MACHINE = 'Nouvelle machine à commande numérique';
const MOIS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const ajout = (m, n) => { const [a, x] = m.split('-').map(Number); const d = new Date(Date.UTC(a, x - 1 + n, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
const nomMois = (m) => MOIS_FR[Number(m.split('-')[1]) - 1];
const frappe = (m) => { const n = nomMois(m); return n.length > 5 ? n.slice(0, 4) : n; }; // « avril », « sept » : le champ mois complète

const ONGLET = (vue) => `.onglet[data-vue="${vue}"]`;
const MOIS = '#modale input[name="mois"]';
const ENREGISTRER = '#modale button[value="ok"]';
const TITRE = '.entete-titre h1';
const BAS = '.tuiles .tuile:nth-child(2)';
const BAS_VAL = `${BAS} b`;
const QUAND = (sel) => async (v) => (await v.lire(`${sel} small`)).split('·')[1].trim(); // « Ponctuel · janvier 2027 » → « janvier 2027 »

export async function preparer(v) {
  const { appli, page } = v;
  if (!/^fr/i.test(process.env.LANG || '')) throw new Error('Lancer le rendu avec LANG=fr_FR.UTF-8 LANGUAGE=fr (champ « mois » de Chromium en français).');
  await v.fermerDialogues(); // guide d'accueil du premier lancement, hors caméra

  // Situation de départ lue dans l'application : lignes, mois, soldes de fin de mois du scénario central.
  const d = await appli.evaluate(([e, m]) => {
    const E = window.__tresorerie.etat(), c = window.__tresorerie.calcul();
    const l = (lib) => E.lignes.find((x) => x.libelle === lib);
    return { scenario: E.scenario, seuil: c.seuil, ecole: l(e), machine: l(m), vus: c.vus.map((x) => ({ mois: x.mois, solde: x.solde })) };
  }, [ECOLE, MACHINE]);
  if (d.scenario !== 'central' || !d.ecole || !d.machine || d.ecole.recurrence !== 'ponctuel' || d.machine.recurrence !== 'ponctuel') throw new Error(`Données de démo inattendues : ${JSON.stringify(d)}`);
  v.cibleEcole = ajout(d.ecole.mois, 3);      // le client paie 3 mois plus tard
  v.cibleMachine = ajout(d.machine.mois, 6);  // la machine est reportée de 6 mois
  if (v.cibleEcole.slice(0, 4) !== d.ecole.mois.slice(0, 4) || v.cibleMachine.slice(0, 4) !== d.machine.mois.slice(0, 4)) throw new Error('Changement d\'année : saisie du mois à revoir.');
  // Contrôle du cas : pas de découvert au départ ; découvert après le glissement ; tout au-dessus du seuil après le report.
  const apres1 = d.vus.map((x) => x.solde - (x.mois >= d.ecole.mois && x.mois < v.cibleEcole ? d.ecole.montant : 0));
  const apres2 = apres1.map((s, i) => s + (d.vus[i].mois >= d.machine.mois && d.vus[i].mois < v.cibleMachine ? d.machine.montant : 0));
  if (d.vus.some((x) => x.solde < 0) || !apres1.some((s) => s < 0) || apres2.some((s) => s < d.seuil)) throw new Error(`Le cas attendu n'est pas dans la démo : ${JSON.stringify({ d: d.vus, apres1, apres2 })}`);

  // Point bas de départ, lu sur la synthèse.
  v.bas0 = await v.lire(BAS_VAL);
  // Écran de départ : Prévisions. Sélecteurs des deux lignes construits sur les titres de catégories (aucun identifiant généré).
  await appli.click(ONGLET('previsions')); await page.waitForTimeout(300);
  const sel = async (type, lib) => {
    const p = await appli.$$eval(`.bloc-prev.${type} .groupe-cat`, (gs, l) => {
      for (const [g, n] of gs.entries()) { const i = [...n.querySelectorAll('.ligne-prev')].findIndex((b) => b.querySelector('b').textContent === l); if (i >= 0) return [g + 2, i + 1]; }
      return null;
    }, lib);
    if (!p) throw new Error(`Ligne introuvable : ${lib}`);
    return `.bloc-prev.${type} .groupe-cat:nth-child(${p[0]}) .ligne-prev:nth-of-type(${p[1]})`;
  };
  v.ECOLE = await sel('enc', ECOLE);
  v.MACHINE = await sel('dec', MACHINE);
  await v.S('cadrer', null);
  await v.S('fenetre', false);
}

export async function jouer(v) {
  const { S, son, pause } = v;
  const temps = (n = 1) => pause(n * T);
  const montant = (await v.lire(`${v.ECOLE} .montant`)).replace(/,00\s*€$/, ' €'); // « 14 000,00 € » → « 14 000 € »

  // Accroche : un mot par demi-temps (un seul son d'entrée)
  son('whoosh', 0.6);
  await S('accroche', ['Votre client paie', '*3_mois* plus tard.', '!Le compte *tient-il_?*'], T / 2);
  await v.temps();
  son('whoosh'); await S('accrocheSortie');
  await S('question', 'Le compte *tient-il* ?');
  await v.temps(); son('whoosh', 0.7); await S('fenetre', true);

  // L'encaissement attendu
  await v.temps(); son('zoom'); await S('cadrer', v.ECOLE, { max: 2.4, marge: 40 });
  const quand0 = await QUAND(v.ECOLE)(v);
  await v.temps(); son('pop'); await S('anneau', 'e', v.ECOLE, { etiquette: `Prévu en ${quand0}`, cote: 'dessous', marge: 4 });
  await S('legende', `Un atelier fictif attend <b>${montant}</b> d'un client.`);
  await temps(1.5);
  await S('retirer', 'e');

  // Problème : le client paie 3 mois plus tard. La caméra suit la souris.
  await v.temps(); await S('legende', `Le client paie <b>3 mois plus tard</b>.`, 'Problème');
  son('zoom', 0.7); await S('suivre', 2.2);
  await v.cliquer(v.ECOLE, { ms: 480, fx: 0.3 });
  await S('suivre', 1.9, 0.15, 0); // fenêtre de saisie : cadrée sur le curseur, bouton Enregistrer compris
  await temps(0.3);
  await v.saisir(MOIS, frappe(v.cibleEcole), { ms: 520 });
  await v.temps(2);
  await v.cliquer(ENREGISTRER, { ms: 480 });
  son('zoom', 0.6); await S('cadrer', v.ECOLE, { max: 2.4, marge: 40 });
  const quand1 = await QUAND(v.ECOLE)(v);
  if (!quand1.startsWith(nomMois(v.cibleEcole))) throw new Error(`Le mois n'a pas changé : ${quand1}`);
  await v.temps();
  await S('flash', v.ECOLE, 'var(--ciel)');
  son('pop'); await S('avantApres', 'e', `${v.ECOLE} small`, quand0, quand1, { couleur: 'var(--bleu)', cote: 'dessous' });
  await temps(2);
  await S('retirer', 'e');

  // La synthèse signale le découvert
  son('dezoom'); await S('suivre', 1.5, 0.15);
  await v.cliquer(ONGLET('synthese'), { ms: 520 });
  son('zoom'); await S('cadrer', [TITRE, BAS], { max: 2.4, marge: 60 });
  const titre1 = await v.lire(TITRE), bas1 = await v.lire(BAS_VAL);
  if (!/^Découvert/.test(titre1)) throw new Error(`Titre inattendu : ${titre1}`);
  const moisDec = titre1.replace(/^Découvert prévu en\s*/, '').replace(/\.$/, '');
  await v.temps();
  await S('flash', TITRE, 'var(--rouge)');
  son('alerte', 0.8); await S('avantApres', 'b', BAS_VAL, v.bas0, bas1, { couleur: 'var(--rouge)', cote: 'dessous', note: 'point bas' });
  await v.temps(); son('tampon'); await S('secouer', 'b'); await S('coup', 0.05);
  await S('tampon', `Découvert en ${moisDec}`, `Point bas : ${bas1}`, 'var(--rouge)');
  await temps(1.8);
  await S('tamponFin'); await S('retirer');

  // Solution : reporter l'achat de la machine
  await v.temps(); await S('legende', `Reporter <b>l'achat de la machine</b>.`, 'Solution');
  son('dezoom'); await S('suivre', 1.5, 0.15);
  await v.cliquer(ONGLET('previsions'), { ms: 520 });
  // La ligne de la machine est en bas de page : vraie molette pour la remonter au-dessus du message « Prévision enregistrée ».
  await S('curseurVers', 900, 1000, 450); son('glisse', 0.5);
  const t = await S('versToile', 900, 1000); await v.page.mouse.move(t.x, t.y);
  for (let i = 0; i < 8; i++) { await v.page.mouse.wheel(0, 80); await pause(30); }
  son('zoom', 0.7); await S('suivre', 2.2);
  const quand2 = await QUAND(v.MACHINE)(v);
  await v.cliquer(v.MACHINE, { ms: 520, fx: 0.3 });
  await S('suivre', 1.9, 0.15, 0);
  await temps(0.3);
  await v.saisir(MOIS, frappe(v.cibleMachine), { ms: 520 });
  await v.temps(2);
  await v.cliquer(ENREGISTRER, { ms: 480 });
  son('zoom', 0.6); await S('cadrer', v.MACHINE, { max: 2.4, marge: 40 });
  const quand3 = await QUAND(v.MACHINE)(v);
  if (!quand3.startsWith(nomMois(v.cibleMachine))) throw new Error(`Le mois n'a pas changé : ${quand3}`);
  await v.temps();
  await S('flash', v.MACHINE, 'var(--ciel)');
  son('pop'); await S('avantApres', 'm', `${v.MACHINE} small`, quand2, quand3, { couleur: 'var(--bleu)', cote: 'dessous' });
  await temps(2);
  await S('retirer', 'm');

  // Verdict
  son('dezoom'); await S('suivre', 1.5, 0.15);
  await v.cliquer(ONGLET('synthese'), { ms: 520 });
  son('zoom'); await S('cadrer', [TITRE, BAS], { max: 2.4, marge: 60 });
  const titre2 = await v.lire(TITRE), bas2 = await v.lire(BAS_VAL);
  if (!/au-dessus du seuil/.test(titre2)) throw new Error(`Titre inattendu : ${titre2}`);
  await v.temps();
  await S('flash', TITRE, 'var(--vert)');
  son('eclat'); await S('eclat', TITRE, ['var(--vert)', 'var(--jaune)', 'var(--bleu)']);
  await S('avantApres', 'b', BAS_VAL, bas1, bas2, { couleur: 'var(--vert)', cote: 'dessous', note: 'point bas' });
  son('trait', 0.6); await S('souligner', 's', TITRE, 'var(--vert)');
  await v.temps(); son('tampon'); son('ding', 0.7);
  await S('tampon', 'Plus de découvert', 'Au-dessus du seuil sur 12 mois', 'var(--vert)');
  await temps(2);
  await S('tamponFin'); await S('retirer'); await S('cacherCurseur');

  // Fin
  await v.temps(); son('whoosh'); await S('volet');
  await S('legende', null);
  await S('outro', { titre: 'Trésorerie prévisionnelle', sous: 'Le creux de trésorerie repéré<br>des mois à l\'avance.', url: 'Démo gratuite · <b>qm-engineering.fr</b>' });
  son('ding', 0.6);
  await temps(3.5);
}
