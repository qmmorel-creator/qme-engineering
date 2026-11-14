# T94 · État des lieux d'entrée et de sortie

Slug `etat-des-lieux`, préfixe `ETD` (clés locales `qme-etd-*`, règles `window.ETD`), prix prévu 19 € (**à confirmer
par Quentin**), permalien Gumroad proposé `etat-des-lieux`, catégorie Gumroad `business-and-money/personal-finance`
(comme la gestion locative, **à vérifier**), taille M, priorité P2, thème Immobilier. Catalogue : `data-pour="perso"`,
thème « Argent » (`argent`, `--c:var(--jaune)`, à côté de la gestion locative et de la location saisonnière).
Pack visé : « Propriétaire » (PPB). Origine : proposition validée par Quentin le 14/11/2026 ; cadrage délégué,
fiche rédigée le 14/11/2026.

## Pour qui

- **Propriétaires bailleurs particuliers** (location vide ou meublée, gestion en direct) : ils font eux-mêmes
  l'entrée et la sortie, souvent sur un modèle papier, et doivent justifier les retenues sur le dépôt de garantie.
- **Locataires** : garder une trace précise et photographiée de l'état d'entrée, la retrouver à la sortie.
- **Petites agences et administrateurs indépendants** : plusieurs états des lieux par mois sans logiciel par
  abonnement.

Complète T64 (gestion locative, GST : loyers, quittances, dépôt de garantie et sa date de restitution, avec la case
« état des lieux conforme ») : T94 produit le constat et dit si la sortie est conforme. Pas de lien technique entre
les deux applications (données séparées par produit) ; cohérence des paramètres : mêmes délais de restitution
(1 et 2 mois, F31269), même vocabulaire (« dépôt de garantie », « location vide / meublée »).

## Promesse

« Entrée, sortie, et ce qui a changé. » Pièce par pièce, un état et une photo pour chaque élément, les compteurs et
les clés, puis la sortie comparée à l'entrée, la vétusté de la grille du bail, les retenues proposées et un
document à signer à la main.

## Décisions de cadrage (déléguées, 14/11/2026)

1. **Un dossier par bail** (logement + parties + entrée + sortie), pas de fiche « logement » séparée : plus simple
   à remplir le jour de la visite. Le passage au locataire suivant se fait par **« Nouveau locataire »** : nouveau
   dossier, même logement, mêmes pièces et éléments, état d'entrée prérempli avec l'état de sortie (photo comprise
   si la limite le permet), relevés de sortie repris comme relevés d'entrée ; l'ancien dossier est archivé.
2. **États codés** : neuf, bon état, usage normal, dégradé, hors service (rangs 0 à 4), plus « à constater ».
   Un toucher dans la liste (boutons N, B, U, D, HS, 44 px), retoucher l'état l'efface ; commentaire, photo, coût
   et vétusté dans la fenêtre de l'élément.
3. **Comparaison** : sortie moins bonne que l'entrée **et** dégradé ou hors service → « dégradé » ; moins bonne
   mais encore neuf, bon ou usage normal → « usure normale » (aucune retenue) ; meilleure → « amélioré » ; égale →
   « identique » ; sortie sans entrée → signalée. Décision prise après un premier essai où « neuf → bon » ressortait
   comme dégradation sur tous les murs repeints : faux positifs, et contraire à l'idée que l'usure normale n'est pas
   imputable.
4. **Vétusté** : **aucune grille intégrée**. La grille se convient dans le bail (décret n° 2016-382, rappelé par
   la fiche F33671) : l'utilisateur saisit des lignes (nom, franchise en années, abattement en % par an, part
   résiduelle en %), associe chaque élément dégradé à une ligne et à sa date de pose (année, mois/année ou date ;
   année seule = 1er juillet). Taux = min(100 − résiduel, max(0, âge − franchise) × abattement), âge en années
   pleines à la date de sortie. Retenue proposée = coût de remise en état × (1 − taux), au centime ; « non
   imputable » → 0. Sans grille : coût entier proposé (signalé).
5. **Dépôt de garantie** : montant saisi ; retenues proposées, reste à rendre, dépassement. Date limite de
   restitution = date de sortie (remise des clés) + 1 mois si conforme, 2 mois sinon (F31269), fin de mois gérée.
   « Conforme » : automatique (aucun élément dégradé ni clé manquante) ou choisi par les parties.
