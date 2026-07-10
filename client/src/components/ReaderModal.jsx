import { Clock, ExternalLink, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { readUrl } from "../api/reader";

export default function ReaderModal({ url, title: initialTitle, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    readUrl(url)
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
  const hostname = data ? new URL(data.url).hostname : "";

  const contentTruncated = data?.content
    ? data.content.length > 5000
      ? data.content.slice(0, 5000) + "..."
      : data.content
    : "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-12 pb-8"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl max-h-[calc(100vh-6rem)] mx-4 bg-surface border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-text truncate">
              {data?.title || initialTitle || "Reader"}
            </h2>
            <div className="flex items-center gap-3 mt-1">
              {hostname && (
                <a
                  href={data.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-accent hover:text-accent-hover"
                >
                  <ExternalLink size={11} />
                  {hostname}
                </a>
              )}
              {mins > 0 && (
                <span className="flex items-center gap-1 text-xs text-dim">
                  <Clock size={11} />
                  {mins} min read
                </span>
              )}
              {data && (
                <span className="text-xs text-dim">
                  {data.content_length_chars.toLocaleString()} chars
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-dim hover:text-text hover:bg-hover transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={20} className="animate-spin text-accent" />
            </div>
          )}

          {error && (
            <div className="py-10 text-center">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {!loading && !error && data?.success === false && (
            <div className="py-10 text-center">
              <p className="text-sm text-muted">{data.error || "Could not extract content from this page."}</p>
            </div>
          )}

          {!loading && !error && data?.success !== false && data?.content && (
            <div className={`prose prose-sm max-w-none ${expanded ? "" : "max-h-[60vh] overflow-hidden relative"}`}>
              <div className="text-sm text-text leading-relaxed whitespace-pre-line font-[system-ui]">
                {expanded ? data.content : contentTruncated}
              </div>
              {!expanded && data.content.length > 5000 && (
                <div className="sticky bottom-0 pt-12 pb-2 bg-gradient-to-t from-surface via-surface/95 to-transparent">
                  <button
                    onClick={() => setExpanded(true)}
                    className="block mx-auto text-xs px-4 py-2 rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors"
                  >
                    Show all ({data.content.length.toLocaleString()} chars)
                  </button>
                </div>
              )}
            </div>
          )}

          {!loading && !error && !data?.content && data?.success !== false && (
            <div className="py-10 text-center">
              <p className="text-sm text-muted">No content extracted.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
