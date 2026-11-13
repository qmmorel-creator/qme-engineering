// Règles métier de la gestion de parc informatique : fonctions pures, sans DOM ni stockage.
// Chargé par l'application (window.REGLES) et par les tests (outils/templates/parc-informatique.test.mjs).
(function (g) {
  'use strict';

  // ---------- Dates locales au format AAAA-MM-JJ (comparables comme des chaînes) ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  const dateFr = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '');
  // Ajoute n mois en gardant le quantième, borné au dernier jour du mois (31/01 + 1 mois = 28 ou 29/02).
  function ajoutMois(s, n) {
    const [a, m, j] = s.split('-').map(Number);
    const total = (a * 12 + (m - 1)) + n;
    const an = Math.floor(total / 12), mois = total - an * 12;
    const dernier = new Date(an, mois + 1, 0).getDate();
    return `${an}-${deux(mois + 1)}-${deux(Math.min(j, dernier))}`;
  }
  // Mois révolus entre deux dates.
  function moisEntre(de, a) {
    const [a1, m1, j1] = de.split('-').map(Number);
    const [a2, m2, j2] = a.split('-').map(Number);
    let n = (a2 - a1) * 12 + (m2 - m1);
    if (j2 < j1 && ajoutMois(de, n) > a) n--;
    return n;
  }

  const plat = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const entier = (v, min = 0) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= min ? n : null; };

  // ---------- Garantie et âge ----------
  // Dernier jour couvert = achat + N mois − 1 jour. Sans date d'achat ou garantie nulle : null.
  function finGarantie(m) {
    const n = entier(m.garantie);
    if (!estDate(m.achat) || !n) return null;
    return ajout(ajoutMois(m.achat, n), -1);
  }
  // { etat: aucune | expiree | proche | ok, fin, jours (restants, négatifs si expirée) }
  function garantie(m, auj, fenetre = 60) {
    const fin = finGarantie(m);
    if (!fin) return { etat: 'aucune', fin: null, jours: null };
    const jours = ecart(auj, fin);
    return { etat: jours < 0 ? 'expiree' : jours <= fenetre ? 'proche' : 'ok', fin, jours };
  }
  const ageMois = (m, auj) => (estDate(m.achat) && m.achat <= auj ? moisEntre(m.achat, auj) : null);
  const ageTexte = (mois) => {
    if (mois === null || mois === undefined) return '–';
    if (mois < 12) return `${mois} mois`;
    const a = Math.floor(mois / 12), r = mois % 12;
    return `${a} an${a > 1 ? 's' : ''}${r ? ` ${r} mois` : ''}`;
  };
  // Ancien : âge ≥ durée de renouvellement (années) ; seulement pour le matériel encore dans le parc.
  function ancien(m, auj, annees) {
    const age = ageMois(m, auj);
    const n = Number(annees);
    return enParc(m) && age !== null && n > 0 && age >= n * 12;
  }
  const enParc = (m) => m.statut !== 'sorti' && m.statut !== 'perdu';

  // ---------- Affectations ----------
  // Période [debut, fin[ : un matériel rendu le jour J peut être remis à quelqu'un d'autre le même jour.
  const ouverte = (a) => !a.fin;
  const affectationOuverte = (affs, materielId) => affs.find((a) => a.materielId === materielId && ouverte(a)) || null;
  const chevauche = (a, b) => a.debut < (b.fin || '9999-12-31') && b.debut < (a.fin || '9999-12-31');

  const LIBELLES_STATUT = { affecte: 'Affecté', stock: 'En stock', reparation: 'En réparation', perdu: 'Perdu ou volé', sorti: 'Sorti du parc' };
  function statut(m, affs) {
    if (m.statut === 'sorti') return 'sorti';
    if (m.statut === 'perdu') return 'perdu';
    if (m.statut === 'reparation') return 'reparation';
    return affectationOuverte(affs, m.id) ? 'affecte' : 'stock';
  }

  // Vérifie une affectation (nouvelle ou modifiée) ; lève une erreur lisible. personne : { depart } facultatif.
  function verifierAffectation(affs, a, materiel, personne) {
    if (!materiel) throw new Error('Matériel introuvable.');
    if (!a.personneId) throw new Error('Choisis la personne.');
    if (!estDate(a.debut)) throw new Error('Date de remise invalide.');
    if (a.fin && !estDate(a.fin)) throw new Error('Date de restitution invalide.');
    if (a.fin && a.fin < a.debut) throw new Error('La restitution ne peut pas précéder la remise.');
    if (!a.fin && !enParc(materiel)) throw new Error('Ce matériel est sorti du parc ou perdu : il ne peut pas être affecté.');
    if (estDate(materiel.achat) && a.debut < materiel.achat) throw new Error('La remise ne peut pas précéder la date d\'achat.');
    if (personne?.depart && a.debut > personne.depart) throw new Error('Cette personne a quitté la structure avant cette date.');
    const conflit = affs.find((b) => b.id !== a.id && b.materielId === a.materielId && chevauche(a, b));
    if (conflit) throw new Error(ouverte(conflit) ? 'Ce matériel est déjà affecté : enregistre d\'abord sa restitution.' : `Période en conflit avec une affectation du ${dateFr(conflit.debut)} au ${dateFr(conflit.fin)}.`);
    return true;
  }

  // Renvoie une NOUVELLE liste d'affectations (l'originale n'est pas modifiée).
  function affecter(affs, materiel, opts) {
    const a = { id: opts.id, materielId: materiel.id, personneId: opts.personneId, debut: opts.date, fin: null, etatRemise: opts.etat || materiel.etat || 'bon', etatRetour: '', note: String(opts.note || '').trim() };
    verifierAffectation(affs, a, materiel, opts.personne);
    return [...affs, a];
  }
  function restituer(affs, affId, opts) {
    const a = affs.find((x) => x.id === affId);
    if (!a) throw new Error('Affectation introuvable.');
    if (!ouverte(a)) throw new Error('Ce matériel est déjà restitué.');
    if (!estDate(opts.date)) throw new Error('Date de restitution invalide.');
    if (opts.date < a.debut) throw new Error('La restitution ne peut pas précéder la remise.');
    const n = { ...a, fin: opts.date, etatRetour: opts.etat || '', note: [a.note, String(opts.note || '').trim()].filter(Boolean).join(' · ') };
    return affs.map((x) => (x.id === affId ? n : x));
  }
  const parDate = (a, b) => b.debut.localeCompare(a.debut) || (b.fin || '9999').localeCompare(a.fin || '9999');
  const historiqueMateriel = (affs, materielId) => affs.filter((a) => a.materielId === materielId).sort(parDate);
  const historiquePersonne = (affs, personneId) => affs.filter((a) => a.personneId === personneId).sort(parDate);

  // ---------- Personnes ----------
  const partie = (p, auj) => !!p?.depart && p.depart < auj;
  const presente = (p, auj) => !partie(p, auj);

  // ---------- Licences ----------
  const typeLicence = (types, id) => types.find((t) => t.id === id) || types[0];
  const attribuees = (l) => (l.attributions || []).length;
  const disponibles = (l) => (Number(l.postes) || 0) - attribuees(l);
  const surAttribuee = (l) => attribuees(l) > (Number(l.postes) || 0);
  // { etat: sans | expiree | proche | ok, jours }
  function echeance(l, auj, fenetre = 60) {
    if (!estDate(l.echeance)) return { etat: 'sans', jours: null };
    const jours = ecart(auj, l.echeance);
    return { etat: jours < 0 ? 'expiree' : jours <= fenetre ? 'proche' : 'ok', jours };
  }
  // Repousse l'échéance d'une période du type (12 mois ou 1 mois). Erreur si le type n'a pas d'échéance.
  function renouveler(l, types) {
    const t = typeLicence(types, l.type);
    if (!t.periode) throw new Error('Ce type de licence n\'a pas d\'échéance.');
    if (!estDate(l.echeance)) throw new Error('Indique d\'abord la date d\'échéance actuelle.');
    return { ...l, echeance: ajoutMois(l.echeance, t.periode), historique: [...(l.historique || []), { date: l.echeance, action: 'renouvelée' }] };
  }
  // Attribue une licence ; refuse les doublons et la cible absente. Ne bloque pas le dépassement (signalé en alerte).
  function attribuer(l, cible, cibleId, depuis, id) {
    if (!cibleId) throw new Error('Choisis à qui ou à quoi attribuer la licence.');
    if ((l.attributions || []).some((a) => a.cible === cible && a.cibleId === cibleId)) throw new Error('Déjà attribuée.');
    return { ...l, attributions: [...(l.attributions || []), { id, cible, cibleId, depuis }] };
  }
  const liberer = (l, attributionId) => ({ ...l, attributions: (l.attributions || []).filter((a) => a.id !== attributionId) });
  // Attributions à libérer : personne partie ou supprimée, matériel sorti, perdu ou supprimé.
  function aLiberer(l, etat, auj) {
    return (l.attributions || []).filter((a) => {
      if (a.cible === 'personne') { const p = etat.personnes.find((x) => x.id === a.cibleId); return !p || partie(p, auj); }
      const m = etat.materiels.find((x) => x.id === a.cibleId);
      return !m || !enParc(m);
    });
  }

  // ---------- Départ : liste de restitution ----------
  // { materiels: [affectations ouvertes], licences: [{ licence, attribution }] } (licences de la personne et des matériels qu'elle détient).
  function restitution(etat, personneId) {
    const affs = etat.affectations.filter((a) => a.personneId === personneId && ouverte(a));
    const ids = new Set(affs.map((a) => a.materielId));
    const licences = [];
    for (const l of etat.licences) {
      for (const a of l.attributions || []) {
        if ((a.cible === 'personne' && a.cibleId === personneId) || (a.cible === 'materiel' && ids.has(a.cibleId))) licences.push({ licence: l, attribution: a });
      }
    }
    return { materiels: affs, licences };
  }

  // ---------- Alertes ----------
  // reglages : { alertes: { garantie, licence, depart, reparationLongue }, categories: { id: { renouvellement } } }
  // Gravité : 0 urgent (rouge), 1 à prévoir (jaune), 2 à surveiller (bleu).
  function alertes(etat, auj, reglages) {
    const A = reglages.alertes;
    const liste = [];
    const nomP = (id) => etat.personnes.find((p) => p.id === id)?.nom || 'Personne supprimée';
    for (const p of etat.personnes) {
      if (!p.depart) continue;
      const r = restitution(etat, p.id);
      const n = r.materiels.length + r.licences.length;
      if (!n) continue;
      const j = ecart(auj, p.depart);
      if (j < 0) liste.push({ type: 'depart', gravite: 0, date: p.depart, ref: { personne: p.id }, titre: `${p.nom} est parti(e) avec du matériel non restitué`, detail: `${r.materiels.length} matériel(s), ${r.licences.length} licence(s) · départ le ${dateFr(p.depart)}` });
      else if (j <= A.depart) liste.push({ type: 'depart', gravite: 1, date: p.depart, ref: { personne: p.id }, titre: `Départ : ${p.nom} ${j === 0 ? 'aujourd\'hui' : `dans ${j} jour${j > 1 ? 's' : ''}`}`, detail: `À récupérer : ${r.materiels.length} matériel(s), ${r.licences.length} licence(s)` });
    }
    for (const l of etat.licences) {
      if (surAttribuee(l)) liste.push({ type: 'licence-depassement', gravite: 0, date: auj, ref: { licence: l.id }, titre: `${l.nom} : ${attribuees(l)} attributions pour ${l.postes} poste(s) achetés`, detail: `Dépassement de ${-disponibles(l)} : achète des postes ou libère des attributions` });
      const e = echeance(l, auj, A.licence);
      if (e.etat === 'expiree') liste.push({ type: 'licence-expiree', gravite: 0, date: l.echeance, ref: { licence: l.id }, titre: `${l.nom} : échéance dépassée`, detail: `Depuis le ${dateFr(l.echeance)} (${-e.jours} j) · renouvelle ou résilie` });
      else if (e.etat === 'proche') liste.push({ type: 'licence-echeance', gravite: 1, date: l.echeance, ref: { licence: l.id }, titre: `${l.nom} : à renouveler`, detail: `Échéance le ${dateFr(l.echeance)} (dans ${e.jours} j) · ${attribuees(l)}/${l.postes} poste(s) utilisés` });
      const lib = aLiberer(l, etat, auj);
      if (lib.length) liste.push({ type: 'licence-liberer', gravite: 1, date: auj, ref: { licence: l.id }, titre: `${l.nom} : ${lib.length} attribution(s) à libérer`, detail: lib.map((a) => (a.cible === 'personne' ? nomP(a.cibleId) : (etat.materiels.find((m) => m.id === a.cibleId)?.inventaire || 'Matériel supprimé'))).join(', ') });
    }
    for (const m of etat.materiels) {
      if (!enParc(m)) continue;
      const gar = garantie(m, auj, A.garantie);
      if (gar.etat === 'proche') liste.push({ type: 'garantie', gravite: 1, date: gar.fin, ref: { materiel: m.id }, titre: `Garantie de ${m.inventaire} · ${m.designation} se termine`, detail: `Dernier jour couvert : ${dateFr(gar.fin)} (dans ${gar.jours} j)` });
      if (m.statut === 'reparation' && m.statutDepuis && ecart(m.statutDepuis, auj) > A.reparationLongue) liste.push({ type: 'reparation', gravite: 1, date: m.statutDepuis, ref: { materiel: m.id }, titre: `${m.inventaire} · ${m.designation} en réparation depuis ${ecart(m.statutDepuis, auj)} jours`, detail: 'Relance le réparateur ou remplace le matériel' });
      const ren = reglages.categories?.[m.categorie]?.renouvellement;
      if (ancien(m, auj, ren)) liste.push({ type: 'ancien', gravite: 2, date: m.achat, ref: { materiel: m.id }, titre: `${m.inventaire} · ${m.designation} a ${ageTexte(ageMois(m, auj))}`, detail: `Durée de renouvellement de la catégorie : ${ren} an${ren > 1 ? 's' : ''} · à prévoir au budget` });
    }
    return liste.sort((a, b) => a.gravite - b.gravite || a.date.localeCompare(b.date) || a.titre.localeCompare(b.titre));
  }

  // ---------- Indicateurs ----------
  function indicateurs(etat, auj, fenetreGarantie = 60) {
    const i = { total: 0, affecte: 0, stock: 0, reparation: 0, perdu: 0, sorti: 0, sousGarantie: 0, horsGarantie: 0, valeur: 0, licences: etat.licences.length, postes: 0, attribuees: 0 };
    for (const m of etat.materiels) {
      const s = statut(m, etat.affectations);
      i[s]++;
      if (!enParc(m)) continue;
      i.total++;
      i.valeur += Number(m.prix) || 0;
      const gar = garantie(m, auj, fenetreGarantie).etat;
      if (gar === 'ok' || gar === 'proche') i.sousGarantie++; else i.horsGarantie++;
    }
    for (const l of etat.licences) { i.postes += Number(l.postes) || 0; i.attribuees += attribuees(l); }
    return i;
  }

  // Parc par catégorie (matériel dans le parc) : [{ categorie, affecte, stock, reparation, total }], par total décroissant.
  function parCategorie(etat) {
    const g = new Map();
    for (const m of etat.materiels) {
      if (!enParc(m)) continue;
      const s = statut(m, etat.affectations);
      if (!g.has(m.categorie)) g.set(m.categorie, { categorie: m.categorie, affecte: 0, stock: 0, reparation: 0, total: 0 });
      const x = g.get(m.categorie);
      x[s]++; x.total++;
    }
    return [...g.values()].sort((a, b) => b.total - a.total || a.categorie.localeCompare(b.categorie));
  }

  // ---------- Inventaire : numéros et filtres ----------
  function prochainInventaire(materiels) {
    const max = materiels.reduce((n, m) => { const x = /^INV-(\d+)$/.exec(String(m.inventaire || '').toUpperCase()); return x ? Math.max(n, Number(x[1])) : n; }, 0);
    return `INV-${String(max + 1).padStart(3, '0')}`;
  }
  // Doublon de numéro d'inventaire ou de série (insensible à la casse et aux espaces) ; renvoie le matériel en double.
  const cleNum = (s) => String(s || '').toUpperCase().replace(/\s+/g, '');
  const doublon = (materiels, champ, valeur, sauf) => (cleNum(valeur) ? materiels.find((m) => m.id !== sauf && cleNum(m[champ]) === cleNum(valeur)) || null : null);

  // f : { categorie, statut (tous | parc | affecte | stock | reparation | perdu | sorti), garantie (toutes | ok | proche | expiree | aucune), texte }
  // noms(m) : texte indexé en plus (détenteur, catégorie).
  function filtrer(materiels, affs, f = {}, auj, fenetre = 60, noms = () => '') {
    const mots = plat(f.texte || '').split(/\s+/).filter(Boolean);
    return materiels.filter((m) => {
      if (f.categorie && m.categorie !== f.categorie) return false;
      const s = statut(m, affs);
      const fs = f.statut || 'parc';
      if (fs === 'parc' && !enParc(m)) return false;
      if (!['parc', 'tous'].includes(fs) && s !== fs) return false;
      if (f.garantie && f.garantie !== 'toutes' && garantie(m, auj, fenetre).etat !== f.garantie) return false;
      if (mots.length) {
        const t = plat([m.inventaire, m.designation, m.serie, m.fournisseur, m.localisation, m.note, noms(m)].join(' '));
        if (!mots.every((x) => t.includes(x))) return false;
      }
      return true;
    });
  }

  // ---------- Exports CSV (point-virgule, BOM UTF-8, tableurs français) ----------
  function champCsv(v) {
    let s = String(v ?? '');
    if (typeof v !== 'number' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`; // formules neutralisées (pas les nombres négatifs)
    return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
  const lignesCsv = (lignes) => `﻿${lignes.map((l) => l.map(champCsv).join(';')).join('\r\n')}\r\n`;
  const nombre = (v) => (v === '' || v === null || v === undefined || !Number.isFinite(Number(v)) ? '' : String(Number(v)).replace('.', ','));

  // ctx : { categories: [{ id, nom }], etats: [{ id, nom }], fenetre }
  function csvInventaire(etat, auj, ctx, liste = etat.materiels) {
    const cat = (id) => ctx.categories.find((c) => c.id === id)?.nom || id;
    const et = (id) => ctx.etats.find((e) => e.id === id)?.nom || '';
    const pers = (id) => etat.personnes.find((p) => p.id === id)?.nom || '';
    const ent = ['N° inventaire', 'Catégorie', 'Désignation', 'N° de série', 'Fournisseur', 'Date d\'achat', 'Prix', 'Garantie (mois)', 'Fin de garantie', 'Garantie', 'Âge (mois)', 'Statut', 'État', 'Détenteur', 'Depuis le', 'Localisation', 'Sortie le', 'Motif de sortie', 'Note'];
    const LG = { ok: 'Sous garantie', proche: 'Se termine bientôt', expiree: 'Expirée', aucune: 'Non renseignée' };
    const lignes = [...liste].sort((a, b) => String(a.inventaire).localeCompare(String(b.inventaire))).map((m) => {
      const a = affectationOuverte(etat.affectations, m.id);
      const gar = garantie(m, auj, ctx.fenetre);
      return [m.inventaire, cat(m.categorie), m.designation, m.serie, m.fournisseur, dateFr(m.achat), nombre(m.prix), m.garantie ?? '', dateFr(gar.fin), LG[gar.etat], ageMois(m, auj) ?? '',
        LIBELLES_STATUT[statut(m, etat.affectations)], et(m.etat), a ? pers(a.personneId) : '', a ? dateFr(a.debut) : '', m.localisation, dateFr(m.sortie?.date), m.sortie?.motif || '', m.note];
    });
    return lignesCsv([ent, ...lignes]);
  }
  function csvAffectations(etat, ctx) {
    const cat = (id) => ctx.categories.find((c) => c.id === id)?.nom || id;
    const et = (id) => ctx.etats.find((e) => e.id === id)?.nom || '';
    const ent = ['Personne', 'Service', 'N° inventaire', 'Catégorie', 'Désignation', 'N° de série', 'Remis le', 'État à la remise', 'Restitué le', 'État au retour', 'Note'];
    const lignes = [...etat.affectations].sort((a, b) => a.debut.localeCompare(b.debut)).map((a) => {
      const m = etat.materiels.find((x) => x.id === a.materielId) || {};
      const p = etat.personnes.find((x) => x.id === a.personneId) || {};
      return [p.nom || '', p.service || '', m.inventaire || '', cat(m.categorie), m.designation || '', m.serie || '', dateFr(a.debut), et(a.etatRemise), a.fin ? dateFr(a.fin) : 'En cours', et(a.etatRetour), a.note];
    });
    return lignesCsv([ent, ...lignes]);
  }
  function csvLicences(etat, auj, ctx) {
    const ty = (id) => ctx.types.find((t) => t.id === id)?.nom || id;
    const cible = (a) => (a.cible === 'personne' ? etat.personnes.find((p) => p.id === a.cibleId)?.nom : etat.materiels.find((m) => m.id === a.cibleId)?.inventaire) || '?';
    const LE = { sans: 'Sans échéance', expiree: 'Expirée', proche: 'À renouveler', ok: 'En cours' };
    const ent = ['Logiciel', 'Catégorie', 'Type', 'Postes achetés', 'Attribués', 'Disponibles', 'Échéance', 'État', 'Coût par période', 'Fournisseur', 'Référence du contrat', 'Attribuée à'];
    const lignes = [...etat.licences].sort((a, b) => a.nom.localeCompare(b.nom)).map((l) => [l.nom, l.categorie, ty(l.type), l.postes, attribuees(l), disponibles(l), dateFr(l.echeance), LE[echeance(l, auj, ctx.fenetre).etat], nombre(l.cout), l.fournisseur, l.contrat, (l.attributions || []).map(cible).join(', ')]);
    return lignesCsv([ent, ...lignes]);
  }

  // Anonymise une personne partie (RGPD) : garde l'historique sans le nom. Refuse si du matériel reste à rendre.
  function anonymiser(etat, personneId, auj) {
    const p = etat.personnes.find((x) => x.id === personneId);
    if (!p) throw new Error('Personne introuvable.');
    if (!partie(p, auj)) throw new Error('Seule une personne partie peut être anonymisée.');
    const r = restitution(etat, personneId);
    if (r.materiels.length || r.licences.length) throw new Error('Du matériel ou des licences restent à récupérer.');
    const n = etat.personnes.filter((x) => x.anonyme).length + 1;
    return { ...p, nom: `Ancien collaborateur ${n}`, note: '', anonyme: true };
  }

  // Taille en octets de l'état sérialisé (le service accepte environ 900 000 octets par compte).
  const taille = (etat) => new TextEncoder().encode(JSON.stringify(etat)).length;

  g.REGLES = {
    iso, versDate, ajout, ecart, estDate, dateFr, ajoutMois, moisEntre, plat,
    finGarantie, garantie, ageMois, ageTexte, ancien, enParc,
    ouverte, affectationOuverte, chevauche, LIBELLES_STATUT, statut, verifierAffectation, affecter, restituer, historiqueMateriel, historiquePersonne,
    partie, presente, typeLicence, attribuees, disponibles, surAttribuee, echeance, renouveler, attribuer, liberer, aLiberer,
    restitution, alertes, indicateurs, parCategorie, prochainInventaire, doublon, filtrer,
    champCsv, csvInventaire, csvAffectations, csvLicences, anonymiser, taille,
  };
})(typeof window !== 'undefined' ? window : globalThis);
