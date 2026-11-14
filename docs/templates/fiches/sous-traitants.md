# T78 · Conformité des sous-traitants (agréments, attestations)

Slug `sous-traitants`, préfixe `STR` (clés locales `qme-str-*`, règles `window.REGLES`), prix prévu 29 €
(**à confirmer par Quentin**), permalien Gumroad proposé `conformite-sous-traitants`, catégorie Gumroad
`business-and-money/management-and-leadership` (**à vérifier**), taille M, priorité P2, usage `pro`. Catalogue :
`data-pour="pro"`, thème « Projets et chantiers » (`projets-et-chantiers`, `--c:var(--bleu)`), avec le circuit de
visa, les réserves et le suivi de chantier. Pack visé : « Chef de projet BTP » (PBT). Origine : proposition
validée par Quentin le 14/11/2026. Cadrage délégué par Quentin ; fiche rédigée le 14/11/2026.
Marques de risque : **daté** (règles légales sourcées, date de vérification affichée, tout paramétrable) et
**RGPD** (coordonnées professionnelles, aucun document stocké).

## Pour qui

Entreprises générales et PME du gros œuvre qui sous-traitent (donneurs d'ordre soumis à l'obligation de
vigilance et qui font accepter leurs sous-traitants), maîtres d'ouvrage (publics et sociaux surtout) et maîtres
d'œuvre / OPC qui suivent les déclarations de sous-traitance et la présence des entreprises. Aujourd'hui : un
classeur avec une ligne par entreprise, des attestations redemandées « quand on y pense », des déclarations
suivies par e-mail, et la pièce périmée découverte au moment du règlement.

Distinct de **T23** (suivi de chantier : le sous-traitant y est une ligne du lot, avec l'état de la demande
d'acceptation) : ici l'unité est **l'entreprise et ses pièces**, sur toutes les opérations, avec les échéances
de validité, les alertes et les relances. Proche de **T63** (vérifications réglementaires) par la mécanique
d'échéances, mais l'objet est la conformité administrative des entreprises, pas des installations.

## Promesse

Aucune attestation périmée sur ton chantier : chaque entreprise à sa place dans la chaîne, chaque pièce avec sa
date de fin, une alerte avant qu'elle n'expire, la relance prête.

## Écrans (5 onglets + guide + réglages)

1. **Alertes** (tableau de bord) : titre de synthèse (points bloquants, points à surveiller) ; tuiles
   non conformes, à surveiller, entreprises à relancer, taux de conformité ; liste des alertes (une par pièce et
   par entreprise, toutes opérations confondues ; puis une par acceptation) avec action directe (saisir la pièce,
   ouvrir l'intervention) ; les cinq premières entreprises à relancer.
2. **Opérations** : cartes (maître d'ouvrage, nombre d'interventions, taux de conformité, barre
   conformes / à surveiller / non conformes) ; fiche d'une opération : tuiles, **tableau de conformité** par lot,
   chaque sous-traitant indenté sous son donneur d'ordre (rang calculé), montant HT, acceptation, une pastille par
   pièce exigée (Valide, J-n, Expirée, Manquante, « – » si non exigée), conformité ; cartes sur téléphone.
3. **Entreprises** : liste filtrable (recherche, conformité) ; fiche : état de chaque pièce (dernière version),
   interventions sur les opérations, relances, historique des pièces ; alerte « établie hors de France ».
4. **Relances** : entreprises à relancer (pièce manquante, expirée ou à J-30, pas de relance depuis N jours) ;
   journal des relances. Fenêtre de relance : objet et message remplis depuis le modèle (pièces avec leur état,
   opérations concernées), modifiables, « Copier le texte », « Ouvrir dans la messagerie » (`mailto:`), date et
   canal, puis « Noter la relance ».
5. **Registre** : choix de l'opération, document daté (situation au jour) : lot, entreprise (SIRET), rang et
   donneur d'ordre, montant, acceptation et paiement, fin de validité de chaque pièce, conformité ; impression
   A4 paysage (enregistrement en PDF par le navigateur) ; export CSV.
- **Guide** : démarrage, calculs, **règles retenues et sources avec leur date de lecture**, évolution annoncée,
  RGPD, limites, avertissement « outil d'aide, ne remplace pas un conseil juridique ».
- **Réglages** : structure, alertes (30 et 15 jours), seuil de vigilance (5 000 € HT), délai entre relances
  (7 jours), **pièces suivies** (nom, nom court, échéance « délivrance + durée » ou « date écrite sur la pièce »,
  durée, portée, ajout de pièces libres), **modèle de relance**, exports CSV, copie JSON, compte, « Sur
  téléphone » (fenêtre « Comme une application »).

## Données

- `operations` : nom, maître d'ouvrage, référence du marché, ville, début, fin, marché public, close, notes.
- `entreprises` : raison sociale, SIRET (facultatif), ville, contact (fonction de préférence), e-mail et
  téléphone professionnels, sans salarié, établie hors de France, notes.
- `intervenants` (une entreprise sur une opération) : lot (texte), donneur d'ordre (vide = titulaire, contrat
  avec le maître d'ouvrage), objet, montant HT, début, fin, décennale exigée, acceptation (`a-declarer`,
  `demande`, `accepte`, `refuse`), dates de demande et de décision, paiement agréé, paiement direct.
- `pieces` (par entreprise) : type, délivrée le, valable jusqu'au (facultatif selon le type), reçue le,
  authenticité vérifiée, référence, notes. **Aucun fichier.**
- `relances` : entreprise, date, pièces, canal, notes.

## Règles (fonctions pures, `regles.js`, 14 tests)

- **Échéance d'une pièce** : date de fin saisie, sinon délivrance + durée du type (6 mois pour la vigilance,
  le Kbis et la liste des salariés étrangers ; date écrite sur la pièce pour la décennale).
