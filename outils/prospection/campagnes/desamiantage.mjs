// Concept métier « désamiantage » (master Concept métier, décision de Quentin du 27/11/2026) : outil SUR MESURE pour les
// entreprises certifiées sous-section 3, à partir de 1 500 € HT ; jamais un template. Page : /concepts/desamiantage/
// (plaquette PDF de 4 pages « Le Journal de zone »). Texte validé par Quentin avant tout envoi (via le GOD).
// Le serveur ajoute la signature « Bandeau » et la mention d'opposition : ne jamais les écrire ici.

export const campagne = {
  id: 'metier-desamiantage',
  nom: 'Concept métier · désamiantage (Journal de zone)',
  vague: 'metier-desamiantage',
  segment: 'Désamiantage (sous-section 3)',
  concept: 'https://qm-engineering.fr/concepts/desamiantage/',
};

// Lien traçable par prospect (GoatCounter garde utm_campaign).
const lien = (p) => `${campagne.concept}?utm_campaign=metier-desamiantage-${p.id}`;
// Le fait relevé sur le site, sans point final en double.
const fait = (p) => String(p.fait || '').trim().replace(/[.;\s]+$/, '');
// « de » élidé devant une voyelle ou un h.
const de = (nom) => (/^[aeiouyhàâäéèêëîïôöùûü]/i.test(String(nom).trim()) ? `d'${nom}` : `de ${nom}`);

export const objet = () => 'Vacations, fiches d\'exposition, restitution : un outil fait pour le désamiantage';

export const texte = (p) => `Bonjour,

Je suis Quentin Morel : je conçois des outils sur mesure pour des métiers dont le besoin ne rentre pas dans un logiciel standard (QME).

J'ai consulté le site ${de(p.nom)}, à ${p.ville}${fait(p) ? ` : ${fait(p)}` : ''}. Dans le désamiantage, une bonne part du temps part dans la paperasse autour de la zone : vacations à 2 h 30 et 6 h par jour à tenir, fiches d'exposition de chaque opérateur, plan de retrait à déposer sur DEMAT@MIANTE, mesures attendues du laboratoire, bordereaux de déchets, dossier de restitution à reconstituer en fin de chantier.

J'ai imaginé pour ce métier « le Journal de zone » :
- chaque chantier suivi du plan de retrait à la restitution ;
- les entrées et sorties du sas pointées sur téléphone, avec une alerte avant la limite de vacation ;
- les fiches d'exposition remplies au fil des vacations ;
- le dossier de restitution complet le jour du repli, relié à vos outils actuels.

La plaquette de 4 pages (données fictives) est ici :
${lien(p)}

Ce n'est pas un logiciel tout fait : je construis l'outil autour de votre organisation, à partir de 1 500 € HT, en commençant par le module qui vous fait gagner le plus de temps.

Si cela vous parle, répondez simplement à ce message : trente minutes d'échange suffisent pour voir par quoi commencer chez vous.

Bien à vous,`;

// Relance unique à J+7, dans le même fil, seulement sans réponse (vérifiée dans Gmail par la session).
export const relance = (p) => `Bonjour,

Je me permets de revenir vers vous au sujet du « Journal de zone », l'outil pour le désamiantage que je vous ai présenté la semaine dernière :
${lien(p)}

Si les vacations, les fiches d'exposition ou le dossier de restitution vous prennent du temps, un échange de 30 minutes suffit pour voir ce qui vous ferait gagner le plus. Sinon, dites-le-moi simplement : je ne vous relancerai pas.

Bien à vous,`;
