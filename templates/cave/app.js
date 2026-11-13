// CaveManager · interface. Socle commun : templates/commun/socle.js. Règles : regles.js (window.CVM).
// Aucune donnée externe : région, appellation, cépage, millésime, producteur et prix sont saisis.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.CVM;
  const O = window.QME_OUTILS;
  const { esc } = window.QME_SOCLE;
  let S = null;
  const uid = () => O.nouvelId();
  const eur = (c, centimes = false) => (c === null || c === undefined ? '–' : O.euros(c, { centimes }));
  const dateFr = (s) => (s ? O.versDate(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
  const nomCat = (id) => B.categories.find((c) => c.id === id)?.nom || '';
  const ETATS = { 'trop-jeune': ['Trop jeune', 'ciel'], 'a-boire': ['À boire', 'vert'], apogee: ['Apogée', 'vert'], 'fin-proche': ['Dernière année', 'jaune'], passee: ['Fenêtre passée', 'rouge'], inconnu: ['Fenêtre inconnue', 'sable'] };
  const annee = () => Number(S.auj().slice(0, 4));
  const vin = (id) => S.E.vins.find((v) => v.id === id);
  const titreVin = (v) => `${v.nom}${v.millesime ? ` ${v.millesime}` : ''}`;
  const motifLib = (m) => [...B.motifsEntree, ...B.motifsSortie].find((x) => x[0] === m)?.[1] || m;
  const lireMontant = (v) => { const s = String(v ?? '').trim(); if (!s) return null; const m = O.lireMontant(s); return m === null ? NaN : m; };
  const ui = { cat: 'toutes', etat: 'tous', q: '', critere: { categorie: '', valeurMax: null } };

  // ---------- Données de démonstration (cave fictive) ----------
  function donneesDemo() {
    const t = O.iso(new Date());
    const a = Number(t.slice(0, 4));
    const V = (nom, extra) => ({ id: uid(), nom, producteur: 'Domaine fictif', ...extra });
    const vins = [
      V('Cuvée des Coteaux', { categorie: 'rouge', region: 'Bordeaux', appellation: 'Appellation régionale (exemple)', cepages: 'Merlot, cabernet franc', millesime: a - 6, emplacement: 'Casier A · rangée 1', prixAchat: 1450, note: 4 }),
      V('Les Vieilles Vignes', { categorie: 'rouge', region: 'Bourgogne', cepages: 'Pinot noir', millesime: a - 4, emplacement: 'Casier A · rangée 2', valeur: 3500, fenetre: { debut: a - 1, apogee: a + 2, fin: a + 6 }, note: 5, commentaire: 'Fenêtre conseillée par le producteur.' }),
      V('Grenache du Plateau', { categorie: 'rouge', region: 'Rhône', cepages: 'Grenache, syrah', millesime: a - 2, emplacement: 'Casier B · rangée 1', prixAchat: 1100 }),
      V('Réserve de Garde', { categorie: 'rouge', region: 'Bordeaux', cepages: 'Cabernet sauvignon', millesime: a - 1, emplacement: 'Casier C · bas', prixAchat: 2800, fenetre: { debut: a + 5, apogee: a + 10, fin: a + 18 } }),
      V('Clos des Galets', { categorie: 'rouge', region: 'Languedoc', cepages: 'Syrah, mourvèdre', millesime: a - 11, emplacement: 'Casier C · haut', prixAchat: 1600, commentaire: 'À surveiller : fenêtre dépassée.' }),
      V('Blanc de Pierre', { categorie: 'blanc', region: 'Loire', cepages: 'Chenin', millesime: a - 3, emplacement: 'Casier B · rangée 2', prixAchat: 1200, note: 4 }),
      V('Les Terrasses', { categorie: 'blanc', region: 'Alsace', cepages: 'Riesling', millesime: a - 6, emplacement: 'Casier B · rangée 3', prixAchat: 1350, fenetre: { debut: a - 4, apogee: a - 1, fin: a } }),
      V('Rosé de Printemps', { categorie: 'rose', region: 'Provence', cepages: 'Cinsault, grenache', millesime: a - 1, emplacement: 'Réfrigérateur à vin', prixAchat: 900 }),
      V('Rosé d\'été', { categorie: 'rose', region: 'Provence', millesime: a - 4, emplacement: 'Réfrigérateur à vin', prixAchat: 850 }),
      V('Brut Réserve', { categorie: 'effervescent', region: 'Champagne', cepages: 'Chardonnay, pinot noir', millesime: null, emplacement: 'Casier D', prixAchat: 2600, valeur: 3000, fenetre: { debut: a - 1, fin: a + 3 } }),
      V('Crémant de fête', { categorie: 'effervescent', region: 'Bourgogne', millesime: a - 3, emplacement: 'Casier D', prixAchat: 1100 }),
      V('Douceur d\'Automne', { categorie: 'liquoreux', region: 'Bordeaux', cepages: 'Sémillon', millesime: a - 9, emplacement: 'Casier C · bas', prixAchat: 2200, format: '37' }),
      V('Magnum de famille', { categorie: 'rouge', region: 'Rhône', millesime: a - 5, emplacement: 'Casier C · bas', format: '150', valeur: 6000, fenetre: { debut: a - 1, apogee: a, fin: a + 4 } }),
    ];
    const m = [];
    const E = (i, j, q, motif = 'achat', prix = vins[i].prixAchat) => m.push({ id: uid(), vinId: vins[i].id, date: O.ajout(t, -j), type: 'entree', motif, quantite: q, prixUnitaire: motif === 'achat' ? prix : null, commentaire: '' });
    const X = (i, j, q, motif = 'consommee', note = 0, commentaire = '') => m.push({ id: uid(), vinId: vins[i].id, date: O.ajout(t, -j), type: 'sortie', motif, quantite: q, noteDegustation: note, commentaire });
    E(0, 900, 6); X(0, 300, 1, 'consommee', 4, 'Souple, fruits noirs.'); X(0, 40, 1, 'consommee', 4);
    E(1, 600, 3, 'achat', 3200); X(1, 20, 1, 'consommee', 5, 'Superbe avec un plat mijoté.');
    E(2, 200, 6); X(2, 60, 2, 'offerte'); E(3, 120, 6); E(4, 2500, 3, 'inventaire'); X(4, 400, 1, 'consommee', 3);
    E(5, 500, 6); X(5, 90, 1, 'consommee', 4); X(5, 15, 1); E(6, 1300, 2); E(7, 150, 6); X(7, 100, 2); X(7, 70, 1, 'abimee', 0, 'Bouchon défectueux.');
    E(8, 1000, 2); E(9, 300, 3); X(9, 45, 1, 'consommee', 5, 'Anniversaire.'); E(10, 700, 6, 'cadeau'); X(10, 180, 2);
    E(11, 1800, 2); E(12, 1000, 1, 'cadeau');
    return R.normaliser({ vins, mouvements: m }, t);
  }

  // ---------- Premier lancement ----------
  function accueil() {
    return `
      <p class="surtitre">Bienvenue</p>
      <h1>Sache quoi ouvrir, quoi garder, et ce que contient ta cave.</h1>
      <p class="intro">Ajoute tes vins avec leur millésime, leur emplacement et leur quantité. Chaque bouteille ouverte, offerte ou achetée est un mouvement : le stock, la valeur et les vins à boire en priorité se calculent.</p>
      <form id="form-accueil" class="formulaire-accueil" novalidate>
        <div class="accueil-pied"><span class="mini">${esc(B.avertissement)}</span><button class="btn primaire" type="submit">Ouvrir ma cave</button></div>
      </form>
      <ol class="conseils" style="margin-top:32px">${B.conseils.map(([x, y]) => `<li><b>${esc(x)}</b><span>${esc(y)}</span></li>`).join('')}</ol>`;
  }
  function apresAccueil() {
    S.$('#form-accueil').addEventListener('submit', (e) => { e.preventDefault(); S.terminerAccueil(R.etatVide(), { vue: 'cave', message: 'Ajoute ton premier vin.' }); });
  }

  // ---------- Vues ----------
  const AVERTISSEMENT = `<p class="mention avertissement">${esc(B.avertissement)}</p>`;
  const etiquetteEtat = (etat) => `<span class="etiquette ${ETATS[etat][1]}">${ETATS[etat][0]}</span>`;
  function ligneVin(x) {
    const v = x.vin;
    const f = x.fenetre;
    return `<li class="ligne ligne-vin cat-${v.categorie} ${x.stock ? '' : 'epuise'}">
      <button class="ligne-info" data-action="vin-ouvrir" data-id="${v.id}"><b>${esc(titreVin(v))}</b>
        <span class="ligne-detail">${esc([v.producteur, v.appellation || v.region, v.cepages].filter(Boolean).join(' · '))}</span>
        <span class="ligne-etiquettes">${etiquetteEtat(x.etat)}${f.debut ? `<span class="etiquette sable">${f.debut}–${f.fin}${f.source === 'regle' ? ' (indicatif)' : ''}</span>` : ''}${v.emplacement ? `<span class="etiquette ciel">${esc(v.emplacement)}</span>` : ''}${v.format !== '75' ? `<span class="etiquette">${esc(B.formats.find((y) => y.id === v.format).nom)}</span>` : ''}${v.note ? `<span class="etiquette sable">${'★'.repeat(v.note)}</span>` : ''}</span></button>
      <div class="ligne-droite"><span class="stock"><b>${x.stock}</b><small>${x.stock > 1 ? 'bouteilles' : 'bouteille'}${x.valeur ? ` · ${eur(x.valeur)} pièce` : ''}</small></span>
        <span class="rang-boutons">${x.stock ? `<button class="btn petit" data-action="sortie" data-id="${v.id}">Ouvrir</button>` : ''}<button class="btn petit" data-action="entree" data-id="${v.id}" aria-label="Ajouter des bouteilles">${S.ICONES.plus}</button></span></div></li>`;
  }

  function vueCave() {
    const s = R.statistiques(S.E, S.auj());
    const q = ui.q.trim().toLowerCase();
    const inv = R.inventaire(S.E, annee()).filter((x) => (ui.cat === 'toutes' || x.vin.categorie === ui.cat) && (ui.etat === 'tous' ? true : ui.etat === 'epuises' ? !x.stock : x.stock && x.etat === ui.etat)
      && (ui.etat === 'epuises' || ui.etat !== 'tous' || x.stock > 0 || q)
      && (!q || `${x.vin.nom} ${x.vin.producteur} ${x.vin.region} ${x.vin.appellation} ${x.vin.cepages} ${x.vin.emplacement} ${x.vin.millesime || ''}`.toLowerCase().includes(q)));
    const groupes = B.categories.map((c) => ({ c, l: inv.filter((x) => x.vin.categorie === c.id).sort((a, b) => (a.vin.millesime || 0) - (b.vin.millesime || 0) || a.vin.nom.localeCompare(b.vin.nom, 'fr')) })).filter((g) => g.l.length);
    const aBoire = s.parEtat['fin-proche'] + s.parEtat.passee;
    return `
      <div class="vue-tete"><div><h1>Cave</h1><p>${S.pluriel(s.bouteilles, 'bouteille')} en ${S.pluriel(s.references, 'référence')}. Touche un vin pour sa fiche et son historique.</p></div>
        <div class="actions"><button class="btn" data-action="mouvement-nouveau">Mouvement</button><button class="btn primaire" data-action="vin-nouveau">${S.ICONES.plus}Vin</button></div></div>
      <div class="tuiles">
        <div class="tuile" style="--c:#8E2F3C"><p class="surtitre">Bouteilles</p><b>${s.bouteilles}</b><span>${S.pluriel(s.references, 'référence')}</span></div>
        <div class="tuile rond" style="--c:var(--jaune)"><p class="surtitre">Valeur</p><b>${eur(s.valeur)}</b><span>${s.sansValeur ? `${S.pluriel(s.sansValeur, 'bouteille')} sans prix` : 'valeur déclarée ou prix d\'achat'}</span></div>
        <div class="tuile" style="--c:var(--rouge)"><p class="surtitre">À boire vite</p><b>${aBoire}</b><span>dernière année ou fenêtre passée</span></div>
        <div class="tuile rond" style="--c:var(--bleu)"><p class="surtitre">Consommées</p><b>${s.consommees12}</b><span>sur 12 mois</span></div>
      </div>
      <div class="outils-liste" style="margin-top:18px">
        <div class="rang-boutons"><label class="champ"><span class="sr-only">Catégorie</span><select id="filtre-cat"><option value="toutes">Toutes les catégories</option>${B.categories.map((c) => `<option value="${c.id}" ${ui.cat === c.id ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}</select></label>
          <label class="champ"><span class="sr-only">État</span><select id="filtre-etat"><option value="tous">En stock</option>${Object.entries(ETATS).map(([k, [l]]) => `<option value="${k}" ${ui.etat === k ? 'selected' : ''}>${l}</option>`).join('')}<option value="epuises" ${ui.etat === 'epuises' ? 'selected' : ''}>Épuisés</option></select></label></div>
        <label class="champ recherche"><span class="sr-only">Rechercher</span><input id="recherche" type="search" placeholder="Vin, producteur, région, cépage, casier" value="${esc(ui.q)}"></label>
      </div>
      ${groupes.length ? groupes.map(({ c, l }) => `<section class="groupe-cat"><h2 class="titre-cat">${esc(c.nom)}<span>${S.pluriel(l.reduce((s2, x) => s2 + x.stock, 0), 'bouteille')}</span></h2><ul class="lignes-abos">${l.map(ligneVin).join('')}</ul></section>`).join('')
        : `<div class="vide-etat">${S.FORME_VIDE}<div><h3>${S.E.vins.length ? 'Aucun vin ne correspond' : 'Ta cave est vide'}</h3><p>${S.E.vins.length ? 'Change les filtres ou la recherche.' : 'Ajoute un vin : nom, millésime, emplacement et nombre de bouteilles.'}</p><div class="actions"><button class="btn primaire" data-action="vin-nouveau">${S.ICONES.plus}Vin</button></div></div></div>`}
      ${AVERTISSEMENT}`;
  }

  function vueOuvrir() {
    const a = R.alertes(S.E, S.auj());
    const c = ui.critere;
    const sug = R.suggestions(S.E, c, S.auj());
    const bloc = (titre, l, sous) => (l.length ? `<section><h2 class="titre-section">${titre} <span>${sous}</span></h2><ul class="lignes-abos">${l.map(ligneVin).join('')}</ul></section>` : '');
    return `
      <div class="vue-tete"><div><h1>À ouvrir</h1><p>Les vins à boire en priorité d'après leur fenêtre de consommation, puis des suggestions selon l'occasion.</p></div></div>
      ${bloc('Fenêtre passée', a.passes, 'à ouvrir sans tarder')}${bloc('Dernière année', a.finProche, `à boire en ${annee()}`)}${bloc('À leur apogée', a.apogee, `en ${annee()}`)}
      ${!a.passes.length && !a.finProche.length && !a.apogee.length ? '<p class="aide">Aucune urgence : rien n\'arrive en fin de fenêtre cette année.</p>' : ''}
      <h2 class="titre-section">Que déboucher ?</h2>
      <form id="form-ouvrir" class="carte-el criteres-vin"><div class="rang-champs">
        <label class="champ">Catégorie<select name="categorie"><option value="">Toutes</option>${B.categories.map((x) => `<option value="${x.id}" ${c.categorie === x.id ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label>
        <label class="champ">Valeur maximale par bouteille (€)<input name="valeurMax" inputmode="decimal" value="${O.saisieMontant(c.valeurMax)}" placeholder="Sans limite"></label></div></form>
      ${sug.length ? `<ol class="suggestions-vin">${sug.slice(0, 10).map((x, i) => `<li><span class="rang">${i + 1}</span><div><button class="lien-ligne" data-action="vin-ouvrir" data-id="${x.vin.id}"><b>${esc(titreVin(x.vin))}</b><span>${esc(nomCat(x.vin.categorie))}${x.vin.emplacement ? ` · ${esc(x.vin.emplacement)}` : ''} · ${S.pluriel(x.stock, 'bouteille')}${x.valeur ? ` · ${eur(x.valeur)}` : ''}</span></button><p class="raisons">${esc(x.raisons.join(' · '))}</p></div><button class="btn petit primaire" data-action="sortie" data-id="${x.vin.id}">Je l'ouvre</button></li>`).join('')}</ol>`
        : '<div class="vide-etat petit"><div><h3>Aucun vin prêt pour ces critères</h3><p>Les vins trop jeunes ou sans fenêtre connue ne sont pas proposés.</p></div></div>'}
      ${AVERTISSEMENT}`;
  }

  function vueMouvements() {
    const l = [...S.E.mouvements].sort((a, b) => b.date.localeCompare(a.date));
    return `
      <div class="vue-tete"><div><h1>Mouvements</h1><p>Entrées (achats, cadeaux) et sorties (consommées, offertes, abîmées) : le stock en découle.</p></div>
        <div class="actions"><button class="btn" data-action="entree">Entrée</button><button class="btn primaire" data-action="sortie">Sortie</button></div></div>
      ${l.length ? `<ul class="lignes-abos">${l.map((m) => { const v = vin(m.vinId); return `<li class="ligne mvt-${m.type}"><button class="ligne-info" data-action="mouvement-ouvrir" data-id="${m.id}"><b>${m.type === 'entree' ? '+' : '−'}${m.quantite} · ${esc(v ? titreVin(v) : 'Vin supprimé')}</b><span class="ligne-detail">${dateFr(m.date)} · ${esc(motifLib(m.motif))}${m.prixUnitaire !== null ? ` · ${eur(m.prixUnitaire, true)} pièce` : ''}${m.noteDegustation ? ` · ${'★'.repeat(m.noteDegustation)}` : ''}${m.commentaire ? ` · ${esc(m.commentaire)}` : ''}</span></button></li>`; }).join('')}</ul>`
        : `<div class="vide-etat">${S.FORME_VIDE}<div><h3>Aucun mouvement</h3><p>Ajoute un vin : sa quantité initiale crée la première entrée.</p></div></div>`}`;
  }

  function vueStats() {
    const s = R.statistiques(S.E, S.auj());
    const barres = (l) => { const max = Math.max(1, ...l.map((x) => x.nb)); return `<figure class="graphique"><div class="barres-cats">${l.slice(0, 12).map((x) => `<div class="barre-cat" tabindex="0" data-info="${esc(`<b>${esc(x.nom)}</b>${S.pluriel(x.nb, 'bouteille')}<br>${O.fmtNombre(x.part)} % de la cave`)}"><span class="bc-nom">${esc(x.nom)}</span><span class="bc-piste"><span class="bc-barre" style="width:${Math.max(1, (x.nb / max) * 100)}%"></span></span><span class="bc-val"><b>${x.nb}</b> · ${O.fmtNombre(x.part)} %</span></div>`).join('')}</div><div class="infobulle" hidden></div></figure>`; };
    const maxM = Math.max(1, ...s.mois.map((m) => m.sorties));
    const moisCourt = (m) => O.versDate(`${m}-01`).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
    return `
      <div class="vue-tete"><div><h1>Statistiques</h1><p>Répartition des ${S.pluriel(s.bouteilles, 'bouteille')} en stock.</p></div></div>
      ${s.bouteilles ? `<div class="colonnes-2">
        <section><h2 class="titre-section">Par catégorie</h2>${barres(s.parCategorie)}</section>
        <section><h2 class="titre-section">Par région</h2>${barres(s.parRegion)}</section>
        <section><h2 class="titre-section">Par millésime</h2>${barres(s.parMillesime)}</section>
        <section><h2 class="titre-section">Par emplacement</h2>${barres(s.parEmplacement)}</section></div>
      <h2 class="titre-section">Fenêtres de consommation</h2>
      <div class="jauges">${Object.entries(ETATS).map(([k, [l]]) => `<div class="jauge-ligne"><span>${l}</span><span class="jauge" style="--c:${k === 'passee' ? 'var(--rouge)' : k === 'fin-proche' ? 'var(--jaune)' : k === 'trop-jeune' ? 'var(--bleu)' : k === 'inconnu' ? 'var(--discret)' : 'var(--vert)'}"><span style="width:${(s.parEtat[k] / s.bouteilles) * 100}%"></span></span><b>${s.parEtat[k]}</b></div>`).join('')}</div>` : '<p class="aide">Aucune bouteille en stock.</p>'}
      <h2 class="titre-section">Sorties par mois <span>12 derniers mois</span></h2>
      <figure class="graphique"><div class="projection">${s.mois.map((m, i) => `<div class="col-proj ${i === 11 ? 'actif' : ''}" tabindex="0" data-info="${esc(`<b>${moisCourt(m.mois)}</b>${S.pluriel(m.sorties, 'bouteille sortie', 'bouteilles sorties')}`)}"><span class="cp-val">${m.sorties || ''}</span><span class="cp-zone"><span class="cp-barre" style="height:${Math.max(1, (m.sorties / maxM) * 100)}%"></span></span><span class="cp-mois">${moisCourt(m.mois)}</span></div>`).join('')}</div><div class="infobulle" hidden></div></figure>
      ${AVERTISSEMENT}`;
  }

  function vueGarde() {
    const g = S.E.reglages.garde;
    return `
      <div class="vue-tete"><div><h1>Garde et conservation</h1><p>Règles indicatives utilisées quand un vin n'a pas de fenêtre saisie : années après le millésime. Modifie-les selon tes vins.</p></div></div>
      <form id="form-garde"><div class="defile"><table class="tableau compact"><thead><tr><th>Catégorie</th><th>À partir de (ans)</th><th>Apogée (ans)</th><th>Jusqu'à (ans)</th><th>Exemple : millésime ${annee() - 3}</th></tr></thead><tbody>${B.categories.map((c) => `<tr><td>${esc(c.nom)}</td>${['debut', 'apogee', 'fin'].map((k) => `<td><input type="number" min="0" max="100" name="${c.id}-${k}" value="${g[c.id][k]}" aria-label="${esc(c.nom)} : ${k}"></td>`).join('')}<td class="mini">${annee() - 3 + g[c.id].debut}–${annee() - 3 + g[c.id].fin}</td></tr>`).join('')}</tbody></table></div>
      <div class="rang-boutons" style="margin-top:10px"><button class="btn primaire" type="submit">Enregistrer les règles</button><button class="btn" type="button" data-action="garde-defaut">Valeurs de départ</button></div></form>
      <h2 class="titre-section">Conservation <span>Conseils généraux, indicatifs</span></h2>
      <ol class="conseils">${B.conservation.map(([x, y]) => `<li><b>${esc(x)}</b><span>${esc(y)}</span></li>`).join('')}</ol>
      ${AVERTISSEMENT}`;
  }

  // ---------- Modales ----------
  function modaleVin(id) {
    const v = id ? vin(id) : null;
    const x = v || { nom: '', producteur: '', categorie: 'rouge', region: '', appellation: '', cepages: '', millesime: annee() - 2, format: '75', emplacement: '', prixAchat: null, valeur: null, fenetre: null, note: 0, commentaire: '' };
    const f0 = v ? R.fenetre(v, S.E.reglages.garde) : null;
    const hist = v ? S.E.mouvements.filter((m) => m.vinId === v.id).sort((a, b) => b.date.localeCompare(a.date)) : [];
    const emplacements = [...new Set(S.E.vins.map((y) => y.emplacement).filter(Boolean))];
    S.ouvrirModale(v ? esc(titreVin(v)) : 'Nouveau vin', `
      <div class="rang-champs"><label class="champ">Nom ou cuvée<input name="nom" maxlength="100" value="${esc(x.nom)}"></label><label class="champ">Producteur<input name="producteur" maxlength="100" value="${esc(x.producteur)}"></label></div>
      <div class="rang-champs"><label class="champ">Catégorie<select name="categorie">${B.categories.map((c) => `<option value="${c.id}" ${c.id === x.categorie ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}</select></label><label class="champ">Millésime <small>Vide : sans millésime.</small><input name="millesime" inputmode="numeric" value="${x.millesime ?? ''}"></label><label class="champ">Format<select name="format">${B.formats.map((f) => `<option value="${f.id}" ${f.id === x.format ? 'selected' : ''}>${esc(f.nom)}</option>`).join('')}</select></label></div>
      <div class="rang-champs"><label class="champ">Région<input name="region" maxlength="60" value="${esc(x.region)}"></label><label class="champ">Appellation<input name="appellation" maxlength="80" value="${esc(x.appellation)}"></label><label class="champ">Cépages<input name="cepages" maxlength="120" value="${esc(x.cepages)}"></label></div>
      <label class="champ">Emplacement <small>Zone, casier, rangée.</small><input name="emplacement" maxlength="80" list="emplacements" value="${esc(x.emplacement)}"></label>
      <datalist id="emplacements">${emplacements.map((e) => `<option value="${esc(e)}">`).join('')}</datalist>
      <div class="rang-champs"><label class="champ">Prix d'achat unitaire (€)<input name="prixAchat" inputmode="decimal" value="${O.saisieMontant(x.prixAchat)}"></label><label class="champ">Valeur déclarée unitaire (€) <small>Ton estimation, facultative.</small><input name="valeur" inputmode="decimal" value="${O.saisieMontant(x.valeur)}"></label></div>
      <fieldset class="champ cadre-champs"><legend>Fenêtre de consommation <small>${f0 && f0.source === 'regle' ? `Vide : règle indicative (${f0.debut}–${f0.fin}).` : 'Vide : règle indicative de la catégorie, si le millésime est connu.'}</small></legend>
        <div class="rang-champs"><label class="champ">À partir de<input name="fDebut" inputmode="numeric" value="${x.fenetre?.debut ?? ''}"></label><label class="champ">Apogée<input name="fApogee" inputmode="numeric" value="${x.fenetre?.apogee ?? ''}"></label><label class="champ">Jusqu'à<input name="fFin" inputmode="numeric" value="${x.fenetre?.fin ?? ''}"></label></div></fieldset>
      <div class="rang-champs"><label class="champ">Ta note<select name="note"><option value="0">—</option>${[1, 2, 3, 4, 5].map((n) => `<option value="${n}" ${x.note === n ? 'selected' : ''}>${'★'.repeat(n)}</option>`).join('')}</select></label>${v ? '' : '<label class="champ">Bouteilles à mettre en cave<input name="quantite" inputmode="numeric" value="1"></label><label class="champ">Date d\'entrée<input type="date" name="date" value="' + S.auj() + '"></label>'}</div>
      <label class="champ">Commentaire<textarea name="commentaire" rows="2" maxlength="500">${esc(x.commentaire)}</textarea></label>
      ${v ? `<h3 class="sous-titre">Historique · stock ${R.stock(S.E, v.id)}</h3>${hist.length ? `<ul class="historique">${hist.map((m) => `<li>${dateFr(m.date)} · ${m.type === 'entree' ? '+' : '−'}${m.quantite} ${esc(motifLib(m.motif).toLowerCase())}${m.noteDegustation ? ` · ${'★'.repeat(m.noteDegustation)}` : ''}${m.commentaire ? ` · ${esc(m.commentaire)}` : ''}</li>`).join('')}</ul>` : '<p class="mini">Aucun mouvement.</p>'}` : ''}
      <p class="erreur" role="alert"></p>`,
    v ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>' : '<button class="btn primaire" value="ok">Ajouter en cave</button><button class="btn" value="annuler">Annuler</button>', (f, action) => {
      if (action === 'supprimer') {
        if (!S.confirmer(`Supprimer « ${titreVin(v)} » et ses ${hist.length} mouvements ? (Une bouteille bue se note en sortie : l'historique reste.)`)) { S.garderModale(); return undefined; }
        S.retenir(); S.E.vins = S.E.vins.filter((y) => y.id !== v.id); S.E.mouvements = S.E.mouvements.filter((m) => m.vinId !== v.id); S.sauver(); S.rendre(); S.toast('Vin supprimé.', { libelle: 'Annuler', faire: S.annuler });
        return undefined;
      }
      const entierOuNull = (k) => { const s = String(f.get(k) || '').trim(); if (!s) return null; const n = Number(s); return Number.isInteger(n) ? n : NaN; };
      const mill = entierOuNull('millesime');
      const fd = entierOuNull('fDebut'), fa = entierOuNull('fApogee'), ff = entierOuNull('fFin');
      if ([mill, fd, fa, ff].some(Number.isNaN)) return 'Années : nombres entiers (par exemple 2019).';
      const prixAchat = lireMontant(f.get('prixAchat')), valeur = lireMontant(f.get('valeur'));
      if (Number.isNaN(prixAchat) || Number.isNaN(valeur)) return 'Montant illisible : par exemple 14,50.';
      const fenetre = fd === null && ff === null && fa === null ? null : { debut: fd, apogee: fa, fin: ff };
      const nouveau = { ...(v || { id: uid() }), nom: O.texte(f.get('nom'), 100), producteur: O.texte(f.get('producteur'), 100), categorie: f.get('categorie'), millesime: mill, format: f.get('format'), region: O.texte(f.get('region'), 60), appellation: O.texte(f.get('appellation'), 80), cepages: O.texte(f.get('cepages'), 120), emplacement: O.texte(f.get('emplacement'), 80), prixAchat, valeur, fenetre, note: Number(f.get('note')), commentaire: O.texte(f.get('commentaire'), 500) };
      const err = R.validerVin(nouveau, annee());
      if (err) return err;
      let q = 0, date = null;
      if (!v) {
        q = Number(f.get('quantite'));
        date = f.get('date');
        if (!(Number.isInteger(q) && q >= 0 && q <= 10000)) return 'Bouteilles : nombre entier (0 pour une fiche sans stock).';
        if (q && !O.estDate(date)) return 'Date d\'entrée invalide.';
      }
      S.retenir();
      const propre = R.normaliserVin(nouveau, annee() + 1);
      if (v) Object.assign(v, propre); else S.E.vins.push(propre);
      if (q) S.E.mouvements.push({ id: uid(), vinId: propre.id, date, type: 'entree', motif: 'achat', quantite: q, prixUnitaire: prixAchat, noteDegustation: 0, commentaire: '' });
      S.sauver(); S.rendre(); S.toast(v ? 'Fiche enregistrée.' : `« ${titreVin(propre)} » : ${S.pluriel(q, 'bouteille')} en cave.`, { libelle: 'Annuler', faire: S.annuler });
      return undefined;
    }, { large: true });
  }

  function modaleMouvement(id, { vinId = null, type = 'sortie' } = {}) {
    const m = id ? S.E.mouvements.find((x) => x.id === id) : null;
    if (!S.E.vins.length) { S.toast('Ajoute d\'abord un vin.'); return; }
    let t = m?.type || type;
    let vid = m?.vinId || vinId || (t === 'sortie' ? S.E.vins.find((v) => R.stock(S.E, v.id) > 0)?.id : S.E.vins[0].id) || S.E.vins[0].id;
    const corps = () => {
      const motifs = t === 'entree' ? B.motifsEntree : B.motifsSortie;
      const st = R.stock(S.E, vid);
      return `
        <div class="choix-statut deux"><label><input type="radio" name="type" value="entree" data-maj="1" ${t === 'entree' ? 'checked' : ''}><span>Entrée</span></label><label><input type="radio" name="type" value="sortie" data-maj="1" ${t === 'sortie' ? 'checked' : ''}><span>Sortie</span></label></div>
        <label class="champ">Vin<select name="vinId" data-maj="1">${[...S.E.vins].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')).map((v) => `<option value="${v.id}" ${v.id === vid ? 'selected' : ''}>${esc(titreVin(v))} (${R.stock(S.E, v.id)})</option>`).join('')}</select><small>Stock actuel : ${S.pluriel(st, 'bouteille')}.</small></label>
        <div class="rang-champs"><label class="champ">Motif<select name="motif">${motifs.map(([k, l]) => `<option value="${k}" ${m?.motif === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label><label class="champ">Date<input type="date" name="date" value="${m?.date || S.auj()}"></label><label class="champ">Bouteilles<input name="quantite" inputmode="numeric" value="${m?.quantite ?? 1}"></label></div>
        ${t === 'entree' ? `<label class="champ">Prix unitaire (€) <small>Facultatif.</small><input name="prix" inputmode="decimal" value="${O.saisieMontant(m?.prixUnitaire ?? (m ? null : vin(vid)?.prixAchat ?? null))}"></label>`
          : `<div class="rang-champs"><label class="champ">Note de dégustation<select name="noteDegustation"><option value="0">—</option>${[1, 2, 3, 4, 5].map((n) => `<option value="${n}" ${m?.noteDegustation === n ? 'selected' : ''}>${'★'.repeat(n)}</option>`).join('')}</select></label></div>`}
        <label class="champ">Commentaire<input name="commentaire" maxlength="300" value="${esc(m?.commentaire || '')}" placeholder="${t === 'sortie' ? 'Avec quoi, avec qui, impressions' : 'Caviste, salon, cadeau de…'}"></label>
        <p class="erreur" role="alert"></p>`;
    };
    const d = S.ouvrirModale(m ? 'Mouvement' : 'Nouveau mouvement', corps(), m ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>' : '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f, action) => {
      if (action === 'supprimer') {
        const reste = S.E.mouvements.filter((x) => x.vinId === m.vinId && x.id !== m.id);
        if (R.premierNegatif(reste)) return 'Impossible : sans cette entrée, des sorties ultérieures n\'auraient plus de bouteilles.';
        S.retenir(); S.E.mouvements = S.E.mouvements.filter((x) => x.id !== m.id); S.sauver(); S.rendre(); S.toast('Mouvement supprimé.', { libelle: 'Annuler', faire: S.annuler });
        return undefined;
      }
      const prix = t === 'entree' ? lireMontant(f.get('prix')) : null;
      if (Number.isNaN(prix)) return 'Prix illisible : par exemple 14,50.';
      const nouveau = { id: m?.id || uid(), vinId: f.get('vinId'), type: t, motif: f.get('motif'), date: f.get('date'), quantite: Number(String(f.get('quantite')).trim()), prixUnitaire: prix, noteDegustation: t === 'sortie' ? Number(f.get('noteDegustation')) : 0, commentaire: O.texte(f.get('commentaire'), 300) };
      const err = R.validerMouvement(S.E, nouveau, m?.id);
      if (err) return err;
      S.retenir();
      if (m) Object.assign(m, nouveau); else S.E.mouvements.push(nouveau);
      S.sauver(); S.rendre();
      const v = vin(nouveau.vinId);
      S.toast(`${titreVin(v)} : ${S.pluriel(R.stock(S.E, v.id), 'bouteille')} en cave.`, { libelle: 'Annuler', faire: S.annuler });
      return undefined;
    });
    d.querySelector('form').addEventListener('change', (e) => { if (!e.target.dataset.maj) return; const f = new FormData(d.querySelector('form')); t = f.get('type'); vid = f.get('vinId'); d.querySelector('.modale-corps').innerHTML = corps(); });
  }

  // ---------- Actions ----------
  const actions = {
    'vin-nouveau': () => modaleVin(null),
    'vin-ouvrir': (el) => modaleVin(el.dataset.id),
    entree: (el) => modaleMouvement(null, { vinId: el.dataset.id || null, type: 'entree' }),
    sortie: (el) => modaleMouvement(null, { vinId: el.dataset.id || null, type: 'sortie' }),
    'mouvement-nouveau': () => modaleMouvement(null, { type: 'sortie' }),
    'mouvement-ouvrir': (el) => modaleMouvement(el.dataset.id),
    'garde-defaut': () => { S.retenir(); S.E.reglages.garde = R.normaliserGarde({}); S.sauver(); S.rendre(); S.toast('Règles de départ rétablies.', { libelle: 'Annuler', faire: S.annuler }); },
    imprimer: () => S.imprimer(() => { if (S.vue !== 'cave') S.changerVue('cave'); }),
    'csv-cave': () => S.exporterCsv(R.csvCave(S.E, S.auj()), 'cave-inventaire'),
    'csv-mouvements': () => S.exporterCsv(R.csvMouvements(S.E), 'cave-mouvements'),
  };

  S = window.QME_SOCLE.creer({
    produit: 'CVM', prefixe: 'cvm', nom: 'CaveManager', fichier: 'cave', titreBarre: 'CaveManager<br>Cave personnelle',
    connexion: { titre: 'Sache quoi ouvrir et ce que contient ta cave.', texte: 'Inventaire par emplacement, entrées et sorties datées, fenêtres de consommation, alertes, statistiques et suggestions de bouteilles à ouvrir.', ouvrir: 'Ouvre ta cave', bouton: 'Ouvrir ma cave' },
    onglets: [
      { id: 'cave', nom: 'Cave', icone: 'grille' },
      { id: 'ouvrir', nom: 'À ouvrir', icone: 'triangle' },
      { id: 'mouvements', nom: 'Mouvements', icone: 'lignes' },
      { id: 'stats', nom: 'Statistiques', icone: 'barres' },
      { id: 'garde', nom: 'Garde', icone: 'rond' },
    ],
    etatVide: R.etatVide, normaliser: (d) => R.normaliser(d), donneesDemo, accueil, apresAccueil,
    vues: { cave: vueCave, ouvrir: vueOuvrir, mouvements: vueMouvements, stats: vueStats, garde: vueGarde },
    apresRendu() {
      S.$('#recherche')?.addEventListener('input', (e) => { ui.q = e.target.value; S.rendre(); });
      S.$('#filtre-cat')?.addEventListener('change', (e) => { ui.cat = e.target.value; S.rendre(); });
      S.$('#filtre-etat')?.addEventListener('change', (e) => { ui.etat = e.target.value; S.rendre(); });
      S.$('#form-ouvrir')?.addEventListener('change', (e) => { const f = new FormData(e.currentTarget); const vm = lireMontant(f.get('valeurMax')); ui.critere = { categorie: f.get('categorie'), valeurMax: Number.isNaN(vm) ? null : vm }; S.rendre(); });
      S.$('#form-ouvrir')?.addEventListener('submit', (e) => e.preventDefault());
      S.$('#form-garde')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        const g = {};
        for (const c of B.categories) {
          const [d, a, fin] = ['debut', 'apogee', 'fin'].map((k) => Number(f.get(`${c.id}-${k}`)));
          if (![d, a, fin].every((x) => Number.isInteger(x) && x >= 0 && x <= 100)) return S.toast(`${c.nom} : années entières entre 0 et 100.`);
          if (!(d <= a && a <= fin)) return S.toast(`${c.nom} : il faut « à partir de » ≤ apogée ≤ « jusqu'à ».`);
          g[c.id] = { debut: d, apogee: a, fin };
        }
        S.retenir(); S.E.reglages.garde = R.normaliserGarde(g); S.sauver(); S.rendre(); S.toast('Règles enregistrées : les fenêtres indicatives sont recalculées.', { libelle: 'Annuler', faire: S.annuler });
        return undefined;
      });
    },
    actions,
    reglages: {
      exports: [['csv-cave', 'Inventaire (CSV)'], ['csv-mouvements', 'Mouvements (CSV)'], ['imprimer', 'Imprimer l\'inventaire']],
      aPropos: () => `<p class="mention">${B.categories.length} catégories, règles de garde indicatives modifiables (version ${B.version}). ${esc(B.avertissement)}</p>`,
    },
    importValide: (d) => d && typeof d === 'object' && Array.isArray(d.vins),
    resumeImport: (d) => `${S.pluriel(d.vins.length, 'vin')}, ${S.pluriel((d.mouvements || []).length, 'mouvement')}`,
  });
  S.lancer();
})();
