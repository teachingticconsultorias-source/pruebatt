# 23 — Checklist obligatorio previo a producción

Verificación previa a **cualquier** subida a producción. El proyecto está conectado a Vercel: un push a `main` actualiza el sitio real.

**Regla:** si algún elemento marcado 🔴 falla, **no se despliega**.

---

## 0. Pre-vuelo (mientras el codemod siga activo)

> ✅ **B-001 completado el 3-sep-2026** (rama `chore/stabilize-build`): el codemod ya no participa del build.
> **Esta sección completa deja de aplicar** en esa rama y posteriores. Se conserva por si hay que desplegar desde una rama anterior.
> En su lugar, verificar en la sección 2 que `npm run build` es reejecutable y no muta el código fuente.

| ✔ | Elemento | Cómo | Crítico |
|---|---|---|---|
| ☐ | El codemod se aplica sin error sobre el blob de Git | Copiar `App.jsx`, `index.css` y `apply-sciverse-v2.mjs` desde `git show HEAD:` a una carpeta temporal y ejecutar `node apply-sciverse-v2.mjs` | 🔴 |
| ☐ | Ninguna de las 9 anclas fue alterada | Revisar el diff de `App.jsx` contra las cadenas de `mustReplace` | 🔴 |
| ☐ | `App.jsx` e `index.css` no quedaron modificados por un build local | `git status` limpio | 🔴 |
| ☐ | `api/generate-project-steam.js` no está en el commit por accidente | `git status` | 🟠 |

---

## 1. Lint y formato

| ✔ | Elemento | Comando | Crítico |
|---|---|---|---|
| ☐ | ESLint sin errores | `npm run lint` | 🔴 |
| ☐ | Sin warnings nuevos respecto a `main` | comparar salida | 🟠 |
| ☐ | Prettier aplicado | `npm run format:check` | 🟠 |
| ☐ | Sin `console.log` en el código nuevo | `grep -rn "console.log" src/ api/` | 🟠 |
| ☐ | Sin `TODO` o `FIXME` en código que se despliega | `grep -rn "TODO\|FIXME" src/ api/` | 🟢 |
| ☐ | Sin código comentado en bloque | revisión del diff | 🟢 |

*(Hasta completar `19-` B-026, estas comprobaciones son manuales.)*

---

## 2. Build

| ✔ | Elemento | Comando | Crítico |
|---|---|---|---|
| ☐ | El build funciona en local | `npm run build` | 🔴 |
| ☐ | El build es **reejecutable** | `npm run build && npm run build` | 🔴 |
| ☐ | Sin errores ni warnings de Vite | revisar salida | 🟠 |
| ☐ | La vista previa funciona | `npm run preview` y probar el flujo P0 | 🔴 |
| ☐ | Tamaño de bundle sin crecer más de un 10 % | comparar `dist/` | 🟠 |
| ☐ | Sin dependencias nuevas no justificadas | revisar el diff de `package.json` | 🟠 |
| ☐ | Un solo lockfile, actualizado | `git status` | 🟠 |
| ☐ | El despliegue de vista previa de Vercel es correcto | probar la URL de preview | 🔴 |

---

## 3. Variables de entorno

| ✔ | Variable | Dónde | Crítico |
|---|---|---|---|
| ☐ | `GEMINI_API_KEY` definida y válida | Vercel (servidor) | 🔴 |
| ☐ | **`GEMINI_MAIN_MODEL` con un identificador de modelo válido** | Vercel (servidor) | 🔴 |
| ☐ | `VITE_SUPABASE_URL` correcta | Vercel (cliente + servidor) | 🔴 |
| ☐ | `VITE_SUPABASE_ANON_KEY` o `VITE_SUPABASE_PUBLISHABLE_KEY` | Vercel (cliente) | 🔴 |
| ☐ | `SUPABASE_URL` (respaldo del servidor) | Vercel | 🟠 |
| ☐ | `SUPABASE_SERVICE_ROLE_KEY` | Vercel (servidor) | 🔴 |
| ☐ | `ADMIN_SECRET` con valor fuerte | Vercel (servidor) | 🔴 |
| ☐ | `.env.example` refleja **todas** las variables reales | repositorio | 🟠 |
| ☐ | Las variables apuntan al proyecto Supabase **de producción** | Vercel | 🔴 |
| ☐ | Ninguna variable de servidor lleva prefijo `VITE_` por error | Vercel | 🔴 |

> ⚠️ **`GEMINI_MAIN_MODEL` es crítica.** El valor por defecto del código (`"gemini-3.6-flash"`) no corresponde a ningún modelo publicado: si la variable falta o es inválida, **toda la generación cae**.

---

## 4. Secretos

