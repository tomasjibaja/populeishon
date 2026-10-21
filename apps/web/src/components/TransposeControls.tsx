import { type Mode, type Score, type ViewTransposition, allKeys, formatKey, formatKeySignature } from '@partituras/core';

export const DEFAULT_TRANSPOSE: Required<ViewTransposition> = { mode: null, targetFifths: null, octaves: 0 };

export type TransposeState = Required<ViewTransposition>;

const MAX_OCTAVES = 3;

export function isOriginal(state: TransposeState): boolean {
  return state.mode === null && state.targetFifths === null && state.octaves === 0;
}

interface Props {
  /** La partitura tal como está guardada (sin transponer). */
  stored: Score;
  state: TransposeState;
  onChange: (state: TransposeState) => void;
  /**
   * Muestra también los controles de octava, de modo de la tonalidad original y "Volver al original".
   * La funcionalidad existe (viewScore), pero por ahora la interfaz solo ofrece elegir la tonalidad.
   */
  advanced?: boolean;
}

/** Elegir en qué tonalidad ver la partitura. No modifica la partitura guardada. */
export function TransposeControls({ stored, state, onChange, advanced = false }: Props) {
  const mode: Mode = state.mode ?? stored.originalKey.mode;
  const originalFifths = stored.originalKey.fifths;
  const selectedFifths = state.targetFifths ?? originalFifths;
  const octaves = state.octaves;

  return (
    <div className="toolbar toolbar-transpose">
      <label className="control">
        <span className="control-text">Mostrar en</span>
        <select
          value={selectedFifths}
          onChange={(event) => {
            const fifths = Number(event.target.value);
            onChange({ ...state, targetFifths: fifths === originalFifths ? null : fifths });
          }}
        >
          {allKeys(mode).map((k) => (
            <option key={k.fifths} value={k.fifths}>
              {formatKey(k)} ({formatKeySignature(k)}){k.fifths === originalFifths ? ' · original' : ''}
            </option>
          ))}
        </select>
      </label>

      {advanced && (
        <>
          <div className="control" role="group" aria-label="Octava">
            Octava
            <span className="stepper">
              <button
                type="button"
                className="button-small"
                aria-label="Bajar una octava"
                disabled={octaves <= -MAX_OCTAVES}
                onClick={() => onChange({ ...state, octaves: octaves - 1 })}
              >
                −
              </button>
              <span className="stepper-value">{octaves > 0 ? `+${octaves}` : octaves}</span>
              <button
                type="button"
                className="button-small"
                aria-label="Subir una octava"
                disabled={octaves >= MAX_OCTAVES}
                onClick={() => onChange({ ...state, octaves: octaves + 1 })}
              >
                +
              </button>
            </span>
          </div>

          <label className="control">
            Modo de la tonalidad original
            <select
              value={mode}
              onChange={(event) => {
                const next = event.target.value as Mode;
                // Cambiar el modo cambia la tónica: la tonalidad destino vuelve a la original.
                onChange({ ...state, mode: next === stored.originalKey.mode ? null : next, targetFifths: null });
              }}
            >
              <option value="major">Mayor</option>
              <option value="minor">Menor</option>
            </select>
          </label>

          <button
            type="button"
            className="button button-secondary"
            disabled={isOriginal(state)}
            onClick={() => onChange(DEFAULT_TRANSPOSE)}
          >
            Volver al original
          </button>
        </>
      )}
    </div>
  );
}
