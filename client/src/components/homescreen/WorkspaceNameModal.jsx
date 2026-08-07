import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
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
      <div className="relative w-full max-w-sm rounded-2xl qwry-popup animate-pop-in">
        <div className="qwry-popup-header">
          <h3 className="qwry-popup-title">
            {title}
          </h3>
          <button onClick={onCancel} className="qwry-popup-close" title="Close">
            <X size={16} />
          </button>
        </div>
        <div className="qwry-popup-body">
          <p className="text-xs text-dim mb-3">{subtitle}</p>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") onCancel();
            }}
            placeholder={placeholder}
            className="qwry-popup-input"
          />
        </div>
        <div className="qwry-popup-footer">
          <button
            onClick={onCancel}
            className="qwry-popup-btn qwry-popup-btn--secondary"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!name.trim()}
            className="qwry-popup-btn qwry-popup-btn--primary"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
