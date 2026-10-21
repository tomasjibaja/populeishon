# API y base de datos (etapa 11)

Código: `apps/api`. Servidor HTTP sin frameworks (solo `node:http`), validación propia en `packages/core`
(`parseScore`) y MongoDB Atlas con Mongoose. La interfaz la usa desde la etapa 12 (`apps/web/src/api/scoresApi.ts`); el contrato de los datos vive en `packages/core/src/api/types.ts`, compartido por ambos.

## Poner en marcha

1. En MongoDB Atlas: creá un **usuario de base de datos** con permiso de lectura y escritura sobre la base `partituras`
   (Database Access) y permití tu IP en **Network Access**.
2. Copiá `apps/api/.env.example` como **`apps/api/.env`** (ese archivo no se sube al repositorio) y completá:
   - `MONGODB_URI`: la cadena de conexión de Atlas (Database > Connect > Drivers), con el usuario y la contraseña del paso 1.
     Si la contraseña tiene `@ : / ? # %`, codificalos (`@` → `%40`).
   - `MONGODB_DB_NAME`: `partituras` (opcional).
   - `PORT`: `3001` (opcional).
3. `npm run db:check -w @partituras/api` guarda, lee, lista y borra una partitura de prueba: confirma que la conexión y los permisos funcionan.
4. `npm run dev:api` levanta la API en `http://localhost:3001`; `npm run dev:all` levanta la API y la web juntas. En desarrollo, la web reenvía lo que empieza con `/api` a la API (proxy de Vite), por eso no hace falta CORS.

Para probarla **sin base de datos**: `STORAGE=memory` en `.env`; guarda en la memoria y se pierde al reiniciar.

Las credenciales viven solo en `apps/api/.env`, en tu máquina. No van en el frontend ni en el repositorio, y la API nunca las escribe en los
registros (solo muestra el servidor).

## Endpoints

| Método y ruta | Qué hace |
| --- | --- |
| `GET /api/health` | `{ status: "ok", storage: "mongo" \| "memory" }` |
| `POST /api/scores` | Guarda una partitura. Cuerpo: `{ score, source? }`. Responde `201` con `{ document, warnings }`. |
| `GET /api/scores` | Lista resúmenes (sin la partitura completa), de la más reciente a la más antigua. Parámetros: `q` (título o autor, sin importar mayúsculas ni tildes), `style`, `keyFifths` (-7 a 7), `keyMode` (`major`/`minor`), `limit` (1 a 100, por defecto 50), `skip`. Responde `{ items, total, limit, skip }`. |
| `GET /api/facets` | Los valores disponibles para los filtros: `{ styles: [{ name, styleKey, count }], keys: [{ fifths, mode, count }] }`. Estilos ordenados por nombre y tonalidades por modo y armadura. |
| `GET /api/scores/:id` | El documento con la partitura completa. |
| `PUT /api/scores/:id` | Reemplaza la partitura (recalcula los campos de búsqueda, conserva la fecha de creación y, si no se manda `source`, el MusicXML original). |
| `DELETE /api/scores/:id` | Borra. `204`. |
| `GET /api/scores/:id/musicxml` | El archivo MusicXML original, si se guardó. |

Errores: siempre `{ error: { code, message, details? } }` con `400` (pedido mal formado o id inválido), `404`, `405`, `413` (cuerpo mayor a 30 MB),
`415` (no es `application/json`), `422` (la partitura no es válida; `details` lista cada problema con su ruta, p. ej.
`score.measures[2].elements[1].pitch.step: debe ser uno de…`) y `500` (sin detalles internos).

Un problema **musical** (un compás incompleto, por ejemplo) no impide guardar: llega en `warnings`.

Probar con curl:

```bash
curl -s localhost:3001/api/health
curl -s -X POST localhost:3001/api/scores -H 'Content-Type: application/json' -d @partitura.json
curl -s 'localhost:3001/api/scores?q=juarez&keyMode=minor'
```

## Modelo de datos (colección `scores`)

| Campo | Contenido |
| --- | --- |
| `_id` | Identificador (ObjectId; la API lo muestra como `id`, 24 caracteres hexadecimales). |
| `ownerId` | `null` por ahora. Cuando haya usuarios, será el id del dueño: **todas** las consultas ya filtran por dueño, así que no hay que rehacer nada. |
| `title`, `composer`, `style`, `originalKey`, `measureCount`, `hasLyrics`, `schemaVersion` | Resumen de la partitura, siempre recalculado desde ella al guardar. |
| `titleSearch`, `composerSearch`, `styleKey` | Los mismos textos sin mayúsculas ni tildes, para buscar. |
| `source` | `{ kind: "musicxml" \| "manual" \| "builtin", fileName?, musicXml?, importedAt? }`. `musicXml` es el archivo original (permite reimportar con un importador mejorado) y no se trae salvo que se pida. |
| `score` | La partitura completa en el modelo propio (`Score` de `packages/core`), con su `schemaVersion`. |
| `createdAt`, `updatedAt` | Fechas (Mongoose). |

Índices (siempre empiezan por `ownerId`): fecha de modificación, título, autor, estilo y tonalidad (`mode` + `fifths`).

### La letra
Cada partitura puede tener `score.lyrics`: **texto con formato** en el que un salto de línea (`\n`) separa los versos y una línea en blanco separa
las estrofas. Se conserva tal cual (los `\r\n` se normalizan a `\n`; máximo 20000 caracteres; una letra vacía no se guarda). Vive dentro de la
partitura, así que viaja con ella al exportar y al transponer, y el resumen indica si la tiene (`hasLyrics`). Si más adelante se necesitara la letra
alineada con las notas (sílaba por nota), se agrega aparte sin romper este campo.

## Qué se valida y por qué sin Zod
`parseScore` (en `packages/core`, compartido por frontend y backend) comprueba tipos, rangos y tamaños de cada campo y **reconstruye** la partitura
solo con los campos conocidos: lo que sobre se descarta, incluidas las claves que empiezan con `$` (que Mongo interpretaría como operadores). Se
escribió a mano porque el modelo es estable y así no se agrega una dependencia ni se duplican los tipos. Las partituras transpuestas se rechazan: son vistas derivadas.
