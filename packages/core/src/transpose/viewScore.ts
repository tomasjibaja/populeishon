import { type Key, type Mode, key } from '../model/key';
import type { Score } from '../model/score';
import { transposeScore } from './transposeScore';

/** Lo que el usuario elige para ver una partitura guardada. Todo ausente (o null) = tal como está guardada. */
export interface ViewTransposition {
  /** Corrige el modo de la tonalidad original (p. ej. si el archivo no lo indicaba y se dedujo mal). */
  readonly mode?: Mode | null;
  /** Tonalidad en la que mostrarla, como posición en el círculo de quintas; null = la original. */
  readonly targetFifths?: number | null;
  /** Octavas adicionales (+1 sube, -1 baja). */
  readonly octaves?: number;
}

export type ViewScoreResult =
  | { readonly ok: true; readonly score: Score }
  | { readonly ok: false; readonly error: string; /** La partitura sin transponer, para seguir mostrando algo. */ readonly score: Score };

/** La partitura con otro modo para la tonalidad original (y para sus cambios de tonalidad). */
export function withMode(score: Score, mode: Mode): Score {
  const relabel = (k: Key): Key => key(k.fifths, mode);
  return {
    ...score,
    originalKey: relabel(score.originalKey),
    measures: score.measures.map((m) => (m.keySignature ? { ...m, keySignature: relabel(m.keySignature) } : m)),
  };
}

/**
 * La partitura tal como se debe mostrar según la elección del usuario. No modifica la guardada ni la persiste:
 * es una vista derivada. Si no hay nada que cambiar devuelve la misma partitura; si la transposición no es
 * posible (una nota se sale del rango) devuelve el error y la partitura sin transponer.
 */
export function viewScore(stored: Score, view: ViewTransposition): ViewScoreResult {
  const base = view.mode && view.mode !== stored.originalKey.mode ? withMode(stored, view.mode) : stored;
  const octaves = view.octaves ?? 0;
  const targetFifths = view.targetFifths ?? base.originalKey.fifths;

  if (targetFifths === base.originalKey.fifths && octaves === 0) return { ok: true, score: base };

  try {
    return { ok: true, score: transposeScore(base, key(targetFifths, base.originalKey.mode), { octaves }) };
  } catch (error) {
    if (error instanceof RangeError) return { ok: false, error: error.message, score: base };
    throw error;
  }
}
