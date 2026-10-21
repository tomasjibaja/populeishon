import type { Measure, Score } from '@partituras/core';
import { type MeasureDisplay, measureDisplay, measureHeaders } from './display';

/**
 * Reparto de los compases en sistemas (líneas) según el ancho disponible.
 * Función pura: el mismo modelo, ancho y opciones producen siempre el mismo layout.
 * Todas las medidas son "lógicas": el zoom se aplica después, al escalar el SVG.
 */

export const LAYOUT = {
  /** Márgenes mínimos dentro del dibujo; el margen visible (20 px a los lados, 20 arriba y 50 abajo) lo da el contenedor. */
  marginX: 2,
  /** A la derecha de la última barra se dibuja, chico, el número de compás: sale del dibujo hacia el margen del contenedor. */
  marginRight: 2,
  /**
   * Ancho lógico mínimo de dibujo. Es bajo a propósito: si fuera mayor que el ancho real (pantallas angostas o zoom alto),
   * el dibujo se saldría del contenedor y perdería los márgenes. Solo una línea con un único compás muy denso puede excederlo.
   */
  minWidth: 200,
  /** Distancia entre un sistema y el siguiente (primera línea a primera línea). */
  systemHeight: 170,
  /** Altura de las cinco líneas del pentagrama. */
  staveHeight: 40,
  /** Distancia desde el tope del sistema hasta la primera línea del pentagrama (deja sitio al cifrado). */
  staveTop: 64,
  /** Espacio bajo el último pentagrama (notas con líneas adicionales, clave 8vb). */
  bottomMargin: 30,
  /** Ancho mínimo y por elemento del contenido musical de un compás. */
  minContentWidth: 80,
  baseContentWidth: 30,
  widthPerElement: 36,
  clefWidth: 40,
  accidentalWidth: 12,
  timeWidth: 34,
  /** Espacio extra por barras de repetición, dobles o finales. */
  repeatBarWidth: 14,
  doubleBarWidth: 8,
  finalBarWidth: 8,
  headerPadding: 10,
  /** Si el último sistema ocupa menos de esta fracción del ancho, no se estira. */
  lastSystemStretchRatio: 0.6,
  /** Con "compases por línea" fijo, el contenido puede comprimirse hasta esta fracción. */
  fixedModeMinScale: 0.7,
  /** Con los saltos del archivo, una línea se comprime como mucho hasta esta fracción; si no, se parte en partes parejas. */
  fileModeMinScale: 0.85,
} as const;

export const ZOOM = { min: 0.5, max: 1.3, step: 0.05, default: 0.85 } as const;

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return ZOOM.default;
  return Math.min(ZOOM.max, Math.max(ZOOM.min, zoom));
}

/** Ancho lógico de dibujo que, al escalarse por `zoom`, ocupa todo el ancho del contenedor. */
export function logicalWidth(containerWidth: number, zoom: number): number {
  return Math.floor(containerWidth / clampZoom(zoom));
}

/**
 * Cómo repartir los compases en líneas:
 * - número: como máximo ese número de compases por línea (la anacrusa no cuenta);
 * - 'file': los saltos de línea que trae el archivo (si no trae ninguno, 4 por línea);
 * - null/ausente: los que entren.
 * En todos los casos, si una línea no cabe en el ancho se parte.
 */
export type LineBreakMode = number | 'file' | null;

export interface LayoutOptions {
  readonly measuresPerSystem?: LineBreakMode;
}

export interface PlacedMeasure {
  /** Índice del compás en `score.measures`. */
  readonly index: number;
  readonly x: number;
  /** Ancho total del pentagrama de este compás, incluidos clave/armadura/compás. */
  readonly width: number;
  readonly display: MeasureDisplay;
}

export interface SystemLayout {
  /** Coordenada y de la primera línea del pentagrama. */
  readonly staveY: number;
  readonly measures: readonly PlacedMeasure[];
}

export interface ScoreLayout {
  readonly systems: readonly SystemLayout[];
  readonly width: number;
  readonly height: number;
}

/** Tamaño en píxeles de pantalla del SVG ya escalado por el zoom. */
export function scaledSize(layout: ScoreLayout, zoom: number): { width: number; height: number } {
  const z = clampZoom(zoom);
  return { width: Math.round(layout.width * z), height: Math.round(layout.height * z) };
}

export function headerWidth(display: MeasureDisplay): number {
  let width = 0;
  if (display.clef) width += LAYOUT.clefWidth;
  if (display.key) {
    width += display.key.accidentals * LAYOUT.accidentalWidth + (display.key.accidentals > 0 ? 8 : 0);
  }
  if (display.time) width += LAYOUT.timeWidth;
  return width > 0 ? width + LAYOUT.headerPadding : 0;
}

/** Ancho fijo extra que piden las barras especiales de un compás. */
export function barWidth(measure: Measure | undefined): number {
  if (!measure) return 0;
  let width = 0;
  if (measure.startRepeat) width += LAYOUT.repeatBarWidth;
  if (measure.endRepeat) width += LAYOUT.repeatBarWidth;
  else if (measure.endBarline === 'double') width += LAYOUT.doubleBarWidth;
  else if (measure.endBarline === 'final') width += LAYOUT.finalBarWidth;
  return width;
}

/**
 * Parte una línea que no entra en `inner` en la menor cantidad de partes consecutivas y de ancho parejo
 * (por ejemplo 7 compases → 3 + 2 + 2). Si una línea ya entra, la devuelve entera.
 */
