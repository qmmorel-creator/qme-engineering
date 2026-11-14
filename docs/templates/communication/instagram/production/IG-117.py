"""Carrousel Instagram IG-117 (Méthode), 30/01/2027, adapté de LI-58 « 0,1 + 0,2 = 0,30000000000000004 ».
Seuls les faits du Google Doc LI-58 (v2) sont repris ; aucune capture d'outil, aucune donnée réelle.

Gabarit sur_mesure de construire_ig_06_33.py (importé, non modifié) ; seule la taille du titre de couverture
est réduite ici (nombre long). Usage, depuis la racine du dépôt :
  python3 docs/templates/communication/instagram/production/IG-117.py
Écrit un HTML temporaire, le rend avec rendre.mjs (png/IG-117-centimes-1..5.png), puis le supprime.
"""
import importlib.util
import pathlib
import subprocess

ICI = pathlib.Path(__file__).resolve().parent
IG = ICI.parent
spec = importlib.util.spec_from_file_location('ig', IG / 'construire_ig_06_33.py')
ig = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ig)

S = dict(id='IG-117', slug='centimes', titre='Méthode · 0,1 + 0,2 = 0,30000000000000004',
  date='30/01/2027', li='LI-58', sourcil='Sur mesure · calcul métier',
  h1='0,1 + 0,2 =<br><mark>0,30000000000000004</mark>',
  sous="Tapez-le dans la plupart des langages de programmation. Et ce n'est pas un bug.",
  p2=("Un ordinateur ne peut pas stocker exactement certains nombres à virgule.",
      "Sur un devis de 40 lignes, le total peut finir décalé d'un centime."),
  p2_bas="Et ce centime-là, un client ou un comptable le remarque.",
  v3=('La règle', "Dans tous mes outils qui manipulent de l'argent.", [
      ('carre', 'Des centimes, en entiers', 'Chaque montant est calculé et arrondi en centimes, en nombres entiers.', None),
      ('barres', 'Des totaux exacts', "Ce sont des sommes d'entiers.", None),
      ('rond', "Les euros, à l'affichage", "La conversion en euros ne se fait qu'à ce moment-là.", None)],
      None),
  v4=("Jusqu'à l'échéancier", 'Ni centime de trop, ni centime perdu.', [
      ("L'acompte, arrondi au centime", "Dans l'outil de devis que j'ai conçu."),
      ("Le solde n'est pas un pourcentage", "C'est le TTC moins ce qui a déjà été demandé.")]),
  v5=("Rien ne se voit à l'écran.", ["C'est pour ça qu'il faut le prévoir"]),
  alt=["Titre « 0,1 + 0,2 = 0,30000000000000004 ». Tapez-le dans la plupart des langages de programmation, et ce n'est pas un bug.",
       "Fond noir : un ordinateur ne peut pas stocker exactement certains nombres à virgule. Sur un devis de 40 lignes, le total peut finir décalé d'un centime, et un client ou un comptable le remarque.",
       "La règle dans tous mes outils qui manipulent de l'argent : chaque montant calculé et arrondi en centimes, en nombres entiers ; des totaux qui sont des sommes d'entiers, donc exacts ; la conversion en euros seulement à l'affichage.",
       "Jusqu'à l'échéancier : l'acompte est arrondi au centime, et le solde n'est pas un pourcentage, c'est le TTC moins ce qui a déjà été demandé. Ni centime de trop, ni centime perdu.",
       "Fond rouge : rien ne se voit à l'écran, c'est pour ça qu'il faut le prévoir. Votre métier a ses règles ? Parlons-en : lien en bio."],
  legende="""0,1 + 0,2 = 0,30000000000000004. Tapez-le dans la plupart des langages de programmation.

Il n'y a pas de bug : un ordinateur ne peut pas stocker exactement certains nombres à virgule, et de minuscules écarts s'accumulent. Sur un devis de 40 lignes, ils peuvent décaler le total d'un centime par rapport à la somme des lignes affichées. Ce centime-là, un client ou un comptable le remarque.

Dans tous mes outils qui manipulent de l'argent, la règle est la même :
▪ chaque montant est calculé et arrondi en centimes, en nombres entiers ;
▪ les totaux sont des sommes d'entiers, donc exacts ;
▪ la conversion en euros ne se fait qu'à l'affichage.

Dans l'outil de devis que j'ai conçu, ça va jusqu'à l'échéancier : l'acompte est arrondi au centime, et le solde n'est pas un pourcentage, c'est le TTC moins ce qui a déjà été demandé.

Rien de tout ça ne se voit à l'écran, et c'est pour ça qu'il faut le prévoir. Votre métier a ses règles ? Parlons-en : lien en bio.

#Facturation #Devis #Fiabilité #OutilsSurMesure""")


def rendre(s, i):
    source = (IG / 'publications.html').read_text(encoding='utf-8')
    tete = source.split('<!-- ============ IG-01')[0]
    tete = tete.replace('<title>Publications Instagram IG-01 à IG-03</title>', f"<title>Publication Instagram {s['id']}</title>")
    vues = ig.sur_mesure(s, i)
    # Nombre long : titre de couverture réduit pour tenir sur la largeur.
    vues[0] = vues[0].replace('font-size:104px">', 'font-size:84px">').replace('font-size:112px">', 'font-size:84px">')
    vues[0] = vues[0].replace('<h1 style="', '<h1 style="line-height:1.15;')  # virgules de la 1re ligne visibles
    corps = [f"\n<!-- ============ {s['id']} · {s['titre']} (d'après {s['li']}) ============ -->"] + vues
    page = (tete + '\n'.join(corps) + '\n\n</body>\n</html>\n').replace('../../../../assets/', '../../../../../assets/')
    tmp = ICI / f"_{s['id']}.html"
    tmp.write_text(page, encoding='utf-8')
    try:
        subprocess.run(['node', str(IG / 'rendre.mjs'), f"production/{tmp.name}"], check=True)
    finally:
        tmp.unlink()


if __name__ == '__main__':
    rendre(S, 1)
    print('\n'.join(f'{k + 1}. {a}' for k, a in enumerate(S['alt'])))
