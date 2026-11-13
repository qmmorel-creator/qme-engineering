// Langue des templates QME (socle commun) : français par défaut, anglais pour les templates traduits.
// Ordre de choix : choix explicite de l'utilisateur (sélecteur ou ?lang=fr|en, mémorisé pour tous les
// templates de cet appareil) > langue du produit acheté (renvoyée à la connexion) > langue du navigateur.
// Les textes s'écrivent en français dans le code : t('Texte {n}', { n }) renvoie la traduction anglaise de
// window.TEXTES_EN quand l'interface est en anglais (repli sur le français si une traduction manque).
(function (g) {
  'use strict';
  const CLE = 'qme-langue', CLE_DATE = 'qme-ordre-date';
  const lire = (c) => { try { return localStorage.getItem(c); } catch { return null; } };
  const ecrire = (c, v) => { try { if (v === null) localStorage.removeItem(c); else localStorage.setItem(c, v); } catch { /* stockage indisponible */ } };

  const param = new URLSearchParams(g.location?.search || '').get('lang');
  if (param === 'fr' || param === 'en') ecrire(CLE, param);
  const choix = lire(CLE);
  const navigateur = String(g.navigator?.language || 'fr').toLowerCase();
  const langue = choix === 'fr' || choix === 'en' ? choix : navigateur.startsWith('fr') ? 'fr' : 'en';
  const en = langue === 'en';

  // Ordre des dates en anglais : mois/jour aux États-Unis (navigateur en-US), jour/mois ailleurs.
  const ordreChoisi = lire(CLE_DATE);
  const ordreDate = !en ? 'jm' : ordreChoisi === 'jm' || ordreChoisi === 'mj' ? ordreChoisi : navigateur === 'en-us' ? 'mj' : 'jm';
  const locale = !en ? 'fr-FR' : ordreDate === 'mj' ? 'en-US' : 'en-GB';

  const manquants = new Set();
  function t(texte, vars) {
    let s = texte;
    if (en) {
      const tr = g.TEXTES_EN?.[texte];
      if (typeof tr === 'string') s = tr; else manquants.add(texte);
    }
    return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m)) : s;
  }
  // Pluriel : français au-delà de 1, anglais dès que n ≠ 1. Les deux formes françaises sont des clés.
  const pluriel = (n, s, p) => `${n} ${(en ? Math.abs(n) !== 1 : Math.abs(n) > 1) ? t(p || `${s}s`) : t(s)}`;

  if (g.document) g.document.documentElement.lang = langue;

  g.LANGUE = {
    langue, en, explicite: choix === 'fr' || choix === 'en', ordreDate, locale, t, pluriel, manquants,
    // Change la langue (mémorisée pour tous les templates de cet appareil) ; la page est rechargée par l'appelant.
    definir(l) { ecrire(CLE, l === 'en' ? 'en' : 'fr'); },
    definirOrdreDate(o) { ecrire(CLE_DATE, o === 'mj' ? 'mj' : 'jm'); },
  };
})(typeof window !== 'undefined' ? window : globalThis);
