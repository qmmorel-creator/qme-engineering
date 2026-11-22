# Annonce « Il y a du nouveau » (22/11/2026)

Contenu : `netlify/lib/nouveautes.mjs` (versions acheteur et testeur, texte et HTML). Images :
`assets/mail/nouveautes-2026-11/` (espace, connexion, panneau, personnaliser ; captures réelles, données fictives,
1120 × 640, JPEG). Envoi : `POST /api/compte/annonce` (code administrateur en en-tête `X-Admin`), depuis la boîte
Gmail de Quentin (SMTP de l'essai).

## Destinataires

- **Testeurs inscrits aux nouveautés** (case facultative du formulaire d'essai, `contact/…`) : version testeur, lien
  de désinscription des nouveautés.
- **Acheteurs** (compte avec un achat rangé par le ping Gumroad ou l'import) : version acheteur, information sur le
  service acheté, lien « Ne plus recevoir ces annonces » (`/api/compte/stop`, compte.sansAnnonces).
- **Exclus** : testeurs non inscrits aux nouveautés (consentement limité aux e-mails de l'essai), adresses
  `ESSAI_TESTEURS`, comptes désinscrits. Une seule fois par adresse (`annonce/nouveautes-2026-11/…`).

## Procédure (après publication)

1. Import des ventes passées (adresse + clé copiée dans Gumroad, fiche de la vente) :
   `POST /api/compte/import` `{ "ventes": [{ "email": "…", "licence": "…" }] }` (simulation), puis
   `"simulation": false`.
2. Test : `POST /api/compte/annonce` `{ "test": "<adresse de Quentin>", "prenom": "Quentin" }` → les deux versions.
3. Simulation : `POST /api/compte/annonce` `{}` → nombre d'acheteurs et de testeurs.
4. Envoi, après feu vert de Quentin : `{ "simulation": false }`, à relancer tant que `restants` > 0 (lots de 8).
