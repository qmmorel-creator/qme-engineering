# T77 · Registre du DOE (dossier des ouvrages exécutés)

Slug `doe`, préfixe `RDE`, prix 29 €, permalien Gumroad proposé `registre-doe`. Taille M, P2. Usage `pro`.
Origine : proposition validée par Quentin le 14/11/2026 (pack « Chef de projet BTP »), ligne T77 de `IDEES.md`.
Cadrage délégué par Quentin (14/11/2026) : décisions ci-dessous prises par l'assistant, à relire.
**confidentiel** : structure seulement, aucune donnée d'un artefact professionnel ; démo fictive (résidence de
logements, extension d'atelier), entreprises inventées suffixées « (fictive) », personnes désignées par leur
fonction, e-mails en `.exemple`.

## Pour qui

- **Maîtres d'œuvre** (architectes, maîtres d'œuvre d'exécution) qui réunissent le DOE de toutes les
  entreprises pour le remettre au maître d'ouvrage.
- **OPC** qui pilotent la fin d'opération et suivent la complétude des dossiers.
- **Entreprises générales** qui collectent le DOE de leurs sous-traitants avant de remettre le leur.
- **Bureaux d'études** en mission de suivi qui vérifient les pièces techniques.

Aujourd'hui : un tableur par opération, une liste par lot, des relances dans la messagerie, sans vue de la
complétude ni historique des relances.

## Écrans (5 onglets + réglages)

- **Pièces** (accueil) : titre « N pièces en retard sur M manquantes », tuiles cliquables (en retard,
  manquantes, à vérifier, validées), filtres (opération, lot, entreprise, famille, statut, recherche),
  liste triée (retards, reçues à vérifier, à reprendre, dates proches, attendues, validées). Actions en un
  geste : « Reçue », puis « Valider » ou « À reprendre » (motif obligatoire), avec « Annuler » dans le toast.
- **Complétude** : tuiles (complétude, remises, manquantes, retard), barres empilées par entreprise (validées,
  reçues, à reprendre, attendues) avec tableau accessible, tableaux par lot, par entreprise et par famille.
- **Relances** : entreprises à relancer (pièces en retard et pas de relance depuis N jours), courrier
  prérempli (texte modifiable, copier ou imprimer), relance notée (date, mode, note) ; journal des relances
  avec suppression et « Annuler ».
- **Documents** : bordereau de transmission (pièces validées, option « reçues », par opération et
  éventuellement par entreprise, destinataire modifiable, cadres « Remis par / Reçu par ») et état des pièces
  manquantes par entreprise (avec les dates de relance). Impression A4 ou PDF par le navigateur.
- **Opérations** : opérations (maître d'ouvrage, adresse, réception, date limite du DOE, DIUO), lots avec
  titulaire et compteur validées / total, entreprises, **pièces types par lot modifiables**, guide (cycle,
  bonnes pratiques, familles, repère CCAG sourcé, limites).
- **Réglages** : structure (en-tête), date limite proposée (réception + 30 j), délai de reprise (15 j),
  intervalle de relance (7 j), alerte (7 j), exports CSV et JSON, restauration, compte, « Sur téléphone ».

## Mécanique (fonctions pures, `regles.js`, tests `outils/templates/doe.test.mjs`)

1. **Statuts** : `attendue` → `recue` → `validee` ou `a-reprendre` (motif obligatoire, nouvelle date limite)
   → `recue` → … ; réouverture vers `attendue` possible ; chaque passage dans l'historique.
2. **Date limite** d'une pièce : la sienne, sinon celle de l'opération. **Retard** : pièce attendue ou à
   reprendre dont la date limite est passée. **Proche** : dans les N jours.
3. **Complétude** = validées / total (arrondi vers le bas) ; **remises** = (reçues + validées) / total.
4. **Relances dues** par couple (opération, entreprise) ayant des pièces en retard : aucune relance, ou la
   dernière il y a au moins N jours. Une relance enregistre les pièces concernées.
5. **Courrier de relance** : modèle de texte (structure, date, destinataire, opération, rang de la relance,
   liste des pièces avec motif et date, date demandée = aujourd'hui + délai de reprise).
6. **Pièces types** : base ou modèle de l'utilisateur par code de lot ; création sans doublon d'intitulé ;
   pièce DIUO ajoutée si l'opération en comporte un.
7. **Bordereau** : validées (+ reçues sur option), dans l'ordre des lots puis des numéros.
8. **Numérotation** `P-001` par opération. **CSV** point-virgule, BOM, formules neutralisées, avec nombre et
   date de la dernière relance.

## Base intégrée (`donnees.js`)

- **20 lots types** (mêmes codes que la levée de réserves T32) et, pour chacun, 1 à 7 pièces attendues
  usuelles réparties en familles : plans d'exécution et de récolement, notices, PV d'essais et de mise en
  service, fiches techniques, garanties et attestations, éléments pour le DIUO, autres (déchets, clés,
  nuancier). Rédigées pour le produit, propositions modifiables, rien de réglementaire.
- 6 bonnes pratiques, cycle en 4 étapes, formats de remise, modes de relance.

## Sources

- **Article 40 du CCAG Travaux 2021** (arrêté du 30 mars 2021, NOR ECOM2106871A), consulté le 14/11/2026 via
  la reproduction de marche-public.fr et le JORF sur Légifrance : remise des DOE au maître d'œuvre à la demande
  de réception (plans conformes, fiches techniques, notices, prescriptions de maintenance, garanties des
  fabricants, constats d'évacuation des déchets, documents pour le DIUO) ; copie des éléments du DIUO au
  coordonnateur SPS ; en cas d'allotissement, remise par lot à l'achèvement ; contenu, format et pénalités
  fixés par les documents particuliers. Présenté en paraphrase, applicable seulement aux marchés qui s'y
  réfèrent. **À revérifier sur le texte consolidé de Légifrance** (une modification du CCAG par arrêté du
  29/12/2022 est signalée, son effet sur l'article 40 n'a pas été vérifié).
- Délais : saisie de l'utilisateur (le marché fait foi). Aucune base externe reprise : pas de licence en jeu.

## Lien avec T23 et T32

Même vocabulaire et mêmes codes de lots que la levée de réserves (T32) ; vient après le suivi de chantier (T23)
dans le pack « Chef de projet BTP ». Produits séparés, sans échange de données (pas d'import croisé en V1).

## Limites (V1)

- Documents non stockés (référence seulement) ; aucune relance envoyée (texte à copier ou imprimer).
- Pas de comptes pour les entreprises ; un accès partagé sur plusieurs appareils.
- Taille : une pièce pèse environ 0,4 Ko, plusieurs milliers tiennent dans un compte.

## Risques

- **Juridique** : pas un conseil ; mention dans le guide, sur le bordereau et sur la fiche Gumroad.
- **RGPD** léger : contacts des entreprises (fonction, e-mail professionnel générique conseillé).
- **confidentiel** : démo et captures entièrement fictives.
