# 10 — Inventario funcional

> ⚠️ **Una afirmación de este documento es incorrecta.** Lo que se dice aquí sobre `onChoosePlan` (que elegir un plan de pago llevaría al registro) es **falso**: `PlansModal` ya abre WhatsApp correctamente. El resto del documento se mantiene. Detalle en [`25-AUDIT-CORRECTIONS.md`](25-AUDIT-CORRECTIONS.md) §C-2.


Inventario de todas las funcionalidades del producto, con estado verificado en el código.

### Estados

| Estado | Significado |
|---|---|
| **Completa** | Funciona de extremo a extremo y cumple lo que promete |
| **Parcial** | Funciona a medias o le falta una pieza esencial |
| **Demo** | Aparenta funcionar; no hace lo que dice |
| **Rota** | Falla en uso normal |
| **Ausente** | Prometida o esperada, no existe |
| **Mejorable** | Funciona bien; hay margen claro |

---

## 1. Autenticación y cuenta

| Función | Estado | Valor usuario | Problemas | Acción |
|---|---|---|---|---|
| Registro con correo | **Mejorable** | Alto | 8 campos de golpe; términos sin enlace real (`AuthGate.jsx:249`); sin medidor de fortaleza; sin captcha | Dividir en 2 pasos; enlazar `LegalModal`; añadir captcha |
| Confirmación por correo | **Parcial** | Alto | **Sin reenviar el correo** (`AuthGate.jsx:215`). Si no llega, la cuenta queda inaccesible | Añadir reenvío con cuenta atrás y aviso de spam |
| Login | **Completa** | Alto | Sin bloqueo tras N intentos; sin mostrar/ocultar contraseña | Activar protección de Supabase |
| Cerrar sesión | **Completa** | Medio | Sin confirmación; duplicado en sidebar y topbar | Confirmar si hay trabajo sin guardar |
| Recuperar contraseña | **Completa** | Alto | `redirectTo` usa `?restablecer=1` que **nadie lee**; funciona por el evento `PASSWORD_RECOVERY` | Limpiar el parámetro muerto |
| Cambiar contraseña | **Completa** | Medio | Sin medidor de fortaleza | Añadir indicador |
| Sesión persistente | **Completa** | Alto | Refresco automático por `supabase-js` | — |
| Ver perfil | **Completa** | Medio | Lee de `user_metadata`, no de la tabla | Unificar la fuente |
| Editar perfil | **Rota** | Alto | Guarda **solo en metadata** (`App.jsx:3547`), nunca en `docentes`. El admin ve datos congelados para siempre | Escribir en ambos destinos |
| Cambiar correo | **Ausente** | Medio | No existe | Añadir con reverificación |
| **Eliminar cuenta** | **Ausente** | Alto | No existe, y `docentes` **no tiene política de DELETE**. Exigible por la Ley 29733 | Implementar con doble confirmación y cascada |
| Exportar mis datos | **Ausente** | Medio | No existe | JSON con perfil y materiales |

---

## 2. Generación con IA

