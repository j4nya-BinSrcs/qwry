import { useCallback, useMemo, useState } from 'react';
import { Layers, Plus, Pencil, Trash2 } from 'lucide-react';
import { useSessionStore } from '../../stores/sessionStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useUIStore } from '../../stores/uiStore';
import BentoPixelBg from './BentoPixelBg';
import WorkspaceNameModal from './WorkspaceNameModal';

const GRADIENTS = [
  ['#0d5c63', '#083b40'],
  ['#147078', '#0d4f56'],
  ['#3a5f6b', '#243f49'],
  ['#4e4b5c', '#35333f'],
  ['#6b6486', '#464057'],
  ['#596e8a', '#37445c'],
];

const THUMB_HEIGHTS = [48, 56, 64, 72, 80];

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

function faviconUrl(domain) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}

function WsThumb({ ws, domains, cat }) {
  const tiles = 8;
  const shown = domains.slice(0, tiles);
  const extra = Math.max(0, domains.length - tiles);
  const height = THUMB_HEIGHTS[hashString(ws.id) % THUMB_HEIGHTS.length];

  return (
    <div className={`bento-ws-thumb is-${cat}`} style={{ height }}>
      <div className="bento-ws-thumb-bg" style={gradientStyle(ws.id)} />
      {shown.length === 0 ? (
        <div className="bento-ws-thumb-empty">
          <Layers size={14} className="text-surface/70" />
        </div>
      ) : (
        <div className="bento-ws-thumb-grid">
          {shown.map((d) => (
            <img key={d} src={faviconUrl(d)} alt="" loading="lazy" onError={(e) => { e.target.style.visibility = 'hidden'; }} />
          ))}
        </div>
      )}
      {extra > 0 && <span className="bento-ws-thumb-more">+{extra}</span>}
    </div>
  );
}

export default function BentoWorkspacesCard({ workspaces, itemsByWorkspace, loading, onCreate, onOpen }) {
  const sessionId = useSessionStore((s) => s.sessionId);
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);
  const updateWorkspace = useWorkspaceStore((s) => s.updateWorkspace);
  const deleteWorkspace = useWorkspaceStore((s) => s.deleteWorkspace);
  const setContextMode = useUIStore((s) => s.setContextMode);

  const [createOpen, setCreateOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);

  const cards = useMemo(() => {
    const sorted = [...(workspaces || [])].sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (tb !== ta) return tb - ta;
      const ac = a.item_count ?? itemsByWorkspace?.[a.id]?.length ?? 0;
      const bc = b.item_count ?? itemsByWorkspace?.[b.id]?.length ?? 0;
      return bc - ac;
    });
    return sorted.map((ws) => {
      const items = itemsByWorkspace?.[ws.id] || [];
      const seen = new Set();
      const domains = [];
      for (const it of items) {
        try {
          const d = new URL(it.url).hostname.replace(/^www\./, '');
          if (!seen.has(d)) {
            seen.add(d);
            domains.push(d);
          }
        } catch {}
      }
      const count = ws.item_count ?? items.length;
      const cat = count >= 8 ? 'lg' : count >= 4 ? 'md' : 'sm';
      return { ws, domains, count, cat };
    });
  }, [workspaces, itemsByWorkspace]);

  const total = workspaces?.length ?? 0;
  const overflow = Math.max(0, total - cards.length);

  const handleViewAll = useCallback(() => {
    if (onOpen && cards.length > 0) onOpen(cards[0].ws.id);
    else setContextMode('workspace');
  }, [onOpen, cards, setContextMode]);

  const handleCreateConfirm = useCallback(
    async (name) => {
      if (onCreate) await onCreate(name);
      else await createWorkspace(sessionId, name);
      setCreateOpen(false);
    },
    [onCreate, createWorkspace, sessionId]
  );

  const handleRenameConfirm = useCallback(
    async (name) => {
      if (renameTarget) await updateWorkspace(sessionId, renameTarget.id, name, null);
      setRenameTarget(null);
    },
    [renameTarget, sessionId, updateWorkspace]
  );

  const handleDelete = useCallback(
    async (ws) => {
      if (window.confirm(`Delete workspace "${ws.name}"?`)) {
        await deleteWorkspace(sessionId, ws.id);
      }
    },
    [sessionId, deleteWorkspace]
  );

  return (
    <div className="bento-card-inner bento-workspaces">
      <div className="bento-ws-pixel" aria-hidden="true">
        <BentoPixelBg />
      </div>

      <div className="bento-ws-content">
        <div className="bento-card-header">
          <div className="bento-card-title">
            <Layers size={13} />
            Workspaces
          </div>
          <span className="bento-card-badge">{total}</span>
          {total > 0 && (
            <button onClick={() => setCreateOpen(true)} className="bento-ws-create bento-ws-create--header">
              <Plus size={13} />
              New workspace
            </button>
          )}
        </div>

        {loading && cards.length === 0 ? (
          <div className="bento-ws-masonry">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="bento-ws-skeleton" style={{ height: 66 }} />
            ))}
          </div>
        ) : cards.length === 0 ? (
          <div className="bento-card-empty">
            <Layers size={18} />
            <p>No workspaces yet — start your first research project.</p>
            <button onClick={() => setCreateOpen(true)} className="bento-ws-create flex-none">
              <Plus size={13} />
              Create workspace
            </button>
          </div>
        ) : (
          <>
            <div className="bento-ws-masonry">
              {cards.map(({ ws, domains, count, cat }) => (
                <div
                  key={ws.id}
                  className={`bento-ws-card is-${cat}`}
                  onClick={() => onOpen?.(ws.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onOpen?.(ws.id);
                    }
                  }}
                >
                  <WsThumb ws={ws} domains={domains} cat={cat} />
                  <div className="bento-ws-card-body">
                    <span className="bento-ws-card-name">{ws.name}</span>
                    <span className="bento-ws-card-count">
                      {count} item{count !== 1 ? 's' : ''}
                    </span>
                    <span className="bento-ws-actions">
                      <button
                        onClick={(e) => { e.stopPropagation(); setRenameTarget(ws); }}
                        title="Rename workspace"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        className="is-danger"
                        onClick={(e) => { e.stopPropagation(); handleDelete(ws); }}
                        title="Delete workspace"
                      >
                        <Trash2 size={12} />
                      </button>
                    </span>
                  </div>
                </div>
              ))}
              {overflow > 0 && (
                <div
                  className="bento-ws-card is-sm bento-ws-more"
                  onClick={handleViewAll}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleViewAll();
                    }
                  }}
                >
                  <span className="bento-ws-card-name" style={{ color: 'var(--color-accent)' }}>
                    +{overflow} more
                  </span>
                  <span className="bento-ws-card-count">View all</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <WorkspaceNameModal
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onConfirm={handleCreateConfirm}
      />
      <WorkspaceNameModal
        open={!!renameTarget}
        title="Rename workspace"
        subtitle="Choose a new name for this workspace."
        placeholder="New name"
        confirmLabel="Rename"
        initialName={renameTarget?.name || ''}
        onCancel={() => setRenameTarget(null)}
        onConfirm={handleRenameConfirm}
      />
    </div>
  );
}
