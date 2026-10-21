import { describe, expect, it } from 'vitest';
import { duration, exampleScore, longExampleScore, measure, note, QUARTER } from '@partituras/core';
import { LAYOUT, ZOOM, barWidth, clampZoom, layoutScore, logicalWidth, scaledSize, splitEvenly } from './layout';

describe('layoutScore', () => {
  it('todos los compases aparecen una sola vez y en orden', () => {
    for (const score of [exampleScore, longExampleScore]) {
      const layout = layoutScore(score, 900);
      const indices = layout.systems.flatMap((s) => s.measures.map((m) => m.index));
      expect(indices).toEqual(score.measures.map((_, i) => i));
    }
  });

  it('los compases de cada línea son contiguos y caben en el ancho', () => {
    const width = 900;
    const layout = layoutScore(longExampleScore, width);
    for (const system of layout.systems) {
      let x: number = LAYOUT.marginX;
      for (const m of system.measures) {
        expect(Math.abs(m.x - x) < 0.001).toBe(true);
        x += m.width;
      }
      expect(x <= width - LAYOUT.marginRight + 0.001).toBe(true);
    }
  });

  it('un ancho menor produce más líneas', () => {
    const wide = layoutScore(longExampleScore, 1600).systems.length;
    const narrow = layoutScore(longExampleScore, 600).systems.length;
    expect(narrow > wide).toBe(true);
    expect(wide > 1).toBe(true);
  });

  it('las líneas, salvo quizá la última, se estiran hasta llenar el ancho', () => {
    const width = 1000;
    const layout = layoutScore(longExampleScore, width);
    layout.systems.slice(0, -1).forEach((system) => {
      const last = system.measures[system.measures.length - 1];
      expect(Math.abs((last?.x ?? 0) + (last?.width ?? 0) - (width - LAYOUT.marginRight)) < 0.001).toBe(true);
    });
  });

  it('cada línea empieza con clave y armadura', () => {
    const layout = layoutScore(longExampleScore, 800);
    for (const system of layout.systems) {
      expect(system.measures[0]?.display.clef).toBe(true);
      expect(system.measures[0]?.display.key !== undefined).toBe(true);
    }
  });

  it('respeta un ancho mínimo y la altura crece con las líneas', () => {
    const tiny = layoutScore(exampleScore, 100);
    expect(tiny.width).toBe(LAYOUT.minWidth);
    const layout = layoutScore(longExampleScore, 700);
    const last = layout.systems[layout.systems.length - 1];
    expect(layout.height).toBe((last?.staveY ?? 0) + LAYOUT.staveHeight + LAYOUT.bottomMargin);
    expect(layout.systems[1]!.staveY - layout.systems[0]!.staveY).toBe(LAYOUT.systemHeight);
  });

  describe('compases por línea fijos', () => {
    const counted = (score: typeof longExampleScore, width: number, perSystem: number) =>
      layoutScore(score, width, { measuresPerSystem: perSystem }).systems.map(
        (system) => system.measures.filter((m) => !score.measures[m.index]?.pickup).length,
      );

    it('con espacio suficiente cada línea lleva exactamente N compases (salvo la última)', () => {
      const perLine = counted(longExampleScore, 1600, 4);
      expect(perLine.slice(0, -1).every((n) => n === 4)).toBe(true);
      expect((perLine[perLine.length - 1] ?? 0) <= 4).toBe(true);
      expect(perLine.reduce((a, b) => a + b, 0)).toBe(32);
    });

    it('la anacrusa no cuenta para el máximo', () => {
      const layout = layoutScore(longExampleScore, 1600, { measuresPerSystem: 4 });
      expect(layout.systems[0]?.measures).toHaveLength(5);
      expect(layout.systems[0]?.measures[0]?.index).toBe(0);
    });

    it('si N compases no entran, la línea lleva menos en vez de desbordar', () => {
      const width = 520;
      const layout = layoutScore(longExampleScore, width, { measuresPerSystem: 8 });
      for (const system of layout.systems) {
        const last = system.measures[system.measures.length - 1];
        expect((last?.x ?? 0) + (last?.width ?? 0) <= width - LAYOUT.marginRight + 0.001).toBe(true);
      }
      expect(counted(longExampleScore, width, 8).every((n) => n < 8)).toBe(true);
    });

    it('las líneas se estiran hasta llenar el ancho', () => {
      const width = 1400;
      const layout = layoutScore(longExampleScore, width, { measuresPerSystem: 4 });
      layout.systems.slice(0, -1).forEach((system) => {
        const last = system.measures[system.measures.length - 1];
        expect(Math.abs((last?.x ?? 0) + (last?.width ?? 0) - (width - LAYOUT.marginRight)) < 0.001).toBe(true);
      });
    });

    it('null equivale al modo automático', () => {
      expect(layoutScore(longExampleScore, 900, { measuresPerSystem: null })).toEqual(
        layoutScore(longExampleScore, 900),
      );
    });
  });

  describe('zoom', () => {
    it('limita el zoom al rango permitido', () => {
      expect(clampZoom(0.1)).toBe(ZOOM.min);
      expect(clampZoom(5)).toBe(ZOOM.max);
      expect(clampZoom(1)).toBe(1);
      expect(clampZoom(Number.NaN)).toBe(ZOOM.default);
    });

    it('achicar el zoom da más ancho lógico y, por tanto, menos líneas', () => {
      expect(logicalWidth(1000, 1)).toBe(1000);
      expect(logicalWidth(1000, 0.5)).toBe(2000);
      const full = layoutScore(longExampleScore, logicalWidth(1000, 1)).systems.length;
      const small = layoutScore(longExampleScore, logicalWidth(1000, 0.5)).systems.length;
      expect(small < full).toBe(true);
    });

    it('el tamaño en pantalla del SVG es el lógico por el zoom', () => {
      const layout = layoutScore(longExampleScore, 1200);
      const size = scaledSize(layout, 0.5);
      expect(size.width).toBe(Math.round(layout.width * 0.5));
      expect(size.height).toBe(Math.round(layout.height * 0.5));
    });
  });

  describe('barras especiales', () => {
    const plain = measure(1, [note('C', 4, QUARTER)]);
    it('las repeticiones y barras especiales piden ancho extra', () => {
      expect(barWidth(plain)).toBe(0);
      expect(barWidth(measure(1, [], { startRepeat: true }))).toBe(LAYOUT.repeatBarWidth);
      expect(barWidth(measure(1, [], { startRepeat: true, endRepeat: true }))).toBe(2 * LAYOUT.repeatBarWidth);
      expect(barWidth(measure(1, [], { endBarline: 'double' }))).toBe(LAYOUT.doubleBarWidth);
      expect(barWidth(measure(1, [], { endBarline: 'final' }))).toBe(LAYOUT.finalBarWidth);
      expect(barWidth(undefined)).toBe(0);
    });
  });

  describe('saltos de línea del archivo', () => {
    const bars = (flags: boolean[]) =>
      flags.map((newSystem, i) =>
        measure(i + 1, [note('C', 4, QUARTER), note('D', 4, QUARTER), note('E', 4, QUARTER), note('F', 4, QUARTER)], newSystem ? { newSystem } : {}),
      );
    const withBreaks = { ...longExampleScore, measures: bars([false, false, false, true, false, true, false, false, false, false]) };
    const lines = (score: typeof withBreaks, width: number, mode: 'file' | number | null) =>
      layoutScore(score, width, { measuresPerSystem: mode }).systems.map((s) => s.measures.map((m) => m.index));

    it('respeta los saltos del archivo cuando entran', () => {
      expect(lines(withBreaks, 1600, 'file')).toEqual([[0, 1, 2], [3, 4], [5, 6, 7, 8, 9]]);
    });

    it('si una línea del archivo no cabe, la parte en vez de desbordar', () => {
      const result = lines(withBreaks, 520, 'file');
      expect(result.length > 3).toBe(true);
      expect(result.flat()).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      // los saltos del archivo siguen siendo inicio de línea
      expect(result.some((line) => line[0] === 3)).toBe(true);
      expect(result.some((line) => line[0] === 5)).toBe(true);
    });

    it('sin saltos en el archivo usa 4 compases por línea', () => {
      const plainScore = { ...longExampleScore, measures: bars(new Array(9).fill(false)) };
      expect(lines(plainScore, 1600, 'file')).toEqual(lines(plainScore, 1600, 4));
    });

    it('un número fijo o el modo automático ignoran los saltos del archivo', () => {
      expect(lines(withBreaks, 1600, 2).every((line) => line.length <= 2)).toBe(true);
      expect(lines(withBreaks, 1600, null).length < lines(withBreaks, 1600, 2).length).toBe(true);
    });
  });

  describe('líneas del archivo que no entran', () => {
    const dense = (count: number, breakAt: number) =>
      Array.from({ length: count }, (_, i) =>
        measure(i + 1, Array.from({ length: 8 }, () => note('C', 4, duration(1, 8))), i === breakAt ? { newSystem: true } : {}),
      );

    it('parte una línea larga en partes parejas, sin dejar compases huérfanos', () => {
      // el archivo tiene una línea de 7 compases y otra de 2; la de 7 no cabe en este ancho
      const score = { ...longExampleScore, measures: dense(9, 7) };
      const lines = layoutScore(score, 1100, { measuresPerSystem: 'file' }).systems.map((s) => s.measures.map((m) => m.index));
      expect(lines.flat()).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
      // el salto del archivo se conserva: el compás 7 empieza línea
      expect(lines.some((line) => line[0] === 7)).toBe(true);
      // las partes de la línea larga son parejas (nada de 3 + 3 + 1)
      const parts = lines.filter((line) => line.every((i) => i < 7));
      expect(parts.length >= 3).toBe(true);
      expect(Math.min(...parts.map((p) => p.length)) >= 2).toBe(true);
      expect(Math.max(...parts.map((p) => p.length)) - Math.min(...parts.map((p) => p.length)) <= 1).toBe(true);
    });

    it('splitEvenly reparte de forma pareja y no parte lo que ya entra', () => {
      const width = (indices: readonly number[]) => indices.length * 100;
      expect(splitEvenly([0, 1, 2], width, 400)).toEqual([[0, 1, 2]]);
      const seven = splitEvenly([0, 1, 2, 3, 4, 5, 6], width, 350).map((p) => p.length);
      expect(seven.reduce((a, b) => a + b, 0)).toBe(7);
      expect(seven).toHaveLength(3);
      expect(Math.max(...seven) - Math.min(...seven) <= 1).toBe(true);
      expect(splitEvenly([0, 1, 2, 3, 4, 5], width, 300).map((p) => p.length)).toEqual([3, 3]);
      expect(splitEvenly([0, 1], width, 50)).toEqual([[0], [1]]);
    });
  });

  it('el espacio libre entre un sistema y el siguiente es al menos un 50 % mayor que antes', () => {
    // antes: 126 px de una primera línea a la siguiente, con un pentagrama de 40 px → 86 px libres
    const before = 126 - 40;
    expect(LAYOUT.systemHeight - LAYOUT.staveHeight >= before * 1.5).toBe(true);
  });

  describe('pantallas angostas y zoom alto', () => {
    const contentRight = (width: number, mode: 'file' | number | null) => {
      const layout = layoutScore(longExampleScore, width, { measuresPerSystem: mode });
      return layout.systems
        .filter((system) => system.measures.length > 1)
        .map((system) => {
          const last = system.measures[system.measures.length - 1];
          return (last?.x ?? 0) + (last?.width ?? 0);
        });
    };

    it('el dibujo se adapta al ancho real y no se sale del contenedor', () => {
      for (const width of [260, 320, 360, 480]) {
        for (const mode of ['file', 4, null] as const) {
          expect(contentRight(width, mode).every((right) => right <= width - LAYOUT.marginRight + 0.001)).toBe(true);
        }
        expect(layoutScore(longExampleScore, width).width).toBe(width);
      }
    });

    it('con poco ancho entran menos compases por línea en vez de desbordar', () => {
      const perLine = (width: number) => layoutScore(longExampleScore, width, { measuresPerSystem: 4 }).systems[1]?.measures.length ?? 0;
      expect(perLine(320) < perLine(1100)).toBe(true);
    });

    it('el margen inferior deja lugar a las notas y a la clave 8vb', () => {
      expect(LAYOUT.bottomMargin >= 30).toBe(true);
    });
  });
});
