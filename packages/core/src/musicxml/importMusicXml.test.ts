import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { measureDuration, scoreDuration } from '../analysis/analysis';
import { QUARTER, duration } from '../model/duration';
import { key } from '../model/key';
import type { NoteElement } from '../model/note';
import { validateScore } from '../validation/validateScore';
import { type ImportResult, importMusicXml } from './importMusicXml';

// ---------- archivos reales exportados desde MuseScore ----------

function readFixture(name: string): string {
  for (const dir of [join(process.cwd(), 'test-data'), join(process.cwd(), 'packages', 'core', 'test-data')]) {
    try {
      return readFileSync(join(dir, name), 'utf8');
    } catch {
      // probar el siguiente directorio
    }
  }
  throw new Error(`No se encontró el archivo de prueba ${name}`);
}

function importFile(name: string): Extract<ImportResult, { ok: true }> {
  const result = importMusicXml(readFixture(name), { fileName: name });
  if (!result.ok) throw new Error(`No se pudo importar ${name}: ${result.report.items.map((i) => i.message).join(' | ')}`);
  return result;
}

const notes = (result: ReturnType<typeof importFile>) =>
  result.score.measures.flatMap((m) => m.elements).filter((e): e is NoteElement => e.type === 'note');
const warnings = (result: ReturnType<typeof importFile>) => result.report.items.filter((i) => i.severity === 'warning');
const measureNumbered = (result: ReturnType<typeof importFile>, n: number) => {
  const found = result.score.measures.find((m) => m.number === n);
  if (!found) throw new Error(`No hay compás ${n}`);
  return found;
};
const hasMessage = (result: ReturnType<typeof importFile>, severity: string, text: string) =>
  result.report.items.some((i) => i.severity === severity && i.message.includes(text));

describe('importar "Bien haiga con el mocito (Em)"', () => {
  const result = importFile('Bien_haiga_con_el_mocito__Em_.musicxml');
  const { score } = result;

  it('lee título, autor y estilo de los créditos (no de work-title)', () => {
    expect(score.title).toBe('Bien haiga con el mocito');
    expect(score.composer).toBe('Fortunato Juárez');
    expect(score.style).toBe('Chacarera');
  });

  it('deduce E menor porque el archivo no trae modo', () => {
    expect(score.originalKey).toEqual(key(1, 'minor'));
    expect(hasMessage(result, 'info', 'E minor')).toBe(true);
  });

  it('lee compás 3/4, clave de sol 8vb y anacrusa', () => {
    expect(score.timeSignature).toEqual({ beats: 3, beatType: 4 });
    expect(score.clef).toEqual({ sign: 'G', octaveChange: -1 });
    expect(score.measures).toHaveLength(28);
    expect(score.measures[0]?.pickup).toBe(true);
    expect(score.measures[0]?.number).toBe(0);
    expect(measureDuration(score.measures[0]!)).toEqual(QUARTER);
  });

  it('conserva acordes con su posición y sufijo de autor', () => {
    const all = score.measures.flatMap((m) => m.chords.map((c) => c.chord));
    expect(all).toHaveLength(21);
    expect(all[all.length - 1]?.text).toBe('Em');
    expect(all.every((c) => c.quality !== 'other')).toBe(true);
  });

  it('conserva las ligaduras como pares', () => {
    const tied = notes(result);
    expect(tied.filter((n) => n.tie === 'start' || n.tie === 'continue')).toHaveLength(13);
    expect(tied.filter((n) => n.tie === 'stop' || n.tie === 'continue')).toHaveLength(13);
  });

  it('importa repeticiones, casillas, dobles barras, barra final y el texto x3', () => {
    expect(measureNumbered(result, 1).startRepeat).toBe(true);
    expect(measureNumbered(result, 16).endRepeat).toBe(true);
    expect(measureNumbered(result, 14).endingStart).toEqual({ numbers: [1], label: '1. 2.' });
    expect(measureNumbered(result, 16).endingEnd).toBe('closed');
    expect(measureNumbered(result, 17).endingStart).toEqual({ numbers: [2], label: '3.' });
    expect(measureNumbered(result, 19).endingEnd).toBe('open');
    expect(measureNumbered(result, 8).endBarline).toBe('double');
    expect(measureNumbered(result, 19).endBarline).toBe('double');
    expect(measureNumbered(result, 27).endBarline).toBe('final');
    expect(measureNumbered(result, 0).texts).toBe(undefined);
    expect(measureNumbered(result, 16).repeatTimes).toBe(3);
    expect(hasMessage(result, 'info', 'Estructura importada')).toBe(true);
  });

  it('conserva los saltos de línea del archivo', () => {
    expect(score.measures.filter((m) => m.newSystem).map((m) => m.number)).toEqual([5, 9, 14, 20, 24]);
  });

  it('el resultado es coherente y no tiene avisos', () => {
    expect(validateScore(score)).toHaveLength(0);
    expect(warnings(result)).toHaveLength(0);
    expect(scoreDuration(score)).toEqual(duration(82, 4));
    expect(score.metadata.source).toEqual({ kind: 'musicxml', fileName: 'Bien_haiga_con_el_mocito__Em_.musicxml' });
  });
});

