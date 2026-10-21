# Importador MusicXML: decisiones

Entrada: MusicXML **sin comprimir** `score-partwise` (como exporta MuseScore con "MusicXML sin comprimir").
Código: `packages/core/src/musicxml/`. Archivos de referencia reales: `packages/core/test-data/`.

El importador nunca lanza: devuelve `{ ok, score?, report }`. El informe lista errores, avisos y notas;
la interfaz lo muestra siempre después de importar.

## Qué se rechaza (con mensaje claro)
- `.mxl` (comprimido), XML mal formado (con número de línea), `score-timewise`, otros formatos.
- Partituras sin ninguna nota con altura.

## Qué parte, voz y pentagrama se importan
- **Parte:** la primera que tenga notas con altura. Si hay más, se avisa cuáles se ignoran.
- **Pentagrama:** el de menor número que tenga notas. **Voz:** la de menor número dentro de ese pentagrama.
- Las notas de otras voces/pentagramas se cuentan y se informan; el resto de la melodía mantiene su posición
  temporal (se respetan `<backup>` y `<forward>`).
- Notas simultáneas (`<chord/>`): se conserva la primera. Notas de adorno y sin altura: se ignoran y se informa.

## Metadatos
Prioridad: **metadatos del archivo** y, si están vacíos o tienen el valor por defecto de MuseScore, **créditos**.
- **Título:** `work-title` (o `movement-title`) salvo el genérico "Partitura sin título"; si no, el `<credit>` `title`
  (si tampoco es genérico); si no, el nombre del archivo (se informa).
- **Autor:** `<creator type="composer">` salvo el genérico "Compositor / arreglista"; si no, el `<credit>` `composer`.
- **Estilo:** `<credit>` `subtitle` (MuseScore lo usa para "Chacarera", "Escondido"…). Es editable más adelante.

## Tonalidad
- Armadura: `<fifths>` del primer compás. Cambios posteriores se guardan en el compás donde ocurren.
- **Modo:** MuseScore no escribe `<mode>`. Si falta se **infiere de los acordes**: se mira el último acorde
  (y si no decide, el primero); si su raíz es la tónica menor de la armadura y es de la familia menor → menor;
  si es la tónica mayor y no es menor → mayor. Si nada decide, se asume mayor y se **advierte**.
  Siempre se informa cómo se decidió, porque el modo define la tónica y por tanto la transposición.

## Compás, clave y tempo
- Compás: `<time>` inicial; cambios en el compás donde ocurren.
- **Clave:** solo clave de sol (línea 2). El cambio de octava (`clef-octave-change`, p. ej. -1 en clave de guitarra)
  se guarda en `Score.clef`. Las alturas del modelo son las que **suenan**; el renderer las dibuja desplazadas
  según la clave. Otras claves o cambios de clave: se avisa.
- **Tempo:** `<metronome>` (figura y pulsos por minuto) o, si no, `<sound tempo>` (negras por minuto). Se usa el inicial.

## Anacrusa
El primer compás se marca como anacrusa si es más corto que el compás (`implicit="yes"` no es imprescindible).

## Acordes (`<harmony>`)
- Se arma el texto `raíz + sufijo + /bajo` y se pasa por `parseChord`, así que el modelo es el mismo que al tipear.
- El sufijo es el atributo `text` de `<kind>` si existe (estilo del autor: `m7`, `-7`, `Δ`…); si no, el estándar del `kind`.
- Posición dentro del compás: tiempo acumulado de las notas previas (+ `<offset>` si existe).
- `<degree>` (alteraciones extra) se ignora con una nota en el informe; N.C. se ignora.

## Repeticiones, casillas, barras y textos
- `<repeat direction="forward">` → `Measure.startRepeat`; `backward` → `endRepeat`. Una repetición puede no tener inicio (se vuelve al principio de la sección): no es un error; el fin siempre está.
- **Veces de repetición:** el atributo `times` de `<repeat>` o, como hace MuseScore, un texto `x3`/`3x` que se escribe al comienzo de la sección: ese texto se asocia a la **barra de fin de repetición siguiente** y se guarda en `repeatTimes`; se dibuja justo encima de esa barra.
- `<ending type="start">` → `endingStart` (con el texto que muestra el autor: "1.", "1. 2.", "3."); `stop` → `endingEnd: 'closed'`;
  `discontinue` → `'open'` (la última casilla, sin cierre). Una casilla va desde su inicio hasta su fin (`endingSpans`).
- `<bar-style>` de la barra derecha, sin repetición: `light-light` → `endBarline: 'double'` (separa secciones);
  `light-heavy` → `'final'`.
- `<words>` de navegación (`D.C.`, `D.S.`, `Fine`, `Coda`, `Segno`…) → `Measure.texts`. Los saltos que solo vienen
  como atributo de `<sound>` (`dacapo`, `dalsegno`, `tocoda`…) generan el texto equivalente. Otros textos se ignoran con una nota.
- Las repeticiones, casillas y D.C. se **dibujan** pero todavía no se **interpretan** (no hay reproducción ni "desplegado").

## Saltos de línea y numeración
- `<print new-system="yes">` / `new-page="yes"` → `Measure.newSystem` (salvo en el primer compás). La vista usa por defecto esos saltos
  ("Como el archivo"); si una línea no cabe en el ancho se parte, y si el archivo no trae saltos se usan 4 compases por línea.
- **Numeración propia:** la anacrusa es el compás 0 y el primer compás completo es el 1, sin importar cómo numere el archivo.
  En pantalla se muestra solo el número del último compás de cada línea, a la derecha.

## Tresillos y grupos irregulares
- `<time-modification>` (`actual-notes`/`normal-notes`) + las marcas `<notations><tuplet type="start|stop">` → `tuplet` en cada nota o silencio
  del grupo (`actual`, `normal`, `start`, `stop`). La duración guardada es la **exacta** (una corchea de tresillo = 1/12);
  la figura con la que se escribe (corchea) se calcula con `notatedDuration`. Los compases se validan con las duraciones exactas.
- Se dibujan con el corchete y el número de VexFlow; un silencio puede formar parte de un grupo.

## Compás de silencio completo
Un compás con un único silencio de la duración del compás (`<rest measure="yes"/>`) se dibuja como silencio de redonda, en cualquier compás.

## Ligaduras
`<tie>`: start/stop → `Note.tie` (`start`, `stop`, o `continue` si cierra una y abre otra).

## Lo que todavía se ignora (y se informa)
Textos de dirección que no son de navegación, ornamentos, notas de adorno, silencios de varios compases (`<multiple-rest>`).
