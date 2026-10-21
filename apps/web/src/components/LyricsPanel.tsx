import type { Score } from '@partituras/core';
import { useEffect, useRef, useState } from 'react';
import { lyricsColumns } from '../lyrics';
import { SheetHeader } from './SheetHeader';

/**
 * La letra con sus saltos de línea y estrofas. En el celular va en una columna; en pantallas anchas pasa a
 * dos columnas si la letra no entra en el alto de la pantalla.
 */
export function LyricsPanel({ score, fullscreen }: { score: Score; fullscreen: boolean }) {
  const probe = useRef<HTMLPreElement>(null);
  const [columns, setColumns] = useState<1 | 2>(1);

  // Se mide la letra en una sola columna (en un elemento oculto) para decidir cuántas columnas usar.
  useEffect(() => {
    const measure = () => {
      const element = probe.current;
      if (!element) return;
      // Espacio que ocupan la barra, el encabezado de la hoja y los botones: menos en pantalla completa.
      const chrome = fullscreen ? 200 : 340;
      setColumns(lyricsColumns(element.scrollHeight, window.innerHeight, window.innerWidth, chrome));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [score.lyrics, fullscreen]);

  return (
    <div className="score-view lyrics-view">
      <SheetHeader score={score} />
      {score.lyrics ? (
        <div className="lyrics-wrap">
          <pre className={columns === 2 ? 'lyrics-body two-columns' : 'lyrics-body'}>{score.lyrics}</pre>
          <pre ref={probe} className="lyrics-body lyrics-probe" aria-hidden="true">
            {score.lyrics}
          </pre>
        </div>
      ) : (
        <p className="muted">Esta partitura no tiene letra todavía. Podés agregarla con “Editar letra”.</p>
      )}
    </div>
  );
}
