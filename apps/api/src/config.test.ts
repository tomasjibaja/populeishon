import { describe, expect, it } from 'vitest';
import { ConfigError, describeMongoUri, readConfig } from './config';

const atlas = 'mongodb+srv://usuario:secreto@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority';

describe('readConfig', () => {
  it('usa los valores por defecto con una conexión de Atlas', () => {
    expect(readConfig({ MONGODB_URI: atlas })).toEqual({ port: 3001, storage: 'mongo', mongoUri: atlas, dbName: 'partituras' });
  });

  it('lee puerto, base y modo memoria', () => {
    expect(readConfig({ STORAGE: 'memory', PORT: '4000' })).toEqual({ port: 4000, storage: 'memory', mongoUri: undefined, dbName: 'partituras' });
    expect(readConfig({ MONGODB_URI: atlas, MONGODB_DB_NAME: 'otra_base' }).dbName).toBe('otra_base');
  });

  it('con mongo, exige la cadena de conexión y explica cómo ponerla', () => {
    expect(() => readConfig({})).toThrow();
    try {
      readConfig({ STORAGE: 'mongo' });
    } catch (error) {
      expect(error instanceof ConfigError).toBe(true);
      expect((error as Error).message.includes('.env')).toBe(true);
    }
  });

  it('rechaza valores inválidos', () => {
    expect(() => readConfig({ STORAGE: 'sqlite' })).toThrow();
    expect(() => readConfig({ STORAGE: 'memory', PORT: 'abc' })).toThrow();
    expect(() => readConfig({ STORAGE: 'memory', PORT: '70000' })).toThrow();
    expect(() => readConfig({ MONGODB_URI: 'http://ejemplo.com' })).toThrow();
    expect(() => readConfig({ MONGODB_URI: atlas, MONGODB_DB_NAME: 'mala base!' })).toThrow();
  });

  it('los mensajes de error no incluyen la contraseña', () => {
    try {
      readConfig({ MONGODB_URI: 'ftp://usuario:secreto@host', STORAGE: 'mongo' });
    } catch (error) {
      expect((error as Error).message.includes('secreto')).toBe(false);
    }
  });
});

describe('describeMongoUri', () => {
  it('muestra solo el servidor, sin usuario ni contraseña', () => {
    expect(describeMongoUri(atlas)).toBe('mongodb+srv://cluster0.abcde.mongodb.net');
    expect(describeMongoUri('mongodb://u:p@localhost:27017/base')).toBe('mongodb://localhost:27017');
    expect(describeMongoUri(atlas).includes('secreto')).toBe(false);
    expect(describeMongoUri('???')).toBe('mongodb://…');
  });
});
