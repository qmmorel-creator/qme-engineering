"""Carrousel Instagram IG-106 · Méthode · le changement d'heure et les automatisations (5 vues), adapté de LI-32.

Gabarit sur_mesure de construire_ig_06_33.py ; seuls les faits du Google Doc LI-32 v2 sont repris.

Usage, depuis la racine du dépôt :
  python3 docs/templates/communication/instagram/production/IG-106.py
→ png/IG-106-changement-heure-1..5.png (HTML temporaire rendu par rendre.mjs, puis supprimé).
"""
import importlib.util
import pathlib
import subprocess

PROD = pathlib.Path(__file__).resolve().parent
ICI = PROD.parent
spec = importlib.util.spec_from_file_location('ig', ICI / 'construire_ig_06_33.py')
ig = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ig)

S = dict(id='IG-106', slug='changement-heure', titre="Méthode · Le changement d'heure, piège discret des automatisations",
  li='LI-32', sourcil='Sur mesure · méthode',
  h1="28 mars : vos rapports <mark>décalent</mark> d'une heure ?",
  sous="Le passage à l'heure d'été, piège discret des automatisations.",
  p2=("Un rapport programmé « à 6 h UTC » arrive à 7 h à Paris en hiver.",
      "Et à 8 h en été."),
  p2_bas="La plupart des planificateurs de serveurs fonctionnent en heure universelle, qui ne change jamais.",
  v3=('Le rapport du matin', "À 7 h, heure de Paris, toute l'année.", [
      ('carre', 'Deux planifications', "La même tâche est programmée à 5 h et à 6 h UTC.", None),
      ('rond', 'Une garde', "À chaque exécution, elle regarde l'heure qu'il est à Paris.", None),
      ('quart', 'Une seule passe', "Celle qui tombe à 7 h. L'autre s'arrête aussitôt, sans rien faire.", None)],
      "Dans l'outil de gestion que je conçois et utilise"),
  v4=('Même prudence pour la banque', '2 accès sur 4.', [
      ('4 par jour et par compte', "La DSP2 limite les accès automatiques sans l'utilisateur."),
      ('2 pour la synchronisation planifiée', "Il reste de la marge pour le bouton « Synchroniser »."),
      ('Invisible tant que tout marche', "On le découvre le lundi qui suit le changement d'heure.")]),
  v5=('Vos automatisations partent à quelle heure ?', ['Relances, rapports, sauvegardes', 'En hiver comme en été']))

ALT = [
    "Titre « 28 mars : vos rapports décalent d'une heure ? » Le passage à l'heure d'été, piège discret des automatisations.",
    "Fond noir : un rapport programmé « à 6 h UTC » arrive à 7 h à Paris en hiver, et à 8 h en été. La plupart des planificateurs de serveurs fonctionnent en heure universelle, qui ne change jamais.",
    "Le rapport du matin à 7 h, heure de Paris, toute l'année : deux planifications, à 5 h et à 6 h UTC ; une garde qui regarde l'heure à Paris ; une seule exécution passe, l'autre s'arrête sans rien faire.",
    "Même prudence pour la banque : la DSP2 limite à 4 par jour et par compte les accès automatiques sans l'utilisateur ; la synchronisation planifiée n'en utilise que 2. Invisible tant que tout marche.",
    "Fond rouge : vos automatisations partent à quelle heure ? Relances, rapports, sauvegardes, en hiver comme en été. Votre métier a ses règles ? Parlons-en : lien en bio.",
]

LEGENDE = """Le 28 mars, la France passe à l'heure d'été. Et beaucoup d'automatisations vont se décaler d'une heure, sans bruit.

La plupart des planificateurs de serveurs fonctionnent en heure universelle (UTC), qui ne change jamais. Un rapport programmé « à 6 h UTC » arrive donc à 7 h à Paris en hiver, et à 8 h en été.

Dans l'outil de gestion que je conçois et utilise, le rapport du matin doit arriver à 7 h, heure de Paris, toute l'année. La tâche est planifiée deux fois, à 5 h et à 6 h UTC, et une garde ne laisse passer que celle qui tombe à 7 h à Paris.

Même prudence pour la banque : la DSP2 limite à 4 par jour et par compte les accès automatiques sans l'utilisateur. La synchronisation planifiée n'en utilise que 2.

Ces détails restent invisibles tant que tout marche. On les découvre le lundi qui suit le changement d'heure.

Vos automatisations ont leurs règles ? Parlons-en : lien en bio.

#Automatisation #Fiabilité #Organisation #OutilsSurMesure #PME"""


def rendre(pid, blocs):
    tete = (ICI / 'publications.html').read_text(encoding='utf-8').split('<!-- ============ IG-01')[0]
    tete = tete.replace('<title>Publications Instagram IG-01 à IG-03</title>', f'<title>Publication Instagram {pid}</title>')
    tmp = ICI / f'_{pid}.html'
    tmp.write_text(tete + '\n'.join(blocs) + '\n\n</body>\n</html>\n', encoding='utf-8')
    try:
        subprocess.run(['node', str(ICI / 'rendre.mjs'), tmp.name], check=True)
    finally:
        tmp.unlink()


if __name__ == '__main__':
    rendre(S['id'], ig.sur_mesure(S, 3))
