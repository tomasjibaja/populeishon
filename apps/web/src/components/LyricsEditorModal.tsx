import { useEffect, useRef, useState } from 'react';
import { MAX_LYRICS_LENGTH } from '../lyrics';

interface Props {
  /** Letra actual de la partitura ('' si no tiene). */
  initial: string;
  title: string;
  saving: boolean;
  error: string | null;
  onSave: (text: string) => void;
  onClose: () => void;
}

/** Ventana para escribir, pegar o corregir la letra de la partitura abierta. */
export function LyricsEditorModal({ initial, title, saving, error, onSave, onClose }: Props) {
  const [text, setText] = useState(initial);
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    area.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saving]);

  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="lyrics-modal-title">
        <h2 id="lyrics-modal-title">Letra de “{title}”</h2>
        <p className="muted">Cada salto de línea es un verso nuevo; una línea en blanco separa las estrofas. Podés pegar el texto completo.</p>
        <textarea
          ref={area}
          className="lyrics-textarea"
          value={text}
          rows={14}
          maxLength={MAX_LYRICS_LENGTH}
          spellCheck={false}
          placeholder="Escribí o pegá la letra acá…"
          onChange={(event) => setText(event.target.value)}
        />
        <div className="modal-footer">
          <span className="muted">
            {text.length} / {MAX_LYRICS_LENGTH}
          </span>
          {error && (
            <span className="modal-error" role="alert">
              {error}
            </span>
          )}
          <span className="modal-buttons">
            <button type="button" className="button button-secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="button" className="button" onClick={() => onSave(text)} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar letra'}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
