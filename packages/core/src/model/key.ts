export type Mode = 'major' | 'minor';

/**
 * Tonalidad como posición en el círculo de quintas (igual que MusicXML):
 * fifths = -7 (7 bemoles) … 0 (sin alteraciones) … +7 (7 sostenidos).
 */
export interface Key {
  readonly fifths: number;
  readonly mode: Mode;
}

const MAJOR_TONICS = ['Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
const MINOR_TONICS = ['Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#'];

export function key(fifths: number, mode: Mode = 'major'): Key {
  if (!Number.isInteger(fifths) || fifths < -7 || fifths > 7) {
    throw new RangeError(`La armadura debe estar entre -7 y 7 (recibido ${fifths}).`);
  }
  return { fifths, mode };
}

/** Semitonos de la tónica respecto de C (0..11). */
function tonicSemitones(k: Key): number {
  const major = (((7 * k.fifths) % 12) + 12) % 12;
  return k.mode === 'major' ? major : (major + 9) % 12;
}

/**
 * Las 15 tonalidades de un modo, ordenadas por la altura de la tónica (C, Db, C#, D…).
 * Las enarmónicas (F# y Gb, B y Cb, C# y Db) aparecen por separado, cada una con su armadura.
 */
export function allKeys(mode: Mode): Key[] {
  const keys: Key[] = [];
  for (let fifths = -7; fifths <= 7; fifths++) keys.push({ fifths, mode });
  return keys.sort((a, b) => tonicSemitones(a) - tonicSemitones(b) || a.fifths - b.fifths);
}

/** Nombre de la tónica: "C", "Bb", "F#"… */
export function keyTonic(k: Key): string {
  const table = k.mode === 'major' ? MAJOR_TONICS : MINOR_TONICS;
  const tonic = table[k.fifths + 7];
  if (tonic === undefined) throw new RangeError(`Tonalidad inválida (fifths=${k.fifths}).`);
  return tonic;
}
