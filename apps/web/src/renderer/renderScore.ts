import {
  type Duration,
  type Measure,
  type MeasureElement,
  type Score,
  ZERO_DURATION,
  addDuration,
  compareDuration,
  effectiveKeys,
  endingSpans,
  effectiveTimeSignatures,
  formatChordSymbol,
  formatDuration,
  measureCapacity,
  measureDuration,
  notatedDuration,
} from '@partituras/core';
import { Accidental, Barline, Beam, Dot, Formatter, Renderer, Stave, StaveNote, StaveTie, Tuplet, Voice } from 'vexflow';
import { chordAnchorX } from './chordPlacement';
import { type LineBreakMode, type ScoreLayout, layoutScore, logicalWidth, scaledSize } from './layout';
import { clefAnnotation, clefOctaveShift, durationToVex, keySpec, pitchToVexKey, vexDurationString } from './mapping';
import {
  type BarType,
  DOUBLE_BAR,
  MEASURE_NUMBER,
  VOLTA,
  barlinesFor,
  endingBrackets,
  systemEndLabel,
  textPlacement,
} from './structure';
import { pairTies } from './ties';
import { CHORD_BASELINE, type ChordFontId, TEXT_FONT_FAMILY, chordFontFor } from './typography';
import { isFullMeasureRest, tupletGroups } from './tuplets';

type Context = ReturnType<Renderer['getContext']>;

export interface RenderOptions {
  /** Ancho en píxeles del contenedor donde se dibuja. */
  readonly containerWidth: number;
  /** 1 = tamaño natural; menos de 1 achica y deja ver más compases y líneas. */
  readonly zoom: number;
  /** Cómo repartir los compases en líneas: número máximo, 'file' (saltos del archivo) o null (los que entren). */
  readonly measuresPerSystem: LineBreakMode;
  /** Número del último compás de cada línea, a la derecha. */
  readonly showMeasureNumbers: boolean;
  /** Tipografía del cifrado de acordes. */
  readonly chordFont: ChordFontId;
}

export interface RenderResult {
  /** Problemas no fatales (p. ej. ligaduras sin pareja). */
  readonly warnings: string[];
}

const BAR_TYPES: Record<BarType, number> = {
  single: Barline.type.SINGLE,
  double: Barline.type.DOUBLE,
  final: Barline.type.END,
  'repeat-begin': Barline.type.REPEAT_BEGIN,
  'repeat-end': Barline.type.REPEAT_END,
  'repeat-both': Barline.type.REPEAT_BOTH,
  none: Barline.type.NONE,
};

interface DrawnNote {
  readonly note: StaveNote;
  readonly systemIndex: number;
  readonly isNote: boolean;
  readonly tie?: 'start' | 'stop' | 'continue';
  readonly pitchKey?: string;
}

/**
 * Crea la nota de VexFlow de un elemento. Los tresillos se escriben con su figura (corchea) y no con la
 * duración exacta (1/12); un silencio que ocupa todo el compás se escribe como silencio de redonda.
 */
function toStaveNote(
  el: MeasureElement,
  measureNumber: number,
  octaveShift: number,
  fullMeasureRest: boolean,
): StaveNote {
  if (fullMeasureRest) {
    return new StaveNote({ keys: ['b/4'], duration: 'wr', clef: 'treble' });
  }

  const vex = durationToVex(notatedDuration(el));
  if (!vex) {
    throw new Error(
      `Compás ${measureNumber}: la duración ${formatDuration(el.duration)} todavía no se puede dibujar.`,
    );
  }

  let staveNote: StaveNote;
  if (el.type === 'rest') {
    staveNote = new StaveNote({ keys: ['b/4'], duration: vexDurationString(vex, true), clef: 'treble' });
  } else {
    staveNote = new StaveNote({
      keys: [pitchToVexKey(el.pitch, octaveShift)],
      duration: vexDurationString(vex, false),
      clef: 'treble',
      autoStem: true,
    });
  }
  if (vex.dots > 0) Dot.buildAndAttach([staveNote], { all: true });
  return staveNote;
}

function noteX(note: StaveNote, fallback: number): number {
  try {
    return note.getAbsoluteX();
  } catch {
    return fallback;
  }
}

/** Dibuja el cifrado encima del pentagrama, alineado con las notas del compás. */
function drawChords(context: Context, stave: Stave, measure: Measure, notes: StaveNote[], lift: number, fontId: ChordFontId): void {
  if (measure.chords.length === 0) return;

  const starts: Duration[] = [];
  let total = ZERO_DURATION;
  for (const el of measure.elements) {
    starts.push(total);
    total = addDuration(total, el.duration);
  }
  const xs = notes.map((n) => noteX(n, stave.getNoteStartX()));
  const endX = stave.getNoteEndX();
  const y = stave.getYForLine(0) - CHORD_BASELINE - lift;

  context.save();
  const font = chordFontFor(fontId);
  context.setFont(font.family, font.size, font.weight);
  for (const { offset, chord } of measure.chords) {
    context.fillText(formatChordSymbol(chord), chordAnchorX(offset, starts, xs, total, endX) - 2, y);
  }
  context.restore();
}

