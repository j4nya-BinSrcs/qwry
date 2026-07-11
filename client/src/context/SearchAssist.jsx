import { ChevronDown, ChevronRight, Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchStore } from "../stores/searchStore";
import { llmGenerate } from "../api/llm";

export default function SearchAssist() {
  const query = useSearchStore((s) => s.query);
  const results = useSearchStore((s) => s.results);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState(null);
  const prevQueryRef = useRef("");

  const generateOverview = useCallback(async (full) => {
    if (!query || results.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const topResults = results.slice(0, full ? 20 : 5);
      const data = await llmGenerate(query, topResults);
      setOverview(data.response);
    } catch (err) {
      setError(err.message);
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }, [query, results]);

  useEffect(() => {
    if (query && query !== prevQueryRef.current && results.length > 0) {
      prevQueryRef.current = query;
      generateOverview(false);
    }
  }, [query, results, generateOverview]);

  if (!query) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center px-8">
          <div className="size-8 rounded bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-3">
            <Sparkles size={16} className="text-accent" />
          </div>
          <p className="text-sm text-muted">Search the web to see an AI-powered overview here</p>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return null;
  }

  return (
    <div className="p-3">
      {/* Quick summary */}
      {loading && !overview && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded bg-accent/5 border border-accent/10 text-xs text-muted">
          <Loader2 size={12} className="animate-spin text-accent" />
          Generating overview...
        </div>
      )}

      {error && !overview && (
        <div className="px-3 py-2.5 text-xs text-muted rounded bg-hover border border-border">
          AI overview unavailable. {error.includes("404") ? "The AI service is not configured." : error}
        </div>
      )}

      {overview && (
        <div className="rounded bg-accent/5 border border-accent/10 overflow-hidden">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 w-full px-3 py-2 text-xs font-semibold text-accent hover:bg-accent/5 transition-colors"
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <Sparkles size={12} />
            <span>AI Overview</span>
          </button>
          {expanded && (
            <div className="px-3 pb-3">
              <p className="text-xs text-text leading-relaxed whitespace-pre-line">
                {overview}
              </p>
            </div>
          )}
          {!expanded && (
            <p className="px-3 pb-2 text-xs text-text leading-relaxed line-clamp-3">
              {overview}
            </p>
          )}
        </div>
      )}

      {!loading && !overview && !error && (
        <button
          onClick={() => generateOverview(true)}
          className="flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover transition-colors px-1"
        >
          <Sparkles size={12} />
          Generate AI overview
        </button>
      )}
    </div>
  );
}
