"""IG-116 · Carrousel « Sur mesure » adapté de LI-57 (Effacer un client sans casser ses chiffres). Seuls les faits du Google Doc LI-57 sont repris ;
aucune capture d'outil client, aucune donnée réelle. Gabarit sur mesure de construire_ig_06_33.py.

Usage, depuis la racine du dépôt :
  python3 docs/templates/communication/instagram/production/IG-116.py
  node docs/templates/communication/instagram/rendre.mjs production/IG-116.html
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


S = dict(id='IG-116', slug='anonymiser', titre='Sur mesure · Effacer un client sans casser ses chiffres', li='LI-57',
  sourcil='Sur mesure · cas réel',
  h1="Effacer un client <mark>sans casser</mark> ses chiffres.", sous="Une demande RGPD, une seule action.",
  p2=("« Supprimez mes données. »",
      "Dans un tableur, effacer la ligne du client efface aussi ses ventes du chiffre d'affaires de l'année."),
  p2_bas="La demande est légitime, le RGPD la prévoit.",
  v3=('Une action : anonymiser', 'La fiche se vide, les ventes restent.', [
      ('carre', 'Données effacées', "Les données personnelles disparaissent, la fiche devient « Client anonymisé ».", None),
      ('barres', 'Chiffres intacts', "Les ventes restent rattachées : chiffre d'affaires, TVA et statistiques ne bougent pas.", None),
      ('rond', 'Confirmation explicite', "L'une des rares actions où un simple « Annuler » ne suffirait pas.", None)],
      'Cas réel, présenté sans aucune donnée du client'),
  v4=("Avant d'anonymiser", "L'autre droit du RGPD.", [
      ('Exporter les données', "Il reste possible d'obtenir les données du client avant de les effacer."),
      ('Pensé dès la base', "Ce détail touche la structure des données : il s'ajoute mal après coup.")]),
  v5=("Une demande d'effacement, chez vous ?", ["Pensée au moment de dessiner la base", "Pas à la réception de la première demande"]))

ALT = [
 "Titre « Effacer un client sans casser ses chiffres. » Une demande RGPD, une seule action.",
 "Fond noir : « Supprimez mes données. » Dans un tableur, effacer la ligne du client efface aussi ses ventes du chiffre d'affaires de l'année. La demande est légitime, le RGPD la prévoit.",
 "Une action, anonymiser : les données personnelles sont effacées et la fiche devient « Client anonymisé » ; les ventes restent rattachées, chiffre d'affaires, TVA et statistiques intacts ; confirmation explicite. Cas réel, sans donnée du client.",
 "Avant d'anonymiser : exporter les données du client, l'autre droit du RGPD. Un détail pensé dès la base, parce qu'il s'ajoute mal après coup.",
 "Fond rouge : une demande d'effacement, chez vous ? Pensée au moment de dessiner la base. Votre métier a ses règles ? Parlons-en : lien en bio.",
]

LEGENDE = """« Supprimez mes données. » Dans un tableur, effacer ce client efface aussi ses ventes du chiffre d'affaires.

La demande est légitime, le RGPD la prévoit. Dans l'outil de boutique que j'ai conçu, la réponse tient en une action : anonymiser.

Les données personnelles sont effacées et la fiche devient « Client anonymisé ». Les ventes restent rattachées à cette fiche vide : chiffre d'affaires, TVA et statistiques ne bougent pas. L'action demande une confirmation explicite : c'est l'une des rares où un simple « Annuler » ne suffirait pas.

Avant d'anonymiser, il reste possible d'exporter les données du client. C'est l'autre droit prévu par le RGPD.

Ce genre de détail s'ajoute mal après coup. Je préfère y penser en dessinant la base, plutôt qu'à la réception de la première demande.

Votre métier a ses règles ? Parlons-en : lien en bio.

#RGPD #DonnéesPersonnelles #Commerce #OutilsSurMesure"""

if __name__ == '__main__':
    ecrire(S['id'], [f"\n<!-- ============ {S['id']} · {S['titre']} (d'après {S['li']}) ============ -->"]
           + ig.sur_mesure(S, 3))
    print(json.dumps(dict(alt=ALT, legende=LEGENDE), ensure_ascii=False))
