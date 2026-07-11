import { Clock, ExternalLink, ImageIcon, Loader2, Play, BookOpen, ChevronDown, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { readUrl } from "../api/reader";
import { useUIStore } from "../stores/uiStore";

export default function ReaderView() {
  const readerUrl = useUIStore((s) => s.readerUrl);
  const readerTitle = useUIStore((s) => s.readerTitle);
  const readerMediaUrl = useUIStore((s) => s.readerMediaUrl);
  const readerVersion = useUIStore((s) => s.readerVersion);

  const [reads, setReads] = useState([]);
  const [openId, setOpenId] = useState(null);
  const submittedRef = useRef(new Set());
  const counterRef = useRef(0);
  const readsRef = useRef([]);
  const readerUrlRef = useRef(null);

  // keep ref in sync with state
  useEffect(() => { readsRef.current = reads; }, [reads]);

  useEffect(() => {
    if (!readerUrl) return;
    readerUrlRef.current = readerUrl;

    // If this URL already has a read entry, just expand it
    const existing = readsRef.current.find((r) => r.url === readerUrl);
    if (existing) {
      setOpenId(existing.id);
      return;
    }

    // Guard against React StrictMode double-fire
    if (submittedRef.current.has(readerUrl)) return;
    submittedRef.current.add(readerUrl);

    const id = ++counterRef.current;
    const entry = { id, url: readerUrl, title: readerTitle, mediaUrl: readerMediaUrl, loading: true, error: null, data: null };
    setReads((prev) => [entry, ...prev]);
    setOpenId(id);

    let cancelled = false;
    readUrl(readerUrl, readerMediaUrl)
      .then((d) => {
        if (!cancelled) {
          setReads((prev) =>
            prev.map((r) => r.id === id ? { ...r, loading: false, data: d } : r)
          );
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setReads((prev) =>
            prev.map((r) => r.id === id ? { ...r, loading: false, error: err.message } : r)
          );
        }
      });
    return () => { cancelled = true; };
  }, [readerUrl, readerMediaUrl, readerTitle, readerVersion]);

  const removeRead = useCallback((id, url) => {
    submittedRef.current.delete(url);
    setReads((prev) => prev.filter((r) => r.id !== id));
    setOpenId((prev) => prev === id ? null : prev);
  }, []);

  const toggleRead = useCallback((id) => {
    setOpenId((prev) => prev === id ? null : id);
  }, []);

  const getHostname = (url) => {
    try { return new URL(url).hostname; } catch { return url; }
  };

  if (!readerUrl && reads.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center px-8">
          <div className="size-8 rounded bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-3">
            <BookOpen size={16} className="text-accent" />
          </div>
          <p className="text-sm text-muted">Select a result to read</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 px-3 py-2 border-b border-border">
        <h2 className="text-sm font-semibold text-text">Reader</h2>
        <p className="text-[10px] text-muted">{reads.length} read{reads.length !== 1 ? "s" : ""}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {reads.map((r) => {
          const data = r.data;
          const hostname = data ? getHostname(data.url) : getHostname(r.url);
          const mins = data ? Math.round(data.reading_time_seconds / 60) : 0;

          return (
            <div key={r.id} className="rounded bg-elevated border border-border overflow-hidden">
              <div
                className="flex items-center gap-2 px-3 py-2 border-b border-border cursor-pointer hover:bg-hover transition-colors"
                onClick={() => toggleRead(r.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-text truncate">
                    {r.title || hostname}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <a href={r.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] text-accent hover:text-accent-hover"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink size={10} />
                      {hostname}
                    </a>
                    {data && data.content_type === "article" && mins > 0 && (
                      <span className="flex items-center gap-1 text-[10px] text-dim">
                        <Clock size={10} />{mins} min
                      </span>
                    )}
                    {data && data.content_type === "image" && (
                      <span className="flex items-center gap-1 text-[10px] text-dim">
                        <ImageIcon size={10} />Image
                      </span>
                    )}
                    {data && data.content_type === "video" && (
                      <span className="flex items-center gap-1 text-[10px] text-dim">
                        <Play size={10} />Video
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); removeRead(r.id, r.url); }}
                  className="p-1 rounded text-dim hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
                  title="Remove"
                >
                  <X size={11} />
                </button>
                {openId === r.id ? <ChevronDown size={12} className="text-dim shrink-0" /> : <ChevronRight size={12} className="text-dim shrink-0" />}
              </div>

              {openId === r.id && (
                <div className="px-3 py-2">
                  {r.loading && (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 size={18} className="animate-spin text-accent" />
                    </div>
                  )}

                  {r.error && (
                    <div className="py-4 text-center space-y-2">
                      <p className="text-xs text-red-400">Unable to load this page.</p>
                      <p className="text-[10px] text-muted">{r.error}</p>
                      <a href={r.url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded bg-accent text-white hover:bg-accent-hover transition-colors"
                      >
                        <ExternalLink size={11} /> Open in browser
                      </a>
                    </div>
                  )}

                  {!r.loading && !r.error && data?.success === false && (
                    <div className="py-4 text-center space-y-2">
                      <p className="text-xs text-muted">This page could not be read automatically.</p>
                      <p className="text-[10px] text-dim">{data.error || "The page may require JavaScript or may not be accessible."}</p>
                      <a href={r.url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded bg-accent text-white hover:bg-accent-hover transition-colors"
                      >
                        <ExternalLink size={11} /> Open in browser
                      </a>
                    </div>
                  )}

                  {!r.loading && !r.error && data?.success !== false && data?.content_type === "image" && (
                    <div className="space-y-3">
                      {data.media_url && (
                        <div className="rounded bg-hover flex items-center justify-center overflow-hidden">
                          <img
                            src={`/api/image-proxy?url=${encodeURIComponent(data.media_url)}`}
                            alt={data.title || ""}
                            className="max-w-full max-h-[60vh] object-contain"
                            onError={(e) => { e.target.style.display = "none"; }}
                          />
                        </div>
                      )}
                      {data.title && <p className="text-sm text-text text-center">{data.title}</p>}
                    </div>
                  )}

                  {!r.loading && !r.error && data?.success !== false && data?.content_type === "video" && (
                    <div className="space-y-3">
                      {data.media_url && (
                        <a href={r.url} target="_blank" rel="noopener noreferrer">
                          <div className="relative rounded overflow-hidden bg-black aspect-video flex items-center justify-center group cursor-pointer">
                            <img
                              src={`/api/image-proxy?url=${encodeURIComponent(data.media_url)}`}
                              alt=""
                              className="w-full h-full object-cover"
                              onError={(e) => { e.target.style.display = "none"; }}
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="size-12 rounded-full bg-black/60 flex items-center justify-center group-hover:bg-black/80 transition-colors">
                                <Play size={22} className="text-white ml-0.5" />
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
                      <div className="text-sm text-text leading-relaxed whitespace-pre-line font-[system-ui]">
                        {data.content}
                      </div>
                    ) : (
                      <div className="py-4 text-center space-y-2">
                        <p className="text-xs text-muted">No readable content was found on this page.</p>
                        <a href={r.url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded bg-accent text-white hover:bg-accent-hover transition-colors"
                        >
                          <ExternalLink size={11} /> Open in browser
                        </a>
                      </div>
                    )
                  )}

                  {!r.loading && !r.error && data && !["image", "video", "article"].includes(data.content_type) && (
                    <div className="py-4 text-center space-y-2">
                      <p className="text-xs text-muted">This content type could not be displayed.</p>
                      <a href={r.url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded bg-accent text-white hover:bg-accent-hover transition-colors"
                      >
                        <ExternalLink size={11} /> Open in browser
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
