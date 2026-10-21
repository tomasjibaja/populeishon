import type { Duration } from './duration';
import type { PitchClass } from './pitch';

/**
 * Clasificación semántica del acorde. 'other' = sufijo no reconocido
 * (se conserva igualmente en `suffix`, así que nunca se pierde información).
 */
export type ChordQuality =
  | 'major'
  | 'minor'
  | 'dominant7'
  | 'major7'
  | 'minor7'
  | 'diminished'
  | 'diminished7'
  | 'halfDiminished7'
  | 'augmented'
  | 'sus2'
  | 'sus4'
  | 'dominant7sus4'
  | 'major6'
  | 'minor6'
  | 'dominant9'
  | 'major9'
  | 'minor9'
  | 'dominant11'
  | 'dominant13'
  | 'minorMajor7'
  | 'other';

/** Un acorde separado en sus componentes, listo para transponerse. */
export interface Chord {
  readonly root: PitchClass;
  readonly quality: ChordQuality;
  /**
   * Todo lo que va entre la raíz y el bajo, tal como se escribió ("m7", "-7", "maj7#11", "7b9").
   * Al transponer solo cambian raíz y bajo; el sufijo se conserva con el estilo del autor.
   */
  readonly suffix: string;
  /** Bajo distinto de la raíz (C/E → E). */
  readonly bass?: PitchClass;
  /** Texto original del cifrado, tal como llegó (MusicXML o tipeado). */
  readonly text: string;
}

/** Acorde anclado a una posición dentro del compás (0 = inicio). */
export interface ChordAt {
  readonly offset: Duration;
  readonly chord: Chord;
}
