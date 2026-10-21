import { type XmlElement, child, childText, childrenNamed } from './xml';

/** Sufijo de cifrado por defecto para cada <kind> de MusicXML. */
const KIND_SUFFIX: Readonly<Record<string, string>> = {
  major: '',
  minor: 'm',
  augmented: 'aug',
  diminished: 'dim',
  dominant: '7',
  'major-seventh': 'maj7',
  'minor-seventh': 'm7',
  'diminished-seventh': 'dim7',
  'augmented-seventh': 'aug7',
  'half-diminished': 'm7b5',
  'major-minor': 'm(maj7)',
  'major-sixth': '6',
  'minor-sixth': 'm6',
  'dominant-ninth': '9',
  'major-ninth': 'maj9',
  'minor-ninth': 'm9',
  'dominant-11th': '11',
  'dominant-13th': '13',
  'suspended-second': 'sus2',
  'suspended-fourth': 'sus4',
  power: '5',
};

export type HarmonyText =
  | { readonly ok: true; readonly text: string; readonly degreesIgnored: boolean }
  | { readonly ok: false; readonly reason: string };

function noteText(parent: XmlElement, stepName: string, alterName: string): string | { error: string } {
  const step = childText(parent, stepName);
  if (!step || !/^[A-G]$/.test(step)) return { error: `nota "${step ?? ''}" inválida` };
  const alterText = childText(parent, alterName);
  const alter = alterText === undefined ? 0 : Number(alterText);
  if (!Number.isInteger(alter) || alter < -2 || alter > 2) return { error: `alteración "${alterText}" no soportada` };
  return `${step}${alter > 0 ? '#'.repeat(alter) : 'b'.repeat(-alter)}`;
}

/**
 * Construye el símbolo de un <harmony> ("Bb7/E"). Si el <kind> trae el atributo `text`
 * (cómo lo muestra el autor: "m7", "-7"…), se respeta; si no, se usa el sufijo estándar.
 */
export function harmonyToText(harmony: XmlElement): HarmonyText {
  const rootEl = child(harmony, 'root');
  if (!rootEl) return { ok: false, reason: 'acorde sin raíz' };
  const root = noteText(rootEl, 'root-step', 'root-alter');
  if (typeof root !== 'string') return { ok: false, reason: `raíz con ${root.error}` };

  const kindEl = child(harmony, 'kind');
  if (!kindEl) return { ok: false, reason: 'acorde sin tipo (kind)' };
  if (kindEl.text === 'none') return { ok: false, reason: 'sin acorde (N.C.)' };

  const shown = kindEl.attributes.text;
  const suffix = shown !== undefined ? shown : KIND_SUFFIX[kindEl.text];
  if (suffix === undefined) return { ok: false, reason: `tipo de acorde "${kindEl.text}" no soportado` };

  let bass = '';
  const bassEl = child(harmony, 'bass');
  if (bassEl) {
    const b = noteText(bassEl, 'bass-step', 'bass-alter');
    if (typeof b !== 'string') return { ok: false, reason: `bajo con ${b.error}` };
    bass = `/${b}`;
  }

  return { ok: true, text: `${root}${suffix}${bass}`, degreesIgnored: childrenNamed(harmony, 'degree').length > 0 };
}
