export type GuideSection = {
  id: string;
  /** Sub-group label within the navTab (e.g. "Équipage" inside "Événements") */
  label: string;
  /** Top-level nav tab this section belongs to */
  navTab: string;
  title: string;
  parent?: string;
  blocks: any[];
  /** Only shown to admins — filtered out for regular users */
  adminOnly?: boolean;
  /** Hidden for admins — shown only to regular users */
  hideForAdmins?: boolean;
};

export const guide: GuideSection[] = [
  // ─── Accueil ──────────────────────────────────────────────────────────────
  {
    id: "accueil",
    navTab: "Accueil",
    label: "Accueil",
    title: "Tableau de bord",
    hideForAdmins: true,
    blocks: [
      {
        type: "component-demo",
        componentType: "accueil",
        config: {},
      },
      {
        type: "text",
        content: "La page d'accueil te donne une vue d'ensemble de ta prochaine course :",
      },
      {
        type: "list",
        items: [
          "Prochain événement — Card avec nom, circuit, format, durée, horaire et compte à rebours.",
          "Mon prochain relais — Relais que tu vas piloter, avec équipage, numéro et heure de départ.",
          "Mes événements à venir — Liste de toutes tes inscriptions avec voiture et équipe assignées.",
        ],
      },
    ],
  },
  {
    id: "accueil-admin",
    navTab: "Accueil",
    label: "Accueil",
    title: "Tableau de bord",
    adminOnly: true,
    blocks: [
      {
        type: "component-demo",
        componentType: "admin-accueil",
      },
      {
        type: "text",
        content: "En tant qu'admin, le tableau de bord affiche des éléments supplémentaires :",
      },
      {
        type: "list",
        items: [
          "Bannière ⚠️ — Apparaît si des pilotes sont en attente d'approbation, avec lien direct vers la gestion des accès.",
          "Actions rapides — Boutons + Ajouter un pilote, + Créer un événement, + Créer un championnat en plus des actions standard.",
          "Grille de statistiques — Compteurs en temps réel : Événements, Pilotes actifs, Pilotes inactifs, Pilotes test, En attente, Cotisations expirées, Syncs iRacing. Les cases en rouge ou orange sont cliquables et mènent directement à la section concernée.",
          "Onglet Suivi — Visible uniquement pour les admins, avec un badge rouge indiquant le nombre total d'éléments à traiter. Trois sous-onglets organisent les alertes.",
        ],
      },
      {
        type: "divider",
        content: "Sans pilotes",
      },
      {
        type: "text",
        content: "Équipages inscrits à un événement mais sans aucun pilote signé. Cliquer sur une carte ouvre directement la page de l'équipage.",
      },
      {
        type: "component-demo",
        componentType: "admin-suivi-sans-pilotes",
      },
      {
        type: "divider",
        content: "Sans relais",
      },
      {
        type: "text",
        content: "Équipages avec des pilotes inscrits mais dont la stratégie active ne contient aucun relais assigné. Cliquer sur une carte ouvre la page de l'équipage.",
      },
      {
        type: "component-demo",
        componentType: "admin-suivi-sans-relais",
      },
      {
        type: "divider",
        content: "Sans équipage",
      },
      {
        type: "text",
        content: "Pilotes inscrits à un événement mais non assignés à un équipage. Cliquer sur une carte ouvre la page de l'événement pour procéder à l'assignation.",
      },
      {
        type: "component-demo",
        componentType: "admin-suivi-sans-equipage",
      },
    ],
  },

  // ─── Pilotes ──────────────────────────────────────────────────────────────
  {
    id: "pilotes",
    navTab: "Pilotes",
    label: "Pilotes",
    title: "Liste des pilotes",
    blocks: [
      {
        type: "component-demo",
        componentType: "pilots",
        config: {},
      },
      {
        type: "text",
        content: "Liste de tous les pilotes de l'équipe avec leur iRating actuel et informations de contact.",
      },
      {
        type: "list",
        items: [
          "Colonnes — Nom, iRacing ID (lien cliquable), iRating, Discord, Twitch, Instagram, Rôle.",
          "Badge ⚠️ — Affiché si la dernière synchronisation iRacing date de plus de 100 jours.",
          "Clique sur un pilote pour voir son profil détaillé.",
        ],
      },
    ],
  },

  {
    id: "profil",
    navTab: "Pilotes",
    label: "Pilotes",
    title: "Profil pilote",
    parent: "pilotes",
    blocks: [
      {
        type: "text",
        content: "Page personnelle du pilote. Deux onglets :",
      },
      {
        type: "header",
        content: "Engagements",
      },
      {
        type: "component-demo",
        componentType: "profil",
        config: { activeTab: "engagements" },
      },
      {
        type: "text",
        content: "Historique de toutes les inscriptions du pilote, groupées par événement — équipage assigné, relais attribués, taux de remplissage des disponibilités.",
      },
      { type: "divider", content: "" },
      {
        type: "header",
        content: "Statistiques — Endurance Manager",
      },
      {
        type: "component-demo",
        componentType: "profil",
        config: { activeTab: "statistiques", statsSubTab: "app" },
      },
      {
        type: "text",
        content: "Stats issues des courses gérées dans l'app : iRating, historique par catégorie, relais, conditions, chronos et consommations par circuit.",
      },
      { type: "divider", content: "" },
      {
        type: "header",
        content: "Statistiques — Garage61",
      },
      {
        type: "component-demo",
        componentType: "profil",
        config: { activeTab: "statistiques", statsSubTab: "garage61" },
      },
      {
        type: "text",
        content: "Vue de toutes les sessions d'entraînement enregistrées sur Garage61. Circuits groupés par catégorie (Road, Oval, Dirt Road, Dirt Oval), triables par tours / % propres / temps piste / nom. Clique sur un circuit pour voir le meilleur tour enregistré (chrono, voiture, type de session, date) avec un lien direct vers Garage61.",
      },
      {
        type: "header",
        content: "Informations",
      },
      {
        type: "list",
        items: [
          "Infos de base — Nom, email, iRacing ID (lien cliquable), Discord, Alerte relais (délai par défaut si activé), Twitch, Instagram, Garage61 (lien vers le profil public).",
          "Badge ⚠️ — Synchronisation iRacing en retard (>100 jours).",
        ],
      },
      {
        type: "callout",
        variant: "tip",
        content: "Le bouton « Inventaire » (visible par le pilote et les admins) affiche les voitures et circuits iRacing possédés. La synchro se relance depuis ce même profil — elle met à jour l'inventaire et l'iRating.",
      },
      {
        type: "header",
        content: "Connexions tierces",
      },
      {
        type: "list",
        items: [
          "🔗 Lier Garage61 — Connecte ton compte Garage61 via OAuth. Une fois lié : le profil affiche un lien vers ton profil Garage61, l'onglet Statistiques débloque le sous-onglet Garage61 (entraînements), et tes chronos peuvent être importés dans l'onglet Performances de ton équipage.",
          "🔗 Lier iRacing — Connecte ton compte iRacing pour synchroniser l'inventaire et l'iRating.",
        ],
      },
      {
        type: "callout",
        variant: "note",
        content: "En liant ton compte Garage61, tu autorises les membres de ton équipe à consulter tes stats d'entraînement et à importer tes chronos (utile si un ingénieur renseigne les données de performance).",
      },
      { type: "divider", content: "" },
      {
        type: "header",
        content: "Notifications Discord",
      },
      {
        type: "text",
        content: "Depuis la page de modification de ton profil, tu peux configurer un délai d'alerte Discord par défaut : le bot t'alertera X minutes avant la fin de chacun de tes relais.",
      },
      {
        type: "list",
        items: [
          "Activer / désactiver — La case à cocher active ou désactive les alertes globalement.",
          "Délai par défaut — Nombre de minutes avant la fin du relais (ex : 5 min).",
          "Override par événement — Dans l'onglet Disponibilités de ton équipage, tu peux configurer un délai différent pour un événement spécifique, sans toucher au réglage global.",
        ],
      },
    ],
  },

  // ─── Événements ───────────────────────────────────────────────────────────
  {
    id: "evenements",
    navTab: "Événements",
    label: "Événements",
    title: "Événements",
    blocks: [
      {
        type: "component-demo",
        componentType: "evenements",
        config: {},
      },
      {
        type: "text",
        content: "Toutes les courses sont listées ici. L'onglet « Tous » est affiché par défaut et regroupe tous les types, triés chronologiquement.",
      },
      {
        type: "list",
        items: [
          "Tous — Vue chronologique de l'ensemble des événements. Des badges colorés identifient le type : Spécial (orange) ou Championnat (violet).",
          "Normaux — Courses standards avec horaires éditables.",
          "Spéciaux — Courses avec créneaux horaires fixes.",
          "Championnats — Séries avec plusieurs manches. Chaque manche est une course appartenant à ce championnat.",
        ],
      },
      {
        type: "text",
        content: "Clique sur une course pour voir les détails, t'inscrire, ou gérer l'équipage.",
      },
    ],
  },

  {
    id: "inscription",
    navTab: "Événements",
    label: "Événements",
    title: "S'inscrire à une course",
    parent: "evenements",
    blocks: [
      {
        type: "component-demo",
        componentType: "inscription-form",
        config: {},
      },
      {
        type: "text",
        content: "Accessible via le bouton « + S'inscrire » sur la page d'un événement. Tous les champs sont optionnels sauf le pilote :",
      },
      {
        type: "list",
        items: [
          "Créneaux de départ préférés — Indique sur quelles vagues tu es disponible.",
          "Équipe — Exprime une préférence pour un équipage existant. Laisse « Pas de préférence » si tu es flexible.",
          "Classes et voitures — Filtres de préférence utilisés pour détecter les incompatibilités.",
          "Tags — Décris ton profil de pilote (ex : chill, compet, solo, gros rouleur).",
        ],
      },
      {
        type: "text",
        content: "Si tu sélectionnes un équipage, le formulaire affiche des alertes de compatibilité :",
      },
      {
        type: "states",
        items: [
          { variant: "hard", label: "Hard", description: "Incompatibilité de classe entre ta préférence et la voiture de l'équipage." },
          { variant: "soft", label: "Soft", description: "Incompatibilité de voiture dans une classe compatible." },
        ],
      },
      {
        type: "callout",
        variant: "note",
        content: "Tu peux t'inscrire à plusieurs équipages au sein d'une même course. C'est utile si plusieurs teams cherchent des drivers pour le même événement.",
      },
    ],
  },

  {
    id: "creation-equipage",
    navTab: "Événements",
    label: "Événements",
    title: "Ajouter un équipage",
    parent: "evenements",
    blocks: [
      {
        type: "component-demo",
        componentType: "equipages-list",
        config: { showCreate: true },
      },
      {
        type: "component-demo",
        componentType: "new-equipage",
        config: {},
      },
      {
        type: "text",
        content: "Accessible via le bouton « + Ajouter un équipage » dans l'onglet Équipages (non disponible pour les pilotes externes et les ingénieurs). Champs à remplir :",
      },
      {
        type: "list",
        items: [
          "Nom d'équipage — Dropdown issu du catalogue Kronos (ex : Kronos Alpha).",
          "Voiture — Dropdown des voitures du catalogue, filtrées par format d'événement. La classe et la taille du réservoir sont déduites automatiquement.",
          "Numéro de course — Pour les championnats uniquement.",
          "Horaire de départ — Sélection parmi les créneaux configurés pour cet événement.",
          "Pilotes — Sélection parmi les pilotes inscrits à l'événement sans équipage. Les conflits de préférences (classe, voiture, horaire) sont signalés par un badge ⚠️. Les disponibilités sont pré-initialisées à « indisponible » pour chaque pilote ajouté.",
          "Streams Twitch — Chaînes associées à cet équipage pour le suivi en direct.",
          "BOP — Ajustements de puissance (%), poids (kg) et taille de réservoir (%) imposés par l'organisateur.",
          "Ravitaillement & pneus — Durée des arrêts en secondes.",
        ],
      },
    ],
  },

  // ─── Détail événement tabs ────────────────────────────────────────────────
  {
    id: "evenement-inscriptions",
    navTab: "Événements",
    label: "Détail événement",
    title: "Inscriptions",
    parent: "evenements",
    blocks: [
      {
        type: "component-demo",
        componentType: "event-detail-tabs",
        config: { activeTab: "inscriptions" },
      },
      {
        type: "component-demo",
        componentType: "inscriptions",
        config: {},
      },
      {
        type: "text",
        content: "Liste de tous les pilotes inscrits à cet événement. Un pilote peut apparaître plusieurs fois s'il est dans plusieurs équipages ou a choisi plusieurs créneaux de départ.",
      },
      {
        type: "list",
        items: [
          "Pilote + iRating — Identité et niveau du pilote.",
          "Équipe — L'équipage auquel le pilote est affecté (pill colorée).",
          "Préférences — Classe et voitures souhaitées lors de l'inscription.",
          "Créneaux — Horaires de départ préférés.",
          "Tags — Profil de pilote choisi lors de l'inscription (ex : chill, compet, solo, gros rouleur).",
        ],
      },
      {
        type: "text",
        content: "Tri — Clique sur un en-tête de colonne pour trier. Pilote et iRating conservent les inscriptions d'un même pilote groupées. Équipe et Créneaux éclatent les lignes pour respecter l'ordre de tri, avec un en-tête de groupe pour chaque nouvelle valeur.",
      },
      {
        type: "text",
        content: "Pilotes dupliqués — Quand un pilote apparaît plusieurs fois (plusieurs équipes ou plusieurs créneaux), ses lignes sont marquées d'une barre colorée à gauche et d'un badge indiquant le nombre d'occurrences (ex : « 2 équipages »). Chaque couleur est propre à un pilote. En tri par iRating, un séparateur 🌭 Merguez marque le seuil des 3 000 iRating.",
      },
      {
        type: "text",
        content: "Filtres — La barre de filtres au-dessus du tableau permet de restreindre la liste :",
      },
      {
        type: "list",
        items: [
          "Sans équipe — Affiche uniquement les pilotes sans équipage assigné.",
          "iRating min / max — Filtre par niveau de pilote.",
          "Catégories / Voitures — Clique sur un label de catégorie (GT3, GTP…) pour sélectionner toutes ses voitures d'un coup. Tu peux aussi sélectionner des voitures individuellement. Si une catégorie n'a aucune voiture préférée (ex : LMP2), son label filtre directement par classe déclarée.",
          "× Réinitialiser — Efface tous les filtres actifs (apparaît dès qu'un filtre est actif).",
        ],
      },
    ],
  },

  {
    id: "evenement-equipages",
    navTab: "Événements",
    label: "Détail événement",
    title: "Équipages",
    parent: "evenements",
    blocks: [
      {
        type: "component-demo",
        componentType: "event-detail-tabs",
        config: { activeTab: "equipages" },
      },
      {
        type: "component-demo",
        componentType: "equipages-list",
        config: {},
      },
      {
        type: "text",
        content: "Vue d'ensemble de tous les équipages engagés pour cet événement. Clique sur un équipage pour accéder à sa page de gestion (disponibilités, relais, planning, course).",
      },
      {
        type: "list",
        items: [
          "Équipage — Nom de l'équipe avec pill colorée.",
          "Voiture / Classe — Voiture engagée et catégorie.",
          "Pilotes — Noms des pilotes affectés à cet équipage.",
          "SoF — Strength of Field estimé (moyenne iRating de l'équipage).",
          "Départ IRL — Horaire de départ réel.",
          "Stream — Lien Twitch si renseigné sur le profil d'un des pilotes.",
          "# — Numéro de voiture (championnats uniquement).",
        ],
      },
    ],
  },

  {
    id: "evenement-horaires",
    navTab: "Événements",
    label: "Détail événement",
    title: "Horaires de départ",
    parent: "evenements",
    blocks: [
      {
        type: "component-demo",
        componentType: "event-detail-tabs",
        config: { activeTab: "horaires" },
      },
      {
        type: "component-demo",
        componentType: "horaires",
        config: {},
      },
      {
        type: "text",
        content: "Gestion des créneaux de départ disponibles pour cet événement. Chaque créneau affiche un label auto-généré (ex : « Samedi 23 avril 2026 ») et l'heure IRL de départ.",
      },
      {
        type: "callout",
        variant: "note",
        content: "Les créneaux sont créés par les admins. Les pilotes choisissent leurs préférences parmi ces créneaux lors de l'inscription.",
      },
    ],
  },

  {
    id: "evenement-inventaire",
    navTab: "Événements",
    label: "Détail événement",
    title: "Inventaire",
    parent: "evenements",
    blocks: [
      {
        type: "component-demo",
        componentType: "event-detail-tabs",
        config: { activeTab: "inventaire" },
      },
      {
        type: "component-demo",
        componentType: "inventory",
        config: {},
      },
      {
        type: "text",
        content: "Vue matricielle filtrée sur les voitures pertinentes pour cet événement : quels pilotes inscrits possèdent chaque voiture dans leur compte iRacing.",
      },
      {
        type: "list",
        items: [
          "Lignes — Voitures disponibles pour cet événement, groupées par classe.",
          "Colonnes — Pilotes inscrits à l'événement.",
          "✓ — Le pilote possède cette voiture dans son compte iRacing.",
          "Badge K — Voiture configurée dans le catalogue Kronos pour les événements.",
          "Badge iR+ — Contenu gratuit avec abonnement iRacing.",
          "Ta colonne est mise en surbrillance pour repérer rapidement tes contenus.",
        ],
      },
      {
        type: "callout",
        variant: "tip",
        content: "Utile avant de constituer les équipages : tu vois d'un coup d'œil qui possède quelle voiture parmi les inscrits.",
      },
    ],
  },

  // ─── Équipage tabs ────────────────────────────────────────────────────────
  {
    id: "onglet-pilotes",
    navTab: "Événements",
    label: "Équipage",
    title: "1. Pilotes",
    parent: "evenements",
    blocks: [
      {
        type: "component-demo",
        componentType: "tabs",
        config: { activeTab: "Pilotes" },
      },
      {
        type: "component-demo",
        componentType: "pilots",
        config: {},
      },
      {
        type: "text",
        content: "Liste des pilotes assignés à cet équipage. Des badges de compatibilité signalent les écarts entre préférences d'inscription et l'équipage :",
      },
      {
        type: "states",
        items: [
          { variant: "hard", label: "Hard", description: "Incompatibilité de classe entre la préférence du pilote et la voiture de l'équipage." },
          { variant: "soft", label: "Soft", description: "Incompatibilité de voiture ou de créneau horaire dans une classe compatible." },
        ],
      },
      {
        type: "header",
        content: "Rejoindre ou ajouter un pilote",
      },
      {
        type: "text",
        content: "Sous le tableau des pilotes assignés, une section « Pilotes inscrits sans équipe » liste les pilotes inscrits à l'événement mais pas encore affectés à cet équipage :",
      },
      {
        type: "list",
        items: [
          "Pilote inscrit — Clique sur ton propre nom pour rejoindre l'équipage (si tu es inscrit à l'événement mais pas encore assigné).",
          "Admin — Peut cliquer sur n'importe quel pilote de la liste pour l'assigner à l'équipage.",
          "Un modal propose ensuite de synchroniser les préférences de créneau horaire du pilote avec celui de l'équipage.",
        ],
      },
    ],
  },

  {
    id: "onglet-disponibilites",
    navTab: "Événements",
    label: "Équipage",
    title: "2. Disponibilités",
    parent: "evenements",
    blocks: [
      {
        type: "component-demo",
        componentType: "tabs",
        config: { activeTab: "Disponibilités" },
      },
      {
        type: "component-demo",
        componentType: "availability",
        config: {},
      },
      {
        type: "text",
        content: "Grille de disponibilité : chaque ligne est un créneau de 30 minutes (heure IRL, heure IG, phase jour/nuit), chaque colonne un pilote. Trois états possibles :",
      },
      {
        type: "states",
        items: [
          { label: "Disponible", variant: "yes" },
          { label: "Indisponible", variant: "no" },
          { label: "Incertain", variant: "neutral" },
        ],
      },
      {
        type: "callout",
        variant: "tip",
        content: "Sur mobile : appuie et glisse pour remplir rapidement plusieurs cases. Sur desktop : clique ou clique-glisse pour basculer l'état de plusieurs cases d'un coup.",
      },
      {
        type: "callout",
        variant: "note",
        content: "Une fois ton nom sélectionné, une carte « Alerte relais Discord » apparaît. Elle affiche ton délai par défaut et te permet de le remplacer pour cet événement uniquement — sans modifier ton réglage global.",
      },
      {
        type: "callout",
        variant: "tip",
        content: "Les disponibilités sont mises à jour en temps réel — les cases cochées par les autres pilotes apparaissent instantanément sans recharger la page.",
      },
    ],
  },

  {
    id: "onglet-relais",
    navTab: "Événements",
    label: "Équipage",
    title: "3. Relais",
    parent: "evenements",
    blocks: [
      {
        type: "component-demo",
        componentType: "tabs",
        config: { activeTab: "Relais" },
      },
      {
        type: "component-demo",
        componentType: "stint-grid",
        config: {},
      },
      {
        type: "text",
        content: "Le cœur du système : planification des relais (stints), calcul automatique des durées et carburants, gestion des stratégies, détection des conflits.",
      },
      {
        type: "header",
        content: "Stratégies",
      },
      {
        type: "text",
        content: "Tu peux créer jusqu'à 5 stratégies différentes (ex : « Plan A sec », « Plan B pluie »). Chaque stratégie a :",
      },
      {
        type: "list",
        items: [
          "Nom + Description — Éditables au-dessus du tableau.",
          "Décalage départ (minutes) — Offset pour compenser formation lap ou autres délais.",
          "★ Statut actif — Une seule stratégie est active (celle que Race Mode utilise).",
        ],
      },
      {
        type: "header",
        content: "Tableau de relais",
      },
      {
        type: "text",
        content: "Colonnes principales :",
      },
      {
        type: "list",
        items: [
          "# — Numéro du relais (séquentiel).",
          "Pilote — Dropdown pour assigner un pilote ou laisser « À définir ».",
          "Départ IRL / Fin IRL — Temps réels calculés automatiquement depuis l'heure de départ + durées cumulées.",
          "Fin réelle — Remplie automatiquement par Race Mode lors d'un pit stop, ou saisissable manuellement directement dans la cellule.",
          "Durée — Calculée depuis Tours × chrono + temps de ravitaillement, ou saisie manuelle.",
          "Tours — Nombre de tours planifiés (manuel ou calculé depuis une durée cible).",
          "Conso — Carburant estimé. Badge rouge si tu dépasses la capacité du réservoir.",
          "Skip fin — Consommation cible pour passer le dernier pit (visible quand la course est entièrement couverte).",
          "Pluie / Chgt pneus — Cases à cocher qui orientent les calculs de chrono et de temps d'arrêt.",
        ],
      },
      {
        type: "text",
        content: "Les valeurs estimées (chrono, conso) affichent des marqueurs de fiabilité selon la source :",
      },
      {
        type: "list",
        items: [
          "Sans marqueur — Donnée spécifique au pilote et à la condition.",
          "* — Estimée via modificateur d'équipage (ex : nuit = sec + offset nuit).",
          "~ — Modificateur à zéro, estimation conservatrice.",
          "† — Moyenne équipe, aucune donnée pilote disponible.",
        ],
      },
      {
        type: "callout",
        variant: "tip",
        content: "Glisse-dépose les lignes du tableau pour réordonner les relais. Seuls les relais non encore démarrés peuvent être bougés.",
      },
      {
        type: "callout",
        variant: "note",
        content: "Le bouton Recalculer force un recalcul complet des temps IRL et des estimations. À utiliser si tu changes la stratégie ou les données de performances après coup.",
      },
      {
        type: "header",
        content: "Gantt intégré",
      },
      {
        type: "text",
        content: "Quand la case « Dispo » est cochée, un diagramme de Gantt s'affiche au-dessus du Fair Share. Il représente la stratégie actuellement sélectionnée (pas nécessairement la stratégie active) et se met à jour en temps réel.",
      },
      {
        type: "header",
        content: "Fair Share",
      },
      {
        type: "text",
        content: "Indicateurs visuels montrant si chaque pilote a au minimum 25% de la « part égale » de tours. Vert = OK, rouge = déséquilibre. Utile pour équilibrer la charge.",
      },
      {
        type: "callout",
        variant: "warn",
        content: "Important : Les temps IRL sont calculés quand tu ouvres cet onglet. Ils sont enregistrés en base et utilisés par Planning + Course. S'ils manquent, c'est que le calcul n'a pas eu lieu — simplement ré-ouvrir cet onglet les génère.",
      },
      {
        type: "callout",
        variant: "tip",
        content: "Le tableau est mis à jour en temps réel — les modifications d'un autre utilisateur (assignation pilote, tours, pluie) apparaissent instantanément.",
      },
    ],
  },

  {
    id: "onglet-planning",
    navTab: "Événements",
    label: "Équipage",
    title: "4. Planning",
    parent: "evenements",
    blocks: [
      {
        type: "component-demo",
        componentType: "tabs",
        config: { activeTab: "Planning" },
      },
      {
        type: "component-demo",
        componentType: "planning",
        config: {},
      },
      {
        type: "text",
        content: "Diagramme de Gantt visualisant la stratégie active. Le nom de la stratégie est affiché centré au-dessus du diagramme. Une ligne par pilote, bandes de relais colorées, avec fond de disponibilité et bande nuit IG.",
      },
      {
        type: "header",
        content: "Lecture du diagramme",
      },
      {
        type: "list",
        items: [
          "Axe horizontal — Temps réel (heures marquées en haut).",
          "Lignes — Un pilote par ligne (label à gauche).",
          "Bandes colorées — Relais assignés (couleur par pilote).",
          "Bandes grises pointillées — Relais non assignés.",
          "Fond vert/rouge/gris — Disponibilité du pilote à ce moment-là.",
          "Fond foncé — Nuit IG (ig_sunset → ig_sunrise).",
          "🏁 + ligne rouge — Fin de course (heure réelle de fin d'épreuve).",
        ],
      },
      {
        type: "header",
        content: "Interactivité",
      },
      {
        type: "text",
        content: "Survolez une bande de relais pour afficher ses détails dans un panneau ci-dessous (numéro, horaires, durée, tours, badge de complétion).",
      },
      {
        type: "callout",
        variant: "tip",
        content: "Le Planning est mis à jour en temps réel — les modifications de relais et les changements de stratégie active apparaissent instantanément pour tous les utilisateurs sur la page.",
      },
    ],
  },

  {
    id: "onglet-performances",
    navTab: "Événements",
    label: "Équipage",
    title: "5. Performances",
    parent: "evenements",
    blocks: [
      {
        type: "component-demo",
        componentType: "tabs",
        config: { activeTab: "Performances" },
      },
      {
        type: "component-demo",
        componentType: "performances",
        config: {},
      },
      {
        type: "text",
        content: "Tableau des données de performance : chronométrages et consommations par pilote, par condition (jour sec, pluie, nuit). Ces données alimentent les calculs de tours et carburant du tab Relais.",
      },
      {
        type: "header",
        content: "Structure jour et nuit",
      },
      {
        type: "text",
        content: "Chaque pilote a deux lignes : jour (données sec/pluie) et 🌙 nuit (optionnelle). Les colonnes couvrent quatre conditions : sec jour, pluie jour, sec nuit, pluie nuit — avec chrono et conso pour chacune.",
      },
      {
        type: "text",
        content: "Quand une valeur ne vient pas de données directes, elle est estimée par cascade de fallbacks :",
      },
      {
        type: "list",
        items: [
          "Sans marqueur — Donnée saisie directement pour cette condition.",
          "* — Estimée en ajoutant un modificateur d'équipage à une condition proche.",
          "~ — Modificateur à zéro (données identiques à la condition source).",
          "† — Moyenne de toute l'équipe, aucune donnée pilote disponible.",
        ],
      },
      {
        type: "header",
        content: "Modificateurs d'équipage",
      },
      {
        type: "text",
        content: "Trois champs éditables au-dessus du tableau (enregistrés automatiquement) :",
      },
      {
        type: "list",
        items: [
          "💧 Pluie jour — Secondes à ajouter au chrono sec pour estimer la pluie jour.",
          "🌙☀️ Nuit sec — Offset pour estimer nuit sec si le pilote n'a pas de données nuit.",
          "🌙💧 Nuit pluie — Offset pour nuit + pluie.",
        ],
      },
      {
        type: "header",
        content: "Remplir tes données",
      },
      {
        type: "text",
        content: "Clique « Modifier » à la fin de ta ligne. Format chrono : M:SS.mmm (ex : 1:52.345). Conso en L/tour. La date de dernière saisie est affichée par ligne. Ces données sont critiques — elles alimentent tous les calculs de stratégie.",
      },
      {
        type: "callout",
        variant: "note",
        content: "Données nuit optionnelles : si tu n'as pas de chrono nuit spécifique, le système estime via les offsets d'équipage. La ligne nuit n'apparaît que si des données nuit existent pour ce pilote.",
      },
      {
        type: "component-demo",
        componentType: "garage61-import",
        config: {},
      },
      {
        type: "header",
        content: "Importer depuis Garage61",
      },
      {
        type: "text",
        content: "Si le circuit de l'événement est configuré avec un identifiant iRacing et que ton compte Garage61 est lié, un bouton 📥 Garage61 apparaît à côté de « Modifier ». Il ouvre un panneau d'import avec tous tes chronos enregistrés sur ce circuit.",
      },
      {
        type: "list",
        items: [
          "Filtres disponibles — Condition (sec/pluie), session (P/Q/R), même voiture que l'équipage (activé par défaut), plage de réservoir (min/max en litres — utile pour isoler un rythme représentatif d'un relais), plage de température de piste (min/max °C), plage de dates avec raccourcis 7j / 30j / 3 mois.",
          "Compteur filtré/total — Toujours visible pour savoir combien de chronos sont masqués.",
          "Colonnes — Condition, chrono, conso, réservoir (carburant en réserve au moment du tour — plus bas = plus léger), température de piste, date, voiture, session.",
          "Boutons d'import — → ☀️ → 💧 → 🌙☀️ → 🌙💧 appliquent le chrono ET la conso correspondante dans le formulaire.",
          "Le panneau reste ouvert après chaque import pour permettre de renseigner plusieurs conditions d'affilée. Un ✓ sur le bouton confirme l'import pour chaque champ.",
        ],
      },
      {
        type: "callout",
        variant: "tip",
        content: "Le compte Garage61 doit être lié depuis ton profil pilote avant de pouvoir utiliser cette fonctionnalité.",
      },
    ],
  },

  {
    id: "onglet-course",
    navTab: "Événements",
    label: "Équipage",
    title: "6. Course",
    parent: "evenements",
    blocks: [
      {
        type: "component-demo",
        componentType: "tabs",
        config: { activeTab: "Course" },
      },
      {
        type: "component-demo",
        componentType: "course",
        config: {},
      },
      {
        type: "text",
        content: "Mode live pendant la course. Affiche l'état actuel, le relais en cours, le temps restant, le prochain pilote, et permet de marquer les pit stops en temps réel.",
      },
      {
        type: "header",
        content: "États de la course",
      },
      {
        type: "states",
        items: [
          { label: "Avant course", variant: "neutral" },
          { label: "En course", variant: "yes" },
          { label: "Dépassement", variant: "no" },
          { label: "Terminée", variant: "no" },
        ],
      },
      {
        type: "header",
        content: "Affichage principal",
      },
      {
        type: "text",
        content: "Une grande card affiche le nom du pilote courant, l'heure de départ et fin estimée, le temps restant (gros compteur). Quand la course est très proche de la fin, la couleur passe à orange (fenêtre de stand) puis rouge (dépassement).",
      },
      {
        type: "header",
        content: "Actions pendant la course",
      },
      {
        type: "list",
        items: [
          "Marquer arrêt au stand — Enregistre l'heure réelle du pit stop pour le relais actif. L'app bascule automatiquement au relais suivant.",
          "Marquer fin relais précédent — Visible si Race Mode a automatiquement avancé au relais N alors que le relais N−1 n'avait jamais été stampé. Enregistre la fin de N−1 avec l'heure actuelle et recalcule le début de N en conséquence.",
          "Annuler dernier arrêt — Revert le pit stop le plus récent (utile en cas d'erreur).",
        ],
      },
      {
        type: "header",
        content: "Bilan carburant",
      },
      {
        type: "text",
        content: "Une fois des relais complétés, un tableau résume consommation réelle vs prévue avec écart par relais. Écart cumulé en vert (sous budget) ou rouge (déficit). Les valeurs estimées portent les mêmes marqueurs de fiabilité que dans l'onglet Relais (*, ~, †).",
      },
      {
        type: "callout",
        variant: "tip",
        content: "Pendant la course : Garde cet onglet ouvert pendant tes relais pour tracker facilement l'avancée. Les vraies données collectées alimentent l'onglet Performances après la course.",
      },
    ],
  },

  // ─── Inventaire ───────────────────────────────────────────────────────────
  {
    id: "inventaire",
    navTab: "Inventaire",
    label: "Inventaire",
    title: "Inventaire",
    blocks: [
      {
        type: "component-demo",
        componentType: "inventory",
        config: {},
      },
      {
        type: "text",
        content: "Matrice des contenus iRacing achetés par les pilotes. Les lignes sont les voitures (ou circuits), les colonnes les pilotes. ✓ indique que ce pilote possède ce contenu dans son compte iRacing.",
      },
      {
        type: "list",
        items: [
          "Onglets Voitures / Circuits — Bascule entre les deux matrices.",
          "Badge K — Voiture ou circuit configuré dans le catalogue Kronos pour les événements.",
          "Badge iR+ — Contenu gratuit avec abonnement iRacing.",
          "Colonne # — Nombre de pilotes qui possèdent ce contenu.",
          "Filtres — Filtrer par catégorie de voiture ou de circuit.",
        ],
      },
      {
        type: "callout",
        variant: "tip",
        content: "La matrice est synchronisée depuis iRacing lors du dernier sync de chaque pilote. Si un pilote vient d'acheter un contenu, il doit relancer sa synchronisation depuis son profil.",
      },
    ],
  },

  // ─── Admin ────────────────────────────────────────────────────────────────
  {
    id: "admin-intro",
    navTab: "Admin",
    label: "Admin",
    title: "Espace admin",
    blocks: [
      {
        type: "callout",
        variant: "warn",
        content: "Cette section est réservée aux pilotes avec le rôle Admin ou Super Admin. Les onglets décrits ici ne sont pas visibles par les pilotes standard.",
      },
      {
        type: "text",
        content: "L'espace admin regroupe tous les outils de configuration et de gestion de l'équipe. Il est accessible depuis le menu principal via le bouton Admin. Huit onglets organisent les différentes sections.",
      },
      {
        type: "component-demo",
        componentType: "admin-tabs",
      },
    ],
  },
  {
    id: "admin-pilotes",
    navTab: "Admin",
    label: "Admin",
    title: "Pilotes",
    parent: "admin-intro",
    blocks: [
      {
        type: "text",
        content: "Gestion des comptes pilotes et des demandes d'inscription. Trois onglets (un seul actif à la fois) permettent de basculer entre les vues :",
      },
      {
        type: "list",
        items: [
          "En attente — Nouvelles demandes d'inscription. Boutons ✓ Approuver et ✗ Refuser par pilote. Un badge rouge sur l'onglet Pilotes signale le nombre de demandes en attente.",
          "Approuvés — Tableau complet des pilotes actifs. Colonnes : Nom, Email (avec copie presse-papier), Rôle (sélecteur déroulant), Discord ID (crayon inline), Cotis. (checkbox), Test (checkbox), Actif (checkbox), iRacing sync (date de dernière synchro). Actions Révoquer et Supprimer disponibles selon le rôle.",
          "Refusés — Pilotes dont la demande a été refusée. Possibilité de les ré-approuver.",
        ],
      },
      {
        type: "component-demo",
        componentType: "admin-drivers",
      },
      {
        type: "callout",
        variant: "tip",
        content: "Le bouton « 🔄 Sync All iRating » met à jour l'iRating de tous les pilotes approuvés en une seule action. L'inventaire (voitures et circuits possédés) n'est pas synchronisé ici — chaque pilote doit relancer sa propre synchronisation depuis son profil.",
      },
    ],
  },
  {
    id: "admin-equipages",
    navTab: "Admin",
    label: "Admin",
    title: "Équipages",
    parent: "admin-intro",
    blocks: [
      {
        type: "text",
        content: "Deux sous-onglets : la gestion des numéros de voiture par équipe et championnat, et la configuration des noms d'équipages.",
      },
      {
        type: "divider",
        content: "Équipages utilisés en championnats",
      },
      {
        type: "text",
        content: "Vue de tous les équipages inscrits dans les championnats actifs, avec édition des numéros de voiture par manche.",
      },
      {
        type: "list",
        items: [
          "Vue par équipe / par championnat — Bascule entre les deux modes d'affichage via les boutons en haut.",
          "Numéro de voiture — Champ éditable inline par manche. La valeur est sauvegardée à la perte de focus.",
          "Indicateur « varie » — Apparaît en orange quand le numéro de voiture diffère entre les manches d'un même championnat. La ligne est automatiquement dépliée pour résolution.",
          "Conflit de numéro — Si le numéro saisi est déjà utilisé par un autre équipage dans la même manche (et le même créneau de départ), une fenêtre de confirmation apparaît.",
        ],
      },
      {
        type: "component-demo",
        componentType: "admin-championship-teams",
      },
      {
        type: "divider",
        content: "Configuration",
      },
      {
        type: "text",
        content: "Gestion des noms d'équipages (crew names) disponibles lors de la création des équipes.",
      },
      {
        type: "list",
        items: [
          "Créer / modifier / supprimer — Ajoute un nom d'équipage avec une couleur optionnelle.",
          "Couleur — Sélecteur avec presets et roue native. La luminance est calculée automatiquement pour garantir la lisibilité sur fond clair et sombre.",
          "Aperçu en direct — La pill colorée se met à jour en temps réel lors de la sélection.",
          "Suppression — Bloquée si des équipages actifs utilisent ce nom.",
        ],
      },
      {
        type: "component-demo",
        componentType: "admin-crew-names",
      },
    ],
  },
  {
    id: "admin-voitures",
    navTab: "Admin",
    label: "Admin",
    title: "Voitures",
    parent: "admin-intro",
    blocks: [
      {
        type: "text",
        content: "Deux sous-onglets : le catalogue Kronos utilisé dans les événements, et le catalogue iRacing complet pour les labels d'inventaire.",
      },
      {
        type: "divider",
        content: "Kronos Endurance",
      },
      {
        type: "text",
        content: "Voitures actives dans l'app, liées au catalogue iRacing. Ce sont ces voitures qui apparaissent lors de la création d'un équipage.",
      },
      {
        type: "list",
        items: [
          "Réservoir — Taille en litres, utilisée par le planificateur de relais.",
          "Ravit. — Taux de ravitaillement (L/s) optionnel par voiture. Si vide, le taux de la classe s'applique.",
          "Type iRacing — Label de regroupement dans l'inventaire pilote (ex : GT3, GTP). Hérité du catalogue iRacing mais modifiable.",
          "Suppression — Bloquée si un équipage actif utilise cette voiture. Un avertissement s'affiche si des pilotes l'ont en préférence.",
        ],
      },
      {
        type: "component-demo",
        componentType: "admin-cars",
      },
      {
        type: "divider",
        content: "Catalogue iRacing",
      },
      {
        type: "text",
        content: "Vue complète des voitures du catalogue iRacing, alimentée lors des synchronisations iRacing. Permet d'assigner un label de type à chaque voiture pour le regroupement dans l'inventaire des pilotes.",
      },
      {
        type: "list",
        items: [
          "Label inventaire — Texte libre (ex : gt3, gtp, lmp2) ou sélectionnable depuis les tags iRacing de la voiture. Affiché en majuscules dans l'inventaire.",
          "Tags iRacing — Tags natifs iRacing de la voiture (lecture seule), affichés comme référence pour choisir le label.",
          "Ces labels n'affectent pas les événements ni les équipages — uniquement l'affichage dans l'inventaire pilote.",
        ],
      },
      {
        type: "component-demo",
        componentType: "admin-cars-iracing",
      },
    ],
  },
  {
    id: "admin-classes",
    navTab: "Admin",
    label: "Admin",
    title: "Classes",
    parent: "admin-intro",
    blocks: [
      {
        type: "text",
        content: "Gestion des catégories de voitures (GT3, GTP, LMP2…). Chaque classe regroupe des voitures et définit un taux de ravitaillement par défaut.",
      },
      {
        type: "list",
        items: [
          "Créer / modifier / supprimer — Nom de la classe + taux de ravitaillement (L/s) avec boutons −/+.",
          "Assigner des voitures — Cliquer sur ▼ Voitures pour ouvrir le panneau. Les voitures déjà assignées apparaissent en pills accent avec × pour les retirer. Les voitures non classées apparaissent comme boutons « + Voiture » à cliquer pour assigner. Une voiture ne peut appartenir qu'à une seule classe.",
          "Override par voiture — Le taux de ravitaillement défini sur une voiture individuelle (onglet Voitures) prend le dessus sur celui de la classe.",
        ],
      },
      {
        type: "component-demo",
        componentType: "admin-classes",
      },
    ],
  },
  {
    id: "admin-circuits",
    navTab: "Admin",
    label: "Admin",
    title: "Circuits",
    parent: "admin-intro",
    blocks: [
      {
        type: "text",
        content: "Gestion des circuits utilisés dans les événements. Chaque circuit peut être lié à un circuit iRacing du catalogue.",
      },
      {
        type: "list",
        items: [
          "Créer / modifier / supprimer — Nom Kronos du circuit + temps pit lane (secondes, optionnel).",
          "Lien iRacing — Associe le circuit à un circuit du catalogue iRacing pour la correspondance avec l'inventaire des pilotes.",
          "Groupement — Les circuits sont groupés par circuit iRacing de base, avec affichage repliable (état sauvegardé localement).",
        ],
      },
      {
        type: "component-demo",
        componentType: "admin-circuits",
      },
    ],
  },
  {
    id: "admin-types",
    navTab: "Admin",
    label: "Admin",
    title: "Types d'événement",
    parent: "admin-intro",
    blocks: [
      {
        type: "text",
        content: "Gestion des formats d'événement (ex : Endurance GT, LMP Cup…). Les types permettent de restreindre les voitures disponibles lors de la création d'un équipage.",
      },
      {
        type: "list",
        items: [
          "Créer / modifier / supprimer — Nom du type d'événement.",
          "Voitures autorisées — Cocher les voitures autorisées pour ce type via ▼ Voitures. Les voitures sont groupées par classe avec une case à cocher de classe pour tout sélectionner/désélectionner d'un coup. Si aucune voiture n'est cochée, toutes sont autorisées.",
        ],
      },
      {
        type: "component-demo",
        componentType: "admin-event-types",
      },
    ],
  },
  {
    id: "admin-garage61",
    navTab: "Admin",
    label: "Admin",
    title: "Garage61",
    parent: "admin-intro",
    blocks: [
      {
        type: "text",
        content: "Outil de correspondance entre les membres Garage61 de l'équipe et les pilotes de la base de données. Affiche un tableau unique de tous les pilotes détectés sur Garage61 avec leur statut de correspondance.",
      },
      {
        type: "list",
        items: [
          "🔄 Actualiser — Relance la détection Garage61 et met à jour le cache. La date de dernière détection est affichée.",
          "Compte de détection — Sélecteur pour choisir quel pilote (membre de toutes les équipes) est utilisé pour la détection.",
          "✓ Appliquer N correspondances exactes — Bouton visible si des correspondances exactes non encore appliquées existent. Applique toutes en une fois.",
          "Statuts par ligne : ✓ Lié (déjà lié), → Correspondance exacte (applicable), ~ Correspondance partielle (prénom abrégé), ⚠ Conflit (slug différent déjà en base), ⚠ Ambigu (plusieurs pilotes, même nom normalisé), Inconnu (aucune correspondance).",
          "Bouton Appliquer — Sur les lignes exactes non encore appliquées. Bouton Résoudre — Sur les lignes partielles ou ambiguës pour forcer manuellement.",
        ],
      },
      {
        type: "component-demo",
        componentType: "admin-garage61",
      },
    ],
  },
  {
    id: "admin-parametres",
    navTab: "Admin",
    label: "Admin",
    title: "Paramètres",
    parent: "admin-intro",
    blocks: [
      {
        type: "text",
        content: "Configuration générale de l'application.",
      },
      {
        type: "list",
        items: [
          "Durées prédéfinies — Liste de durées (en minutes) proposées dans le sélecteur lors de la création d'un événement.",
          "Durée par défaut — Durée pré-sélectionnée à l'ouverture du formulaire de création.",
          "Créneaux spéciaux — Heures de départ fixes par jour de la semaine (vendredi, samedi, dimanche) pour les événements marqués « spéciaux ».",
          "Tags d'inscription — Liste des tags disponibles lors de l'inscription d'un pilote à un événement (ex : chill, compet, solo, gros rouleur).",
        ],
      },
      {
        type: "component-demo",
        componentType: "admin-settings",
      },
    ],
  },
];

