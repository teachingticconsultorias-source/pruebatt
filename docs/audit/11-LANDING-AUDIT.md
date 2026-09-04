# 11 — Auditoría de la landing y propuesta V2

Archivo: `App.jsx:2481-2605` (`ImprovedLanding`), montado desde `AuthGate.jsx:177`.

---

## PARTE I — Análisis de la landing actual

### 1. Estructura actual

| # | Sección | Estado |
|---|---|---|
| 1 | Nav (marca, Pruébalo, Planes, Testimonios, Preguntas, Iniciar sesión, Acceder gratis) | 🔵 |
| 2 | Hero (titular, subtítulo, 2 CTA, línea de confianza, mockup animado) | 🔵 |
| 3 | Demo + Beneficios (tarjeta interactiva de actividad + 5 beneficios) | 🟢 |
| 4 | Testimonios (carrusel de 6) | 🟠 |
| 5 | Barra de confianza (3 puntos) | 🔵 |
| 6 | Preguntas frecuentes (8) | 🟢 |
| 7 | CTA final | 🔵 |
| 8 | Pie (4 columnas) | 🟢 |
| — | **Precios** | 🔴 **solo en modal** |

### 2. Lo que funciona

1. **La demo interactiva es el mejor elemento.** Muestra una actividad real (`ACTIVITIES[0]`) con conmutador primaria/secundaria funcionando en vivo. Deja ver el producto antes de registrarse: es exactamente lo que debe hacer una landing.
2. **Preguntas frecuentes honestas.** Ocho preguntas que abordan lo que de verdad pregunta un docente, incluida *"¿La inteligencia artificial puede equivocarse?" → "Sí. SciVerse es una herramienta de apoyo y el docente debe revisar el contenido"*. Esa franqueza construye confianza y protege legalmente.
3. **Pie completo.** RUC, correo, WhatsApp, redes, y los cuatro documentos legales incluido el Libro de Reclamaciones — obligatorio en Perú.
4. **Copy en español peruano, sin jerga.** "Lleva experiencias STEAM a tu aula" habla el idioma del usuario.
5. **Identidad visual con personalidad.** El mockup animado con órbitas y tarjetas flotantes comunica producto real.

### 3. Problemas

#### 3.1 🔴 Los precios no están en la página

**Dónde.** Solo en `PlansModal` (`App.jsx:2822`), abierto desde el nav o el pie.

**Por qué importa.**

- **El precio es la segunda pregunta de todo docente.** Un clic extra pierde visitantes.
- **Los buscadores no indexan el contenido del modal**, que se monta bajo demanda. Se pierde todo el tráfico de búsquedas como "cuánto cuesta plataforma sesiones CNEB" o "programa sesiones aprendizaje precio Perú".
- La sección `#planes` **no existe** aunque el dashboard enlace a `#planes-docente` internamente.

**Propuesta.** Sección visible entre Preguntas y CTA final, con las tres opciones y anclaje `#planes`.

#### 3.2 🔴 Elegir un plan de pago lleva al registro

