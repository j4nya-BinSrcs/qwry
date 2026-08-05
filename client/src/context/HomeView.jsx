import { ArrowRight, BookOpen, Layers, Plus, Search, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useContentStore } from "../stores/contentStore";
import { useSearchStore } from "../stores/searchStore";
import { useSessionStore } from "../stores/sessionStore";
import { useUIStore } from "../stores/uiStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import ProfileMenu from "../components/ProfileMenu";
import GradientWaves from "../components/GradientWaves";

function getHostname(url) {
  try { return new URL(url).hostname; } catch { return ""; }
}

function timeAgo(date) {
  if (!date) return "";
  const sec = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

export default function HomeView() {
  const sessionId = useSessionStore((s) => s.sessionId);
  const loadWorkspaces = useWorkspaceStore((s) => s.loadWorkspaces);
  const setSearchQuery = useSearchStore((s) => s.setQuery);
  const search = useSearchStore((s) => s.search);
  const setContextMode = useUIStore((s) => s.setContextMode);
  const [quickQuery, setQuickQuery] = useState("");

  useEffect(() => {
    loadWorkspaces(sessionId);
  }, [sessionId, loadWorkspaces]);

  const handleQuickSearch = useCallback((q) => {
    const queryToSearch = (typeof q === "string" ? q : quickQuery).trim();
    if (!queryToSearch) return;
    setSearchQuery(queryToSearch);
    search(queryToSearch);
    setContextMode("search-assist");
  }, [quickQuery, setSearchQuery, search, setContextMode]);

  const TOPIC_SUGGESTIONS = [
    "Generative AI",
    "Quantum Computing",
    "Machine Learning Papers",
    "Tech Trends 2026",
    "Market Research",
  ];

  return (
    <div className="h-full relative flex flex-col bg-transparent text-text overflow-hidden">
      {/* Full Viewport Background GradientWaves (Fixed & Non-interactive) */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-85 overflow-hidden">
        <GradientWaves
          horizonColor="#070817"
          waveColor="#6d28d9"
          crestColor="#06b6d4"
          speed={0.4}
          amplitude={3.0}
          waveScale={0.8}
          waveRatio={0.85}
          swell={30}
          turbulence={15}
          tilt={1.15}
          zoom={1.0}
          height={5.0}
          fogDepth={25}
          detail="high"
          brightness={1.25}
          opacity={0.85}
          mouseInteraction={false}
          parallaxStrength={0}
          grain={true}
          grainIntensity={0.04}
        />
      </div>

      {/* Top Profile Control Bar */}
      <div className="sticky top-0 z-20 flex items-center justify-end px-6 py-3 bg-panel/40 backdrop-blur-xl border-b border-border/40">
        <ProfileMenu />
      </div>

      {/* Vertically and Horizontally Centered Content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-12 max-w-3xl mx-auto w-full text-center -mt-8">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-violet-500/15 border border-violet-500/25 text-violet-300 text-xs font-semibold mb-6 backdrop-blur-md shadow-lg shadow-violet-500/10">
          <Sparkles size={13} className="text-violet-400 animate-spin" style={{ animationDuration: '4s' }} />
          <span>AI-Powered Knowledge & Research Hub</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-text font-heading leading-tight mb-3">
          Welcome to <span className="brand-gradient-text">QWRY</span>
        </h1>
        
        {/* Subtitle */}
        <p className="text-sm sm:text-base text-muted max-w-lg mx-auto leading-relaxed mb-8">
          Your personal research workspace. Search, collect, summarize, and visualize with fluid AI tools.
        </p>

        {/* Quick search input (longer max-w-2xl width with prominent magnifying glass & thin separator line) */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleQuickSearch();
          }}
          className="w-full max-w-2xl mx-auto mb-6"
        >
          <div className="relative flex items-center group input-glow-focus rounded-2xl">
            {/* Left Magnifying Glass Icon + Super Thin Vertical Line */}
            <div className="absolute left-4 z-10 flex items-center gap-3 pointer-events-none">
              <Search size={20} className="text-violet-400 group-focus-within:text-violet-300 group-focus-within:scale-110 transition-all shrink-0" />
              <div className="h-5 w-[1px] bg-border/80 group-focus-within:bg-violet-500/50 transition-colors" />
            </div>

            <input
              type="text"
              value={quickQuery}
              onChange={(e) => setQuickQuery(e.target.value)}
              placeholder="Search topics, articles, papers, or media..."
              className="w-full h-14 pl-14 pr-14 rounded-2xl bg-panel/75 backdrop-blur-2xl border border-border/80 text-base text-text outline-none placeholder:text-dim transition-all duration-300 focus:bg-elevated focus:border-violet-500/80 shadow-2xl shadow-violet-500/10"
            />

            <button
              type="submit"
              disabled={!quickQuery.trim()}
              className="absolute right-2.5 z-10 p-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md hover:opacity-90 hover:scale-105 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              title="Search"
            >
              <ArrowRight size={18} />
            </button>
          </div>
        </form>

        {/* Topic Suggestion Pills */}
        <div className="flex flex-wrap items-center justify-center gap-2 max-w-2xl">
          <span className="text-xs text-dim font-medium mr-1">Trending Topics:</span>
          {TOPIC_SUGGESTIONS.map((topic) => (
            <button
              key={topic}
              onClick={() => handleQuickSearch(topic)}
              className="px-3 py-1.5 rounded-xl bg-surface/60 hover:bg-violet-500/15 border border-border/60 hover:border-violet-500/30 text-xs font-medium text-muted hover:text-violet-300 backdrop-blur-md transition-all duration-200"
            >
              {topic}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}



