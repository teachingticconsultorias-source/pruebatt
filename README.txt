SciVerse — Recursos de sesión
================================

Este paquete añade cuatro generadores funcionales después de una sesión:

1. Ficha de aprendizaje
2. Rúbrica analítica
3. Lista de cotejo
4. Escala de valoración

FUNCIONAMIENTO
- Usa GEMINI_API_KEY del proyecto Vercel.
- Requiere usuario autenticado en Supabase.
- Cada generación consume 1 de los 5 créditos semanales.
- Si Gemini falla, el crédito se devuelve.
- Cada recurso se guarda en `materiales_docente`.
- Los Word se crean en el navegador usando la dependencia `docx` que SciVerse ya tiene.

ORDEN RECOMENDADO
1. Ejecutar supabase-session-resources.sql.
2. Subir api/generate-session-resource.js.
3. Subir components/SessionResourcesPanel.jsx.
4. Subir session-resources.css.
5. Hacer el pequeño cambio indicado en INTEGRACION_App.jsx.txt.
6. Esperar el deployment de Vercel.
7. Probar con un usuario registrado.

NO SE INCLUYE PromptLab.
