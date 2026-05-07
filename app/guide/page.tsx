import { guide } from "./guide.data";
import GuideRenderer from "./components/GuideRenderer";
import Sidebar from "./components/Sidebar";

export default function Page() {
  return (
    <div className="flex h-full w-full gap-0">
      <Sidebar sections={guide} scrollContainerId="guide-main" />
      <main
        id="guide-main"
        className="flex-1 overflow-y-auto"
        style={{ backgroundColor: "var(--bg)" }}
      >
        <div style={{ padding: "4rem 4%" }}>
          <h1 className="text-4xl font-bold mb-4 uppercase tracking-wider" style={{ color: "var(--text)", letterSpacing: "0.05em" }}>
            Guide d'utilisation — Pilotes
          </h1>
          <p className="text-lg font-medium mb-16 pb-8" style={{ color: "var(--text-dim)", borderBottom: "1px solid var(--border)" }}>
            Maîtrise chaque section du Kronos Endurance Planner.
          </p>
          <GuideRenderer data={guide} />
        </div>
      </main>
    </div>
  );
}