describe('importar "El coyuyo y la tortuga"', () => {
  const result = importFile('El_coyuyo_y_la_tortuga.musicxml');
  const { score } = result;

  it('lee metadatos y deduce G mayor', () => {
    expect(score.title).toBe('El coyuyo y la tortuga');
    expect(score.composer).toBe('Peteco Carabajal');
    expect(score.style).toBe('Escondido');
    expect(score.originalKey).toEqual(key(1, 'major'));
  });

  it('30 compases completos en 3/4, sin anacrusa, clave de sol normal', () => {
    expect(score.measures).toHaveLength(30);
    expect(score.measures.some((m) => m.pickup)).toBe(false);
    expect(score.timeSignature).toEqual({ beats: 3, beatType: 4 });
    expect(score.clef).toEqual({ sign: 'G', octaveChange: 0 });
    expect(validateScore(score)).toHaveLength(0);
  });

  it('importa dos secciones con repetición ("|: ... :||: ... :|"), casillas, D.C. y x3', () => {
    expect(measureNumbered(result, 10).startRepeat).toBe(true);
    expect(measureNumbered(result, 13).endRepeat).toBe(true);
    expect(measureNumbered(result, 14).startRepeat).toBe(true);
    expect(measureNumbered(result, 14).texts).toBe(undefined);
    expect(measureNumbered(result, 29).repeatTimes).toBe(3);
    expect(measureNumbered(result, 13).repeatTimes).toBe(undefined);
    expect(measureNumbered(result, 29).endingStart?.label).toBe('1. 2.');
    expect(measureNumbered(result, 29).endRepeat).toBe(true);
    expect(measureNumbered(result, 30).endingStart?.label).toBe('3.');
    expect(measureNumbered(result, 30).endingEnd).toBe('open');
    expect(measureNumbered(result, 30).texts).toEqual(['D.C.']);
    expect(measureNumbered(result, 9).endBarline).toBe('double');
    expect(measureNumbered(result, 21).endBarline).toBe('double');
    expect(warnings(result)).toHaveLength(0);
  });

  it('conserva los saltos de línea del archivo', () => {
    expect(score.measures.filter((m) => m.newSystem).map((m) => m.number)).toEqual([5, 10, 14, 18, 22, 26]);
  });

  it('23 acordes y 14 ligaduras', () => {
    expect(score.measures.reduce((n, m) => n + m.chords.length, 0)).toBe(23);
    expect(notes(result).filter((n) => n.tie === 'start' || n.tie === 'continue')).toHaveLength(14);
  });
});

