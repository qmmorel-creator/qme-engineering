# T83 · Papiers du foyer (où est quoi, durée de conservation)

Slug `papiers`, préfixe `DCS`, prix 15 €, permalien Gumroad proposé `papiers-du-foyer`. Taille S, P2. Usage `perso`.
Origine : proposition validée par Quentin le 14/11/2026 (pack « Reprendre la main sur son argent »), ligne T83 de
`IDEES.md`. Cadrage délégué par Quentin (14/11/2026) : décisions ci-dessous prises par l'assistant, à relire.
**daté** : durées de conservation reprises d'une fiche officielle datée (voir Sources), à revérifier chaque année.
**Pas de stockage de pièces d'identité en V1** : l'outil note où est le document, jamais son contenu ni son numéro.
Démo entièrement fictive (famille Martin, prénoms inventés, lieux génériques).

## Pour qui

- **Particuliers et familles** qui cherchent toujours le même papier au mauvais moment (passeport avant un
  voyage, avis d'impôt pour un dossier de location, bail pour l'état des lieux) et gardent tout « au cas où ».
- **Couples qui s'installent** et réunissent deux piles de papiers.
- **Personnes qui veulent préparer un proche** (parent âgé, conjoint) : savoir où sont les papiers essentiels en
  cas d'hospitalisation, de décès ou de sinistre.

Aujourd'hui : un classeur rempli au fil de l'eau, des PDF dispersés dans plusieurs dossiers, et la question
« combien de temps garder ça ? » cherchée en ligne à chaque tri.

## Écrans (5 onglets + réglages)

- **Tableau de bord** : nom du foyer, recherche « Où est… » (renvoie aux documents), tuiles cliquables
  (documents et non rangés, à renouveler, peut être jeté et bientôt, essentiels), alerte « documents sans
  date », listes « À renouveler » et « À trier » (5 premiers, bouton « Jeté »), résumé des emplacements.
- **Documents** : recherche, filtres par statut (tous, peut être jeté, à renouveler, essentiels, sans date,
  jetés), par personne et par catégorie, liste groupée par catégorie ; chaque ligne : nom, personne,
  « Essentiel », emplacement et précision, catégorie, conservation, renouvellement. Impression de l'inventaire,
  export CSV.
- **Rangements** : une carte par emplacement (nom, type, où le trouver, documents rangés, « Document ici »),
  plus « Pas encore rangé » ; création, modification (couleur), suppression (documents passés « pas rangé »).
- **Échéances** : renouvellements (dépassés ou dans la fenêtre de rappel, case pour voir les lointains, bouton
  « Renouvelé » qui demande la nouvelle date), « Peut être jeté » (bouton « Jeté »), « Jetable dans les 90 jours »,
  « Date à saisir », « En attente d'un événement ». Impression de la liste à trier.
- **Urgence** : mot pour un proche et personne ou organisme à contacter, documents essentiels groupés par
  personne avec leur emplacement, essentiels de la base pas encore notés (« Ajouter »), impression de la fiche.
- **Réglages** : nom du foyer, personnes (prénoms), exports CSV et JSON, restauration, compte, « Sur téléphone »,
  sources et date de vérification.
- **Premier lancement** en 2 étapes : foyer, prénoms (facultatifs), premier emplacement ; puis inventaire de
  départ à cocher (14 documents courants cochés par défaut, une carte par personne pour les pièces d'identité).

## Mécanique (fonctions pures, `regles.js`, tests `outils/templates/papiers.test.mjs`)

1. **Règle de conservation d'un type** : permanente ; durée (ans, mois, jours) depuis la date du document ;
   durée depuis un événement daté par l'utilisateur (fin de la location, clôture du compte, fin du contrat,
   fin des études, liquidation de la retraite, revente du véhicule…) ; jusqu'au 31 décembre de la N-ième année
   suivant la date (impôts) ; « tant qu'il est valable » (pièces d'identité, permis, carte grise) ; « à choisir »
   (fiche muette ou variable).
2. **Garder jusqu'au** : choix de l'utilisateur d'abord (date choisie ou « garder toujours »), sinon règle du
   type. Événement non daté → « à garder » ; date du document manquante → « date à saisir ».
