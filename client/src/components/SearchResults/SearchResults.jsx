import React, { useState, useEffect } from 'react';
import { Globe } from 'lucide-react';
import { useSearch } from '../../context/SearchContext';
import { useSiteActions } from '../../context/SiteActionsContext';
import { ResultCard } from './ResultCard';
import { NoResults } from '../ErrorStates/NoResults';
import { SkeletonLoader } from '../common/Common';
import { Pagination } from './Pagination';
import { motion, AnimatePresence } from 'framer-motion';
import './SearchResults.css';

const ITEMS_PER_PAGE = 5;

export const SearchResults = () => {
  const { results, query, isLoading, queryTime } = useSearch();
  const { blacklistedDomains } = useSiteActions();
  const [currentPage, setCurrentPage] = useState(1);

  const filteredResults = results.filter(item => {
    const domain = item.domain || new URL(item.url).hostname;
    return !blacklistedDomains.includes(domain);
  });

  // Reset to page 1 whenever search query or results change
  useEffect(() => {
    setCurrentPage(1);
  }, [query, results]);

  const totalPages = Math.ceil(filteredResults.length / ITEMS_PER_PAGE);
  const currentResults = filteredResults.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

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
          <motion.div key={currentPage} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.25 }}>
            <AnimatePresence mode="popLayout">
              {currentResults.map((item, index) => (
                <ResultCard key={item.id || item.url} item={item} index={index} />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Advanced Animated Pagination */}
      {!isLoading && filteredResults.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={filteredResults.length}
          itemsPerPage={ITEMS_PER_PAGE}
        />
      )}
    </section>
  );
};
