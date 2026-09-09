# Atlas 3D · lista de comprobación manual

Los tests automáticos cubren los datos, la lógica y el marcado. Lo que **no**
pueden cubrir es lo que hace la GPU: si el sombreado se ve bien, si el rayo
acierta donde apunta el dedo y si la hoja inferior queda debajo de la barra del
navegador. Eso hay que mirarlo.

Marca cada casilla en un navegador real. Si algo falla, anota el navegador, el
tamaño de pantalla y qué estabas haciendo.

**Ruta:** SciVerse → barra lateral → **Explorar en 3D** → *Atlas del cuerpo
humano* / *Atlas oral y maxilofacial*.

---

## Antes de empezar

- [ ] `npm run build` termina sin errores.
- [ ] Servir `dist/` (por ejemplo `npm run preview`) — **no** `npm run dev`: el
      objetivo es probar lo mismo que recibe una docente.
- [ ] Abrir la pestaña de red y dejarla abierta durante la primera prueba.

---

## 1 · Carga (los dos atlas)

| # | Comprobación | Chrome | Edge |
|---|---|---|---|
| 1.1 | Al abrir **Inicio**, la red NO pide `three-*.js` ni `body-*.bin.gz` | ☐ | ☐ |
| 1.2 | Al entrar al atlas aparece «Preparando el atlas 3D…» con Kantu | ☐ | ☐ |
| 1.3 | Después cambia a «Cargando estructuras anatómicas…» y la barra avanza | ☐ | ☐ |
| 1.4 | En ningún momento hay pantalla en blanco | ☐ | ☐ |
| 1.5 | Se descargan 15 `body-*.bin.gz` + `atlas.json` + `atlas-es.json` | ☐ | ☐ |
| 1.6 | Al volver a Inicio y entrar de nuevo, **no** se vuelve a descargar nada | ☐ | ☐ |
| 1.7 | Cambiar del atlas humano al oral tampoco descarga de nuevo | ☐ | ☐ |

---

## 2 · Selección

| # | Comprobación | Chrome | Edge |
|---|---|---|---|
| 2.1 | Al pasar el ratón por encima, la estructura se aclara y el cursor pasa a mano | ☐ | ☐ |
| 2.2 | Al hacer clic, esa estructura gana un contorno verde azulado y **conserva su color base** | ☐ | ☐ |
| 2.3 | El resto del modelo **sigue visible** | ☐ | ☐ |
| 2.4 | El panel de información se abre solo y muestra el nombre correcto | ☐ | ☐ |
| 2.5 | Clic en el fondo (fuera del modelo) quita la selección | ☐ | ☐ |
| 2.6 | Arrastrar para girar **no** selecciona nada al soltar | ☐ | ☐ |
| 2.7 | La selección se mantiene después de girar | ☐ | ☐ |
| 2.8 | …después de hacer zoom | ☐ | ☐ |
| 2.9 | …después de apagar y encender sistemas | ☐ | ☐ |
| 2.10 | …después de aislar y salir del aislamiento | ☐ | ☐ |
| 2.11 | …después de entrar y salir de pantalla completa | ☐ | ☐ |
| 2.12 | Un clic sobre una estructura **oculta** selecciona la que hay detrás, no la oculta | ☐ | ☐ |
| 2.13 | El nombre del panel coincide con la estructura que se ve resaltada | ☐ | ☐ |

> **Prueba clave del rayo (2.13).** Gira hasta ver el modelo de perfil y haz
> clic en el borde de una estructura. Si el panel nombra otra cosa, el rayo
> está fallando y hay que anotarlo.

---

## 3 · Ficha de información

| # | Comprobación | Chrome | Edge |
|---|---|---|---|
| 3.1 | Sale nombre en español, sistema con su color e identificador FMA | ☐ | ☐ |
| 3.2 | Sale también el nombre original en inglés | ☐ | ☐ |
| 3.3 | **Tráquea** (busca «traquea») trae apartado «Descripción» | ☐ | ☐ |
| 3.4 | **Fémur derecho** NO trae «Descripción», y no queda hueco ni título suelto | ☐ | ☐ |
| 3.5 | «Localización» de la **mandíbula** lee: Cuerpo humano › Cabeza › … › Boca | ☐ | ☐ |
| 3.6 | «Grupos anatómicos» lista grupos reales, no «Órgano» ni «Entidad anatómica» | ☐ | ☐ |
| 3.7 | En ninguna ficha aparece `undefined`, `[object Object]` ni `NaN` | ☐ | ☐ |
| 3.8 | Al final se ven los créditos de BodyParts3D (CC BY 4.0) y de los dos proyectos MIT | ☐ | ☐ |
| 3.9 | El bloque «Para el aula» se distingue del resto (fondo verde claro) | ☐ | ☐ |

