import type { Key, Mode } from '../model/key';
import type { Score, ScoreSource } from '../model/score';
import type { ValidationIssue } from '../validation/validateScore';

/** Contrato de la API REST, compartido por el frontend y el backend. */

export interface ScoreSourceView {
  readonly kind: ScoreSource['kind'];
  readonly fileName?: string;
  /** Si se guardó el MusicXML original (se descarga aparte). */
  readonly hasMusicXml: boolean;
  readonly importedAt?: string;
}

export interface ScoreDocumentView {
  readonly id: string;
  readonly ownerId: string | null;
  readonly title: string;
  readonly composer?: string;
  readonly style?: string;
  readonly originalKey: Key;
  readonly measureCount: number;
  readonly hasLyrics: boolean;
  readonly schemaVersion: number;
  readonly source: ScoreSourceView;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly score: Score;
}

export interface ScoreSummaryView {
  readonly id: string;
  readonly title: string;
  readonly composer?: string;
  readonly style?: string;
  readonly originalKey: Key;
  readonly measureCount: number;
  readonly hasLyrics: boolean;
  readonly sourceKind: ScoreSource['kind'];
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Estilo que existe en la biblioteca, con cuántas partituras lo tienen. `styleKey` es el valor para filtrar. */
export interface StyleFacet {
  readonly name: string;
  readonly styleKey: string;
  readonly count: number;
}

/** Tonalidad que existe en la biblioteca, con cuántas partituras la tienen. */
export interface KeyFacet {
  readonly fifths: number;
  readonly mode: Mode;
  readonly count: number;
}

/** Valores disponibles para los filtros de la biblioteca. */
export interface ScoreFacets {
  readonly styles: readonly StyleFacet[];
  readonly keys: readonly KeyFacet[];
}

export interface ScoreListResponse {
  readonly items: readonly ScoreSummaryView[];
  readonly total: number;
  readonly limit: number;
  readonly skip: number;
}

export interface ScoreWriteResponse {
  readonly document: ScoreDocumentView;
  /** Problemas musicales (compases incompletos…): no impiden guardar. */
  readonly warnings: readonly ValidationIssue[];
}

/** Cuerpo de crear o reemplazar una partitura. `musicXml` es el archivo original. */
export interface ScoreSaveInput {
  readonly score: Score;
  readonly source?: {
    readonly kind: ScoreSource['kind'];
    readonly fileName?: string;
    readonly musicXml?: string;
  };
}
