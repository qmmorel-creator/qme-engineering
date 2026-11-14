// Base intégrée du calendrier du potager : 60 légumes, aromatiques et petits fruits avec leur nom latin et leur
// famille botanique (connaissance botanique générale, noms de familles de la classification APG IV), types de
// parcelles, opérations, unités de récolte, couleurs fixes.
//
// AUCUNE période de semis, de plantation ou de récolte et AUCUNE association n'est fournie : faute d'une source
// publique dont la licence permette la réutilisation commerciale (recherche du 14/11/2026, voir
// docs/templates/fiches/potager.md), ces données sont saisies par le jardinier d'après ses sachets, ses livres ou
// son expérience. Aucune marque, aucune variété commerciale.
window.BASE = {
  version: '2026-11-14',

  // Familles botaniques (APG IV) ; `ancien` : nom courant encore très employé au jardin.
  familles: [
    { code: 'solanacees', nom: 'Solanacées', ancien: '' },
    { code: 'cucurbitacees', nom: 'Cucurbitacées', ancien: '' },
    { code: 'fabacees', nom: 'Fabacées', ancien: 'légumineuses' },
    { code: 'brassicacees', nom: 'Brassicacées', ancien: 'crucifères' },
    { code: 'apiacees', nom: 'Apiacées', ancien: 'ombellifères' },
    { code: 'amaryllidacees', nom: 'Amaryllidacées', ancien: 'alliacées' },
    { code: 'asteracees', nom: 'Astéracées', ancien: 'composées' },
    { code: 'amaranthacees', nom: 'Amaranthacées', ancien: 'chénopodiacées' },
    { code: 'caprifoliacees', nom: 'Caprifoliacées', ancien: 'valérianacées' },
    { code: 'poacees', nom: 'Poacées', ancien: 'graminées' },
    { code: 'lamiacees', nom: 'Lamiacées', ancien: 'labiées' },
    { code: 'polygonacees', nom: 'Polygonacées', ancien: '' },
    { code: 'rosacees', nom: 'Rosacées', ancien: '' },
    { code: 'aizoacees', nom: 'Aizoacées', ancien: '' },
    { code: 'portulacacees', nom: 'Portulacacées', ancien: '' },
    { code: 'convolvulacees', nom: 'Convolvulacées', ancien: '' },
  ],

  // 60 légumes : nom courant, nom latin, famille. Aucune période.
  legumes: [
    ['tomate', 'Tomate', 'Solanum lycopersicum', 'solanacees'],
    ['aubergine', 'Aubergine', 'Solanum melongena', 'solanacees'],
    ['poivron', 'Poivron', 'Capsicum annuum', 'solanacees'],
    ['piment', 'Piment', 'Capsicum annuum', 'solanacees'],
    ['pomme-de-terre', 'Pomme de terre', 'Solanum tuberosum', 'solanacees'],
    ['courgette', 'Courgette', 'Cucurbita pepo', 'cucurbitacees'],
    ['concombre', 'Concombre', 'Cucumis sativus', 'cucurbitacees'],
    ['cornichon', 'Cornichon', 'Cucumis sativus', 'cucurbitacees'],
    ['melon', 'Melon', 'Cucumis melo', 'cucurbitacees'],
    ['pasteque', 'Pastèque', 'Citrullus lanatus', 'cucurbitacees'],
    ['potiron', 'Potiron', 'Cucurbita maxima', 'cucurbitacees'],
    ['potimarron', 'Potimarron', 'Cucurbita maxima', 'cucurbitacees'],
    ['courge-musquee', 'Courge musquée', 'Cucurbita moschata', 'cucurbitacees'],
    ['haricot-nain', 'Haricot nain', 'Phaseolus vulgaris', 'fabacees'],
    ['haricot-rames', 'Haricot à rames', 'Phaseolus vulgaris', 'fabacees'],
    ['petit-pois', 'Petit pois', 'Pisum sativum', 'fabacees'],
    ['pois-mangetout', 'Pois mangetout', 'Pisum sativum', 'fabacees'],
    ['feve', 'Fève', 'Vicia faba', 'fabacees'],
    ['chou-pomme', 'Chou pommé', 'Brassica oleracea', 'brassicacees'],
    ['chou-fleur', 'Chou-fleur', 'Brassica oleracea', 'brassicacees'],
    ['brocoli', 'Brocoli', 'Brassica oleracea', 'brassicacees'],
    ['chou-bruxelles', 'Chou de Bruxelles', 'Brassica oleracea', 'brassicacees'],
    ['chou-kale', 'Chou kale', 'Brassica oleracea', 'brassicacees'],
    ['chou-rave', 'Chou-rave', 'Brassica oleracea', 'brassicacees'],
    ['chou-chinois', 'Chou chinois', 'Brassica rapa', 'brassicacees'],
    ['navet', 'Navet', 'Brassica rapa', 'brassicacees'],
    ['radis', 'Radis', 'Raphanus sativus', 'brassicacees'],
    ['roquette', 'Roquette', 'Eruca vesicaria', 'brassicacees'],
    ['carotte', 'Carotte', 'Daucus carota', 'apiacees'],
    ['panais', 'Panais', 'Pastinaca sativa', 'apiacees'],
    ['celeri-branche', 'Céleri-branche', 'Apium graveolens', 'apiacees'],
    ['celeri-rave', 'Céleri-rave', 'Apium graveolens', 'apiacees'],
    ['fenouil', 'Fenouil', 'Foeniculum vulgare', 'apiacees'],
    ['persil', 'Persil', 'Petroselinum crispum', 'apiacees'],
    ['coriandre', 'Coriandre', 'Coriandrum sativum', 'apiacees'],
    ['aneth', 'Aneth', 'Anethum graveolens', 'apiacees'],
    ['ail', 'Ail', 'Allium sativum', 'amaryllidacees'],
    ['oignon', 'Oignon', 'Allium cepa', 'amaryllidacees'],
    ['echalote', 'Échalote', 'Allium cepa', 'amaryllidacees'],
    ['poireau', 'Poireau', 'Allium porrum', 'amaryllidacees'],
    ['ciboulette', 'Ciboulette', 'Allium schoenoprasum', 'amaryllidacees'],
    ['laitue', 'Laitue', 'Lactuca sativa', 'asteracees'],
    ['chicoree-frisee', 'Chicorée frisée', 'Cichorium endivia', 'asteracees'],
    ['scarole', 'Scarole', 'Cichorium endivia', 'asteracees'],
    ['endive', 'Endive', 'Cichorium intybus', 'asteracees'],
    ['artichaut', 'Artichaut', 'Cynara cardunculus', 'asteracees'],
    ['salsifis', 'Salsifis', 'Tragopogon porrifolius', 'asteracees'],
    ['topinambour', 'Topinambour', 'Helianthus tuberosus', 'asteracees'],
    ['betterave', 'Betterave', 'Beta vulgaris', 'amaranthacees'],
    ['blette', 'Blette', 'Beta vulgaris', 'amaranthacees'],
    ['epinard', 'Épinard', 'Spinacia oleracea', 'amaranthacees'],
    ['mache', 'Mâche', 'Valerianella locusta', 'caprifoliacees'],
    ['mais-doux', 'Maïs doux', 'Zea mays', 'poacees'],
    ['basilic', 'Basilic', 'Ocimum basilicum', 'lamiacees'],
    ['rhubarbe', 'Rhubarbe', 'Rheum rhabarbarum', 'polygonacees'],
    ['oseille', 'Oseille', 'Rumex acetosa', 'polygonacees'],
    ['fraisier', 'Fraisier', 'Fragaria × ananassa', 'rosacees'],
    ['tetragone', 'Tétragone', 'Tetragonia tetragonoides', 'aizoacees'],
    ['pourpier', 'Pourpier', 'Portulaca oleracea', 'portulacacees'],
    ['patate-douce', 'Patate douce', 'Ipomoea batatas', 'convolvulacees'],
  ],

  // Types de parcelles.
  typesParcelle: { planche: 'Planche', carre: 'Carré potager', serre: 'Serre, tunnel', bac: 'Bac, pot', autre: 'Autre' },

  // Opérations du calendrier (fenêtres saisies par culture), dans l'ordre de la frise. `journal` : type d'entrée du
  // journal qui la marque comme faite (null : jamais « faite », la récolte s'étale).
  operations: [
    { code: 'semisAbri', nom: 'Semis sous abri', court: 'Semis abri', verbe: 'semer sous abri', journal: 'semis', lieu: 'abri', couleur: '#E8B93A', motif: 'points' },
    { code: 'semisPleine', nom: 'Semis en pleine terre', court: 'Semis', verbe: 'semer en pleine terre', journal: 'semis', lieu: 'pleine', couleur: '#B84A34', motif: 'plein' },
    { code: 'plantation', nom: 'Plantation, repiquage', court: 'Plantation', verbe: 'planter ou repiquer', journal: 'plantation', lieu: '', couleur: '#2E7D4F', motif: 'rayures' },
    { code: 'recolte', nom: 'Récolte', court: 'Récolte', verbe: 'récolter', journal: null, lieu: '', couleur: '#2E5A88', motif: 'plein' },
  ],

  // Types d'entrées du journal.
  typesJournal: [
    ['semis', 'Semis'], ['levee', 'Levée'], ['repiquage', 'Repiquage'], ['plantation', 'Plantation'], ['recolte', 'Récolte'], ['note', 'Note'],
  ],
  lieuxSemis: [['abri', 'Sous abri'], ['pleine', 'En pleine terre']],

  // Unités de récolte : g et kg sont additionnés en kg ; les autres sont comptées à part.
  unites: [['kg', 'kg'], ['g', 'g'], ['piece', 'pièce'], ['botte', 'botte'], ['litre', 'litre']],

  // Couleurs fixes des familles (fond, bord, texte), dans l'ordre de `familles`.
  couleurs: [
    { fond: '#F8DCD3', bord: '#B84A34', texte: '#8A3322' },
    { fond: '#FBEBC2', bord: '#B8901F', texte: '#6E5310' },
    { fond: '#DCEBDD', bord: '#2E7D4F', texte: '#1F5A36' },
    { fond: '#D8E4F0', bord: '#2E5A88', texte: '#22476E' },
    { fond: '#F6E0EC', bord: '#A04A78', texte: '#7A2F58' },
    { fond: '#E6DDF0', bord: '#6A4C93', texte: '#4A3270' },
    { fond: '#D5ECEC', bord: '#2F7A7A', texte: '#1F5656' },
    { fond: '#F3EDE3', bord: '#6E685F', texte: '#45413A' },
  ],

  conseils: [
    ['Tes dates, pas celles d\'un autre', 'Recopie les périodes de tes sachets de graines ou de ton carnet : semis sous abri, semis en pleine terre, plantation, récolte.'],
    ['Un décalage pour ta région', 'Si tes dates arrivent plus tôt ou plus tard que celles des sachets, règle un décalage en semaines : tout le calendrier suit.'],
    ['Note ce que tu fais', 'Un semis, une levée, une récolte avec sa quantité : le journal coche ce qui est fait et prépare le bilan de fin de saison.'],
    ['Change de place chaque année', 'Place tes cultures sur tes planches : l\'outil te signale une même famille au même endroit l\'an dernier.'],
  ],
};
