import type { Chord, ChordQuality } from '../model/chord';
import { type PitchClass, type Step, pitchClass } from '../model/pitch';

export type ParseChordResult =
  | { readonly ok: true; readonly chord: Chord }
  | { readonly ok: false; readonly error: string };

/** Alias de sufijo → calidad. Se elige siempre la coincidencia más larga. */
const QUALITY_ALIASES: ReadonlyArray<readonly [string, ChordQuality]> = [
  ['', 'major'], ['M', 'major'], ['maj', 'major'], ['Maj', 'major'],
  ['m', 'minor'], ['min', 'minor'], ['mi', 'minor'], ['-', 'minor'],
  ['7', 'dominant7'],
  ['maj7', 'major7'], ['Maj7', 'major7'], ['M7', 'major7'], ['ma7', 'major7'], ['MA7', 'major7'],
  ['Δ', 'major7'], ['Δ7', 'major7'], ['∆', 'major7'], ['∆7', 'major7'], ['^', 'major7'], ['^7', 'major7'],
  ['m7', 'minor7'], ['min7', 'minor7'], ['mi7', 'minor7'], ['-7', 'minor7'],
  ['dim', 'diminished'], ['o', 'diminished'], ['°', 'diminished'],
  ['dim7', 'diminished7'], ['o7', 'diminished7'], ['°7', 'diminished7'],
  ['m7b5', 'halfDiminished7'], ['m7♭5', 'halfDiminished7'], ['min7b5', 'halfDiminished7'],
  ['mi7b5', 'halfDiminished7'], ['-7b5', 'halfDiminished7'],
  ['ø', 'halfDiminished7'], ['ø7', 'halfDiminished7'], ['Ø', 'halfDiminished7'], ['Ø7', 'halfDiminished7'],
  ['aug', 'augmented'], ['+', 'augmented'],
  ['sus2', 'sus2'], ['sus4', 'sus4'], ['sus', 'sus4'],
  ['7sus4', 'dominant7sus4'], ['7sus', 'dominant7sus4'],
  ['6', 'major6'], ['m6', 'minor6'], ['min6', 'minor6'], ['-6', 'minor6'],
  ['9', 'dominant9'], ['maj9', 'major9'], ['Maj9', 'major9'], ['M9', 'major9'], ['Δ9', 'major9'],
  ['m9', 'minor9'], ['min9', 'minor9'], ['-9', 'minor9'],
  ['11', 'dominant11'], ['13', 'dominant13'],
  ['mMaj7', 'minorMajor7'], ['mM7', 'minorMajor7'], ['m(maj7)', 'minorMajor7'],
  ['min(maj7)', 'minorMajor7'], ['-Maj7', 'minorMajor7'],
];

/** Lo que puede seguir a un alias para que la coincidencia sea válida ("7" + "b9", pero no "o" + "mit3"). */
const VALID_REMAINDER = /^$|^[0-9#b♯♭(+\-/]|^add|^alt|^omit/;

const SUFFIX_CHARS = /^[A-Za-z0-9#♯♭+\-°øØΔ∆^(),/]*$/;
const ROOT = /^([A-G])(♯♯|♭♭|##|bb|♯|♭|#|b)?/;
const BASS = /^([A-G])(♯♯|♭♭|##|bb|♯|♭|#|b)?$/;

function alterOf(accidental: string | undefined): number {
  if (!accidental) return 0;
  const first = accidental[0];
  const sign = first === '#' || first === '♯' ? 1 : -1;
  return sign * accidental.length;
}

function classify(suffix: string): ChordQuality {
  let best: { length: number; quality: ChordQuality } | undefined;
  for (const [alias, quality] of QUALITY_ALIASES) {
    if (!suffix.startsWith(alias)) continue;
    if (!VALID_REMAINDER.test(suffix.slice(alias.length))) continue;
    if (!best || alias.length > best.length) best = { length: alias.length, quality };
  }
  return best?.quality ?? 'other';
}

/** Separa un símbolo de acorde en raíz, calidad, sufijo y bajo. Nunca lanza: devuelve el error. */
export function parseChord(input: string): ParseChordResult {
  const text = input.trim();
  if (text === '') return { ok: false, error: 'El símbolo de acorde está vacío.' };

  const rootMatch = ROOT.exec(text);
  if (!rootMatch) {
    return { ok: false, error: `"${text}": el acorde debe empezar con una nota de la A a la G en mayúscula.` };
  }
  const root: PitchClass = pitchClass(rootMatch[1] as Step, alterOf(rootMatch[2]));
  const rest = text.slice(rootMatch[0].length);

  let suffix = rest;
  let bass: PitchClass | undefined;
  const slash = rest.lastIndexOf('/');
  if (slash >= 0) {
    const bassMatch = BASS.exec(rest.slice(slash + 1));
    if (bassMatch) {
      bass = pitchClass(bassMatch[1] as Step, alterOf(bassMatch[2]));
      suffix = rest.slice(0, slash);
    }
  }

  if (!SUFFIX_CHARS.test(suffix)) {
    return { ok: false, error: `"${text}": contiene caracteres que no pertenecen a un cifrado.` };
  }
  if (/\/(?!\d)/.test(suffix)) {
    return { ok: false, error: `"${text}": el bajo después de "/" no es una nota válida.` };
  }

  const chord: Chord = {
    root,
    quality: classify(suffix),
    suffix,
    ...(bass ? { bass } : {}),
    text,
  };
  return { ok: true, chord };
}

export function parseChordOrThrow(input: string): Chord {
  const result = parseChord(input);
  if (!result.ok) throw new Error(result.error);
  return result.chord;
}

function noteText(p: PitchClass, glyphs: boolean): string {
  const sharp = glyphs ? '♯' : '#';
  const flat = glyphs ? '♭' : 'b';
  const alter = p.alter > 0 ? sharp.repeat(p.alter) : flat.repeat(-p.alter);
  return `${p.step}${alter}`;
}

/**
 * Reconstruye el texto a partir de las componentes. Por defecto con # y b ASCII;
 * con `glyphs` usa ♯ y ♭ (para respetar el estilo de quien escribió el cifrado).
 */
export function chordToText(chord: Chord, options: { glyphs?: boolean } = {}): string {
  const glyphs = options.glyphs ?? false;
  return `${noteText(chord.root, glyphs)}${chord.suffix}${chord.bass ? `/${noteText(chord.bass, glyphs)}` : ''}`;
}
