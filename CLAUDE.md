# Consignes pour les assistants

Site de QME (Quentin Morel Engineering) et templates vendus sur Gumroad. Lire `README.md`.

- **Aucune fusion dans `main` ni publication sans feu vert explicite de Quentin** (chaque fusion déclenche
  un déploiement Netlify facturé). Travail sur une branche, PR vers `main`.
- Netlify publie tout le dépôt : rien de privé hors de `docs/`, `.claude/` et `CLAUDE.md` (bloqués en 404
  dans `netlify.toml`).

## Templates

- **Codes gratuits** : tout code d'accès offert (`npm run code -- <PRODUIT> 1`) est inscrit dans
  `docs/templates/codes-gratuits.md` (code, id de révocation, destinataire, statut).

- **Idées** : `docs/templates/IDEES.md` est la liste vivante. Toute idée de template donnée par Quentin y
  est ajoutée tout de suite (ligne du tableau + fiche si elle est détaillée), et le statut suit le
  développement (`idée`, `fiche`, `en cours`, `prêt`, `en vente`).
- **Développement d'un template** : appliquer le skill `.claude/skills/nouveau-template/`, à chaque fois.
- Référence d'architecture : `templates/revision/` (planning de révision).
- **Pas de version anglaise des templates ni des packs** (décision du 18/11/2026) : interface, démo, fiche Gumroad,
  `gumroadEn`, traductions restent en français uniquement ; les mentions « version anglaise en attente » dans
  `README.md`, `IDEES.md` et les fiches sont caduques. La **partie anglaise du site** (`en/`) est conservée : la page
  `/en/templates/` continue de présenter chaque template français (carte « in French »).

## Affiliation

- **Retour d'un influenceur intéressé** : skill `.claude/skills/retour-affiliation/` (analyse de la niche, démo
  personnalisée `/demo/<prénom>`, vidéo privée, brouillon en deux volets : produits à recommander contre commission,
  puis sur-mesure pour lui). Aucun taux de commission dans les mails : le demander à Quentin à chaque fois. Rien
  n'est fusionné ni envoyé sans son feu vert. Fiches : `docs/templates/communication/affiliation/`.

## Vidéos de démonstration (LinkedIn, Instagram, YouTube Shorts)

- **Idée du jour** : skill `.claude/skills/idee-video/` (un seul produit en vente, angles en rotation), qui
  appelle **`.claude/skills/video-demo/`** (interaction réelle avec le template, rendu, Google Drive,
  programmation LinkedIn 17:30 / Instagram 08:30 / YouTube Shorts 12:00). Pas de TikTok (abandonné le 16/11/2026) ;
  chaîne YouTube : `docs/templates/communication/youtube/`. Outils et journal : `docs/videos/`.
- **Tout format vidéo** ajouté à un planning (Reel Instagram, vidéo LinkedIn) reçoit aussi sa ligne `YT-nn` dans le
  planning YouTube, le même jour (12:00 pour une vidéo démo, 20:00 pour un reel du soir).
- **Moteur vidéo unique** (décision du 18/11/2026) : toute vidéo QME (démo, Reel du soir, Short, motion design, vidéo
  privée de partenariat) est rendue par `docs/videos/` : `moteur.mjs` pour une démo interactive (scénario
  `docs/videos/scenarios/`), `rendu.mjs` pour une page HTML animée (`instagram/video.mjs` et `sonoriser.mjs` n'en sont
  que des raccourcis). Capture image par image en temps virtuel à 30 i/s, encodage sous 2,9 Mo, musique QME. Ne jamais
  écrire un autre outil de capture (screencast, `recordVideo`, enregistrement d'écran) : faire évoluer ce moteur.
- **Aucune vidéo muette** (décision du 18/11/2026) : tout Reel, Short ou vidéo programmé porte la musique QME
  (`docs/videos/musique/`) ; vérifier la piste audio avec `ffprobe` avant tout dépôt Drive. Seules les vidéos privées
  remises à un partenaire pour son propre montage restent muettes.
- **Reels du soir** : skill `.claude/skills/reel-du-soir/` (motion design en musique à partir des démos), lundi, mercredi et
  vendredi, Instagram 18:45 + YouTube Short 20:00 ; tâche planifiée « Reel du soir ». Journal :
  `docs/templates/communication/instagram/production/journal-reels.md`.
- **Publications classiques** (post, carrousel, grand chiffre…) : skill `.claude/skills/publication-classique/`,
  lancé chaque jour par une tâche planifiée ; il ne produit que si la réserve passe sous 7 jours. Journal :
  `docs/templates/communication/journal-publications.md`.
