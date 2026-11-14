// Base intégrée du template Papiers du foyer : catégories, documents types avec leur durée de conservation,
// types d'emplacement, conseils. Aucune logique ici.
//
// Durées de conservation : reprises de la fiche « Durée de conservation des papiers » de service-public.gouv.fr
// (F19134, Direction de l'information légale et administrative), page « vérifiée le 13 octobre 2026 »,
// consultée par QME le 14 novembre 2026. Ce sont des durées minimales indicatives, pas un conseil juridique :
// une procédure en cours peut imposer de garder un document plus longtemps. Chaque durée reste modifiable
// document par document (date choisie ou « garder toujours »). À revérifier chaque année (champ `verifie`).
//
// Les pièces d'identité, titres de séjour, permis et documents sans durée dans la fiche sont marqués « hors
// fiche » : l'application ne calcule pas de date pour les jeter.
//
// Règle de conservation `r` :
//   'P'                  conservation permanente
//   { a, m, j }          années / mois / jours à compter de la date du document
//   { fin, a, m }        à compter d'un événement (`fin` = son libellé : « la clôture du compte »…) que
//                        l'utilisateur date lui-même ; tant qu'il n'est pas daté, le document est gardé
//   { dec }              jusqu'au 31 décembre de la `dec`-ième année suivant la date du document
//   { valide: true }     tant que la pièce est valable (aucune date pour la jeter)
//   { aucune: '…' }      pas de durée chiffrée dans la fiche : l'utilisateur choisit
(() => {
  // d(identifiant stable, catégorie, nom, règle, durée telle qu'écrite dans la fiche, options)
  // options : e = essentiel en cas d'urgence, ech = libellé de l'échéance de renouvellement, hors = hors fiche
  const d = (id, cat, nom, r, src, o = {}) => ({ id, cat, nom, r, src, e: Boolean(o.e), ech: o.ech || '', hors: Boolean(o.hors), aide: o.aide || '' });
  const RETRAITE = 'la liquidation de ta retraite';

  window.BASE = {
    version: '2026-11-14',
    source: {
      titre: 'Durée de conservation des papiers',
      editeur: 'service-public.gouv.fr (Direction de l\'information légale et administrative)',
      reference: 'fiche F19134',
      url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F19134',
      verifiePar: '13 octobre 2026', // date « Vérifié le » affichée sur la fiche
      consulte: '2026-11-14', // date de consultation par QME
    },
    avertissement: 'Durées minimales indicatives tirées de service-public.gouv.fr, pas un conseil juridique : en cas de litige ou de procédure en cours, garde le document plus longtemps.',

    categories: [
      { id: 'identite', nom: 'Identité', long: 'Identité et titres', court: 'ID' },
      { id: 'famille', nom: 'Famille', long: 'État civil, famille et scolarité', court: 'FAM' },
      { id: 'logement', nom: 'Logement', long: 'Logement, factures et achats', court: 'LOG' },
      { id: 'impots', nom: 'Impôts', long: 'Impôts et succession', court: 'IMP' },
      { id: 'banque', nom: 'Banque', long: 'Banque, crédits et épargne', court: 'BQE' },
      { id: 'sante', nom: 'Santé', long: 'Santé et remboursements', court: 'SAN' },
      { id: 'travail', nom: 'Travail', long: 'Travail, chômage et retraite', court: 'TRA' },
      { id: 'vehicule', nom: 'Véhicule', long: 'Véhicule et permis', court: 'VEH' },
      { id: 'assurances', nom: 'Assurances', long: 'Assurances', court: 'ASS' },
    ],

    // Types d'emplacement proposés (nom libre ensuite : « Classeur bleu », « Boîte à chaussures », « Drive »).
    typesLieu: [
      { id: 'classeur', nom: 'Classeur ou trieur' },
      { id: 'boite', nom: 'Boîte ou pochette' },
      { id: 'tiroir', nom: 'Tiroir ou meuble' },
      { id: 'coffre', nom: 'Coffre ou lieu sûr' },
      { id: 'numerique', nom: 'Dossier numérique (cloud, ordinateur)' },
      { id: 'ailleurs', nom: 'Chez quelqu\'un d\'autre (notaire, proche…)' },
      { id: 'autre', nom: 'Autre' },
    ],
    couleurs: ['#2E5A88', '#E58C74', '#E8B93A', '#6C8E5A', '#8A6BA8', '#B84A34', '#4E8C96', '#9A7B4F'],

    documents: [
      // ---------- Identité (hors fiche : pas de durée de conservation, on suit la validité) ----------
      d('cni', 'identite', 'Carte nationale d\'identité', { valide: true }, null, { e: true, ech: 'Fin de validité', hors: true }),
      d('passeport', 'identite', 'Passeport', { valide: true }, null, { e: true, ech: 'Fin de validité', hors: true }),
      d('sejour', 'identite', 'Titre de séjour', { valide: true }, null, { e: true, ech: 'Fin de validité', hors: true, aide: 'Les délais pour demander le renouvellement dépendent du titre : vérifie-les sur service-public.gouv.fr.' }),
      d('vitale', 'identite', 'Carte Vitale', { valide: true }, null, { e: true, hors: true }),
      d('electeur', 'identite', 'Carte électorale', { valide: true }, null, { hors: true }),

      // ---------- Famille, état civil, scolarité ----------
      d('livret', 'famille', 'Livret de famille', 'P', 'Conservation permanente', { e: true }),
      d('etatcivil', 'famille', 'Acte d\'état civil (naissance, mariage, décès)', 'P', 'Conservation permanente', { e: true }),
      d('mariage', 'famille', 'Contrat de mariage', 'P', 'Conservation permanente'),
      d('pacs', 'famille', 'Convention de Pacs', 'P', 'Conservation permanente'),
      d('jugement', 'famille', 'Jugement de divorce ou d\'adoption', 'P', 'Conservation permanente'),
      d('reconnaissance', 'famille', 'Acte de reconnaissance d\'un enfant', 'P', 'Conservation permanente'),
      d('caf', 'famille', 'Avis de versement d\'allocations familiales', { a: 5 }, '5 ans'),
      d('scolfact', 'famille', 'Facture de cantine, garderie, activités', { a: 5 }, '5 ans'),
      d('scolcert', 'famille', 'Certificat de scolarité', { fin: 'la fin des études', a: 5 }, 'Fin des études + 5 ans'),
      d('bourse', 'famille', 'Justificatif de bourse ou d\'aide aux études', { fin: 'la fin des études', a: 5 }, 'Fin des études + 5 ans'),
      d('livretscol', 'famille', 'Livret scolaire', { fin: 'la fin des études' }, 'Jusqu\'à la fin des études'),
      d('diplome', 'famille', 'Diplôme', 'P', 'Conservation permanente', { e: true }),
      d('notessup', 'famille', 'Relevé de notes d\'études supérieures', 'P', 'Conservation permanente'),
      d('militaire', 'famille', 'Livret militaire, attestation des services', 'P', 'Conservation permanente'),

      // ---------- Logement, factures et achats ----------
      d('titrepropriete', 'logement', 'Acte de vente (titre de propriété)', 'P', 'Conservation permanente', { e: true }),
      d('bail', 'logement', 'Contrat de location et état des lieux', { fin: 'la fin de la location', a: 3 }, 'Durée de la location + 3 ans', { e: true }),
      d('quittance', 'logement', 'Quittance de loyer', { fin: 'la fin de la location', a: 3 }, 'Durée de la location + 3 ans'),
      d('revisionloyer', 'logement', 'Courrier de révision de loyer', { fin: 'la fin de la location', a: 3 }, 'Durée de la location + 3 ans'),
      d('energie', 'logement', 'Facture d\'électricité ou de gaz', { a: 5 }, '5 ans'),
      d('eau', 'logement', 'Facture d\'eau', { a: 5 }, '5 ans'),
      d('telecom', 'logement', 'Facture de téléphone ou d\'internet', { a: 5 }, '5 ans'),
      d('box', 'logement', 'Preuve de restitution de la box', { a: 5 }, '5 ans'),
      d('petitstravaux', 'logement', 'Facture de petits travaux', { a: 5 }, '5 ans'),
      d('grostravaux', 'logement', 'Facture de gros travaux (gros œuvre)', { a: 10 }, '10 ans (durée de conservation du logement pour une construction, un agrandissement ou une amélioration)'),
      d('ramonage', 'logement', 'Attestation de ramonage', { a: 2 }, '2 ans (au moins 5 ans conseillés)'),
      d('chaudiere', 'logement', 'Attestation d\'entretien de la chaudière', { a: 2 }, '2 ans (au moins 5 ans conseillés)'),
      d('dpe', 'logement', 'Diagnostic de performance énergétique (depuis le 1er juillet 2021)', { a: 10 }, '10 ans'),
      d('copro', 'logement', 'Charges de copropriété, PV d\'assemblée générale', { a: 5 }, '5 ans'),
      d('apl', 'logement', 'Justificatif de versement de l\'APL', { fin: 'la fin de tes droits', a: 5 }, 'Fin des droits + 5 ans'),
      d('demenageur', 'logement', 'Contrat de déménagement', { a: 1 }, '1 an'),
      d('achat', 'logement', 'Facture d\'achat (électroménager, meuble…)', { a: 5 }, '5 ans à partir de la date d\'achat'),
      d('garantie', 'logement', 'Justificatif d\'achat pour la garantie', { fin: 'la fin de la garantie' }, 'Jusqu\'à la fin de la garantie', { ech: 'Fin de la garantie' }),

      // ---------- Impôts ----------
      d('ir', 'impots', 'Impôt sur le revenu (déclaration, avis, justificatifs)', { dec: 2 }, 'Jusqu\'au 31 décembre de la 2e année suivant la mise en recouvrement', { aide: 'Date du document : la date de mise en recouvrement indiquée sur l\'avis.' }),
      d('foncier', 'impots', 'Taxe foncière', { dec: 1 }, 'Jusqu\'au 31 décembre de l\'année suivant la mise en recouvrement', { aide: 'Date du document : la date de mise en recouvrement indiquée sur l\'avis.' }),
      d('thsecondaire', 'impots', 'Taxe d\'habitation (résidence secondaire)', { dec: 1 }, 'Jusqu\'au 31 décembre de l\'année suivant la mise en recouvrement'),
      d('ifi', 'impots', 'Impôt sur la fortune immobilière', { dec: 2 }, 'Jusqu\'au 31 décembre de la 2e année suivant la mise en recouvrement'),
      d('succession', 'impots', 'Déclaration de succession et justificatifs', { dec: 3 }, 'Jusqu\'au 31 décembre de la 3e année suivant le dépôt (conservation permanente conseillée)'),
      d('creditimpot', 'impots', 'Justificatif du crédit d\'impôt emploi à domicile', { dec: 3 }, 'Jusqu\'à la fin de la 3e année suivant celle de l\'imposition', { aide: 'Date du document : une date de l\'année d\'imposition.' }),

      // ---------- Banque ----------
      d('convention', 'banque', 'Convention de compte (compte courant, livret, PEL)', { fin: 'la clôture du compte', a: 5 }, '5 ans après la clôture du compte'),
      d('releve', 'banque', 'Relevé de compte, talon de chèque', { a: 5 }, '5 ans à partir de la date de l\'opération'),
      d('cheque', 'banque', 'Chèque à encaisser', { a: 1, j: 8 }, '1 an et 8 jours'),
      d('credit', 'banque', 'Contrat de crédit (immobilier, consommation) et justificatifs', { fin: 'la fin du prêt', a: 5 }, '5 ans après la clôture du prêt', { e: true }),
      d('epargnesal', 'banque', 'Relevé d\'épargne salariale (PEE, Perco, PER)', { fin: 'la clôture du contrat', a: 5 }, 'Clôture du contrat + 5 ans'),
      d('assvie', 'banque', 'Contrat d\'assurance-vie', 'P', 'Conservation permanente', { e: true }),

      // ---------- Santé ----------
      d('carnetsante', 'sante', 'Carnet de santé, de vaccination, carte de groupe sanguin', 'P', 'Conservation permanente', { e: true }),
      d('examen', 'sante', 'Certificat ou examen médical (radiographie…)', 'P', 'Conservation permanente'),
      d('ordonnance', 'sante', 'Ordonnance', { a: 1 }, '1 an (lunettes : 1, 5 ou 3 ans selon l\'âge ; audioprothèses : pas de délai)'),
      d('feuillesoins', 'sante', 'Feuille de soins', { a: 2 }, '2 ans'),
      d('remboursement', 'sante', 'Relevé de remboursement de l\'Assurance maladie', { a: 2 }, '2 ans'),
      d('hopitalpublic', 'sante', 'Facture d\'un hôpital public', { a: 4 }, '4 ans'),
      d('cliniqueprivee', 'sante', 'Facture d\'un établissement de santé privé', { a: 2 }, '2 ans'),
      d('mutuelle', 'sante', 'Carte et relevés de la complémentaire santé', { aucune: 'Variable selon l\'organisme : voir le contrat' }, 'Variable selon l\'organisme, voir le contrat', { e: true, ech: 'Fin de validité de la carte' }),
      d('ij', 'sante', 'Preuve de versement d\'indemnités journalières', { fin: RETRAITE }, 'Jusqu\'à la liquidation de la retraite'),

      // ---------- Travail ----------
      d('salaire', 'travail', 'Bulletin de salaire', { fin: RETRAITE }, 'Jusqu\'à la liquidation de la retraite', { e: true }),
      d('contrattravail', 'travail', 'Contrat de travail, certificat de travail', { fin: RETRAITE }, 'Jusqu\'à la liquidation de la retraite'),
      d('stc', 'travail', 'Solde de tout compte', { a: 5 }, '5 ans'),
      d('francetravail', 'travail', 'Attestation France Travail, allocations chômage', { a: 5 }, '5 ans (utile jusqu\'à la liquidation de la retraite)'),
      d('pension', 'travail', 'Titre de pension, paiement de la retraite', 'P', 'Conservation permanente', { e: true }),
      d('emploidomicile', 'travail', 'Bulletin de paye d\'un salarié à domicile', { a: 5 }, '5 ans (particulier employeur)'),

      // ---------- Véhicule ----------
      d('cartegrise', 'vehicule', 'Certificat d\'immatriculation (carte grise)', { valide: true }, null, { e: true, hors: true, aide: 'À garder tant que tu as le véhicule.' }),
      d('controle', 'vehicule', 'Procès-verbal de contrôle technique', { aucune: 'Pas dans la fiche' }, null, { ech: 'Prochain contrôle technique', hors: true }),
      d('permis', 'vehicule', 'Permis de conduire', { valide: true }, null, { e: true, ech: 'Fin de validité du titre', hors: true }),
      d('facturevehicule', 'vehicule', 'Facture d\'achat ou de réparation du véhicule', { fin: 'la revente du véhicule', a: 2 }, 'Durée de conservation du véhicule (+ 2 ans en cas de revente)'),
      d('cession', 'vehicule', 'Certificat de cession', { fin: 'la fin de détention du véhicule' }, 'Durée de conservation du véhicule'),
      d('contravention', 'vehicule', 'Avis de contravention', { a: 3 }, '3 ans à compter de la décision définitive', { aide: 'Date du document : la date où la décision est devenue définitive.' }),

      // ---------- Assurances ----------
      d('assurhab', 'assurances', 'Contrat d\'assurance habitation', { fin: 'la fin du contrat', a: 2 }, '2 ans après la fin du contrat', { e: true, ech: 'Échéance annuelle' }),
      d('assurauto', 'assurances', 'Contrat d\'assurance auto', { fin: 'la fin du contrat', a: 2 }, '2 ans après la fin du contrat', { e: true, ech: 'Échéance annuelle' }),
      d('rc', 'assurances', 'Assurance responsabilité civile, scolaire', { fin: 'la fin du contrat', a: 2 }, '2 ans après la fin du contrat', { ech: 'Échéance annuelle' }),
      d('avisecheance', 'assurances', 'Avis d\'échéance, quittance, preuve de paiement', { a: 2 }, 'Date du document + 2 ans'),
      d('resiliation', 'assurances', 'Courrier de résiliation d\'assurance', { a: 2 }, 'Date du document + 2 ans'),
      d('releveinfo', 'assurances', 'Relevé d\'information automobile', 'P', 'Conservation permanente'),
      d('prevoyance', 'assurances', 'Contrat de prévoyance, obsèques', { aucune: 'Pas dans la fiche' }, null, { e: true, hors: true }),
    ],

    // Inventaire de départ : documents proposés au premier lancement (cochés par défaut).
    depart: ['cni', 'passeport', 'vitale', 'livret', 'bail', 'ir', 'convention', 'carnetsante', 'mutuelle', 'salaire', 'cartegrise', 'permis', 'assurhab', 'assurauto'],

    conseils: [
      ['Note où il est, pas ce qu\'il contient', 'Ni numéro complet, ni mot de passe, ni scan : l\'application dit dans quel classeur ou quel dossier chercher.'],
      ['Un emplacement, un nom', '« Classeur bleu, onglet Banque », « Pochette rouge du tiroir », « Dossier Impôts du cloud » : le nom que toute la famille comprend.'],
      ['Trie une fois par an', 'La liste « Peut être jeté » rassemble ce que la durée de conservation permet de détruire. Déchire ou passe au broyeur ce qui porte des données personnelles.'],
    ],
  };
})();
