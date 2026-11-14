// Base intégrée du template Candidatures études, stages, alternance : types de candidature, statuts, pièces
// types et listes de départ, questions d'entretien, trames de lettre de motivation, messages de relance.
// Aucune logique ici.
//
// Aucun calendrier officiel n'est intégré, aucune date : les dates limites, d'entretien et de réponse viennent de
// chaque établissement ou entreprise et sont saisies par l'utilisateur. Aucune plateforme de candidature n'est
// nommée. Les listes de pièces sont des points de départ (pièces souvent demandées), à adapter à ce que demande
// chaque formation ou recruteur. Questions, pistes et trames : textes originaux QME.
(() => {
  // p(identifiant stable, nom, aide, options) ; options : apres = à fournir seulement après acceptation
  const p = (id, nom, aide, o = {}) => ({ id, nom, aide, apres: Boolean(o.apres) });
  // q(identifiant stable, thème, question, piste de réponse, types concernés : [] = tous)
  const q = (id, theme, texte, piste, pour = []) => ({ id, theme, texte, piste, pour });

  window.BASE = {
    version: '2026-11-14',

    types: [
      { id: 'formation', nom: 'Formation', long: 'Formation (après le bac, master, école)', organisme: 'Établissement', intitule: 'Formation visée', exemple: 'Ex. : Licence de psychologie, Master génie civil', couleur: '#2E5A88' },
      { id: 'stage', nom: 'Stage', long: 'Stage', organisme: 'Entreprise ou organisme', intitule: 'Stage visé', exemple: 'Ex. : Stage assistant marketing, 6 mois', couleur: '#B84A34' },
      { id: 'alternance', nom: 'Alternance', long: 'Alternance (apprentissage, professionnalisation)', organisme: 'Entreprise ou organisme', intitule: 'Poste en alternance', exemple: 'Ex. : Chargé de projet en alternance', couleur: '#C79A1E' },
      { id: 'job', nom: 'Job étudiant', long: 'Job étudiant (été, week-end, à l\'année)', organisme: 'Employeur', intitule: 'Job visé', exemple: 'Ex. : Équipier en restauration, juillet-août', couleur: '#24221F' },
    ],

    // Ordre d'affichage ; `actif` = la candidature est encore en jeu ; `fin` = réponse définitive.
    statuts: [
      { id: 'preparer', nom: 'À préparer', court: 'À préparer', actif: true },
      { id: 'envoyee', nom: 'Envoyée', court: 'Envoyée', actif: true },
      { id: 'entretien', nom: 'Entretien', court: 'Entretien', actif: true },
      { id: 'attente', nom: 'Liste d\'attente', court: 'Attente', actif: true },
      { id: 'acceptee', nom: 'Acceptée', court: 'Acceptée', actif: false, fin: true },
      { id: 'refusee', nom: 'Refusée', court: 'Refusée', actif: false, fin: true },
      { id: 'retiree', nom: 'Retirée (désistement)', court: 'Retirée', actif: false, fin: true },
    ],

    statutsPiece: [
      { id: 'afaire', nom: 'À faire' },
      { id: 'encours', nom: 'En cours' },
      { id: 'prete', nom: 'Prête' },
      { id: 'envoyee', nom: 'Envoyée' },
    ],

    pieces: [
      p('cv', 'CV', 'Une page, adapté à chaque candidature : mets en avant ce qui sert ce poste ou cette formation.'),
      p('lm', 'Lettre de motivation', 'Une lettre par candidature : la trame de l\'onglet Préparer t\'aide à la construire.'),
      p('projet', 'Projet de formation motivé', 'Texte court demandé par certaines formations : pourquoi celle-ci, et ce que tu veux en faire.'),
      p('bulletins', 'Bulletins scolaires', 'Ceux demandés par la formation (souvent les deux dernières années).'),
      p('releves', 'Relevés de notes', 'Ceux des années demandées ; pour l\'année en cours, les résultats déjà connus.'),
      p('diplome', 'Diplôme ou attestation de réussite', 'Si le diplôme n\'est pas encore délivré, une attestation de réussite ou d\'inscription.'),
      p('reco', 'Lettre de recommandation', 'Demande-la tôt (au moins deux à trois semaines avant) et note à qui dans la précision.'),
      p('avis', 'Avis ou appréciations des professeurs', 'Souvent rempli par l\'établissement d\'origine : vérifie qu\'il est bien transmis.'),
      p('portfolio', 'Portfolio ou réalisations', 'Pour les formations ou postes créatifs et techniques : projets, travaux, liens.'),
      p('langue', 'Certificat de niveau de langue', 'Seulement s\'il est demandé : vérifie le test et le score attendus.'),
      p('identite', 'Copie de pièce d\'identité', 'À joindre si elle est demandée. L\'application ne garde que son statut, jamais la pièce ni son numéro.'),
      p('photo', 'Photo d\'identité', 'Seulement si elle est demandée.'),
      p('frais', 'Frais de dossier ou de concours', 'Si la candidature est payante : note le montant et la date limite de paiement dans la précision.'),
      p('epreuves', 'Inscription aux épreuves (écrit, oral, test)', 'Note la date de l\'épreuve dans les dates de la candidature.'),
      p('formulaire', 'Formulaire de candidature', 'Le dossier propre à l\'établissement ou à l\'entreprise.'),
      p('inscription', 'Inscription ou admission en formation', 'Pour l\'alternance : la preuve que l\'école ou le centre de formation t\'accepte.'),
      p('rythme', 'Calendrier du rythme d\'alternance', 'Les périodes en entreprise et en formation : l\'employeur le demande souvent.'),
      p('disponibilites', 'Disponibilités', 'Jours, horaires et périodes où tu peux travailler.'),
      p('references', 'Références', 'Un ou deux contacts d\'anciens encadrants, avec leur accord.'),
      p('responsabilite', 'Attestation de responsabilité civile', 'Souvent demandée pour un stage : auprès de ton assurance ou de celle de tes parents.', { apres: true }),
      p('convention', 'Convention de stage', 'Fournie par ton établissement, à faire signer une fois le stage accepté.', { apres: true }),
      p('contrat', 'Contrat d\'alternance', 'Signé avec l\'employeur et le centre de formation une fois la candidature acceptée.', { apres: true }),
      p('confirmation', 'Confirmation d\'inscription', 'Réponse définitive ou inscription administrative, une fois admis.', { apres: true }),
    ],

    // Listes de départ proposées à la création d'une candidature (modifiables ensuite, pièce par pièce).
    modeles: [
      { id: 'postbac', type: 'formation', nom: 'Formation après le bac', pieces: ['projet', 'bulletins', 'releves', 'avis', 'cv', 'frais', 'confirmation'] },
      { id: 'master', type: 'formation', nom: 'Master ou poursuite d\'études', pieces: ['cv', 'lm', 'releves', 'diplome', 'reco', 'langue', 'identite', 'confirmation'] },
      { id: 'ecole', type: 'formation', nom: 'École sur dossier ou concours', pieces: ['formulaire', 'cv', 'lm', 'releves', 'reco', 'frais', 'epreuves', 'photo', 'identite', 'confirmation'] },
      { id: 'stage', type: 'stage', nom: 'Stage', pieces: ['cv', 'lm', 'releves', 'portfolio', 'responsabilite', 'convention'] },
      { id: 'alternance', type: 'alternance', nom: 'Alternance', pieces: ['cv', 'lm', 'inscription', 'rythme', 'releves', 'contrat'] },
      { id: 'job', type: 'job', nom: 'Job étudiant', pieces: ['cv', 'disponibilites', 'references'] },
      { id: 'vide', type: '', nom: 'Liste vide (j\'ajoute mes pièces)', pieces: [] },
    ],

    canaux: [
      { id: 'email', nom: 'E-mail' },
      { id: 'telephone', nom: 'Téléphone' },
      { id: 'site', nom: 'Formulaire ou espace en ligne' },
      { id: 'place', nom: 'Sur place' },
    ],

    formatsEntretien: [
      { id: 'presentiel', nom: 'Sur place' },
      { id: 'visio', nom: 'En visio' },
      { id: 'telephone', nom: 'Par téléphone' },
    ],

    themes: [
      { id: 'presentation', nom: 'Te présenter' },
      { id: 'motivation', nom: 'Motivation' },
      { id: 'parcours', nom: 'Parcours et expériences' },
      { id: 'qualites', nom: 'Qualités et points à travailler' },
      { id: 'situation', nom: 'Mises en situation' },
      { id: 'pratique', nom: 'Questions pratiques' },
      { id: 'poser', nom: 'Tes questions à poser' },
    ],

    questions: [
      q('pres1', 'presentation', 'Présente-toi en deux minutes.', 'Trois temps : qui tu es aujourd\'hui, ce qui t\'a amené ici, ce que tu cherches. Termine sur le lien avec cette candidature.'),
      q('pres2', 'presentation', 'Qu\'est-ce qui ne figure pas sur ton CV ?', 'Une activité, un engagement ou un trait de caractère, avec un exemple concret.'),
      q('pres3', 'presentation', 'Comment tes proches ou tes camarades te décriraient-ils ?', 'Deux ou trois mots, chacun appuyé par une situation vécue.'),
      q('pres4', 'presentation', 'Qu\'est-ce qui t\'occupe en dehors des cours ?', 'Sport, association, projet personnel : dis ce que tu y as appris, pas seulement ce que tu fais.'),
      q('mot1', 'motivation', 'Pourquoi cette formation plutôt qu\'une autre ?', 'Cite deux éléments précis du programme ou de l\'organisation (cours, projets, stages, rythme) et relie-les à ton projet.', ['formation']),
      q('mot2', 'motivation', 'Pourquoi notre entreprise ?', 'Ce que tu sais de son activité, de ses produits ou de ses clients, et ce qui t\'attire dans ce que tu ferais chez elle.', ['stage', 'alternance', 'job']),
      q('mot3', 'motivation', 'Qu\'attends-tu de ce stage ?', 'Les compétences que tu veux développer et la façon dont tu comptes être utile à l\'équipe dès les premières semaines.', ['stage']),
      q('mot4', 'motivation', 'Pourquoi l\'alternance ?', 'Le rythme qui te correspond, l\'expérience concrète, le lien entre ce que tu apprends et ce que tu fais en entreprise.', ['alternance']),
      q('mot5', 'motivation', 'Où d\'autre as-tu candidaté ?', 'Reste honnête et cohérent : d\'autres candidatures dans la même direction montrent un projet construit.'),
      q('mot6', 'motivation', 'Que feras-tu si ta candidature n\'est pas retenue ?', 'Un plan B réfléchi, sans dévaloriser cette candidature : il montre que ton projet tient debout.', ['formation']),
      q('par1', 'parcours', 'Raconte une expérience qui te rend fier ou fière.', 'Situation, ce que tu as fait toi-même, résultat. Une expérience scolaire, associative ou personnelle compte autant qu\'un emploi.'),
      q('par2', 'parcours', 'Comment expliques-tu cette note ou cette période plus difficile ?', 'Reconnais-la simplement, explique ce que tu as changé depuis et ce que tu en as retiré.'),
      q('par3', 'parcours', 'Quel cours ou quel projet t\'a le plus marqué ?', 'Choisis-en un en rapport avec la candidature et dis ce qu\'il t\'a donné envie de faire.'),
      q('par4', 'parcours', 'As-tu déjà travaillé en équipe ? Comment ça s\'est passé ?', 'Ton rôle, une difficulté rencontrée et la manière dont l\'équipe l\'a dépassée.'),
      q('par5', 'parcours', 'Qu\'as-tu appris de ton dernier stage ou job ?', 'Une compétence concrète et un savoir-être, chacun illustré.', ['stage', 'alternance', 'job']),
      q('qua1', 'qualites', 'Cite trois qualités utiles pour ce poste ou cette formation.', 'Trois qualités, trois exemples courts. Évite les listes sans preuve.'),
      q('qua2', 'qualites', 'Quel est ton principal point à améliorer ?', 'Un vrai point, pas une qualité déguisée, et ce que tu fais déjà pour progresser.'),
      q('qua3', 'qualites', 'Comment t\'organises-tu quand tu as beaucoup de travail ?', 'Ta méthode : priorités, liste, planning, et un exemple de période chargée bien tenue.'),
      q('qua4', 'qualites', 'Comment réagis-tu face à une critique ?', 'Écouter, demander des précisions, corriger : un exemple où un retour t\'a fait progresser.'),
      q('sit1', 'situation', 'Tu as une tâche que tu ne sais pas faire. Que fais-tu ?', 'Chercher d\'abord par toi-même, puis demander au bon moment, avec une question précise.', ['stage', 'alternance', 'job']),
      q('sit2', 'situation', 'Un client ou un usager est mécontent devant toi. Comment réagis-tu ?', 'Écouter sans couper, reformuler, proposer ce qui dépend de toi, passer la main si besoin.', ['job', 'alternance']),
      q('sit3', 'situation', 'Deux tâches urgentes arrivent en même temps. Laquelle passe en premier ?', 'Montre ton raisonnement : échéance, impact, et le réflexe de prévenir ton responsable.', ['stage', 'alternance', 'job']),
      q('sit4', 'situation', 'Un membre de ton groupe de projet ne fait pas sa part. Que fais-tu ?', 'En parler directement et tôt, répartir à nouveau, prévenir l\'encadrant seulement si rien ne bouge.', ['formation', 'stage']),
      q('pra1', 'pratique', 'Quelles sont tes disponibilités ?', 'Dates, jours et horaires précis ; dis aussi ce qui est négociable.', ['job', 'stage']),
      q('pra2', 'pratique', 'Connais-tu le rythme de l\'alternance et ton école ou centre de formation ?', 'Le rythme exact (semaines ou jours), l\'établissement et où en est ton admission.', ['alternance']),
      q('pra3', 'pratique', 'Es-tu mobile ? Comment viendras-tu ?', 'Le trajet prévu et sa durée, ou ton projet de logement si tu déménages.'),
      q('pra4', 'pratique', 'Comment financeras-tu tes études ou ton installation ?', 'Une réponse simple et préparée : elle rassure sur ta capacité à suivre jusqu\'au bout.', ['formation']),
      q('pos1', 'poser', 'À quoi ressemblerait une semaine type ?', 'Elle montre que tu te projettes et t\'aide à comparer les offres.'),
      q('pos2', 'poser', 'Qui m\'encadrerait, et comment se passent les points d\'étape ?', 'Pour savoir qui t\'accompagne et à quelle fréquence.', ['stage', 'alternance']),
      q('pos3', 'poser', 'Que deviennent les anciens étudiants de la formation ?', 'Poursuites d\'études, métiers, entreprises : des faits concrets pour décider.', ['formation']),
      q('pos4', 'poser', 'Quelles sont les prochaines étapes, et quand aurai-je une réponse ?', 'Toujours la poser à la fin : note la date annoncée comme « réponse attendue ».'),
      q('pos5', 'poser', 'Qu\'est-ce qui fait réussir quelqu\'un à ce poste ou dans cette formation ?', 'Elle montre ton envie de bien faire et t\'apprend ce qui compte vraiment pour eux.'),
    ],

    // Trames originales de lettre de motivation. {champ} est remplacé par la valeur saisie ; un champ vide reste
    // signalé « [à compléter : …] ». organisme, intitule et signature sont repris de la candidature et du profil.
    trames: [
      {
        id: 'formation', nom: 'Formation', type: 'formation', objet: 'Candidature en {intitule}',
        champs: [
          { id: 'situation', lib: 'Ta situation actuelle', exemple: 'en terminale générale, spécialités mathématiques et sciences économiques et sociales' },
          { id: 'declic', lib: 'Ce qui a fait naître ton intérêt', exemple: 'un projet de classe sur l\'urbanisme de ma ville, qui m\'a fait découvrir le métier d\'urbaniste' },
          { id: 'atout1', lib: 'Une matière, une qualité ou une expérience qui te prépare', exemple: 'mes bons résultats en géographie et mon goût pour l\'analyse de documents' },
          { id: 'atout2', lib: 'Une deuxième preuve, hors des cours', exemple: 'mon engagement au conseil de la vie lycéenne, où j\'ai mené un projet de réaménagement du foyer' },
          { id: 'specificite', lib: 'Ce qui t\'attire dans cette formation précise', exemple: 'les projets de terrain menés avec des collectivités dès la deuxième année' },
          { id: 'projet', lib: 'Ton projet après la formation', exemple: 'poursuivre en master pour travailler sur l\'aménagement des villes moyennes' },
        ],
        paragraphes: [
          'Actuellement {situation}, je souhaite intégrer la formation {intitule} proposée par {organisme}. Mon intérêt est né de {declic}.',
          'Je pense disposer des bases nécessaires pour réussir dans cette formation : {atout1}. En dehors des cours, {atout2} m\'a appris à m\'organiser et à mener un projet jusqu\'au bout.',
          'Votre formation a retenu mon attention en particulier pour {specificite}. C\'est pour moi une étape cohérente vers mon projet : {projet}.',
          'Je me tiens à votre disposition pour vous présenter ma motivation lors d\'un entretien et vous remercie de l\'attention portée à ma candidature.',
        ],
      },
      {
        id: 'stage', nom: 'Stage', type: 'stage', objet: 'Candidature pour un stage : {intitule}',
        champs: [
          { id: 'situation', lib: 'Ta formation et ton année', exemple: 'en deuxième année de BUT techniques de commercialisation' },
          { id: 'periode', lib: 'La période et la durée du stage', exemple: 'de 10 semaines à partir d\'avril' },
          { id: 'interet', lib: 'Ce qui t\'attire dans l\'entreprise', exemple: 'votre développement auprès des commerces de proximité et la place laissée aux stagiaires dans vos projets' },
          { id: 'competence', lib: 'Une compétence que tu apportes, avec une preuve', exemple: 'la conduite d\'une enquête client, menée pour un projet tutoré auprès de 120 personnes' },
          { id: 'apprendre', lib: 'Ce que tu veux apprendre', exemple: 'la préparation et le suivi d\'une action commerciale de bout en bout' },
        ],
        paragraphes: [
          'Actuellement {situation}, je recherche un stage {periode}. Je vous adresse ma candidature pour le poste de {intitule} au sein de {organisme}.',
          'Ce qui m\'attire chez vous, c\'est {interet}. Je peux y contribuer dès mon arrivée grâce à {competence}.',
          'Ce stage serait pour moi l\'occasion d\'apprendre {apprendre}, au contact d\'une équipe expérimentée.',
          'Je reste à votre disposition pour un entretien, à votre convenance, et vous remercie de l\'attention que vous porterez à ma candidature.',
        ],
      },
      {
        id: 'alternance', nom: 'Alternance', type: 'alternance', objet: 'Candidature en alternance : {intitule}',
        champs: [
          { id: 'formation', lib: 'La formation préparée en alternance', exemple: 'un BTS gestion de la PME' },
          { id: 'ecole', lib: 'L\'école ou le centre de formation, et le rythme', exemple: 'au centre de formation de ma ville, à raison de deux jours en cours et trois jours en entreprise' },
          { id: 'debut', lib: 'La date de début souhaitée', exemple: 'septembre' },
          { id: 'interet', lib: 'Ce qui t\'attire dans l\'entreprise', exemple: 'la diversité de votre clientèle et la polyvalence demandée à vos équipes' },
          { id: 'experience', lib: 'Une expérience ou une qualité qui te rend opérationnel', exemple: 'deux étés passés à l\'accueil d\'un camping, où j\'ai géré réservations et encaissements' },
          { id: 'engagement', lib: 'Ce que tu t\'engages à apporter', exemple: 'de la rigueur dans le suivi administratif et l\'envie d\'apprendre vite' },
        ],
        paragraphes: [
          'Je prépare {formation} {ecole} et je recherche une entreprise d\'accueil pour un contrat en alternance à partir de {debut}. Le poste de {intitule} proposé par {organisme} correspond à ce que je souhaite apprendre.',
          'Votre entreprise m\'intéresse pour {interet}. {experience} m\'a donné les premiers réflexes utiles à ce poste.',
          'L\'alternance me permettra de mettre aussitôt en pratique ce que j\'apprends en formation. Je m\'engage à vous apporter {engagement}.',
          'Je me tiens à votre disposition pour un entretien et vous remercie de l\'attention portée à ma candidature.',
        ],
      },
      {
        id: 'job', nom: 'Job étudiant', type: 'job', objet: 'Candidature : {intitule}',
        champs: [
          { id: 'situation', lib: 'Ta situation', exemple: 'étudiant en première année de licence de droit' },
          { id: 'dispo', lib: 'Tes disponibilités', exemple: 'tout le mois de juillet et les trois premières semaines d\'août' },
          { id: 'qualite', lib: 'Une qualité utile, avec une preuve', exemple: 'le sens du contact, développé comme animateur bénévole dans un club de sport' },
          { id: 'motivation', lib: 'Pourquoi cet employeur', exemple: 'l\'ambiance de votre établissement, que je connais comme client' },
        ],
        paragraphes: [
          'Actuellement {situation}, je suis disponible {dispo} et je vous propose ma candidature pour le poste de {intitule} chez {organisme}.',
          'Je peux vous apporter {qualite}. Je choisis de vous écrire pour {motivation}.',
          'Je suis disponible pour un entretien ou une période d\'essai et vous remercie de votre attention.',
        ],
      },
      {
        id: 'spontanee', nom: 'Candidature spontanée', type: '', objet: 'Candidature spontanée',
        champs: [
          { id: 'situation', lib: 'Ta situation', exemple: 'en master 1 de communication' },
          { id: 'recherche', lib: 'Ce que tu recherches (stage, alternance, job) et quand', exemple: 'un stage de quatre à six mois à partir de février' },
          { id: 'decouverte', lib: 'Comment tu connais l\'organisme', exemple: 'la conférence que votre équipe a donnée dans mon école' },
          { id: 'apport', lib: 'Ce que tu peux apporter, avec une preuve', exemple: 'mon expérience de la création de contenus, avec la page d\'une association que j\'anime depuis deux ans' },
        ],
        paragraphes: [
          'Actuellement {situation}, je recherche {recherche}. J\'ai découvert {organisme} grâce à {decouverte}, et j\'aimerais rejoindre vos équipes.',
          'Je pourrais vous apporter {apport}. J\'aimerais beaucoup vous en parler et comprendre vos besoins actuels.',
          'Je vous remercie par avance de l\'attention portée à ma demande et reste disponible pour un échange.',
        ],
      },
    ],

    // Messages de relance à copier. {organisme}, {intitule}, {date} (date d'envoi) et {signature} remplacés.
    relances: {
      formation: 'Bonjour,\n\nJ\'ai déposé le {date} ma candidature pour la formation {intitule}. Je souhaitais m\'assurer que mon dossier est complet et savoir quand les réponses seront communiquées.\n\nJe vous remercie par avance.\n\n{signature}',
      autre: 'Bonjour,\n\nJe vous ai adressé le {date} ma candidature pour le poste de {intitule} chez {organisme}. Ce poste m\'intéresse toujours beaucoup et je me permets de revenir vers vous pour savoir si elle a pu être étudiée. Je suis disponible pour un entretien à votre convenance.\n\nBien cordialement,\n\n{signature}',
      remerciement: 'Bonjour,\n\nMerci pour l\'entretien du {date} au sujet de {intitule}. Nos échanges ont confirmé mon intérêt pour {organisme}. Je reste à votre disposition pour toute information complémentaire.\n\nBien cordialement,\n\n{signature}',
    },

    conseils: [
      ['Une candidature par ligne', 'Chaque formation, stage ou poste a sa fiche : ses pièces, ses dates et sa réponse.'],
      ['Tes dates, à la source', 'Aucun calendrier n\'est intégré : recopie les dates de chaque établissement ou recruteur, et vérifie-les à la source.'],
      ['Les pièces avant la date limite', 'Le tableau de bord montre ce qu\'il manque pour chaque envoi des prochains jours.'],
      ['Relancer au bon moment', 'Sans réponse après le délai choisi, l\'application propose une relance avec un message à copier.'],
    ],

    avertissement: 'Les dates limites, d\'entretien et de réponse sont celles que tu saisis : vérifie-les toujours sur le site ou auprès de l\'établissement ou du recruteur. Les listes de pièces sont des points de départ : seule compte la liste demandée par chaque candidature.',
  };
})();
