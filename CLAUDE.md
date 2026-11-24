# Consignes pour les assistants

Site de QME (Quentin Morel Engineering) et templates vendus sur Gumroad. Lire `README.md`.

- **Aucune fusion dans `main` ni publication sans feu vert explicite de Quentin** (chaque fusion déclenche
  un déploiement Netlify facturé). Travail sur une branche, PR vers `main`.
- Netlify publie tout le dépôt : rien de privé hors de `docs/`, `.claude/` et `CLAUDE.md` (bloqués en 404
  dans `netlify.toml`).

## Signature graphique dans tous les mails (décision du 22/11/2026)

- **Tout e-mail rédigé pour Quentin** (brouillon Gmail ou envoi) porte sa signature graphique « Bandeau » dans la version
  HTML, comme les mails automatiques du site : `node docs/templates/communication/signature/brouillon-gmail.mjs --json`
  (images en pièces jointes intégrées, l'outil Gmail supprimant les images distantes). Procédure :
  `docs/templates/communication/signature/README.md`. Elle remplace la signature texte, qui reste dans la version texte brut.

## Copie cachée des e-mails automatiques (décision du 24/11/2026)

- **Toute séquence d'e-mails envoyée automatiquement par le site via OVH** (essai, achat, accompagnement après achat,
  toute séquence future) met Quentin en copie cachée sur son adresse pro (`quentin.morel@qm-engineering.fr`) : c'est le
  comportement par défaut de `netlify/lib/mail.mjs`. Seules exceptions (`copieCachee: false`) : codes et liens de
  connexion, notifications adressées à Quentin, annonces en nombre. Où voir ces envois :
  `docs/templates/communication/DELIVRABILITE.md`.

## Prospection : mention d'opposition (règle absolue)

- **Tout e-mail de prospection** (entreprise, affiliation, partenariat, relance, réponse type aux refus) : vérifier
  d'abord que l'adresse et son domaine ne sont pas sur la liste d'opposition (`GET /api/compte/opposition`), puis
  terminer **toujours** par la mention « Ne plus recevoir les informations » avec le lien
  `https://qm-engineering.fr/ne-plus-recevoir/?email=<adresse>` (ou « répondez stop »). Une réponse « stop » ou
  hostile est inscrite le jour même sur la liste d'opposition. Sans exception : `docs/templates/communication/REGLES-PROSPECTION.md`.
- **Signature graphique obligatoire dans tout e-mail de prospection** (décision du 23/11/2026) : sur mesure, affiliation
  avec un influenceur ou une agence d'influenceurs, partenariat, relance, réponse à un prospect. Un brouillon ou un envoi
  sans la signature « Bandeau » (version HTML) ne part pas. Procédure : `docs/templates/communication/signature/README.md`.

## Suivi des prospects, des clients et de l'affiliation : Nexora Optim › QME (décision du 24/11/2026)

