import { useState, useCallback, useEffect } from "react";
import { Layers, X, Plus, Sparkles, FolderPlus } from "lucide-react";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { useSessionStore } from "../stores/sessionStore";
import { useUIStore } from "../stores/uiStore";

const PRESET_SUGGESTIONS = [
  "Deep Learning Research",
  "Product Roadmap 2026",
  "Market Competitors",
  "Design Inspiration",
  "Daily Knowledge Hub",
];

export default function CreateWorkspaceModal() {
  const open = useUIStore((s) => s.createWsModalOpen);
  const close = useUIStore((s) => s.closeCreateWsModal);
  const setContextMode = useUIStore((s) => s.setContextMode);

  const sessionId = useSessionStore((s) => s.sessionId);
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setError(null);
      setLoading(false);
    }
  }, [open]);

  const handleSubmit = useCallback(async (e) => {
    if (e) e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter a workspace name.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const ws = await createWorkspace(sessionId, trimmed, description.trim() || null);
      if (ws) {
        close();
        setContextMode("workspace");
      }
    } catch (err) {
      setError(err.message || "Failed to create workspace.");
    } finally {
      setLoading(false);
    }
  }, [name, description, sessionId, createWorkspace, close, setContextMode]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Escape") close();
  }, [close]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={close}
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md animate-in fade-in duration-200" />
      
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg bg-elevated/95 backdrop-blur-xl border border-violet-500/30 rounded-2xl shadow-2xl overflow-hidden z-10 animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/80 bg-surface/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400">
              <FolderPlus size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text font-heading">
                New Research Workspace
              </h2>
              <p className="text-[11px] text-muted font-medium">Create a dedicated space for your sources and notes</p>
            </div>
          </div>
          <button
            onClick={close}
            className="p-1.5 rounded-xl text-muted hover:text-text hover:bg-hover border border-transparent hover:border-border transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 font-medium">
              {error}
            </div>
          )}

          {/* Workspace Name Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text uppercase tracking-wider font-heading">
              Workspace Name <span className="text-violet-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Quantum Computing Research"
              autoFocus
              className="w-full h-11 px-4 rounded-xl bg-panel/80 border border-border/80 text-sm text-text placeholder:text-dim outline-none transition-all focus:border-violet-500/80 focus:bg-elevated focus:ring-2 focus:ring-violet-500/20"
            />
          </div>

          {/* Quick Suggestions Pills */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-medium text-dim">Quick Suggestions:</span>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_SUGGESTIONS.map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => setName(sug)}
                  className="px-2.5 py-1 text-xs rounded-lg bg-surface/80 hover:bg-violet-500/15 border border-border/60 hover:border-violet-500/30 text-muted hover:text-violet-300 transition-all"
                >
                  + {sug}
                </button>
              ))}
            </div>
          </div>

          {/* Description Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text uppercase tracking-wider font-heading">
              Description <span className="text-dim text-[10px] lowercase font-normal">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief summary or objective of this workspace..."
              rows={2}
              className="w-full p-3 rounded-xl bg-panel/80 border border-border/80 text-xs text-text placeholder:text-dim outline-none transition-all focus:border-violet-500/80 focus:bg-elevated resize-none"
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border/80">
            <button
              type="button"
              onClick={close}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-muted hover:text-text hover:bg-hover border border-transparent hover:border-border transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || loading}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25 hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus size={14} />
              {loading ? "Creating..." : "Create Workspace"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