describe('importar "La nostalgiosa"', () => {
  const result = importFile('La_nostalgiosa.musicxml');
  const { score } = result;

  it('lee metadatos; sin subtítulo no hay estilo', () => {
    expect(score.title).toBe('La Nostalgiosa');
    expect(score.composer).toBe('E. Falú / J. Dávalos');
    expect(score.style).toBe(undefined);
  });

  it('C mayor, 3/4, clave 8vb y tempo 80', () => {
    expect(score.originalKey).toEqual(key(0, 'major'));
    expect(score.timeSignature).toEqual({ beats: 3, beatType: 4 });
    expect(score.clef).toEqual({ sign: 'G', octaveChange: -1 });
    expect(score.tempo).toEqual({ bpm: 80, beatUnit: QUARTER });
  });

  it('detecta la anacrusa aunque el archivo no la marque como implícita', () => {
    expect(score.measures[0]?.pickup).toBe(true);
    expect(score.measures[0]?.number).toBe(0);
    expect(score.measures[1]?.number).toBe(1);
    expect(score.measures).toHaveLength(31);
    expect(validateScore(score)).toHaveLength(0);
  });

  it('importa los 36 acordes, incluidos dos en un mismo compás, y las semicorcheas', () => {
    expect(score.measures.reduce((n, m) => n + m.chords.length, 0)).toBe(36);
    expect(score.measures.some((m) => m.chords.length === 2)).toBe(true);
    expect(notes(result).some((n) => n.duration.num === 1 && n.duration.den === 16)).toBe(true);
  });

  it('importa las casillas 1. y 2. de cada sección y el D.C. final', () => {
    // La anacrusa es el compás 0: los números son los del archivo menos uno.
    expect([4, 17].map((n) => measureNumbered(result, n).endingStart?.label)).toEqual(['1.', '1.']);
    expect([5, 18].map((n) => measureNumbered(result, n).endingStart?.label)).toEqual(['2.', '2.']);
    expect([1, 6].map((n) => measureNumbered(result, n).startRepeat)).toEqual([true, true]);
    expect(measureNumbered(result, 30).texts).toEqual(['D.C.']);
    expect(measureNumbered(result, 30).endBarline).toBe('final');
  });

  it('conserva los saltos de línea del archivo', () => {
    expect(score.measures.filter((m) => m.newSystem).map((m) => m.number)).toEqual([6, 10, 14, 19, 23, 27]);
  });

  it('no tiene avisos', () => {
    expect(warnings(result)).toHaveLength(0);
  });
});

// ---------- casos sintéticos ----------

const wrap = (parts: string, extra = '') =>
  `<?xml version="1.0"?><score-partwise version="4.0">${extra}<part-list><score-part id="P1"><part-name>Melodía</part-name></score-part></part-list>${parts}</score-partwise>`;
const part = (measures: string, id = 'P1') => `<part id="${id}">${measures}</part>`;
const attrs = (o: { div?: number; fifths?: number; mode?: string; beats?: number; beatType?: number } = {}) =>
  `<attributes><divisions>${o.div ?? 1}</divisions><key><fifths>${o.fifths ?? 0}</fifths>${o.mode ? `<mode>${o.mode}</mode>` : ''}</key><time><beats>${o.beats ?? 4}</beats><beat-type>${o.beatType ?? 4}</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>`;
const noteXml = (step: string, octave: number, dur: number, extra = '', voice = 1) =>
  `<note><pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>${dur}</duration><voice>${voice}</voice>${extra}</note>`;
const fourQuarters = (extra = '') => [0, 1, 2, 3].map((i) => noteXml('CDEF'.charAt(i), 4, 1, i === 0 ? extra : '')).join('');
const measure = (n: number, body: string) => `<measure number="${n}">${body}</measure>`;
const harmony = (step: string, kind: string, text?: string, extra = '') =>
  `<harmony><root><root-step>${step}</root-step></root><kind${text !== undefined ? ` text="${text}"` : ''}>${kind}</kind>${extra}</harmony>`;

const ok = (xml: string, fileName?: string) => {
  const result = importMusicXml(xml, fileName ? { fileName } : {});
  if (!result.ok) throw new Error(result.report.items.map((i) => i.message).join(' | '));
  return result;
};

describe('importMusicXml: errores', () => {
  it('rechaza XML mal formado con un mensaje claro y sin lanzar', () => {
    const result = importMusicXml('<score-partwise><part>');
    expect(result.ok).toBe(false);
    expect(result.report.items[0]?.severity).toBe('error');
    expect(result.report.items[0]?.message.includes('XML')).toBe(true);
  });

  it('rechaza .mxl comprimidos explicando cómo exportar', () => {
    const result = importMusicXml('PK\u0003\u0004binario');
    expect(result.ok).toBe(false);
    expect(result.report.items[0]?.message.includes('mxl')).toBe(true);
  });

  it('rechaza otros formatos y partituras sin notas', () => {
    expect(importMusicXml('<html/>').ok).toBe(false);
    expect(importMusicXml('<score-timewise/>').ok).toBe(false);
    expect(importMusicXml(wrap('')).ok).toBe(false);
    expect(importMusicXml(wrap(part(measure(1, attrs())))).ok).toBe(false);
  });
});

