import { describe, expect, it } from 'vitest';
import { exampleScore } from '../fixtures/exampleScore';
import { longExampleScore } from '../fixtures/longExampleScore';
import { formatKey, formatKeySignature } from '../format/format';
import { measure, note } from '../model/builders';
import { WHOLE } from '../model/duration';
import { allKeys, key } from '../model/key';
import type { Score } from '../model/score';
import { viewScore, withMode } from './viewScore';

describe('allKeys y formatKeySignature', () => {
  it('lista las 15 tonalidades de cada modo ordenadas por la altura de la tónica', () => {
    const major = allKeys('major').map((k) => formatKey(k).replace(' major', ''));
    expect(major).toEqual(['C', 'Db', 'C#', 'D', 'Eb', 'E', 'F', 'Gb', 'F#', 'G', 'Ab', 'A', 'Bb', 'Cb', 'B']);
    const minor = allKeys('minor').map((k) => formatKey(k).replace(' minor', ''));
    expect(minor).toEqual(['C', 'C#', 'D', 'Eb', 'D#', 'E', 'F', 'F#', 'G', 'Ab', 'G#', 'A', 'Bb', 'A#', 'B']);
    expect(allKeys('major')).toHaveLength(15);
  });

  it('describe la armadura', () => {
    expect(formatKeySignature(key(0))).toBe('sin alteraciones');
    expect(formatKeySignature(key(4))).toBe('4♯');
    expect(formatKeySignature(key(-2))).toBe('2♭');
    expect(formatKeySignature(key(-7))).toBe('7♭');
  });
});

describe('withMode', () => {
  it('cambia el modo de la tonalidad original y de sus cambios, sin tocar lo demás', () => {
    const result = withMode(longExampleScore, 'minor');
    expect(result.originalKey).toEqual(key(0, 'minor'));
    expect(result.measures.find((m) => m.number === 17)?.keySignature).toEqual(key(1, 'minor'));
    expect(result.measures.map((m) => m.elements)).toEqual(longExampleScore.measures.map((m) => m.elements));
    expect(longExampleScore.originalKey).toEqual(key(0, 'major'));
  });
});

describe('viewScore', () => {
  it('sin cambios devuelve la misma partitura', () => {
    expect(viewScore(exampleScore, {})).toEqual({ ok: true, score: exampleScore });
    expect(viewScore(exampleScore, { mode: null, targetFifths: null, octaves: 0 }).score === exampleScore).toBe(true);
    expect(viewScore(exampleScore, { targetFifths: 0 }).score === exampleScore).toBe(true);
    expect(viewScore(exampleScore, { mode: 'major' }).score === exampleScore).toBe(true);
  });

  it('transpone a la tonalidad elegida', () => {
    const result = viewScore(exampleScore, { targetFifths: 4 });
    expect(result.ok).toBe(true);
    expect(result.score.originalKey).toEqual(key(4));
    expect(result.score.transposition?.from).toEqual(key(0));
    expect(result.score.measures[0]?.chords[0]?.chord.text).toBe('E');
  });

  it('puede subir o bajar octavas sin cambiar de tonalidad', () => {
    const result = viewScore(exampleScore, { octaves: 1 });
    expect(result.ok).toBe(true);
    expect(result.score.originalKey).toEqual(key(0));
    expect(result.score.transposition).toEqual({ from: key(0), fifths: 0, semitones: 12 });
    const first = result.score.measures[0]?.elements[0];
    expect(first?.type === 'note' ? first.pitch.octave : -1).toBe(5);
  });

  it('un modo corregido cambia la tónica sobre la que se transpone', () => {
    // La armadura sin alteraciones puede ser C mayor o A menor: en A menor, "mostrar en 2 sostenidos" es B menor.
    const asMinor = viewScore(exampleScore, { mode: 'minor', targetFifths: 2 });
    expect(asMinor.score.originalKey).toEqual(key(2, 'minor'));
    expect(asMinor.score.transposition).toEqual({ from: key(0, 'minor'), fifths: 2, semitones: 2 });
    const asMajor = viewScore(exampleScore, { targetFifths: 2 });
    expect(asMajor.score.originalKey).toEqual(key(2, 'major'));
    // las notas se mueven igual (un tono); lo que cambia es el nombre de la tonalidad
    expect(asMinor.score.measures[0]?.elements).toEqual(asMajor.score.measures[0]?.elements);
  });

  it('si no se puede transponer, avisa y devuelve la partitura sin transponer', () => {
    const high: Score = { ...exampleScore, measures: [measure(1, [note('B', 9, WHOLE)])] };
    const result = viewScore(high, { targetFifths: 4 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.includes('Compás 1')).toBe(true);
      expect(result.score).toEqual(high);
    }
  });

  it('no modifica la partitura guardada', () => {
    const snapshot = JSON.stringify(longExampleScore);
    viewScore(longExampleScore, { mode: 'minor', targetFifths: -5, octaves: -1 });
    expect(JSON.stringify(longExampleScore)).toBe(snapshot);
  });
});
