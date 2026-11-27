# Campagne ciblée « architectes d'intérieur » (pack Freelance : trouver ses clients)

Sous-campagne lancée le 27/11/2026 depuis la session « Audit campagnes ciblées », skill
`.claude/skills/campagne-ciblee-pack/`. **Rien n'est fusionné, mis en file ni envoyé avant le feu vert de Quentin**
sur l'aperçu Netlify de la page et le brouillon du mail type.

- Id de campagne : `architectes-interieur` ; vague Nexora : `cible-architectes-interieur`.
- Page : `/concepts/architectes-interieur/` (captures réelles des démos `?demo`, données fictives).
- Modèle de mail : `outils/prospection/campagnes/architectes-interieur.mjs` (structure de
  `docs/prospection/mail-type-packs-niches.md`), liens traçables `?utm_campaign=ai-<id>`.
- Pack principal : **Freelance : trouver ses clients** (PFC, en vente) : Préparateur d'appel découverte (APD), CRM et
  prospection (CRM), Propositions commerciales (PCM), Kit références et plaquette (KRF), Calendrier éditorial (CED),
  Suivi de candidatures (CAN). Prix lus sur `qm-engineering.fr/packs/freelance-clients/` le 27/11/2026 : **76 € au
  lieu de 102 €**, outils seuls **de 12 à 25 €**, achat unique, 14 jours d'essai sans carte bancaire.
- Pack complémentaire cité : **Freelance : chiffrer, facturer, encaisser** (PFG) : **118 € au lieu de 158 €** (page
  `/packs/freelance-gestion/`, 27/11/2026) : suivi du temps comparé au devis (TMP), devis (DVS), relance des impayés (RCV).
- `node outils/gumroad/ecart.mjs` (27/11/2026) : aucun écart, PFC et PFG en vente.

## Cible et règles de sourcing

Architectes d'intérieur et décorateurs indépendants ou petites agences (moins de 10 personnes). **Adresse générique
uniquement** (contact@, agence@, studio@, hello@…), constatée sur le site de l'entreprise ; les adresses nominatives,
fréquentes dans ce métier, sont écartées (vivier réduit assumé). Exclus : cabinets d'architectes DPLG/HMONP sans
activité d'intérieur, enseignes de décoration, franchises, home staging pur.

**Anti-doublon strict** : des architectes ont déjà été prospectés (campagne `btp`, architectes assurant la direction
des travaux ; vague 12 « Professions libérales », dont Qui Plus Est architectes urbanistes en discussion). Un cabinet
qui fait aussi de l'intérieur et figure déjà quelque part est écarté. Trois contrôles par lot (skill § 4) :
`campagne.mjs doublons`, Nexora `list_qme` par nom, Gmail `in:anywhere <domaine>` ; `doublons` relancé juste avant `file`.

## Journal

| Date | Étape | Détail |
|---|---|---|
| 27/11/2026 | Préparation | Page, captures (appel découverte, options d'une proposition, plaquette, pipeline, missions), modèle de mail, journal. PR sans fusion. |
