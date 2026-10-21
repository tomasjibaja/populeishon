/** La letra con sus saltos de línea y estrofas tal como se guardó. */
export function LyricsView({ lyrics }: { lyrics: string }) {
  return (
    <section className="lyrics-section" aria-label="Letra">
      <h2>Letra</h2>
      <pre className="lyrics">{lyrics}</pre>
    </section>
  );
}
