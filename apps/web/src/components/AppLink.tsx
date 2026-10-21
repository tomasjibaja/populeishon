import type { ReactNode } from 'react';

/**
 * Enlace que navega sin recargar la página. Con Ctrl, Cmd, Shift o el botón del medio se comporta
 * como un enlace común (abre en otra pestaña).
 */
export function AppLink({
  href,
  onNavigate,
  className,
  children,
}: {
  href: string;
  onNavigate: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      className={className}
      onClick={(event) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        onNavigate();
      }}
    >
      {children}
    </a>
  );
}
