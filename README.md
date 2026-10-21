# Partituras

Webapp para importar, visualizar y transponer partituras de una melodía con cifrado de acordes (estilo Real Book).

**Estado: Etapa 14** — interfaz simplificada y pulida: lector con pantalla completa y letra, edición de la letra, búsqueda con estilo, biblioteca completa en su propia pantalla, acordes en Kalam y pie con créditos. Incluye todo lo anterior: guardar en la base de datos, importación de MusicXML, repeticiones, casillas, tresillos, transposición, varias líneas, zoom y acordes.
Las repeticiones y casillas llegan en una etapa próxima.

## Requisitos

Node.js 20.19 o superior y npm.

## Uso

Para guardar partituras la API tiene que estar corriendo (ver `docs/api.md` para configurar `apps/api/.env`):

```bash
npm install
npm run dev:all    # levanta la API (puerto 3001) y la web (puerto 5173) a la vez; Ctrl+C detiene ambas
```

También se pueden levantar por separado: `npm run dev:api` y `npm run dev` (en dos terminales). Sin la API, la web funciona igual
(ejemplos, importar, transponer); solo avisa que no puede guardar ni listar.

```bash
npm install
npm run dev        # abre http://localhost:5173
npm test           # tests del modelo (Vitest)
npm run typecheck  # TypeScript en todos los paquetes
npm run build      # compila la web
```

## Estructura

```
packages/core   Modelo musical propio (sin React ni VexFlow). Aquí vivirán el
                importador MusicXML, la transposición y el exportador.
docs            Importador (importer-strategy.md), transposición (transposition.md) y API/base de datos (api.md).
apps/web        Frontend React + Vite (en desarrollo reenvía /api a la API).
docs            Decisiones del importador (docs/importer-strategy.md).
apps/api        API REST (Node + MongoDB Atlas). Ver docs/api.md.
```

## Modelo musical (resumen)