---

## 4 · Estructuras relacionadas

| # | Comprobación | Chrome | Edge |
|---|---|---|---|
| 4.1 | Selecciona «Arteria carótida común derecha»: aparece la izquierda como relacionada | ☐ | ☐ |
| 4.2 | Al pulsarla, la selección cambia a ella | ☐ | ☐ |
| 4.3 | La cámara se acerca a la nueva estructura | ☐ | ☐ |
| 4.4 | El panel se actualiza sin recargar la página | ☐ | ☐ |
| 4.5 | Si su sistema estaba apagado, se enciende y la estructura se ve | ☐ | ☐ |
| 4.6 | En el atlas oral, ninguna relacionada es de fuera de cabeza y cuello | ☐ | ☐ |

---

## 5 · Aislar

| # | Comprobación | Chrome | Edge |
|---|---|---|---|
| 5.1 | Apaga «Arterias» y «Venas», selecciona un hueso y pulsa **Aislar** | ☐ | ☐ |
| 5.2 | Sólo se ve esa estructura | ☐ | ☐ |
| 5.3 | Aparece el aviso ámbar «Estás viendo una estructura aislada» | ☐ | ☐ |
| 5.4 | La barra de acciones sigue funcionando (girar, zoom, centrar) | ☐ | ☐ |
| 5.5 | Al pulsar **Salir del aislamiento**, vuelven exactamente los sistemas que había: arterias y venas siguen apagadas | ☐ | ☐ |
| 5.6 | Escape también sale del aislamiento | ☐ | ☐ |
| 5.7 | Estando aislado, pulsar una estructura relacionada aísla la nueva | ☐ | ☐ |

---

## 6 · Ocultar y restaurar

| # | Comprobación | Chrome | Edge |
|---|---|---|---|
| 6.1 | Selecciona una estructura y pulsa **Ocultar**: desaparece | ☐ | ☐ |
| 6.2 | El contador del panel de sistemas baja en uno | ☐ | ☐ |
| 6.3 | Aparece «Restaurar ocultas (1)» | ☐ | ☐ |
| 6.4 | Oculta tres más: el contador dice (4) | ☐ | ☐ |
| 6.5 | Ocultar **no** ha cambiado qué sistemas están encendidos | ☐ | ☐ |
| 6.6 | **Restaurar ocultas** las devuelve todas y no toca los sistemas | ☐ | ☐ |
| 6.7 | Con la estructura oculta seleccionada, la ficha avisa «Esta estructura está oculta» | ☐ | ☐ |

---

## 7 · Centrar

| # | Comprobación | Chrome | Edge |
|---|---|---|---|
| 7.1 | **Centrar estructura** sobre un fémur: se encuadra completo, con aire | ☐ | ☐ |
| 7.2 | Sobre un diente: se acerca de verdad, no se queda diminuto | ☐ | ☐ |
| 7.3 | Sobre un nervio fino: también | ☐ | ☐ |
| 7.4 | El ángulo de la cámara no da un salto brusco | ☐ | ☐ |
| 7.5 | **Centrar modelo** (barra) devuelve el encuadre general | ☐ | ☐ |

---

## 8 · Búsqueda

| # | Comprobación | Chrome | Edge |
|---|---|---|---|
| 8.1 | «corazon» sin tilde encuentra resultados | ☐ | ☐ |
| 8.2 | «mandíbula» con tilde también | ☐ | ☐ |
| 8.3 | «mandible» (inglés) encuentra la mandíbula | ☐ | ☐ |
| 8.4 | «FMA52748» encuentra la mandíbula | ☐ | ☐ |
| 8.5 | Cada resultado muestra su FMA a la derecha | ☐ | ☐ |
| 8.6 | Al pulsar un resultado se selecciona, se centra y se limpia el buscador | ☐ | ☐ |
| 8.7 | Una búsqueda sin coincidencias dice «No encontramos ninguna estructura…» | ☐ | ☐ |
| 8.8 | Escribir es fluido, sin retardo perceptible | ☐ | ☐ |

---

## 9 · Sistemas, categorías y atajos

