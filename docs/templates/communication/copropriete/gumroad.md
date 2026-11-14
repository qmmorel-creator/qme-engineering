# Fiche Gumroad · Charges et AG de copropriété

Texte à reporter dans la fiche Gumroad (outils `mcp__Gumroad__*`), au format de `../gumroad-a-creer.json` dans
`gumroad.json`. Prix prévu dans `IDEES.md` (15 €) : **nom et prix à confirmer par Quentin**. **Aucun produit Gumroad
n'a été créé** (consigne de la mission du 14/11/2026). La clé de licence est à activer à la main dans l'éditeur
Gumroad (Content → Insert → License key, sans multi-postes), puis l'identifiant produit reporté dans `PRODUITS`
(`netlify/lib/templates-acces.mjs`, champ `gumroad` de `CPR`). L'entrée n'a pas été ajoutée à
`../gumroad-a-creer.json` (fichier partagé, laissé au coordinateur).

- **Produit interne** : `CPR` (préfixe des codes), application `https://qm-engineering.fr/templates/copropriete/`
- **Lien de contenu** : `https://qm-engineering.fr/connexion/`
- **Couverture** : `assets/templates-copropriete-couverture.png` (1280 × 720, générée par
  `outils/templates/couvertures-gumroad.cjs` avec les 3 lignes de `couverture.txt`), une fois en ligne
- **Bouton** : « Ouvrir ma copropriété »
- **Catégorie** : `business-and-money/personal-finance` (comme la gestion locative et la capacité d'emprunt), **à confirmer**.

## Nom

Charges et AG de copropriété

## Prix

15 € (achat unique)

## Permalien

`charges-ag-copropriete` (à confirmer à la création)

## Résumé (une phrase)

Appels de fonds payés ou à payer, charges par poste et régularisation, part récupérable sur le locataire, évolution sur plusieurs années, assemblées générales (ordre du jour, vote, résultat) et travaux votés avec échéancier.

## Description (HTML)

```html
<h2>Chaque appel payé, chaque vote préparé.</h2><p>Copropriétaire, tu reçois toute l'année des appels de fonds, un décompte annuel, une convocation, un procès-verbal. Charges et AG de copropriété les range au même endroit : ce qui est payé, ce que coûte chaque poste, ce qui a été voté.</p><h3>Ce que tu obtiens</h3><ul><li><strong>Les appels de fonds</strong> : provisions, fonds de travaux, travaux votés ; payé ou à payer, alerte avant l'échéance ; les 4 appels trimestriels de l'exercice créés à partir du budget voté.</li><li><strong>Les charges poste par poste</strong> : recopiées du décompte annuel, avec la régularisation (charges réelles moins provisions appelées) et l'évolution sur plusieurs années en graphique.</li><li><strong>La part récupérable sur le locataire</strong> : saisie par poste, avec une aide qui propose les catégories citées par la liste officielle ; récapitulatif imprimable des charges par nature.</li><li><strong>Les assemblées générales</strong> : convocation, ordre du jour collé en une fois, majorité recopiée de la convocation, ton intention de vote, puis le résultat.</li><li><strong>Les travaux votés</strong> : ta quote-part (estimée avec tes tantièmes ou saisie), l'échéancier, chaque échéance appelée puis payée.</li><li><strong>Les documents à conserver</strong> : où est rangé chaque papier (règlement, procès-verbaux, décomptes, factures) ; exports CSV.</li></ul><h3>Comment ça marche</h3><ol><li>Après l'achat, tu reçois ta <strong>clé de licence</strong> par e-mail.</li><li>Ouvre <strong>qm-engineering.fr/connexion</strong> et saisis-la ; indique ta copropriété et tes lots avec leurs tantièmes.</li><li>Recopie le dernier appel de fonds reçu, ou génère les appels de l'exercice ; ajoute le décompte et la prochaine AG quand ils arrivent.</li></ol><p>Rien à installer. Plusieurs copropriétés avec la même clé. Achat unique, sans abonnement.</p><p><em>Outil d'aide : le règlement de copropriété, les décisions d'assemblée et les documents du syndic font foi ; il ne remplace pas un conseil juridique. Aucune règle de majorité intégrée. Repères indicatifs repris de service-public.gouv.fr (provisions trimestrielles, fonds de travaux, charges récupérables), désactivables. Démo disponible sur qm-engineering.fr/catalogue/copropriete.</em></p>
```

## Tags (7)

1. copropriete
2. charges
3. syndic
4. assemblee-generale
5. proprietaire
6. bailleur
7. francais

## Texte du reçu

Ta clé de licence (ci-dessus) est ton code d'accès. Ouvre qm-engineering.fr/connexion, colle-la, puis indique ta copropriété et tes lots avec leurs tantièmes. Recopie ensuite le dernier appel de fonds reçu. Garde cet e-mail : la même clé fonctionne sur tous tes appareils.

## Détails

- **Format** : Application web (ordinateur, tablette, téléphone)
- **Accès** : Clé de licence envoyée par e-mail
- **Langue** : Français
- **Paiement** : Achat unique, sans abonnement
- **Pour** : Copropriétaires occupants ou bailleurs, conseils syndicaux

## Avertissement (repris dans la description)

Outil d'aide : le règlement de copropriété et le syndic font foi, ne remplace pas un conseil juridique. Aucune règle
de majorité intégrée (saisie depuis la convocation). Repères repris de service-public.gouv.fr (fiches F20586
« Budget prévisionnel d'une copropriété », vérifiée le 4 août 2026 ; F34026 « Fonds de travaux mis en place dans les
copropriétés », vérifiée le 9 juin 2026 ; F947 « Charges à payer par le locataire », vérifiée le 15 avril 2025 ;
consultées le 14/11/2026), indicatifs et désactivables. Aucune donnée personnelle demandée (noms de lots et de
copropriété libres).
