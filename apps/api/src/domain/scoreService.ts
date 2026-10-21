import { type Score, type ScoreFacets, parseScore, validateScore } from '@partituras/core';
import { badRequest, notFound, validationError } from './errors';
import { deriveIndexFields, normalizeForSearch } from './normalize';
import type { ScoreRepository } from './repository';
import type {
  ListFilter,
  ListQuery,
  RequestContext,
  ScoreDocumentView,
  ScoreRecord,
  ScoreSummaryRecord,
  ScoreSummaryView,
  SourceInput,
  SourceKind,
  WriteResult,
} from './types';

export const LIMITS = { maxXmlChars: 15_000_000, defaultPageSize: 50, maxPageSize: 100, maxQueryChars: 100 } as const;

const OBJECT_ID = /^[0-9a-f]{24}$/;
const SOURCE_KINDS: readonly SourceKind[] = ['builtin', 'musicxml', 'manual'];

function assertId(id: string): void {
  if (!OBJECT_ID.test(id)) throw badRequest('El identificador de la partitura no es válido.');
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Valida el cuerpo de crear/reemplazar: `{ score, source? }`. */
function parseBody(body: unknown): { score: Score; source?: SourceInput } {
  if (!isObject(body)) throw validationError('El cuerpo debe ser un objeto JSON.', ['body: debe ser un objeto']);

  const parsed = parseScore(body.score);
  if (!parsed.ok) throw validationError('La partitura no es válida.', parsed.errors);

  let source: SourceInput | undefined;
  if (body.source !== undefined) {
    if (!isObject(body.source)) throw validationError('El origen no es válido.', ['source: debe ser un objeto']);
    const { kind, fileName, musicXml } = body.source;
    const errors: string[] = [];
    if (typeof kind !== 'string' || !(SOURCE_KINDS as readonly string[]).includes(kind)) {
      errors.push(`source.kind: debe ser uno de: ${SOURCE_KINDS.join(', ')}`);
    }
    if (fileName !== undefined && (typeof fileName !== 'string' || fileName.length > 255)) {
      errors.push('source.fileName: debe ser un texto de hasta 255 caracteres');
    }
    if (musicXml !== undefined && (typeof musicXml !== 'string' || musicXml.trim() === '' || musicXml.length > LIMITS.maxXmlChars)) {
      errors.push(`source.musicXml: debe ser un texto no vacío de hasta ${LIMITS.maxXmlChars} caracteres`);
    }
    if (errors.length > 0) throw validationError('El origen no es válido.', errors);
    source = {
      kind: kind as SourceKind,
      ...(typeof fileName === 'string' && fileName ? { fileName } : {}),
      ...(typeof musicXml === 'string' ? { musicXml } : {}),
    };
  }
  return { score: parsed.score, ...(source ? { source } : {}) };
}

function toDocumentView(record: ScoreRecord): ScoreDocumentView {
  const { source } = record;
  return {
    id: record.id,
    ownerId: record.ownerId,
    title: record.title,
    ...(record.composer ? { composer: record.composer } : {}),
    ...(record.style ? { style: record.style } : {}),
    originalKey: record.originalKey,
    measureCount: record.measureCount,
    hasLyrics: record.hasLyrics,
    schemaVersion: record.schemaVersion,
    source: {
      kind: source.kind,
      ...(source.fileName ? { fileName: source.fileName } : {}),
      hasMusicXml: source.hasMusicXml,
      ...(source.importedAt ? { importedAt: source.importedAt.toISOString() } : {}),
    },
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    score: record.score,
  };
}

function toSummaryView(record: ScoreSummaryRecord): ScoreSummaryView {
  return {
    id: record.id,
    title: record.title,
    ...(record.composer ? { composer: record.composer } : {}),
    ...(record.style ? { style: record.style } : {}),
    originalKey: record.originalKey,
    measureCount: record.measureCount,
    hasLyrics: record.hasLyrics,
    sourceKind: record.sourceKind,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toFilter(query: ListQuery): ListFilter {
  const q = query.q ? normalizeForSearch(query.q.slice(0, LIMITS.maxQueryChars)) : '';
  const style = query.style ? normalizeForSearch(query.style.slice(0, LIMITS.maxQueryChars)) : '';
  const limit = Math.min(Math.max(query.limit ?? LIMITS.defaultPageSize, 1), LIMITS.maxPageSize);
  return {
    ...(q ? { q } : {}),
    ...(style ? { styleKey: style } : {}),
    ...(query.keyFifths !== undefined ? { keyFifths: query.keyFifths } : {}),
    ...(query.keyMode ? { keyMode: query.keyMode } : {}),
    limit,
    skip: Math.max(query.skip ?? 0, 0),
  };
}

/**
 * Casos de uso sobre partituras. Valida todo lo que entra, deriva los campos de búsqueda y no depende
 * de HTTP ni de MongoDB.
 */
export class ScoreService {
  constructor(private readonly repository: ScoreRepository) {}

  async create(body: unknown, ctx: RequestContext): Promise<WriteResult> {
    const { score, source } = parseBody(body);
    const record = await this.repository.create({
      ownerId: ctx.ownerId,
      ...deriveIndexFields(score),
      source: source ?? { kind: score.metadata.source.kind, ...(score.metadata.source.fileName ? { fileName: score.metadata.source.fileName } : {}) },
      score,
    });
    return { document: toDocumentView(record), warnings: validateScore(score) };
  }

  async list(query: ListQuery, ctx: RequestContext): Promise<{ items: ScoreSummaryView[]; total: number; limit: number; skip: number }> {
    const filter = toFilter(query);
    const { items, total } = await this.repository.list(filter, ctx.ownerId);
    return { items: items.map(toSummaryView), total, limit: filter.limit, skip: filter.skip };
  }

  /** Estilos (por nombre) y tonalidades (por modo y armadura) disponibles para filtrar. */
  async facets(ctx: RequestContext): Promise<ScoreFacets> {
    const { styles, keys } = await this.repository.facets(ctx.ownerId);
    return {
      styles: [...styles].sort((a, b) => a.name.localeCompare(b.name, 'es')),
      keys: [...keys].sort((a, b) => a.mode.localeCompare(b.mode) || a.fifths - b.fifths),
    };
  }

  async get(id: string, ctx: RequestContext): Promise<ScoreDocumentView> {
    assertId(id);
    const record = await this.repository.findById(id, ctx.ownerId);
    if (!record) throw notFound();
    return toDocumentView(record);
  }

  async getMusicXml(id: string, ctx: RequestContext): Promise<string> {
    assertId(id);
    const xml = await this.repository.findMusicXml(id, ctx.ownerId);
    if (xml === null) throw notFound('La partitura no existe o no tiene el archivo MusicXML original.');
    return xml;
  }

  async replace(id: string, body: unknown, ctx: RequestContext): Promise<WriteResult> {
    assertId(id);
    const { score, source } = parseBody(body);
    const record = await this.repository.replace(id, ctx.ownerId, {
      ownerId: ctx.ownerId,
      ...deriveIndexFields(score),
      ...(source ? { source } : {}),
      score,
    });
    if (!record) throw notFound();
    return { document: toDocumentView(record), warnings: validateScore(score) };
  }

  async remove(id: string, ctx: RequestContext): Promise<void> {
    assertId(id);
    if (!(await this.repository.remove(id, ctx.ownerId))) throw notFound();
  }
}
