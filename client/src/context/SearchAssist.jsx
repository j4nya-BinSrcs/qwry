import { Loader2, Sparkles, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchStore } from "../stores/searchStore";
import { llmGenerate } from "../api/llm";
import MarkdownRenderer from "../components/MarkdownRenderer";

export default function SearchAssist() {
  const query = useSearchStore((s) => s.query);
  const results = useSearchStore((s) => s.results);
  const search = useSearchStore((s) => s.search);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [deepLoading, setDeepLoading] = useState(false);
  const [error, setError] = useState(null);
  const prevQueryRef = useRef("");

  const generateOverview = useCallback(async (deep) => {
    if (!query || results.length === 0) return;
    if (deep) {
      setDeepLoading(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const topResults = results.slice(0, deep ? 50 : 10);
      const data = await llmGenerate(query, topResults);
      setOverview(data.response);
    } catch (err) {
      setError(err.message);
      setOverview(null);
    } finally {
      setLoading(false);
      setDeepLoading(false);
    }
  }, [query, results]);

  useEffect(() => {
    if (query && query !== prevQueryRef.current && results.length > 0) {
      prevQueryRef.current = query;
      generateOverview(false);
    }
  }, [query, results, generateOverview]);

  const handleDeepSearch = useCallback(() => {
    search(query);
    generateOverview(true);
  }, [query, search, generateOverview]);

  if (!query) {
    return (
      <div className="flex items-center justify-center py-12">
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
        <div className="rounded bg-accent/5 border border-accent/10">
          <div className="flex items-center justify-between px-3 py-2 border-b border-accent/10">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-accent">
              <Sparkles size={12} />
              <span>AI Overview</span>
            </div>
            <button
              onClick={handleDeepSearch}
              disabled={deepLoading}
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-accent hover:bg-accent/10 transition-colors disabled:opacity-50"
            >
              {deepLoading ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <Search size={11} />
              )}
              Deep Search
            </button>
          </div>
          <div className="px-3 py-2.5">
            <MarkdownRenderer>{overview}</MarkdownRenderer>
          </div>
        </div>
      )}

      {!loading && !overview && !error && (
        <button
          onClick={() => generateOverview(false)}
          className="flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover transition-colors px-1"
        >
          <Sparkles size={12} />
          Generate AI overview
        </button>
      )}
    </div>
  );
}
