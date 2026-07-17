import type { GraphStructure, QueryResponse } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

async function parseOrThrow<T>(response: Response, label: string): Promise<T> {
  if (!response.ok) {
    throw new Error(`${label} failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchGraphStructure(): Promise<GraphStructure> {
  const response = await fetch(`${API_BASE_URL}/graph/structure`);
  return parseOrThrow<GraphStructure>(response, "fetchGraphStructure");
}

export async function postQuery(message: string, threadId?: string): Promise<QueryResponse> {
  const response = await fetch(`${API_BASE_URL}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, thread_id: threadId ?? null }),
  });
  return parseOrThrow<QueryResponse>(response, "postQuery");
}

export async function postApprove(threadId: string, approved: boolean): Promise<QueryResponse> {
  const response = await fetch(`${API_BASE_URL}/approve/${threadId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ approved }),
  });
  return parseOrThrow<QueryResponse>(response, "postApprove");
}
