import type { TraceEntry } from "../types";

interface NodeDetailPanelProps {
  entry: TraceEntry | null;
  onClose: () => void;
}

export function NodeDetailPanel({ entry, onClose }: NodeDetailPanelProps) {
  if (!entry) return null;

  return (
    <div className="mt-1 rounded-card border border-teal/25 bg-teal-tint/40 p-4 shadow-card">
      <div className="flex items-start justify-between">
        <p className="font-mono text-sm font-semibold uppercase tracking-wide text-teal-deep">{entry.node}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mt-1 -mr-1 flex h-7 w-7 items-center justify-center rounded-control text-lg leading-none text-muted transition-colors hover:bg-surface hover:text-ink"
        >
          ×
        </button>
      </div>
      <p className="mt-1 text-xs uppercase tracking-wide text-muted">Data source: {entry.graph}</p>
      <p className="mt-2 text-sm leading-relaxed text-ink">{entry.summary}</p>
      {entry.detail && <p className="mt-2 text-sm leading-relaxed text-muted">{entry.detail}</p>}
    </div>
  );
}
