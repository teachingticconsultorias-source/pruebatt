# 17 — Funcionalidades ausentes

Funciones que no existen y que mejorarían la plataforma. Cada una explica **por qué**, no solo **qué**.

### Clasificación

| Categoría | Criterio |
|---|---|
| **Necesaria** | Sin ella el producto está incompleto o incumple una obligación |
| **Importante** | Mejora sustancialmente retención, valor o eficiencia |
| **Nice-to-have** | Aporta, pero no cambia la trayectoria del producto |
| **No recomendada** | Parece buena idea y no lo es en este contexto |

---

## 1. NECESARIAS

### N1 · Editar el material generado

**Qué falta.** El visor (`App.jsx:3521`) es solo lectura. No se puede cambiar una palabra.

**Por qué es necesaria.** Ninguna IA acierta al 100 % en contexto pedagógico. La docente **siempre** querrá ajustar un criterio, adaptar un material o cambiar una pregunta. Hoy sus opciones son regenerar (otro crédito, resultado distinto) o editar el Word descargado (perdiendo la copia de la plataforma).

Es la razón principal por la que SciVerse se usa como generador de un solo uso en lugar de como espacio de trabajo. **Sin edición no hay hábito, y sin hábito no hay retención.**

**Alcance mínimo.** Edición en línea campo a campo con guardado automático, más regeneración por sección a coste reducido.

**Esfuerzo L · Depende de:** `material_versions` (`07-` §6.5)

---

### N2 · Reenviar el correo de confirmación

**Qué falta.** La pantalla de confirmación (`AuthGate.jsx:215`) solo ofrece "Ya confirmé mi cuenta".

**Por qué es necesaria.** Los correos de Supabase van a spam con frecuencia, más aún con dominios institucionales peruanos. Si no llega, la docente **no tiene ninguna acción disponible**: ni reenviar, ni corregir el correo, ni contactar soporte. La cuenta se pierde.

Es una fuga invisible: nadie se queja, simplemente no vuelven.

**Alcance mínimo.** `supabase.auth.resend()` con cuenta atrás de 60 s, opción de corregir el correo, aviso de spam y enlace a soporte.

**Esfuerzo S**

---

### N3 · Eliminar la cuenta y exportar los datos

**Qué falta.** No existe ninguna opción, y `docentes` **no tiene política de DELETE**.

**Por qué es necesaria.** La Ley 29733 de Protección de Datos Personales del Perú reconoce el derecho de cancelación. El producto recoge nombre, correo, celular e institución de docentes identificables.

**Alcance mínimo.** "Descargar mis datos" (JSON con perfil y materiales) y "Eliminar mi cuenta" con doble confirmación y borrado en cascada.

**Esfuerzo M**

---

### N4 · Autoguardado de los formularios

**Qué falta.** Los asistentes de 3 pasos viven solo en `useState`. Recargar, navegar o cerrar la pestaña borra todo.

**Por qué es necesaria.** Rellenar propósito, contexto y evidencia lleva varios minutos de escritura reflexiva. Perderlo por un toque accidental en móvil es la peor experiencia que puede tener el producto — y ocurre en la fase de mayor inversión de la docente.

**Alcance mínimo.** `localStorage` con debounce de 500 ms, clave por generador, y aviso al volver: "Tenías una sesión a medias. ¿Continuar?".

**Esfuerzo S**

---

### N5 · Onboarding del primer uso

**Qué falta.** Tras el primer login se cae directo al dashboard, sin bienvenida ni guía.

**Por qué es necesaria.** El dashboard de producción muestra cuatro categorías equivalentes. Una docente que entra por primera vez no sabe por dónde empezar. El momento de valor —tener una sesión en Word— queda a varios clics sin señalizar.

Y como efecto secundario valioso: el onboarding es el sitio natural para capturar grados y áreas, que **precargan todos los formularios posteriores**.

**Alcance mínimo.** Tres pantallas omitibles: ¿qué enseñas? → así funciona → crea tu primera sesión con el formulario ya lleno.

**Objetivo medible:** del registro al primer `.docx` en menos de 5 minutos.

**Esfuerzo L**

---

### N6 · Indicador de créditos visible

**Qué falta.** `/api/credits` y `CreditsIndicator.jsx` existen y funcionan; **el componente nunca se importa**.

**Por qué es necesaria.** La docente descubre su límite al chocar con él, a mitad de tarea, sin saber cuándo se renueva — aunque `next_reset` ya viene en la respuesta de la RPC.

