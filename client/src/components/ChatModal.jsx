import { ExternalLink, Loader2, Send, X, Bot, User } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { chatWithWorkspace } from "../api/chat";
import { useSessionStore } from "../stores/sessionStore";

export default function ChatModal({ workspaceId, workspaceName, onClose }) {
  const sessionId = useSessionStore((s) => s.sessionId);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = useCallback(async () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setLoading(true);
    try {
      const data = await chatWithWorkspace(sessionId, workspaceId, q);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer, sources: data.sources || [] },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${err.message}`, sources: [] },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, sessionId, workspaceId]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
      if (e.key === "Escape") onClose();
    },
    [handleSend, onClose]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 pb-8 px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md animate-in fade-in duration-200" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl max-h-[calc(100vh-5rem)] bg-elevated/95 backdrop-blur-xl border border-violet-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col z-10 animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-border/80 bg-surface/50">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20">
              <Bot size={18} className="text-violet-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text font-heading truncate">
                AI Workspace Chat
              </h2>
              <p className="text-[10px] text-muted font-medium">{workspaceName || "Workspace Context"}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-muted hover:text-text hover:bg-hover border border-transparent hover:border-border transition-all">
            <X size={16} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.length === 0 && (
            <div className="py-16 text-center">
              <div className="size-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-3">
                <Bot size={22} className="text-violet-400" />
              </div>
              <p className="text-sm font-medium text-muted">Ask any question synthesize insights from your workspace sources</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex items-start gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
              <div className={`size-7 rounded-lg shrink-0 flex items-center justify-center text-xs ${
                msg.role === "user" ? "bg-violet-600 text-white" : "bg-cyan-500/10 border border-cyan-500/20 text-cyan-300"
              }`}>
                {msg.role === "user" ? <User size={13} /> : <Bot size={13} />}
              </div>

              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-md ${
                  msg.role === "user"
                    ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-medium"
                    : "glass-card text-text border-border/80"
                }`}
              >
                <p className="whitespace-pre-line leading-relaxed">{msg.content}</p>
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-border/50 space-y-1">
                    <p className="text-[10px] text-cyan-300 font-bold uppercase tracking-wider">Referenced Sources</p>
                    {msg.sources.map((s, j) => (
                      <a
                        key={j}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-[11px] text-muted hover:text-violet-300 transition-colors"
                      >
                        <ExternalLink size={10} className="shrink-0" />
                        <span className="truncate">{s.title || s.url}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-3">
              <div className="size-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 flex items-center justify-center">
                <Bot size={13} />
              </div>
              <div className="glass-card rounded-2xl px-4 py-2.5 flex items-center gap-2 text-xs text-muted">
                <Loader2 size={13} className="animate-spin text-violet-400" />
                Thinking...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 px-4 py-3.5 border-t border-border/80 bg-surface/50">
          <div className="flex items-center gap-2 input-glow-focus rounded-xl">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your saved sources..."
              rows={1}
              className="flex-1 bg-panel/80 border border-border/80 rounded-xl px-3.5 py-2.5 text-sm text-text placeholder-dim outline-none focus:border-violet-500/60 resize-none transition-all"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="shrink-0 p-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md hover:opacity-90 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

