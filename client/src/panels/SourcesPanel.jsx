import { useState } from "react";
import { useSearchStore } from "../stores/searchStore";

const CATEGORY_FILTERS = [
  { id: "all", label: "All" },
  { id: "research", label: "Research", icon: "📄" },
  { id: "articles", label: "Articles", icon: "📰" },
  { id: "discussions", label: "Discussions", icon: "💬" },
  { id: "videos", label: "Videos", icon: "🎬" },
  { id: "news", label: "News", icon: "📰" },
  { id: "shopping", label: "Shopping", icon: "🛒" },
  { id: "offbeat", label: "Offbeat", icon: "🔮" },
  { id: "code", label: "Code", icon: "💻" },
];

function matchFilter(r, filterId) {
  if (filterId === "all") return true;
  const cat = (r.category || "").toLowerCase();
  let host = "";
  try { host = new URL(r.url).hostname.toLowerCase(); } catch {}
  const title = (r.title || "").toLowerCase();
  const snippet = (r.snippet || "").toLowerCase();
  const text = title + " " + snippet;

  switch (filterId) {
    case "research":
      return cat === "general" || cat === "science" || cat === "encyclopedia" || cat === "reference" ||
             host.endsWith(".edu") || host.includes("wikipedia") || host.includes("academic") ||
             host.includes("scholar") || host.includes("arxiv") || host.includes("cambridge") ||
             host.includes("springer") || host.includes("ieee") || host.includes("acm.org") ||
             text.includes("research paper") || text.includes("study shows");
    case "articles":
      return cat === "articles" || cat === "blog" || cat === "opinion" || cat === "blogs" ||
             host.includes("medium.com") || host.includes("substack") || host.includes("wordpress") ||
             host.includes("blog") || host.includes("tutorial") ||
             text.includes("blog post") || text.includes("tutorial") || text.includes("opinion");
    case "discussions":
      return cat.includes("discuss") || cat.includes("forum") || cat.includes("qa") || cat === "social media" ||
             host.includes("reddit") || host.includes("stackoverflow") || host.includes("stackexchange") ||
             host.includes("quora") || host.includes("discourse") || host.includes("forum");
    case "videos":
      return cat === "videos" || cat === "video" ||
             host.includes("youtube") || host.includes("youtu.be") || host.includes("vimeo") ||
             host.includes("twitch") || host.includes("dailymotion");
    case "news":
      return cat === "news" || cat === "newspaper" ||
             host.includes("cnn.com") || host.includes("nytimes") || host.includes("reuters") ||
             host.includes("bbc") || host.includes("theguardian") || host.includes("bloomberg") ||
             text.includes("breaking news") || (text.includes("report") && text.includes("today"));
    case "shopping":
      return cat === "shopping" || cat.includes("shop") || cat === "products" ||
             host.includes("amazon") || host.includes("ebay") || host.includes("walmart") ||
             host.includes("etsy") || host.includes("bestbuy") || host.includes("target.com") ||
             host.includes("alibaba") || host.includes("aliexpress") ||
             text.includes("buy ") || text.includes("price") || text.includes("$");
    case "offbeat":
      return cat === "offbeat" || cat === "funny" || cat === "weird" ||
             host.includes("reddit.com/r/funny") || host.includes("buzzfeed") ||
             text.includes("weird") || text.includes("unusual") || text.includes("strange");
    case "code":
      return host.includes("github") || host.includes("gitlab") || host.includes("bitbucket") ||
             host.includes("npmjs") || host.includes("pypi") || host.includes("crates.io") ||
             host.includes("docs.rs") || host.includes("packagist") || host.includes("nuget") ||
             host.includes("docker") || host.includes("hub.docker") ||
             cat === "it" || cat === "code" || cat === "repository" || cat === "package" ||
             text.includes("source code") || text.includes("api reference") || text.includes("sdk");
    default:
      return false;
  }
}

function ResultCard({ result }) {
  let hostname = "";
  try { hostname = new URL(result.url).hostname.replace("www.", ""); } catch {}

  return (
    <div className="group">
      <div className="flex items-start gap-3 px-3 py-3">
        <div className="size-7 rounded-full border border-border shrink-0 mt-0.5 flex items-center justify-center">
          <span className="text-[10px] font-bold text-text uppercase">
            {result.title?.charAt(0) || "?"}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-text truncate">
            {result.title}
          </div>
          <div className="text-xs text-dim truncate mt-0.5">
            {hostname}
          </div>
          {result.snippet && (
            <p className="text-xs text-muted mt-1.5 line-clamp-2 leading-relaxed">
              {result.snippet}
            </p>
          )}
        </div>
      </div>
      <div className="mx-3 border-b border-border last:hidden" />
    </div>
  );
}

export default function SourcesPanel() {
  const query = useSearchStore((s) => s.query);
  const results = useSearchStore((s) => s.results);
  const loading = useSearchStore((s) => s.loading);
  const error = useSearchStore((s) => s.error);
  const search = useSearchStore((s) => s.search);
  const [activeFilter, setActiveFilter] = useState("all");

  const filtered = results.filter((r) => matchFilter(r, activeFilter));
  const totalResults = results.length;
  const visibleResults = filtered.slice(0, 5);
  const remaining = filtered.length - 5;

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 px-3 pt-5 pb-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-text uppercase tracking-widest">
            Sources
          </h2>
          <span className="text-xs text-dim">{totalResults} results</span>
        </div>

        <div className="space-y-0.5">
          {CATEGORY_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`flex items-center gap-2.5 w-full px-3 py-1.5 text-xs rounded-full transition-colors ${
                activeFilter === f.id
                  ? "bg-text text-white font-medium"
                  : "text-text hover:bg-hover"
              }`}
            >
              <span className="text-[11px]">{f.icon || "○"}</span>
              <span>{f.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="size-4 border-2 border-text border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {error && (
          <div className="px-4 py-3 text-sm text-muted mx-2">
            {error}
          </div>
        )}
        {!loading && !error && results.length === 0 && query && (
          <div className="px-4 py-12 text-center text-sm text-muted">
            No results found
          </div>
        )}
        {!loading && !error && results.length === 0 && !query && (
          <div className="px-4 py-12 text-center text-sm text-muted">
            Search the web to see results here
          </div>
        )}
        {!loading && !error && results.length > 0 && filtered.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-muted">
            No results match the selected filter
          </div>
        )}
        <div>
          {visibleResults.map((result, i) => (
            <ResultCard key={`${result.url}-${i}`} result={result} />
          ))}
        </div>
        {remaining > 0 && (
          <div className="px-3 pt-2 pb-3">
            <button
              onClick={() => search(query)}
              className="text-xs text-dim hover:text-text transition-colors"
            >
              +{remaining} more results
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
