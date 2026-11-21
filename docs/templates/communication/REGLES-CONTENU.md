# Règles de contenu QME (toutes plateformes)

Décisions de Quentin du 18/11/2026. Elles s'appliquent à toute publication produite pour LinkedIn, Instagram,
TikTok, YouTube Shorts et X, par toutes les tâches planifiées et tous les skills de contenu.

## 1. Cadence

- **Au moins une publication par jour et par plateforme**, et **au moins 7 jours d'avance** programmés sur chacune.
- TikTok reprend Instagram ; YouTube reçoit les vidéos démo, les Reels du soir et, les jours sans Short, le diaporama
  TikTok du carrousel Instagram du jour (tâche « TikTok · diaporamas J+14 »).
- Heures : `HEURES.md`.

## 2. Toujours poser un problème, puis le résoudre

Chaque publication suit : **problème vécu par l'audience → conséquence concrète → solution (le template ou le sur
mesure) → preuve (capture réelle, données fictives) → appel à l'action**. Jamais le nom du produit en premier.

## 3. L'accroche (hook)

La première ligne du texte, la première vue d'un carrousel et la première seconde d'une vidéo portent le problème,
lisibles sans le son et sans ouvrir la publication. Une seule idée, 12 mots au plus. Formes qui marchent :
- question qui pique (« Votre compte tient-il si un client paie trois mois plus tard ? ») ;
- chiffre vérifiable et surprenant, tiré de la démo (« 88 € par mois, 1 060 € par an ») ;
- erreur courante (« Relire trois fois la veille : la méthode qui retient le moins ») ;
- avant / après, situation vécue (« Hugo à 120 %, un geste, plus personne en surcharge »).
Interdits : « Découvrez… », « Saviez-vous… » sans chiffre, superlatifs, emoji en tête, chiffre inventé.

## 4. La rétention

- **Boucle ouverte** : l'accroche promet une réponse donnée plus loin (« … la réponse en vue 4 », « … voici le calcul »).
- Vidéo : un fait nouveau toutes les 2 à 3 s, texte à l'écran, la réponse avant les 3 dernières secondes, fin qui
  boucle sur le début ; **29 s au plus** pour les Reels et Shorts (les 5 musiques sont alors candidates).
- Carrousel (5 vues) : 1 problème, 2 aggravation, 3-4 solution et preuve, 5 appel à l'action ; « Faites glisser » sur
  la vue 1. Chaque vue se termine sur une raison de passer à la suivante.
- Texte : phrases courtes, une idée par ligne, la question finale invite à commenter (LinkedIn, X).

## 5. Couleurs Bauhaus en rotation

Palette du kit (`instagram/README.md`) : rouge `#D9302A`, jaune `#F5B400`, bleu `#1D4E89`, encre `#141414`, papier
`#F0EDE6`. La **couleur d'accent dominante** (fond de la vue d'accroche, bandeau, surlignage du mot clé) tourne entre
**rouge, jaune et bleu** (l'encre en contrepoint) : jamais la même couleur dominante deux publications de suite sur
un même réseau. Contrastes du kit : texte blanc sur rouge, bleu et encre ; texte encre sur jaune, jamais blanc.
Noter la couleur dominante dans le journal de la tâche pour tenir la rotation.

## 6. Son

Aucune vidéo muette : musique choisie automatiquement dans la bibliothèque QME (`docs/videos/musique/README.md`),
piste vérifiée par `ffprobe` avant tout dépôt.

## 7. Appel à l'action : l'essai gratuit (tous les templates en vente)

Décision de Quentin du 18/11/2026. Pour toute publication **en français** (LinkedIn, Instagram, TikTok, YouTube Shorts)
qui montre un template **en vente, vie personnelle ou professionnel** (étendu aux templates pro le 21/11/2026 ; liste : `PRODUITS_ESSAI`, `netlify/lib/essais.mjs`), l'appel à
l'action principal devient l'essai : « 14 jours d'essai gratuit, sans carte bancaire » ; vos données sont reprises si
vous achetez. Lien : `qm-engineering.fr/essai/` (ou la page catalogue du template, dont le premier bouton est l'essai).
Le prix et l'achat unique restent mentionnés en second. Packs et sur mesure : inchangés (l'essai se fait template par template).
**X n'est pas concerné** (campagne en anglais, sur mesure uniquement).
Fonctionnement et parcours : `docs/templates/essai-gratuit.md`. À appliquer dès que la page `/essai/` est en ligne
(fusion de la PR de l'essai gratuit).
