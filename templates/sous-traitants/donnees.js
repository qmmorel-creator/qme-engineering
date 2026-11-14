// Base intégrée de la conformité des sous-traitants : types de pièces de vigilance (modifiables dans
// les Réglages), statuts d'acceptation, modèle de relance, sources légales avec leur date de
// vérification. Aucune donnée d'entreprise réelle. Les règles légales datées sont affichées avec leur
// source et la date à laquelle elles ont été lues ; tout ce qui n'est pas sourcé est paramétrable.
window.BASE = {
  // Réglages de départ (modifiables dans les Réglages).
  alerteJ30: 30, // première alerte avant expiration (jours)
  alerteJ15: 15, // seconde alerte avant expiration (jours)
  seuilVigilance: 5000, // € HT : montant à partir duquel l'obligation de vigilance s'applique (source : vigilance)
  relanceJours: 7, // une entreprise relancée il y a moins de N jours n'est pas reproposée à la relance

  // Date de lecture des sources ci-dessous (affichée dans le Guide et sur la page du catalogue).
  verifieLe: '2026-11-14',

  sources: [
    { code: 'vigilance', titre: 'Recours à la sous-traitance : obligation de vigilance (seuil de 5 000 €, documents à la conclusion puis tous les 6 mois, solidarité financière)', editeur: 'Entreprendre.Service-Public.fr, fiche F36261 (page vérifiée le 27/06/2026 par la DILA)', url: 'https://entreprendre.service-public.gouv.fr/vosdroits/F36261' },
    { code: 'urssaf', titre: 'Obtenir et vérifier une attestation de vigilance (validité de 6 mois, code de sécurité à 15 caractères)', editeur: 'Urssaf.fr', url: 'https://www.urssaf.fr/accueil/attestation-vigilance.html' },
    { code: 'd8222-5', titre: 'Code du travail, article D8222-5 (documents à remettre par un cocontractant établi en France)', editeur: 'Code du travail numérique (version en vigueur depuis le 01/01/2023)', url: 'https://code.travail.gouv.fr/code-du-travail/d8222-5' },
    { code: 'etrangers', titre: 'Code du travail, articles D8254-2 et D8254-4 (liste nominative des salariés étrangers soumis à autorisation de travail, à la conclusion puis tous les 6 mois)', editeur: 'Code du travail numérique et Légifrance', url: 'https://code.travail.gouv.fr/code-du-travail/d8254-2' },
    { code: 'decennale', titre: 'Code des assurances, article L243-2 (attestation d\'assurance décennale, jointe aux devis et factures)', editeur: 'Légifrance', url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000031010272' },
    { code: 'loi1975', titre: 'Loi n° 75-1334 du 31 décembre 1975 relative à la sous-traitance : articles 3 (acceptation et agrément des conditions de paiement), 6 (paiement direct en marché public) et 14-1 (mise en demeure par le maître d\'ouvrage)', editeur: 'Légifrance', url: 'https://www.legifrance.gouv.fr/loda/id/JORFTEXT000000889241' },
  ],

  // Évolution annoncée, à surveiller (affichée dans le Guide).
  evolution: 'Service-Public annonce un renforcement de la vigilance (vérification périodique des obligations sociales et fiscales, étendue à toute la chaîne de sous-traitance) applicable après un décret, et au plus tard le 27/12/2026 ; les documents seront précisés par ce décret. Mets à jour la liste des pièces dans les Réglages quand il paraîtra.',

  // Types de pièces. validiteMois : durée retenue à partir de la date de délivrance (depart « emission »),
  // ou durée proposée quand l'échéance est lue sur la pièce (depart « fin »).
  // portee : vigilance (contrat ≥ seuil), employeur (contrat ≥ seuil et entreprise qui emploie des salariés),
  // travaux (case « décennale exigée » de l'intervention), toujours, facultatif (jamais exigée).
  typesPieces: [
    { code: 'VIG', nom: 'Attestation de vigilance Urssaf', court: 'Vigilance', validiteMois: 6, depart: 'emission', portee: 'vigilance', source: 'urssaf',
      aide: 'Valable 6 mois à compter de sa délivrance. Vérifie son authenticité sur urssaf.fr avec le code de sécurité, et la cohérence de l\'effectif déclaré.' },
    { code: 'KBS', nom: 'Extrait Kbis ou justificatif d\'immatriculation', court: 'Kbis', validiteMois: 6, depart: 'emission', portee: 'vigilance', source: 'd8222-5',
      aide: 'À remettre à la conclusion puis tous les 6 mois (extrait K ou Kbis, justificatif d\'immatriculation au RNE, ou autre document prévu par l\'article D8222-5).' },
    { code: 'ETR', nom: 'Liste nominative des salariés étrangers soumis à autorisation de travail', court: 'Salariés étrangers', validiteMois: 6, depart: 'emission', portee: 'employeur', source: 'etrangers',
      aide: 'Seule la date de remise est notée ici : la liste elle-même (noms, titres de travail) reste dans tes dossiers.' },
    { code: 'DEC', nom: 'Attestation d\'assurance décennale', court: 'Décennale', validiteMois: 12, depart: 'fin', portee: 'travaux', source: 'decennale',
      aide: 'Saisis la date de fin de validité écrite sur l\'attestation, et vérifie que les activités couvertes correspondent au lot.' },
    { code: 'RCP', nom: 'Attestation d\'assurance responsabilité civile professionnelle', court: 'RC pro', validiteMois: 12, depart: 'fin', portee: 'facultatif', source: '',
      aide: 'Exigence contractuelle, pas légale dans tous les cas : coche « exigée » dans les Réglages si tes contrats la demandent.' },
    { code: 'FSC', nom: 'Attestation de régularité fiscale', court: 'Fiscale', validiteMois: 12, depart: 'fin', portee: 'facultatif', source: '',
      aide: 'Souvent demandée en commande publique. Durée non fixée ici : saisis la date de fin indiquée ou celle de ta procédure.' },
  ],

  portees: [
    { code: 'vigilance', nom: 'Contrats à partir du seuil de vigilance' },
    { code: 'employeur', nom: 'Contrats à partir du seuil, entreprises qui emploient des salariés' },
    { code: 'travaux', nom: 'Interventions avec décennale exigée' },
    { code: 'toujours', nom: 'Toutes les interventions' },
    { code: 'facultatif', nom: 'Jamais exigée (suivie si tu la saisis)' },
  ],

  // Acceptation du sous-traitant et agrément de ses conditions de paiement par le maître d'ouvrage
  // (loi n° 75-1334, article 3). Le titulaire du marché n'est pas concerné.
  statutsAcceptation: [
    { code: 'a-declarer', nom: 'À déclarer', court: 'À déclarer' },
    { code: 'demande', nom: 'Demande envoyée au maître d\'ouvrage', court: 'Demandée' },
    { code: 'accepte', nom: 'Accepté par le maître d\'ouvrage', court: 'Accepté' },
    { code: 'refuse', nom: 'Refusé', court: 'Refusé' },
  ],

  canaux: ['E-mail', 'Courrier', 'Téléphone', 'Réunion de chantier', 'Plateforme de collecte'],

  // Modèle de relance (modifiable dans les Réglages). Champs remplacés : {entreprise}, {pieces},
  // {operations}, {structure}, {date}.
  modeleRelance: {
    objet: 'Pièces administratives à transmettre : {entreprise}',
    corps: 'Bonjour,\n\nDans le cadre de notre obligation de vigilance, merci de nous transmettre les pièces suivantes pour {entreprise} :\n\n{pieces}\n\nOpérations concernées : {operations}.\n\nSans ces pièces à jour, nous ne pouvons pas maintenir votre intervention ni procéder aux règlements dans des conditions régulières.\n\nCordialement,\n{structure}',
  },
};