function textWidth(context: Context, text: string): number {
  try {
    return context.measureText(text).width;
  } catch {
    return text.length * 6.5;
  }
}

/** "x3", "D.C."…: al comienzo del compás o pegados a su final, por encima de las casillas. */
function drawTexts(context: Context, stave: Stave, measure: Measure, right: number): void {
  const texts = measure.texts ?? [];
  const times = measure.endRepeat && measure.repeatTimes ? `x${measure.repeatTimes}` : undefined;
  if (texts.length === 0 && !times) return;
  const y = stave.getYForLine(0) - VOLTA.textBaseline;

  context.save();
  context.setFont(TEXT_FONT_FAMILY, VOLTA.textFontSize, 'bold', 'italic');
  let startX = stave.getNoteStartX() + 2;
  let endX = right - 4;
  if (times) {
    // El número de repeticiones va justo encima de la barra de fin de repetición.
    endX -= textWidth(context, times);
    context.fillText(times, endX, y);
    endX -= 6;
  }
  for (const text of texts) {
    const width = textWidth(context, text);
    if (textPlacement(text) === 'start') {
      context.fillText(text, startX, y);
      startX += width + 6;
    } else {
      endX -= width;
      context.fillText(text, endX, y);
      endX -= 6;
    }
  }
  context.restore();
}

/** Número del último compás de la línea, chico y a la derecha de la última barra. */
function drawSystemNumber(context: Context, system: ScoreLayout['systems'][number], measures: readonly Measure[]): void {
  const label = systemEndLabel(system, measures);
  if (!label) return;
  context.save();
  context.setFont(TEXT_FONT_FAMILY, MEASURE_NUMBER.fontSize, 'normal');
  context.setFillStyle('#555555');
  context.fillText(label.text, label.x, system.staveY + MEASURE_NUMBER.baselineFromTop);
  context.restore();
  context.setFillStyle('#000000');
}

/** Casillas (1.ª, 2.ª vez): corchete sobre los compases, con gancho donde empieza o termina cerrada. */
function drawEndingBrackets(
  context: Context,
  system: ScoreLayout['systems'][number],
  infos: ReturnType<typeof endingSpans>,
): void {
  const top = system.staveY - VOLTA.lineOffset;
  context.save();
  context.setLineWidth(1);
  for (const bracket of endingBrackets(system, infos)) {
    context.beginPath();
    if (bracket.hookLeft) {
      context.moveTo(bracket.x1, top + VOLTA.hook);
      context.lineTo(bracket.x1, top);
    } else {
      context.moveTo(bracket.x1, top);
    }
    context.lineTo(bracket.x2, top);
    if (bracket.hookRight) context.lineTo(bracket.x2, top + VOLTA.hook);
    context.stroke();

    context.setFont(TEXT_FONT_FAMILY, VOLTA.fontSize, 'bold');
    context.fillText(bracket.label, bracket.x1 + VOLTA.labelOffsetX, top - VOLTA.labelAboveLine);
  }
  context.restore();
}

/** Doble barra con líneas más gruesas que las de VexFlow, pegada al final del pentagrama. */
function drawDoubleBar(context: Context, stave: Stave, right: number): void {
  const top = stave.getYForLine(0);
  const bottom = stave.getYForLine(4);
  context.save();
  context.setLineWidth(DOUBLE_BAR.lineWidth);
  for (const x of [right - 1 - DOUBLE_BAR.lineWidth - DOUBLE_BAR.gap, right - 1]) {
    context.beginPath();
    context.moveTo(x, top);
    context.lineTo(x, bottom);
    context.stroke();
  }
  context.restore();
}

function drawTie(context: Context, firstNote: StaveNote | null, lastNote: StaveNote | null): void {
  new StaveTie({ firstNote, lastNote, firstIndexes: [0], lastIndexes: [0] }).setContext(context).draw();
}

/**
 * Dibuja la partitura en varias líneas para el ancho disponible, solo a partir del modelo propio.
 * Se puede volver a llamar con otro ancho, zoom u opciones: borra lo anterior y rehace el layout.
 */
