// Transforme les données fictives des démos en un hôtel fictif (« Hôtel Exemple »), pour les captures de /concepts/hotels/.
const fs = require('fs');
const S = process.argv[2];
const lire = (t) => JSON.parse(Object.values(JSON.parse(fs.readFileSync(`${S}/ls-${t}.json`, 'utf8')))[0]);
const remplacer = (o, M) => {
  if (typeof o === 'string') return M[o] !== undefined ? M[o] : o;
  if (Array.isArray(o)) return o.map((x) => remplacer(x, M));
  if (o && typeof o === 'object') { for (const k of Object.keys(o)) o[k] = remplacer(o[k], M); return o; }
  return o;
};
const supprimerEq = (s, ids, champs) => { for (const c of champs) s[c] = s[c].filter((x) => !ids.includes(x.equipement) && !ids.includes(x.id)); };

// ---------- Vérifications réglementaires
const v = lire('verifications');
v.structure = 'Hôtel Exemple (fictif)';
const idsV = v.equipements.filter((e) => e.type === 'LEV_ACC').map((e) => e.id);
const obsSuppr = v.verifications.filter((x) => idsV.includes(x.equipement)).map((x) => x.id);
supprimerEq(v, idsV, ['equipements', 'verifications', 'observations']);
const typeV = { 'Chariot élévateur n° 1': 'CUIS_ERP', 'Chariot élévateur n° 2': 'CHAUF_ERP', 'Nacelle élévatrice': 'GAZ_ERP' };
for (const e of v.equipements) if (typeV[e.nom]) e.type = typeV[e.nom];
for (const s of v.sites) { if (s.nom === 'Siège · bureaux') s.type = 'erp5'; if (s.nom === 'Plateforme logistique') s.type = 'erp5'; }
remplacer(v, {
  'Siège · bureaux': 'Chambres et étages', 'Plateforme logistique': 'Restaurant et cuisine', "Espace d'accueil du public": 'Accueil, salons et séminaires',
  "Installation électrique du siège": "Installation électrique de l'hôtel", "Parc d'extincteurs (24)": 'Extincteurs des étages (24)',
  "Centrale de traitement d'air": 'Ventilation des chambres (VMC)', "Installation électrique de la plateforme": 'Installation électrique du restaurant',
  'TGBT quai nord': 'Tableau de la cuisine', 'Chariot élévateur n° 1': 'Hotte et appareils de cuisson', 'Chariot élévateur n° 2': 'Chambre froide et climatisation du restaurant',
  'Nacelle élévatrice': 'Installation gaz de la cuisine', 'Porte de quai sectionnelle n° 3': 'Porte automatique de la livraison', 'Quai 3': 'Entrée de service',
  'Extincteurs et RIA de la plateforme': 'Extincteurs de la cuisine et de la salle', 'Rayonnages de stockage': "Conduit d'extraction de la hotte (nettoyage)",
  "Compresseur d'air": "Adoucisseur d'eau", "Installation électrique de l'espace public": 'Installation électrique des salons', "Extincteurs de l'espace public (9)": 'Extincteurs du rez-de-chaussée (9)',
  "Désenfumage de la salle d'accueil": "Désenfumage de l'escalier", 'Levage Contrôle Exemple': 'Cuisine Pro Exemple', 'Atelier': 'Cuisine',
  'Prise de courant détériorée en salle de réunion': 'Prise de courant détériorée en chambre 12',
  'Absence de protection différentielle 30 mA sur la prise du poste de charge 12': 'Absence de protection différentielle 30 mA sur la prise du lave-vaisselle',
  'Capot manquant sur la boîte de dérivation du quai 2': 'Capot manquant sur la boîte de dérivation de la réserve',
  'Joints de bas de tablier usés': 'Joint bas de porte usé', 'Usure du flexible de levage : à remplacer': "Flexible d'alimentation du fourneau à remplacer",
  'Services généraux': 'Direction', 'Responsable maintenance': 'Agent de maintenance', 'Responsable logistique': 'Chef de cuisine', 'Service maintenance interne': 'Maintenance de l\'hôtel',
});
fs.writeFileSync(`${S}/h-verifications.json`, JSON.stringify(v));

