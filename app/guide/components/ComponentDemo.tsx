import NavDemo from "./demos/NavDemo";
import TabsDemo from "./demos/TabsDemo";
import EventDetailTabsDemo from "./demos/EventDetailTabsDemo";
import AccueilDemo from "./demos/AccueilDemo";
import EvenementsDemo from "./demos/EvenementsDemo";
import PilotsDemo from "./demos/PilotsDemo";
import ProfilDemo from "./demos/ProfilDemo";
import InscriptionFormDemo from "./demos/InscriptionFormDemo";
import InscriptionsDemo from "./demos/InscriptionsDemo";
import EquipagesDemo from "./demos/EquipagesDemo";
import AvailabilityDemo from "./demos/AvailabilityDemo";
import StintGridDemo from "./demos/StintGridDemo";
import PlanningDemo from "./demos/PlanningDemo";
import PerformancesDemo from "./demos/PerformancesDemo";
import Garage61ImportDemo from "./demos/Garage61ImportDemo";
import CourseDemo from "./demos/CourseDemo";
import StartTimesDemo from "./demos/StartTimesDemo";
import InventoryDemo from "./demos/InventoryDemo";
import NewEquipageDemo from "./demos/NewEquipageDemo";
import AdminAccueilDemo from "./demos/AdminAccueilDemo";
import { AdminSuiviSansPilotesDemo, AdminSuiviSansRelaisDemo, AdminSuiviSansEquipageDemo } from "./demos/AdminSuiviDemo";
import AdminTabsDemo from "./demos/AdminTabsDemo";
import AdminDriversDemo from "./demos/AdminDriversDemo";
import AdminCrewNamesDemo from "./demos/AdminCrewNamesDemo";
import AdminChampionshipTeamsDemo from "./demos/AdminChampionshipTeamsDemo";
import AdminCarsDemo from "./demos/AdminCarsDemo";
import AdminCarsIracingDemo from "./demos/AdminCarsIracingDemo";
import AdminClassesDemo from "./demos/AdminClassesDemo";
import AdminCircuitsDemo from "./demos/AdminCircuitsDemo";
import AdminEventTypesDemo from "./demos/AdminEventTypesDemo";
import AdminGarage61Demo from "./demos/AdminGarage61Demo";
import AdminSettingsDemo from "./demos/AdminSettingsDemo";

interface ComponentDemoProps {
  type: string;
  config: any;
}

export default function ComponentDemo({ type, config }: ComponentDemoProps) {
  switch (type) {
    case "nav":                return <NavDemo {...config} />;
    case "tabs":               return <TabsDemo {...config} />;
    case "event-detail-tabs":  return <EventDetailTabsDemo {...config} />;
    case "accueil":            return <AccueilDemo />;
    case "evenements":         return <EvenementsDemo />;
    case "pilots":             return <PilotsDemo />;
    case "profil":             return <ProfilDemo {...config} />;
    case "inscription-form":   return <InscriptionFormDemo />;
    case "inscriptions":       return <InscriptionsDemo />;
    case "equipages-list":     return <EquipagesDemo {...config} />;
    case "availability":       return <AvailabilityDemo />;
    case "stint-grid":         return <StintGridDemo />;
    case "planning":           return <PlanningDemo />;
    case "performances":       return <PerformancesDemo />;
    case "garage61-import":    return <Garage61ImportDemo />;
    case "course":             return <CourseDemo />;
    case "horaires":           return <StartTimesDemo />;
    case "inventory":          return <InventoryDemo />;
    case "new-equipage":       return <NewEquipageDemo />;
    case "admin-accueil":             return <AdminAccueilDemo />;
    case "admin-suivi-sans-pilotes":  return <AdminSuiviSansPilotesDemo />;
    case "admin-suivi-sans-relais":   return <AdminSuiviSansRelaisDemo />;
    case "admin-suivi-sans-equipage": return <AdminSuiviSansEquipageDemo />;
    case "admin-tabs":                return <AdminTabsDemo />;
    case "admin-drivers":             return <AdminDriversDemo />;
    case "admin-crew-names":          return <AdminCrewNamesDemo />;
    case "admin-championship-teams":  return <AdminChampionshipTeamsDemo />;
    case "admin-cars":                return <AdminCarsDemo />;
    case "admin-cars-iracing":        return <AdminCarsIracingDemo />;
    case "admin-classes":             return <AdminClassesDemo />;
    case "admin-circuits":            return <AdminCircuitsDemo />;
    case "admin-event-types":         return <AdminEventTypesDemo />;
    case "admin-garage61":            return <AdminGarage61Demo />;
    case "admin-settings":            return <AdminSettingsDemo />;
    default:
      return <div style={{ color: "var(--danger)" }}>Unknown component type: {type}</div>;
  }
}
