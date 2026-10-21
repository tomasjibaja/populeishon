import { describe, expect, it } from 'vitest';
import { endingSpans, longExampleScore, measure, note, QUARTER, type Measure } from '@partituras/core';
import { layoutScore } from './layout';
import { MEASURE_NUMBER, barlinesFor, endingBrackets, systemEndLabel, textPlacement } from './structure';

const bar = (n: number, options = {}): Measure =>
  measure(n, [note('C', 4, QUARTER), note('D', 4, QUARTER), note('E', 4, QUARTER), note('F', 4, QUARTER)], options);

describe('barlinesFor', () => {
  it('un compás común tiene barras simples', () => {
    expect(barlinesFor(bar(1), undefined, bar(2))).toEqual({ begin: 'single', end: 'single' });
  });

  it('dibuja repetición, doble barra y barra final', () => {
    expect(barlinesFor(bar(1, { startRepeat: true }), undefined, undefined).begin).toBe('repeat-begin');
    expect(barlinesFor(bar(1, { endRepeat: true }), undefined, bar(2)).end).toBe('repeat-end');
    expect(barlinesFor(bar(1, { endBarline: 'double' }), undefined, bar(2)).end).toBe('double');
    expect(barlinesFor(bar(1, { endBarline: 'final' }), undefined, undefined).end).toBe('final');
  });

  it('fin de repetición seguido de inicio de otra: una sola barra con puntos a ambos lados', () => {
    const first = bar(1, { endRepeat: true });
    const second = bar(2, { startRepeat: true });
    expect(barlinesFor(first, undefined, second).end).toBe('repeat-both');
    expect(barlinesFor(second, first, undefined).begin).toBe('none');
  });

  it('si el vecino está en otra línea, cada compás dibuja su propia barra', () => {
    expect(barlinesFor(bar(1, { endRepeat: true }), undefined, undefined).end).toBe('repeat-end');
    expect(barlinesFor(bar(2, { startRepeat: true }), undefined, undefined).begin).toBe('repeat-begin');
  });

  it('una doble barra pegada a un inicio de repetición se omite', () => {
    expect(barlinesFor(bar(1, { endBarline: 'double' }), undefined, bar(2, { startRepeat: true })).end).toBe('none');
  });
});

describe('textPlacement', () => {
  it('"x3" va al principio; D.C., Fine y Coda al final', () => {
    expect(textPlacement('x3')).toBe('start');
    expect(textPlacement('3x')).toBe('start');
    expect(textPlacement('D.C.')).toBe('end');
    expect(textPlacement('Fine')).toBe('end');
    expect(textPlacement('To Coda')).toBe('end');
  });
});

describe('endingBrackets', () => {
  const infosOf = (measures: Measure[]) => endingSpans({ ...longExampleScore, measures });

  it('dibuja las casillas 1. (cerrada) y 2. (abierta) de la partitura larga', () => {
    const layout = layoutScore(longExampleScore, 1600, { measuresPerSystem: 8 });
    const infos = endingSpans(longExampleScore);
    const brackets = layout.systems.flatMap((system) => endingBrackets(system, infos));
    expect(brackets.map((b) => b.label)).toEqual(['1.', '2.']);
    expect(brackets.map((b) => b.hookLeft)).toEqual([true, true]);
    expect(brackets.map((b) => b.hookRight)).toEqual([true, false]);
  });

  it('una casilla que pasa de una línea a otra queda abierta del lado del corte', () => {
    const measures = [
      bar(1),
      bar(2, { endingStart: { numbers: [1], label: '1.' } }),
      bar(3),
      bar(4),
      bar(5, { endingEnd: 'closed' }),
      bar(6),
    ];
    const layout = layoutScore({ ...longExampleScore, measures }, 900, { measuresPerSystem: 2 });
    const infos = infosOf(measures);
    const brackets = layout.systems.flatMap((system) => endingBrackets(system, infos));

    expect(brackets.length > 1).toBe(true);
    expect(brackets[0]?.hookLeft).toBe(true);
    expect(brackets[0]?.hookRight).toBe(false);
    const last = brackets[brackets.length - 1];
    expect(last?.hookLeft).toBe(false);
    expect(last?.hookRight).toBe(true);
    brackets.forEach((b) => expect(b.x2 > b.x1).toBe(true));
  });

  it('sin casillas no hay corchetes', () => {
    const layout = layoutScore({ ...longExampleScore, measures: [bar(1), bar(2)] }, 900);
    const infos = infosOf([bar(1), bar(2)]);
    expect(layout.systems.flatMap((system) => endingBrackets(system, infos))).toEqual([]);
  });
});

describe('systemEndLabel', () => {
  it('numera solo el último compás de cada línea, sin contar la anacrusa', () => {
    const layout = layoutScore(longExampleScore, 1200, { measuresPerSystem: 4 });
    const labels = layout.systems.map((system) => systemEndLabel(system, longExampleScore.measures)?.text);
    // la anacrusa va en la primera línea y no cuenta: 1.ª línea = compases 1 a 4
    expect(labels.slice(0, 3)).toEqual(['4', '8', '12']);
    expect(labels.every((text) => text !== undefined)).toBe(true);
  });

  it('se coloca a la derecha de la última barra', () => {
    const layout = layoutScore(longExampleScore, 1000);
    const system = layout.systems[0];
    const last = system?.measures[system.measures.length - 1];
    const label = system ? systemEndLabel(system, longExampleScore.measures) : undefined;
    expect(label?.x).toBe((last?.x ?? 0) + (last?.width ?? 0) + MEASURE_NUMBER.gap);
  });

  it('una línea que solo tiene la anacrusa no lleva número', () => {
    const only = { ...layoutScore(longExampleScore, 1000).systems[0]!, measures: layoutScore(longExampleScore, 1000).systems[0]!.measures.slice(0, 1) };
    expect(systemEndLabel(only, longExampleScore.measures)).toBe(undefined);
  });
});

