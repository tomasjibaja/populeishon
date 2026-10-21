import { describe, expect, it } from 'vitest';
import { longExampleScore } from '../fixtures/longExampleScore';
import { formatStructure } from '../format/format';
import { measure, note } from '../model/builders';
import { QUARTER } from '../model/duration';
import { key } from '../model/key';
import type { Measure } from '../model/measure';
import type { Score } from '../model/score';
import { timeSignature } from '../model/timeSignature';
import { validateScore } from '../validation/validateScore';
import { endingSpans } from './structure';

const bar = (n: number, options = {}): Measure =>
  measure(n, [note('C', 4, QUARTER), note('D', 4, QUARTER), note('E', 4, QUARTER), note('F', 4, QUARTER)], options);
const scoreOf = (measures: Measure[]): Score => ({
  ...longExampleScore,
  originalKey: key(0, 'major'),
  timeSignature: timeSignature(4, 4),
  measures,
});

describe('endingSpans', () => {
  it('resuelve una casilla de varios compases con cierre y otra abierta', () => {
    const spans = endingSpans(
      scoreOf([
        bar(1),
        bar(2, { endingStart: { numbers: [1], label: '1.' } }),
        bar(3, { endingEnd: 'closed' }),
        bar(4, { endingStart: { numbers: [2], label: '2.' } }),
        bar(5, { endingEnd: 'open' }),
        bar(6),
      ]),
    );
    expect(spans[0]).toBe(undefined);
    expect(spans[1]).toEqual({ label: '1.', numbers: [1], first: true, last: false, closed: false });
    expect(spans[2]).toEqual({ label: '1.', numbers: [1], first: false, last: true, closed: true });
    expect(spans[3]?.first).toBe(true);
    expect(spans[4]).toEqual({ label: '2.', numbers: [2], first: false, last: true, closed: false });
    expect(spans[5]).toBe(undefined);
  });

  it('una casilla de un solo compás es primera y última a la vez', () => {
    const spans = endingSpans(scoreOf([bar(1, { endingStart: { numbers: [1], label: '1.' }, endingEnd: 'closed' }), bar(2)]));
    expect(spans[0]).toEqual({ label: '1.', numbers: [1], first: true, last: true, closed: true });
  });

  it('una casilla sin cierre termina al empezar otra o al acabar la partitura', () => {
    const spans = endingSpans(
      scoreOf([
        bar(1, { endingStart: { numbers: [1], label: '1.' } }),
        bar(2, { endingStart: { numbers: [2], label: '2.' } }),
        bar(3),
      ]),
    );
    expect(spans[0]?.last).toBe(true);
    expect(spans[0]?.closed).toBe(false);
    expect(spans[2]?.last).toBe(true);
  });

  it('la partitura larga de ejemplo tiene sus dos casillas y es válida', () => {
    const spans = endingSpans(longExampleScore);
    const labels = spans.map((s) => s?.label);
    expect(labels[15]).toBe('1.');
    expect(labels[16]).toBe('2.');
    expect(validateScore(longExampleScore)).toHaveLength(0);
  });
});

describe('validación de casillas', () => {
  it('detecta cierres sin apertura y aperturas sin cierre', () => {
    expect(validateScore(scoreOf([bar(1, { endingEnd: 'closed' })]))).toHaveLength(1);
    expect(validateScore(scoreOf([bar(1, { endingStart: { numbers: [1], label: '1.' } })]))).toHaveLength(1);
    expect(
      validateScore(
        scoreOf([
          bar(1, { endingStart: { numbers: [1], label: '1.' } }),
          bar(2, { endingStart: { numbers: [2], label: '2.' }, endingEnd: 'open' }),
        ]),
      ),
    ).toHaveLength(1);
  });
});

describe('formatStructure', () => {
  it('describe las marcas de un compás', () => {
    expect(formatStructure(bar(1))).toEqual([]);
    expect(
      formatStructure(
        bar(1, {
          startRepeat: true,
          endingStart: { numbers: [1], label: '1.' },
          endRepeat: true,
          endingEnd: 'closed',
          endBarline: 'double',
          texts: ['x3'],
        }),
      ),
    ).toEqual(['inicio de repetición', 'empieza casilla 1.', 'fin de repetición', 'cierra casilla', 'doble barra', 'texto "x3"']);
  });

  it('muestra las veces de la repetición y el salto de línea', () => {
    expect(formatStructure(bar(1, { endRepeat: true, repeatTimes: 3, newSystem: true }))).toEqual(['fin de repetición (x3)', 'salto de línea']);
  });
});
