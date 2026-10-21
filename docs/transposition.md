# Transposición: cómo funciona

Código: `packages/core/src/transpose/`. Es lógica pura (sin React ni VexFlow) y se prueba por separado.

## Idea central: la línea de quintas
Cada nombre de nota "escrito" es un entero: F = -1, C = 0, G = 1, D = 2, A = 3, E = 4, B = 5; cada sostenido suma 7 y cada
bemol resta 7 (F# = 6, Bb = -2). **Transponer los nombres es sumar una constante**, la misma que gira la armadura en el
círculo de quintas. Por eso melodía y armadura nunca se desincronizan y no hay reemplazos de texto ni alteraciones
sueltas nota por nota: la nueva armadura aparece y las notas reciben las alteraciones que corresponden a ella.

Una transposición son dos números coherentes (`Transposition`):
- `fifths`: cuánto se mueve el nombre en la cadena de quintas (define la grafía: C# o Db);
- `semitones`: cuánto se mueve el sonido, con signo (define la octava). Siempre `semitones ≡ 7·fifths (mod 12)`.

## Intervalo y dirección
`transpositionBetween(origen, destino, opciones)`:
- `fifths = quintas(destino) − quintas(origen)`.
- Por defecto se elige el intervalo **más corto** (C → G baja una cuarta; C → F# sube un tritono). `direction: 'up' | 'down'`
  fuerza el sentido y `octaves` suma octavas (para acomodar el registro).
- La tonalidad destino debe ser **del mismo modo** que la original.

## Casos delicados
- **Tonalidades fuera de rango:** si girar la armadura pasara de 7 sostenidos o bemoles (B mayor + tercera mayor = D# mayor),
  se usa la enarmónica (Eb mayor) y las notas de esa región adoptan la misma grafía.
- **Dobles alteraciones:** si una nota pidiera una triple (G###), se escribe con la grafía equivalente (A#).
- **Cambios de tonalidad dentro de la partitura:** cada región se transpone con la misma altura real pero con la grafía
  de su propia armadura.
- **Octavas:** si una nota saliera del rango soportado (octavas -1 a 9), se lanza un error con el número de compás.

## `transposeScore(score, destino, opciones)`
Devuelve una `Score` **nueva** (la original no se toca). En la derivada, `originalKey` es la tonalidad en que está
escrita ahora y `transposition` (`from`, `fifths`, `semitones`) guarda el origen; al transponer dos veces se componen.
Cambian: alturas de las notas, armadura inicial y armaduras de los cambios de tonalidad. Se conserva todo lo demás
(duraciones, ligaduras, tresillos, estructura, textos, tempo).

## Acordes
`transposeChord(acorde, transposición)` transpone **por componentes**, nunca reemplazando texto:
- raíz y bajo (inversión) con el mismo desplazamiento que la melodía y la misma grafía: en E mayor, `Am` → `C#m` (no `Dbm`);
- la **calidad** y el **sufijo** (`m7`, `-7`, `Δ7`, `7b9`, `6/9`…) no cambian, así que se conserva el estilo del autor;
- el texto se **regenera** desde la estructura; si el original usaba ♯/♭ el nuevo también.

Ejemplo: C – Am – F – G → E – C#m – A – B; en Eb mayor: Eb – Cm – Ab – Bb; `C/E` → `E/G#`.
Dentro de `transposeScore`, cada acorde usa la transposición de la región de su compás, así que en una región con otra
tonalidad (o enarmónica) la grafía de los acordes coincide con la de su armadura. La posición del acorde en el compás no cambia.

## Interfaz (etapa 10)
La partitura guardada nunca cambia: lo que se dibuja es una **vista derivada** (`viewScore`) según lo que el usuario elige:
- **Mostrar en:** las 15 tonalidades del modo de la partitura, ordenadas por la tónica y con su armadura; las enarmónicas
  (F♯/G♭, C♯/D♭, B/C♭) aparecen separadas. La original está marcada.
- **Octava:** +/− hasta tres octavas, para acomodar el registro.
- **Modo de la tonalidad original:** corrige el modo si el archivo no lo indicaba y se dedujo mal de los acordes
  (por ejemplo, una armadura de un sostenido puede ser G mayor o E menor). Cambia la tónica sobre la que se transpone,
  y la tonalidad destino vuelve a la original. Es solo de la vista: todavía no se guarda.
- **Volver al original** deja todo como está guardado. El encabezado indica "transpuesta desde … (+4 semitonos)".
- Si una nota se sale del rango de octavas, se avisa con el número de compás y se sigue mostrando la partitura sin transponer.
