import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        /**
         * Three.js en su propio trozo.
         *
         * Sin esto acababa mezclado con el resto del atlas en un chunk
         * bautizado al azar («fuentes-XXXX.js»), que no dice nada al mirar la
         * pestaña de red. Sigue siendo diferido: sólo lo importa el atlas, y
         * el atlas sólo se pide cuando alguien lo abre.
         */
        manualChunks(id) {
          if (id.includes("node_modules/three/")) return "three";
          return undefined;
        },
      },
    },
  },
});
