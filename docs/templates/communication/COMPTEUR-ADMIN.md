# Compteur réseaux QME : page d'administration

Page : **https://qm-engineering.fr/admin/compteur/** (non indexée, jamais en cache), protégée par un mot de passe
simple partageable. Même contenu que la page Claude « Compteur réseaux QME » : compteurs cumulés empilés par réseau,
mode « sans mes j'aime ni commentaires », section Gumroad (vues, ventes, revenu, sources de trafic, ventes et
provenance), cartes par réseau, classement et détail des publications.

## Fonctionnement

- **Données** : uniquement le Google Sheet « Mesures réseaux QME » (`1578z4XTYuN-_85VdCrjJYLX9hEDlRpnmZZP5gTfNMik`).
  - `Publications`, `Historique` : remplis chaque jour par Instinct (`PROMPT-INSTINCT-MESURES*.md`).
  - `Gumroad produits`, `Gumroad sources`, `Gumroad jours`, `Gumroad ventes` : copiés chaque matin de Gumroad par la
    tâche planifiée « Compteur QME · copie Gumroad vers Sheet » (06:47, Paris). Aucune adresse e-mail d'acheteur.
- **Lecture** : `netlify/functions/compteur.mjs` (`/api/compteur`, logique `netlify/lib/compteur.mjs`, tests
  `outils/templates/compteur.test.mjs`) vérifie le mot de passe puis lit chaque onglet par la publication web du Sheet
  en CSV. La page (`admin/compteur/`) ne reçoit les données qu'après un mot de passe correct.
- **Graphiques** : d3 7.9.0 hébergé sur le site (`admin/compteur/d3-7.9.0.min.js`), police Outfit du site.

## Mise en service (Quentin, une fois)

1. **Publier le Sheet sur le Web** : Google Sheets, Fichier > Partager > Publier sur le Web > « Tout le document »,
   format « Page Web » > Publier. Copier l'adresse obtenue et ne garder que la partie
   `https://docs.google.com/spreadsheets/d/e/2PACX-…/pub` (sans `?…` ni `/pubhtml`).
   Attention : quiconque possède cette adresse (longue, impossible à deviner) peut lire le Sheet. Ne la partager avec
   personne ; elle ne sert qu'à Netlify.
2. **Variables Netlify** (Site configuration > Environment variables) :
   - `COMPTEUR_SHEET_PUB` = l'adresse de l'étape 1 ;
   - `COMPTEUR_MOT_DE_PASSE` = le mot de passe choisi (6 caractères au moins).
3. **Redéployer** le site (ou fusionner la PR) pour que la fonction lise les variables.
4. Ouvrir https://qm-engineering.fr/admin/compteur/, saisir le mot de passe.

Changer le mot de passe : modifier `COMPTEUR_MOT_DE_PASSE` sur Netlify puis redéployer ; les appareils connectés
devront le ressaisir. Couper l'accès : supprimer la variable (la page répond « Compteur non configuré »).

## Sécurité

- Mot de passe simple : chaque essai faux attend 0,7 s, mais il n'y a pas de blocage après plusieurs essais. Choisir
  un mot de passe qui ne soit pas un mot du dictionnaire seul (par exemple deux mots et un nombre).
- Le mot de passe est gardé sur l'appareil (« Rester connecté ») ou pour la session ; « Se déconnecter » l'efface.