// ---------- Maintenance préventive
const m = lire('maintenance');
m.entreprise = 'Hôtel Exemple (fictif)';
const parRep = (r) => m.equipements.find((e) => e.repere === r)?.id;
const idsM = ['CHA-01', 'PON-01', 'TOU-01'].map(parRep);
supprimerEq(m, idsM, ['equipements', 'operations', 'releves', 'interventions']);
const fam = { 'CMP-01': 'cuisine', 'USI-01': 'cuisine', 'TOU-02': 'batiment' };
for (const e of m.equipements) if (fam[e.repere]) e.famille = fam[e.repere];
for (const e of m.equipements) {
  const r = { 'CMP-01': 'CF-01', 'USI-01': 'LV-01', 'TOU-02': 'LL-01', 'GE-01': 'GE-01', 'CHD-01': 'CHD-01', 'CLI-01': 'CLI-01', 'POR-01': 'POR-01', 'POM-01': 'POM-01', 'INC-01': 'INC-01' }[e.repere];
  if (r) e.repere = r;
}
if (!m.familles.includes('cuisine')) m.familles.push('cuisine');
if (!m.familles.includes('batiment')) m.familles.push('batiment');
remplacer(m, {
  'Compresseur à vis 15 kW': 'Chambre froide positive', 'Local compresseur': 'Cuisine, réserve froide', 'Centre d\'usinage vertical': 'Lave-vaisselle à capot',
  'Atelier, travée 1': 'Cuisine, plonge', 'Tour conventionnel': 'Lave-linge professionnel 14 kg', 'Atelier, travée 2': 'Lingerie, sous-sol',
  'Groupe électrogène de secours': 'Groupe électrogène de secours', 'Extérieur, abri': 'Cour arrière', 'Chaudière gaz des bureaux': "Chaudière gaz de l'hôtel",
  'Bureaux, chaufferie': 'Sous-sol, chaufferie', 'Climatisation de la salle serveur': 'Climatisation des chambres', 'Bureaux, salle serveur': 'Étages, groupes en toiture',
  'Porte sectionnelle du quai': "Porte automatique de l'accueil", "Quai d'expédition": 'Entrée principale', 'Pompe de relevage': 'Pompe de relevage',
  'Extérieur, regard sud': 'Parking, regard sud', 'Extincteurs du site (12 appareils)': "Extincteurs de l'hôtel (24 appareils)", 'Tout le site': 'Tous niveaux',
  'Filtre à air : nettoyage ou remplacement': 'Condenseur : nettoyage', 'Vidange et filtre à huile': 'Joints de porte et étanchéité', 'Séparateur air-huile': 'Dégivrage et contrôle de température',
  'Réservoir sous pression : vérification réglementaire': 'Entretien par le frigoriste', 'Graissage et niveaux': 'Filtres et bras de lavage : nettoyage',
  'Bac de liquide de coupe : vidange et nettoyage': 'Détartrage', 'Contrôle des jeux et de la géométrie': 'Révision par le technicien',
  'Cartouche filtre à air compresseur': 'Joint de porte de chambre froide', 'Filtre à huile compresseur': 'Filtre du lave-vaisselle', 'Huile compresseur, bidon de 5 L': 'Détartrant, bidon de 5 L',
  'Séparateur air-huile': 'Sonde de température', 'Graisse multi-usages, cartouche': 'Courroie de lave-linge', 'Filtre unité intérieure clim': 'Filtre unité intérieure clim',
  'Magasin, étagère 2': 'Local technique, étagère 2', 'Magasin, armoire huiles': 'Local technique, armoire', 'Magasin, étagère 4': 'Local technique, étagère 4',
  "Fuite d'air au raccord du sécheur": 'Fuite d\'eau sous le lave-vaisselle', 'Alarme de lubrification centralisée': 'Alarme de température de la chambre froide',
  'Température haute en salle serveur': 'Climatisation en panne en chambre 21', 'Broche bloquée en rotation lente': 'Lave-linge bloqué en essorage',
});
fs.writeFileSync(`${S}/h-maintenance.json`, JSON.stringify(m));

