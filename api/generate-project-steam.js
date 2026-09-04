
const GEMINI_MODEL = process.env.GEMINI_MAIN_MODEL || "gemini-3.6-flash";

const SUGGESTION_SCHEMA={type:"object",properties:{suggestion:{type:"string"}},required:["suggestion"]};
const PROJECT_SCHEMA={
  type:"object",
  properties:{
    titulo:{type:"string"},
    situacionSignificativa:{type:"string"},
    reto:{type:"string"},
    integracionSTEAM:{type:"array",items:{type:"object",properties:{area:{type:"string"},aporte:{type:"string"}},required:["area","aporte"]}},
    competencias:{type:"array",items:{type:"object",properties:{area:{type:"string"},competencia:{type:"string"}},required:["area","competencia"]}},
    productoEsperado:{type:"string"},
    evidencias:{type:"array",items:{type:"string"}},
    rutaSemanas:{type:"array",items:{type:"object",properties:{semana:{type:"integer"},titulo:{type:"string"},proposito:{type:"string"},actividades:{type:"array",items:{type:"string"}},evidencia:{type:"string"}},required:["semana","titulo","proposito","actividades","evidencia"]}},
    sesiones:{type:"array",items:{type:"object",properties:{titulo:{type:"string"},competencia:{type:"string"},actividadCentral:{type:"string"},evidencia:{type:"string"},criterios:{type:"array",items:{type:"string"}},instrumento:{type:"string"}},required:["titulo","competencia","actividadCentral","evidencia","criterios","instrumento"]}}
  },
  required:["titulo","situacionSignificativa","reto","integracionSTEAM","competencias","productoEsperado","evidencias","rutaSemanas","sesiones"]
};

async function authUser(token,url,key){
  const r=await fetch(`${url}/auth/v1/user`,{headers:{apikey:key,Authorization:`Bearer ${token}`}});
  if(!r.ok)throw Object.assign(new Error("Tu sesión venció. Vuelve a iniciar sesión."),{status:401});
}

