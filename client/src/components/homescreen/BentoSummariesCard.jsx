import { useCallback } from 'react';
import { Sparkles, ExternalLink, ArrowRight } from 'lucide-react';
import { useContentStore } from '../../stores/contentStore';
import { useUIStore } from '../../stores/uiStore';

function getHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export default function BentoSummariesCard() {
  const summaries = useContentStore((s) => s.summaries);
  const openSummarizer = useUIStore((s) => s.openSummarizer);
  const setContextMode = useUIStore((s) => s.setContextMode);

  const handleOpen = useCallback(
    (summary) => {
      openSummarizer(summary.url, summary.title);
      setContextMode('summarizer');
    },
    [openSummarizer, setContextMode]
  );

  const recents = (summaries || []).filter((s) => !s.loading).slice(0, 3);

  return (
    <div className="bento-card-inner">
      <div className="bento-card-inner-content">
        <div className="bento-card-header">
          <div className="bento-card-title">
            <Sparkles size={14} />
            Recent Summaries
          </div>
          <span className="bento-card-badge">{summaries?.length ?? 0}</span>
        </div>

        {recents.length === 0 ? (
          <div className="bento-card-empty">
            <Sparkles size={18} />
            <p>No summaries yet — summarize an article to see it here.</p>
          </div>
        ) : (
          <ul className="bento-list">
            {recents.map((summary) => {
              const title = summary.title || getHostname(summary.url) || 'Untitled';
              const host = getHostname(summary.url);
              return (
                <li
                  key={summary.url}
                  className="bento-list-row"
                  onClick={() => handleOpen(summary)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleOpen(summary);
                    }
                  }}
                >
                  <span className="bento-list-row-icon">
                    <Sparkles size={13} />
                  </span>
                  <span className="bento-list-row-main">
                    <span className="bento-list-row-title">{title}</span>
                    {host && (
                      <a
                        href={summary.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="bento-list-row-sub bento-list-row-link"
                        title={summary.url}
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
            onClick={() => setContextMode('summarizer')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setContextMode('summarizer');
              }
            }}
          >
            View all summaries
            <ArrowRight size={13} />
          </div>
        )}
      </div>
    </div>
  );
}
