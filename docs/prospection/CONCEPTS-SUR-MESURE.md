# Concepts : une vraie personnalisation au secteur, jamais un SaaS générique

Décision de Quentin du 27/11/2026, après le concept CD Pétanque 87 jugé « beaucoup trop générique » : **tout concept
envoyé à un prospect est conçu pour son métier**, sur le modèle des concepts Kelly (`concepts/conciergerie-en-provence/`)
et ARVA (`concepts/arva/`). Ce document s'applique en plus du skill `concept-prospect` et **prime sur ses gabarits**
(`demo-template.html`, `concept-page-template.html`) quand ils produisent un rendu générique.

## 1. Ce qui est interdit

- La coquille SaaS neutre : barre latérale sombre standard, cartes KPI grises, tableaux et badges génériques, police
  système, accent bleu par défaut, intitulés passe-partout (« Tableau de bord », « Modèles », « Catégories »).
- La page de concept produite telle quelle par `concept_page.py` (titre, paragraphe, quatre images, bouton) : c'est un
  point de départ technique, jamais la page envoyée.
- Des écrans qu'on pourrait recopier chez un autre prospect en changeant seulement le nom.

## 2. Ce qu'un concept doit avoir (références : Kelly et ARVA)

**La démonstration interactive** (publiée dans `concepts/<slug>/demo/index.html`, liée depuis la page) :
- **Une identité propre au prospect et à son métier** : nom de l'outil tiré de leur vocabulaire (« Le carnet
  d'entretien », « Rappel NEO BT PRO »), logotype ou mot-symbole, palette et typographies choisies pour le secteur (pas
  l'accent par défaut), icônes adaptées.
- **Un écran d'accueil avec un grand chiffre métier** et une phrase qui dit la situation du jour dans leurs mots
  (« 10 interventions aujourd'hui », « 1 055 appareils pas encore contrôlés »), un anneau ou une jauge d'avancement.
- **L'entonnoir de leur processus réel**, étape par étape avec leurs termes (« De l'intervention prévue aux heures
  validées », « Du contrôle à l'échange, appareil par appareil »).
- **Des éléments visuels du terrain** : carte de leur zone, illustration de leur environnement (montagnes, collines de
  Provence, locaux), vignettes de leurs objets (photos de locaux, appareils, documents), jamais d'images d'une autre
  entreprise ni de données réelles non publiques.
- **Les objets et règles du métier** à l'écran : statuts, contrôles, documents, gestes et contraintes propres au
  secteur (normes, règlements, tenues, matériel), vérifiés sur des sources publiques.
- **Au moins une vue téléphone** dans un cadre de téléphone, pour la personne sur le terrain.
- Des interactions réelles (navigation, filtres, cases à cocher, sélection sur la carte) et le bandeau « Exemple de
  données fictives ».

**La page de concept** (`concepts/<slug>/index.html`, écrite sur mesure, pas le gabarit) :
- un en-tête aux couleurs du concept, titre qui reprend leur problème dans leurs mots, maquette ordinateur + téléphone ;
- trois colonnes « Ce que vous m'avez dit » (citation courte de son message) / « Ce que demande ce métier » / « Ce que
  propose le concept » ;
- des sections numérotées (01, 02…) : titre orienté bénéfice, phrase d'accroche, trois puces, captures ;
- une bande sombre pour les vues téléphone ;
- « Vos outils restent en place » (ce que l'outil relie au lieu de remplacer) ;
- « On commence par ce qui vous fait gagner le plus de temps » (modules ou étapes), puis l'estimation réglable
  (étape 6 bis du skill), puis les boutons « Ouvrir la démonstration interactive » et « Télécharger le PDF ».

## 3. Comment s'y prendre

1. Partir des fichiers de Kelly ou d'ARVA (page et démo), pas des gabarits du skill, et réécrire contenu, palette,
   typographies et illustrations pour le nouveau secteur.
2. Lire le site du prospect et deux ou trois sources publiques du métier (fédération, règlement, fiches métier) :
   relever au moins dix termes et cinq objets propres au secteur, et les retrouver à l'écran.
3. Contrôle avant PR : si l'on remplace le nom du prospect par un autre secteur et que les écrans restent crédibles,
   le concept est trop générique et se refait.
4. Le PDF reprend les captures de cette démonstration (scripts `capture.cjs` et `build_pdf.cjs` du skill).
5. Les autres règles restent : données fictives signalées, aucun prix inventé, aucune trace de Claude, PR non fusionnée
   sans Quentin, registre Nexora (`CLAUDE.md`, « Concepts »).

Les pages des campagnes par concept (`campagne-concept`, `campagne-ciblee-pack`) suivent la même exigence à l'échelle
du secteur visé : identité, vocabulaire, objets et visuels du métier, sans nom de prospect.
