import { VexFlow } from 'vexflow';
import { type ChordFontId, DEFAULT_CHORD_FONT, chordFontFor, fontLoadSpec } from './typography';

let vexFlowReady: Promise<void> | undefined;
const chordFontLoads = new Map<ChordFontId, Promise<void>>();

/** VexFlow 5 necesita sus fuentes (Bravura para los símbolos) antes de dibujar. Se cargan una sola vez. */
function ensureVexFlowFonts(): Promise<void> {
  vexFlowReady ??= (async () => {
    try {
      await VexFlow.loadFonts('Bravura', 'Academico');
      VexFlow.setFonts('Bravura', 'Academico');
    } catch (error) {
      console.warn('No se pudieron cargar las fuentes de VexFlow; se usan las predeterminadas.', error);
    }
  })();
  return vexFlowReady;
}

/** La tipografía elegida para el cifrado: se espera un instante a que llegue; si no, se usa la siguiente de la lista. */
function ensureChordFont(id: ChordFontId): Promise<void> {
  let load = chordFontLoads.get(id);
  if (!load) {
    const spec = fontLoadSpec(chordFontFor(id));
    load = (async () => {
      if (!spec || typeof document === 'undefined' || !document.fonts) return;
      try {
        await Promise.race([document.fonts.load(spec), new Promise((resolve) => setTimeout(resolve, 2000))]);
      } catch {
        // sin la fuente, el cifrado usa la alternativa
      }
    })();
    chordFontLoads.set(id, load);
  }
  return load;
}

/** Deja listas las fuentes de VexFlow y la del cifrado elegida. */
export async function ensureFonts(chordFont: ChordFontId = DEFAULT_CHORD_FONT): Promise<void> {
  await Promise.all([ensureVexFlowFonts(), ensureChordFont(chordFont)]);
}
