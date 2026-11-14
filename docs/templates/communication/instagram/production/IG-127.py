"""IG-127 · Carrousel « Sur mesure » adapté de LI-68 (Les mots du métier). Seuls les faits du Google Doc LI-68 sont
repris ; aucune capture d'outil client, aucune donnée réelle. Gabarit sur mesure de construire_ig_06_33.py.

Usage, depuis la racine du dépôt :
  python3 docs/templates/communication/instagram/production/IG-127.py
  node docs/templates/communication/instagram/rendre.mjs production/IG-127.html
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


S = dict(id='IG-127', slug='mots-metier', sourcil='Sur mesure · méthode',
  h1="Les mots <mark>du métier</mark>.", sous="Pour un outil, le design compte moins que les mots.",
  p2=("Dans un atelier vélo, on ne dit pas « commande » mais « fiche ».",
      "Et pas « client arrivé » mais « vélo déposé »."),
  p2_bas=None,
  v3=('Ailleurs aussi', 'Chaque métier a ses mots.', [
      ('rond', 'Une crèche', "« Familles » plutôt qu'« utilisateurs » ; des « heures prévues au contrat ».", None),
      ('carre', 'Un entrepôt', "Un « lot » et une « référence » ne sont pas la même chose.", None),
      ('quart', "À l'écran", "Les confondre suffit à perdre la confiance d'un magasinier.", None)],
      None),
  v4=('Avant de dessiner un écran', 'Je relève le vocabulaire.', [
      ('Le site, les documents, les mails', 'Les statuts vraiment utilisés, les unités, les étapes.'),
      ('Repris tels quels', "Un outil qui parle comme son métier s'adopte sans formation.")]),
  v5=('Quel mot de votre métier est mal traduit ?', ['Un outil qui parle comme un logiciel', 'oblige chacun à traduire, toute la journée']))

ALT = [
    "Titre « Les mots du métier. » Pour un outil, le design compte moins que les mots.",
    "Fond noir : dans un atelier vélo, on ne dit pas « commande » mais « fiche », et pas « client arrivé » mais « vélo déposé ».",
    "Ailleurs aussi : une crèche parle de « familles » et d'« heures prévues au contrat » ; dans un entrepôt, un « lot » et une « référence » ne sont pas la même chose ; les confondre à l'écran suffit à perdre la confiance d'un magasinier.",
    "Avant de dessiner un écran, je relève le vocabulaire du site, des documents et des mails, puis je le reprends tel quel : un outil qui parle comme son métier s'adopte sans formation.",
    "Fond rouge : quel mot de votre métier est mal traduit ? Un outil qui parle comme un logiciel oblige chacun à traduire. Votre métier a ses règles ? Parlons-en : lien en bio.",
]

if __name__ == '__main__':
    ecrire(S['id'], [f"\n<!-- ============ {S['id']} · Les mots du métier (d'après LI-68) ============ -->"]
           + ig.sur_mesure(S, 2))
    print(json.dumps(ALT, ensure_ascii=False))
