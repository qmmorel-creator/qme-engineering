// FêteBudget · interface. Socle commun : templates/commun/socle.js. Règles : regles.js (window.FTB).
// Quantités indicatives et ajustables ; aucun prix fourni ; aucun envoi d'invitation.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.FTB;
  const O = window.QME_OUTILS;
  const { esc } = window.QME_SOCLE;
  let S = null;
  const uid = () => O.nouvelId();
  const eur = (c, centimes = true) => (c === null || c === undefined ? '–' : O.euros(c, { centimes }));
  const dateFr = (s, long = true) => (s ? O.versDate(s).toLocaleDateString('fr-FR', long ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' } : { day: 'numeric', month: 'short' }) : '');
  const nomCat = (id) => B.categories.find((c) => c.id === id)?.nom || '';
  const ev = () => S.E.evenement;
  const LIB_STATUT = { attente: 'En attente', confirme: 'Confirmé', decline: 'Décliné' };
  const fmtQ = (n, u) => (u === 'g' && n >= 1000 ? `${O.fmtNombre(n / 1000, { dec: 2 })} kg` : `${O.fmtNombre(n, { dec: 2 })} ${u}${n > 1 && /^[a-zè]{3,}$/.test(u) ? 's' : ''}`);
  const ui = { filtreInv: 'tous' };
  // « 5 kg » pour une unité simple, « 13 × bouteille de 1,5 L » pour un conditionnement.
  const achat = (x) => (x.nbCond ? (/\s/.test(x.besoin.uc) ? `${x.nbCond} × ${esc(x.besoin.uc)}` : `${x.nbCond} ${esc(x.besoin.uc)}`) : fmtQ(x.quantite, x.besoin.unite));

  // Lecture d'un montant saisi (vide = null) ; renvoie NaN si illisible.
  const lireMontant = (v) => { const s = String(v ?? '').trim(); if (!s) return null; const m = O.lireMontant(s); return m === null ? NaN : m; };

  // ---------- Données de démonstration (fête fictive) ----------
  function donneesDemo() {
    const t = O.iso(new Date());
    const p = (nom, parts = 1) => ({ id: uid(), nom, parts });
    const parts = [p('Alex'), p('Bao'), p('Cyd et Dom', 2)];
    const noms = ['Alex', 'Bao', 'Cyd', 'Dom', 'Élie', 'Fanny', 'Gaël', 'Hana', 'Inès', 'Jules', 'Kim', 'Léo', 'Maé', 'Nils', 'Olga', 'Paul', 'Rose', 'Sam'];
    const invites = noms.map((nom, i) => ({ id: uid(), nom, type: 'adulte', statut: i < 13 ? 'confirme' : i < 16 ? 'attente' : 'decline' }));
    invites.push(...['Lina', 'Malo', 'Nour', 'Oscar'].map((nom, i) => ({ id: uid(), nom: `${nom} (enfant)`, type: 'enfant', statut: i < 3 ? 'confirme' : 'attente' })));
    const sc = [{ id: 'jardin', nom: 'A · Jardin et barbecue maison' }, { id: 'salle', nom: 'B · Salle louée et traiteur' }];
    const d = (categorie, libelle, prevu, reel = null, payePar = null, scenarios = [], note = '') => ({ id: uid(), categorie, libelle, prevu, reel, payePar, scenarios, note });
    return R.normaliser({
      evenement: { nom: 'Les 40 ans d\'Alex', type: 'anniv-adulte', formule: 'barbecue', date: O.ajout(t, 18), heure: '19:00', duree: 5, lieu: 'Jardin ou salle des fêtes (à décider)', budgetMode: 'global', budgetGlobal: 90000, base: 'attendus' },
      invites, participants: parts, scenarios: sc, scenarioActif: 'jardin',
      depenses: [
        d('lieu', 'Location de la salle des fêtes', 35000, null, null, ['salle']),
        d('lieu', 'Location de tables et bancs', 6000, 5800, parts[1].id, ['jardin'], 'Acompte versé.'),
        d('repas', 'Viandes et grillades', 9000, null, null, ['jardin']),
        d('repas', 'Salades, pain, fromage', 7500, null, null, ['jardin']),
        d('repas', 'Traiteur (buffet complet)', 52000, null, null, ['salle']),
        d('repas', 'Gâteau d\'anniversaire', 6500, 6800, parts[0].id),
        d('boissons', 'Boissons', 12000, null, null),
        d('decoration', 'Guirlandes et ballons', 4000, 3650, parts[2].id),
        d('materiel', 'Vaisselle jetable compostable', 3500, 3200, parts[0].id),
        d('animations', 'Playlist et enceinte prêtée', 0, 0, null),
        d('animations', 'Photobooth (location)', 9000, null, null, ['salle']),
        d('transport', 'Navette retour (participation)', 5000, null, null, ['salle']),
      ],
      ajustements: { vin: { quantite: 4, prix: 750 }, eau: { prix: 50 }, soft: { prix: 180 }, grillades: { prix: 1600 } },
      faites: { p0: true, p1: true, p2: true },
      tachesPerso: [{ id: uid(), j: -10, texte: 'Préparer la playlist' }],
    });
  }

  // ---------- Premier lancement ----------
  function accueil() {
    return `
      <p class="surtitre">Bienvenue</p>
      <h1>Une fête complète, un budget maîtrisé.</h1>
      <p class="intro">Décris ton événement : les quantités de repas et de boissons, la liste de préparation et le suivi du budget se calculent à partir de lui.</p>
      <form id="form-accueil" class="formulaire-accueil" novalidate>
        <label class="champ">Nom de l'événement<input name="nom" maxlength="80" placeholder="Ex. : Les 30 ans de Sam"></label>
        <div class="rang-champs"><label class="champ">Type<select name="type">${B.types.map((t) => `<option value="${t.id}">${esc(t.nom)}</option>`).join('')}</select></label><label class="champ">Date<input type="date" name="date"></label></div>
        <div class="rang-champs"><label class="champ">Budget global (€) <small>Facultatif.</small><input name="budget" inputmode="decimal"></label></div>
        <label class="champ">Invités <small>Un par ligne ; ajoute « (enfant) » pour un enfant. Tu pourras compléter ensuite.</small><textarea name="invites" rows="5" placeholder="Camille\nSacha\nLou (enfant)"></textarea></label>
        <p class="erreur" role="alert"></p>
        <div class="accueil-pied"><span></span><button class="btn primaire" type="submit">Préparer la fête</button></div>
      </form>
      <ol class="conseils" style="margin-top:32px">${B.conseils.map(([a, b]) => `<li><b>${esc(a)}</b><span>${esc(b)}</span></li>`).join('')}</ol>`;
  }
  function apresAccueil() {
    S.$('#form-accueil').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const err = (m) => { e.target.querySelector('.erreur').textContent = m; };
      const nom = O.texte(f.get('nom'), 80);
      if (!nom) return err('Donne un nom à l\'événement.');
      const budget = lireMontant(f.get('budget'));
      if (Number.isNaN(budget)) return err('Budget illisible : écris un montant en euros, par exemple 600.');
      const type = B.types.find((t) => t.id === f.get('type'));
      const etat = R.normaliser({
        evenement: { nom, type: type.id, formule: type.formule, duree: type.duree, date: f.get('date') || null, budgetGlobal: budget },
        invites: lignesInvites(f.get('invites')),
      });
      S.terminerAccueil(etat, { vue: 'apercu', message: 'Événement créé. Ajoute tes dépenses prévues ou consulte les quantités.' });
    });
  }
  const lignesInvites = (texte) => String(texte || '').split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 300).map((x) => {
    const enfant = /\(enfant\)\s*$/i.test(x);
    return { id: uid(), nom: O.texte(x.replace(/\(enfant\)\s*$/i, '').trim(), 60) + (enfant ? ' (enfant)' : ''), type: enfant ? 'enfant' : 'adulte', statut: 'attente' };
  });

  // ---------- Vues ----------
  const AVERTISSEMENT = `<p class="mention avertissement">Aide à l'organisation : les quantités sont des estimations ajustables, les montants viennent de ta saisie. ${esc(B.sourceQuantites)}</p>`;
  function selecteurScenario() {
    if (S.E.scenarios.length < 2) return '';
    return `<div class="onglets-internes" role="group" aria-label="Scénario">${S.E.scenarios.map((s) => `<button data-action="scenario" data-id="${s.id}" aria-pressed="${s.id === S.E.scenarioActif}">${esc(s.nom)}</button>`).join('')}</div>`;
  }
  function enTete() {
    const e = ev();
    const j = e.date ? O.ecart(S.auj(), e.date) : null;
    return `<div class="vue-tete"><div><h1>${esc(e.nom)}</h1><p>${esc(B.types.find((t) => t.id === e.type).nom)} · ${esc(B.formules.find((f) => f.id === e.formule).nom.toLowerCase())}${e.date ? ` · ${dateFr(e.date)}${e.heure ? ` à ${e.heure}` : ''}` : ' · date à fixer'}${j !== null ? (j > 0 ? ` · dans ${S.pluriel(j, 'jour')}` : j === 0 ? ' · aujourd\'hui' : ` · il y a ${S.pluriel(-j, 'jour')}`) : ''}${e.lieu ? ` · ${esc(e.lieu)}` : ''}</p></div>
      <div class="actions"><button class="btn" data-action="evenement">Événement</button><button class="btn" data-action="scenarios">Scénarios</button></div></div>`;
  }

  function vueApercu() {
    const t = R.totaux(S.E);
    const c = R.compte(S.E.invites, ev().base);
    const comp = S.E.scenarios.length > 1 ? R.comparaison(S.E) : null;
    const pct = t.budget ? Math.min(100, Math.round((t.retenu / t.budget) * 100)) : null;
    const max = Math.max(1, ...t.parCat.map((x) => x.retenu));
    return `
      ${enTete()}
      ${selecteurScenario()}
      <div class="tuiles">
        <div class="tuile" style="--c:var(--bleu)"><p class="surtitre">Budget</p><b>${t.budget === null ? '–' : eur(t.budget, false)}</b><span>${t.budget === null ? 'à fixer (bouton « Événement »)' : ev().budgetMode === 'parPersonne' ? `${eur(ev().budgetParPersonne)} × ${S.pluriel(c.total, 'personne')}` : 'budget global'}</span></div>
        <div class="tuile rond" style="--c:var(--jaune)"><p class="surtitre">Dépensé ou prévu</p><b>${eur(t.retenu, false)}</b><span>${eur(t.reel, false)} payés, ${eur(t.retenu - t.reel, false)} encore prévus</span></div>
        <div class="tuile" style="--c:${t.depasse ? 'var(--rouge)' : 'var(--vert)'}"><p class="surtitre">${t.depasse ? 'Dépassement' : 'Reste'}</p><b>${t.restant === null ? '–' : eur(Math.abs(t.restant), false)}</b><span>${t.restant === null ? 'sans budget fixé' : t.depasse ? 'au-dessus du budget' : 'disponible'}</span></div>
        <div class="tuile rond" style="--c:var(--encre)"><p class="surtitre">Par personne</p><b>${t.parPersonne === null ? '–' : eur(t.parPersonne)}</b><span>${S.pluriel(c.total, 'personne attendue', 'personnes attendues')} (${S.pluriel(c.adultes, 'adulte')}, ${S.pluriel(c.enfants, 'enfant')})</span></div>
      </div>
      ${pct !== null ? `<div class="barre-budget ${t.depasse ? 'depasse' : ''}" role="img" aria-label="Budget consommé à ${pct} %"><span style="width:${pct}%"></span></div>` : ''}
      <h2 class="titre-section">Par catégorie <span>Montant retenu : réel s'il est saisi, sinon prévu</span></h2>
      ${t.parCat.length ? `<figure class="graphique"><div class="barres-cats">${t.parCat.map((x) => `<div class="barre-cat" tabindex="0" data-info="${esc(`<b>${esc(nomCat(x.categorie))}</b>Prévu ${eur(x.prevu)}<br>Payé ${eur(x.reel)}<br>${S.pluriel(x.nb, 'dépense')}${x.aPayer ? `, ${x.aPayer} à payer` : ''}`)}"><span class="bc-nom">${esc(nomCat(x.categorie))}</span><span class="bc-piste"><span class="bc-barre" style="width:${Math.max(0.5, (x.retenu / max) * 100)}%"></span></span><span class="bc-val"><b>${eur(x.retenu, false)}</b></span></div>`).join('')}</div><div class="infobulle" hidden></div></figure>`
        : `<div class="vide-etat petit"><div><h3>Aucune dépense</h3><p>Ajoute tes dépenses prévues (lieu, repas, boissons…) ou transforme les quantités estimées en dépenses.</p><div class="actions"><button class="btn petit primaire" data-action="depense-nouvelle">${S.ICONES.plus}Dépense</button><button class="btn petit" data-action="vue" data-vue="besoins">Quantités</button></div></div></div>`}
      ${comp ? `<h2 class="titre-section">Comparaison des scénarios</h2><div class="defile"><table class="tableau compact"><thead><tr><th>Catégorie</th>${comp.map((x) => `<th class="nb">${esc(x.scenario.nom)}</th>`).join('')}</tr></thead><tbody>${B.categories.filter((cat) => comp.some((x) => x.parCat[cat.id])).map((cat) => `<tr><td>${esc(cat.nom)}</td>${comp.map((x) => `<td class="nb">${eur(x.parCat[cat.id] ?? 0, false)}</td>`).join('')}</tr>`).join('')}</tbody>
        <tfoot><tr><td>Total</td>${comp.map((x) => `<td class="nb">${eur(x.retenu, false)}</td>`).join('')}</tr><tr><td>Par personne</td>${comp.map((x) => `<td class="nb">${x.parPersonne === null ? '–' : eur(x.parPersonne)}</td>`).join('')}</tr><tr><td>Reste sur le budget</td>${comp.map((x) => `<td class="nb ${x.restant < 0 ? 'ecart-plus' : ''}">${x.restant === null ? '–' : eur(x.restant, false)}</td>`).join('')}</tr></tfoot></table></div>` : ''}
      ${AVERTISSEMENT}`;
  }

  function vueInvites() {
    const c = R.compte(S.E.invites, ev().base);
    const liste = S.E.invites.filter((i) => ui.filtreInv === 'tous' || i.statut === ui.filtreInv || i.type === ui.filtreInv);
    const filtres = [['tous', 'Tous', S.E.invites.length], ['confirme', 'Confirmés', c.confirmes], ['attente', 'En attente', c.attente], ['decline', 'Déclinés', c.declines], ['enfant', 'Enfants', S.E.invites.filter((i) => i.type === 'enfant').length]];
    return `
      <div class="vue-tete"><div><h1>Invités</h1><p>${S.pluriel(c.total, 'personne comptée', 'personnes comptées')} pour les quantités et le budget par personne : ${ev().base === 'confirmes' ? 'confirmés seulement' : 'confirmés et en attente (sans les déclinés)'}. Touche la réponse pour la changer.</p></div>
        <div class="actions"><button class="btn" data-action="invites-coller">Ajouter une liste</button><button class="btn primaire" data-action="invite-nouveau">${S.ICONES.plus}Invité</button></div></div>
      <div class="outils-liste"><div class="filtres" role="group" aria-label="Filtrer">${filtres.map(([id, l, n]) => `<button class="filtre" data-action="filtre-inv" data-id="${id}" aria-pressed="${ui.filtreInv === id}">${l} <small>${n}</small></button>`).join('')}</div></div>
      ${liste.length ? `<ul class="liste-invites">${liste.map((i) => `<li class="st-${i.statut}"><button class="lien-ligne" data-action="invite-ouvrir" data-id="${i.id}"><b>${esc(i.nom)}</b><span>${i.type === 'enfant' ? 'Enfant' : 'Adulte'}${i.note ? ` · ${esc(i.note)}` : ''}</span></button><button class="statut-invite" data-action="invite-statut" data-id="${i.id}" title="Changer la réponse">${LIB_STATUT[i.statut]}</button></li>`).join('')}</ul>`
        : `<div class="vide-etat">${S.FORME_VIDE}<div><h3>${S.E.invites.length ? 'Aucun invité dans ce filtre' : 'Aucun invité'}</h3><p>Colle ta liste d'invités, un par ligne : les quantités se calculeront d'elles-mêmes.</p><div class="actions"><button class="btn primaire" data-action="invites-coller">Ajouter une liste</button></div></div></div>`}
      <p class="mention" style="margin-top:16px">Aucune invitation n'est envoyée : FêteBudget sert à compter et à prévoir. Exporte la liste (réglages) si besoin.</p>`;
  }

  function vueDepenses() {
    const t = R.totaux(S.E);
    const nomP = (id) => S.E.participants.find((p) => p.id === id)?.nom;
    const rep = R.repartition(S.E);
    const groupes = B.categories.map((cat) => ({ cat, ds: t.depenses.filter((d) => d.categorie === cat.id) })).filter((g) => g.ds.length);
    return `
      <div class="vue-tete"><div><h1>Dépenses</h1><p>Prévu puis réel. Une dépense sans réel compte pour son montant prévu. ${S.E.scenarios.length > 1 ? 'Les dépenses propres à un scénario sont marquées.' : ''}</p></div>
        <div class="actions"><button class="btn primaire" data-action="depense-nouvelle">${S.ICONES.plus}Dépense</button></div></div>
      ${selecteurScenario()}
      ${groupes.length ? groupes.map(({ cat, ds }) => `<section class="groupe-cat"><h2 class="titre-cat">${esc(cat.nom)}<span>${eur(ds.reduce((s, d) => s + R.retenu(d), 0), false)}</span></h2><ul class="lignes-abos">${ds.map((d) => `<li class="ligne ${d.reel === null ? '' : 'payee'}"><button class="ligne-info" data-action="depense-ouvrir" data-id="${d.id}"><b>${esc(d.libelle)}</b><span class="ligne-detail">Prévu ${eur(d.prevu)}${d.reel !== null ? ` · réel ${eur(d.reel)}${d.prevu !== null && d.reel !== d.prevu ? ` (${d.reel > d.prevu ? '+' : ''}${eur(d.reel - d.prevu)})` : ''}` : ''}${d.payePar ? ` · payé par ${esc(nomP(d.payePar))}` : ''}</span><span class="ligne-etiquettes">${d.reel === null ? '<span class="etiquette jaune">À payer</span>' : '<span class="etiquette vert">Payé</span>'}${d.scenarios.map((s) => `<span class="etiquette ciel">${esc(S.E.scenarios.find((x) => x.id === s)?.nom || '')}</span>`).join('')}</span></button><div class="ligne-droite"><span class="ligne-cout"><b>${eur(R.retenu(d))}</b></span></div></li>`).join('')}</ul></section>`).join('')
        : `<div class="vide-etat">${S.FORME_VIDE}<div><h3>Aucune dépense${S.E.scenarios.length > 1 ? ' dans ce scénario' : ''}</h3><p>Lieu, décoration, repas, boissons, matériel, animations, transport.</p><div class="actions"><button class="btn primaire" data-action="depense-nouvelle">${S.ICONES.plus}Dépense</button></div></div></div>`}
      <h2 class="titre-section">Partage des frais <span>Dépenses réelles payées par les participants</span></h2>
      ${S.E.participants.length ? `<div class="colonnes-2">
        <section><ul class="lignes-abos">${rep.soldes.map((s) => `<li class="ligne"><button class="ligne-info" data-action="participant-ouvrir" data-id="${s.id}"><b>${esc(s.nom)}</b><span class="ligne-detail">${S.pluriel(s.parts, 'part')} · a payé ${eur(s.paye)} · doit ${eur(s.doit)}</span></button><div class="ligne-droite"><span class="ligne-cout"><b class="${s.solde < 0 ? 'texte-rouge' : ''}">${s.solde > 0 ? '+' : ''}${eur(s.solde)}</b><small>${s.solde > 0 ? 'à recevoir' : s.solde < 0 ? 'à rembourser' : 'équilibré'}</small></span></div></li>`).join('')}</ul>
          <div class="rang-boutons" style="margin-top:10px"><button class="btn petit" data-action="participant-nouveau">${S.ICONES.plus}Participant</button></div></section>
        <section>${rep.virements.length ? `<p class="surtitre">${S.pluriel(rep.virements.length, 'virement')} pour équilibrer ${eur(rep.total)}</p><ul class="virements">${rep.virements.map((v) => `<li><b>${esc(v.deNom)}</b><span>verse ${eur(v.montant)} à</span><b>${esc(v.aNom)}</b></li>`).join('')}</ul>` : `<p class="aide">${rep.total ? 'Les comptes sont équilibrés.' : 'Saisis le montant réel et le payeur des dépenses pour calculer qui rembourse qui.'}</p>`}</section>
      </div>` : `<div class="vide-etat petit"><div><h3>Plusieurs personnes paient ?</h3><p>Ajoute les participants (avec leurs parts, 2 pour un couple) : FêteBudget calcule qui rembourse qui, en un minimum de virements.</p><div class="actions"><button class="btn petit" data-action="participant-nouveau">${S.ICONES.plus}Participant</button></div></div></div>`}
      ${AVERTISSEMENT}`;
  }

  function vueBesoins() {
    const bs = R.besoins(S.E);
    const c = R.compte(S.E.invites, ev().base);
    const total = bs.reduce((s, x) => s + (x.cout || 0), 0);
    const groupes = ['repas', 'boissons', 'materiel'].map((cat) => ({ cat, ls: bs.filter((x) => x.besoin.categorie === cat) })).filter((g) => g.ls.length);
    return `
      <div class="vue-tete"><div><h1>Quantités</h1><p>Estimation pour ${S.pluriel(c.adultes, 'adulte')} et ${S.pluriel(c.enfants, 'enfant')}, formule « ${esc(B.formules.find((f) => f.id === ev().formule).nom.toLowerCase())} », ${O.fmtNombre(ev().duree)} h. Modifie une quantité ou ajoute ton prix : le coût se calcule.</p></div>
        <div class="actions"><button class="btn" data-action="csv-courses">Liste de courses (CSV)</button>${total ? '<button class="btn primaire" data-action="besoins-depenses">Ajouter aux dépenses prévues</button>' : ''}</div></div>
      ${!c.total ? `<div class="vide-etat petit"><div><h3>Aucun invité compté</h3><p>Ajoute des invités pour estimer les quantités.</p><div class="actions"><button class="btn petit" data-action="vue" data-vue="invites">Invités</button></div></div></div>` : groupes.map(({ cat, ls }) => `<h2 class="titre-section">${esc(nomCat(cat))}</h2>
        <div class="defile"><table class="tableau compact table-besoins"><thead><tr><th>Article</th><th class="nb">Estimation</th><th>Quantité retenue</th><th>À acheter</th><th>Prix ${cat === 'materiel' ? 'du paquet' : 'unitaire'} (€)</th><th class="nb">Coût</th></tr></thead><tbody>${ls.map((x) => `<tr class="${x.ajuste ? 'ajuste' : ''}"><td data-libelle="">${esc(x.besoin.nom)}</td><td class="nb" data-libelle="Estimation">${fmtQ(x.calcule, x.besoin.unite)}</td>
          <td data-libelle="Retenu (${esc(x.besoin.unite)})"><input class="saisie-besoin" data-id="${x.besoin.id}" data-champ="quantite" inputmode="decimal" value="${x.ajuste ? O.saisieNombre(x.quantite) : ''}" placeholder="${O.saisieNombre(x.quantite)}" aria-label="Quantité de ${esc(x.besoin.nom)} en ${esc(x.besoin.unite)}"></td>
          <td data-libelle="À acheter">${achat(x)}</td>
          <td data-libelle="Prix (€)"><input class="saisie-besoin" data-id="${x.besoin.id}" data-champ="prix" inputmode="decimal" value="${O.saisieMontant(x.prix)}" placeholder="—" aria-label="Prix de ${esc(x.besoin.nom)}"></td>
          <td class="nb" data-libelle="Coût">${eur(x.cout)}</td></tr>`).join('')}</tbody></table></div>`).join('')}
      ${total ? `<p class="total-besoins">Coût estimé des quantités chiffrées : <b>${eur(total)}</b></p>` : ''}
      <p class="mention" style="margin-top:12px">Le prix s'entend par conditionnement (bouteille, sac, paquet) ou par unité sans conditionnement. ${esc(B.sourceQuantites)}</p>`;
  }

  function vuePreparation() {
    const ts = R.taches(S.E);
    const t = S.auj();
    const faites = ts.filter((x) => x.faite).length;
    return `
      <div class="vue-tete"><div><h1>Préparation</h1><p>${faites}/${ts.length} tâches faites. ${ev().date ? 'Échéances calculées depuis le jour J.' : 'Fixe la date de l\'événement pour dater les tâches.'}</p></div>
        <div class="actions"><button class="btn" data-action="imprimer">Imprimer la synthèse</button></div></div>
      <ul class="liste-cases">${ts.map((x) => { const retard = x.date && !x.faite && x.date < t; return `<li class="${x.faite ? 'fait' : ''} ${retard ? 'retard' : ''}"><input type="checkbox" id="t-${x.id}" data-action="tache" data-id="${x.id}" ${x.faite ? 'checked' : ''}><label class="libelle" for="t-${x.id}"><span>${esc(x.texte)}</span><small>${x.j === 0 ? 'Jour J' : x.j < 0 ? `J−${-x.j}` : `J+${x.j}`}${x.date ? ` · ${dateFr(x.date, false)}` : ''}${retard ? ' · en retard' : ''}</small></label>${x.perso ? `<button class="btn petit" data-action="tache-retirer" data-id="${x.id}">Retirer</button>` : '<span></span>'}</li>`; }).join('')}</ul>
      <form class="ajout-tache"><label class="champ">Nouvelle tâche<input name="texte" maxlength="120"></label><label class="champ">Jours avant (−) ou après (+) le jour J<input name="j" type="number" min="-365" max="60" value="-7"></label><button class="btn" type="submit">${S.ICONES.plus}Ajouter</button></form>
      <article class="seulement-imprime document">${synthese()}</article>`;
  }
  function synthese() {
    const t = R.totaux(S.E);
    const c = R.compte(S.E.invites, ev().base);
    const rep = R.repartition(S.E);
    return `<h2>${esc(ev().nom)}</h2><p>${ev().date ? dateFr(ev().date) : ''}${ev().lieu ? ` · ${esc(ev().lieu)}` : ''} · ${S.pluriel(c.total, 'personne')}</p>
      <h3>Budget</h3><p>Budget ${eur(t.budget, false)} · retenu ${eur(t.retenu)} · ${t.restant === null ? '' : t.depasse ? `dépassement ${eur(-t.restant)}` : `reste ${eur(t.restant)}`}</p>
      <table class="tableau compact"><tbody>${t.depenses.map((d) => `<tr><td>${esc(nomCat(d.categorie))}</td><td>${esc(d.libelle)}</td><td class="nb">${eur(R.retenu(d))}</td><td>${d.reel === null ? 'à payer' : 'payé'}</td></tr>`).join('')}</tbody></table>
      ${rep.virements.length ? `<h3>Remboursements</h3><ul class="puces">${rep.virements.map((v) => `<li>${esc(v.deNom)} verse ${eur(v.montant)} à ${esc(v.aNom)}</li>`).join('')}</ul>` : ''}
      <h3>Courses</h3><ul class="puces">${R.besoins(S.E).map((x) => `<li>${esc(x.besoin.nom)} : ${achat(x)}</li>`).join('')}</ul>
      <h3>Préparation</h3><ul class="puces">${R.taches(S.E).filter((x) => !x.faite).map((x) => `<li>${x.date ? dateFr(x.date, false) : (x.j < 0 ? `J−${-x.j}` : `J+${x.j}`)} : ${esc(x.texte)}</li>`).join('')}</ul>`;
  }

  // ---------- Modales ----------
  function modaleEvenement() {
    const e = ev();
    S.ouvrirModale('Événement', `
      <label class="champ">Nom<input name="nom" maxlength="80" value="${esc(e.nom)}"></label>
      <div class="rang-champs"><label class="champ">Type<select name="type">${B.types.map((t) => `<option value="${t.id}" ${t.id === e.type ? 'selected' : ''}>${esc(t.nom)}</option>`).join('')}</select></label><label class="champ">Formule de repas<select name="formule">${B.formules.map((f) => `<option value="${f.id}" ${f.id === e.formule ? 'selected' : ''}>${esc(f.nom)}</option>`).join('')}</select></label></div>
      <div class="rang-champs"><label class="champ">Date<input type="date" name="date" value="${e.date || ''}"></label><label class="champ">Heure<input type="time" name="heure" value="${e.heure}"></label><label class="champ">Durée (h)<input name="duree" inputmode="decimal" value="${O.saisieNombre(e.duree)}"></label></div>
      <label class="champ">Lieu<input name="lieu" maxlength="120" value="${esc(e.lieu)}"></label>
      <fieldset class="champ cadre-champs"><legend>Budget</legend>
        <div class="choix-statut deux"><label><input type="radio" name="budgetMode" value="global" ${e.budgetMode === 'global' ? 'checked' : ''}><span>Budget global</span></label><label><input type="radio" name="budgetMode" value="parPersonne" ${e.budgetMode === 'parPersonne' ? 'checked' : ''}><span>Par personne</span></label></div>
        <div class="rang-champs" style="margin-top:10px"><label class="champ">Budget global (€)<input name="budgetGlobal" inputmode="decimal" value="${O.saisieMontant(e.budgetGlobal)}"></label><label class="champ">Budget par personne (€)<input name="budgetParPersonne" inputmode="decimal" value="${O.saisieMontant(e.budgetParPersonne)}"></label></div></fieldset>
      <label class="champ">Invités comptés<select name="base"><option value="attendus" ${e.base === 'attendus' ? 'selected' : ''}>Confirmés et en attente</option><option value="confirmes" ${e.base === 'confirmes' ? 'selected' : ''}>Confirmés seulement</option></select></label>
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const nom = O.texte(f.get('nom'), 80);
      if (!nom) return 'Donne un nom à l\'événement.';
      const duree = O.lireNombre(f.get('duree'));
      if (!(duree >= 0.5 && duree <= 48)) return 'Durée : entre 0,5 et 48 heures.';
      const bg = lireMontant(f.get('budgetGlobal')), bp = lireMontant(f.get('budgetParPersonne'));
      if (Number.isNaN(bg) || Number.isNaN(bp)) return 'Budget illisible : écris un montant en euros, par exemple 600 ou 25,50.';
      S.retenir();
      Object.assign(e, { nom, type: f.get('type'), formule: f.get('formule'), date: f.get('date') || null, heure: f.get('heure') || '', duree, lieu: O.texte(f.get('lieu'), 120), budgetMode: f.get('budgetMode'), budgetGlobal: bg, budgetParPersonne: bp, base: f.get('base') });
      S.sauver(); S.rendre(); S.toast('Événement enregistré.', { libelle: 'Annuler', faire: S.annuler });
      return undefined;
    }, { large: true });
  }

  function modaleScenarios() {
    const sc = S.E.scenarios;
    S.ouvrirModale('Scénarios', `
      <p class="aide">Compare deux organisations (jardin ou salle, traiteur ou fait maison). Une dépense sans scénario compte dans tous ; une dépense peut être réservée à un scénario depuis sa fiche.</p>
      ${sc.map((s, i) => `<div class="rang-champs"><label class="champ">Scénario ${i + 1}<input name="s-${s.id}" maxlength="60" value="${esc(s.nom)}"></label>${sc.length > 1 ? `<label class="case"><input type="checkbox" name="x-${s.id}"> Supprimer</label>` : ''}</div>`).join('')}
      ${sc.length < 6 ? '<label class="champ">Nouveau scénario <small>Facultatif.</small><input name="nouveau" maxlength="60"></label>' : ''}
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const garder = sc.filter((s) => !f.get(`x-${s.id}`));
      const nouveau = O.texte(f.get('nouveau'), 60);
      if (!garder.length && !nouveau) return 'Garde au moins un scénario.';
      for (const s of garder) if (!O.texte(f.get(`s-${s.id}`), 60)) return 'Chaque scénario doit avoir un nom.';
      const suppr = sc.filter((s) => f.get(`x-${s.id}`)).map((s) => s.id);
      const perdues = S.E.depenses.filter((d) => d.scenarios.length && d.scenarios.every((x) => suppr.includes(x)));
      if (suppr.length && !S.confirmer(`Supprimer ${S.pluriel(suppr.length, 'scénario')}${perdues.length ? ` et ${S.pluriel(perdues.length, 'dépense propre', 'dépenses propres')}` : ''} ?`)) return 'Suppression annulée.';
      S.retenir();
      S.E.depenses = S.E.depenses.filter((d) => !perdues.includes(d)).map((d) => ({ ...d, scenarios: d.scenarios.filter((x) => !suppr.includes(x)) }));
      S.E.scenarios = garder.map((s) => ({ ...s, nom: O.texte(f.get(`s-${s.id}`), 60) }));
      if (nouveau) S.E.scenarios.push({ id: uid(), nom: nouveau });
      if (!S.E.scenarios.some((s) => s.id === S.E.scenarioActif)) S.E.scenarioActif = S.E.scenarios[0].id;
      S.sauver(); S.rendre(); S.toast('Scénarios enregistrés.', { libelle: 'Annuler', faire: S.annuler });
      return undefined;
    });
  }

  function modaleDepense(id) {
    const d = id ? S.E.depenses.find((x) => x.id === id) : null;
    const v = d || { categorie: 'repas', libelle: '', prevu: null, reel: null, payePar: null, scenarios: S.E.scenarios.length > 1 ? [S.E.scenarioActif] : [], note: '' };
    S.ouvrirModale(d ? 'Dépense' : 'Nouvelle dépense', `
      <div class="rang-champs"><label class="champ">Catégorie<select name="categorie">${B.categories.map((c) => `<option value="${c.id}" ${c.id === v.categorie ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}</select></label><label class="champ">Libellé<input name="libelle" maxlength="100" value="${esc(v.libelle)}"></label></div>
      <div class="rang-champs"><label class="champ">Prévu (€)<input name="prevu" inputmode="decimal" value="${O.saisieMontant(v.prevu)}"></label><label class="champ">Réel (€) <small>Vide tant que ce n'est pas payé.</small><input name="reel" inputmode="decimal" value="${O.saisieMontant(v.reel)}"></label></div>
      ${S.E.participants.length ? `<label class="champ">Payé par<select name="payePar"><option value="">—</option>${S.E.participants.map((p) => `<option value="${p.id}" ${p.id === v.payePar ? 'selected' : ''}>${esc(p.nom)}</option>`).join('')}</select></label>` : ''}
      ${S.E.scenarios.length > 1 ? `<fieldset class="champ cadre-champs"><legend>Scénarios <small>Tout coché = dépense commune.</small></legend><div class="rang-boutons">${S.E.scenarios.map((s) => `<label class="case"><input type="checkbox" name="sc-${s.id}" ${!v.scenarios.length || v.scenarios.includes(s.id) ? 'checked' : ''}> ${esc(s.nom)}</label>`).join('')}</div></fieldset>` : ''}
      <label class="champ">Note<input name="note" maxlength="200" value="${esc(v.note)}"></label>
      <p class="erreur" role="alert"></p>`,
    d ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>' : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="ok-suivant">Ajouter et nouvelle</button><button class="btn" value="annuler">Annuler</button>', (f, action) => {
      if (action === 'supprimer') { S.retenir(); S.E.depenses = S.E.depenses.filter((x) => x.id !== d.id); S.sauver(); S.rendre(); S.toast('Dépense supprimée.', { libelle: 'Annuler', faire: S.annuler }); return undefined; }
      const libelle = O.texte(f.get('libelle'), 100);
      if (!libelle) return 'Indique un libellé.';
      const prevu = lireMontant(f.get('prevu')), reel = lireMontant(f.get('reel'));
      if (Number.isNaN(prevu) || Number.isNaN(reel)) return 'Montant illisible : nombre positif en euros, par exemple 45,90.';
      if (prevu === null && reel === null) return 'Saisis au moins un montant prévu ou réel.';
      const scs = S.E.scenarios.filter((s) => f.get(`sc-${s.id}`)).map((s) => s.id);
      if (S.E.scenarios.length > 1 && !scs.length) return 'Coche au moins un scénario.';
      S.retenir();
      const champs = { categorie: f.get('categorie'), libelle, prevu, reel, payePar: f.get('payePar') || null, scenarios: scs.length === S.E.scenarios.length ? [] : scs, note: O.texte(f.get('note'), 200) };
      if (d) Object.assign(d, champs); else S.E.depenses.push({ id: uid(), ...champs });
      S.sauver(); S.rendre();
      const t = R.totaux(S.E);
      S.toast(t.restant !== null ? `${t.depasse ? 'Dépassement' : 'Reste'} : ${eur(Math.abs(t.restant))}.` : 'Dépense enregistrée.', { libelle: 'Annuler', faire: S.annuler });
      if (action === 'ok-suivant') { S.garderModale(); setTimeout(() => modaleDepense(null), 0); }
      return undefined;
    });
  }

  function modaleInvite(id) {
    const i = id ? S.E.invites.find((x) => x.id === id) : null;
    S.ouvrirModale(i ? 'Invité' : 'Nouvel invité', `
      <label class="champ">Nom<input name="nom" maxlength="60" value="${esc(i?.nom || '')}"></label>
      <div class="choix-statut deux"><label><input type="radio" name="type" value="adulte" ${!i || i.type === 'adulte' ? 'checked' : ''}><span>Adulte</span></label><label><input type="radio" name="type" value="enfant" ${i?.type === 'enfant' ? 'checked' : ''}><span>Enfant</span></label></div>
      <div class="choix-statut">${Object.entries(LIB_STATUT).map(([k, l]) => `<label><input type="radio" name="statut" value="${k}" ${(i?.statut || 'attente') === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
      <label class="champ">Note <small>Régime, accompagnant, covoiturage…</small><input name="note" maxlength="200" value="${esc(i?.note || '')}"></label><p class="erreur" role="alert"></p>`,
    i ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Retirer</button>' : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="ok-suivant">Ajouter et nouveau</button><button class="btn" value="annuler">Annuler</button>', (f, action) => {
      if (action === 'supprimer') { S.retenir(); S.E.invites = S.E.invites.filter((x) => x.id !== i.id); S.sauver(); S.rendre(); S.toast(`${i.nom} retiré.`, { libelle: 'Annuler', faire: S.annuler }); return undefined; }
      const nom = O.texte(f.get('nom'), 60);
      if (!nom) return 'Indique un nom.';
      S.retenir();
      const champs = { nom, type: f.get('type'), statut: f.get('statut'), note: O.texte(f.get('note'), 200) };
      if (i) Object.assign(i, champs); else S.E.invites.push({ id: uid(), ...champs });
      S.sauver(); S.rendre();
      if (action === 'ok-suivant') { S.garderModale(); setTimeout(() => modaleInvite(null), 0); }
      return undefined;
    });
  }

  function modaleParticipant(id) {
    const p = id ? S.E.participants.find((x) => x.id === id) : null;
    S.ouvrirModale(p ? 'Participant' : 'Nouveau participant', `
      <p class="aide">Une personne (ou un foyer) qui partage les frais. Parts : 1 par défaut, 2 pour un couple qui paie double.</p>
      <div class="rang-champs"><label class="champ">Nom<input name="nom" maxlength="60" value="${esc(p?.nom || '')}"></label><label class="champ">Parts<input name="parts" inputmode="decimal" value="${O.saisieNombre(p?.parts ?? 1)}"></label></div><p class="erreur" role="alert"></p>`,
    p ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Retirer</button>' : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>', (f, action) => {
      if (action === 'supprimer') { S.retenir(); S.E.participants = S.E.participants.filter((x) => x.id !== p.id); S.E.depenses.forEach((d) => { if (d.payePar === p.id) d.payePar = null; }); S.sauver(); S.rendre(); return undefined; }
      const nom = O.texte(f.get('nom'), 60);
      if (!nom) return 'Indique un nom.';
      const parts = O.lireNombre(f.get('parts'));
      if (!(parts >= 0.5 && parts <= 20)) return 'Parts : entre 0,5 et 20.';
      S.retenir();
      if (p) Object.assign(p, { nom, parts }); else S.E.participants.push({ id: uid(), nom, parts });
      S.sauver(); S.rendre();
      return undefined;
    });
  }

  // ---------- Actions ----------
  const STATUT_SUIVANT = { attente: 'confirme', confirme: 'decline', decline: 'attente' };
  const actions = {
    evenement: () => modaleEvenement(),
    scenarios: () => modaleScenarios(),
    scenario: (el) => { S.E.scenarioActif = el.dataset.id; S.sauver(); S.rendre(); },
    'depense-nouvelle': () => modaleDepense(null),
    'depense-ouvrir': (el) => modaleDepense(el.dataset.id),
    'invite-nouveau': () => modaleInvite(null),
    'invite-ouvrir': (el) => modaleInvite(el.dataset.id),
    'invite-statut': (el) => { const i = S.E.invites.find((x) => x.id === el.dataset.id); S.retenir(); i.statut = STATUT_SUIVANT[i.statut]; S.sauver(); S.rendre(); },
    'filtre-inv': (el) => { ui.filtreInv = el.dataset.id; S.rendre(); },
    'invites-coller': () => S.ouvrirModale('Ajouter une liste d\'invités', '<label class="champ">Un invité par ligne ; ajoute « (enfant) » pour un enfant<textarea name="liste" rows="8"></textarea></label><p class="erreur" role="alert"></p>', '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const l = lignesInvites(f.get('liste'));
      if (!l.length) return 'Colle au moins un nom.';
      S.retenir(); S.E.invites.push(...l); S.sauver(); S.rendre(); S.toast(`${S.pluriel(l.length, 'invité ajouté', 'invités ajoutés')}, réponse en attente.`, { libelle: 'Annuler', faire: S.annuler });
      return undefined;
    }),
    'participant-nouveau': () => modaleParticipant(null),
    'participant-ouvrir': (el) => modaleParticipant(el.dataset.id),
    'besoins-depenses': () => {
      const bs = R.besoins(S.E).filter((x) => x.cout);
      const parCat = {};
      for (const x of bs) parCat[x.besoin.categorie] = (parCat[x.besoin.categorie] || 0) + x.cout;
      S.retenir();
      for (const [cat, montant] of Object.entries(parCat)) S.E.depenses.push({ id: uid(), categorie: cat, libelle: `Courses estimées : ${nomCat(cat).toLowerCase()}`, prevu: montant, reel: null, payePar: null, scenarios: S.E.scenarios.length > 1 ? [S.E.scenarioActif] : [], note: 'Créée depuis les quantités estimées.' });
      S.sauver(); S.changerVue('depenses'); S.toast(`${S.pluriel(Object.keys(parCat).length, 'dépense prévue ajoutée', 'dépenses prévues ajoutées')}.`, { libelle: 'Annuler', faire: S.annuler });
    },
    tache: (el) => { S.retenir(); if (el.checked) S.E.faites[el.dataset.id] = true; else delete S.E.faites[el.dataset.id]; S.sauver(); S.rendre(); },
    'tache-retirer': (el) => { S.retenir(); S.E.tachesPerso = S.E.tachesPerso.filter((x) => x.id !== el.dataset.id); S.sauver(); S.rendre(); },
    imprimer: () => S.imprimer(() => { if (S.vue !== 'preparation') S.changerVue('preparation'); }),
    'csv-depenses': () => S.exporterCsv(R.csvDepenses(S.E), 'fete-depenses'),
    'csv-invites': () => S.exporterCsv(R.csvInvites(S.E), 'fete-invites'),
    'csv-courses': () => S.exporterCsv(R.csvCourses(S.E), 'fete-courses'),
  };

  S = window.QME_SOCLE.creer({
    produit: 'FTB', prefixe: 'ftb', nom: 'FêteBudget', fichier: 'fete-budget', titreBarre: 'FêteBudget<br>Fête et budget',
    connexion: { titre: 'Une fête complète, chaque dépense maîtrisée.', texte: 'Invités, budget global ou par personne, dépenses prévues et réelles, quantités de repas et de boissons estimées, scénarios comparés et frais partagés entre participants.', ouvrir: 'Ouvre FêteBudget', bouton: 'Ouvrir FêteBudget' },
    onglets: [
      { id: 'apercu', nom: 'Budget', icone: 'rond' },
      { id: 'invites', nom: 'Invités', icone: 'grille' },
      { id: 'depenses', nom: 'Dépenses', icone: 'lignes' },
      { id: 'besoins', nom: 'Quantités', icone: 'barres' },
      { id: 'preparation', nom: 'Préparation', icone: 'triangle' },
    ],
    etatVide: R.etatVide, normaliser: R.normaliser, donneesDemo, accueil, apresAccueil,
    vues: { apercu: vueApercu, invites: vueInvites, depenses: vueDepenses, besoins: vueBesoins, preparation: vuePreparation },
    apresRendu() {
      document.querySelectorAll('.saisie-besoin').forEach((el) => el.addEventListener('change', () => {
        const brut = el.value.trim();
        const a = S.E.ajustements[el.dataset.id] || { quantite: null, prix: null };
        if (el.dataset.champ === 'quantite') { const v = brut ? O.lireNombre(brut) : null; if (brut && v === null) return S.toast('Quantité illisible.'); a.quantite = v; }
        else { const v = lireMontant(brut); if (Number.isNaN(v)) return S.toast('Prix illisible : par exemple 1,80.'); a.prix = v; }
        S.retenir();
        if (a.quantite === null && a.prix === null) delete S.E.ajustements[el.dataset.id]; else S.E.ajustements[el.dataset.id] = a;
        S.sauver(); S.rendre();
        return undefined;
      }));
      S.$('.ajout-tache')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        const texte = O.texte(f.get('texte'), 120);
        if (!texte) return;
        S.retenir(); S.E.tachesPerso.push({ id: uid(), texte, j: O.entier(f.get('j'), -365, 60, 0) }); S.sauver(); S.rendre();
      });
    },
    actions,
    reglages: {
      exports: [['csv-depenses', 'Dépenses (CSV)'], ['csv-invites', 'Invités (CSV)'], ['csv-courses', 'Liste de courses (CSV)'], ['imprimer', 'Imprimer la synthèse']],
      aPropos: () => `<p class="mention">Base : ${B.types.length} types d'événement, ${B.formules.length} formules, ${B.besoins.length} articles de quantités, ${B.preparation.length} tâches de préparation (version ${B.version}). ${esc(B.sourceQuantites)} Aucune invitation ni aucun message n'est envoyé.</p>`,
    },
    importValide: (d) => d && typeof d === 'object' && d.evenement && Array.isArray(d.depenses),
    resumeImport: (d) => `« ${d.evenement.nom || 'événement'} », ${S.pluriel(d.depenses.length, 'dépense')}`,
  });
  S.lancer();
})();
