# SciVerse para Docentes — cómo desplegarlo en Vercel

## Qué incluye esta versión

- El sitio completo (landing, registro, fichas STEAM, laboratorio 3D, retos,
  generador de sesiones, plantillas).
- **Registro real con contraseña y confirmación por correo en Supabase**.
  Incluye inicio y cierre de sesión y recuperación de contraseña.
- El registro solicita si el docente enseña en primaria o secundaria y abre
  automáticamente los materiales, retos y generador en el nivel elegido.
- **Generador de sesiones STEAM con Gemini** (la misma API que usas en tus
  otros proyectos como AmeLia), en vez de la API de Anthropic.
- **Panel de administración** en `/?admin=1` para ver la lista de docentes
  registrados.

## Requisitos

- Cuenta de [GitHub](https://github.com) (gratis)
- Cuenta de [Vercel](https://vercel.com) (gratis, puedes entrar con GitHub)
- Cuenta de [Supabase](https://supabase.com) (gratis)
- Una clave de la API de **Gemini**, se obtiene gratis en
  [aistudio.google.com/apikey](https://aistudio.google.com/apikey)

## Paso 1 — Crea el proyecto en Supabase

1. Entra a [supabase.com](https://supabase.com) → "New project".
2. Cuando esté listo, ve a **SQL Editor → New query**, pega el contenido
   del archivo `supabase-schema.sql` (incluido en este proyecto) y dale
   "Run". Esto crea la tabla `docentes`, conecta cada perfil con Supabase
   Auth y configura la seguridad.
3. Ve a **Settings → API** y copia tres valores, los vas a necesitar en el
   paso 3:
   - `Project URL`
   - `anon public` key
   - `service_role` key (⚠️ esta es secreta, nunca la pongas en el código
     del navegador — solo se usa en el panel de administración, del lado
     del servidor)
4. Ve a **Authentication → Providers → Email** y verifica que estén
   activadas las opciones **Enable Email provider** y **Confirm email**.
5. Ve a **Authentication → URL Configuration**:
   - En **Site URL** coloca la dirección publicada de tu página.
   - En **Redirect URLs** agrega esa misma dirección terminada en `/**`.
   - Mientras haces pruebas también puedes agregar `http://localhost:5173/**`.
6. En **Authentication → Email Templates → Confirm signup** puedes cambiar
   el asunto a `Activa tu cuenta de SciVerse | Teaching TIC` y personalizar
   el mensaje. No elimines el enlace `{{ .ConfirmationURL }}`.
7. Para probar sin SMTP propio, utiliza el mismo correo que pertenece al
   equipo de tu proyecto de Supabase. El correo predeterminado solo permite
   destinatarios del equipo y tiene un límite muy bajo. Para docentes reales,
   configura **Authentication → SMTP Settings** con Resend, Brevo u otro
   proveedor SMTP.

## Paso 2 — Consigue tu clave de Gemini

1. Entra a [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
2. Crea una clave nueva y cópiala.

## Paso 3 — Prueba local (opcional, pero recomendado)

```bash
npm install
cp .env.example .env.local
# abre .env.local y pega tus claves reales (Gemini + Supabase)
npm run dev
```

El generador de sesiones y el panel de administración necesitan las
funciones de `api/`, que solo corren con el CLI de Vercel — para probarlas
localmente usa `vercel dev` en vez de `npm run dev` (instala antes con
`npm i -g vercel`).

## Paso 4 — Sube el proyecto a GitHub

```bash
cd sciverse-docentes
git init
git add .
git commit -m "Primera versión de SciVerse para Docentes"
```

Crea un repositorio nuevo y vacío en GitHub, luego:

```bash
git remote add origin https://github.com/TU-USUARIO/sciverse-docentes.git
git branch -M main
git push -u origin main
```

## Paso 5 — Despliega en Vercel

1. Entra a [vercel.com](https://vercel.com) e inicia sesión con GitHub.
2. Clic en **"Add New" → "Project"** y elige el repositorio.
3. Vercel detecta que es un proyecto Vite automáticamente — no toques nada
   en "Build and Output Settings".
4. Antes de darle a "Deploy", abre **"Environment Variables"** y agrega
   estas seis (los valores que copiaste en los pasos 1 y 2):

   | Nombre | De dónde sale |
   |---|---|
   | `GEMINI_API_KEY` | Google AI Studio |
   | `VITE_SUPABASE_URL` | Supabase → Settings → API → Project URL |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase → Settings → API Keys → Publishable key (`sb_publishable_...`) |
   | `SUPABASE_URL` | el mismo Project URL de arriba |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role |
   | `ADMIN_SECRET` | invéntala tú — es la clave para entrar a `/?admin=1` |

5. Clic en **Deploy**. En 1–2 minutos tienes tu URL
   (`sciverse-docentes.vercel.app`).

## Paso 6 — Verifica que todo funcione

- Entra al sitio, regístrate como si fueras un docente.
- Abre el correo recibido, pulsa el enlace de confirmación y luego inicia
  sesión. Antes de confirmar, el sistema no debe permitir el ingreso.
- Ve a Supabase → **Table Editor → docentes** y confirma que tu registro
  apareció ahí.
- Entra a `tu-sitio.vercel.app/?admin=1`, pon la clave que elegiste en
  `ADMIN_SECRET`, y confirma que ves la lista.
- Prueba el generador de sesiones STEAM y confirma que Gemini responde.

## Dominio propio (opcional)

En el proyecto de Vercel, ve a **Settings → Domains**, agrega tu dominio
(por ejemplo `laboratorio.teachingtic.com`) y sigue las instrucciones para
apuntar el DNS.

## Cada vez que quieras actualizar el sitio

```bash
git add .
git commit -m "Descripción del cambio"
git push
```

Vercel vuelve a desplegar automáticamente.

## Seguridad — qué queda protegido y cómo

- La clave `anon` de Supabase es pública, pero las reglas RLS permiten a cada
  docente leer o modificar únicamente su propio perfil.
- La clave `service_role` (secreta) solo se usa dentro de
  `api/list-docentes.js`, que corre en el servidor de Vercel — nunca llega
  al navegador.
- Las contraseñas y la confirmación del correo son gestionadas por Supabase
  Auth; la aplicación nunca guarda contraseñas en la tabla `docentes`.
- El panel de administración pide la clave `ADMIN_SECRET` antes de mostrar
  la lista. Más adelante conviene reemplazarla por roles administrativos.

## Siguientes pasos sugeridos

- Exportar la lista de docentes a Excel/CSV desde el panel.
- Personalizar los correos con el logo y dominio de Teaching TIC.
- Analítica de uso del sitio (Vercel Analytics, un clic desde el dashboard).

Cuando quieras avanzar con cualquiera de estos, dime y lo armamos juntas.
