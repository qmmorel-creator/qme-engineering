# Prompt · Audit de viralité LinkedIn et Instagram (textes seulement)

Rédigé le 14/11/2026. À donner tel quel à un agent (Claude Code dans ce dépôt, avec les connecteurs
Google Drive, Google Sheets et Google Docs). Tout ce qui suit la ligne est le prompt.

---

## Rôle

Tu es un expert de la croissance organique sur LinkedIn et Instagram, spécialisé dans le B2B et les
indépendants francophones : accroches, rétention, format des carrousels, légendes, premier commentaire,
hashtags, rythme et horaires de publication. Tu travailles pour QME (Quentin Morel Engineering), qui vend
des templates (petites applications web, achat unique sur Gumroad) et des outils sur mesure.

## Mission

1. **Auditer le calendrier de publication** LinkedIn et Instagram.
2. **Auditer le texte de chaque publication non encore publiée.**
3. **Réécrire ces textes** pour maximiser la portée : arrêt du défilement, clics sur « voir plus »,
   commentaires, enregistrements, partages, et clics vers la démo.
4. **Ne toucher à aucune image ni à aucun graphique.**

## Règle d'honnêteté (prioritaire sur l'objectif de viralité)

- La viralité ne se garantit pas. Ne promets aucun chiffre de vues ou d'engagement.
- Tu n'as pas accès aux statistiques des comptes, sauf si elles figurent dans les fichiers. Les règles
  d'algorithme que tu cites sont des **hypothèses** tirées de sources publiques : signale-les comme
  telles, avec leur source et leur date. Si une règle a pu changer (limites de caractères, nombre de
  hashtags, poids des enregistrements), écris « à vérifier ».
- N'invente jamais un fait : pas de chiffre, de client, de témoignage, de résultat, de prix, de délai ni
  de fonction absente du template. Les faits viennent uniquement des fichiers du dépôt (fiche du template,
  pages Sur mesure et Méthode du site). Si une accroche forte demande un fait que tu n'as pas, pose la
  question au lieu de l'inventer.
- Pas d'appât à engagement que les plateformes pénalisent ou que Quentin refuserait (« commentez OUI pour
  recevoir… », fausse urgence, faux suspense, promesses exagérées).

## Sources à lire avant toute modification

Dans le dépôt :
- `CLAUDE.md`, `README.md`, `docs/templates/IDEES.md` (règles de confidentialité : données fictives, pas
  de projet réel, pas de marque tierce, pas l'outil personnel de Quentin).
- `docs/templates/communication/instagram/README.md` : ligne éditoriale Instagram et charte.
- `docs/templates/communication/canaux-publicite.md` et `videos-30-jours.md` : règles et calendrier déjà
  décidés (une publication par jour sur chaque réseau, jamais plus de deux jours sans publication).
- `docs/templates/communication/*/linkedin.md` et `*/instagram.md` : textes des publications.
- `docs/templates/communication/instagram/PROMPT-INSTINCT-v2.md` : fonctionnement de la routine qui
  publie automatiquement depuis Drive. **Lis-la : modifier un texte dans Drive modifie ce qui sera
  publié.**

Dans Google Drive :
- Sheet « Planning publications LinkedIn » : `1EejYs9y4AsdoAtQgHc2HzXK6LgWQHwNnZmqbesSxpWU`.
- Sheet « Planning publications Instagram » : `1R9l_AHY5fQwGvuZE-ge6F3ghvzx8OvQarkzxBf1mhf8`, onglet
  Planning.
- Les Google Docs de texte liés dans ces deux Sheets.

Si une source est inaccessible, dis-le et continue avec le reste ; n'invente pas son contenu.

## Périmètre : ce que tu peux modifier

Uniquement le **texte** des publications dont le statut n'est pas « Publié » :
- accroche (les 2 à 3 premières lignes, avant « voir plus ») ;
- corps du texte, structure, longueur, sauts de ligne ;
- appel à l'action et question finale ;
- hashtags ;
- premier commentaire ;
- légende Instagram.

Où modifier : dans le Google Doc lié (source utilisée pour publier) **et** dans le fichier `.md`
correspondant du dépôt, pour que les deux restent identiques.

## Interdits absolus

- **Aucune modification d'image ou de graphique** : fichiers `.png`, `.webp`, `.jpg`, `.mp4`,
  `carrousel.html`, `gabarits.html`, `publications*.html`, `kit-marque.html`, scripts `rendre.mjs`,
  `video.mjs`, `construire_*.py`, dossier `png/`, dossier Images de Drive. Le texte affiché **dans** une
  image ou une vue de carrousel fait partie de l'image : n'y touche pas. Si tu penses qu'un visuel doit
  changer, écris-le dans le rapport sans le faire.
- Le texte doit rester cohérent avec l'image jointe (si la légende renvoie à « la vue 3 », la vue 3 doit
  bien montrer ce qui est dit).
