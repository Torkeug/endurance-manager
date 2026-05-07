export default function FeatureList({ items }) {
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div
          key={i}
          className="card flex gap-4"
          style={{ display: "flex", gap: "1rem" }}
        >
          <div className="text-3xl flex-shrink-0">{item.icon}</div>
          <div className="flex-1">
            <div className="font-bold text-lg" style={{ color: "var(--text)" }}>
              {item.title}
            </div>
            <div className="text-base mt-1 font-medium" style={{ color: "var(--text-dim)" }}>
              {item.desc}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}