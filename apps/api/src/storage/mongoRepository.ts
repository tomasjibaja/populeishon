import type { Key, Mode, Score, ScoreFacets } from '@partituras/core';
import mongoose, { Schema } from 'mongoose';
import type { ScoreReplaceInput, ScoreRepository } from '../domain/repository';
import type {
  ListFilter,
  ScoreRecord,
  ScoreRecordInput,
  ScoreSummaryRecord,
  SourceInput,
  SourceKind,
} from '../domain/types';

/** Cómo queda cada partitura en la colección "scores". */
interface ScoreDoc {
  _id: { toString(): string };
  ownerId?: string | null;
  title: string;
  composer?: string;
  style?: string;
  originalKey: Key;
  titleSearch: string;
  composerSearch: string;
  styleKey: string;
  measureCount: number;
  hasLyrics: boolean;
  schemaVersion: number;
  source: { kind: SourceKind; fileName?: string; musicXml?: string; importedAt?: Date };
  score: Score;
  createdAt: Date;
  updatedAt: Date;
}

const scoreSchema = new Schema(
  {
    // Preparado para usuarios: hoy siempre es null.
    ownerId: { type: String, default: null },
    title: { type: String, required: true, maxlength: 200 },
    composer: { type: String, maxlength: 200 },
    style: { type: String, maxlength: 200 },
    originalKey: {
      fifths: { type: Number, required: true, min: -7, max: 7 },
      mode: { type: String, required: true, enum: ['major', 'minor'] },
    },
    titleSearch: { type: String, default: '' },
    composerSearch: { type: String, default: '' },
    styleKey: { type: String, default: '' },
    measureCount: { type: Number, default: 0 },
    hasLyrics: { type: Boolean, default: false },
    schemaVersion: { type: Number, required: true },
    source: {
      kind: { type: String, required: true, enum: ['builtin', 'musicxml', 'manual'] },
      fileName: { type: String, maxlength: 255 },
      // El archivo original es pesado: no se trae salvo que se pida con select('+source.musicXml').
      musicXml: { type: String, select: false },
      importedAt: { type: Date },
    },
    // La partitura completa en el modelo propio de la aplicación.
    score: { type: Schema.Types.Mixed, required: true },
  },
  { collection: 'scores', timestamps: true, minimize: false },
);