describe('importMusicXml: metadatos', () => {
  const m1 = measure(1, attrs() + fourQuarters());

  it('ignora el título genérico de MuseScore y usa el nombre de archivo', () => {
    const result = ok(wrap(part(m1), '<work><work-title>Partitura sin título</work-title></work>'), 'Mi_tema_nuevo.musicxml');
    expect(result.score.title).toBe('Mi tema nuevo');
    expect(hasMessage(result, 'info', 'nombre del archivo')).toBe(true);
  });

  it('da prioridad a los metadatos del archivo sobre los créditos', () => {
    const extra =
      '<work><work-title>Mi título de metadatos</work-title></work><identification><creator type="composer">Autor de metadatos</creator></identification>' +
      '<credit page="1"><credit-type>title</credit-type><credit-words>Título del crédito</credit-words></credit>' +
      '<credit page="1"><credit-type>composer</credit-type><credit-words>Autor del crédito</credit-words></credit>';
    const { score } = ok(wrap(part(m1), extra));
    expect(score.title).toBe('Mi título de metadatos');
    expect(score.composer).toBe('Autor de metadatos');
  });

  it('si los metadatos están vacíos o por defecto, los pisan los créditos', () => {
    const extra =
      '<work><work-title></work-title></work><identification><creator type="composer">Compositor / arreglista</creator></identification>' +
      '<credit page="1"><credit-type>title</credit-type><credit-words>Título del crédito</credit-words></credit>' +
      '<credit page="1"><credit-type>composer</credit-type><credit-words>Autor del crédito\n\n</credit-words></credit>';
    const { score } = ok(wrap(part(m1), extra));
    expect(score.title).toBe('Título del crédito');
    expect(score.composer).toBe('Autor del crédito');
  });

  it('si ni los créditos aportan algo útil, usa el nombre de archivo y deja el compositor vacío', () => {
    const extra =
      '<work><work-title>Partitura sin título</work-title></work>' +
      '<credit page="1"><credit-type>title</credit-type><credit-words>Partitura sin título</credit-words></credit>' +
      '<credit page="1"><credit-type>composer</credit-type><credit-words>Compositor / arreglista</credit-words></credit>';
    const { score } = ok(wrap(part(m1), extra), 'Otro_tema.musicxml');
    expect(score.title).toBe('Otro tema');
    expect(score.composer).toBe(undefined);
  });

  it('prefiere el título de los créditos y descarta el compositor genérico', () => {
    const extra =
      '<work><work-title>Partitura sin título</work-title></work><identification><creator type="composer">Compositor / arreglista</creator></identification>' +
      '<credit page="1"><credit-type>title</credit-type><credit-words>Mi canción</credit-words></credit>';
    const result = ok(wrap(part(m1), extra));
    expect(result.score.title).toBe('Mi canción');
    expect(result.score.composer).toBe(undefined);
  });
});

describe('importMusicXml: tonalidad, compás y tempo', () => {
  it('respeta <mode> cuando existe', () => {
    const result = ok(wrap(part(measure(1, attrs({ mode: 'minor' }) + fourQuarters()))));
    expect(result.score.originalKey).toEqual(key(0, 'minor'));
    expect(hasMessage(result, 'info', 'no indica el modo')).toBe(false);
  });

  it('sin modo y sin acordes asume mayor y lo advierte', () => {
    const result = ok(wrap(part(measure(1, attrs({ fifths: 2 }) + fourQuarters()))));
    expect(result.score.originalKey).toEqual(key(2, 'major'));
    expect(hasMessage(result, 'warning', 'afecta a la transposición')).toBe(true);
  });

  it('registra cambios de armadura y de compás solo donde ocurren', () => {
    const second =
      '<attributes><key><fifths>2</fifths></key><time><beats>3</beats><beat-type>4</beat-type></time></attributes>' +
      [0, 1, 2].map(() => noteXml('A', 4, 1)).join('');
    const third = '<attributes><key><fifths>2</fifths></key></attributes>' + [0, 1, 2].map(() => noteXml('B', 4, 1)).join('');
    const { score } = ok(wrap(part(measure(1, attrs() + fourQuarters()) + measure(2, second) + measure(3, third))));
    expect(score.measures[0]?.timeSignature).toBe(undefined);
    expect(score.measures[1]?.timeSignature).toEqual({ beats: 3, beatType: 4 });
    expect(score.measures[1]?.keySignature).toEqual(key(2, 'major'));
    expect(score.measures[2]?.keySignature).toBe(undefined);
    expect(score.measures[2]?.timeSignature).toBe(undefined);
    expect(validateScore(score)).toHaveLength(0);
  });

  it('lee el tempo de <sound> o de <metronome>', () => {
    const withSound = measure(1, attrs() + '<direction><direction-type><words>Allegro</words></direction-type><sound tempo="120"/></direction>' + fourQuarters());
    expect(ok(wrap(part(withSound))).score.tempo).toEqual({ bpm: 120, beatUnit: QUARTER });
    const withMetronome = measure(1, attrs() + '<direction><direction-type><metronome><beat-unit>half</beat-unit><per-minute>60</per-minute></metronome></direction-type></direction>' + fourQuarters());
    expect(ok(wrap(part(withMetronome))).score.tempo).toEqual({ bpm: 60, beatUnit: duration(1, 2) });
  });
});

