import { ArrowLeft, ExternalLink, Loader2, Sparkles, BookOpen } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useUIStore } from "../stores/uiStore";
import MarkdownRenderer from "../components/MarkdownRenderer";

let summaryCounter = 0;

export default function SummarizerView() {
  const summarizeUrl = useUIStore((s) => s.summarizeUrl);
  const summarizeTitle = useUIStore((s) => s.summarizeTitle);
  const setContextMode = useUIStore((s) => s.setContextMode);

  const [summaries, setSummaries] = useState([]);

  useEffect(() => {
    if (!summarizeUrl) return;
    const id = ++summaryCounter;
    const entry = { id, url: summarizeUrl, title: summarizeTitle, loading: true, error: null, summary: null, provider: null };
    setSummaries((prev) => [entry, ...prev]);

    fetch("/api/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: summarizeUrl }),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`Failed: ${r.status}`);
        return r.json();
      })
      .then((d) => {
        setSummaries((prev) =>
          prev.map((s) =>
            s.id === id ? { ...s, loading: false, summary: d.summary, provider: d.provider || "unknown" } : s
          )
        );
      })
      .catch((err) => {
        setSummaries((prev) =>
          prev.map((s) =>
            s.id === id ? { ...s, loading: false, error: err.message } : s
          )
        );
      });
  }, [summarizeUrl]);

  if (!summarizeUrl && summaries.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center px-8">
          <div className="size-8 rounded bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-3">
            <BookOpen size={16} className="text-accent" />
          </div>
          <p className="text-sm text-muted">Select a result to summarize</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 flex items-center gap-3 px-3 py-2 border-b border-border">
        <button
          onClick={() => setContextMode("search-assist")}
          className="p-1 rounded text-dim hover:text-text hover:bg-hover transition-colors"
          title="Back"
        >
          <ArrowLeft size={14} />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-text">Summarizer</h2>
          <p className="text-[10px] text-muted">{summaries.length} summary{summaries.length !== 1 ? "ies" : "y"}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {summaries.map((s) => (
          <div key={s.id} className="rounded bg-elevated border border-border overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-text truncate">
                  {s.title || new URL(s.url).hostname}
                </div>
                <a href={s.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[10px] text-accent hover:text-accent-hover mt-0.5"
                >
                  <ExternalLink size={10} />
                  {new URL(s.url).hostname}
                </a>
              </div>
              {!s.loading && s.summary && (
                <div className="flex items-center gap-1 text-[10px] text-dim shrink-0">
                  <Sparkles size={10} />
                  {s.provider}
                </div>
              )}
            </div>
            <div className="px-3 py-2">
              {s.loading && (
                <div className="flex items-center gap-1.5 text-xs text-muted">
                  <Loader2 size={12} className="animate-spin text-accent" />
                  Summarizing...
                </div>
              )}
              {s.error && (
                <p className="text-xs text-red-400">{s.error}</p>
              )}
              {s.summary && <MarkdownRenderer>{s.summary}</MarkdownRenderer>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
