import { type ImportResult, importMusicXml } from '@partituras/core';
import { useRef, useState } from 'react';

/** Botón que abre el explorador de archivos, lee el MusicXML elegido y lo convierte al modelo propio. */
export function ImportButton({
  onImported,
}: {
  /** Recibe el resultado, el texto original del archivo (para poder guardarlo) y su nombre. */
  onImported: (result: ImportResult, text: string, fileName: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const text = await file.text();
      onImported(importMusicXml(text, { fileName: file.name }), text, file.name);
    } catch (error) {
      onImported(
        {
          ok: false,
          report: {
            fileName: file.name,
            items: [
              {
                severity: 'error',
                message: `No se pudo leer el archivo: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
          },
        },
        '',
        file.name,
      );
    } finally {
      setBusy(false);
      // Permite volver a elegir el mismo archivo.
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <>
      <button type="button" className="button" disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? 'Leyendo…' : 'Importar MusicXML'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".musicxml,.xml,.mxl"
        hidden
        onChange={(event) => void handleFiles(event.target.files)}
      />
    </>
  );
}
