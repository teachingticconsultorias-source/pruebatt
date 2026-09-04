# SCIVERSE V2 — CONTINUATION STATE

## ÚLTIMA ACTUALIZACIÓN

2026-09-04 · Bloque Visual 03 **cerrado y revalidado** en navegador real.

Esta revalidación se ejecutó sobre un `dist` reconstruido desde el HEAD actual.
Antes de empezar había un proceso `vite preview` huérfano (PID en el puerto
4173) sirviendo un build antiguo: se terminó y se reconstruyó, porque cualquier
auditoría contra ese proceso habría medido código que ya no existe. Conviene
repetir ese paso al inicio de cada sesión de QA.

## ESTADO ACTUAL

- Rama: `feat/visual-overhaul`
- Bloque Visual: **100% terminado**
- Working tree limpio.
- No se hizo push, deploy, merge a `main`, ni cambios en Supabase/Vercel.

## BLOQUE VISUAL — CIERRE

| Área | Estado |
|---|---|
| Landing | 🟢 |
| Auth | 🟢 |
| App Shell | 🟢 |
| Dashboard | 🟢 |
| Crear | 🟢 |
| Sesiones | 🟢 |
| Herramientas | 🟢 |
| Biblioteca | 🟢 |
| Cuenta | 🟢 |
| Capacitación | 🟢 |
| Planes | 🟢 |
| Responsive | 🟢 |
| Accessibility | 🟢 |
| Visual QA | 🟢 |

## QUÉ SE TERMINÓ

1. Contraste WCAG AA corregido en Actividades STEAM y Retos grupales.
2. Consolidación local de colores preservada y completada para los roles
   visuales tocados; no se revirtió.
3. La sección Sesiones quedó terminada como asistente de tres pasos:
   - Datos básicos.
   - Propósito y contexto.
   - Revisión.
   - Barra de acciones sticky que se eleva sobre la navegación móvil y respeta
     `env(safe-area-inset-bottom)`.
   - Etiquetas explícitas `htmlFor`/`id` en los campos con sugerencias de Kantu.
   - `handleGenerate`, prompts y créditos intactos.
4. Sección Herramientas terminada con el catálogo compartido `ToolGrid` y
   `config/tools.js`; navegación desktop y móvil. No se construyó un catálogo
   paralelo. Unidad de aprendizaje sigue como Próximamente. El crucigrama no
   volvió al catálogo.
5. Responsive final revisado en `375`, `430`, `768`, `1024`, `1280`, `1440`,
   `1920` y `844x390`.
6. Accessibility final:
   - Texto mínimo de 12 px.
   - Objetivos táctiles comprobados.
   - Foco visible comprobado por teclado.
   - Contraste medido sobre el render real, no leído del CSS.
7. Pase de consistencia visual completado en Landing, Auth, Shell, Dashboard,
   Crear, Sesiones, Herramientas, Biblioteca, Actividades, Retos y Cuenta.
8. CTA final de Landing centrado mediante el contenedor completo:
   - `max-width: var(--content-max)`.
   - `margin-inline: auto` explícito.
   - ancho con gutters simétricos y padding simétrico.
   - sin `left`, sin `transform`, sin márgenes laterales arbitrarios.

## QA VISUAL REAL — REVALIDADO

```bash
node scripts/visual-qa.mjs docs/qa
```

```text
vistas auditadas:                  88
problemas de layout:                0
errores/warnings propios:           0
vistas que no llegaron al destino:  0
```

El script verifica también que Landing, Login, Registro y las secciones
autenticadas realmente alcanzan su destino, en lugar de asumirlo: una versión
anterior hacía clic sobre elementos ocultos del sidebar y auditaba el
dashboard creyendo auditar otra vista. La excepción de WCAG 2.5.8 para los
botones legales en línea del consentimiento está documentada en el script.

## ACCESIBILIDAD — REVALIDADO

```bash
node scripts/a11y-qa.mjs
```

```text
landing:         0 fallos      landing-movil:  0 fallos
panel:           0 fallos      panel-movil:    0 fallos
actividades:     0 fallos      retos:          0 fallos
biblioteca:      0 fallos      herramientas:   0 fallos

contraste (WCAG AA):  0 fallos
foco visible:         0 fallos
teclado:              0 fallos  ·  185 paradas en 8 vistas
TOTAL:                0 problemas de accesibilidad
```

