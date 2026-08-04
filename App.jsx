import React, { useState, useRef, useEffect, useCallback } from "react";
import * as THREE from "three";
import { supabase } from "./supabaseClient.js";
import AuthGate from "./AuthGate.jsx";
import {
  FlaskConical,
  Atom,
  Dna,
  Microscope,
  Users,
  Download,
  Printer,
  GraduationCap,
  Zap,
  X,
  ChevronRight,
  BookOpen,
  Target,
  Clock,
  Layers,
  Sparkles,
  ClipboardList,
  Award,
  School,
  ArrowRight,
  Cpu,
  Cog,
  Palette,
  Calculator,
  Loader2,
  Wand2,
  RotateCw,
  User,
  Mail,
  Phone,
  LogOut,
  LockKeyhole,
  CheckCircle2,
  Facebook,
  MessageCircle,
  ShieldCheck,
  HelpCircle,
  FileText,
} from "lucide-react";

/* ---------------------------------------------------------------------- */
/* TOKENS                                                                  */
/* ---------------------------------------------------------------------- */

const C = {
  bg: "#FAFEFE",
  surface: "#FFFFFF",
  surface2: "#F1FBFA",
  line: "rgba(15,61,58,0.14)",
  lineSoft: "rgba(15,61,58,0.07)",
  text: "#0F2E2C",
  muted: "#5B7876",
  teal: "#3EC6C0", // color primario, del logo
  tealDeep: "#1F9E98",
  coral: "#FB6542", // del logo
  yellow: "#FFBB00", // del logo
  violet: "#FB6542", // alias: mismo coral, usado como acento secundario
  amber: "#FFBB00", // primaria
  cyan: "#1F9E98", // secundaria
};

const CNEB = {
  indaga: "Indaga mediante métodos científicos para construir sus conocimientos",
  explica:
    "Explica el mundo físico basándose en conocimientos sobre los seres vivos, materia y energía, biodiversidad, Tierra y universo",
  disena: "Diseña y construye soluciones tecnológicas para resolver problemas de su entorno",
  datos: "Resuelve problemas de gestión de datos e incertidumbre",
  cambio: "Resuelve problemas de regularidad, equivalencia y cambio",
  crea: "Crea proyectos desde los lenguajes artísticos",
};

/* ---------------------------------------------------------------------- */
/* CONTENT                                                                 */
/* ---------------------------------------------------------------------- */

const SUBJECTS = {
  fisica: { label: "Física", icon: Zap, color: C.teal },
  quimica: { label: "Química", icon: FlaskConical, color: C.violet },
  biologia: { label: "Biología", icon: Dna, color: "#6FE6A8" },
  tecnologia: { label: "Tecnología", icon: Cpu, color: "#4FA8FF" },
  ingenieria: { label: "Ingeniería", icon: Cog, color: "#FF8A5B" },
  arte: { label: "Arte", icon: Palette, color: "#FF6FA8" },
  matematica: { label: "Matemática", icon: Calculator, color: "#FFD166" },
};