export default async function handler(req,res){
  if(req.method!=="POST")return res.status(405).json({error:"Método no permitido"});
  const apiKey=process.env.GEMINI_API_KEY;
  const supabaseUrl=process.env.VITE_SUPABASE_URL||process.env.SUPABASE_URL;
  const supabaseKey=process.env.VITE_SUPABASE_PUBLISHABLE_KEY||process.env.VITE_SUPABASE_ANON_KEY;
  const token=req.headers.authorization?.replace(/^Bearer\s+/i,"");
  if(!apiKey)return res.status(500).json({error:"Falta GEMINI_API_KEY"});
  if(!token||!supabaseUrl||!supabaseKey)return res.status(401).json({error:"Inicia sesión para continuar"});

  try{
    await authUser(token,supabaseUrl,supabaseKey);
    const {mode="generate",field,form={}}=req.body||{};
    const weeks=Math.min(4,Math.max(1,Number(form.duracionSemanas||2)));
    if(mode==="suggestion"){
      const instructions={
        situacion:"Redacta una situación significativa auténtica y cercana al contexto del estudiante. Debe presentar un problema o necesidad que dé sentido al proyecto, sin inventar datos locales específicos.",
        reto:"Formula una sola pregunta guía retadora, abierta, comprensible para el grado y que conduzca a crear una solución o producto.",
        producto:"Propón un producto final concreto, construible, observable y adecuado al grado, relacionado con la situación significativa.",
        evidencias:"Propón entre 3 y 5 evidencias concretas del proceso y producto: bocetos, registros, pruebas, prototipo, explicación, exposición u otras pertinentes."
      };
      if(!instructions[field])return res.status(400).json({error:"Campo de sugerencia no válido"});
      const prompt=`Eres especialista peruano en CNEB y metodología STEAM.
Nivel: ${form.nivel}. Grado: ${form.grado}. Región: ${form.region||"No indicada"}.
Tema: ${form.tema||"No indicado"}. Situación actual: ${form.situacion||""}.
Áreas STEAM: ${(form.areasSTEAM||[]).join(", ")}.
${instructions[field]}
Responde solo el texto listo para pegar en el formulario.`;
      const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,{method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":apiKey},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{responseMimeType:"application/json",responseSchema:SUGGESTION_SCHEMA,maxOutputTokens:900}})});
      const data=await r.json();if(!r.ok)throw Object.assign(new Error(data?.error?.message||"Error de Gemini"),{status:r.status});
      const text=data.candidates?.[0]?.content?.parts?.map(p=>p.text).join("")||"";
      return res.status(200).json(JSON.parse(text));
    }

    if(!(form.areasSTEAM||[]).length||!form.tema||!form.situacion)return res.status(400).json({error:"Falta información del proyecto."});
    const prompt=`Actúa como especialista peruano en CNEB, aprendizaje basado en proyectos y metodología STEAM.

Diseña un PROYECTO STEAM, no una sesión de aprendizaje.

DATOS DEL DOCENTE:
Nivel: ${form.nivel}
Grado: ${form.grado}
Sección: ${form.seccion||"No indicada"}
Región: ${form.region}
Duración TOTAL: ${weeks} semana(s). Debes producir exactamente ${weeks} elementos en rutaSemanas y nunca más de 4.
Tema o título provisional: ${form.tema}
Situación significativa proporcionada: ${form.situacion}
Reto propuesto: ${form.reto||"Formúlalo"}
Áreas STEAM seleccionadas: ${(form.areasSTEAM||[]).join(" | ")}
Área curricular principal: ${form.areaCurricular}
Competencia CNEB principal, conservar literalmente: ${form.competencia}
Capacidades seleccionadas: ${(form.capacidades||[]).join(" | ")}
Producto esperado: ${form.producto}
Evidencias propuestas: ${form.evidencias}
Recursos disponibles: ${form.recursos||"materiales accesibles del entorno"}

REGLAS:
- No lo estructures como Inicio, Desarrollo y Cierre de una sola clase.
- Organiza el proyecto por semanas.
- En integracionSTEAM incluye solo las áreas STEAM seleccionadas y explica su aporte real.
- Conserva literalmente la competencia CNEB principal. Puedes incorporar otras competencias únicamente si pertenecen claramente a las áreas curriculares y son pertinentes; evita inventar competencias.
- El producto debe responder al reto.
- Las evidencias deben mostrar proceso y producto.
- La ruta semanal debe mostrar progresión: comprender el problema, investigar/diseñar, construir/probar/mejorar y comunicar, adaptando las fases al número de semanas.
- Genera entre ${weeks*2} y ${weeks*3} sesiones breves dentro de "sesiones".
- Cada sesión debe incluir competencia, actividad central, evidencia, criterios observables e instrumento sugerido.
- Usa lenguaje claro y aplicable por docentes peruanos.
- Devuelve únicamente JSON válido.`;

    const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,{method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":apiKey},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],systemInstruction:{parts:[{text:"Eres especialista peruano en CNEB y proyectos STEAM. No conviertas proyectos en sesiones."}]},generationConfig:{responseMimeType:"application/json",responseSchema:PROJECT_SCHEMA,maxOutputTokens:7500}})});
    const data=await r.json();if(!r.ok)throw Object.assign(new Error(data?.error?.message||"Error de Gemini"),{status:r.status});
    const text=data.candidates?.[0]?.content?.parts?.map(p=>p.text).join("")||"";
    if(!text)throw new Error("Gemini no devolvió contenido");
    const project=JSON.parse(text);
    project.rutaSemanas=(project.rutaSemanas||[]).slice(0,weeks);
    return res.status(200).json({project,model:GEMINI_MODEL});
  }catch(e){return res.status(e.status||500).json({error:e.message||"No se pudo generar el proyecto"});}
}