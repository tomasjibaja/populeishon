import type { Score } from '@partituras/core';
import { splitAuthors } from '../sheetHeader';

/** Encabezado de la hoja, como en un Real Book: estilo a la izquierda, título al centro y autores a la derecha. */
export function SheetHeader({ score }: { score: Score }) {
  const authors = splitAuthors(score.composer);
  return (
    <header className="sheet-header">
      <div className="sheet-style">{score.style}</div>
      <h1 className="sheet-title">{score.title}</h1>
      <div className="sheet-authors">
        {authors.map((author) => (
          <div key={author}>{author}</div>
        ))}
      </div>
    </header>
  );
}
