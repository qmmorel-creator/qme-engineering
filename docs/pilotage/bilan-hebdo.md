# Bilan hebdomadaire QME · procédure

Exécutée chaque lundi à 8 h 37 (heure de Paris) par la tâche planifiée « Bilan hebdomadaire QME », dans la
session GOD (`session_0183EW54bFyxAQcskkhnKJvb`, rattachement du 27/11/2026). Décidée par Quentin le 15/11/2026.
Lecture seule partout, sauf l'ajout d'**une** ligne dans la Sheet de bilan. Aucun chiffre inventé : ce qui
n'est pas lu est « non relevé ».

## Repères

- Objectif : 1000 € net par mois en mai 2027.
- Jalons de ventes du mois : nov. 2026 aucun · déc. 4 · janv. 2027 14 · févr. 20 · mars 35 · avr. 50 · mai 70.
- Net estimé par vente = prix × (1 − 0,129 − 0,232) − 0,80 $ × 0,86 (frais Gumroad et carte, cotisations
  BIC 21,2 % + CFP + versement libératoire ; 1 $ ≈ 0,86 €, hypothèse). Montants Gumroad en cents de dollar.
- Point d'étape du 15/01/2027 : moins de 50 vues Gumroad par semaine, tous canaux → le temps de Quentin
  bascule vers la prospection B2B directe.
- TikTok abandonné le 16/11/2026, **repris le 18/11/2026** : Instinct reprend chaque publication Instagram sur TikTok.

## Étapes

1. **Gumroad** : `get_sales_totals` (par produit) sur 7 jours et depuis le 1er du mois ; `get_analytics`
   par produit et par provenance sur 7 jours ; `list_sales` payantes depuis le lundi précédent (utm_source,
   utm_medium, referrer, discount_code). Les ventes avec `TESTACHAT26` sont des tests : à exclure et à
   signaler. Les téléchargements à 0 € ne sont pas des ventes.
2. **Site (GoatCounter)** : `curl` sur `https://qme-engineering.goatcounter.com/api/v0/stats/total`,
   `/stats/hits?limit=20` et `/stats/toprefs?limit=10`, avec `start` = J-7 et `end` = J-1. La clé est injectée
   par le proxy de l'environnement : n'ajouter aucun en-tête. Relever les pages vues, `/templates`, les pages
   `/catalogue/` et les provenances.
3. **Réseaux** : lignes « Publié » des 7 derniers jours dans les plannings Instagram
   (`1R9l_AHY5fQwGvuZE-ge6F3ghvzx8OvQarkzxBf1mhf8`, dont TikTok en colonnes U à W et mini-stories), LinkedIn
   (`1EejYs9y4AsdoAtQgHc2HzXK6LgWQHwNnZmqbesSxpWU`) et X (`1lri4kqQO61Ei4s6w9za2UdudsPhdpas_zKuAIG5N8hM`), à mettre
   en remarques (colonne N). **YouTube Shorts** : planning `1LYdQZabr6B4Z_Ctu0ayYF1tOOtMIPMiqeXa9LTfNTtE`, onglet Planning (géré par l'agent de contenu,
   ne pas le modifier) : nombre de lignes « Publié » sur les 7 derniers jours. Vues : « non relevé »
   tant que YouTube n'est pas connecté.
4. **Bilan** : une ligne à la fin de la Sheet « Bilan hebdomadaire QME »
   (`1YItwICcnHITVD_pdzfhAPJw81hdvltziOWrwixmX-xg`, onglet Bilans), colonnes A à N comme l'en-tête : semaine,
   ventes payantes 7 j, CA 7 j, ventes du mois, jalon, net estimé du mois, vues Gumroad 7 j, pages vues site
   7 j, vues /templates 7 j, Shorts YouTube publiés, vues YouTube Shorts, provenance principale des ventes, 3 actions,
   remarques. Ne modifier aucune ligne existante.
5. **Compte rendu** : une PushNotification (première ligne < 200 caractères : ventes, % du jalon, vues
   Gumroad), puis les 3 actions de la semaine.

## Interdits

Publier, dépublier ou modifier un produit Gumroad ; créer ou modifier un code de réduction ; publier sur un
réseau social ; écrire ailleurs que la ligne du bilan ; envoyer un e-mail ; toute donnée personnelle
d'acheteur dans le bilan ou la notification.
