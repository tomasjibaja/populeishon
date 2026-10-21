import type { Score } from '@partituras/core';
import { useEffect, useRef, useState } from 'react';
import { ensureFonts } from '../renderer/fonts';
import { SheetHeader } from './SheetHeader';
import type { LineBreakMode } from '../renderer/layout';
import type { ChordFontId } from '../renderer/typography';
import { renderScore } from '../renderer/renderScore';

interface ScoreViewProps {
  score: Score;
  zoom: number;
  measuresPerSystem: LineBreakMode;
  showMeasureNumbers: boolean;
  chordFont: ChordFontId;
}

export function ScoreView({ score, zoom, measuresPerSystem, showMeasureNumbers, chordFont }: ScoreViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Mide el ancho disponible y lo actualiza al redimensionar la ventana.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    setWidth(Math.floor(container.clientWidth));
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setWidth(Math.floor(container.clientWidth)));
    });
    observer.observe(container);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  // Redibuja cuando cambia la partitura, el ancho o las opciones de vista.
  useEffect(() => {
    if (width <= 0) return;
    let cancelled = false;

    void (async () => {
      await ensureFonts(chordFont);
      const container = containerRef.current;
      if (cancelled || !container) return;
      try {
        const result = renderScore(container, score, {
          containerWidth: width,
          zoom,
          measuresPerSystem,
          showMeasureNumbers,
          chordFont,
        });
        setWarnings(result.warnings);
        setError(null);
      } catch (e) {
        container.innerHTML = '';
        setWarnings([]);
        setError(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [score, width, zoom, measuresPerSystem, showMeasureNumbers, chordFont]);

  return (
    <section aria-label="Partitura">
      <div className="score-view">
        <SheetHeader score={score} />
        <div ref={containerRef} className="score-canvas" />
      </div>
      {/* ADMIN-PANEL: avisos del dibujo (por ejemplo, ligaduras sin pareja)
      {warnings.length > 0 && (
        <ul className="render-warnings">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      */}
      {error && (
        <p className="status status-error" role="alert">
          No se pudo dibujar la partitura: {error}
        </p>
      )}
    </section>
  );
}
