/**
 * Tipografías del cifrado de acordes. Se elige desde la lista "Tipografía de acordes".
 * Las fuentes a mano se cargan desde Google Fonts (ver index.html); si no están disponibles se usa la siguiente de la lista.
 * Para agregar una: sumar un elemento aquí y su familia en el enlace de index.html.
 */
export type ChordFontId = 'classic' | 'kalam' | 'architects' | 'neucha';

export interface ChordFontOption {
  readonly id: ChordFontId;
  readonly label: string;
  readonly family: string;
  /** Nombre de la fuente a descargar; ausente si es del sistema. */
  readonly loadName?: string;
  readonly size: number;
  readonly weight: 'normal' | 'bold';
}

export const CHORD_FONTS: readonly ChordFontOption[] = [
  { id: 'classic', label: 'Clásica (la anterior)', family: 'Helvetica, Arial, sans-serif', size: 15, weight: 'bold' },
  {
    id: 'kalam',
    label: 'Kalam (a mano, inclinada)',
    family: "'Kalam', 'Segoe Print', 'Comic Sans MS', cursive",
    loadName: "'Kalam'",
    size: 17,
    weight: 'bold',
  },
  {
    id: 'architects',
    label: 'Architects Daughter (rótulo)',
    family: "'Architects Daughter', 'Segoe Print', 'Comic Sans MS', sans-serif",
    loadName: "'Architects Daughter'",
    size: 17,
    weight: 'normal',
  },
  {
    id: 'neucha',
    label: 'Neucha (a mano, redondeada)',
    family: "'Neucha', 'Segoe Print', 'Comic Sans MS', sans-serif",
    loadName: "'Neucha'",
    size: 18,
    weight: 'normal',
  },
];

/** Elegida: Kalam. Las demás quedan definidas por si se vuelve a ofrecer la elección en un panel de administración. */
export const DEFAULT_CHORD_FONT: ChordFontId = 'kalam';

export function chordFontFor(id: ChordFontId): ChordFontOption {
  return CHORD_FONTS.find((font) => font.id === id) ?? CHORD_FONTS[0]!;
}

/** Texto que el navegador necesita para descargar esa fuente con su grosor y tamaño. */
export function fontLoadSpec(font: ChordFontOption): string | undefined {
  return font.loadName ? `${font.weight} ${font.size}px ${font.loadName}` : undefined;
}

/** Distancia entre la primera línea del pentagrama y la línea base del cifrado. */
export const CHORD_BASELINE = 14;

/** Letra de los textos de navegación (x2, D.C.…) y de los números de compás. */
export const TEXT_FONT_FAMILY = 'Helvetica, Arial, sans-serif';