Los textos secundarios usan `neutral-600`; los terciarios, `neutral-550`.
Las etiquetas de nivel conservan sus fondos e intención visual y usan
`amber-700` para Primaria y `teal-800` para Secundaria.

El modal comprobado sobre render real: atrapa el foco (0 fugas en 30
tabulaciones), bloquea el scroll del body, cierra con Escape y devuelve el
foco al disparador.

## CTA LANDING — REVALIDADO

Medición del contenedor `.lp-final` sobre el render de producción:

| Viewport | Margen izquierdo | Margen derecho | Diferencia | Ancho |
|---:|---:|---:|---:|---:|
| 375 | 24 px | 24 px | 0 px | 327 px |
| 1024 | 24 px | 24 px | 0 px | 976 px |
| 1280 | 40 px | 40 px | 0 px | 1200 px |
| 1440 | 120 px | 120 px | 0 px | 1200 px |
| 1920 | 360 px | 360 px | 0 px | 1200 px |

Computado en 1440: `margin-inline: 120px/120px`, `padding: 24px/24px`,
`transform: none`, `position: static`, `left/right: auto`.

## TESTS Y BUILD — REVALIDADO

```text
npm test        22/22 ✓
npm run build   ✓  (build 1)
npm run build   ✓  (build 2)
```

Los dos builds consecutivos producen artefactos **byte-idénticos**:

```text
JS   sha256[0:16] = 7a2fde0e7a1b2f23   (idéntico en ambos builds)
CSS  sha256[0:16] = 764d984272f3f13b   (idéntico en ambos builds)
```

Mutación de fuentes tras dos builds: **ninguna** (`git status --porcelain`
vacío). El codemod sigue fuera del build y no debe reintroducirse.

Aviso conocido y no bloqueante: Vite informa que el bundle JS principal supera
500 kB. La división del bundle pertenece al siguiente bloque técnico.

## CONTEXTO CRÍTICO — NO ROMPER

- `api/_lib/*` y el backend de créditos permanecen intactos.
- Una sesión consume un crédito y conserva el refund mediante `withCredit`.
- `useMaterialSave`, `SaveStatus`, `describeSaveError`, descargas y guardado
  permanecen activos.
- `resendConfirmation()` continúa siendo real; no mockear.
- Perfil, autorización admin y modelo Gemini no fueron modificados.
- `gemini-3.6-flash` es un modelo válido; no "corregirlo" (ver
  `docs/audit/25-AUDIT-CORRECTIONS.md`, C-1).
- No ejecutar todavía `supabase/migrations/001_material_types.sql`.
- No rotar ni tocar secretos desde este bloque.
- El QA no ejecuta Gemini ni consume créditos: usa una sesión falsa en
  `localStorage` y nunca dispara generación.

## PENDIENTES FUERA DEL BLOQUE VISUAL

1. Supabase real y credenciales: flujo de auth y persistencia contra un
   proyecto real antes de producción.
2. Validar contra producción y sólo después ejecutar
   `supabase/migrations/001_material_types.sql`.
3. Rotar `ADMIN_SECRET` en Vercel cuando se autorice.
4. Pruebas funcionales conectadas (guardado, créditos, refund, admin) contra
   backend real.
5. Backend restante y Bloque Técnico C: retirar código muerto de `App.jsx`
   de forma incremental y verificable (`ImprovedLanding`, `RegistrationGate`,
   `Usage`, `CrosswordGenerator` — este último ya es inalcanzable, definido y
   nunca referenciado), y dividir el bundle empezando por Admin y la
   exportación DOCX, sin cambiar comportamiento.

## SIGUIENTE ACCIÓN EXACTA

El Bloque Visual está cerrado. La siguiente acción autorizada es el **Bloque
Deploy Visual a Vercel**. No desplegar ni hacer push hasta recibir esa
autorización expresa; `feat/visual-overhaul` se mantiene sin push.

Al reanudar cualquier QA, primero:

```bash
# terminar cualquier vite preview huérfano en 4173, reconstruir y servir
npm run build && npm run preview
node scripts/visual-qa.mjs docs/qa
node scripts/a11y-qa.mjs
```
