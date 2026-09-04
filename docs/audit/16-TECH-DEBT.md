# 16 — Deuda técnica

> ⚠️ **Una afirmación de este documento es incorrecta.** Lo que se dice aquí sobre el modelo `gemini-3.6-flash` (que no existiría y rompería la IA) es **falso**: es un modelo válido y estable de la API de Gemini. El resto del documento se mantiene. Detalle en [`25-AUDIT-CORRECTIONS.md`](25-AUDIT-CORRECTIONS.md) §C-1.


Inventario consolidado con rutas y líneas reales.

**Escala de esfuerzo:** XS < 2 h · S = medio día · M = 1-3 días · L = 1-2 semanas · XL > 2 semanas

---

## 1. Deuda crítica (P0)

| ID | Archivo | Problema | Impacto | Riesgo | Esfuerzo | Prioridad |
|---|---|---|---|---|---|---|
| TD-01 | `apply-sciverse-v2.mjs`, `package.json:8` | El build reescribe `App.jsx` e `index.css` y genera un endpoint. No es idempotente (verificado). 9 anclas frágiles | El repositorio no refleja producción. Ninguna edición de `App.jsx` es segura | Un despliegue rompe el sitio. Ya ocurrió (`PASOS.txt`) | S | **P0** |
| TD-02 | `App.jsx:989`, `:1179`, `ResourceFromAI` | `saveTeacherMaterial` en `try/catch{console.error}` | La docente cree que guardó; el material no existe | Pérdida silenciosa de trabajo | S | **P0** |
| TD-03 | `api/generate-session.js`, `api/generate-project-steam.js` | Sin consumo de créditos. 4 llamadas por sesión | Gasto en Gemini sin techo | Coste descontrolado | M | **P0** |
| TD-04 | `App.jsx:3503` + los 4 `.sql` | Guarda `tipo:"challenge"`; ningún `CHECK` lo permite | **Ningún reto se guarda jamás** | Función rota + error crudo al usuario | XS | **P0** |
| TD-05 | `supabase-session-resources.sql:190` vs `supabase-session-flow-v2.sql:9` | `CHECK` contradictorios sobre `tipo` | Que `reading` funcione depende del orden de ejecución | Fallo intermitente sin causa evidente | XS | **P0** |
| TD-06 | `AdminPanel.jsx:23`, `api/list-docentes.js:11` | `ADMIN_SECRET` en query string | Secreto en logs de Vercel e historial | Acceso a PII de todos los docentes | XS | **P0** |
| TD-07 | `api/list-docentes.js:26` | `select("*")` sin paginación | Volcado completo de datos personales | Ley 29733 | XS | **P0** |
| TD-08 | `public/mascot/*.png` | 1,77 MB en dos PNG mostrados a ~100 px | Carga lenta y consumo de datos de la docente | Abandono en conexiones lentas | XS | **P0** |
| TD-09 | `App.jsx:1950` `CrosswordGenerator` | `setTimeout` y eco de las pistas. **En producción bajo "CREAR CON KANTU"** | No genera nada | Pérdida de confianza en todo el producto | S | **P0** |
| TD-10 | Los 4 endpoints de IA | `GEMINI_MODEL` por defecto `"gemini-3.6-flash"`, inexistente, y `GEMINI_MAIN_MODEL` no está en `.env.example` | Un despliegue nuevo nace con la IA rota | Indisponibilidad total con causa oculta | XS | **P0** |
| TD-11 | `App.jsx:3547` | El perfil se guarda solo en `user_metadata`, nunca en `docentes` | Admin con datos congelados; dos verdades | Decisiones sobre datos falsos | S | **P0** |
| TD-12 | `App.jsx:3572` + `components/CreditsIndicator.jsx` | Créditos con cifras inventadas; el componente real nunca se importa | La docente no sabe cuántas generaciones le quedan | Sorpresa a mitad de tarea | XS | **P0** |

---

## 2. Deuda alta (P1)

