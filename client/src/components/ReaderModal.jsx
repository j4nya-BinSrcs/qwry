import { Clock, ExternalLink, ImageIcon, Loader2, Play, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { readUrl } from "../api/reader";

export default function ReaderModal({ url, mediaUrl, title: initialTitle, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    readUrl(url, mediaUrl)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [url]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const mins = data ? Math.round(data.reading_time_seconds / 60) : 0;
  const hostname = data ? (() => { try { return new URL(data.url).hostname; } catch { return ""; } })() : "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-10 pb-8 px-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md animate-in fade-in duration-200" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl max-h-[calc(100vh-5rem)] bg-elevated/95 backdrop-blur-xl border border-violet-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col z-10 animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-border/80 bg-surface/50">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-text truncate font-heading">
              {data?.title || initialTitle || "Reader"}
            </h2>
            <div className="flex items-center gap-3 mt-1.5">
              {hostname && (
                <a
                  href={data?.url || url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-violet-300 hover:text-violet-200 transition-colors font-medium"
                >
                  <ExternalLink size={11} />
                  {hostname}
                </a>
              )}
              {data?.content_type === "article" && mins > 0 && (
                <span className="flex items-center gap-1 text-xs text-dim">
                  <Clock size={11} />
                  {mins} min read
                </span>
              )}
              {data?.content_type === "article" && (
                <span className="text-xs text-dim font-mono">
                  {data.content_length_chars.toLocaleString()} chars
                </span>
              )}
              {data?.content_type === "image" && (
                <span className="flex items-center gap-1 text-xs text-dim">
                  <ImageIcon size={11} />
                  Image
                </span>
              )}
              {data?.content_type === "video" && (
                <span className="flex items-center gap-1 text-xs text-dim">
                  <Play size={11} />
                  Video
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-muted hover:text-text hover:bg-hover border border-transparent hover:border-border transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="animate-spin text-violet-400" />
            </div>
          )}

          {error && (
            <div className="py-12 text-center space-y-4">
              <p className="text-sm text-text">{error}</p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md hover:opacity-90 transition-all"
              >
                <ExternalLink size={13} />
                Open in browser instead
              </a>
            </div>
          )}

          {!loading && !error && data?.success === false && (
            <div className="py-12 text-center space-y-4">
              <p className="text-sm text-muted">{data.error || "Could not extract content from this page."}</p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md hover:opacity-90 transition-all"
              >
                <ExternalLink size={13} />
                Open in browser instead
              </a>
            </div>
          )}

          {!loading && !error && data?.success !== false && data?.content_type === "image" && (
            <div className="space-y-4">
              <div className="rounded-xl overflow-hidden glass-card flex items-center justify-center p-2">
                {data.media_url ? (
                  <img
                    src={`/api/image-proxy?url=${encodeURIComponent(data.media_url)}`}
                    alt={data.title || ""}
                    className="max-w-full max-h-[70vh] object-contain rounded-lg"
                    onError={(e) => {
                      e.target.style.display = "none";
                      e.target.parentElement.innerHTML =
                        '<p class="text-sm text-muted p-8">Image could not be loaded</p>';
                    }}
                  />
                ) : (
                  <div className="py-16 text-center text-muted text-sm">No image URL available</div>
                )}
              </div>
              {data.title && (
                <p className="text-sm text-text font-medium text-center">{data.title}</p>
              )}
              <div className="text-center">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md hover:opacity-90 transition-all"
                >
                  <ExternalLink size={13} />
                  Open in browser instead
                </a>
              </div>
            </div>
          )}

          {!loading && !error && data?.success !== false && data?.content_type === "video" && (
            <div className="space-y-4">
              {data.media_url && (
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <div className="relative rounded-xl overflow-hidden glass-card aspect-video flex items-center justify-center group cursor-pointer border-violet-500/30">
                    <img
                      src={`/api/image-proxy?url=${encodeURIComponent(data.media_url)}`}
                      alt={data.title || "Video thumbnail"}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        e.target.style.display = "none";
                      }}
                    />
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center">
                      <div className="size-16 rounded-full bg-violet-600/90 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                        <Play size={26} className="ml-1" />
                      </div>
                    </div>
                  </div>
                </a>
              )}
              {data.title && (
                <h3 className="text-base font-bold text-text font-heading">{data.title}</h3>
              )}
              {data.content && (
                <p className="text-sm text-muted leading-relaxed">{data.content}</p>
              )}
              <div className="text-center">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md hover:opacity-90 transition-all"
                >
                  <Play size={13} />
                  Watch Video
                </a>
              </div>
            </div>
          )}

          {!loading && !error && data?.success !== false && data?.content_type === "article" && data?.content && (
            <div className={`prose prose-sm max-w-none ${expanded ? "" : "max-h-[60vh] overflow-hidden relative"}`}>
              <div className="text-sm text-text leading-relaxed whitespace-pre-line font-sans opacity-95">
                {expanded ? data.content : (data.content.length > 5000 ? data.content.slice(0, 5000) + "..." : data.content)}
              </div>
              {!expanded && data.content.length > 5000 && (
                <div className="sticky bottom-0 pt-6 pb-2 bg-gradient-to-t from-elevated to-transparent mt-2 flex justify-center">
                  <button
                    onClick={() => setExpanded(true)}
                    className="text-xs font-semibold px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md hover:opacity-90 transition-all"
                  >
                    Show all ({data.content.length.toLocaleString()} chars)
                  </button>
                </div>
              )}
            </div>
          )}

          {!loading && !error && data?.success !== false && data?.content_type === "article" && !data?.content && (
            <div className="py-12 text-center">
              <p className="text-sm text-muted">No readable content extracted from this page.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

