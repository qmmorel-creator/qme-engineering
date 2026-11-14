"""IG-98 · Carrousel « Sur mesure » adapté de LI-26 (Une ligne, une chose : pourquoi votre tableur mélange tout). Seuls les faits du Google Doc LI-26 sont repris ;
aucune capture d'outil client, aucune donnée réelle. Gabarit sur mesure de construire_ig_06_33.py.

Usage, depuis la racine du dépôt :
  python3 docs/templates/communication/instagram/production/IG-98.py
  node docs/templates/communication/instagram/rendre.mjs production/IG-98.html
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


S = dict(id='IG-98', slug='une-ligne-une-chose', titre='Sur mesure · Une ligne, une chose', li='LI-26',
  sourcil='Sur mesure · cas réel',
  h1="Une ligne, <mark>une chose</mark>.", sous="La règle invisible qui fait tenir un outil dans le temps.",
  p2=("Une seule ligne pour le client, son achat, sa soirée jeux et ses points de fidélité.",
      "Pratique, jusqu'au jour où il faut répondre à une question simple."),
  p2_bas="Le cas d'une boutique de jeux de société.",
  v3=('Une ligne décrit une seule chose', 'Chaque chose à sa place.', [
      ('carre', 'Clients et produits', "Un client est une ligne de la table des clients, un produit une ligne du catalogue.", None),
      ('barres', 'Ventes', "Une vente est une ligne ; chaque article vendu, une ligne rattachée à cette vente.", None),
      ('rond', 'Soirées jeux', "Une soirée est une ligne ; chaque inscription relie un client à une soirée.", None)],
      'Cas réel, présenté sans aucune donnée du client'),
  v4=('Ce que ça simplifie', 'Trois réponses, rien à recopier.', [
      ('Places restantes vendredi ?', "On compte les inscriptions de cette soirée."),
      ('Le jeu le plus vendu ce trimestre ?', "On additionne les lignes de vente."),
      ('Soirées ou seulement le comptoir ?', "On croise les deux tables.")]),
  v5=('Votre tableur recopie des colonnes ?', ["Chaque information existe une fois, au bon endroit", "Le reste s'y réfère"]))

ALT = [
 "Titre « Une ligne, une chose. » La règle invisible qui fait tenir un outil dans le temps.",
 "Fond noir : une seule ligne pour le client, son achat, sa soirée jeux et ses points de fidélité. Pratique, jusqu'au jour où il faut répondre à une question simple. Le cas d'une boutique de jeux de société.",
 "Une ligne décrit une seule chose : clients et produits, ventes et articles vendus, soirées jeux et inscriptions, chacun dans sa table. Cas réel, sans donnée du client.",
 "Ce que ça simplifie : places restantes vendredi (on compte les inscriptions), jeu le plus vendu du trimestre (on additionne les lignes de vente), soirées ou comptoir (on croise les deux tables).",
 "Fond rouge : votre tableur recopie des colonnes ? Chaque information existe une fois, au bon endroit. Votre métier a ses règles ? Parlons-en : lien en bio.",
]

LEGENDE = """Client, achat, soirée jeux et points de fidélité sur une seule ligne : pratique, jusqu'à la première question simple.

Pour une boutique de jeux de société, j'ai conçu un outil qui repose sur une seule règle : une ligne décrit une seule chose. Un client, un produit, une vente, chaque article vendu, une soirée, chaque inscription : chacun a sa ligne.

Sur le papier, c'est plus compliqué. En pratique, combien de places restent vendredi, quel jeu se vend le mieux ce trimestre, qui vient aux soirées et qui seulement au comptoir : chaque réponse se lit sans recopier une seule colonne.

On ne voit jamais cette partie du travail à l'écran. C'est pourtant elle qui décide si l'outil tiendra encore dans deux ans.

Votre métier a ses règles ? Parlons-en : lien en bio.

#OutilsSurMesure #BaseDeDonnées #Commerce #Tableur"""

if __name__ == '__main__':
    ecrire(S['id'], [f"\n<!-- ============ {S['id']} · {S['titre']} (d'après {S['li']}) ============ -->"]
           + ig.sur_mesure(S, 0))
    print(json.dumps(dict(alt=ALT, legende=LEGENDE), ensure_ascii=False))
