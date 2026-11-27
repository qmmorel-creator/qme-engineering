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
