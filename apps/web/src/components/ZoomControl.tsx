import { ZOOM } from '../renderer/layout';

/** Deslizador del tamaño de la partitura. */
export function ZoomControl({ zoom, onChange }: { zoom: number; onChange: (zoom: number) => void }) {
  const percent = Math.round(zoom * 100);
  return (
    <label className="control zoom-control">
      <span className="control-text">Tamaño: {percent} %</span>
      <span className="control-icon" aria-hidden="true">
        🔍 {percent} %
      </span>
      <input
        type="range"
        aria-label="Tamaño de la partitura"
        min={Math.round(ZOOM.min * 100)}
        max={Math.round(ZOOM.max * 100)}
        step={Math.round(ZOOM.step * 100)}
        value={percent}
        onChange={(event) => onChange(Number(event.target.value) / 100)}
      />
    </label>
  );
}
