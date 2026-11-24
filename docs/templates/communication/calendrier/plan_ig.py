"""Replanification Instagram : une seule publication par jour (décision de Quentin du 24/11/2026).
Sortie : plan_ig.json {id: (date, heure)} et un tableau lisible."""
import json, datetime as dt

v = json.load(open('ig.json'))['values']
rows = {}
for i, r in enumerate(v[1:], start=2):
    r = r + [''] * (16 - len(r))
    rows[r[0]] = dict(row=i, id=r[0], d=r[1], h=r[2], s=r[3], th=r[4], t=r[5], fmt=r[13])
fut = {k: x for k, x in rows.items() if x['d'] >= '2026-11-24' and x['s'] not in ('Annulé', 'Publié')}

D = lambda s: dt.date.fromisoformat(s)
J0 = D('2026-11-25')

# 1. Dates imposées (concours, série des calculs) : (date, heure)
fixe = {
    'IG-220': ('2026-11-25', '20:00'), 'IG-221': ('2026-12-05', '20:00'),
    'IG-222': ('2026-12-08', '20:00'), 'IG-223': ('2026-12-11', '19:00'),
    'IG-226': ('2026-12-01', '21:00'), 'IG-227': ('2026-12-09', '19:00'), 'IG-228': ('2026-12-15', '21:00'),
}
# 2. Les contenus audacieux, dans l'ordre voulu (dates libres remplies dans cet ordre)
audacieux = [
    'IG-214', 'IG-155', 'IG-169', 'IG-215', 'IG-131', 'IG-216', 'IG-217', 'IG-149', 'IG-218', 'IG-158',
    'IG-50', 'IG-219', 'IG-56', 'IG-224', 'IG-178', 'IG-46', 'IG-225', 'IG-205', 'IG-161', 'IG-170',
    'IG-211', 'IG-166', 'IG-58', 'IG-176', 'IG-210', 'IG-212', 'IG-162', 'IG-209', 'IG-171', 'IG-150',
    'IG-61', 'IG-163', 'IG-172', 'IG-173', 'IG-174', 'IG-175', 'IG-43',
]
# Échéances (au plus tard) à respecter
echeance = {'IG-215': '2026-12-06', 'IG-216': '2026-12-06', 'IG-149': '2026-12-20', 'IG-224': '2026-12-18',
            'IG-225': '2026-12-20', 'IG-219': '2026-12-20', 'IG-205': '2026-12-19', 'IG-162': '2026-12-30',
            'IG-166': '2026-12-30', 'IG-210': '2026-12-30', 'IG-209': '2026-12-31', 'IG-46': '2027-01-05'}
fonds = ['IG-151', 'IG-08', 'IG-30', 'IG-09', 'IG-10', 'IG-12', 'IG-13', 'IG-14', 'IG-17']
a_produire_fin = ['IG-164', 'IG-165']

reste = [k for k in sorted(fut, key=lambda k: (fut[k]['d'], fut[k]['h']))
         if k not in fixe and k not in audacieux and k not in a_produire_fin]
t2 = [k for k in reste if fut[k]['th'] in ('Sur mesure', 'Méthode') and k not in fonds]
t3 = [k for k in fonds if k in fut] + [k for k in reste if k not in t2 and k not in fonds]
assert set(audacieux) <= set(fut), set(audacieux) - set(fut)

plan = {k: fixe[k] for k in fixe}
pris = {d for d, _ in fixe.values()}
jour = J0
file_aud = list(audacieux)
alterne = [t3, t2]
n_alt = 0
mode_mixte = False
while file_aud or t3 or t2:
    ds = jour.isoformat()
    if ds not in pris:
        choix = None
        if file_aud and (not mode_mixte or n_alt % 3 == 0):
            choix = file_aud.pop(0)
        else:
            src = alterne[n_alt % 2] if alterne[n_alt % 2] else alterne[(n_alt + 1) % 2]
            if src: choix = src.pop(0)
            elif file_aud: choix = file_aud.pop(0)
        if mode_mixte: n_alt += 1
        plan[choix] = (ds, fut[choix]['h'])
        pris.add(ds)
    jour += dt.timedelta(days=1)
    if jour >= D('2027-01-02'): mode_mixte = True
for k in a_produire_fin:
    if k in fut:
        while jour.isoformat() in pris: jour += dt.timedelta(days=1)
        plan[k] = (jour.isoformat(), fut[k]['h']); pris.add(jour.isoformat())

# Contrôles
assert set(plan) == set(fut), set(fut) ^ set(plan)
dates = [d for d, _ in plan.values()]
assert len(dates) == len(set(dates)), 'deux publications le même jour'
for k, lim in echeance.items():
    assert plan[k][0] <= lim, (k, plan[k], lim)
assert plan['IG-224'][0] < plan['IG-225'][0]
json.dump(plan, open('plan_ig.json', 'w'), ensure_ascii=False, indent=0)
for k in sorted(plan, key=lambda k: plan[k]):
    x = fut[k]; dd = plan[k]
    flag = '' if (x['d'], x['h']) == dd else f"  (avant {x['d']} {x['h']})"
    print(dd[0], dd[1], k, x['th'][:12], x['t'][:60] + flag)
print('dernier jour', max(dates), 'publications', len(plan))
