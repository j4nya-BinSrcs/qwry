import { useCallback } from 'react';
import { BookOpen, ExternalLink, Headphones, ArrowRight } from 'lucide-react';
import { useContentStore } from '../../stores/contentStore';
import { useUIStore } from '../../stores/uiStore';

function getHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function RowIcon({ type }) {
  if (type === 'video') return <ExternalLink size={13} />;
  if (type === 'audio') return <Headphones size={13} />;
  return <BookOpen size={13} />;
}

export default function BentoReadsCard() {
  const reads = useContentStore((s) => s.reads);
  const openReader = useUIStore((s) => s.openReader);
  const setContextMode = useUIStore((s) => s.setContextMode);

  const handleOpen = useCallback(
    (read) => {
      openReader(read.url, read.title, read.media_url || null);
      setContextMode('reader');
    },
    [openReader, setContextMode]
  );

  const recents = (reads || []).filter((r) => !r.loading).slice(0, 3);

  return (
    <div className="bento-card-inner">
      <div className="bento-card-inner-content">
        <div className="bento-card-header">
          <div className="bento-card-title">
            <BookOpen size={14} />
            Recent Reads
          </div>
          <span className="bento-card-badge">{reads?.length ?? 0}</span>
        </div>

        {recents.length === 0 ? (
          <div className="bento-card-empty">
            <BookOpen size={18} />
            <p>No reads yet — open an article from your sources.</p>
          </div>
        ) : (
          <ul className="bento-list">
            {recents.map((read) => {
              const title = read.title || getHostname(read.url) || 'Untitled';
              const host = getHostname(read.url);
              const type = read.kind || read.type;
              return (
                <li
                  key={read.url}
                  className="bento-list-row"
                  onClick={() => handleOpen(read)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleOpen(read);
                    }
                  }}
                >
                  <span className="bento-list-row-icon">
                    <RowIcon type={type} />
                  </span>
                  <span className="bento-list-row-main">
                    <span className="bento-list-row-title">{title}</span>
                    {host && (
                      <a
                        href={read.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="bento-list-row-sub bento-list-row-link"
                        title={read.url}
                      >
                        <ExternalLink size={10} />
                        {host}
                      </a>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {recents.length > 0 && (
          <div
            className="bento-card-footer"
            onClick={() => setContextMode('reader')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setContextMode('reader');
              }
            }}
          >
            View all reads
            <ArrowRight size={13} />
          </div>
        )}
      </div>
    </div>
  );
}
