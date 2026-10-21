import { describe, expect, it } from 'vitest';
import { parseRoute, pathFor } from './routing';

const id = '0123456789abcdef01234567';

describe('rutas', () => {
  it('la raíz y las direcciones desconocidas son la portada', () => {
    expect(parseRoute('/')).toEqual({ name: 'home' });
    expect(parseRoute('/otra')).toEqual({ name: 'home' });
    expect(parseRoute('/scores')).toEqual({ name: 'home' });
    expect(parseRoute('/scores/')).toEqual({ name: 'home' });
  });

  it('reconoce una partitura guardada por su id', () => {
    expect(parseRoute(`/scores/${id}`)).toEqual({ name: 'score', id });
    expect(parseRoute(`/scores/${id}/`)).toEqual({ name: 'score', id });
  });

  it('un id inválido no es una partitura', () => {
    expect(parseRoute('/scores/abc')).toEqual({ name: 'home' });
    expect(parseRoute(`/scores/${id}0`)).toEqual({ name: 'home' });
    expect(parseRoute(`/scores/${id.toUpperCase()}`)).toEqual({ name: 'home' });
    expect(parseRoute(`/scores/${id}/otra`)).toEqual({ name: 'home' });
  });

  it('reconoce la biblioteca completa', () => {
    expect(parseRoute('/library')).toEqual({ name: 'library' });
    expect(parseRoute('/library/')).toEqual({ name: 'library' });
    expect(parseRoute('/library/otra')).toEqual({ name: 'home' });
    expect(parseRoute('/libraryx')).toEqual({ name: 'home' });
  });

  it('pathFor es la inversa de parseRoute', () => {
    expect(pathFor({ name: 'home' })).toBe('/');
    expect(pathFor({ name: 'score', id })).toBe(`/scores/${id}`);
    expect(pathFor({ name: 'library' })).toBe('/library');
    expect(parseRoute(pathFor({ name: 'library' }))).toEqual({ name: 'library' });
    expect(parseRoute(pathFor({ name: 'score', id }))).toEqual({ name: 'score', id });
  });
});