- **Source unique** : l'onglet **QME de Nexora Optim** (`/qme`), lu et écrit par le MCP Nexora : `get_qme`
  (`entity: "summary"` : relances dues, balle chez QME, prospects sérieux et tièdes), `list_qme` (filtres, pagination),
  `mutate_qme` (étape, relance, balle, prochaine action, échanges datés, clients, devis `QME-AAAA-NNN`, contrats,
  factures, créateurs et pilotage de la file d'affiliation). À lire avant toute relance, devis, réponse ou nouveau mail
  à un prospect ; à mettre à jour le jour même par la session qui traite un échange. Une relance = une tâche Nexora
  (`create_task`, `optim: {qme: {type, id}}`). Avant de conclure qu'un prospect attend une réponse, chercher
  `to:<adresse>` dans tous les fils Gmail.
- `docs/prospection/suivi-prospects.md`, `journal-refus.md` et le Sheet « QME · Affiliation · file d'envoi » sont des
  **archives** (état au 24/11/2026, migré dans Nexora) : ne plus les modifier.
- La **liste d'opposition du site** reste la référence des désinscriptions (`REGLES-PROSPECTION.md`) : une réponse
  « stop » ou hostile y est inscrite le jour même, ET le prospect ou créateur passe à l'étape `oppose` dans Nexora.
- Ventes, audience, essais et plannings restent dans leurs sources (Gumroad, site, Sheets) : Nexora les lit en direct
  (`get_qme_dashboard`), sans copie. Référence : `docs/QME.md` du dépôt nexora.
- **Un projet Nexora par prospect** (décision du 24/11/2026), dans le dossier « QM Engineering ». À sa création, il
  reçoit toujours une tâche **« État global du prospect »**, dont le statut est l'un des six statuts réservés aux
  projets prospects : Prospect, Discussion, Offre envoyée, Négociation, Refus, Signé. Ce statut suit chaque échange,
  en même temps que la fiche QME du prospect, et une **Note Bible** (voir plus bas). Procédure et identifiants :
  `docs/prospection/NEXORA-PROSPECTS.md`.
- **Mise à jour de Nexora après chaque action** (règle absolue, décision du 24/11/2026) : chaque traitement d'un
  prospect, d'un client ou d'un créateur en discussion (mail reçu ou envoyé, réponse, relance, appel, visio, concept,
  proposition, devis, contrat, facture, refus) est reporté **le jour même, avant de rendre la main**, dans tous les
  endroits concernés de Nexora Optim : fiche QME (échanges, étape, balle, prochaine action, relance), fiche client et
  devis, tâche « État global du prospect », Note Bible, tâches de relance ou de réunion du projet. Liste de contrôle :
  `docs/prospection/NEXORA-PROSPECTS.md` § 2. Une action non reportée dans Nexora est considérée comme non faite.
- **Note Bible par prospect** (décision du 24/11/2026) : chaque projet prospect a une tâche « Note Bible · <Prospect> »
  (type Notes, statut Valable) qui porte **en tête le lien de la page de concept**, puis la liste de tous les PDF émis
  (type, date, version, lien Drive). À chaque document émis : copie du PDF dans le dossier Drive du prospect
  (`04 - Prospects & clients`), ligne ajoutée à la Note Bible, lien reporté dans la fiche QME (`conceptUrl`,
  `conceptPdf`, `pdf` du devis). Modèle et rangement : `docs/prospection/NEXORA-PROSPECTS.md` § 3.

## Gumroad : référent unique (décision du 24/11/2026)

- **Toute demande ou action Gumroad** (création de fiche, publication, mise en vente sur le site, prix, description,
  dépublication, packs) est traitée par **l'agent Gumroad**, session `session_0183EW569cgV6TXMdunVEq3r`. Les autres
  sessions ne créent, ne publient et ne modifient rien sur Gumroad : elles renvoient Quentin vers l'agent Gumroad ou lui
  transmettent la demande (`send_message`). Fonctionnement et tâche quotidienne :
  `docs/templates/communication/gumroad-priorite.md` § « Qui gère Gumroad » ; écart prêt / Gumroad :
  `node outils/gumroad/ecart.mjs`.

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
  programmation LinkedIn 17:30 / Instagram 12:30 / YouTube Shorts 12:00 ; heures recalées le 18/11/2026 :
  `docs/templates/communication/HEURES.md`). TikTok repris le 18/11/2026 (abandon du 16/11 levé) : Instinct reprend chaque
  publication Instagram sur TikTok (@qme.qm.engineering), en vidéo seule sans légende (Quentin colle le texte) ; un carrousel y part en diaporama vidéo
  (`docs/videos/diaporama.mjs`, fichier Drive `IG-nn-<slug>-tiktok.mp4`), procédure `docs/templates/communication/tiktok/` ;
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
- **Référence vidéo (décision du 20/11/2026)** : les 7 Reels retravaillés (IG-156, IG-155, IG-131, IG-56, IG-149, IG-50, IG-46),
  dont Quentin préfère largement le dynamisme. Toute vidéo suit `docs/templates/communication/REGLES-CONTENU.md` § 3 bis :
  vrai problème chiffré avec tension, bascule, solution montrée ; accroche entière dès la première image.
- **Reels du soir** : skill `.claude/skills/reel-du-soir/` (motion design en musique à partir des démos), lundi, mercredi et
  vendredi, Instagram 21:00 + YouTube Short 20:00 ; tâche planifiée « Reel du soir ». Journal :
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