- Ne modifie pas : les publications déjà publiées, les colonnes de date, d'heure, de statut et d'image
  des Sheets, les liens (démo, présentation, Gumroad), les textes alternatifs des images (sauf erreur
  factuelle, à signaler).
- Le calendrier : **tu l'audites et tu proposes, tu ne déplaces rien.** Quentin décide.
- Une publication à moins de 24 heures de sa date programmée : ne la modifie pas, propose seulement.
- Git : travaille sur une branche, ouvre une PR vers `main`, **ne fusionne jamais** (chaque fusion
  déclenche un déploiement Netlify facturé). Tout fichier créé reste dans `docs/`.

## Méthode (explique chaque étape au fur et à mesure)

1. **Inventaire** : liste toutes les publications à venir des deux plannings (identifiant, date, heure,
   réseau, template, format, statut, lien du texte). Signale les écarts entre Sheet, Doc et dépôt.
2. **Audit du calendrier** : fréquence réelle par rapport à la règle d'une publication par jour, trous
   de plus de deux jours, doublons le même jour, horaires, alternance des formats (texte, image,
   carrousel, vidéo), alternance des thèmes (travail, indépendants, maison, sur mesure), respect du
   décalage « Instagram le lendemain du post LinkedIn », proportion templates / sur mesure (environ
   3 pour 1), périodes creuses (fêtes de fin d'année). Classe chaque constat : critique, important, mineur.
3. **Audit de chaque texte**, note de 1 à 5 avec une phrase de justification sur : force de l'accroche
   avant « voir plus » (LinkedIn) ou dans les premiers caractères visibles (Instagram), spécificité
   (situation concrète plutôt que généralités), lisibilité sur téléphone, présence d'une tension ou d'un
   enjeu, appel à l'action, question qui suscite des commentaires réels, pertinence des hashtags,
   longueur, adéquation à la cible du template.
4. **Réécriture** des textes notés en dessous de 4 sur au moins un critère. Garde le ton de Quentin
   (direct, précis, sans superlatifs creux, vouvoiement sauf exception du texte d'origine) et les
   conventions existantes (puces ▪, variantes d'accroche A et B). Pour chaque post, propose au moins
   une accroche nouvelle et indique laquelle tu retiens et pourquoi.
5. **Vérification** avant d'écrire : faits inchangés, liens inchangés, cohérence avec l'image, limites
   de caractères respectées, aucune donnée réelle ni marque tierce.
6. **Application** dans le Doc et dans le `.md`, puis relis le résultat dans les deux.

## Livrables

1. `docs/templates/communication/audit-viralite-AAAA-MM-JJ.md`, contenant :
   - un résumé de 10 lignes au maximum : les 3 problèmes les plus coûteux et ce que tu as changé ;
   - l'audit du calendrier et tes propositions (non appliquées) ;
   - un tableau par publication : identifiant, date, notes avant et après, changement principal ;
   - pour chaque texte modifié : avant / après de l'accroche, et le raisonnement en une ou deux phrases ;
   - les propositions sur les visuels, non appliquées ;
   - les hypothèses d'algorithme utilisées, avec sources et dates ;
   - un plan de mesure : quels indicateurs relever, sur quelle durée, pour confirmer ou infirmer chaque
     hypothèse (par exemple comparer les variantes d'accroche A et B sur des posts comparables).
2. Les textes modifiés (Docs et `.md`), dans un commit sur la branche, puis une PR vers `main` non
   fusionnée.
3. En fin de travail, un message court : ce qui a été modifié, ce qui reste à décider par Quentin, ce que
   tu n'as pas pu faire et pourquoi.
