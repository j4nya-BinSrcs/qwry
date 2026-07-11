import { ArrowLeft, ExternalLink, Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useUIStore } from "../stores/uiStore";
import MarkdownRenderer from "../components/MarkdownRenderer";

export default function SummarizerView() {
  const summarizeUrl = useUIStore((s) => s.summarizeUrl);
  const summarizeTitle = useUIStore((s) => s.summarizeTitle);
  const setContextMode = useUIStore((s) => s.setContextMode);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!summarizeUrl) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: summarizeUrl }),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`Failed: ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (!cancelled) { setData(d); setLoading(false); }
      })
      .catch((err) => {
        if (!cancelled) { setError(err.message); setLoading(false); }
      });
    return () => { cancelled = true; };
  }, [summarizeUrl]);

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
            {summarizeTitle || "Summarizer"}
          </h2>
          {summarizeUrl && (
            <a href={summarizeUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] text-accent hover:text-accent-hover mt-0.5"
            >
              <ExternalLink size={10} />
              {new URL(summarizeUrl).hostname}
            </a>
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
          <div className="py-8 text-center">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {data && (
          <div className="space-y-3">
            {data.title && (
              <h3 className="text-sm font-semibold text-text">{data.title}</h3>
            )}
            <div className="flex items-center gap-1.5 text-[10px] text-accent mb-2">
              <Sparkles size={11} />
              <span className="font-medium">Summary</span>
              <span className="text-dim font-normal">
                via {data.provider || "unknown"}
              </span>
            </div>
            <MarkdownRenderer>{data.summary}</MarkdownRenderer>
          </div>
        )}
      </div>
    </div>
  );
}