- **État** : expirée (échéance dépassée), J-15, J-30 (seuils réglables), valide, manquante. Pièce en cours :
  celle dont l'échéance est la plus tardive.
- **Pièces exigées** par intervention selon la portée du type : vigilance (montant ≥ seuil ; montant inconnu :
  exigée par prudence), employeur (idem et entreprise avec salariés), travaux (case décennale), toujours,
  facultatif (suivie si saisie, jamais exigée).
- **Acceptation** : titulaire sans objet ; accepté + paiement agréé = ok ; accepté sans agrément = « paiement à
  agréer » ; non accepté avant le début = « demandée » (à surveiller) ; non accepté après le début = non
  conforme ; refus = non conforme.
- **Conformité** : non conforme (pièce manquante ou expirée, non accepté, refus) > à surveiller > conforme ;
  « terminée » (hors suivi) si la fin d'intervention est passée ou l'opération close.
- **Rang** calculé par la chaîne des donneurs d'ordre (cycles bloqués à la saisie et ignorés au calcul).
- **Alertes** dédoublonnées par entreprise et pièce ; **à relancer** : entreprises avec une alerte de pièce et
  sans relance depuis N jours ; **texte de relance** par remplacement des champs du modèle.
- **CSV** point-virgule, UTF-8 avec BOM, formules neutralisées : registre (une ligne par intervention) et
  pièces.

## Sources (lues le 14/11/2026, affichées dans le Guide)

| Règle | Source |
| --- | --- |
| Vigilance : contrat ≥ 5 000 € HT, documents à la conclusion puis tous les 6 mois, solidarité financière | Entreprendre.Service-Public.fr, fiche F36261 (page vérifiée le 27/06/2026 par la DILA) |
| Attestation de vigilance valable 6 mois, vérification par code de sécurité | urssaf.fr, « Obtenir et vérifier une attestation de vigilance » |
| Documents d'un cocontractant établi en France (attestation, justificatif d'immatriculation) | Code du travail, art. D8222-5 (Code du travail numérique, version au 01/01/2023) |
| Liste nominative des salariés étrangers, à la conclusion puis tous les 6 mois | Code du travail, art. D8254-2 et D8254-4 |
| Attestation d'assurance décennale jointe aux devis et factures | Code des assurances, art. L243-2 (Légifrance) |
| Acceptation et agrément des conditions de paiement, paiement direct, mise en demeure | Loi n° 75-1334 du 31/12/1975, art. 3, 6 et 14-1 (Légifrance) |

**Évolution à surveiller** : Service-Public annonce un renforcement de la vigilance (obligations sociales et
fiscales, toute la chaîne de sous-traitance) applicable après un décret et au plus tard le 27/12/2026 ; les
documents seront fixés par ce décret. L'application l'affiche dans le Guide ; la liste des pièces se met à jour
dans les Réglages (aucune mise à jour du code nécessaire). À revérifier avant la mise en vente.

## Décisions de cadrage (déléguées, à relire par Quentin)

- **Pièces par entreprise**, pas par intervention : une attestation vaut pour toutes les opérations.
- **Lot en texte libre** (avec suggestions des lots déjà saisis), pas de table de lots séparée.
- **Pas de pièces jointes ni d'espace fournisseur** : seules les dates sont suivies (RGPD, taille, simplicité).
- **Entreprises établies hors de France** : simple signalement (art. D8222-7 cité) ; l'utilisateur ajoute ses
  pièces ; pas de base de documents étrangers.
- **Pas d'envoi d'e-mail** : copie ou `mailto:` ; la relance se note à la main.
- **Seuil et durées paramétrables**, valeurs d'origine sourcées ; aucun calcul du cumul annuel des contrats
  (le montant saisi est celui du contrat).
- Accès unique par clé, sans comptes par personne.

## RGPD

Coordonnées professionnelles seulement (fonction ou service conseillés) ; **aucun document** ni nom de salarié
(la liste des salariés étrangers reste dans les dossiers de l'utilisateur, seule sa date est suivie) ; données
hébergées avec la clé (Netlify Blobs, Francfort) ; suppression d'entreprise et d'opération en cascade, export
CSV et JSON avant archivage. Démo : entreprises inventées, e-mails sur le domaine réservé `.example`, aucun
SIRET.

## Risques

- Règle qui change (décret attendu) : sources et date affichées, tout paramétrable, avertissement juridique.
- Confusion avec un service de collecte certifié : la page et l'application disent « outil d'aide ».
- Faux sentiment de conformité si l'authenticité n'est pas vérifiée : case « authenticité vérifiée » et
  astérisque au registre.
