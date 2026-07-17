import { useState, type FormEvent } from "react";

interface QueryInputProps {
  onSubmit: (message: string) => void;
  disabled: boolean;
}

export function QueryInput({ onSubmit, disabled }: QueryInputProps) {
  const [value, setValue] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue("");
  }

  return (
    <div className="space-y-2">
      <form
        onSubmit={handleSubmit}
        className="flex gap-2 rounded-card border border-line bg-surface p-2 shadow-card"
      >
        <input
          aria-label="Ask SpendWeiss"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={disabled}
          placeholder="Ask about a purchase or your subscriptions..."
          className="flex-1 rounded-control bg-transparent px-3 py-2.5 text-ink placeholder:text-muted/70 focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled}
          className="rounded-control bg-teal px-5 py-2.5 font-medium text-white transition-colors hover:bg-teal-deep disabled:cursor-not-allowed disabled:opacity-40"
        >
          Send
        </button>
      </form>
      <div className="px-2 text-xs text-muted">
        <span className="font-medium text-ink">Try:</span>{" "}
        <span className="mr-2">What card should I use for groceries?</span>
        <span>Is my Netflix bill actually a subscription?</span>
      </div>
    </div>
  );
}