describe('importMusicXml: acordes, notas y voces', () => {
  it('construye acordes con bajo, posición y sufijo de autor', () => {
    const body =
      attrs() + harmony('C', 'major') + noteXml('C', 4, 1) +
      `<harmony><root><root-step>B</root-step><root-alter>-1</root-alter></root><kind text="maj7">major-seventh</kind><bass><bass-step>A</bass-step></bass></harmony>` +
      noteXml('D', 4, 1) + noteXml('E', 4, 1) + harmony('D', 'minor-seventh', '-7') + noteXml('F', 4, 1);
    const { score } = ok(wrap(part(measure(1, body))));
    const chords = score.measures[0]!.chords;
    expect(chords.map((c) => c.chord.text)).toEqual(['C', 'Bbmaj7/A', 'D-7']);
    expect(chords.map((c) => c.offset)).toEqual([duration(0, 1), duration(1, 4), duration(3, 4)]);
    expect(chords[2]?.chord.quality).toBe('minor7');
  });

  it('ignora un tipo de acorde desconocido avisando, sin perder las notas', () => {
    const { score, report } = ok(wrap(part(measure(1, attrs() + harmony('C', 'tristan') + fourQuarters()))));
    expect(score.measures[0]?.chords).toHaveLength(0);
    expect(score.measures[0]?.elements).toHaveLength(4);
    expect(report.items.some((i) => i.severity === 'warning' && i.message.includes('tristan'))).toBe(true);
  });

  it('marca "continue" cuando una nota cierra y abre ligadura', () => {
    const body =
      attrs({ beats: 3 }) +
      noteXml('G', 4, 1, '<tie type="start"/>') +
      noteXml('G', 4, 1, '<tie type="stop"/><tie type="start"/>') +
      noteXml('G', 4, 1, '<tie type="stop"/>');
    const { score } = ok(wrap(part(measure(1, body))));
    expect(score.measures[0]?.elements.map((e) => (e.type === 'note' ? e.tie : 'rest'))).toEqual(['start', 'continue', 'stop']);
  });

  it('importa solo la voz principal y lo informa', () => {
    const body = attrs() + fourQuarters() + '<backup><duration>4</duration></backup>' + [0, 1, 2, 3].map(() => noteXml('G', 3, 1, '', 2)).join('');
    const { score, report } = ok(wrap(part(measure(1, body))));
    expect(score.measures[0]?.elements).toHaveLength(4);
    expect(report.items.some((i) => i.message.includes('otras voces'))).toBe(true);
    expect(validateScore(score)).toHaveLength(0);
  });

  it('ignora notas de adorno', () => {
    const body = attrs() + `<note><grace/><pitch><step>D</step><octave>5</octave></pitch><voice>1</voice></note>` + fourQuarters();
    const { score, report } = ok(wrap(part(measure(1, body))));
    expect(score.measures[0]?.elements).toHaveLength(4);
    expect(report.items.some((i) => i.message.includes('adorno'))).toBe(true);
  });

  it('importa tresillos con su grupo y su duración exacta', () => {
    const modification = '<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>';
    const mark = (type: string) => `<notations><tuplet type="${type}" bracket="yes"/></notations>`;
    const body =
      attrs({ div: 3 }) +
      noteXml('C', 5, 3) +
      noteXml('D', 5, 1, modification + mark('start')) +
      noteXml('E', 5, 1, modification) +
      noteXml('F', 5, 1, modification + mark('stop')) +
      noteXml('G', 5, 6);
    const { score, report } = ok(wrap(part(measure(1, body))));
    const elements = score.measures[0]!.elements;
    expect(elements).toHaveLength(5);
    expect(elements[1]).toEqual({
      type: 'note',
      pitch: { step: 'D', alter: 0, octave: 5 },
      duration: duration(1, 12),
      tuplet: { actual: 3, normal: 2, start: true },
    });
    expect(elements[2]?.tuplet).toEqual({ actual: 3, normal: 2 });
    expect(elements[3]?.tuplet).toEqual({ actual: 3, normal: 2, stop: true });
    expect(elements[0]?.tuplet).toBe(undefined);
    expect(validateScore(score)).toHaveLength(0);
    expect(report.items.some((i) => i.severity === 'info' && i.message.includes('tresillo'))).toBe(true);
    expect(report.items.some((i) => i.severity === 'warning' && i.message.includes('tresillo'))).toBe(false);
  });

  it('un silencio dentro de un tresillo conserva el grupo', () => {
    const modification = '<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>';
    const restXml = (extra: string) => `<note><rest/><duration>1</duration><voice>1</voice>${extra}</note>`;
    const body =
      attrs({ div: 3 }) +
      restXml(modification + '<notations><tuplet type="start"/></notations>') +
      noteXml('E', 5, 1, modification) +
      noteXml('F', 5, 1, modification + '<notations><tuplet type="stop"/></notations>') +
      noteXml('G', 5, 9);
    const { score } = ok(wrap(part(measure(1, body))));
    expect(score.measures[0]?.elements[0]).toEqual({ type: 'rest', duration: duration(1, 12), tuplet: { actual: 3, normal: 2, start: true } });
  });

  it('importa un compás de silencio completo como un silencio de la duración del compás', () => {
    const first = measure(1, attrs({ beats: 3 }) + [0, 1, 2].map(() => noteXml('C', 4, 1)).join(''));
    const silent = measure(2, '<note><rest measure="yes"/><duration>3</duration><voice>1</voice></note>');
    const { score } = ok(wrap(part(first + silent)));
    expect(score.measures[1]?.elements).toEqual([{ type: 'rest', duration: duration(3, 4) }]);
    expect(validateScore(score)).toHaveLength(0);
  });

  it('con varias partes importa la primera con notas y lo advierte', () => {
    const second = part(measure(1, attrs() + noteXml('A', 3, 4)), 'P2');
    const xml = `<?xml version="1.0"?><score-partwise><part-list><score-part id="P1"><part-name>Voz</part-name></score-part><score-part id="P2"><part-name>Bajo</part-name></score-part></part-list>${part(measure(1, attrs() + fourQuarters()))}${second}</score-partwise>`;
    const { score, report } = ok(xml);
    expect(score.measures[0]?.elements).toHaveLength(4);
    expect(report.items.some((i) => i.severity === 'warning' && i.message.includes('Bajo'))).toBe(true);
  });

  it('avisa de los compases incompletos sin rechazar el archivo', () => {
    const { score, report } = ok(wrap(part(measure(1, attrs() + fourQuarters()) + measure(2, noteXml('C', 4, 2)))));
    expect(score.measures).toHaveLength(2);
    expect(report.items.some((i) => i.severity === 'warning' && i.measure === 2)).toBe(true);
  });
});

