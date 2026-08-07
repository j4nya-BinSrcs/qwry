import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export default function WorkspaceNameModal({
  open,
  title = 'New workspace',
  subtitle = 'Give your workspace a name to start organizing your research.',
  placeholder = 'Workspace name',
  confirmLabel = 'Create',
  initialName = '',
  onConfirm,
  onCancel,
}) {
  const [name, setName] = useState(initialName);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setName(initialName);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open, initialName]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const submit = () => {
    const trimmed = name.trim();
    if (trimmed) onConfirm(trimmed);
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-elevated shadow-pop p-5 animate-pop-in">
        <h3 className="text-base font-semibold text-text mb-1">{title}</h3>
        <p className="text-xs text-muted mb-4">{subtitle}</p>
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') onCancel();
          }}
          placeholder={placeholder}
          className="w-full px-3 py-2 rounded-lg bg-hover border border-border text-text text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 mb-4"
        />
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm text-text hover:bg-hover transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!name.trim()}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-surface hover:bg-accent-hover transition-colors disabled:opacity-40"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
