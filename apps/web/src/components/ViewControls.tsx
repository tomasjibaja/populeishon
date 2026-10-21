import { type LineBreakMode } from '../renderer/layout';
import { CHORD_FONTS, type ChordFontId, DEFAULT_CHORD_FONT } from '../renderer/typography';
import { ZoomControl } from './ZoomControl';

export interface ViewSettings {
  /** 1 = 100 %. */
  zoom: number;
  /** 'file' = saltos de línea del archivo; número = máximo por línea; null = los que entren. */
  measuresPerSystem: LineBreakMode;
  /** Número del último compás de cada línea. */
  showMeasureNumbers: boolean;
  /** Tipografía del cifrado de acordes. */
  chordFont: ChordFontId;
}

export const DEFAULT_VIEW: ViewSettings = {
  zoom: 0.85,
  measuresPerSystem: 'file',
  showMeasureNumbers: true,
  chordFont: DEFAULT_CHORD_FONT,
};

const PER_SYSTEM_OPTIONS = [3, 4, 5, 6, 8];

const toValue = (mode: LineBreakMode): string => (mode === null ? 'auto' : String(mode));
const fromValue = (value: string): LineBreakMode => (value === 'auto' ? null : value === 'file' ? 'file' : Number(value));

/** Por ahora solo se ofrece el tamaño y los compases por sistema (el resto queda para el panel de administración). */
export function ViewControls({
  settings,
  onChange,
}: {
  settings: ViewSettings;
  onChange: (settings: ViewSettings) => void;
}) {
  return (
    <>
      <ZoomControl zoom={settings.zoom} onChange={(zoom) => onChange({ ...settings, zoom })} />
      <label className="control">
        <span className="control-text">Compases por sistema</span>
        <select
          value={toValue(settings.measuresPerSystem)}
          onChange={(event) => onChange({ ...settings, measuresPerSystem: fromValue(event.target.value) })}
        >
          <option value="file">Como el archivo</option>
          <option value="auto">Automático</option>
          {PER_SYSTEM_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>

      {/* ADMIN-PANEL: tipografía de los acordes (se eligió Kalam; las otras opciones siguen en renderer/typography.ts)
      <label className="control">
        Tipografía de acordes
        <select
          value={settings.chordFont}
          onChange={(event) => onChange({ ...settings, chordFont: event.target.value as ChordFontId })}
        >
          {CHORD_FONTS.map((font) => (
            <option key={font.id} value={font.id}>
              {font.label}
            </option>
          ))}
        </select>
      </label>
      */}

      {/* ADMIN-PANEL: numeración de compases (por ahora siempre activada)
      <label className="control control-check">
        <input
          type="checkbox"
          checked={settings.showMeasureNumbers}
          onChange={(event) => onChange({ ...settings, showMeasureNumbers: event.target.checked })}
        />
        Numerar compases
      </label>
      */}
    </>
  );
}
