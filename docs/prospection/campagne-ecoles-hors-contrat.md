# Campagne ciblée « ecoles-hors-contrat » (préparée le 27/11/2026)

Sous-campagne lancée depuis la session « Audit campagnes ciblées » : pack **Écoles et formateurs** (PNS, en vente depuis
le 27/11/2026) présenté aux écoles privées hors contrat et aux centres de soutien scolaire indépendants. Skill :
`.claude/skills/campagne-ciblee-pack/` ; structure du mail : `docs/prospection/mail-type-packs-niches.md`.

| Élément | Valeur |
|---|---|
| Page concept | `https://qm-engineering.fr/concepts/ecoles-hors-contrat/` (captures réelles des démos du 27/11/2026, données fictives) |
| Démos | `/templates/gestion-classe/?demo`, `/templates/progression/?demo`, `/templates/quiz/?demo`, `/templates/emploi-du-temps/?demo` |
| Modèle de mail | `outils/prospection/campagnes/ecoles-hors-contrat.mjs` (objet, texte, relance J+7) ; lien traçable `?utm_campaign=ehc-<id>` |
| Angle | notes et bulletins, progression par classe, quiz, emploi du temps des classes et des salles |
| Prix (lus le 27/11/2026 sur `/packs/enseignant/` et dans `outils/packs/donnees.mjs`) | pack 111 € au lieu de 149 € ; seuls : PRG 15 €, QZZ 19 €, CSE 25 €, EDT 45 € (104 € les quatre) ; AEC 45 € non mis en avant |
| Envoi | OVH via le site, file `/api/prospection` (campagne `ecoles-hors-contrat`, créée sans `parJour`, en pause jusqu'au feu vert), un mail toutes les 2 minutes au total, campagnes en parallèle à tour de rôle, lundi–samedi, 8 h–18 h |
| Copie | copie cachée `quentin.morel@qm-engineering.fr` ; pas de Floriane (mail de masse) |
| Nexora | concept `cpt-ecoles-hors-contrat` ; prospects `vague: "cible-ecoles-hors-contrat"`, segment « Écoles hors contrat et soutien scolaire » |
| Projets Nexora | seulement pour les retours intéressés, après accord de Quentin |
| Validation | page (aperçu Netlify de la PR) et brouillon Gmail validés par Quentin avant tout envoi |

## Cible et exclusions

- Écoles privées hors contrat (primaire, collège, lycée, pédagogies alternatives) et centres de soutien scolaire
  indépendants ; adresse générique ou de l'établissement relevée sur une page précise de son site ; un seul fait vérifié.
- Exclus : établissements sous contrat et publics, réseaux nationaux et franchises de soutien scolaire, écoles de
  musique, danse, théâtre ou langues, auto-écoles, et tout établissement déjà prospecté (campagne `formation`, vagues 14
  et 15 « Écoles privées », Montessori, écoles de musique, Compagnie Antarès, École de musique de Givry).
- Anti-doublon (§ 4 du skill) : `campagne.mjs doublons`, puis Nexora `list_qme` par nom, puis Gmail `in:anywhere
  <domaine>` ; `doublons` relancé juste avant `file`.

## Points ouverts

- **Prix** : les quatre outils utiles à cette cible coûtent 104 € séparément, moins que le pack (111 €), qui contient
  aussi l'auto-école. Le mail le dit tel quel ; à confirmer par Quentin.
- La démo de l'emploi du temps montre un centre de formation fictif (pas une école) : la page le présente comme
  « établissement fictif ».
- La gestion de classe signale elle-même qu'elle ne remplace pas un logiciel de vie scolaire : la page le dit.

- **Contrôle `doublons` insuffisant** : sur le lot 1, l'outil (PR #330) n'a écarté aucune adresse, alors que 8 établissements
  déjà prospectés en vague 12 ou 14 (dont `info@cipec.com`, adresse identique) ont été trouvés par Nexora et par Gmail.
  Les contrôles Nexora et Gmail restent indispensables.
- **Gmail** : une recherche `in:anywhere {d1 … d16}` renvoie toute la boîte (résultat faux) ; paquets de 6 domaines au
  plus, méthode vérifiée sur 6 domaines déjà contactés (6 trouvés sur 6).
- Aucun centre de soutien scolaire indépendant trouvé : les recherches ne ramènent que des réseaux nationaux ou des
  plateformes, ou des adresses nominatives. Lot dédié à faire, ville par ville, si Quentin le souhaite.

## Lots

### Lot 1 (27/11/2026) : 160 adresses retenues sur 182 trouvées

Repérage dans l'annuaire de l'Éducation nationale (data.education.gouv.fr, filtre « hors contrat ») et dans l'annuaire
de la Fondation pour l'école ; chaque adresse a été relevée sur une page précise du site de l'établissement (champ
`source`), avec un fait tiré de ce site. Fichier hors dépôt (adresses) ; versé dans Nexora au lancement.

| Contrôle | Écartés |
|---|---|
| Relecture (statut à confirmer, réseau, établissement en double, grande école internationale, adresse d'un tiers) | 14 : Al-Kindi, IBS of Provence, Le Lieu Utile, Cours Aliénor d'Aquitaine (Excellence Ruralités), Cours Charles Péguy, Cours Charlemagne, Cours La Boussole (Espérance banlieues), École de Tarcisius (même lieu que le Collège de la Trinité), American School of Paris, British School of Paris, International School of Paris, IDSP, Kingsworth, École de l'Étoile-du-Matin (réseau FSSPX) |
| `campagne.mjs doublons` | 0 |
| Nexora (2 567 fiches, comparaison des noms) | 8 : Steiner-Waldorf Lyon, L'Envolée, Da Vinci School, Mésanges, CIPEC, Boutons d'Or, English School Lyon, Les Pouces Verts |
| Gmail (`in:anywhere`, domaine ou adresse entière) | 0 |
| Liste d'opposition | 0 |

Répartition : Sud 47, Ouest 48, Nord et Île-de-France 65. À revoir par Quentin s'il le souhaite : Ein Gedi (jeunes
avec un trouble du développement intellectuel), The Old School (anglophone), écoles de deux classes (Montessori by the
Sea, 1-2-3 Colibris, Croque la Vie, 1, 2, 3 Soleil), statut non écrit sur le site mais « hors contrat » dans l'annuaire
officiel (Avicenne, Yunus Emre, Saint-Dominique, Saint-Bernard, Collège Louis et Zélie Martin).

## Journal

| Date | Partis | Réponses | Oppositions | Notes |
|---|---|---|---|---|
| 2026-11-27 | 0 | 0 | 0 | Page (PR #332), captures, modèle de mail, brouillon Gmail de validation ; lot 1 : 160 adresses contrôlées ; rien en file, campagne non créée |
