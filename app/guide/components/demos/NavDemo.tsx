export default function NavDemo() {
  const navLinks = [
    { label: "ACCUEIL" },
    { label: "PILOTES" },
    { label: "ÉVÉNEMENTS" },
    { label: "INVENTAIRE" },
    { label: "ADMIN" },
    { label: "GUIDE", active: true },
  ];

  return (
    <div style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }} className="rounded">
      <nav className="flex items-center justify-between p-4" style={{ backgroundColor: "var(--surface)" }}>
        {/* Logo area */}
        <div className="font-bold" style={{ color: "var(--accent)" }}>
          Kronos
        </div>

        {/* Nav links */}
        <div className="flex gap-6">
          {navLinks.map((link) => (
            <div
              key={link.label}
              className="text-sm font-bold uppercase tracking-wide"
              style={{
                color: link.active ? "var(--accent)" : "var(--text-dim)",
                borderBottom: link.active ? "2px solid var(--accent)" : "none",
                paddingBottom: "0.25rem",
              }}
            >
              {link.label}
            </div>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium" style={{ color: "var(--text-dim)" }}>
            Raphaël Laurent
          </span>
          <span className="text-xs font-bold px-2 py-1 rounded" style={{ backgroundColor: "var(--accent-dim)", color: "var(--accent)" }}>
            SUPER ADMIN
          </span>
          <div className="text-sm font-bold uppercase" style={{ color: "var(--text-dim)" }}>
            DÉCONNEXION
          </div>
        </div>
      </nav>
    </div>
  );
}