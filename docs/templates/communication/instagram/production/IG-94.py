"""Carrousel Instagram IG-94 · Sur mesure · ravitaillement d'un ultra-trail (5 vues), adapté de LI-02.

Gabarit sur_mesure de construire_ig_06_33.py ; seuls les faits du Google Doc LI-02 v2 sont repris
(console de course conçue par Quentin, ultra fictif de 112 km). Aucune capture d'outil client.

Usage, depuis la racine du dépôt :
  python3 docs/templates/communication/instagram/production/IG-94.py
→ png/IG-94-ravito-1..5.png (HTML temporaire rendu par rendre.mjs, puis supprimé).
"""
import importlib.util
import pathlib
import subprocess

PROD = pathlib.Path(__file__).resolve().parent
ICI = PROD.parent
spec = importlib.util.spec_from_file_location('ig', ICI / 'construire_ig_06_33.py')
ig = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ig)

S = dict(id='IG-94', slug='ravito', titre="Sur mesure · Combien de litres d'eau au ravito du km 55 ?",
  li='LI-02', sourcil='Sur mesure · cas concret',
  h1="Combien de litres d'eau au <mark>km 55</mark> ?",
  sous="Un coureur qui a abandonné au km 27 ne boit pas au km 55.",
  p2=("Au ravitaillement d'un ultra-trail, on répond souvent « beaucoup ».",
      "Sur la console de course que j'ai conçue, on calcule."),
  p2_bas="Exemple : un ultra fictif de 112 km.",
  v3=('Le stock de départ', 'Une règle écrite.', [
      ('carre', 'Coureurs attendus', "Ceux qui peuvent encore atteindre ce point, pas tous les inscrits.", None),
      ('rond', '× consommation par passage', "Eau 0,6 L, isotonique 0,25 L, soupe 0,22 L, solide 0,15 kg.", None),
      ('quart', '× 1,25', "25 % de plus pour les imprévus : la chaleur, les arrêts plus longs.", None)],
      'Ultra fictif de 112 km, données fictives'),
  v4=('Pendant la course', 'La jauge baisse en direct.', [
      ('Chaque passage pointé', "fait baisser la jauge du ravitaillement."),
      ('Huit barrières horaires', "De 4 h 30 au km 14 jusqu'à 37 h à l'arrivée, au km 112."),
      ('« Hors barrière »', "Le coureur qui dépasse sa marge apparaît aussitôt au PC course.")]),
  v5=('Vous préparez des quantités pour un public ?', ["Traiteur, buvette, festival, séminaire", "Une règle écrite plutôt qu'une estimation de tête"]))

ALT = [
    "Titre « Combien de litres d'eau au km 55 ? » Un coureur qui a abandonné au km 27 ne boit pas au km 55.",
    "Fond noir : au ravitaillement d'un ultra-trail, on répond souvent « beaucoup ». Sur la console de course que j'ai conçue, on calcule. Exemple : un ultra fictif de 112 km.",
    "Le stock de départ : coureurs attendus à ce point (pas tous les inscrits) × consommation par passage (eau 0,6 L, isotonique 0,25 L, soupe 0,22 L, solide 0,15 kg) × 1,25 pour les imprévus. Données fictives.",
    "Pendant la course : chaque passage pointé fait baisser la jauge du ravitaillement ; huit barrières horaires, de 4 h 30 au km 14 à 37 h au km 112 ; le coureur hors barrière apparaît aussitôt au PC course.",
    "Fond rouge : vous préparez des quantités pour un public ? Traiteur, buvette, festival, séminaire : une règle écrite plutôt qu'une estimation de tête. Votre métier a ses règles ? Parlons-en : lien en bio.",
]

LEGENDE = """Un coureur qui a abandonné au km 27 ne boit pas au km 55. Alors combien de litres d'eau poser à ce ravitaillement ?

Sur la console de course que j'ai conçue, pour un ultra fictif de 112 km, la réponse n'est pas « beaucoup ». C'est un calcul : les coureurs qui peuvent encore atteindre ce point, multipliés par la consommation par passage (0,6 L d'eau, 0,25 L d'isotonique, 0,22 L de soupe, 0,15 kg de solide), plus 25 % pour la chaleur et les arrêts qui s'allongent.

Ensuite, chaque passage pointé fait baisser la jauge en direct, et le PC course voit aussitôt un coureur passer hors barrière horaire.

Traiteur, buvette d'association, festival, séminaire : dès que le public fond ou grossit dans la journée, une règle simple et écrite vaut mieux qu'une estimation de tête.

Votre métier a ses règles ? Parlons-en : lien en bio.

#OutilsSurMesure #Événementiel #Trail #Logistique #Organisation"""


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
    rendre(S['id'], ig.sur_mesure(S, 0))
