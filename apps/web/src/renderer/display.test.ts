import { describe, expect, it } from 'vitest';
import { longExampleScore } from '@partituras/core';
import { measureDisplay, measureHeaders } from './display';

describe('measureDisplay', () => {
  const headers = measureHeaders(longExampleScore);
  const at = (index: number) => {
    const header = headers[index];
    if (!header) throw new Error(`sin compás ${index}`);
    return header;
  };

  it('el primer compás muestra clave, armadura y compás', () => {
    const d = measureDisplay(at(0), true);
    expect(d.clef).toBe(true);
    expect(d.key?.spec).toBe('C');
    expect(d.time).toBe('4/4');
  });

  it('un compás intermedio sin cambios no muestra nada', () => {
    expect(measureDisplay(at(5), false)).toEqual({ clef: false });
  });

  it('el inicio de línea repite la armadura pero no el compás', () => {
    const d = measureDisplay(at(5), true);
    expect(d.clef).toBe(true);
    expect(d.key?.spec).toBe('C');
    expect(d.time).toBe(undefined);
  });

  it('un cambio de tonalidad a mitad de línea muestra la nueva armadura cancelando la anterior', () => {
    // compás 17 (índice 17): C → G
    expect(measureDisplay(at(17), false).key).toEqual({ spec: 'G', cancelSpec: 'C', accidentals: 1 });
    // compás 29 (índice 29): G → C, con cambio de compás 3/4 → 4/4
    const back = measureDisplay(at(29), false);
    expect(back.key).toEqual({ spec: 'C', cancelSpec: 'G', accidentals: 1 });
    expect(back.time).toBe('4/4');
  });

  it('un cambio de compás se muestra solo donde ocurre', () => {
    expect(measureDisplay(at(25), false)).toEqual({ clef: false, time: '3/4' });
    expect(measureDisplay(at(26), false)).toEqual({ clef: false });
  });

  it('en inicio de línea con tonalidad cambiada no hay cancelación', () => {
    const d = measureDisplay(at(17), true);
    expect(d.key).toEqual({ spec: 'G', accidentals: 1 });
  });
});
