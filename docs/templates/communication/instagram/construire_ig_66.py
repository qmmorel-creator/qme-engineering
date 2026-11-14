"""Carrousel Instagram IG-66 (T69 · Dossier sinistre habitation), 20/01/2027, lendemain de LI-111.

Réutilise les gabarits de construire_ig_06_33.py (couverture, problème, écrans, appel à l'action, story)
et l'en-tête de styles de publications.html. Sortie : publications-ig66.html, puis
node docs/templates/communication/instagram/rendre.mjs publications-ig66.html → png/IG-66-sinistre-*.png
"""
import importlib.util
import pathlib

ICI = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('ig', ICI / 'construire_ig_06_33.py')
ig = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ig)

T = dict(id='IG-66', slug='sinistre', dossier='sinistre', nom='Dossier sinistre habitation',
  titre='T69 · Dossier sinistre habitation', date='20/01/2027', li='LI-111', li_date='19/01', prix=29,
  couleur='Maison', h1='Un sinistre : <mark>5 jours ouvrés</mark> pour le déclarer.',
  sous="Le délai minimal légal. Pour un vol, 2.",
  p2=("D'abord couper l'eau, prévenir le voisin, mettre les meubles à l'abri.",
      "Puis des semaines de factures à retrouver, de photos à classer et d'expert à relancer."),
  v3=('Dossier sinistre habitation', 'La déclaration, guidée.', 'sinistre-dossier', [
      "<b>Six questions</b> et le délai à respecter, calculé en jours ouvrés.",
      "<b>La source officielle</b> de chaque règle, avec sa date de vérification.",
      "<b>Les justificatifs</b> à réunir et les mesures d'urgence, selon le sinistre."],
      'Capture de la démo, données fictives.'),
  v4=('Inventaire chiffré', 'Le calcul, ligne par ligne.', 'sinistre-dommages', [
      "<b>Réparation</b>, ou remplacement moins la vétusté que vous fixez.",
      "<b>Déclaré et reconnu</b> par l'assureur restent séparés.",
      "<b>Un dossier à imprimer</b> pour l'expert, photos comprises."],
      'Aucun barème imposé. Données fictives.'),
  demo='trois dossiers fictifs', plus='Vos dossiers ont leurs propres étapes et documents',
  story="Délais, dommages chiffrés, preuves et suivi jusqu'au versement.")

T['legende'] = """Un sinistre : 5 jours ouvrés pour le déclarer. 2 pour un vol.

C'est le délai minimal prévu par la loi, et il tombe au pire moment : quand il faut couper l'eau, prévenir le voisin et retrouver un numéro de contrat.

Le Dossier sinistre habitation :
▪ six questions, et le délai à respecter calculé en jours ouvrés, avec la source officielle de chaque règle ;
▪ un inventaire chiffré où le calcul est visible : réparation, ou remplacement moins la vétusté que vous fixez ; déclaré et reconnu restent séparés ;
▪ les preuves rangées par statut, et un dossier complet à imprimer pour l'expert.

Aucune promesse d'indemnisation : c'est un outil d'organisation, votre contrat fait foi. Achat unique, 29 €.

Besoin de plus ? Vos dossiers ont leurs propres étapes et documents : je construis la version sur mesure.

Démo libre avec trois dossiers fictifs, et contact : lien en bio.

#Assurance #Habitation #DégâtDesEaux #Maison #Organisation"""

source = (ICI / 'publications.html').read_text(encoding='utf-8')
tete = source.split('<!-- ============ IG-01')[0]
tete = tete.replace('<title>Publications Instagram IG-01 à IG-03</title>', '<title>Publication Instagram IG-66</title>')
corps = [f"\n<!-- ============ IG-66 · {T['titre']} (d'après LI-111) ============ -->",
         ig.couv('IG-66', 'sinistre', T['couleur'], 'bleu', T['h1'], T['sous'], 2),
         ig.probleme('IG-66', 'sinistre', T['p2'], None, 'bleu'),
         ig.ecran('IG-66', 'sinistre', 3, 'bleu', *T['v3']),
         ig.ecran('IG-66', 'sinistre', 4, 'jaune', *T['v4']),
         ig.cta_template(T), ig.story(T)]
(ICI / 'publications-ig66.html').write_text(tete + '\n'.join(corps) + '\n\n</body>\n</html>\n', encoding='utf-8')
alts = ig.alt_template(T)


print('\n'.join(alts))
