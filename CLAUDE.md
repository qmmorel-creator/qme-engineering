# Consignes pour les assistants

Site de QME (Quentin Morel Engineering) et templates vendus sur Gumroad. Lire `README.md`.

- **Aucune fusion dans `main` ni publication sans feu vert explicite de Quentin** (chaque fusion déclenche
  un déploiement Netlify facturé). Travail sur une branche, PR vers `main`.
- Netlify publie tout le dépôt : rien de privé hors de `docs/`, `.claude/` et `CLAUDE.md` (bloqués en 404
  dans `netlify.toml`).

## Pilotage des sessions : GOD, masters, sous-sessions (décision du 27/11/2026)

- **Hiérarchie à trois niveaux** : la session **GOD** (`session_0183EW54bFyxAQcskkhnKJvb`) pilote les sessions
  **MASTER**, qui pilotent leurs sous-sessions (`[Tunnel]`, `[Affiliation]`, campagnes ciblées…). Le GOD arbitre les
  périmètres, transmet les consignes de Quentin et tient le registre ; il ne fait pas le travail d'un master.
- **Registre unique** : `docs/pilotage/REGISTRE-SESSIONS.md` (masters, identifiants, tâches planifiées, sous-sessions).
  Toute session qui crée un master, rattache une sous-session ou crée une tâche planifiée récurrente le signale au GOD
  (`send_message`), qui met le registre à jour. Aucune session sans master ni tâche planifiée orpheline.
- **Supprimer une tâche planifiée supprime les sessions qu'elle a lancées** : on désactive (`enabled: false`), on ne
  supprime que si sa session n'existe plus.

## Réseaux sociaux : une seule publication par plateforme et par jour (décision du 24/11/2026)

- **Règle très importante** : Instagram, TikTok, YouTube, LinkedIn et X ont chacun **au plus une publication par jour**,
  tous formats confondus (seule exception : les mini-stories, en plus, voir section Mini-stories) (post, carrousel, Reel, vidéo, Short). Toute session ou tâche planifiée qui programme choisit
  un jour **sans aucune ligne** sur la plateforme ; jamais deux lignes à la même date. Contenus audacieux en priorité.
  Règle : `docs/templates/communication/REGLES-CONTENU.md` § 1 ; calendrier refait le 24/11/2026 :
  `docs/templates/communication/CALENDRIER-UNE-PAR-JOUR.md`.
- **Agent de contenu unique** (décision du 24/11/2026) : une seule tâche planifiée, « Agent contenu réseaux sociaux QME
  (quotidien) », 10:07, produit et programme tout le contenu automatique (Instagram, TikTok, YouTube, LinkedIn, X) avec
  les skills ci-dessous. Les anciennes tâches (Publications du jour, Vidéo démo du jour, Reel du soir, Campagne X,
  diaporamas J+14) sont supprimées : ne pas en recréer. Détail : `docs/templates/communication/ROUTINES-RESEAUX.md`.

## Signature graphique dans tous les mails (décision du 22/11/2026)

