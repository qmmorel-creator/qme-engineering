# Fiche Gumroad · Gestion locative

Texte à reporter dans la fiche Gumroad (outils `mcp__Gumroad__*`), au format de `../gumroad-a-creer.json`
dans `gumroad.json`. Prix prévu dans `IDEES.md` (20 €) : **nom et prix à confirmer par Quentin**.
**Aucun produit Gumroad n'a été créé** (consigne de la mission : aucun outil Gumroad utilisé). La clé de
licence est à activer à la main dans l'éditeur Gumroad (Content → Insert → License key, sans multi-postes),
puis l'identifiant produit reporté dans `PRODUITS` (`netlify/lib/templates-acces.mjs`, champ `gumroad` de `GRT`).

- **Produit interne** : `GRT` (préfixe des codes), application `https://qm-engineering.fr/templates/gestion-locative/`
- **Lien de contenu** : `https://qm-engineering.fr/connexion/`
- **Couverture** : `assets/templates-gestion-locative-couverture.png` (1280 × 720, générée par
  `outils/templates/couvertures-gumroad.cjs` avec les 3 lignes de `couverture.txt`), une fois en ligne
- **Bouton** : « Ouvrir ma gestion locative »
- **Catégorie** : `business-and-money/personal-finance` (Business & Money › Personal Finance, déjà utilisée pour d'autres
  templates). Une catégorie « immobilier » serait plus juste si Gumroad en propose une : **à vérifier** à la
  création.
- Entrée à ajouter dans `../gumroad-a-creer.json` au moment de la création (non ajoutée ici : fichier partagé
  entre plusieurs lots).

## Nom

Gestion locative

## Prix

20 € (achat unique)

## Permalien

`gestion-locative` (à confirmer à la création)

## Résumé (une phrase)

Tes loyers encaissés ou relancés, la quittance en un geste, la révision annuelle avec l'IRL, les charges régularisées et le rendement de chaque bien.

## Description (HTML)

```html
<h2>Tes loyers, sans tableur.</h2><p>Un loyer arrive en deux fois, un autre ne vient pas, la quittance se refait à la main chaque mois, la révision annuelle s'oublie (et passé un an, elle est perdue), les charges ne sont jamais régularisées… et au bout de l'année, impossible de dire ce que rapporte vraiment chaque logement. La Gestion locative réunit tes biens, tes baux et tes loyers au même endroit.</p><h3>Ce que tu obtiens</h3><ul><li><strong>Chaque échéance suivie</strong>, de 1 à 10 logements (location vide, meublée ou bail mobilité) : loyer et charges au jour prévu, prorata du premier et du dernier mois, paiements complets ou partiels, retard en jours et grille de l'année.</li><li><strong>La quittance en un geste</strong> : détaillée (loyer et charges) quand le mois est payé, reçu en cas de paiement partiel ; à imprimer, enregistrer en PDF ou copier.</li><li><strong>Des relances au bon palier</strong> : rappel amiable, relance, mise en demeure, textes prêts à copier, sans pénalité de retard (interdite).</li><li><strong>La révision annuelle sans oubli</strong> : date de révision, limite d'un an pour la demander, nouveau loyer calculé avec l'IRL que tu saisis (aucun indice intégré), lettre au locataire prête, application sans effet rétroactif ; bail mobilité et logement classé F ou G exclus.</li><li><strong>Charges et dépôt de garantie</strong> : régularisation annuelle des provisions au prorata de l'occupation avec décompte à envoyer ; dépôt contrôlé (1 mois en vide, 2 en meublé) et date limite de restitution calculée à la remise des clés.</li><li><strong>Le rendement de chaque bien</strong> : loyers, dépenses récupérables ou non, rendement brut et net de charges (avant impôts), jours sans locataire, impayés ; export CSV.</li></ul><h3>Comment ça marche</h3><ol><li>Après l'achat, tu reçois ta <strong>clé de licence</strong> par e-mail.</li><li>Ouvre <strong>qm-engineering.fr/connexion</strong> et saisis-la.</li><li>Décris tes biens et tes baux, note les loyers reçus : retards, quittances, révisions, charges et rendement se calculent. Tes données sont enregistrées en ligne et te suivent sur ordinateur, tablette et téléphone avec la même clé.</li></ol><p>Rien à installer, aucun compte à créer. Achat unique, sans abonnement.</p><p><em>Aucune banque, aucun service de paiement ni aucune messagerie n'est connecté : rien n'est envoyé à ta place. Outil d'aide à la gestion, pas un conseil juridique ni fiscal : les modèles de lettres sont à adapter, aucun régime d'imposition n'est calculé. Repères légaux sourcés sur service-public.gouv.fr, avec leur date de vérification. Démo disponible sur qm-engineering.fr/templates.</em></p>
```

## Tags (7)

1. gestion-locative
2. proprietaire-bailleur
3. quittance-de-loyer
4. revision-du-loyer
5. irl
6. loyers
7. francais

## Texte du reçu

Ta clé de licence (ci-dessus) est ton code d'accès. Ouvre qm-engineering.fr/connexion, colle-la, et ta gestion locative s'ouvre. Décris tes biens et tes baux, puis note les loyers reçus : quittances, relances, révisions et rendement se calculent. Garde cet e-mail : la même clé fonctionne sur tous tes appareils.

## Détails

- **Format** : Application web (ordinateur, tablette, téléphone)
- **Accès** : Clé de licence envoyée par e-mail
- **Langue** : Français
- **Paiement** : Achat unique, sans abonnement
- **Pour** : Propriétaires bailleurs de 1 à 10 logements

## Avertissement (repris dans la description)

Aucune banque, aucun service de paiement ni aucune messagerie connectés : rien n'est envoyé. Outil d'aide à
la gestion, pas un conseil juridique ni fiscal ; modèles de lettres à adapter ; aucun régime d'imposition
calculé. Aucun indice IRL intégré : valeurs saisies par l'utilisateur (Insee). Repères sourcés sur
service-public.gouv.fr (fiches F1311, F13723, F35247, F31269, F947, F2889), dates de vérification affichées
dans l'application ; à revérifier chaque année.
