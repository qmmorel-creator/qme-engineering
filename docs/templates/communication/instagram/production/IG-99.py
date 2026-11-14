"""Carrousel Instagram IG-99 (Sur mesure), 10/01/2027, adapté de LI-45 « Un chiffrage qui se tape en une
ligne ». Seuls les faits du Google Doc LI-45 sont repris ; aucune capture d'outil, aucune donnée réelle.

Gabarit sur_mesure de construire_ig_06_33.py (importé, non modifié). Usage, depuis la racine du dépôt :
  python3 docs/templates/communication/instagram/production/IG-99.py
Écrit un HTML temporaire, le rend avec rendre.mjs (png/IG-99-chiffrage-1..5.png), puis le supprime.
"""
import importlib.util
import pathlib
import subprocess

ICI = pathlib.Path(__file__).resolve().parent
IG = ICI.parent
spec = importlib.util.spec_from_file_location('ig', IG / 'construire_ig_06_33.py')
ig = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ig)

S = dict(id='IG-99', slug='chiffrage', titre='Sur mesure · Un chiffrage qui se tape en une ligne',
  date='10/01/2027', li='LI-45', sourcil='Sur mesure · calcul métier',
  h1='Un chiffrage qui se tape <mark>en une ligne</mark>.',
  sous="« Peinture murs 45m² 12€ _Lot_1 » devient une ligne de 540 €, rangée dans le lot 1.",
  p2=("Un premier chiffrage se fait souvent au dos d'une enveloppe, ou dans un tableur improvisé.",
      "Ensuite, il faut tout remettre au propre."),
  p2_bas=None,
  v3=('Tapé comme on parle', 'Une ligne, un poste chiffré.', [
      ('carre', '« Peinture murs 45m² 12€ _Lot_1 »', "45 m² à 12 € l'unité : 540 €, dans la section « Lot 1 ».", None),
      ('rond', '« Installation ft 800€ »', 'Un forfait à 800 €.', None),
      ('barres', 'Des sections qui se replient', 'Avec leurs sous-totaux ; en bas, total HT, TVA modifiable et TTC.', None)],
      'Exemple illustratif, données fictives'),
  v4=('Et ensuite', "Le premier quart d'heure.", [
      ('Modifiable comme un tableur', "« Copier » pour le coller dans un tableur, export PDF, enregistrement automatique."),
      ('Pas un logiciel de devis complet', "Il sert à savoir si le projet tient dans le budget, avant une demi-journée sur un vrai devis.")]),
  v5=('Votre premier chiffrage, vous le faites où ?', ['Sur un carnet', 'Dans un tableur', 'Dans le logiciel de devis']),
  alt=["Titre « Un chiffrage qui se tape en une ligne. » « Peinture murs 45m² 12€ _Lot_1 » devient une ligne de 540 €, rangée dans le lot 1.",
       "Fond noir : un premier chiffrage se fait souvent au dos d'une enveloppe, ou dans un tableur improvisé. Ensuite, il faut tout remettre au propre.",
       "Tapé comme on parle : « Peinture murs 45m² 12€ _Lot_1 » donne 45 m² à 12 €, soit 540 €, dans la section Lot 1 ; « Installation ft 800€ » donne un forfait à 800 € ; les sections se replient avec leurs sous-totaux, total HT, TVA et TTC. Exemple illustratif.",
       "Le premier quart d'heure : tableau modifiable comme un tableur, copie vers un tableur, export PDF, enregistrement automatique. Pas un logiciel de devis complet : il dit si le projet tient dans le budget.",
       "Fond rouge : votre premier chiffrage, vous le faites où ? Sur un carnet, dans un tableur, dans le logiciel de devis. Votre métier a ses règles ? Parlons-en : lien en bio."],
  legende="""« Peinture murs 45m² 12€ _Lot_1 » : tapé tel quel, ça devient une ligne chiffrée de 540 €.

Un premier chiffrage se fait souvent au dos d'une enveloppe ou dans un tableur improvisé, puis il faut tout remettre au propre. Dans l'outil de gestion que je conçois et utilise, il se tape comme on parle :
▪ « Peinture murs 45m² 12€ _Lot_1 » donne 45 m² à 12 € l'unité, soit 540 €, rangés dans la section « Lot 1 » ;
▪ « Installation ft 800€ » donne un forfait à 800 €.

Les sections se replient avec leurs sous-totaux ; en bas, le total HT, la TVA modifiable et le TTC. Le tableau reste modifiable comme un tableur, se copie dans un tableur ou part en PDF.

Ce n'est pas un logiciel de devis complet. Il sert au premier quart d'heure, celui où l'on sait si le projet tient dans le budget, avant de passer une demi-journée sur un vrai devis.

Et vous, ce premier chiffrage, vous le faites où ? Votre métier a ses règles ? Parlons-en : lien en bio.

#Chiffrage #Devis #Artisans #OutilsSurMesure""")


def rendre(s, i):
    source = (IG / 'publications.html').read_text(encoding='utf-8')
    tete = source.split('<!-- ============ IG-01')[0]
    tete = tete.replace('<title>Publications Instagram IG-01 à IG-03</title>', f"<title>Publication Instagram {s['id']}</title>")
    vues = ig.sur_mesure(s, i)
    # Interligne du titre un peu plus grand : le surlignage ne masque pas les jambages de la ligne du dessus.
    vues[0] = vues[0].replace('<h1 style="', '<h1 style="line-height:1.1;')
    corps = [f"\n<!-- ============ {s['id']} · {s['titre']} (d'après {s['li']}) ============ -->"] + vues
    page = (tete + '\n'.join(corps) + '\n\n</body>\n</html>\n').replace('../../../../assets/', '../../../../../assets/')
    tmp = ICI / f"_{s['id']}.html"
    tmp.write_text(page, encoding='utf-8')
    try:
        subprocess.run(['node', str(IG / 'rendre.mjs'), f"production/{tmp.name}"], check=True)
    finally:
        tmp.unlink()


if __name__ == '__main__':
    rendre(S, 2)
    print('\n'.join(f'{k + 1}. {a}' for k, a in enumerate(S['alt'])))