**Alcance mínimo.** Importar el componente y ponerlo en la barra superior. Aviso al llegar a 1 restante.

**Esfuerzo XS** — el trabajo ya está hecho.

---

### N7 · Que el plan pagado cambie algo

**Qué falta.** `docentes.plan` existe con default `'gratuito'` y **nadie lo lee**. `ai_weekly_limit` es 5 para todos.

**Por qué es necesaria.** Hoy una docente puede pagar S/20 por WhatsApp y **no obtener nada automáticamente**: alguien tiene que entrar a Supabase y editar su fila a mano. Si se olvida, la clienta pagó y sigue limitada.

Es un fallo de negocio, no de producto: el sistema de cobro no está conectado a lo que se cobra.

**Alcance mínimo.** Leer `plan` al iniciar sesión, derivar `ai_weekly_limit` de la tabla `plans` (`07-` §6.3), y permitir cambiar el plan desde el admin.

**Esfuerzo M · Depende de:** `plans` y admin V2

---

### N8 · Guardado visible con reintento

**Qué falta.** `saveTeacherMaterial` va en `try/catch{console.error}` en las tres rutas principales.

**Por qué es necesaria.** La docente ve el resultado y asume que está guardado. Si falló, no aparece nunca en su biblioteca y nadie se lo dice. Descubre la pérdida días después.

**Alcance mínimo.** Estado visible ("Guardando…" → "Guardado ✓" → "No se pudo guardar ⚠"), reintento, y descarga inmediata como salida de emergencia.

**Esfuerzo S**

---

## 2. IMPORTANTES

### I1 · Enrutamiento con URLs reales

**Por qué.** Sin URLs no se puede compartir un recurso, el botón Atrás expulsa de la aplicación, recargar pierde el sitio, y el soporte no puede decir "entra a este enlace".

También bloquea otras funciones: páginas legales con URL propia, campañas con enlaces directos, y analítica por página.

**Esfuerzo M**

---

### I2 · Continuar donde lo dejaste

**Por qué.** La planificación docente es semanal y continua. Un producto que no recuerda en qué estabas obliga a: Biblioteca → buscar → abrir → descubrir que no se puede editar.

Es el mayor obstáculo a la retención semanal. La consulta ya existe en la versión del repositorio (`App.jsx:3699`); el codemod la eliminó del dashboard de producción.

**Esfuerzo M**

---

### I3 · Colecciones para organizar el trabajo

**Por qué.** Una docente activa acumula decenas de materiales por bimestre. Con una lista plana ordenada por fecha, la biblioteca se vuelve un montón indiferenciado y deja de usarse.

Agrupar por "Unidad 3 - Ecosistemas" o "4.º B" es como piensa realmente el trabajo docente.

**Esfuerzo M · Depende de:** `collections` (`07-` §6.9)

---

### I4 · Favoritos sincronizados

**Por qué.** Hoy viven en `localStorage`. Una docente que guarda 15 actividades en la computadora del colegio no las ve en su celular, y limpiar el navegador las borra sin aviso.

**Esfuerzo S · Depende de:** tabla `favoritos`

---

### I5 · Historial de generaciones

**Por qué.** Si la docente cierra la pestaña durante la generación, o el guardado falla, el resultado **se pierde sin rastro**. No hay forma de recuperarlo ni de saber que existió.

Además habilita: reintentar una generación fallida, comparar dos versiones, y —del lado del negocio— calcular el coste real por docente y detectar abuso.

**Esfuerzo M · Depende de:** `ai_generations` (`07-` §6.6)

---

### I6 · Reintento por módulo en la generación

**Por qué.** Fallar en el módulo 4 de 4 tira tres llamadas exitosas a Gemini y todo el trabajo de la docente. Sin reintento, sin reanudación, sin guardado parcial.

**Esfuerzo M**

---

### I7 · Correo semanal de retorno

**Por qué.** Nada trae de vuelta a la docente: sin correos, sin notificaciones, sin resumen. El producto depende por completo de que se acuerde sola.

El domingo por la tarde es el momento natural de planificar la semana. Un correo con "tus 5 creaciones se renovaron · tienes 3 sesiones de la semana pasada" encaja con el ritmo real del trabajo docente.

**Esfuerzo M**

---

### I8 · Buscador global

**Por qué.** Con 17 actividades, 10 herramientas y N materiales propios, navegar por menús es más lento que escribir. Hoy solo hay búsqueda dentro de la biblioteca, y limitada a los 100 registros cargados.

