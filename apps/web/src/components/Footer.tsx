/** Pie de página con los créditos; el texto completo es un enlace al sitio del desarrollador. */
export function Footer() {
  return (
    <footer className="site-footer">
      <a href="https://tjdev.vercel.app" target="_blank" rel="noopener noreferrer">
        Desarrollado por Tomas Jibaja para la EMPA - Copyright {new Date().getFullYear()}
      </a>
    </footer>
  );
}