| ID | Archivo | Problema | Impacto | Riesgo | Esfuerzo | Prioridad |
|---|---|---|---|---|---|---|
| TD-13 | `src/**` | Directorio completo muerto (2.100 líneas). `index.html:11` carga `/main.jsx` de la raíz | Confusión permanente para quien abra el repo | Editar el archivo equivocado | XS | P1 |
| TD-14 | `components/**` | Directorio completo muerto (1.563 líneas), incluido el único consumidor de `/api/credits` | Trabajo hecho y desaprovechado | — | S | P1 |
| TD-15 | `App.jsx:2855-3298` | `RegistrationGate` obsoleto (~440 líneas) | Peso muerto y confusión con `AuthGate` | Modificar la auth equivocada | S | P1 |
| TD-16 | `App.jsx:3078-3290` | **Código inalcanzable tras `return`** (~210 líneas) | Landing anterior que nunca se ejecuta | Un linter lo habría detectado | XS | P1 |
| TD-17 | `App.jsx` | 3.776 líneas con 8 responsabilidades | Imposible de mantener; duplicados invisibles | Regresiones en cada cambio | L | P1 |
| TD-18 | `App.jsx:885-2333` | 9 generadores repiten el mismo esqueleto; token duplicado en 5 sitios | Las mejoras no se propagan | Comportamiento divergente | M | P1 |
| TD-19 | `App.jsx:69`, `AuthGate.jsx:5`, `AdminPanel.jsx:4` | Tres paletas con valores divergentes | La marca cambia de tono al iniciar sesión | Inconsistencia visible | S | P1 |
| TD-20 | raíz | Sin ESLint ni Prettier | Nada detecta código muerto ni inalcanzable | La deuda se regenera | S | P1 |
| TD-21 | raíz | Dos lockfiles + `pnpm-workspace.yaml` | Instalaciones no deterministas | Lo desplegado ≠ lo probado | XS | P1 |
| TD-22 | `App.jsx:3643` | `@import` de fuentes duplicado y bloqueante | Retrasa el primer pintado | — | XS | P1 |
| TD-23 | Toda la app | Sin `ErrorBoundary` | Un error de render = pantalla en blanco | Pérdida total del trabajo | S | P1 |
| TD-24 | `App.jsx:948-962` | Un fallo de módulo descarta los 3 anteriores | 2 min de espera tirados | Abandono | M | P1 |
| TD-25 | `App.jsx:3585-3602` | 20 `useState` en un componente | Re-render del árbol completo al escribir | Lentitud perceptible | M | P1 |
| TD-26 | Toda la app | Sin router: navegación en `useState` | Sin compartir, sin Atrás, recargar pierde el sitio | Fricción constante | M | P1 |
| TD-27 | `App.jsx:3606` | Trae `contenido` completo de 100 materiales para pintar tarjetas | 1-3 MB por carga de biblioteca | Lentitud en móvil | XS | P1 |
| TD-28 | `App.jsx:3619`, `:3729` | `materialTypeLabel` mapea 5 de 9 tipos; el filtro tampoco los incluye | Materiales V2 sin nombre y no filtrables | La biblioteca degrada al crecer | S | P1 |
| TD-29 | `App.jsx:3733` | La biblioteca descarga con `materialContentText` (texto plano) | Peor calidad que la descarga original | Incoherencia visible | S | P1 |
| TD-30 | `App.jsx:3602` | Favoritos solo en `localStorage` | Se pierden al cambiar de dispositivo | Pérdida de datos sin aviso | S | P1 |
| TD-31 | `AuthGate.jsx:215` | Confirmación de correo sin reenvío | Punto muerto si el correo no llega | Cuentas perdidas en silencio | S | P1 |
| TD-32 | `App.jsx:2601` vs `:2505` | `choosePlan` definido y nunca usado | Elegir un plan de pago lleva al registro | Conversión perdida | XS | P1 |
| TD-33 | `App.jsx:2427`, `:3700`, `:3572`, `supabase-freemium.sql` | Cuatro cifras distintas para el mismo límite | Promesa incumplida al docente | Reclamos | S | P1 |
| TD-34 | `index.html` | Sin descripción, Open Graph, canonical ni favicon | Sin previsualización al compartir por WhatsApp | Tráfico perdido | XS | P1 |
| TD-35 | `App.jsx:3521` | Visor de materiales de solo lectura | No se puede corregir nada | Producto de un solo uso | L | P1 |
| TD-36 | Generadores | Sin autoguardado del formulario | Recargar borra todo | Pérdida de trabajo | S | P1 |
| TD-37 | Todo `api/` | Sin limitación de tasa en ningún endpoint | Abuso y fuerza bruta viables | Coste y seguridad | M | P1 |
| TD-38 | `index.css` (157 reglas) | Texto de 7-10 px | Ilegible para el público objetivo | Accesibilidad y percepción | M | P1 |
| TD-39 | `index.css` | Solo 3 reglas `:focus`, ninguna `:focus-visible` | Navegación por teclado a ciegas | WCAG 2.4.7 | XS | P1 |
| TD-40 | Los 5 modales | Sin `Escape`, trampa ni devolución de foco (0 `onKeyDown`) | Usuario de teclado atrapado | WCAG 2.1.2 | M | P1 |
| TD-41 | `docentes` | Sin política de DELETE; sin opción de eliminar cuenta | Incumple el derecho de cancelación | Ley 29733 | M | P1 |
| TD-42 | `App.jsx:3540` | Referidos generan `?ref=` que nadie lee; estadísticas fijas en 0 | Función simulada | Pérdida de confianza | M | P1 |
| TD-43 | `api/generate-with-quota.js` | Endpoint huérfano que resuelve TD-03 | Trabajo hecho sin conectar | — | XS | P1 |
| TD-44 | raíz | Sin `.gitattributes`; `core.autocrlf` provoca CRLF local | **`npm run build` imposible en Windows** | Sin verificación local | XS | P1 |
| TD-45 | raíz | Sin pruebas de ningún tipo | Cualquier cambio puede romper auth o guardado | Regresiones no detectadas | L | P1 |
| TD-46 | Todo `api/` | Sin registro estructurado | Imposible diagnosticar "no me funciona" | Soporte a ciegas | S | P1 |
| TD-47 | No existe `vercel.json` | Sin cabeceras de seguridad | Sin CSP, `Referrer-Policy` ni `X-Frame-Options` | Agrava TD-06 | XS | P1 |
| TD-48 | `docentes.activo` | La app no lo comprueba al iniciar sesión | Desactivar una cuenta no la desactiva | Control inefectivo | S | P1 |

