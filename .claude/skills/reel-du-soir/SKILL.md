---
name: reel-du-soir
description: Produire et programmer un « Reel du soir » QME (motion design en musique de 20 à 29 s, 1080 × 1920, à partir de captures réelles d'une démo de template en vente), publié sur Instagram à 21:00 et en YouTube Short à 20:00 le même jour, les lundis, mercredis et vendredis. À utiliser quand la tâche planifiée « Reel du soir » se déclenche, ou quand Quentin demande « un reel du soir », « un Short du soir », « remplis les soirées YouTube ».
---

# Reel du soir (Instagram 21:00 + YouTube Short 20:00)

> **Règle absolue (décision de Quentin du 24/11/2026) : une seule publication par plateforme et par jour** (Instagram,
> TikTok, YouTube, LinkedIn, X), tous formats confondus (post, carrousel, Reel, vidéo, Short). Avant de programmer, relire
> le planning de la plateforme et prendre un jour **sans aucune ligne** (statut ≠ « Annulé ») : jamais deux lignes le
> même jour sur une plateforme. TikTok suit Instagram. Un Short jumeau d'un Reel prend le jour du Reel (ce jour ne doit
> avoir aucun autre Short). Les contenus audacieux (nouveaux formats, Reels de référence) vont dans les jours libres les
> plus proches. Détails et calendrier refait le 24/11/2026 : `docs/templates/communication/REGLES-CONTENU.md` § 1.

> **Règles communes (18/11/2026)** : appliquer `docs/templates/communication/REGLES-CONTENU.md` (au moins 1 publication par jour et
> 7 jours d'avance par plateforme, problème posé puis résolu, accroche, rétention, couleur d'accent Bauhaus en rotation,
> aucune vidéo muette) et les heures de `docs/templates/communication/HEURES.md`. Elles priment sur ce skill.

