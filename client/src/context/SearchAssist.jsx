import { FileText, Loader2, Sparkles, BookOpen, ChevronRight, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchOverview, llmGenerate } from "../api/llm";
import { useContentStore } from "../stores/contentStore";
import { useSearchStore } from "../stores/searchStore";
import MarkdownRenderer from "../components/MarkdownRenderer";

const ELABORATE_KEY = (q) => q + "__elaborate";
const STUDY_KEY = (q) => q + "__study";

export default function SearchAssist() {
  const query = useSearchStore((s) => s.query);
  const results = useSearchStore((s) => s.results);
  const suggestions = useSearchStore((s) => s.suggestions);
  const search = useSearchStore((s) => s.search);

  const storeOverviews = useContentStore((s) => s.overviews);
  const setOverviewInStore = useContentStore((s) => s.setOverview);

  const [shortOverview, setShortOverview] = useState(null);
  const [elaborateExtension, setElaborateExtension] = useState(null);
  const [studyExtension, setStudyExtension] = useState(null);
  const [loadingShort, setLoadingShort] = useState(false);
  const [loadingElaborate, setLoadingElaborate] = useState(false);
  const [loadingStudy, setLoadingStudy] = useState(false);
  const [error, setError] = useState(null);
  const prevQueryRef = useRef("");

  useEffect(() => {
    if (!query || query === prevQueryRef.current) return;
    prevQueryRef.current = query;

    setElaborateExtension(null);
    setStudyExtension(null);
    setError(null);

    const shortCached = storeOverviews[query];
    if (shortCached) {
      setShortOverview(shortCached);
      return;
    }

    setLoadingShort(true);
    fetchOverview(query)
      .then((cached) => {
        if (cached) {
          setShortOverview(cached);
          setOverviewInStore(query, cached);
          setLoadingShort(false);
          return;
        }
        llmGenerate(query, [], "short")
          .then((data) => {
            setShortOverview(data.response);
            setOverviewInStore(query, data.response);
          })
          .catch((err) => setError(err.message))
          .finally(() => setLoadingShort(false));
      })
      .catch(() => {
        llmGenerate(query, [], "short")
          .then((data) => {
            setShortOverview(data.response);
            setOverviewInStore(query, data.response);
          })
          .catch((err) => setError(err.message))
          .finally(() => setLoadingShort(false));
      });
  }, [query, storeOverviews, setOverviewInStore]);

  const handleElaborate = useCallback(async () => {
    if (loadingElaborate || elaborateExtension) return;

    const cached = storeOverviews[ELABORATE_KEY(query)];
    if (cached) {
      setElaborateExtension(cached);
      return;
    }

    setLoadingElaborate(true);
    try {
      const data = await llmGenerate(query, [], "elaborate");
      setElaborateExtension(data.response);
      setOverviewInStore(ELABORATE_KEY(query), data.response);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingElaborate(false);
    }
  }, [query, loadingElaborate, elaborateExtension, storeOverviews, setOverviewInStore]);

  const handleStudy = useCallback(async () => {
    if (loadingStudy || studyExtension) return;

    const cached = storeOverviews[STUDY_KEY(query)];
    if (cached) {
      setStudyExtension(cached);
      return;
    }

    setLoadingStudy(true);
    try {
      const data = await llmGenerate(query, results.slice(0, 5), "study");
      setStudyExtension(data.response);
      setOverviewInStore(STUDY_KEY(query), data.response);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingStudy(false);
    }
  }, [query, results, loadingStudy, studyExtension, storeOverviews, setOverviewInStore]);

  if (!query) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center px-8">
          <div className="size-10 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-3 shadow-md">
            <Sparkles size={18} className="text-violet-400" />
          </div>
          <p className="text-sm font-medium text-muted">Search the web to view AI overview and synthesized insights</p>
        </div>
      </div>
    );
  }

  const hasContent = shortOverview || elaborateExtension || studyExtension;

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Short overview loading */}
      {loadingShort && !shortOverview && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl glass-card text-xs text-muted">
          <Loader2 size={14} className="animate-spin text-violet-400" />
          <span>Generating AI overview...</span>
        </div>
      )}

      {/* Error */}
      {error && !shortOverview && (
        <div className="px-4 py-3 text-xs text-muted rounded-xl glass-card border-red-500/20 bg-red-500/5">
          AI overview unavailable. {error.includes("404") ? "The AI service is not configured." : error}
        </div>
      )}

      {/* AI Overview Card */}
      {hasContent && (
        <div className="relative rounded-2xl glass-card border-violet-500/30 overflow-hidden shadow-xl shadow-violet-500/5">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/80 bg-surface/50">
            <Sparkles size={14} className="text-violet-400 shrink-0" />
            <span className="text-xs font-bold text-text uppercase tracking-wider font-heading">AI Overview</span>
          </div>

          <div className="px-4 py-3.5 space-y-3 text-sm text-text leading-relaxed">
            {shortOverview && <div className="leading-relaxed opacity-95">{shortOverview}</div>}

            {elaborateExtension && (
              <>
                <hr className="border-border/60" />
                <MarkdownRenderer>{elaborateExtension}</MarkdownRenderer>
              </>
            )}

            {studyExtension && (
              <>
                <hr className="border-border/60" />
                <MarkdownRenderer>{studyExtension}</MarkdownRenderer>
              </>
            )}
          </div>

          {shortOverview && (
            <div className="flex items-center gap-2 px-4 py-3 border-t border-border/80 bg-surface/30">
              <button
                onClick={handleElaborate}
                disabled={loadingElaborate || !!elaborateExtension}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-text border border-border/80 hover:bg-violet-500/15 hover:border-violet-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loadingElaborate ? (
                  <Loader2 size={12} className="animate-spin text-violet-400" />
                ) : (
                  <FileText size={12} className="text-violet-400" />
                )}
                {elaborateExtension ? "Elaborated" : "Elaborate"}
              </button>
              <button
                onClick={handleStudy}
                disabled={loadingStudy || !!studyExtension}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-text border border-border/80 hover:bg-cyan-500/15 hover:border-cyan-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loadingStudy ? (
                  <Loader2 size={12} className="animate-spin text-cyan-400" />
                ) : (
                  <BookOpen size={12} className="text-cyan-400" />
                )}
                {studyExtension ? "Studied" : "Study Results"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Generate AI button if not loaded */}
      {!loadingShort && !shortOverview && !error && results.length > 0 && (
        <button
          onClick={() => {
            setLoadingShort(true);
            llmGenerate(query, [], "short")
              .then((data) => {
                setShortOverview(data.response);
                setOverviewInStore(query, data.response);
              })
              .catch((err) => setError(err.message))
              .finally(() => setLoadingShort(false));
          }}
          className="flex items-center gap-2 text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors px-2 py-1.5 rounded-xl hover:bg-violet-500/10 border border-transparent hover:border-violet-500/20"
        >
          <Sparkles size={13} />
          <span>Generate AI overview</span>
        </button>
      )}

      {/* Related Searches */}
      <div className="pt-2">
        <div className="text-xs font-bold text-muted uppercase tracking-wider mb-2.5 px-1 font-heading">
          Related Searches
        </div>
        <div className="space-y-1.5">
          {suggestions.length > 0 ? suggestions.slice(0, 6).map((s, i) => (
            <button
              key={i}
              onClick={() => search(s)}
              className="flex items-center gap-3 w-full px-3.5 py-2.5 rounded-xl glass-card hover:border-violet-500/40 text-left group"
            >
              <Search size={14} className="text-dim group-hover:text-violet-400 shrink-0 transition-colors" />
              <span className="text-sm text-text font-medium flex-1 truncate group-hover:text-violet-300 transition-colors">{s}</span>
              <ChevronRight size={14} className="text-dim group-hover:translate-x-1 group-hover:text-violet-400 shrink-0 transition-all" />
            </button>
          )) : (
            <>
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 w-full px-3.5 py-2.5 rounded-xl glass-card opacity-50">
                  <Search size={14} className="text-dim shrink-0" />
                  <span className="text-sm text-muted flex-1 truncate">Search topics related to query</span>
                  <ChevronRight size={14} className="text-dim shrink-0" />
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

