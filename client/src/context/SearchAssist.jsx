import { FileText, Loader2, Sparkles, BookOpen, ChevronRight, ChevronDown, ChevronUp, RefreshCw, Check, Copy, Bookmark, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchOverview, llmGenerate } from "../api/llm";
import { useContentStore } from "../stores/contentStore";
import { useSearchStore } from "../stores/searchStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { useSessionStore } from "../stores/sessionStore";
import { useWorkspaceStationStore } from "../stores/workspaceStationStore";
import MarkdownRenderer from "../components/MarkdownRenderer";
import Skeleton, { SkeletonOverview } from "../components/Skeleton";

const ELABORATE_KEY = (q) => q + "__elaborate";
const STUDY_KEY = (q) => q + "__study";

export default function SearchAssist() {
  const query = useSearchStore((s) => s.query);
  const results = useSearchStore((s) => s.results);
  const suggestions = useSearchStore((s) => s.suggestions);
  const search = useSearchStore((s) => s.search);
  const searchLoading = useSearchStore((s) => s.loading);

  const storeOverviews = useContentStore((s) => s.overviews);
  const setOverviewInStore = useContentStore((s) => s.setOverview);

  const activeWsId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const sessionId = useSessionStore((s) => s.sessionId);
  const station = useWorkspaceStationStore();

  const [shortOverview, setShortOverview] = useState(null);
  const [elaborateExtension, setElaborateExtension] = useState(null);
  const [studyExtension, setStudyExtension] = useState(null);
  const [loadingShort, setLoadingShort] = useState(false);
  const [loadingElaborate, setLoadingElaborate] = useState(false);
  const [loadingStudy, setLoadingStudy] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  const [savedSummary, setSavedSummary] = useState(false);
  const [saveTip, setSaveTip] = useState(null);
  const [error, setError] = useState(null);
  const prevQueryRef = useRef("");

  useEffect(() => {
    if (!query || query === prevQueryRef.current) return;
    prevQueryRef.current = query;

    setElaborateExtension(null);
    setStudyExtension(null);
    setError(null);
    setShortOverview(null);
    setExpanded(true);
    setCopied(false);
    setSavedSummary(false);
    setSaveTip(null);

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

  const handleRegenerate = useCallback(async () => {
    if (!query || regenerating) return;
    setRegenerating(true);
    setError(null);
    try {
      const data = await llmGenerate(query, [], "short");
      setShortOverview(data.response);
      setOverviewInStore(query, data.response);
    } catch (err) {
      setError(err.message);
    } finally {
      setRegenerating(false);
    }
  }, [query, regenerating, setOverviewInStore]);

  const handleCopy = useCallback(() => {
    const text = [shortOverview, elaborateExtension, studyExtension].filter(Boolean).join("\n\n");
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [shortOverview, elaborateExtension, studyExtension]);

  const handleSaveSummary = useCallback(async () => {
    if (!shortOverview || !activeWsId) return;
    if (savedSummary) {
      setSaveTip("Already saved");
      setTimeout(() => setSaveTip(null), 2000);
      return;
    }
    try {
      await station.createNote(sessionId, activeWsId, query, shortOverview);
      setSavedSummary(true);
      setSaveTip("Saved to notes");
      setTimeout(() => setSaveTip(null), 2000);
    } catch {}
  }, [shortOverview, activeWsId, savedSummary, station, sessionId, query]);

  if (!query) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center px-8">
          <div className="size-8 rounded-lg bg-elevated flex items-center justify-center mx-auto mb-3">
            <Sparkles size={16} className="text-text" />
          </div>
          <p className="text-sm text-muted">Search the web to see an AI-powered overview here</p>
        </div>
      </div>
    );
  }

  const hasContent = shortOverview || elaborateExtension || studyExtension;
  const hasExtensions = elaborateExtension || studyExtension;

  const ghostBtn = "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted hover:text-text hover:bg-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
  const primaryBtn = "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-accent text-surface hover:opacity-85 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed";
  const iconBtn = "size-8 flex items-center justify-center rounded-lg text-dim hover:text-text hover:bg-hover transition-colors disabled:opacity-30 disabled:cursor-not-allowed";

  return (
    <div className="h-full overflow-y-auto px-4 pt-3 pb-6 space-y-4">
      {/* Short overview loading */}
      {loadingShort && !shortOverview && (
        <SkeletonOverview />
      )}

      {/* Error */}
      {error && !shortOverview && (
        <div className="px-4 py-3 text-xs text-muted rounded-lg border border-border bg-panel">
          AI overview unavailable. {error.includes("404") ? "The AI service is not configured." : error}
        </div>
      )}

            {/* Overview card: the centerpiece */}
      {hasContent && (
        <div className="relative overflow-hidden rounded-2xl bg-elevated shadow-raised animate-pop-in">
          <div className="overview-glow pointer-events-none absolute inset-0" />

          <div className="relative">
            {/* Header */}
            <div className="flex items-start gap-3.5 px-5 pt-5 pb-3">
              <div className="size-10 shrink-0 rounded-xl bg-gradient-to-br from-accent/35 to-accent/10 ring-1 ring-accent/25 flex items-center justify-center shadow-raised">
                <Sparkles size={20} className="text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-semibold text-text tracking-tight">Overview</h2>
                  <span className="text-xs text-accent font-medium px-1.5 py-0.5 rounded-md bg-accent/10">
                    QWRY
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <div className="relative">
                  <button
                    onClick={handleSaveSummary}
                    disabled={!activeWsId || !shortOverview}
                    className={iconBtn}
                    title={savedSummary ? "Already saved to notes" : "Save overview to notes"}
                  >
                    {savedSummary ? <Check size={16} className="text-accent" /> : <Bookmark size={16} />}
                  </button>
                  {saveTip && (
                    <span className="absolute top-full right-0 mt-1.5 whitespace-nowrap px-2 py-1 rounded-md bg-elevated border border-border text-[11px] text-text shadow-pop animate-fade-in z-20">
                      {saveTip}
                    </span>
                  )}
                </div>
                <button onClick={handleCopy} className={iconBtn} title="Copy overview text">
                  {copied ? <Check size={16} className="text-accent" /> : <Copy size={16} />}
                </button>
              </div>
            </div>

            {/* Body */}
            <div className={`expandable px-5 ${expanded ? "max-h-[3200px] opacity-100" : "max-h-72 opacity-100"}`}>
              <div className="pt-1 pb-5">
                {shortOverview && <MarkdownRenderer>{shortOverview}</MarkdownRenderer>}

                {elaborateExtension && (
                  <div className="mt-5 pt-5 border-t border-border/60 animate-pop-in">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="size-6 rounded-lg bg-accent/10 flex items-center justify-center">
                        <FileText size={14} className="text-accent" />
                      </div>
                      <span className="text-xs font-semibold text-text">Elaborated</span>
                    </div>
                    <MarkdownRenderer>{elaborateExtension}</MarkdownRenderer>
                  </div>
                )}

                {studyExtension && (
                  <div className="mt-5 pt-5 border-t border-border/60 animate-pop-in">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="size-6 rounded-lg bg-accent/10 flex items-center justify-center">
                        <BookOpen size={14} className="text-accent" />
                      </div>
                      <span className="text-xs font-semibold text-text">Study Results</span>
                    </div>
                    <MarkdownRenderer>{studyExtension}</MarkdownRenderer>
                  </div>
                )}
              </div>
            </div>

            {!expanded && (
              <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-elevated via-elevated/80 to-transparent" />
            )}

            {/* Footer actions */}
            <div className="relative flex flex-wrap items-center gap-2 px-5 py-3 border-t border-border/60">
              <button
                onClick={() => setExpanded(!expanded)}
                className={ghostBtn}
                title={expanded ? "Collapse" : "Expand"}
                disabled={!hasExtensions}
              >
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {expanded ? "Collapse" : "Expand"}
              </button>
              <button
                onClick={handleRegenerate}
                disabled={regenerating}
                className={ghostBtn}
                title="Regenerate this overview"
              >
                {regenerating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Regenerate
              </button>
              <button
                onClick={handleElaborate}
                disabled={loadingElaborate || !!elaborateExtension}
                className={primaryBtn}
                title="Generate an elaborated summary from the query"
              >
                {loadingElaborate ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <FileText size={14} />
                )}
                {elaborateExtension ? "Elaborated" : "Elaborate"}
              </button>
              <button
                onClick={handleStudy}
                disabled={loadingStudy || !!studyExtension}
                className={primaryBtn}
                title="Generate a study breakdown from top results"
              >
                {loadingStudy ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <BookOpen size={14} />
                )}
                {studyExtension ? "Studied" : "Study Results"}
              </button>
            </div>
          </div>
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
          className="flex items-center gap-2 text-xs text-text hover:text-muted transition-colors px-1"
        >
          <Sparkles size={16} />
          Generate AI overview
        </button>
      )}

      {/* Related Searches — stacked cards */}
      <div>
        <div className="text-sm font-semibold text-text mb-2.5 px-1">
          Related Searches
        </div>
        <div className="space-y-2">
          {searchLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 w-full px-3.5 py-3 rounded-lg bg-panel/60">
                <Skeleton className="size-4 rounded-full shrink-0" />
                <Skeleton className="h-3 flex-1" />
                <Skeleton className="size-4 shrink-0" />
              </div>
            ))
          ) : suggestions.length > 0 ? suggestions.slice(0, 6).map((s, i) => (
            <button
              key={i}
              onClick={() => search(s)}
              className="flex items-center gap-3 w-full px-3.5 py-3 rounded-lg bg-panel/60 hover:bg-hover transition-colors text-left group"
            >
              <div className="size-6 rounded-lg bg-elevated flex items-center justify-center shrink-0 shadow-surface">
                <Search size={14} className="text-dim" />
              </div>
              <span className="text-sm text-text flex-1 truncate">{s}</span>
              <ChevronRight size={16} className="text-dim shrink-0 group-hover:text-text transition-colors" />
            </button>
          )) : null}
        </div>
      </div>
    </div>
  );
}
