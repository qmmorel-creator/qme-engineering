# Licences QME · clés, codes d'accès, acheteurs et versions

Sous-master `[Production] Licences` (`session_0183EW533FcUsTe1HcA8zwfT`), sous le [MASTER] Production. Créé le
27/11/2026. Dossier `docs/` : non publié par Netlify (404). **Aucune adresse e-mail, aucun identifiant, mot de passe ni
secret dans ce fichier** : les adresses des acheteurs restent dans Gumroad, celles des clients dans Nexora Optim › QME.

## 1. Inventaire du 27/11/2026

Source code : `netlify/lib/templates-acces.mjs` (`PRODUITS`, `FUSIONNES`, `PRODUITS_PRIVES`) et `netlify/lib/packs.mjs`
(`PACKS`). Source Gumroad : `list_products` (connecteur, lecture seule), 117 fiches.

| Catégorie | Nombre | Identifiant Gumroad | Fiche Gumroad |
|---|---|---|---|
| Templates vendus (`PRODUITS`) | 92 | 92/92 renseignés, aucun doublon | 92/92 trouvées, toutes publiées |
| Packs actifs (`PACKS`) | 18 | 18/18 | 18/18 trouvées, toutes publiées |
| Packs retirés (PVY, PAQ, PBD) | 3 | renseignés | dépubliées (cohérent) ; PCS retiré sans fiche |
| Fusionnés (`FUSIONNES` : PRS → CRM, CND → CAN, PRK → GMA) | 3 | renseignés | dépubliées ; une licence achetée ouvre le template d'accueil |
| Privé RVX (Révisions QME X Laurine) | 1 | variable Netlify `RVX_GUMROAD_ID` (hors code) | fiche `Bxld7Q6KTUy5ValRUfIvMA==`, publiée, seule fiche non référencée dans le code |

`node outils/gumroad/ecart.mjs` : 0 template ni pack prêt sans fiche. EVT réutilise l'ancienne fiche « Organisateur de
mariage » (licences MRG valables), comme prévu le 22/11.

**Non vérifiable par le connecteur** : l'option « Generate a unique license key » de chaque fiche (absente de
`get_product`). Indice indirect : les 2 ventes réelles (TCH, CRA) ont donné une clé utilisable. Contrôle visuel à faire
dans le tableau de bord Gumroad (voir § 6).

Remboursements : gérés automatiquement. La vérification de licence (`templates-acces.mjs`, appel
`licenses/verify` sans incrémenter le compteur) refuse une clé `refunded`, `chargebacked` ou `disputed` ; aucune
désactivation manuelle n'est nécessaire, mais elle est notée au registre (§ 2).

## 2. Registre des acheteurs Gumroad

