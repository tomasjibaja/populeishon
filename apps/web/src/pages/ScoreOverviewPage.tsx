import {
  type Score,
  type ScoreDocumentView,
  type ScoreSummaryView,
  exampleScore,
  longExampleScore,
  viewScore,
} from '@partituras/core';
import { useEffect, useMemo, useState } from 'react';
import { messageOf, scoreStore } from '../api/scoresApi';
import { ImportButton } from '../components/ImportButton';
/* ADMIN-PANEL: informe de importación, avisos de la partitura, línea de datos y tabla del modelo
import { ImportReportView } from '../components/ImportReportView';
import { MeasureTable } from '../components/MeasureTable';
import { ScoreHeader } from '../components/ScoreHeader';
import { ValidationStatus } from '../components/ValidationStatus';
*/
import { LibraryPage } from '../components/LibraryPage';
import { LibraryPanel } from '../components/LibraryPanel';
import { LyricsEditorModal } from '../components/LyricsEditorModal';
import { Reader, type ReaderMode } from '../components/Reader';
import { DEFAULT_TRANSPOSE, TransposeControls, type TransposeState } from '../components/TransposeControls';
import { DEFAULT_VIEW, ViewControls, type ViewSettings } from '../components/ViewControls';
import { useLibrary } from '../hooks/useLibrary';
import { useRoute } from '../hooks/useRoute';
import { normalizeLyrics, withLyrics } from '../lyrics';

/** Una partitura que se puede mostrar: un ejemplo, una recién importada o una guardada. */
interface Opened {
  id: string;
  label: string;
  origin: 'example' | 'import' | 'saved';
  score: Score;
  /** Id en la base de datos, si está guardada. */
  savedId?: string;
  /** Archivo original, para guardarlo junto con la partitura. */
  musicXml?: string;
  fileName?: string;
}

// ADMIN-PANEL: los ejemplos ya no se ofrecen en la interfaz (antes estaban en el selector "Partitura").
const EXAMPLES: Opened[] = [
  { id: 'corto', label: 'Ejemplo corto (8 compases)', origin: 'example', score: exampleScore },
  { id: 'largo', label: 'Ejemplo largo (33 compases, con cambios)', origin: 'example', score: longExampleScore },
];
/** La importada o la guardada que está abierta ocupa siempre este lugar. */
const EXTRA_ID = 'extra';

interface Notice {
  tone: 'ok' | 'error';
  text: string;
}

