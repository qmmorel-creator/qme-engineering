"""IG-103 · Carrousel « Sur mesure » adapté de LI-30 (Changer de série moins souvent, sans livrer en retard). Seuls les faits du Google Doc LI-30 sont
repris ; aucune capture d'outil client, aucune donnée réelle. Gabarit sur mesure de construire_ig_06_33.py.

Usage, depuis la racine du dépôt :
  python3 docs/templates/communication/instagram/production/IG-103.py
  node docs/templates/communication/instagram/rendre.mjs production/IG-103.html
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


S = dict(id='IG-103', slug='changements-serie', sourcil='Sur mesure · industrie',
  h1="<mark>5 changements</mark> de série, ou 2.", sous="Mêmes six ordres, mêmes dates de livraison. Seul l'ordre de passage change.",
  p2=("Réglages, nettoyage, premières pièces à contrôler.",
      "Une heure ici, quarante minutes là, plusieurs fois par jour."),
  p2_bas="Une partie se gagne sur la machine. Une autre sur le planning, sans toucher à la machine.",
  v3=('Exemple fictif', 'Six ordres, une ligne de conditionnement.', [
      ('barres', "Dans l'ordre d'arrivée", "A, B, A, C, B, A : 5 changements de série.", None),
      ('carre', 'Regroupés par famille', "A, A, A, B, B, C : 2, sans dépasser aucune date de livraison.", None)],
      'Exemple fictif'),
  v4=("L'outil que je construirais", "L'ordre de passage, chiffré en heures.", [
      ('Chaque ordre', 'Sa famille, sa durée, sa date de besoin.'),
      ('Une matrice des changements', "Passer de clair à foncé n'est pas comme l'inverse."),
      ('En rouge, le retard', "Tout ordre qui finirait après sa date de besoin. La décision reste au planificateur.")]),
  v5=('Votre ordre de passage, vous le fixez comment ?', ["À l'arrivée, par famille, à l'expérience ?", "L'outil ne remplace pas le savoir de l'atelier"]))

ALT = [
    "Titre « 5 changements de série, ou 2. » Mêmes six ordres, mêmes dates de livraison ; seul l'ordre de passage change.",
    "Fond noir : réglages, nettoyage, premières pièces à contrôler. Une heure ici, quarante minutes là, plusieurs fois par jour. Une partie se gagne sur la machine, une autre sur le planning.",
    "Exemple fictif, six ordres sur une ligne de conditionnement : dans l'ordre d'arrivée (A, B, A, C, B, A), 5 changements de série ; regroupés par famille (A, A, A, B, B, C), 2, sans dépasser aucune date de livraison.",
    "L'outil que je construirais : chaque ordre a sa famille, sa durée et sa date de besoin ; une matrice des temps de changement entre familles ; en rouge, tout ordre qui finirait en retard. La décision reste au planificateur.",
    "Fond rouge : votre ordre de passage, vous le fixez comment ? À l'arrivée, par famille, à l'expérience. Votre métier a ses règles ? Parlons-en : lien en bio.",
]

if __name__ == '__main__':
    ecrire(S['id'], [f"\n<!-- ============ {S['id']} · Changer de série moins souvent, sans livrer en retard (d'après LI-30) ============ -->"]
           + ig.sur_mesure(S, 2))
    print(json.dumps(ALT, ensure_ascii=False))
