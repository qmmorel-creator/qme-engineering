// Messages de reçu Gumroad (champ « custom_receipt_text », 500 caractères au plus), un par produit.
// Décision de Quentin du 18/11/2026 : un message chaleureux avec émojis, sur le modèle du message WhatsApp
// envoyé avec un code gratuit, et un premier geste propre à chaque produit.
//
// Ajouter un produit : une entrée dans RECUS (identifiant Gumroad, nom, premier geste, partage éventuel),
// puis `node docs/templates/communication/recus-gumroad.mjs <identifiant>` affiche le texte à passer à
// `mcp__Gumroad__update_product` (custom_receipt_text). Sans argument : contrôle de tous les textes.

export const LIMITE = 500;

const ENTETE = [
  '🎉 Merci pour ton achat !',
  "🔑 Ta clé de licence (ci-dessus) est ton code d'accès.",
  '1️⃣ Ouvre qm-engineering.fr/connexion',
  '2️⃣ Colle la clé et coche « Rester connecté »',
];
const PIED = [
  '📱 Même clé sur ordinateur, tablette et téléphone, rien à installer.',
  '❓ Une question : quentin.morel@qm-engineering.fr',
];

// geste : étape 3, ce que l'acheteur fait juste après l'ouverture. partage : ligne 👥 si la clé se partage.
export const RECUS = [
  // Templates
  { id: 'zjO4cm1dUdBGh1IfYqmklw==', nom: 'Planning de révision', geste: "Ajoute tes matières, tes chapitres et ta date d'examen : chaque jour, tes révisions s'affichent (J+1, J+3, J+7…)." },
  { id: '29mMG1jJqiRppcqs_Mt09w==', nom: "Compte rendu et plan d'actions", geste: "Note chaque action en une ligne (« Marie : envoyer le devis vendredi ») : elle revient toute seule à la réunion suivante tant qu'elle n'est pas faite." },
  { id: '-T__Q8H0-88YesaxXTxU4w==', nom: 'Coût de revient et prix par client', geste: "Saisis tes charges et tes heures facturables : ton coût horaire, ton prix plancher et ton prix conseillé se calculent." },
  { id: 'M7_JNLoIwpFH6zWHHxhOUA==', nom: 'Calculateur de TJM freelance', geste: "Indique ton revenu visé, tes frais, tes jours facturables et ton statut : ton TJM minimum et conseillé s'affichent." },
  { id: 'fb4T6HNJyejxH1Q-mL8x8g==', nom: 'Livre recettes-dépenses micro-entreprise', geste: "Note tes recettes et tes achats au fil de l'eau : ton livre et ton registre se tiennent tout seuls." },
  { id: 'FK_HeZlqRLdZO8o7Y1Bccw==', nom: 'Budget commun', geste: "Choisis ton modèle de foyer et ajoute vos dépenses : qui doit combien à qui se calcule.", partage: "Transmets la clé à ton ou ta partenaire ou à tes colocs : vous voyez les mêmes comptes." },
  { id: 'CJfr2K4d-pBBg-5mOHaYMA==', nom: 'Planning Gantt rapide', geste: "Tape une tâche par ligne avec sa durée : le Gantt se dessine, liens et jours fériés compris." },
  { id: 'fhPqrSBXayFL21IZWU6YIg==', nom: 'Gestionnaire de tâches', geste: "Choisis tes statuts, note tout en une ligne, puis garde chaque matin les 3 à 5 tâches qui comptent." },
  { id: 'gPo_NgvoB4zjkqk2mFkXBQ==', nom: 'Nutrition et dépense énergétique', geste: "Donne ton accord pour l'enregistrement de tes données et renseigne ton profil : ta dépense du jour se calcule." },
  { id: 'YvGeAPDZjuqr9yflNtLhhw==', nom: 'Budget du foyer', geste: "Choisis ton modèle de foyer, puis répartis tes revenus dans tes enveloppes." },
  { id: 'TmtmeDwq1OsE2Y9gL6rDag==', nom: 'Organisateur de mariage', geste: "Indique la date du mariage : ton rétroplanning se cale dessus. 💍", partage: "Partage la clé avec ta moitié : vous préparez tout à deux." },
  { id: 'zJsheWedmR4QFEZA1e15mA==', nom: 'Circuit de visa des documents', geste: "Crée ton opération, coche tes lots et tes viseurs, puis reporte les délais de ton marché dans les réglages." },
  { id: 'DzQ3gTUdCp2Eg3dECASbhA==', nom: 'Registre des non-conformités', geste: "Note ton premier écart : constat, cause, action et vérification, suivis jusqu'à la clôture." },
  { id: 'OGiloE9iB6oIL0UuitwyBA==', nom: 'CRM freelance', geste: "Indique ton délai de paiement et ton taux de TVA, puis ajoute tes contacts avec leur prochaine action datée." },
  { id: '6uyeEBR91feI1tM2Wbij8Q==', nom: 'Planner horaire', geste: "Glisse tes blocs de 30 minutes sur la semaine : chaque vendredi, le bilan du prévu et du réalisé t'attend." },
  { id: '1xyF3Lz36TxDCOz4KnVB4A==', nom: 'Levée de réserves', geste: "Crée ton opération, coche tes lots, puis saisis tes réserves pendant la visite, même sur téléphone." },
  { id: 'RmzvzczQ7xnP2IP7yRfwBg==', nom: 'Générateur de devis', geste: "Remplis ton catalogue de prestations, puis crée ton premier devis : remises, TVA et mentions sont vérifiées." },
  { id: 'no1AEwLFPlXydqFGU7vRzg==', nom: 'Trésorerie prévisionnelle 12 mois', geste: "Saisis ton solde de départ et tes encaissements prévus : l'alerte se déclenche si le solde passe sous ton seuil." },
  { id: '5XuVWuitD2ZzpVkwQFHlVw==', nom: 'Inscriptions associatives', geste: "Nomme ta saison, choisis tes activités, saisis tes tarifs, puis inscris les familles." },
  { id: 'leplToyYwMtXCmdXZa9T4Q==', nom: 'Pilote de travaux maison', geste: "Choisis un modèle (cuisine, salle de bains…), ajoute tes devis et retiens ceux que tu signes : budget et planning suivent. 🔨" },
  { id: 'fCyii9wIVdIfFc1YQdbZzQ==', nom: 'Secret Santa', geste: "Crée un échange et envoie le lien d'invitation au groupe. Lance le tirage quand tout le monde est inscrit : même toi, tu ne sauras pas qui offre à qui. 🎅" },
  { id: 'DvjP1MxGl7bGDZiHfGgcfQ==', nom: "Suivi d'habitudes et routines", geste: "Choisis une routine type et coche tes habitudes du jour : tes séries démarrent. 🔥" },
  { id: '-5-cTF1xpPORIx5P_zGn7w==', nom: 'Remboursement de dettes', geste: "Ajoute tes dettes et ton budget : la date où tout est soldé se calcule." },
  { id: '5wUF3mCVqbG3yAF-coM12A==', nom: 'Suivi des abonnements', geste: "Coche tes abonnements dans la liste et saisis tes prix : les totaux et les alertes se calculent." },
  { id: 'A8JdI_BV8_BHRmFHWK4r3A==', nom: 'Inventaire valorisé', geste: "Coche les familles d'objets que tu possèdes et ajoute tes objets : leur valeur se calcule." },
  { id: 'sz94ceBG8cN4BLBpImKYxQ==', nom: 'Temps de vie', geste: "Indique ton revenu net et ton temps de travail : chaque dépense se convertit en heures de vie. ⏳" },
  { id: 'NOhwt805chMWKwJGEDhgJQ==', nom: "Préparateur d'appel découverte", geste: "Crée ton premier appel et choisis tes questions : le plan minuté se calcule. 📞" },
  { id: 'xbHURXS0w79P1ap-nFBbWQ==', nom: 'Relance des impayés', geste: "Saisis tes factures en attente : le retard, les pénalités et le message de relance se calculent." },
  { id: '4yl9UwCwQPGWahkhI0oJUA==', nom: 'Stocks et inventaire', geste: "Crée tes articles avec leur stock de départ, puis note tes entrées et tes sorties : alertes et liste à commander suivent. 📦" },
  { id: 'VP_lDEeIUWMGQ8bSAZ12tQ==', nom: 'Simulateur leasing ou achat', geste: "Indique le véhicule et tes kilomètres, puis tes offres : le coût total net de chacune se calcule. 🚗" },
  { id: 'XMvZIWF4YueA-fSR5lunEg==', nom: 'Tableau de bord annuel et roue de vie', geste: "Choisis tes domaines de vie, note ton point de départ en 5 minutes, puis ajoute tes objectifs. 🎯" },
  { id: 'sEO7sJxS14azsCZ761I-yQ==', nom: "Objectif d'épargne et fonds d'urgence", geste: "Commence par le fonds d'urgence : chiffre-le, indique ton versement mensuel et la date d'atteinte s'affiche. 🐷" },
  { id: 'KZHfWPckpGMOxeFYDPcrow==', nom: "Document unique d'évaluation des risques", geste: "Indique ton activité et ton effectif, coche tes unités de travail, puis cote les risques proposés." },
  { id: 'EnpmgktOylLJZJST9_Tfhg==', nom: 'Repas de la semaine et liste de courses', geste: "Indique combien vous êtes à table et place tes recettes sur la semaine : la liste de courses se calcule. 🛒" },
  { id: 'B0MUKsC_AHC_LeiL83xQvA==', nom: 'Planificateur de voyage', geste: "Indique les dates et les voyageurs, puis ajoute tes étapes. Bon voyage ! ✈️" },
  { id: 'uGMwDvkv48r4plEy5vFJNQ==', nom: "Planning d'équipe et staffing", geste: "Choisis ton secteur, ajoute ton équipe et tes projets, puis affecte des heures par semaine.", partage: "Partage la clé avec les managers qui tiennent le planning avec toi." },
  { id: '1evFhHOrqZyrgIdg9T483A==', nom: 'Gestion de compétition sportive', geste: "Choisis un format de départ, puis inscris les participants : vagues et horaires se calculent. 🏆" },
  { id: 'nSUWbSsPnceWsczHeshUnw==', nom: 'Dossier sinistre habitation', geste: "Réponds aux six questions de l'assistant : ton dossier est créé et le délai pour déclarer s'affiche." },
  { id: '1T1zE6319ZF9qexKr8Kzzw==', nom: 'Carnet de musculation et cross-training', geste: "Choisis ton unité et note ta première séance : le volume et les records se calculent. 💪" },
  { id: '-cFP8vq3TQIStzfF1gSA-w==', nom: 'Carnet de voiture', geste: "Ajoute ta voiture et son kilométrage du jour, puis note tes pleins : échéances et coût au kilomètre suivent. 🚗" },
  { id: 'u-ySqLkS21aA1mhfeG9EFQ==', nom: 'Suivi du temps et rentabilité par mission', geste: "Indique ton TJM cible, crée ta première mission et lance le chronomètre. ⏱️" },
  { id: 'cfXnYcVohgvMwrn0ONglsQ==', nom: 'Suivi de lecture', geste: "Fixe ton objectif de l'année, ajoute le livre que tu lis, puis note ta page après chaque lecture. 📚" },
  { id: 'mfJW49fm4F0bQ7rUSdY8Kw==', nom: 'Notes et moyennes', geste: "Choisis ta formation, recopie tes matières avec leurs coefficients, puis note chaque résultat. 🎓" },
  { id: 'eo2d-2oYp7KgqGwQQ_v4OA==', nom: "État des lieux d'entrée et de sortie", geste: "Crée ton logement, choisis un modèle de pièces, puis note chaque élément le jour de la visite. 🏠" },
  { id: 'aGMrUCFVZ9yzLWfaNIWQ1w==', nom: 'Suivi de TVA', geste: "Choisis ton régime et la date de début, puis saisis tes opérations : chaque période se calcule." },
  { id: 'uJxPWSYtiXp3nixYfudDoQ==', nom: 'Papiers du foyer', geste: "Indique les prénoms du foyer, ton premier emplacement et coche les documents que tu as : ton inventaire est prêt. 📂" },
  { id: '-yAS1RKHFCUmacHWd-lOAw==', nom: "Capacité d'emprunt et comparateur de prêts", geste: "Indique tes revenus, ton projet et le taux d'une offre reçue : ta capacité d'emprunt s'affiche. 🏡" },
  { id: '3hYVauouIDMw3cQ-RA5gCQ==', nom: 'Candidatures études, stages, alternance', geste: "Crée ta première candidature avec sa liste de pièces et sa date limite. Bonne chance ! 🍀" },
  { id: '-JA7LGCBFecmAERfqUDnZQ==', nom: 'Planning de mémoire ou de thèse', geste: "Choisis le type de travail, saisis ta date de rendu et le nombre de mots demandé, puis adapte le plan. ✍️" },
  { id: 'geVSrMzs3CshVaDi9IeCaQ==', nom: "Rentabilité d'un investissement locatif", geste: "Décris un premier bien (prix, loyer, taxe foncière), puis tes frais et ton crédit : rendements et cash-flow s'affichent." },
  { id: '1DfML3czjZu5bg95z3KuRg==', nom: 'Vivre sans voiture', geste: "Réponds au questionnaire, puis remplace les valeurs d'exemple par tes chiffres. 🚲" },
  // Packs : la clé ouvre le tableau de bord du pack (/packs/espace/).
  { id: 'TdGXvyeaHjN_iKZ4zHr9gw==', nom: 'Pack Freelance : chiffrer, facturer, encaisser', pack: 7, geste: "Ton tableau de bord s'ouvre : TJM, devis, trésorerie… chaque template s'ouvre d'un clic." },
  { id: 'YtS6AIhqXdCedt-AqQtjmw==', nom: 'Pack Étudiant', pack: 7, geste: "Ton tableau de bord s'ouvre : révisions, notes, mémoire… chaque template s'ouvre d'un clic. 🎓" },
  { id: 'Kwfo3TDSuJWfngx4ZTJ4xQ==', nom: 'Pack Voyage', pack: 2, geste: "Ton tableau de bord s'ouvre : planificateur de voyage et budget commun, chacun d'un clic. ✈️" },
  { id: 'nVivzNvD6qcdSi5wf1UqXQ==', nom: 'Pack Ma voiture', pack: 3, geste: "Ton tableau de bord s'ouvre : carnet de voiture, leasing ou achat, vivre sans voiture, chacun d'un clic. 🚗" },
  { id: '4_R4X-TJIMmWKBpkEg3DSg==', nom: 'Pack Argent du quotidien', pack: 4, geste: "Ton tableau de bord s'ouvre : budget, abonnements, budget commun… chaque template s'ouvre d'un clic." },
  { id: 'wZiO_GtwtRZgFPEI6TO0Gw==', nom: 'Pack Bien démarrer l’année', pack: 3, geste: "Ton tableau de bord s'ouvre : tâches, habitudes et roue de vie, chacun d'un clic. 🎯" },
];

