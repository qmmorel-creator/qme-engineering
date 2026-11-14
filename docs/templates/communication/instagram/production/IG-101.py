"""Carrousel Instagram IG-101 (Sur mesure · WOD Motion, d'une épreuve écrite à un spot), 12/01/2027, adapté de LI-17 (Google Doc du planning LinkedIn).

Seuls les faits du post LinkedIn sont repris ; aucune capture d'outil client, aucune donnée réelle.
Gabarit sur_mesure de construire_ig_06_33.py (importé, non modifié).
Usage, depuis la racine du dépôt :
  python3 docs/templates/communication/instagram/production/IG-101.py
  node docs/templates/communication/instagram/rendre.mjs production/IG-101.html
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

S = dict(id='IG-101', slug='wod-motion', titre="Sur mesure · D'une épreuve écrite à un spot de 30 secondes",
  sourcil='Sur mesure · automatisation',
  h1="<mark>Un spot</mark> de 30 secondes, depuis une épreuve écrite.", sous="Sans monteur vidéo.",
  p2=("« 3 tours : 15 wall balls, 12 burpees box jump overs, 9 power cleans à 60 kg. Time cap 12 minutes. »",
      "L'épreuve, telle que l'organisateur l'écrit."),
  p2_bas="Souvent annoncée avec une simple image et du texte.",
  v3=('WOD Motion', 'Quatre étapes.', [
      ('carre', 'Structurer', 'Une fiche de données : mouvements, répétitions, charge, plage du chrono.', None),
      ('quart', 'Animer', 'Une silhouette par mouvement, qui fait le vrai geste, avec compteur et chrono.', None),
      ('rond', 'Habiller', 'Ouverture sur le logo, couleurs de la salle, carton final.', None),
      ('barres', 'Sonoriser, exporter', "Une musique composée par l'outil, sans droits à payer ; un MP4 de 30 s.", None)],
      'Compétition fictive'),
  v4=('Au-delà du sport', 'Une donnée devient un contenu.', [
      ('Une fiche produit', 'qui devient un visuel.'),
      ('Une programmation', 'qui devient une affiche.'),
      ('Un résultat', 'qui devient une publication.')]),
  v5=('Vos données pourraient-elles devenir vos visuels ?', ['Même rendu pour chaque épreuve', 'Le spot fictif : rubrique Vidéos du site']))
out = ig.sur_mesure(S, 1)
out[2] = out[2].replace('<div class="roles">', '<div class="roles" style="gap:18px;top:340px">')
ecrire(S['id'], S['titre'], 'LI-17', out)
