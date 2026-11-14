// Base intégrée de « Cadeaux reçus et remerciements » : types d'événement, types de cadeaux ou d'attentions,
// canaux et tons du remerciement, 44 modèles de messages (rédaction originale pour QME, 14/11/2026), formats
// de planches d'étiquettes A4 (dimensions courantes, sans nom de marque), conseils de démarrage.
// Aucune règle légale ni donnée datée. Les identifiants ne changent jamais (données des utilisateurs).
//
// Modèles : champs remplis par l'application.
//   {appel} formule d'appel du foyer · {cadeaux} cadeaux reçus (« la machine à pain et votre présence »)
//   {occasion} « notre mariage », « la naissance de Léo »… · {concerne} prénom de l'enfant ou de la personne disparue
//   {projet} ce que l'argent reçu permettra (« notre voyage de noces ») · {signature}
// Blocs conditionnels : {?argent}…{/argent} (de l'argent a été reçu), {?projet}…{/projet} (argent reçu et
// projet renseigné), {?concerne}…{/concerne} et {!concerne}…{/concerne} (prénom renseigné ou non).
(() => {
  const m = (id, ton, texte) => ({ id, ton, texte });

  window.BASE = {
    version: '2026-11-14',

    evenements: [
      { id: 'mariage', nom: 'Mariage', nous: true, festif: true, mot: 'cadeaux', motUn: 'cadeau', occasion: 'notre mariage', concerne: null,
        tons: ['chaleureux', 'sobre', 'bref', 'leger'], cadeaux: ['objet', 'cagnotte', 'argent', 'bon', 'presence', 'message', 'aide', 'fleurs', 'don'] },
      { id: 'naissance', nom: 'Naissance ou baptême', nous: true, festif: true, mot: 'cadeaux', motUn: 'cadeau', occasion: 'la naissance de {concerne}', occasionSans: 'cette naissance', concerne: 'Prénom de l\'enfant',
        tons: ['chaleureux', 'sobre', 'bref', 'leger'], cadeaux: ['objet', 'argent', 'cagnotte', 'bon', 'message', 'aide', 'fleurs', 'presence', 'don'] },
      { id: 'anniversaire', nom: 'Anniversaire', nous: false, festif: true, mot: 'cadeaux', motUn: 'cadeau', occasion: 'mon anniversaire', concerne: null,
        tons: ['chaleureux', 'sobre', 'bref', 'leger'], cadeaux: ['objet', 'cagnotte', 'argent', 'bon', 'presence', 'message', 'fleurs', 'aide', 'don'] },
      { id: 'retraite', nom: 'Départ à la retraite', nous: false, festif: true, mot: 'cadeaux', motUn: 'cadeau', occasion: 'mon départ à la retraite', concerne: null,
        tons: ['chaleureux', 'sobre', 'bref', 'leger'], cadeaux: ['cagnotte', 'objet', 'bon', 'message', 'presence', 'argent', 'fleurs', 'aide', 'don'] },
      { id: 'obseques', nom: 'Obsèques', nous: true, festif: false, mot: 'marques de sympathie', motUn: 'marque de sympathie', occasion: 'ces moments difficiles', concerne: 'Personne disparue, comme vous la nommez (« maman », « Jeanne »)',
        tons: ['sobre', 'chaleureux', 'bref'], cadeaux: ['fleurs', 'message', 'presence', 'don', 'aide', 'objet', 'argent', 'cagnotte', 'bon'] },
      { id: 'autre', nom: 'Autre occasion', nous: true, festif: true, mot: 'cadeaux', motUn: 'cadeau', occasion: 'cette occasion', concerne: null,
        tons: ['chaleureux', 'sobre', 'bref'], cadeaux: ['objet', 'argent', 'cagnotte', 'bon', 'presence', 'message', 'aide', 'fleurs', 'don'] },
    ],

    // defaut : groupe nominal utilisé dans le message quand la description est vide.
    // monetaire : compte pour les blocs {?argent} et {?projet} (argent reçu par l'utilisateur).
    cadeaux: [
      { id: 'objet', nom: 'Objet', defaut: 'votre cadeau', monetaire: false, exemple: 'la machine à pain' },
      { id: 'argent', nom: 'Argent (chèque, virement, espèces)', court: 'Argent', defaut: 'votre généreux cadeau', monetaire: true, exemple: 'votre chèque' },
      { id: 'cagnotte', nom: 'Participation à une cagnotte', court: 'Cagnotte', defaut: 'votre participation à la cagnotte', monetaire: true, exemple: '' },
      { id: 'bon', nom: 'Bon ou expérience', court: 'Bon cadeau', defaut: 'votre bon cadeau', monetaire: false, exemple: 'le dîner au restaurant' },
      { id: 'fleurs', nom: 'Fleurs', defaut: 'les fleurs', monetaire: false, exemple: 'la très belle composition' },
      { id: 'message', nom: 'Message ou carte', court: 'Message', defaut: 'votre message', monetaire: false, exemple: 'votre lettre' },
      { id: 'presence', nom: 'Présence', defaut: 'votre présence', monetaire: false, exemple: '' },
      { id: 'aide', nom: 'Aide, service rendu', court: 'Aide', defaut: 'votre aide', monetaire: false, exemple: 'votre aide pour la décoration' },
      { id: 'don', nom: 'Don à une association', court: 'Don', defaut: 'votre don', monetaire: false, exemple: 'votre don à l\'association' },
    ],

    canaux: [
      { id: 'poste', nom: 'Carte par la poste', court: 'Poste', adresse: true },
      { id: 'main', nom: 'Carte remise en main propre', court: 'En main propre', adresse: false },
      { id: 'message', nom: 'Message (texte à copier)', court: 'Message', adresse: false },
      { id: 'vive-voix', nom: 'De vive voix', court: 'De vive voix', adresse: false },
    ],

    statuts: [
      { id: 'a-ecrire', nom: 'À écrire' },
      { id: 'ecrit', nom: 'Écrit, à envoyer' },
      { id: 'envoye', nom: 'Envoyé' },
    ],

    tons: [
      { id: 'chaleureux', nom: 'Chaleureux', desc: 'Affectueux, pour la famille et les amis proches.' },
      { id: 'sobre', nom: 'Sobre', desc: 'Sincère et retenu, pour les relations plus distantes ou les moments graves.' },
      { id: 'bref', nom: 'Bref', desc: 'Deux lignes, pour une carte petit format ou un message.' },
      { id: 'leger', nom: 'Léger', desc: 'Avec une pointe d\'humour, pour les proches qui l\'apprécient.' },
    ],

    // Modèles par type d'événement. Rédaction originale QME. Le « je » ou le « nous » suit le type d'événement.
    modeles: {
      mariage: [
        m('mar-ch1', 'chaleureux', '{appel}\n\nMerci du fond du cœur pour {cadeaux}. Votre attention pour {occasion} nous a beaucoup touchés{?argent}, et votre générosité nous aide à bien commencer notre vie à deux{/argent}.{?projet} Grâce à elle, nous pourrons nous offrir {projet}.{/projet}\n\nNous avons hâte de vous recevoir chez nous pour vous remercier de vive voix.\n\nAvec toute notre affection,\n{signature}'),
        m('mar-ch2', 'chaleureux', '{appel}\n\nQuelle joie de découvrir {cadeaux} ! Nous y voyons toute l\'attention que vous nous portez, et cela nous touche beaucoup.{?projet} Grâce à vous, nous allons pouvoir nous offrir {projet}.{/projet}\n\nMerci d\'avoir fait de ce jour un souvenir encore plus beau.\n\nTendrement,\n{signature}'),
        m('mar-so1', 'sobre', '{appel}\n\nNous tenons à vous remercier très sincèrement pour {cadeaux}. Nous avons été très sensibles à votre attention pour {occasion}.{?projet} Votre participation nous aidera à nous offrir {projet}.{/projet}\n\nAvec nos remerciements renouvelés,\n{signature}'),
        m('mar-so2', 'sobre', '{appel}\n\nVotre attention pour {occasion} nous a beaucoup touchés. Merci pour {cadeaux}.{?projet} Votre générosité nous permettra de nous offrir {projet}.{/projet}\n\nNous vous prions de recevoir nos plus sincères remerciements.\n{signature}'),
        m('mar-br1', 'bref', '{appel}\n\nUn immense merci pour {cadeaux} ! Votre attention nous a fait très plaisir.\n\n{signature}'),
        m('mar-br2', 'bref', '{appel}\n\nMerci pour {cadeaux}, et pour votre affection en ce jour si important pour nous.\n\nÀ très bientôt,\n{signature}'),
        m('mar-le1', 'leger', '{appel}\n\nNous sommes mariés, c\'est officiel, et vous y êtes pour quelque chose ! Merci mille fois pour {cadeaux}.{?projet} Promis, nous penserons à vous en nous offrant {projet}.{/projet}\n\nLa prochaine fois, c\'est nous qui invitons.\n\n{signature}'),
        m('mar-le2', 'leger', '{appel}\n\nOn nous avait prévenus : le plus dur après un mariage, c\'est d\'écrire les remerciements. Pour vous, c\'est un vrai plaisir : merci pour {cadeaux} !{?projet} Grâce à vous, nous allons pouvoir nous offrir {projet}.{/projet}\n\nÀ charge de revanche,\n{signature}'),
      ],
      naissance: [
        m('nai-ch1', 'chaleureux', '{appel}\n\n{?concerne}{concerne} et nous vous remercions{/concerne}{!concerne}Nous vous remercions{/concerne} de tout cœur pour {cadeaux}. Votre attention pour {occasion} nous a beaucoup émus.{?projet} Votre générosité est mise de côté pour {projet}.{/projet}\n\nNous avons hâte que vous fassiez connaissance.\n\nAvec toute notre affection,\n{signature}'),
        m('nai-ch2', 'chaleureux', '{appel}\n\nMerci mille fois pour {cadeaux} ! Nos premières semaines {?concerne}avec {concerne} {/concerne}sont pleines de découvertes, et votre attention les rend encore plus douces.{?projet} Votre générosité est mise de côté pour {projet}.{/projet}\n\nÀ très bientôt pour un câlin,\n{signature}'),
        m('nai-so1', 'sobre', '{appel}\n\nNous vous remercions sincèrement pour {cadeaux}. Votre attention pour {occasion} nous a beaucoup touchés.{?projet} Votre participation sera utilisée pour {projet}.{/projet}\n\nBien affectueusement,\n{signature}'),
        m('nai-so2', 'sobre', '{appel}\n\nNous avons été très sensibles à votre attention pour {occasion}. Merci pour {cadeaux}.\n\nAvec nos remerciements chaleureux,\n{signature}'),
        m('nai-br1', 'bref', '{appel}\n\nMerci beaucoup pour {cadeaux} ! {?concerne}{concerne} vous embrasse.{/concerne}{!concerne}Bébé vous embrasse.{/concerne}\n\n{signature}'),
        m('nai-br2', 'bref', '{appel}\n\nUn grand merci pour {cadeaux}, et pour votre attention pour {occasion}.\n\nÀ bientôt,\n{signature}'),
        m('nai-le1', 'leger', '{appel}\n\n{?concerne}{concerne} n\'écrit pas encore très bien{/concerne}{!concerne}Notre bébé n\'écrit pas encore très bien{/concerne}, alors nous prenons la plume : merci pour {cadeaux} ! Vous êtes officiellement adoptés.{?projet} Votre générosité est mise de côté pour {projet}.{/projet}\n\nDes bisous (et quelques nuits courtes),\n{signature}'),
        m('nai-le2', 'leger', '{appel}\n\nEntre deux biberons et trois couches, nous tenions à vous dire un immense merci pour {cadeaux}. {?concerne}{concerne} a déjà validé !{/concerne}{!concerne}Bébé a déjà validé !{/concerne}\n\nÀ très vite,\n{signature}'),
      ],
      anniversaire: [
        m('ann-ch1', 'chaleureux', '{appel}\n\nMerci du fond du cœur pour {cadeaux}. Votre attention pour {occasion} m\'a fait chaud au cœur.{?projet} Votre générosité m\'aidera à m\'offrir {projet}.{/projet}\n\nC\'est une chance de vous avoir près de moi.\n\nAvec toute mon affection,\n{signature}'),
        m('ann-ch2', 'chaleureux', '{appel}\n\nQuel bonheur de fêter {occasion} avec des personnes comme vous ! Merci pour {cadeaux} : j\'y vois toute l\'attention que vous me portez.{?projet} Grâce à vous, je vais pouvoir m\'offrir {projet}.{/projet}\n\nÀ très bientôt,\n{signature}'),
        m('ann-so1', 'sobre', '{appel}\n\nJe tiens à vous remercier sincèrement pour {cadeaux}. J\'ai été très sensible à votre attention pour {occasion}.{?projet} Votre participation m\'aidera à m\'offrir {projet}.{/projet}\n\nBien amicalement,\n{signature}'),
        m('ann-so2', 'sobre', '{appel}\n\nVotre attention pour {occasion} me fait très plaisir. Merci pour {cadeaux}.\n\nAvec mes remerciements sincères,\n{signature}'),
        m('ann-br1', 'bref', '{appel}\n\nUn grand merci pour {cadeaux}, et merci d\'avoir pensé à moi.\n\n{signature}'),
        m('ann-br2', 'bref', '{appel}\n\nMerci pour {cadeaux}, quelle belle surprise !\n\nJe vous embrasse,\n{signature}'),
        m('ann-le1', 'leger', '{appel}\n\nOn dit qu\'à partir d\'un certain âge, on ne compte plus les années. Moi, je compte surtout les personnes qui y pensent : merci pour {cadeaux} !{?projet} Votre générosité m\'aidera à m\'offrir {projet}.{/projet}\n\nRendez-vous à la prochaine bougie,\n{signature}'),
        m('ann-le2', 'leger', '{appel}\n\nUne bougie de plus sur le gâteau, et un merci de plus à vous adresser : merci pour {cadeaux} ! La barre est haute pour l\'an prochain.\n\n{signature}'),
      ],
      retraite: [
        m('ret-ch1', 'chaleureux', '{appel}\n\nMerci du fond du cœur pour {cadeaux}. Tourner la page après toutes ces années n\'est pas simple, et votre attention pour {occasion} rend ce moment beaucoup plus doux.{?projet} Votre générosité m\'aidera à m\'offrir {projet}.{/projet}\n\nJe garde de nos années de travail de très beaux souvenirs.\n\nAvec toute mon amitié,\n{signature}'),
        m('ret-ch2', 'chaleureux', '{appel}\n\nMerci pour {cadeaux}, et pour tout ce que nous avons partagé. Je pars avec la tête pleine de bons moments passés avec vous.{?projet} Grâce à vous, je vais pouvoir m\'offrir {projet} pour bien commencer cette nouvelle vie.{/projet}\n\nÀ bientôt, autour d\'un café qui ne sera plus pris en vitesse,\n{signature}'),
        m('ret-so1', 'sobre', '{appel}\n\nJe tiens à vous remercier sincèrement pour {cadeaux}. Votre attention pour {occasion} me touche beaucoup.{?projet} Votre participation m\'aidera à m\'offrir {projet}.{/projet}\n\nJe vous souhaite une très bonne continuation.\n\nCordialement,\n{signature}'),
        m('ret-so2', 'sobre', '{appel}\n\nMerci pour {cadeaux}. Ce fut un plaisir de travailler à vos côtés, et votre attention pour {occasion} me touche sincèrement.\n\nBien cordialement,\n{signature}'),
        m('ret-br1', 'bref', '{appel}\n\nUn grand merci pour {cadeaux}, et pour ce beau moment de départ.\n\n{signature}'),
        m('ret-br2', 'bref', '{appel}\n\nMerci à vous pour {cadeaux} : j\'en garderai un très beau souvenir.\n\n{signature}'),
        m('ret-le1', 'leger', '{appel}\n\nOfficiellement, je n\'ai plus de réunion le lundi matin. Officieusement, il me reste un merci à vous dire : merci pour {cadeaux} !{?projet} Votre générosité m\'aidera à m\'offrir {projet}.{/projet}\n\nPassez me voir, j\'ai désormais tout mon temps,\n{signature}'),
        m('ret-le2', 'leger', '{appel}\n\nMon réveil est à la retraite lui aussi, mais pas ma reconnaissance : merci pour {cadeaux} ! Je vous laisse les dossiers, je garde les souvenirs.\n\n{signature}'),
      ],
      obseques: [
        m('obs-so1', 'sobre', '{appel}\n\nTrès sensibles aux marques de sympathie que vous nous avez témoignées{?concerne} lors du décès de {concerne}{/concerne}, nous vous adressons nos sincères remerciements pour {cadeaux}.\n\n{signature}'),
        m('obs-so2', 'sobre', '{appel}\n\nVotre soutien nous a été précieux. Nous vous remercions sincèrement pour {cadeaux}.\n\n{signature}'),
        m('obs-ch1', 'chaleureux', '{appel}\n\nNous avons été profondément touchés par votre soutien dans ces moments difficiles. Merci pour {cadeaux}.{?concerne} {concerne} aurait été sensible à votre attention.{/concerne}\n\nAvec notre reconnaissance émue,\n{signature}'),
        m('obs-ch2', 'chaleureux', '{appel}\n\nDans la peine qui est la nôtre, vos marques d\'affection nous ont apporté un grand réconfort. Merci pour {cadeaux}.{?concerne} Nous savons combien {concerne} comptait pour vous.{/concerne}\n\nAvec toute notre gratitude,\n{signature}'),
        m('obs-br1', 'bref', '{appel}\n\nMerci pour {cadeaux}. Votre soutien nous a beaucoup touchés.\n\n{signature}'),
        m('obs-br2', 'bref', '{appel}\n\nDe tout cœur, merci pour {cadeaux}, et pour vos pensées.\n\n{signature}'),
      ],
      autre: [
        m('aut-ch1', 'chaleureux', '{appel}\n\nMerci du fond du cœur pour {cadeaux}. Votre attention pour {occasion} nous a fait un immense plaisir.{?projet} Votre générosité nous aidera à nous offrir {projet}.{/projet}\n\nAvec toute notre affection,\n{signature}'),
        m('aut-ch2', 'chaleureux', '{appel}\n\nQuelle belle attention ! Merci pour {cadeaux}. Nous sommes heureux de partager ce moment avec vous.\n\nÀ très bientôt,\n{signature}'),
        m('aut-so1', 'sobre', '{appel}\n\nNous vous remercions sincèrement pour {cadeaux}. Nous avons été très sensibles à votre attention pour {occasion}.{?projet} Votre participation nous aidera à nous offrir {projet}.{/projet}\n\nBien cordialement,\n{signature}'),
        m('aut-so2', 'sobre', '{appel}\n\nVotre attention nous a beaucoup touchés. Merci pour {cadeaux}.\n\nAvec nos remerciements,\n{signature}'),
        m('aut-br1', 'bref', '{appel}\n\nUn grand merci pour {cadeaux} !\n\n{signature}'),
        m('aut-br2', 'bref', '{appel}\n\nMerci pour {cadeaux}, et pour votre attention, cela nous a fait très plaisir.\n\n{signature}'),
      ],
    },

    // Planches A4 (210 × 297 mm) : dimensions courantes. Marges et pas en millimètres.
    etiquettes: [
      { id: '3x8', nom: '24 par planche · 70 × 37 mm', colonnes: 3, lignes: 8, largeur: 70, hauteur: 37, haut: 0.5, gauche: 0, pasX: 70, pasY: 37 },
      { id: '3x7', nom: '21 par planche · 70 × 42,3 mm', colonnes: 3, lignes: 7, largeur: 70, hauteur: 42.3, haut: 0.45, gauche: 0, pasX: 70, pasY: 42.3 },
      { id: '2x7', nom: '14 par planche · 99,1 × 38,1 mm', colonnes: 2, lignes: 7, largeur: 99.1, hauteur: 38.1, haut: 15.15, gauche: 4.65, pasX: 101.6, pasY: 38.1 },
      { id: '2x8', nom: '16 par planche · 99,1 × 33,9 mm', colonnes: 2, lignes: 8, largeur: 99.1, hauteur: 33.9, haut: 12.9, gauche: 4.65, pasX: 101.6, pasY: 33.9 },
    ],

    conseils: [
      ['Note au fil de l\'eau', 'Un cadeau ouvert, une ligne : qui, quoi, et c\'est tout. Le montant et l\'adresse sont facultatifs.'],
      ['Un foyer, un merci', 'La tante et l\'oncle qui ont offert ensemble forment un seul foyer : une carte, qui remercie pour tous leurs cadeaux.'],
      ['Le message est prêt', 'Choisis un ton, le message se remplit avec les cadeaux du foyer. Tu le retouches, tu le copies sur la carte.'],
      ['Le compteur descend', '« Reste à remercier » baisse à chaque carte envoyée. Les étiquettes d\'adresses s\'impriment sur une planche A4.'],
    ],
  };
})();
