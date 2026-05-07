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
import CourseDemo from "./demos/CourseDemo";
import StartTimesDemo from "./demos/StartTimesDemo";
import InventoryDemo from "./demos/InventoryDemo";

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
    case "profil":             return <ProfilDemo />;
    case "inscription-form":   return <InscriptionFormDemo />;
    case "inscriptions":       return <InscriptionsDemo />;
    case "equipages-list":     return <EquipagesDemo />;
    case "availability":       return <AvailabilityDemo />;
    case "stint-grid":         return <StintGridDemo />;
    case "planning":           return <PlanningDemo />;
    case "performances":       return <PerformancesDemo />;
    case "course":             return <CourseDemo />;
    case "horaires":           return <StartTimesDemo />;
    case "inventory":          return <InventoryDemo />;
    default:
      return <div style={{ color: "var(--danger)" }}>Unknown component type: {type}</div>;
  }
}