- **Tout e-mail rédigé pour Quentin** (brouillon Gmail ou envoi) porte sa signature graphique « Bandeau » dans la version
  HTML, comme les mails automatiques du site : `node docs/templates/communication/signature/brouillon-gmail.mjs --json`
  (images en pièces jointes intégrées, l'outil Gmail supprimant les images distantes). Procédure :
  `docs/templates/communication/signature/README.md`. Elle remplace la signature texte, qui reste dans la version texte brut.

## Floriane Jolliot en copie de tous les mails de Quentin (décision du 27/11/2026)

- **Tout e-mail personnalisé rédigé ou envoyé pour Quentin** (brouillon Gmail, réponse à un prospect, client,
  influenceur ou partenaire, relance individuelle) met `floriane.jolliot@qm-engineering.fr` en **copie (Cc), jamais
  en copie cachée**. **Jamais dans les mails de masse** (campagnes de prospection, file OVH `/api/prospection`,
  premiers mails et relances de campagne, vagues d'affiliation, mails automatiques du site). Son adresse personnelle
  (Gmail) n'est plus utilisée nulle part.

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
  à un prospect ; à mettre à jour le jour même par la session qui traite un échange. **Aucune tâche Nexora pour ce que
  Claude fait automatiquement** (décision du 25/11/2026 : relances, envois, suivis de campagne) : une relance se suit par
  la date `relance` de la fiche QME (filtre `dueOnly`), jamais par `create_task`. Avant de conclure qu'un prospect attend une réponse, chercher
  `to:<adresse>` dans tous les fils Gmail.
- **Jamais de prospect sans adresse e-mail** (décision de Quentin du 24/11/2026) : une entreprise sans adresse e-mail publique (formulaire, téléphone seul) n'est pas créée dans Nexora Optim › QME ; l'étape `pas-de-mail` n'est plus utilisée, et les 410 fiches qui la portaient ont été supprimées le 24/11/2026.
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
  devis, tâche « État global du prospect », Note Bible, tâches de réunion du projet (aucune tâche de relance). Liste de contrôle :
  `docs/prospection/NEXORA-PROSPECTS.md` § 2. Une action non reportée dans Nexora est considérée comme non faite.
- **Note Bible par prospect** (décision du 24/11/2026) : chaque projet prospect a une tâche « Note Bible · <Prospect> »
  (type Notes, statut Valable) qui porte **en tête le lien de la page de concept**, puis la liste de tous les PDF émis
  (type, date, version, lien Drive). À chaque document émis : copie du PDF dans le dossier Drive du prospect
  (`04 - Prospects & clients`), ligne ajoutée à la Note Bible, lien reporté dans la fiche QME (`conceptUrl`,
  `conceptPdf`, `pdf` du devis). Modèle et rangement : `docs/prospection/NEXORA-PROSPECTS.md` § 3.

## Master Concept métier : sur-mesure pour des métiers non couverts (décision du 27/11/2026)

- **Remplace la « Campagne quotidienne de prospection par concept »** du 24/11/2026. Session
  `session_0183EW54tGg2Bhkayay2aBFc` (**[MASTER] Concept métier**), tâche planifiée de 13:47 (lundi–vendredi).
- **Mission** : chaque semaine, trouver **un métier** au besoin très particulier, **non couvert par les templates QME**
  (modèle : `concepts/horlogerie/`), et le prospecter pour vendre du **sur-mesure à partir de 1 500 € HT** (cible
  1 500–2 000 €), jamais un template. Critères : besoin spécifique, outil métier absent ou cher, entreprises de 3 à
  50 salariés, adresses e-mail publiques.
- **Format** : plaquette PDF de 4 pages propre au métier + une page simple `concepts/<métier>/` qui l'affiche. **Pas de
  démo interactive au départ** : elle n'est faite qu'à la réponse intéressée d'un prospect (skill `concept-prospect`).
  Exception voulue par Quentin à la section « Concepts : personnalisés au secteur » ci-dessous, pour ces seuls concepts
  métier.
- **Rythme** : lundi, recherche du métier, plaquette, page et mail type ; puis **40 à 60 entreprises vérifiées** envoyées
  sur la semaine par la file OVH du site (une campagne par métier, mécanique du skill `campagne-ciblee-pack`), relance
  unique à J+7. Mardi–vendredi : suivi des envois, des réponses et des relances.
- **Validation** : le métier choisi, la plaquette et le mail type sont validés par Quentin (via le GOD) avant le premier
  envoi de chaque métier. Réponses des intéressés toujours en brouillon ; un prospect intéressé passe au Master Tunnel de
  vente. Opposition, signature « Bandeau », Nexora et registre des concepts : règles habituelles.
- **Fusion** : feu vert permanent pour **une PR de campagne par jour au plus** (page concept, données, `docs/`), si les
  vérifications Netlify sont vertes. Toute autre fusion reste soumise à l'accord de Quentin. Journal :
  `docs/prospection/campagnes-concept.md`.

## Campagnes ciblées par pack (décision du 25/11/2026)

- **Skill `.claude/skills/campagne-ciblee-pack/`** : un template ou un pack prêt présenté à tout un secteur (page concept
  avec captures réelles de la démo, mail personnalisé « template tout prêt, sur mesure possible »), sourcing sans
  limite d'adresses vérifiées. Première vague : auto-écoles (`docs/prospection/campagne-auto-ecole.md`).
- **Envoi par OVH via le site** : file `/api/prospection` et tâche `prospection-envoi` (un mail toutes les 2 minutes,
  lundi–samedi, 8 h–18 h à Paris, sans plafond global depuis le 25/11/2026, soit 300 par jour au plus ; **campagnes actives en parallèle**, à tour
  de rôle mail par mail, chacune s'étalant sur plusieurs jours si besoin), copie cachée vers la boîte pro de Quentin, signature et mention
  d'opposition ajoutées par le serveur, opposition relue avant chaque envoi.
- **Page et brouillon validés par Quentin avant tout envoi** ; projets Nexora seulement pour les retours intéressés,
  après son accord. Prospects tenus à jour dans Nexora Optim › QME (`vague: "cible-<sujet>"`).

## Concepts : personnalisés au secteur, jamais un SaaS générique (décision du 27/11/2026)

- **Tout concept** (skill `concept-prospect`, page `concepts/<slug>/`, démo, PDF ; hors concepts métier du master Concept
  métier, voir plus haut, qui commencent par une plaquette PDF sans démo) est
  conçu pour le métier du prospect, sur le modèle de Kelly (`concepts/conciergerie-en-provence/`) et d'ARVA
  (`concepts/arva/`) : démonstration interactive publiée dans `concepts/<slug>/demo/`, identité propre (nom de l'outil,
  palette, typographies), grand chiffre métier, entonnoir de leur processus, visuels du terrain, vocabulaire et objets du
  secteur, vue téléphone, page de concept écrite sur mesure. Interdits : la coquille SaaS neutre des gabarits du skill et
  la page brute de `concept_page.py`. Cette règle prime sur les gabarits du skill. Détail et contrôle avant PR :
  `docs/prospection/CONCEPTS-SUR-MESURE.md`.
- **Skill de référence : `.claude/skills/concept-prospect/` du dépôt** (règle intégrée, versionnée ici). Il prime sur le
  skill claude.ai `anthropic-skills:concept-prospect`, resté générique : toujours appeler `concept-prospect` (version du dépôt).

## Concepts : registre dans Nexora Optim › QME › Concepts (décision du 24/11/2026)

- **Tout agent qui crée ou modifie un concept** (page `concepts/<slug>/`, PDF, démo de concept, généré à la main ou par
  `outils/concepts/registres.mjs`) **l'enregistre ou le met à jour le jour même dans Nexora** : MCP Nexora
  `mutate_qme`, `entity: "concept"`, `action: "upsert_many"`, éléments donnés par
  `node outils/concepts/registre-nexora.mjs <slug…>` (identifiant stable `cpt-<slug>` : rejouer ne crée pas de doublon).
  Puis compléter dans le même appel ou juste après : `statut` (`brouillon`, `en-ligne`, `envoye`, `discussion`, `retenu`,
  `abandonne`), `segment`, `vague`, `dateEnvoi`, et `prospectId` ou `clientId` (lus par `list_qme`), et mettre le
  `conceptUrl` de la fiche prospect. Un envoi, une réponse ou un abandon met aussi le statut du concept à jour.
  Un concept absent de Nexora est un oubli à corriger : vérifier avec `list_qme` (`domain: "concepts"`).

## Gumroad : référent unique (décision du 24/11/2026)

- **Toute demande ou action Gumroad** (création de fiche, publication, mise en vente sur le site, prix, description,
  dépublication, packs) est traitée par **l'agent Gumroad**, session `session_0183EW569cgV6TXMdunVEq3r`. Les autres
  sessions ne créent, ne publient et ne modifient rien sur Gumroad : elles renvoient Quentin vers l'agent Gumroad ou lui
  transmettent la demande (`send_message`). Fonctionnement et tâche quotidienne :
  `docs/templates/communication/gumroad-priorite.md` § « Qui gère Gumroad » ; écart prêt / Gumroad :
  `node outils/gumroad/ecart.mjs`.

## PDF émis : rangement Google Drive et note Bible (décision du 24/11/2026)

- **Tout PDF émis à un prospect ou à un client** (concept, proposition, devis, plaquette, références, contrat,
  facture…), en pièce jointe ou par un lien, est rangé **le jour même** dans Google Drive :
  `13 - Entreprise QME / 04 - Prospects & clients / <Prénom Nom> – <Entreprise> / <type>`, avec six sous-dossiers
  fixes (`01 - Concept`, `02 - Proposition`, `03 - Devis`, `04 - Plaquette`, `05 - Références`,
  `06 - Contrat et factures`, plus `07 - Autres documents` si besoin) et des fichiers nommés `AAAA-MM-JJ - <Type> - <Entreprise> - <version>.pdf`, dans la
  version réellement émise (retrouvée dans git).
- **Note Bible** : chaque projet Nexora de prospect a une note « Note Bible · <Prénom> (<Entreprise>) » (type Notes),
  avec en tête l'URL de la page concept, puis le lien du dossier Drive et un lien par PDF, le type en tête du nom du
  lien (`[Concept] …`, `[Devis] …`). Elle est complétée à chaque nouveau PDF. Procédure, identifiants et prospects déjà
  rangés : `docs/prospection/RANGEMENT-DRIVE.md`.
- **Master Tunnel de vente** (décision du 24/11/2026) : de la première réponse intéressée à la signature, tout prospect
  est suivi selon `docs/prospection/PROMPT-MASTER-TUNNEL-VENTE.md` (concepts, réunions et comptes rendus, devis et
  calculs, contrats, factures), chaque interaction reportée le jour même dans Nexora Optim et Google Drive. Il prend
  le relais de Master Prospection (`docs/prospection/PROMPT-AGENT-PROSPECTION.md`).
- **Une conversation dédiée par client potentiel** (décision du 25/11/2026) : chaque prospect du tunnel de vente est
  délégué **systématiquement** à une session enfant de Master Tunnel de vente (`create_session`, titre
  `[Tunnel] <Prénom Nom> · <Entreprise>`, tags `tunnel` et `tunnel:<slug>`), qui fait tout le travail sur ce prospect et
  rend compte au Master ; le Master lui transmet interactions et relances. Registre :
  `docs/prospection/CONVERSATIONS-TUNNEL.md` ; détail : `PROMPT-MASTER-TUNNEL-VENTE.md` § 1 bis. Hors affiliation.

## Templates

- **Codes gratuits** : tout code d'accès offert (`npm run code -- <PRODUIT> 1`) est inscrit dans
  `docs/templates/codes-gratuits.md` (code, id de révocation, destinataire, statut).

- **Idées** : `docs/templates/IDEES.md` est la liste vivante. Toute idée de template donnée par Quentin y
  est ajoutée tout de suite (ligne du tableau + fiche si elle est détaillée), et le statut suit le
  développement (`idée`, `fiche`, `en cours`, `prêt`, `en vente`).
- **Développement d'un template** : appliquer le skill `.claude/skills/nouveau-template/`, à chaque fois.
- Référence d'architecture : `templates/revision/` (planning de révision).

## Affiliation

- **Référent unique : la session « [MASTER] Suivi Influenceurs »** (`session_0183EW53pHmtjN8ttBAEgiRL`, décision de
  Quentin du 24/11/2026). Tout ce qui concerne les influenceurs, créateurs et agences d'influenceurs pour l'affiliation
  (vagues 1 et 2, réponses, brouillons, relances, commissions, démos personnalisées, fiches créateurs de Nexora Optim ›
  QME › Affiliation, y compris Laurine / Optimind et Odélia / Yuzu) est traité par cette session. Les autres sessions
  n'y écrivent, n'y envoient et n'y modifient rien : elles renvoient Quentin vers elle ou lui transmettent l'élément
  (`send_message`), sans rien transférer ni supprimer d'autre sans l'accord de Quentin. Routine :
  `docs/templates/communication/affiliation-routine-nexora.md`.
- **Retour d'un influenceur intéressé** : skill `.claude/skills/retour-affiliation/` (analyse de la niche, démo
  personnalisée `/demo/<prénom>`, vidéo privée, brouillon en deux volets : produits à recommander contre commission,
  puis sur-mesure pour lui). Aucun taux de commission dans les mails : le demander à Quentin à chaque fois. Rien
  n'est fusionné ni envoyé sans son feu vert. Fiches : `docs/templates/communication/affiliation/`.
- **Une sous-conversation par retour d'influenceur** (décision du 25/11/2026) : dès que Quentin demande de traiter le
  retour d'un influenceur précis, la session master crée **systématiquement** une session enfant liée (`create_session`,
  titre `[Affiliation] <Prénom Nom> · <compte>`, tags `affiliation` et `affiliation:<prénom-nom>`) qui tient ce dossier
  jusqu'au bout et rend compte à la master. Identifiant noté dans la fiche du créateur. Détail : skill
  `retour-affiliation`, § « Sous-conversation de suivi ».
- **QME - Plaquette partenariat réseaux sociaux** (référence du 25/11/2026) : A4 Grillon, commission de 25 % par vente
  Gumroad, outil sur mesure offert. Page : `qm-engineering.fr/partenariat/` ; Drive : `13 - Entreprise QME / 03 - Marque QME & site` ; source et PDF :
  `docs/templates/communication/affiliation/plaquette/`. Jointe à un mail seulement avec l'accord de Quentin.

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
  vendredi à l'origine, Instagram 21:00 + YouTube Short 20:00 ; lancé par l'agent de contenu unique. Journal :
  `docs/templates/communication/instagram/production/journal-reels.md`.
- **Publications classiques** (post, carrousel, grand chiffre…) : skill `.claude/skills/publication-classique/`,
  lancé par l'agent de contenu unique ; il ne produit que si la réserve passe sous 7 jours. Journal :
  `docs/templates/communication/journal-publications.md`.

## Mini-stories QME (décision du 27/11/2026)

- **Agent master des mini-stories** (décision de Quentin du 27/11/2026) : la session `session_0183EW55iLAYXDKQ2SE6AK5p`
  pilote tout le volet mini-stories (liste des sujets, production, réserve Drive, accessoires de Grillon, audit et
  stratégie). Les autres sessions lui transmettent les demandes (`send_message`) ou y renvoient Quentin. Cible : Instagram
  et TikTok, public jeune, volet personnel ; charte de Grillon.
- **Skill `.claude/skills/ministories/`** : micro-histoires publicitaires de 15 à 22 s (format v2) avec la mascotte **Grillon**
  (anciennement Carreau, renommée par Quentin le 27/11/2026), du script au MP4 contrôlé. Pilote : `docs/ministories/episodes/
  2026-11-27-le-salaire-a-disparu/`. Voix : connecteur ElevenLabs, voix « Caroline - Warm, Sweet and Soft » ; à défaut, voix provisoire edge-tts + texte
  `_elevenlabs.txt` dans le Drive, supprimés avec le MP4 provisoire dès que la version Caroline est déposée.
- **Tâche planifiée « Mini-story QME du jour »** (8:40, Paris) : complète la réserve de 7 vidéos, sujets pris dans la liste, templates ou packs de la vie
  personnelle, sujets variés (journal `docs/ministories/journal.md`). Elle produit (MP4, voix Caroline,
  dépôt Drive « QME - Vidéos Ministories ») et programme les 5 créneaux hebdomadaires des mini-stories (voir
  « Publication » ci-dessous), dans la règle d'une publication par plateforme et par jour.
- **Publication** (décision de Quentin du 27/11/2026) : **5 mini-stories par semaine** sur Instagram (TikTok suit),
  choisies et programmées par l'agent master dans le planning Instagram (Sheet `1R9l_AHY5fQwGvuZE-ge6F3ghvzx8OvQarkzxBf1mhf8`),
  thème « Mini-story », à 20:15 (passage d'Instinct), **en plus** de la publication du jour : elles ne comptent pas dans la règle d'une
  publication par jour et ne déplacent aucune ligne (décision du 27/11/2026). Version TikTok : carton final ramené à 1,5 s (Instagram : 4 s). L'agent de contenu
  ne remplace jamais une ligne « Mini-story ».
- **Rangement après publication** (décision du 27/11/2026) : dès qu'une mini-story est publiée (Instagram et TikTok),
  **Instinct** déplace sa vidéo et sa version TikTok dans le sous-dossier Drive « Publiées »
  (`1SQ-ivu-pPCfd8Od6FD6vwq-tFkQb-DbP`) de « QME - Vidéos Ministories » (consigne `instagram/PROMPT-INSTINCT-v8.md`) ;
  la tâche quotidienne de 8:40 rattrape ce qui n'a pas été rangé. Seules les vidéos à la racine du dossier comptent dans
  la réserve de 7.
- **Format v2 obligatoire** (validé par Quentin le 27/11/2026) : 15 à 22 s, accroche écrite à l'écran dès la 1re image,
  **aucune pub au milieu** (jamais « Avec <produit>, de QME » ni liste de fonctions : le produit arrive en chute, en une
  réplique de 8 mots au plus), fin qui boucle sur le début, 30 à 45 mots. Détail : skill `ministories`,
  `references/ecriture.md` § Format v2. Référence : épisode `2026-11-27-03-carton-47-v2`.
- **Avance** : toujours **au moins 7 jours** de mini-stories programmées dans le planning Instagram (jours ouvrés), et
  7 vidéos prêtes non programmées dans le Drive ; la tâche de 8:40 le vérifie chaque matin et comble tout manque.
- **Liste des sujets** (décision du 27/11/2026) : Quentin valide seulement les pitchs dans `docs/ministories/sujets.md`
  (rang = ordre de production, sans validation du scénario) ; **toujours 7 vidéos d'avance** dans le Drive « QME - Vidéos
  Ministories ». Branche de production : `claude/mini-stories-qme-caro-b07mx2`.

## Test des nouveaux formats (décision du 24/11/2026)

- Quentin veut sortir du contenu toujours identique : 9 formats testés (pire tableur, calcul utile sans produit, test
  `/diagnostic/`, conversation de couple, quiz, série numérotée, défi chronométré, actualité chiffrée, satisfaisant),
  **sans visage ni voix de Quentin**, tout animé par Claude. Skill `.claude/skills/formats-test/`, calendrier et
  mesure : `docs/templates/communication/formats-test/README.md`. Thème « Test formats » dans le planning Instagram.

## Campagne X (anglais, sur mesure)

- **Publication quotidienne sur X** (décision du 18/11/2026) : skill `.claude/skills/campagne-x/`, en anglais uniquement, volet
  sur mesure uniquement, une publication par jour (post, image ou vidéo en rotation, accroches et thèmes variés), produite une semaine
  d'avance par l'agent de contenu unique, publiée à 10:00 heure de Californie (19:00 à Paris), publié par Instinct (Sheet « Planning
  publications X », routine `PROMPT-INSTINCT-X.md`). Dossier :
  `docs/templates/communication/x/` (journal `journal-x.md`, bannière du profil `banniere.html`). Lien de toutes les
  publications : `qm-engineering.fr/x` → `/en/english-version/`, générée par `node outils/x/generer.mjs` (bouton
  « I'd like it in English » : modules `en-<slug>` du compteur `/api/interets`).
