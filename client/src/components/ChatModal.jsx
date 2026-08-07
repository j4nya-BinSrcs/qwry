import { ExternalLink, Loader2, Send, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { chatWithWorkspace, workspaceChatHistory } from "../api/chat";
import { useSessionStore } from "../stores/sessionStore";

export default function ChatModal({ workspaceId, workspaceName, onClose }) {
  const sessionId = useSessionStore((s) => s.sessionId);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const bottomRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (!workspaceId || !sessionId) return;
    setHistoryLoading(true);
    workspaceChatHistory(sessionId, workspaceId)
      .then((data) => {
        if (data?.messages) {
          setMessages(data.messages.map((m) => ({
            role: m.role,
            content: m.content,
            sources: m.sources || [],
          })));
        }
      })
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, [workspaceId, sessionId]);

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
      <div className="absolute inset-0 bg-text/60" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl max-h-[calc(100vh-6rem)] mx-4 qwry-popup animate-pop-in"
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-5 py-4 qwry-popup-header">
          <h2 className="text-base font-semibold text-text truncate">
            Chat: {workspaceName || "Workspace"}
          </h2>
          <button onClick={onClose} className="qwry-popup-close" title="Close">
            <X size={16} />
          </button>
        </div>

        {/* Messages */}
        <div className="qwry-popup-body">
          {messages.length === 0 && (
            <div className="py-12 text-center text-sm text-muted">
              Ask a question about your saved items
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} mb-4`}>
              <div
                className={`max-w-[80%] rounded-xl px-4 py-3 text-sm ${
                  msg.role === "user"
                    ? "bg-text text-surface"
                    : "bg-elevated shadow-surface text-text"
                }`}
              >
                <p className="whitespace-pre-line leading-relaxed">{msg.content}</p>
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border/50 space-y-1">
                    <div className="qwry-popup-section-title">Sources</div>
                    {msg.sources.map((s, j) => (
                      <a
                        key={j}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs text-text hover:text-muted"
                      >
                        <ExternalLink size={16} />
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
              <div className="bg-elevated shadow-surface rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-muted">
                <Loader2 size={16} className="animate-spin" />
                Thinking...
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="shrink-0 px-4 py-3 border-t border-border qwry-popup-footer">
          <div className="flex items-center gap-2 w-full">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your saved items..."
              rows={1}
              className="qwry-popup-input resize-none"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="qwry-popup-btn qwry-popup-btn--primary"
              title="Send"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