const ACTIVITIES = [
  {
    id: "caida-libre",
    subject: "fisica",
    code: "EXP-101",
    title: "Caída libre: ¿qué llega primero al suelo?",
    competencia: CNEB.explica,
    versions: {
      primaria: {
        objetivo:
          "Comparar, mediante la observación directa en el laboratorio virtual, la caída de dos objetos de distinto peso soltados desde la misma altura, registrando si su predicción inicial coincidió o no con el resultado, para reconocer que el peso no determina la velocidad de caída.",
        duracion: "30–35 min",
        materiales: ["Laboratorio de Física de SciVerse", "Hoja de predicciones (ver plantillas)", "Lápiz"],
        pasos: [
          "Antes de abrir el laboratorio, pide a cada estudiante que escriba su predicción: ¿cuál objeto cae primero, el liviano o el pesado?",
          "Abran juntos el experimento 'Caída libre' y suelten un objeto liviano y uno pesado desde la misma altura.",
          "Observen el resultado en cámara lenta y anótenlo junto a la predicción inicial.",
          "Repitan cambiando la altura con el control deslizante y comparen los tiempos.",
          "Conversen en grupo: ¿por qué muchas veces creemos que lo pesado cae más rápido?",
        ],
        cierre:
          "Pregunta de cierre: 'Si soltáramos una pluma y una piedra en la Luna, ¿qué pasaría?' (para abrir la conversación sobre el aire y la gravedad, sin necesidad de fórmulas).",
      },
      secundaria: {
        objetivo:
          "Verificar, mediante mediciones realizadas en el laboratorio virtual con al menos tres alturas distintas, la relación entre altura, gravedad y tiempo de caída, contrastando los resultados con la fórmula t = √(2h/g) con un margen de error menor al 10%, para comprender la validez del modelo matemático que describe la caída libre.",
        duracion: "40–45 min",
        materiales: ["Laboratorio de Física de SciVerse", "Calculadora", "Ficha de registro de datos"],
        pasos: [
          "Presenta la fórmula t = √(2h/g) y pide una hipótesis sobre qué pasa con t si h se duplica.",
          "En el laboratorio, fijen la gravedad en 9.8 m/s² y midan el tiempo de caída para 3 alturas distintas.",
          "Registren los datos en la ficha y calculen el tiempo teórico con la fórmula para cada altura.",
          "Cambien la gravedad (por ejemplo, a la de la Luna, 1.6 m/s²) y repitan la medición.",
          "En grupos, grafiquen tiempo vs. altura y discutan si la relación es lineal o no.",
        ],
        cierre:
          "Reto de cierre: pedir que calculen cuánto tardaría un objeto en caer desde el punto más alto de su colegio, usando la fórmula.",
      },
    },
  },
  {
    id: "pendulo",
    subject: "fisica",
    code: "EXP-104",
    title: "El péndulo: ¿de qué depende su ritmo?",
    competencia: CNEB.indaga,
    versions: {
      primaria: {
        objetivo: "Describir, contando el número de oscilaciones de un péndulo en 15 segundos con dos longitudes distintas en el laboratorio virtual, la diferencia de ritmo observada entre ambas, señalando cuál péndulo osciló más lento, para relacionar la longitud del péndulo con su velocidad de movimiento.",
        duracion: "25–30 min",
        materiales: ["Laboratorio de Física de SciVerse", "Cronómetro (o el del laboratorio)"],
        pasos: [
          "Muestra el péndulo del laboratorio y pregunta: '¿creen que un péndulo largo se mueve más rápido o más lento que uno corto?'",
          "Cuenten en voz alta cuántas veces va y viene el péndulo en 15 segundos con el hilo corto.",
          "Alarguen el hilo con el control deslizante y repitan el conteo.",
          "Anoten ambos resultados en la pizarra y comparen.",
        ],
        cierre: "Cierre con dibujo: cada estudiante dibuja un péndulo 'rápido' y uno 'lento' y explica la diferencia con sus palabras.",
      },
      secundaria: {
        objetivo:
          "Comprobar, mediante la medición del periodo de un péndulo para cuatro longitudes distintas en el laboratorio virtual, la relación entre longitud y periodo, comparando el valor medido con el valor teórico calculado con la fórmula T = 2π√(L/g) con una diferencia menor al 10%, para validar el modelo matemático del movimiento pendular.",
        duracion: "40 min",
        materiales: ["Laboratorio de Física de SciVerse", "Ficha de registro de datos"],
        pasos: [
          "Presenta la fórmula T = 2π√(L/g) sin resolverla todavía.",
          "Midan el periodo del laboratorio para 4 longitudes distintas de péndulo y regístrenlas.",
          "Calculen el periodo teórico con la fórmula para cada longitud y comparen con lo medido.",
          "Grafiquen T frente a √L y observen si la relación se aproxima a una línea recta.",
        ],
        cierre: "Pregunta de cierre: '¿Qué pasaría con el periodo si hiciéramos este experimento en la Luna?'",
      },
    },
  },
  {
    id: "acido-base",
    subject: "quimica",
    code: "EXP-207",
    title: "Ácidos y bases: la reacción que burbujea",
    competencia: CNEB.explica,
    versions: {
      primaria: {
        objetivo: "Describir, a partir de la observación de la mezcla de dos sustancias en el laboratorio virtual de química, los cambios visibles ocurridos (burbujas, color o temperatura), registrándolos en una hoja de observaciones con al menos dos detalles correctos, para reconocer que al mezclar ciertas sustancias ocurren reacciones.",
        duracion: "25–30 min",
        materiales: ["Laboratorio de Química de SciVerse", "Hoja de observaciones con dibujos"],
        pasos: [
          "Pregunta qué creen que pasará al mezclar los dos frascos disponibles en el experimento de neutralización.",
          "Realicen la mezcla en el laboratorio y observen juntos la animación de la reacción.",
          "Pidan a los estudiantes que dibujen lo que vieron: burbujas, cambio de color, etc.",
          "Conversen sobre otros ejemplos cotidianos parecidos (vinagre y bicarbonato en casa).",
        ],
        cierre: "Cierre: cada estudiante completa la frase 'Cuando junté las dos sustancias, observé que...'",
      },
      secundaria: {
        objetivo: "Identificar, mediante la ejecución de la reacción de neutralización en el laboratorio virtual, el cambio de pH ocurrido al mezclar un ácido con una base, explicándolo con la ecuación química simplificada de la reacción, para comprender el proceso de neutralización ácido-base.",
        duracion: "40–45 min",
        materiales: ["Laboratorio de Química de SciVerse", "Ficha de registro", "Tabla periódica (referencia)"],
        pasos: [
          "Presenta el concepto de pH y pide una hipótesis sobre cómo cambiará al mezclar un ácido con una base.",
          "Ejecuten la reacción de neutralización en el laboratorio y registren el cambio observado.",
          "Escriban en grupo la ecuación química simplificada de la reacción.",
          "Comparen con otra reacción disponible (por ejemplo, catálisis) y discutan qué tienen en común y en qué se diferencian.",
        ],
        cierre: "Reto: pedir un ejemplo de la vida diaria donde ocurra una neutralización ácido-base y que lo argumenten con evidencia.",
      },
    },
  },
  {
    id: "catalizadores",
    subject: "quimica",
    code: "EXP-209",
    title: "Catalizadores: ¿qué acelera una reacción?",
    competencia: CNEB.indaga,
    versions: {
      primaria: {
        objetivo: "Comparar, cronometrando dos ejecuciones de una misma reacción en el laboratorio virtual (con y sin acelerador), el tiempo que demora cada una en completarse, identificando cuál terminó primero, para reconocer que existen sustancias que aceleran una reacción.",
        duracion: "25 min",
        materiales: ["Laboratorio de Química de SciVerse"],
        pasos: [
          "Ejecuten la reacción de catálisis del laboratorio dos veces: una sin acelerador y otra con él.",
          "Pidan a los estudiantes que comparen con un cronómetro cuál reacción termina primero.",
          "Conversen: '¿qué creen que hizo la sustancia extra?'",
        ],
        cierre: "Cierre con analogía: comparar el catalizador con algo que 'ayuda a apurar' una tarea cotidiana (por ejemplo, un ventilador que seca la ropa más rápido).",
      },
      secundaria: {
        objetivo: "Explicar, a partir de la medición del tiempo de reacción con y sin catalizador en el laboratorio virtual, el efecto del catalizador sobre la velocidad de reacción, relacionándolo con el concepto de energía de activación en un texto breve, para comprender por qué el catalizador acelera la reacción sin consumirse.",
        duracion: "40 min",
        materiales: ["Laboratorio de Química de SciVerse", "Ficha de registro de datos"],
        pasos: [
          "Presenta el concepto de energía de activación con un esquema simple en la pizarra.",
          "Midan el tiempo de reacción sin catalizador y regístrenlo.",
          "Repitan con catalizador y comparen los tiempos.",
          "En grupos, expliquen con sus palabras por qué el catalizador reduce el tiempo sin ser consumido en la reacción.",
        ],
        cierre: "Pregunta de cierre: '¿por qué las enzimas del cuerpo humano se consideran catalizadores biológicos?'",
      },
    },
  },
  {
    id: "celula",
    subject: "biologia",
    code: "EXP-303",
    title: "Dentro de la célula: partes y funciones",
    competencia: CNEB.explica,
    versions: {
      primaria: {
        objetivo: "Identificar, explorando el modelo 3D de la célula vegetal y animal en el laboratorio interactivo, las partes principales de la célula (núcleo, membrana y citoplasma), etiquetándolas correctamente en una ficha, para reconocer la estructura básica de una célula.",
        duracion: "30 min",
        materiales: ["Laboratorio 3D de Biología de SciVerse", "Ficha para colorear/etiquetar"],
        pasos: [
          "Exploren juntos el modelo 3D de la célula vegetal y la célula animal en el laboratorio interactivo.",
          "Pidan a los estudiantes que identifiquen qué parte creen que es el 'centro de control' (núcleo) y toquen ese punto en el modelo.",
          "Giren el modelo para observar la membrana que envuelve todo.",
          "Completen la ficha uniendo cada parte con su nombre.",
        ],
        cierre: "Cierre: comparar la célula con una 'casa' — el núcleo como el jefe de la casa, la membrana como la pared, etc.",
      },
      secundaria: {
        objetivo: "Relacionar, explorando en 3D los organelos de la célula animal y vegetal en el laboratorio interactivo, la estructura de cada organelo con su función, completando una tabla comparativa con al menos cuatro organelos correctamente descritos, para comprender cómo la estructura celular sostiene sus funciones vitales.",
        duracion: "45 min",
        materiales: ["Laboratorio 3D de Biología de SciVerse", "Tabla comparativa (plantilla)"],
        pasos: [
          "Exploren en 3D la mitocondria, el cloroplasto o el aparato de Golgi según el tipo de célula, tocando cada organelo para leer su función.",
          "Completen una tabla comparando organelos presentes en célula animal vs. vegetal.",
          "Discutan por qué solo la célula vegetal tiene cloroplastos y pared celular.",
          "Cierren relacionando la función de cada organelo con un proceso vital (respiración, fotosíntesis, síntesis de proteínas).",
        ],
        cierre: "Reto: elaborar un mapa conceptual que conecte estructura → función para al menos 4 organelos.",
      },
    },
  },
  {
    id: "neurona",
    subject: "biologia",
    code: "EXP-306",
    title: "La neurona: cómo viajan los mensajes del cuerpo",
    competencia: CNEB.explica,
    versions: {
      primaria: {
        objetivo: "Describir, a partir de la exploración del modelo 3D de la neurona en el laboratorio interactivo, cómo el cuerpo envía mensajes de una célula a otra, dando al menos un ejemplo de una reacción rápida del cuerpo, para reconocer la función de las neuronas en la comunicación del organismo.",
        duracion: "25–30 min",
        materiales: ["Laboratorio 3D de Biología de SciVerse"],
        pasos: [
          "Muestren el modelo 3D de la neurona en el laboratorio y describan su forma (parece un árbol con raíces largas).",
          "Expliquen con una analogía: la neurona es como un 'cable' que lleva avisos, por ejemplo 'la mano toca algo caliente'.",
          "Pidan ejemplos de situaciones donde el cuerpo reacciona rápido (tocar algo caliente, ver una pelota venir).",
        ],
        cierre: "Cierre con juego: en cadena humana, simular cómo viaja un mensaje de neurona en neurona hasta el cerebro.",
      },
      secundaria: {
        objetivo: "Describir, explorando el modelo 3D de la neurona en el laboratorio interactivo, el proceso de transmisión del impulso nervioso desde las dendritas hasta el axón, relacionándolo con la velocidad de un reflejo del cuerpo humano, para comprender el rol del sistema nervioso en la respuesta rápida del organismo.",
        duracion: "40 min",
        materiales: ["Laboratorio 3D de Biología de SciVerse", "Ficha de registro"],
        pasos: [
          "Exploren el modelo 3D señalando dendritas, cuerpo celular (soma) y axón.",
          "Expliquen brevemente el concepto de sinapsis como el punto de conexión entre neuronas.",
          "En grupos, investiguen y discutan por qué algunos reflejos son más rápidos que decisiones conscientes.",
          "Relacionen lo observado con un caso real: el reflejo de retirar la mano de algo caliente.",
        ],
        cierre: "Pregunta de cierre: '¿qué pasaría si el impulso nervioso viajara más lento de lo normal?'",
      },
    },
  },
  {
    id: "algoritmos",
    subject: "tecnologia",
    code: "EXP-401",
    title: "Algoritmos sin computadora: ¿cómo le doy instrucciones a alguien?",
    competencia: CNEB.disena,
    versions: {
      primaria: {
        objetivo: "Elaborar, mediante el juego de dar instrucciones a un compañero con tarjetas de movimiento, una secuencia de pasos precisos que guíe al 'robot' a través de un circuito con obstáculos, logrando completar el recorrido sin errores en al menos un intento, para comprender qué es un algoritmo.",
        duracion: "30 min",
        materiales: ["Tarjetas de movimiento (adelante, girar, detenerse)", "Un circuito simple con obstáculos en el aula"],
        pasos: [
          "En parejas, un estudiante hace de 'robot' y el otro le da instrucciones usando solo las tarjetas de movimiento.",
          "El 'robot' solo puede hacer exactamente lo que dice la tarjeta, ni más ni menos.",
          "Prueben guiar al 'robot' a través del circuito con obstáculos.",
          "Si el robot choca o se equivoca, conversen: ¿la instrucción era clara o ambigua?",
        ],
        cierre: "Cierre: conectar con la idea de que las computadoras necesitan instrucciones muy precisas y ordenadas, igual que el 'robot' del juego.",
      },
      secundaria: {
        objetivo: "Diseñar, en grupos, un diagrama de flujo con al menos una estructura condicional que resuelva un problema cotidiano (como el funcionamiento de un semáforo), simulándolo manualmente con distintos casos de entrada sin errores lógicos, para aplicar el pensamiento algorítmico a una situación real.",
        duracion: "45 min",
        materiales: ["Ficha de diagrama de flujo en blanco", "Tarjetas de símbolos (inicio, decisión, proceso, fin)"],
        pasos: [
          "Plantea un problema real: '¿cómo decide un semáforo cuándo cambiar de color?'",
          "En grupos, diseñen un diagrama de flujo con al menos una decisión condicional (si... entonces...).",
          "Intercambien diagramas entre grupos y simulen manualmente qué pasaría con distintos casos de entrada.",
          "Discutan qué pasaría si faltara una condición o si dos condiciones se contradicen.",
        ],
        cierre: "Reto: pedir que diseñen el algoritmo de otro sistema cotidiano (una alarma, un ascensor) usando el mismo formato.",
      },
    },
  },
  {
    id: "puente-resistente",
    subject: "ingenieria",
    code: "EXP-501",
    title: "Ingenieros por un día: diseña una estructura que resista",
    competencia: CNEB.disena,
    versions: {
      primaria: {
        objetivo: "Construir, en equipos y con materiales limitados (papel y cinta), una estructura tipo puente capaz de sostener un peso pequeño sin caerse, rediseñándola al menos una vez si falla en la primera prueba, para reconocer qué formas hacen más resistente una estructura.",
        duracion: "35–40 min",
        materiales: ["Hojas de papel", "Cinta adhesiva", "Un objeto pequeño para usar como peso (borrador, moneda)"],
        pasos: [
          "Reta a los estudiantes, en grupos, a construir un 'puente' de papel que sostenga el peso sin caerse.",
          "Denles un tiempo límite para construir su primer diseño y probarlo.",
          "Si el puente cede, permite que lo rediseñen usando lo que observaron.",
          "Comparen qué formas (dobleces, columnas) resistieron mejor.",
        ],
        cierre: "Cierre: conversar sobre por qué doblar el papel (como un acordeón) lo hace más fuerte que dejarlo plano.",
      },
      secundaria: {
        objetivo: "Diseñar y construir, aplicando el proceso de ingeniería (definir, diseñar, construir, probar, mejorar) y con una cantidad limitada de materiales, una estructura capaz de soportar la mayor carga posible, registrando el peso soportado en al menos dos versiones del diseño, para relacionar la cantidad de material usado con la resistencia lograda.",
        duracion: "50 min",
        materiales: ["Palitos de madera o sorbetes", "Cinta adhesiva", "Pesas o monedas para la prueba de carga", "Ficha de registro de iteraciones"],
        pasos: [
          "Presenta la restricción: cada grupo tiene un número limitado de materiales (por ejemplo, 15 palitos y 50 cm de cinta).",
          "Diseñen y construyan una estructura que debe soportar el mayor peso posible.",
          "Prueben la estructura agregando peso gradualmente y registren en qué punto falla.",
          "Rediseñen una segunda versión y comparen el resultado con la primera, registrando ambos intentos en la ficha.",
        ],
        cierre: "Reto: pedir que expliquen, con datos de su ficha, la relación entre la cantidad de material usado y la resistencia lograda.",
      },
    },
  },
  {
    id: "simetria-naturaleza",
    subject: "arte",
    code: "EXP-601",
    title: "Patrones y simetría en la naturaleza",
    competencia: CNEB.crea,
    versions: {
      primaria: {
        objetivo: "Crear, mediante la técnica de pintura espejada (doblado de papel), una figura con un eje de simetría reconocible, identificándolo correctamente al mostrarla a la clase, para reconocer patrones simétricos presentes en la naturaleza.",
        duracion: "30 min",
        materiales: ["Imágenes de hojas, mariposas y flores", "Papel", "Témpera o crayolas"],
        pasos: [
          "Muestren imágenes de mariposas, hojas y flores y pidan identificar dónde está el 'espejo' (eje de simetría).",
          "Cada estudiante dobla una hoja de papel por la mitad y pinta con témpera solo en un lado.",
          "Doblan el papel para que la pintura se transfiera al otro lado, creando una figura simétrica.",
          "Comparen sus creaciones y encuentren el eje de simetría en cada una.",
        ],
        cierre: "Cierre: cada estudiante muestra su creación y señala su eje de simetría.",
      },
      secundaria: {
        objetivo: "Diseñar, midiendo proporciones en ejemplos de arte o arquitectura y aplicando una cuadrícula basada en el número áureo (≈1.618), una composición artística propia que respete esa proporción, explicando su elección con al menos un cálculo de razón entre segmentos, para comprender la presencia de la proporción áurea en el arte y la naturaleza.",
        duracion: "45 min",
        materiales: ["Regla", "Calculadora", "Ejemplos de obras de arte (Partenón, Mona Lisa) para observar", "Papel cuadriculado"],
        pasos: [
          "Presenta el número áureo (≈1.618) y su relación con la razón entre segmentos de una figura.",
          "En grupos, midan proporciones en ejemplos de arte o arquitectura y calculen la razón entre segmentos.",
          "Diseñen una cuadrícula basada en la proporción áurea sobre papel cuadriculado.",
          "Creen una composición artística sencilla (dibujo o collage) usando esa cuadrícula como guía.",
        ],
        cierre: "Pregunta de cierre: '¿por qué creen que esta proporción aparece tanto en el arte como en la naturaleza?'",
      },
    },
  },
  {
    id: "matematica-datos-lab",
    subject: "matematica",
    code: "EXP-701",
    title: "Matemática con datos del laboratorio",
    competencia: CNEB.datos,
    versions: {
      primaria: {
        objetivo: "Organizar, a partir de los datos obtenidos en el experimento del péndulo, un gráfico de barras dibujado a mano que represente los conteos registrados, explicando qué barra es mayor y qué significa, para comunicar de forma visual los resultados de un experimento.",
        duracion: "30 min",
        materiales: ["Datos del experimento 'El péndulo' (o cualquier otro ya realizado)", "Papel cuadriculado", "Regla"],
        pasos: [
          "Recuperen los conteos de oscilaciones registrados en el experimento del péndulo.",
          "Ayuden a los estudiantes a organizar esos datos en una tabla simple.",
          "Representen los datos como un gráfico de barras dibujado a mano.",
          "Conversen: ¿qué barra es más alta? ¿qué significa eso sobre el péndulo?",
        ],
        cierre: "Cierre: pedir que expliquen con sus palabras qué les dice el gráfico que no se veía solo con los números.",
      },
      secundaria: {
        objetivo: "Modelar, a partir de los datos de tiempo y altura obtenidos en el experimento de caída libre, una gráfica que relacione ambas variables, determinando si la relación es lineal o cuadrática y usándola para predecir el tiempo de caída desde una altura no medida directamente, para comprender cómo la matemática describe fenómenos físicos.",
        duracion: "45 min",
        materiales: ["Datos del experimento 'Caída libre'", "Calculadora", "Papel cuadriculado o graficador"],
        pasos: [
          "Recuperen los datos de tiempo y altura registrados en el experimento de física.",
          "Grafiquen tiempo (eje x) vs. altura (eje y) y observen la forma de la curva.",
          "Comparen con una función lineal simple: ¿se ajustan bien los puntos a una recta?",
          "Discutan por qué la relación entre altura y tiempo de caída no es lineal sino cuadrática.",
        ],
        cierre: "Reto: pedir que usen la función para predecir el tiempo de caída desde una altura que no midieron directamente.",
      },
    },
  },
];

