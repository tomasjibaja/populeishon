import type { ChordAt } from './chord';
import type { Key } from './key';
import type { MeasureElement } from './note';
import type { TimeSignature } from './timeSignature';

/** Casilla de repetición (1.ª, 2.ª vez…): empieza en este compás. */
export interface EndingStart {
  /** Veces de la repetición en que suena (p. ej. [1, 2]). */
  readonly numbers: readonly number[];
  /** Texto que se muestra en el paréntesis ("1.", "1. 2.", "3."). */
  readonly label: string;
}

export interface Measure {
  readonly number: number;
  /** Anacrusa: compás inicial incompleto. Solo puede ser el primero. */
  readonly pickup?: boolean;
  /** Solo si cambia respecto del compás anterior. */
  readonly timeSignature?: TimeSignature;
  /** Solo si cambia respecto del compás anterior. */
  readonly keySignature?: Key;
  /** Ordenados por posición, sin repetir. */
  /** Barra de repetición al inicio del compás (|:). */
  readonly startRepeat?: boolean;
  /** Barra de repetición al final del compás (:|). Puede haber fin sin inicio: se repite desde el principio de la sección. */
  readonly endRepeat?: boolean;
  /** Veces que se toca la repetición que termina aquí (x2, x3). Solo con `endRepeat`. */
  readonly repeatTimes?: number;
  /** Salto de línea: este compás empieza un sistema nuevo (tal como viene en el archivo importado). */
  readonly newSystem?: boolean;
  /** Barra al final del compás cuando no es repetición: doble (separa secciones) o final. */
  readonly endBarline?: 'double' | 'final';
  /** Aquí empieza una casilla. */
  readonly endingStart?: EndingStart;
  /** Aquí termina la casilla en curso: 'closed' con cierre, 'open' sin cierre (la última casilla). */
  readonly endingEnd?: 'closed' | 'open';
  /** Indicaciones de navegación ("x3", "D.C.", "Fine"…). */
  readonly texts?: readonly string[];
  readonly chords: readonly ChordAt[];
  /** Notas y silencios, en orden temporal. */
  readonly elements: readonly MeasureElement[];
}
