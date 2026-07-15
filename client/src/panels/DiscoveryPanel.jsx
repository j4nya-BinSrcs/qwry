import { Sparkles } from "lucide-react";
import { useState } from "react";
import { useSearchStore } from "../stores/searchStore";

const FILTERS = [
  { id: "images", label: "Images" },
  { id: "videos", label: "Videos" },
  { id: "news", label: "News" },
  { id: "shopping", label: "Shopping" },
];

export default function DiscoveryPanel() {
  const query = useSearchStore((s) => s.query);
  const imageResults = useSearchStore((s) => s.imageResults);
  const videoResults = useSearchStore((s) => s.videoResults);
  const [activeFilter, setActiveFilter] = useState("images");

  const newsResults = imageResults.slice(0, 1);

  if (!query) {
    return (
      <div className="h-full flex flex-col">
        <div className="shrink-0 px-3 pt-5 pb-3">
          <h2 className="text-xs font-bold text-text uppercase tracking-widest mb-3">
            IMAGES
          </h2>
          <div className="flex gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                  activeFilter === f.id
                    ? "bg-text text-white"
                    : "text-muted hover:text-text"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-muted px-4 text-center">
            Search to see related content here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 px-3 pt-5 pb-3">
        <h2 className="text-xs font-bold text-text uppercase tracking-widest mb-3">
          IMAGES
        </h2>
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                activeFilter === f.id
                  ? "bg-text text-white"
                  : "text-muted hover:text-text"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-6">
        {imageResults.length > 0 && (
          <div>
            <div className="space-y-3">
              {imageResults.slice(0, 3).map((img, i) => (
                <div key={i}>
                  <div className="rounded-lg border border-border bg-white overflow-hidden">
                    {img.img_src ? (
                      <div className="aspect-[4/3] bg-hover">
                        <img
                          src={`/api/image-proxy?url=${encodeURIComponent(img.img_src)}`}
                          alt=""
                          className="w-full h-full object-cover grayscale"
                          onError={(e) => { e.target.style.display = "none"; }}
                        />
                      </div>
                    ) : (
                      <div className="aspect-[4/3] bg-hover flex items-center justify-center">
                        <span className="text-[10px] text-dim">No image</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-text mt-1.5 px-0.5 capitalize">
                    {img.title?.toLowerCase() || "Image"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {videoResults.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-text uppercase tracking-widest mb-3">
              VIDEOS
            </h3>
            <div className="space-y-3">
              {videoResults.slice(0, 2).map((vid, i) => (
                <div key={i}>
                  <div className="rounded-lg border border-border bg-white overflow-hidden">
                    {vid.img_src ? (
                      <div className="aspect-video bg-hover">
                        <img
                          src={`/api/image-proxy?url=${encodeURIComponent(vid.img_src)}`}
                          alt=""
                          className="w-full h-full object-cover grayscale"
                          onError={(e) => { e.target.style.display = "none"; }}
                        />
                      </div>
                    ) : (
                      <div className="aspect-video bg-hover flex items-center justify-center">
                        <span className="text-[10px] text-dim">No thumbnail</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-text mt-1.5 font-medium px-0.5">
                    {vid.title}
                  </p>
                  <p className="text-[11px] text-dim mt-0.5 px-0.5">
                    {vid.engine || vid.source || "Video"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h3 className="text-xs font-bold text-text uppercase tracking-widest mb-3">
            NEWS
          </h3>
          <div className="rounded-lg border border-border bg-white overflow-hidden relative">
            <div className="absolute top-3 right-3 text-dim">
              <Sparkles size={20} />
            </div>
            <div className="p-3.5 pr-12">
              <p className="text-xs text-text font-medium leading-snug">
                Coffee prices surge as demand increases worldwide
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[11px] text-muted">BBC</span>
                <span className="text-dim text-[11px]">·</span>
                <span className="text-[11px] text-dim">2h ago</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
