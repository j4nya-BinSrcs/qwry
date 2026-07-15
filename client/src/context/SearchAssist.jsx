import { ChevronRight, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchOverview, llmGenerate } from "../api/llm";
import { useSearchStore } from "../stores/searchStore";

export default function SearchAssist() {
  const query = useSearchStore((s) => s.query);
  const results = useSearchStore((s) => s.results);
  const suggestions = useSearchStore((s) => s.suggestions);
  const search = useSearchStore((s) => s.search);

  const [shortOverview, setShortOverview] = useState(null);
  const [loadingShort, setLoadingShort] = useState(false);
  const [error, setError] = useState(null);
  const prevQueryRef = useRef("");

  useEffect(() => {
    if (!query || query === prevQueryRef.current) return;
    prevQueryRef.current = query;

    setError(null);

    setLoadingShort(true);
    fetchOverview(query)
      .then((cached) => {
        if (cached) {
          setShortOverview(cached);
          setLoadingShort(false);
          return;
        }
        llmGenerate(query, [], "short")
          .then((data) => setShortOverview(data.response))
          .catch((err) => setError(err.message))
          .finally(() => setLoadingShort(false));
      })
      .catch(() => {
        llmGenerate(query, [], "short")
          .then((data) => setShortOverview(data.response))
          .catch((err) => setError(err.message))
          .finally(() => setLoadingShort(false));
      });
  }, [query]);

  const handleElaborate = useCallback(async () => {
    if (!query) return;
    try {
      const data = await llmGenerate(query, [], "elaborate");
      setShortOverview(data.response);
    } catch (err) {
      setError(err.message);
    }
  }, [query]);

  const handleStudy = useCallback(async () => {
    if (!query) return;
    try {
      const data = await llmGenerate(query, results.slice(0, 5), "study");
      setShortOverview(data.response);
    } catch (err) {
      setError(err.message);
    }
  }, [query, results]);

  if (!query) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-muted">Search the web to see an AI-powered overview here</p>
      </div>
    );
  }

  const defaultSuggestions = [
    "espresso",
    "history of coffee",
    "cold brew coffee",
    "decaf coffee",
    "instant coffee",
    "On the Web: History of Coffee (June 24, 2018)",
  ];

  const displaySuggestions = suggestions.length > 0 ? suggestions : defaultSuggestions;

  return (
    <div className="h-full overflow-y-auto p-4 space-y-6">
      {loadingShort && !shortOverview && (
        <div className="flex items-center gap-2 px-4 py-3 border border-border rounded-lg text-xs text-muted">
          <div className="size-3 border-2 border-text border-t-transparent rounded-full animate-spin" />
          Generating overview...
        </div>
      )}

      {error && !shortOverview && (
        <div className="px-4 py-3 text-xs text-muted border border-border rounded-lg">
          AI overview unavailable. {error.includes("404") ? "The AI service is not configured." : error}
        </div>
      )}

      {(shortOverview || loadingShort) && (
        <div className="decorated-corner rounded-xl border border-border bg-white">
          <div className="px-5 pt-5 pb-3">
            <h3 className="text-xs font-bold text-text uppercase tracking-widest mb-3">
              AI OVERVIEW
            </h3>
            <div className="text-sm text-text leading-relaxed">
              {loadingShort ? (
                <div className="flex items-center gap-2">
                  <div className="size-3 border-2 border-text border-t-transparent rounded-full animate-spin" />
                  Generating overview...
                </div>
              ) : (
                shortOverview
              )}
            </div>
          </div>
          {!loadingShort && (
            <div className="flex items-center gap-5 px-5 pb-5 pt-2">
              <button
                onClick={handleElaborate}
                className="flex items-center gap-1 text-xs text-text hover:text-muted transition-colors"
              >
                Elaborate
                <span className="text-sm">→</span>
              </button>
              <button
                onClick={handleStudy}
                className="flex items-center gap-1 text-xs text-text hover:text-muted transition-colors"
              >
                Study Results
                <span className="text-sm">→</span>
              </button>
            </div>
          )}
        </div>
      )}

      {!loadingShort && !shortOverview && !error && results.length > 0 && (
        <button
          onClick={() => {
            setLoadingShort(true);
            llmGenerate(query, [], "short")
              .then((data) => setShortOverview(data.response))
              .catch((err) => setError(err.message))
              .finally(() => setLoadingShort(false));
          }}
          className="flex items-center gap-1.5 text-xs text-text hover:text-muted transition-colors"
        >
          Generate AI overview
        </button>
      )}

      <div>
        <h4 className="text-xs font-bold text-text uppercase tracking-widest mb-3">
          RELATED SEARCHES
        </h4>
        <div className="space-y-1.5">
          {displaySuggestions.slice(0, 6).map((s, i) => (
            <button
              key={i}
              onClick={() => search(s)}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg border border-border bg-white hover:bg-hover transition-colors"
            >
              <Search size={14} className="text-text shrink-0" />
              <span className="text-xs text-text flex-1 text-left">
                {s}
              </span>
              <ChevronRight size={14} className="text-dim shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
