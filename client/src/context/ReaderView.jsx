import { Clock, ExternalLink, ImageIcon, Loader2, Play, ArrowLeft, BookOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { readUrl } from "../api/reader";
import { useUIStore } from "../stores/uiStore";

export default function ReaderView() {
  const readerUrl = useUIStore((s) => s.readerUrl);
  const readerTitle = useUIStore((s) => s.readerTitle);
  const readerMediaUrl = useUIStore((s) => s.readerMediaUrl);
  const setContextMode = useUIStore((s) => s.setContextMode);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!readerUrl) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    readUrl(readerUrl, readerMediaUrl)
      .then((d) => {
        if (!cancelled) { setData(d); setLoading(false); }
      })
      .catch((err) => {
        if (!cancelled) { setError(err.message); setLoading(false); }
      });
    return () => { cancelled = true; };
  }, [readerUrl, readerMediaUrl]);

  const mins = data ? Math.round(data.reading_time_seconds / 60) : 0;
  const hostname = data ? new URL(data.url).hostname : "";

  if (!readerUrl) {
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
      <div className="shrink-0 flex items-center gap-3 px-3 py-2 border-b border-border">
        <button
          onClick={() => setContextMode("search-assist")}
          className="p-1 rounded text-dim hover:text-text hover:bg-hover transition-colors"
          title="Back"
        >
          <ArrowLeft size={14} />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-text truncate">
            {data?.title || readerTitle || "Reader"}
          </h2>
          {hostname && (
            <a
              href={data?.url || readerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] text-accent hover:text-accent-hover mt-0.5"
            >
              <ExternalLink size={10} />
              {hostname}
            </a>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-dim shrink-0">
          {data?.content_type === "article" && mins > 0 && (
            <span className="flex items-center gap-1">
              <Clock size={10} />{mins} min
            </span>
          )}
          {data?.content_type === "image" && (
            <span className="flex items-center gap-1">
              <ImageIcon size={10} />Image
            </span>
          )}
          {data?.content_type === "video" && (
            <span className="flex items-center gap-1">
              <Play size={10} />Video
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={18} className="animate-spin text-accent" />
          </div>
        )}

        {error && (
          <div className="py-8 text-center space-y-3">
            <p className="text-sm text-red-400">{error}</p>
            <a href={readerUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded bg-accent text-white hover:bg-accent-hover transition-colors"
            >
              <ExternalLink size={11} /> Open in browser
            </a>
          </div>
        )}

        {!loading && !error && data?.success === false && (
          <div className="py-8 text-center space-y-3">
            <p className="text-sm text-muted">{data.error || "Could not extract content."}</p>
            <a href={readerUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded bg-accent text-white hover:bg-accent-hover transition-colors"
            >
              <ExternalLink size={11} /> Open in browser
            </a>
          </div>
        )}

        {!loading && !error && data?.content_type === "image" && (
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

        {!loading && !error && data?.content_type === "video" && (
          <div className="space-y-3">
            {data.media_url && (
              <a href={readerUrl} target="_blank" rel="noopener noreferrer">
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

        {!loading && !error && data?.content_type === "article" && data?.content && (
          <div className="text-sm text-text leading-relaxed whitespace-pre-line font-[system-ui]">
            {data.content}
          </div>
        )}
      </div>
    </div>
  );
}
