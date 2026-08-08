import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Layers, Sparkles, ArrowRight } from 'lucide-react';
import { useSessionStore } from '../../stores/sessionStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useUIStore } from '../../stores/uiStore';
import WorkspaceNameModal from './WorkspaceNameModal';

const PARTICLE_COUNT = 30;

export default function EmptyState({ className = '' }) {
  const [particles, setParticles] = useState([]);
  const animationRef = useRef(null);
  const timeRef = useRef(0);
  const prefersReducedMotion = useRef(false);

  const sessionId = useSessionStore((s) => s.sessionId);
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);
  const setContextMode = useUIStore((s) => s.setContextMode);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotion.current = mediaQuery.matches;
    const handler = (e) => { prefersReducedMotion.current = e.matches; };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion.current) return;

    const newParticles = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.002,
      vy: (Math.random() - 0.5) * 0.002,
      size: 2 + Math.random() * 4,
      opacity: 0.1 + Math.random() * 0.2,
      targetX: Math.random(),
      targetY: Math.random(),
      forming: false,
    }));
    setParticles(newParticles);

    const animate = (time) => {
      timeRef.current = time * 0.001;
      setParticles((prev) => prev.map((p) => {
        if (!p.forming && Math.random() < 0.001) {
          return { ...p, forming: true, targetX: 0.3 + Math.random() * 0.4, targetY: 0.3 + Math.random() * 0.4 };
        }
        if (p.forming) {
          const dx = p.targetX - p.x;
          const dy = p.targetY - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 0.01) {
            return { ...p, forming: false, targetX: Math.random(), targetY: Math.random() };
          }
          return { ...p, x: p.x + dx * 0.02, y: p.y + dy * 0.02 };
        }
        return {
          ...p,
          x: (p.x + p.vx * 1000) % 1,
          y: (p.y + p.vy * 1000) % 1,
        };
      }));
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationRef.current);
  }, []);

  const [modalOpen, setModalOpen] = useState(false);

  const handleCreate = useCallback(async (name) => {
    if (!name) return;
    const ws = await createWorkspace(sessionId, name);
    if (ws) {
      setContextMode('workspace');
    }
    setModalOpen(false);
  }, [sessionId, createWorkspace, setContextMode]);

  const accentColor = 'var(--color-accent)';

  return (
    <div className={`empty-state relative flex flex-col items-center justify-center min-h-[400px] px-6 ${className}`}>
      <div
        className="absolute inset-0 overflow-hidden"
        aria-hidden="true"
        style={{ borderRadius: '16px' }}
      >
        <svg viewBox="0 0 1 1" className="w-full h-full" style={{ pointerEvents: 'none' }}>
          {particles.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={p.size / 400}
              fill={accentColor}
              opacity={p.opacity}
            />
          ))}
        </svg>
      </div>

      <div className="relative z-10 text-center">
        <div className="size-16 rounded-2xl bg-elevated/80 backdrop-blur-sm border border-border flex items-center justify-center mx-auto mb-6 shadow-raised">
          <div className="relative size-8">
            <Layers size={32} className="text-accent" />
            {!prefersReducedMotion.current && (
              <div className="absolute inset-0 animate-pulse rounded-full border-2 border-accent/30" style={{ animationDuration: '2s' }} />
            )}
          </div>
        </div>

        <h1 className="text-2xl font-semibold text-text tracking-tight mb-2">Start your research</h1>
        <p className="text-base text-muted max-w-xs mb-8">
          Create a workspace to collect sources, take notes, and build knowledge.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => setModalOpen(true)}
            className="group flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-text text-surface font-medium text-sm hover:opacity-85 transition-opacity min-w-[180px]"
          >
            <Plus size={18} />
            <span>Create Workspace</span>
          </button>

          <button
            onClick={() => { setContextMode('search-assist'); }}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-border text-text font-medium text-sm hover:bg-hover transition-colors min-w-[180px]"
          >
            <Sparkles size={18} className="text-accent" />
            <span>Search first</span>
          </button>
        </div>

          <p className="mt-6 text-xs text-dim">
            Or press <kbd className="px-1.5 py-0.5 rounded bg-hover font-mono">⌘K</kbd> to open search from anywhere
          </p>
        </div>

        <WorkspaceNameModal
          open={modalOpen}
          title="New workspace"
          subtitle="Give your new workspace a name to get started."
          placeholder="Workspace name"
          confirmLabel="Create"
          initialName=""
          onCancel={() => setModalOpen(false)}
          onConfirm={handleCreate}
        />
      </div>
  );
}