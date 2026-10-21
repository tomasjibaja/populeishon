import { describe, expect, it } from 'vitest';
import { effectiveKeys, effectiveTimeSignatures, scoreDuration } from '../analysis/analysis';
import { exampleScore } from '../fixtures/exampleScore';
import { longExampleScore } from '../fixtures/longExampleScore';
import { HALF, QUARTER, WHOLE, ZERO_DURATION, duration } from '../model/duration';
import { chord, chordAt, measure, note } from '../model/builders';
import type { Measure } from '../model/measure';
import type { Score } from '../model/score';
import { key } from '../model/key';
import { timeSignature } from '../model/timeSignature';
import { validateScore } from './validateScore';

function scoreWith(measures: Measure[]): Score {
  return { ...exampleScore, measures };
}

const fourQuarters = (n: number, options = {}) =>
  measure(n, [note('C', 4, QUARTER), note('D', 4, QUARTER), note('E', 4, QUARTER), note('F', 4, QUARTER)], options);

describe('validateScore', () => {
  it('la partitura de ejemplo es válida y dura 8 redondas', () => {
    expect(validateScore(exampleScore)).toHaveLength(0);
    expect(exampleScore.measures).toHaveLength(8);
    expect(scoreDuration(exampleScore)).toEqual(duration(8, 1));
  });

  it('detecta un compás incompleto', () => {
    const issues = validateScore(scoreWith([measure(1, [note('C', 4, HALF)])]));
    expect(issues).toHaveLength(1);
    expect(issues[0]?.measure).toBe(1);
  });

  it('detecta un acorde fuera del compás y acordes repetidos', () => {
    const c = chord('C');
    const outside = scoreWith([fourQuarters(1, { chords: [chordAt(WHOLE, c)] })]);
    expect(validateScore(outside)).toHaveLength(1);

    const repeated = scoreWith([fourQuarters(1, { chords: [chordAt(HALF, c), chordAt(HALF, c)] })]);
    expect(validateScore(repeated)).toHaveLength(1);
  });

  it('respeta los cambios de compás', () => {
    const threeQuarters = (n: number, options = {}) =>
      measure(n, [note('C', 4, QUARTER), note('D', 4, QUARTER), note('E', 4, QUARTER)], options);
    const ok = scoreWith([
      fourQuarters(1),
      threeQuarters(2, { timeSignature: timeSignature(3, 4) }),
      threeQuarters(3),
    ]);
    expect(validateScore(ok)).toHaveLength(0);

    const bad = scoreWith([fourQuarters(1), threeQuarters(2, { timeSignature: timeSignature(3, 4) }), fourQuarters(3)]);
    expect(validateScore(bad)).toHaveLength(1);
  });

  it('avisa si no hay compases', () => {
    expect(validateScore(scoreWith([]))).toHaveLength(1);
  });

  it('los constructores rechazan alturas inválidas', () => {
    expect(() => note('C', 4, QUARTER, { alter: 3 })).toThrow();
    expect(() => note('C', 12, QUARTER)).toThrow();
    expect(ZERO_DURATION.num).toBe(0);
  });

  it('la partitura larga es válida (anacrusa, cambios y compás final que la completa)', () => {
    expect(validateScore(longExampleScore)).toHaveLength(0);
    expect(longExampleScore.measures).toHaveLength(33);
    // anacrusa 1/4 + 24 compases de 4/4 + 4 de 3/4 + 3 de 4/4 + final de 3/4 = 31 redondas
    expect(scoreDuration(longExampleScore)).toEqual(duration(31, 1));
  });

  it('acepta una anacrusa válida y rechaza las inválidas', () => {
    const pickup = measure(0, [note('G', 4, QUARTER)], { pickup: true });
    const complete = (n: number) => fourQuarters(n);
    const lastBar = measure(2, [note('C', 5, duration(3, 4))]);
    expect(validateScore(scoreWith([pickup, complete(1), lastBar]))).toHaveLength(0);

    // el final no completa la anacrusa
    expect(validateScore(scoreWith([pickup, complete(1), measure(2, [note('C', 5, HALF)])]))).toHaveLength(1);
    // anacrusa que no es el primer compás
    expect(validateScore(scoreWith([complete(1), pickup]))).toHaveLength(1);
    // anacrusa de duración completa
    expect(validateScore(scoreWith([measure(0, [note('C', 5, WHOLE)], { pickup: true }), complete(1)]))).toHaveLength(1);
  });

  it('resuelve tonalidad y compás vigentes en cada compás', () => {
    const keys = effectiveKeys(longExampleScore);
    expect(keys[16]).toEqual(key(0, 'major'));
    expect(keys[17]).toEqual(key(1, 'major'));
    expect(keys[28]).toEqual(key(1, 'major'));
    expect(keys[29]).toEqual(key(0, 'major'));
    const signatures = effectiveTimeSignatures(longExampleScore);
    expect(signatures[24]).toEqual(timeSignature(4, 4));
    expect(signatures[25]).toEqual(timeSignature(3, 4));
    expect(signatures[28]).toEqual(timeSignature(3, 4));
    expect(signatures[29]).toEqual(timeSignature(4, 4));
  });
});
