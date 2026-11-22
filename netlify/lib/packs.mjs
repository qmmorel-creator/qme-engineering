import { TEMPLATES } from '../../outils/packs/donnees.mjs';

// Packs de templates QME : une seule clé ouvre plusieurs templates.
//
// Source unique côté serveur (codes de pack, licences Gumroad des packs) et côté site (générateur des pages
// /packs/, outils/packs/generer.mjs). Un pack liste les préfixes de ses templates (`produits`) ; seuls ceux
// présents dans PRODUITS sont ouverts, les autres sont annoncés « bientôt » sur la page du pack. Quand un
// template prévu entre dans PRODUITS, les acheteurs du pack y ont accès sans rien faire.
//
// Remise (décision de Quentin, 14/11/2026) : progressive selon le nombre de templates, de 10 à 25 %.
// Prix arrondi à l'euro inférieur. La même règle vaut pour le pack sur mesure.

export const REMISES = [[5, 25], [4, 20], [3, 15], [2, 10]]; // [nombre minimum de templates, % de remise]

export function remise(nombre) {
  for (const [min, pct] of REMISES) if (nombre >= min) return pct;
  return 0;
}

// Prix en centimes (évite les erreurs d'arrondi des flottants) ; prix du pack arrondi à l'euro inférieur.
export function prixPack(prixCentimes) {
  const valeur = prixCentimes.reduce((s, p) => s + p, 0);
  const pct = remise(prixCentimes.length);
  const prix = pct ? Math.floor((valeur * (100 - pct)) / 100 / 100) * 100 : valeur;
  return { valeur, pct, prix, economie: valeur - prix };
}

// Option « Pack évolutif » (décision de Quentin, 14/11/2026) : sans elle, un pack ouvre les templates qu'il
// contenait le jour de l'achat ; avec elle, il ouvre aussi tous les templates ajoutés au pack ensuite.
// Prix de l'option : 25 % du prix du pack, arrondi à l'euro supérieur, 9 € au minimum.
export const OPTION = { pct: 25, minimum: 900, nom: 'Pack évolutif' };
export const prixOption = (prixPackCentimes) => Math.max(OPTION.minimum, Math.ceil((prixPackCentimes * OPTION.pct) / 100 / 100) * 100);

// Templates accessibles avec un pack. `ajouts` d'un pack : préfixe → date (AAAA-MM-JJ) d'ajout au pack après
// son lancement. Avec l'option, tout le pack ; sans elle, les templates d'origine et ceux ajoutés au plus tard
// le jour de l'achat (date inconnue, code généré à la main : templates d'origine seulement).
export function produitsAccessibles(code, { option = false, date = null } = {}, connus = {}) {
  const pack = PACKS[code], ajouts = pack.ajouts || {};
  const jour = date ? String(date).slice(0, 10) : null;
  return pack.produits.filter((p) => connus[p] && (option || !ajouts[p] || (jour && ajouts[p] <= jour)));
}

