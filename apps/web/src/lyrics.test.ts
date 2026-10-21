import { describe, expect, it } from 'vitest';
import { exampleScore } from '@partituras/core';
import { MAX_LYRICS_LENGTH, lyricsColumns, normalizeLyrics, withLyrics } from './lyrics';

describe('normalizeLyrics', () => {
  it('conserva versos y estrofas, y unifica los saltos de línea', () => {
    expect(normalizeLyrics('Verso uno\r\nVerso dos\n\nOtra estrofa\rÚltimo')).toBe('Verso uno\nVerso dos\n\nOtra estrofa\nÚltimo');
  });

  it('quita espacios al final de cada línea y líneas en blanco en los extremos, pero no el interior', () => {
    expect(normalizeLyrics('\n\n  Con sangría  \nSegundo   \n\n\nTercero\n\n')).toBe('  Con sangría\nSegundo\n\n\nTercero');
  });

  it('vacío o solo espacios es "sin letra"', () => {
    expect(normalizeLyrics('')).toBe(undefined);
    expect(normalizeLyrics('  \n \r\n  ')).toBe(undefined);
  });

  it('respeta el máximo de caracteres', () => {
    expect(normalizeLyrics('a'.repeat(MAX_LYRICS_LENGTH + 50))?.length).toBe(MAX_LYRICS_LENGTH);
  });
});

describe('withLyrics', () => {
  it('agrega, cambia y quita la letra sin modificar la original', () => {
    const snapshot = JSON.stringify(exampleScore);
    const added = withLyrics(exampleScore, 'Hola\nMundo');
    expect(added.lyrics).toBe('Hola\nMundo');
    expect(withLyrics(added, 'Otra').lyrics).toBe('Otra');
    const removed = withLyrics(added, undefined);
    expect('lyrics' in removed).toBe(false);
    expect(removed).toEqual(exampleScore);
    expect(JSON.stringify(exampleScore)).toBe(snapshot);
  });
});

describe('lyricsColumns', () => {
  it('en pantallas anchas pasa a dos columnas si la letra excede el alto de la pantalla', () => {
    expect(lyricsColumns(400, 900, 1200, 260)).toBe(1);
    expect(lyricsColumns(700, 900, 1200, 260)).toBe(2);
    expect(lyricsColumns(640, 900, 1200, 260)).toBe(1);
    expect(lyricsColumns(641, 900, 1200, 260)).toBe(2);
    expect(lyricsColumns(2000, 900, 1200, 260)).toBe(2);
  });

  it('en el celular siempre es una columna', () => {
    expect(lyricsColumns(5000, 800, 390, 200)).toBe(1);
    expect(lyricsColumns(5000, 800, 640, 200)).toBe(1);
    expect(lyricsColumns(5000, 800, 641, 200)).toBe(2);
  });

  it('en pantalla completa hay menos "chrome", así que cabe más antes de pasar a dos columnas', () => {
    expect(lyricsColumns(700, 900, 1200, 260)).toBe(2);
    expect(lyricsColumns(700, 900, 1200, 120)).toBe(1);
  });
});
