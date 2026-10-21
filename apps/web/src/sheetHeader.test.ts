import { describe, expect, it } from 'vitest';
import { splitAuthors } from './sheetHeader';

describe('splitAuthors', () => {
  it('separa varios autores, uno por línea', () => {
    expect(splitAuthors('E. Falú / J. Dávalos')).toEqual(['E. Falú', 'J. Dávalos']);
    expect(splitAuthors('A / B / C')).toEqual(['A', 'B', 'C']);
    expect(splitAuthors('Uno\nDos')).toEqual(['Uno', 'Dos']);
  });

  it('un solo autor, vacío o ausente', () => {
    expect(splitAuthors('Fortunato Juárez')).toEqual(['Fortunato Juárez']);
    expect(splitAuthors('')).toEqual([]);
    expect(splitAuthors(undefined)).toEqual([]);
    expect(splitAuthors('  ')).toEqual([]);
  });

  it('no parte nombres con barra pegada', () => {
    expect(splitAuthors('AC/DC')).toEqual(['AC/DC']);
  });
});
