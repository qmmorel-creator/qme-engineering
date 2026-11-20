---
name: publication-classique
description: Créer et programmer les publications « classiques » LinkedIn et Instagram de QME (post avec image, carrousel, grand chiffre, avant / après, capture, texte seul), dans le style déjà publié, quand la réserve de publications passe sous 7 jours. Rotation des sujets, des styles d'accroche et des formats, sans redondance. À utiliser quand Quentin demande « prépare les prochaines publications », « il manque des posts », « publication du jour », ou depuis la tâche planifiée quotidienne qui surveille la réserve.
---

# Publications classiques LinkedIn et Instagram

> **Règles communes (18/11/2026)** : appliquer `docs/templates/communication/REGLES-CONTENU.md` (au moins 1 publication par jour et
> 7 jours d'avance par plateforme, problème posé puis résolu, accroche, rétention, couleur d'accent Bauhaus en rotation,
> aucune vidéo muette) et les heures de `docs/templates/communication/HEURES.md`. Elles priment sur ce skill.

But : qu'il y ait **toujours au moins 7 jours** de publications programmées sur chaque réseau (une par jour,
en plus des vidéos démo). Chaque publication reprend la manière de QME déjà publiée : constat concret,
geste du concepteur, outil montré avec des données fictives, accroche forte, aucune promesse inventée.

Explique chaque étape à Quentin en français, sans flatterie ; dis ce qui est vérifié et ce qui ne l'est pas.

## Références à lire (dans cet ordre)

