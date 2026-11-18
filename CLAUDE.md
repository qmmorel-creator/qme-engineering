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

## Affiliation

- **Retour d'un influenceur intéressé** : skill `.claude/skills/retour-affiliation/` (analyse de la niche, démo
  personnalisée `/demo/<prénom>`, vidéo privée, brouillon en deux volets : produits à recommander contre commission,
  puis sur-mesure pour lui). Aucun taux de commission dans les mails : le demander à Quentin à chaque fois. Rien
  n'est fusionné ni envoyé sans son feu vert. Fiches : `docs/templates/communication/affiliation/`.

## Vidéos de démonstration (LinkedIn, Instagram, YouTube Shorts, TikTok)

- **Idée du jour** : skill `.claude/skills/idee-video/` (un seul produit en vente, angles en rotation), qui
  appelle **`.claude/skills/video-demo/`** (interaction réelle avec le template, rendu, Google Drive,
  programmation LinkedIn 17:30 / Instagram 08:30 / YouTube Shorts 12:00). TikTok repris le 18/11/2026 (abandon du 16/11 levé) : Instinct reprend chaque
  publication Instagram sur TikTok (@qme.qm.engineering), procédure `docs/templates/communication/tiktok/` ;
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

## Campagne X (anglais, sur mesure)

- **Publication quotidienne sur X** (décision du 18/11/2026) : skill `.claude/skills/campagne-x/`, en anglais uniquement, volet
  sur mesure uniquement, une publication par jour (post, image ou vidéo en rotation, accroches et thèmes variés), produite une semaine
  d'avance par la tâche planifiée « Campagne X · contenu J+7 », à 10:00 heure de Californie (19:00 à Paris), publié par Instinct (Sheet « Planning
  publications X », routine `PROMPT-INSTINCT-X.md`). Dossier :
  `docs/templates/communication/x/` (journal `journal-x.md`, bannière du profil `banniere.html`). Lien de toutes les
  publications : `qm-engineering.fr/x` → `/en/english-version/`, générée par `node outils/x/generer.mjs` (bouton
  « I'd like it in English » : modules `en-<slug>` du compteur `/api/interets`).
