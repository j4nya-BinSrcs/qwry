import { ExternalLink, Loader2, Send, X } from "lucide-react";
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
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 pb-8" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl max-h-[calc(100vh-6rem)] mx-4 bg-white border border-border rounded-xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-text truncate">
            Chat: {workspaceName || "Workspace"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-md text-dim hover:text-text hover:bg-hover transition-all">
            <X size={16} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="py-12 text-center text-sm text-muted">
              Ask a question about your saved items
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
                  msg.role === "user"
                    ? "bg-black text-white"
                    : "bg-white border border-border text-text"
                }`}
              >
                <p className="whitespace-pre-line leading-relaxed">{msg.content}</p>
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border/50 space-y-1">
                    <p className="text-[10px] text-dim font-medium uppercase tracking-wider">Sources</p>
                    {msg.sources.map((s, j) => (
                      <a
                        key={j}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-[11px] text-text hover:text-muted"
                      >
                        <ExternalLink size={10} />
                        <span className="truncate">{s.title || s.url}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-border rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm text-muted">
                <Loader2 size={12} className="animate-spin" />
                Thinking...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 px-4 py-3 border-t border-border">
          <div className="flex items-center gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your saved items..."
              rows={1}
              className="flex-1 bg-hover border border-border rounded-lg px-3 py-2 text-sm text-text placeholder-dim outline-none focus:border-text resize-none"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="shrink-0 p-2 rounded-lg bg-black text-white hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
