import { ArrowLeft, ExternalLink, Loader2, Sparkles, X, ChevronDown, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useUIStore } from "../stores/uiStore";
import MarkdownRenderer from "../components/MarkdownRenderer";

let summaryCounter = 0;

export default function SummarizerView() {
  const summarizeUrl = useUIStore((s) => s.summarizeUrl);
  const summarizeTitle = useUIStore((s) => s.summarizeTitle);
  const summarizeVersion = useUIStore((s) => s.summarizeVersion);
  const setContextMode = useUIStore((s) => s.setContextMode);

  const [summaries, setSummaries] = useState([]);
  const [expanded, setExpanded] = useState(new Set());
  const submittedRef = useRef(new Set());

  useEffect(() => {
    if (!summarizeUrl) return;
    if (submittedRef.current.has(summarizeUrl)) return;
    submittedRef.current.add(summarizeUrl);

    const id = ++summaryCounter;
    const entry = { id, url: summarizeUrl, title: summarizeTitle, loading: true, error: null, summary: null, provider: null };
    setSummaries((prev) => [entry, ...prev]);
    setExpanded((prev) => new Set([...prev, id]));

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
  }, [summarizeUrl, summarizeVersion, summarizeTitle]);

  const removeSummary = useCallback((id, url) => {
    submittedRef.current.delete(url);
    setSummaries((prev) => prev.filter((s) => s.id !== id));
    setExpanded((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const toggleSummary = useCallback((id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  if (!summarizeUrl && summaries.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center px-8">
          <div className="size-8 rounded bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-3">
            <Sparkles size={16} className="text-accent" />
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
          <p className="text-[10px] text-muted">{summaries.length} {summaries.length === 1 ? "summary" : "summaries"}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {summaries.map((s) => (
          <div key={s.id} className="rounded bg-elevated border border-border overflow-hidden">
            <div
              className="flex items-center gap-2 px-3 py-2 border-b border-border cursor-pointer hover:bg-hover transition-colors"
              onClick={() => toggleSummary(s.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-text truncate">
                  {s.title || new URL(s.url).hostname}
                </div>
                <a href={s.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[10px] text-accent hover:text-accent-hover mt-0.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink size={10} />
                  {new URL(s.url).hostname}
                </a>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {!s.loading && s.summary && (
                  <span className="flex items-center gap-1 text-[10px] text-dim">
                    <Sparkles size={10} />
                    {s.provider}
                  </span>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); removeSummary(s.id, s.url); }}
                  className="p-1 rounded text-dim hover:text-red-400 hover:bg-red-500/10 transition-all"
                  title="Remove"
                >
                  <X size={11} />
                </button>
                {expanded.has(s.id) ? <ChevronDown size={12} className="text-dim" /> : <ChevronRight size={12} className="text-dim" />}
              </div>
            </div>
            {expanded.has(s.id) && (
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
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
