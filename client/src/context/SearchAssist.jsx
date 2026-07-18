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
      <div className="flex items-center justify-center py-12">
        <div className="text-center px-8">
          <div className="size-8 rounded border border-border flex items-center justify-center mx-auto mb-3">
            <Sparkles size={16} className="text-text" />
          </div>
          <p className="text-sm text-muted">Search the web to see an AI-powered overview here</p>
        </div>
      </div>
    );
  }

  const hasContent = shortOverview || elaborateExtension || studyExtension;

  return (
    <div className="h-full overflow-y-auto p-3 space-y-3">
      {/* Short overview loading */}
      {loadingShort && !shortOverview && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded border border-border bg-white text-xs text-muted">
          <Loader2 size={12} className="animate-spin" />
          Generating overview...
        </div>
      )}

      {/* Error */}
      {error && !shortOverview && (
        <div className="px-3 py-2.5 text-xs text-muted rounded border border-border bg-white">
          AI overview unavailable. {error.includes("404") ? "The AI service is not configured." : error}
        </div>
      )}

      {/* Overview card */}
      {hasContent && (
        <div className="relative rounded-xl border border-border bg-white">
          <div className="absolute bottom-0 left-0 size-6 rounded-tr-2xl bg-white z-10" />
          <div className="absolute bottom-0 left-0 size-7 rounded-tr-2xl bg-black z-0" />
          <div className="absolute bottom-0 right-0 size-6 rounded-tl-2xl bg-white z-10" />
          <div className="absolute bottom-0 right-0 size-7 rounded-tl-2xl bg-black z-0" />

          <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border">
            <Sparkles size={13} className="text-text shrink-0" />
            <span className="text-xs font-semibold text-text">AI Overview</span>
          </div>

          <div className="px-4 py-3 space-y-2 text-sm text-text leading-relaxed">
            {shortOverview && <div>{shortOverview}</div>}

            {elaborateExtension && (
              <>
                <hr className="border-border" />
                <MarkdownRenderer>{elaborateExtension}</MarkdownRenderer>
              </>
            )}

            {studyExtension && (
              <>
                <hr className="border-border" />
                <MarkdownRenderer>{studyExtension}</MarkdownRenderer>
              </>
            )}
          </div>

          {shortOverview && (
            <div className="flex items-center gap-2 px-4 py-3 border-t border-border">
              <button
                onClick={handleElaborate}
                disabled={loadingElaborate || !!elaborateExtension}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] text-text border border-border hover:bg-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loadingElaborate ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <FileText size={11} />
                )}
                {elaborateExtension ? "Elaborated" : "Elaborate"}
              </button>
              <button
                onClick={handleStudy}
                disabled={loadingStudy || !!studyExtension}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] text-text border border-border hover:bg-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loadingStudy ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <BookOpen size={11} />
                )}
                {studyExtension ? "Studied" : "Study Results"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Not loaded yet — show generate button */}
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
          className="flex items-center gap-1.5 text-xs text-text hover:text-muted transition-colors px-1"
        >
          <Sparkles size={12} />
          Generate AI overview
        </button>
      )}

      {/* Related Searches — stacked cards */}
      <div>
        <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-2 px-1">
          Related Searches
        </div>
        <div className="space-y-1">
          {suggestions.length > 0 ? suggestions.slice(0, 6).map((s, i) => (
            <button
              key={i}
              onClick={() => search(s)}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg border border-border bg-white hover:bg-hover transition-colors text-left"
            >
              <Search size={14} className="text-dim shrink-0" />
              <span className="text-sm text-text flex-1 truncate">{s}</span>
              <ChevronRight size={14} className="text-dim shrink-0" />
            </button>
          )) : (
            <>
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg border border-border bg-white text-left opacity-40">
                  <Search size={14} className="text-dim shrink-0" />
                  <span className="text-sm text-muted flex-1 truncate">Search related to your query</span>
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
