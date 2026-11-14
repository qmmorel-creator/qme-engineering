"""IG-114 · Carrousel « Sur mesure » adapté de LI-55 (Le réapprovisionnement à deux bacs). Seuls les faits du Google Doc LI-55 sont repris ; aucune
capture d'outil client, aucune donnée réelle. Gabarit sur mesure de construire_ig_06_33.py.

Usage, depuis la racine du dépôt :
  python3 docs/templates/communication/instagram/production/IG-114.py
  node docs/templates/communication/instagram/rendre.mjs production/IG-114.html
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
S = dict(id='IG-114', slug='deux-bacs', sourcil='Sur mesure · logistique',
  h1="Ne plus <mark>compter</mark> les vis.", sous="Le réapprovisionnement à deux bacs, pour les petites pièces d'un atelier.",
  p2=("Vis, joints, gants, consommables.",
      "Les compter coûte souvent plus cher que les pièces elles-mêmes."),
  p2_bas="La méthode des deux bacs permet de ne plus compter.",
  v3=('La méthode', 'Deux bacs au poste.', [
      ('carre', 'On consomme dans le premier', "Chaque référence a deux bacs au poste.", None),
      ('rond', 'Le bac vide part au magasin', "Lui, ou son étiquette : c'est lui, la commande. On passe au second.", None),
      ('quart', 'Le second couvre le délai', "Il doit tenir pendant le réapprovisionnement : c'est ce qui fixe sa taille.", None)],
      'Sur papier, ça marche déjà très bien.'),
  v4=("Ce que l'outil ajoute", 'La mesure.', [
      ('Une étiquette scannée', "Au moment où le bac se vide : la demande arrive au magasin ou chez le fournisseur, sans ressaisie."),
      ('Le délai réel suivi', "Du scan au retour du bac plein."),
      ('Une alerte', "Quand ce délai dépasse ce que le second bac couvre : agrandir les bacs, ou changer de fournisseur.")]),
  v5=('Combien de temps passez-vous à compter ?', ['Ateliers, garages', 'Cuisines professionnelles']))

ALT = [
    "Titre « Ne plus compter les vis. » Le réapprovisionnement à deux bacs, pour les petites pièces d'un atelier.",
    "Fond noir : vis, joints, gants, consommables : les compter coûte souvent plus cher que les pièces elles-mêmes. La méthode des deux bacs permet de ne plus compter.",
    "La méthode : deux bacs au poste par référence ; quand le premier est vide, il part au magasin et c'est lui la commande ; le second doit couvrir le délai de réapprovisionnement, ce qui fixe sa taille. Sur papier, ça marche déjà.",
    "Ce que l'outil ajoute : une étiquette scannée quand le bac se vide, la demande part sans ressaisie ; le délai réel suivi jusqu'au retour du bac plein ; une alerte quand ce délai dépasse ce que couvre le second bac.",
    "Fond rouge : combien de temps passez-vous à compter ? Ateliers, garages, cuisines professionnelles. Votre métier a ses règles ? Parlons-en : lien en bio.",
]

if __name__ == '__main__':
    ecrire(S['id'], [f"\n<!-- ============ {S['id']} · Le réapprovisionnement à deux bacs (d'après LI-55) ============ -->"]
           + ig.sur_mesure(S, 0))
    print(json.dumps(ALT, ensure_ascii=False))