describe('importMusicXml: repeticiones, casillas y barras', () => {
  const barline = (location: string, inner: string) => `<barline location="${location}">${inner}</barline>`;
  const section = (n: number, before = '', after = '') => measure(n, (n === 1 ? attrs() : '') + before + fourQuarters() + after);

  it('lee repeticiones, doble barra y barra final', () => {
    const xml = wrap(
      part(
        section(1, barline('left', '<bar-style>heavy-light</bar-style><repeat direction="forward"/>')) +
          section(2, '', barline('right', '<bar-style>light-heavy</bar-style><repeat direction="backward"/>')) +
          section(3, '', barline('right', '<bar-style>light-light</bar-style>')) +
          section(4, '', barline('right', '<bar-style>light-heavy</bar-style>')),
      ),
    );
    const { score } = ok(xml);
    const m = score.measures;
    expect(m[0]?.startRepeat).toBe(true);
    expect(m[1]?.endRepeat).toBe(true);
    expect(m[1]?.endBarline).toBe(undefined);
    expect(m[2]?.endBarline).toBe('double');
    expect(m[3]?.endBarline).toBe('final');
  });

  it('lee casillas con su texto, o con el número si no lo traen', () => {
    const xml = wrap(
      part(
        section(1) +
          section(2, barline('left', '<ending number="1, 2" type="start">1. 2.</ending>'), barline('right', '<ending number="1, 2" type="stop"/><repeat direction="backward"/>')) +
          section(3, barline('left', '<ending number="3" type="start"/>'), barline('right', '<ending number="3" type="discontinue"/>')),
      ),
    );
    const { score, report } = ok(xml);
    expect(score.measures[1]?.endingStart).toEqual({ numbers: [1, 2], label: '1. 2.' });
    expect(score.measures[1]?.endingEnd).toBe('closed');
    expect(score.measures[2]?.endingStart).toEqual({ numbers: [3], label: '3.' });
    expect(score.measures[2]?.endingEnd).toBe('open');
    expect(report.items.some((i) => i.severity === 'warning' && i.message.includes('casilla'))).toBe(false);
  });

  it('conserva las indicaciones de navegación y sintetiza las que solo vienen como atributo de <sound>', () => {
    const words = (text: string) => `<direction><direction-type><words>${text}</words></direction-type></direction>`;
    const xml = wrap(
      part(
        measure(1, attrs() + words('x3') + words('Con fuerza') + fourQuarters()) +
          measure(2, '<direction><sound dacapo="yes"/></direction>' + fourQuarters()),
      ),
    );
    const { score, report } = ok(xml);
    expect(score.measures[0]?.texts).toEqual(['x3']);
    expect(score.measures[1]?.texts).toEqual(['D.C.']);
    expect(report.items.some((i) => i.message.includes('Con fuerza'))).toBe(true);
  });

  it('avisa si una casilla no se cierra', () => {
    const xml = wrap(part(section(1, barline('left', '<ending number="1" type="start">1.</ending>')) + section(2)));
    const { report } = ok(xml);
    expect(report.items.some((i) => i.severity === 'warning' && i.message.includes('casilla'))).toBe(true);
  });
});