| # | Comprobación | Chrome | Edge |
|---|---|---|---|
| 9.1 | Atlas humano: 15 sistemas, cada uno con su cuenta | ☐ | ☐ |
| 9.2 | Apagar un sistema lo quita del modelo y baja el contador | ☐ | ☐ |
| 9.3 | «Ocultar todo» deja el lienzo vacío y el contador a 0 | ☐ | ☐ |
| 9.4 | «Mostrar todo» lo devuelve | ☐ | ☐ |
| 9.5 | Atlas oral: aparecen las 7 categorías pedidas | ☐ | ☐ |
| 9.6 | Atajos: Todas · Esqueleto · Dentición · Músculos · Nervios · Vasos | ☐ | ☐ |
| 9.7 | «Dentición» deja sólo los dientes y las encías (30) | ☐ | ☐ |
| 9.8 | Tocar una categoría a mano después de un atajo lo desmarca | ☐ | ☐ |
| 9.9 | El atlas oral abre encuadrado en cabeza y cuello, sin tronco ni piernas | ☐ | ☐ |

---

## 10 · Pantalla completa

| # | Comprobación | Chrome | Edge |
|---|---|---|---|
| 10.1 | El botón entra en pantalla completa y el modelo ocupa todo | ☐ | ☐ |
| 10.2 | La imagen no sale estirada al entrar ni al salir | ☐ | ☐ |
| 10.3 | El mismo botón sale | ☐ | ☐ |
| 10.4 | Escape sale | ☐ | ☐ |
| 10.5 | Al salir, la barra lateral de SciVerse sigue ahí y funciona | ☐ | ☐ |

---

## 11 · Minimizar paneles

| # | Comprobación | Chrome | Edge |
|---|---|---|---|
| 11.1 | La flecha del panel de sistemas lo pliega y el lienzo se ensancha | ☐ | ☐ |
| 11.2 | Vuelve a abrirse con la misma flecha | ☐ | ☐ |
| 11.3 | Lo mismo con el panel de información | ☐ | ☐ |
| 11.4 | Los botones «Sistemas» e «Información» de la barra los cierran y abren del todo | ☐ | ☐ |
| 11.5 | Con los dos cerrados, el modelo ocupa el ancho completo | ☐ | ☐ |

---

## 12 · Volver a SciVerse

| # | Comprobación | Chrome | Edge |
|---|---|---|---|
| 12.1 | Clic en «Mi biblioteca» sale del atlas y carga la biblioteca | ☐ | ☐ |
| 12.2 | Volver al atlas lo abre otra vez, sin descargas | ☐ | ☐ |
| 12.3 | Entrar y salir cinco veces no degrada el rendimiento ni da error de contexto WebGL | ☐ | ☐ |

> **12.3 es la prueba de fugas.** Con las herramientas de desarrollo abiertas,
> repite entrar/salir cinco veces y mira la consola: si aparece «Too many
> active WebGL contexts», el `destruir()` no está soltando algo.

---

## 13 · Móvil

Prueba en Chrome de Android o en el emulador con **el modo táctil activado**
(el emulador con ratón no reproduce los gestos).

### 360 × 800

| # | Comprobación | ☐ |
|---|---|---|
| 13.1 | El modelo ocupa casi toda la pantalla | ☐ |
| 13.2 | No hay scroll horizontal en ningún momento | ☐ |
| 13.3 | Arrastrar con un dedo gira | ☐ |
| 13.4 | Pellizcar con dos dedos acerca y aleja | ☐ |
| 13.5 | Dos dedos arrastrando desplazan el modelo | ☐ |
| 13.6 | Un toque limpio selecciona | ☐ |
| 13.7 | Al seleccionar sube una ficha inferior **plegada** con nombre y categoría | ☐ |
| 13.8 | Los tres botones (Centrar · Aislar · Ocultar) son cómodos de pulsar | ☐ |
| 13.9 | La flecha despliega la ficha completa | ☐ |
| 13.10 | Con la ficha abierta se puede seguir girando el modelo por encima | ☐ |
| 13.11 | La X cierra la ficha | ☐ |
| 13.12 | La barra de acciones flotante no queda tapada por la barra del navegador | ☐ |
| 13.13 | Ningún botón queda bajo la barra de gestos del sistema | ☐ |

### 390 × 844

| # | Comprobación | ☐ |
|---|---|---|
| 13.14 | Todo lo anterior | ☐ |
| 13.15 | El subtítulo del atlas no ocupa más de dos líneas | ☐ |

