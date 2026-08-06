import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ExternalLink, MessageCircle, Layers, Scale, Plus, MoreHorizontal,
  ChevronRight, Trash2, Edit3, Copy, Check, ArrowRight,
} from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useWorkspaceStationStore } from '../../stores/workspaceStationStore';
import { useSessionStore } from '../../stores/sessionStore';

const GRADIENTS = [
  ['#0d5c63', '#083b40'],
  ['#147078', '#0d4f56'],
  ['#3a5f6b', '#243f49'],
  ['#4e4b5c', '#35333f'],
  ['#6b6486', '#464057'],
  ['#596e8a', '#37445c'],
];

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

function gradientStyle(seed) {
  const grad = GRADIENTS[hashString(seed) % GRADIENTS.length];
  return { background: `linear-gradient(135deg, ${grad[0]}, ${grad[1]})` };
}

function GradientBg({ seed }) {
  return <div className="absolute inset-0" style={gradientStyle(seed)} />;
}

function Favicon({ domain, size = 16 }) {
  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=${size * 4}`}
      alt=""
      className={`rounded size-${size / 4} shrink-0`}
      onError={(e) => { e.target.style.display = 'none'; }}
    />
  );
}

function DomainPill({ domain, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-text hover:bg-hover transition-colors group"
      title={`Filter by ${domain}`}
    >
      <Favicon domain={domain} size={12} />
      <span className="truncate max-w-[100px]">{domain}</span>
    </button>
  );
}

function ActionButton({ children, onClick, primary = false, disabled, 'aria-label': ariaLabel, className = '' }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
        primary
          ? 'bg-text text-surface hover:opacity-85'
          : 'text-text hover:bg-hover'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : ''} ${className}`}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}

function ContextMenu({ items, onClose, anchorRef }) {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target) && anchorRef.current && !anchorRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [anchorRef, onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 rounded-lg bg-elevated border border-border shadow-pop overflow-hidden animate-pop-in min-w-[180px]"
      role="menu"
    >
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => { item.onClick(); onClose(); }}
          className={`w-full px-3 py-2 text-left text-sm text-text hover:bg-hover transition-colors flex items-center gap-2 ${
            item.danger ? 'text-red-400' : ''
          }`}
          role="menuitem"
          disabled={item.disabled}
        >
          {item.icon && <item.icon size={16} />}
          {item.label}
          {item.shortcut && <span className="ml-auto text-xs text-dim">{item.shortcut}</span>}
        </button>
      ))}
    </div>
  );
}

