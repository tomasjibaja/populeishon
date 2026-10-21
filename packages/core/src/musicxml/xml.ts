/**
 * Lector XML mínimo, sin dependencias, que funciona igual en Node y en el navegador.
 * Soporta lo que usa MusicXML: elementos, atributos, texto, entidades, CDATA,
 * comentarios, instrucciones <?...?> y DOCTYPE. Conserva el orden de los hijos,
 * que en MusicXML es significativo (notas, acordes y retrocesos van entremezclados).
 */

export interface XmlElement {
  readonly name: string;
  readonly attributes: Readonly<Record<string, string>>;
  readonly children: readonly XmlElement[];
  /** Texto propio del elemento (sin el de los hijos), con espacios de los bordes recortados. */
  readonly text: string;
}

export class XmlParseError extends Error {
  constructor(
    message: string,
    readonly line: number,
  ) {
    super(message);
    this.name = 'XmlParseError';
  }
}

const NAME = /[^\s/>=<"']+/y;

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|amp|lt|gt|quot|apos);/g, (whole, body: string) => {
    switch (body) {
      case 'amp': return '&';
      case 'lt': return '<';
      case 'gt': return '>';
      case 'quot': return '"';
      case 'apos': return "'";
    }
    const code = body.startsWith('#x') ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
    return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
  });
}

export function parseXml(source: string): XmlElement {
  let pos = 0;

  const lineAt = (p: number) => source.slice(0, p).split('\n').length;
  const fail = (message: string, at = pos): never => {
    const line = lineAt(at);
    throw new XmlParseError(`${message} (línea ${line})`, line);
  };

  const skipWhitespace = () => {
    while (pos < source.length && /\s/.test(source.charAt(pos))) pos++;
  };

  const skipUntil = (terminator: string, what: string) => {
    const end = source.indexOf(terminator, pos);
    if (end < 0) fail(`${what} sin cerrar`);
    pos = end + terminator.length;
  };

  const skipDoctype = () => {
    // <!DOCTYPE ... > con posible subconjunto interno [ ... ]
    pos += '<!DOCTYPE'.length;
    let depth = 0;
    while (pos < source.length) {
      const ch = source.charAt(pos++);
      if (ch === '[') depth++;
      else if (ch === ']') depth--;
      else if (ch === '>' && depth <= 0) return;
    }
    fail('DOCTYPE sin cerrar');
  };

  /** Salta espacios, comentarios, instrucciones de proceso y DOCTYPE. */
  const skipMisc = () => {
    for (;;) {
      skipWhitespace();
      if (source.startsWith('<?', pos)) skipUntil('?>', 'Instrucción <?');
      else if (source.startsWith('<!--', pos)) skipUntil('-->', 'Comentario');
      else if (source.startsWith('<!DOCTYPE', pos)) skipDoctype();
      else return;
    }
  };

  const readName = (): string => {
    NAME.lastIndex = pos;
    const match = NAME.exec(source);
    if (!match) return fail('Se esperaba un nombre');
    pos += match[0].length;
    return match[0];
  };

  const parseElement = (): XmlElement => {
    const start = pos;
    if (source.charAt(pos) !== '<') fail('Se esperaba "<"');
    pos++;
    const name = readName();
    const attributes: Record<string, string> = {};

    for (;;) {
      skipWhitespace();
      if (source.startsWith('/>', pos)) {
        pos += 2;
        return { name, attributes, children: [], text: '' };
      }
      if (source.charAt(pos) === '>') {
        pos++;
        break;
      }
      if (pos >= source.length) fail(`Elemento <${name}> sin cerrar`, start);
      const attrName = readName();
      skipWhitespace();
      if (source.charAt(pos) !== '=') fail(`Falta "=" en el atributo "${attrName}"`);
      pos++;
      skipWhitespace();
      const quote = source.charAt(pos);
      if (quote !== '"' && quote !== "'") fail(`El atributo "${attrName}" debe ir entre comillas`);
      const end = source.indexOf(quote, pos + 1);
      if (end < 0) fail(`Atributo "${attrName}" sin cerrar`);
      attributes[attrName] = decodeEntities(source.slice(pos + 1, end));
      pos = end + 1;
    }

    const children: XmlElement[] = [];
    let text = '';
    for (;;) {
      if (pos >= source.length) fail(`Elemento <${name}> sin cerrar`, start);
      if (source.startsWith('</', pos)) {
        pos += 2;
        const closing = readName();
        skipWhitespace();
        if (source.charAt(pos) !== '>') fail(`Cierre </${closing}> mal formado`);
        pos++;
        if (closing !== name) fail(`Se esperaba </${name}> pero aparece </${closing}>`);
        return { name, attributes, children, text: text.trim() };
      }
      if (source.startsWith('<!--', pos)) skipUntil('-->', 'Comentario');
      else if (source.startsWith('<![CDATA[', pos)) {
        const end = source.indexOf(']]>', pos);
        if (end < 0) fail('CDATA sin cerrar');
        text += source.slice(pos + '<![CDATA['.length, end);
        pos = end + 3;
      } else if (source.startsWith('<?', pos)) skipUntil('?>', 'Instrucción <?');
      else if (source.charAt(pos) === '<') children.push(parseElement());
      else {
        const next = source.indexOf('<', pos);
        const end = next < 0 ? source.length : next;
        text += decodeEntities(source.slice(pos, end));
        pos = end;
      }
    }
  };

  skipMisc();
  if (pos >= source.length) fail('El documento está vacío');
  const root = parseElement();
  skipMisc();
  if (pos < source.length) fail('Hay contenido después del elemento raíz');
  return root;
}

/** Primer hijo con ese nombre. */
export function child(el: XmlElement, name: string): XmlElement | undefined {
  return el.children.find((c) => c.name === name);
}

/** Todos los hijos con ese nombre, en orden. */
export function childrenNamed(el: XmlElement, name: string): XmlElement[] {
  return el.children.filter((c) => c.name === name);
}

/** Texto del primer hijo con ese nombre (o undefined si no existe). */
export function childText(el: XmlElement, name: string): string | undefined {
  return child(el, name)?.text;
}

/** Sigue una ruta de nombres de hijo: find(el, 'key', 'fifths'). */
export function find(el: XmlElement, ...path: string[]): XmlElement | undefined {
  let current: XmlElement | undefined = el;
  for (const name of path) {
    if (!current) return undefined;
    current = child(current, name);
  }
  return current;
}