// ---------- Stocks et inventaire
const k = lire('stocks');
k.entreprise = 'Hôtel Exemple (fictif)';
k.categories = ['Linge', "Produits d'accueil", 'Petit-déjeuner', 'Bar et boutique', 'Entretien'];
const A = { // ref : [ref, nom, catégorie, unité, emplacement, fournisseur, prix d'achat en centimes, prix de vente]
  'CIR-SOJ': ['CAF-GRN', 'Café en grains', 'Petit-déjeuner', 'kg', 'Réserve sèche', 'Torréfacteur Exemple', 1850, null],
  'MEC-04': ['SAV-20', 'Mini-savon 20 g', "Produits d'accueil", 'pièce', 'Réserve des étages', 'Accueil Hôtelier Exemple', 22, null],
  'PAR-FIG': ['GEL-5L', 'Gel douche, recharge 5 L', "Produits d'accueil", 'bidon', 'Réserve des étages', 'Accueil Hôtelier Exemple', 3400, null],
  'POT-200': ['DRP-240', 'Drap 240 × 300 cm', 'Linge', 'pièce', 'Lingerie', 'Linge Hôtelier Exemple', 1400, null],
  'COU-200': ['TAI-65', 'Taie d\'oreiller 65 × 65 cm', 'Linge', 'pièce', 'Lingerie', 'Linge Hôtelier Exemple', 350, null],
  'BTE-S': ['SRV-BN', 'Serviette de bain', 'Linge', 'pièce', 'Lingerie', 'Linge Hôtelier Exemple', 790, null],
  'ETQ-RL': ['PGN-L', 'Peignoir taille L', 'Linge', 'pièce', 'Lingerie', 'Linge Hôtelier Exemple', 3200, null],
  'BOU-FIG': ['VIN-ROS', 'Vin rosé 75 cl', 'Bar et boutique', 'bouteille', 'Bar', 'Cave Exemple', 650, 2400],
  'BOU-CED': ['VIN-RGE', 'Vin rouge 75 cl', 'Bar et boutique', 'bouteille', 'Bar', 'Cave Exemple', 700, 2600],
  'DIF-LAV': ['CRM-75', 'Crémant 75 cl', 'Bar et boutique', 'bouteille', 'Bar', 'Cave Exemple', 900, 3200],
  'FON-CIT': ['JUS-1L', 'Jus d\'orange, bouteille 1 L', 'Petit-déjeuner', 'bouteille', 'Réserve froide', 'Épicerie Exemple', 280, null],
  'COF-3': ['COF-TER', 'Coffret du terroir', 'Bar et boutique', 'pièce', 'Accueil', 'Producteurs Exemple', 1450, 3900],
  'MUG-GRE': ['MUG-HOT', "Mug de l'hôtel", 'Bar et boutique', 'pièce', 'Accueil', 'Objets Exemple', 780, 1800],
  'CPO-ILL': ['CPO-ILL', 'Carte postale illustrée', 'Bar et boutique', 'pièce', 'Accueil', 'Imprimerie Exemple', 35, 125],
  'GAN-NIT': ['GAN-NIT', 'Gants nitrile, boîte de 100', 'Entretien', 'boîte', 'Local ménage', 'Hygiène Exemple', 690, null],
  'PAP-SOI': ['SAC-30', 'Sacs poubelle 30 L, rouleau de 50', 'Entretien', 'rouleau', 'Local ménage', 'Hygiène Exemple', 450, null],
  'BOU-PDE': ['COF-NOE', 'Coffret de Noël (édition 2025)', 'Bar et boutique', 'pièce', 'Réserve sèche', 'Producteurs Exemple', 1600, 4200],
};
const facteur = {};
for (const a of k.articles) {
  const n = A[a.ref]; if (!n) continue;
  facteur[a.id] = [n[6] / (a.prixAchat || n[6]), a.prixVente ? (n[7] / a.prixVente) : 1];
  Object.assign(a, { ref: n[0], nom: n[1], categorie: n[2], unite: n[3], emplacement: n[4], fournisseur: n[5], prixAchat: n[6], prixVente: n[7] });
}
for (const x of k.mouvements) { const f = facteur[x.article]; if (f && typeof x.prix === 'number') x.prix = Math.round(x.prix * (x.type === 'sortie' || x.type === 'vente' ? f[1] : f[0])); }
for (const i of k.inventaires) for (const l of i.lignes || []) { const f = facteur[l.article]; if (f && typeof l.cout === 'number') l.cout = Math.round(l.cout * f[0]); }
remplacer(k, { 'Tournant · emballages': 'Tournant · linge' });
fs.writeFileSync(`${S}/h-stocks.json`, JSON.stringify(k));

