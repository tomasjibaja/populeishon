import type { Chord, ChordQuality } from '../model/chord';
import { type Mode, key, keyTonic } from '../model/key';
import type { PitchClass } from '../model/pitch';

/**
 * MuseScore no escribe <mode>: una armadura con 1 sostenido puede ser G mayor o E menor.
 * Como el modo determina la tónica (y por lo tanto la transposición), se infiere de los acordes:
 * se mira el último acorde y, si no decide, el primero. Decide si su raíz es la tónica mayor
 * o la tónica menor de esa armadura, y su calidad es coherente (mayor/dominante o menor).
 */

const MINOR_FAMILY: ReadonlySet<ChordQuality> = new Set<ChordQuality>([
  'minor',
  'minor6',
  'minor7',
  'minor9',
  'minorMajor7',
  'halfDiminished7',
  'diminished',
  'diminished7',
]);

export type ModeInference =
  | { readonly mode: Mode; readonly decidedBy: 'last-chord' | 'first-chord' }
  | { readonly mode: 'major'; readonly decidedBy: 'default' };

function samePitchClass(a: PitchClass, tonic: string): boolean {
  const text = `${a.step}${a.alter > 0 ? '#'.repeat(a.alter) : 'b'.repeat(-a.alter)}`;
  return text === tonic;
}

function decide(fifths: number, chord: Chord): Mode | undefined {
  const minorFamily = MINOR_FAMILY.has(chord.quality);
  if (samePitchClass(chord.root, keyTonic(key(fifths, 'minor'))) && minorFamily) return 'minor';
  if (samePitchClass(chord.root, keyTonic(key(fifths, 'major'))) && !minorFamily) return 'major';
  return undefined;
}

export function inferMode(fifths: number, chordsInOrder: readonly Chord[]): ModeInference {
  const last = chordsInOrder[chordsInOrder.length - 1];
  const first = chordsInOrder[0];
  if (last) {
    const mode = decide(fifths, last);
    if (mode) return { mode, decidedBy: 'last-chord' };
  }
  if (first) {
    const mode = decide(fifths, first);
    if (mode) return { mode, decidedBy: 'first-chord' };
  }
  return { mode: 'major', decidedBy: 'default' };
}
