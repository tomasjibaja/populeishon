import { describe, expect, it } from 'vitest';
import { chord, note, rest } from '../model/builders';
import { QUARTER, duration } from '../model/duration';
import { notatedDuration } from '../model/note';
import { pitch } from '../model/pitch';
import { timeSignature } from '../model/timeSignature';
import { describeDuration, formatBeat, formatChordSymbol, formatElement, formatPitch } from './format';

describe('format', () => {
  it('formatea alturas con alteración', () => {
    expect(formatPitch(pitch('F', 4, 1))).toBe('F#4');
    expect(formatPitch(pitch('B', 3, -1))).toBe('Bb3');
    expect(formatPitch(pitch('C', 5))).toBe('C5');
  });

  it('nombra figuras usuales y usa fracción en las demás', () => {
    expect(describeDuration(QUARTER)).toBe('negra');
    expect(describeDuration(duration(3, 8))).toBe('negra con puntillo');
    expect(describeDuration(duration(5, 16))).toBe('5/16');
  });

  it('calcula el tiempo de una posición', () => {
    const fourFour = timeSignature(4, 4);
    expect(formatBeat(duration(0, 1), fourFour)).toBe('1');
    expect(formatBeat(duration(1, 2), fourFour)).toBe('3');
    expect(formatBeat(duration(1, 8), fourFour)).toBe('1.5');
  });

  it('describe notas, ligaduras y silencios', () => {
    expect(formatElement(note('E', 4, QUARTER))).toBe('E4 negra');
    expect(formatElement(note('E', 4, QUARTER, { tie: 'start' }))).toBe('E4 negra ligada al siguiente');
    expect(formatElement(rest(QUARTER))).toBe('silencio de negra');
  });

  it('dibuja el cifrado con símbolos tipográficos', () => {
    expect(formatChordSymbol(chord('C7b9'))).toBe('C7♭9');
    expect(formatChordSymbol(chord('F#m7b5'))).toBe('F♯m7♭5');
    expect(formatChordSymbol(chord('Bb/D'))).toBe('B♭/D');
    expect(formatChordSymbol(chord('Cmaj7#11'))).toBe('Cmaj7♯11');
    expect(formatChordSymbol(chord('Cm7'))).toBe('Cm7');
  });

  it('un tresillo se escribe como corchea aunque dure 1/12', () => {
    const triplet = note('F', 4, duration(1, 12), { tuplet: { actual: 3, normal: 2 } });
    expect(notatedDuration(triplet)).toEqual(duration(1, 8));
    expect(formatElement(triplet)).toBe('F4 corchea (tresillo)');
    expect(notatedDuration(note('F', 4, QUARTER))).toEqual(QUARTER);
    const quintuplet = rest(duration(1, 20), { tuplet: { actual: 5, normal: 4 } });
    expect(notatedDuration(quintuplet)).toEqual(duration(1, 16));
    expect(formatElement(quintuplet)).toBe('silencio de semicorchea (grupo 5:4)');
  });
});