describe('importMusicXml: veces de repetición, saltos de línea y numeración', () => {
  const barline = (inner: string) => `<barline location="right">${inner}</barline>`;
  const words = (text: string) => `<direction><direction-type><words>${text}</words></direction-type></direction>`;
  const bar = (n: number, before = '', after = '') => measure(n, (n === 1 ? attrs() : '') + before + fourQuarters() + after);

  it('pasa el "x3" de la sección a la barra de fin de repetición siguiente', () => {
    const xml = wrap(part(bar(1, words('x3')) + bar(2) + bar(3, '', barline('<repeat direction="backward"/>')) + bar(4)));
    const { score } = ok(xml);
    expect(score.measures[0]?.texts).toBe(undefined);
    expect(score.measures[2]?.repeatTimes).toBe(3);
    expect(score.measures[2]?.endRepeat).toBe(true);
  });

  it('lee el atributo "times" de la repetición', () => {
    const xml = wrap(part(bar(1) + bar(2, '', barline('<repeat direction="backward" times="4"/>'))));
    expect(ok(xml).score.measures[1]?.repeatTimes).toBe(4);
  });

  it('si no hay barra de fin que lo reciba, el "x3" queda como texto', () => {
    const xml = wrap(part(bar(1, words('x3')) + bar(2)));
    const { score } = ok(xml);
    expect(score.measures[0]?.texts).toEqual(['x3']);
    expect(score.measures[0]?.repeatTimes).toBe(undefined);
  });

  it('conserva los saltos de línea (new-system y new-page), salvo en el primer compás', () => {
    const print = (attr: string) => `<print ${attr}/>`;
    const xml = wrap(part(bar(1, print('new-system="yes"')) + bar(2) + bar(3, print('new-system="yes"')) + bar(4, print('new-page="yes"'))));
    expect(ok(xml).score.measures.map((m) => m.newSystem === true)).toEqual([false, false, true, true]);
  });

  it('la anacrusa es el compás 0 aunque el archivo la numere 1, y el primer compás completo es el 1', () => {
    const pickup = `<measure number="1">${attrs()}${noteXml('G', 4, 1)}</measure>`;
    const xml = wrap(part(pickup + measure(2, fourQuarters()) + measure(3, fourQuarters())));
    const { score } = ok(xml);
    expect(score.measures.map((m) => m.number)).toEqual([0, 1, 2]);
    expect(score.measures[0]?.pickup).toBe(true);
  });

  it('sin anacrusa la numeración empieza en 1', () => {
    const { score } = ok(wrap(part(bar(1) + bar(2))));
    expect(score.measures.map((m) => m.number)).toEqual([1, 2]);
  });
});

