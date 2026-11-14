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

// Préfixe de pack : 3 lettres sans I, L, O, U, distinct de tout préfixe de template.
// `gumroad` : identifiant du produit Gumroad du pack (licence), ajouté une fois la fiche créée.
export const PACKS = {
  PFG: { slug: 'freelance-gestion', nom: 'Pack Freelance : chiffrer, facturer, encaisser', produits: ['TJM', 'PRX', 'DVS', 'MCE', 'RCV', 'TRS'] },
  PFC: { slug: 'freelance-clients', nom: 'Pack Freelance : trouver ses clients', produits: ['APD', 'PRS', 'CRM'] },
  PBT: { slug: 'chef-de-projet-btp', nom: 'Pack Chef de projet BTP', produits: ['GNT', 'VSA', 'RSV', 'NCF', 'CRA'] },
  PPE: { slug: 'petite-entreprise', nom: 'Pack Petite entreprise', produits: ['CNG', 'NDF', 'ARD', 'TRS', 'CRA'] },
  PMG: { slug: 'moyens-generaux', nom: 'Pack Moyens généraux', produits: ['PRC', 'VHC', 'ARD'] },
  PAR: { slug: 'argent', nom: 'Pack Reprendre la main sur son argent', produits: ['BDG', 'ABN', 'DTT', 'TDV', 'PTM'] },
  PMR: { slug: 'mariage-installation', nom: 'Pack Mariage et installation à deux', produits: ['MRG', 'BCM', 'BDG'] },
  PPR: { slug: 'productivite', nom: 'Pack Productivité perso', produits: ['TCH', 'PHR', 'HBT'] },
  PET: { slug: 'etudiant', nom: 'Pack Étudiant', produits: ['REV', 'PHR', 'HBT'] },
  PAS: { slug: 'associations', nom: 'Pack Associations et clubs', produits: ['ASC', 'EVT', 'TRS'] },
  PPB: { slug: 'proprietaire', nom: 'Pack Propriétaire', produits: ['SJR', 'TRV', 'ENT'] },
  PFM: { slug: 'forme', nom: 'Pack Forme', produits: ['NTR', 'HBT'] },
};

// Pack sur mesure : le code porte lui-même la liste des templates (préfixes de 3 lettres accolés), signée.
export const SUR_MESURE = 'SMP';
