# T35 · Pipeline de prospection B2B

Slug `prospection`, préfixe `PRS`, prix 25 €, permalien Gumroad `pipeline-prospection`, taille M, priorité P1.
Origine : backlog de Quentin n° 10 (ligne T35 de `IDEES.md`). Fiche rédigée le 12/11/2026.

## Pour qui

Commerciaux, indépendants, consultants et dirigeants de petites structures B2B qui cherchent leurs
**premiers rendez-vous et premiers contrats** : ils écrivent à des prospects par e-mail, par message sur
les réseaux professionnels ou par téléphone, notent tout dans un tableur ou dans leur tête, oublient la
deuxième relance (celle qui obtient souvent la réponse) et ne savent pas quel canal leur répond le mieux.

## Promesse

Chaque matin, la liste exacte des prospects à relancer, avec le message prêt à copier.

## Frontière avec le CRM freelance (T28)

T35 couvre **la prospection avant le premier contrat** : ciblage, cadences de relance, scripts de
messages, taux de conversion par étape et par canal. Il s'arrête à « Gagné » (premier contrat obtenu).
T28 (`templates/crm/`) suit ensuite les clients : affaires, devis, factures, encaissements, chiffre
d'affaires. T35 ne gère ni montants facturés, ni devis, ni factures.

## Écrans (5 onglets)

1. **Aujourd'hui** : « À relancer aujourd'hui » (relances dues, retards en tête avec le nombre de jours),
   pour chaque prospect : étape, canal et script conseillés par la cadence, bouton « Préparer le
   message » (script rempli avec les variables, copie en un clic), « Envoyé », « A répondu »,
   « Reporter ». En dessous : cadences terminées sans réponse (à clore ou à recontacter plus tard), et
   les relances des 7 prochains jours. Tuiles : à relancer, envoyés aujourd'hui, réponses sur 30 jours.
2. **Pipeline** : colonnes par étape (À contacter, Contacté, En échange, Rendez-vous, Proposition,
   Gagné ; Perdu repliable), **glisser-déposer** d'une carte entre colonnes sur ordinateur ;
   **alternative sans glisser** : bouton « Étape suivante » sur chaque carte et choix de l'étape dans
   la fiche (indispensable au téléphone et au clavier). Au téléphone : une colonne à la fois, choisie
   par des pastilles avec le nombre de prospects.
3. **Prospects** : liste complète avec recherche (nom, organisation, fonction, source) et filtres
   (actifs, à relancer, gagnés, perdus, à revoir RGPD, opposés). Fiche prospect : prénom, nom,
   organisation, fonction, canal principal, source, coordonnée professionnelle (texte libre), notes,
   étape, cadence, prochaine relance, historique des échanges.
4. **Scripts** : scripts de messages par étape et par canal, variables mises en évidence, aperçu rempli
   avec un prospect au choix, copie en un clic ; ajout, modification, suppression, retour aux scripts
   d'origine. Cadences : les 3 cadences types et les cadences personnelles (suite de relances : délai,
   canal, script conseillé).
5. **Chiffres** : entonnoir (prospects ayant atteint chaque étape), taux de passage d'une étape à la
   suivante, taux par canal (réponse, rendez-vous, gagnés), activité des 8 dernières semaines (messages
   envoyés, réponses), sur une période choisie (30 jours, 90 jours, 12 mois, tout).

## Saisie