Une ligne par vente (id de vente Gumroad, jamais l'adresse). Mis à jour à chaque contrôle (§ 5).

| Date | Id de vente | Produit | Acheteur | Montant | Statut | Remarque |
|---|---|---|---|---|---|---|
| 18/11/2026 | `P6HgJoXnguyjLjFLoTsyvA==` | CRA Compte rendu et plan d'actions | Quentin (test interne) | 0 € (code `QME-TEST-…`) | actif | achat de test |
| 20/11/2026 | `mlASpbmFumqxgkBZcl9M3A==` | TCH Gestionnaire de tâches | Floriane Jolliot | 20,82 $ | actif | — |

## 3. Codes d'accès hors Gumroad

Registre unique : `docs/templates/codes-gratuits.md` (inchangé). Au 27/11/2026 : 1 code actif, HBT pour Floriane
Jolliot (13/11), préfixe présent dans `PRODUITS`. Codes annoncés non émis : Odélia / Yuzu (à la réponse d'Eva, dossier
du Master Suivi influenceurs, `affiliation/odelia.md`) ; codes en lot TRS envisagés (`tresorerie/prospects.md`).

## 4. Clients sur mesure : accès et versions livrées

Source : fiche client Nexora (`prodUrl`, `miseEnService`, `echanges`). Au 27/11/2026, 8 fiches clients, **aucune
signée** (Antarès et Givry au devis, ARVA et Oh ! Délices Paysans en rendez-vous, Tignes Spirit, Conciergerie en
Provence et Royaumes & Légendes au concept, Charpennes Tonkin perdu) : rien à suivre.

| Client (id Nexora) | URL de production | Mise en service | Version livrée (commit `main`) | Accès remis (date, à qui, canal) | Statut |
|---|---|---|---|---|---|
| — | — | — | — | — | — |

Les identifiants eux-mêmes ne sont jamais écrits ici : seulement le fait qu'ils ont été remis, quand et par quel canal.

## 5. Procédures

**Délivrer un code offert** (validation de Quentin obligatoire, transmise par le master Production via le GOD)
1. Vérifier que le préfixe est dans `PRODUITS` (ou `PACKS`, `PRODUITS_PRIVES`).
2. `TEMPLATES_SECRET=<secret Netlify> npm run code -- <PRODUIT> 1` (le secret n'est jamais écrit dans un fichier ni un commit).
3. Ligne le jour même dans `codes-gratuits.md` (date, produit, code, Id = 8 caractères après le préfixe, destinataire, `actif`).
4. Remise par brouillon Gmail (signature « Bandeau », Floriane en Cc), envoyé par Quentin.

**Révoquer un code** (validation de Quentin) : ajouter l'Id à la variable Netlify `TEMPLATES_CODES_REVOQUES`
(séparée par des virgules), redéployer si nécessaire, statut `révoqué` + date dans `codes-gratuits.md`.

**Accès perdu (acheteur Gumroad)** : retrouver la vente (`list_sales`, filtre `email`) ; si elle est valide, renvoyer
le reçu depuis Gumroad ou rappeler la clé par brouillon ; sinon, demander la preuve d'achat. Jamais de code offert à la
place sans accord de Quentin.

**Remboursement** : automatique côté site (§ 1) ; ligne du § 2 passée à `remboursé` avec la date.

**Nouvelle fiche Gumroad** (créée par l'agent Gumroad) : vérifier que son identifiant est dans `PRODUITS` ou `PACKS`,
que l'option clé de licence est cochée, et qu'une clé de test ouvre le bon template ; écart → `send_message` à l'agent
Gumroad (`session_0183EW569cgV6TXMdunVEq3r`).

**Mise en service d'un client sur mesure** : à l'étape 6 de `README.md` § 3, ligne au § 4 (URL, date, commit déployé,
remise des accès) et fiche client Nexora (`prodUrl`, `miseEnService`, échange daté) le jour même. Chaque nouvelle
livraison (correctif, évolution) ajoute une ligne de version.

**Contrôle périodique** (à chaque sollicitation du master, au moins chaque lundi) : `list_products` contre le code
(script du § 1), `ecart.mjs`, `list_sales` depuis le dernier contrôle (§ 2), fiches clients `gagne` / `signe` (§ 4).

## 6. Décisions et points ouverts

1. Option « clé de licence » : décision de Quentin du 27/11/2026, on se fie à l'indice des 2 ventes ; à chaque
   nouvelle vente, contrôle visuel de la fiche concernée (clé reçue par l'acheteur et ouvrant le bon template).
2. `RVX_GUMROAD_ID` = `Bxld7Q6KTUy5ValRUfIvMA==` : confirmé par Quentin le 27/11/2026.
3. Écarts de nom (domaine de l'agent Gumroad, sans effet sur les licences) : fiche CRM nommée « CRM freelance » sur
   Gumroad contre « CRM et prospection » sur le site.

## 7. Annonces de version

| Date | Produit | Annonce | Destinataires externes | Suite |
|---|---|---|---|---|
| 28/11/2026 | PGS « Suivi culturel » (#357, en ligne le 28/11) | textes validés par Quentin (`annonce-suivi-culturel.md`) | **0** | aucun envoi, aucun développement de `/api/compte/annonce` |

Recomptage du 28/11/2026, après la mise en ligne de #357 : acheteurs PGS 0 et acheteurs PET 0 (Gumroad `list_sales` et
achats du site) ; testeurs du template lecture inscrits aux nouveautés 0 (un seul essai lecture, sans la case cochée) ;
registre des préférences : 1 ligne PGS « abonné », celle de Floriane Jolliot (adresse personnelle, exclue par
CLAUDE.md ; personne interne). Opposition : sans objet (aucune adresse à vérifier). À recompter à la prochaine vente
PGS ou PET, ou à la prochaine inscription d'un testeur aux nouveautés.

Recomptage du 28/11/2026 pour **Habitudes (HBT)**, thème « Bauhaus adouci » (#326, en ligne le 27/11, changement
visuel seul : formes, couleurs, onglets ; fonctions et données inchangées) : **0 destinataire externe**, aucun mail
n'a été envoyé. Acheteurs HBT et packs qui le contiennent (PPR, PET, PFM ; PBD retiré) : 0 (Gumroad `list_sales`,
2 ventes au total depuis l'ouverture, aucune de ces fiches ; achats du site : 1, TCH). Testeurs : 0 essai Habitudes, 0
inscrit aux nouveautés ; le registre des préférences n'a aucune ligne HBT. Codes actifs : 1 (`QK5AC4M8`, Floriane
Jolliot, interne). Opposition : sans objet.

## 8. Information des utilisateurs après une mise à jour (procédure proposée le 28/11/2026, à valider)

**Déclencheur** : toute fusion dans `main` qui change ce qu'un utilisateur voit ou fait dans un template (fonction,
présentation, données, nom). Pas pour une correction invisible (texte de page catalogue, test, documentation).

**Déclaration** : la PR qui change le template ajoute une ligne au registre des mises à jour (fichier versionné, par
exemple `netlify/lib/mises-a-jour.mjs` : `{ produit, date, titre, resume }`, résumé en une phrase pour l'utilisateur).
La mise à jour est ainsi déclarée par la fusion elle-même, sans appel manuel.

**Destinataires**, par mise à jour :
- acheteurs du produit, packs inclus (comptes du site dont une clé `achat` ouvre ce produit, via `produitsAccessibles`) ;
- titulaires d'un code offert actif pour ce produit (`codes-gratuits.md`) : le site ne connaît pas leur adresse ; s'ils
  sont externes, brouillon individuel préparé par Licences (règles des mails personnalisés : signature, Floriane en
  Cc), sinon rien ;
- testeurs seulement s'ils ont coché « recevoir les nouveautés » pour ce template (`contact/…`) ;
- exclus : liste d'opposition (adresse et domaine), comptes `sansAnnonces`, adresses internes (Quentin, Floriane),
  adresse déjà servie pour cette mise à jour.

**Regroupement** : un seul envoi par semaine (lundi), un mail par destinataire qui liste tous ses templates mis à jour
depuis le dernier envoi. Pendant la vague « Bauhaus adouci » (environ 95 templates sur 19 jours), un acheteur reçoit
donc au plus 3 mails, jamais 19.

**Canal** : OVH via le site, version texte et HTML, signature « Bandeau », mention « Ne plus recevoir les
informations » avec lien personnel, sans Floriane. **Copie cachée** : CLAUDE.md (« Copie cachée des e-mails
automatiques », 24/11/2026) classe les annonces en nombre parmi les exceptions **sans** copie cachée. Proposition :
pas de copie cachée par destinataire, mais un récapitulatif hebdomadaire à Quentin (nombre d'envois par template, une
copie du mail type). À trancher par Quentin.

**Textes** : deux modèles (acheteurs et codes / testeurs inscrits), validés une fois par Quentin, puis envoi
automatique : brouillon dans `docs/production/annonce-mises-a-jour.md`. Le résumé de chaque mise à jour, écrit dans la
PR, est la seule partie variable ; une mise à jour qui change les données ou le prix repasse par Quentin.

**Outil** : `POST /api/compte/annonce` existe déjà (`netlify/lib/comptes.mjs` : simulation, test, lots, anti-doublon,
opposition), mais il est figé sur l'annonce du 22/11 et écrit à tous. À développer (PR non fusionnée, estimation :
une demi-journée à une journée, tests compris) :
1. le registre des mises à jour (ci-dessus) ;
2. le ciblage par produit (acheteurs, packs inclus, testeurs inscrits) et le regroupement par destinataire ;
3. le contenu à partir des deux modèles validés ;
4. une fonction planifiée Netlify hebdomadaire (comme `essais-quotidien.mjs`), avec marque `maj/<produit>/<date>/<empreinte>` ;
5. une route administrateur de simulation (nombres par template, sans adresses) et d'envoi de test.

Tant que l'outil n'existe pas, Licences recompte à chaque mise en production signalée par le master et consigne le
résultat au § 7.

**28/11/2026, 13 h 11 · consigne de Quentin via le GOD** (« envoie les mails d'info template aux acheteurs et testeurs de
habitudes ») : version #326 vérifiée en production (`app.css` et `app.js` servis identiques à `main`). Nouveau
comptage : acheteurs Habitudes (Gumroad, packs inclus, achats du site) 0 ; testeurs Habitudes 0 (tous statuts ;
essais ouverts depuis le 18/11, couverts par la fenêtre de 90 jours) ; registre : aucune ligne HBT. **0 envoi, 0
échec.** À refaire à la prochaine vente ou au prochain essai Habitudes.
