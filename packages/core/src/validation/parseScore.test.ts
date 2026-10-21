import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { exampleScore } from '../fixtures/exampleScore';
import { longExampleScore } from '../fixtures/longExampleScore';
import { importMusicXml } from '../musicxml/importMusicXml';
import { key } from '../model/key';
import { transposeScore } from '../transpose/transposeScore';
import { SCORE_LIMITS, parseScore } from './parseScore';

const json = (value: unknown): unknown => JSON.parse(JSON.stringify(value));
const errorsOf = (input: unknown): string[] => {
  const result = parseScore(input);
  return result.ok ? [] : result.errors;
};

describe('parseScore: datos válidos', () => {
  it('acepta las partituras de ejemplo (después de pasar por JSON) y las devuelve idénticas', () => {
    for (const score of [exampleScore, longExampleScore]) {
      const result = parseScore(json(score));
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.score).toEqual(score);
    }
  });

  it('acepta las tres partituras importadas de MuseScore', () => {
    for (const name of ['Bien_haiga_con_el_mocito__Em_', 'El_coyuyo_y_la_tortuga', 'La_nostalgiosa']) {
      let xml = '';
      for (const dir of [join(process.cwd(), 'test-data'), join(process.cwd(), 'packages', 'core', 'test-data')]) {
        try {
          xml = readFileSync(join(dir, `${name}.musicxml`), 'utf8');
          break;
        } catch {
          // probar el siguiente directorio
        }
      }
      const imported = importMusicXml(xml, { fileName: `${name}.musicxml` });
      expect(imported.ok).toBe(true);
      if (imported.ok) {
        const parsed = parseScore(json(imported.score));
        expect(parsed.ok).toBe(true);
        if (parsed.ok) expect(parsed.score).toEqual(imported.score);
      }
    }
  });
});

describe('parseScore: la letra', () => {
  const withLyrics = (lyrics: unknown) => json({ ...exampleScore, lyrics });

  it('conserva los versos y las estrofas y normaliza los saltos de línea', () => {
    const result = parseScore(withLyrics('Primer verso\r\nSegundo verso\n\nOtra estrofa\rY otro verso'));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.score.lyrics).toBe('Primer verso\nSegundo verso\n\nOtra estrofa\nY otro verso');
  });

  it('una letra vacía o en blanco no se guarda', () => {
    for (const blank of ['', '   \n  ']) {
      const result = parseScore(withLyrics(blank));
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.score.lyrics).toBe(undefined);
    }
  });

  it('rechaza una letra que no es texto o es desmesurada', () => {
    expect(errorsOf(withLyrics(42)).some((e) => e.startsWith('score.lyrics'))).toBe(true);
    expect(errorsOf(withLyrics('a'.repeat(SCORE_LIMITS.lyrics + 1))).some((e) => e.startsWith('score.lyrics'))).toBe(true);
  });
});

describe('parseScore: datos inválidos', () => {
  it('rechaza lo que no es un objeto', () => {
    expect(errorsOf(null)).toHaveLength(1);
    expect(errorsOf('hola')).toHaveLength(1);
    expect(errorsOf([])).toHaveLength(1);
  });

  it('indica la ruta exacta del problema', () => {
    const bad = json(exampleScore) as { measures: { elements: { pitch?: { step: string } }[] }[] };
    bad.measures[2]!.elements[1]!.pitch!.step = 'H';
    const errors = errorsOf(bad);
    expect(errors.length).toBe(1);
    expect(errors[0]!.startsWith('score.measures[2].elements[1].pitch.step')).toBe(true);
  });

  it('exige título, tonalidad válida, compás válido y al menos un compás', () => {
    expect(errorsOf({ ...(json(exampleScore) as object), title: '  ' }).some((e) => e.startsWith('score.title'))).toBe(true);
    expect(errorsOf({ ...(json(exampleScore) as object), originalKey: { fifths: 9, mode: 'major' } }).some((e) => e.startsWith('score.originalKey'))).toBe(true);
    expect(errorsOf({ ...(json(exampleScore) as object), timeSignature: { beats: 4, beatType: 3 } }).some((e) => e.startsWith('score.timeSignature'))).toBe(true);
    expect(errorsOf({ ...(json(exampleScore) as object), measures: [] }).some((e) => e.startsWith('score.measures'))).toBe(true);
    expect(errorsOf({ ...(json(exampleScore) as object), schemaVersion: 2 }).some((e) => e.startsWith('score.schemaVersion'))).toBe(true);
  });

  it('rechaza duraciones, acordes y alteraciones fuera de rango', () => {
    const bad = json(exampleScore) as {
      measures: { elements: { duration: { num: number; den: number }; pitch?: { alter: number } }[]; chords: { chord: { quality: string } }[] }[];
    };
    bad.measures[0]!.elements[0]!.duration = { num: 1, den: 0 };
    bad.measures[1]!.elements[0]!.pitch!.alter = 3;
    bad.measures[0]!.chords[0]!.chord.quality = 'maravilloso';
    const errors = errorsOf(bad);
    expect(errors.some((e) => e.includes('measures[0].elements[0].duration.den'))).toBe(true);
    expect(errors.some((e) => e.includes('measures[1].elements[0].pitch.alter'))).toBe(true);
    expect(errors.some((e) => e.includes('measures[0].chords[0].chord.quality'))).toBe(true);
  });

  it('no acepta partituras transpuestas (son vistas derivadas)', () => {
    const transposed = json(transposeScore(exampleScore, key(4)));
    expect(errorsOf(transposed).some((e) => e.startsWith('score.transposition'))).toBe(true);
  });

  it('limita la cantidad de errores informados', () => {
    const bad = json(exampleScore) as { measures: object[] };
    bad.measures = Array.from({ length: 100 }, () => ({ number: 'x' }));
    expect(errorsOf(bad).length <= 25).toBe(true);
  });
});

describe('parseScore: solo pasan los campos conocidos', () => {
  it('descarta campos desconocidos, también dentro de compases y notas, y claves con "$"', () => {
    const dirty = json(exampleScore) as Record<string, any>;
    dirty.$where = 'function() { return true }';
    dirty.extra = { $ne: 1 };
    dirty.measures[0].hack = true;
    dirty.measures[0].elements[0].$set = { a: 1 };
    dirty.measures[0].elements[0].pitch.$gt = 3;
    dirty.measures[0].chords[0].chord.admin = true;
    dirty.metadata.source.$or = [];
    const result = parseScore(dirty);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(JSON.stringify(result.score).includes('$')).toBe(false);
      expect(JSON.stringify(result.score).includes('hack')).toBe(false);
      expect(JSON.stringify(result.score).includes('admin')).toBe(false);
      expect(result.score).toEqual(exampleScore);
    }
  });

  it('no modifica el objeto de entrada', () => {
    const input = json(exampleScore) as Record<string, unknown>;
    input.junk = 1;
    const snapshot = JSON.stringify(input);
    parseScore(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