export function ScoreOverviewPage() {
  const [route, navigate] = useRoute();
  const library = useLibrary(scoreStore);

  // Al empezar no hay ninguna partitura abierta.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [extra, setExtra] = useState<Opened | null>(null);
  const [view, setView] = useState<ViewSettings>(DEFAULT_VIEW);
  const [transpose, setTranspose] = useState<TransposeState>(DEFAULT_TRANSPOSE);
  const [mode, setMode] = useState<ReaderMode>('music');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingLyrics, setEditingLyrics] = useState(false);
  const [lyricsSaving, setLyricsSaving] = useState(false);
  const [lyricsError, setLyricsError] = useState<string | null>(null);

  const sources: Opened[] = extra ? [...EXAMPLES, extra] : EXAMPLES;
  const selected = selectedId === null ? undefined : sources.find((s) => s.id === selectedId);
  const stored = selected?.score;

  // La partitura guardada nunca cambia: lo que se dibuja es una vista derivada según la tonalidad elegida.
  const shown = useMemo(() => (stored ? viewScore(stored, transpose) : undefined), [stored, transpose]);

  function selectSource(id: string | null) {
    setSelectedId(id);
    setTranspose(DEFAULT_TRANSPOSE);
    setMode('music');
  }

  function openSaved(doc: ScoreDocumentView) {
    setExtra({ id: EXTRA_ID, label: `Guardada: ${doc.title}`, origin: 'saved', score: doc.score, savedId: doc.id });
    selectSource(EXTRA_ID);
  }

  async function loadSaved(id: string) {
    setLoading(true);
    try {
      openSaved(await scoreStore.get(id));
      setNotice(null);
    } catch (error) {
      setNotice({ tone: 'error', text: messageOf(error) });
      navigate({ name: 'home' }, true);
    } finally {
      setLoading(false);
    }
  }

  // Abrir una partitura guardada por su dirección (/scores/:id), y volver atrás con el navegador.
  useEffect(() => {
    if (route.name === 'score') {
      if (extra?.savedId !== route.id) void loadSaved(route.id);
      else if (selectedId !== EXTRA_ID) selectSource(EXTRA_ID);
    } else if (route.name === 'home' && extra?.origin === 'saved' && selectedId === EXTRA_ID) {
      selectSource(null);
    }
  }, [route]);

  /* ADMIN-PANEL: selector de partitura (ejemplos, importada o guardada)
  function chooseSource(id: string) {
    selectSource(id);
    navigate(id === EXTRA_ID && extra?.savedId ? { name: 'score', id: extra.savedId } : { name: 'home' });
  }
  */

  function handleImported(result: Parameters<Parameters<typeof ImportButton>[0]['onImported']>[0], text: string, fileName: string) {
    if (!result.ok) {
      const reason = result.report.items.find((item) => item.severity === 'error')?.message ?? 'el archivo no es válido';
      setNotice({ tone: 'error', text: `No se pudo importar "${fileName}": ${reason}` });
      return;
    }
    // ADMIN-PANEL: el informe completo de la importación (result.report) ya no se muestra.
    setNotice(null);
    setExtra({
      id: EXTRA_ID,
      label: `Importada: ${result.score.title}`,
      origin: 'import',
      score: result.score,
      musicXml: text,
      fileName,
    });
    selectSource(EXTRA_ID);
    navigate({ name: 'home' });
  }

  async function save() {
    if (!selected || selected.origin === 'saved') return;
    setSaving(true);
    setNotice(null);
    try {
      const source =
        selected.origin === 'import'
          ? {
              kind: 'musicxml' as const,
              ...(selected.fileName ? { fileName: selected.fileName } : {}),
              ...(selected.musicXml ? { musicXml: selected.musicXml } : {}),
            }
          : { kind: 'builtin' as const };
      const result = await scoreStore.create({ score: selected.score, source });
      openSaved(result.document);
      navigate({ name: 'score', id: result.document.id });
      await library.refresh();
      setNotice({ tone: 'ok', text: 'Guardada en la biblioteca.' });
    } catch (error) {
      setNotice({ tone: 'error', text: `No se pudo guardar: ${messageOf(error)}` });
    } finally {
      setSaving(false);
    }
  }

  /** ADMIN-PANEL: eliminar partituras (antes había un botón "Eliminar" en la lista). */
  async function remove(item: ScoreSummaryView) {
    if (!window.confirm(`¿Eliminar "${item.title}" de la biblioteca? No se puede deshacer.`)) return;
    try {
      await scoreStore.remove(item.id);
      if (extra?.savedId === item.id) {
        setExtra(null);
        selectSource(null);
        navigate({ name: 'home' });
      }
      await library.refresh();
      setNotice({ tone: 'ok', text: `Se eliminó "${item.title}".` });
    } catch (error) {
      setNotice({ tone: 'error', text: `No se pudo eliminar: ${messageOf(error)}` });
    }
  }

  /** Guarda la letra: en la base de datos si la partitura está guardada; si no, queda en la partitura abierta. */
  async function saveLyrics(text: string) {
    if (!selected) return;
    const updated = withLyrics(selected.score, normalizeLyrics(text));
    if (selected.origin === 'saved' && selected.savedId) {
      setLyricsSaving(true);
      setLyricsError(null);
      try {
        const result = await scoreStore.replace(selected.savedId, { score: updated });
        setExtra({ ...selected, id: EXTRA_ID, score: result.document.score });
        setEditingLyrics(false);
        await library.refresh();
      } catch (error) {
        setLyricsError(`No se pudo guardar la letra: ${messageOf(error)}`);
      } finally {
        setLyricsSaving(false);
      }
      return;
    }
    setExtra({ ...selected, id: EXTRA_ID, score: updated });
    setSelectedId(EXTRA_ID);
    setEditingLyrics(false);
  }

  const openScore = (id: string) => navigate({ name: 'score', id });
  const backFromLibrary = () => navigate(extra?.savedId ? { name: 'score', id: extra.savedId } : { name: 'home' });

  return (
    <main className="page">
      <header className="app-bar">
        <span className="app-name">♪ Partituras</span>
        <div className="app-actions">
          <ImportButton onImported={handleImported} />
          <button
            type="button"
            className="button button-secondary"
            disabled={!selected}
            onClick={() => {
              setLyricsError(null);
              setEditingLyrics(true);
            }}
          >
            Editar letra
          </button>
        </div>
      </header>

      {notice && (
        <p className={notice.tone === 'ok' ? 'status status-ok' : 'status status-error'} role={notice.tone === 'ok' ? 'status' : 'alert'}>
          {notice.text}
        </p>
      )}

      {route.name === 'library' ? (
        <LibraryPage currentId={selected?.savedId} onOpen={openScore} onBack={backFromLibrary} />
      ) : (
        <>
          <LibraryPanel
            library={library}
            currentId={selected?.savedId}
            onOpen={openScore}
            onOpenLibrary={() => navigate({ name: 'library' })}
          />

          {loading && (
            <p className="loading" role="status">
              <span className="spinner" aria-hidden="true" />
              Abriendo la partitura…
            </p>
          )}

          {selected && stored && shown ? (
            <>
              <section className="options" aria-label="Opciones de vista">
                <div className="options-grid">
                  <TransposeControls stored={stored} state={transpose} onChange={setTranspose} />
                  <ViewControls settings={view} onChange={setView} />
                </div>
              </section>

              {!shown.ok && (
                <p className="status status-error" role="alert">
                  No se pudo transponer: {shown.error}
                </p>
              )}

              {/* ADMIN-PANEL: informe de importación, avisos de la partitura y línea de datos
              {lastImport && <ImportReportView result={lastImport} onDismiss={() => setLastImport(null)} />}
              <ScoreHeader score={shown.score} />
              <ValidationStatus issues={validateScore(shown.score)} />
              */}

              {selected.origin !== 'saved' && (
                <div className="save-bar">
                  <button type="button" className="button" disabled={saving} onClick={() => void save()}>
                    {saving ? 'Guardando…' : 'Guardar en la biblioteca'}
                  </button>
                  <span className="muted">Se guarda tal como está, sin transponer.</span>
                </div>
              )}

              <Reader
                score={shown.score}
                stored={stored}
                transpose={transpose}
                onTranspose={setTranspose}
                view={view}
                onView={setView}
                mode={mode}
                onMode={setMode}
              />

              {/* ADMIN-PANEL: tabla con los datos del modelo
              <details className="model-data">
                <summary>Ver los datos del modelo</summary>
                <MeasureTable score={shown.score} />
              </details>
              */}
            </>
          ) : (
            !loading && (
              <p className="empty-state">Importá un archivo MusicXML o buscá una partitura de tu biblioteca para empezar.</p>
            )
          )}

          {/* ADMIN-PANEL: nota con lo que se hará en la próxima etapa
          <p className="footnote">Próxima etapa: limpieza de datos accesorios.</p>
          */}
        </>
      )}

      {editingLyrics && selected && (
        <LyricsEditorModal
          initial={selected.score.lyrics ?? ''}
          title={selected.score.title}
          saving={lyricsSaving}
          error={lyricsError}
          onSave={(text) => void saveLyrics(text)}
          onClose={() => setEditingLyrics(false)}
        />
      )}
    </main>
  );
}
