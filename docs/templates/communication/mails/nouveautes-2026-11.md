# Annonce « Il y a du nouveau » (22/11/2026)

Contenu : `netlify/lib/nouveautes.mjs` (versions acheteur et testeur, texte et HTML). Images :
`assets/mail/nouveautes-2026-11/` (espace, connexion, panneau, personnaliser ; captures réelles, données fictives,
1120 × 640, JPEG). Envoi : `POST /api/compte/annonce` (code administrateur en en-tête `X-Admin`), depuis
`quentin.morel@qm-engineering.fr` (SMTP de l'essai, OVH depuis le 23/11/2026).

## Destinataires

- **Testeurs inscrits aux nouveautés** (case facultative du formulaire d'essai, `contact/…`) : version testeur.
- **Acheteurs** (compte avec un achat rangé par le ping Gumroad ou l'import) : version acheteur, information sur le
  service acheté.
- Un seul lien en pied pour tous : **« Ne plus recevoir les informations »** (`/api/compte/stop`) → liste
  d'opposition `opposition/…` (`netlify/lib/preferences.mjs`) : fiche nouveautés effacée, compte marqué, plus aucune
  annonce. Le lien de désinscription des e-mails d'essai y inscrit aussi. Un nouveau consentement (case cochée lors
  d'un essai) lève l'opposition. Conservation : 3 ans.
- **Exclus** : testeurs non inscrits aux nouveautés (consentement limité aux e-mails de l'essai), adresses
  `ESSAI_TESTEURS`, liste d'opposition. Une seule fois par adresse (`annonce/nouveautes-2026-11/…`).

## Registre des préférences

`/admin/registre/` (code administrateur) ou `GET /api/compte/registre` (`?format=csv`) : une ligne par adresse
(profil acheteur / testeur, applications achetées, essais, nouveautés depuis, informations : abonné / désinscrit / non
inscrit, date et origine de la désinscription, dernière annonce reçue). Vue calculée, aucune donnée en plus.

## Procédure (après publication)

1. Import des ventes passées (adresse + clé copiée dans Gumroad, fiche de la vente) :
   `POST /api/compte/import` `{ "ventes": [{ "email": "…", "licence": "…" }] }` (simulation), puis
   `"simulation": false`.
2. Test : `POST /api/compte/annonce` `{ "test": "<adresse de Quentin>", "prenom": "Quentin" }` → les deux versions.
3. Simulation : `POST /api/compte/annonce` `{}` → nombre d'acheteurs et de testeurs.
4. Envoi, après feu vert de Quentin : `{ "simulation": false }`, à relancer tant que `restants` > 0 (lots de 8).

## Envoi

- 22/11/2026, 17:25 (heure de Paris : 18:25) : 2 envois, 0 erreur (1 acheteuse importée depuis Gumroad, 1 testeuse
  inscrite aux nouveautés), après feu vert de Quentin. Test des deux versions envoyé à Quentin avant.
- Avant l'envoi : les 3 entrées de `docs/prospection/desinscrits.md` inscrites sur la liste d'opposition (3 adresses,
  domaines `helene-weddingplanner.fr`, `renfort-solutions.fr`, `renfortek.fr`).