```js
// App.jsx:2505 — definido y NUNCA usado
const choosePlan = (plan) => {
  if (plan.name === "Gratuito") return onRegister();
  window.open(`https://wa.me/51921090875?text=...`, "_blank");
};
// App.jsx:2601 — anula la lógica anterior
{showPlansModal && <PlansModal onClose={...} onChoosePlan={onRegister} />}
```

`PlansModal` tiene su propio `handleChoosePlan` funcional, pero recibe `onRegister` y lo ignora.

**Impacto.** El visitante pulsa "Elegir plan mensual" esperando instrucciones de pago y aterriza en un formulario de registro sin explicación. **Se pierde la conversión en el punto exacto de máxima intención.**

**Propuesta.** Pasar `onChoosePlan={choosePlan}` y eliminar la duplicación.

#### 3.3 🔴 SEO prácticamente inexistente

`index.html` completo:

```html
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SciVerse para Docentes</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=..." rel="stylesheet" />
</head>
```

Lo que falta:

| Elemento | Estado | Consecuencia |
|---|---|---|
| `<meta name="description">` | ❌ | Google inventa el fragmento a partir del contenido |
| Open Graph (`og:title`, `og:description`, `og:image`) | ❌ | Al compartir en WhatsApp o Facebook aparece un enlace desnudo — **crítico**, siendo WhatsApp el canal principal entre docentes peruanos |
| Twitter Card | ❌ | Igual |
| `<link rel="canonical">` | ❌ | Riesgo de contenido duplicado |
| `<html lang="es">` | ✅ | Correcto |
| Datos estructurados (JSON-LD) | ❌ | Sin resultados enriquecidos |
| `robots.txt` / `sitemap.xml` | ❌ | Rastreo sin guía |
| Favicon | ❌ | Icono genérico en la pestaña |
| `<h1>` único y descriptivo | ⚠️ | Existe, pero el título no contiene palabras clave de búsqueda |

**El más grave es Open Graph.** Los docentes comparten enlaces por WhatsApp. Sin `og:image` ni `og:description`, el enlace compartido aparece sin previsualización — y un enlace sin previsualización se abre mucho menos.

#### 3.4 🟠 El titular no dice qué hace el producto

> "Convierte tus ideas en **experiencias STEAM** listas para el aula."

Es evocador pero vago. No menciona lo que de verdad busca el usuario: **sesión de aprendizaje**, **CNEB**, **rúbrica**, **Word**, **tiempo ahorrado**.

Un docente peruano busca "sesiones de aprendizaje CNEB" o "programa mis sesiones rápido". El titular no conecta con esa intención ni para el usuario ni para el buscador.

**Propuesta.** Nombrar el resultado y el ahorro:

> **Tus sesiones de aprendizaje alineadas al CNEB, en minutos.**
> Crea sesiones, rúbricas y fichas listas para descargar en Word. Diseñado para docentes de primaria y secundaria del Perú.

#### 3.5 🟠 Testimonios sin respaldo visible

`TESTIMONIALS` (`App.jsx:2430`) presenta seis nombres con rol y cita como si fueran docentes reales.

No es un fallo técnico, pero sí un riesgo de veracidad publicitaria si no hay consentimiento documentado. Y un visitante escéptico nota la ausencia de foto, institución o cualquier elemento verificable, con lo que el testimonio resta credibilidad en vez de sumarla.

**Propuesta.** Sustituir por pruebas verificables (número de docentes registrados, materiales generados, instituciones), y reintroducir testimonios solo con consentimiento por escrito, nombre, institución y foto.

#### 3.6 🟠 No se explica cómo funciona

Se salta de la propuesta de valor a los beneficios sin mostrar el proceso. El visitante no sabe qué tendrá que hacer ni cuánto tardará.

**Propuesta.** Sección "Cómo funciona" de tres pasos: *Cuéntale a Kantu tu clase → Kantu genera la sesión completa → Descárgala en Word y llévala al aula*, con "menos de 3 minutos".

#### 3.7 🟡 El nav enlaza a "#demo" pero la etiqueta dice "Pruébalo"

La sección `#demo` es una tarjeta de vista previa, no algo con lo que se pueda interactuar libremente. La expectativa que genera "Pruébalo" no se cumple del todo.

**Propuesta.** Renombrar a "Ver ejemplo", o convertirla en una demo real donde el visitante escriba un tema y vea una sesión de ejemplo (sin gastar créditos, con resultados precocinados).

#### 3.8 🟡 Prop `onForgotPassword` declarada y sin uso

`ImprovedLanding({ onRegister, onLogin, onForgotPassword })` (`App.jsx:2481`) — el tercer parámetro nunca se usa en el cuerpo, y `AuthGate.jsx:177` tampoco lo pasa. Residuo de la `RegistrationGate` muerta.

#### 3.9 🟡 Documentos legales sin URL propia

`LegalModal` los muestra en modal. El **Libro de Reclamaciones** es una obligación legal en Perú y debe ser accesible y enlazable de forma permanente, no un estado de React.

#### 3.10 🟡 Sin nada dirigido a instituciones

Toda la landing habla al docente individual. No hay mensaje para directores, coordinadores o UGEL — que es donde están las ventas de mayor volumen.

#### 3.11 🟢 Accesibilidad del menú móvil

El botón usa el icono `Layers` en lugar de un menú de hamburguesa reconocible, aunque `aria-label` y `aria-expanded` están correctos.

---

## PARTE II — Propuesta de Landing V2

> **PROPUESTO — estructura, no implementación.**

### Objetivo

Un docente peruano que llega desde una búsqueda o desde WhatsApp debe, en menos de 30 segundos: entender qué hace el producto, ver que es para él, comprobar que es gratis para empezar, y registrarse.

