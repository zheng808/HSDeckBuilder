import { useEffect, useState } from 'react';
import { extractDeckstring } from '@hsdeck/shared';
import { useDecodeDeckCode } from '../../api/hooks';
import { errorMessage } from '../../api/client';
import type { DecodeResponse } from '../../api/types';
import { Button } from '../ui/Button';

interface ImportDeckCodeDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (decoded: DecodeResponse) => void;
}

export function ImportDeckCodeDialog({ open, onClose, onImport }: ImportDeckCodeDialogProps) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const decode = useDecodeDeckCode();

  useEffect(() => {
    if (open) {
      setText('');
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = async () => {
    const code = extractDeckstring(text) ?? text.trim();
    if (!code) {
      setError('Paste a deck code first.');
      return;
    }
    try {
      const decoded = await decode.mutateAsync(code);
      onImport(decoded);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
        className="card-surface flex w-full max-w-lg flex-col gap-3 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="import-title" className="text-lg font-semibold">
          Import a deck code
        </h2>
        <p className="text-sm text-ink-muted">
          Paste a code copied from the game client or another site. Comment lines starting with #
          are ignored.
        </p>
        <label className="sr-only" htmlFor="deck-code-input">
          Deck code
        </label>
        <textarea
          id="deck-code-input"
          autoFocus
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="AAECAf0E…"
          className="w-full resize-y rounded-md border border-line bg-bg p-2 font-mono text-sm placeholder:text-ink-faint focus:border-gold"
        />
        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={decode.isPending}>
            Import
          </Button>
        </div>
      </div>
    </div>
  );
}