1. `CLAUDE.md`, `docs/templates/IDEES.md` (règles de confidentialité, aucune marque tierce, aucune donnée réelle,
   pas l'outil personnel de Quentin, mentions « ne remplace pas un avis professionnel »).
2. `docs/templates/communication/audit-viralite-2026-11-14.md` et `PROMPT-AUDIT-VIRALITE.md` : les **12 styles**,
   les règles d'accroche, le format strict des Docs.
3. `docs/templates/communication/canaux-publicite.md` et `videos-30-jours.md` § 1–2 : ce qui fonctionne, accroches,
   façon de parler de Quentin.
4. `docs/templates/communication/instagram/README.md` : ligne éditoriale Instagram, charte, formats, hashtags.
5. Modèles de textes : `docs/templates/communication/*/linkedin.md`, `*/instagram.md`, `sur-mesure/IG-*.md`.
6. Modèles de visuels : `instagram/gabarits.html`, `instagram/construire_ig_06_33.py`,
   `instagram/production/IG-1xx.py` (+ `.html`), rendu `node docs/templates/communication/instagram/rendre.mjs <fichier.html>`.
7. `.claude/skills/nouveau-template/reference.md` § Planning LinkedIn et § Planning Instagram (colonnes, dossiers,
   statuts) et `docs/templates/communication/instagram/PROMPT-INSTINCT-v3.md` § 3 (lecture des Docs par la routine).
8. Mémoire : `docs/templates/communication/journal-publications.md`.

## 1. Mesurer la réserve

1. Relire **en entier** les deux onglets `Planning` (LinkedIn `1EejYs9y4AsdoAtQgHc2HzXK6LgWQHwNnZmqbesSxpWU` A1:N,
   Instagram `1R9l_AHY5fQwGvuZE-ge6F3ghvzx8OvQarkzxBf1mhf8` A1:P).
2. Ne compter que les publications **classiques** : statut ≠ « Annulé », Thème ≠ « Vidéo démo ».
3. Pour chaque réseau, trouver le **premier jour sans publication classique** à partir de demain. La
   **date de référence commune** est le plus tôt des deux (décision de Quentin du 15/11/2026 : les deux réseaux
   démarrent ensemble, sur le réseau le moins couvert ; au 15/11/2026, LinkedIn couvert jusqu'au 22/03/2027).
4. Si cette date de référence est à **plus de 7 jours** : ne rien produire, ajouter une ligne « contrôle,
   réserve OK (LinkedIn jusqu'au …, Instagram jusqu'au …) » au journal et s'arrêter.
5. Sinon, produire **sur les deux réseaux** : pour chacun, ses premiers jours libres (au plus 3 publications par
   réseau et par exécution ; la tâche repasse le lendemain). Instagram garde son avance éventuelle : il reprend
   à son premier jour libre, de préférence avec le pendant d'un post LinkedIn déjà programmé et pas encore
   décliné sur Instagram. Ne jamais déplacer ni supprimer une publication existante pour aligner les dates.

## 2. Choisir les sujets (non-redondance)

Lister les titres internes (colonne F) des 60 derniers et des 30 prochains jours des deux plannings, et le journal.

- **LinkedIn**, alterner les familles (jamais deux fois la même famille d'affilée) :
  1. Template QME **en vente** (`node docs/videos/catalogue.mjs` : liste à l'instant t) — environ 1 jour sur 2 ;
  2. Méthode de chef de projet / ingénieur (planning, chemin critique, compte rendu, qualité, BTP) ;
  3. Sur mesure : un cas concret, fictif, tiré du métier (rôles, atelier, maintenance, automatisation) ;
  4. Argent des indépendants (TJM, coût de revient, relances, trésorerie) ;
  5. Coulisses du concepteur (comment un outil est construit, une règle chiffrée vérifiable).
- **Instagram** (ligne éditoriale du README) : templates et sur mesure uniquement ; de préférence le
  **pendant du post LinkedIn de la veille** (même sujet, adapté), sinon un template en vente.
- Interdits : un produit déjà mis en avant (classique ou vidéo) dans les **14 jours** autour de la date ; un
  sujet déjà traité avec le même angle ; un template qui n'est pas en vente présenté comme achetable.

## 3. Choisir le style d'accroche et le format (variété)

- **Style** : parmi les 12 de l'audit (contre-intuition, une seule idée courte, question directe, liste,
  avant / après, comparatif, opinion, scène, erreur et son coût, chiffre qui surprend, mini-tutoriel, récit) ;
  jamais l'un des **3 derniers** utilisés sur le réseau. Environ un post sur deux finit par une question.
- **Format LinkedIn** : `Image`, `Carrousel`, `Capture`, `Grand chiffre`, `Avant / après`, `Texte seul` ;
  jamais deux fois le même d'affilée, `Texte seul` au plus une fois par semaine.
- **Format Instagram** : `Carrousel` (5 vues, schéma du README) le plus souvent ; `Image` simple au plus une
  fois sur quatre.

## 4. Écrire

**Accroche (vitalité)** : c'est elle qui décide de la portée.
- LinkedIn : 1 à 2 lignes avant « voir plus », moins de 140 caractères ; une scène, un chiffre exact et
  vérifiable, une contradiction ou une question que la cible se pose cette semaine. Instagram : la première
  ligne de la légende et le titre de la vue 1 portent la même promesse.
- Écrire **3 accroches**, garder la plus concrète (celle qu'on comprend sans contexte), noter les 2 autres
  en section `NOTES` du Doc.
- Pas de superlatif, pas d'émoji, pas de statistique sans source, aucune promesse de résultat chiffrée,
  aucune marque tierce. Vouvoiement. Chiffres et dates **vérifiés** (calcul, application en démo, page du site).

**Corps** : constat → principe → « J'ai donc construit… » / ce que fait l'outil (3 points ▪ au plus) → appel
à l'action (démo libre, achat unique) → question finale si le style s'y prête. 3 à 5 hashtags `#Mot`.
Instagram : 3 à 6 phrases, « Démo libre et achat : lien en bio », 5 hashtags au plus, pont vers le sur mesure.
**Template vie personnelle** (`REGLES-CONTENU.md` § 7) : l'appel à l'action devient l'essai, « 14 jours d'essai
gratuit, sans carte : lien en bio » (LinkedIn : `qm-engineering.fr/essai/`), l'achat unique en second.

**Doc** (format strict lu par la routine) : texte à publier, ligne `———`, `PREMIER COMMENTAIRE` (LinkedIn :
lien de la démo et de la page catalogue ou du site), ligne `———`, `NOTES` (accroches B et C, sources). Jamais
« ===== », « TEXTE DE LA PUBLICATION », « À VÉRIFIER », « Prévu le », « [à compléter] » dans la partie publiée.
**Liens LinkedIn suivis** : tout lien `qm-engineering.fr` ou `qmengineering.gumroad.com/l/` d'un texte ou d'un premier commentaire LinkedIn porte `utm_source=linkedin&utm_medium=social&utm_campaign=li-nn` (ID en minuscules ; `?demo&utm_…` après un `?demo`). Le site transmet ces UTM à Gumroad (`assets/site.js`) : chaque vente est rattachée à son post.

## 5. Visuels

- Vrais écrans des templates : captures de la démo (`/templates/<slug>/?demo`, serveur local
  `npm run dev:templates`, Playwright), mention **« Données fictives »** sur chaque capture.
- Charte du README (papier, encre, rouge, jaune, bleu ; Outfit ; formes Bauhaus ; ombres pleines ; pas de
  dégradé ni d'emoji ; marque QME en pied).
- Fichier source : `docs/templates/communication/instagram/production/<ID>.py` → `<ID>.html` (sur le modèle
  des IG-1xx existants, gabarits importés sans les modifier), puis `rendre.mjs` → PNG **1080 × 1350**. Le même
  jeu sert au carrousel LinkedIn (`LI-nn-1.png;LI-nn-2.png…`) et Instagram (`IG-nn-<slug>-1.png | …`).
- Relire chaque PNG (Read) : texte lisible, rien à moins de 40 px des bords, pas de débordement, compteur
  « n / 5 », mention données fictives.
- Texte alternatif : un par image, numérotés « 1. … | 2. … », avec « données fictives ».

## 6. Déposer et programmer

1. Drive : images LinkedIn dans `1QTuTihvIcKxLpFSU7xfACyVeXxYA9N_j`, Docs LinkedIn dans
   `19-LC3WoXSV6njvAiwUuoArup-5jpa12K` (titre `LI-nn – <titre interne>`) ; images Instagram dans
   `1ALPahoZEKdYjG5iUnPfa5aYubsOPWN3m`, légendes dans `1uOEyjI7iKVDVu9qXxRcxwGvoNouP-ORd`
   (`IG-nn · <titre interne> · légende`). Envoi par `mcp__Google_Drive__create_file` avec
   `base64Content: sha256:<empreinte>:<chemin absolu>` (≈ 3,1 Mo max par fichier). Relire chaque Doc créé.
   **TikTok (décision de Quentin du 18/11/2026)** : Instinct reprend chaque publication Instagram sur TikTok
   en **vidéo seule, sans légende** (Quentin colle lui-même le texte ensuite), procédure
   `docs/templates/communication/tiktok/`. Un **Reel** est repris tel quel : rien à produire. Un **Carrousel** ou une
   **Image** demande une vidéo : `node docs/videos/diaporama.mjs <PNG dans l'ordre de la colonne I> --sortie
   docs/videos/sortie/IG-nn-<slug>-tiktok.mp4`, vérifier la piste audio (`ffprobe`), puis la déposer dans le dossier
   Images Instagram sous le nom exact `IG-nn-<slug>-tiktok.mp4` (premier fichier de la colonne I, « -1.png » ou
   « .png » remplacé par « -tiktok.mp4 ») : Instinct la cherche par ce nom. Rien à écrire dans le planning.
2. Lignes : relire l'onglet juste avant d'écrire ; ID = plus grand numéro + 1 ; insérer à la place
   chronologique (`insert_dimension` puis `update_values`). LinkedIn : **10:00** (méthode, B2B) ou **12:15**
   (template) ; Instagram **19:00** (heures : `docs/templates/communication/HEURES.md`) ; colonne O d'Instagram = ID LinkedIn associé ; colonne P = IDs Drive dans
   l'ordre ; Thème = famille du sujet ; Format = format choisi.
3. **Statut « Programmé »** (publication autonome demandée par Quentin le 15/11/2026). Si Quentin demande une
   relecture, mettre « Prêt » à la place. Ne jamais toucher une ligne « Publié », « Erreur », « Annulé » ou déjà
   passée ; ne jamais publier soi-même.
4. Relire les plages écrites (dates, IDs, liens).

## 7. Clore

1. Journal `docs/templates/communication/journal-publications.md` : une ligne par publication (date, réseau,
   ID, famille, sujet / produit, style, format, accroche retenue, Doc, statut).
2. Sources des visuels et textes dans le dépôt : `docs/templates/communication/<slug ou sujet>/` (`linkedin.md`,
   `instagram.md`) et `instagram/production/`. Commit sur la branche de travail, push ; **aucune fusion dans
   `main`** sans feu vert de Quentin.
3. Résumé à Quentin : réserve avant / après, publications créées (ID, date, heure, format, accroche), ce qui a
   été vérifié.