| Función | Estado | Valor usuario | Problemas | Acción |
|---|---|---|---|---|
| **Sesión de aprendizaje** | **Parcial** | **Muy alto** | El núcleo del producto y está bien construido. Pero: 4 llamadas **sin consumir créditos**; un fallo destruye todo el progreso (`App.jsx:948`); guardado silencioso (`:989`); sin cancelar; no está en el catálogo de "Crear" en producción | Cuota + reintento por módulo + guardado visible |
| Sugerencias de campo (propósito, contexto, evidencia) | **Completa** | Alto | Sin créditos; sin reintento | Coste reducido o gratuito, pero contabilizado |
| **Proyecto STEAM (producción)** | **Parcial** | Alto | Endpoint dedicado con esquema propio. **Sin cuota.** Su código fuente solo existe dentro de `apply-sciverse-v2.mjs` | Versionar el archivo y añadir cuota |
| Proyecto STEAM (repositorio) | **Rota** | Alto | `documentType="project"` usa `SESSION_SCHEMA` → **produce una sesión, no un proyecto** | Resuelto en producción por el codemod |
| **Rúbrica de evaluación** | **Mejorable** | **Muy alto** | Exportación Word excelente (`downloadRubricWord`). Sin cuota; guardado silencioso (`:1179`) | Añadir cuota; guardado visible |
| **Lista de cotejo** | **Mejorable** | Alto | Igual que rúbrica | Igual |
| Escala de valoración (producción) | **Mejorable** | Alto | Consume crédito ✅. Guardado silencioso | Guardado visible |
| Ficha de trabajo (producción) | **Mejorable** | Alto | Consume crédito ✅ | Guardado visible |
| Ficha de lectura (producción) | **Parcial** | Alto | Consume crédito ✅, pero guarda `tipo:"reading"`, permitido **solo** por `supabase-session-flow-v2.sql`. Si `session-resources.sql` corrió después, **todo guardado falla** | Consolidar migraciones |
| **Reto grupal con IA** | **Rota** | Alto | Genera bien, pero guarda `tipo:"challenge"` y **ningún SQL permite ese valor**. Todo reto falla al guardarse; se muestra el error crudo de Postgres | Añadir `challenge` al `CHECK` |
| Guía de observación | **Ausente** | Medio | Esquema y endpoint existen (`generate-session-resource.js`), pero ninguna interfaz lo expone | Añadir al catálogo |
| Cuestionario | **Ausente** | Medio | Igual: esquema listo, sin interfaz | Añadir al catálogo |
| Clase completa (sesión→instrumento→material) | **Parcial** | **Muy alto** | La mejor idea de producto. Solo accesible desde el banner del dashboard; contabilidad de créditos incoherente dentro del propio flujo | Añadir al catálogo; unificar cobro |
| **Editar lo generado** | **Ausente** | **Muy alto** | El visor es solo lectura (`App.jsx:3521`). Sin edición, sin regeneración parcial, sin versiones | Edición en línea + regeneración por sección |
| Regenerar una parte | **Ausente** | Alto | Todo o nada | Regeneración por sección |
| Historial de generaciones | **Ausente** | Alto | Si se cierra la pestaña o falla el guardado, el resultado se pierde sin rastro | Tabla `ai_generations` |
| **Ver créditos restantes** | **Rota** | **Muy alto** | `/api/credits` y `CreditsIndicator.jsx` existen y funcionan, pero **el componente nunca se importa**. Mi cuenta muestra "0 / 1" inventado (`App.jsx:3572`) | Importar el componente |

---

## 3. Herramientas sin IA

| Función | Estado | Valor usuario | Problemas | Acción |
|---|---|---|---|---|
| **Sopa de letras** | **Completa** | Alto | Algoritmo real propio (`App.jsx:1209`), 8 direcciones, versión estudiante y solucionario en canvas. Sin coste de IA | Modelo a seguir para el resto |
| **Crucigrama** | **Demo** | — | `setTimeout(1200)` y devuelve las pistas pegadas por la docente. **No genera cuadrícula.** Publicado bajo "CREAR CON KANTU" | **Retirar de producción** o implementar de verdad |
| Unidad de aprendizaje | **Demo** | — | Devuelve `{titulo, duracion, sesiones: 8}` con el 8 constante. Inalcanzable en producción, pero sigue en el bundle | Eliminar o implementar |
| Ficha de trabajo (versión antigua) | **Demo** | — | Eco del formulario. Sustituida en producción | Eliminar |
| Generador de lecturas (versión antigua) | **Demo** | — | Devuelve título y tema, **sin texto de lectura**. Sustituida en producción | Eliminar |
| Ficha de evaluación | **Demo** | — | Eco del formulario. Inalcanzable en producción | Eliminar o implementar |

---

## 4. Catálogos

