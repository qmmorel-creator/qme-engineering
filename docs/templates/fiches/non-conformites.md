# T25 · Registre des non-conformités et actions correctives

Slug `non-conformites` · préfixe `NCF` · 20 € · taille M · P1 · permalien Gumroad `non-conformites`.
Origine : documents de travail de Quentin (12/11/2026). **confidentiel** : structure seulement, aucune
donnée de l'artefact d'origine ; exemples et démo fictifs, aucun secteur de l'énergie.

## Pour qui

Responsables qualité, conducteurs de travaux, chefs d'atelier et dirigeants de PME du BTP et de
l'industrie (5 à 200 personnes) qui tiennent leurs non-conformités dans un tableur ou un cahier : les
écarts sont notés, mais les causes ne sont pas analysées, les actions se perdent, personne ne vérifie
qu'elles ont marché, et il faut une demi-journée pour sortir des indicateurs avant une revue de direction
ou un audit client. Trop petits pour un logiciel qualité à abonnement.

## Écrans

- **Registre** (accueil) : tableau de bord rapide (ouvertes, en retard, à vérifier, clôturées sur 30 j),
  liste des non-conformités filtrable (étape, gravité, type, lot ou atelier, recherche plein texte),
  triée retards d'abord ; étiquettes d'étape et de gravité ; bouton « Nouvelle non-conformité ».
- **Fiche d'une non-conformité** (ouverte depuis le registre, `#nc-<id>`) : frise des 5 étapes
  (constat → analyse → actions → vérification → clôture), avec à chaque étape le bouton qui la fait
  avancer ; impression de la fiche.
- **Actions** : toutes les actions correctives et préventives ouvertes, par échéance, retards en tête,
  regroupables par responsable ; « Fait » en un geste avec « Annuler ».
