import { Clock, ExternalLink, ImageIcon, Play, BookOpen, ChevronDown, ChevronRight, X, FolderOpen, FolderClosed } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readUrl } from "../api/reader";
import { useContentStore } from "../stores/contentStore";
import { useUIStore } from "../stores/uiStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { SkeletonArticle } from "../components/Skeleton";

let _readerId = 0;

function WorkspaceBadge() {
  const activeId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const ws = workspaces.find((w) => w.id === activeId);
  if (!ws) return null;
  return <span className="text-base px-2 py-1 bg-hover rounded-md text-dim truncate max-w-28">{ws.name}</span>;
}

function WorkspaceReadsContainer({ reads, workspace, openId, toggleRead, removeRead, getHostname }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg bg-elevated shadow-raised overflow-hidden border border-border">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 border-b border-border cursor-pointer hover:bg-hover transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-text truncate">{workspace.name}</div>
          <div className="text-xs text-dim mt-0.5">{reads.length} read{reads.length !== 1 ? "s" : ""}</div>
        </div>
        {expanded ? <ChevronDown size={16} className="text-dim shrink-0" /> : <ChevronRight size={16} className="text-dim shrink-0" />}
      </button>

      {expanded && (
        <div className="space-y-2.5 p-3">
          {reads.map((r) => {
            const data = r.data;
            const hostname = data ? getHostname(data.url) : getHostname(r.url);

            return (
              <div key={r.id} className="rounded-lg bg-panel shadow-card border border-border overflow-hidden">
                <div
                  className="flex items-center gap-2 px-3 py-2 border-b border-border cursor-pointer hover:bg-hover transition-colors"
                  onClick={() => toggleRead(r.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-text truncate">{r.title || hostname}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <a href={r.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-base text-text hover:text-muted"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink size={16} />
                        {hostname}
                      </a>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeRead(r.id, r.url); }}
                    className="p-1 rounded-md text-dim hover:text-text hover:bg-hover transition-all shrink-0"
                    title="Remove"
                  >
                    <X size={16} />
                  </button>
                  {openId === r.id ? <ChevronDown size={16} className="text-dim shrink-0" /> : <ChevronRight size={16} className="text-dim shrink-0" />}
                </div>

                {openId === r.id && (
                  <div className="px-3 py-2">
                    {r.loading && <SkeletonArticle />}

                    {r.error && (
                      <div className="py-4 text-center space-y-2">
                        <p className="text-xs text-text">Unable to load this page.</p>
                        <p className="text-base text-muted">{r.error}</p>
                        <a href={r.url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs px-3 py-2 rounded-md bg-text text-surface hover:bg-text/80 transition-colors"
                        ><ExternalLink size={16} /> Open in browser</a>
                      </div>
                    )}

                    {!r.loading && !r.error && data?.success === false && (
                      <div className="py-4 text-center space-y-2">
                        <p className="text-xs text-muted">Could not read this page automatically.</p>
                        <p className="text-base text-dim">{data.error}</p>
                        <a href={r.url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs px-3 py-2 rounded-md bg-text text-surface hover:bg-text/80 transition-colors"
                        ><ExternalLink size={16} /> Open in browser</a>
                      </div>
                    )}

                    {!r.loading && !r.error && data?.success !== false && data?.content_type === "image" && (
                      <div className="space-y-3">
                        {data.media_url && (
                          <div className="rounded-md bg-hover flex items-center justify-center overflow-hidden">
                            <img src={`/api/image-proxy?url=${encodeURIComponent(data.media_url)}`} alt={data.title || ""}
                              className="max-w-full max-h-[60vh] object-contain"
                              onError={(e) => { e.target.style.display = "none"; }} />
                          </div>
                        )}
                        {data.title && <p className="text-sm text-text text-center">{data.title}</p>}
                      </div>
                    )}

                    {!r.loading && !r.error && data?.success !== false && data?.content_type === "video" && (
                      <div className="space-y-3">
                        {data.media_url && (
                          <a href={r.url} target="_blank" rel="noopener noreferrer">
                            <div className="relative rounded-md overflow-hidden bg-text aspect-video flex items-center justify-center group cursor-pointer">
                              <img src={`/api/image-proxy?url=${encodeURIComponent(data.media_url)}`} alt=""
                                className="w-full h-full object-cover"
                                onError={(e) => { e.target.style.display = "none"; }} />
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="size-12 rounded-full bg-text/60 flex items-center justify-center group-hover:bg-text/80 transition-colors">
                                  <Play size={24} className="text-surface ml-1" />
                                </div>
                              </div>
                            </div>
                          </a>
                        )}
                        {data.title && <h3 className="text-sm font-semibold text-text">{data.title}</h3>}
                        {data.content && <p className="text-xs text-muted leading-relaxed">{data.content}</p>}
                      </div>
                    )}

                    {!r.loading && !r.error && data?.success !== false && data?.content_type === "article" && (
                      data?.content ? (
                        <div className="text-sm text-text leading-relaxed whitespace-pre-line font-[system-ui]">{data.content}</div>
                      ) : (
                        <div className="py-4 text-center space-y-2">
                          <p className="text-xs text-muted">No readable content was found on this page.</p>
                          <a href={r.url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs px-3 py-2 rounded-md bg-text text-surface hover:bg-text/80 transition-colors"
                          ><ExternalLink size={16} /> Open in browser</a>
                        </div>
                      )
                    )}

                    {!r.loading && !r.error && data && !["image", "video", "article"].includes(data.content_type) && (
                      <div className="py-4 text-center space-y-2">
                        <p className="text-xs text-muted">This content type could not be displayed.</p>
                        <a href={r.url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs px-3 py-2 rounded-md bg-text text-surface hover:bg-text/80 transition-colors"
                        ><ExternalLink size={16} /> Open in browser</a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ReaderView() {
  const readerUrl = useUIStore((s) => s.readerUrl);
  const readerTitle = useUIStore((s) => s.readerTitle);
  const readerMediaUrl = useUIStore((s) => s.readerMediaUrl);
  const readerVersion = useUIStore((s) => s.readerVersion);

  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const workspaces = useWorkspaceStore((s) => s.workspaces);

  const storeReads = useContentStore((s) => s.reads);
  const addRead = useContentStore((s) => s.addRead);
  const removeReadFromStore = useContentStore((s) => s.removeRead);

  const [openId, setOpenId] = useState(null);
  const [loadingId, setLoadingId] = useState(null);
  const [loadingUrl, setLoadingUrl] = useState(null);
  const loadingRef = useRef(null);

  // Merge store reads with in-progress loading entry for display
  const reads = useMemo(() => {
    const all = [...storeReads];
    if (loadingUrl && !all.some((r) => r.url === loadingUrl)) {
      all.unshift({
        id: loadingId,
        url: loadingUrl,
        title: readerTitle,
        mediaUrl: readerMediaUrl,
        workspaceId: activeWorkspaceId,
        loading: true,
        error: null,
        data: null,
      });
    }
    return all;
  }, [storeReads, loadingUrl, loadingId, readerTitle, readerMediaUrl, activeWorkspaceId]);

  useEffect(() => {
    if (!readerUrl) return;

    const existing = storeReads.find((r) => r.url === readerUrl);
    if (existing) {
      setOpenId(existing.id);
      return;
    }

    if (loadingRef.current === readerUrl) return;
    loadingRef.current = readerUrl;

    const id = ++_readerId;
    setLoadingUrl(readerUrl);
    setLoadingId(id);
    setOpenId(id);

    let cancelled = false;
    readUrl(readerUrl, readerMediaUrl, activeWorkspaceId)
      .then((d) => {
        if (cancelled) return;
        addRead({ id, url: readerUrl, title: d.title || readerTitle, mediaUrl: readerMediaUrl, workspaceId: activeWorkspaceId, loading: false, error: null, data: d });
        if (!cancelled) {
          setLoadingUrl(null);
          setLoadingId(null);
          loadingRef.current = null;
        }
      })
      .catch((err) => {
        if (cancelled) return;
        addRead({ id, url: readerUrl, title: readerTitle, mediaUrl: readerMediaUrl, workspaceId: activeWorkspaceId, loading: false, error: err.message, data: null });
        if (!cancelled) {
          setLoadingUrl(null);
          setLoadingId(null);
          loadingRef.current = null;
        }
      });
    return () => { cancelled = true; };
  }, [readerUrl, readerMediaUrl, readerTitle, readerVersion, storeReads, addRead, activeWorkspaceId]);

  const removeRead = useCallback(
    (id, url) => {
      removeReadFromStore(url);
      setOpenId((prev) => (prev === id ? null : prev));
    },
    [removeReadFromStore],
  );

  const toggleRead = useCallback((id) => {
    setOpenId((prev) => (prev === id ? null : id));
  }, []);

  const getHostname = (url) => {
    try { return new URL(url).hostname; } catch { return url; }
  };

  // Group reads by workspace
  const readsByWorkspace = useMemo(() => {
    const grouped = { noWorkspace: [] };
    for (const r of reads) {
      const wsId = r.workspaceId;
      if (!wsId) {
        grouped.noWorkspace.push(r);
      } else {
        if (!grouped[wsId]) grouped[wsId] = [];
        grouped[wsId].push(r);
      }
    }
    return grouped;
  }, [reads]);

  const getWorkspaceName = (wsId) => {
    if (!wsId) return null;
    const ws = workspaces.find((w) => w.id === wsId);
    return ws?.name || "Unknown Workspace";
  };

  if (!readerUrl && reads.length === 0 && !loadingUrl) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center px-8">
          <div className="size-8 rounded-lg bg-elevated flex items-center justify-center mx-auto mb-3">
            <BookOpen size={16} className="text-text" />
          </div>
          <p className="text-sm text-muted">Select a result to read</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 px-4 pt-4 pb-2 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-text tracking-tight">Reader</h2>
          <p className="text-sm text-muted mt-0.5">{reads.length} read{reads.length !== 1 ? "s" : ""}</p>
        </div>
        <WorkspaceBadge />
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Reads with no workspace */}
        {readsByWorkspace.noWorkspace.length > 0 && (
          <div className="space-y-2.5">
            {readsByWorkspace.noWorkspace.map((r) => {
              const data = r.data;
              const hostname = data ? getHostname(data.url) : getHostname(r.url);

              return (
                <div key={r.id} className="rounded-lg bg-elevated shadow-raised overflow-hidden">
                  <div
                    className="flex items-center gap-2 px-3 py-2 border-b border-border cursor-pointer hover:bg-hover transition-colors"
                    onClick={() => toggleRead(r.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-text truncate">{r.title || hostname}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <a href={r.url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-base text-text hover:text-muted"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink size={16} />
                          {hostname}
                        </a>
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeRead(r.id, r.url); }}
                      className="p-1 rounded-md text-dim hover:text-text hover:bg-hover transition-all shrink-0"
                      title="Remove"
                    >
                      <X size={16} />
                    </button>
                    {openId === r.id ? <ChevronDown size={16} className="text-dim shrink-0" /> : <ChevronRight size={16} className="text-dim shrink-0" />}
                  </div>

                  {openId === r.id && (
                    <div className="px-3 py-2">
                      {r.loading && <SkeletonArticle />}

                      {r.error && (
                        <div className="py-4 text-center space-y-2">
                          <p className="text-xs text-text">Unable to load this page.</p>
                          <p className="text-base text-muted">{r.error}</p>
                          <a href={r.url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs px-3 py-2 rounded-md bg-text text-surface hover:bg-text/80 transition-colors"
                          ><ExternalLink size={16} /> Open in browser</a>
                        </div>
                      )}

                      {!r.loading && !r.error && data?.success === false && (
                        <div className="py-4 text-center space-y-2">
                          <p className="text-xs text-muted">Could not read this page automatically.</p>
                          <p className="text-base text-dim">{data.error}</p>
                          <a href={r.url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs px-3 py-2 rounded-md bg-text text-surface hover:bg-text/80 transition-colors"
                          ><ExternalLink size={16} /> Open in browser</a>
                        </div>
                      )}

                      {!r.loading && !r.error && data?.success !== false && data?.content_type === "image" && (
                        <div className="space-y-3">
                          {data.media_url && (
                            <div className="rounded-md bg-hover flex items-center justify-center overflow-hidden">
                              <img src={`/api/image-proxy?url=${encodeURIComponent(data.media_url)}`} alt={data.title || ""}
                                className="max-w-full max-h-[60vh] object-contain"
                                onError={(e) => { e.target.style.display = "none"; }} />
                            </div>
                          )}
                          {data.title && <p className="text-sm text-text text-center">{data.title}</p>}
                        </div>
                      )}

                      {!r.loading && !r.error && data?.success !== false && data?.content_type === "video" && (
                        <div className="space-y-3">
                          {data.media_url && (
                            <a href={r.url} target="_blank" rel="noopener noreferrer">
                              <div className="relative rounded-md overflow-hidden bg-text aspect-video flex items-center justify-center group cursor-pointer">
                                <img src={`/api/image-proxy?url=${encodeURIComponent(data.media_url)}`} alt=""
                                  className="w-full h-full object-cover"
                                  onError={(e) => { e.target.style.display = "none"; }} />
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="size-12 rounded-full bg-text/60 flex items-center justify-center group-hover:bg-text/80 transition-colors">
                                    <Play size={24} className="text-surface ml-1" />
                                  </div>
                                </div>
                              </div>
                            </a>
                          )}
                          {data.title && <h3 className="text-sm font-semibold text-text">{data.title}</h3>}
                          {data.content && <p className="text-xs text-muted leading-relaxed">{data.content}</p>}
                        </div>
                      )}

                      {!r.loading && !r.error && data?.success !== false && data?.content_type === "article" && (
                        data?.content ? (
                          <div className="text-sm text-text leading-relaxed whitespace-pre-line font-[system-ui]">{data.content}</div>
                        ) : (
                          <div className="py-4 text-center space-y-2">
                            <p className="text-xs text-muted">No readable content was found on this page.</p>
                            <a href={r.url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs px-3 py-2 rounded-md bg-text text-surface hover:bg-text/80 transition-colors"
                            ><ExternalLink size={16} /> Open in browser</a>
                          </div>
                        )
                      )}

                      {!r.loading && !r.error && data && !["image", "video", "article"].includes(data.content_type) && (
                        <div className="py-4 text-center space-y-2">
                          <p className="text-xs text-muted">This content type could not be displayed.</p>
                          <a href={r.url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs px-3 py-2 rounded-md bg-text text-surface hover:bg-text/80 transition-colors"
                          ><ExternalLink size={16} /> Open in browser</a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Reads grouped by workspace */}
        {Object.entries(readsByWorkspace).filter(([k]) => k !== "noWorkspace").map(([wsId, wsReads]) => (
          <WorkspaceReadsContainer
            key={wsId}
            reads={wsReads}
            workspace={{ id: wsId, name: getWorkspaceName(wsId) }}
            openId={openId}
            toggleRead={toggleRead}
            removeRead={removeRead}
            getHostname={getHostname}
          />
        ))}
      </div>
    </div>
  );
}
