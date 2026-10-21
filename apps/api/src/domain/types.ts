import type { Key, Mode, Score, ScoreWriteResponse } from '@partituras/core';

export type SourceKind = 'builtin' | 'musicxml' | 'manual';

/** Origen que llega al guardar. `musicXml` es el archivo original, para poder reimportarlo con un importador mejorado. */
export interface SourceInput {
  readonly kind: SourceKind;
  readonly fileName?: string;
  readonly musicXml?: string;
}

/** Campos derivados de la partitura que se guardan aparte para poder buscar y filtrar sin leer toda la partitura. */
export interface ScoreIndexFields {
  readonly title: string;
  readonly composer?: string;
  readonly style?: string;
  readonly originalKey: Key;
  /** Título, autor y estilo sin mayúsculas ni tildes. */
  readonly titleSearch: string;
  readonly composerSearch: string;
  readonly styleKey: string;
  readonly measureCount: number;
  readonly hasLyrics: boolean;
  readonly schemaVersion: number;
}

export interface ScoreRecordInput extends ScoreIndexFields {
  /** null mientras no haya usuarios; después, el id del dueño. */
  readonly ownerId: string | null;
  readonly source: SourceInput;
  readonly score: Score;
}

export interface StoredSource {
  readonly kind: SourceKind;
  readonly fileName?: string;
  readonly hasMusicXml: boolean;
  readonly importedAt?: Date;
}

export interface ScoreRecord extends ScoreIndexFields {
  readonly id: string;
  readonly ownerId: string | null;
  readonly source: StoredSource;
  readonly score: Score;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ScoreSummaryRecord extends ScoreIndexFields {
  readonly id: string;
  readonly sourceKind: SourceKind;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ListFilter {
  /** Texto buscado (ya normalizado) en título o autor. */
  readonly q?: string;
  readonly styleKey?: string;
  readonly keyFifths?: number;
  readonly keyMode?: Mode;
  readonly limit: number;
  readonly skip: number;
}

export interface ListQuery {
  readonly q?: string;
  readonly style?: string;
  readonly keyFifths?: number;
  readonly keyMode?: Mode;
  readonly limit?: number;
  readonly skip?: number;
}

/** Quién hace la petición. Hoy siempre es "nadie" (sin usuarios); mañana saldrá de la autenticación. */
export interface RequestContext {
  readonly ownerId: string | null;
}

// ---- lo que ve el cliente (JSON): el contrato vive en el core, compartido con el frontend ----

export type { ScoreDocumentView, ScoreSummaryView } from '@partituras/core';
export type WriteResult = ScoreWriteResponse;
