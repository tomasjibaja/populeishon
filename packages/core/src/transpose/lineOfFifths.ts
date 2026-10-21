import type { PitchClass, Step } from '../model/pitch';

/**
 * Línea de quintas: cada nombre de nota "escrito" (spelled) es un entero.
 * F = -1, C = 0, G = 1, D = 2, A = 3, E = 4, B = 5; cada sostenido suma 7 y cada bemol resta 7
 * (F# = 6, Bb = -2). Transponer cambiando el nombre de las notas es sumar una constante: es lo mismo
 * que girar la armadura en el círculo de quintas, así que melodía y armadura nunca se desincronizan.
 */

const ORDER: readonly Step[] = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const BASE: Readonly<Record<Step, number>> = { F: -1, C: 0, G: 1, D: 2, A: 3, E: 4, B: 5 };
const SEMITONES: Readonly<Record<Step, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Rango de la línea de quintas con a lo sumo doble bemol o doble sostenido (Fbb … B##). */
export const LINE_MIN = -15;
export const LINE_MAX = 19;

export function lineOf(p: PitchClass): number {
  return BASE[p.step] + 7 * p.alter;
}

export function pitchClassAt(line: number): PitchClass {
  const index = (((line + 1) % 7) + 7) % 7;
  return { step: ORDER[index] ?? 'C', alter: Math.floor((line + 1) / 7) };
}

/** Semitonos de la nota respecto de C (sin octava; puede salir de 0..11 con B# o Cb). */
export function semitonesOf(p: PitchClass): number {
  return SEMITONES[p.step] + p.alter;
}

/**
 * Si la línea queda más allá de dobles alteraciones (G###), se usa la grafía enarmónica
 * equivalente (A#): son 12 posiciones de la línea de quintas, mismo sonido.
 */
export function respellLine(line: number): number {
  let result = line;
  while (result > LINE_MAX) result -= 12;
  while (result < LINE_MIN) result += 12;
  return result;
}
