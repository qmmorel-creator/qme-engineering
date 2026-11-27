# Campagne ciblée « clubs-competition » · Pack Associations et clubs

Lancée le 27/11/2026 (sous-campagne de la session « Audit campagnes ciblées »), skill `.claude/skills/campagne-ciblee-pack/`.

- **Id de campagne** : `clubs-competition` · **vague Nexora** : `cible-clubs-competition`
- **Produit** : Pack Associations et clubs (PAS, en vente) : Inscriptions associatives (ASC, 29 €), Organisateur
  d'événement (EVT, 39 €), Trésorerie prévisionnelle (TRS, 29 €), Gestion de compétition sportive (CMP, 49 €),
  Subventions (SBV, 25 €), Bénévoles et planning des créneaux (BNV, 19 €), Assemblée générale (AGS, 19 €).
  Prix lus le 27/11/2026 sur `https://qm-engineering.fr/packs/associations/` : **156 € au lieu de 209 €**, outils
  seuls de 19 à 49 €, achat unique sans renouvellement, 14 jours d'essai sans carte bancaire. `ecart.mjs` : aucun écart.
- **Page concept** : `/concepts/clubs-competition/` (9 captures réelles des démos `?demo`, bandeau démo masqué).
  Rétroplanning : la démo EVT n'a pas d'exemple sportif ; capture de l'exemple « Fête », signalée dans la note de la page.
- **Modèle de mail** : `outils/prospection/campagnes/clubs-competition.mjs` (structure de `mail-type-packs-niches.md`).
  Liens traçables `?utm_campaign=clubs-competition-<id>`.
- **Cible** : clubs et associations sportives qui organisent eux-mêmes une compétition ou une course (judo,
  gymnastique, escalade, trail, triathlon, natation, cross-training associatif…), adresse de contact du club constatée
  sur son site. Exclus : fédérations, ligues, comités, organisateurs professionnels, salles commerciales.
- **Envoi** : campagne créée sans `parJour`, en pause ; rien en file avant le feu vert de Quentin sur l'aperçu de la
  page et le brouillon `[À valider · campagne clubs-competition]`.

## Lots

| Lot | Date | Sourcés | Écartés `doublons` | Écartés Nexora | Écartés Gmail | Écartés opposition | Retenus |
|---|---|---|---|---|---|---|---|
| C (natation, badminton, tennis de table, vélo) | 27/11/2026 | 45 (2 retirés : ville non lue sur le site) | 0 | 0 | 0 | 0 | 43 |

## Journal

- 27/11/2026 : page, captures, modèle de mail, concept enregistré dans Nexora (`cpt-clubs-competition`, brouillon). PR #335
  (aperçu contrôlé : 200, `noindex`). Campagne créée sur le site, en pause, sans `parJour`. Lot C contrôlé (43 prêts) ;
  témoins Gmail vérifiés (domaine inventé : 0 fil ; `qm-engineering.fr` : environ 4 300 fils), une requête par domaine,
  entre guillemets. Brouillon de validation à Quentin (club réel du lot C). Lots A et B en cours de sourcing.
  Les lots restent hors du dépôt jusqu'à la mise en file (sinon `doublons` les écarterait comme déjà cités).
- 27/11/2026 : règle mise à jour (PR #330, b01111b) : Nexora aussi par radical de domaine. Lot C refait : 43 recherches
  par radical (partie locale de l'adresse pour les sites hébergés sur une plateforme), toutes vides ; témoin `cipec`
  retrouvé (vague 14). `doublons` (version à jour) : 0 écarté. Lot C toujours à 43.
- 27/11/2026 : `doublons --campagne clubs-competition` (PR #330, 28fa78b) ignore les fichiers de la campagne : lots A et C
  commités, contrôle relancé (0 écarté). Lot A : 40 sourcés, 9 retirés (4 faits de 2019 à 2022, 5 compétitions internes),
  31 ; doublons 0, opposition 0 ; Nexora et Gmail en cours.