| ✔ | Elemento | Cómo | Crítico |
|---|---|---|---|
| ☐ | Sin claves en el código | `grep -rEn "eyJ[A-Za-z0-9_-]{20,}\|sb_secret_\|AIza[0-9A-Za-z_-]{30}" --include=*.js --include=*.jsx .` | 🔴 |
| ☐ | Sin `SUPABASE_SERVICE_ROLE_KEY` fuera de `api/` | `grep -rn "SERVICE_ROLE" src/ *.jsx` | 🔴 |
| ☐ | Sin `GEMINI_API_KEY` en código de cliente | `grep -rn "GEMINI_API_KEY" src/ *.jsx` | 🔴 |
| ☐ | `.env` y `.env.local` en `.gitignore` | revisar | 🔴 |
| ☐ | Sin secretos en el historial de Git del commit nuevo | `git log -p` del rango | 🔴 |
| ☐ | `ADMIN_SECRET` **no viaja en la URL** | revisar `AdminPanel.jsx` y `list-docentes.js` | 🔴 |
| ☐ | Sin secretos en los ZIP versionados | (eliminar los ZIP) | 🟠 |

---

## 5. Autenticación

| ✔ | Flujo | Cómo probar | Crítico |
|---|---|---|---|
| ☐ | Registro con correo nuevo | Registro completo en preview | 🔴 |
| ☐ | Llega el correo de confirmación | Revisar bandeja **y spam** | 🔴 |
| ☐ | El enlace de confirmación activa la cuenta | Pulsarlo | 🔴 |
| ☐ | Login con la cuenta confirmada | — | 🔴 |
| ☐ | Login rechazado sin confirmar | — | 🟠 |
| ☐ | Login rechazado con contraseña incorrecta | — | 🔴 |
| ☐ | Recuperación de contraseña envía correo | — | 🟠 |
| ☐ | El enlace de recuperación permite cambiarla | — | 🟠 |
| ☐ | Cerrar sesión limpia la sesión | Recargar tras salir | 🔴 |
| ☐ | Recargar mantiene la sesión iniciada | F5 | 🔴 |
| ☐ | Sin sesión no se accede a la aplicación | Abrir una URL privada en incógnito | 🔴 |
| ☐ | Una cuenta con `activo = false` no entra | Marcar en la base y probar | 🟠 |
| ☐ | El perfil muestra los datos correctos | Comparar con la base | 🔴 |
| ☐ | Editar el perfil persiste tras recargar | — | 🔴 |

---

## 6. RLS y base de datos

| ✔ | Elemento | Cómo probar | Crítico |
|---|---|---|---|
| ☐ | **RLS activa en `docentes` y `materiales_docente`** | `select relname, relrowsecurity from pg_class where relname in ('docentes','materiales_docente')` | 🔴 |
| ☐ | **Un docente NO ve materiales de otro** | Dos cuentas; A no ve nada de B | 🔴 |
| ☐ | Un docente NO ve el perfil de otro | Dos cuentas | 🔴 |
| ☐ | Un docente puede crear, editar y borrar **sus** materiales | Ciclo completo | 🔴 |
| ☐ | Las migraciones se probaron en staging | — | 🔴 |
| ☐ | Cada migración tiene su reversión escrita | Revisar | 🔴 |
| ☐ | El `CHECK` de `tipo` incluye **todos** los que la app escribe | `select distinct tipo from materiales_docente` vs el `CHECK` | 🔴 |
| ☐ | Copia de seguridad reciente antes de migrar | Supabase → Backups | 🔴 |
| ☐ | El trigger `crear_perfil_docente` funciona | Registro de prueba | 🔴 |
| ☐ | Las 3 RPC de créditos responden | Llamarlas autenticado | 🔴 |
| ☐ | `consume_ai_credit` conserva `FOR UPDATE` | Revisar la definición | 🔴 |

---

## 7. Gemini e IA

| ✔ | Elemento | Cómo probar | Crítico |
|---|---|---|---|
| ☐ | **Generar una sesión completa funciona** | Flujo completo en preview | 🔴 |
| ☐ | Los 4 módulos se completan | Observar el progreso | 🔴 |
| ☐ | El resultado tiene contenido pedagógico coherente | Leerlo | 🔴 |
| ☐ | Generar una rúbrica funciona | — | 🔴 |
| ☐ | Generar una lista de cotejo funciona | — | 🟠 |
| ☐ | Generar un reto **y que aparezca en la biblioteca** | — | 🔴 |
| ☐ | Generar ficha de trabajo y de lectura | — | 🟠 |
| ☐ | Generar un proyecto STEAM | — | 🟠 |
| ☐ | Las sugerencias de campo funcionan | Propósito, contexto, evidencia | 🟠 |
| ☐ | Se consume un crédito por generación | Comparar antes/después | 🔴 |
| ☐ | El crédito se **devuelve** si falla | Provocar un fallo | 🔴 |
| ☐ | Al agotar el cupo, mensaje claro con fecha de renovación | Agotar en una cuenta de prueba | 🟠 |
| ☐ | **Límite de presupuesto activo en Google Cloud** | Consola de Google Cloud | 🔴 |
| ☐ | Sin errores de Gemini en los logs de las últimas 24 h | Logs de Vercel | 🟠 |

