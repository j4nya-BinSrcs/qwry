import { ExternalLink, Loader2, Sparkles, X, ChevronDown, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "../api/client";
import { useContentStore } from "../stores/contentStore";
import { useUIStore } from "../stores/uiStore";
import MarkdownRenderer from "../components/MarkdownRenderer";

function getHostname(url) {
  try { return new URL(url).hostname; } catch { return url || ""; }
}

export default function SummarizerView() {
  const summarizeUrl = useUIStore((s) => s.summarizeUrl);
  const summarizeTitle = useUIStore((s) => s.summarizeTitle);
  const summarizeVersion = useUIStore((s) => s.summarizeVersion);

  const storeSummaries = useContentStore((s) => s.summaries);
  const addSummary = useContentStore((s) => s.addSummary);
  const removeSummaryFromStore = useContentStore((s) => s.removeSummary);

  const [expanded, setExpanded] = useState(new Set());
  const [loadingUrl, setLoadingUrl] = useState(null);
  const [loadingId, setLoadingId] = useState(null);
  const loadingRef = useRef(null);

  // Merge store summaries with in-progress loading entry
  const summaries = useMemo(() => {
    const all = [...storeSummaries];
    if (loadingUrl && !all.some((s) => s.url === loadingUrl)) {
      all.unshift({
        id: loadingId,
        url: loadingUrl,
        title: summarizeTitle,
        loading: true,
        error: null,
        summary: null,
        provider: null,
      });
    }
    return all;
  }, [storeSummaries, loadingUrl, loadingId, summarizeTitle]);

  useEffect(() => {
    if (!summarizeUrl) return;

    const existing = storeSummaries.find((s) => s.url === summarizeUrl);
    if (existing) {
      setExpanded((prev) => new Set([...prev, existing.id]));
      return;
    }

    if (loadingRef.current === summarizeUrl) return;
    loadingRef.current = summarizeUrl;

    const id = crypto.randomUUID();
    setLoadingUrl(summarizeUrl);
    setLoadingId(id);
    setExpanded((prev) => new Set([...prev, id]));

    let cancelled = false;
    apiFetch("/api/summarize", {
      method: "POST",
      body: JSON.stringify({ url: summarizeUrl }),
    })
      .then((r) => {
        if (cancelled) return;
        if (!r.ok) throw new Error(`Failed: ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (cancelled) return;
        addSummary({ id, url: summarizeUrl, title: d.title || summarizeTitle, loading: false, error: null, summary: d.summary, provider: d.provider || "unknown" });
        if (!cancelled) {
          setLoadingUrl(null);
          setLoadingId(null);
          loadingRef.current = null;
        }
      })
      .catch((err) => {
        if (cancelled) return;
        addSummary({ id, url: summarizeUrl, title: summarizeTitle, loading: false, error: err.message, summary: null, provider: null });
        if (!cancelled) {
          setLoadingUrl(null);
          setLoadingId(null);
          loadingRef.current = null;
        }
      });
    return () => { cancelled = true; };
  }, [summarizeUrl, summarizeVersion, summarizeTitle, storeSummaries, addSummary]);

  const removeSummary = useCallback(
    (id, url) => {
      loadingRef.current?.delete?.(url);
      removeSummaryFromStore(url);
      setExpanded((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
    [removeSummaryFromStore],
  );

  const toggleSummary = useCallback((id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  if (!summarizeUrl && storeSummaries.length === 0 && !loadingUrl) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center px-8">
          <div className="size-8 rounded bg-hover border border-border flex items-center justify-center mx-auto mb-3">
            <Sparkles size={16} className="text-text" />
          </div>
          <p className="text-sm text-muted">Select a result to summarize</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 px-3 py-2 border-b border-border">
        <h2 className="text-sm font-semibold text-text">Summarizer</h2>
        <p className="text-[10px] text-muted">{summaries.length} {summaries.length === 1 ? "summary" : "summaries"}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {summaries.map((s) => (
          <div key={s.id} className="rounded bg-panel border border-border overflow-hidden">
            <div
              className="flex items-center gap-2 px-3 py-2 border-b border-border cursor-pointer hover:bg-hover transition-colors"
              onClick={() => toggleSummary(s.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-text truncate">{s.title || getHostname(s.url)}</div>
                <a href={s.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[10px] text-text hover:text-muted mt-0.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink size={10} />
                  {getHostname(s.url)}
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
                  className="p-1 rounded text-dim hover:text-text hover:bg-hover transition-all"
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
                    <Loader2 size={12} className="animate-spin text-text" />
                    Summarizing...
                  </div>
                )}
                {s.error && (
                  <div className="py-3 text-center space-y-2">
                    <p className="text-xs text-muted">Could not generate a summary for this page.</p>
                    <p className="text-[10px] text-dim">{s.error}</p>
                    <a href={s.url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded bg-text text-surface hover:bg-text/80 transition-colors"
                    ><ExternalLink size={11} /> Open in browser</a>
                  </div>
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