### Estructura

```
┌──────────────────────────────────────────────────────────┐
│ 0. BARRA SUPERIOR                                        │
│    Marca · Cómo funciona · Herramientas · Precios ·      │
│    Preguntas | Iniciar sesión · [Empezar gratis]         │
├──────────────────────────────────────────────────────────┤
│ 1. HERO                                                  │
│    H1: Tus sesiones de aprendizaje alineadas al CNEB,    │
│        en minutos.                                       │
│    Sub: Crea sesiones, rúbricas y fichas listas para     │
│         descargar en Word. Para docentes de primaria y   │
│         secundaria del Perú.                             │
│    [Crear mi primera sesión gratis] [Ver un ejemplo ↓]   │
│    ✓ Gratis para empezar  ✓ Sin tarjeta  ✓ En español    │
│    → Visual: sesión real generada, no un mockup abstracto│
├──────────────────────────────────────────────────────────┤
│ 2. PRUEBA SOCIAL BREVE                                   │
│    "Ya lo usan N docentes de M instituciones"            │
│    (solo cifras verificables; si no las hay, se omite)   │
├──────────────────────────────────────────────────────────┤
│ 3. EL PROBLEMA                                           │
│    "Programar una sesión toma 40 minutos. Tienes 25 a    │
│     la semana y también hay que enseñar."                │
├──────────────────────────────────────────────────────────┤
│ 4. CÓMO FUNCIONA — 3 pasos                               │
│    1 Cuéntale tu clase  2 Kantu la genera  3 Descarga    │
│    "Menos de 3 minutos, de principio a fin."             │
├──────────────────────────────────────────────────────────┤
│ 5. DEMO EN VIVO ⭐                                        │
│    Escribe un tema → ve una sesión de ejemplo            │
│    (resultados precocinados, sin gastar créditos)        │
│    Con conmutador primaria/secundaria                    │
├──────────────────────────────────────────────────────────┤
│ 6. HERRAMIENTAS — solo las que funcionan de verdad       │
│    Sesión · Proyecto STEAM · Rúbrica · Lista de cotejo   │
│    Escala de valoración · Ficha · Lectura · Sopa de      │
│    letras · Reto grupal · 17 actividades STEAM           │
├──────────────────────────────────────────────────────────┤
│ 7. ALINEACIÓN AL CNEB — el diferenciador                 │
│    Competencias y capacidades oficiales, procesos        │
│    didácticos por área, enfoques transversales, DUA      │
│    → Es lo que ningún generador genérico ofrece          │
├──────────────────────────────────────────────────────────┤
│ 8. RESULTADO REAL                                        │
│    Vista previa del .docx generado, con tablas y formato │
├──────────────────────────────────────────────────────────┤
│ 9. PRECIOS ⭐ (hoy oculto en modal)                       │
│    Gratuito · Mensual · Institucional (consultar)        │
│    Cifras coherentes con lo que la base concede          │
├──────────────────────────────────────────────────────────┤
│ 10. PARA INSTITUCIONES (nuevo)                           │
│     Licencias por colegio, capacitación, seguimiento     │
│     [Solicitar propuesta]                                │
├──────────────────────────────────────────────────────────┤
│ 11. TESTIMONIOS — solo con consentimiento verificable    │
├──────────────────────────────────────────────────────────┤
│ 12. PREGUNTAS FRECUENTES (conservar las 8 + 4 nuevas)    │
├──────────────────────────────────────────────────────────┤
│ 13. CTA FINAL                                            │
│     "Tu próxima sesión puede estar lista en 3 minutos."  │
├──────────────────────────────────────────────────────────┤
│ 14. PIE (conservar, añadir URLs legales propias)         │
└──────────────────────────────────────────────────────────┘
```

### Cambios respecto a la actual

| # | Cambio | Motivo |
|---|---|---|
| 1 | **Precios en la página** | Elimina el clic extra y hace el contenido indexable |
| 2 | **Titular con palabras clave reales** | "sesiones de aprendizaje" y "CNEB" son lo que se busca |
| 3 | **Sección "Cómo funciona"** | Elimina la incertidumbre sobre el proceso |
| 4 | **Demo interactiva de verdad** | Convierte la vista previa pasiva en experiencia |
| 5 | **Sección de alineación al CNEB** | Es el diferenciador y hoy no se argumenta |
| 6 | **Vista previa del Word** | El entregable real es lo que convence |
| 7 | **Sección para instituciones** | Abre el canal de mayor volumen |
| 8 | **Sección del problema** | Genera identificación antes de proponer solución |
| 9 | **Testimonios verificables o fuera** | Un testimonio dudoso resta credibilidad |
| 10 | **Metadatos y Open Graph** | Sin ellos no hay tráfico ni previsualización al compartir |

