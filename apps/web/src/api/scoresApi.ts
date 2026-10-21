import type {
  ScoreDocumentView,
  ScoreFacets,
  ScoreListResponse,
  ScoreSaveInput,
  ScoreWriteResponse,
} from '@partituras/core';

/** Error de la API (o de la conexión con ella) con un mensaje listo para mostrar. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly details?: readonly string[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ListParams {
  readonly q?: string;
  readonly style?: string;
  readonly keyFifths?: number;
  readonly keyMode?: 'major' | 'minor';
  readonly limit?: number;
  readonly skip?: number;
}

/** Lo que la interfaz necesita del almacenamiento de partituras. */
export interface ScoreStore {
  list(params?: ListParams): Promise<ScoreListResponse>;
  /** Estilos y tonalidades que hay guardados, para armar los filtros. */
  facets(): Promise<ScoreFacets>;
  get(id: string): Promise<ScoreDocumentView>;
  create(input: ScoreSaveInput): Promise<ScoreWriteResponse>;
  replace(id: string, input: ScoreSaveInput): Promise<ScoreWriteResponse>;
  remove(id: string): Promise<void>;
}

const CONNECTION_HINT = 'No se pudo conectar con el servidor. ¿Está corriendo la API? (npm run dev:api)';

async function toApiError(response: Response): Promise<ApiError> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    // Sin cuerpo JSON: suele ser el proxy avisando que la API no responde.
    return new ApiError(response.status >= 500 ? CONNECTION_HINT : `Error ${response.status} del servidor.`, response.status);
  }
  const error = (body as { error?: { code?: unknown; message?: unknown; details?: unknown } } | null)?.error;
  if (error && typeof error.message === 'string') {
    const details = Array.isArray(error.details) ? error.details.filter((d): d is string => typeof d === 'string') : undefined;
    return new ApiError(error.message, response.status, typeof error.code === 'string' ? error.code : undefined, details);
  }
  return new ApiError(response.status >= 500 ? CONNECTION_HINT : `Error ${response.status} del servidor.`, response.status);
}

export function createHttpScoreStore(options: { baseUrl?: string; fetchFn?: typeof fetch } = {}): ScoreStore {
  const base = options.baseUrl ?? '/api';
  const doFetch: typeof fetch = options.fetchFn ?? ((input, init) => fetch(input, init));

  async function request(path: string, init?: RequestInit): Promise<Response> {
    let response: Response;
    try {
      response = await doFetch(`${base}${path}`, init);
    } catch {
      throw new ApiError(CONNECTION_HINT, 0, 'network_error');
    }
    if (!response.ok) throw await toApiError(response);
    return response;
  }

  const jsonInit = (method: string, body: unknown): RequestInit => ({
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return {
    async list(params = {}) {
      const query = new URLSearchParams();
      if (params.q) query.set('q', params.q);
      if (params.style) query.set('style', params.style);
      if (params.keyFifths !== undefined) query.set('keyFifths', String(params.keyFifths));
      if (params.keyMode) query.set('keyMode', params.keyMode);
      if (params.limit !== undefined) query.set('limit', String(params.limit));
      if (params.skip !== undefined) query.set('skip', String(params.skip));
      const text = query.toString();
      return (await (await request(`/scores${text ? `?${text}` : ''}`)).json()) as ScoreListResponse;
    },

    async facets() {
      return (await (await request('/facets')).json()) as ScoreFacets;
    },

    async get(id) {
      return (await (await request(`/scores/${encodeURIComponent(id)}`)).json()) as ScoreDocumentView;
    },

    async create(input) {
      return (await (await request('/scores', jsonInit('POST', input))).json()) as ScoreWriteResponse;
    },

    async replace(id, input) {
      return (await (await request(`/scores/${encodeURIComponent(id)}`, jsonInit('PUT', input))).json()) as ScoreWriteResponse;
    },

    async remove(id) {
      await request(`/scores/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
  };
}

/** Mensaje para mostrar al usuario ante cualquier error. */
export function messageOf(error: unknown): string {
  if (error instanceof ApiError) {
    return error.details && error.details.length > 0 ? `${error.message} ${error.details.slice(0, 3).join(' · ')}` : error.message;
  }
  return error instanceof Error ? error.message : String(error);
}

export const scoreStore: ScoreStore = createHttpScoreStore();
