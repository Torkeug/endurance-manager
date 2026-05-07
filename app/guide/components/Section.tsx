export default function Section({ id, title, children, isSubsection = false, showTitle = true }) {
  if (isSubsection) {
    // Subsection — subtle indented box with background
    return (
      <section id={id} className="scroll-mt-32" style={{ marginBottom: "2rem", marginLeft: "1rem" }}>
        <div
          className="p-6 rounded border-l-2"
          style={{
            backgroundColor: "var(--surface-2)",
            borderColor: "var(--accent-dim)",
            borderLeftWidth: "3px",
          }}
        >
          <h3 className="text-lg font-bold mb-4" style={{ color: "var(--text)", letterSpacing: "0.02em" }}>
            {title}
          </h3>
          <div className="space-y-4" style={{ color: "var(--text)" }}>
            {children}
          </div>
        </div>
      </section>
    );
  }

  // Main section — prominent card
  return (
    <section id={id} className="scroll-mt-32" style={{ marginBottom: "5rem" }}>
      <div
        className="p-10 rounded-lg shadow-sm"
        style={{
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        }}
      >
        {showTitle && (
          <h2 className="text-3xl font-bold mb-8 uppercase tracking-wider" style={{ color: "var(--accent)", letterSpacing: "0.04em" }}>
            {title}
          </h2>
        )}
        <div className="space-y-6" style={{ color: "var(--text)" }}>
          {children}
        </div>
      </div>
    </section>
  );
}
