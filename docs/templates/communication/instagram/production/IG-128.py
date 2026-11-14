"""IG-128 · Carrousel « Sur mesure » adapté de LI-69 (Combien de pièces commander pour les ordres de la semaine ?). Seuls les faits du Google Doc LI-69 sont repris ;
aucune capture d'outil client, aucune donnée réelle. Gabarit sur mesure de construire_ig_06_33.py.

Usage, depuis la racine du dépôt :
  python3 docs/templates/communication/instagram/production/IG-128.py
  node docs/templates/communication/instagram/rendre.mjs production/IG-128.html
"""
import importlib.util
import json
import pathlib

ICI = pathlib.Path(__file__).resolve().parent
IG = ICI.parent
spec = importlib.util.spec_from_file_location('ig', IG / 'construire_ig_06_33.py')
ig = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ig)


def ecrire(pid, blocs):
    tete = (IG / 'publications.html').read_text(encoding='utf-8').split('<!-- ============ IG-01')[0]
    tete = tete.replace('<title>Publications Instagram IG-01 à IG-03</title>', f'<title>Publication Instagram {pid}</title>')
    page = tete + '\n'.join(blocs) + '\n\n</body>\n</html>\n'
    page = page.replace("../../../../assets/", "../../../../../assets/")
    (ICI / f'{pid}.html').write_text(page, encoding='utf-8')


S = dict(id='IG-128', slug='besoins-composants', titre='Sur mesure · Combien de pièces commander ?', li='LI-69',
  sourcil='Sur mesure · méthode',
  h1="Combien de pièces <mark>commander</mark> ?", sous="Pour les ordres de fabrication de la semaine.",
  p2=("« Pour les ordres de la semaine prochaine, qu'est-ce qu'il nous manque ? »",
      "Dans un tableur, la réponse prend une demi-journée."),
  p2_bas="Le calcul, lui, tient en trois étapes.",
  v3=('Trois étapes', 'Du besoin brut à la commande.', [
      ('carre', '1. Besoins bruts', "Quantité de chaque ordre × nomenclature : les composants du produit et leurs quantités.", None),
      ('barres', '2. Besoins nets', "Besoins bruts − stock disponible − commandes fournisseurs en cours.", None),
      ('rond', '3. À commander', "Les besoins nets, arrondis au conditionnement du fournisseur.", None)],
      'Méthode illustrée, données fictives'),
  v4=('Exemple fictif', '310 charnières, 100 commandées.', [
      ('40 armoires A, 25 armoires B', "4 et 6 charnières chacune : 160 + 150 = 310."),
      ('120 en stock, 100 en commande', "Besoin net : 90 charnières."),
      ('Vendues par boîtes de 50', "On en commande 100.")]),
  v5=('Ce calcul revient chaque semaine ?', ["Nomenclatures saisies une fois", "Composants en retard signalés"]))

ALT = [
 "Titre « Combien de pièces commander ? » Pour les ordres de fabrication de la semaine.",
 "Fond noir : « Pour les ordres de la semaine prochaine, qu'est-ce qu'il nous manque ? » Dans un tableur, la réponse prend une demi-journée. Le calcul tient en trois étapes.",
 "Trois étapes : besoins bruts (quantité de chaque ordre × nomenclature), besoins nets (moins le stock et les commandes en cours), quantité à commander arrondie au conditionnement. Données fictives.",
 "Exemple fictif : 40 armoires A et 25 armoires B, 310 charnières ; 120 en stock et 100 en commande, besoin net de 90 ; vendues par boîtes de 50, on en commande 100.",
 "Fond rouge : ce calcul revient chaque semaine ? Nomenclatures saisies une fois, composants en retard signalés. Votre métier a ses règles ? Parlons-en : lien en bio.",
]

LEGENDE = """« Pour les ordres de la semaine prochaine, qu'est-ce qu'il nous manque ? » Dans un tableur : une demi-journée.

Le calcul, lui, tient en trois étapes.
1. Besoins bruts : pour chaque ordre de fabrication, la quantité à produire × la nomenclature.
2. Besoins nets : besoins bruts − stock disponible − commandes fournisseurs en cours.
3. À commander : les besoins nets, arrondis au conditionnement du fournisseur.

Exemple fictif : 40 armoires A à 4 charnières et 25 armoires B à 6, soit 310 charnières. 120 en stock, 100 en commande : il en manque 90. Vendues par boîtes de 50, on en commande 100.

Je construirais un outil avec les nomenclatures saisies une fois, les ordres de la semaine, et ce calcul fait pour chaque composant, en signalant ceux qui ne seront pas livrés à temps. Pas besoin d'un progiciel de gestion de production pour répondre à une question qui revient chaque semaine.

Votre métier a ses règles ? Parlons-en : lien en bio.

#Industrie #Approvisionnement #GestionDeProduction #OutilsSurMesure"""

if __name__ == '__main__':
    ecrire(S['id'], [f"\n<!-- ============ {S['id']} · {S['titre']} (d'après {S['li']}) ============ -->"]
           + ig.sur_mesure(S, 1))
    print(json.dumps(dict(alt=ALT, legende=LEGENDE), ensure_ascii=False))
