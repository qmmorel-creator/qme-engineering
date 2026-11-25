// Campagne ciblée « formation » (demande de Quentin du 25/11/2026) : template Emploi du temps d'établissement (T56, EDT,
// 45 €, en vente) présenté comme prêt à l'emploi, avec l'ouverture sur du sur-mesure. Cible : petits organismes de
// formation, petits CFA indépendants, écoles privées de langues ou d'arts. Page : /concepts/formation/ ; démo :
// /templates/emploi-du-temps/?demo. Texte validé par Quentin avant tout envoi (docs/prospection/campagne-formation.md).
// Le serveur ajoute la signature « Bandeau » et la mention d'opposition : ne jamais les écrire ici.
// Pack « Écoles et formateurs » volontairement non cité (incomplet : CSE bloqué par Quentin).

export const campagne = {
  id: 'formation',
  nom: 'Formation · emploi du temps prêt à l\'emploi',
  vague: 'cible-formation',
  segment: 'Organismes de formation et écoles privées',
  produit: { code: 'EDT', nom: 'Emploi du temps d\'établissement', template: 'emploi-du-temps' },
  concept: 'https://qm-engineering.fr/concepts/formation/',
  demo: 'https://qm-engineering.fr/templates/emploi-du-temps/?demo',
};

// Lien traçable par prospect (GoatCounter garde utm_campaign) : ?utm_campaign=fo-<id>.
const code = (p) => `fo-${String(p.id).slice(0, 50)}`;
const lien = (p) => `${campagne.concept}?utm_campaign=${code(p)}`;
// Catalogue des templates pour les pros (fin du mail). Templates cités : en vente (QZZ, PRG).
const autres = (p) => `https://qm-engineering.fr/pro/?utm_campaign=${code(p)}`;
// Le fait relevé sur le site, en fin de phrase, sans point final en double.
const fait = (p) => String(p.fait || '').trim().replace(/[.;\s]+$/, '');

// « de » élidé devant une voyelle ou un h : « le site d'Alpha Formation… », « le site de La Clé… ».
const de = (nom) => (/^[aeiouyhàâäéèêëîïôöùûü]/i.test(String(nom).trim()) ? `d'${nom}` : `de ${nom}`);

export const objet = (p) => `${p.nom} : un emploi du temps sans conflit de salle ni de formateur`;

export const texte = (p) => `Bonjour,

Je suis Quentin Morel : je conçois des outils de gestion pour les petites structures (QME).

J'ai consulté le site ${de(p.nom)}, à ${p.ville}${fait(p) ? ` : ${fait(p)}` : ''}. Quand l'emploi du temps de plusieurs groupes, formateurs et salles tient dans un tableur, les croisements se découvrent souvent tard : un formateur attendu dans deux salles à la même heure, un groupe trop nombreux pour la salle prévue, un module qui dépasse ses heures sans que personne ne le voie.

J'ai conçu un emploi du temps d'établissement prêt à l'emploi, en ligne, sur ordinateur comme sur téléphone :
- il signale un conflit de formateur, de salle ou de groupe au moment où vous posez la séance, avant qu'il arrive ;
- il vérifie la capacité et l'équipement des salles, les disponibilités et absences des formateurs ;
- il suit les heures réalisées par groupe, par module et par formateur, comparées aux volumes prévus ;
- il gère jours fériés, vacances et semaines A/B, et recopie une semaine type jusqu'à la fin de l'année.

Vous pouvez l'essayer tout de suite, sans inscription, sur un organisme fictif :
${lien(p)}

C'est un template tout prêt. Si votre organisation demande autre chose (plusieurs sites, demi-groupes, accès des formateurs à leur planning, émargement), je peux aussi le faire sur mesure, en fonction de votre besoin.

Si cela vous parle, répondez simplement à ce message : trente minutes d'échange suffisent pour voir ce qui vous ferait gagner le plus de temps.

D'autres outils prêts à l'emploi peuvent aussi servir à vos formateurs, comme une banque de questions et de quiz ou une progression pédagogique : ${autres(p)}

Bien à vous,`;

// Relance unique à J+7, dans le même fil, seulement sans réponse (vérifiée dans Gmail par la session).
export const relance = (p) => `Bonjour,

Je me permets de revenir vers vous au sujet de l'emploi du temps d'établissement que je vous ai présenté la semaine dernière :
${lien(p)}

Si les conflits de salles ou de formateurs, ou le suivi des heures par groupe, vous prennent du temps, un échange de 30 minutes suffit pour voir ce qui vous ferait gagner le plus de temps, avec l'outil tel quel ou adapté sur mesure. Sinon, dites-le-moi simplement : je ne vous relancerai pas.

Bien à vous,`;
