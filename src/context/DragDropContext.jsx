import React, { createContext, useContext, useState } from 'react';
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';

const DragDropContext = createContext();

export const DragDropProvider = ({ children }) => {
  const [activeItem, setActiveItem] = useState(null);
  const [chatContextItems, setChatContextItems] = useState([]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragStart = (event) => {
    const { active } = event;
    if (active && active.data && active.data.current) {
      setActiveItem(active.data.current);
    }
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.data.current) {
      const item = active.data.current;
      if (over.id === 'ai-chat-dropzone') {
        setChatContextItems(prev => {
          if (prev.some(c => c.id === item.id || (c.src && c.src === item.src))) return prev;
          return [...prev, item];
        });
      }
    }
    setActiveItem(null);
  };

  const removeChatContextItem = (idOrSrc) => {
    setChatContextItems(prev => prev.filter(c => c.id !== idOrSrc && c.src !== idOrSrc));
  };

  const clearChatContext = () => setChatContextItems([]);

  return (
    <DragDropContext.Provider value={{ activeItem, chatContextItems, removeChatContextItem, clearChatContext }}>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {children}
        <DragOverlay zIndex={500}>
          {activeItem ? (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '12px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--accent-primary)',
                boxShadow: 'var(--shadow-glow-primary)',
                opacity: 0.85,
                backdropFilter: 'blur(12px)',
                color: 'var(--text-primary)',
                maxWidth: '280px',
                pointerEvents: 'none'
              }}
            >
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Dragging {activeItem.type || 'item'}
              </div>
              <div style={{ fontWeight: 600, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeItem.title || activeItem.alt || 'Item'}
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </DragDropContext.Provider>
  );
};

export const useAppDragDrop = () => useContext(DragDropContext);