---

## 3. Deuda media (P2)

| ID | Archivo | Problema | Impacto | Esfuerzo |
|---|---|---|---|---|
| TD-49 | `App.jsx:3622` | Filtrado y ordenación sin `useMemo` | Retardo al escribir en el buscador | XS |
| TD-50 | `App.jsx:81-83` | `violet` = coral, `amber` = yellow, `cyan` = tealDeep | `C.violet` devuelve naranja | S |
| TD-51 | `App.jsx:100-139` | Dos juegos casi idénticos de primitivas Word | Duplicación | S |
| TD-52 | `App.jsx:125`, `:3613` | Bus de eventos con `window.dispatchEvent` | Canal invisible e indepurable | S |
| TD-53 | Generadores | Sin `AbortController` | `setState` sobre componentes desmontados | S |
| TD-54 | `*.zip` (3), `*.txt` (6), `package-fallback.json`, `AnimalCellLab.jsx` | 234 KB de archivos obsoletos versionados | Clones lentos, confusión | XS |
| TD-55 | `App.jsx:292-884` | Datos mezclados con código (~590 líneas) | Cambiar un precio toca el archivo de Word | S |
| TD-56 | `App.jsx` | Formato inconsistente; líneas de 500+ caracteres | Ilegible | S |
| TD-57 | `tailwind.config.js:3` | Incluye `src/` muerto, excluye `components/` | CSS inflado | XS |
| TD-58 | `App.jsx:3645` + `index.css` | `@media print` duplicada | Reglas que se solapan | XS |
| TD-59 | `index.css` | 24 radios, 58 sombras, 25+ breakpoints, 331 colores literales | Inconsistencia visual | M |
| TD-60 | `materiales_docente.updated_at` | Declarada y nunca actualizada | Dato inútil | XS |
| TD-61 | `supabase-schema.sql:26-28` | Tres índices únicos sobre `correo`; `ON CONFLICT` frágil | Riesgo en registro con mayúsculas | S |
| TD-62 | `App.jsx:3606` | Consulta sin `.eq("user_id")` explícito | Depende solo de RLS | XS |
| TD-63 | `api/generate-session.js:198` | Sin respaldo a `SUPABASE_URL` | Fallo desconcertante si falta la variable | XS |
| TD-64 | Los 4 endpoints | Sin timeout hacia Gemini | La función agota su tiempo sin mensaje útil | S |
| TD-65 | `main.jsx:4` | `AdminPanel` importado estáticamente | Todos descargan el panel admin | XS |
| TD-66 | `App.jsx:3624` | `window.confirm` y borrado definitivo | Sin deshacer | S |
| TD-67 | `.env.example` | Faltan `GEMINI_MAIN_MODEL` y `VITE_SUPABASE_PUBLISHABLE_KEY` | Despliegue nuevo mal configurado | XS |
| TD-68 | `App.jsx:3672` | Barra superior duplica marca y cerrar sesión | Ruido visual | S |
| TD-69 | `App.jsx:3683` | Navegación móvil sin acceso a cuenta | Fricción en móvil | S |
| TD-70 | `App.jsx:3695` | Dos estadísticas con el mismo número | Delata falta de cuidado | XS |
| TD-71 | `App.jsx:3661` | "Plan actual: Gratuito" codificado en duro | Ignora `profile.plan` | XS |
| TD-72 | `AdminPanel.jsx:69` | Tabla de 6 columnas sin adaptar a móvil | Scroll horizontal | S |
| TD-73 | `App.jsx:3733` | Objetivos táctiles < 44 px, "eliminar" junto a "duplicar" | Pulsación errónea destructiva | S |
| TD-74 | `App.jsx:3737` | "Crear instrumento" desde un reto pierde el contexto | Reescritura manual | S |
| TD-75 | `supabase-freemium.sql:45` | `search_path = public` en vez de `''` | Menos estricto que el trigger | XS |
| TD-76 | `App.jsx:2430` | Testimonios sin respaldo visible | Riesgo de veracidad publicitaria | S |
| TD-77 | `api/*` | Sin validación por esquema de las entradas | Prompts inflables | M |
| TD-78 | Los 4 endpoints | `systemInstruction` duplicada y desigual | Recursos con menos criterio pedagógico | S |
| TD-79 | `App.jsx:963-985` | Composición del resultado con accesos anidados sin comprobación | `TypeError` tras 2 min de espera | S |

