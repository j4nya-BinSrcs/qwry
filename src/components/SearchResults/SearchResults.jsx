import React from 'react';
import { Globe } from 'lucide-react';
import { useSearch } from '../../context/SearchContext';
import { useSiteActions } from '../../context/SiteActionsContext';
import { ResultCard } from './ResultCard';
import { NoResults } from '../ErrorStates/NoResults';
import { SkeletonLoader } from '../common/Common';
import { AnimatePresence } from 'framer-motion';
import './SearchResults.css';

export const SearchResults = () => {
  const { results, query, isLoading, queryTime } = useSearch();
  const { blacklistedDomains } = useSiteActions();

  const filteredResults = results.filter(item => {
    const domain = item.domain || new URL(item.url).hostname;
    return !blacklistedDomains.includes(domain);
  });

  return (
    <section className="column-panel search-results-panel glass-panel">
      {/* Panel Header */}
      <div className="panel-header">
        <h2 className="panel-title font-heading">
          <Globe className="panel-icon" size={18} color="var(--accent-primary)" />
          Website Links
        </h2>
        <span className="results-metrics">
          About {filteredResults.length} results ({queryTime})
        </span>
      </div>

      {/* Scrollable Results Area */}
      <div className="panel-scroll-area">
        {isLoading ? (
          <SkeletonLoader count={4} height="90px" />
        ) : filteredResults.length === 0 ? (
          <NoResults query={query} />
        ) : (
          <AnimatePresence>
            {filteredResults.map((item, index) => (
              <ResultCard key={item.id || item.url} item={item} index={index} />
            ))}
          </AnimatePresence>
        )}
      </div>
    </section>
  );
};