### 430 × 932

| # | Comprobación | ☐ |
|---|---|---|
| 13.16 | Todo lo anterior | ☐ |
| 13.17 | La ficha desplegada deja ver al menos un tercio del modelo | ☐ |

### Pantalla completa en móvil

| # | Comprobación | ☐ |
|---|---|---|
| 13.18 | El botón funciona (con Fullscreen API o con el modo inmersivo de respaldo) | ☐ |
| 13.19 | Se puede salir | ☐ |
| 13.20 | Al salir, la navegación de SciVerse sigue funcionando | ☐ |

> En iPhone la Fullscreen API no se concede a un `div`: lo esperado es que
> entre el **modo inmersivo** de SciVerse, que ocupa la ventana entera. Si no
> pasa ninguna de las dos cosas, anótalo.

---

## 14 · Rendimiento

| # | Comprobación | Escritorio | Móvil |
|---|---|---|---|
| 14.1 | Girar el modelo es fluido | ☐ | ☐ |
| 14.2 | Con el modelo quieto, el uso de CPU baja casi a cero | ☐ | ☐ |
| 14.3 | Seleccionar responde al instante, sin tirón | ☐ | ☐ |
| 14.4 | Pasar el ratón por encima no ralentiza el giro | ☐ | — |
| 14.5 | El móvil no se calienta de forma llamativa en cinco minutos | — | ☐ |

> **14.2** es la comprobación de que sólo se redibuja cuando algo cambia. Si la
> CPU se mantiene alta con el modelo parado, el bucle está pintando de más.

---

## 15 · Accesibilidad

| # | Comprobación | ☐ |
|---|---|---|
| 15.1 | Tabulando se llega al lienzo y se ve el foco | ☐ |
| 15.2 | Con el lienzo enfocado, las flechas giran y `+`/`-` acercan | ☐ |
| 15.3 | Todos los botones de la barra tienen tooltip en escritorio | ☐ |
| 15.4 | Un sistema apagado se distingue sin mirar el color (icono de ojo tachado) | ☐ |
| 15.5 | Con «reducir movimiento» activado en el sistema, la hoja inferior no se anima | ☐ |
| 15.6 | Con un lector de pantalla, el progreso de carga se anuncia | ☐ |

---

## 16 · Errores

| # | Comprobación | ☐ |
|---|---|---|
| 16.1 | Con la red cortada al entrar, sale «No pudimos cargar el atlas 3D» y un botón de reintento | ☐ |
| 16.2 | Al restaurar la red, el reintento funciona | ☐ |
| 16.3 | En un navegador sin WebGL sale el aviso de dispositivo, sin botón de reintento inútil | ☐ |
| 16.4 | Ningún mensaje enseña texto técnico, `undefined` ni una traza | ☐ |

> Para 16.3, en Chrome: `chrome://flags` → *Disable WebGL*. En Edge, ejecutar
> con `--disable-3d-apis`.

---

## Registro

| Fecha | Navegador / dispositivo | Bloques probados | Incidencias |
|---|---|---|---|
| | | | |

---

## 17 · Los dos bugs de produccion (verificacion dirigida)

Estos dos se reportaron desde produccion. Son la prueba mas importante de la
lista: si alguno vuelve, el atlas es inusable.

### 17.1 · La camara no se mueve al seleccionar

| # | Comprobación | Humano | Oral |
|---|---|---|---|
| a | Entrar al atlas y esperar a que cargue | ☐ | ☐ |
| b | Girar el modelo a una orientacion cualquiera | ☐ | ☐ |
| c | Hacer zoom hasta una zona concreta (abdomen, brazo, un diente) | ☐ | ☐ |
| d | Hacer clic sobre una estructura | ☐ | ☐ |
| e | **La estructura se resalta** | ☐ | ☐ |
| f | **La camara NO se mueve**: mismo angulo, misma distancia, mismo centro | ☐ | ☐ |
| g | El panel de informacion se abre con esa estructura | ☐ | ☐ |
| h | Hacer clic en otra: la camara sigue igual | ☐ | ☐ |
| i | Cinco selecciones seguidas: la camara nunca se mueve | ☐ | ☐ |
| j | Con la rueda, tras seleccionar: el zoom parte de donde estaba | ☐ | ☐ |
| k | Con pinch tactil, idem | ☐ | ☐ |
| l | Seleccionar una pieza pequeña (un nervio, un diente) tampoco la mueve | ☐ | ☐ |

