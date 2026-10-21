import { ScoreService } from './domain/scoreService';
import type { ScoreRepository } from './domain/repository';
import { ConfigError, describeMongoUri, readConfig } from './config';
import { createApp } from './http/server';
import { connectMongo } from './storage/connect';
import { MemoryScoreRepository } from './storage/memoryRepository';

async function main(): Promise<void> {
  const config = readConfig(process.env);

  let repository: ScoreRepository;
  if (config.storage === 'memory') {
    console.warn('⚠ STORAGE=memory: las partituras se guardan solo en la memoria y se pierden al reiniciar.');
    repository = new MemoryScoreRepository();
  } else {
    console.log(`Conectando con MongoDB en ${describeMongoUri(config.mongoUri ?? '')} (base "${config.dbName}")…`);
    repository = await connectMongo(config.mongoUri ?? '', config.dbName);
    console.log('MongoDB conectado.');
  }

  const server = createApp({
    service: new ScoreService(repository),
    storage: config.storage,
    log: (message, error) => console.error(message, error),
  });
  server.listen(config.port, () => console.log(`API lista en http://localhost:${config.port}/api/health`));

  const shutdown = () => {
    console.log('Cerrando…');
    server.close(() => {
      void repository.close().finally(() => process.exit(0));
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error: unknown) => {
  if (error instanceof ConfigError) console.error(`Configuración: ${error.message}`);
  else console.error('No se pudo iniciar la API:', error instanceof Error ? error.message : error);
  process.exit(1);
});
