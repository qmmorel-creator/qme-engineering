"""Carrousel Instagram IG-119 (Méthode · Le prototype avant le cahier des charges), 01/02/2027, adapté de LI-60 (Google Doc du planning LinkedIn).

Seuls les faits du post LinkedIn sont repris ; aucune capture d'outil client, aucune donnée réelle.
Gabarit sur_mesure de construire_ig_06_33.py (importé, non modifié).
Usage, depuis la racine du dépôt :
  python3 docs/templates/communication/instagram/production/IG-119.py
  node docs/templates/communication/instagram/rendre.mjs production/IG-119.html
"""
import importlib.util
import pathlib

ICI = pathlib.Path(__file__).resolve().parent
IG_DIR = ICI.parent
spec = importlib.util.spec_from_file_location('ig', IG_DIR / 'construire_ig_06_33.py')
ig = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ig)


def ecrire(pid, titre, li, sections):
    source = (IG_DIR / 'publications.html').read_text(encoding='utf-8')
    tete = source.split('<!-- ============ IG-01')[0].replace("'../../../../assets/", "'../../../../../assets/")
    tete = tete.replace('<title>Publications Instagram IG-01 à IG-03</title>', f'<title>Publication Instagram {pid}</title>')
    corps = [f"\n<!-- ============ {pid} · {titre} (d'après {li}) ============ -->"] + sections
    (ICI / f'{pid}.html').write_text(tete + '\n'.join(corps) + '\n\n</body>\n</html>\n', encoding='utf-8')

S = dict(id='IG-119', slug='prototype', titre='Méthode · Le prototype avant le cahier des charges',
  sourcil='Sur mesure · méthode',
  h1="Le prototype <mark>avant</mark> le cahier des charges.", sous="Je montre avant d'écrire.",
  p2=("Vingt pages décrivent un outil que personne n'a encore vu.",
      "Trois mois plus tard, on découvre que ce n'était pas ça."),
  p2_bas=None,
  v3=('Ma méthode', 'Montrer, puis écrire.', [
      ('carre', 'Un premier échange', 'Puis je construis une maquette cliquable.', None),
      ('quart', 'Les mots du métier', 'Et des données fictives crédibles.', None),
      ('rond', 'On la regarde ensemble', '« Ce statut n\'existe pas chez nous. » Chaque correction m\'apprend une règle du métier.', None)],
      None),
  v4=('Ensuite seulement', 'Le cahier des charges.', [
      ('Beaucoup plus court', 'Il décrit quelque chose que tout le monde a vu.'),
      ("Pas pour aller plus vite", "à tout prix."),
      ('Pour se tromper tôt', 'Quand se tromper ne coûte presque rien.')]),
  v5=('Une règle évidente chez vous, écrite nulle part ?', ['Elle apparaîtra sur la maquette', 'Avant le cahier des charges']))
ecrire(S['id'], S['titre'], 'LI-60', ig.sur_mesure(S, 3))
