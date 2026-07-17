import type { QueryResponse, TraceEntry } from "../types";

interface AnswerCardProps {
  query: string;
  response: QueryResponse;
  onApprove: (approved: boolean) => void;
  onExpandDiagram: (trace: TraceEntry[]) => void;
}

export function AnswerCard({ query, response, onApprove, onExpandDiagram }: AnswerCardProps) {
  return (
    <div className="space-y-3 rounded-card border border-line border-l-[3px] border-l-teal bg-surface p-5 shadow-card">
      <p className="font-mono text-[13px] font-medium leading-relaxed text-muted">{query}</p>

      {response.status === "completed" && (
        <>
          <p className="text-[15px] leading-relaxed text-ink">{response.reply}</p>
          {response.trace.length > 0 && (
            <button
              type="button"
              onClick={() => onExpandDiagram(response.trace)}
              className="inline-flex items-center gap-1.5 rounded-control bg-teal-tint px-3 py-1.5 text-sm font-medium text-teal-deep transition-colors hover:bg-teal hover:text-white"
            >
              See the flow and decision log
            </button>
          )}
        </>
      )}

      {response.status === "pending_approval" && (
        <>
          <p className="rounded-control bg-gold-tint px-3 py-2 text-[15px] leading-relaxed text-ink">{response.pending_action}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onApprove(true)}
              className="rounded-control bg-teal px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-teal-deep"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => onApprove(false)}
              className="rounded-control border border-line px-4 py-1.5 text-sm font-medium text-ink transition-colors hover:border-ink/40 hover:bg-paper"
            >
              Decline
            </button>
          </div>
        </>
      )}
    </div>
  );
}
