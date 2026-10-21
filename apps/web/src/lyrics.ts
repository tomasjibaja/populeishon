import type { Score } from '@partituras/core';

/** Máximo de caracteres de la letra (el mismo que valida el servidor). */
export const MAX_LYRICS_LENGTH = 20000;

/**
 * Texto de la letra tal como se guarda: saltos de línea "\n" (se aceptan también los de Windows y Mac), sin espacios
 * sobrantes al final de cada línea ni líneas en blanco al principio o al final. Vacío = sin letra (undefined).
 */
export function normalizeLyrics(text: string): string | undefined {
  const cleaned = text
    .replace(/\u0000/g, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .join('\n')
    .replace(/^\n+|\n+$/g, '');
  return cleaned === '' ? undefined : cleaned.slice(0, MAX_LYRICS_LENGTH);
}

/** La partitura con otra letra (o sin letra si es undefined). No modifica la original. */
export function withLyrics(score: Score, lyrics: string | undefined): Score {
  const { lyrics: _previous, ...rest } = score;
  return lyrics === undefined ? rest : { ...rest, lyrics };
}

/**
 * Cuántas columnas usar para mostrar la letra: en pantallas anchas, dos si la letra en una sola columna
 * no entra en el alto disponible de la pantalla; en pantallas angostas (celular), siempre una.
 *
 * @param contentHeight alto de la letra en una sola columna
 * @param chrome        alto que ocupan la barra, el encabezado y los botones (no es para la letra)
 */
export function lyricsColumns(contentHeight: number, viewportHeight: number, viewportWidth: number, chrome: number): 1 | 2 {
  if (viewportWidth <= 640) return 1;
  return contentHeight > Math.max(viewportHeight - chrome, 0) ? 2 : 1;
}
