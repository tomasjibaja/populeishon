/**
 * Comprueba la conexión con MongoDB Atlas: guarda una partitura de prueba, la lee, la lista y la borra.
 * Uso: npm run db:check -w @partituras/api   (con apps/api/.env completo)
 */
import { exampleScore } from '@partituras/core';
import { ConfigError, describeMongoUri, readConfig } from '../src/config';
import { deriveIndexFields } from '../src/domain/normalize';
import { connectMongo } from '../src/storage/connect';

async function run(): Promise<void> {
  const config = readConfig({ ...process.env, STORAGE: 'mongo' });
  console.log(`Conectando con ${describeMongoUri(config.mongoUri ?? '')} (base "${config.dbName}")…`);
  const repository = await connectMongo(config.mongoUri ?? '', config.dbName);
  try {
    const created = await repository.create({
      ownerId: null,
      ...deriveIndexFields(exampleScore),
      source: { kind: 'builtin' },
      score: { ...exampleScore, lyrics: 'Primer verso\nSegundo verso\n\nOtra estrofa' },
    });
    console.log(`✔ Guardada: ${created.id}`);

    const found = await repository.findById(created.id, null);
    console.log(`✔ Leída: "${found?.title}", ${found?.score.measures.length} compases, letra con ${found?.score.lyrics?.split('\n').length} líneas`);

    const listed = await repository.list({ limit: 5, skip: 0 }, null);
    console.log(`✔ Listadas: ${listed.total} partitura(s) en la colección`);

    console.log((await repository.remove(created.id, null)) ? '✔ Borrada la de prueba' : '✘ No se pudo borrar la de prueba');
    console.log('\nTodo bien: la conexión y los permisos de escritura funcionan.');
  } finally {
    await repository.close();
  }
}

run().catch((error: unknown) => {
  if (error instanceof ConfigError) console.error(`Configuración: ${error.message}`);
  else console.error('✘ Falló la comprobación:', error instanceof Error ? error.message : error);
  process.exit(1);
});
