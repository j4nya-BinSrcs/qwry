import { ExternalLink } from "lucide-react";

export default function InfoBoxCard({ infobox }) {
  if (!infobox) return null;

  const imgSrc = infobox.img_src || infobox.thumbnail;
  const urls = infobox.urls || [];
  const content = infobox.content || "";
  const title = infobox.infobox || infobox.title || "Overview";

  return (
    <div className="px-1 pb-2">
      <div className="rounded-2xl glass-card border-violet-500/30 overflow-hidden shadow-lg shadow-violet-500/5">
        {imgSrc && (
          <div className="relative w-full aspect-video bg-surface/80 overflow-hidden">
            <img
              src={`/api/image-proxy?url=${encodeURIComponent(imgSrc)}`}
              alt={title}
              className="w-full h-full object-cover"
              onError={(e) => (e.target.style.display = "none")}
            />
          </div>
        )}
        <div className="p-4">
          <h3 className="text-sm font-bold text-text mb-1.5 font-heading brand-gradient-text">{title}</h3>
          {content && (
            <p className="text-xs text-muted leading-relaxed line-clamp-5 opacity-90">
              {content}
            </p>
          )}
          {urls.length > 0 && (
            <div className="mt-3 pt-2.5 border-t border-border/50 space-y-1.5">
              {urls.slice(0, 3).map((u, i) => (
                <a
                  key={i}
                  href={u.url || u}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-violet-300 hover:text-violet-200 transition-colors font-medium"
                >
                  <ExternalLink size={11} className="shrink-0" />
                  <span className="truncate">{u.title || u.url || u}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}