| Función | Estado | Valor usuario | Problemas | Acción |
|---|---|---|---|---|
| **Actividades STEAM (17)** | **Completa** | Alto | La pantalla mejor resuelta. Filtro por área y nivel con conteos | Añadir búsqueda por texto |
| Detalle de actividad | **Completa** | Alto | Contenido pedagógico rico. Modal sin `Escape` ni trampa de foco | Accesibilidad de modales |
| Descargar actividad en Word | **Completa** | Alto | `downloadActivityWord` con buen formato | — |
| Catálogo de retos | **Completa** | Medio | Datos estáticos, filtro solo por nivel | Añadir filtro por área |
| Detalle de reto | **Mejorable** | Medio | "Crear instrumento" **pierde todo el contexto** del reto (`App.jsx:3737`) | Pasar `initialContext` |
| Plantillas Word | **Mejorable** | Medio | Contenido estático sin vista previa | Añadir previsualización |

---

## 5. Biblioteca

| Función | Estado | Valor usuario | Problemas | Acción |
|---|---|---|---|---|
| Listar mis creaciones | **Mejorable** | **Muy alto** | `limit(100)` con filtrado en cliente: **con más de 100 materiales, los antiguos son inalcanzables** | Filtrar y paginar en servidor |
| Buscar en la biblioteca | **Parcial** | Alto | Solo sobre los 100 cargados; sin `useMemo` | Búsqueda en servidor |
| Filtrar por tipo | **Parcial** | Alto | El desplegable **no incluye** `worksheet`, `reading` ni `rating_scale` (`App.jsx:3729`): esos materiales son invisibles al filtrar | Derivar de un diccionario único |
| Etiquetas de tipo | **Parcial** | Medio | `materialTypeLabel` mapea 5 de 9 tipos; el resto aparece como "Material" | Mismo diccionario |
| Filtrar por nivel / ordenar | **Completa** | Medio | — | — |
| Abrir material | **Parcial** | Alto | Solo lectura; volcado JSON genérico | Vista por tipo + edición |
| Descargar desde la biblioteca | **Parcial** | **Muy alto** | Usa `materialContentText`, texto plano — **peor que la descarga original**. Los exportadores buenos solo se usan al generar | Enrutar al exportador correcto por tipo |
| Duplicar material | **Completa** | Medio | — | — |
| Eliminar material | **Mejorable** | Medio | `window.confirm` y borrado definitivo, sin deshacer | Papelera de 30 días |
| **Guardados / favoritos** | **Parcial** | Alto | Solo `localStorage` (`App.jsx:3602`). Cambiar de dispositivo o limpiar el navegador **los borra sin aviso** | Tabla `favoritos` en Supabase |
| Organizar en carpetas | **Ausente** | Alto | Lista plana. Una docente activa acumula decenas por bimestre | Colecciones |
| Compartir material | **Ausente** | Medio | Sin URLs no hay nada que compartir | Requiere router |

---

## 6. Dashboard y navegación

| Función | Estado | Valor usuario | Problemas | Acción |
|---|---|---|---|---|
| Dashboard (producción) | **Parcial** | **Muy alto** | **Sin "continuar donde lo dejaste"**, sin materiales recientes, sin estadísticas. "Pregúntale a Kantu" no lleva a ninguna parte | Rediseñar como home docente |
| Materiales recientes | **Ausente en producción** | Alto | Existe en la versión del repositorio (`App.jsx:3699`), eliminado por el codemod | Restaurar y mejorar |
| Estadísticas | **Rota** | Bajo | Dos tarjetas muestran el **mismo número**; "Mi plan" fijo en "Gratuito" | 4 métricas reales |
| Navegación por secciones | **Mejorable** | Alto | Solo `useState`. Sin URLs, sin compartir, sin botón Atrás, recargar pierde el sitio | Introducir router |
| Barra lateral | **Mejorable** | Alto | "Plan actual: Gratuito" codificado en duro (`:3661`) | Leer del perfil |
| Navegación móvil | **Mejorable** | Alto | Sin acceso a cuenta ni cerrar sesión | Añadir pestaña "Más" |
| Búsqueda global | **Ausente** | Alto | Solo hay búsqueda en la biblioteca | Buscador con `Cmd/Ctrl+K` |

