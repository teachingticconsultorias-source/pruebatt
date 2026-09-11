import { useCallback, useEffect, useRef, useState } from "react";

/* ==========================================================================
   UNA OPERACIÓN CARA, UNA SOLA VEZ

   EL PROBLEMA REAL
   ----------------
   Todos los generadores protegían el doble clic con `disabled={loading}` y un
   `setLoading(true)` al principio del manejador. Eso NO basta: `setLoading` es
   asíncrono. Dos clics separados por 40 ms ocurren ambos antes de que React
   vuelva a pintar, así que los dos encuentran el botón habilitado y los dos
   entran. El resultado es dos llamadas a Gemini y —donde la operación cobra—
   dos reservas de idempotencia compitiendo por la misma clave.

   La idempotencia del servidor evita el cobro doble, pero el navegador no
   debería llegar a intentarlo: la segunda petición gasta cuota, ensucia los
   logs y deja a la docente mirando un error que ella no provocó.

   LA GUARDA ES UNA REFERENCIA, NO UN ESTADO
   -----------------------------------------
   Una `ref` se actualiza en la misma vuelta del bucle de eventos. El segundo
   clic la encuentra ya en `true` y se descarta sin efectos.

   NO sustituye al `disabled` del botón: el `disabled` es lo que la docente VE,
   y esto es lo que garantiza que no ocurra. Van juntos.
   ========================================================================== */

/**
 * Envuelve una acción para que no pueda ejecutarse dos veces a la vez.
 *
 * @returns {[Function, boolean]} `ejecutar(accion)` y si hay una en curso.
 */
export function useAccionUnica() {
  const enCurso = useRef(false);
  const vivo = useRef(true);
  const [activa, setActiva] = useState(false);

  useEffect(() => () => { vivo.current = false; }, []);

  const ejecutar = useCallback(async (accion) => {
    if (enCurso.current || typeof accion !== "function") return undefined;
    enCurso.current = true;
    if (vivo.current) setActiva(true);
    try {
      return await accion();
    } finally {
      enCurso.current = false;
      // Si el componente se desmontó mientras tanto, escribir estado dispararía
      // un aviso de React y no serviría de nada.
      if (vivo.current) setActiva(false);
    }
  }, []);

  return [ejecutar, activa];
}
