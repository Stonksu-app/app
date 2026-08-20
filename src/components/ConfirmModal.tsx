import { Button } from './Button';

/**
 * A generic yes/no confirmation dialog for destructive actions.
 *
 * Styled after RegisterModal's overlay: full-screen scrim, centered card.
 * Kept generic (title/message/labels as props) so it can be reused wherever
 * an action needs a "are you sure?" step instead of firing immediately.
 */
export default function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  busy = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] bg-carbon-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-carbon-900 border-2 border-carbon-800 rounded-3xl p-6 animate-pop-in">
        <h2 className="text-xl font-black text-carbon-50">{title}</h2>
        <p className="text-sm text-carbon-400 mt-2">{message}</p>

        <div className="mt-5 flex gap-2.5">
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={busy}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
