// WattBudget · interface. Socle commun : templates/commun/socle.js. Règles : regles.js (window.WTT).
// Aucun tarif fourni, aucune connexion à un fournisseur ou à un compteur.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.WTT;
  const O = window.QME_OUTILS;
  const { esc } = window.QME_SOCLE;
  let S = null;
  const uid = () => O.nouvelId();
  const kwh = (n) => `${O.fmtNombre(n, { dec: n < 10 ? 2 : n < 100 ? 1 : 0 })} kWh`;
  const eur = (c, centimes = true) => (c === null || c === undefined ? '–' : O.euros(c, { centimes }));
  const nomCat = (id) => B.categories.find((c) => c.id === id)?.nom || 'Autres appareils';
  const prixTxt = (p) => (p ? `${O.fmtNombre(p, { dec: 4 })} €/kWh` : 'non saisi');
  const LIB_FIAB = { mesuree: ['Mesurée', 'vert'], etiquette: ['Étiquette énergie', 'ciel'], estimee: ['Estimée', 'jaune'] };
  const ui = { selection: new Set(), remp: { appareilId: '', kwhApres: '', prixAchat: '', dureeVie: '10' } };
  const appareil = (id) => S.E.appareils.find((a) => a.id === id);
  const r = () => S.E.reglages;

  // ---------- Données de démonstration (foyer fictif, tarif fictif) ----------
  function donneesDemo() {
    const e = R.etatVide();
    e.reglages = R.normaliserReglages({ option: 'hphc', prixHP: 0.24, prixHC: 0.18, abonnement: 18000, dateTarif: O.ajout(O.iso(new Date()), -120), factureKwh: 10800, tarifFictif: true });
    const ajout = (id, extra = {}) => { const a = R.depuisCatalogue(id, { id: uid(), ...extra }); e.appareils.push(a); return a; };
    ajout('radiateur', { quantite: 4, note: 'Séjour et chambres.' });
    ajout('chauffe-eau', { horaire: 'hc', note: 'Programmé la nuit.' });
    ajout('seche-serviettes');
    ajout('frigo-congel', { kwhAn: 410, note: 'Ancien modèle, étiquette relevée : 410 kWh/an.' });
    ajout('congelateur', { mode: 'mesure', mesureKwh: 4.6, mesureJours: 7, mesureLe: O.ajout(O.iso(new Date()), -10), note: 'Mesuré au wattmètre pendant une semaine.' });
    ajout('lave-linge', { horaire: 'hc' });
    ajout('lave-vaisselle');
    ajout('seche-linge', { cycles: 2 });
    ajout('four');
    ajout('plaque-induction');
    ajout('bouilloire');
    ajout('micro-ondes');
    ajout('box');
    ajout('tv', { heures: 4, veilleH: 20 });
    ajout('decodeur');
    ajout('console', { note: 'Laissée en veille la nuit.' });
    ajout('portable', { quantite: 2 });
    ajout('led', { quantite: 12 });
    ajout('lampadaire', { note: 'Halogène de 300 W, à remplacer ?' });
    ajout('aspirateur');
    const id = (n) => e.appareils.find((a) => a.nom.startsWith(n)).id;
    e.scenarios = [
      R.normaliserScenario({ id: uid(), nom: 'Chasse aux veilles', actions: ['Décodeur', 'Console', 'Téléviseur', 'Four à micro', 'Lave-vaisselle', 'Lave-linge'].map((n) => ({ id: uid(), appareilId: id(n), type: 'veille', investissement: n === 'Décodeur' ? 1500 : 0 })) }, e.appareils.map((a) => a.id)),
      R.normaliserScenario({ id: uid(), nom: 'Remplacer le réfrigérateur et le lampadaire', actions: [
        { id: uid(), appareilId: id('Réfrigérateur-congélateur'), type: 'remplacer', valeur: 230, investissement: 69900 },
        { id: uid(), appareilId: id('Lampadaire'), type: 'remplacer', valeur: 25, investissement: 4500 },
        { id: uid(), appareilId: id('Lave-vaisselle'), type: 'hc' },
        { id: uid(), appareilId: id('Radiateur'), type: 'duree', valeur: 10 },
      ] }, e.appareils.map((a) => a.id)),
    ];
    return e;
  }

  // ---------- Premier lancement ----------
  function accueil() {
    return `
      <p class="surtitre">Bienvenue</p>
      <h1>Ce que te coûtent tes appareils.</h1>
      <p class="intro">Saisis le prix de ton électricité, puis coche tes appareils dans un catalogue de ${B.appareils.length} appareils courants. Tu ajusteras ensuite leur puissance et leur durée d'utilisation.</p>
      <form id="form-accueil" class="formulaire-accueil large" novalidate>
        <fieldset class="champ cadre-champs"><legend>Ton tarif <small>Sur ta facture ou ton espace client. Aucun tarif n'est fourni d'office : ils changent. Tu peux le saisir plus tard.</small></legend>
          ${champsTarif(R.normaliserReglages({}))}
        </fieldset>
        <fieldset class="champ"><legend>Tes appareils</legend>
          <div class="choix-types">${B.categories.map((c) => `<fieldset class="groupe-types"><legend>${esc(c.nom)}</legend>${B.appareils.filter((a) => a.cat === c.id).map((a) => `<label class="case"><input type="checkbox" name="cat-${a.id}"> <span>${esc(a.nom)}</span></label>`).join('')}</fieldset>`).join('')}</div>
        </fieldset>
        <p class="erreur" role="alert"></p>
        <div class="accueil-pied"><span class="mini">Tout reste modifiable.</span><button class="btn primaire" type="submit">Créer mon bilan</button></div>
      </form>
      <ol class="conseils" style="margin-top:32px">${B.conseils.map(([t, d]) => `<li><b>${esc(t)}</b><span>${esc(d)}</span></li>`).join('')}</ol>`;
  }
  function apresAccueil() {
    brancherTarif(S.$('#form-accueil'));
    S.$('#form-accueil').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const t = lireTarif(f);
      if (typeof t === 'string') { e.target.querySelector('.erreur').textContent = t; return; }
      const etat = R.etatVide();
      etat.reglages = t;
      etat.appareils = B.appareils.filter((a) => f.get(`cat-${a.id}`)).map((a) => R.depuisCatalogue(a.id, { id: uid() }));
      S.terminerAccueil(etat, { vue: etat.appareils.length ? 'apercu' : 'appareils', message: etat.appareils.length ? `${S.pluriel(etat.appareils.length, 'appareil ajouté', 'appareils ajoutés')} avec des valeurs indicatives : ajuste-les avec ta plaque signalétique.` : 'Ajoute ton premier appareil.' });
    });
  }

  // ---------- Tarif (réglages et premier lancement) ----------
  function champsTarif(t) {
    return `<div class="choix-statut deux" role="radiogroup" aria-label="Option tarifaire">
        <label><input type="radio" name="option" value="base" ${t.option === 'base' ? 'checked' : ''}><span>Prix unique (base)</span></label>
        <label><input type="radio" name="option" value="hphc" ${t.option === 'hphc' ? 'checked' : ''}><span>Heures pleines / creuses</span></label></div>
      <div class="rang-champs" data-option="base" ${t.option === 'base' ? '' : 'hidden'}><label class="champ">Prix du kWh (€ TTC)<input name="prix" inputmode="decimal" value="${O.saisieNombre(t.prix)}" placeholder="Ex. : 0,2016"></label></div>
      <div class="rang-champs" data-option="hphc" ${t.option === 'hphc' ? '' : 'hidden'}><label class="champ">Heures pleines (€/kWh)<input name="prixHP" inputmode="decimal" value="${O.saisieNombre(t.prixHP)}"></label><label class="champ">Heures creuses (€/kWh)<input name="prixHC" inputmode="decimal" value="${O.saisieNombre(t.prixHC)}"></label></div>
      <div class="rang-champs">
        <label class="champ">Abonnement annuel (€ TTC) <small>Facultatif : la part fixe de ta facture.</small><input name="abonnement" inputmode="decimal" value="${O.saisieMontant(t.abonnement)}"></label>
        <label class="champ">Tarif en vigueur depuis le <small>Facultatif, pour savoir quand le revoir.</small><input type="date" name="dateTarif" value="${t.dateTarif || ''}"></label>
      </div>
      <label class="champ">Consommation annuelle de ta facture (kWh) <small>Facultatif : pour voir quelle part ton inventaire explique.</small><input name="factureKwh" inputmode="decimal" value="${O.saisieNombre(t.factureKwh)}"></label>`;
  }
  function brancherTarif(racine) {
    racine.querySelectorAll('[name=option]').forEach((x) => x.addEventListener('change', () => {
      const v = racine.querySelector('[name=option]:checked').value;
      racine.querySelectorAll('[data-option]').forEach((d) => { d.hidden = d.dataset.option !== v; });
    }));
  }
  function lireTarif(f) {
    const lire = (n) => { const s = String(f.get(n) || '').trim(); if (!s) return null; const v = O.lireNombre(s); return v === null || v <= 0 || v > 5 ? NaN : v; };
    const option = f.get('option') === 'hphc' ? 'hphc' : 'base';
    const prix = lire('prix'), prixHP = lire('prixHP'), prixHC = lire('prixHC');
    if ([prix, prixHP, prixHC].some(Number.isNaN)) return 'Prix du kWh : nombre en euros entre 0 et 5, par exemple 0,2016.';
    if (option === 'hphc' && (prixHP === null) !== (prixHC === null)) return 'Saisis les deux prix, heures pleines et heures creuses.';
    const ab = String(f.get('abonnement') || '').trim();
    const abonnement = ab ? O.lireMontant(ab) : null;
    if (ab && abonnement === null) return 'Abonnement illisible : écris un montant en euros, par exemple 180,50.';
    const fk = String(f.get('factureKwh') || '').trim();
    const factureKwh = fk ? O.lireNombre(fk) : null;
    if (fk && !(factureKwh >= 1)) return 'Consommation de la facture : nombre de kWh positif.';
    return R.normaliserReglages({ option, prix, prixHP, prixHC, abonnement, dateTarif: f.get('dateTarif') || null, factureKwh, tarifFictif: false });
  }

  // ---------- Vues ----------
  const AVERTISSEMENT = `<p class="mention avertissement">Estimation à partir de tes saisies : ta facture et ton compteur font foi. Les valeurs du catalogue sont indicatives. ${esc(B.sourceValeurs)}</p>`;
  function bandeauTarif() {
    const t = r();
    if (!R.tarifComplet(t)) return `<div class="alerte-tarif"><div><b>Ton prix du kWh n'est pas saisi.</b><span>Les consommations sont calculées en kWh ; les coûts s'afficheront dès que tu auras saisi ton tarif.</span></div><button class="btn primaire petit" data-action="reglages">Saisir mon tarif</button></div>`;
    const age = t.dateTarif ? O.ecart(t.dateTarif, O.iso(new Date())) : null;
    if (t.tarifFictif) return `<div class="alerte-tarif douce"><div><b>Tarif fictif de l'exemple</b><span>${t.option === 'hphc' ? `HP ${prixTxt(t.prixHP)}, HC ${prixTxt(t.prixHC)}` : prixTxt(t.prix)} : ce n'est pas un tarif réel. Remplace-le par celui de ton contrat.</span></div><button class="btn petit" data-action="reglages">Modifier</button></div>`;
    if (age !== null && age > 365) return `<div class="alerte-tarif douce"><div><b>Tarif saisi il y a plus d'un an</b><span>Vérifie qu'il est toujours celui de ton contrat.</span></div><button class="btn petit" data-action="reglages">Vérifier</button></div>`;
    return '';
  }

  function barres(items, valeur, libelleVal, info) {
    const max = Math.max(...items.map(valeur), 0.0001);
    return `<figure class="graphique"><div class="barres-cats">${items.map((x) => `<div class="barre-cat" tabindex="0" data-info="${esc(info(x))}"><span class="bc-nom">${esc(x.nom || nomCat(x.cat))}</span><span class="bc-piste"><span class="bc-barre" style="width:${Math.max(0.5, (valeur(x) / max) * 100)}%"></span></span><span class="bc-val"><b>${libelleVal(x)}</b></span></div>`).join('')}</div><div class="infobulle" hidden></div></figure>`;
  }

  function vueApercu() {
    const t = R.totaux(S.E.appareils, r());
    if (!S.E.appareils.length) return `${bandeauTarif()}<div class="vue-tete"><div><h1>Aperçu</h1><p>Ton inventaire est vide.</p></div></div><div class="vide-etat">${S.FORME_VIDE}<div><h3>Ajoute tes appareils</h3><p>Choisis-les dans le catalogue : puissance et durée d'utilisation sont préremplies, tu les ajustes ensuite.</p><div class="actions"><button class="btn primaire" data-action="catalogue">${S.ICONES.plus}Ajouter depuis le catalogue</button></div></div></div>`;
    const c = t.complet;
    const tuiles = [
      ['Par an', c ? eur(t.cout, false) : kwh(t.kwh), c ? `${kwh(t.kwh)} par an, hors abonnement` : 'tarif à saisir pour le coût', 'var(--bleu)', ''],
      ['Par mois', c ? eur(t.parMois) : kwh(t.kwh / 12), c ? 'moyenne, hors abonnement' : 'en moyenne', 'var(--jaune)', 'rond'],
      ['Par jour', c ? eur(t.parJour) : kwh(t.kwh / 365), 'en moyenne sur l\'année', 'var(--encre)', ''],
      ['Facture estimée', c ? eur(t.facture, false) : '–', c ? (t.abonnement ? `dont ${eur(t.abonnement, false)} d'abonnement` : 'abonnement non saisi') : 'tarif à saisir', 'var(--rouge)', 'rond'],
    ].map(([lib, v, d, coul, fo]) => `<div class="tuile ${fo}" style="--c:${coul}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`).join('');
    const top = t.postes.slice(0, 8);
    const fiab = t.fiabilite;
    return `
      ${bandeauTarif()}
      <div class="vue-tete"><div><h1>Aperçu</h1><p>Consommation et coût estimés de ${S.pluriel(t.lignes.length - t.erreurs, 'appareil')}${t.erreurs ? ` (${S.pluriel(t.erreurs, 'appareil incomplet', 'appareils incomplets')}, non compté${t.erreurs > 1 ? 's' : ''})` : ''}.</p></div>
        <div class="actions"><button class="btn primaire" data-action="catalogue">${S.ICONES.plus}Ajouter</button></div></div>
      <div class="tuiles">${tuiles}</div>
      <h2 class="titre-section">Principaux postes <span>Les ${top.length} premiers font ${O.fmtNombre(top.at(-1)?.cumul ?? 0)} % de ta consommation</span></h2>
      ${barres(top, (x) => x.kwh, (x) => (c ? `${eur(x.cout, false)} · ${O.fmtNombre(x.part)} %` : `${kwh(x.kwh)} · ${O.fmtNombre(x.part)} %`), (x) => `<b>${esc(x.nom)}</b>${kwh(x.kwh)} par an<br>${c ? `${eur(x.cout)} par an, ${eur(Math.round(x.cout / 12))} par mois<br>` : ''}${O.fmtNombre(x.part)} % du total, cumul ${O.fmtNombre(x.cumul)} %<br>Valeur ${LIB_FIAB[x.fiabilite][0].toLowerCase()}`)}
      <details class="tableau-details"><summary>Voir le tableau de tous les postes</summary><div class="defile"><table class="tableau compact"><thead><tr><th>Appareil</th><th class="nb">kWh/an</th><th class="nb">€/an</th><th class="nb">Part</th><th class="nb">Cumul</th><th>Fiabilité</th></tr></thead><tbody>${t.postes.map((x) => `<tr><td>${esc(x.nom)}</td><td class="nb">${O.fmtNombre(x.kwh, { dec: 1 })}</td><td class="nb">${eur(x.cout)}</td><td class="nb">${O.fmtNombre(x.part)} %</td><td class="nb">${O.fmtNombre(x.cumul)} %</td><td>${LIB_FIAB[x.fiabilite][0]}</td></tr>`).join('')}</tbody></table></div></details>
      <div class="colonnes-2">
        <section><h2 class="titre-section">Par catégorie</h2>
          ${barres(t.parCat, (x) => x.kwh, (x) => (c ? eur(x.cout, false) : kwh(x.kwh)), (x) => `<b>${esc(nomCat(x.cat))}</b>${kwh(x.kwh)} par an<br>${c ? `${eur(x.cout)} par an<br>` : ''}${S.pluriel(x.nb, 'appareil')}`)}</section>
        <section><h2 class="titre-section">Fiabilité des valeurs</h2>
          <div class="jauges">${[['mesuree', fiab.mesuree], ['etiquette', fiab.etiquette], ['estimee', fiab.estimee]].map(([k, n]) => `<div class="jauge-ligne"><span>${LIB_FIAB[k][0]}</span><span class="jauge" style="--c:${k === 'mesuree' ? 'var(--vert)' : k === 'etiquette' ? 'var(--bleu)' : 'var(--jaune)'}"><span style="width:${(n / Math.max(1, t.lignes.length - t.erreurs)) * 100}%"></span></span><b>${n}</b></div>`).join('')}</div>
          <p class="aide" style="margin-top:12px">${fiab.estimee ? `${S.pluriel(fiab.estimee, 'appareil repose', 'appareils reposent')} sur des valeurs indicatives : la plaque signalétique, l'étiquette énergie ou un wattmètre les rendent fiables.` : 'Toutes les valeurs viennent d\'une étiquette ou d\'une mesure.'}</p>
          ${t.veille ? `<p class="aide" style="margin-top:8px">Veilles : ${kwh(t.veille)} par an${c ? `, soit ${eur(t.coutVeille)}` : ''}.</p>` : ''}
          ${t.couverture !== null ? `<p class="aide" style="margin-top:8px">Ton inventaire explique <b>${O.fmtNombre(t.couverture)} %</b> des ${kwh(r().factureKwh)} de ta facture${t.couverture < 80 ? ' : des appareils manquent ou sont sous-estimés.' : t.couverture > 120 ? ' : des durées sont sans doute surestimées.' : '.'}</p>` : ''}
        </section>
      </div>
      ${AVERTISSEMENT}`;
  }

  function etiquettes(a, c) {
    const t = [];
    if (!c.ok) t.push('<span class="etiquette rouge">Incomplet</span>');
    const [lib, coul] = LIB_FIAB[c.fiabilite];
    t.push(`<span class="etiquette ${coul}">${lib}</span>`);
    if (a.quantite > 1) t.push(`<span class="etiquette sable">× ${a.quantite}</span>`);
    if (a.horaire === 'hc' && r().option === 'hphc') t.push('<span class="etiquette encre">Heures creuses</span>');
    if (a.mode !== 'annuel' && a.mois < 12) t.push(`<span class="etiquette sable">${O.fmtNombre(a.mois)} mois par an</span>`);
    if (c.veille) t.push('<span class="etiquette rose">Veille</span>');
    return t.join('');
  }

  function vueAppareils() {
    const t = R.totaux(S.E.appareils, r());
    const groupes = B.categories.map((cat) => ({ cat, ls: t.lignes.filter((x) => x.a.cat === cat.id).sort((x, y) => y.c.total - x.c.total) })).filter((g) => g.ls.length);
    return `
      ${bandeauTarif()}
      <div class="vue-tete"><div><h1>Appareils</h1><p>Clique sur un appareil pour ajuster sa puissance, sa durée, ou saisir son étiquette énergie ou une mesure au wattmètre.</p></div>
        <div class="actions"><button class="btn" data-action="appareil-nouveau">Appareil personnalisé</button><button class="btn primaire" data-action="catalogue">${S.ICONES.plus}Depuis le catalogue</button></div></div>
      ${groupes.length ? groupes.map(({ cat, ls }) => `<section class="groupe-cat"><h2 class="titre-cat">${esc(cat.nom)}<span>${S.pluriel(ls.length, 'appareil')} · ${kwh(ls.reduce((s, x) => s + x.c.total, 0))}${t.complet ? ` · ${eur(ls.reduce((s, x) => s + (x.cout || 0), 0), false)} par an` : ''}</span></h2>
        <ul class="lignes-abos">${ls.map(({ a, c, cout: co }) => `<li class="ligne ${c.ok ? '' : 'alerte-rouge'}"><button class="ligne-info" data-action="appareil-ouvrir" data-id="${a.id}"><b>${esc(a.nom)}</b><span class="formule">${c.ok ? esc(c.formule) : esc(c.erreur)}</span><span class="ligne-etiquettes">${etiquettes(a, c)}</span></button>
          <div class="ligne-droite"><span class="ligne-cout">${c.ok ? (co !== null ? `<b>${eur(co)}</b><small>par an · ${eur(Math.round(co / 12))} par mois · ${kwh(c.total)}</small>` : `<b>${kwh(c.total)}</b><small>par an</small>`) : '<button class="btn petit" data-action="appareil-ouvrir" data-id="' + a.id + '">Compléter</button>'}</span></div></li>`).join('')}</ul></section>`).join('')
        : `<div class="vide-etat">${S.FORME_VIDE}<div><h3>Aucun appareil</h3><p>Ajoute tes appareils depuis le catalogue (valeurs indicatives préremplies) ou crée un appareil personnalisé.</p><div class="actions"><button class="btn primaire" data-action="catalogue">${S.ICONES.plus}Depuis le catalogue</button></div></div></div>`}
      ${AVERTISSEMENT}`;
  }

  function vueComparer() {
    const t = R.totaux(S.E.appareils, r());
    const valides = t.lignes.filter((x) => x.c.ok);
    if (!valides.length) return `<div class="vue-tete"><div><h1>Comparer</h1></div></div><div class="vide-etat petit"><div><h3>Rien à comparer</h3><p>Ajoute au moins un appareil complet.</p></div></div>`;
    const choisis = valides.filter((x) => ui.selection.has(x.a.id));
    const rp = ui.remp;
    const cible = appareil(rp.appareilId) || valides[0].a;
    const consoCible = R.consommation(cible);
    const res = (() => {
      const apres = O.lireNombre(rp.kwhApres);
      const achat = String(rp.prixAchat).trim() ? O.lireMontant(rp.prixAchat) : null;
      if (apres === null || achat === null) return null;
      return R.remplacement({ kwhAvant: consoCible.total, kwhApres: apres * cible.quantite, prix: R.prixKwh(cible, r()), prixAchat: achat, dureeVie: O.lireNombre(rp.dureeVie) || null });
    })();
    return `
      ${bandeauTarif()}
      <div class="vue-tete"><div><h1>Comparer</h1><p>Coche des appareils pour les comparer, ou simule le remplacement d'un équipement par un modèle plus sobre.</p></div></div>
      <div class="colonnes-2">
        <section><h2 class="titre-section">Appareils à comparer <span>${choisis.length} sélectionné${choisis.length > 1 ? 's' : ''}</span></h2>
          <ul class="liste-cases">${valides.map(({ a, c }) => `<li class="${ui.selection.has(a.id) ? '' : ''}"><input type="checkbox" id="cmp-${a.id}" data-action="selection" data-id="${a.id}" ${ui.selection.has(a.id) ? 'checked' : ''}><label class="libelle" for="cmp-${a.id}"><b>${esc(a.nom)}</b><small>${kwh(c.total)} par an</small></label><span></span></li>`).join('')}</ul></section>
        <section><h2 class="titre-section">Simuler un remplacement</h2>
          <form id="form-remp" class="carte-el formulaire-remp" novalidate>
            <label class="champ">Appareil actuel<select name="appareilId">${valides.map(({ a }) => `<option value="${a.id}" ${a.id === cible.id ? 'selected' : ''}>${esc(a.nom)}${a.quantite > 1 ? ` (× ${a.quantite})` : ''}</option>`).join('')}</select><small>Consommation actuelle : ${kwh(consoCible.total)} par an.</small></label>
            <div class="rang-champs"><label class="champ">Nouveau modèle (kWh/an, à l'unité)<small>Étiquette énergie du modèle envisagé.</small><input name="kwhApres" inputmode="decimal" value="${esc(rp.kwhApres)}"></label>
              <label class="champ">Prix d'achat total (€)<small>0 si déjà payé.</small><input name="prixAchat" inputmode="decimal" value="${esc(rp.prixAchat)}"></label>
              <label class="champ">Durée de vie (ans)<input name="dureeVie" inputmode="decimal" value="${esc(rp.dureeVie)}"></label></div>
            <div class="resultat-remp" aria-live="polite">${!res ? '<p class="mini">Saisis la consommation du nouveau modèle et son prix d\'achat.</p>' : !res.ok ? `<p class="texte-rouge"><b>${esc(res.erreur)}</b></p>` : `
              <p><b class="chiffre-cle">${res.economieAn > 0 ? eur(res.economieAn) : eur(0)}</b> d'économie par an (${kwh(Math.max(0, res.economieKwh))}).</p>
              <p>${res.retourAns === null ? '<b class="texte-rouge">Pas d\'économie : le remplacement ne se rentabilise jamais sur l\'électricité.</b>' : res.retourAns === 0 ? 'Rentabilisé immédiatement (aucun achat).' : `Rentabilisé en <b>${res.retourMois < 24 ? S.pluriel(res.retourMois, 'mois', 'mois') : `${O.fmtNombre(res.retourAns, { dec: 1 })} ans`}</b>${res.rentableSurVie === false ? ', <b class="texte-rouge">plus que sa durée de vie</b>' : ''}.`}</p>
              ${res.bilanVie !== null ? `<p class="mini">Bilan sur la durée de vie : ${eur(res.bilanVie, false)} (économies − prix d'achat), au tarif actuel.</p>` : ''}
              ${res.economieKwh > 0 ? '<button class="btn petit" type="button" data-action="remp-scenario">Ajouter aux scénarios</button>' : ''}`}</div>
          </form></section>
      </div>
      ${choisis.length ? `<h2 class="titre-section">Comparaison</h2><div class="defile"><table class="tableau compact"><thead><tr><th>Appareil</th><th>Mode</th><th class="nb">Puissance</th><th class="nb">Usage</th><th class="nb">kWh/an</th><th class="nb">€/an</th><th class="nb">€/mois</th><th class="nb">Part du total</th></tr></thead>
        <tbody>${choisis.map(({ a, c, cout: co }) => `<tr><td>${esc(a.nom)}${a.quantite > 1 ? ` × ${a.quantite}` : ''}</td><td>${esc(B.modes.find((m) => m.id === a.mode).nom.split(' ')[0])}</td><td class="nb">${a.mode === 'duree' ? `${O.fmtNombre(a.puissance)} W` : '–'}</td><td class="nb">${a.mode === 'duree' ? `${O.fmtNombre(a.heures)} h × ${O.fmtNombre(a.jours)} j/sem` : a.mode === 'cycles' ? `${O.fmtNombre(a.cycles)} cycles/sem` : '–'}</td><td class="nb">${O.fmtNombre(c.total, { dec: 1 })}</td><td class="nb">${eur(co)}</td><td class="nb">${co === null ? '–' : eur(Math.round(co / 12))}</td><td class="nb">${t.kwh ? O.fmtNombre(O.arrondi((c.total / t.kwh) * 100, 1)) : 0} %</td></tr>`).join('')}</tbody>
        ${choisis.length > 1 ? `<tfoot><tr><td colspan="4">Total de la sélection</td><td class="nb">${O.fmtNombre(choisis.reduce((s, x) => s + x.c.total, 0), { dec: 1 })}</td><td class="nb">${t.complet ? eur(choisis.reduce((s, x) => s + x.cout, 0)) : '–'}</td><td class="nb">${t.complet ? eur(Math.round(choisis.reduce((s, x) => s + x.cout, 0) / 12)) : '–'}</td><td></td></tr></tfoot>` : ''}</table></div>` : '<p class="aide" style="margin-top:20px">Coche au moins un appareil pour afficher le tableau comparatif.</p>'}
      ${AVERTISSEMENT}`;
  }

  function vueScenarios() {
    const sc = S.E.scenarios;
    const nomAction = (ac) => {
      const a = appareil(ac.appareilId);
      const def = B.actions.find((x) => x.id === ac.type);
      const v = ac.type === 'duree' ? ` de ${O.fmtNombre(ac.valeur || 0)} %` : ac.type === 'remplacer' ? ` (${kwh(ac.valeur || 0)} par an)` : '';
      return `${esc(a?.nom || 'Appareil supprimé')} : ${esc(def.nom.toLowerCase())}${v}${ac.investissement ? ` · ${eur(ac.investissement, false)} d'achat` : ''}`;
    };
    return `
      ${bandeauTarif()}
      <div class="vue-tete"><div><h1>Scénarios</h1><p>Combine des actions (veilles, durées, heures creuses, remplacements) et compare l'économie annuelle à ta situation actuelle.</p></div>
        <div class="actions"><button class="btn" data-action="scenario-rapide">Scénarios rapides</button><button class="btn primaire" data-action="scenario-nouveau">${S.ICONES.plus}Nouveau scénario</button></div></div>
      ${sc.length ? `<div class="grille-cartes scenarios">${sc.map((s) => {
        const res = R.resultatScenario(S.E.appareils, s, r());
        const retour = res.investissement && res.economie > 0 ? O.arrondi(res.investissement / res.economie, 1) : null;
        return `<article class="carte-el"><button class="lien-ligne" data-action="scenario-ouvrir" data-id="${s.id}"><b>${esc(s.nom)}</b><span>${S.pluriel(s.actions.length, 'action')}</span></button>
          <p class="chiffre-cle">${res.economie !== null ? `${eur(res.economie, false)} <small class="mini">par an</small>` : `${kwh(res.economieKwh)} <small class="mini">par an</small>`}</p>
          <p class="detail">−${O.fmtNombre(res.economiePct)} % · ${kwh(res.economieKwh)} économisés · ${res.apres.cout !== null ? `${eur(res.apres.cout, false)} par an au lieu de ${eur(res.avant.cout, false)}` : 'tarif à saisir pour le coût'}</p>
          ${res.investissement ? `<p class="detail">Investissement ${eur(res.investissement, false)}${retour !== null ? `, rentabilisé en ${O.fmtNombre(retour)} an${retour > 1 ? 's' : ''}` : ''}</p>` : ''}
          <ul class="puces">${s.actions.map((ac) => `<li>${nomAction(ac)}</li>`).join('')}</ul>
          <div class="rang-boutons"><button class="btn petit" data-action="scenario-ouvrir" data-id="${s.id}">Modifier</button></div></article>`;
      }).join('')}</div>` : `<div class="vide-etat">${S.FORME_VIDE}<div><h3>Aucun scénario</h3><p>Crée un scénario ou pars d'un scénario rapide (toutes les veilles éteintes, 10 % de durée en moins…).</p><div class="actions"><button class="btn primaire" data-action="scenario-rapide">Scénarios rapides</button></div></div></div>`}
      ${AVERTISSEMENT}`;
  }

  // ---------- Modale : appareil ----------
  function champsMode(a) {
    const n = (nom, v) => `name="${nom}" inputmode="decimal" value="${O.saisieNombre(v)}"`;
    const saison = `<label class="champ">Mois d'utilisation par an<small>12 si toute l'année ; 5 pour un chauffage d'hiver.</small><input ${n('mois', a.mois)}></label>`;
    const veille = `<fieldset class="champ cadre-champs"><legend>Veille <small>Puissance quand l'appareil est éteint mais branché (0 si débranché).</small></legend><div class="rang-champs"><label class="champ">Veille (W)<input ${n('veille', a.veille)}></label><label class="champ">Heures de veille par jour<input ${n('veilleH', a.veilleH)}></label></div></fieldset>`;
    if (a.mode === 'duree') return `<div class="rang-champs"><label class="champ">Puissance en marche (W)<small>Plaque signalétique.</small><input ${n('puissance', a.puissance)}></label><label class="champ">Heures par jour<small>0,25 = 15 min.</small><input ${n('heures', a.heures)}></label><label class="champ">Jours par semaine<input ${n('jours', a.jours)}></label></div>${saison}${veille}`;
    if (a.mode === 'cycles') return `<div class="rang-champs"><label class="champ">kWh par cycle<small>Notice ou étiquette (programme utilisé).</small><input ${n('kwhCycle', a.kwhCycle)}></label><label class="champ">Cycles par semaine<input ${n('cycles', a.cycles)}></label></div>${saison}${veille}`;
    if (a.mode === 'annuel') return '<label class="champ">Consommation annuelle (kWh/an)<small>Indiquée sur l\'étiquette énergie (veille comprise).</small><input ' + n('kwhAn', a.kwhAn) + '></label>';
    return `<div class="rang-champs"><label class="champ">Énergie relevée (kWh)<small>Affichée par le wattmètre.</small><input ${n('mesureKwh', a.mesureKwh)}></label><label class="champ">Durée de la mesure (jours)<input ${n('mesureJours', a.mesureJours)}></label><label class="champ">Date du relevé<input type="date" name="mesureLe" value="${a.mesureLe || ''}"></label></div>${saison}<p class="aide">Mesure sur une période représentative (une semaine au moins pour un appareil de froid), veille comprise.</p>`;
  }
  function lireAppareil(form, base) {
    const f = new FormData(form);
    const out = { ...base, nom: O.texte(f.get('nom'), 80), cat: f.get('cat'), mode: f.get('mode'), horaire: f.get('horaire') === 'hc' ? 'hc' : 'standard', note: O.texte(f.get('note'), 300) };
    const q = String(f.get('quantite') || '').trim();
    out.quantite = q ? Number(q.replace(',', '.')) : 1;
    let illisible = null;
    for (const k of ['puissance', 'heures', 'jours', 'mois', 'veille', 'veilleH', 'kwhCycle', 'cycles', 'kwhAn', 'mesureKwh', 'mesureJours']) {
      if (!form.querySelector(`[name=${k}]`)) continue;
      const s = String(f.get(k) || '').trim();
      const v = s ? O.lireNombre(s) : null;
      if (s && v === null) illisible = `Valeur illisible ou négative dans « ${form.querySelector(`[name=${k}]`).closest('label').firstChild.textContent.trim()} ».`;
      out[k] = v;
    }
    if (form.querySelector('[name=mesureLe]')) out.mesureLe = f.get('mesureLe') || null;
    if (out.veille === null) out.veille = 0;
    if (out.veilleH === null) out.veilleH = 0;
    return { a: out, illisible };
  }
  function modaleAppareil(id) {
    const existant = id ? appareil(id) : null;
    let a = structuredClone(existant || R.normaliserAppareil({ id: uid(), nom: '', cat: 'autre', mode: 'duree', mois: 12 }));
    const hphc = r().option === 'hphc';
    const corps = () => `
      <div class="rang-champs"><label class="champ">Nom<input name="nom" maxlength="80" value="${esc(a.nom)}" required></label><label class="champ">Quantité<input name="quantite" inputmode="numeric" value="${a.quantite}"></label></div>
      <label class="champ">Catégorie<select name="cat">${B.categories.map((c) => `<option value="${c.id}" ${c.id === a.cat ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}</select></label>
      <label class="champ">Calcul de la consommation<select name="mode" data-maj="mode">${B.modes.map((m) => `<option value="${m.id}" ${m.id === a.mode ? 'selected' : ''}>${esc(m.nom)}</option>`).join('')}</select></label>
      ${champsMode(a)}
      ${hphc ? `<label class="case"><input type="checkbox" name="horaire" value="hc" ${a.horaire === 'hc' ? 'checked' : ''}> Fonctionne en heures creuses (programmé)</label>` : ''}
      <label class="champ">Note<small>Facultative : source de la valeur, emplacement.</small><input name="note" maxlength="300" value="${esc(a.note)}"></label>
      <div class="apercu-calcul" id="apercu-appareil" aria-live="polite"></div>
      <p class="erreur" role="alert"></p>`;
    const d = S.ouvrirModale(existant ? 'Appareil' : 'Nouvel appareil', corps(), existant
      ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn" value="dupliquer">Dupliquer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>', (f, action) => {
      if (action === 'supprimer') {
        S.retenir();
        S.E.appareils = S.E.appareils.filter((x) => x.id !== existant.id);
        S.E.scenarios.forEach((s) => { s.actions = s.actions.filter((ac) => ac.appareilId !== existant.id); });
        S.sauver(); S.rendre(); S.toast(`« ${existant.nom} » supprimé.`, { libelle: 'Annuler', faire: S.annuler });
        return undefined;
      }
      const { a: x, illisible } = lireAppareil(d.querySelector('form'), a);
      if (illisible) return illisible;
      const err = R.valider(x);
      if (err) return err;
      S.retenir();
      const propre = R.normaliserAppareil({ ...x, id: action === 'dupliquer' ? uid() : x.id, nom: action === 'dupliquer' ? `${x.nom} (copie)` : x.nom });
      if (existant && action !== 'dupliquer') Object.assign(existant, propre); else S.E.appareils.push(propre);
      S.sauver(); S.rendre();
      const c = R.consommation(propre);
      const co = R.cout(c.total, R.prixKwh(propre, r()));
      S.toast(`${propre.nom} : ${kwh(c.total)} par an${co !== null ? `, ${eur(co)}` : ''}.`, { libelle: 'Annuler', faire: S.annuler });
      return undefined;
    });
    const form = d.querySelector('form');
    const apercu = () => {
      const { a: x, illisible } = lireAppareil(form, a);
      const el = d.querySelector('#apercu-appareil');
      const err = illisible || R.valider(x);
      if (err) { el.className = 'apercu-calcul en-erreur'; el.innerHTML = `<b>${esc(err)}</b>`; return; }
      const c = R.consommation(x);
      const co = R.cout(c.total, R.prixKwh(x, r()));
      el.className = 'apercu-calcul';
      el.innerHTML = `<span class="formule">${esc(c.formule)}</span><span class="chaine">${co !== null ? `<span>Par an <b>${eur(co)}</b></span><span>Par mois <b>${eur(Math.round(co / 12))}</b></span><span>Par jour <b>${eur(Math.round(co / 365))}</b></span>` : '<span>Saisis ton tarif pour voir le coût.</span>'}</span>`;
    };
    form.addEventListener('input', apercu);
    form.addEventListener('change', (e) => {
      if (e.target.dataset.maj !== 'mode') return;
      const ancien = lireAppareil(form, a).a;
      a = { ...ancien, mode: e.target.value };
      d.querySelector('.modale-corps').innerHTML = corps();
      apercu();
    });
    apercu();
  }

  function modaleCatalogue() {
    S.ouvrirModale('Ajouter depuis le catalogue', `
      <p class="aide">Valeurs indicatives (puissance, durée, veille) que tu ajusteras ensuite. Coche autant d'appareils que tu veux.</p>
      <div class="choix-types">${B.categories.map((c) => `<fieldset class="groupe-types"><legend>${esc(c.nom)}</legend>${B.appareils.filter((a) => a.cat === c.id).map((a) => `<label class="case"><input type="checkbox" name="c-${a.id}"> <span>${esc(a.nom)}${S.E.appareils.some((x) => x.catalogueId === a.id) ? ' <small class="mini">(déjà ajouté)</small>' : ''}</span></label>`).join('')}</fieldset>`).join('')}</div>
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Ajouter la sélection</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const choix = B.appareils.filter((a) => f.get(`c-${a.id}`));
      if (!choix.length) return 'Coche au moins un appareil.';
      S.retenir();
      choix.forEach((a) => S.E.appareils.push(R.depuisCatalogue(a.id, { id: uid() })));
      S.sauver(); S.changerVue('appareils');
      S.toast(`${S.pluriel(choix.length, 'appareil ajouté', 'appareils ajoutés')}.`, { libelle: 'Annuler', faire: S.annuler });
      return undefined;
    }, { large: true });
  }

  // ---------- Modale : scénario ----------
  function modaleScenario(id, modele = null) {
    const existant = id ? S.E.scenarios.find((s) => s.id === id) : null;
    let s = structuredClone(existant || modele || { id: uid(), nom: '', actions: [] });
    const opts = (choisi) => S.E.appareils.map((a) => `<option value="${a.id}" ${a.id === choisi ? 'selected' : ''}>${esc(a.nom)}</option>`).join('');
    const corps = () => `
      <label class="champ">Nom du scénario<input name="nom" maxlength="80" value="${esc(s.nom)}" placeholder="Ex. : Hiver plus sobre"></label>
      <div id="actions">${s.actions.map((ac) => `<div class="rang-action" data-ac="${ac.id}">
        <label class="champ">Appareil<select name="ap-${ac.id}">${opts(ac.appareilId)}</select></label>
        <label class="champ">Action<select name="ty-${ac.id}" data-maj="1">${B.actions.map((x) => `<option value="${x.id}" ${x.id === ac.type ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label>
        ${ac.type === 'duree' ? `<label class="champ">Réduction (%)<input name="va-${ac.id}" inputmode="decimal" value="${O.saisieNombre(ac.valeur)}"></label>` : ac.type === 'remplacer' ? `<label class="champ">Nouveau (kWh/an, à l'unité)<input name="va-${ac.id}" inputmode="decimal" value="${O.saisieNombre(ac.valeur)}"></label>` : '<span></span>'}
        <label class="champ">Achat (€)<input name="in-${ac.id}" inputmode="decimal" value="${O.saisieMontant(ac.investissement || null)}" placeholder="0"></label>
        <button class="btn-icone" type="button" data-action="action-retirer" data-id="${ac.id}" aria-label="Retirer l'action">×</button></div>`).join('')}</div>
      <button class="btn petit" type="button" data-action="action-ajouter">${S.ICONES.plus}Ajouter une action</button>
      ${r().option !== 'hphc' && s.actions.some((ac) => ac.type === 'hc') ? '<p class="aide">Les heures creuses n\'ont d\'effet qu\'avec l\'option heures pleines / heures creuses (Réglages).</p>' : ''}
      <div class="apercu-calcul" id="apercu-scenario"></div>
      <p class="erreur" role="alert"></p>`;
    const lire = (form) => {
      const f = new FormData(form);
      let err = null;
      const actions = [...form.querySelectorAll('[data-ac]')].map((el) => {
        const i = el.dataset.ac;
        const type = f.get(`ty-${i}`);
        const brut = String(f.get(`va-${i}`) || '').trim();
        const valeur = brut ? O.lireNombre(brut) : null;
        if ((type === 'duree' || type === 'remplacer') && !(valeur > 0)) err = type === 'duree' ? 'Réduction de durée : pourcentage entre 1 et 100.' : 'Remplacement : consommation du nouveau modèle en kWh/an.';
        if (type === 'duree' && valeur > 100) err = 'Réduction de durée : 100 % au maximum.';
        const inv = String(f.get(`in-${i}`) || '').trim();
        const investissement = inv ? O.lireMontant(inv) : 0;
        if (inv && investissement === null) err = 'Prix d\'achat illisible.';
        return { id: i, appareilId: f.get(`ap-${i}`), type, valeur, investissement: investissement || 0 };
      });
      return { s: { ...s, nom: O.texte(f.get('nom'), 80), actions }, err };
    };
    const d = S.ouvrirModale(existant ? 'Scénario' : 'Nouveau scénario', corps(), existant
      ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Créer</button><button class="btn" value="annuler">Annuler</button>', (f, action) => {
      if (action === 'supprimer') { S.retenir(); S.E.scenarios = S.E.scenarios.filter((x) => x.id !== existant.id); S.sauver(); S.rendre(); S.toast('Scénario supprimé.', { libelle: 'Annuler', faire: S.annuler }); return undefined; }
      const { s: x, err } = lire(d.querySelector('form'));
      if (!x.nom) return 'Donne un nom au scénario.';
      if (!x.actions.length) return 'Ajoute au moins une action.';
      if (err) return err;
      S.retenir();
      const propre = R.normaliserScenario(x, S.E.appareils.map((a) => a.id));
      if (existant) Object.assign(existant, propre); else S.E.scenarios.push(propre);
      S.sauver(); if (S.vue !== 'scenarios') S.changerVue('scenarios'); else S.rendre();
      S.toast('Scénario enregistré.', { libelle: 'Annuler', faire: S.annuler });
      return undefined;
    }, { large: true });
    const form = d.querySelector('form');
    const apercu = () => {
      const { s: x, err } = lire(form);
      const el = d.querySelector('#apercu-scenario');
      if (err) { el.className = 'apercu-calcul en-erreur'; el.innerHTML = `<b>${esc(err)}</b>`; return; }
      const res = R.resultatScenario(S.E.appareils, R.normaliserScenario(x, S.E.appareils.map((a) => a.id)), r());
      el.className = 'apercu-calcul';
      el.innerHTML = `<span class="chaine"><span>Économie <b>${res.economie !== null ? `${eur(res.economie)} par an` : kwh(res.economieKwh)}</b></span><span><b>${kwh(res.economieKwh)}</b> (−${O.fmtNombre(res.economiePct)} %)</span>${res.investissement ? `<span>Achats <b>${eur(res.investissement, false)}</b></span>` : ''}</span>`;
    };
    const redessiner = () => { s = lire(form).s; d.querySelector('.modale-corps').innerHTML = corps(); apercu(); };
    form.addEventListener('input', apercu);
    form.addEventListener('change', (e) => { if (e.target.dataset.maj) redessiner(); });
    form.addEventListener('click', (e) => {
      const b = e.target.closest('[data-action="action-ajouter"],[data-action="action-retirer"]');
      if (!b) return;
      e.stopPropagation();
      s = lire(form).s;
      if (b.dataset.action === 'action-ajouter') s.actions.push({ id: uid(), appareilId: S.E.appareils[0]?.id, type: 'veille', valeur: null, investissement: 0 });
      else s.actions = s.actions.filter((x) => x.id !== b.dataset.id);
      d.querySelector('.modale-corps').innerHTML = corps();
      apercu();
    });
    apercu();
  }

  function modaleScenariosRapides() {
    const ap = S.E.appareils.filter((a) => R.consommation(a).ok);
    const modeles = [
      ['veilles', 'Toutes les veilles éteintes', ap.filter((a) => R.consommation(a).veille > 0).map((a) => ({ id: uid(), appareilId: a.id, type: 'veille' }))],
      ['moins10', '10 % de durée d\'utilisation en moins partout', ap.map((a) => ({ id: uid(), appareilId: a.id, type: 'duree', valeur: 10 }))],
      ['hc', 'Lavage et eau chaude en heures creuses', ap.filter((a) => ['lave-linge', 'lave-vaisselle', 'seche-linge', 'chauffe-eau'].includes(a.catalogueId) && a.horaire !== 'hc').map((a) => ({ id: uid(), appareilId: a.id, type: 'hc' }))],
      ['chauffage', 'Chauffage : 10 % de durée en moins', ap.filter((a) => a.cat === 'chauffage' && a.catalogueId !== 'chauffe-eau' && a.catalogueId !== 'vmc').map((a) => ({ id: uid(), appareilId: a.id, type: 'duree', valeur: 10 }))],
    ].filter(([, , acs]) => acs.length);
    if (!modeles.length) { S.toast('Ajoute d\'abord des appareils complets.'); return; }
    S.ouvrirModale('Scénarios rapides', `<p class="aide">Point de départ modifiable : choisis-en un, ajuste-le, puis enregistre-le.</p>
      <div class="choix-statut colonne">${modeles.map(([k, nom, acs], i) => `<label><input type="radio" name="modele" value="${k}" ${i ? '' : 'checked'}><span>${esc(nom)} · ${S.pluriel(acs.length, 'action')}</span></label>`).join('')}</div>${r().option !== 'hphc' ? '<p class="mini">Le scénario « heures creuses » demande l\'option heures pleines / heures creuses.</p>' : ''}`,
    '<button class="btn primaire" value="ok">Continuer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const m = modeles.find(([k]) => k === f.get('modele'));
      S.garderModale();
      setTimeout(() => modaleScenario(null, { id: uid(), nom: m[1], actions: m[2] }), 0);
      return undefined;
    });
  }

  // ---------- Actions ----------
  const actions = {
    catalogue: () => modaleCatalogue(),
    'appareil-nouveau': () => modaleAppareil(null),
    'appareil-ouvrir': (el) => modaleAppareil(el.dataset.id),
    selection: (el) => { if (el.checked) ui.selection.add(el.dataset.id); else ui.selection.delete(el.dataset.id); S.rendre(); },
    'scenario-nouveau': () => { if (!S.E.appareils.length) return S.toast('Ajoute d\'abord des appareils.'); modaleScenario(null); },
    'scenario-ouvrir': (el) => modaleScenario(el.dataset.id),
    'scenario-rapide': () => modaleScenariosRapides(),
    'remp-scenario': () => {
      const a = appareil(ui.remp.appareilId) || S.E.appareils.find((x) => R.consommation(x).ok);
      modaleScenario(null, { id: uid(), nom: `Remplacer ${a.nom.toLowerCase()}`, actions: [{ id: uid(), appareilId: a.id, type: 'remplacer', valeur: O.lireNombre(ui.remp.kwhApres), investissement: O.lireMontant(ui.remp.prixAchat) || 0 }] });
    },
    'csv-appareils': () => S.exporterCsv(R.csvAppareils(S.E), 'wattbudget-appareils'),
    imprimer: () => S.imprimer(() => { if (S.vue === 'comparer') S.changerVue('apercu'); }),
  };

  S = window.QME_SOCLE.creer({
    produit: 'WTT', prefixe: 'wtt', nom: 'WattBudget', fichier: 'watt-budget', titreBarre: 'WattBudget<br>Coût de tes appareils',
    connexion: { titre: 'Ce que coûte chaque appareil.', texte: 'Consommation et coût de tes appareils électriques au jour, au mois et à l\'année, avec ton propre tarif. Repère les gros postes, simule un remplacement, teste des économies.', ouvrir: 'Ouvre WattBudget', bouton: 'Ouvrir WattBudget' },
    onglets: [
      { id: 'apercu', nom: 'Aperçu', icone: 'rond' },
      { id: 'appareils', nom: 'Appareils', icone: 'lignes' },
      { id: 'comparer', nom: 'Comparer', icone: 'barres' },
      { id: 'scenarios', nom: 'Scénarios', icone: 'triangle' },
    ],
    etatVide: R.etatVide, normaliser: R.normaliser, donneesDemo, accueil, apresAccueil,
    vues: { apercu: vueApercu, appareils: vueAppareils, comparer: vueComparer, scenarios: vueScenarios },
    apresRendu() {
      const f = S.$('#form-remp');
      if (!f) return;
      f.addEventListener('change', (e) => { ui.remp[e.target.name] = e.target.value; S.rendre(); });
      f.addEventListener('submit', (e) => e.preventDefault());
    },
    actions,
    reglages: {
      large: true,
      corps: () => `<div class="groupe" style="border:0;padding:0"><h3>Ton tarif</h3><p class="aide">Prix TTC de ton contrat (facture ou espace client). Aucun tarif n'est fourni d'office.</p>${champsTarif(r())}</div>`,
      valider: (f) => { const t = lireTarif(f); if (typeof t === 'string') return t; S.E.reglages = t; return undefined; },
      exports: [['csv-appareils', 'Appareils et coûts (CSV)'], ['imprimer', 'Imprimer l\'aperçu']],
      aPropos: () => `<p class="mention">Catalogue : ${B.appareils.length} appareils en ${B.categories.length} catégories (version ${B.version}). ${esc(B.sourceValeurs)} Aucune connexion à un fournisseur ni à un compteur.</p>`,
    },
    importValide: (d) => d && typeof d === 'object' && Array.isArray(d.appareils),
    resumeImport: (d) => S.pluriel(d.appareils.length, 'appareil'),
  });
  // Les champs du tarif dans les réglages : afficher le bon bloc selon l'option.
  document.addEventListener('click', (e) => { if (e.target.closest('[data-action="reglages"]')) setTimeout(() => brancherTarif(S.modale()), 0); });
  S.lancer();
})();
