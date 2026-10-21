import {
  type Key,
  type Score,
  type TimeSignature,
  effectiveKeys,
  effectiveTimeSignatures,
} from '@partituras/core';
import { keySpec, timeSpec } from './mapping';

/** Qué debe mostrar el comienzo de cada compás (clave, armadura, indicación de compás). */

export interface MeasureHeader {
  readonly key: Key;
  readonly prevKey: Key | undefined;
  readonly timeSignature: TimeSignature;
  readonly keyChanged: boolean;
  readonly timeChanged: boolean;
}

export interface MeasureDisplay {
  readonly clef: boolean;
  readonly key?: { readonly spec: string; readonly cancelSpec?: string; readonly accidentals: number };
  readonly time?: string;
}

const sameKey = (a: Key, b: Key) => a.fifths === b.fifths && a.mode === b.mode;
const sameTime = (a: TimeSignature, b: TimeSignature) => a.beats === b.beats && a.beatType === b.beatType;

export function measureHeaders(score: Score): MeasureHeader[] {
  const keys = effectiveKeys(score);
  const signatures = effectiveTimeSignatures(score);

  return score.measures.map((_, i) => {
    const key = keys[i] ?? score.originalKey;
    const timeSignature = signatures[i] ?? score.timeSignature;
    const prevKey = i > 0 ? keys[i - 1] : undefined;
    const prevTime = i > 0 ? signatures[i - 1] : undefined;
    return {
      key,
      prevKey,
      timeSignature,
      keyChanged: prevKey === undefined || !sameKey(key, prevKey),
      timeChanged: prevTime === undefined || !sameTime(timeSignature, prevTime),
    };
  });
}

/**
 * Al principio de cada sistema se repite clave y armadura; el compás solo cuando cambia
 * (o en el primer compás de la partitura). En mitad de un sistema solo aparecen los cambios.
 */
export function measureDisplay(header: MeasureHeader, systemStart: boolean): MeasureDisplay {
  const time = header.timeChanged ? timeSpec(header.timeSignature) : undefined;

  if (systemStart) {
    return {
      clef: true,
      key: { spec: keySpec(header.key), accidentals: Math.abs(header.key.fifths) },
      ...(time ? { time } : {}),
    };
  }

  const key = header.keyChanged
    ? {
        spec: keySpec(header.key),
        ...(header.prevKey ? { cancelSpec: keySpec(header.prevKey) } : {}),
        accidentals: Math.abs(header.key.fifths) + (header.prevKey ? Math.abs(header.prevKey.fifths) : 0),
      }
    : undefined;

  return { clef: false, ...(key ? { key } : {}), ...(time ? { time } : {}) };
}
