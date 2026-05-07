import Section from "./Section";
import Callout from "./Callout";
import Steps from "./Steps";
import FeatureList from "./FeatureList";
import States from "./States";
import ComponentDemo from "./ComponentDemo";

const NAV_TAB_ORDER = ["Accueil", "Pilotes", "Événements", "Inventaire"];

function renderBlock(block: any, i: number) {
  if (block.type === "header") {
    return (
      <h4 key={i} style={{ fontSize: "0.8rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-dim)", marginTop: "0.5rem" }}>
        {block.content}
      </h4>
    );
  }
  if (block.type === "text") {
    return (
      <p key={i} className="text-base font-medium leading-relaxed" style={{ color: "var(--text)" }}>
        {block.content}
      </p>
    );
  }
  if (block.type === "list") {
    return (
      <ul key={i} className="space-y-3 pl-6">
        {block.items.map((item: string, idx: number) => (
          <li key={idx} className="text-base font-medium" style={{ color: "var(--text)" }}>
            {item}
          </li>
        ))}
      </ul>
    );
  }
  if (block.type === "steps") return <Steps key={i} steps={block.items} />;
  if (block.type === "callout") {
    return (
      <div key={i} style={{ margin: "1rem 0" }}>
        <Callout type={block.variant}>
          {block.content}
        </Callout>
      </div>
    );
  }
  if (block.type === "feature-list") return <FeatureList key={i} items={block.items} />;
  if (block.type === "component-demo") return (
    <div key={i} style={{ margin: "2.5rem 0" }}>
      <div style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: "0.5rem", paddingLeft: "0.1rem" }}>
        Aperçu
      </div>
      <div style={{ border: "1px solid var(--border)", borderTop: "2px solid var(--accent)", borderRadius: "4px", padding: "1.5rem", background: "var(--bg)", overflowX: "auto" }}>
        <ComponentDemo type={block.componentType} config={block.config} />
      </div>
    </div>
  );
  if (block.type === "states") return <div key={i} style={{ margin: "1rem 0" }}><States items={block.items} /></div>;
  return null;
}

export default function GuideRenderer({ data }: { data: any[] }) {
  const byNavTab = new Map<string, any[]>();
  for (const section of data) {
    const tab = section.navTab ?? section.label;
    if (!byNavTab.has(tab)) byNavTab.set(tab, []);
    byNavTab.get(tab)!.push(section);
  }
  const orderedTabs = NAV_TAB_ORDER.filter((t) => byNavTab.has(t));

  return orderedTabs.map((navTab) => (
    <div key={navTab}>
      <div style={{ marginBottom: "3rem" }}>
        <h2
          className="text-2xl font-bold uppercase tracking-widest"
          style={{ color: "var(--accent)", letterSpacing: "0.1em" }}
        >
          {navTab}
        </h2>
        <div style={{ height: "2px", background: "var(--accent)", width: "2rem", marginTop: "0.5rem" }} />
      </div>
      {byNavTab.get(navTab)!.map((section, idx, arr) => {
        const prevLabel = idx > 0 ? arr[idx - 1].label : null;
        const showLabelHeader = section.label !== navTab && section.label !== prevLabel;
        return (
          <div key={section.id}>
            {showLabelHeader && (
              <div style={{ marginTop: "2.5rem", marginBottom: "1.25rem" }}>
                <h3 style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--text-dim)",
                  margin: 0,
                }}>
                  {section.label}
                </h3>
                <div style={{ height: "1px", background: "var(--border)", marginTop: "0.5rem" }} />
              </div>
            )}
            <Section id={section.id} title={section.title} isSubsection={!!section.parent} showTitle={section.title !== navTab}>
              {section.blocks.map(renderBlock)}
            </Section>
          </div>
        );
      })}
    </div>
  ));
}