export function renderScore(container: HTMLDivElement, score: Score, options: RenderOptions): RenderResult {
  const warnings: string[] = [];
  container.innerHTML = '';

  const layout = layoutScore(score, logicalWidth(options.containerWidth, options.zoom), {
    measuresPerSystem: options.measuresPerSystem,
  });
  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(layout.width, layout.height);
  const context = renderer.getContext();

  const signatures = effectiveTimeSignatures(score);
  const keys = effectiveKeys(score);
  const drawn: DrawnNote[] = [];
  const endings = endingSpans(score);
  const octaveChange = score.clef?.octaveChange ?? 0;
  const octaveShift = clefOctaveShift(octaveChange);
  const annotation = clefAnnotation(octaveChange);

  layout.systems.forEach((system, systemIndex) => {
    system.measures.forEach((placed, position) => {
      const m = score.measures[placed.index];
      const ts = signatures[placed.index];
      const key = keys[placed.index];
      if (!m || !ts || !key) return;

      const neighbor = (offset: number): Measure | undefined => {
        const other = system.measures[position + offset];
        return other ? score.measures[other.index] : undefined;
      };
      const bars = barlinesFor(m, neighbor(-1), neighbor(1));

      const stave = new Stave(placed.x, system.staveY, placed.width);
      if (bars.begin !== 'single') stave.setBegBarType(BAR_TYPES[bars.begin]);
      // La doble barra se dibuja aparte, con líneas más gruesas.
      if (bars.end !== 'single') stave.setEndBarType(BAR_TYPES[bars.end === 'double' ? 'none' : bars.end]);
      if (placed.display.clef) stave.addClef('treble', 'default', annotation);
      if (placed.display.key) stave.addKeySignature(placed.display.key.spec, placed.display.key.cancelSpec);
      if (placed.display.time) stave.addTimeSignature(placed.display.time);
      stave.setContext(context).draw();
      if (bars.end === 'double') drawDoubleBar(context, stave, placed.x + placed.width);

      const capacity = measureCapacity(ts);
      const fullMeasureRest = isFullMeasureRest(m.elements, capacity);
      const notes = m.elements.map((el) => toStaveNote(el, m.number, octaveShift, fullMeasureRest));

      // Grupos irregulares: se crean antes de la voz, porque cambian la duración efectiva de sus notas.
      // Las opciones van con los dos estilos de nombre para no depender de la versión de VexFlow.
      const tuplets = tupletGroups(m.elements).map((group) => {
        const options: Record<string, number> = {
          numNotes: group.actual,
          notesOccupied: group.normal,
          num_notes: group.actual,
          notes_occupied: group.normal,
        };
        return new Tuplet(notes.slice(group.from, group.to + 1), options);
      });

      // Compases completos usan su compás; anacrusa y compás final que la completa, su duración real.
      const total = measureDuration(m);
      const voice =
        compareDuration(total, capacity) === 0
          ? new Voice({ numBeats: ts.beats, beatValue: ts.beatType })
          : new Voice({ numBeats: total.num, beatValue: total.den });
      // La duración del compás ya se validó en el modelo: VexFlow no debe volver a exigirla.
      voice.setStrict(false);
      voice.addTickables(notes);

      Accidental.applyAccidentals([voice], keySpec(key));
      const beams = Beam.generateBeams(notes);
      new Formatter().joinVoices([voice]).formatToStave([voice], stave);

      voice.draw(context, stave);
      drawChords(context, stave, m, notes, endings[placed.index] ? VOLTA.chordLift : 0, options.chordFont);
      drawTexts(context, stave, m, placed.x + placed.width);
      tuplets.forEach((tuplet) => tuplet.setContext(context).draw());
      beams.forEach((beam) => beam.setContext(context).draw());

      m.elements.forEach((el, k) => {
        const note = notes[k];
        if (!note) return;
        drawn.push({
          note,
          systemIndex,
          isNote: el.type === 'note',
          ...(el.type === 'note' ? { tie: el.tie, pitchKey: pitchToVexKey(el.pitch) } : {}),
        });
      });
    });
    drawEndingBrackets(context, system, endings);
    if (options.showMeasureNumbers) drawSystemNumber(context, system, score.measures);
  });

  const { pairs, unmatched } = pairTies(drawn);
  for (const { from, to } of pairs) {
    const a = drawn[from];
    const b = drawn[to];
    if (!a || !b) continue;
    if (a.systemIndex === b.systemIndex) {
      drawTie(context, a.note, b.note);
    } else {
      // La ligadura cruza de línea: se dibuja la mitad al final de una y la mitad al inicio de la otra.
      drawTie(context, a.note, null);
      drawTie(context, null, b.note);
    }
  }
  if (unmatched.length > 0) {
    warnings.push(`Hay ${unmatched.length} ligadura(s) sin la nota con la que unirse; no se dibujan.`);
  }

  // El dibujo se hace en medidas lógicas; el zoom se aplica escalando el SVG completo.
  const svg = container.querySelector('svg');
  if (svg) {
    const size = scaledSize(layout, options.zoom);
    svg.setAttribute('viewBox', `0 0 ${layout.width} ${layout.height}`);
    svg.setAttribute('width', String(size.width));
    svg.setAttribute('height', String(size.height));
    svg.style.width = `${size.width}px`;
    svg.style.height = `${size.height}px`;
    // El número del último compás de cada línea queda a la derecha, en el margen del contenedor.
    svg.style.overflow = 'visible';
  }

  return { warnings };
}
