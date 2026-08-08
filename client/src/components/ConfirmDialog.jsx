import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

export default function ConfirmDialog({
  open,
  title = 'Confirm',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-2xl qwry-popup animate-pop-in">
        <div className="qwry-popup-header">
          <h3 className="qwry-popup-title">{title}</h3>
          <button onClick={onCancel} className="qwry-popup-close" title="Close">
            <X size={16} />
          </button>
        </div>
        <div className="qwry-popup-body">
          {message && <p className="text-xs text-dim">{message}</p>}
        </div>
        <div className="qwry-popup-footer">
          <button
            onClick={onCancel}
            className="qwry-popup-btn qwry-popup-btn--secondary"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`qwry-popup-btn ${destructive ? 'qwry-popup-btn--destructive' : 'qwry-popup-btn--primary'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}