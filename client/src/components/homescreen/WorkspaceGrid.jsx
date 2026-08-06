import { useMemo } from 'react';
import { Plus } from 'lucide-react';
import WorkspaceCard from './WorkspaceCard';
import { SkeletonWsCard } from '../../components/Skeleton';

function getCardSpan(itemCount) {
  if (itemCount >= 20) return 'span-2';
  if (itemCount >= 10) return 'span-2';
  if (itemCount >= 5) return '';
  return '';
}

export default function WorkspaceGrid({
  workspaces,
  itemsByWorkspace,
  loading,
  onNavigate,
  onChat,
  onCanvas,
  onCreate,
  className = '',
}) {
  const sortedWorkspaces = useMemo(() => {
    return [...workspaces].sort((a, b) => {
      const aCount = a.item_count ?? itemsByWorkspace[a.id]?.length ?? 0;
      const bCount = b.item_count ?? itemsByWorkspace[b.id]?.length ?? 0;
      return bCount - aCount;
    });
  }, [workspaces, itemsByWorkspace]);

  if (loading && workspaces.length === 0) {
    return <SkeletonWsCard count={6} className={className} />;
  }

  if (workspaces.length === 0) {
    return null;
  }

  return (
    <div className={`workspace-grid ${className}`} style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
      gap: '24px',
      gridAutoRows: 'minmax(180px, auto)',
    }}>
      {sortedWorkspaces.map((ws) => {
        const items = itemsByWorkspace[ws.id] || [];
        const span = getCardSpan(ws.item_count ?? items.length);
        return (
          <WorkspaceCard
            key={ws.id}
            workspace={ws}
            items={items}
            onNavigate={onNavigate}
            onChat={onChat}
            onCanvas={onCanvas}
            className={span}
          />
        );
      })}
      <WorkspaceCreateCard onCreate={onCreate} />
    </div>
  );
}

function WorkspaceCreateCard({ onCreate }) {
  return (
    <button
      onClick={onCreate}
      className="workspace-card relative rounded-xl bg-elevated/50 backdrop-blur-sm border-2 border-dashed border-border hover:border-accent/50 transition-all flex items-center justify-center min-h-[180px] group"
      style={{ gridColumn: 'span 1' }}
    >
      <div className="text-center px-6 opacity-60 group-hover:opacity-100 transition-opacity">
        <div className="size-12 rounded-xl bg-surface/50 flex items-center justify-center mx-auto mb-3 group-hover:bg-accent/10 transition-colors">
          <Plus size={24} className="text-accent" />
        </div>
        <h3 className="text-base font-semibold text-text mb-1">New workspace</h3>
        <p className="text-sm text-muted">Start a fresh research project</p>
      </div>
    </button>
  );
}