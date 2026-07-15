import { Search, Newspaper, Youtube, ShoppingBag, Image, MessageCircle, Code, BookOpen, Globe } from "lucide-react";
import { useSearchStore } from "../stores/searchStore";

const FILTERS = [
  { id: "all", label: "All", icon: Search },
  { id: "research", label: "Research", icon: BookOpen },
  { id: "articles", label: "Articles", icon: Globe },
  { id: "discussions", label: "Discussions", icon: MessageCircle },
  { id: "videos", label: "Videos", icon: Youtube },
  { id: "news", label: "News", icon: Newspaper },
  { id: "shopping", label: "Shopping", icon: ShoppingBag },
  { id: "official", label: "Official", icon: Globe },
  { id: "code", label: "Code", icon: Code },
];

export default function FilterSidebar() {
  const results = useSearchStore((s) => s.results);
  const activeFilter = useSearchStore((s) => s.activeFilter);
  const setActiveFilter = useSearchStore((s) => s.setActiveFilter);

  return (
    <div className="h-full flex flex-col items-center py-3 px-1">
      <div className="mb-4 text-center">
        <div className="text-[10px] font-semibold text-text tracking-wider">SOURCES</div>
        <div className="text-[9px] text-dim mt-0.5">{results.length} results</div>
      </div>

      <div className="flex-1 flex flex-col items-center gap-3">
        {FILTERS.map((f) => {
          const isActive = activeFilter === f.id;
          const Icon = f.icon;
          return (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`flex flex-col items-center gap-0.5 p-1.5 rounded-lg transition-colors w-full ${
                isActive
                  ? "bg-black text-white"
                  : "text-text hover:bg-hover"
              }`}
              title={f.label}
            >
              <Icon size={14} />
              <span className="text-[7px] leading-tight font-medium">{f.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