- Prospect : prénom et organisation (au moins un des deux), nom, fonction, canal (e-mail, réseaux
  professionnels, téléphone, rencontre ou événement, recommandation, courrier), source (texte libre :
  salon, annuaire, recommandation de…), coordonnée, notes, cadence (par défaut celle des réglages),
  date du premier contact (aujourd'hui par défaut). Ajout de plusieurs prospects d'un coup : un par
  ligne « Prénom Nom ; Organisation ; Fonction ».
- Contact : date, canal, sens (envoyé ou reçu), note courte. « Envoyé » fait avancer la cadence ;
  « A répondu » note un échange reçu et propose l'étape « En échange ».
- Réglages : ton prénom et ton activité en une phrase (variables `{mon prénom}`, `{mon activité}`),
  cadence par défaut, durée de conservation RGPD (36 mois par défaut).

## Mécanique clé

- **Cadence** = suite de relances ; chaque relance a un délai en jours **depuis la précédente**, un
  canal et un script conseillé. Prochaine relance = date de début de la cadence + délai de la
  première relance, puis date du dernier message envoyé + délai de la relance suivante. Après la
  dernière relance sans réponse : « cadence terminée » (plus de date) ; l'application propose de passer
  le prospect en Perdu (motif « sans réponse ») ou de le recontacter plus tard (nouvelle cadence).
- **Changement d'étape** : chaque étape a une cadence conseillée. « Proposition » démarre la cadence
  « Suivi de proposition » le jour du passage ; « En échange » et « Rendez-vous » arrêtent la
  cadence et demandent une date de prochaine action (7 jours par défaut, modifiable) ; « Gagné »,
  « Perdu » et l'opposition arrêtent tout.
- **Reporter** : décale la prochaine relance à une date choisie (demain par défaut), sans compter de
  message.
- **Variables de script** : `{prénom}`, `{nom}`, `{organisation}`, `{fonction}`, `{mon prénom}`,
  `{mon activité}` ; une variable vide reste visible entre crochets (« [organisation] ») pour ne jamais
  envoyer un message à trou.
- **Conversion** : l'étape la plus avancée atteinte est gardée même après un passage en Perdu.
  Taux de passage d'une étape à la suivante = prospects ayant atteint l'étape suivante ÷ prospects ayant
  atteint l'étape. Par canal : taux de réponse = prospects ayant atteint « En échange » ÷ prospects
  contactés ; taux de rendez-vous et de gain de la même façon. Période : prospects créés dans la
  période.
- **RGPD** : un prospect non gagné sans contact venant de lui (ni création) depuis la durée réglée
  est signalé « à revoir » (supprimer ou archiver). **Opposition** : un clic arrête toute relance,
  efface coordonnée et notes, et garde seulement nom, organisation et date dans la liste d'opposition
  pour ne pas le recontacter ; un nouveau prospect au même nom et à la même organisation déclenche un
  avertissement.

## Base intégrée

- **7 étapes** : À contacter, Contacté, En échange, Rendez-vous, Proposition, Gagné, Perdu (définition,
  conseil, cadence conseillée).
- **3 cadences types** :
  - « Premier contact » : J0 e-mail, +3 j réseaux professionnels, +4 j téléphone, +7 j e-mail,
    +14 j dernier message (5 messages sur 4 semaines) ;
  - « Relation douce » (cycles longs, recommandation, rencontre) : J0, +7 j, +14 j, +30 j
    (4 messages sur 7 semaines) ;
  - « Suivi de proposition » : +3 j, +4 j, +7 j, +14 j après l'envoi de la proposition.
- **18 scripts de messages** rédigés, sobres, sans promesse chiffrée : premier contact (e-mail,
  réseaux professionnels, téléphone, après une rencontre, sur recommandation), relances (première,
  deuxième avec un élément utile, téléphone, dernier message), réponse positive et prise de
  rendez-vous, confirmation et compte rendu de rendez-vous, envoi et suivi de proposition, objection
  « pas le moment », refus (remerciement), premier contrat (remerciement et démarrage).
- 6 canaux, 6 motifs de perte (sans réponse, pas de besoin, pas le moment, budget, choix d'un autre
  prestataire, autre).

## Repères réglementaires (affichés avec source et date dans l'aide)

Aucune affirmation juridique sans source ; formulation « rappel de bonnes pratiques », renvoi à cnil.fr.

- Prospection par e-mail de professionnels : possible sans consentement préalable si l'objet de la
  sollicitation est en rapport avec la profession de la personne ; la personne doit être informée et
  pouvoir s'opposer simplement, chaque message identifie l'émetteur. Source : cnil.fr, « La prospection
  commerciale par courrier électronique, SMS-MMS et automate d'appel » (mise à jour 10/06/2026,
  consultée le 12/11/2026).
- Opposition : à respecter sans justification ; liste d'opposition (« repoussoir ») recommandée,
  limitée aux données nécessaires, conservée au moins 3 ans. Source : cnil.fr, « Comment utiliser une
  liste repoussoir pour respecter l'opposition à la prospection ? » (mise à jour 10/06/2026,
  consultée le 12/11/2026).
- Conservation des données d'un prospect non client : 3 ans à compter de la collecte ou du dernier
  contact venant du prospect (référentiel non contraignant). Source : cnil.fr, questions-réponses sur
  les référentiels « gestion des activités commerciales » (page du 28/01/2022, consultée le 12/11/2026).
  Sert de valeur par défaut réglable (36 mois).

## Risques et avertissements

- **RGPD** : données de tiers (prospects) hébergées en ligne ; rappel dans l'aide et dans la fiche
  prospect (minimisation, information, opposition, durée de conservation), sans conseil juridique.
- **Aucune automatisation** : l'application n'envoie rien, ne se connecte à aucun réseau social, ne
  collecte aucune donnée ; l'utilisateur copie le message et l'envoie lui-même. Aucune marque de réseau
  dans le produit (« réseaux professionnels »).
- **Daté** : les trois repères CNIL, à revérifier une fois par an.
- Scripts : modèles à personnaliser, aucun résultat promis.

## Choix d'implémentation

- Socle `templates/revision/` ; règles métier pures dans `templates/prospection/regles.js`
  (`globalThis.PRS_REGLES`), testées par `outils/templates/prospection.test.mjs`.
- Scripts et cadences copiés dans les données de l'utilisateur au premier lancement (modifiables),
  bouton « Revenir aux scripts d'origine ».
- Glisser-déposer HTML5 sur ordinateur (pointeur fin) ; boutons « Étape suivante » et liste d'étapes
  partout.
- Démo relative à aujourd'hui, 100 % fictive (organisations inventées, aucune coordonnée réelle).
- Modèle tableur complémentaire (prévu « HTML+tableur ») : non fait, export JSON seulement ; à trancher
  par Quentin.
