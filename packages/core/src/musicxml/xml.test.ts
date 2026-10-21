import { describe, expect, it } from 'vitest';
import { XmlParseError, child, childText, childrenNamed, find, parseXml } from './xml';

describe('parseXml', () => {
  it('lee elementos, atributos y texto en orden', () => {
    const root = parseXml('<a x="1" y=\'dos\'><b>uno</b><c/><b> tres </b></a>');
    expect(root.name).toBe('a');
    expect(root.attributes).toEqual({ x: '1', y: 'dos' });
    expect(root.children.map((c) => c.name)).toEqual(['b', 'c', 'b']);
    expect(childrenNamed(root, 'b').map((b) => b.text)).toEqual(['uno', 'tres']);
    expect(childText(root, 'b')).toBe('uno');
    expect(child(root, 'z')).toBe(undefined);
  });

  it('decodifica entidades y acepta CDATA, comentarios, instrucciones y DOCTYPE', () => {
    const root = parseXml(
      '<?xml version="1.0"?>\n<!DOCTYPE score [ <!ENTITY x "y"> ]>\n<!-- hola --><r><t a="&quot;q&quot;">A &amp; B &#233; &#xE9;</t><u><![CDATA[<x>]]></u></r>',
    );
    const t = find(root, 't');
    expect(t?.text).toBe('A & B é é');
    expect(t?.attributes.a).toBe('"q"');
    expect(find(root, 'u')?.text).toBe('<x>');
  });

  it('sigue rutas de hijos', () => {
    const root = parseXml('<a><b><c>fin</c></b></a>');
    expect(find(root, 'b', 'c')?.text).toBe('fin');
    expect(find(root, 'b', 'z')).toBe(undefined);
  });

  it('informa errores con el número de línea', () => {
    expect(() => parseXml('<a><b></a>')).toThrow();
    expect(() => parseXml('<a>')).toThrow();
    expect(() => parseXml('')).toThrow();
    expect(() => parseXml('<a></a><b/>')).toThrow();
    expect(() => parseXml('<a x=1/>')).toThrow();
    try {
      parseXml('<a>\n<b>\n</a>');
    } catch (error) {
      expect(error instanceof XmlParseError).toBe(true);
      expect((error as XmlParseError).line).toBe(3);
    }
  });
});
