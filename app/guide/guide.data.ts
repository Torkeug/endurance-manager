export type GuideSection = {
  id: string;
  /** Sub-group label within the navTab (e.g. "Équipage" inside "Événements") */
  label: string;
  /** Top-level nav tab this section belongs to */
  navTab: string;
  title: string;
  parent?: string;
  blocks: any[];
};

export const guide: GuideSection[] = [
  // ─── Accueil ──────────────────────────────────────────────────────────────
  {
    id: "accueil",
    navTab: "Accueil",
    label: "Accueil",
    title: "Tableau de bord",
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
        type: "component-demo",
        componentType: "profil",
        config: {},
      },
      {
        type: "text",
        content: "Page personnelle du pilote. Deux onglets :",
      },
      {
        type: "header",
        content: "Engagements",
      },
      {
        type: "text",
        content: "Historique de toutes les inscriptions du pilote, groupées par événement — équipage assigné, relais attribués, taux de remplissage des disponibilités.",
      },
      {
        type: "header",
        content: "Statistiques",
      },
      {
        type: "list",
        items: [
          "iRating actuel — Mis à jour automatiquement lors de syncs iRacing.",
          "Historique iRating — Graphique par catégorie (Sports Car, Formula, etc.).",
          "Stats de pilote — Résumé (relais, heures, podiums, victoires), conditions (nuit, pluie), tableau de chronos et conso par circuit.",
        ],
      },
      {
        type: "header",
        content: "Informations",
      },
      {
        type: "list",
        items: [
          "Infos de base — Nom, email, iRacing ID (lien cliquable), Discord, Twitch, Instagram.",
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
          "🔗 Lier Garage61 — Connecte ton compte Garage61 via OAuth. Une fois lié, tes chronos enregistrés sur Garage61 peuvent être importés directement dans l'onglet Performances de ton équipage.",
          "🔗 Lier iRacing — Connecte ton compte iRacing pour synchroniser l'inventaire et l'iRating.",
        ],
      },
      {
        type: "callout",
        variant: "note",
        content: "En liant ton compte Garage61, tu autorises les membres de ton équipe à importer tes chronos pour toi (utile si un ingénieur renseigne les données de performance).",
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
        content: "Toutes les courses (normales, spéciales, championnats) sont listées ici, triées par type.",
      },
      {
        type: "list",
        items: [
          "Normaux — Courses avec horaires éditables.",
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
          "Alerte relais Discord — Le bot Discord alertera X minutes avant la fin de chaque relais. Laisser vide pour désactiver.",
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
        content: "Liste de tous les pilotes inscrits à cet événement. Chaque ligne correspond à une inscription — un pilote peut apparaître plusieurs fois s'il est dans plusieurs équipages.",
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
        content: "Diagramme de Gantt visualisant ta stratégie active. Une ligne par pilote, bandes de relais colorées, avec fond de disponibilité et bande nuit IG.",
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
          "Filtres disponibles — Condition (sec/pluie), session (P/Q/R), jour/nuit (si fourni par Garage61), même voiture que l'équipage, tours propres uniquement, plage de dates.",
          "Compteur filtré/total — Toujours visible pour savoir combien de chronos sont masqués.",
          "Colonnes — Condition, tour propre (✓/✗), chrono, conso, date, voiture, session.",
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
];

