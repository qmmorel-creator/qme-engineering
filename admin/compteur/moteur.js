/* Moteur du compteur (remplace celui du tableau de bord Claude) : mêmes appels dash.loader, dash.calc,
   dash.draw, dash.data, dash.onData, dash.params et dash.setParams. Les données viennent de /api/compteur
   (onglets du Sheet « Mesures réseaux QME »). */
window.dash = (() => {
  const chargeurs = {}, calculs = {}, dessins = {}, ecouteurs = [];
  let etat = 'loading', donnees = {}, cache = {}, params = {mode: 'net'};
  try { const m = localStorage.getItem('qme-compteur-mode'); if (m === 'net' || m === 'brut') params.mode = m; } catch (e) {}

  const lire = (id) => {
    if (id in cache) return cache[id];
    let r;
    if (etat !== 'ok') r = {status: etat, data: calculs[id] ? null : [], columns: []};
    else if (calculs[id]) {
      const entrees = calculs[id].inputs.map(lire);
      const ko = entrees.find((e) => e.status !== 'ok');
      if (ko) r = {status: ko.status, data: null, columns: []};
      else {
        try { r = {status: 'ok', data: calculs[id].fn(...entrees.map((e) => e.data)), columns: []}; }
        catch (e) { console.error('Calcul', id, e); r = {status: 'error', data: null, message: String(e.message || e), columns: []}; }
      }
    } else r = donnees[id] || {status: 'missing', data: [], columns: []};
    cache[id] = r;
    return r;
  };

  const rendre = () => {
    cache = {};
    ecouteurs.forEach((f) => { try { f(); } catch (e) { console.error(e); } });
    Object.entries(dessins).forEach(([nom, f]) => {
      document.querySelectorAll(`[data-draw="${nom}"]`).forEach((el) => {
        if (el.closest('[hidden]')) return;
        try { f(el); } catch (e) { console.error('Dessin', nom, e); }
      });
    });
  };

  let minuteur = null, largeur = window.innerWidth;
  window.addEventListener('resize', () => {
    if (Math.abs(window.innerWidth - largeur) < 8) return;
    largeur = window.innerWidth;
    clearTimeout(minuteur); minuteur = setTimeout(rendre, 150);
  });

  return {
    colors: ['#2E5A88', '#B84A34', '#E8B93A', '#2E7D4F', '#24221F'],
    loader: (id, o) => { chargeurs[id] = o.fn; },
    calc: (id, o) => { calculs[id] = o; },
    draw: (nom, f) => { dessins[nom] = f; },
    onData: (f) => { ecouteurs.push(f); },
    data: lire,
    params: () => ({...params}),
    setParams: (p) => {
      Object.assign(params, p);
      try { localStorage.setItem('qme-compteur-mode', params.mode); } catch (e) {}
      rendre();
    },
    resetParams: () => { params = {mode: 'net'}; rendre(); },
    refresh: () => {},
    // Appelé par la page après /api/compteur : onglets bruts → jeux de données, puis dessin.
    _charger: async (reponse) => {
      const onglets = reponse.onglets || {}, erreurs = reponse.erreurs || {};
      const objets = (v, nombres) => {
        if (!Array.isArray(v) || !v.length) return [];
        const tete = v[0].map((h) => String(h).trim());
        return v.slice(1).map((l) => {
          const o = {};
          tete.forEach((h, i) => {
            const x = l[i] === undefined ? '' : l[i];
            if (nombres.includes(h)) { const n = Number(String(x).replace(/[\s  ]/g, '').replace(',', '.')); o[h] = x === '' || !Number.isFinite(n) ? null : n; }
            else if (x === 'TRUE' || x === 'FALSE') o[h] = x === 'TRUE';
            else o[h] = x === '' ? null : x;
          });
          return o;
        });
      };
      const sources = {
        publications: async () => chargeurs.publications({answer: {values: onglets.publications}}),
        historique: async () => chargeurs.historique({answer: {values: onglets.historique}}),
        gumroad_produits: async () => objets(onglets.gumroad_produits, ['views', 'sales', 'revenue_cents']),
        gumroad_sources: async () => objets(onglets.gumroad_sources, ['views', 'sales', 'revenue_cents']),
        gumroad_jours: async () => objets(onglets.gumroad_jours, ['units', 'revenue_cents']),
        gumroad_ventes: async () => chargeurs.gumroad_ventes({
          answer: {sales: objets(onglets.gumroad_ventes, ['price_cents', 'net_cents']), next_cursor: null},
          call: async () => ({}), args: {}
        }),
      };
      donnees = {};
      await Promise.all(Object.entries(sources).map(async ([id, f]) => {
        if (erreurs[id] || !onglets[id]) { donnees[id] = {status: 'error', data: [], columns: [], message: erreurs[id] || 'Onglet absent'}; return; }
        try {
          const r = await f();
          const lignes = Array.isArray(r) ? r : (r.rows || r.data || []);
          donnees[id] = {status: 'ok', data: lignes, columns: (r && r.columns) || []};
        } catch (e) {
          console.error('Chargement', id, e);
          donnees[id] = {status: 'error', data: [], columns: [], message: String(e.message || e)};
        }
      }));
      etat = 'ok';
      rendre();
    },
    _etat: (e) => { etat = e; rendre(); },
  };
})();
