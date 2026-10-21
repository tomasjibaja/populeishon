import type { Clef } from './clef';
import type { Duration } from './duration';
import type { Key } from './key';
import type { Measure } from './measure';
import type { TimeSignature } from './timeSignature';

export const SCHEMA_VERSION = 1 as const;

export interface Tempo {
  readonly bpm: number;
  /** Figura que marca la pulsación (por defecto, negra). */
  readonly beatUnit: Duration;
}

export interface ScoreSource {
  readonly kind: 'builtin' | 'musicxml' | 'manual';
  readonly fileName?: string;
}

/** Registro de una transposición, presente solo en las partituras derivadas por `transposeScore`. */
export interface ScoreTransposition {
  /** Tonalidad en la que estaba escrita la partitura original. */
  readonly from: Key;
  /** Desplazamiento en la cadena de quintas (+1 = una quinta justa arriba en el nombre de las notas). */
  readonly fifths: number;
  /** Desplazamiento real en semitonos (con signo), incluida la octava. */
  readonly semitones: number;
}

export interface ScoreMetadata {
  readonly source: ScoreSource;
}

/**
 * Modelo propio de la aplicación. No depende de VexFlow, React ni MongoDB.
 * La Score guardada nunca se modifica: transponer produce otra Score derivada (no se persiste).
 * En una Score derivada, `originalKey` es la tonalidad en la que está escrita ahora y
 * `transposition` dice de dónde viene.
 */
export interface Score {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly id: string;
  readonly title: string;
  readonly composer?: string;
  readonly style?: string;
  /**
   * Letra de la canción como texto con formato: un salto de línea (`\n`) separa los versos y una línea en blanco
   * separa las estrofas. Se conservan tal cual al guardar y mostrar (máx. 20000 caracteres).
   */
  readonly lyrics?: string;
  readonly originalKey: Key;
  /** Solo en partituras derivadas por transposición. */
  readonly transposition?: ScoreTransposition;
  /** Compás inicial; los cambios posteriores van en Measure.timeSignature. */
  readonly timeSignature: TimeSignature;
  readonly tempo?: Tempo;
  /** Si falta, clave de sol normal. */
  readonly clef?: Clef;
  readonly measures: readonly Measure[];
  readonly metadata: ScoreMetadata;
}
