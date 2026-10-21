import type { ScoreFacets } from '@partituras/core';
import type { ListFilter, ScoreRecord, ScoreRecordInput, ScoreSummaryRecord, SourceInput } from './types';

/** Al reemplazar, si no llega `source` se conserva el que ya estaba (incluido el XML original). */
export type ScoreReplaceInput = Omit<ScoreRecordInput, 'source'> & { readonly source?: SourceInput };

/**
 * Almacenamiento de partituras. Hay una versión en memoria (pruebas y desarrollo) y otra con MongoDB.
 * Todas las operaciones están acotadas a un dueño (`ownerId`, hoy siempre null).
 */
export interface ScoreRepository {
  create(input: ScoreRecordInput): Promise<ScoreRecord>;
  findById(id: string, ownerId: string | null): Promise<ScoreRecord | null>;
  /** El archivo MusicXML original, si se guardó. */
  findMusicXml(id: string, ownerId: string | null): Promise<string | null>;
  list(filter: ListFilter, ownerId: string | null): Promise<{ items: ScoreSummaryRecord[]; total: number }>;
  /** Estilos y tonalidades que hay en la biblioteca, para armar los filtros. */
  facets(ownerId: string | null): Promise<ScoreFacets>;
  replace(id: string, ownerId: string | null, input: ScoreReplaceInput): Promise<ScoreRecord | null>;
  remove(id: string, ownerId: string | null): Promise<boolean>;
  close(): Promise<void>;
}
