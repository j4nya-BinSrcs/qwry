import { ExternalLink } from "lucide-react";

export default function InfoBoxCard({ infobox }) {
  if (!infobox) return null;

  const imgSrc = infobox.img_src || infobox.thumbnail;
  const urls = infobox.urls || [];
  const content = infobox.content || "";
  const title = infobox.infobox || infobox.title || "Info";

  return (
    <div className="px-3 pb-2">
      <div className="rounded-lg bg-panel border border-border overflow-hidden">
        {imgSrc && (
          <div className="relative w-full aspect-video bg-hover overflow-hidden">
            <img
              src={`/api/image-proxy?url=${encodeURIComponent(imgSrc)}`}
              alt={title}
              className="w-full h-full object-cover"
              onError={(e) => (e.target.style.display = "none")}
            />
          </div>
        )}
        <div className="p-3">
          <h3 className="text-sm font-semibold text-text mb-1">{title}</h3>
          {content && (
            <p className="text-xs text-muted leading-relaxed line-clamp-4">
              {content}
            </p>
          )}
          {urls.length > 0 && (
            <div className="mt-2 space-y-1">
              {urls.slice(0, 3).map((u, i) => (
                <a
                  key={i}
                  href={u.url || u}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-text hover:text-muted transition-colors"
                >
                  <ExternalLink size={11} />
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