function HeroMediaStrip({ items, workspaceId, className }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [images, setImages] = useState([]);
  const intervalRef = useRef(null);

  useEffect(() => {
    const mediaItems = items
      .filter((item) => item.media_url || item.thumbnail || item.img_src)
      .slice(0, 6);
    setImages(mediaItems);
    if (mediaItems.length > 1) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % mediaItems.length);
      }, 4000);
    }
    return () => clearInterval(intervalRef.current);
  }, [items]);

  if (images.length === 0) {
    return (
      <div className={`relative h-24 w-full ${className}`}>
        <GradientBg seed={workspaceId} />
        <div className="absolute inset-0 flex items-center justify-center">
          <Layers size={24} className="text-surface/60" />
        </div>
      </div>
    );
  }

  if (images.length === 1) {
    const item = images[0];
    const src = item.media_url || item.thumbnail || item.img_src;
    return (
      <div className={`relative h-24 w-full ${className}`}>
        <img
          src={`/api/image-proxy?url=${encodeURIComponent(src)}`}
          alt={item.title || ''}
          className="w-full h-full object-cover"
          onError={(e) => { e.target.style.display = 'none'; }}
        />
      </div>
    );
  }

  if (images.length <= 4) {
    return (
      <div className={`relative h-24 w-full grid grid-cols-2 gap-1 p-1 ${className}`}>
        {images.map((item, i) => {
          const src = item.media_url || item.thumbnail || item.img_src;
          return (
            <div key={i} className="relative aspect-square rounded overflow-hidden">
              <img
                src={`/api/image-proxy?url=${encodeURIComponent(src)}`}
                alt={item.title || ''}
                className="w-full h-full object-cover"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`relative h-24 w-full ${className}`}>
      <img
        src={`/api/image-proxy?url=${encodeURIComponent(images[currentIndex].media_url || images[currentIndex].thumbnail || images[currentIndex].img_src)}`}
        alt={images[currentIndex].title || ''}
        className="w-full h-full object-cover transition-opacity duration-500"
        onError={(e) => { e.target.style.display = 'none'; }}
      />
    </div>
  );
}

function EmptyCard({ onCreate, className }) {
  return (
    <div className={`relative rounded-xl bg-elevated/80 backdrop-blur-sm border border-border overflow-hidden flex flex-col ${className}`}>
      <div className="absolute inset-0 flex items-center justify-center">
        <GradientBg seed="empty" />
        <div className="relative z-10 text-center px-6">
          <div className="size-12 rounded-xl bg-surface/50 flex items-center justify-center mx-auto mb-3">
            <Layers size={24} className="text-dim" />
          </div>
          <h3 className="text-base font-semibold text-text mb-1">Empty workspace</h3>
          <p className="text-sm text-muted mb-4">Add sources to start your research</p>
          <ActionButton primary onClick={onCreate}>
            <Plus size={14} /> Add sources
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

export default function WorkspaceCard({
  workspace,
  items,
  onNavigate,
  onChat,
  onCanvas,
  onDelete,
  onRename,
  onDuplicate,
  className = '',
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const menuAnchorRef = useRef(null);
  const cardRef = useRef(null);

  const sessionId = useSessionStore((s) => s.sessionId);
  const openSummarizer = useUIStore((s) => s.openSummarizer);
  const openReader = useUIStore((s) => s.openReader);
  const setContextMode = useUIStore((s) => s.setContextMode);
  const deleteWorkspace = useWorkspaceStore((s) => s.deleteWorkspace);
  const updateWorkspace = useWorkspaceStore((s) => s.updateWorkspace);
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);

  const count = workspace.item_count ?? items?.length ?? 0;
  const hasNotes = useWorkspaceStationStore.getState().notes?.some(n => n.workspace_id === workspace.id) ?? false;
  const hasComparisons = useWorkspaceStationStore.getState().comparisons?.some(c => c.workspace_id === workspace.id) ?? false;

  const domains = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const item of items || []) {
      try {
        const d = new URL(item.url).hostname.replace(/^www\./, '');
        if (!seen.has(d)) {
          seen.add(d);
          out.push(d);
        }
      } catch {}
    }
    return out;
  }, [items]);

  const updatedAt = useMemo(() => {
    if (!workspace.updated_at) return null;
    try {
      return new Date(workspace.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch { return null; }
  }, [workspace.updated_at]);

  const handleNavigate = useCallback(() => {
    setActiveWorkspace(workspace.id);
    setContextMode('workspace');
    onNavigate?.(workspace.id);
  }, [workspace.id, setActiveWorkspace, setContextMode, onNavigate]);

  const handleChat = useCallback(() => {
    setActiveWorkspace(workspace.id);
    setContextMode('workspace');
    onChat?.(workspace.id);
  }, [workspace.id, setActiveWorkspace, setContextMode, onChat]);

  const handleCanvas = useCallback(() => {
    setActiveWorkspace(workspace.id);
    setContextMode('workspace');
    onCanvas?.(workspace.id);
  }, [workspace.id, setActiveWorkspace, setContextMode, onCanvas]);

  const handleDelete = useCallback(async (e) => {
    e.stopPropagation();
    if (window.confirm(`Delete workspace "${workspace.name}"?`)) {
      await deleteWorkspace(sessionId, workspace.id);
    }
    onDelete?.(workspace.id);
    setShowMenu(false);
  }, [sessionId, workspace, deleteWorkspace, onDelete]);

  const handleRename = useCallback(() => {
    const name = prompt('New workspace name:', workspace.name);
    if (name && name !== workspace.name) {
      updateWorkspace(sessionId, workspace.id, name, null);
    }
    onRename?.(workspace.id, name);
    setShowMenu(false);
  }, [sessionId, workspace, updateWorkspace, onRename]);

  const handleDuplicate = useCallback(async () => {
    const newWs = await useWorkspaceStore.getState().createWorkspace(sessionId, `${workspace.name} (copy)`, workspace.description);
    if (newWs) {
      const wsItems = useWorkspaceStore.getState().items.filter(i => i.workspace_id === workspace.id);
      await useWorkspaceStore.getState().addItemsBulk(sessionId, newWs.id, wsItems.map(i => ({
        url: i.url, title: i.title, snippet: i.snippet, source: i.source, media_url: i.media_url
      })));
    }
    onDuplicate?.(newWs?.id);
    setShowMenu(false);
  }, [sessionId, workspace, onDuplicate]);

  const menuItems = [
    { label: 'Rename', icon: Edit3, onClick: handleRename, shortcut: '⌘R' },
    { label: 'Duplicate', icon: Copy, onClick: handleDuplicate, shortcut: '⌘D' },
    { type: 'separator' },
    { label: 'Export…', icon: ArrowRight, onClick: () => { /* TODO */ setShowMenu(false); } },
    { type: 'separator' },
    { label: 'Delete', icon: Trash2, onClick: handleDelete, danger: true },
  ];

  if (count === 0) {
    return (
      <EmptyCard onCreate={handleNavigate} className={className} />
    );
  }

  return (
    <div
      ref={cardRef}
      className={`workspace-card relative rounded-xl bg-elevated/80 backdrop-blur-sm border border-border overflow-hidden transition-all duration-slow ease-out group/focus ${isHovered ? 'shadow-card-hover -translate-y-1' : 'shadow-card'} hover:shadow-card-hover hover:-translate-y-1 ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleNavigate}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleNavigate(); }}
      role="button"
      aria-label={`Open workspace ${workspace.name}`}
    >
      <HeroMediaStrip items={items} workspaceId={workspace.id} className="relative z-0" />

      <div className="relative z-10 p-4 pb-3 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-text truncate pr-8">{workspace.name}</h3>
            <div className="flex items-center gap-2 mt-1 text-xs text-dim flex-wrap">
              <span>{count} source{count !== 1 ? 's' : ''}</span>
              {hasNotes && <span>· {useWorkspaceStationStore.getState().notes?.filter(n => n.workspace_id === workspace.id).length ?? 0} note{useWorkspaceStationStore.getState().notes?.filter(n => n.workspace_id === workspace.id).length !== 1 ? 's' : ''}</span>}
              {hasComparisons && <span>· {useWorkspaceStationStore.getState().comparisons?.filter(c => c.workspace_id === workspace.id).length ?? 0} comparison{useWorkspaceStationStore.getState().comparisons?.filter(c => c.workspace_id === workspace.id).length !== 1 ? 's' : ''}</span>}
              {updatedAt && <span>· Updated {updatedAt}</span>}
            </div>
          </div>
          <button
            ref={menuAnchorRef}
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            className="shrink-0 p-1.5 rounded-lg text-dim hover:text-text hover:bg-hover transition-colors"
            aria-label="Workspace options"
            aria-expanded={showMenu}
          >
            <MoreHorizontal size={16} />
          </button>
        </div>

        {domains.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {domains.slice(0, 4).map((d) => (
              <DomainPill key={d} domain={d} onClick={(e) => { e.stopPropagation(); }} />
            ))}
            {domains.length > 4 && (
              <span className="flex items-center px-2 py-1 rounded-md text-xs text-dim bg-hover shrink-0">
                +{domains.length - 4}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 pt-1 border-t border-border/50">
          <ActionButton primary onClick={handleNavigate}>
            <ArrowRight size={14} /> Continue
          </ActionButton>
          <ActionButton onClick={handleChat}>
            <MessageCircle size={14} /> Chat
          </ActionButton>
          {hasComparisons && (
            <ActionButton onClick={handleCanvas}>
              <Scale size={14} /> Compare
            </ActionButton>
          )}
          {(!hasComparisons || count > 10) && (
            <ActionButton onClick={handleCanvas}>
              <Layers size={14} /> Canvas
            </ActionButton>
          )}
          <div className="flex-1" />
          {showMenu && (
            <ContextMenu items={menuItems} onClose={() => setShowMenu(false)} anchorRef={menuAnchorRef} />
          )}
        </div>
      </div>
    </div>
  );
}