const RETOS = [
  {
    id: "detectives-gravedad",
    title: "Detectives de la gravedad",
    subject: "fisica",
    grades: ["primaria", "secundaria"],
    desc: "Equipos compiten prediciendo, antes de cada prueba, cuál objeto llegará primero al soltar distintos pares desde el laboratorio. Gana el equipo con más aciertos.",
    duracion: "20 min",
    icon: Zap,
  },
  {
    id: "debate-acido-base",
    title: "El gran debate ácido-base",
    subject: "quimica",
    grades: ["secundaria"],
    desc: "Cada equipo defiende, con evidencia obtenida del laboratorio, si una mezcla dada es ácida, básica o neutra, y debe argumentar frente a la clase.",
    duracion: "30 min",
    icon: FlaskConical,
  },
  {
    id: "arma-celula",
    title: "Arma la célula",
    subject: "biologia",
    grades: ["primaria"],
    desc: "Carrera por equipos: usando el modelo 3D como guía, cada equipo ordena tarjetas con los nombres de las partes de la célula en el orden correcto.",
    duracion: "20 min",
    icon: Dna,
  },
  {
    id: "torre-mas-alta",
    title: "La torre más alta con menos material",
    subject: "ingenieria",
    grades: ["primaria", "secundaria"],
    desc: "Reto de ingeniería en equipos: construir la torre más alta posible usando la misma cantidad limitada de materiales, sin que se caiga en 10 segundos.",
    duracion: "25 min",
    icon: Cog,
  },
];

const TEMPLATE_CONTENT = {
  "ficha-blanco": `FICHA DE LABORATORIO — SciVerse
================================

Docente: ______________________     Grado y sección: ____________
Área STEAM: ___________________      Fecha: ____________________

TÍTULO DEL EXPERIMENTO O RETO
-----------------------
_____________________________________________________________

COMPETENCIA CNEB TRABAJADA
-----------------------
_____________________________________________________________

OBJETIVO DE LA SESIÓN
-----------------------
_____________________________________________________________

PREDICCIÓN INICIAL DE LOS ESTUDIANTES
-----------------------
_____________________________________________________________

PASOS REALIZADOS
-----------------------
1. _________________________________________________________
2. _________________________________________________________
3. _________________________________________________________
4. _________________________________________________________

OBSERVACIONES
-----------------------
_____________________________________________________________
_____________________________________________________________

PREGUNTA DE CIERRE
-----------------------
_____________________________________________________________

Generado desde SciVerse para Docentes.`,

  "rubrica-cneb": `RÚBRICA DE EVALUACIÓN — CNEB
=====================================================
Aplicable a actividades STEAM (Ciencia, Tecnología, Ingeniería, Arte, Matemática)

CRITERIO 1 — Formula predicciones o hipótesis
  Logro destacado: predice con base en una idea clara y la justifica.
  Logro esperado: predice, aunque la justificación es parcial.
  En proceso: predice sin justificar.
  En inicio: no logra formular una predicción.

CRITERIO 2 — Registra observaciones o datos
  Logro destacado: registra observaciones o datos precisos y completos.
  Logro esperado: registra con algunos detalles faltantes.
  En proceso: registra de forma poco clara.
  En inicio: no registra.

CRITERIO 3 — Compara predicción y resultado
  Logro destacado: compara y explica las diferencias con argumentos.
  Logro esperado: compara, con explicación breve.
  En proceso: compara sin explicar.
  En inicio: no compara.

CRITERIO 4 — Comunica sus conclusiones o su producto
  Logro destacado: comunica con lenguaje apropiado al grado y al área.
  Logro esperado: comunica con lenguaje sencillo pero correcto.
  En proceso: comunica de forma confusa.
  En inicio: no logra comunicar sus conclusiones.

Generado desde SciVerse para Docentes.`,

  "guia-docente": `GUÍA RÁPIDA PARA EL DOCENTE — Cómo usar SciVerse en clase
============================================================

1. ELIGE EL GRADO
   Usa el selector de "Primaria" o "Secundaria" en el portal para ver
   actividades adaptadas al nivel de tus estudiantes.

2. ELIGE EL ÁREA STEAM
   Filtra por Ciencia (física, química, biología), Tecnología,
   Ingeniería, Arte o Matemática según lo que estés trabajando.

3. REVISA LA FICHA ANTES DE CLASE
   Cada actividad incluye objetivo, competencia CNEB, materiales,
   duración estimada y pasos guiados.

4. USA EL LABORATORIO INTERACTIVO 3D
   Para las actividades de biología, abre el laboratorio 3D y deja que
   los estudiantes giren y toquen los organelos de la célula.

5. SIGUE LOS PASOS GUIADOS
   Cada ficha está pensada para conducir la sesión paso a paso: desde
   la predicción inicial hasta la pregunta de cierre.

6. USA LOS RETOS GRUPALES PARA REFORZAR
   Al final de una unidad, propone uno de los retos grupales como
   actividad de cierre o repaso.

7. GENERA SESIONES NUEVAS CON EL GENERADOR STEAM
   Si necesitas una actividad sobre un tema que no está en el catálogo,
   usa el generador de sesiones para crear una nueva en segundos.

8. EVALÚA CON LA RÚBRICA
   Usa la rúbrica CNEB incluida en las plantillas para registrar el
   avance de tus estudiantes de forma objetiva.

Generado desde SciVerse para Docentes.`,

  certificado: `CERTIFICADO — Científico/a SciVerse
=====================================

Se otorga el presente certificado a:

______________________________________

Por haber completado con entusiasmo las actividades STEAM del
laboratorio virtual SciVerse, demostrando curiosidad,
observación y pensamiento científico.

Grado: _______________     Fecha: _______________

Docente responsable: __________________________

"La ciencia empieza con una buena pregunta."
— SciVerse

Generado desde SciVerse para Docentes.`,
};

const TEMPLATES = [
  {
    id: "ficha-blanco",
    title: "Ficha de laboratorio en blanco",
    desc: "Plantilla de planificación para preparar cualquier experimento o reto STEAM con tus estudiantes.",
    icon: ClipboardList,
  },
  {
    id: "rubrica-cneb",
    title: "Rúbrica de evaluación CNEB",
    desc: "Rúbrica lista para calificar el trabajo de indagación y creación STEAM de tus estudiantes.",
    icon: Target,
  },
  {
    id: "guia-docente",
    title: "Guía rápida para el docente",
    desc: "Cómo usar SciVerse en clase, paso a paso, en una sola página.",
    icon: BookOpen,
  },
  {
    id: "certificado",
    title: "Certificado 'Científico/a SciVerse'",
    desc: "Reconocimiento imprimible para entregar a tus estudiantes al cerrar una unidad.",
    icon: Award,
  },
];

/* ---------------------------------------------------------------------- */
/* 3D CELL DATA                                                            */
/* ---------------------------------------------------------------------- */

const CELL_TYPES = {
  vegetal: {
    label: "Célula vegetal",
    parts: [
      { kind: "sphere", args: [2.75, 20, 20], pos: [0, 0, 0], color: 0x2d6a4f, opacity: 0.12, wire: true },
      { kind: "sphere", args: [2.6, 24, 24], pos: [0, 0, 0], color: 0x74c69d, opacity: 0.14 },
      { kind: "sphere", args: [0.7, 20, 20], pos: [0.6, 0.3, 0], color: 0x9b5de5, opacity: 1, name: "Núcleo", desc: "Controla las actividades de la célula y contiene el ADN." },
      { kind: "sphere", args: [1.05, 20, 20], pos: [-0.7, -0.5, -0.2], color: 0x4ea8de, opacity: 0.4, name: "Vacuola", desc: "Almacena agua y nutrientes, y da soporte a la célula." },
      { kind: "sphere", args: [0.32, 12, 12], pos: [1.4, -0.6, 0.8], color: 0x2b9348, opacity: 1, name: "Cloroplasto", desc: "Realiza la fotosíntesis: transforma la luz en energía." },
      { kind: "sphere", args: [0.3, 12, 12], pos: [-1.3, 0.9, 0.6], color: 0x2b9348, opacity: 1, name: "Cloroplasto", desc: "Realiza la fotosíntesis: transforma la luz en energía." },
      { kind: "sphere", args: [0.28, 12, 12], pos: [0.3, -1.5, -0.9], color: 0x2b9348, opacity: 1, name: "Cloroplasto", desc: "Realiza la fotosíntesis: transforma la luz en energía." },
      { kind: "sphere", args: [0.22, 10, 10], pos: [-0.4, -1.2, 1.1], color: 0xf3722c, opacity: 1, name: "Mitocondria", desc: "Produce la energía que la célula necesita para funcionar." },
      { kind: "sphere", args: [0.2, 10, 10], pos: [1.2, 1.1, -0.7], color: 0xf3722c, opacity: 1, name: "Mitocondria", desc: "Produce la energía que la célula necesita para funcionar." },
    ],
  },
  animal: {
    label: "Célula animal",
    parts: [
      { kind: "sphere", args: [2.3, 24, 24], pos: [0, 0, 0], color: 0xe0a3c4, opacity: 0.16 },
      { kind: "sphere", args: [0.75, 20, 20], pos: [0.3, 0.2, 0], color: 0x9b5de5, opacity: 1, name: "Núcleo", desc: "Controla las actividades de la célula y contiene el ADN." },
      { kind: "torus", args: [0.55, 0.09, 10, 20], pos: [-1.0, 0.5, 0.3], rot: [1.3, 0.4, 0], color: 0xffd166, opacity: 1, name: "Aparato de Golgi", desc: "Empaqueta y distribuye las proteínas producidas en la célula." },
      { kind: "torus", args: [0.45, 0.08, 10, 20], pos: [-1.0, 0.7, 0.3], rot: [1.3, 0.4, 0], color: 0xffd166, opacity: 1, name: "Aparato de Golgi", desc: "Empaqueta y distribuye las proteínas producidas en la célula." },
      { kind: "sphere", args: [0.22, 10, 10], pos: [1.2, -0.8, 0.6], color: 0xf3722c, opacity: 1, name: "Mitocondria", desc: "Produce la energía que la célula necesita para funcionar." },
      { kind: "sphere", args: [0.2, 10, 10], pos: [0.8, 1.0, -0.9], color: 0xf3722c, opacity: 1, name: "Mitocondria", desc: "Produce la energía que la célula necesita para funcionar." },
      { kind: "sphere", args: [0.15, 8, 8], pos: [-0.9, -1.0, -0.5], color: 0xef476f, opacity: 1, name: "Lisosoma", desc: "Digiere desechos y sustancias dentro de la célula." },
      { kind: "sphere", args: [0.13, 8, 8], pos: [-0.5, -1.3, 0.7], color: 0xef476f, opacity: 1, name: "Lisosoma", desc: "Digiere desechos y sustancias dentro de la célula." },
    ],
  },
  neurona: {
    label: "Neurona",
    parts: [
      { kind: "sphere", args: [0.9, 22, 22], pos: [0, 0, 0], color: 0xf4d35e, opacity: 0.9, name: "Soma", desc: "Cuerpo celular de la neurona; contiene el núcleo y los organelos." },
      { kind: "sphere", args: [0.35, 16, 16], pos: [0, 0.1, 0], color: 0x9b5de5, opacity: 1, name: "Núcleo", desc: "Contiene el ADN que dirige la actividad de la neurona." },
      { kind: "cylinder", args: [0.12, 0.16, 3.2, 12], pos: [2.4, -0.1, 0], rot: [0, 0, Math.PI / 2], color: 0xf9e79f, opacity: 1, name: "Axón", desc: "Transmite el impulso nervioso hacia otras neuronas." },
      { kind: "cylinder", args: [0.07, 0.03, 0.9, 8], pos: [-0.9, 0.7, 0.2], rot: [0, 0, 0.8], color: 0xf9e79f, opacity: 1, name: "Dendritas", desc: "Reciben las señales que llegan de otras neuronas." },
      { kind: "cylinder", args: [0.07, 0.03, 0.9, 8], pos: [-0.9, -0.4, 0.4], rot: [0, 0, -0.7], color: 0xf9e79f, opacity: 1, name: "Dendritas", desc: "Reciben las señales que llegan de otras neuronas." },
      { kind: "cylinder", args: [0.06, 0.03, 0.7, 8], pos: [-0.7, 0.1, -0.7], rot: [0.9, 0, 0.3], color: 0xf9e79f, opacity: 1, name: "Dendritas", desc: "Reciben las señales que llegan de otras neuronas." },
    ],
  },
};

