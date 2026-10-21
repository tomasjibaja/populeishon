import { describe, expect, it } from 'vitest';
import { QUARTER, WHOLE, duration, longExampleScore, note, rest, type MeasureElement } from '@partituras/core';
import { isFullMeasureRest, tupletGroups } from './tuplets';

const third = duration(1, 12);
const t = (extra = {}) => note('C', 5, third, { tuplet: { actual: 3, normal: 2, ...extra } });
const plain = note('C', 5, QUARTER);

describe('tupletGroups', () => {
  it('agrupa un tresillo delimitado por start y stop', () => {
    const elements: MeasureElement[] = [plain, t({ start: true }), t(), t({ stop: true }), plain];
    expect(tupletGroups(elements)).toEqual([{ from: 1, to: 3, actual: 3, normal: 2 }]);
  });

  it('separa dos tresillos seguidos', () => {
    const elements: MeasureElement[] = [t({ start: true }), t(), t({ stop: true }), t({ start: true }), t(), t({ stop: true })];
    expect(tupletGroups(elements).map((g) => [g.from, g.to])).toEqual([[0, 2], [3, 5]]);
  });

  it('sin marcas de inicio, agrupa los elementos consecutivos de la misma razón', () => {
    expect(tupletGroups([t(), t(), t(), plain]).map((g) => [g.from, g.to])).toEqual([[0, 2]]);
  });

  it('cierra el grupo si cambia la razón y al final del compás', () => {
    const quintuplet = (extra = {}) => note('D', 5, duration(1, 20), { tuplet: { actual: 5, normal: 4, ...extra } });
    const groups = tupletGroups([t(), t(), quintuplet(), quintuplet(), quintuplet()]);
    expect(groups.map((g) => [g.from, g.to, g.actual])).toEqual([[0, 1, 3], [2, 4, 5]]);
  });

  it('un silencio dentro del grupo forma parte de él, y un elemento suelto no es un grupo', () => {
    const insideRest = rest(third, { tuplet: { actual: 3, normal: 2, start: true } });
    expect(tupletGroups([insideRest, t(), t({ stop: true })]).map((g) => [g.from, g.to])).toEqual([[0, 2]]);
    expect(tupletGroups([plain, t({ start: true, stop: true }), plain])).toEqual([]);
  });

  it('la partitura larga de ejemplo tiene un tresillo en el compás 14', () => {
    const measure14 = longExampleScore.measures.find((m) => m.number === 14);
    const groups = tupletGroups(measure14?.elements ?? []);
    expect(groups).toEqual([{ from: 2, to: 4, actual: 3, normal: 2 }]);
  });
});

describe('isFullMeasureRest', () => {
  const threeFour = duration(3, 4);
  it('reconoce un único silencio de la duración del compás', () => {
    expect(isFullMeasureRest([rest(threeFour)], threeFour)).toBe(true);
    expect(isFullMeasureRest([rest(WHOLE)], WHOLE)).toBe(true);
  });

  it('no confunde con otros compases', () => {
    expect(isFullMeasureRest([rest(QUARTER)], threeFour)).toBe(false);
    expect(isFullMeasureRest([rest(QUARTER), rest(duration(1, 2))], threeFour)).toBe(false);
    expect(isFullMeasureRest([note('C', 5, threeFour)], threeFour)).toBe(false);
    expect(isFullMeasureRest([], threeFour)).toBe(false);
  });

  it('la partitura larga tiene un compás de silencio completo en 3/4 (compás 27)', () => {
    const measure27 = longExampleScore.measures.find((m) => m.number === 27);
    expect(isFullMeasureRest(measure27?.elements ?? [], threeFour)).toBe(true);
  });
});