// Préfixe de pack : 3 lettres sans I, L, O, U, distinct de tout préfixe de template.
// `ajouts` : templates entrés dans le pack après son lancement, avec leur date (voir produitsAccessibles).
// `gumroad` : identifiant du produit Gumroad du pack (licence), ajouté une fois la fiche créée.
export const PACKS = {
  PFG: { slug: 'freelance-gestion', nom: 'Pack Freelance : chiffrer, facturer, encaisser', produits: ['TJM', 'PRX', 'DVS', 'MCE', 'RCV', 'TRS', 'TMP'], gumroad: 'TdGXvyeaHjN_iKZ4zHr9gw==', permalien: 'pack-freelance-gestion' },
  PFC: { slug: 'freelance-clients', nom: 'Pack Freelance : trouver ses clients', produits: ['APD', 'CRM', 'PCM', 'KRF', 'CED', 'CND'], gumroad: 'jE3iyCKKK07ALZrBhP7j_w==', permalien: 'pack-freelance-clients' },
  PBT: { slug: 'chef-de-projet-btp', nom: 'Pack Chef de projet BTP', produits: ['GNT', 'VSA', 'RSV', 'NCF', 'CRA', 'CHT', 'RDE', 'STR'], gumroad: 'Oi7gqrAFzTtGi5bCk205ZA==', permalien: 'pack-chef-de-projet-btp' },
  PPE: { slug: 'petite-entreprise', nom: 'Pack Petite entreprise', produits: ['CNG', 'NDF', 'ARD', 'TRS', 'CRA', 'TDB', 'EQP', 'ENP', 'DRP'], gumroad: 'hHV1OaACgMmSJW0Vkv0SXQ==', permalien: 'pack-petite-entreprise' },
  PMG: { slug: 'moyens-generaux', nom: 'Pack Moyens généraux', produits: ['PRC', 'VHC', 'ARD', 'GMA', 'VRF', 'SDR', 'BSC', 'CTR', 'ACH', 'SMN'] },
  PAR: { slug: 'argent', nom: 'Pack Papiers et décisions d’argent', produits: ['TDV', 'PTM', 'DCS', 'RBS', 'CPT'] },
  PMR: { slug: 'vie-a-deux', nom: 'Pack Vie à deux', produits: ['MRG', 'BCM', 'BDG', 'DMN', 'VYG', 'CDX'] },
  PPR: { slug: 'productivite', nom: 'Pack Productivité perso', produits: ['TCH', 'PHR', 'HBT', 'RDV', 'RVH'] },
  PET: { slug: 'etudiant', nom: 'Pack Étudiant', produits: ['REV', 'PHR', 'HBT', 'PGS', 'NTS', 'CAN', 'MMR'], gumroad: 'YtS6AIhqXdCedt-AqQtjmw==', permalien: 'pack-etudiant' },
  PAS: { slug: 'associations', nom: 'Pack Associations et clubs', produits: ['ASC', 'EVT', 'TRS', 'CMP', 'SBV', 'BNV', 'AGS'] },
  PPB: { slug: 'proprietaire', nom: 'Pack Propriétaire', produits: ['SJR', 'TRV', 'ENT', 'GST', 'SNH', 'CPT', 'RNT', 'CPR', 'ETD'] },
  PFM: { slug: 'forme', nom: 'Pack Forme', produits: ['NTR', 'HBT', 'RPS', 'MSC', 'CRS'] },
  // Packs ouverts le 14/11/2026 ; ceux dont les templates sont encore en préparation n'ont pas de produits.
  PFA: { slug: 'famille', nom: 'Pack Maison et famille', produits: ['BDG', 'ENT', 'RPS', 'GRD', 'BBE', 'ANM', 'PTG'] },
  // Retirés le 22/11/2026 (rationalisation, décision de Quentin) : entièrement contenus dans un plus grand pack.
  PVY: { slug: 'voyage', nom: 'Pack Voyage', produits: ['BCM', 'VYG'], gumroad: 'Kwfo3TDSuJWfngx4ZTJ4xQ==', permalien: 'pack-voyage', retire: '2026-11-22' },
  PNS: { slug: 'enseignant', nom: 'Pack Écoles et formateurs', produits: ['PRG', 'QZZ', 'CSE', 'EDT', 'AEC'] },
  PXP: { slug: 'exploitation', nom: 'Pack Exploitation et maintenance', produits: ['GMA', 'VRF', 'NCF', 'STK'] },
  PCA: { slug: 'commercant-artisan', nom: 'Pack Commerçant et artisan', produits: ['STK', 'DVS', 'MCE', 'TRS', 'TVA'], gumroad: 'YqkUp-9uupBcFHTAAjlkQg==', permalien: 'pack-commercant-artisan' },
  PVT: { slug: 'voiture', nom: 'Pack Ma voiture', produits: ['VTR', 'CAR', 'SVT'], ajouts: { SVT: '2026-11-18' }, gumroad: 'nVivzNvD6qcdSi5wf1UqXQ==', permalien: 'pack-voiture' },
  // Packs ouverts le 15/11/2026, composés de templates déjà en vente.
  // Retiré le 22/11/2026 (décision de Quentin) : doublon du Pack Budget perso et famille, aucune vente. Gardé ici pour
  // qu'un éventuel code ou licence reste valable ; plus de page publique (redirection dans netlify.toml).
  PAQ: { slug: 'argent-du-quotidien', nom: 'Pack Argent du quotidien', produits: ['BDG', 'BCM', 'ABN', 'RDV'], gumroad: '4_R4X-TJIMmWKBpkEg3DSg==', permalien: 'pack-argent-du-quotidien' , retire: '2026-11-22' },
  PBD: { slug: 'bien-demarrer', nom: 'Pack Bien démarrer l’année', produits: ['TCH', 'HBT', 'RDV'], gumroad: 'wZiO_GtwtRZgFPEI6TO0Gw==', permalien: 'pack-bien-demarrer', retire: '2026-11-22' },
  // Pack ouvert le 20/11/2026 (demande de Quentin), composé de templates déjà en vente ; fiche Gumroad reliée le 21/11/2026.
  PBF: { slug: 'budget-perso-famille', nom: 'Pack Budget perso et famille', produits: ['BDG', 'BCM', 'ABN', 'EPG', 'DTT'], gumroad: 'FbVA2eJXNqKeGcjM5sA1aQ==', permalien: 'pack-budget-perso-famille' },
  // Pack Cuisine (demande de Quentin, 22/11/2026) : fiche Gumroad à créer une fois Garde-manger en vente.
  PCS: { slug: 'cuisine', nom: 'Pack Cuisine', produits: ['RPS', 'GRD'], retire: '2026-11-22' },
};

// Pack sur mesure : le code porte lui-même la liste des templates (préfixes de 3 lettres accolés), signée.
export const SUR_MESURE = 'SMP';

// Achat du pack sur mesure sur Gumroad (vérifié le 14/11/2026 dans l'aide Gumroad) : un produit unique
// « Pack sur mesure » à prix libre, avec clé de licence et un champ personnalisé « Templates ». La page
// /packs/composer/ envoie l'acheteur sur …/l/<permalien>?wanted=true&price=<euros>&Templates=<préfixes>
// (pré-remplissage du prix libre et du champ). À la connexion, l'API de vérification de licence renvoie
// le prix payé (`price`, en centimes) et `custom_fields` : le serveur en tire la composition et refuse
// si le montant payé est inférieur au prix du barème. `gumroad` : identifiant du produit, une fois créé.
// Réglages Gumroad à faire à la main : prix libre (minimum 12 €), champ « Templates » obligatoire, clé de
// licence, parité de pouvoir d'achat désactivée pour ce produit, aucun code de réduction applicable.
export const ACHAT_SUR_MESURE = { gumroad: undefined, permalien: undefined, champ: 'Templates' };


// Composition lue dans les champs personnalisés d'un achat (format tolérant : tableau de textes
// « Templates: BDG, ABN », tableau d'objets ou objet), limitée aux templates connus, sans doublon.
export function compositionDepuisAchat(achat, connus) {
  const texte = JSON.stringify(achat?.custom_fields ?? '').toUpperCase();
  return [...new Set((texte.match(/\b[A-Z]{3}\b/g) || []).filter((p) => connus[p] && TEMPLATES[p]))];
}

// Prix du barème pour une composition (centimes), d'après les prix unitaires de outils/packs/donnees.mjs.
export const prixComposition = (compo) => prixPack(compo.map((p) => TEMPLATES[p].prix)).prix;