/* ---------------------------------------------------------------------- */
/* HELPERS                                                                  */
/* ---------------------------------------------------------------------- */

function downloadText(filename, content) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ---------------------------------------------------------------------- */
/* 3D CELL VIEWER                                                           */
/* ---------------------------------------------------------------------- */

function Cell3DViewer() {
  const mountRef = useRef(null);
  const stateRef = useRef({});
  const [cellType, setCellType] = useState("vegetal");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth;
    const height = 420;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 6.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const point = new THREE.PointLight(0xffffff, 1.1);
    point.position.set(4, 4, 6);
    scene.add(point);
    const point2 = new THREE.PointLight(0x00f5c4, 0.4);
    point2.position.set(-5, -3, -4);
    scene.add(point2);

    const group = new THREE.Group();
    scene.add(group);
    const raycastTargets = [];

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    let dragging = false;
    let moved = false;
    let lastX = 0;
    let lastY = 0;
    let rafId;

    function onPointerDown(e) {
      dragging = true;
      moved = false;
      lastX = e.clientX;
      lastY = e.clientY;
    }
    function onPointerMove(e) {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
      group.rotation.y += dx * 0.006;
      group.rotation.x = Math.max(-1, Math.min(1, group.rotation.x + dy * 0.006));
      lastX = e.clientX;
      lastY = e.clientY;
    }
    function onPointerUp(e) {
      dragging = false;
      if (moved) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(raycastTargets, false);
      if (hits.length > 0) {
        setSelected(hits[0].object.userData.info);
      }
    }
    function onWheel(e) {
      e.preventDefault();
      camera.position.z = Math.max(3.5, Math.min(9, camera.position.z + e.deltaY * 0.002));
    }

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

    function animate() {
      if (!dragging) group.rotation.y += 0.0025;
      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    }
    animate();

    function onResize() {
      const w = mount.clientWidth;
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
      renderer.setSize(w, height);
    }
    window.addEventListener("resize", onResize);

    stateRef.current = { scene, camera, renderer, group, raycastTargets, onResize, onPointerDown, onPointerMove, onPointerUp, onWheel, rafId: () => rafId };

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("wheel", onWheel);
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, []);

  // rebuild geometry when cell type changes
  useEffect(() => {
    const st = stateRef.current;
    if (!st.group) return;
    setSelected(null);

    while (st.group.children.length) {
      const child = st.group.children.pop();
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    }
    st.raycastTargets.length = 0;

    const def = CELL_TYPES[cellType];
    def.parts.forEach((p) => {
      let geo;
      if (p.kind === "sphere") geo = new THREE.SphereGeometry(...p.args);
      else if (p.kind === "cylinder") geo = new THREE.CylinderGeometry(...p.args);
      else if (p.kind === "torus") geo = new THREE.TorusGeometry(...p.args);
      const mat = new THREE.MeshPhongMaterial({
        color: p.color,
        transparent: p.opacity < 1,
        opacity: p.opacity,
        wireframe: !!p.wire,
        shininess: 40,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(...p.pos);
      if (p.rot) mesh.rotation.set(...p.rot);
      if (p.name) {
        mesh.userData.info = { name: p.name, desc: p.desc };
        st.raycastTargets.push(mesh);
      }
      st.group.add(mesh);
    });
  }, [cellType]);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
        <div className="flex items-center gap-2">
          {Object.entries(CELL_TYPES).map(([key, def]) => (
            <button
              key={key}
              onClick={() => setCellType(key)}
              className="px-3 py-1.5 rounded-full text-sm font-medium"
              style={{
                background: cellType === key ? "#6FE6A8" : "transparent",
                color: cellType === key ? "#0B2B29" : C.muted,
                border: `1px solid ${C.line}`,
              }}
            >
              {def.label}
            </button>
          ))}
        </div>
        <span className="text-xs inline-flex items-center gap-1.5" style={{ color: C.muted }}>
          <RotateCw size={13} /> Arrastra para girar · rueda para acercar · toca un organelo
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-0 mt-4">
        <div ref={mountRef} style={{ width: "100%", height: 420, cursor: "grab" }} />
        <div className="p-5 border-t md:border-t-0 md:border-l" style={{ borderColor: C.line }}>
          {selected ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "#6FE6A8" }}>
                {selected.name}
              </p>
              <p className="text-sm leading-relaxed" style={{ color: C.text }}>
                {selected.desc}
              </p>
            </>
          ) : (
            <p className="text-sm leading-relaxed" style={{ color: C.muted }}>
              Toca cualquier organelo del modelo 3D para ver su nombre y su función aquí.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* STEAM SESSION GENERATOR                                                  */
/* ---------------------------------------------------------------------- */

function SteamGenerator({ initialGrade = "primaria" }) {
  const [tema, setTema] = useState("");
  const [grado, setGrado] = useState(initialGrade);
  const [area, setArea] = useState("Combinado STEAM");
  const [duracion, setDuracion] = useState("45");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const areaOptions = ["Combinado STEAM", "Ciencia", "Tecnología", "Ingeniería", "Arte", "Matemática"];

  async function handleGenerate() {
    if (!tema.trim()) {
      setError("Escribe primero el tema de la sesión.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const systemInstruction = `Eres un especialista en diseño curricular STEAM alineado al Currículo Nacional de Educación Básica (CNEB) de Perú. Genera una sesión de aprendizaje STEAM breve y práctica, pensada para usarse junto al laboratorio virtual SciVerse. Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, sin backticks ni comentarios, con esta forma exacta:
{
  "titulo": "string",
  "areasSTEAM": ["string", "..."],
  "competenciasCNEB": ["string", "..."],
  "materiales": ["string", "..."],
  "inicio": "string",
  "desarrollo": "string",
  "cierre": "string",
  "productoSTEAM": "string"
}`;

      const userMsg = `Tema: ${tema}\nGrado: ${grado}\nDuración: ${duracion} minutos\nÁrea STEAM de énfasis: ${area}`;

      const response = await fetch("/api/generate-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [
            { role: "user", content: `${systemInstruction}\n\n${userMsg}` },
          ],
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Error del servidor");
      const textBlock = (data.content || []).find((b) => b.type === "text");
      if (!textBlock) throw new Error("Sin respuesta de texto");
      const clean = textBlock.text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setResult(parsed);
    } catch (e) {
      setError("No se pudo generar la sesión. Intenta de nuevo en unos segundos.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl p-6" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
      <div className="flex items-center gap-2 mb-1">
        <Wand2 size={18} color={C.teal} />
        <h3 className="text-lg font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Generador de sesiones STEAM
        </h3>
      </div>
      <p className="text-sm mb-5" style={{ color: C.muted }}>
        Escribe un tema y genera, en segundos, una sesión STEAM nueva alineada al CNEB.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <input
          value={tema}
          onChange={(e) => setTema(e.target.value)}
          placeholder="Tema, por ejemplo: el ciclo del agua"
          className="md:col-span-2 rounded-lg px-3 py-2.5 text-sm outline-none"
          style={{ background: "rgba(15,61,58,0.05)", border: `1px solid ${C.line}`, color: C.text }}
        />
        <select
          value={grado}
          onChange={(e) => setGrado(e.target.value)}
          className="rounded-lg px-3 py-2.5 text-sm outline-none"
          style={{ background: "rgba(15,61,58,0.05)", border: `1px solid ${C.line}`, color: C.text }}
        >
          <option value="primaria">Primaria</option>
          <option value="secundaria">Secundaria</option>
        </select>
        <select
          value={area}
          onChange={(e) => setArea(e.target.value)}
          className="rounded-lg px-3 py-2.5 text-sm outline-none"
          style={{ background: "rgba(15,61,58,0.05)", border: `1px solid ${C.line}`, color: C.text }}
        >
          {areaOptions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select
          value={duracion}
          onChange={(e) => setDuracion(e.target.value)}
          className="rounded-lg px-3 py-2.5 text-sm outline-none md:col-span-2"
          style={{ background: "rgba(15,61,58,0.05)", border: `1px solid ${C.line}`, color: C.text }}
        >
          <option value="30">30 minutos</option>
          <option value="45">45 minutos</option>
          <option value="60">60 minutos</option>
          <option value="90">90 minutos (doble hora)</option>
        </select>
      </div>

      <button
        onClick={handleGenerate}
        disabled={loading}
        className="inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold w-full md:w-auto"
        style={{ background: C.teal, color: "#0B2B29", opacity: loading ? 0.7 : 1 }}
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
        {loading ? "Generando sesión..." : "Generar sesión STEAM"}
      </button>

      {error && (
        <p className="text-sm mt-4" style={{ color: "#FF8A5B" }}>
          {error}
        </p>
      )}

      {result && (
        <div className="mt-6 rounded-xl p-5" style={{ background: "rgba(15,61,58,0.03)", border: `1px solid ${C.line}` }}>
          <h4 className="text-lg font-semibold mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {result.titulo}
          </h4>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {(result.areasSTEAM || []).map((a, i) => (
              <span key={i} className="text-[11px] font-semibold px-2 py-1 rounded-full" style={{ background: "rgba(62,198,192,0.12)", color: C.teal, border: `1px solid rgba(62,198,192,0.3)` }}>
                {a}
              </span>
            ))}
          </div>

          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: C.muted }}>Competencias CNEB</p>
          <ul className="text-sm mb-4 space-y-1" style={{ color: C.text }}>
            {(result.competenciasCNEB || []).map((c, i) => (
              <li key={i} className="flex gap-2"><span style={{ color: C.teal }}>·</span> {c}</li>
            ))}
          </ul>

          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: C.muted }}>Materiales</p>
          <ul className="text-sm mb-4 space-y-1" style={{ color: C.text }}>
            {(result.materiales || []).map((m, i) => (
              <li key={i} className="flex gap-2"><span style={{ color: C.teal }}>·</span> {m}</li>
            ))}
          </ul>

          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: C.muted }}>Inicio</p>
              <p className="text-sm leading-relaxed" style={{ color: C.text }}>{result.inicio}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: C.muted }}>Desarrollo</p>
              <p className="text-sm leading-relaxed" style={{ color: C.text }}>{result.desarrollo}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: C.muted }}>Cierre</p>
              <p className="text-sm leading-relaxed" style={{ color: C.text }}>{result.cierre}</p>
            </div>
          </div>

          <div className="mt-4 rounded-lg p-4" style={{ background: "rgba(62,198,192,0.06)", borderLeft: `3px solid ${C.teal}` }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: C.teal }}>Producto STEAM</p>
            <p className="text-sm leading-relaxed" style={{ color: C.text }}>{result.productoSTEAM}</p>
          </div>

          <button
            onClick={() =>
              downloadText(
                `sesion-steam-${tema.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 30) || "generada"}.txt`,
                `${result.titulo}\n\nGrado: ${grado}\nDuración: ${duracion} min\nÁreas STEAM: ${(result.areasSTEAM || []).join(", ")}\n\nCompetencias CNEB:\n${(result.competenciasCNEB || []).map((c) => "- " + c).join("\n")}\n\nMateriales:\n${(result.materiales || []).map((m) => "- " + m).join("\n")}\n\nInicio:\n${result.inicio}\n\nDesarrollo:\n${result.desarrollo}\n\nCierre:\n${result.cierre}\n\nProducto STEAM:\n${result.productoSTEAM}\n\nGenerado desde SciVerse para Docentes.`
              )
            }
            className="mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold"
            style={{ background: "rgba(15,61,58,0.08)", color: C.text, border: `1px solid ${C.line}` }}
          >
            <Download size={14} /> Descargar esta sesión
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* REGISTRO DE DOCENTES (INTRANET)                                         */
/* ---------------------------------------------------------------------- */

function ImprovedLanding({ onRegister, onLogin }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [demoGrade, setDemoGrade] = useState("primaria");
  const [legalView, setLegalView] = useState(null);
  const demoActivity = ACTIVITIES[0];
  const demoVersion = demoActivity.versions[demoGrade];
  const features = [
    { icon: Wand2, title: "Generador con IA", desc: "Crea proyectos y sesiones STEAM adaptados a tu propósito y nivel.", color: C.coral },
    { icon: Microscope, title: "Laboratorio interactivo 3D", desc: "Explora modelos directamente en el navegador, sin instalar programas.", color: C.teal },
    { icon: ClipboardList, title: "Guías para el aula", desc: "Actividades paso a paso, diferenciadas para primaria y secundaria.", color: C.yellow },
    { icon: Award, title: "Plantillas CNEB", desc: "Rúbricas, fichas y recursos editables para acompañar el aprendizaje.", color: "#8B5CF6" },
    { icon: Users, title: "Retos colaborativos", desc: "Propuestas para aprender haciendo, dialogando y creando en equipo.", color: "#FB7185" },
    { icon: BookOpen, title: "Cinco áreas STEAM", desc: "Ciencia, Tecnología, Ingeniería, Arte y Matemática conectadas.", color: "#4FA8FF" },
  ];
  const plans = [
    { name: "Gratuito", price: "0", period: "para conocer SciVerse", saving: "Sin tarjeta", featured: false, benefits: ["Actividades de muestra", "1 generación con IA", "Laboratorio 3D", "Recursos de demostración"] },
    { name: "Mensual", price: "10", period: "por 1 mes", saving: "Ideal para empezar", featured: false, benefits: ["30 generaciones con IA", "Actividades STEAM", "Laboratorio y simuladores", "Fichas y plantillas", "Soporte por WhatsApp"] },
    { name: "Semestral", price: "30", period: "por 6 meses", saving: "Equivale a S/5 al mes", featured: true, benefits: ["60 generaciones mensuales", "Actividades STEAM", "Laboratorio y simuladores", "Descargas en Word", "Nuevos recursos", "Soporte prioritario"] },
    { name: "Anual", price: "50", period: "por 12 meses", saving: "Equivale a S/4.17 al mes", featured: false, benefits: ["100 generaciones mensuales", "Acceso completo anual", "Primaria o secundaria", "Descargas en Word", "Nuevos recursos", "Soporte prioritario"] },
  ];
  const faqs = [
    ["¿Qué puedo crear con SciVerse?", "Puedes generar sesiones y actividades STEAM, consultar experiencias guiadas, utilizar el laboratorio 3D y descargar fichas y plantillas."],
    ["¿Los recursos están alineados al CNEB?", "Las propuestas consideran el Currículo Nacional del Perú. Todo contenido generado con IA debe ser revisado y adaptado por el docente."],
    ["¿Funciona para primaria y secundaria?", "Sí. Durante el registro eliges tu nivel y SciVerse abre automáticamente los materiales correspondientes."],
    ["¿Puedo descargar los materiales en Word?", "Sí. Los planes con acceso completo permiten descargar sesiones y fichas en Word para editarlas."],
    ["¿Cómo se activa mi cuenta?", "Después de registrarte recibirás un correo de confirmación. Al abrir el enlace podrás iniciar sesión."],
    ["¿Cómo pago con Plin o Yape?", "Selecciona un plan y te enviaremos a WhatsApp para confirmar el pago a Teaching TIC."],
    ["¿El pago se renueva automáticamente?", "No. Los pagos por Plin o Yape no se renuevan automáticamente; tú decides cuándo renovar."],
    ["¿La inteligencia artificial puede equivocarse?", "Sí. SciVerse es una herramienta de apoyo y el docente debe revisar el contenido antes de aplicarlo."],
  ];
  const choosePlan = (plan) => {
    if (plan.name === "Gratuito") return onRegister();
    const message = `Hola Teaching TIC, deseo adquirir el Plan ${plan.name} de SciVerse por S/${plan.price}. ¿Me comparten los datos para pagar por Plin o Yape?`;
    window.open(`https://wa.me/51921090875?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="landing-shell" style={{ background: C.bg, color: C.text, minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
      <nav className="landing-nav">
        <a href="#inicio" className="brand-lockup" aria-label="Inicio de SciVerse">
          <span className="brand-mark"><Microscope size={22} /></span>
          <span><strong>SciVerse</strong><small>una iniciativa de Teaching TIC</small></span>
        </a>
        <div className={`landing-links ${menuOpen ? "is-open" : ""}`}>
          <a href="#demo" onClick={() => setMenuOpen(false)}>Pruébalo</a>
          <a href="#beneficios" onClick={() => setMenuOpen(false)}>Beneficios</a>
          <a href="#planes" onClick={() => setMenuOpen(false)}>Planes</a>
          <a href="#preguntas" onClick={() => setMenuOpen(false)}>Preguntas</a>
          <a href="#confianza" onClick={() => setMenuOpen(false)}>Para docentes</a>
        </div>
        <div className="nav-actions">
          <button className="menu-toggle" aria-label="Abrir menú" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={20} /> : <Layers size={20} />}</button>
          <button onClick={onLogin} className="secondary-btn compact login-nav-btn">Iniciar sesión</button>
          <button onClick={onRegister} className="primary-btn compact">Acceder gratis <ArrowRight size={15} /></button>
        </div>
      </nav>

      <header id="inicio" className="hero-grid">
        <div className="hero-copy">
          <span className="eyebrow"><Sparkles size={13} /> Tecnología educativa creada para docentes</span>
          <h1>Convierte tus ideas en <span>experiencias STEAM</span> listas para el aula.</h1>
          <p>Explora recursos alineados al CNEB, actividades adaptadas para primaria y secundaria, un laboratorio 3D y un generador de sesiones con inteligencia artificial.</p>
          <div className="hero-actions">
            <button onClick={onRegister} className="primary-btn">Empezar gratis <ArrowRight size={17} /></button>
            <a href="#demo" className="secondary-btn"><Microscope size={17} /> Ver demostración</a>
          </div>
          <div className="trust-line"><span>✓ Sin costo para docentes</span><span>✓ Acceso en menos de un minuto</span><span>✓ En español</span></div>
        </div>
        <div className="hero-visual" aria-label="Vista previa de las herramientas de SciVerse">
          <div className="visual-orbit orbit-one" /><div className="visual-orbit orbit-two" />
          <div className="hero-dashboard">
            <div className="dashboard-top"><span className="dot coral" /><span className="dot yellow" /><span className="dot teal" /><small>Laboratorio SciVerse</small></div>
            <div className="dashboard-body">
              <div className="science-core"><Atom size={58} /><span>Explora · Crea · Comparte</span></div>
              <div className="tool-row"><span><Wand2 size={16} /> IA educativa</span><span><Dna size={16} /> Modelo 3D</span></div>
            </div>
          </div>
          <div className="floating-card card-a"><ClipboardList size={18} /><span><b>Fichas CNEB</b><small>listas para usar</small></span></div>
          <div className="floating-card card-b"><Award size={18} /><span><b>Primaria y secundaria</b><small>recursos adaptados</small></span></div>
        </div>
      </header>

      <section className="impact-strip" aria-label="Características principales">
        <div><strong>{ACTIVITIES.length}</strong><span>actividades guiadas</span></div><div><strong>5</strong><span>áreas STEAM</span></div><div><strong>2</strong><span>niveles educativos</span></div><div><strong>CNEB</strong><span>enfoque curricular</span></div>
      </section>

      <section id="demo" className="demo-section">
        <div className="section-heading"><span className="eyebrow"><Zap size={13} /> Prueba antes de registrarte</span><h2>Así se ve una actividad en SciVerse</h2><p>Elige un nivel y revisa una experiencia de muestra. El catálogo completo se habilita con tu registro gratuito.</p></div>
        <div className="demo-card">
          <div className="demo-toolbar">
            <div><span className="subject-pill"><Zap size={14} /> Física</span><small>{demoActivity.code}</small></div>
            <div className="grade-switch">{["primaria", "secundaria"].map((grade) => <button key={grade} onClick={() => setDemoGrade(grade)} className={demoGrade === grade ? "active" : ""}>{grade}</button>)}</div>
          </div>
          <div className="demo-content">
            <div><h3>{demoActivity.title}</h3><p>{demoVersion.objetivo}</p><span className="duration"><Clock size={15} /> {demoVersion.duracion}</span></div>
            <div className="demo-steps"><small>Ruta de aprendizaje</small>{demoVersion.pasos.slice(0, 3).map((step, index) => <p key={step}><b>{index + 1}</b>{step}</p>)}</div>
          </div>
          <div className="demo-footer"><span>Esta es una muestra del catálogo.</span><button onClick={onRegister} className="primary-btn compact">Explorar todos los recursos <ArrowRight size={15} /></button></div>
        </div>
      </section>

      <section id="beneficios" className="benefits-section">
        <div className="section-heading"><span className="eyebrow"><Layers size={13} /> Herramientas que trabajan contigo</span><h2>Innova sin empezar desde cero</h2><p>Recursos prácticos para planificar, explorar y acompañar experiencias STEAM significativas.</p></div>
        <div className="feature-grid">{features.map((feature) => { const Icon = feature.icon; return <article key={feature.title} className="feature-card" style={{ "--accent": feature.color }}><span className="feature-icon"><Icon size={20} /></span><h3>{feature.title}</h3><p>{feature.desc}</p><ChevronRight size={17} /></article>; })}</div>
      </section>

      <section id="planes" className="pricing-section">
        <div className="section-heading"><span className="eyebrow"><Award size={13} /> Precios claros y en soles</span><h2>Un plan para cada etapa docente</h2><p>Empieza gratis y elige más capacidad cuando necesites generar y descargar más materiales.</p></div>
        <div className="pricing-grid">
          {plans.map((plan) => <article key={plan.name} className={`price-card ${plan.featured ? "featured" : ""}`}>
            {plan.featured && <span className="popular-badge"><Sparkles size={12} /> Más conveniente</span>}
            <div className="plan-head"><span>Plan {plan.name}</span><strong><small>S/</small>{plan.price}</strong><p>{plan.period}</p></div>
            <div className="saving-pill">{plan.saving}</div>
            <ul>{plan.benefits.map((benefit) => <li key={benefit}><span>✓</span>{benefit}</li>)}</ul>
            <button onClick={() => choosePlan(plan)} className={plan.featured ? "primary-btn plan-button" : "secondary-btn plan-button"}>{plan.name === "Gratuito" ? "Crear cuenta gratis" : `Elegir plan ${plan.name.toLowerCase()}`} <ArrowRight size={15} /></button>
          </article>)}
        </div>
        <p className="pricing-note"><span>🔒</span> Pago por Plin o Yape a nombre de Teaching TIC. La activación se confirma por WhatsApp.</p>
      </section>

      <section id="confianza" className="confidence-section">
        <div className="confidence-copy"><span className="eyebrow"><GraduationCap size={13} /> Diseñado desde la realidad educativa</span><h2>Más tiempo para acompañar. Menos tiempo preparando desde cero.</h2><p>SciVerse combina tecnología, currículo y propuestas prácticas para que cada docente pueda adaptar y crear según su contexto.</p><ul><li><Target size={17} /> Recursos contextualizados al Currículo Nacional del Perú.</li><li><Users size={17} /> Actividades para trabajo individual y colaborativo.</li><li><Cpu size={17} /> Tecnología accesible desde el navegador, sin instalaciones.</li></ul></div>
        <div className="quote-card"><span>“</span><p>La tecnología cobra sentido cuando ayuda al docente a crear experiencias más inclusivas, significativas y cercanas a sus estudiantes.</p><small>Teaching TIC · Innovación educativa con propósito</small></div>
      </section>

      <section id="preguntas" className="faq-section">
        <div className="section-heading"><span className="eyebrow"><HelpCircle size={13} /> Resolvemos tus dudas</span><h2>Preguntas frecuentes</h2><p>Todo lo que necesitas saber antes de crear tu cuenta o elegir un plan.</p></div>
        <div className="faq-list">{faqs.map(([question, answer]) => <details className="faq-item" key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div>
      </section>

      <section className="final-cta"><div><span className="eyebrow light"><Sparkles size={13} /> Tu próxima experiencia empieza aquí</span><h2>Explora, adapta y crea con SciVerse.</h2><p>Regístrate una vez y accede gratuitamente a todas las herramientas disponibles.</p></div><button onClick={onRegister} className="light-btn">Crear mi acceso gratuito <ArrowRight size={17} /></button></section>

      <footer className="landing-footer expanded-footer">
        <div className="footer-column"><div className="brand-lockup"><span className="brand-mark"><Microscope size={20} /></span><span><strong>SciVerse</strong><small>una iniciativa de Teaching TIC</small></span></div><p>Tecnología educativa para experiencias STEAM accesibles, creativas y contextualizadas.</p><div className="social-row"><a href="https://www.facebook.com/teachingticconsultorias/" target="_blank" rel="noreferrer" aria-label="Facebook"><Facebook size={17} /></a><a href="https://wa.me/51921090875" target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle size={17} /></a></div></div>
        <div className="footer-column"><h4>Explora</h4><a href="#beneficios">Herramientas</a><a href="#planes">Planes</a><a href="#preguntas">Preguntas frecuentes</a><button onClick={onRegister}>Crear cuenta</button></div>
        <div className="footer-column"><h4>Legal y confianza</h4><button onClick={() => setLegalView("terms")}>Términos y condiciones</button><button onClick={() => setLegalView("privacy")}>Política de privacidad</button><button onClick={() => setLegalView("ai")}>Política de uso de IA</button><button onClick={() => setLegalView("complaints")}>Libro de Reclamaciones</button></div>
        <div className="footer-column"><h4>Contacto</h4><p>Teaching TIC Consultorías S.A.C.<br />RUC 20607945331<br />Jr. Cristóbal de Peralta Norte 9 50, Dpto. 210</p><a href="mailto:teachingticconsultorias@gmail.com">teachingticconsultorias@gmail.com</a><a href="https://wa.me/51921090875" target="_blank" rel="noreferrer">+51 921 090 875</a><small>© 2026 Teaching TIC. Todos los derechos reservados.</small></div>
      </footer>
      {legalView && <LegalModal view={legalView} onClose={() => setLegalView(null)} />}
    </div>
  );
}

function LegalModal({ view, onClose }) {
  const content = {
    terms: { title: "Términos y condiciones", icon: FileText, body: ["SciVerse es una plataforma de apoyo pedagógico ofrecida por Teaching TIC Consultorías S.A.C., identificada con RUC 20607945331 y domicilio fiscal en Jr. Cristóbal de Peralta Norte 9 50, Dpto. 210.", "El usuario debe revisar y adaptar los recursos antes de utilizarlos. El acceso es personal y no debe compartirse con terceros.", "Los planes pagados se activan luego de verificar el pago. Los pagos por Plin o Yape no se renuevan automáticamente.", "Para consultas puedes escribir a teachingticconsultorias@gmail.com o comunicarte al +51 921 090 875."] },
    privacy: { title: "Política de privacidad", icon: ShieldCheck, body: ["Teaching TIC Consultorías S.A.C., RUC 20607945331, es responsable del tratamiento de los datos recopilados a través de SciVerse.", "Recopilamos los datos necesarios para crear la cuenta, brindar soporte y gestionar el acceso: nombre, correo, institución educativa, celular y nivel educativo.", "No vendemos información personal. Los datos de autenticación son gestionados por Supabase y se utilizan para operar SciVerse y atender al usuario.", "Puedes solicitar el acceso, actualización o eliminación de tus datos escribiendo a teachingticconsultorias@gmail.com."] },
    ai: { title: "Uso responsable de inteligencia artificial", icon: Sparkles, body: ["SciVerse utiliza inteligencia artificial para apoyar la creación de recursos educativos.", "La IA puede producir errores. El docente debe verificar competencias, desempeños, normativa, datos y pertinencia pedagógica antes de utilizar el contenido.", "No ingreses información sensible de estudiantes, diagnósticos médicos, contraseñas ni datos personales innecesarios."] },
    complaints: { title: "Libro de Reclamaciones", icon: ClipboardList, body: ["Proveedor: Teaching TIC Consultorías S.A.C. · RUC 20607945331.", "Domicilio fiscal: Jr. Cristóbal de Peralta Norte 9 50, Dpto. 210.", "Para presentar un reclamo o queja, envía tus nombres y apellidos, documento de identidad, correo, teléfono, descripción del servicio, detalle del reclamo o queja y el pedido concreto a teachingticconsultorias@gmail.com.", "Teaching TIC enviará una constancia de recepción y atenderá la solicitud dentro del plazo legal aplicable. La presentación de un reclamo no impide acudir a otras vías de solución de controversias."] },
  }[view];
  const Icon = content.icon;
  return <div className="legal-backdrop" role="presentation" onMouseDown={onClose}><section className="legal-modal" role="dialog" aria-modal="true" aria-labelledby="legal-title" onMouseDown={(event) => event.stopPropagation()}><button className="legal-close" onClick={onClose} aria-label="Cerrar"><X size={20} /></button><Icon size={26} color={C.teal} /><h2 id="legal-title">{content.title}</h2>{content.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{view === "complaints" && <div className="legal-actions"><a className="primary-btn" href="mailto:teachingticconsultorias@gmail.com?subject=Registro%20en%20el%20Libro%20de%20Reclamaciones&body=Tipo%3A%20Reclamo%20o%20queja%0ANombres%20y%20apellidos%3A%0ADNI%20o%20CE%3A%0ACorreo%3A%0ATel%C3%A9fono%3A%0AServicio%20contratado%3A%0ADetalle%3A%0APedido%20concreto%3A">Registrar por correo <Mail size={15} /></a><a className="secondary-btn" href="https://wa.me/51921090875?text=Hola%20Teaching%20TIC%2C%20necesito%20orientaci%C3%B3n%20para%20presentar%20un%20reclamo." target="_blank" rel="noreferrer">Orientación por WhatsApp <MessageCircle size={15} /></a></div>}<small>Última actualización: agosto de 2026.</small></section></div>;
}

function RegistrationGate({ children }) {
  const [checking, setChecking] = useState(true);
  const [profile, setProfile] = useState(null);
  const [view, setView] = useState("landing"); // 'landing' | 'form'
  const [form, setForm] = useState({ nombres: "", apellidos: "", ie: "", celular: "", correo: "" });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("sciverse-docente-perfil");
      if (raw) setProfile(JSON.parse(raw));
    } catch (e) {
      // no hay perfil guardado todavía
    } finally {
      setChecking(false);
    }
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.nombres.trim() || !form.apellidos.trim() || !form.correo.trim() || !form.ie.trim()) {
      setError("Completa nombres, apellidos, institución educativa y correo.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (supabase) {
        const { error: dbError } = await supabase.from("docentes").insert([form]);
        if (dbError) throw dbError;
      }
      localStorage.setItem("sciverse-docente-perfil", JSON.stringify(form));
      setProfile(form);
    } catch (e) {
      setError("No se pudo guardar tu registro. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    try {
      localStorage.removeItem("sciverse-docente-perfil");
    } catch (e) {
      // ignorar si ya no existe
    }
    setProfile(null);
    setView("landing");
    setForm({ nombres: "", apellidos: "", ie: "", celular: "", correo: "" });
  }

  if (checking) {
    return (
      <div style={{ background: C.bg, minHeight: "100vh" }} className="flex items-center justify-center">
        <Loader2 size={22} className="animate-spin" color={C.teal} />
      </div>
    );
  }

  if (profile) return children(profile, handleLogout);

  const goToForm = () => {
    setView("form");
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  /* ---------- LANDING PÚBLICA ---------- */
  if (view === "landing") {
    return <ImprovedLanding onRegister={goToForm} />;
    const FEATURES = [
      { icon: Wand2, title: "Generador de experiencias de aprendizaje con IA", desc: "Crea experiencias STEAM nuevas al instante sobre cualquier tema que necesites.", color: C.coral },
      { icon: ClipboardList, title: "Guías de laboratorio", desc: "Fichas paso a paso, listas para llevar directo al aula.", color: C.teal },
      { icon: Microscope, title: "Laboratorio interactivo 3D", desc: "Explora células y otros modelos en 3D, directamente en el navegador, sin instalar nada.", color: C.yellow },
      { icon: BookOpen, title: "Actividades en las 5 áreas STEAM", desc: "Ciencia, Tecnología, Ingeniería, Arte y Matemática, diferenciadas por primaria y secundaria.", color: C.teal },
      { icon: Users, title: "Retos grupales", desc: "Actividades pensadas para trabajar en equipos y cerrar unidades con dinamismo.", color: C.coral },
      { icon: Award, title: "Plantillas y rúbricas CNEB", desc: "Fichas, rúbricas y certificados descargables, listos para imprimir.", color: C.yellow },
    ];
    return (
      <div style={{ background: C.bg, color: C.text, minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap');`}</style>

        <nav className="flex items-center justify-between px-6 md:px-10 py-5" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
          <div className="flex items-center gap-2">
            <Microscope size={20} color={C.teal} />
            <span className="text-lg font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              SciVerse <span style={{ color: C.muted, fontWeight: 400 }}>para Docentes</span>
            </span>
          </div>
          <button onClick={goToForm} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: C.teal, color: "#0B2B29" }}>
            Regístrate
          </button>
        </nav>

        <header className="px-6 md:px-10 pt-16 pb-14 max-w-4xl mx-auto text-center">
          <span
            className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-widest uppercase px-3 py-1.5 rounded-full mb-6"
            style={{ color: C.teal, background: "rgba(15,61,58,0.05)", border: `1px solid ${C.line}`, fontFamily: "'JetBrains Mono', monospace" }}
          >
            <Sparkles size={13} /> Laboratorio virtual STEAM · Alineado al CNEB
          </span>
          <h1 className="text-4xl md:text-6xl font-semibold leading-tight mb-6" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Lleva el laboratorio a tu aula
          </h1>
          <p className="text-lg max-w-2xl mx-auto mb-9" style={{ color: C.muted }}>
            Accede al laboratorio virtual y realiza más de <strong style={{ color: C.text }}>1,000 experiencias de aprendizaje STEAM</strong> — Ciencia, Tecnología, Ingeniería, Arte y Matemática — con fichas listas para primaria y secundaria, un laboratorio 3D interactivo y un generador de sesiones con IA.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button onClick={goToForm} className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold" style={{ background: C.teal, color: "#0B2B29" }}>
              Accede al laboratorio virtual <ArrowRight size={16} />
            </button>
            <span className="text-xs" style={{ color: C.muted }}>Gratis para docentes · toma menos de un minuto</span>
          </div>
        </header>

        <section className="px-6 md:px-10 pb-16 max-w-3xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center rounded-2xl p-6" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
            <div>
              <p className="text-2xl font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif", color: C.teal }}>1000+</p>
              <p className="text-xs mt-1" style={{ color: C.muted }}>Experiencias STEAM</p>
            </div>
            <div>
              <p className="text-2xl font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif", color: C.teal }}>5</p>
              <p className="text-xs mt-1" style={{ color: C.muted }}>Áreas STEAM</p>
            </div>
            <div>
              <p className="text-2xl font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif", color: C.teal }}>2</p>
              <p className="text-xs mt-1" style={{ color: C.muted }}>Niveles: primaria y secundaria</p>
            </div>
            <div>
              <p className="text-2xl font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif", color: C.teal }}>100%</p>
              <p className="text-xs mt-1" style={{ color: C.muted }}>Alineado al CNEB</p>
            </div>
          </div>
        </section>

        <section className="px-6 md:px-10 pb-16 max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-semibold text-center mb-10" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Todo lo que necesitas para llevar STEAM al aula
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <div key={i} className="rounded-xl p-5 transition-transform hover:-translate-y-1" style={{ background: C.surface, border: `1px solid ${C.line}`, borderTop: `3px solid ${f.color}` }}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ background: `${f.color}1F` }}>
                    <Icon size={17} color={f.color} />
                  </div>
                  <h4 className="text-base font-semibold mb-1.5" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{f.title}</h4>
                  <p className="text-sm" style={{ color: C.muted }}>{f.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="px-6 md:px-10 pb-20 max-w-3xl mx-auto text-center">
          <div className="rounded-2xl p-10" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
            <GraduationCap size={26} color={C.teal} className="mx-auto mb-4" />
            <h3 className="text-xl md:text-2xl font-semibold mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Realiza más de 1,000 experiencias de aprendizaje STEAM
            </h3>
            <p className="text-sm mb-6" style={{ color: C.muted }}>
              Regístrate una vez y accede a todo el laboratorio virtual, sin costo.
            </p>
            <button onClick={goToForm} className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold" style={{ background: C.teal, color: "#0B2B29" }}>
              Regístrate ahora <ArrowRight size={16} />
            </button>
          </div>
        </section>

        <footer className="px-6 md:px-10 py-8 text-center text-xs" style={{ color: C.muted, borderTop: `1px solid ${C.lineSoft}` }}>
          SciVerse para Docentes — un espacio de Frida García Rurush, IA educativa.
        </footer>
      </div>
    );
  }

  /* ---------- FORMULARIO DE REGISTRO ---------- */
  return (
    <div style={{ background: C.bg, color: C.text, minHeight: "100vh", fontFamily: "'Inter', sans-serif" }} className="flex items-center justify-center px-6 py-12">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=Inter:wght@400;500;600&display=swap');`}</style>
      <div className="w-full max-w-md rounded-2xl p-7" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
        <button onClick={() => setView("landing")} className="text-xs mb-4 inline-flex items-center gap-1" style={{ color: C.muted }}>
          ← Volver
        </button>
        <div className="flex items-center gap-2 mb-1">
          <Microscope size={20} color={C.teal} />
          <span className="text-lg font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>SciVerse <span style={{ color: C.muted, fontWeight: 400 }}>Docentes</span></span>
        </div>
        <p className="text-sm mb-5" style={{ color: C.muted }}>
          Regístrate una vez para acceder a las fichas, el laboratorio 3D, los retos y el generador de sesiones STEAM.
        </p>

        <div className="flex items-center gap-2 my-4">
          <div className="h-px flex-1" style={{ background: C.line }} />
          <span className="text-xs" style={{ color: C.muted }}>completa tus datos</span>
          <div className="h-px flex-1" style={{ background: C.line }} />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              value={form.nombres}
              onChange={(e) => setForm({ ...form, nombres: e.target.value })}
              placeholder="Nombres"
              className="rounded-lg px-3 py-2.5 text-sm outline-none"
              style={{ background: "rgba(15,61,58,0.05)", border: `1px solid ${C.line}`, color: C.text }}
            />
            <input
              value={form.apellidos}
              onChange={(e) => setForm({ ...form, apellidos: e.target.value })}
              placeholder="Apellidos"
              className="rounded-lg px-3 py-2.5 text-sm outline-none"
              style={{ background: "rgba(15,61,58,0.05)", border: `1px solid ${C.line}`, color: C.text }}
            />
          </div>
          <input
            value={form.ie}
            onChange={(e) => setForm({ ...form, ie: e.target.value })}
            placeholder="Institución educativa (IE)"
            className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
            style={{ background: "rgba(15,61,58,0.05)", border: `1px solid ${C.line}`, color: C.text }}
          />
          <input
            value={form.celular}
            onChange={(e) => setForm({ ...form, celular: e.target.value })}
            placeholder="Celular"
            className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
            style={{ background: "rgba(15,61,58,0.05)", border: `1px solid ${C.line}`, color: C.text }}
          />
          <input
            value={form.correo}
            onChange={(e) => setForm({ ...form, correo: e.target.value })}
            type="email"
            placeholder="Correo electrónico"
            className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
            style={{ background: "rgba(15,61,58,0.05)", border: `1px solid ${C.line}`, color: C.text }}
          />

          {error && <p className="text-xs" style={{ color: "#FF8A5B" }}>{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold mt-2"
            style={{ background: C.teal, color: "#0B2B29", opacity: saving ? 0.7 : 1 }}
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <User size={15} />}
            {saving ? "Guardando..." : "Registrarme y entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* UI PIECES                                                                */
/* ---------------------------------------------------------------------- */

function GradeTag({ grade }) {
  const isPrimaria = grade === "primaria";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase"
      style={{
        color: isPrimaria ? C.amber : C.cyan,
        background: isPrimaria ? "rgba(255,187,0,0.14)" : "rgba(31,158,152,0.14)",
        border: `1px solid ${isPrimaria ? "rgba(255,187,0,0.4)" : "rgba(31,158,152,0.4)"}`,
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      {isPrimaria ? "Primaria" : "Secundaria"}
    </span>
  );
}

function PunchHoles() {
  return (
    <div className="absolute left-0 top-0 bottom-0 w-6 flex flex-col justify-evenly items-center py-6">
      {[0, 1, 2].map((i) => (
        <div key={i} className="w-2.5 h-2.5 rounded-full" style={{ background: C.bg, border: `1px solid ${C.line}` }} />
      ))}
    </div>
  );
}

function ActivityCard({ activity, onOpen, grade }) {
  const subj = SUBJECTS[activity.subject];
  const Icon = subj.icon;
  return (
    <button
      onClick={() => onOpen(activity)}
      className="relative text-left rounded-xl overflow-hidden pl-8 pr-5 py-5 transition-transform duration-200 hover:-translate-y-1 focus:outline-none focus-visible:ring-2"
      style={{ background: C.surface, border: `1px solid ${C.line}`, outlineColor: subj.color }}
    >
      <PunchHoles />
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] tracking-widest" style={{ color: subj.color, fontFamily: "'JetBrains Mono', monospace" }}>
          {activity.code}
        </span>
        <Icon size={18} color={subj.color} />
      </div>
      <h3 className="text-lg font-semibold leading-snug mb-2" style={{ color: C.text, fontFamily: "'Space Grotesk', sans-serif" }}>
        {activity.title}
      </h3>
      <p className="text-sm mb-4" style={{ color: C.muted }}>
        {subj.label} · Ambos niveles disponibles
      </p>
      <div className="flex items-center gap-2">
        <GradeTag grade={grade} />
      </div>
      <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium" style={{ color: subj.color }}>
        Ver ficha guiada <ChevronRight size={15} />
      </div>
    </button>
  );
}

function ActivityModal({ activity, grade, setGrade, onClose }) {
  if (!activity) return null;
  const subj = SUBJECTS[activity.subject];
  const v = activity.versions[grade];
  const accent = grade === "primaria" ? C.amber : C.cyan;
  const handlePrint = () => window.print();

  return (
    <div
      className="fixed inset-0 z-50 flex items-start md:items-center justify-center p-3 md:p-6 overflow-y-auto"
      style={{ background: "rgba(15,61,58,0.45)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div className="printable relative w-full max-w-2xl rounded-2xl my-6" style={{ background: C.surface2, border: `1px solid ${C.line}` }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-6 pt-6">
          <div>
            <span className="text-[11px] tracking-widest" style={{ color: subj.color, fontFamily: "'JetBrains Mono', monospace" }}>
              {activity.code} · {subj.label}
            </span>
            <h2 className="text-2xl font-semibold mt-1" style={{ color: C.text, fontFamily: "'Space Grotesk', sans-serif" }}>
              {activity.title}
            </h2>
          </div>
          <button onClick={onClose} className="no-print p-1.5 rounded-lg" style={{ color: C.muted }} aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>

        <div className="no-print flex gap-2 px-6 mt-4">
          {["primaria", "secundaria"].map((g) => (
            <button
              key={g}
              onClick={() => setGrade(g)}
              className="px-3 py-1.5 rounded-full text-sm font-semibold transition-colors"
              style={{ background: grade === g ? (g === "primaria" ? C.amber : C.cyan) : "transparent", color: grade === g ? "#0B2B29" : C.muted, border: `1px solid ${grade === g ? "transparent" : C.line}` }}
            >
              {g === "primaria" ? "Primaria" : "Secundaria"}
            </button>
          ))}
        </div>

        <div className="px-6 py-6 space-y-5">
          <div className="flex flex-wrap gap-4 text-sm" style={{ color: C.muted }}>
            <span className="inline-flex items-center gap-1.5"><Clock size={14} /> {v.duracion}</span>
            <span className="inline-flex items-center gap-1.5"><Layers size={14} /> {v.materiales.length} materiales</span>
          </div>

          <div className="rounded-lg p-4" style={{ background: "rgba(15,61,58,0.03)", borderLeft: `3px solid ${accent}` }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: accent }}>Competencia CNEB</p>
            <p className="text-sm" style={{ color: C.text }}>{activity.competencia}</p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: C.muted }}>Objetivo de la sesión</p>
            <p className="text-sm leading-relaxed" style={{ color: C.text }}>{v.objetivo}</p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: C.muted }}>Materiales</p>
            <ul className="text-sm space-y-1" style={{ color: C.text }}>
              {v.materiales.map((m, i) => (
                <li key={i} className="flex gap-2"><span style={{ color: accent }}>·</span> {m}</li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.muted }}>Pasos guiados</p>
            <ol className="space-y-2.5">
              {v.pasos.map((p, i) => (
                <li key={i} className="flex gap-3 text-sm leading-relaxed" style={{ color: C.text }}>
                  <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold" style={{ background: accent, color: "#0B2B29" }}>{i + 1}</span>
                  {p}
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-lg p-4" style={{ background: "rgba(15,61,58,0.03)" }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: C.muted }}>Cierre</p>
            <p className="text-sm leading-relaxed" style={{ color: C.text }}>{v.cierre}</p>
          </div>
        </div>

        <div className="no-print flex gap-3 px-6 pb-6">
          <button onClick={handlePrint} className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold" style={{ background: "rgba(15,61,58,0.06)", color: C.text, border: `1px solid ${C.line}` }}>
            <Printer size={16} /> Imprimir / guardar como PDF
          </button>
          <button
            onClick={() =>
              downloadText(
                `${activity.id}-${grade}.txt`,
                `${activity.title} (${grade})\n\nCompetencia CNEB: ${activity.competencia}\n\nObjetivo:\n${v.objetivo}\n\nDuración: ${v.duracion}\n\nMateriales:\n${v.materiales.map((m) => "- " + m).join("\n")}\n\nPasos:\n${v.pasos.map((p, i) => `${i + 1}. ${p}`).join("\n")}\n\nCierre:\n${v.cierre}\n\nGenerado desde SciVerse para Docentes.`
              )
            }
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold"
            style={{ background: accent, color: "#0B2B29" }}
          >
            <Download size={16} /> Descargar ficha
          </button>
        </div>
      </div>
    </div>
  );
}

function RetoCard({ reto }) {
  const subj = SUBJECTS[reto.subject];
  const Icon = reto.icon;
  return (
    <div className="rounded-xl p-5" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
      <div className="flex items-center justify-between mb-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(15,61,58,0.05)" }}>
          <Icon size={17} color={subj.color} />
        </div>
        <span className="text-xs inline-flex items-center gap-1" style={{ color: C.muted }}><Clock size={12} /> {reto.duracion}</span>
      </div>
      <h4 className="text-base font-semibold mb-1.5" style={{ color: C.text, fontFamily: "'Space Grotesk', sans-serif" }}>{reto.title}</h4>
      <p className="text-sm mb-3" style={{ color: C.muted }}>{reto.desc}</p>
      <div className="flex gap-1.5">
        {reto.grades.map((g) => <GradeTag key={g} grade={g} />)}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* MAIN APP                                                                 */
/* ---------------------------------------------------------------------- */

export default function SciVerseDocentes() {
  return <AuthGate LandingComponent={ImprovedLanding}>{(profile, onLogout) => <SciVerseApp profile={profile} onLogout={onLogout} />}</AuthGate>;
}

function SciVerseApp({ profile, onLogout }) {
  const preferredGrade = profile.nivel === "secundaria" ? "secundaria" : "primaria";
  const [heroGrade, setHeroGrade] = useState(preferredGrade);
  const [gradeFilter, setGradeFilter] = useState(preferredGrade);
  const [subjectFilter, setSubjectFilter] = useState("todos");
  const [selected, setSelected] = useState(null);
  const [modalGrade, setModalGrade] = useState(preferredGrade);

  const filtered = ACTIVITIES.filter((a) => subjectFilter === "todos" || a.subject === subjectFilter);
  const filteredRetos = RETOS.filter((r) => gradeFilter === "todos" || r.grades.includes(gradeFilter));

  const openActivity = (a) => {
    setSelected(a);
    setModalGrade(heroGrade);
  };

  const heroAccent = heroGrade === "primaria" ? C.amber : C.cyan;

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap');
        @media print {
          body * { visibility: hidden; }
          .printable, .printable * { visibility: visible; }
          .printable { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <nav className="flex items-center justify-between px-6 md:px-10 py-5 sticky top-0 z-30" style={{ background: "rgba(255,255,255,0.88)", backdropFilter: "blur(8px)", borderBottom: `1px solid ${C.lineSoft}` }}>
        <div className="flex items-center gap-2">
          <Microscope size={20} color={C.teal} />
          <span className="text-lg font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            SciVerse <span style={{ color: C.muted, fontWeight: 400 }}>para Docentes</span>
          </span>
        </div>
        <div className="hidden md:flex items-center gap-6 text-sm" style={{ color: C.muted }}>
          <a href="#actividades" className="hover:opacity-80">Actividades</a>
          <a href="#lab3d" className="hover:opacity-80">Laboratorio 3D</a>
          <a href="#retos" className="hover:opacity-80">Retos grupales</a>
          <a href="#generador" className="hover:opacity-80">Generador STEAM</a>
          <a href="#plantillas" className="hover:opacity-80">Plantillas</a>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-sm" style={{ color: C.muted }}>
            Hola, <strong style={{ color: C.text }}>{profile.nombres}</strong> · {heroGrade === "primaria" ? "Primaria" : "Secundaria"}
          </span>
          <button onClick={onLogout} className="p-1.5 rounded-lg" style={{ color: C.muted }} title="Cerrar sesión">
            <LogOut size={16} />
          </button>
        </div>
      </nav>

      <header className="px-6 md:px-10 pt-14 pb-16 max-w-5xl mx-auto text-center">
        <span
          className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-widest uppercase px-3 py-1.5 rounded-full mb-6"
          style={{ color: heroAccent, background: "rgba(15,61,58,0.05)", border: `1px solid ${C.line}`, fontFamily: "'JetBrains Mono', monospace" }}
        >
          <Sparkles size={13} /> Laboratorio virtual STEAM · Alineado al CNEB
        </span>
        <h1 className="text-4xl md:text-5xl font-semibold leading-tight mb-5" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Tu laboratorio, llevado al aula
        </h1>
        <p className="text-lg max-w-2xl mx-auto mb-3" style={{ color: C.muted }}>
          Fichas guiadas, un laboratorio 3D interactivo, retos grupales y un generador de sesiones con IA — en las cinco áreas STEAM: <strong style={{ color: C.text }}>Ciencia, Tecnología, Ingeniería, Arte y Matemática</strong>.
        </p>
        <p className="text-sm max-w-2xl mx-auto mb-8" style={{ color: C.muted }}>
          Todo adaptado al grado de tus estudiantes.
        </p>

        <div className="inline-flex items-center gap-1 p-1 rounded-full mb-10" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
          {["primaria", "secundaria"].map((g) => (
            <button
              key={g}
              onClick={() => setHeroGrade(g)}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors"
              style={{ background: heroGrade === g ? (g === "primaria" ? C.amber : C.cyan) : "transparent", color: heroGrade === g ? "#0B2B29" : C.muted }}
            >
              <School size={15} /> {g === "primaria" ? "Primaria" : "Secundaria"}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-6 max-w-lg mx-auto text-center">
          <div>
            <p className="text-2xl font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{ACTIVITIES.length}</p>
            <p className="text-xs mt-1" style={{ color: C.muted }}>Actividades STEAM</p>
          </div>
          <div>
            <p className="text-2xl font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{RETOS.length}</p>
            <p className="text-xs mt-1" style={{ color: C.muted }}>Retos grupales</p>
          </div>
          <div>
            <p className="text-2xl font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{TEMPLATES.length}</p>
            <p className="text-xs mt-1" style={{ color: C.muted }}>Plantillas CNEB</p>
          </div>
        </div>
      </header>

      {/* ACTIVIDADES */}
      <section id="actividades" className="px-6 md:px-10 py-14 max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <span className="text-xs tracking-widest uppercase" style={{ color: C.teal, fontFamily: "'JetBrains Mono', monospace" }}>Bitácora de actividades</span>
            <h2 className="text-2xl md:text-3xl font-semibold mt-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Actividades en las cinco áreas STEAM</h2>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setSubjectFilter("todos")} className="px-3 py-1.5 rounded-full text-sm font-medium" style={{ background: subjectFilter === "todos" ? C.teal : "transparent", color: subjectFilter === "todos" ? "#0B2B29" : C.muted, border: `1px solid ${C.line}` }}>
              Todas
            </button>
            {Object.entries(SUBJECTS).map(([key, s]) => (
              <button key={key} onClick={() => setSubjectFilter(key)} className="px-3 py-1.5 rounded-full text-sm font-medium" style={{ background: subjectFilter === key ? s.color : "transparent", color: subjectFilter === key ? "#0B2B29" : C.muted, border: `1px solid ${C.line}` }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((a) => <ActivityCard key={a.id} activity={a} onOpen={openActivity} grade={heroGrade} />)}
        </div>
      </section>

      {/* LABORATORIO 3D */}
      <section id="lab3d" className="px-6 md:px-10 py-14 max-w-6xl mx-auto">
        <span className="text-xs tracking-widest uppercase" style={{ color: "#6FE6A8", fontFamily: "'JetBrains Mono', monospace" }}>Laboratorio interactivo</span>
        <h2 className="text-2xl md:text-3xl font-semibold mt-1 mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Explora la célula en 3D</h2>
        <p className="text-sm mb-6" style={{ color: C.muted }}>
          Modelo 3D construido con Three.js, directamente en el navegador. Cambia de célula, arrastra para girarla y toca cada organelo para ver su función — ideal para proyectar en clase o dejar que tus estudiantes lo exploren en parejas.
        </p>
        <Cell3DViewer />
      </section>

      {/* RETOS GRUPALES */}
      <section id="retos" className="px-6 md:px-10 py-14 max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <span className="text-xs tracking-widest uppercase" style={{ color: C.violet, fontFamily: "'JetBrains Mono', monospace" }}>Para el aula completa</span>
            <h2 className="text-2xl md:text-3xl font-semibold mt-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Retos grupales</h2>
          </div>
          <div className="flex gap-2">
            {["todos", "primaria", "secundaria"].map((g) => (
              <button key={g} onClick={() => setGradeFilter(g)} className="px-3 py-1.5 rounded-full text-sm font-medium capitalize" style={{ background: gradeFilter === g ? (g === "primaria" ? C.amber : g === "secundaria" ? C.cyan : C.violet) : "transparent", color: gradeFilter === g ? "#0B2B29" : C.muted, border: `1px solid ${C.line}` }}>
                {g}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {filteredRetos.map((r) => <RetoCard key={r.id} reto={r} />)}
        </div>
      </section>

      {/* GENERADOR STEAM */}
      <section id="generador" className="px-6 md:px-10 py-14 max-w-4xl mx-auto">
        <span className="text-xs tracking-widest uppercase" style={{ color: C.teal, fontFamily: "'JetBrains Mono', monospace" }}>Con inteligencia artificial</span>
        <h2 className="text-2xl md:text-3xl font-semibold mt-1 mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Generador de proyectos y sesiones STEAM</h2>
        <p className="text-sm mb-6" style={{ color: C.muted }}>
          ¿Necesitas una actividad sobre un tema que no está en el catálogo? Descríbelo aquí y genera una sesión nueva, lista para usar.
        </p>
        <SteamGenerator initialGrade={preferredGrade} />
      </section>

      {/* PLANTILLAS */}
      <section id="plantillas" className="px-6 md:px-10 py-14 max-w-6xl mx-auto">
        <span className="text-xs tracking-widest uppercase" style={{ color: C.amber, fontFamily: "'JetBrains Mono', monospace" }}>Listas para imprimir</span>
        <h2 className="text-2xl md:text-3xl font-semibold mt-1 mb-8" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Plantillas descargables alineadas al CNEB</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {TEMPLATES.map((t) => {
            const Icon = t.icon;
            return (
              <div key={t.id} className="rounded-xl p-5 flex flex-col" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ background: "rgba(15,61,58,0.05)" }}>
                  <Icon size={17} color={C.teal} />
                </div>
                <h4 className="text-base font-semibold mb-1.5" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{t.title}</h4>
                <p className="text-sm mb-4 flex-1" style={{ color: C.muted }}>{t.desc}</p>
                <button onClick={() => downloadText(`${t.id}.txt`, TEMPLATE_CONTENT[t.id])} className="inline-flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold" style={{ background: "rgba(15,61,58,0.06)", color: C.text, border: `1px solid ${C.line}` }}>
                  <Download size={14} /> Descargar
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="px-6 md:px-10 pb-20 max-w-4xl mx-auto text-center">
        <div className="rounded-2xl p-10" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
          <GraduationCap size={26} color={C.teal} className="mx-auto mb-4" />
          <h3 className="text-xl md:text-2xl font-semibold mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>¿Prefieres que te arme la sesión directamente en el chat?</h3>
          <p className="text-sm mb-6" style={{ color: C.muted }}>Cuéntame el tema y el grado, y armamos juntos una ficha guiada nueva para tu clase.</p>
          <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold" style={{ background: C.teal, color: "#0B2B29" }} onClick={() => document.getElementById("generador")?.scrollIntoView({ behavior: "smooth" })}>
            Proponer una actividad <ArrowRight size={15} />
          </button>
        </div>
      </section>

      <footer className="px-6 md:px-10 py-8 text-center text-xs" style={{ color: C.muted, borderTop: `1px solid ${C.lineSoft}` }}>
        SciVerse para Docentes — un espacio de Frida García Rurush, IA educativa.
      </footer>

      {selected && <ActivityModal activity={selected} grade={modalGrade} setGrade={setModalGrade} onClose={() => setSelected(null)} />}
    </div>
  );
}