export function texteRecu({ geste, partage, pack }) {
  const entete = pack
    ? [ENTETE[0], `🔑 Ta clé de licence (ci-dessus) ouvre les ${pack} templates du pack.`, ...ENTETE.slice(2)]
    : ENTETE;
  return [...entete, `3️⃣ ${geste}`, ...(partage ? [`👥 ${partage}`] : []), ...PIED].join('\n');
}

export function controler() {
  const erreurs = [];
  const ids = new Set();
  for (const r of RECUS) {
    if (ids.has(r.id)) erreurs.push(`${r.nom} : identifiant en double`);
    ids.add(r.id);
    const n = texteRecu(r).length; // unités UTF-16 : majorant du compte en caractères de Gumroad
    if (n > LIMITE) erreurs.push(`${r.nom} : ${n} caractères (limite ${LIMITE})`);
  }
  return erreurs;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const id = process.argv[2];
  if (id) {
    const r = RECUS.find((x) => x.id === id || x.nom === id);
    if (!r) { console.error(`Produit inconnu : ${id}`); process.exit(1); }
    console.log(texteRecu(r));
  } else {
    const erreurs = controler();
    for (const r of RECUS) console.log(`${String(texteRecu(r).length).padStart(3)}  ${r.nom}`);
    if (erreurs.length) { console.error(erreurs.join('\n')); process.exit(1); }
    console.log(`${RECUS.length} reçus conformes.`);
  }
}
