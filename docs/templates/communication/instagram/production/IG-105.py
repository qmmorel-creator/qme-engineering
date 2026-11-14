"""Carrousel Instagram IG-105 (Méthode), 17/01/2027, adapté de LI-31 « Repérer une dépense anormale avec deux
règles simples ». Seuls les faits du Google Doc LI-31 (v2) sont repris ; aucune capture d'outil, aucune donnée réelle.

Gabarit sur_mesure de construire_ig_06_33.py (importé, non modifié). Usage, depuis la racine du dépôt :
  python3 docs/templates/communication/instagram/production/IG-105.py
Écrit un HTML temporaire, le rend avec rendre.mjs (png/IG-105-depense-anormale-1..5.png), puis le supprime.
"""
import importlib.util
import pathlib
import subprocess

ICI = pathlib.Path(__file__).resolve().parent
IG = ICI.parent
spec = importlib.util.spec_from_file_location('ig', IG / 'construire_ig_06_33.py')
ig = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ig)

S = dict(id='IG-105', slug='depense-anormale', titre='Méthode · Repérer une dépense anormale',
  date='17/01/2027', li='LI-31', sourcil='Sur mesure · contrôle',
  h1='Une dépense anormale, repérée par <mark>deux seuils</mark>.',
  sous="Pas besoin d'intelligence artificielle.",
  p2=("Une facture fournisseur deux fois plus chère que d'habitude passe souvent inaperçue.",
      "Pas par négligence : personne ne connaît par cœur la moyenne de chaque fournisseur."),
  p2_bas=None,
  v3=('Signalée si', 'Les trois conditions sont réunies.', [
      ('barres', '1. Au moins 3 opérations', 'Plus anciennes, avec le même tiers : la moyenne a un sens.', None),
      ('rond', '2. Plus de 1,8 fois la moyenne', 'Pour ne pas crier au loup sur de petites variations.', None),
      ('carre', "3. Un écart d'au moins 20 €", '6 € au lieu de 3 €, c\'est le double, mais pas un signal.', None)],
      None),
  v4=('Exemple', 'Un fournisseur à 40 € en moyenne.', [
      ('Une facture à 95 € : signalée', "Elle dépasse 1,8 fois la moyenne, avec un écart de plus de 20 €."),
      ('Une facture à 55 € : non signalée', "Sous 1,8 fois la moyenne ; et 15 € d'écart ne méritent pas votre attention."),
      ('En plus, les doublons probables', 'Même date, même tiers, même montant au centime.')]),
  v5=('Qui relit vos factures fournisseurs ?', ['Avant paiement, et à quelle fréquence ?', 'Une courte liste à regarder chaque semaine']),
  alt=["Titre « Une dépense anormale, repérée par deux seuils. » Pas besoin d'intelligence artificielle.",
       "Fond noir : une facture fournisseur deux fois plus chère que d'habitude passe souvent inaperçue. Pas par négligence : personne ne connaît par cœur la moyenne de chaque fournisseur.",
       "Une dépense est signalée si trois conditions sont réunies : au moins 3 opérations plus anciennes avec le même tiers ; un montant supérieur à 1,8 fois la moyenne ; un écart d'au moins 20 €.",
       "Exemple, un fournisseur à 40 € en moyenne : une facture à 95 € est signalée, une facture à 55 € ne l'est pas. En plus, les doublons probables : même date, même tiers, même montant au centime.",
       "Fond rouge : qui relit vos factures fournisseurs, avant paiement et à quelle fréquence ? Votre métier a ses règles ? Parlons-en : lien en bio."],
  legende="""Une facture fournisseur deux fois plus chère que d'habitude passe souvent inaperçue.

Pas par négligence : personne ne connaît par cœur la moyenne de chaque fournisseur. Dans un outil de suivi de comptes que j'ai conçu, une dépense récente est signalée comme inhabituelle quand trois conditions sont réunies : le tiers a au moins 3 opérations plus anciennes, le montant dépasse 1,8 fois sa moyenne, et l'écart atteint au moins 20 €.

Un fournisseur facture 40 € en moyenne. Une facture à 95 € est signalée. Une facture à 55 € ne l'est pas : elle reste sous 1,8 fois la moyenne, et 15 € d'écart ne méritent pas votre attention.

Le même outil repère aussi les doublons probables : même date, même tiers, même montant au centime.

Pas besoin d'intelligence artificielle : deux seuils bien choisis, et une courte liste à regarder chaque semaine.

Chez vous, qui relit les factures avant paiement ? Votre métier a ses règles ? Parlons-en : lien en bio.

#Contrôle #Comptabilité #TPE #Gestion #OutilsSurMesure""")


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
    rendre(S, 3)
    print('\n'.join(f'{k + 1}. {a}' for k, a in enumerate(S['alt'])))
