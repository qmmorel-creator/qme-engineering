// Base intégrée de « Assemblée générale et vie statutaire » : catégories de membres et fonctions proposées,
// rétroplanning type d'une AG et d'un conseil, ordres du jour types, trames de convocation, de pouvoir et de
// procès-verbal (rédaction originale pour QME, 14/11/2026), conseils de démarrage.
// Aucune règle légale : délais, quorums, pouvoirs et majorités sont saisis d'après les statuts (regles.js ne
// fournit qu'un point de départ marqué « à vérifier »). Les décalages du rétroplanning sont des suggestions
// d'organisation, modifiables réunion par réunion, pas des obligations.
//
// Trames : champs remplis par l'application.
//   {association} {siege} {ville} {instance} « assemblée générale ordinaire » · {instance_article} « l'assemblée
//   générale ordinaire » · {instance_de} « de l'assemblée… », « du conseil… » · {date} « samedi 12 décembre 2026 »
//   {heure} « 14 h 30 » · {lieu} · {ordre_du_jour} liste numérotée · {pouvoirs} phrase sur les pouvoirs (vide s'ils
//   ne sont pas admis) · {quorum} phrase sur le quorum (vide sans quorum) · {signataire} {qualite} {date_envoi}
//   PV : {president} {secretaire} {convoque_le} {inscrits} {presents} {representes} {excuses} {quorum_phrase}
//   {deroulement} {heure_fin}
// Blocs conditionnels : {?cle}…{/cle} si la valeur est renseignée, {!cle}…{/cle} si elle est vide
// (seconde : seconde convocation ; cotisation : réunion d'AG, où seuls les membres à jour votent).
(() => {
  window.BASE = {
    version: '2026-11-14',

    categories: ['Membre actif', 'Membre fondateur', 'Membre bienfaiteur', 'Membre d\'honneur', 'Membre associé', 'Membre de droit'],
    fonctions: {
      bureau: ['Président·e', 'Vice-président·e', 'Trésorier·e', 'Trésorier·e adjoint·e', 'Secrétaire', 'Secrétaire adjoint·e'],
      ca: ['Administrateur·rice', 'Membre du conseil', 'Représentant·e des salariés', 'Représentant·e d\'une section'],
    },

    // Rétroplanning : ancre « limite » = date limite d'envoi de la convocation (date de la réunion moins le délai
    // des statuts) ; ancre « reunion » = date de la réunion. cle « convocation » : étape qui date l'envoi.
    etapes: {
      ag: [
        { cle: 'date', titre: 'Fixer la date et réserver la salle (bureau ou conseil)', ancre: 'limite', decalage: -30 },
        { cle: 'comptes', titre: 'Arrêter les comptes de l\'exercice (trésorier·e)', ancre: 'limite', decalage: -21 },
        { cle: 'odj', titre: 'Arrêter l\'ordre du jour et les projets de résolution', ancre: 'limite', decalage: -14 },
        { cle: 'rapports', titre: 'Rédiger les rapports (moral, d\'activité, financier)', ancre: 'limite', decalage: -7 },
        { cle: 'cotisations', titre: 'Faire le point des cotisations : liste des membres votants', ancre: 'limite', decalage: -3 },
        { cle: 'candidatures', titre: 'Lancer l\'appel à candidatures si des mandats arrivent à échéance', ancre: 'limite', decalage: -3 },
        { cle: 'convocation', titre: 'Envoyer la convocation, l\'ordre du jour et le pouvoir', ancre: 'limite', decalage: 0 },
        { cle: 'pouvoirs', titre: 'Relancer les membres et recueillir les pouvoirs', ancre: 'reunion', decalage: -5 },
        { cle: 'materiel', titre: 'Imprimer la feuille de présence et préparer le matériel de vote', ancre: 'reunion', decalage: -1 },
        { cle: 'tenue', titre: 'Tenir l\'assemblée : émargement, quorum, votes', ancre: 'reunion', decalage: 0 },
        { cle: 'pv', titre: 'Rédiger le procès-verbal et le faire signer', ancre: 'reunion', decalage: 15 },
        { cle: 'suites', titre: 'Diffuser le PV, mettre à jour le registre et les déclarations si besoin', ancre: 'reunion', decalage: 30 },
      ],
      conseil: [
        { cle: 'odj', titre: 'Préparer l\'ordre du jour', ancre: 'limite', decalage: -3 },
        { cle: 'convocation', titre: 'Envoyer la convocation et l\'ordre du jour', ancre: 'limite', decalage: 0 },
        { cle: 'tenue', titre: 'Tenir la réunion : présences, quorum, décisions', ancre: 'reunion', decalage: 0 },
        { cle: 'pv', titre: 'Rédiger le compte rendu ou le procès-verbal', ancre: 'reunion', decalage: 10 },
      ],
    },

    // Ordres du jour types (modifiables réunion par réunion). vote : point soumis au vote (résolution).
    ordresDuJour: {
      ago: [
        { titre: 'Accueil, émargement et vérification du quorum', vote: false },
        { titre: 'Rapport moral du ou de la président·e', vote: true, resolution: 'L\'assemblée approuve le rapport moral.' },
        { titre: 'Rapport d\'activité de l\'année écoulée', vote: true, resolution: 'L\'assemblée approuve le rapport d\'activité.' },
        { titre: 'Rapport financier et approbation des comptes', vote: true, resolution: 'L\'assemblée approuve les comptes de l\'exercice et donne quitus au trésorier ou à la trésorière.' },
        { titre: 'Budget prévisionnel et montant de la cotisation', vote: true, resolution: 'L\'assemblée adopte le budget prévisionnel et fixe le montant de la cotisation.' },
        { titre: 'Renouvellement des membres du conseil', vote: true, resolution: 'Sont élus au conseil : [noms].' },
        { titre: 'Questions diverses', vote: false },
      ],
      age: [
        { titre: 'Accueil, émargement et vérification du quorum', vote: false },
        { titre: 'Présentation du projet de modification des statuts', vote: false },
        { titre: 'Vote de la modification des statuts', vote: true, resolution: 'L\'assemblée adopte les nouveaux statuts tels que présentés.' },
        { titre: 'Pouvoirs pour les formalités', vote: true, resolution: 'L\'assemblée donne pouvoir au ou à la président·e pour accomplir les formalités.' },
      ],
      conseil: [
        { titre: 'Approbation du compte rendu de la réunion précédente', vote: true, resolution: 'Le compte rendu de la réunion précédente est approuvé.' },
        { titre: 'Point sur les activités et la trésorerie', vote: false },
        { titre: 'Décisions à prendre', vote: true, resolution: '' },
        { titre: 'Questions diverses', vote: false },
      ],
    },

    // Points ajoutables d'un clic.
    pointsTypes: [
      { titre: 'Élection des membres du conseil', vote: true, resolution: 'Sont élus au conseil : [noms].' },
      { titre: 'Élection du bureau', vote: true, resolution: 'Sont élus : [fonction : nom].' },
      { titre: 'Montant de la cotisation', vote: true, resolution: 'La cotisation annuelle est fixée à [montant].' },
      { titre: 'Approbation du règlement intérieur', vote: true, resolution: 'Le règlement intérieur est approuvé.' },
      { titre: 'Affectation du résultat', vote: true, resolution: 'Le résultat de l\'exercice est affecté [à préciser].' },
      { titre: 'Point d\'information', vote: false },
      { titre: 'Questions diverses', vote: false },
    ],

    trames: {
      convocation: [
        { id: 'ag-formelle', nom: 'Assemblée générale · formelle', instances: ['ago', 'age'], texte:
`{association}
{?siege}{siege}
{/siege}
Objet : convocation à {instance_article}{?seconde} (seconde convocation){/seconde}

Madame, Monsieur, cher membre,

{?seconde}Le quorum n'ayant pas été atteint lors de la première réunion, {/seconde}{!seconde}Conformément aux statuts, {/seconde}vous êtes convoqué·e à {instance_article} de l'association {association}, qui se tiendra le {date}{?heure} à {heure}{/heure}, {lieu}.

Ordre du jour :
{ordre_du_jour}

{?cotisation}Seuls les membres à jour de leur cotisation prennent part aux votes. {/cotisation}{?quorum}{quorum}{/quorum}
{?pouvoirs}
{pouvoirs}
{/pouvoirs}

Les documents relatifs à l'ordre du jour peuvent être demandés auprès du bureau.

Veuillez agréer, Madame, Monsieur, cher membre, l'expression de nos sentiments les meilleurs.

{?ville}Fait à {ville}, le {date_envoi}{/ville}{!ville}Le {date_envoi}{/ville}
{signataire}
{qualite}` },
        { id: 'ag-conviviale', nom: 'Assemblée générale · conviviale', instances: ['ago', 'age'], texte:
`Bonjour à toutes et à tous,

C'est le moment de faire le bilan de l'année ensemble : {instance_article} de l'association {association} aura lieu le {date}{?heure} à {heure}{/heure}, {lieu}.{?seconde} Il s'agit d'une seconde convocation, la première réunion n'ayant pas réuni le quorum.{/seconde}

Au programme :
{ordre_du_jour}

{?cotisation}Pour voter, pensez à être à jour de votre cotisation. {/cotisation}{?quorum}{quorum}{/quorum}
{?pouvoirs}
Vous ne pourrez pas venir ? {pouvoirs}
{/pouvoirs}

Votre présence compte : c'est l'occasion de donner votre avis et de choisir ensemble les projets de l'année à venir.

À très bientôt,
{signataire}
{qualite}` },
        { id: 'conseil', nom: 'Conseil ou bureau', instances: ['ca', 'bureau'], texte:
`{association}
Convocation à la réunion {instance_de}

Bonjour,

La prochaine réunion {instance_de} aura lieu le {date}{?heure} à {heure}{/heure}, {lieu}.

Ordre du jour :
{ordre_du_jour}

{?quorum}{quorum} {/quorum}{?pouvoirs}{pouvoirs}{/pouvoirs}
Merci de confirmer votre présence ou de prévenir en cas d'empêchement.

{signataire}
{qualite}` },
      ],
      pouvoir:
`POUVOIR

Je soussigné·e ………………………………………………, membre de l'association {association},
donne pouvoir à ………………………………………………, membre de l'association,
pour me représenter à {instance_article} du {date}{?heure} à {heure}{/heure}, prendre part en mon nom aux délibérations et aux votes inscrits à l'ordre du jour.

Fait à ……………………………, le ……………………………

Signature, précédée de la mention manuscrite « Bon pour pouvoir » :




À remettre au mandataire ou au bureau avant la réunion.`,
      pv: [
        { id: 'pv-ag', instances: ['ago', 'age'], texte:
`{association}
{?siege}{siege}
{/siege}
Procès-verbal de {instance_article}{?seconde} (seconde convocation){/seconde}
Réunion du {date}

Le {date}{?heure} à {heure}{/heure}, les membres de l'association {association} se sont réunis {lieu}, en {instance}{?convoque_le}, sur convocation envoyée le {convoque_le}{/convoque_le}.

La séance est présidée par {president}. {secretaire} est désigné·e secrétaire de séance.
Une feuille de présence a été émargée par les membres présents et les mandataires.

Membres votants : {inscrits}. Présents : {presents}. Représentés : {representes}.{?excuses} Excusés : {excuses}.{/excuses}
{quorum_phrase}

Ordre du jour :
{ordre_du_jour}

Déroulement et décisions

{deroulement}

L'ordre du jour étant épuisé, la séance est levée{?heure_fin} à {heure_fin}{/heure_fin}.

Le ou la président·e de séance : {president}
Le ou la secrétaire de séance : {secretaire}` },
        { id: 'pv-conseil', instances: ['ca', 'bureau'], texte:
`{association}
Compte rendu de la réunion {instance_de}
Réunion du {date}

Le {date}{?heure} à {heure}{/heure}, {instance_article} s'est réuni {lieu}{?convoque_le}, sur convocation du {convoque_le}{/convoque_le}.
Présidence : {president}. Secrétariat : {secretaire}.

Membres : {inscrits}. Présents : {presents}. Représentés : {representes}.{?excuses} Excusés : {excuses}.{/excuses}
{quorum_phrase}

{deroulement}

La séance est levée{?heure_fin} à {heure_fin}{/heure_fin}.

Le ou la président·e : {president}
Le ou la secrétaire : {secretaire}` },
      ],
    },

    conseils: [
      ['Recopie tes statuts', 'Délai de convocation, quorum, pouvoirs, majorités, durée des mandats : l\'outil calcule avec tes règles, pas avec des règles générales.'],
      ['Coche les cotisations', 'Les membres votants à jour de cotisation forment la liste des votants de l\'AG.'],
      ['Saisis les mandats', 'Bureau et conseil, avec leur date de début : les échéances de renouvellement se calculent.'],
      ['Prépare l\'AG', 'Rétroplanning daté, convocation à copier, feuille de présence, votes et procès-verbal imprimable.'],
    ],
  };
})();
