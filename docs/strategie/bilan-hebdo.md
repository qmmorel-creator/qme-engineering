# Bilan hebdomadaire QME · procédure

Exécutée chaque lundi à 8 h 37 (heure de Paris) par la tâche planifiée « Bilan hebdomadaire QME », dans la
session de pilotage (qui a les connecteurs Gumroad, Google Sheets et Nexora). Décidée par Quentin le 15/11/2026.
Lecture seule partout, sauf l'ajout d'**une** ligne dans la Sheet de bilan. Aucun chiffre inventé : ce qui
n'est pas lu est « non relevé ».

## Repères

- Objectif : 1000 € net par mois en mai 2027.
- Jalons de ventes du mois : nov. 2026 aucun · déc. 4 · janv. 2027 14 · févr. 20 · mars 35 · avr. 50 · mai 70.
- Net estimé par vente = prix × (1 − 0,129 − 0,232) − 0,80 $ × 0,86 (frais Gumroad et carte, cotisations
  BIC 21,2 % + CFP + versement libératoire ; 1 $ ≈ 0,86 €, hypothèse). Montants Gumroad en cents de dollar.
- Point d'étape du 15/01/2027 : moins de 50 vues Gumroad par semaine, tous canaux → le temps de Quentin
  bascule vers la prospection B2B directe.
- Test TikTok (17/11 → 28/12) : on continue si au moins 5 ventes attribuables ou des clics qui doublent
  toutes les 2 semaines ; on arrête si moins de 10 clics vers Gumroad en tout.

## Étapes

1. **Gumroad** : `get_sales_totals` (par produit) sur 7 jours et depuis le 1er du mois ; `get_analytics`
   par produit et par provenance sur 7 jours ; `list_sales` payantes depuis le lundi précédent (utm_source,
   utm_medium, referrer, discount_code). Les ventes avec `TESTACHAT26` sont des tests : à exclure et à
   signaler. Les téléchargements à 0 € ne sont pas des ventes.
2. **Site (GoatCounter)** : `curl` sur `https://qme-engineering.goatcounter.com/api/v0/stats/total`,
   `/stats/hits?limit=20` et `/stats/toprefs?limit=10`, avec `start` = J-7 et `end` = J-1. La clé est injectée
   par le proxy de l'environnement : n'ajouter aucun en-tête. Relever les pages vues, `/templates`, les pages
   `/catalogue/` et les provenances.
3. **TikTok** : Sheet `1ZyM20se9GnwdN77kgk4vzvr6OtvEGabdZWq6Jz6Od58`, onglet Planning (statuts, erreurs,
   vidéos publiées) et onglet Mesures s'il existe.
4. **Bilan** : une ligne à la fin de la Sheet « Bilan hebdomadaire QME »
   (`1YItwICcnHITVD_pdzfhAPJw81hdvltziOWrwixmX-xg`, onglet Bilans), colonnes A à N comme l'en-tête : semaine,
   ventes payantes 7 j, CA 7 j, ventes du mois, jalon, net estimé du mois, vues Gumroad 7 j, pages vues site
   7 j, vues /templates 7 j, vidéos TikTok publiées, vues TikTok, provenance principale des ventes, 3 actions,
   remarques. Ne modifier aucune ligne existante.
5. **Compte rendu** : une PushNotification (première ligne < 200 caractères : ventes, % du jalon, vues
   Gumroad), puis les 3 actions de la semaine.

## Interdits

Publier, dépublier ou modifier un produit Gumroad ; créer ou modifier un code de réduction ; publier sur un
réseau social ; écrire ailleurs que la ligne du bilan ; envoyer un e-mail ; toute donnée personnelle
d'acheteur dans le bilan ou la notification.
