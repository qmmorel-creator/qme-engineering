"""Carrousel Instagram IG-93 (Méthode), 02/01/2027, adapté de LI-43 « Préparer les commandes par vagues,
pas une par une ». Seuls les faits du Google Doc LI-43 sont repris ; aucune capture d'outil, aucune donnée réelle.

Gabarit sur_mesure de construire_ig_06_33.py (importé, non modifié). Usage, depuis la racine du dépôt :
  python3 docs/templates/communication/instagram/production/IG-93.py
Écrit un HTML temporaire, le rend avec rendre.mjs (png/IG-93-vagues-1..5.png), puis le supprime.
"""
import importlib.util
import pathlib
import subprocess

ICI = pathlib.Path(__file__).resolve().parent
IG = ICI.parent
spec = importlib.util.spec_from_file_location('ig', IG / 'construire_ig_06_33.py')
ig = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ig)

S = dict(id='IG-93', slug='vagues', titre='Méthode · Préparer les commandes par vagues',
  date='02/01/2027', li='LI-43', sourcil='Sur mesure · méthode',
  h1='Préparer les commandes <mark>par vagues</mark>.',
  sous="Pas une par une. La méthode en quatre temps, pour un petit entrepôt ou un e-commerçant.",
  p2=("Traiter les commandes une par une, c'est repasser dix fois dans la même allée.",
      "Sur une journée, ça fait des kilomètres."),
  p2_bas=None,
  v3=('Les trois premiers temps', 'De la vague à la liste.', [
      ('carre', '1. Regrouper en vagues', "Par exemple, toutes les commandes qui partent avec le même transporteur à 15 h.", None),
      ('barres', '2. Additionner par article', "12 commandes contiennent l'article X : on en prend 17 d'un coup.", None),
      ('quart', '3. Trier dans l\'ordre du parcours', 'Allée 1, allée 2, allée 3, sans retour en arrière.', None)],
      'Exemple illustratif, données fictives'),
  v4=('Le quatrième temps', 'Le contrôle au colisage.', [
      ('4. Répartir par commande', "Au poste de colisage, avec un scan : la bonne référence, la bonne quantité, dans le bon carton."),
      ("L'essentiel du gain : l'étape 3", "Un parcours qui suit les emplacements, pas l'ordre de saisie des commandes."),
      ('Le vrai premier chantier', "Que chaque article ait un emplacement connu.")]),
  v5=("L'ordre des commandes, ou celui des allées ?", ['Vos listes de préparation suivent lequel ?']),
  alt=["Titre « Préparer les commandes par vagues. » Pas une par une : la méthode en quatre temps, pour un petit entrepôt ou un e-commerçant.",
       "Fond noir : traiter les commandes une par une, c'est repasser dix fois dans la même allée. Sur une journée, ça fait des kilomètres.",
       "Les trois premiers temps : regrouper les commandes en vagues (même transporteur à 15 h) ; additionner les quantités par article (12 commandes contiennent l'article X, on en prend 17 d'un coup) ; trier la liste dans l'ordre du parcours, allée 1, 2, 3. Exemple illustratif.",
       "Le quatrième temps : répartir par commande au poste de colisage, avec un contrôle par scan. L'essentiel du gain vient de l'étape 3 ; le vrai premier chantier : un emplacement connu pour chaque article.",
       "Fond rouge : l'ordre des commandes, ou celui des allées ? Votre métier a ses règles ? Parlons-en : lien en bio."],
  legende="""Traiter les commandes une par une, c'est repasser dix fois dans la même allée.

Sur une journée, ça fait des kilomètres. Pour un petit entrepôt ou un e-commerçant, je construirais plutôt la préparation en quatre temps.

1. Regrouper les commandes en vagues : par exemple, toutes celles qui partent avec le même transporteur à 15 h.
2. Additionner les quantités par article sur la vague : 12 commandes contiennent l'article X, on en prend 17 d'un coup.
3. Trier la liste de prélèvement dans l'ordre du parcours : allée 1, allée 2, allée 3, sans retour en arrière.
4. Répartir ensuite par commande au poste de colisage, avec un contrôle par scan.

L'essentiel du gain vient de l'étape 3. Encore faut-il que chaque article ait un emplacement connu : c'est souvent là que se trouve le vrai premier chantier.

Vos listes suivent-elles l'ordre des commandes, ou celui des allées ? Votre métier a ses règles ? Parlons-en : lien en bio.

#Logistique #Entrepôt #ECommerce #OutilsSurMesure""")


def rendre(s, i):
    source = (IG / 'publications.html').read_text(encoding='utf-8')
    tete = source.split('<!-- ============ IG-01')[0]
    tete = tete.replace('<title>Publications Instagram IG-01 à IG-03</title>', f"<title>Publication Instagram {s['id']}</title>")
    corps = [f"\n<!-- ============ {s['id']} · {s['titre']} (d'après {s['li']}) ============ -->"] + ig.sur_mesure(s, i)
    page = (tete + '\n'.join(corps) + '\n\n</body>\n</html>\n').replace('../../../../assets/', '../../../../../assets/')
    tmp = ICI / f"_{s['id']}.html"
    tmp.write_text(page, encoding='utf-8')
    try:
        subprocess.run(['node', str(IG / 'rendre.mjs'), f"production/{tmp.name}"], check=True)
    finally:
        tmp.unlink()


if __name__ == '__main__':
    rendre(S, 1)
    print('\n'.join(f'{k + 1}. {a}' for k, a in enumerate(S['alt'])))
