export default function Steps({ steps }) {
  return (
    <div className="space-y-4">
      {steps.map((s, i) => (
        <div key={i} className="flex gap-4">
          <div
            className="w-7 h-7 rounded-full text-white text-sm flex items-center justify-center flex-shrink-0 font-bold"
            style={{ backgroundColor: "var(--accent)" }}
          >
            {i + 1}
          </div>
          <div className="text-base font-medium pt-0.5" style={{ color: "var(--text)" }}>
            {s}
          </div>
        </div>
      ))}
    </div>
  );
}