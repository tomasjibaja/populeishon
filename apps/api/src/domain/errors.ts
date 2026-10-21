/** Errores de dominio: la capa HTTP los traduce a códigos de estado. */
export class DomainError extends Error {
  constructor(
    readonly code: 'bad_request' | 'validation_error' | 'not_found' | 'payload_too_large' | 'unsupported_media_type',
    message: string,
    readonly details?: readonly string[],
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export const badRequest = (message: string) => new DomainError('bad_request', message);
export const notFound = (message = 'No se encontró la partitura.') => new DomainError('not_found', message);
export const validationError = (message: string, details: readonly string[]) =>
  new DomainError('validation_error', message, details);
