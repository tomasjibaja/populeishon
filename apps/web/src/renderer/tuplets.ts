import { type Duration, type MeasureElement, compareDuration, equalsDuration } from '@partituras/core';

/** Grupos irregulares (tresillos…) y compases de silencio completo, para dibujar. */

export interface TupletGroup {
  /** Índices (inclusive) de los elementos del compás que forman el grupo. */
  readonly from: number;
  readonly to: number;
  readonly actual: number;
  readonly normal: number;
}

/**
 * Agrupa los elementos consecutivos de un grupo irregular. Un grupo empieza en `start` (o al cambiar la
 * razón) y termina en `stop`, al salir del grupo o al final del compás. Se descartan los de un solo elemento.
 */
export function tupletGroups(elements: readonly MeasureElement[]): TupletGroup[] {
  const groups: TupletGroup[] = [];
  let current: { from: number; actual: number; normal: number } | undefined;

  const close = (to: number) => {
    if (current && to > current.from) groups.push({ ...current, to });
    current = undefined;
  };

  elements.forEach((el, index) => {
    const tuplet = el.tuplet;
    if (!tuplet) {
      close(index - 1);
      return;
    }
    if (current && (tuplet.start || current.actual !== tuplet.actual || current.normal !== tuplet.normal)) {
      close(index - 1);
    }
    if (!current) current = { from: index, actual: tuplet.actual, normal: tuplet.normal };
    if (tuplet.stop) close(index);
  });
  close(elements.length - 1);

  return groups;
}

/** Un compás con un único silencio que dura todo el compás se dibuja como silencio de redonda. */
export function isFullMeasureRest(elements: readonly MeasureElement[], capacity: Duration): boolean {
  const only = elements[0];
  return (
    elements.length === 1 &&
    only !== undefined &&
    only.type === 'rest' &&
    !only.tuplet &&
    compareDuration(only.duration, capacity) === 0 &&
    !equalsDuration(only.duration, { num: 0, den: 1 })
  );
}
