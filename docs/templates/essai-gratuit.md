# Essai gratuit des templates « vie personnelle »

Décision de Quentin du 18/11/2026 : **14 jours d'essai gratuit, sans carte bancaire**, pour chaque template vie
personnelle en vente ; ensuite **30 jours en lecture seule**, puis effacement. À l'achat, les données de l'essai
sont reprises dans l'espace acheté. E-mails envoyés **depuis la boîte de Quentin**.

## Parcours du client

1. Page catalogue du template → bouton **« Essai gratuit 14 jours »** (premier bouton) → `/essai/?t=<slug>`.
2. Formulaire : template, prénom (facultatif), e-mail, case d'accord pour les e-mails de l'essai.
3. `POST /api/essai` → code d'essai affiché (et envoyé par e-mail) → « Ouvrir mon template »
   (`/templates/<slug>/?essai=<code>`) : l'application s'ouvre avec le code.
4. Pendant 14 jours : bandeau bleu « Essai gratuit · encore N jours », boutons **Acheter** (Gumroad) et
   **J'ai acheté**. Toutes les fonctions, synchronisation entre appareils (le code s'utilise sur un autre appareil).
5. Fin : bandeau noir « Essai terminé · lecture seule jusqu'au … ». Consultation, onglets, export, impression
   permis ; toute modification ouvre la fenêtre « Lecture seule » (achat proposé). Le serveur refuse aussi toute
   écriture (403).
6. Achat sur Gumroad → clé saisie dans « J'ai acheté » (ou sur l'écran de connexion du template) : données reprises,
   bandeau retiré. Si l'achat est fait avec la même adresse e-mail que l'essai, la reprise se fait aussi sans le code
   d'essai (autre appareil). Achat d'un pack contenant le template : reprise dans le template du pack.
7. Sans achat : rien n'est prélevé ; effacement automatique 30 jours après la fin.

## E-mails (boîte de Quentin)

| Quand | Objet | Contenu |
|---|---|---|
| Au lancement | Merci d'essayer le <template> | Remerciement, code, lien d'ouverture, date de fin, achat et reprise, « répondez-moi » |
| Fin − 3 jours | Plus que 3 jours d'essai : <template> | Rappel, prix, reprise des données, demande de retour |
| Lendemain de la fin | Votre essai du <template> est terminé | Lecture seule jusqu'à la date d'effacement, achat, « pourquoi pas ? » |
| Effacement − 7 jours | Vos données d'essai seront effacées le … | Dernier e-mail : acheter ou exporter |
| Nouvelle demande, même adresse | Votre code d'essai : <template> | Code renvoyé (jamais affiché à l'écran) |

Aucun e-mail après un achat ou un clic sur le lien d'arrêt (bas de chaque e-mail). Un seul e-mail par jour et par
essai. Textes : `contenuMail` dans `netlify/lib/essais.mjs` (vouvoiement, Quentin à la première personne).

### Configuration de l'envoi (une fois, par Quentin)

Les e-mails partent en SMTP authentifié depuis le Gmail de Quentin, avec l'adresse « Envoyer en tant que »
`quentin.morel@qm-engineering.fr` (déjà utilisée pour la prospection). Ils apparaissent dans « Messages envoyés » et
les réponses arrivent dans la boîte.

1. Compte Google → Sécurité → **Validation en deux étapes** activée (prérequis).
2. Compte Google → Sécurité → **Mots de passe des applications** → créer « QME essai » → copier les 16 caractères.
3. Netlify → site → Site configuration → Environment variables, ajouter (portée « Functions ») :
   - `ESSAI_SMTP_UTILISATEUR` : l'adresse Gmail de la boîte ;
   - `ESSAI_SMTP_MOT_DE_PASSE` : le mot de passe d'application ;
   - `ESSAI_EXPEDITEUR` : `Quentin Morel <quentin.morel@qm-engineering.fr>`.
4. Redéployer (ou attendre la prochaine publication) : les variables sont lues au démarrage des fonctions.

