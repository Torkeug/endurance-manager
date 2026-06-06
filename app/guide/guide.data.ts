export type GuideSection = {
  id: string;
  /** Sub-group label within the navTab */
  label: string;
  /** Top-level nav tab ID — "home" | "pilots" | "events" | "inventory" | "admin" */
  navTab: string;
  title: string;
  parent?: string;
  blocks: any[];
  /** Only shown to admins — filtered out for regular users */
  adminOnly?: boolean;
  /** Hidden for admins — shown only to regular users */
  hideForAdmins?: boolean;
};

type TranslationFn = {
  (key: string): string;
  raw: (key: string) => any;
};

export function getGuide(t: TranslationFn): GuideSection[] {
  return [
    // ─── Accueil ──────────────────────────────────────────────────────────────
    {
      id: "accueil",
      navTab: "home",
      label: t("label.home"),
      title: t("accueil.title"),
      hideForAdmins: true,
      blocks: [
        { type: "component-demo", componentType: "accueil", config: {} },
        { type: "text", content: t("accueil.text1") },
        { type: "list", items: t.raw("accueil.items1") },
      ],
    },
    {
      id: "accueil-admin",
      navTab: "home",
      label: t("label.home"),
      title: t("accueilAdmin.title"),
      adminOnly: true,
      blocks: [
        { type: "component-demo", componentType: "admin-accueil" },
        { type: "text", content: t("accueilAdmin.text1") },
        { type: "list", items: t.raw("accueilAdmin.items1") },
        { type: "divider", content: t("accueilAdmin.divNoPilots") },
        { type: "text", content: t("accueilAdmin.textNoPilots") },
        { type: "component-demo", componentType: "admin-suivi-sans-pilotes" },
        { type: "divider", content: t("accueilAdmin.divNoStints") },
        { type: "text", content: t("accueilAdmin.textNoStints") },
        { type: "component-demo", componentType: "admin-suivi-sans-relais" },
        { type: "divider", content: t("accueilAdmin.divNoCrew") },
        { type: "text", content: t("accueilAdmin.textNoCrew") },
        { type: "component-demo", componentType: "admin-suivi-sans-equipage" },
      ],
    },

    // ─── Pilotes ──────────────────────────────────────────────────────────────
    {
      id: "pilotes",
      navTab: "pilots",
      label: t("label.pilots"),
      title: t("pilotes.title"),
      blocks: [
        { type: "component-demo", componentType: "pilots", config: {} },
        { type: "text", content: t("pilotes.text1") },
        { type: "list", items: t.raw("pilotes.items1") },
      ],
    },

    {
      id: "profil",
      navTab: "pilots",
      label: t("label.pilots"),
      title: t("profil.title"),
      parent: "pilotes",
      blocks: [
        { type: "text", content: t("profil.text1") },
        { type: "header", content: t("profil.headerEngagements") },
        { type: "component-demo", componentType: "profil", config: { activeTab: "engagements" } },
        { type: "text", content: t("profil.textEngagements") },
        { type: "divider", content: "" },
        { type: "header", content: t("profil.headerStatsApp") },
        { type: "component-demo", componentType: "profil", config: { activeTab: "statistiques", statsSubTab: "app" } },
        { type: "text", content: t("profil.textStatsApp") },
        { type: "divider", content: "" },
        { type: "header", content: t("profil.headerStatsG61") },
        { type: "component-demo", componentType: "profil", config: { activeTab: "statistiques", statsSubTab: "garage61" } },
        { type: "text", content: t("profil.textStatsG61") },
        { type: "header", content: t("profil.headerInfo") },
        { type: "list", items: t.raw("profil.items1") },
        { type: "callout", variant: "tip", content: t("profil.callout1") },
        { type: "header", content: t("profil.headerThirdParty") },
        { type: "list", items: t.raw("profil.items2") },
        { type: "callout", variant: "note", content: t("profil.callout2") },
        { type: "divider", content: "" },
        { type: "header", content: t("profil.headerDiscord") },
        { type: "text", content: t("profil.textDiscord") },
        { type: "list", items: t.raw("profil.items3") },
      ],
    },

    // ─── Événements ───────────────────────────────────────────────────────────
    {
      id: "evenements",
      navTab: "events",
      label: t("label.events"),
      title: t("evenements.title"),
      blocks: [
        { type: "component-demo", componentType: "evenements", config: {} },
        { type: "text", content: t("evenements.text1") },
        { type: "list", items: t.raw("evenements.items1") },
        { type: "text", content: t("evenements.text2") },
      ],
    },

    {
      id: "inscription",
      navTab: "events",
      label: t("label.events"),
      title: t("inscription.title"),
      parent: "evenements",
      blocks: [
        { type: "component-demo", componentType: "inscription-form", config: {} },
        { type: "text", content: t("inscription.text1") },
        { type: "list", items: t.raw("inscription.items1") },
        { type: "text", content: t("inscription.text2") },
        {
          type: "states",
          items: [
            { variant: "hard", label: t("inscription.stateHardLabel"), description: t("inscription.stateHardDesc") },
            { variant: "soft", label: t("inscription.stateSoftLabel"), description: t("inscription.stateSoftDesc") },
          ],
        },
        { type: "callout", variant: "note", content: t("inscription.callout1") },
      ],
    },

    {
      id: "creation-equipage",
      navTab: "events",
      label: t("label.events"),
      title: t("creationEquipage.title"),
      parent: "evenements",
      blocks: [
        { type: "component-demo", componentType: "equipages-list", config: { showCreate: true } },
        { type: "component-demo", componentType: "new-equipage", config: {} },
        { type: "text", content: t("creationEquipage.text1") },
        { type: "list", items: t.raw("creationEquipage.items1") },
      ],
    },

    // ─── Détail événement tabs ────────────────────────────────────────────────
    {
      id: "evenement-inscriptions",
      navTab: "events",
      label: t("label.eventDetail"),
      title: t("evenementInscriptions.title"),
      parent: "evenements",
      blocks: [
        { type: "component-demo", componentType: "event-detail-tabs", config: { activeTab: "inscriptions" } },
        { type: "component-demo", componentType: "inscriptions", config: {} },
        { type: "text", content: t("evenementInscriptions.text1") },
        { type: "list", items: t.raw("evenementInscriptions.items1") },
        { type: "text", content: t("evenementInscriptions.text2") },
        { type: "text", content: t("evenementInscriptions.text3") },
        { type: "text", content: t("evenementInscriptions.text4") },
        { type: "list", items: t.raw("evenementInscriptions.items2") },
      ],
    },

    {
      id: "evenement-equipages",
      navTab: "events",
      label: t("label.eventDetail"),
      title: t("evenementEquipages.title"),
      parent: "evenements",
      blocks: [
        { type: "component-demo", componentType: "event-detail-tabs", config: { activeTab: "equipages" } },
        { type: "component-demo", componentType: "equipages-list", config: {} },
        { type: "text", content: t("evenementEquipages.text1") },
        { type: "list", items: t.raw("evenementEquipages.items1") },
      ],
    },

    {
      id: "evenement-horaires",
      navTab: "events",
      label: t("label.eventDetail"),
      title: t("evenementHoraires.title"),
      parent: "evenements",
      blocks: [
        { type: "component-demo", componentType: "event-detail-tabs", config: { activeTab: "horaires" } },
        { type: "component-demo", componentType: "horaires", config: {} },
        { type: "text", content: t("evenementHoraires.text1") },
        { type: "callout", variant: "note", content: t("evenementHoraires.callout1") },
      ],
    },

    {
      id: "evenement-inventaire",
      navTab: "events",
      label: t("label.eventDetail"),
      title: t("evenementInventaire.title"),
      parent: "evenements",
      blocks: [
        { type: "component-demo", componentType: "event-detail-tabs", config: { activeTab: "inventaire" } },
        { type: "component-demo", componentType: "inventory", config: {} },
        { type: "text", content: t("evenementInventaire.text1") },
        { type: "list", items: t.raw("evenementInventaire.items1") },
        { type: "callout", variant: "tip", content: t("evenementInventaire.callout1") },
      ],
    },

    // ─── Équipage tabs ────────────────────────────────────────────────────────
    {
      id: "onglet-pilotes",
      navTab: "events",
      label: t("label.crew"),
      title: t("onglePilotes.title"),
      parent: "evenements",
      blocks: [
        { type: "component-demo", componentType: "tabs", config: { activeTab: "Pilotes" } },
        { type: "component-demo", componentType: "pilots", config: {} },
        { type: "text", content: t("onglePilotes.text1") },
        {
          type: "states",
          items: [
            { variant: "hard", label: t("onglePilotes.stateHardLabel"), description: t("onglePilotes.stateHardDesc") },
            { variant: "soft", label: t("onglePilotes.stateSoftLabel"), description: t("onglePilotes.stateSoftDesc") },
          ],
        },
        { type: "header", content: t("onglePilotes.headerJoin") },
        { type: "text", content: t("onglePilotes.text2") },
        { type: "list", items: t.raw("onglePilotes.items1") },
      ],
    },

    {
      id: "onglet-disponibilites",
      navTab: "events",
      label: t("label.crew"),
      title: t("ongletDisponibilites.title"),
      parent: "evenements",
      blocks: [
        { type: "component-demo", componentType: "tabs", config: { activeTab: "Disponibilités" } },
        { type: "component-demo", componentType: "availability", config: {} },
        { type: "text", content: t("ongletDisponibilites.text1") },
        {
          type: "states",
          items: [
            { label: t("ongletDisponibilites.stateYesLabel"), variant: "yes" },
            { label: t("ongletDisponibilites.stateNoLabel"), variant: "no" },
            { label: t("ongletDisponibilites.stateNeutralLabel"), variant: "neutral" },
          ],
        },
        { type: "callout", variant: "tip", content: t("ongletDisponibilites.callout1") },
        { type: "callout", variant: "note", content: t("ongletDisponibilites.callout2") },
        { type: "callout", variant: "tip", content: t("ongletDisponibilites.callout3") },
      ],
    },

    {
      id: "onglet-relais",
      navTab: "events",
      label: t("label.crew"),
      title: t("ongletRelais.title"),
      parent: "evenements",
      blocks: [
        { type: "component-demo", componentType: "tabs", config: { activeTab: "Relais" } },
        { type: "component-demo", componentType: "stint-grid", config: {} },
        { type: "text", content: t("ongletRelais.text1") },
        { type: "header", content: t("ongletRelais.headerStrategies") },
        { type: "text", content: t("ongletRelais.text2") },
        { type: "list", items: t.raw("ongletRelais.items1") },
        { type: "header", content: t("ongletRelais.headerTable") },
        { type: "text", content: t("ongletRelais.text3") },
        { type: "list", items: t.raw("ongletRelais.items2") },
        { type: "text", content: t("ongletRelais.text4") },
        { type: "list", items: t.raw("ongletRelais.items3") },
        { type: "callout", variant: "tip", content: t("ongletRelais.callout1") },
        { type: "callout", variant: "note", content: t("ongletRelais.callout2") },
        { type: "header", content: t("ongletRelais.headerGantt") },
        { type: "text", content: t("ongletRelais.text5") },
        { type: "header", content: t("ongletRelais.headerFairShare") },
        { type: "text", content: t("ongletRelais.text6") },
        { type: "callout", variant: "warn", content: t("ongletRelais.callout3") },
        { type: "callout", variant: "tip", content: t("ongletRelais.callout4") },
      ],
    },

    {
      id: "onglet-planning",
      navTab: "events",
      label: t("label.crew"),
      title: t("ongletPlanning.title"),
      parent: "evenements",
      blocks: [
        { type: "component-demo", componentType: "tabs", config: { activeTab: "Planning" } },
        { type: "component-demo", componentType: "planning", config: {} },
        { type: "text", content: t("ongletPlanning.text1") },
        { type: "header", content: t("ongletPlanning.headerReading") },
        { type: "list", items: t.raw("ongletPlanning.items1") },
        { type: "header", content: t("ongletPlanning.headerInteractivity") },
        { type: "text", content: t("ongletPlanning.text2") },
        { type: "callout", variant: "tip", content: t("ongletPlanning.callout1") },
      ],
    },

    {
      id: "onglet-performances",
      navTab: "events",
      label: t("label.crew"),
      title: t("ongletPerformances.title"),
      parent: "evenements",
      blocks: [
        { type: "component-demo", componentType: "tabs", config: { activeTab: "Performances" } },
        { type: "component-demo", componentType: "performances", config: {} },
        { type: "text", content: t("ongletPerformances.text1") },
        { type: "header", content: t("ongletPerformances.headerDayNight") },
        { type: "text", content: t("ongletPerformances.text2") },
        { type: "text", content: t("ongletPerformances.text3") },
        { type: "list", items: t.raw("ongletPerformances.items1") },
        { type: "header", content: t("ongletPerformances.headerModifiers") },
        { type: "text", content: t("ongletPerformances.text4") },
        { type: "list", items: t.raw("ongletPerformances.items2") },
        { type: "header", content: t("ongletPerformances.headerFill") },
        { type: "text", content: t("ongletPerformances.text5") },
        { type: "callout", variant: "note", content: t("ongletPerformances.callout1") },
        { type: "component-demo", componentType: "garage61-import", config: {} },
        { type: "header", content: t("ongletPerformances.headerG61") },
        { type: "text", content: t("ongletPerformances.text6") },
        { type: "list", items: t.raw("ongletPerformances.items3") },
        { type: "callout", variant: "tip", content: t("ongletPerformances.callout2") },
      ],
    },

    {
      id: "onglet-course",
      navTab: "events",
      label: t("label.crew"),
      title: t("ongletCourse.title"),
      parent: "evenements",
      blocks: [
        { type: "component-demo", componentType: "tabs", config: { activeTab: "Course" } },
        { type: "component-demo", componentType: "course", config: {} },
        { type: "text", content: t("ongletCourse.text1") },
        { type: "header", content: t("ongletCourse.headerStates") },
        {
          type: "states",
          items: [
            { label: t("ongletCourse.stateBeforeLabel"), variant: "neutral" },
            { label: t("ongletCourse.stateInLabel"), variant: "yes" },
            { label: t("ongletCourse.stateOverLabel"), variant: "no" },
            { label: t("ongletCourse.stateDoneLabel"), variant: "no" },
          ],
        },
        { type: "header", content: t("ongletCourse.headerDisplay") },
        { type: "text", content: t("ongletCourse.text2") },
        { type: "header", content: t("ongletCourse.headerActions") },
        { type: "list", items: t.raw("ongletCourse.items1") },
        { type: "header", content: t("ongletCourse.headerFuel") },
        { type: "text", content: t("ongletCourse.text3") },
        { type: "callout", variant: "tip", content: t("ongletCourse.callout1") },
      ],
    },

    // ─── Inventaire ───────────────────────────────────────────────────────────
    {
      id: "inventaire",
      navTab: "inventory",
      label: t("label.inventory"),
      title: t("inventaire.title"),
      blocks: [
        { type: "component-demo", componentType: "inventory", config: {} },
        { type: "text", content: t("inventaire.text1") },
        { type: "list", items: t.raw("inventaire.items1") },
        { type: "callout", variant: "tip", content: t("inventaire.callout1") },
      ],
    },

    // ─── Admin ────────────────────────────────────────────────────────────────
    {
      id: "admin-intro",
      navTab: "admin",
      label: t("label.admin"),
      title: t("adminIntro.title"),
      blocks: [
        { type: "callout", variant: "warn", content: t("adminIntro.callout1") },
        { type: "text", content: t("adminIntro.text1") },
        { type: "component-demo", componentType: "admin-tabs" },
      ],
    },
    {
      id: "admin-pilotes",
      navTab: "admin",
      label: t("label.admin"),
      title: t("adminPilotes.title"),
      parent: "admin-intro",
      blocks: [
        { type: "text", content: t("adminPilotes.text1") },
        { type: "list", items: t.raw("adminPilotes.items1") },
        { type: "component-demo", componentType: "admin-drivers" },
        { type: "callout", variant: "tip", content: t("adminPilotes.callout1") },
      ],
    },
    {
      id: "admin-equipages",
      navTab: "admin",
      label: t("label.admin"),
      title: t("adminEquipages.title"),
      parent: "admin-intro",
      blocks: [
        { type: "text", content: t("adminEquipages.text1") },
        { type: "divider", content: t("adminEquipages.divChampionships") },
        { type: "text", content: t("adminEquipages.text2") },
        { type: "list", items: t.raw("adminEquipages.items1") },
        { type: "component-demo", componentType: "admin-championship-teams" },
        { type: "divider", content: t("adminEquipages.divConfig") },
        { type: "text", content: t("adminEquipages.text3") },
        { type: "list", items: t.raw("adminEquipages.items2") },
        { type: "component-demo", componentType: "admin-crew-names" },
      ],
    },
    {
      id: "admin-voitures",
      navTab: "admin",
      label: t("label.admin"),
      title: t("adminVoitures.title"),
      parent: "admin-intro",
      blocks: [
        { type: "text", content: t("adminVoitures.text1") },
        { type: "divider", content: t("adminVoitures.divKronos") },
        { type: "text", content: t("adminVoitures.text2") },
        { type: "list", items: t.raw("adminVoitures.items1") },
        { type: "component-demo", componentType: "admin-cars" },
        { type: "divider", content: t("adminVoitures.divCatalogue") },
        { type: "text", content: t("adminVoitures.text3") },
        { type: "list", items: t.raw("adminVoitures.items2") },
        { type: "component-demo", componentType: "admin-cars-iracing" },
      ],
    },
    {
      id: "admin-classes",
      navTab: "admin",
      label: t("label.admin"),
      title: t("adminClasses.title"),
      parent: "admin-intro",
      blocks: [
        { type: "text", content: t("adminClasses.text1") },
        { type: "list", items: t.raw("adminClasses.items1") },
        { type: "component-demo", componentType: "admin-classes" },
      ],
    },
    {
      id: "admin-circuits",
      navTab: "admin",
      label: t("label.admin"),
      title: t("adminCircuits.title"),
      parent: "admin-intro",
      blocks: [
        { type: "text", content: t("adminCircuits.text1") },
        { type: "list", items: t.raw("adminCircuits.items1") },
        { type: "component-demo", componentType: "admin-circuits" },
      ],
    },
    {
      id: "admin-types",
      navTab: "admin",
      label: t("label.admin"),
      title: t("adminTypes.title"),
      parent: "admin-intro",
      blocks: [
        { type: "text", content: t("adminTypes.text1") },
        { type: "list", items: t.raw("adminTypes.items1") },
        { type: "component-demo", componentType: "admin-event-types" },
      ],
    },
    {
      id: "admin-garage61",
      navTab: "admin",
      label: t("label.admin"),
      title: t("adminGarage61.title"),
      parent: "admin-intro",
      blocks: [
        { type: "text", content: t("adminGarage61.text1") },
        { type: "list", items: t.raw("adminGarage61.items1") },
        { type: "component-demo", componentType: "admin-garage61" },
      ],
    },
    {
      id: "admin-parametres",
      navTab: "admin",
      label: t("label.admin"),
      title: t("adminParametres.title"),
      parent: "admin-intro",
      blocks: [
        { type: "text", content: t("adminParametres.text1") },
        { type: "list", items: t.raw("adminParametres.items1") },
        { type: "component-demo", componentType: "admin-settings" },
      ],
    },
  ];
}
