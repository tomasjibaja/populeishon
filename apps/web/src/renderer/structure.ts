import type { EndingInfo, Measure } from '@partituras/core';
import type { SystemLayout } from './layout';

/** Decisiones de dibujo de repeticiones, casillas, barras y textos de navegación (sin VexFlow). */

export type BarType = 'single' | 'double' | 'final' | 'repeat-begin' | 'repeat-end' | 'repeat-both' | 'none';

export interface MeasureBars {
  readonly begin: BarType;
  readonly end: BarType;
}

/**
 * Barras de inicio y fin de un compás. `previous` y `next` son los vecinos de la MISMA línea:
 * si un compás termina en repetición y el siguiente empieza otra, se dibuja una sola barra doble
 * con puntos a ambos lados; y una doble barra o barra simple pegada a un inicio de repetición se omite.
 */
export function barlinesFor(measure: Measure, previous: Measure | undefined, next: Measure | undefined): MeasureBars {
  const begin: BarType = measure.startRepeat ? (previous?.endRepeat ? 'none' : 'repeat-begin') : 'single';

  let end: BarType;
  if (measure.endRepeat) end = next?.startRepeat ? 'repeat-both' : 'repeat-end';
  else if (next?.startRepeat) end = 'none';
  else if (measure.endBarline === 'double') end = 'double';
  else if (measure.endBarline === 'final') end = 'final';
  else end = 'single';

  return { begin, end };
}

/** "x3" va al comienzo del compás; D.C., Fine, Coda… van pegados al final. */
export function textPlacement(text: string): 'start' | 'end' {
  return /^(x\s?\d+|\d+\s?x)$/i.test(text.trim()) ? 'start' : 'end';
}

/** Geometría (en medidas lógicas, relativa a la primera línea del pentagrama) de casillas y textos. */
export const VOLTA = {
  /** Altura de la línea de la casilla sobre la primera línea del pentagrama: pegada al sistema. */
  lineOffset: 12,
  hook: 5,
  /** El texto ("1.", "1. 2.") va sobre la línea, a la izquierda. */
  labelOffsetX: 3,
  labelAboveLine: 3,
  fontSize: 10,
  /** Los compases bajo una casilla suben su cifrado esta cantidad para que no choque con la casilla. */
  chordLift: 14,
  /** Línea base de "x2", D.C.… (por encima del cifrado y de la casilla). */
  textBaseline: 54,
  textFontSize: 12,
} as const;

/** Doble barra dibujada con líneas más gruesas que las de VexFlow (que son de 1 px). */
export const DOUBLE_BAR = { lineWidth: 2, gap: 3 } as const;

export const MEASURE_NUMBER = {
  fontSize: 9,
  gap: 4,
  /** Línea base del número, medida hacia abajo desde la primera línea: a la altura del centro del pentagrama. */
  baselineFromTop: 24,
} as const;

export interface SystemEndLabel {
  readonly text: string;
  /** Posición x donde empieza el texto: a la derecha de la última barra de la línea. */
  readonly x: number;
}

/**
 * Número de compás que se muestra al final de una línea: el de su último compás.
 * La anacrusa no se numera (es el compás 0). `Measure.number` ya cuenta sin la anacrusa.
 */
export function systemEndLabel(system: SystemLayout, measures: readonly Measure[]): SystemEndLabel | undefined {
  const last = system.measures[system.measures.length - 1];
  const measure = last ? measures[last.index] : undefined;
  if (!last || !measure || measure.pickup) return undefined;
  return { text: String(measure.number), x: last.x + last.width + MEASURE_NUMBER.gap };
}

export interface EndingBracket {
  readonly x1: number;
  readonly x2: number;
  readonly label: string;
  /** Gancho a la izquierda: la casilla empieza en esta línea. */
  readonly hookLeft: boolean;
  /** Gancho a la derecha: la casilla termina cerrada en esta línea. */
  readonly hookRight: boolean;
}

/**
 * Agrupa los compases consecutivos de una línea que pertenecen a la misma casilla.
 * Si la casilla continúa en la línea siguiente (o venía de la anterior) queda abierta de ese lado.
 */
export function endingBrackets(system: SystemLayout, infos: readonly (EndingInfo | undefined)[]): EndingBracket[] {
  const brackets: EndingBracket[] = [];
  let current: { x1: number; x2: number; label: string; hookLeft: boolean } | undefined;

  const flush = (hookRight: boolean) => {
    if (current) brackets.push({ ...current, hookRight });
    current = undefined;
  };

  for (const placed of system.measures) {
    const info = infos[placed.index];
    if (!info) {
      flush(false);
      continue;
    }
    if (current && !info.first) {
      current.x2 = placed.x + placed.width;
    } else {
      flush(false);
      current = { x1: placed.x, x2: placed.x + placed.width, label: info.label, hookLeft: info.first };
    }
    if (info.last) flush(info.closed);
  }
  flush(false);
  return brackets;
}