Y las que SI deben moverla:

| # | Comprobación | ☐ |
|---|---|---|
| m | Con algo seleccionado, **Centrar estructura** acerca a esa pieza | ☐ |
| n | El angulo se conserva al centrar: no da un salto brusco | ☐ |
| o | **Centrar modelo** devuelve el encuadre general | ☐ |
| p | **Restablecer vista** devuelve angulo y distancia iniciales | ☐ |
| q | **Restablecer vista** NO cambia que sistemas estan encendidos | ☐ |
| r | Buscar una estructura y pulsarla SI acerca a ella (se eligio de una lista, sin verla) | ☐ |
| s | Pulsar una «estructura relacionada» tambien acerca | ☐ |

> **f es el bug.** Antes: zoom al abdomen, clic en un musculo y la vista
> volvia al cuerpo completo. La causa era que el visor se destruia y se
> reconstruia en cada re-render de React.

### 17.2 · Piel y anexos

| # | Comprobación | ☐ |
|---|---|---|
| a | Al abrir el atlas humano, **el cuerpo NO esta cubierto de piel** | ☐ |
| b | En Sistemas, «Piel y anexos» aparece con el ojo tachado | ☐ |
| c | Activarla: aparecen la piel, las cejas, el vello y el labio (5 estructuras) | ☐ |
| d | Desactivarla: **desaparecen de verdad** | ☐ |
| e | Con la piel apagada, abrir y cerrar el panel de Sistemas: sigue apagada | ☐ |
| f | Con la piel apagada, entrar y salir de pantalla completa: sigue apagada | ☐ |
| g | Con la piel apagada, pasar el raton por el modelo: sigue apagada | ☐ |
| h | Con la piel apagada, seleccionar varias estructuras: sigue apagada | ☐ |
| i | **Restablecer vista** no la vuelve a encender | ☐ |
| j | **Restaurar visibilidad** la deja apagada (es su estado de arranque) | ☐ |
| k | **Mostrar todo** SI la enciende | ☐ |
| l | Buscar «piel» y pulsarla: se enciende su sistema y se ve | ☐ |
| m | El contador de visibles cuadra con lo que se ve en pantalla | ☐ |

> **e, f y g eran el bug**: el panel decia OFF y la malla seguia encendida,
> porque el visor se reconstruia con todo visible y la visibilidad solo se
> reaplicaba si además cambiaba el conjunto de visibles.

### 17.3 · Aislar, ocultar y seleccionar no se mezclan

| # | Comprobación | ☐ |
|---|---|---|
| a | Apagar Arterias y Venas. Seleccionar un hueso. **Aislar** | ☐ |
| b | Solo se ve ese hueso, y aparece el aviso ambar | ☐ |
| c | La camara **no** se movio al aislar | ☐ |
| d | Girar y hacer zoom estando aislado: funciona | ☐ |
| e | **Salir del aislamiento**: Arterias y Venas siguen apagadas | ☐ |
| f | La camara sigue donde la dejaste | ☐ |
| g | Aislado, pulsar una relacionada: se aisla la nueva | ☐ |
| h | Seleccionar y **Ocultar**: desaparece y la seleccion se limpia | ☐ |
| i | Ocultar no apago su sistema: las demas piezas siguen ahi | ☐ |
| j | **Restaurar ocultas** no cambia que sistemas estan encendidos | ☐ |
| k | Escape sale del aislamiento; otra vez, quita la seleccion | ☐ |

### 17.4 · El resaltado

| # | Comprobación | ☐ |
|---|---|---|
| a | La estructura seleccionada conserva su color base | ☐ |
| b | Lo que destaca es el contorno, en verde azulado | ☐ |
| c | No es blanco solido ni amarillo fluorescente | ☐ |
| d | Un musculo seleccionado sigue pareciendo un musculo | ☐ |
| e | Al seleccionar otra, la primera vuelve a su aspecto normal | ☐ |
| f | Al quitar la seleccion, todo vuelve a su aspecto normal | ☐ |
| g | Pasar el raton por encima aclara sin cambiar el color | ☐ |
| h | Cambiar de seleccion es instantaneo: no hay parpadeo ni negro | ☐ |

> **h** es la prueba de que no se reconstruye la escena. Si hay un parpadeo o
> el modelo desaparece un instante, el visor se esta recreando otra vez.
