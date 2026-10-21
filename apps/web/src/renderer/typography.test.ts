import { describe, expect, it } from 'vitest';
import { CHORD_FONTS, DEFAULT_CHORD_FONT, chordFontFor, fontLoadSpec } from './typography';

describe('tipografías del cifrado', () => {
  it('hay entre 3 y 5 opciones, con identificadores distintos', () => {
    expect(CHORD_FONTS.length >= 3 && CHORD_FONTS.length <= 5).toBe(true);
    expect(new Set(CHORD_FONTS.map((f) => f.id)).size).toBe(CHORD_FONTS.length);
    expect(new Set(CHORD_FONTS.map((f) => f.label)).size).toBe(CHORD_FONTS.length);
  });

  it('la predeterminada es Kalam y la anterior sigue disponible', () => {
    expect(DEFAULT_CHORD_FONT).toBe('kalam');
    expect(chordFontFor(DEFAULT_CHORD_FONT).family.startsWith("'Kalam'")).toBe(true);
    expect(chordFontFor('classic')).toEqual({ id: 'classic', label: 'Clásica (la anterior)', family: 'Helvetica, Arial, sans-serif', size: 15, weight: 'bold' });
  });

  it('las fuentes a mano se descargan y tienen alternativas del sistema', () => {
    for (const font of CHORD_FONTS.filter((f) => f.id !== 'classic')) {
      expect(font.loadName !== undefined).toBe(true);
      expect(font.family.includes(',')).toBe(true);
      expect(font.size >= 15 && font.size <= 20).toBe(true);
    }
    expect(fontLoadSpec(chordFontFor('classic'))).toBe(undefined);
    expect(fontLoadSpec(chordFontFor('kalam'))).toBe("bold 17px 'Kalam'");
    expect(fontLoadSpec(chordFontFor('neucha'))).toBe("normal 18px 'Neucha'");
  });

  it('un identificador desconocido usa la primera de la lista', () => {
    expect(chordFontFor('inexistente' as never).id).toBe('classic');
  });
});
