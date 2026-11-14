"""Carrousel Instagram IG-111 (Sur mesure), 24/01/2027, adapté de LI-52 « 900 images pour 30 secondes ».
Seuls les faits du Google Doc LI-52 (v2) sont repris ; aucune capture d'outil, aucune donnée réelle, aucune
marque tierce ni nom d'outil interne (règles de IDEES.md).

Gabarit sur_mesure de construire_ig_06_33.py (importé, non modifié). Usage, depuis la racine du dépôt :
  python3 docs/templates/communication/instagram/production/IG-111.py
Écrit un HTML temporaire, le rend avec rendre.mjs (png/IG-111-900-images-1..5.png), puis le supprime.
"""
import importlib.util
import pathlib
import subprocess

ICI = pathlib.Path(__file__).resolve().parent
IG = ICI.parent
spec = importlib.util.spec_from_file_location('ig', IG / 'construire_ig_06_33.py')
ig = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ig)

S = dict(id='IG-111', slug='900-images', titre='Sur mesure · 900 images pour 30 secondes',
  date='24/01/2027', li='LI-52', sourcil='Sur mesure · automatisation',
  h1='<mark>900 images</mark> pour 30 secondes de vidéo.',
  sous="Aucune n'est dessinée à la main.",
  p2=("30 secondes à 30 images par seconde : 900 images.",
      "Chacune est calculée à partir d'une fiche de données."),
  p2_bas="L'épreuve sportive, ses mouvements, ses répétitions, la plage du chrono, les couleurs de la salle.",
  v3=('Le spot', 'Fabriqué depuis la fiche.', [
      ('quart', 'Un segment par mouvement', 'La silhouette qui fait le geste, le compteur de répétitions et le chrono.', None),
      ('carre', 'Un écran final', 'Avec le résultat, après le titre et le logo en ouverture.', None),
      ('rond', "Une musique composée par l'outil", 'À 125 battements par minute, un impact calé sur chaque transition.', None)],
      None),
  v4=('Le plus long', 'Rendre le résultat prévisible.', [
      ('La même fiche, le même spot', 'Toujours.'),
      ("Une planche de contrôle avant l'export", "Quelques images clés côte à côte : tout se vérifie en un coup d'œil."),
      ('Même logique pour un devis ou un planning', 'Quand la donnée est bien structurée, le document se fabrique tout seul.')]),
  v5=('Quel document refaites-vous encore à la main ?', ['Alors que ses données existent déjà quelque part']),
  alt=["Titre « 900 images pour 30 secondes de vidéo. » Aucune n'est dessinée à la main.",
       "Fond noir : 30 secondes à 30 images par seconde, 900 images, chacune calculée à partir d'une fiche de données : l'épreuve sportive, ses mouvements, ses répétitions, la plage du chrono, les couleurs de la salle.",
       "Le spot fabriqué depuis la fiche : un segment par mouvement avec la silhouette, le compteur de répétitions et le chrono ; un écran final avec le résultat ; une musique composée par l'outil à 125 battements par minute.",
       "Le plus long : rendre le résultat prévisible. La même fiche donne toujours le même spot ; une planche de contrôle avant l'export ; même logique pour un devis ou un planning.",
       "Fond rouge : quel document refaites-vous encore à la main, alors que ses données existent déjà ? Votre métier a ses règles ? Parlons-en : lien en bio."],
  legende="""900 images pour un spot de 30 secondes. Aucune n'est dessinée à la main.

30 secondes à 30 images par seconde, en 1920 × 1080. Chaque image est calculée à partir d'une fiche de données : l'épreuve sportive, ses mouvements, ses répétitions, la plage du chrono, les couleurs de la salle.

Le spot s'ouvre sur le titre et le logo, puis un segment par mouvement, avec la silhouette qui fait le geste, le compteur de répétitions et le chrono. Un écran final donne le résultat, sur une musique composée par l'outil, à 125 battements par minute.

Honnêtement, animer les silhouettes n'a pas été le plus long. Le plus long a été de rendre le résultat prévisible : la même fiche donne toujours le même spot, et une planche de contrôle permet de tout vérifier avant l'export.

C'est la même logique qu'un devis ou un planning : quand la donnée est bien structurée, le document se fabrique tout seul.

Quel document refaites-vous encore à la main ? Votre métier a ses règles ? Parlons-en : lien en bio.

#Automatisation #MotionDesign #Vidéo #OutilsSurMesure""")


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
    rendre(S, 0)
    print('\n'.join(f'{k + 1}. {a}' for k, a in enumerate(S['alt'])))
