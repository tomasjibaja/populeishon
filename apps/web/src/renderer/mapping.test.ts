import { describe, expect, it } from 'vitest';
import { duration, key, pitch, timeSignature } from '@partituras/core';
import {
  clefAnnotation,
  clefOctaveShift,
  durationToVex,
  keySpec,
  pitchToVexKey,
  timeSpec,
  vexDurationString,
} from './mapping';

describe('mapping a VexFlow', () => {
  it('convierte figuras simples y con puntillo', () => {
    expect(durationToVex(duration(1, 1))).toEqual({ code: 'w', dots: 0 });
    expect(durationToVex(duration(1, 4))).toEqual({ code: 'q', dots: 0 });
    expect(durationToVex(duration(1, 8))).toEqual({ code: '8', dots: 0 });
    expect(durationToVex(duration(3, 4))).toEqual({ code: 'h', dots: 1 });
    expect(durationToVex(duration(3, 8))).toEqual({ code: 'q', dots: 1 });
  });

  it('devuelve null para duraciones no soportadas', () => {
    expect(durationToVex(duration(1, 12))).toBe(null);
    expect(durationToVex(duration(5, 8))).toBe(null);
  });

  it('construye las claves de altura', () => {
    expect(pitchToVexKey(pitch('C', 5))).toBe('c/5');
    expect(pitchToVexKey(pitch('F', 4, 1))).toBe('f#/4');
    expect(pitchToVexKey(pitch('B', 3, -1))).toBe('bb/3');
    expect(pitchToVexKey(pitch('E', 4, -2))).toBe('ebb/4');
    expect(pitchToVexKey(pitch('C', 4, 2))).toBe('c##/4');
  });

  it('construye armadura y compás', () => {
    expect(keySpec(key(0))).toBe('C');
    expect(keySpec(key(-2))).toBe('Bb');
    expect(keySpec(key(0, 'minor'))).toBe('Am');
    expect(keySpec(key(-3, 'minor'))).toBe('Cm');
    expect(timeSpec(timeSignature(3, 4))).toBe('3/4');
  });

  it('arma el texto de duración con puntillos y silencios', () => {
    expect(vexDurationString({ code: 'q', dots: 0 }, false)).toBe('q');
    expect(vexDurationString({ code: 'q', dots: 1 }, false)).toBe('qd');
    expect(vexDurationString({ code: 'h', dots: 1 }, false)).toBe('hd');
    expect(vexDurationString({ code: '8', dots: 0 }, true)).toBe('8r');
    expect(vexDurationString({ code: 'q', dots: 1 }, true)).toBe('qdr');
  });

  it('traduce la clave con cambio de octava', () => {
    expect(clefAnnotation(-1)).toBe('8vb');
    expect(clefAnnotation(1)).toBe('8va');
    expect(clefAnnotation(0)).toBe(undefined);
    expect(clefOctaveShift(-1)).toBe(1);
    expect(clefOctaveShift(0) === 0).toBe(true);
    // G3 suena una octava debajo de lo escrito en clave 8vb: se dibuja como G4
    expect(pitchToVexKey(pitch('G', 3), clefOctaveShift(-1))).toBe('g/4');
  });
});
