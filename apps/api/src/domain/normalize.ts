import type { Score } from '@partituras/core';
import type { ScoreIndexFields } from './types';

/** Minúsculas, sin tildes y con espacios simples: así "Fortunato Juárez" se encuentra buscando "juarez". */
export function normalizeForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Campos de búsqueda y resumen que se guardan junto a la partitura; siempre se recalculan desde ella. */
export function deriveIndexFields(score: Score): ScoreIndexFields {
  return {
    title: score.title,
    ...(score.composer ? { composer: score.composer } : {}),
    ...(score.style ? { style: score.style } : {}),
    originalKey: score.originalKey,
    titleSearch: normalizeForSearch(score.title),
    composerSearch: normalizeForSearch(score.composer ?? ''),
    styleKey: normalizeForSearch(score.style ?? ''),
    measureCount: score.measures.length,
    hasLyrics: Boolean(score.lyrics),
    schemaVersion: score.schemaVersion,
  };
}