---

## 8. Guardado y biblioteca

| ✔ | Elemento | Cómo probar | Crítico |
|---|---|---|---|
| ☐ | Lo generado **aparece** en la biblioteca | Generar y comprobar | 🔴 |
| ☐ | Un fallo de guardado **se muestra** a la docente | Provocar un fallo | 🔴 |
| ☐ | La búsqueda de biblioteca funciona | — | 🟠 |
| ☐ | Los filtros de tipo y nivel funcionan | — | 🟠 |
| ☐ | Todos los tipos muestran su etiqueta correcta | Revisar los 9 | 🟠 |
| ☐ | Descargar desde la biblioteca da un documento con formato | Abrir el `.docx` | 🔴 |
| ☐ | Duplicar funciona | — | 🟡 |
| ☐ | Eliminar funciona y pide confirmación | — | 🟠 |

---

## 9. Descargas Word

| ✔ | Elemento | Cómo probar | Crítico |
|---|---|---|---|
| ☐ | La sesión se descarga y **abre en Word sin errores** | Abrir el archivo | 🔴 |
| ☐ | Contiene tablas, encabezados y numeración | Revisar visualmente | 🔴 |
| ☐ | Muestra el nombre y la institución correctos | Comparar con el perfil | 🟠 |
| ☐ | La rúbrica se descarga con su tabla de niveles | — | 🔴 |
| ☐ | La lista de cotejo se descarga | — | 🟠 |
| ☐ | La sopa de letras genera estudiante y solucionario | — | 🟠 |
| ☐ | Las plantillas se descargan | — | 🟡 |
| ☐ | Sin caracteres corruptos (tildes, ñ) | Revisar el texto | 🔴 |

---

## 10. Responsive

| ✔ | Ancho | Qué verificar | Crítico |
|---|---|---|---|
| ☐ | **375 px** (móvil) | Sin scroll horizontal; navegación inferior usable; modales legibles | 🔴 |
| ☐ | **768 px** (tablet) | Sin zona muerta entre lateral y navegación móvil | 🟠 |
| ☐ | **1024 px** (portátil) | Retículas coherentes; barra de filtros usable | 🟠 |
| ☐ | **1280 px** (escritorio) | Layout completo correcto | 🟠 |
| ☐ | **1920 px** (amplio) | El contenido no se estira sin límite | 🟡 |
| ☐ | Ningún elemento desborda horizontalmente | Recorrer todas las pantallas | 🔴 |
| ☐ | Los modales son usables en móvil | — | 🟠 |
| ☐ | Las tablas no rompen el layout en móvil | Panel admin | 🟠 |
| ☐ | Los formularios son cómodos en móvil | Asistente de 3 pasos | 🟠 |

---

## 11. Accesibilidad

| ✔ | Elemento | Cómo | Crítico |
|---|---|---|---|
| ☐ | **Ninguna regla fija texto por debajo de 12 px** | `grep -oE "font-size:[0-9]+px" index.css \| sort -u` | 🟠 |
| ☐ | Todo el texto alcanza 4.5:1 de contraste | axe DevTools | 🟠 |
| ☐ | El foco de teclado es visible en todos los interactivos | Recorrer con `Tab` | 🔴 |
| ☐ | Toda la aplicación es operable solo con teclado | Sin ratón | 🔴 |
| ☐ | Los modales cierran con `Escape` | Probar los 5 | 🟠 |
| ☐ | El foco vuelve al abridor al cerrar un modal | — | 🟠 |
| ☐ | Todas las imágenes tienen `alt` apropiado | Revisar | 🟠 |
| ☐ | Los botones de solo icono tienen `aria-label` | Revisar | 🟠 |
| ☐ | Los errores de formulario se anuncian | Lector de pantalla | 🟠 |
| ☐ | Lighthouse Accessibility ≥ 90 | DevTools | 🟠 |
| ☐ | axe DevTools sin incidencias críticas | — | 🟠 |
| ☐ | El zoom al 200 % no rompe el layout | — | 🟡 |

---

## 12. Recorridos críticos (P0)

**Los cinco deben pasar. Sin excepción.**

