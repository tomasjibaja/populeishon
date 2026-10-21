/** Rutas de la aplicación: la portada, la biblioteca completa (/library) y una partitura guardada (/scores/:id). */
export type Route =
  | { readonly name: 'home' }
  | { readonly name: 'library' }
  | { readonly name: 'score'; readonly id: string };

const SCORE_PATH = /^\/scores\/([0-9a-f]{24})\/?$/;
const LIBRARY_PATH = /^\/library\/?$/;

export function parseRoute(pathname: string): Route {
  if (LIBRARY_PATH.test(pathname)) return { name: 'library' };
  const match = SCORE_PATH.exec(pathname);
  return match?.[1] ? { name: 'score', id: match[1] } : { name: 'home' };
}

export function pathFor(route: Route): string {
  if (route.name === 'score') return `/scores/${route.id}`;
  return route.name === 'library' ? '/library' : '/';
}