// ---------- Non-conformités (réclamations et écarts d'un hôtel)
const n = lire('non-conformites');
n.entreprise = 'Hôtel Exemple (fictif)';
n.profil = 'industrie';
n.reglages.libelleZone = 'Service'; n.reglages.libelleLieu = 'Lieu';
n.reglages.zones = ['Réception', 'Étages', 'Petit-déjeuner', 'Restaurant', 'Cuisine', 'Lingerie', 'Maintenance', 'Séminaires'];
const N = [ // titre, lieu, service, détecté par
  ['Chambre remise en vente sans contrôle après travaux', 'Chambre 14', 'Étages', 'Gouvernante'],
  ['Linge livré taché par la blanchisserie', 'Lingerie', 'Lingerie', 'Gouvernante'],
  ['Joints de douche noircis', 'Chambre 22', 'Étages', 'Client'],
  ['Consignes d\'évacuation absentes en chambre', 'Chambre 31', 'Étages', 'Direction'],
  ['Issue de secours encombrée par des chariots', 'Couloir du 2e étage', 'Étages', 'Direction'],
  ['Température de la chambre froide relevée à 6 °C', 'Réserve froide', 'Cuisine', 'Chef de cuisine'],
  ['Allergènes non affichés au buffet', 'Salle du petit-déjeuner', 'Petit-déjeuner', 'Direction'],
  ['Fuite au plafond de la salle de bains', 'Chambre 18', 'Maintenance', 'Client'],
  ['Clé magnétique non désactivée au départ', 'Réception', 'Réception', 'Réceptionniste'],
  ['Climatisation bruyante signalée deux nuits de suite', 'Chambre 21', 'Maintenance', 'Client'],
  ['Thermomètre de cuisine non étalonné', 'Cuisine', 'Cuisine', 'Chef de cuisine'],
  ['Moquette tachée dans le couloir', 'Couloir du 1er étage', 'Étages', 'Gouvernante'],
  ['Prestation de vitrerie non conforme à la commande', 'Façade', 'Maintenance', 'Direction'],
  ['Infiltration au pied d\'une fenêtre', 'Chambre 9', 'Maintenance', 'Client'],
  ['Produits d\'accueil manquants en chambre', 'Chambre 27', 'Étages', 'Client'],
  ['Porte coupe-feu qui ne se ferme plus seule', 'Palier du 3e étage', 'Maintenance', 'Agent de maintenance'],
  ['Tri des déchets non respecté en cuisine', 'Cuisine', 'Cuisine', 'Direction'],
  ['Facture de séminaire erronée', 'Réception', 'Séminaires', 'Client'],
  ['Registre de sécurité non signé après une vérification', 'Réception', 'Réception', 'Direction'],
  ['Lot de serviettes livré en mauvaise taille', 'Lingerie', 'Lingerie', 'Gouvernante'],
  ['Calfeutrement manquant autour d\'une gaine', 'Local technique', 'Maintenance', 'Agent de maintenance'],
];
n.ncs.forEach((x, i) => {
  const [t, l, z, d] = N[i] || N[0];
  Object.assign(x, { titre: t, description: `${t}. Constat fait sur place ; écart photographié.`, lieu: l, zone: z, detectePar: d, photo: `Photo ${1340 + i}` });
  if (x.analyse) x.analyse = { ...x.analyse, pourquoi: [`${t}.`, 'Le contrôle prévu n\'a pas été fait.', 'Aucun point de contrôle écrit pour ce cas.'], racine: 'Aucun point de contrôle écrit pour ce cas.' };
});
remplacer(n, {
  'Reprendre l\'ouvrage et contrôler la reprise': 'Corriger et contrôler sur place', 'Ajouter le point à l\'autocontrôle du lot': 'Ajouter le point à la check-list du service',
  'Afficher la liste des plans en vigueur, mise à jour à chaque indice': 'Afficher les consignes à jour dans chaque chambre', 'Faire réaliser le traitement de fissure': 'Faire intervenir le prestataire',
  'Transmettre les réserves par écrit, avec accusé de lecture': 'Transmettre la réclamation par écrit au prestataire', 'Reprendre le raccord de la bavette': 'Reprendre le joint de la fenêtre',
  'Repiquer et ragréer les zones à faible enrobage': 'Remplacer la ferme-porte', 'Commander des cales adaptées aux diamètres utilisés': 'Commander la pièce de rechange',
  'Obtenir le certificat et l\'étiquette du fabricant': 'Obtenir l\'attestation du prestataire', 'Liste des marquages à contrôler à réception': 'Liste des points à contrôler à la livraison',
  'Rappel des consignes de tri au quart d\'heure sécurité': 'Rappel des consignes de tri au briefing du matin', 'Démonter et reposer la cloison à la cote': 'Reprendre l\'intervention',
  'Vérifier les axes de traçage avec le géomètre avant chaque niveau': 'Contrôle de la chambre avant remise en vente',
  'Chef de chantier gros œuvre': 'Agent de maintenance', 'Responsable qualité': 'Direction', 'Chef d\'équipe plâtrerie': 'Gouvernante', 'Conducteur de travaux': 'Direction', 'Acheteur': 'Réception',
  'Contrôle sur les ouvrages suivants : aucun nouvel écart.': 'Contrôle sur les chambres suivantes : aucun nouvel écart.',
});
fs.writeFileSync(`${S}/h-non-conformites.json`, JSON.stringify(n));
console.log('ok');
