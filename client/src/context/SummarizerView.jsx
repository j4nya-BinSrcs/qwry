import { ExternalLink, Sparkles, X, ChevronDown, ChevronRight, FolderOpen, FolderClosed } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "../api/client";
import { useContentStore } from "../stores/contentStore";
import { useUIStore } from "../stores/uiStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import MarkdownRenderer from "../components/MarkdownRenderer";
import { SkeletonText } from "../components/Skeleton";

function getHostname(url) {
  try { return new URL(url).hostname; } catch { return url || ""; }
}

function WorkspaceBadge() {
  const activeId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const ws = workspaces.find((w) => w.id === activeId);
  if (!ws) return null;
  return <span className="text-base px-2 py-1 bg-hover rounded-md text-dim truncate max-w-28">{ws.name}</span>;
}

function WorkspaceSummariesContainer({ summaries, workspace, expanded, toggleSummary, removeSummary, getHostname }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="rounded-lg bg-accent/[0.06] shadow-raised overflow-hidden border border-accent/25">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 border-b border-border cursor-pointer hover:bg-hover transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-text truncate">{workspace.name}</div>
          <div className="text-xs text-dim mt-0.5">{summaries.length} summar{summaries.length === 1 ? "y" : "ies"}</div>
        </div>
        {isExpanded ? <ChevronDown size={16} className="text-dim shrink-0" /> : <ChevronRight size={16} className="text-dim shrink-0" />}
      </button>

      {isExpanded && (
        <div className="space-y-3 p-3.5">
          {summaries.map((s) => (
            <div key={s.id} className="rounded-lg bg-panel shadow-card border border-border overflow-hidden">
              <div
                className="flex items-center gap-2 px-3 py-2 border-b border-border cursor-pointer hover:bg-hover transition-colors"
                onClick={() => toggleSummary(s.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-text truncate">{s.title || getHostname(s.url)}</div>
                  <a href={s.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-base text-text hover:text-muted mt-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink size={16} />
                    {getHostname(s.url)}
                  </a>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!s.loading && s.summary && (
                    <span className="flex items-center gap-1 text-base text-dim">
                      <Sparkles size={16} />
                      {s.provider}
                    </span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); removeSummary(s.id, s.url); }}
                    className="p-1 rounded-md text-dim hover:text-text hover:bg-hover transition-all"
                    title="Remove"
                  >
                    <X size={16} />
                  </button>
                  {expanded.has(s.id) ? <ChevronDown size={16} className="text-dim" /> : <ChevronRight size={16} className="text-dim" />}
                </div>
              </div>
              {expanded.has(s.id) && (
                <div className="px-3 py-2">
                  {s.loading && (
                    <SkeletonText lines={4} />
                  )}
                  {s.error && (
                    <div className="py-3 text-center space-y-2">
                      <p className="text-xs text-muted">Could not generate a summary for this page.</p>
                      <p className="text-base text-dim">{s.error}</p>
                      <a href={s.url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs px-3 py-2 rounded-md bg-text text-surface hover:bg-text/80 transition-colors"
                      ><ExternalLink size={16} /> Open in browser</a>
                    </div>
                  )}
                  {s.summary && <MarkdownRenderer>{s.summary}</MarkdownRenderer>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SummarizerView() {
  const summarizeUrl = useUIStore((s) => s.summarizeUrl);
  const summarizeTitle = useUIStore((s) => s.summarizeTitle);
  const summarizeVersion = useUIStore((s) => s.summarizeVersion);

  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const workspaces = useWorkspaceStore((s) => s.workspaces);

  const storeSummaries = useContentStore((s) => s.summaries);
  const addSummary = useContentStore((s) => s.addSummary);
  const removeSummaryFromStore = useContentStore((s) => s.removeSummary);
  const hydrateSummaries = useContentStore((s) => s.hydrateSummaries);

  const [expanded, setExpanded] = useState(new Set());
  const [loadingUrl, setLoadingUrl] = useState(null);
  const [loadingId, setLoadingId] = useState(null);
  const loadingRef = useRef(null);

  // Restore summaries saved on the server so they survive reloads
  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/history/summaries")
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => {
        if (cancelled) return;
        const entries = (list || []).map((e) => ({
          id: e.id,
          url: e.url,
          title: e.title,
          workspaceId: e.workspace_id || null,
          loading: false,
          error: null,
          summary: e.summary,
          provider: e.model || "unknown",
        }));
        hydrateSummaries(entries);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [hydrateSummaries]);

  // Merge store summaries with in-progress loading entry
  const summaries = useMemo(() => {
    const all = [...storeSummaries];
    if (loadingUrl && !all.some((s) => s.url === loadingUrl)) {
      all.unshift({
        id: loadingId,
        url: loadingUrl,
        title: summarizeTitle,
        workspaceId: activeWorkspaceId,
        loading: true,
        error: null,
        summary: null,
        provider: null,
      });
    }
    return all;
  }, [storeSummaries, loadingUrl, loadingId, summarizeTitle, activeWorkspaceId]);

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
      body: JSON.stringify({ url: summarizeUrl, workspace_id: activeWorkspaceId }),
    })
      .then((r) => {
        if (cancelled) return;
        if (!r.ok) throw new Error(`Failed: ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (cancelled) return;
        addSummary({ id, url: summarizeUrl, title: d.title || summarizeTitle, workspaceId: activeWorkspaceId, loading: false, error: null, summary: d.summary, provider: d.provider || "unknown" });
        if (!cancelled) {
          setLoadingUrl(null);
          setLoadingId(null);
          loadingRef.current = null;
        }
      })
      .catch((err) => {
        if (cancelled) return;
        addSummary({ id, url: summarizeUrl, title: summarizeTitle, workspaceId: activeWorkspaceId, loading: false, error: err.message, summary: null, provider: null });
        if (!cancelled) {
          setLoadingUrl(null);
          setLoadingId(null);
          loadingRef.current = null;
        }
      });
    return () => { cancelled = true; };
  }, [summarizeUrl, summarizeVersion, summarizeTitle, storeSummaries, addSummary, activeWorkspaceId]);

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

  // Group summaries by workspace
  const summariesByWorkspace = useMemo(() => {
    const grouped = { noWorkspace: [] };
    for (const s of summaries) {
      const wsId = s.workspaceId;
      if (!wsId) {
        grouped.noWorkspace.push(s);
      } else {
        if (!grouped[wsId]) grouped[wsId] = [];
        grouped[wsId].push(s);
      }
    }
    return grouped;
  }, [summaries]);

  const getWorkspaceName = (wsId) => {
    if (!wsId) return null;
    const ws = workspaces.find((w) => w.id === wsId);
    return ws?.name || "Unknown Workspace";
  };

  if (!summarizeUrl && storeSummaries.length === 0 && !loadingUrl) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center px-8">
          <div className="size-8 rounded-lg bg-elevated flex items-center justify-center mx-auto mb-3">
            <Sparkles size={16} className="text-text" />
          </div>
          <p className="text-sm text-muted">Select a result to summarize</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 px-5 pt-5 pb-3 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-text tracking-tight">Summarizer</h2>
          <p className="text-sm text-muted mt-0.5">{summaries.length} {summaries.length === 1 ? "summary" : "summaries"}</p>
        </div>
        <WorkspaceBadge />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-6 space-y-4">
        {/* Summaries with no workspace */}
        {summariesByWorkspace.noWorkspace.length > 0 && (
          <div className="space-y-3">
            {summariesByWorkspace.noWorkspace.map((s) => (
              <div key={s.id} className="rounded-lg bg-elevated shadow-raised overflow-hidden">
                <div
                  className="flex items-center gap-2 px-3 py-2 border-b border-border cursor-pointer hover:bg-hover transition-colors"
                  onClick={() => toggleSummary(s.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-text truncate">{s.title || getHostname(s.url)}</div>
                    <a href={s.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-base text-text hover:text-muted mt-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink size={16} />
                      {getHostname(s.url)}
                    </a>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!s.loading && s.summary && (
                      <span className="flex items-center gap-1 text-base text-dim">
                        <Sparkles size={16} />
                        {s.provider}
                      </span>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); removeSummary(s.id, s.url); }}
                      className="p-1 rounded-md text-dim hover:text-text hover:bg-hover transition-all"
                      title="Remove"
                    >
                      <X size={16} />
                    </button>
                    {expanded.has(s.id) ? <ChevronDown size={16} className="text-dim" /> : <ChevronRight size={16} className="text-dim" />}
                  </div>
                </div>
                {expanded.has(s.id) && (
                  <div className="px-3 py-2">
                    {s.loading && (
                      <SkeletonText lines={4} />
                    )}
                    {s.error && (
                      <div className="py-3 text-center space-y-2">
                        <p className="text-xs text-muted">Could not generate a summary for this page.</p>
                        <p className="text-base text-dim">{s.error}</p>
                        <a href={s.url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs px-3 py-2 rounded-md bg-text text-surface hover:bg-text/80 transition-colors"
                        ><ExternalLink size={16} /> Open in browser</a>
                      </div>
                    )}
                    {s.summary && <MarkdownRenderer>{s.summary}</MarkdownRenderer>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Summaries grouped by workspace */}
        {Object.entries(summariesByWorkspace).filter(([k]) => k !== "noWorkspace").map(([wsId, wsSummaries]) => (
          <WorkspaceSummariesContainer
            key={wsId}
            summaries={wsSummaries}
            workspace={{ id: wsId, name: getWorkspaceName(wsId) }}
            expanded={expanded}
            toggleSummary={toggleSummary}
            removeSummary={removeSummary}
            getHostname={getHostname}
          />
        ))}
      </div>
    </div>
  );
}
