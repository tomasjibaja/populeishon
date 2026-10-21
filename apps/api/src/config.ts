export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export interface Config {
  readonly port: number;
  readonly storage: 'memory' | 'mongo';
  readonly mongoUri: string | undefined;
  readonly dbName: string;
}

/** Lee y valida la configuración desde las variables de entorno. Nunca muestra la contraseña en los mensajes. */
export function readConfig(env: Readonly<Record<string, string | undefined>>): Config {
  const storage = (env.STORAGE ?? 'mongo').trim().toLowerCase();
  if (storage !== 'mongo' && storage !== 'memory') {
    throw new ConfigError(`STORAGE debe ser "mongo" o "memory" (valor actual: "${env.STORAGE}").`);
  }

  const portText = (env.PORT ?? '3001').trim();
  const port = Number(portText);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ConfigError(`PORT debe ser un número entre 1 y 65535 (valor actual: "${portText}").`);
  }

  const mongoUri = env.MONGODB_URI?.trim() || undefined;
  if (storage === 'mongo') {
    if (!mongoUri) {
      throw new ConfigError(
        'Falta MONGODB_URI. Copiá apps/api/.env.example como apps/api/.env y completá la cadena de conexión de MongoDB Atlas ' +
          '(o usá STORAGE=memory para probar sin base de datos).',
      );
    }
    if (!/^mongodb(\+srv)?:\/\//.test(mongoUri)) {
      throw new ConfigError('MONGODB_URI debe empezar con "mongodb://" o "mongodb+srv://".');
    }
  }

  const dbName = (env.MONGODB_DB_NAME ?? 'partituras').trim();
  if (!/^[A-Za-z0-9_-]{1,38}$/.test(dbName)) {
    throw new ConfigError('MONGODB_DB_NAME solo puede tener letras, números, "_" y "-" (hasta 38 caracteres).');
  }

  return { port, storage, mongoUri, dbName };
}

/** Muestra de la cadena de conexión sin usuario ni contraseña: solo el servidor. */
export function describeMongoUri(uri: string): string {
  const match = /^(mongodb(?:\+srv)?:\/\/)(?:[^@/]*@)?([^/?]+)/.exec(uri);
  return match ? `${match[1]}${match[2]}` : 'mongodb://…';
}
