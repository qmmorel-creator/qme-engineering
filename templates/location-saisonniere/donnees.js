// Base intégrée de la location saisonnière : réglages par défaut, check-list de ménage, conseils et repères.
// Contenu original rédigé pour QME. AUCUN barème de taxe de séjour n'est intégré : chaque commune (ou
// intercommunalité) fixe le sien chaque année ; l'utilisateur saisit son tarif par personne et par nuit.
// Repères relevés le 14/11/2026 : à revérifier chaque année (nouveaux tarifs au 1er janvier).
(() => {
  window.BASE = {
    version: '2026-11-14',

    reglages: {
      taxeDefaut: null,       // centimes par personne et par nuit, saisi par l'utilisateur pour sa commune
      exonererMineurs: true,  // enfants (mineurs) non comptés dans la taxe : à vérifier auprès de la commune
      acomptePct: 30,         // acompte demandé à la réservation, en % de ce qui est à recevoir
      soldeJours: 0,          // solde attendu N jours avant l'arrivée (0 = le jour de l'arrivée)
      verifieLe: '2026-11-14',
    },

    // Un seul canal au départ : la réservation en direct. Les autres canaux sont nommés par l'utilisateur.
    canaux: [{ id: 'direct', nom: 'Direct', commission: 0, collecteTaxe: false }],

    // Check-list de ménage entre deux séjours (affichée dans l'onglet Ménage, à titre indicatif).
    checklist: [
      'Aérer, retirer le linge de lit et les serviettes',
      'Lancer le linge, refaire les lits avec du linge propre',
      'Salle de bains et toilettes : nettoyer, désinfecter, remettre papier et savon',
      'Cuisine : vaisselle rangée, plaques, four, réfrigérateur vidé et essuyé',
      'Poussière, sols aspirés et lavés',
      'Poubelles vidées et sacs remplacés',
      'Vérifier le matériel (ampoules, piles, télécommandes) et noter ce qui manque',
      'Remettre l\'accueil en place (clés, livret, produits de base)',
    ],

    conseils: [
      ['Un calendrier, une vérité', 'Saisis chaque réservation dès qu\'elle arrive, quel que soit le canal : deux réservations confirmées ne peuvent pas se chevaucher, une option en conflit est signalée.'],
      ['Ce qui reste vraiment', 'Pour chaque séjour, la commission du canal est déduite : tu vois le brut, la commission et le net, par canal et par mois.'],
      ['Le ménage au bon moment', 'Chaque départ crée un ménage à faire avant la prochaine arrivée dans le logement.'],
      ['La taxe de séjour', 'Saisis le tarif par personne et par nuit fixé par ta commune : la taxe de chaque séjour se calcule, mineurs exonérés si l\'option est cochée.'],
    ],

    // Repères (droit français). Outil d'aide : la délibération de ta commune et les textes font foi.
    reperes: [
      ['Qui fixe le tarif', 'La taxe de séjour est instituée par la commune ou l\'intercommunalité, qui en adopte les tarifs dans la limite d\'une grille nationale ; une délibération prise avant le 1er juillet s\'applique au 1er janvier suivant (Entreprendre.service-public.gouv.fr, page vérifiée le 01/01/2026). Demande le tarif applicable à ta mairie ou à ton office de tourisme.'],
      ['Hébergement classé', 'Au réel, la taxe est le tarif de la catégorie de l\'hébergement, multiplié par le nombre de nuits et par le nombre de personnes imposables (même source).'],
      ['Hébergement non classé', 'Pour un hébergement non classé ou en attente de classement, la taxe est un pourcentage (de 1 % à 5 %, voté par la collectivité) du prix de la nuit par personne, plafonné (même source). L\'outil ne fait pas ce calcul : calcule le montant par personne et par nuit avec ta commune et saisis-le dans le logement.'],
      ['Mineurs', 'Les mineurs sont exemptés de la taxe de séjour d\'après les guides consultés (source secondaire, non vérifiée sur le texte de loi) : à vérifier auprès de ta commune. L\'exonération se désactive dans les Réglages.'],
      ['Collecte par un canal', 'Certains intermédiaires de réservation collectent et reversent eux-mêmes la taxe : coche-le sur le canal concerné si c\'est ton cas (à vérifier dans ton contrat avec ce canal). Sinon, c\'est à toi de la reverser, selon le calendrier de ta commune.'],
      ['Impôts', 'Les recettes de location meublée sont imposables. L\'outil ne calcule aucun régime fiscal (micro-BIC, réel, statut de loueur en meublé) : il te donne les recettes par mois et par an pour ta déclaration, à faire vérifier par un professionnel.'],
    ],
    sources: [
      ['Entreprendre.service-public.gouv.fr, « Taxe de séjour » (vérifiée le 01/01/2026 par la DILA)', 'https://entreprendre.service-public.gouv.fr/vosdroits/F31635'],
      ['impots.gouv.fr, « Taxe de séjour » : délibérations et tarifs des collectivités (modifiée le 15/10/2026)', 'https://www.impots.gouv.fr/taxe-de-sejour'],
    ],
    sourceTaxe: 'Aucun barème intégré : chaque commune fixe ses tarifs chaque année. Saisis le tien (par personne et par nuit) dans les Réglages ou dans chaque logement, et revérifie-le chaque 1er janvier. Repères relevés le 14/11/2026.',
  };
})();
