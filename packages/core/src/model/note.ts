import { type Duration, duration } from './duration';
import type { Pitch } from './pitch';

/** 'start' abre una ligadura, 'stop' la cierra, 'continue' cierra una y abre otra. */
export type Tie = 'start' | 'stop' | 'continue';

/**
 * Pertenencia a un grupo irregular (tresillo 3:2, seisillo 6:4, quintillo 5:4…):
 * `actual` notas ocupan el tiempo de `normal`. La duración de la nota (`duration`) es la que realmente dura
 * (una corchea de tresillo = 1/12); el grupo se delimita con `start` y `stop`.
 */
export interface TupletInfo {
  readonly actual: number;
  readonly normal: number;
  readonly start?: boolean;
  readonly stop?: boolean;
}

export interface NoteElement {
  readonly type: 'note';
  readonly pitch: Pitch;
  readonly duration: Duration;
  readonly tie?: Tie;
  readonly tuplet?: TupletInfo;
}

export interface RestElement {
  readonly type: 'rest';
  readonly duration: Duration;
  readonly tuplet?: TupletInfo;
}

export type MeasureElement = NoteElement | RestElement;

/** Figura con la que se escribe el elemento: en un tresillo de corcheas, la corchea (1/8) aunque dure 1/12. */
export function notatedDuration(el: MeasureElement): Duration {
  return el.tuplet ? duration(el.duration.num * el.tuplet.actual, el.duration.den * el.tuplet.normal) : el.duration;
}