- `Duration`: fracción exacta de redonda (`1/4` = negra).
- `Pitch`: `step` + `alter` + `octave` (nombre escrito: C# ≠ Db). La alteración que se dibuja la decide el renderer según la armadura.
- `Key`: `fifths` (-7…7) + `mode`.
- `Chord`: `root` + `quality` + `suffix` (como se escribió) + `bass` + `text` original. `parseChord` lo construye desde un símbolo.
- `NoteElement`/`RestElement`: `tuplet` (tresillos y otros grupos irregulares; `duration` es la exacta y `notatedDuration` la figura escrita).
- `Measure`: `startRepeat`/`endRepeat`, `endingStart`/`endingEnd` (casillas), `endBarline` (doble o final), `repeatTimes` (x2, x3), `newSystem` (salto de línea del archivo), `texts` (D.C.), `pickup` (anacrusa), `timeSignature`/`keySignature` solo si cambian, `chords` con posición dentro del compás + `elements` (notas y silencios).
- `Score`: `lyrics` (letra con saltos de línea), `transposition` (solo en partituras derivadas por `transposeScore`), `clef` (clave de sol con cambio de octava opcional), `originalKey` nunca se modifica; transponer producirá otra `Score`.

## Panel de administración (pendiente)

Lo que se quitó de la interfaz **no se borró: está comentado** con la marca `ADMIN-PANEL` para reintroducirlo en un panel de administración
(buscá esa palabra en `apps/web/src`): informe de importación, avisos y errores de la partitura, línea de datos, tabla del modelo, selector de
ejemplos, filtro por tonalidad, botón de eliminar, numeración y tipografía de acordes (opciones en `renderer/typography.ts`), avisos del dibujo y la nota de
"próxima etapa".

## Prueba manual de la etapa 14

1. `npm install` y `npm run dev:all`. Al abrir, no hay ninguna partitura abierta: se ve la barra, la búsqueda y un mensaje.
2. **Importar MusicXML** abre la partitura (si el archivo no sirve, un aviso corto lo explica). **Editar letra**, al lado, abre una ventana con la letra de la partitura abierta: se puede escribir, pegar y guardar (si la partitura ya está guardada, se actualiza en la base de datos; si no, queda con la partitura y se guarda con "Guardar en la biblioteca").
3. Solo se ofrecen tres opciones de vista: **tonalidad**, **tamaño** y **compases por sistema**. Los acordes van en **Kalam**.
4. **Debajo de la hoja** hay dos botones: **Pantalla completa** y **Mostrar letra** (que pasa a **Mostrar partitura** mientras se ve la letra).
5. **Letra:** en el celular va en una columna; en pantallas anchas pasa a dos columnas cuando no entra en el alto de la pantalla.
6. **Pantalla completa:** al tocar la pantalla aparecen los controles (salir, tonalidad, tamaño y letra/música; en el celular, con íconos); al tocar de nuevo se ocultan. También sale con Esc.
7. **Búsqueda:** escribí título o autor, o elegí un **estilo** en el desplegable ("Sin filtro" y un estilo por cada uno que haya en la base de datos). El **título** de cada resultado es el enlace para abrir la partitura (sin botones). "ir a la biblioteca" lleva a `/library`, con la lista completa de a 30 por página.
8. Al pie: "Desarrollado por Tomas Jibaja para la EMPA - Copyright <año actual>", con enlace a tjdev.vercel.app.
9. `npm test` pasa en `core`, `web` y `api`.

## Prueba manual de la etapa 13 (sigue valiendo)

1. `npm install` y `npm run dev:all` (con la API configurada).
2. Guardá varias partituras (los tres archivos de `packages/core/test-data/` sirven; también los ejemplos).
3. La sección **Biblioteca** muestra la cantidad y el listado, de la más reciente a la más antigua.
4. **Buscar por título o autor:** escribí "juarez" (sin tilde y en minúsculas) y aparece *Bien haiga con el mocito*; "falu" encuentra *La nostalgiosa*. La búsqueda espera un instante después de tipear.
5. **Estilo** y **Tonalidad:** los desplegables solo ofrecen lo que hay guardado, con la cantidad entre paréntesis (por ejemplo "Chacarera (1)", "E minor (1)"). Se pueden combinar entre sí y con el texto.
6. **Limpiar filtros** aparece cuando hay alguno activo; si nada coincide, lo dice.
7. Con más de 20 partituras aparecen **Anteriores / Siguientes** con el rango ("21–40 de 57"). Al eliminar lo último de una página vuelve a la anterior.
8. **Abrir** y **Eliminar** funcionan igual que antes desde el listado filtrado; al guardar o eliminar, el listado y los filtros se actualizan.
9. `npm test` pasa en `core`, `web` y `api`.

## Prueba manual de la etapa 12 (sigue valiendo)

1. `npm install` y `npm run dev:all` (con `apps/api/.env` configurado; o con `STORAGE=memory` para probar sin Atlas).
2. Abrí la web. Debe verse la lista **Partituras guardadas** (vacía la primera vez).
3. **Importar MusicXML** → elegí un archivo → aparece el botón **Guardar en la biblioteca**. Tocalo: aparece el aviso "Guardada en la biblioteca", la dirección pasa a `/scores/<id>` y la partitura figura en la lista.
4. **Recargá la página**: sigue ahí (se abre sola por la dirección y aparece en la lista).
5. Tocá **Importar** con otro archivo, guardalo y alterná entre las dos con **Abrir**: cada una se abre desde la base de datos, con su tonalidad y transposición reiniciadas.
6. **Eliminar** (con confirmación) quita la partitura de la lista; si estaba abierta, vuelve a los ejemplos.
7. Abrí `/scores/000000000000000000000000` (un id que no existe): avisa que no existe y vuelve a la portada.
8. Con la API apagada, la lista muestra el error y cómo levantarla, con un botón **Reintentar**; el resto de la web sigue funcionando.
9. Los **ejemplos** también se pueden guardar (para probar sin importar). Lo guardado es siempre la partitura sin transponer.
10. `npm test` pasa en `core`, `web` y `api`.

## Prueba manual de la etapa 11 (sigue valiendo)

La interfaz no cambia (solo se oculta la octava, el modo y "volver al original"; el desplegable sigue marcando la tonalidad original). La API se prueba aparte:

1. `npm install` y `npm test`: pasan `core`, `web` y `api` (la API se prueba con almacenamiento en memoria).
2. **Sin base de datos:** en `apps/api/.env` poné `STORAGE=memory`, corré `npm run dev:api` y probá `curl localhost:3001/api/health`.
3. **Con Atlas:** completá `apps/api/.env` según `docs/api.md` (usuario de base de datos, IP permitida, `MONGODB_URI`), corré `npm run db:check`: debe terminar con "Todo bien".
4. `npm run dev:api` y guardá una partitura con curl (ver `docs/api.md`); recargá el listado: sigue ahí. Mirá la colección `scores` en Atlas.

## Prueba manual de la etapa 10 (sigue valiendo)

1. `npm install` y `npm run dev`.
2. **Ejemplo corto** → en **Mostrar en** elegí "E major (4♯)": cambia la armadura a 4 sostenidos, la melodía sube una tercera mayor y los acordes pasan a `E, C#m7, Amaj7, B7, E/G#, C#m, F#m7 + B7b9, Emaj7`. El encabezado dice "transpuesta desde C major (+4 semitonos)".
3. Elegí "Eb major (3♭)": los acordes quedan `Eb, Cm7, Abmaj7, Bb7, Eb/G…` con bemoles. Probá "F# major (6♯)" y "Gb major (6♭)": suenan igual y se escriben distinto.
4. **Octava** −/+: sube o baja la partitura una octava sin cambiar de tonalidad.
5. **Ejemplo largo** → "C# major (7♯)": la parte en G mayor (compases 17 a 28) pasa a Ab mayor con sus acordes (`Ab`, `Fm7`…).
6. Importá *Bien haiga con el mocito* (E menor): el selector muestra las tonalidades menores. Si el archivo no traía el modo y se dedujo mal, cambiá **Modo de la tonalidad original**.
7. **Volver al original** restaura todo. Al cambiar de partitura o importar otra, la elección se reinicia.
8. "Ver los datos del modelo" muestra las notas y acordes transpuestos.
9. `npm test` pasa en `core` y en `web`.

## Prueba manual de la etapa 9 (sigue valiendo)

La app se ve igual que en la 8 (la interfaz para transponer es la etapa 10). Se prueba con `npm test`
(`packages/core/src/transpose/transposeChord.test.ts`):

- C – Am – F – G a E mayor da E – C#m – A – B; a Eb mayor, Eb – Cm – Ab – Bb;
- `C/E` pasa a `E/G#` (el bajo se transpone con la raíz); `G7/B` a `B7/D#`;
- el estilo del autor se conserva: `C-7` → `E-7`, `CΔ7` → `EΔ7`, `C7b9` → `E7b9`, `B♭7` → `C7`;
- la ida y vuelta a las 15 tonalidades devuelve los acordes originales, y el texto regenerado se vuelve a leer con las mismas componentes.

1. `npm install` y `npm test`: deben pasar `core` y `web`.
2. `npm run dev`: la app se ve igual que antes.

## Prueba manual de la etapa 8 (sigue valiendo)

Esta etapa no cambia lo que se ve: la app funciona igual que en la 7. El motor se prueba con `npm test` (carpeta
`packages/core/src/transpose/`). Los tests comprueban, entre otras cosas:

- C mayor → E mayor: E4 pasa a G#4, G4 a B4 y la armadura queda con 4 sostenidos;
- ida y vuelta a las 15 tonalidades mayores (y en modo menor) devuelve exactamente la partitura original, incluidos los cambios de tonalidad;
- los cambios de tonalidad internos, ligaduras, tresillos y estructura se conservan; los acordes no se tocan todavía;
- la partitura original nunca se modifica (se prueba congelándola).

1. `npm install` y `npm test`: deben pasar `core` y `web`.
2. `npm run dev`: la app se ve igual que antes.

## Prueba manual de la etapa 7 (sigue valiendo) (y ajustes de la 6.2)

1. `npm install` y `npm run dev`.
2. **Ejemplo largo**:
   - compás 14: un tresillo de corcheas con corchete y el número 3;
   - compás 27 (3/4): un silencio de redonda que ocupa todo el compás;
   - compases 15 y 16: los corchetes de casilla pegados al pentagrama, con el texto "1." y "2." sobre la línea y el cifrado de esos compases por encima; el "x2" sobre la barra de fin de repetición.
3. **Número de compás:** chico, a la derecha del final de cada línea, a la altura del centro del pentagrama.
4. **Compases por línea → Como el archivo:** con una ventana angosta, una línea del archivo que no entra se parte en partes parejas (por ejemplo 3 + 3 en vez de 5 + 1) y los saltos originales se conservan.
5. Importá un archivo con tresillos: se dibujan con su corchete y el informe lo anota como nota.
6. `npm test` pasa en `core` y en `web`.

## Prueba manual de la etapa 6.1 (correcciones)

1. Importá *La nostalgiosa*: por defecto "Compases por línea" está en **Como el archivo** y las líneas coinciden con las de MuseScore (la primera lleva la anacrusa + 5 compases).
2. Cambiá a 4, 5… o Automático para repartir por tu cuenta; "Como el archivo" vuelve a los saltos originales.
3. A la derecha de cada línea aparece, chico, el número del último compás (la anacrusa no cuenta: el primer compás completo es el 1). Se apaga con **Numerar compases**.
4. Los corchetes de casilla quedaron mucho más cerca del cifrado de su propia línea.
5. En *Bien haiga* y *El coyuyo*, el "x3" aparece justo encima de la barra de fin de repetición (`:|`) que cierra la sección, y no al comienzo.
6. Una repetición sin barra de inicio (solo `:|`) se dibuja normal.
7. `npm test` pasa en `core` y en `web`.

## Prueba manual de la etapa 6

1. `npm install` y `npm run dev`.
2. Importá los tres archivos de `packages/core/test-data/`. El informe ya no avisa de repeticiones: dice "Estructura importada: …".
3. En la partitura debe verse:
   - barras de repetición con puntos (|: al inicio de sección y :| al final);
   - corchetes de casilla sobre los compases ("1. 2." y "3." en *Bien haiga*; "1." y "2." en *La nostalgiosa*), con gancho a la izquierda y cierre en la primera casilla y abierta la última;
   - dobles barras entre secciones y barra final al terminar;
   - "x3" al comienzo del compás y "D.C." al final del último.
4. En **Ejemplo largo** (compases 8 a 16 y 32) hay una doble barra, una repetición con casillas 1. y 2., "x2" y "D.C.".
5. Cambiá **Compases por línea** y el zoom: una casilla que cae entre dos líneas queda abierta del lado del corte.
6. "Ver los datos del modelo" tiene una columna **Estructura** con lo que cada compás tiene.
7. Metadatos: si el archivo trae título o compositor en las propiedades de la partitura (Archivo > Propiedades) se usan esos; si están vacíos o con el valor por defecto, se usan los de los créditos.
8. `npm test` pasa en `core` y en `web`.

## Prueba manual de la etapa 5 (sigue valiendo)

1. `npm install` y `npm run dev`.
2. Tocá **Importar MusicXML** y elegí un `.musicxml` exportado de MuseScore (sin comprimir).
3. Debe aparecer un informe ("Importado con N avisos") y la partitura importada, ya seleccionada, con título, autor y estilo, acordes encima, ligaduras y anacrusa.
4. Con los tres archivos de `packages/core/test-data/` se espera: tonalidad deducida de los acordes (E minor, G major, C major), compás 3/4, un aviso por las repeticiones y casillas que todavía no se interpretan, y una nota si la clave lleva cambio de octava.
5. Probá con un `.mxl` o un archivo que no sea MusicXML: debe mostrar un error claro sin romper la app.
6. `npm test` pasa en `core` y en `web`.

Arreglo incluido en esta versión: el ejemplo largo daba "IncompleteVoice" por cómo se declaraban los puntillos y la duración de cada compás ante VexFlow.

## Prueba manual de la etapa 4.1

1. `npm install` y `npm run dev`.
2. Elegí **Ejemplo largo**. Por defecto se ve con 4 compases por línea (la anacrusa no cuenta) y tamaño 85 %.
3. Mové el control **Tamaño**: al achicar entran más líneas en pantalla; al agrandar, menos y más grandes.
4. Cambiá **Compases por línea** (Automático, 3, 4, 5, 6, 8): cada línea lleva ese máximo; si no entran, lleva menos en lugar de desbordar.
5. Con una ventana de escritorio, a 70 % y 4 compases por línea deberían verse 5 o más líneas a la vez.
6. Achicá la ventana: se rehace el layout sin superposiciones.
7. `npm test` pasa en `core` y en `web`.

## Prueba manual de la etapa 4

Los puntos de la etapa 4 siguen valiendo (anacrusa, corcheas con barra, puntillos, silencios, ligaduras dentro y entre compases, F♯ y F♮ accidentales, cambio a G mayor en el compás 17, 3/4 desde el 25 y vuelta a C y 4/4 en el 29).
