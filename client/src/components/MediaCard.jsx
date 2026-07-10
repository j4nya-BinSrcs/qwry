import { ExternalLink, GripVertical } from "lucide-react";
import { useDraggable } from "@dnd-kit/core";

export default function MediaCard({ result }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `media-${result.url}`,
      data: { type: "search-result", result },
    });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  const imgSrc = result.img_src || result.thumbnail;
  const isImage = result.category === "images";
  const isVideo = result.category === "videos" || result.category === "news";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all cursor-default ${
        isDragging
          ? "opacity-50"
          : "hover:bg-hover border border-transparent hover:border-border"
      }`}
    >
      <button
        {...listeners}
        className="shrink-0 text-dim cursor-grab active:cursor-grabbing hover:text-text transition-colors"
      >
        <GripVertical size={12} />
      </button>

      {/* Thumbnail */}
      <div className="size-10 shrink-0 rounded-md bg-hover overflow-hidden">
        {imgSrc ? (
          <img
            src={`/api/image-proxy?url=${encodeURIComponent(imgSrc)}`}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => (e.target.style.display = "none")}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-dim text-xs">
            {isVideo ? "▶" : "🖼"}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-text truncate">
          {result.title}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[10px] text-dim capitalize">
            {result.engine || result.source || result.category}
          </span>
        </div>
      </div>

      {/* Actions */}
      <button
        onClick={() => window.open(result.url, "_blank")}
        className="p-1 rounded-md text-dim hover:text-text opacity-0 group-hover:opacity-100 transition-all"
        title="Open source"
      >
        <ExternalLink size={12} />
      </button>
    </div>
  );
}