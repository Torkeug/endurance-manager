const styles = {
  info: { bg: "var(--surface-2)", border: "var(--accent-dim)", text: "var(--text)" },
  tip: { bg: "#0f2a1a", border: "var(--success)", text: "#60c090" },
  warn: { bg: "#2a1010", border: "var(--danger)", text: "#f08080" },
  note: { bg: "#0f2a1a", border: "var(--success)", text: "#60c090" },
};

export default function Callout({ type, children }) {
  const style = styles[type];
  return (
    <div
      className="border p-5 rounded text-base font-medium"
      style={{
        backgroundColor: style.bg,
        borderColor: style.border,
        color: style.text,
      }}
    >
      {children}
    </div>
  );
}