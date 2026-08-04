import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
// Supabase ahora muestra llaves "Publishable" (sb_publishable_...).
// Aceptamos ambos nombres para mantener compatibilidad con proyectos antiguos.
const anonKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;

// Si no configuraste Supabase todavía, el cliente queda en null y el
// registro sigue funcionando solo con localStorage (modo sin base de datos).
export const supabase = url && anonKey ? createClient(url, anonKey) : null;
