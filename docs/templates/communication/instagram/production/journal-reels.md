# Journal des Reels du soir

Mémoire du skill `.claude/skills/reel-du-soir/` : une ligne par Reel, dans l'ordre. Instagram 18:45 et YouTube Short
20:00, les lundis, mercredis et vendredis (décision de Quentin du 16/11/2026). Non publié (`/docs/*` en 404).

Reels du soir antérieurs (produits avant ce skill, sans ligne ici) : IG-27, IG-36 à IG-61, IG-131 à IG-133
(voir le planning Instagram et `docs/templates/communication/videos-30-jours.md`).

**18/11/2026 — plus aucun Reel muet (décision de Quentin).** Contrôle `ffprobe` des fichiers Drive programmés : les 24 Reels
motion design (IG-27, IG-40, IG-41, IG-42, IG-43, IG-44, IG-45, IG-46, IG-47, IG-49, IG-50, IG-51, IG-52, IG-53, IG-55, IG-56,
IG-57, IG-58, IG-59, IG-60, IG-61, IG-131, IG-132, IG-133) n'avaient aucune piste audio. Musique QME ajoutée sans réencoder
l'image (`node sonoriser.mjs`, image identique à l'original), nouvelles versions déposées dans « Images Instagram » sous le
même nom, IDs mis à jour dans les plannings Instagram (colonne P, lignes « Programmé ») et YouTube (colonne I) ; anciennes
versions renommées `…-ANCIEN-muet.mp4` (non supprimées). `video.mjs` ajoute désormais la musique d'office.

| Date | Instagram | YouTube | Produit | Angle | Titre | Durée | Fichier | Statut |
|---|---|---|---|---|---|---|---|---|
| 2026-11-20 | IG-152 (18:45) | YT-39 (20:00) | Planning de mémoire ou de thèse (`memoire`) | chiffre vérifiable | Combien de mots par jour pour finir votre mémoire ? | 25 s | `production/IG-152.html` → `png/IG-152-memoire.mp4` (2,77 Mo, AAC, Drive `1-SEGkCXPDYjzSUpPRH-73H3m5_ScaHJ4`) | Programmé |
| 2026-11-23 | IG-155 (21:00) | YT-43 (20:00) | Notes de frais et indemnités kilométriques (`notes-de-frais`) | erreur courante (chiffre vérifiable) · couleur dominante bleu | 0,636 € le km, toute l'année ? | 25 s | `production/IG-155.html` → `png/IG-155-notes-de-frais.mp4` (2,76 Mo, AAC, Drive `1JvHC26eIKlsc0j8na_Ejrhi9usaacrvu`) | Programmé |
| 2026-12-02 | IG-178 (21:00) | YT-51 (20:00) | Simulateur leasing ou achat (`leasing`) | chiffre vérifiable (coût caché du forfait kilométrique) · couleur dominante rouge | LLD à 379 € par mois… puis 1 440 € en rendant la voiture | 27,5 s | `production/IG-178.html` → `png/IG-178-leasing.mp4` (2,87 Mo, AAC, Drive `12dX8aTNvJGxFFBgIDDQuJhypJ_OMWeG4`) | Programmé |
| 2026-12-04 | IG-211 (21:00) | YT-67 (20:00) | Capacité d'emprunt et comparateur de prêts (`emprunt`) | chiffre-choc suivi de sa cause (coût total du crédit, pas la mensualité) · couleur dominante bleu | 264 200 € empruntés, 38 703 € d'écart | 26,5 s | `production/IG-211.html` → `png/IG-211-emprunt.mp4` (2,86 Mo, AAC, Drive `1meoAQgrotqJRKeYO5nB0VMB46Xh77ZGh`) | Programmé |
