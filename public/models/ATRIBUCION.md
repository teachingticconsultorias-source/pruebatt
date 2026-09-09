# Atribución de los modelos anatómicos

Este directorio contiene geometría de terceros. La licencia **exige** que esta
atribución viaje con los ficheros: no la borres ni la muevas fuera de aquí.

## BodyParts3D 4.0

- **Ficheros:** `atlas.json`, `body-0.bin.gz` … `body-14.bin.gz`
- **Obra:** BodyParts3D
- **Autoría:** © The Database Center for Life Science (DBCLS)
- **Licencia:** Creative Commons Atribución 4.0 Internacional (CC BY 4.0)
- **Texto de la licencia:** <https://creativecommons.org/licenses/by/4.0/>
- **Página oficial de licencia del dataset:**
  <https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html>
- **Descarga original:**
  <https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html>
  (`isa_BP3D_4.0_obj_99.zip`, 2.234 mallas OBJ individuales)
- **Cita académica:** Mitsuhashi N. *et al.* (2009). «BodyParts3D: 3D structure
  database for anatomical concepts». *Nucleic Acids Research*.
  <https://doi.org/10.1093/nar/gkn613>

### Qué se modificó

La geometría **no** se ha alterado. El empaquetado binario —agrupación en 15
bloques, posiciones en `Float32`, normales en `Int16` y índices en `Uint32`— es
el que publica el proyecto [human-atlas](https://github.com/ashemag/human-atlas)
(código bajo licencia MIT, © 2026 ashemag), del que se descargaron estos
ficheros ya empaquetados.

`atlas-es.json` es un añadido de SciVerse: los nombres de las 2.234 estructuras
traducidos al español, generados por `scripts/build-atlas-es.mjs` a partir de un
léxico revisado a mano. No contiene geometría.

### Alcance del modelo

Anatomía de referencia de un varón adulto (TARO MRI), 3.432 conceptos FMA. No
representa todas las estructuras ni todas las variantes anatómicas humanas. Es
material educativo: no sirve para diagnóstico ni para planificación quirúrgica.

## Lo que NO está aquí, y por qué

Del proyecto [OMFAtlas](https://github.com/choxos/OMFAtlas) no se ha reutilizado
ningún modelo. Sus datasets dentales llevan licencias incompatibles con un
producto comercial o que impondrían ShareAlike:

| Fichero de OMFAtlas | Licencia | Motivo del descarte |
|---|---|---|
| `open-full-jaw.bin` | CC BY-NC-SA 4.0 | **NonCommercial.** SciVerse tiene plan de pago. |
| `toothfairy.bin` | CC BY-SA 4.0 | ShareAlike sobre las mallas derivadas. |
| `facial.bin` | CC BY-SA 2.1 Japan | ShareAlike sobre las mallas derivadas. |

Las estructuras de cabeza, cuello y cavidad oral del atlas maxilofacial salen
del mismo BodyParts3D 4.0 de arriba, que sí es CC BY 4.0.

Detalle completo en `docs/ATLAS-3D-INTEGRATION.md`.