6. **Rectification de l'entrée** : rappel « le locataire peut demander à compléter l'état des lieux d'entrée
   jusqu'au … » (entrée + 10 jours, F31270), et mention du premier mois de chauffe pour le chauffage (texte seul).
7. **Contenu du document** : rubriques du contenu minimal listées par F31270 et F33671 (type, date, localisation,
   parties et domicile du bailleur, mandataire, compteurs, clés, description par pièce, signatures ; à la sortie,
   nouvelle adresse du locataire et date de l'entrée). La liste « À compléter avant d'imprimer » s'en sert comme
   repères, **sans prétendre valider** le document. Document unique à deux colonnes (entrée / sortie) ou un seul
   constat, au choix ; cases de signature à remplir à la main, « fait à …, le … » ; pied : « ne remplace pas un
   constat de commissaire de justice ».
8. **Photos** (point à prévoir de la ligne d'idée) : comparé à `templates/sinistre/` (originaux en IndexedDB, non
   synchronisés) et `templates/reserves/` (référence texte seulement). Choix : **vignette réduite dans le
   navigateur** (JPEG, côté 480 px puis 400, 320, 240, qualité 0,62 à 0,4, jusqu'à ≤ 20 000 caractères, environ
   15 Ko), **synchronisée** avec le dossier pour la retrouver sur un autre appareil et l'imprimer ; **une photo par
   élément et par constat** ; **30 par compte** par défaut (réglable jusqu'à 60), refus si le compte approche des
   900 Ko. L'original n'est pas gardé : l'outil le dit (« garde tes photos d'origine »). Normalisation : data URL
   JPEG, PNG ou WebP en base64 seulement, 40 000 caractères au plus (rien d'autre n'est affiché en `src`).
9. **Pièces et éléments types** (`donnees.js`) : 12 types de pièce (entrée, séjour, cuisine, chambre, salle de
   bains, WC, couloir, bureau, buanderie, extérieur, cave/garage/parking, autre) avec leurs éléments par catégorie
   (sols, murs, plafonds, menuiseries, électricité, plomberie, chauffage-ventilation, équipements) et le mobilier
   ajouté en meublé. **Pas de liste « mobilier obligatoire » présentée comme légale** (non sourcée ici) : ce sont
   des éléments proposés. 6 modèles de logement (studio, T2, T3, T4, maison, sans pièce).
10. **Compteurs** (eau froide/chaude, électricité base/HP/HC, gaz, chauffage, autre) et **clés** (porte, immeuble,
    boîte aux lettres, cave, garage, télécommande, autre) : relevés et nombres d'entrée et de sortie, consommation,
    clés manquantes ; relevé de sortie inférieur à l'entrée signalé.
11. **Données datées** : délais (1 mois, 2 mois, 10 jours) en paramètres `BASE.reglages` modifiables dans les
    Réglages, sources et date de consultation affichées. Le coût d'un état des lieux par un professionnel et les
    tarifs de commissaire de justice (fiche F31270) ne sont **pas** repris (non nécessaires, datés).

## Écrans (5 onglets)

1. **Dossiers** : cartes (adresse, type, pièces, locataires, statut « à préparer / entrée en cours / entrée faite /
   sortie en cours / sortie faite », avancement entrée et sortie, dates, délai de rectification, date limite du
   dépôt et retenues), « Nouveau dossier », « Logement, parties, bail », « Nouveau locataire », archivés repliés,
   compteur de photos et de taille.
2. **Pièces** : bascule Entrée / Sortie, date et observations de la phase, avancement, légende des états, pièces
   avec leurs éléments (état en un toucher, commentaire, vignette, rappel de l'état d'entrée à la sortie, étiquette
   de différence), « Le reste en bon état » (entrée) ou « Le reste comme à l'entrée » (sortie), ordre des pièces,
   ajout de pièces (avec éléments types) et d'éléments.
3. **Compteurs** : relevés et consommation ; clés remises, rendues, manquantes.
4. **Comparaison** : tuiles (dégradés, usure normale, retenues proposées, dépôt à rendre), cartes des différences
   avec photos d'entrée et de sortie, usure normale et identiques repliés, tableau vétusté et retenues, conformité
   (auto ou choisie) et date limite de restitution, clés manquantes, consommations, grille de vétusté.
5. **Document** : entrée, sortie ou les deux ; points à compléter ; document imprimable (seule la feuille
   s'imprime) ; export CSV.

Réglages : délais, nombre de photos, sources, export CSV et JSON, restauration, compte, « Sur téléphone » (fenêtre
« Comme une application »), données personnelles, à propos.

## Sources (consultées le 14/11/2026)

- service-public.gouv.fr, fiche F31270 « État des lieux d'entrée dans un bail d'habitation » (vérifiée le
  10/03/2026 par l'éditeur) : contenu minimal, document unique à deux colonnes ou documents similaires, demande de
  modification dans les 10 jours (et premier mois de chauffe pour le chauffage), grille de vétusté convenue au bail.
  https://www.service-public.gouv.fr/particuliers/vosdroits/F31270
- service-public.gouv.fr, fiche F33671 « État des lieux de sortie pour un bail d'habitation » (vérifiée le
  10/03/2026) : contenu minimal de la sortie (nouvelle adresse, date de l'entrée, évolutions), vétusté sans
  retenue. https://www.service-public.gouv.fr/particuliers/vosdroits/F33671
- service-public.gouv.fr, fiche F31269 « Dépôt de garantie dans un bail d'habitation » (vérifiée le 09/06/2026) :
  restitution dans 1 mois si la sortie est conforme, 2 mois sinon, à compter de la remise des clés.
  https://www.service-public.gouv.fr/particuliers/vosdroits/F31269
- Décret n° 2016-382 du 30 mars 2016 (établissement de l'état des lieux et prise en compte de la vétusté), cité par
  les fiches ci-dessus : https://www.legifrance.gouv.fr/loda/id/JORFTEXT000032320564/ (lien relevé sur
  service-public.gouv.fr, texte non relu en entier).

À revérifier chaque année (mise à jour de `BASE.reglages.verifieLe` et des mentions « consultée le »).

## Risques et limites

- **Juridique** : outil d'aide, ni certifié ni opposable par lui-même ; avertissement dans chaque vue, sur le
  document, la page du site et la fiche Gumroad. La signature des parties fait l'état des lieux contradictoire.
- **Photos** : vignettes légères, pas des preuves en haute définition ; limite de nombre et de taille du compte.
- **Données personnelles** : noms et adresses des parties, photos du logement. Rappel de ne photographier ni
  personnes ni papiers d'identité ; suppression des dossiers terminés conseillée.
- **Taille** : un T4 meublé fait environ 100 éléments (≈ 30 Ko de texte) ; les photos dominent la taille.
- **Agences** : 900 Ko par clé et 30 photos : une petite agence exportera puis supprimera les dossiers terminés.
  Une version « agence » (plusieurs utilisateurs, stockage des photos séparé) relèverait du sur mesure.

## Démo

Trois dossiers fictifs relatifs à aujourd'hui : un T2 meublé (« 12 allée des Tilleuls, 00000 Ville-Exemple »,
bailleuse « Claire Exemple ») rendu il y a 6 jours avec 5 dégradations (dont une non imputée), usure normale,
une fenêtre améliorée, une clé manquante, grille de 3 lignes et dépôt de 1 300 € ; un studio loué vide par
« Agence Démo Immobilier », entrée faite il y a 4 jours (délai de rectification ouvert, hotte hors service) ; le T2
préparé pour le locataire suivant (entrée dans 3 jours). Photos dessinées dans le navigateur (« Photo d'exemple »).

## Tests

`outils/templates/etat-des-lieux.test.mjs` (13 tests) : base, normalisation, création, dates de pose et âge,
vétusté, comparaison (dont usure normale), statut, retenues, compteurs et clés, délais (fin de mois), points à
compléter, nouveau locataire, photos, taille et CSV. Parcours Playwright (1280 px, iPhone 13, Pixel 7) : code faux
refusé, premier lancement, saisie avec photo, synchronisation vers un second contexte, rechargement, démo,
fenêtre « Comme une application », aucune erreur de page.
