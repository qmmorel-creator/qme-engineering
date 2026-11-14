"""Carrousel Instagram IG-124 · Sur mesure · le devis se construit sur le vélo (5 vues), adapté de LI-65.

Gabarit sur_mesure de construire_ig_06_33.py ; seuls les faits du Google Doc LI-65 v2 sont repris.
Aucune capture de l'outil d'atelier : schémas et texte seulement.

Usage, depuis la racine du dépôt :
  python3 docs/templates/communication/instagram/production/IG-124.py
→ png/IG-124-devis-velo-1..5.png (HTML temporaire rendu par rendre.mjs, puis supprimé).
"""
import importlib.util
import pathlib
import subprocess

PROD = pathlib.Path(__file__).resolve().parent
ICI = PROD.parent
spec = importlib.util.spec_from_file_location('ig', ICI / 'construire_ig_06_33.py')
ig = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ig)

S = dict(id='IG-124', slug='devis-velo', titre='Sur mesure · Le devis se construit sur le vélo',
  li='LI-65', sourcil='Sur mesure · atelier',
  h1="Le devis se construit sur le <mark>vélo</mark>.",
  sous="En 3D, dans l'outil d'atelier vélo que j'ai conçu.",
  p2=("Le client montre du doigt : « c'est là que ça frotte ».",
      "Le devis, lui, reste une liste."),
  p2_bas=None,
  v3=('Sur le vélo, en 3D', 'Chaque travail à sa place.', [
      ('carre', 'Le vélo du client', "Gabarit (ville, VTT, route, cargo), cadre, roues, freinage.", None),
      ('rond', 'Une pastille numérotée', "Chaque travail est posé sur la pièce concernée.", None),
      ('quart', 'Le devis se remplit', "Ligne, temps, prix des pièces, statut ; le total se recalcule avec le taux horaire.", None)],
      'Présenté sans aucune donnée du client'),
  v4=('Le détail qui compte', 'Le statut le plus urgent.', [
      ('Plusieurs lignes sur la même pièce ?', "La pastille prend le statut le plus urgent."),
      ('« En cours » avant « à faire »', "et « à faire » avant « terminé »."),
      ("Un coup d'œil au vélo", "suffit pour voir ce qui reste.")]),
  v5=('Le devis se fait-il devant le vélo, ou au comptoir ?', ['Le client comprend son devis', 'La facture sort de la même liste']))

ALT = [
    "Titre « Le devis se construit sur le vélo. » En 3D, dans l'outil d'atelier vélo que j'ai conçu.",
    "Fond noir : le client montre du doigt : « c'est là que ça frotte ». Le devis, lui, reste une liste.",
    "Sur le vélo, en 3D : on choisit le gabarit (ville, VTT, route, cargo), le cadre, les roues, le freinage ; chaque travail est posé sur la pièce avec une pastille numérotée ; le devis se remplit à côté, total recalculé.",
    "Le détail qui compte : quand plusieurs lignes portent sur la même pièce, la pastille prend le statut le plus urgent, « en cours » avant « à faire », « à faire » avant « terminé ». Un coup d'œil au vélo suffit.",
    "Fond rouge : le devis se fait-il devant le vélo, ou au comptoir ? Le client comprend son devis, la facture sort de la même liste. Votre métier a ses règles ? Parlons-en : lien en bio.",
]

LEGENDE = """« C'est là que ça frotte. » Le client montre du doigt. Le devis, lui, reste une liste.

Dans l'outil d'atelier vélo que j'ai conçu, le devis se construit sur le vélo lui-même, en 3D. On choisit le gabarit (ville, VTT, route, cargo), le cadre, les roues, le freinage, puis chaque travail est posé sur la pièce concernée avec une pastille numérotée. À côté, le devis se remplit : la ligne, le temps, le prix des pièces, le statut.

Un détail compte beaucoup en atelier : quand plusieurs lignes portent sur la même pièce, la pastille prend le statut le plus urgent. Un coup d'œil au vélo suffit pour voir ce qui reste.

Le client comprend son devis, le mécanicien voit son travail, et la facture sort de la même liste, sans ressaisie.

Votre métier a ses règles ? Parlons-en : lien en bio.

#OutilsSurMesure #Artisan #Réparation #Atelier #Vélo"""


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
    rendre(S['id'], ig.sur_mesure(S, 1))