### Copy propuesto

**H1:** Tus sesiones de aprendizaje alineadas al CNEB, en minutos.

**Subtítulo:** Crea sesiones, rúbricas, fichas y proyectos STEAM listos para descargar en Word. Diseñado con los procesos didácticos oficiales de cada área, para docentes de primaria y secundaria del Perú.

**CTA principal:** Crear mi primera sesión gratis
**CTA secundaria:** Ver un ejemplo

**Sección del problema:**
> Programar una sesión completa toma cerca de 40 minutos: propósito, criterios, evidencia, secuencia didáctica, instrumento de evaluación. Multiplícalo por las sesiones de tu semana. **SciVerse hace el primer borrador; tú aportas el criterio.**

**Sección CNEB:**
> No es un generador de textos genérico. SciVerse conoce las competencias y capacidades oficiales del CNEB, los procesos didácticos de cada área —indagación, diseño tecnológico, los tres momentos de la lectura, resolución de problemas— y los enfoques transversales. Por eso lo que genera se parece a lo que tu institución espera recibir.

**Preguntas nuevas a añadir:**

- ¿Necesito saber de inteligencia artificial? → No. Completas un formulario con lo que ya sabes de tu clase.
- ¿Puedo editar lo que genera? → *(Responder con honestidad según el estado real; hoy la respuesta sería que se descarga en Word para editar, y esto debe cambiar — ver `03-UX-AUDIT.md` §5.5.)*
- ¿Mis datos y materiales son privados? → Sí. Solo tú ves tu biblioteca.
- ¿Funciona en celular? → Sí, desde el navegador, sin instalar nada.

### Metadatos necesarios

```html
<!-- PROPUESTO — todavía no existe -->
<title>SciVerse · Sesiones de aprendizaje CNEB con IA para docentes del Perú</title>
<meta name="description" content="Crea sesiones de aprendizaje, rúbricas y fichas alineadas al CNEB en minutos. Descárgalas en Word. Gratis para empezar. Para docentes de primaria y secundaria del Perú." />
<link rel="canonical" href="https://[dominio]/" />

<meta property="og:type" content="website" />
<meta property="og:title" content="SciVerse · Sesiones CNEB en minutos" />
<meta property="og:description" content="Sesiones, rúbricas y fichas alineadas al CNEB, listas para Word. Gratis para empezar." />
<meta property="og:image" content="https://[dominio]/og-image.png" />
<meta property="og:locale" content="es_PE" />
<meta name="twitter:card" content="summary_large_image" />

<link rel="icon" href="/favicon.svg" />
```

Más `robots.txt`, `sitemap.xml` y JSON-LD de tipo `SoftwareApplication` con `offers`.

### Métricas a seguir

Una vez exista analítica (ver `19-`):

| Métrica | Referencia |
|---|---|
| Visitante → registro iniciado | 8-12 % |
| Registro iniciado → completado | > 70 % |
| Registro → correo confirmado | > 60 % |
| Confirmado → primera sesión generada | > 50 % |
| Rebote en la landing | < 55 % |
| Alcance del scroll a precios | > 40 % |

### Orden de implementación

| Fase | Acción | Esfuerzo |
|---|---|---|
| **1** | Metadatos, Open Graph, favicon, `robots.txt` | XS |
| **2** | Arreglar `onChoosePlan` (una línea) | XS |
| **3** | Sección de precios visible con cifras coherentes | S |
| **4** | Nuevo titular y sección del problema | S |
| **5** | Sección "Cómo funciona" | S |
| **6** | Sección de alineación al CNEB | S |
| **7** | Vista previa del Word generado | M |
| **8** | Demo interactiva real | M |
| **9** | Sección para instituciones | S |
| **10** | Resolver los testimonios | S |
| **11** | Páginas legales con URL propia | S — requiere router |

Las cuatro primeras suman menos de un día y son las que más mueven la conversión.
