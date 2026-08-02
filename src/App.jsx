import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './context/ThemeContext';
import { SearchProvider } from './context/SearchContext';
import { SiteActionsProvider } from './context/SiteActionsContext';
import { DragDropProvider } from './context/DragDropContext';

import { LandingPage } from './pages/LandingPage';
import { SearchPage } from './pages/SearchPage';

import './styles/global.css';

export default function App() {
  return (
    <ThemeProvider>
      <SearchProvider>
        <SiteActionsProvider>
          <DragDropProvider>
            <Router>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Router>

            <Toaster
              position="bottom-right"
              toastOptions={{
                duration: 3500,
                style: {
                  background: 'var(--bg-elevated)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-default)',
                  backdropFilter: 'blur(16px)',
                  fontSize: '0.875rem',
                  fontFamily: 'var(--font-body)'
                }
              }}
            />
          </DragDropProvider>
        </SiteActionsProvider>
      </SearchProvider>
    </ThemeProvider>
  );
}