---

## 4. Deuda baja (P3)

| ID | Archivo | Problema | Esfuerzo |
|---|---|---|---|
| TD-80 | Toda la app | Sin TypeScript ni PropTypes | M |
| TD-81 | Toda la app | Sin esqueletos de carga | S |
| TD-82 | `index.css` | Una sola regla `prefers-reduced-motion` | S |
| TD-83 | `App.jsx` | Estados vacíos desiguales | S |
| TD-84 | `App.jsx:2528` | Icono `Layers` como menú móvil | XS |
| TD-85 | `index.html` | Fuentes sin autoalojar ni SRI | S |
| TD-86 | `App.jsx` | Idiomas mezclados sin convención escrita | XS |
| TD-87 | `AuthGate.jsx:148` | `?restablecer=1` que nadie lee | XS |
| TD-88 | `App.jsx:2481` | Prop `onForgotPassword` declarada y sin uso | XS |
| TD-89 | raíz | Sin `security.txt` ni escaneo de dependencias | S |
| TD-90 | Supabase | Sin entorno de staging | S |
| TD-91 | `App.jsx:3521` | `MaterialContentView` vuelca JSON sin formato por tipo | M |
| TD-92 | `App.jsx:3737` | Plantillas sin vista previa | S |
| TD-93 | `App.jsx:3577` | Integraciones con botones `disabled` "Próximamente" | XS |
| TD-94 | Landing | Sin sección para instituciones | S |
| TD-95 | `api/generate-session-resource.js:338` | Fallos de devolución de crédito sin registro | XS |
| TD-96 | Los 4 endpoints | `maxOutputTokens` fijos sin relación con lo pedido | S |
| TD-97 | Toda la app | Sin analítica | M |

