import type { TraceEntry } from "../types";

interface DecisionLogPanelProps {
  trace: TraceEntry[];
}

export function DecisionLogPanel({ trace }: DecisionLogPanelProps) {
  if (trace.length === 0) return null;

  return (
    <div className="rounded-card border border-line bg-surface-raise shadow-card">
      <div className="border-b border-line bg-paper/80 px-4 py-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Decision log</p>
        <p className="mt-1 text-sm leading-relaxed text-ink">
          Full step-by-step reasoning, including the longer summaries that do not fit cleanly inside the diagram.
        </p>
      </div>
      <div className="space-y-3 p-4">
        {trace.map((entry, index) => (
          <div key={`${entry.node}-${index}`} className="rounded-control border border-line bg-paper px-4 py-4">
            <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-deep">
                Step {index + 1}
              </span>
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">{entry.graph}</span>
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink">{entry.node}</span>
            </div>
            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-sm leading-7 text-ink font-sans">
              {entry.detail || entry.summary || "No explanation captured."}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}
