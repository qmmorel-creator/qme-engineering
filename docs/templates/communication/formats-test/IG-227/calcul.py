"""IG-227 · F3 · Le calcul que personne ne fait n°3 : une baisse puis une hausse du même pourcentage ne s'annulent pas.
Calcul refait en code : python3 calcul.py (aucune dépendance). Exemples fictifs, ne remplace pas un conseil financier."""
from fractions import Fraction as F

def fr(x, d=1):
    return f"{float(x):.{d}f}".replace(".", ",")

PRIX = F(100)  # prix fictif

# Étape 1 : −20 % puis +20 %
baisse = PRIX * F(20, 100)
apres_baisse = PRIX - baisse
hausse = apres_baisse * F(20, 100)
final = apres_baisse + hausse
print("Étape 1 · 100 € − 20 % puis + 20 % (exemple fictif)")
print(f"  100 € − 20 % : − {fr(baisse, 2)} € -> {fr(apres_baisse, 2)} €")
print(f"  {fr(apres_baisse, 2)} € + 20 % : + {fr(hausse, 2)} € -> {fr(final, 2)} €")
print(f"  il manque {fr(PRIX - final, 2)} € (soit − {fr((PRIX - final) / PRIX * 100)} %)")
assert (baisse, apres_baisse, hausse, final, PRIX - final) == (20, 80, 16, 96, 4)

# Étape 2 : pourquoi, et combien pour revenir
retour = (PRIX - apres_baisse) / apres_baisse * 100
print(f"Étape 2 · la hausse s'applique à 80 €, pas à 100 € : 20 % de 80 € = {fr(hausse, 2)} €")
print(f"  pour revenir à 100 € : il faut + 20 € sur 80 € = + {fr(retour)} %")
assert retour == 25 and apres_baisse * (1 + retour / 100) == PRIX

# Étape 3 : ordre inverse, +20 % puis −20 %
haut = PRIX * F(120, 100)
inverse = haut * F(80, 100)
print(f"Étape 3 · ordre inverse : 100 € + 20 % = {fr(haut, 2)} € ; − 20 % = {fr(inverse, 2)} €")
print(f"  coefficient : 0,8 × 1,2 = 1,2 × 0,8 = {fr(F(8, 10) * F(12, 10), 2)} (la multiplication est commutative)")
assert haut == 120 and inverse == 96 and F(8, 10) * F(12, 10) == F(12, 10) * F(8, 10) == F(96, 100)
# Perte générale après −x % puis +x % : x² / 100 %
for x in (10, 20, 50):
    perte = 100 - 100 * (1 - F(x, 100)) * (1 + F(x, 100))
    assert perte == F(x * x, 100)
    print(f"  −{x} % puis +{x} % : perte de {fr(perte)} % (= {x}² ÷ 100)")

# Règle à garder : après une baisse de x %, il faut x ÷ (100 − x) × 100 % pour revenir
def remonte(x):
    return x / (100 - x) * 100

print("Règle à garder · hausse pour revenir = x ÷ (100 − x) × 100")
attendu = [(F(10), "11,1"), (F(20), "25,0"), (F(25), "33,3"), (F(100, 3), "50,0"), (F(50), "100,0")]
for x, att in attendu:
    h = remonte(x)
    assert fr(h) == att, (x, h)
    assert (100 - x) * (1 + h / 100) == 100  # on revient exactement à 100
    print(f"  − {fr(x)} % -> + {fr(h, 3)} % -> affiché + {fr(h)} %")
# −33,3 % affiché = un tiers exactement ; avec 33,3 tout rond on obtiendrait 49,9 %
print(f"  (avec x = 33,3 tout rond : + {fr(remonte(F(333, 10)), 2)} % ; le tableau parle d'un tiers exact, d'où + 50 %)")

# Exemples de la vie courante (fictifs)
print("Exemples fictifs")
solde = F(50) * F(80, 100)
remonte_solde = solde * F(120, 100)
print(f"  prix soldé : 50 € − 20 % = {fr(solde, 2)} € ; + 20 % = {fr(remonte_solde, 2)} € (pas 50 €)")
assert solde == 40 and remonte_solde == 48
tp = remonte(F(20))
print(f"  temps partiel à 80 % -> temps plein : + {fr(tp)} % de temps de travail (20 ÷ 80)")
assert tp == 25
ep0 = F(10000); ep1 = ep0 * F(90, 100); ep2 = ep1 * F(110, 100)
print(f"  épargne fictive : 10 000 € − 10 % = {fr(ep1, 2)} € ; + 10 % = {fr(ep2, 2)} € ; pour revenir : + {fr(remonte(F(10)), 1)} %")
assert ep1 == 9000 and ep2 == 9900 and ep1 * (1 + remonte(F(10)) / 100) == ep0
print("Toutes les assertions passent.")