Décision de Quentin du 16/11/2026 : en plus des vidéos démo du matin (skill `video-demo`), des Reels du soir
(à l'origine trois par semaine ; depuis le 24/11/2026, uniquement les jours encore libres sur Instagram et YouTube). Explique chaque étape en
français, sans flatterie ; dis ce qui a été vérifié et ce qui ne l'a pas été.

## Règles non négociables

1. **Captures réelles** : chaque écran montré vient de la démo du template (`?demo`, serveur local), capturé avec
   Playwright. Aucun chiffre inventé : tout montant ou date à l'écran est lu dans l'application ou calculé avec ses
   fonctions (`regles.js`, `donnees.js`) et vérifié.
2. **Produit en vente** à l'instant t (`node docs/videos/catalogue.mjs`), jamais « bientôt ».
3. **Rotation** : jamais un produit montré (vidéo démo, Reel ou publication classique) dans les 7 jours avant ou après
   la date choisie, sur les trois plannings ; préférer le produit le moins présent en Reel du soir (`journal-reels.md`).
   Sujet différent de la vidéo démo du même jour.
4. **Charte et confidentialité** (`docs/templates/IDEES.md`, `instagram/README.md`) : données fictives marquées
   « Données fictives », aucune marque tierce, aucun client ou projet réel, pas l'outil personnel de Quentin ;
   argent / santé : pas de promesse. Vouvoiement, pas d'émoji, pas de superlatif.
5. **Format** : 1080 × 1920, 30 i/s, H.264, **avec la musique QME** (jamais muet, décision de Quentin du 18/11/2026),
   20 à 29 s, fichier < 2,9 Mo (limite du connecteur Drive). **Moteur vidéo unique** : `video.mjs` est un raccourci vers
   `docs/videos/rendu.mjs` (capture image par image en temps virtuel, encodage en deux passes sous 2,9 Mo, musique
   ajoutée après l'encodage). Ne pas écrire d'autre outil de rendu : faire évoluer `rendu.mjs`. Accroche
   lisible dès la première seconde ; rien d'important dans les 250 px du haut ni les 340 px du bas.

## 1. Choisir la date

Relire **juste avant d'écrire** les plannings Instagram (`A1:P`) et YouTube (`A1:O`) (IDs dans
`.claude/skills/video-demo/reference.md` § Programmation et `docs/templates/communication/youtube/README.md`).
Date = le **premier jour**, entre demain et J+45 (de préférence un lundi, mercredi ou vendredi), qui n'a **aucune
publication Instagram ni aucun Short YouTube** (tous formats, statut ≠ « Annulé ») : règle « une seule publication par
plateforme et par jour » du 24/11/2026. Aucune date libre : ne rien produire.

## 2. Fabriquer

1. Choisir le produit (règle 3) et un **angle** en rotation avec les Reels précédents : problème concret, chiffre
   vérifiable, avant / après, méthode, question. **Référence (20/11/2026) : les 7 Reels de `REGLES-CONTENU.md` § 3 bis**
   (vrai problème avec tension → bascule → solution ; texte de la scène 1 sans animation d'entrée ni rideau, lisible
   dès la première image). Écrire le script : accroche (3 lignes au plus), 2 ou 3 plans de
   démo, fin « <Produit> · démo gratuite · qm-engineering.fr ».
2. `npm run dev:templates`, puis captures Playwright de `http://localhost:8888/templates/<slug>/?demo` (viewport 430 px,
   dpr 2, bandeau démo et barre d'onglets masqués) dans `docs/templates/communication/instagram/production/captures/`.
3. Page animée `docs/templates/communication/instagram/production/IG-nn.html` sur le modèle de `IG-46.html` (en-tête
   commentaire : titre, script, durée, commande de rendu ; animations CSS en pause, `window.placer(ms)`).
4. Rendu depuis `docs/templates/communication/instagram` : `node video.mjs production/IG-nn.html <durée> <ms couverture>`,
   (moteur unique `docs/videos/rendu.mjs` : musique QME ajoutée d'office, taille tenue sous 2,9 Mo), puis renommer en `png/IG-nn-<slug>.mp4` et `png/IG-nn-<slug>-couverture.png`.
5. **Vérifier** : `ffprobe` (1080 × 1920, durée, **piste audio AAC présente sur toute la durée** — un Reel sans son
   n'est jamais déposé —, taille < 2,9 Mo, garantie par le moteur) ; planche
   `ffmpeg -vf "fps=1,scale=180:-1,tile=10x3"` relue image par image (accroche lisible, zones sûres, rien de coupé,
   chiffres identiques à l'application, mention « Données fictives » sur chaque capture).

## 3. Déposer et programmer

1. Drive (`mcp__Google_Drive__create_file`, `base64Content` = `sha256:<empreinte>:<chemin absolu>`,
   `disableConversionToGoogleType: true`) dans le dossier **Images Instagram** : la vidéo (`video/mp4`) et la
   couverture (`image/png`).
2. Doc de légende dans le dossier **Textes Instagram**, titre `IG-nn · <titre interne> · légende`, format strict de la
   routine : texte (accroche, 3 ou 4 lignes utiles, « Démo gratuite avec des données fictives : lien en bio. » ou,
   pour un template en vente (vie personnelle ou pro), « 14 jours d'essai gratuit, sans carte : lien en bio. » (`REGLES-CONTENU.md` § 7),
   3 à 5 hashtags `#Mot`), rien d'autre ; argent / santé : « ne remplace pas un avis professionnel » si utile.
3. Ligne **Instagram** à sa place chronologique : ID `IG-` + plus grand numéro + 1, date choisie, heure **21:00**,
   statut « Programmé », Thème « Reel du soir », Titre interne `Reel · <titre>`, Doc (ID et lien), fichiers
   `IG-nn-<slug>.mp4 | couverture : IG-nn-<slug>-couverture.png`, texte alternatif (ce que montre la vidéo, « données
   fictives »), Format `Reel`, P = `<ID vidéo> | couverture : <ID image>`. TikTok : rien à produire, Instinct
   reprend cette vidéo telle quelle, sans légende (`docs/templates/communication/tiktok/`).
4. Ligne **YouTube** à sa place chronologique : ID `YT-` + plus grand numéro + 1, même date, **20:00**,
   « Programmé », Thème = slug, titre (100 caractères au plus), description au modèle de
   `docs/templates/communication/youtube/README.md` (lien `?demo&utm_source=youtube&utm_medium=description&utm_campaign=yt-nn`,
   `#Shorts`), H = nom du fichier, I = ID Drive de la vidéo, J = ID Instagram, Format `Short`.
5. Relire les plages écrites. Ne jamais publier soi-même ni écrire « Publié » (Instinct publie ; son passage de
   21:00 sert une deuxième publication Instagram du jour).

## 4. Clore

1. Ligne dans `docs/templates/communication/instagram/production/journal-reels.md` (date, ID Instagram, ID YouTube,
   produit, angle, titre, durée, fichier HTML, statut).
2. Commit sur la branche de travail (page HTML, captures, journal ; les `.mp4` et `.png` de `png/` suivent les
   habitudes du dépôt), push. **Aucune fusion dans `main`** sans feu vert de Quentin.
3. Résumé : produit, angle, titre, durée, date, IDs Instagram et YouTube, ce qui a été vérifié et ce qui ne l'a pas été.
