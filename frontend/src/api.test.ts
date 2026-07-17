import { describe, expect, it, vi, beforeEach } from "vitest";
import { fetchGraphStructure, postQuery, postApprove } from "./api";

describe("api client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("fetchGraphStructure calls GET /graph/structure and returns parsed JSON", async () => {
    const fakeStructure = { nodes: [{ id: "reason", graph: "card_optimizer" }], edges: [] };
    (fetch as any).mockResolvedValue({ ok: true, json: async () => fakeStructure });

    const result = await fetchGraphStructure();

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/graph/structure"));
    expect(result).toEqual(fakeStructure);
  });

  it("postQuery sends message and thread_id, returns parsed JSON", async () => {
    const fakeResponse = { thread_id: "abc", status: "completed", classification: "card_optimizer", trace: [], reply: "Use HDFC Millennia." };
    (fetch as any).mockResolvedValue({ ok: true, json: async () => fakeResponse });

    const result = await postQuery("What card for groceries?", "abc");

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/query"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ message: "What card for groceries?", thread_id: "abc" }),
      })
    );
    expect(result).toEqual(fakeResponse);
  });

  it("postQuery omits thread_id as null when not provided", async () => {
    (fetch as any).mockResolvedValue({ ok: true, json: async () => ({}) });

    await postQuery("hi");

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/query"),
      expect.objectContaining({ body: JSON.stringify({ message: "hi", thread_id: null }) })
    );
  });

  it("postApprove sends approved flag to /approve/{thread_id}", async () => {
    const fakeResponse = { thread_id: "abc", status: "completed", classification: "card_optimizer", trace: [], reply: "Approved." };
    (fetch as any).mockResolvedValue({ ok: true, json: async () => fakeResponse });

    const result = await postApprove("abc", true);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/approve/abc"),
      expect.objectContaining({ method: "POST", body: JSON.stringify({ approved: true }) })
    );
    expect(result).toEqual(fakeResponse);
  });

  it("throws a descriptive error when the response is not ok", async () => {
    (fetch as any).mockResolvedValue({ ok: false, status: 404 });

    await expect(postApprove("unknown-thread", true)).rejects.toThrow("404");
  });
});
