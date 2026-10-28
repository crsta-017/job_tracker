import { useEffect, useRef } from "react";

// Accessible modal built on the native <dialog> element (focus trap and Esc come for free)
export default function ConfirmDialog({ open, title, children, confirmLabel, busy, onConfirm, onCancel }) {
  const ref = useRef(null);

  useEffect(() => {
    const d = ref.current;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dialog"
      onCancel={(e) => { e.preventDefault(); onCancel(); }}
      onClick={(e) => { if (e.target === ref.current) onCancel(); }} // click on the backdrop
    >
      <div className="dialog-body">
        <h2>{title}</h2>
        <div className="dialog-text">{children}</div>
        <div className="dialog-actions">
          <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn danger" onClick={onConfirm} disabled={busy}>
            {busy ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