---

## 7. Planes y monetización

| Función | Estado | Valor usuario | Problemas | Acción |
|---|---|---|---|---|
| Ver planes | **Parcial** | Alto | Escondidos tras un modal → invisibles para SEO | Sección visible en la landing |
| **Precios coherentes** | **Rota** | Alto | Cuatro cifras distintas: `PLANS` dice S/20 y "5+5+5 semanales"; el dashboard dice "desde S/10"; Mi cuenta dice "0/1"; la base da 5 en total | Fuente única `config/plans.js` |
| Elegir un plan de pago | **Rota** | Alto | La landing anula la lógica de WhatsApp pasando `onChoosePlan={onRegister}` (`:2601`): elegir un plan lleva al registro | Pasar `choosePlan` |
| Pago | **Ausente** | Alto | Manual por Yape/Plin confirmado por WhatsApp | Aceptable hoy; formalizar con comprobante |
| Aplicar el plan a los límites | **Ausente** | **Muy alto** | `docentes.plan` existe y **nadie lo lee**. Un plan pagado no cambia nada automáticamente | Leer `plan` y ajustar `ai_weekly_limit` |
| Referidos | **Demo** | Bajo | Genera `?ref=` que **nadie lee**; estadísticas fijas en 0 | Implementar o retirar |

---

## 8. Administración

| Función | Estado | Valor usuario | Problemas | Acción |
|---|---|---|---|---|
| Acceso al panel | **Parcial** | Medio | Secreto compartido en query string; sin límite de intentos | Cabecera + roles reales |
| Listar docentes | **Parcial** | Medio | `select("*")` sin paginación; PII completa; datos congelados | Paginar y limitar columnas |
| Buscar / filtrar docentes | **Ausente** | Medio | Tabla plana | Añadir |
| Ver consumo de IA | **Ausente** | Alto | Las columnas existen; el panel no las muestra | Añadir |
| Activar / desactivar cuenta | **Ausente** | Alto | `activo` existe; **la app ni siquiera lo comprueba al iniciar sesión** | Implementar y hacerla efectiva |
| Cambiar plan o créditos | **Ausente** | Alto | Hoy requiere entrar a Supabase manualmente | Añadir |
| Métricas del producto | **Ausente** | Alto | Sin registros, altas, retención ni generaciones | Panel de métricas |
| Auditoría de acciones | **Ausente** | Medio | Sin rastro de quién consultó qué | `audit_logs` |

---

## 9. Contenido y soporte

| Función | Estado | Valor usuario | Problemas | Acción |
|---|---|---|---|---|
| Landing | **Mejorable** | Alto | Sin SEO (`index.html` sin descripción ni Open Graph); precios ocultos | Ver `11-LANDING-AUDIT.md` |
| Preguntas frecuentes | **Completa** | Medio | 8 preguntas pertinentes | — |
| Testimonios | **Mejorable** | Medio | Seis nombres y citas presentados como reales, sin respaldo visible | Documentar consentimiento o etiquetar como ilustrativos |
| Documentos legales | **Mejorable** | Medio | En modal, sin URL propia. El **Libro de Reclamaciones** es obligación legal en Perú y merece página propia | Páginas con URL |
| Capacitación | **Parcial** | Alto | Contenido estático, "fecha por confirmar", enlace a WhatsApp | Calendario e inscripción |
| Integraciones (Drive, Canva) | **Ausente** | Bajo | Botones `disabled` con "Próximamente" | Retirar hasta que existan |
| Onboarding | **Ausente** | **Muy alto** | Ninguno. Se cae directo al dashboard | Recorrido de 3 pasos |
| Ayuda contextual | **Ausente** | Alto | Sin tooltips para DUA, evidencia, enfoques transversales | Tooltips en términos pedagógicos |
| Soporte | **Parcial** | Medio | Solo WhatsApp desde la landing y Mi cuenta | Acceso desde la aplicación |
| Notificaciones | **Ausente** | Alto | Ninguna. Nada trae de vuelta a la docente | Correo semanal |

