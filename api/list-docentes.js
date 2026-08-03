// Función serverless de Vercel: devuelve la lista de docentes registrados.
// Usa la clave "service role" de Supabase (secreta, solo vive en el
// servidor) para poder leer la tabla aunque las políticas de seguridad
// (RLS) bloqueen la lectura pública. Protegida con una clave simple de
// administrador (ADMIN_SECRET) para que no cualquiera pueda ver la lista.

import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  const { secret } = req.query;

  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    res.status(401).json({ error: "No autorizado" });
    return;
  }

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    res.status(500).json({ error: "Falta configurar SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en Vercel" });
    return;
  }

  try {
    const supabaseAdmin = createClient(url, serviceKey);
    const { data, error } = await supabaseAdmin
      .from("docentes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.status(200).json({ docentes: data });
  } catch (err) {
    res.status(500).json({ error: "No se pudo leer la lista de docentes" });
  }
}
