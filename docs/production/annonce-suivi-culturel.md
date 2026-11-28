# Annonce « Suivi culturel » (ex-Suivi de lecture, PGS) · préparation

Demande de Quentin du 28/11/2026, transmise par le [MASTER] Production. Préparée par `[Production] Licences`.
**Aucun envoi** avant (i) la mise en ligne de la PR #357 dans `main` et (ii) la validation des deux textes par Quentin.
Aucune adresse dans ce fichier ; la liste de travail est hors dépôt (espace temporaire de la session, droits 600).

## 1. Destinataires au 28/11/2026

| Catégorie | Source | Nombre |
|---|---|---|
| Acheteurs PGS | Gumroad `list_sales` (fiche `cfXnYcVohgvMwrn0ONglsQ==`) | 0 |
| Acheteurs Pack Étudiant (PET, seul pack actif contenant PGS) | Gumroad (fiche `YtS6AIhqXdCedt-AqQtjmw==`) ; achats du site (tableau de bord) | 0 |
| Testeurs du template lecture (acheteurs exclus) | Essais du site, lus par Nexora `get_qme_dashboard` (90 jours) | 1 |
| Après dédoublonnage | — | 1 |
| Exclus par l'opposition (adresse et domaine, `POST /api/compte/opposition/verifier`) | — | 0 |
| **Total** | — | **1** |

L'unique testeuse est **interne** : Floriane Jolliot, avec son adresse personnelle (essai ouvert le 20/11, en cours
jusqu'au 04/12, case « nouveautés » non cochée). CLAUDE.md (27/11/2026) exclut cette adresse de tout envoi. Il n'y a
donc **aucun destinataire externe** aujourd'hui.

Le tableau de bord ne liste que les essais en cours ou récents (4 lancés sur 90 jours, dont 1 de test). La liste
complète des essais (`GET /api/essai/essais`) demande le code administrateur ou le jeton de lecture, que cette
session n'a pas (401) : le recomptage exact se fera au moment de l'envoi, par la simulation du § 3.

## 2. Consentement des testeurs (point à trancher)

La règle appliquée par le site depuis l'annonce du 22/11 (`netlify/lib/nouveautes.mjs`) : seuls les testeurs qui ont
coché « recevoir les nouveautés » reçoivent une annonce ; les autres n'ont consenti qu'aux e-mails de leur essai.
Écrire à tous les testeurs du template lecture contredirait cette règle. Recommandation : n'écrire qu'aux testeurs
inscrits aux nouveautés (`contact/…` dont `templates` contient `lecture`) ; pour un essai encore en cours, la
nouveauté peut entrer dans les e-mails de l'essai eux-mêmes.

## 3. Textes

Les textes complets (objet, version texte, version HTML avec la signature « Bandeau » du site) sont dans
`docs/production/annonce-suivi-culturel/` : `acheteur.txt`, `acheteur.html`, `testeur.txt`, `testeur.html`.
Variables : `{{prenom_virgule}}` (« , Prénom » ou vide), `{{email}}` (lien « Ne plus recevoir les informations »,
`https://qm-engineering.fr/ne-plus-recevoir/?email=<adresse>`), présent dans les deux textes. Vouvoiement, sans
copie cachée ni Floriane en copie (annonce en nombre). Suivi : `utm_campaign=suivi-culturel-2026-12`.

- **Acheteurs** : « Votre Suivi de lecture devient le Suivi culturel, gratuitement » ; nouveautés (films et séries,
  podcasts et livres audio, recherche intégrée, objectifs par média), données reprises, bouton « Ouvrir mon Suivi
  culturel » (`/templates/lecture/`).
- **Testeurs** : « Le Suivi de lecture que vous avez essayé devient le Suivi culturel » ; mêmes nouveautés, boutons
  « Rouvrir mon essai » (`/essai/?t=lecture`) et « L'acheter (12 €) » (fiche Gumroad). Un essai par adresse et par
  template : le lien rouvre l'essai existant (code renvoyé), en lecture seule s'il est terminé ; le texte ne promet pas
  un nouvel essai.

Défaut de rendu préexistant, non corrigé ici : l'image de la signature « Bandeau » fait 380 px de large fixe ; à 390 px
d'écran, le mail défile horizontalement de quelques dizaines de pixels (même chose dans les mails actuels du site).

## 4. Mécanisme d'envoi

**Existant** : `POST /api/compte/annonce` (`netlify/lib/comptes.mjs`), code administrateur `x-admin` : simulation par
défaut, envoi de test (`test`), envoi par lots de 8 à 20 à relancer jusqu'à `restants: 0`, marque
`annonce/<campagne>/<empreinte>` contre les doublons, opposition par adresse et par domaine, `copieCachee: false`.
Limite : il est figé sur la campagne du 22/11 (`CAMPAGNE`, `contenuAnnonce`) et écrit à **tous** les contacts et
acheteurs.

**Minimum à ajouter (non codé)** :
1. un paramètre `campagne` dans le corps, qui choisit le contenu (registre `{ id: { contenu, cible } }`, la campagne du
   22/11 restant celle par défaut) ;
2. une cible par produit : acheteurs dont un compte porte une clé `PGS` ou `PET` (source `achat`) ; testeurs
   inscrits aux nouveautés pour `lecture` (§ 2), acheteurs retirés ;
3. le contenu de cette annonce, repris des fichiers du § 3.

**Déclenchement manuel** (par Quentin ou une session qui a le code administrateur) :
1. `POST https://qm-engineering.fr/api/compte/annonce` `{ "campagne": "suivi-culturel-2026-12" }` → simulation et
   nombres ;
2. `{ "campagne": …, "test": "<adresse pro de Quentin>" }` → les deux versions en test ;
3. `{ "campagne": …, "simulation": false, "limite": 20 }`, relancé jusqu'à `restants: 0`.

## 5. Recommandation

Avec 0 acheteur et aucun testeur externe, un envoi en nombre n'a aujourd'hui aucun destinataire et le développement
du § 4 ne se justifie pas. Proposition : garder les textes prêts, refaire le comptage à la mise en ligne de #357, et ne
développer le paramètre `campagne` que si au moins un destinataire externe apparaît.