**Esfuerzo M · Depende de:** búsqueda en servidor

---

### I9 · Guía de observación y cuestionario en la interfaz

**Por qué.** Los esquemas y el endpoint **ya existen** (`api/generate-session-resource.js`), pero ninguna interfaz los expone. Son dos instrumentos que los docentes peruanos usan habitualmente y que están construidos a medias.

**Esfuerzo S** — solo falta añadirlos al catálogo.

---

### I10 · Ayuda contextual

**Por qué.** Términos como DUA, enfoques transversales, evidencia de aprendizaje o criterio observable aparecen en los formularios sin explicación. Una docente con menos formación en el CNEB actual queda fuera.

**Esfuerzo S**

---

### I11 · Papelera de 30 días

**Por qué.** `deleteMaterial` borra definitivamente tras un `window.confirm` que se acepta por inercia. Y el botón de eliminar está pegado al de duplicar, con objetivos táctiles pequeños.

**Esfuerzo S**

---

### I12 · Panel de administración con roles

**Por qué.** Sin él no se puede confirmar un pago, desactivar una cuenta ni ver cuánto se gasta en IA — las tres operaciones diarias del negocio. Ver `13-`.

**Esfuerzo L**

---

### I13 · Analítica de producto

**Por qué.** Hoy no se sabe cuántos completan el registro, cuántos generan su primera sesión, ni cuántos vuelven. Todas las decisiones de producto son a ciegas. Ver `19-`.

**Esfuerzo M**

---

### I14 · Vincular instrumento y sesión

**Por qué.** La interfaz ofrece "Crear instrumento desde esta sesión", pero **la relación no se guarda**. En la biblioteca aparecen como dos materiales sin conexión.

`parent_id` (`07-` §6.4) lo resuelve y habilita "ver todo lo de esta clase".

**Esfuerzo S**

---

### I15 · Compartir material con otra docente

**Por qué.** Los docentes trabajan en equipos por grado y área. Compartir una sesión con una colega es la forma natural de difusión — y el canal de crecimiento orgánico más barato.

**Esfuerzo M · Depende de:** router

---

## 3. NICE-TO-HAVE

| # | Función | Por qué aporta | Por qué no es prioritaria | Esfuerzo |
|---|---|---|---|---|
| NH1 | Sentido de progreso ("tu año en SciVerse") | Hace visible el valor acumulado; una constancia sirve para el portafolio docente | No desbloquea nada; con pocos usuarios activos el dato es pobre | M |
| NH2 | Plantillas a partir de materiales propios | Reutilizar la estructura de una buena sesión | Duplicar ya cubre el 80 % | M |
| NH3 | Modo oscuro | Solicitado con frecuencia | Requiere el sistema de diseño terminado primero | M |
| NH4 | Exportar a PDF | Algunas instituciones lo piden | Word ya cubre el caso y se puede convertir | S |
| NH5 | Exportar a PowerPoint | Prometido en `PLANS` | No hay demanda demostrada | L |
| NH6 | Crucigrama real | Completaría la categoría "Juegos" | **Primero hay que retirar la versión falsa** | M |
| NH7 | Más actividades STEAM | Amplía el catálogo | Las 17 actuales no están agotadas por los usuarios | M |
| NH8 | Integración con Google Drive | Anunciada en Mi cuenta | Complejidad OAuth alta; descargar y subir ya funciona | L |
| NH9 | Comentarios entre docentes | Comunidad | Requiere masa crítica que aún no existe | L |
| NH10 | Aplicación móvil nativa | Mejor experiencia en celular | La web responsive cubre el caso; duplica el mantenimiento | XL |
| NH11 | Trabajo sin conexión (PWA) | Útil en colegios con mala conexión | La generación necesita red igualmente | L |
| NH12 | Generación por voz | Accesibilidad y rapidez | Sin evidencia de demanda | L |
| NH13 | Chat con Kantu | Coherente con la mascota | Un chat abierto es caro y difícil de acotar pedagógicamente | L |

---

## 4. NO RECOMENDADAS

### NR1 · Gestión de suscripciones con renovación automática

**Por qué no.** El pago es manual por Yape/Plin confirmado por WhatsApp (`App.jsx:2825`). Una tabla `subscriptions` con ciclos y renovaciones sería un modelo de datos que nadie mantiene correctamente, generando estados inconsistentes.

