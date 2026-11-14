"""IG-110 · Carrousel « Sur mesure » adapté de LI-50 (Premier périmé, premier sorti). Seuls les faits du Google Doc LI-50 sont repris ;
aucune capture d'outil client, aucune donnée réelle. Gabarit sur mesure de construire_ig_06_33.py.

Usage, depuis la racine du dépôt :
  python3 docs/templates/communication/instagram/production/IG-110.py
  node docs/templates/communication/instagram/rendre.mjs production/IG-110.html
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


S = dict(id='IG-110', slug='fefo', titre='Sur mesure · Premier périmé, premier sorti', li='LI-50',
  sourcil='Sur mesure · méthode',
  h1="Premier périmé, <mark>premier sorti</mark>.", sous="La règle FEFO, appliquée par l'outil.",
  p2=("Le lot qui doit sortir en premier n'est pas forcément le plus ancien.",
      "C'est celui qui périme le plus tôt."),
  p2_bas="Entrepôt alimentaire, cosmétique ou pharmaceutique : la règle est la même.",
  v3=('En quatre temps', "L'outil applique la règle.", [
      ('carre', '1. À la réception', "Chaque lot porte sa date limite, saisie ou scannée une fois.", None),
      ('quart', '2. À la préparation', "L'outil propose le lot qui périme le plus tôt, pas le plus ancien ni le plus accessible.", None),
      ('rond', '3. Chaque matin', "Les lots dont la date approche, par exemple sous 30 jours : promotion, don ou transfert.", None)],
      'Exemple illustratif, aucune donnée réelle'),
  v4=('4. Le lot périmé', 'Bloqué, même par erreur.', [
      ('Bloqué', "Il ne peut plus être proposé à la préparation."),
      ('À chaque préparation', "La règle ne dépend plus de l'attention du préparateur un vendredi soir.")]),
  v5=('Des produits dorment derrière les plus récents ?', ["Épiceries, traiteurs, cosmétiques", "Pièces à durée de vie limitée"]))

ALT = [
 "Titre « Premier périmé, premier sorti. » La règle FEFO, appliquée par l'outil.",
 "Fond noir : le lot qui doit sortir en premier n'est pas forcément le plus ancien. C'est celui qui périme le plus tôt. Entrepôt alimentaire, cosmétique ou pharmaceutique : la règle est la même.",
 "En quatre temps : à la réception, chaque lot porte sa date limite ; à la préparation, l'outil propose le lot qui périme le plus tôt ; chaque matin, la liste des lots dont la date approche. Exemple illustratif.",
 "4. Le lot périmé est bloqué : il ne peut plus être proposé à la préparation, même par erreur. La règle ne dépend plus de l'attention du préparateur.",
 "Fond rouge : des produits dorment derrière les plus récents ? Épiceries, traiteurs, cosmétiques, pièces à durée de vie limitée. Votre métier a ses règles ? Parlons-en : lien en bio.",
]

LEGENDE = """Le lot qui doit sortir en premier n'est pas forcément le plus ancien. C'est celui qui périme le plus tôt.

La règle porte un nom : FEFO, premier périmé, premier sorti. Pour un magasin ou un petit entrepôt, je construirais l'outil en quatre temps.

1. À la réception, chaque lot porte sa date limite, saisie ou scannée une fois.
2. À la préparation, l'outil propose toujours le lot qui périme le plus tôt.
3. Chaque matin, il liste les lots dont la date approche, pour décider : promotion, don ou transfert vers un autre site.
4. Un lot périmé est bloqué : il ne peut plus être proposé, même par erreur.

La règle devient vraiment utile quand l'outil l'applique à chaque préparation, au lieu de compter sur l'attention du préparateur un vendredi soir.

Votre métier a ses règles ? Parlons-en : lien en bio.

#Logistique #Stock #AntiGaspillage #OutilsSurMesure"""

if __name__ == '__main__':
    ecrire(S['id'], [f"\n<!-- ============ {S['id']} · {S['titre']} (d'après {S['li']}) ============ -->"]
           + ig.sur_mesure(S, 2))
    print(json.dumps(dict(alt=ALT, legende=LEGENDE), ensure_ascii=False))
