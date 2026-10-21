/**
 * Clave. Por ahora solo clave de sol en segunda línea, con posible cambio de octava
 * (-1 = "clave de sol de guitarra/tenor": las notas suenan una octava más abajo de lo escrito).
 * Las alturas del modelo son siempre las que suenan; la clave solo afecta a cómo se dibujan.
 */
export interface Clef {
  readonly sign: 'G';
  readonly octaveChange: number;
}