Sans ces variables, l'essai fonctionne mais **aucun e-mail ne part** (le code reste affiché à l'écran). Limite Gmail :
environ 500 envois par jour, large pour ce volume.

## Technique

- **Code d'essai** `PRE-AAAA-AAAA-SSSS-SSSS` (`genererCodeEssai`, `netlify/lib/templates-acces.mjs`) : les 3 premiers
  caractères de l'identifiant portent le jour de début (heure de Paris), la signature HMAC est calculée dans le
  contexte `essai` (distincte des codes achetés). La date ne peut pas être modifiée : **la durée maximale est garantie
  sans rien stocker**. Révocable comme un code (`TEMPLATES_CODES_REVOQUES`).
- **Durées** : `ESSAI = { jours: 14, conservation: 30 }` (même fichier). Actif jusqu'au jour `fin` inclus, lecture
  seule jusqu'à `effacement` inclus.
- **Registre** (Netlify Blobs `templates-essais`, Francfort) : `essai/<id>` (e-mail, prénom, dates, e-mails envoyés,
  arrêt, achat), `email/<empreinte>/<produit>` (un essai par adresse et par template), `ip/<empreinte>/<jour>`
  (5 essais par jour et par connexion au plus). Données de l'essai : store `templates-donnees`, clé `essai/<produit>/…`.
- **API** : `POST /api/essai`, `GET /api/essai/stop` (`netlify/functions/essai.mjs`, logique `netlify/lib/essais.mjs`) ;
  l'API des templates (`/api/templates/*`) accepte le code d'essai et renvoie `essai` (jours restants, fin, prix,
  lien d'achat) ; `PUT` refusé après la fin ; report à la connexion par clé de licence (`reporterEssai`).
- **Tâche quotidienne** `netlify/functions/essais-quotidien.mjs` (8:10 UTC) : rappels, effacement.
- **Templates ouverts** : `PRODUITS_ESSAI` = `pour: 'perso'` dans `outils/packs/donnees.mjs`, identifiant Gumroad
  dans `PRODUITS`, prix > 0 (29 au 18/11/2026 ; Secret Santa, gratuit, exclu).
- **Application** : module commun `assets/essai.js`, chargé avant `app.js` (`data-produit`, `data-slug`). Il ne
  modifie pas le code des templates : il lit les réponses de l'API, affiche le bandeau, bloque les modifications
  (actions permises : liste `PERMIS`), joint le code d'essai à la connexion par clé.
- **Site** : `node outils/essai/generer.mjs` génère `/essai/` et ajoute l'essai aux pages catalogue (bouton, prix,
  question « Y a-t-il un essai gratuit ? », rappel) ; puis `node outils/seo/donnees-structurees.mjs` et
  `node outils/sitemap/generer.mjs`.

## Vérifier

- `npm test` (`outils/templates/essai.test.mjs` : durée, lecture seule, effacement, report, pack, e-mails, IP, arrêt).
- Navigateur, tous les templates : `QME_LICENCES_TEST=1 PORT=8899 node outils/templates/serveur-local.mjs`, puis
  `node outils/essai/e2e.cjs tous` (ou un slug, avec un dossier de captures). Le serveur local affiche les e-mails dans
  la console et simule le temps (`/__dev/decalage?jours=15`) ; clés de test `0E55A1NN-00000000-00000000-00000000`
  (NN = rang hexadécimal du template dans `PRODUITS`), refusées hors de ce serveur.
- Après publication : `/essai/` en 200, un essai réel avec une adresse de Quentin (e-mail reçu, depuis la bonne
  adresse), `POST /api/templates/connexion` avec le code → `essai.joursRestants = 14`.

## Mesure (GoatCounter)

Clics `essai-<slug>` (bouton de la page catalogue), `essai-lancer`, événements `essai-cree-<slug>`, achats depuis
l'application `essai-achat-<slug>` et `essai-achat-ls-<slug>` (fenêtre « Lecture seule »).