export function splitEvenly(
  indices: readonly number[],
  lineWidth: (indices: readonly number[]) => number,
  inner: number,
): number[][] {
  if (indices.length <= 1 || lineWidth(indices) <= inner) return [[...indices]];

  for (let parts = 2; parts <= indices.length; parts++) {
    // Se corta donde la suma acumulada queda más cerca de cada múltiplo del ancho total / partes.
    const prefix = [0];
    indices.forEach((measureIndex, position) => {
      prefix.push((prefix[position] ?? 0) + lineWidth([measureIndex]));
    });
    const total = prefix[indices.length] ?? 0;

    const cuts = [0];
    for (let part = 1; part < parts; part++) {
      const target = (total * part) / parts;
      const from = (cuts[part - 1] ?? 0) + 1;
      const to = indices.length - (parts - part);
      let best = from;
      for (let cut = from; cut <= to; cut++) {
        if (Math.abs((prefix[cut] ?? 0) - target) < Math.abs((prefix[best] ?? 0) - target)) best = cut;
      }
      cuts.push(best);
    }
    cuts.push(indices.length);

    const result = cuts.slice(1).map((end, k) => indices.slice(cuts[k] ?? 0, end));
    if (result.every((line) => lineWidth(line) <= inner)) return result;
  }
  return indices.map((i) => [i]);
}

export function layoutScore(score: Score, availableWidth: number, options: LayoutOptions = {}): ScoreLayout {
  const mode = options.measuresPerSystem;
  const hasFileBreaks = score.measures.some((m, i) => i > 0 && m.newSystem);
  const useFileBreaks = mode === 'file' && hasFileBreaks;
  const perSystem =
    typeof mode === 'number' && mode > 0 ? Math.floor(mode) : mode === 'file' && !hasFileBreaks ? 4 : null;
  const minScale = useFileBreaks ? LAYOUT.fileModeMinScale : perSystem === null ? 1 : LAYOUT.fixedModeMinScale;

  const totalWidth = Math.max(availableWidth, LAYOUT.minWidth);
  const inner = totalWidth - LAYOUT.marginX - LAYOUT.marginRight;
  const headers = measureHeaders(score);

  const contentWidths = score.measures.map((m) =>
    Math.max(LAYOUT.minContentWidth, LAYOUT.baseContentWidth + LAYOUT.widthPerElement * m.elements.length),
  );

  const fixedWidth = (i: number, asStart: boolean): number => {
    const header = headers[i];
    return (header ? headerWidth(measureDisplay(header, asStart)) : 0) + barWidth(score.measures[i]);
  };
  const unit = (i: number, asStart: boolean): number =>
    fixedWidth(i, asStart) + (contentWidths[i] ?? LAYOUT.minContentWidth) * minScale;
  /** Ancho de una línea formada por estos compases, con el contenido comprimido al mínimo permitido. */
  const lineWidth = (indices: readonly number[]): number =>
    indices.reduce((sum, i, position) => sum + unit(i, position === 0), 0);

  // 1. Reparto de compases en líneas.
  const groups: number[][] = [];

  if (useFileBreaks) {
    // Se respetan los saltos del archivo. Si una línea no entra en el ancho, se parte en partes
    // parejas (3+3, no 5+1) para no dejar líneas huérfanas estiradas a todo el ancho.
    const original: number[][] = [];
    score.measures.forEach((m, i) => {
      const last = original[original.length - 1];
      if (!last || m.newSystem === true) original.push([i]);
      else last.push(i);
    });
    for (const line of original) groups.push(...splitEvenly(line, lineWidth, inner));
  } else {
    // Corte voraz: se agregan compases a la línea mientras entren (y no superen el máximo pedido).
    let current: number[] = [];
    let used = 0;
    let counted = 0;
    score.measures.forEach((m, i) => {
      const counts = m.pickup ? 0 : 1;
      if (current.length === 0) {
        current = [i];
        used = unit(i, true);
        counted = counts;
      } else if (used + unit(i, false) > inner || (perSystem !== null && counted + counts > perSystem)) {
        groups.push(current);
        current = [i];
        used = unit(i, true);
        counted = counts;
      } else {
        current.push(i);
        used += unit(i, false);
        counted += counts;
      }
    });
    if (current.length > 0) groups.push(current);
  }

  // 2. Cada línea se ajusta (solo el contenido, no las claves) para llenar el ancho.
  const systems: SystemLayout[] = groups.map((indices, systemIndex) => {
    const displays = indices.map((measureIndex, position) => {
      const header = headers[measureIndex];
      return header ? measureDisplay(header, position === 0) : { clef: position === 0 };
    });
    const headerWidths = displays.map((display, position) => headerWidth(display) + barWidth(score.measures[indices[position] ?? -1]));
    const contents = indices.map((measureIndex) => contentWidths[measureIndex] ?? LAYOUT.minContentWidth);
    const sumHeaders = headerWidths.reduce((a, b) => a + b, 0);
    const sumContents = contents.reduce((a, b) => a + b, 0);

    const isLast = systemIndex === groups.length - 1;
    const natural = sumHeaders + sumContents;
    const stretch = !isLast || natural >= LAYOUT.lastSystemStretchRatio * inner;
    const scale = stretch ? Math.max(minScale, (inner - sumHeaders) / sumContents) : 1;

    let x: number = LAYOUT.marginX;
    const measures: PlacedMeasure[] = indices.map((measureIndex, position) => {
      const width = (headerWidths[position] ?? 0) + (contents[position] ?? 0) * scale;
      const placed = { index: measureIndex, x, width, display: displays[position] ?? { clef: false } };
      x += width;
      return placed;
    });

    return { staveY: systemIndex * LAYOUT.systemHeight + LAYOUT.staveTop, measures };
  });

  return {
    systems,
    width: totalWidth,
    height: (systems[systems.length - 1]?.staveY ?? LAYOUT.staveTop) + LAYOUT.staveHeight + LAYOUT.bottomMargin,
  };
}