- **Indicateurs** : période (3 mois, 12 mois, tout) ; tuiles (ouvertes, en retard, délai moyen de
  clôture, taux d'efficacité à la première vérification) ; constatées et clôturées par mois ;
  répartition par gravité, par famille de cause (6M) et par type d'écart ; coût estimé de non-qualité si
  renseigné ; tableaux accessibles sous chaque graphique.
- **Méthode** (base intégrée) : typologie des écarts, grille de gravité, modèle des 5 pourquoi avec deux
  exemples complets, familles de causes 6M, décisions sur le produit, règles d'une bonne action.
- **Réglages** : nom de l'entreprise, libellé de la zone (« Lot » ou « Atelier »), liste des lots ou
  ateliers, délais de traitement par gravité, délai de vérification, export CSV, copie JSON,
  déconnexion.

## Saisie

1. **Constat** (modale, 30 secondes sur le terrain) : date, titre court, description, lieu (chantier,
   site, ligne), lot ou atelier (liste réglable), type d'écart, gravité (grille affichée), origine
   (interne, fournisseur, sous-traitant, client, audit), détecté par, quantité ou étendue, **référence de
   photo** et traitement immédiat (décision sur le produit : reprise, rebut, acceptation par dérogation…).
   Numéro attribué automatiquement `NC-AAAA-NNN` (séquence par année).
2. **Analyse** guidée : 5 champs « Pourquoi ? » ; chaque question reprend la réponse précédente
   (« Pourquoi “le béton a été coulé sans contrôle du ferraillage” ? ») ; on peut s'arrêter avant 5 ;
   cause racine (préremplie par le dernier pourquoi), famille de cause 6M, rappels de méthode.
3. **Actions** : corrective (supprime la cause de cette NC) ou préventive (évite l'écart ailleurs),
   quoi, responsable (fonction conseillée), échéance ; « Fait » avec date.
4. **Vérification d'efficacité** : date prévue (dernière action faite + délai réglable, 30 j par
   défaut), constat de vérification, verdict. Efficace → clôture (date, par qui). Inefficace → la NC
   revient à l'analyse : nouvelle action exigée avant une nouvelle vérification.

**Photo** : le service de synchronisation des templates ne stocke que des données JSON, pas de fichiers.
En V1, aucune photo n'est enregistrée dans l'application : un champ « Référence photo » indique où elle
est rangée (« Photo 0412, dossier chantier », lien vers un partage). C'est dit dans la modale et la FAQ.

## Mécanique clé

- **Étape calculée** (fonction pure `etape(nc)`) : `cloturee` si clôture ; `analyse` si aucune action
  (ou si la dernière vérification est inefficace et qu'aucune action n'a été ajoutée depuis) ;
  `actions` si une action reste à faire ; `verification` si toutes les actions sont faites.
- **Échéance de traitement** = date du constat + délai de la gravité (réglable) ; **retard** si la NC
  n'est pas clôturée après cette date ou si une de ses actions dépasse son échéance.
- **Délai de clôture** = jours entre constat et clôture ; moyenne sur les NC clôturées de la période.
- **Efficacité à la première vérification** = part des NC clôturées sans vérification inefficace.
- Annulation (« Annuler ») des actions rapides : action faite, clôture, suppression.

## Base intégrée (`donnees.js`)

Repères de méthode usuels en qualité, rédigés pour le produit. **Aucune norme n'est citée comme
exigence** : la grille, les délais et la typologie sont des propositions à adapter à son propre système.

- **Typologie des écarts** (10 types, description et exemples BTP / industrie) : dimensionnel et
  géométrie ; aspect et finition ; matériau ou composant ; exécution et mise en œuvre ; documentaire et
  traçabilité ; produit ou livraison fournisseur ; sous-traitance ; équipement, outillage et mesure ;
  sécurité et environnement ; réclamation client.
- **Grille de gravité** (4 niveaux) : mineure, significative, majeure, critique ; pour chacun : effets
  sur le produit ou l'ouvrage, le client, la sécurité, le coût ou le délai ; délai de traitement proposé
  (30, 15, 7, 2 jours, réglables) ; exigence de vérification.
- **Modèle des 5 pourquoi** : 6 règles (partir d'un fait constaté, une cause par niveau, vérifier sur
  le terrain, ne pas s'arrêter à « erreur humaine », s'arrêter quand l'action est à notre portée,
  relire à l'envers avec « donc »), questions de relance, deux exemples fictifs complets (BTP :
  réservation oubliée dans un voile ; industrie : cote hors tolérance après changement d'outil).
- **Familles de causes (6M)** : méthode, main-d'œuvre, matériel, matière, milieu, mesure, avec
  questions types.
- **Décisions sur le produit** : reprise, réparation, rebut ou démolition, acceptation par dérogation,
  déclassement, retour fournisseur, tri ou contrôle renforcé.
- **Profils** : 12 lots types du bâtiment et 10 ateliers types de l'industrie, proposés au premier
  lancement.

## Exports

- **CSV du registre** (une ligne par NC : numéro, dates, lieu, zone, type, gravité, origine, étape,
  cause racine, famille, nb d'actions, échéance, retard, clôture, délai, coût) et **CSV des actions**
  (une ligne par action). Point-virgule, BOM UTF-8 (accents dans un tableur français), guillemets
  échappés, formules neutralisées (`=`, `+`, `-`, `@` en tête préfixés d'une apostrophe).
- **Fiche de non-conformité imprimable** (A4) : en-tête, constat, traitement immédiat, analyse,
  actions, vérification, clôture, cadres de visa.

## Sources

- Aucune donnée réglementaire ni datée : rien à mettre à jour chaque année.
- Méthode des 5 pourquoi, 6M (diagramme d'Ishikawa), action corrective et préventive : savoir-faire
  qualité général, présenté comme méthode, sans référence normative. Les normes de management de la
  qualité (texte payant) n'ont pas été vérifiées : ni citées, ni paraphrasées comme exigence.
- Aucune base externe reprise : pas de question de licence.

## Risques

- **confidentiel** : exemples fictifs (entreprise et chantiers inventés, personnes désignées par leur
  fonction), aucun secteur de l'énergie.
- **RGPD** léger : les responsables d'actions sont des salariés ; rappel dans l'aide de privilégier la
  fonction plutôt que le nom.
- Pas de valeur de preuve ni de certification : « outil d'aide, ne remplace pas ton système de
  management de la qualité » (Méthode et fiche Gumroad).

## Choix d'implémentation (V1)

- Socle de `templates/revision/` ; règles pures dans `regles.js` (`window.REGLES`), testées par
  `outils/templates/non-conformites.test.mjs`.
- Une seule liste de zones par compte (lots **ou** ateliers) ; le libellé est réglable.
- Pas de pièces jointes (voir Photo) ; pas de multi-utilisateur (un compte = une clé).
- Démo : PME de gros œuvre et second œuvre fictive, une vingtaine de NC sur 12 mois, chaque étape
  représentée (retard, à vérifier, inefficace, clôturées).
