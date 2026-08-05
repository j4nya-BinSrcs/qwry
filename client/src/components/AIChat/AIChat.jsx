import React, { useState, useEffect } from 'react';
import { Sparkles, Send, X, Grid } from 'lucide-react';
import { useSearch } from '../../context/SearchContext';
import { useAppDragDrop } from '../../context/DragDropContext';
import { searchApi } from '../../services/api';
import { useDroppable } from '@dnd-kit/core';
import { ChatMessage } from './ChatMessage';
import { PinnedSites } from './PinnedSites';
import { Pill } from '../common/Common';
import { motion, AnimatePresence } from 'framer-motion';
import './AIChat.css';

export const AIChat = () => {
  const { query, aiOverview, executeSearch, results } = useSearch();
  const { chatContextItems, removeChatContextItem } = useAppDragDrop();
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [displayedOverview, setDisplayedOverview] = useState('');
  const [isTypingOverview, setIsTypingOverview] = useState(false);
  // Default mode for LLM generation: "short", "elaborate", or "study"
  const [llmMode, setLlmMode] = useState('short');

  const { isOver, setNodeRef } = useDroppable({
    id: 'ai-chat-dropzone',
  });

  // Typewriter effect for AI Overview summary
  useEffect(() => {
    const summaryText = aiOverview?.summary || 'Qwry AI synthesis ready for your search query.';
    let index = 0;
    setDisplayedOverview('');
    setIsTypingOverview(true);

    const timer = setInterval(() => {
      if (index < summaryText.length) {
        setDisplayedOverview(prev => prev + summaryText.charAt(index));
        index++;
      } else {
        setIsTypingOverview(false);
        clearInterval(timer);
      }
    }, 12);

    return () => clearInterval(timer);
  }, [aiOverview, query]);

  const handleSendChat = async (e) => {
    if (e) e.preventDefault();
    if (!chatInput || !chatInput.trim() || isSending) return;

    const userMsg = { id: Date.now(), sender: 'user', text: chatInput.trim() };
    setMessages(prev => [...prev, userMsg]);
    const currentInput = chatInput.trim();
    setChatInput('');
    setIsSending(true);

    try {
      // NOTE: Backend has no conversational/multi-turn endpoint outside workspaces.
      // Each submitted message is an independent POST /api/llm/generate call
      // with query=currentInput and results context.
      const contextResults = [...chatContextItems, ...(results || [])];
      const res = await searchApi.aiChat(currentInput, contextResults, llmMode);
      const aiReplyMsg = { id: Date.now() + 1, sender: 'ai', text: res.response };
      setMessages(prev => [...prev, aiReplyMsg]);
    } catch (err) {
      console.error('[AIChat] Error sending message', err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section className="column-panel ai-chat-panel glass-panel">
      {/* Panel Header */}
      <div className="panel-header">
        <h2 className="panel-title font-heading">
          <Sparkles className="panel-icon" size={18} color="var(--accent-primary)" />
          AI Overview & Intelligence
        </h2>
      </div>

      <div className="panel-scroll-area ai-chat-scroll">
        {/* Section 1: AI Summary Overview */}
        <div className="ai-summary-box">
          <p className="ai-summary-text">
            {displayedOverview}
            {isTypingOverview && <span className="typewriter-cursor" />}
          </p>

          {/* Mode Selector Pills */}
          <div className="ai-mode-selector">
            <button
              type="button"
              className={`ai-mode-pill ${llmMode === 'short' ? 'active' : ''}`}
              onClick={() => setLlmMode('short')}
              title="Fast 35-50 word answer engine summary"
            >
              Short (Fast)
            </button>
            <button
              type="button"
              className={`ai-mode-pill ${llmMode === 'elaborate' ? 'active' : ''}`}
              onClick={() => setLlmMode('elaborate')}
              title="Full standalone report from LLM knowledge base"
            >
              Elaborate (Deep)
            </button>
            <button
              type="button"
              className={`ai-mode-pill ${llmMode === 'study' ? 'active' : ''}`}
              onClick={() => setLlmMode('study')}
              title="Reads top 5 search result web pages server-side"
            >
              Study (Web Synthesized)
            </button>
          </div>
        </div>

        {/* Chat Message History */}
        {messages.length > 0 && (
          <div className="chat-messages-container">
            {messages.map(msg => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
          </div>
        )}

        {/* Section 2: Chat Input & Dropzone */}
        <div
          ref={setNodeRef}
          className={`ai-dropzone-container ${isOver ? 'drop-target-active' : ''}`}
        >
          {/* Dropped Context Cards Stack */}
          {chatContextItems.length > 0 && (
            <div className="dropped-context-stack">
              <AnimatePresence>
                {chatContextItems.map(item => (
                  <motion.div
                    key={item.id || item.src}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    className="dropped-card-pill"
                  >
                    <span className="dropped-card-title">
                      {item.type === 'image' ? '🖼️ Image' : `🔗 ${item.title || item.domain || 'Card'}`}
                    </span>
                    <button
                      type="button"
                      className="dropped-card-remove"
                      onClick={() => removeChatContextItem(item.id || item.src)}
                    >
                      <X size={12} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          <form onSubmit={handleSendChat} className="ai-chat-form">
            <input
              type="text"
              className="ai-chat-input"
              placeholder={isOver ? "Drop to add context ✨" : `Ask AI (${llmMode} mode)... drop cards here`}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
            />
            <button
              type="submit"
              className="ai-send-btn"
              disabled={isSending || !chatInput.trim()}
            >
              <Send size={16} />
            </button>
          </form>
        </div>

        {/* Section 3: Related & Improve Suggestions */}
        <div className="related-suggestions-section">
          <div className="section-subtitle font-heading">
            <Grid size={14} color="var(--accent-secondary)" />
            <span>Related & Improve</span>
          </div>
          <div className="suggestions-pill-list">
            {(aiOverview?.suggestions || ['web design trends', 'fastapi backend', 'react 19 features']).map(pillText => (
              <Pill key={pillText} onClick={() => executeSearch(pillText)}>
                {pillText}
              </Pill>
            ))}
          </div>
        </div>

        {/* Section 4: Pinned Sites */}
        <PinnedSites />
      </div>
    </section>
  );
};