3. **Statut** : peut être jeté (date dépassée, jetable le lendemain du dernier jour), jetable bientôt (90 jours),
   à garder, toujours, en attente, date à saisir, jeté (trace gardée, document hors des listes).
4. **Renouvellement** : échéance saisie, rappel en mois (0 à 12, 3 par défaut, borné à la fin du mois) ;
   expiré, à renouveler (fenêtre de rappel), à jour. « Renouvelé » remplace l'échéance (future obligatoire).
5. **Recherche « où est… »** : tous les mots, sans accents ni casse, pluriel en -s/-x toléré, dans le nom, le
   type, la catégorie, la personne, l'emplacement, la précision et la note ; titres qui contiennent le mot
   en tête.
6. **Urgence** : documents essentiels, foyer d'abord puis par personne, triés par catégorie.
7. **Données sensibles refusées** dans les champs libres (nom, précision, note, mot pour le proche, prénoms,
   emplacements) : 9 chiffres ou plus (espaces, points et tirets compris), IBAN, mot de passe ou code annoncé,
   suite de 9 caractères ou plus mêlant lettres et chiffres (numéro de passeport).
8. **CSV** point-virgule avec BOM ; dates ISO.

## Base intégrée (`donnees.js`)

- **9 catégories** : identité, famille (état civil et scolarité), logement (factures et achats), impôts, banque,
  santé, travail, véhicule, assurances.
- **77 documents types** avec règle, durée telle qu'écrite dans la fiche, essentiel par défaut, libellé de
  l'échéance (fin de validité, prochain contrôle technique, échéance annuelle, fin de la garantie) et aide
  (« date du document : date de mise en recouvrement »).
- **Hors fiche** (marqués `hors`, jamais « peut être jeté ») : carte d'identité, passeport, titre de séjour, carte
  Vitale, carte électorale, carte grise, permis de conduire, procès-verbal de contrôle technique, prévoyance.
- 7 types d'emplacement, 8 couleurs, 3 conseils.

## Sources

- Durées de conservation : service-public.gouv.fr, fiche « Durée de conservation des papiers » (F19134,
  Direction de l'information légale et administrative), <https://www.service-public.gouv.fr/particuliers/vosdroits/F19134>,
  « Vérifié le 13 octobre 2026 », consultée le 14/11/2026. Affichée dans l'application (Réglages, mention en
  bas des vues, fenêtre de chaque document) avec ces deux dates.
- Simplifications assumées : la fiche distingue la durée des ordonnances de lunettes selon l'âge (1, 5 ou 3 ans)
  et l'absence de délai pour les audioprothèses ; l'application applique 1 an et le rappelle dans le texte
  source (modifiable). Gros travaux : 10 ans (gros œuvre) ; la fiche indique la durée de conservation du
  logement pour une construction ou un agrandissement, rappelée dans le texte source. Feuilles de soins : 2 ans
  (cas des 27 mois via Compte ameli non retenu).
- Aucune règle de renouvellement (durée de validité des titres, délais d'obtention) n'est intégrée : dates saisies
  par l'utilisateur, renvoi à service-public.gouv.fr pour les délais.
- **À revérifier chaque année** (ou si la fiche change) : `BASE.source` (`verifiePar`, `consulte`) et les durées.

## Risques et limites

- Un utilisateur peut jeter trop tôt un document utile à une procédure : avertissement permanent (durées
  minimales indicatives, pas un conseil juridique) et rien n'est jamais supprimé automatiquement.
- Données personnelles : uniquement noms de documents, prénoms, emplacements et dates ; contrôle des numéros
  dans tous les champs libres, rappel dans les aides. Les prénoms et emplacements restent des données
  personnelles hébergées comme celles des autres templates (Netlify Blobs, Francfort).
- Pas de pièce jointe, pas de scan, pas de rappel par e-mail (rappels visibles à l'ouverture).
- V2 possibles : durées personnalisées par type (dans les réglages), rappel par calendrier (.ics), partage en
  lecture de la fiche d'urgence.

## Communication

`docs/templates/communication/papiers/` : `section-site.html` (page en vente), `carte-en-prochaine.html` (carte EN,
non appliquée), `gumroad.json` / `gumroad.md`, `linkedin.md`, `instagram.md` (+ carrousel), `prospects.md`.
