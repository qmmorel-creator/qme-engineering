"""Carrousel Instagram IG-125 (Sur mesure · Retours et SAV), 07/02/2027, adapté de LI-66 (Google Doc du planning LinkedIn).

Seuls les faits du post LinkedIn sont repris ; aucune capture d'outil client, aucune donnée réelle.
Gabarit sur_mesure de construire_ig_06_33.py (importé, non modifié).
Usage, depuis la racine du dépôt :
  python3 docs/templates/communication/instagram/production/IG-125.py
  node docs/templates/communication/instagram/rendre.mjs production/IG-125.html
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

S = dict(id='IG-125', slug='retours-sav', titre='Sur mesure · Retours et SAV : chaque produit a son dossier',
  sourcil='Sur mesure · service client',
  h1="<mark>Où en est</mark> ce retour produit ?", sous="Le circuit des retours, en quatre étapes.",
  p2=("Service client, magasin, atelier, comptabilité.",
      "Trois semaines plus tard, le client rappelle. Personne ne sait vraiment."),
  p2_bas=None,
  v3=('Le circuit que je construirais', 'Chaque produit a son dossier.', [
      ('carre', '1. Une demande numérotée', "Avant l'envoi : le client sait quoi écrire sur le colis.", None),
      ('quart', '2. Un diagnostic au poste', 'Constat, photo, cause probable dans une liste courte.', None),
      ('rond', '3. Une décision tracée', "Réparation, échange, avoir ou refus motivé : la suite se déclenche.", None),
      ('barres', '4. Un suivi visible', 'Par le client, et des statistiques par produit et par cause.', None)],
      'Exemple illustratif'),
  v4=('Le point qui manque', 'Souvent, le quatrième.', [
      ('Traiter un retour vite', 'Ça satisfait un client.'),
      ("L'analyser", "Ça aide à en éviter d'autres."),
      ('La question à se poser', 'La première cause de retour de votre produit le plus vendu ?')]),
  v5=('Fabricant, e\u2011commerçant ou réparateur ?', ['Des retours suivis du colis à la cause', 'Avec vos décisions et vos étapes']))
out = ig.sur_mesure(S, 4)
out[2] = out[2].replace('<div class="roles">', '<div class="roles" style="gap:18px;top:340px">')
ecrire(S['id'], S['titre'], 'LI-66', out)
