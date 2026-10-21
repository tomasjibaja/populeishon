import { randomBytes } from 'node:crypto';
import type { KeyFacet, ScoreFacets, StyleFacet } from '@partituras/core';
import type { ScoreReplaceInput, ScoreRepository } from '../domain/repository';
import type { ListFilter, ScoreRecord, ScoreRecordInput, ScoreSummaryRecord, SourceInput, StoredSource } from '../domain/types';

interface Row {
  record: ScoreRecord;
  musicXml?: string;
}

function toStoredSource(source: SourceInput, importedAt: Date): StoredSource {
  return {
    kind: source.kind,
    ...(source.fileName ? { fileName: source.fileName } : {}),
    hasMusicXml: source.musicXml !== undefined,
    ...(source.musicXml !== undefined || source.kind === 'musicxml' ? { importedAt } : {}),
  };
}

/** Almacenamiento en memoria: sirve para las pruebas y para probar la API sin base de datos. Se pierde al reiniciar. */
export class MemoryScoreRepository implements ScoreRepository {
  private readonly rows = new Map<string, Row>();

  async create(input: ScoreRecordInput): Promise<ScoreRecord> {
    const now = new Date();
    const { source, ...rest } = input;
    const record: ScoreRecord = {
      ...rest,
      id: randomBytes(12).toString('hex'),
      source: toStoredSource(source, now),
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(record.id, { record, ...(source.musicXml !== undefined ? { musicXml: source.musicXml } : {}) });
    return structuredClone(record);
  }

  async findById(id: string, ownerId: string | null): Promise<ScoreRecord | null> {
    const row = this.rows.get(id);
    return row && row.record.ownerId === ownerId ? structuredClone(row.record) : null;
  }

  async findMusicXml(id: string, ownerId: string | null): Promise<string | null> {
    const row = this.rows.get(id);
    return row && row.record.ownerId === ownerId && row.musicXml !== undefined ? row.musicXml : null;
  }

  async list(filter: ListFilter, ownerId: string | null): Promise<{ items: ScoreSummaryRecord[]; total: number }> {
    const matching = [...this.rows.values()]
      .map((row) => row.record)
      .filter((r) => r.ownerId === ownerId)
      .filter((r) => !filter.q || r.titleSearch.includes(filter.q) || r.composerSearch.includes(filter.q))
      .filter((r) => filter.styleKey === undefined || r.styleKey === filter.styleKey)
      .filter((r) => filter.keyFifths === undefined || r.originalKey.fifths === filter.keyFifths)
      .filter((r) => filter.keyMode === undefined || r.originalKey.mode === filter.keyMode)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() || b.id.localeCompare(a.id));

    const items = matching.slice(filter.skip, filter.skip + filter.limit).map((r): ScoreSummaryRecord => {
      const { source, score: _score, ownerId: _owner, ...rest } = structuredClone(r);
      return { ...rest, sourceKind: source.kind };
    });
    return { items, total: matching.length };
  }

  async facets(ownerId: string | null): Promise<ScoreFacets> {
    const styles = new Map<string, StyleFacet>();
    const keys = new Map<string, KeyFacet>();
    for (const { record } of this.rows.values()) {
      if (record.ownerId !== ownerId) continue;
      if (record.styleKey && record.style) {
        const previous = styles.get(record.styleKey);
        styles.set(record.styleKey, { name: previous?.name ?? record.style, styleKey: record.styleKey, count: (previous?.count ?? 0) + 1 });
      }
      const keyId = `${record.originalKey.fifths}:${record.originalKey.mode}`;
      const previousKey = keys.get(keyId);
      keys.set(keyId, { ...record.originalKey, count: (previousKey?.count ?? 0) + 1 });
    }
    return { styles: [...styles.values()], keys: [...keys.values()] };
  }

  async replace(id: string, ownerId: string | null, input: ScoreReplaceInput): Promise<ScoreRecord | null> {
    const row = this.rows.get(id);
    if (!row || row.record.ownerId !== ownerId) return null;

    const now = new Date();
    const { source, ...rest } = input;
    const next: ScoreRecord = {
      ...rest,
      id,
      source: source ? toStoredSource(source, now) : row.record.source,
      createdAt: row.record.createdAt,
      updatedAt: now,
    };
    this.rows.set(id, {
      record: next,
      ...(source ? (source.musicXml !== undefined ? { musicXml: source.musicXml } : {}) : row.musicXml !== undefined ? { musicXml: row.musicXml } : {}),
    });
    return structuredClone(next);
  }

  async remove(id: string, ownerId: string | null): Promise<boolean> {
    const row = this.rows.get(id);
    if (!row || row.record.ownerId !== ownerId) return false;
    return this.rows.delete(id);
  }

  async close(): Promise<void> {
    this.rows.clear();
  }
}