---

## 10. Calidad técnica transversal

| Función | Estado | Valor usuario | Problemas | Acción |
|---|---|---|---|---|
| Manejo de errores | **Parcial** | Alto | Errores de Postgres en crudo; sin `ErrorBoundary` → pantalla en blanco | Mensajes en español + boundary |
| Estados de carga | **Mejorable** | Medio | Giro genérico, sin esqueletos | Esqueletos con forma real |
| Estados vacíos | **Parcial** | Medio | `LibraryEmpty` es bueno; el resto improvisado | Componente único |
| Autoguardado | **Ausente** | **Muy alto** | Recargar pierde el formulario entero | `localStorage` con debounce |
| Trabajo sin conexión | **Ausente** | Bajo | Sin service worker | No prioritario |
| Responsive | **Mejorable** | Alto | Funciona, pero con 25+ puntos de ruptura | Unificar a 5 |
| Accesibilidad | **Parcial** | Alto | 157 reglas con texto ≤10px; 0 modales con `Escape` | Ver `14-` |
| Rendimiento | **Mejorable** | Medio | Bundle único; sin `lazy`, `memo` ni `useMemo` | Ver `15-` |
| Pruebas | **Ausente** | Alto | Ninguna | Ver `18-` |
| Analítica | **Ausente** | Alto | Ninguna | Ver `19-` |

---

## Resumen cuantitativo

| Estado | Cantidad | % |
|---|---|---|
| **Completa** | 16 | 17 % |
| **Mejorable** | 21 | 22 % |
| **Parcial** | 22 | 23 % |
| **Demo** | 5 | 5 % |
| **Rota** | 7 | 7 % |
| **Ausente** | 24 | 25 % |
| **Total** | **95** | |

### Las siete funciones rotas

1. **Editar perfil** — los cambios nunca llegan a la base de datos.
2. **Reto grupal con IA** — ningún reto se guarda jamás (`CHECK` sin `challenge`).
3. **Ver créditos restantes** — cifras inventadas; el componente real nunca se importa.
4. **Precios coherentes** — cuatro cifras distintas en cuatro sitios.
5. **Elegir un plan de pago** — lleva al registro en lugar de al pago.
6. **Estadísticas del dashboard** — dos tarjetas con el mismo número; plan fijo.
7. **Proyecto STEAM (repositorio)** — genera una sesión; corregido solo en producción.

### Las cinco demos

Crucigrama · Unidad de aprendizaje · Ficha de trabajo (antigua) · Generador de lecturas (antiguo) · Ficha de evaluación.

**Solo "Crucigrama" está en producción** — y es el más engañoso, porque está publicado bajo la etiqueta "CREAR CON KANTU".

### Las cinco ausencias de mayor valor

| Función | Por qué importa |
|---|---|
| **Editar lo generado** | Ninguna IA acierta al 100 %. Sin edición, el producto es de un solo uso y no se convierte en hábito |
| **Autoguardado** | Perder un formulario largo por un toque accidental es la peor experiencia posible |
| **Onboarding** | Determina si la docente llega o no a su primer momento de valor |
| **Aplicar el plan a los límites** | Sin esto, cobrar no cambia nada para quien paga |
| **Eliminar cuenta** | Exigible por la Ley 29733 de Protección de Datos Personales |

---

## Conclusión

**El 17 % de las funciones está verdaderamente completo.** El 25 % que falta incluye piezas que no son adornos: editar, autoguardar, orientar al nuevo usuario y hacer efectivo el plan pagado.

Lo llamativo es cuánto está **casi** hecho. `/api/credits` funciona pero su componente no se importa. `generate-with-quota.js` funciona pero nadie lo llama. La consulta de materiales recientes existe pero el codemod la eliminó del dashboard. `docentes.plan` existe pero nadie lo lee. Los esquemas de guía de observación y cuestionario están escritos pero sin interfaz.

**Buena parte del trabajo pendiente es conectar cosas que ya están construidas.** Ese es el hallazgo más esperanzador de toda la auditoría.
