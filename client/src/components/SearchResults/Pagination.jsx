import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import './Pagination.css';

export const Pagination = ({ currentPage, totalPages, onPageChange, totalItems, itemsPerPage }) => {
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <div className="pagination-container">
      <span className="pagination-info">
        Showing {startItem}-{endItem} of {totalItems}
      </span>

      <div className="pagination-controls">
        <button
          type="button"
          className="pagination-btn arrow-btn"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Previous Page"
        >
          <ChevronLeft size={16} />
        </button>

        {getPageNumbers().map(pageNum => {
          const isActive = pageNum === currentPage;
          return (
            <button
              key={pageNum}
              type="button"
              className={`pagination-btn page-num-btn ${isActive ? 'active' : ''}`}
              onClick={() => onPageChange(pageNum)}
            >
              {isActive && (
                <motion.div
                  layoutId="activePaginationPage"
                  className="pagination-active-pill"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <span className="page-num-text">{pageNum}</span>
            </button>
          );
        })}

        <button
          type="button"
          className="pagination-btn arrow-btn"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label="Next Page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};