| ✔ | # | Recorrido | Pasos | Crítico |
|---|---|---|---|---|
| ☐ | **1** | **Registro completo** | Landing → Registro → correo → confirmar → login → dashboard | 🔴 |
| ☐ | **2** | **Generar y guardar** | Login → Crear → Sesión → asistente → generar → **aparece en biblioteca** | 🔴 |
| ☐ | **3** | **Descargar** | Biblioteca → abrir → Descargar Word → **abre correctamente en Word** | 🔴 |
| ☐ | **4** | **Créditos** | Generar → el saldo baja 1 → provocar fallo → **el saldo se restaura** | 🔴 |
| ☐ | **5** | **Aislamiento** | Cuenta A crea material → cuenta B **NO lo ve** en ningún sitio | 🔴 |

Complementarios (🟠):

| ✔ | Recorrido |
|---|---|
| ☐ | Recuperar contraseña de principio a fin |
| ☐ | Editar el perfil y verificar que persiste |
| ☐ | Generar una rúbrica desde una sesión |
| ☐ | Crear un reto con IA y **verificar que se guarda** |
| ☐ | Acceder al panel admin y ver el listado |
| ☐ | Explorar el catálogo de actividades y descargar una |

---

## 13. Smoke test en producción

**Inmediatamente después de publicar. Máximo 10 minutos.**

| ✔ | # | Verificación | Tiempo |
|---|---|---|---|
| ☐ | 1 | La landing carga sin errores en consola | 30 s |
| ☐ | 2 | Login con una cuenta real de prueba | 30 s |
| ☐ | 3 | El dashboard muestra los datos correctos | 30 s |
| ☐ | 4 | La biblioteca carga los materiales existentes | 30 s |
| ☐ | 5 | **Generar una sesión completa** | 3 min |
| ☐ | 6 | **La sesión aparece en la biblioteca** | 30 s |
| ☐ | 7 | **Descargar el Word y abrirlo** | 1 min |
| ☐ | 8 | El saldo de créditos bajó correctamente | 30 s |
| ☐ | 9 | El panel admin responde | 30 s |
| ☐ | 10 | Revisar los logs de Vercel: sin errores nuevos | 1 min |
| ☐ | 11 | Probar en un móvil real | 2 min |

**Si cualquiera falla → revertir el despliegue en Vercel de inmediato.**

---

## 14. Post-despliegue

| ✔ | Elemento | Cuándo |
|---|---|---|
| ☐ | Vigilar los logs de Vercel | 30 min |
| ☐ | Comprobar que hay registros nuevos | 2 h |
| ☐ | Comprobar que hay generaciones exitosas | 2 h |
| ☐ | Revisar si hay errores de Gemini | 24 h |
| ☐ | Revisar el gasto en Google Cloud | 24 h |
| ☐ | Verificar que nadie reporta problemas por WhatsApp | 24 h |
| ☐ | Mantener disponible la reversión | 24 h |

---

## 15. Resumen del checklist

| Sección | Elementos | Críticos 🔴 |
|---|---|---|
| 0. Pre-vuelo (codemod) | 4 | 3 |
| 1. Lint y formato | 6 | 1 |
| 2. Build | 8 | 3 |
| 3. Variables de entorno | 10 | 7 |
| 4. Secretos | 7 | 6 |
| 5. Autenticación | 14 | 8 |
| 6. RLS y base de datos | 11 | 10 |
| 7. Gemini e IA | 15 | 6 |
| 8. Guardado y biblioteca | 8 | 2 |
| 9. Descargas Word | 8 | 3 |
| 10. Responsive | 9 | 2 |
| 11. Accesibilidad | 12 | 2 |
| 12. Recorridos críticos | 11 | 5 |
| 13. Smoke test | 11 | — |
| 14. Post-despliegue | 7 | — |
| **Total** | **141** | **58** |

---

## Versión mínima

Para cambios pequeños y de bajo riesgo, el mínimo innegociable:

```
□ El codemod se aplica sin error (mientras siga activo)
□ npm run build funciona en local
□ El despliegue de vista previa es correcto
□ Ningún secreto en el código
□ Los 5 recorridos P0 pasan en la vista previa
□ Smoke test en producción tras publicar
```

**Nunca menos que esto.** El proyecto no tiene pruebas automatizadas: la verificación manual es la única red de seguridad que existe.

---

## Nota final

Este checklist es largo porque hoy **no hay ninguna automatización**. A medida que avance la Fase 11 del roadmap (`20-`), las secciones 1, 2, 5, 6, 7, 12 se sustituyen por `npm test` en CI, y este documento se reduce a las verificaciones que solo una persona puede hacer: revisar un `.docx` abierto en Word, probar en un móvil real, y leer una sesión generada para comprobar que tiene sentido pedagógico.
