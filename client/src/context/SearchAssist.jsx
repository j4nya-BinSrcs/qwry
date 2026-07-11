import { FileText, Loader2, Sparkles, BookOpen, ChevronDown, ChevronRight } from "lucide-react";
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

  const [relatedOpen, setRelatedOpen] = useState(false);
  const [shortOverview, setShortOverview] = useState(null);
  const [elaborateExtension, setElaborateExtension] = useState(null);
  const [studyExtension, setStudyExtension] = useState(null);
  const [loadingShort, setLoadingShort] = useState(false);
  const [loadingElaborate, setLoadingElaborate] = useState(false);
  const [loadingStudy, setLoadingStudy] = useState(false);
  const [error, setError] = useState(null);
  const prevQueryRef = useRef("");

  // Generate short overview on query change
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
          <div className="size-8 rounded bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-3">
            <Sparkles size={16} className="text-accent" />
          </div>
          <p className="text-sm text-muted">Search the web to see an AI-powered overview here</p>
        </div>
      </div>
    );
  }

  const hasContent = shortOverview || elaborateExtension || studyExtension;

  return (
    <div className="h-full overflow-y-auto p-3">
      {/* Short overview loading */}
      {loadingShort && !shortOverview && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded bg-accent/5 border border-accent/10 text-xs text-muted">
          <Loader2 size={12} className="animate-spin text-accent" />
          Generating overview...
        </div>
      )}

      {/* Error */}
      {error && !shortOverview && (
        <div className="px-3 py-2.5 text-xs text-muted rounded bg-hover border border-border">
          AI overview unavailable. {error.includes("404") ? "The AI service is not configured." : error}
        </div>
      )}

      {/* Overview section */}
      {hasContent && (
        <div className="rounded bg-accent/5 border border-accent/10">
          <div className="flex items-center gap-1.5 px-3 py-2 border-b border-accent/10">
            <Sparkles size={12} className="text-accent shrink-0" />
            <span className="text-xs font-semibold text-accent">AI Overview</span>
          </div>
          <div className="px-3 py-2.5 space-y-2 text-sm text-text leading-relaxed">
            {shortOverview && <div>{shortOverview}</div>}

            {elaborateExtension && (
              <>
                <hr className="border-accent/10" />
                <MarkdownRenderer>{elaborateExtension}</MarkdownRenderer>
              </>
            )}

            {studyExtension && (
              <>
                <hr className="border-accent/10" />
                <MarkdownRenderer>{studyExtension}</MarkdownRenderer>
              </>
            )}
          </div>

          {shortOverview && (
            <div className="flex items-center gap-2 px-3 py-2 border-t border-accent/10">
              <button
                onClick={handleElaborate}
                disabled={loadingElaborate || !!elaborateExtension}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] text-accent hover:bg-accent/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] text-accent hover:bg-accent/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
          className="flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover transition-colors px-1"
        >
          <Sparkles size={12} />
          Generate AI overview
        </button>
      )}

      {/* Related Searches — always visible */}
      <div className="mt-3 rounded border border-border overflow-hidden">
        <button
          onClick={() => setRelatedOpen(!relatedOpen)}
          className="flex items-center gap-2 w-full px-3 py-2 text-xs font-semibold text-muted uppercase tracking-wider hover:text-text transition-colors"
        >
          {relatedOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          <span>Related Searches</span>
          <span className="text-dim font-normal">{suggestions.length}</span>
        </button>
        {relatedOpen && suggestions.length > 0 && (
          <div className="px-3 pb-2 flex flex-wrap gap-1.5">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => search(s)}
                className="px-2.5 py-1 text-[10px] rounded-full bg-hover text-muted border border-border hover:text-text hover:border-accent/30 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
