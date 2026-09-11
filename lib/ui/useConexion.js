import { useEffect, useState } from "react";

/* ==========================================================================
   ¿HAY INTERNET?

   Muchas docentes trabajan con datos móviles y conexiones que se caen a mitad
   de una generación de noventa segundos. Antes eso terminaba en un
   «Failed to fetch» en pantalla.

   Lo que se hace y lo que NO
   --------------------------
   Se escuchan los eventos `online`/`offline` del navegador, que son gratis y
   no hacen ninguna petición. NO hay sondeo: una llamada periódica «para ver si
   hay red» gastaría batería y datos justo a quien le faltan.

   `navigator.onLine` sólo garantiza lo negativo: si dice que NO hay red, no la
   hay. Si dice que sí, puede que la haya y aun así no llegue al servidor. Por
   eso se usa para EVITAR una petición condenada, nunca para asegurar que
   funcionará: de eso ya se encarga el manejo de errores.
   ========================================================================== */
export function useConexion() {
  const [enLinea, setEnLinea] = useState(
    () => (typeof navigator === "undefined" ? true : navigator.onLine !== false)
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const conectado = () => setEnLinea(true);
    const desconectado = () => setEnLinea(false);
    window.addEventListener("online", conectado);
    window.addEventListener("offline", desconectado);
    return () => {
      window.removeEventListener("online", conectado);
      window.removeEventListener("offline", desconectado);
    };
  }, []);

  return enLinea;
}
