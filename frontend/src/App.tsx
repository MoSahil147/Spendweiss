import { useEffect, useState } from "react";
import { fetchGraphStructure, postApprove, postQuery } from "./api";
import { QueryInput } from "./components/QueryInput";
import { AnswerCard } from "./components/AnswerCard";
import { DecisionDiagram } from "./components/DecisionDiagram";
import { DecisionLogPanel } from "./components/DecisionLogPanel";
import type { QueryResponse, TraceEntry } from "./types";

interface ConversationEntry {
  query: string;
  response: QueryResponse;
  expandedTrace: TraceEntry[] | null;
}

function App() {
  const [threadId, setThreadId] = useState<string | undefined>(undefined);
  const [entries, setEntries] = useState<ConversationEntry[]>([]);
  const [pending, setPending] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    fetchGraphStructure()
      .then(() => {
        if (active) {
          setStatusMessage(null);
        }
      })
      .catch((error) => {
        if (active) {
          setStatusMessage(error instanceof Error ? error.message : "Unable to reach the SpendWeiss API.");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(message: string) {
    setPending(true);
    setPendingMessage(message);
    setStatusMessage(null);

    try {
      const response = await postQuery(message, threadId);
      setThreadId(response.thread_id);
      setEntries((prev) => [...prev, { query: message, response, expandedTrace: null }]);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to send your message right now.");
    } finally {
      setPending(false);
      setPendingMessage(null);
    }
  }

  async function handleApprove(index: number, approved: boolean) {
    const entry = entries[index];
    if (entry.response.status !== "pending_approval") return;

    setStatusMessage(null);

    try {
      const response = await postApprove(entry.response.thread_id, approved);
      setEntries((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, response } : item)));
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to complete the approval decision.");
    }
  }

  function handleExpandDiagram(index: number, trace: TraceEntry[]) {
    setEntries((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, expandedTrace: trace } : item)));
  }

  return (
    <div className="max-w-6xl mx-auto px-5 py-10 pb-16 space-y-8">
      <div className="border-b border-line pb-5">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">SpendWeiss</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Ask a purchase question, inspect the decision path, and approve or decline the recommendation in place.
        </p>
      </div>

      {statusMessage && (
        <div className="rounded-card border border-gold/30 bg-gold-tint/70 px-4 py-3 text-sm text-ink">
          {statusMessage}
        </div>
      )}

      {pendingMessage && (
        <div className="rounded-card border border-teal/25 bg-teal-tint/50 p-4 shadow-card">
          <div className="flex items-center gap-2 text-sm font-medium text-teal-deep">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-teal" />
            Processing your request…
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted">{pendingMessage}</p>
        </div>
      )}

      {entries.map((entry, index) => (
        <div key={index} className="space-y-3">
          <AnswerCard
            query={entry.query}
            response={entry.response}
            onApprove={(approved) => handleApprove(index, approved)}
            onExpandDiagram={(trace) => handleExpandDiagram(index, trace)}
          />
          {entry.expandedTrace && (
            <>
              <DecisionDiagram trace={entry.expandedTrace} query={entry.query} />
              <DecisionLogPanel trace={entry.expandedTrace} />
            </>
          )}
        </div>
      ))}

      <QueryInput onSubmit={handleSubmit} disabled={pending} />
    </div>
  );
}

export default App;