// Índices para listar y filtrar (siempre por dueño).
scoreSchema.index({ ownerId: 1, updatedAt: -1 });
scoreSchema.index({ ownerId: 1, titleSearch: 1 });
scoreSchema.index({ ownerId: 1, composerSearch: 1 });
scoreSchema.index({ ownerId: 1, styleKey: 1 });
scoreSchema.index({ ownerId: 1, 'originalKey.mode': 1, 'originalKey.fifths': 1 });

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function toRecord(doc: ScoreDoc): ScoreRecord {
  return {
    id: String(doc._id),
    ownerId: doc.ownerId ?? null,
    title: doc.title,
    ...(doc.composer ? { composer: doc.composer } : {}),
    ...(doc.style ? { style: doc.style } : {}),
    originalKey: { fifths: doc.originalKey.fifths, mode: doc.originalKey.mode },
    titleSearch: doc.titleSearch,
    composerSearch: doc.composerSearch,
    styleKey: doc.styleKey,
    measureCount: doc.measureCount,
    hasLyrics: doc.hasLyrics,
    schemaVersion: doc.schemaVersion,
    source: {
      kind: doc.source.kind,
      ...(doc.source.fileName ? { fileName: doc.source.fileName } : {}),
      hasMusicXml: doc.source.musicXml !== undefined,
      ...(doc.source.importedAt ? { importedAt: doc.source.importedAt } : {}),
    },
    score: doc.score,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function sourceFields(source: SourceInput, now: Date) {
  return {
    kind: source.kind,
    ...(source.fileName ? { fileName: source.fileName } : {}),
    ...(source.musicXml !== undefined ? { musicXml: source.musicXml } : {}),
    ...(source.musicXml !== undefined || source.kind === 'musicxml' ? { importedAt: now } : {}),
  };
}

export class MongoScoreRepository implements ScoreRepository {
  private readonly model = mongoose.model('Score', scoreSchema);

  /** Crea la colección y los índices si no existen. */
  async init(): Promise<void> {
    await this.model.init();
  }

  async create(input: ScoreRecordInput): Promise<ScoreRecord> {
    const { source, ...rest } = input;
    const now = new Date();
    const created = await this.model.create({ ...rest, source: sourceFields(source, now) });
    return toRecord(created.toObject() as unknown as ScoreDoc);
  }

  async findById(id: string, ownerId: string | null): Promise<ScoreRecord | null> {
    // Se trae el XML solo para saber si existe; no se devuelve en la respuesta.
    const doc = (await this.model.findOne({ _id: id, ownerId }).select('+source.musicXml').lean()) as unknown as ScoreDoc | null;
    return doc ? toRecord(doc) : null;
  }

  async findMusicXml(id: string, ownerId: string | null): Promise<string | null> {
    const doc = (await this.model.findOne({ _id: id, ownerId }).select('+source.musicXml').lean()) as unknown as ScoreDoc | null;
    return doc?.source.musicXml ?? null;
  }

  async list(filter: ListFilter, ownerId: string | null): Promise<{ items: ScoreSummaryRecord[]; total: number }> {
    const query: Record<string, unknown> = { ownerId };
    if (filter.q) {
      const contains = new RegExp(escapeRegex(filter.q));
      query.$or = [{ titleSearch: contains }, { composerSearch: contains }];
    }
    if (filter.styleKey !== undefined) query.styleKey = filter.styleKey;
    if (filter.keyFifths !== undefined) query['originalKey.fifths'] = filter.keyFifths;
    if (filter.keyMode !== undefined) query['originalKey.mode'] = filter.keyMode;

    const [docs, total] = await Promise.all([
      this.model
        .find(query)
        .select('ownerId title composer style originalKey titleSearch composerSearch styleKey measureCount hasLyrics schemaVersion source.kind source.fileName createdAt updatedAt')
        .sort({ updatedAt: -1, _id: -1 })
        .skip(filter.skip)
        .limit(filter.limit)
        .lean(),
      this.model.countDocuments(query),
    ]);

    const items = (docs as unknown as ScoreDoc[]).map((doc): ScoreSummaryRecord => {
      const { source, score: _score, ownerId: _owner, ...rest } = toRecord({ ...doc, score: undefined as unknown as Score });
      return { ...rest, sourceKind: source.kind };
    });
    return { items, total };
  }

  async facets(ownerId: string | null): Promise<ScoreFacets> {
    const [styles, keys] = await Promise.all([
      this.model.aggregate([
        { $match: { ownerId, styleKey: { $ne: '' } } },
        { $group: { _id: '$styleKey', name: { $first: '$style' }, count: { $sum: 1 } } },
      ]) as Promise<{ _id: string; name?: string; count: number }[]>,
      this.model.aggregate([
        { $match: { ownerId } },
        { $group: { _id: { fifths: '$originalKey.fifths', mode: '$originalKey.mode' }, count: { $sum: 1 } } },
      ]) as Promise<{ _id: { fifths: number; mode: Mode }; count: number }[]>,
    ]);
    return {
      styles: styles.map((s) => ({ name: s.name ?? s._id, styleKey: s._id, count: s.count })),
      keys: keys.map((k) => ({ fifths: k._id.fifths, mode: k._id.mode, count: k.count })),
    };
  }

  async replace(id: string, ownerId: string | null, input: ScoreReplaceInput): Promise<ScoreRecord | null> {
    const { source, ...rest } = input;
    const now = new Date();
    const update = { ...rest, ...(source ? { source: sourceFields(source, now) } : {}) };
    const doc = (await this.model
      .findOneAndUpdate({ _id: id, ownerId }, { $set: update }, { new: true, runValidators: true })
      .select('+source.musicXml')
      .lean()) as unknown as ScoreDoc | null;
    return doc ? toRecord(doc) : null;
  }

  async remove(id: string, ownerId: string | null): Promise<boolean> {
    const result = await this.model.deleteOne({ _id: id, ownerId });
    return result.deletedCount === 1;
  }

  async close(): Promise<void> {
    await mongoose.disconnect();
  }
}
