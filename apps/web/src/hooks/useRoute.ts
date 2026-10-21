import { useCallback, useEffect, useState } from 'react';
import { type Route, parseRoute, pathFor } from '../routing';

/** Ruta actual (según la dirección del navegador) y una función para navegar sin recargar la página. */
export function useRoute(): [Route, (route: Route, replace?: boolean) => void] {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.pathname));

  useEffect(() => {
    const onPopState = () => setRoute(parseRoute(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((next: Route, replace = false) => {
    const path = pathFor(next);
    if (path !== window.location.pathname) {
      if (replace) window.history.replaceState(null, '', path);
      else window.history.pushState(null, '', path);
    }
    setRoute(next);
  }, []);

  return [route, navigate];
}
