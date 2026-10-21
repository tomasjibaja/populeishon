import type { Score } from '@partituras/core';
import { useEffect, useRef, useState } from 'react';
import { LyricsPanel } from './LyricsPanel';
import { ScoreView } from './ScoreView';
import { TransposeControls, type TransposeState } from './TransposeControls';
import type { ViewSettings } from './ViewControls';
import { ZoomControl } from './ZoomControl';

export type ReaderMode = 'music' | 'lyrics';

interface Props {
  /** La partitura tal como se muestra (ya transpuesta). */
  score: Score;
  /** La partitura guardada, sin transponer (para el selector de tonalidad). */
  stored: Score;
  transpose: TransposeState;
  onTranspose: (state: TransposeState) => void;
  view: ViewSettings;
  onView: (view: ViewSettings) => void;
  mode: ReaderMode;
  onMode: (mode: ReaderMode) => void;
}

/**
 * La hoja (o la letra) con los botones de debajo: pantalla completa y alternar entre música y letra.
 * En pantalla completa, al tocar la pantalla aparecen los controles: salir, tonalidad, tamaño y música/letra.
 */
export function Reader({ score, stored, transpose, onTranspose, view, onView, mode, onMode }: Props) {
  const root = useRef<HTMLElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [controls, setControls] = useState(false);

  async function enter() {
    setFullscreen(true);
    setControls(false);
    try {
      await root.current?.requestFullscreen?.();
    } catch {
      // Sin la API del navegador (por ejemplo en iPhone), la hoja igual ocupa toda la ventana.
    }
  }

  async function exit() {
    setFullscreen(false);
    setControls(false);
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {
      // ya se había salido
    }
  }

  // Salir con la tecla Esc del navegador (pantalla completa real) o del propio modo.
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) {
        setFullscreen(false);
        setControls(false);
      }
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') void exit();
    };
    window.addEventListener('keydown', onKey);
    // Mientras está en pantalla completa no se desplaza la página de atrás.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [fullscreen]);

  const toggleMode = () => onMode(mode === 'music' ? 'lyrics' : 'music');

  return (
    <section
      ref={root}
      className={fullscreen ? 'reader is-fullscreen' : 'reader'}
      aria-label="Lectura"
      onClick={(event) => {
        if (!fullscreen) return;
        // Tocar un control no muestra ni oculta la barra.
        if ((event.target as Element).closest('.reader-controls')) return;
        setControls((visible) => !visible);
      }}
    >
      {fullscreen && controls && (
        <div className="reader-controls" role="toolbar" aria-label="Controles de lectura">
          <button type="button" className="rc-button" aria-label="Salir de pantalla completa" onClick={() => void exit()}>
            <span className="rc-icon" aria-hidden="true">
              ✕
            </span>
            <span className="rc-label">Salir de pantalla completa</span>
          </button>
          <TransposeControls stored={stored} state={transpose} onChange={onTranspose} />
          <ZoomControl zoom={view.zoom} onChange={(zoom) => onView({ ...view, zoom })} />
          <button
            type="button"
            className="rc-button"
            aria-label={mode === 'music' ? 'Mostrar la letra' : 'Mostrar la partitura'}
            onClick={toggleMode}
          >
            <span className="rc-icon" aria-hidden="true">
              {mode === 'music' ? '¶' : '♪'}
            </span>
            <span className="rc-label">{mode === 'music' ? 'Letra' : 'Música'}</span>
          </button>
        </div>
      )}

      {mode === 'music' ? (
        <ScoreView
          score={score}
          zoom={view.zoom}
          measuresPerSystem={view.measuresPerSystem}
          showMeasureNumbers={view.showMeasureNumbers}
          chordFont={view.chordFont}
        />
      ) : (
        <LyricsPanel score={score} fullscreen={fullscreen} />
      )}

      {!fullscreen && (
        <div className="reader-actions">
          <button type="button" className="button button-secondary" onClick={() => void enter()}>
            Pantalla completa
          </button>
          <button type="button" className="button button-secondary" aria-pressed={mode === 'lyrics'} onClick={toggleMode}>
            {mode === 'lyrics' ? 'Mostrar partitura' : 'Mostrar letra'}
          </button>
        </div>
      )}
    </section>
  );
}