---

## 5. Resumen

| Prioridad | Cantidad | Esfuerzo agregado |
|---|---|---|
| **P0** | **12** | ~1,5 semanas |
| **P1** | **36** | ~6 semanas |
| **P2** | **31** | ~4 semanas |
| **P3** | **18** | ~3 semanas |
| **Total** | **97** | **~14-15 semanas** |

### Por categoría

| Categoría | Cantidad |
|---|---|
| Código muerto y duplicado | 14 |
| Seguridad y control de costes | 12 |
| Datos y persistencia | 13 |
| UX y producto | 18 |
| Accesibilidad | 9 |
| Rendimiento | 10 |
| Proceso y tooling | 10 |
| UI y sistema de diseño | 8 |
| Backend e IA | 3 |

### Los diez elementos de mayor retorno

Máximo impacto, esfuerzo XS o S:

| # | ID | Acción | Esfuerzo | Elimina |
|---|---|---|---|---|
| 1 | TD-08 | Optimizar los PNG de Kantu | XS | 1,7 MB por sesión |
| 2 | TD-04 | Añadir `challenge` al `CHECK` | XS | Una función completamente rota |
| 3 | TD-12 | Importar `CreditsIndicator` | XS | Créditos invisibles |
| 4 | TD-06 | Secreto fuera de la URL | XS | La peor fuga de seguridad |
| 5 | TD-27 | Quitar `contenido` del listado | XS | 1-3 MB por carga |
| 6 | TD-10 | Fijar un modelo de Gemini válido | XS | Riesgo de indisponibilidad total |
| 7 | TD-32 | Arreglar `onChoosePlan` | XS | Conversión perdida |
| 8 | TD-39 | Regla `:focus-visible` | XS | El mayor bloqueo de teclado |
| 9 | TD-01 | Eliminar el codemod del build | S | El riesgo estructural raíz |
| 10 | TD-02 | Guardado visible con reintento | S | Pérdida silenciosa de trabajo |

**Los ocho primeros suman menos de un día** y eliminan tres P0 de seguridad, dos de rendimiento y dos funciones rotas.

---

## 6. Nota sobre el origen de la deuda

Casi toda esta deuda tiene una causa común, documentada en el propio repositorio: `LEEME_PRIMERO.txt`, `PASOS.txt` e `INSTRUCCIONES_SCIVERSE_V2.txt` describen un flujo donde las mejoras llegan en ZIP y se aplican **editando archivos a mano en la web de GitHub**, sin entorno local, sin `npm install`, sin linter y sin pruebas.

Ese proceso explica de forma directa:

- **TD-13, TD-14, TD-15, TD-16, TD-54** — el código muerto: nadie lo detecta porque no hay linter.
- **TD-01** — el codemod existe porque no hay forma de editar `App.jsx` con confianza.
- **TD-44** — el build local está roto, así que nadie construye antes de desplegar.
- **TD-56** — el formato es inconsistente porque no hay Prettier.
- **TD-18, TD-19, TD-51** — los duplicados no se ven en un archivo de 3.776 líneas.

**Arreglar el proceso (TD-01, TD-20, TD-21, TD-44, TD-45) evita que la deuda se regenere.** Sin eso, cada corrección de esta lista se compensará con deuda nueva en el siguiente parche.