**Cuándo reconsiderar.** Cuando exista una pasarela real (Culqi, Niubiz, Mercado Pago). Hasta entonces, `plans` + `profiles.plan_id` es suficiente.

---

### NR2 · Migrar a Next.js

**Por qué no.** Es la recomendación reflexiva ante una SPA de Vite en Vercel, y aquí no está justificada. Los beneficios reales de Next —renderizado en servidor y rutas de API integradas— ya se cubren: la landing es la única página que necesitaría SEO, y las funciones de `/api` ya funcionan.

El coste sería una migración completa mientras los P0 siguen abiertos.

**Cuándo reconsiderar.** Si la landing se convierte en un canal de contenidos con blog y páginas por región o área.

---

### NR3 · Migrar a TypeScript ahora

**Por qué no.** Habría evitado bugs reales (`C.violet` devolviendo naranja, accesos anidados sin comprobar). Pero migrar 8.900 líneas mientras el build reescribe el código fuente y no hay pruebas es multiplicar el riesgo.

**Cuándo reconsiderar.** Después de eliminar el codemod y dividir `App.jsx`. Y entonces, gradualmente: primero `lib/` y `hooks/`, no todo de golpe.

---

### NR4 · Panel para instituciones

**Por qué no.** Requiere la tabla `institutions`, jerarquía de permisos, agregación por colegio y facturación institucional. Es un producto distinto.

**Cuándo reconsiderar.** Cuando exista una decisión comercial de vender a colegios completos y al menos un cliente piloto.

---

### NR5 · Marketplace de materiales entre docentes

**Por qué no.** Necesita moderación, control de calidad, derechos de autor y masa crítica. Con los usuarios actuales sería un catálogo vacío.

**Cuándo reconsiderar.** Con miles de docentes activos y materiales de calidad verificada.

---

### NR6 · Gamificación con puntos e insignias

**Por qué no.** El público son profesionales resolviendo una tarea laboral bajo presión de tiempo. Puntos y medallas pueden leerse como infantilización y restar credibilidad ante la dirección del colegio.

**Alternativa mejor.** NH1 (progreso profesional con constancia descargable) da el mismo refuerzo en un registro apropiado.

---

### NR7 · Editor de arrastrar y soltar para sesiones

**Por qué no.** Suena potente, pero el valor del producto es **no tener que construir la sesión**. Un editor visual devuelve a la docente el trabajo del que huía.

**Alternativa mejor.** N1 (edición en línea de campos concretos) resuelve la necesidad real.

---

### NR8 · Añadir más campos al registro

**Por qué no.** Cada campo reduce la conversión. Ciudad, intereses, objetivos y años de experiencia **no alimentan ninguna función del producto**.

Los que sí aportan —grados, áreas, región— se piden en el **onboarding**, después del registro, cuando la docente ya invirtió y el dato precarga formularios de inmediato.

---

## 5. Resumen

| Categoría | Cantidad |
|---|---|
| **Necesarias** | 8 |
| **Importantes** | 15 |
| **Nice-to-have** | 13 |
| **No recomendadas** | 8 |

### Las cinco de mayor impacto

| # | Función | Por qué |
|---|---|---|
| 1 | **N1 · Editar lo generado** | Convierte un generador de un solo uso en herramienta de trabajo. Es la diferencia entre probar y adoptar |
| 2 | **N5 · Onboarding** | Determina si la docente llega al momento de valor o abandona |
| 3 | **N7 · Que el plan pagado cambie algo** | Hoy cobrar no activa nada automáticamente. Es un fallo de negocio abierto |
| 4 | **I2 · Continuar donde lo dejaste** | Convierte visitas sueltas en hábito semanal |
| 5 | **N2 · Reenviar confirmación** | Recupera cuentas que hoy se pierden en silencio |

### Las cuatro más baratas

| # | Función | Esfuerzo | Por qué es tan barata |
|---|---|---|---|
| 1 | **N6 · Créditos visibles** | XS | El endpoint y el componente ya existen; falta importarlo |
| 2 | **I9 · Guía de observación y cuestionario** | S | Esquemas y endpoint ya construidos; falta la entrada en el catálogo |
| 3 | **N8 · Guardado visible** | S | Cambiar tres `catch` silenciosos por avisos |
| 4 | **N4 · Autoguardado** | S | `localStorage` con debounce |

**Un patrón se repite:** buena parte de lo que "falta" está **construido pero sin conectar**. Ese es el hallazgo más útil de este documento — la distancia entre el producto actual y uno bastante mejor es menor de lo que parece.
