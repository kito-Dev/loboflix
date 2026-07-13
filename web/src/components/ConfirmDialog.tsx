import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  loading = false,
  onConfirm,
  onClose,
}: Props) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="schedule-modal confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
      <button type="button" className="schedule-modal__backdrop" onClick={onClose} aria-label="Fechar" />
      <div className="schedule-modal__sheet">
        <div className="schedule-modal__handle" aria-hidden="true" />
        <div className="confirm-dialog__icon" aria-hidden="true">
          <AlertTriangle size={28} strokeWidth={1.8} />
        </div>
        <h2 id="confirm-dialog-title" className="schedule-modal__title">
          {title}
        </h2>
        <p className="schedule-modal__subtitle confirm-dialog__message">{message}</p>
        <button type="button" className="btn btn-danger-outline btn-block" onClick={onConfirm} disabled={loading}>
          {loading ? 'Removendo...' : confirmLabel}
        </button>
        <button type="button" className="btn btn-ghost btn-block" onClick={onClose} disabled={loading}>
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}
