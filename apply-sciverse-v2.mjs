import fs from "node:fs";

const appPath = "App.jsx";
const cssPath = "index.css";
const projectApiPath = "api/generate-project-steam.js";

function mustReplace(source, searchValue, replacement, label) {
  const next = source.replace(searchValue, replacement);
  if (next === source) throw new Error(`No pude aplicar el cambio: ${label}`);
  return next;
}

let app = fs.readFileSync(appPath, "utf8");

// ---------------------------------------------------------------------
// 1) Íconos adicionales
// ---------------------------------------------------------------------
app = mustReplace(
  app,
  '  Quote,\n} from "lucide-react";',
  '  Quote,\n  Gamepad2,\n  ListChecks,\n  CalendarDays,\n} from "lucide-react";',
  "iconos del dashboard"
);

// ---------------------------------------------------------------------
// 2) Generadores V2: Proyecto STEAM, Ficha, Lectura y Escala
// ---------------------------------------------------------------------
const generatorsV2 = String.raw`
function getTeacherFullName(profile={}) {
  return [profile.nombres, profile.apellidos].filter(Boolean).join(" ").trim() || "Docente";
}

function ProjectSteamGenerator({ initialGrade = "primaria", profile = {} }) {
  const initialLevel = initialGrade === "secundaria" ? "Secundaria" : "Primaria";
  const [step,setStep]=useState(1);
  const [form,setForm]=useState({
    nivel:initialLevel,
    grado:initialLevel==="Primaria"?"4.º":"2.º",
    seccion:"",
    region:"",
    duracionSemanas:"2",
    tema:"",
    situacion:"",
    reto:"",
    areasSTEAM:["Ciencia","Tecnología","Ingeniería","Arte","Matemática"],
    areaCurricular:"Ciencia y Tecnología",
    competencia:CNEB.disena,
    capacidades:GENERATOR_CAPACITIES[CNEB.disena],
    producto:"",
    evidencias:"",
    recursos:"",
  });
  const [loading,setLoading]=useState(false);
  const [result,setResult]=useState(null);
  const [error,setError]=useState("");
  const [suggesting,setSuggesting]=useState("");

  const grades=form.nivel==="Primaria"?["1.º","2.º","3.º","4.º","5.º","6.º"]:["1.º","2.º","3.º","4.º","5.º"];
  const update=(key,value)=>setForm(prev=>({...prev,[key]:value}));
  function changeLevel(nivel){setForm(prev=>({...prev,nivel,grado:"1.º"}));}
  function changeArea(areaCurricular){
    const competencia=GENERATOR_COMPETENCIES[areaCurricular][0];
    setForm(prev=>({...prev,areaCurricular,competencia,capacidades:GENERATOR_CAPACITIES[competencia]||[]}));
  }
  function changeCompetence(competencia){setForm(prev=>({...prev,competencia,capacidades:GENERATOR_CAPACITIES[competencia]||[]}));}
  function toggleSteamArea(area){setForm(prev=>({...prev,areasSTEAM:prev.areasSTEAM.includes(area)?prev.areasSTEAM.filter(x=>x!==area):[...prev.areasSTEAM,area]}));}
  function toggleCapacity(cap){setForm(prev=>({...prev,capacidades:prev.capacidades.includes(cap)?prev.capacidades.filter(x=>x!==cap):[...prev.capacidades,cap]}));}

  async function suggest(field){
    if(!form.tema.trim()) return setError("Escribe primero un tema o idea para el proyecto.");
    setSuggesting(field);setError("");
    try{
      const {data:{session}}=await supabase.auth.getSession();
      const response=await fetch("/api/generate-project-steam",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session?.access_token||""}`},body:JSON.stringify({mode:"suggestion",field,form})});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"No se pudo generar la sugerencia.");
      update(field,data.suggestion);
    }catch(e){setError(e.message);}finally{setSuggesting("");}
  }

  function next(){
    setError("");
    if(step===1&&(!form.nivel||!form.grado||!form.region||!form.duracionSemanas)) return setError("Completa nivel, grado, región y duración.");
    if(step===2&&(!form.tema.trim()||!form.situacion.trim()||form.areasSTEAM.length<2||!form.competencia||!form.capacidades.length)) return setError("Completa el tema, la situación significativa y selecciona al menos dos áreas STEAM.");
    if(step===3&&(!form.producto.trim()||!form.evidencias.trim())) return setError("Completa el producto esperado y las evidencias.");
    setStep(s=>Math.min(4,s+1));
  }

  async function generate(){
    setLoading(true);setError("");setResult(null);
    try{
      const {data:{session}}=await supabase.auth.getSession();
      const response=await fetch("/api/generate-project-steam",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session?.access_token||""}`},body:JSON.stringify({mode:"generate",form,profile:{nombres:profile.nombres,apellidos:profile.apellidos,ie:profile.ie}})});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"No se pudo generar el proyecto STEAM.");
      setResult(data.project);
      try{
        await saveTeacherMaterial({
          tipo:"project",
          titulo:data.project.titulo||form.tema,
          form:{...form,area:form.areaCurricular,tema:form.tema},
          contenido:data.project
        });
      }catch(saveError){console.error(saveError);}
    }catch(e){setError(e.message);}finally{setLoading(false);}
  }

  async function downloadProject(){
    if(!result)return;
    const teacher=getTeacherFullName(profile);
    const weeks=(result.rutaSemanas||[]).map((w,i)=>`SEMANA ${i+1}: ${w.titulo}\n${w.proposito}\nActividades: ${(w.actividades||[]).join(" | ")}\nEvidencia: ${w.evidencia}`).join("\n\n");
    const sessions=(result.sesiones||[]).map((s,i)=>`${i+1}. ${s.titulo}\nCompetencia: ${s.competencia}\nActividad central: ${s.actividadCentral}\nEvidencia: ${s.evidencia}\nCriterios: ${(s.criterios||[]).join(" | ")}\nInstrumento: ${s.instrumento}`).join("\n\n");
    const text=`PROYECTO STEAM

I. DATOS INFORMATIVOS
Docente: ${teacher}
I.E.: ${profile.ie||""}
Región: ${form.region}
Nivel: ${form.nivel}
Grado y sección: ${form.grado}${form.seccion?` - ${form.seccion}`:""}
Duración: ${form.duracionSemanas} semana(s)

II. TÍTULO
${result.titulo}

III. SITUACIÓN SIGNIFICATIVA
${result.situacionSignificativa}

IV. RETO O PREGUNTA GUÍA
${result.reto}

V. INTEGRACIÓN STEAM
${(result.integracionSTEAM||[]).map(x=>`${x.area}: ${x.aporte}`).join("\n")}

VI. COMPETENCIAS CNEB
${(result.competencias||[]).map(x=>`${x.area}: ${x.competencia}`).join("\n")}

VII. PRODUCTO ESPERADO
${result.productoEsperado}

VIII. EVIDENCIAS
${(result.evidencias||[]).map(x=>`• ${x}`).join("\n")}

IX. RUTA DEL PROYECTO POR SEMANAS
${weeks}

X. SESIONES DEL PROYECTO
${sessions}`;
    await downloadWord(`proyecto-steam-${(result.titulo||"proyecto").toLowerCase().replace(/[^a-z0-9]+/gi,"-")}.docx`,text,result.titulo);
  }

  return <div className="project-steam-v2">
    <div className="project-teacher-card">
      <div className="project-avatar">{(profile.nombres?.[0]||"D").toUpperCase()}</div>
      <div><small>DATOS TOMADOS DE TU CUENTA</small><strong>{getTeacherFullName(profile)}</strong><p>{profile.ie||"Institución educativa no registrada"}</p></div>
      <CheckCircle2 size={20}/>
    </div>

    <div className="instrument-steps project-steps">
      {["Datos del proyecto","Situación y CNEB","Producto y evidencias","Revisión"].map((label,index)=><div key={label} className={step>=index+1?"active":""}><b>{step>index+1?<CheckCircle2 size={14}/>:index+1}</b><span>{label}</span></div>)}
    </div>

    {step===1&&<div className="wizard-card">
      <div className="wizard-card__title"><span><School size={18}/></span><div><h4>Datos del proyecto</h4><p>Define a quién va dirigido y cuánto tiempo durará.</p></div></div>
      <div className="wizard-fields">
        <label>Nivel educativo *<select value={form.nivel} onChange={e=>changeLevel(e.target.value)}><option>Primaria</option><option>Secundaria</option></select></label>
        <label>Grado *<select value={form.grado} onChange={e=>update("grado",e.target.value)}>{grades.map(g=><option key={g}>{g}</option>)}</select></label>
        <label>Sección<input value={form.seccion} onChange={e=>update("seccion",e.target.value)} placeholder="Ej.: A, B o Única"/></label>
        <label>Duración *<select value={form.duracionSemanas} onChange={e=>update("duracionSemanas",e.target.value)}>{[1,2,3,4].map(n=><option key={n} value={n}>{n} {n===1?"semana":"semanas"}</option>)}</select></label>
        <label className="wide">Región *<select value={form.region} onChange={e=>update("region",e.target.value)}><option value="">Selecciona una región</option>{PERU_REGIONS.map(r=><option key={r}>{r}</option>)}</select></label>
      </div>
    </div>}

    {step===2&&<div className="wizard-card">
      <div className="wizard-card__title"><span><Sparkles size={18}/></span><div><h4>Situación significativa e integración STEAM</h4><p>Cuéntale a Kantu qué problema o necesidad abordarán.</p></div></div>
      <div className="wizard-fields">
        <label className="wide">Tema o título provisional *<input value={form.tema} onChange={e=>update("tema",e.target.value)} placeholder="Ej.: Guardianes del agua"/></label>
        <label className="wide ai-field"><span>Situación significativa *</span><button type="button" onClick={()=>suggest("situacion")} disabled={suggesting==="situacion"}>{suggesting==="situacion"?<Loader2 size={13} className="animate-spin"/>:<Sparkles size={13}/>} Sugerir con Kantu</button><textarea value={form.situacion} onChange={e=>update("situacion",e.target.value)} placeholder="Describe brevemente el problema, necesidad o situación de la escuela o comunidad."/></label>
        <label className="wide ai-field"><span>Reto o pregunta guía</span><button type="button" onClick={()=>suggest("reto")} disabled={suggesting==="reto"}>{suggesting==="reto"?<Loader2 size={13} className="animate-spin"/>:<Sparkles size={13}/>} Sugerir con Kantu</button><input value={form.reto} onChange={e=>update("reto",e.target.value)} placeholder="Ej.: ¿Cómo podríamos reducir el desperdicio de agua en nuestra escuela?"/></label>
        <fieldset className="wide steam-area-picker"><legend>¿Qué áreas STEAM intervienen? * <small>Selecciona al menos 2</small></legend>{["Ciencia","Tecnología","Ingeniería","Arte","Matemática"].map(area=><label key={area} className={form.areasSTEAM.includes(area)?"selected":""}><input type="checkbox" checked={form.areasSTEAM.includes(area)} onChange={()=>toggleSteamArea(area)}/><span>{area}</span></label>)}</fieldset>
        <label className="wide">Área curricular principal *<select value={form.areaCurricular} onChange={e=>changeArea(e.target.value)}>{GENERATOR_AREAS.map(a=><option key={a}>{a}</option>)}</select></label>
        <label className="wide">Competencia CNEB principal *<select value={form.competencia} onChange={e=>changeCompetence(e.target.value)}>{GENERATOR_COMPETENCIES[form.areaCurricular].map(c=><option key={c}>{c}</option>)}</select></label>
        <fieldset className="wide capacity-picker"><legend>Capacidades que se movilizarán *</legend>{(GENERATOR_CAPACITIES[form.competencia]||[]).map(cap=><label key={cap}><input type="checkbox" checked={form.capacidades.includes(cap)} onChange={()=>toggleCapacity(cap)}/><span>{cap}</span></label>)}</fieldset>
      </div>
    </div>}

    {step===3&&<div className="wizard-card">
      <div className="wizard-card__title"><span><Target size={18}/></span><div><h4>Producto y evidencias</h4><p>Define qué construirán o presentarán los estudiantes.</p></div></div>
      <div className="wizard-fields">
        <label className="wide ai-field"><span>Producto esperado *</span><button type="button" onClick={()=>suggest("producto")} disabled={suggesting==="producto"}>{suggesting==="producto"?<Loader2 size={13} className="animate-spin"/>:<Sparkles size={13}/>} Sugerir con Kantu</button><textarea value={form.producto} onChange={e=>update("producto",e.target.value)} placeholder="Ej.: prototipo de un sistema sencillo para reutilizar agua."/></label>
        <label className="wide ai-field"><span>Evidencias del proyecto *</span><button type="button" onClick={()=>suggest("evidencias")} disabled={suggesting==="evidencias"}>{suggesting==="evidencias"?<Loader2 size={13} className="animate-spin"/>:<Sparkles size={13}/>} Sugerir con Kantu</button><textarea value={form.evidencias} onChange={e=>update("evidencias",e.target.value)} placeholder="Ej.: boceto, registro de pruebas, prototipo y exposición final."/></label>
        <label className="wide">Recursos disponibles<input value={form.recursos} onChange={e=>update("recursos",e.target.value)} placeholder="Ej.: material reciclado, cartulina, tabletas, botellas"/></label>
      </div>
    </div>}

    {step===4&&!result&&<div className="wizard-card wizard-review">
      <div className="wizard-card__title"><span><ClipboardList size={18}/></span><div><h4>Revisa antes de crear</h4><p>Kantu organizará el proyecto en {form.duracionSemanas} semana(s), nunca más de cuatro.</p></div></div>
      <div className="review-grid">
        <div><small>Docente</small><strong>{getTeacherFullName(profile)}</strong></div>
        <div><small>I.E.</small><strong>{profile.ie||"—"}</strong></div>
        <div><small>Nivel y grado</small><strong>{form.nivel} · {form.grado} {form.seccion}</strong></div>
        <div><small>Duración</small><strong>{form.duracionSemanas} semana(s)</strong></div>
        <div className="wide"><small>Situación significativa</small><p>{form.situacion}</p></div>
        <div className="wide"><small>Áreas STEAM</small><p>{form.areasSTEAM.join(" · ")}</p></div>
        <div className="wide"><small>Producto</small><p>{form.producto}</p></div>
      </div>
    </div>}

    {error&&<p className="wizard-error">{error}</p>}
    {!result&&<div className="wizard-actions">{step>1&&<button className="wizard-back" onClick={()=>setStep(s=>s-1)}>Anterior</button>}{step<4?<button className="wizard-next" onClick={next}>Continuar <ArrowRight size={15}/></button>:<button className="wizard-next" onClick={generate} disabled={loading}>{loading?<Loader2 size={16} className="animate-spin"/>:<Sparkles size={16}/>} {loading?"Kantu está creando...":"Generar proyecto STEAM"}</button>}</div>}

    {loading&&<div className="kantu-working"><div className="kantu-working__visual"><span className="kantu-orbit"><Sparkles size={15}/></span><img src="/mascot/kantu-material.png" alt="Kantu creando el proyecto"/></div><div className="kantu-working__copy"><small>KANTU ESTÁ TRABAJANDO</small><h4>Estoy organizando el proyecto por semanas…</h4><p>Relaciono la situación significativa, las áreas STEAM, las competencias y el producto final.</p><div className="kantu-progress"><i/><i/><i/></div></div></div>}

    {result&&<div className="project-result-v2">
      <header><div><small>PROYECTO STEAM GENERADO</small><h2>{result.titulo}</h2><p>{form.nivel} · {form.grado} · {form.duracionSemanas} semana(s)</p></div><button onClick={downloadProject}><Download size={16}/> Descargar Word</button></header>
      <div className="steam-result-tags">{form.areasSTEAM.map(a=><span key={a}>{a}</span>)}</div>
      <details open><summary>01 · Situación significativa</summary><p>{result.situacionSignificativa}</p></details>
      <details open><summary>02 · Reto del proyecto</summary><p>{result.reto}</p></details>
      <details><summary>03 · Integración STEAM</summary>{(result.integracionSTEAM||[]).map((x,i)=><div className="project-list-row" key={i}><strong>{x.area}</strong><p>{x.aporte}</p></div>)}</details>
      <details><summary>04 · Competencias CNEB</summary>{(result.competencias||[]).map((x,i)=><div className="project-list-row" key={i}><strong>{x.area}</strong><p>{x.competencia}</p></div>)}</details>
      <details><summary>05 · Producto y evidencias</summary><p><strong>Producto:</strong> {result.productoEsperado}</p><ul>{(result.evidencias||[]).map((e,i)=><li key={i}>{e}</li>)}</ul></details>
      <details open><summary>06 · Ruta de {form.duracionSemanas} semana(s)</summary><div className="project-week-grid">{(result.rutaSemanas||[]).map((w,i)=><article key={i}><small>SEMANA {i+1}</small><h4>{w.titulo}</h4><p>{w.proposito}</p><ul>{(w.actividades||[]).map((a,j)=><li key={j}>{a}</li>)}</ul><strong>Evidencia</strong><p>{w.evidencia}</p></article>)}</div></details>
      <details><summary>07 · Sesiones del proyecto</summary><div className="project-session-list">{(result.sesiones||[]).map((s,i)=><article key={i}><span>{i+1}</span><div><h4>{s.titulo}</h4><p><strong>Competencia:</strong> {s.competencia}</p><p>{s.actividadCentral}</p><p><strong>Evidencia:</strong> {s.evidencia}</p><p><strong>Instrumento:</strong> {s.instrumento}</p></div></article>)}</div></details>
    </div>}
  </div>;
}

function ResourceFromAI({ kind, initialGrade="primaria", profile={} }) {
  const isReading=kind==="reading";
  const [form,setForm]=useState({nivel:initialGrade==="secundaria"?"Secundaria":"Primaria",grado:initialGrade==="secundaria"?"2.º":"4.º",area:isReading?"Comunicación":"Ciencia y Tecnología",tema:"",proposito:"",contexto:""});
  const [loading,setLoading]=useState(false);const [resource,setResource]=useState(null);const [error,setError]=useState("");
  const grades=form.nivel==="Primaria"?["1.º","2.º","3.º","4.º","5.º","6.º"]:["1.º","2.º","3.º","4.º","5.º"];
  const update=(key,value)=>setForm(prev=>({...prev,[key]:value}));
  async function generate(){
    if(!form.tema.trim())return setError("Escribe el tema del material.");
    setLoading(true);setError("");setResource(null);
    try{
      const {data:{session}}=await supabase.auth.getSession();
      const type=isReading?"reading":"worksheet";
      const response=await fetch("/api/generate-session-resource",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session?.access_token||""}`},body:JSON.stringify({type,form:{...form,competencia:"",capacidades:[],evidencia:"",region:""},options:{readingLength:"media"}})});
      const data=await response.json();if(!response.ok)throw new Error(data.error||"No se pudo generar el material.");
      setResource(data.resource);
      try{await saveTeacherMaterial({tipo:type,titulo:data.resource.titulo||form.tema,form:{...form,tema:form.tema},contenido:data.resource});}catch(e){console.error(e);}
    }catch(e){setError(e.message);}finally{setLoading(false);}
  }
  function resourceText(){
    if(isReading){
      const grouped={literal:[],inferencial:[],critico:[]};(resource.preguntas||[]).forEach(q=>(grouped[q.nivel]||grouped.critico).push(q.pregunta));
      return `FICHA DE LECTURA

Nombre y apellidos: ______________________________
Institución educativa: ____________________________
Grado y sección: __________________  Fecha: _______
Área / curso: ${form.area}

Título del texto: ${resource.titulo}
Autor(a) / fuente: Texto original generado con Kantu

TEXTO DE LECTURA
${resource.texto}

NIVEL LITERAL
${grouped.literal.map((q,i)=>`${i+1}. ${q}\n__________________________________________________`).join("\n")}

NIVEL INFERENCIAL
${grouped.inferencial.map((q,i)=>`${i+1}. ${q}\n__________________________________________________`).join("\n")}

NIVEL CRÍTICO
${grouped.critico.map((q,i)=>`${i+1}. ${q}\n__________________________________________________`).join("\n")}

NIVEL REFLEXIVO
1. ¿Cómo relacionas lo leído con una experiencia de tu vida?
__________________________________________________
2. ¿Qué enseñanza del texto podrías aplicar en tu entorno?
__________________________________________________`;
    }
    const questions=(resource.secciones||[]).flatMap(s=>(s.actividades||[]).filter(a=>["pregunta","respuesta_larga"].includes(a.tipo)).map(a=>a.texto)).slice(0,8);
    return `FICHA DE TRABAJO · PREGUNTAS Y RESPUESTAS

Nombre y apellidos: ______________________________
Institución educativa: ____________________________
Grado y sección: __________________  Área / tema: ${form.area} / ${form.tema}
Fecha: ____ / ____ / ____

Instrucciones: Lee cada pregunta con atención y responde de forma clara y completa.

${Array.from({length:8},(_,i)=>`${String(i+1).padStart(2,"0")} ${questions[i]||`Pregunta sobre ${form.tema}`}\n__________________________________________________\n__________________________________________________`).join("\n\n")}`;
  }
  return <div className="resource-ai-v2">
    {!resource?<div className="wizard-card"><div className="wizard-card__title"><span>{isReading?<BookOpen size={18}/>:<FileText size={18}/>}</span><div><h4>{isReading?"Ficha de lectura":"Ficha de trabajo"}</h4><p>{isReading?"Genera una lectura original con preguntas por niveles de comprensión.":"Genera una ficha de preguntas y respuestas lista para tus estudiantes."}</p></div></div><div className="wizard-fields">
      <label>Nivel *<select value={form.nivel} onChange={e=>setForm(prev=>({...prev,nivel:e.target.value,grado:"1.º"}))}><option>Primaria</option><option>Secundaria</option></select></label>
      <label>Grado *<select value={form.grado} onChange={e=>update("grado",e.target.value)}>{grades.map(g=><option key={g}>{g}</option>)}</select></label>
      <label className="wide">Área curricular *<select value={form.area} onChange={e=>update("area",e.target.value)}>{GENERATOR_AREAS.map(a=><option key={a}>{a}</option>)}</select></label>
      <label className="wide">Tema *<input value={form.tema} onChange={e=>update("tema",e.target.value)} placeholder={isReading?"Ej.: Las festividades de mi comunidad":"Ej.: El ciclo del agua"}/></label>
      <label className="wide">Contexto o indicación adicional<textarea value={form.contexto} onChange={e=>update("contexto",e.target.value)} placeholder="Opcional: contexto rural, festividad, situación del aula..."/></label>
    </div>{error&&<p className="wizard-error">{error}</p>}<div className="wizard-actions"><button className="wizard-next" onClick={generate} disabled={loading}>{loading?<Loader2 size={16} className="animate-spin"/>:<Sparkles size={16}/>} {loading?"Kantu está creando...":"Generar con Kantu"}</button></div></div>
    :<div className="instrument-result"><div className="instrument-result__actions"><div><small>{isReading?"FICHA DE LECTURA":"FICHA DE TRABAJO"}</small><h3>{resource.titulo}</h3></div><div><button onClick={()=>setResource(null)}>← Crear otra</button><button className="primary" onClick={()=>downloadWord(`${isReading?"ficha-lectura":"ficha-trabajo"}.docx`,resourceText(),resource.titulo)}><Download size={14}/> Word</button></div></div><pre className="resource-document-preview">{resourceText()}</pre></div>}
  </div>;
}

function ValuationScaleGenerator({initialGrade="primaria",profile={}}){
  const initialLevel=initialGrade==="secundaria"?"Secundaria":"Primaria";
  const [form,setForm]=useState({nivel:initialLevel,grado:initialLevel==="Primaria"?"4.º":"2.º",area:"Ciencia y Tecnología",tema:"",competencia:CNEB.indaga,capacidades:GENERATOR_CAPACITIES[CNEB.indaga],evidencia:"",region:""});
  const [resource,setResource]=useState(null);const[loading,setLoading]=useState(false);const[error,setError]=useState("");
  const grades=form.nivel==="Primaria"?["1.º","2.º","3.º","4.º","5.º","6.º"]:["1.º","2.º","3.º","4.º","5.º"];
  const update=(key,value)=>setForm(prev=>({...prev,[key]:value}));
  function changeArea(area){const competencia=GENERATOR_COMPETENCIES[area][0];setForm(prev=>({...prev,area,competencia,capacidades:GENERATOR_CAPACITIES[competencia]||[]}));}
  function changeCompetence(competencia){setForm(prev=>({...prev,competencia,capacidades:GENERATOR_CAPACITIES[competencia]||[]}));}
  async function generate(){
    if(!form.tema.trim()||!form.region||!form.evidencia.trim())return setError("Completa tema, región y evidencia.");
    setLoading(true);setError("");
    try{
      const {data:{session}}=await supabase.auth.getSession();
      const response=await fetch("/api/generate-session-resource",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session?.access_token||""}`},body:JSON.stringify({type:"rating_scale",form,options:{numeroCriterios:2,scaleType:"frecuencia"}})});
      const data=await response.json();if(!response.ok)throw new Error(data.error||"No se pudo generar la escala.");setResource(data.resource);
      try{await saveTeacherMaterial({tipo:"rating_scale",titulo:data.resource.titulo||form.tema,form,contenido:data.resource});}catch(e){console.error(e);}
    }catch(e){setError(e.message);}finally{setLoading(false);}
  }
  function text(){
    const c=(resource.criterios||[]).slice(0,2);
    return `ESCALA DE VALORACIÓN · REGISTRO DE AULA

Institución educativa / Docente: ${profile.ie||""} / ${getTeacherFullName(profile)}
Grado y sección: ${form.grado} __________________
Área: ${form.area}
Competencia: ${form.competencia}

Escala: SIEMPRE · A VECES · NO LO HACE · NO OBSERVADO

CRITERIO 1
${c[0]?.criterio||""}

CRITERIO 2
${c[1]?.criterio||""}

N.º | APELLIDOS Y NOMBRES | SIEMPRE | A VECES | NO LO HACE | NO OBSERVADO | SIEMPRE | A VECES | NO LO HACE | NO OBSERVADO
${Array.from({length:25},(_,i)=>`${i+1}. | ______________________________ | ___ | ___ | ___ | ___ | ___ | ___ | ___ | ___`).join("\n")}`;
  }
  return <div>{!resource?<div className="wizard-card"><div className="wizard-card__title"><span><ListChecks size={18}/></span><div><h4>Escala de valoración</h4><p>Genera criterios observables para el registro de aula.</p></div></div><div className="wizard-fields">
    <label>Nivel<select value={form.nivel} onChange={e=>setForm(prev=>({...prev,nivel:e.target.value,grado:"1.º"}))}><option>Primaria</option><option>Secundaria</option></select></label>
    <label>Grado<select value={form.grado} onChange={e=>update("grado",e.target.value)}>{grades.map(g=><option key={g}>{g}</option>)}</select></label>
    <label className="wide">Región *<select value={form.region} onChange={e=>update("region",e.target.value)}><option value="">Selecciona una región</option>{PERU_REGIONS.map(r=><option key={r}>{r}</option>)}</select></label>
    <label className="wide">Área<select value={form.area} onChange={e=>changeArea(e.target.value)}>{GENERATOR_AREAS.map(a=><option key={a}>{a}</option>)}</select></label>
    <label className="wide">Tema *<input value={form.tema} onChange={e=>update("tema",e.target.value)}/></label>
    <label className="wide">Competencia<select value={form.competencia} onChange={e=>changeCompetence(e.target.value)}>{GENERATOR_COMPETENCIES[form.area].map(c=><option key={c}>{c}</option>)}</select></label>
    <label className="wide">Evidencia *<textarea value={form.evidencia} onChange={e=>update("evidencia",e.target.value)}/></label>
  </div>{error&&<p className="wizard-error">{error}</p>}<div className="wizard-actions"><button className="wizard-next" onClick={generate} disabled={loading}>{loading?<Loader2 size={16} className="animate-spin"/>:<Sparkles size={16}/>} Generar escala</button></div></div>:<div className="instrument-result"><div className="instrument-result__actions"><div><small>ESCALA DE VALORACIÓN</small><h3>{resource.titulo}</h3></div><div><button onClick={()=>setResource(null)}>← Crear otra</button><button className="primary" onClick={()=>downloadWord("escala-de-valoracion.docx",text(),resource.titulo)}><Download size={14}/> Word</button></div></div><pre className="resource-document-preview">{text()}</pre></div>}</div>;
}

function CompleteClassIntro({onStart}){
  return <div className="complete-class-intro">
    <div className="complete-flow-heading"><span><Sparkles size={14}/> KANTU TE ACOMPAÑA</span><h2>Crea tu clase completa</h2><p>En un solo recorrido prepararás tu sesión de aprendizaje, un instrumento de evaluación y un material para estudiantes.</p></div>
    <div className="complete-flow-cards">
      <article><span>01</span><BookOpen size={25}/><h3>Sesión de aprendizaje</h3><p>Propósito, competencia, capacidades, criterios y secuencia didáctica.</p></article>
      <article><span>02</span><ClipboardList size={25}/><h3>Instrumento de evaluación</h3><p>Rúbrica o lista de cotejo vinculada a la evidencia de la sesión.</p></article>
      <article><span>03</span><FileText size={25}/><h3>Material</h3><p>Ficha o recurso listo para trabajar con tus estudiantes.</p></article>
    </div>
    <button className="complete-start" onClick={onStart}>Empezar por la sesión <ArrowRight size={16}/></button>
  </div>;
}
`;

app = mustReplace(
  app,
  'function CreateStudio({ preferredGrade = "primaria", profile = {} }) {',
  generatorsV2 + '\nfunction CreateStudio({ preferredGrade = "primaria", profile = {}, initialCreation = null, onInitialCreationConsumed = ()=>{} }) {',
  "insertar generadores V2"
);

// ---------------------------------------------------------------------
// 3) Reemplazar CreateStudio completo
// ---------------------------------------------------------------------
const studioRegex = /function CreateStudio\(\{ preferredGrade = "primaria", profile = \{\}, initialCreation = null, onInitialCreationConsumed = \(\)=>\{\} \}\) \{[\s\S]*?\n\}\n\n\/\* ---------------------------------------------------------------------- \*\/\n\/\* REGISTRO DE DOCENTES/;

const newStudio = String.raw`function CreateStudio({ preferredGrade = "primaria", profile = {}, initialCreation = null, onInitialCreationConsumed = ()=>{} }) {
  const [creation,setCreation]=useState(initialCreation);
  const [category,setCategory]=useState(null);

  useEffect(()=>{
    if(initialCreation){setCreation(initialCreation);setCategory(null);onInitialCreationConsumed();}
  },[initialCreation]);

  const catalog={
    fichas:{
      title:"Fichas",
      icon:FileText,
      desc:"Materiales para que tus estudiantes practiquen, respondan y comprendan.",
      items:[
        {id:"worksheet-v2",label:"Ficha de trabajo",desc:"Preguntas y respuestas listas para imprimir.",icon:FileText},
        {id:"reading-v2",label:"Ficha de lectura",desc:"Texto original y preguntas literal, inferencial, crítica y reflexiva.",icon:BookOpen},
      ]
    },
    juegos:{
      title:"Juegos",
      icon:Gamepad2,
      desc:"Recursos lúdicos para repasar contenidos y motivar la participación.",
      items:[
        {id:"wordsearch",label:"Sopa de letras",desc:"Juego de palabras escondidas con solucionario.",icon:Search},
        {id:"crossword",label:"Crucigrama",desc:"Crea pistas para reforzar conceptos clave.",icon:Layers},
      ]
    },
    instrumentos:{
      title:"Instrumentos",
      icon:ClipboardList,
      desc:"Evalúa con criterios observables y formatos para el registro de aula.",
      items:[
        {id:"rubric",label:"Rúbrica de evaluación",desc:"Criterios con niveles de desempeño.",icon:ClipboardList},
        {id:"rating-scale",label:"Escala de valoración",desc:"Siempre · A veces · No lo hace · No observado.",icon:ListChecks},
        {id:"checklist",label:"Lista de cotejo",desc:"Verificación rápida de criterios observables.",icon:CheckCircle2},
      ]
    },
    planificacion:{
      title:"Planificación",
      icon:CalendarDays,
      desc:"Diseña experiencias de mayor duración alineadas al CNEB.",
      items:[
        {id:"project-v2",label:"Proyecto STEAM",desc:"Proyecto interdisciplinario organizado entre 1 y 4 semanas.",icon:Cog},
      ]
    }
  };

  const allItems=Object.values(catalog).flatMap(x=>x.items);
  const selected=allItems.find(x=>x.id===creation);

  function openCategory(key){setCategory(key);setCreation(null);}
  function back(){if(creation){setCreation(null);return;}setCategory(null);}

  return <div className="create-studio create-studio-v2">
    {!creation&&!category&&<>
      <div className="create-studio__intro compact-create-intro">
        <div><span className="create-studio__eyebrow"><Sparkles size={13}/> KANTU TE ACOMPAÑA</span><h2>¿Qué quieres crear?</h2><p>Selecciona una categoría. Todo lo que generes se guardará en tu biblioteca.</p></div>
        <div className="create-studio__nova"><img src="/mascot/kantu-material.png" alt="Kantu"/><span><strong>Kantu te guía</strong><small>Te acompaño paso a paso</small></span></div>
      </div>
      <div className="creation-category-grid">
        {Object.entries(catalog).map(([key,item])=>{const Icon=item.icon;return <button key={key} onClick={()=>openCategory(key)}><span><Icon size={26}/></span><h3>{item.title}</h3><p>{item.desc}</p><b>Explorar <ArrowRight size={14}/></b></button>})}
      </div>
    </>}

    {!creation&&category&&<div>
      <div className="create-generator-head"><div><span>CATEGORÍA</span><h3>{catalog[category].title}</h3><p>{catalog[category].desc}</p></div><button onClick={back}>← Volver a categorías</button></div>
      <div className="creation-type-grid creation-type-grid-v2">{catalog[category].items.map(({id,label,desc,icon:Icon})=><button key={id} className="creation-type-card teal" onClick={()=>setCreation(id)}><span><Icon size={22}/></span><div><small>CREAR CON KANTU</small><h3>{label}</h3><p>{desc}</p><b>Comenzar <ArrowRight size={15}/></b></div></button>)}</div>
    </div>}

    {creation&&<div className="create-generator-wrap">
      <div className="create-generator-head"><div><span>CREANDO CON KANTU</span><h3>{creation==="complete"?"Clase completa":selected?.label}</h3><p>{creation==="complete"?"Sesión + instrumento + material en un mismo recorrido.":selected?.desc}</p></div><button onClick={()=>{setCreation(null);setCategory(null)}}>← Elegir otro producto</button></div>
      {creation==="complete"?<CompleteClassIntro onStart={()=>setCreation("session")}/>
      :creation==="session"?<SteamGenerator initialGrade={preferredGrade} documentType="session" profile={profile}/>
      :creation==="project-v2"?<ProjectSteamGenerator initialGrade={preferredGrade} profile={profile}/>
      :creation==="worksheet-v2"?<ResourceFromAI kind="worksheet" initialGrade={preferredGrade} profile={profile}/>
      :creation==="reading-v2"?<ResourceFromAI kind="reading" initialGrade={preferredGrade} profile={profile}/>
      :creation==="rating-scale"?<ValuationScaleGenerator initialGrade={preferredGrade} profile={profile}/>
      :(creation==="rubric"||creation==="checklist")?<EvaluationInstrumentGenerator profile={profile} initialGrade={preferredGrade} instrumentType={creation}/>
      :creation==="wordsearch"?<WordSearchGenerator initialGrade={preferredGrade} profile={profile}/>
      :creation==="crossword"?<CrosswordGenerator initialGrade={preferredGrade} profile={profile}/>
      :null}
    </div>}
  </div>;
}

/* ---------------------------------------------------------------------- */
/* REGISTRO DE DOCENTES`;

if (!studioRegex.test(app)) throw new Error("No encontré el bloque CreateStudio para reemplazar.");
app = app.replace(studioRegex, newStudio);

// ---------------------------------------------------------------------
// 4) Estado para abrir el estudio desde el dashboard
// ---------------------------------------------------------------------
app = mustReplace(
  app,
  '  const [activeSection, setActiveSection] = useState("inicio");',
  '  const [activeSection, setActiveSection] = useState("inicio");\n  const [createEntry, setCreateEntry] = useState(null);\n  const openCreate = (entry=null) => { setCreateEntry(entry); setActiveSection("crear"); };',
  "estado createEntry"
);

// ---------------------------------------------------------------------
// 5) Dashboard principal V2
// ---------------------------------------------------------------------
const dashboardRegex = /\{activeSection === "inicio" && <section id="inicio-docente" className="teacher-dashboard">[\s\S]*?<\/section>\}\n\n      \{activeSection === "actividades"/;

const dashboardV2 = String.raw`{activeSection === "inicio" && <section id="inicio-docente" className="teacher-dashboard sciverse-home-v2">
        <div className="home-v2-heading">
          <small>HOLA, {(profile.nombres||"DOCENTE").toUpperCase()}</small>
          <h1>Todo para <span>planificar</span> tu clase</h1>
          <p><ShieldCheck size={14}/> Alineado al CNEB del MINEDU</p>
        </div>

        <article className="complete-class-banner">
          <div className="complete-class-visual"><span><BookOpen size={28}/></span><span><ClipboardList size={28}/></span><span><FileText size={28}/></span></div>
          <div className="complete-class-copy"><h2>Crea tu clase completa</h2><p>Genera tu sesión de aprendizaje, un instrumento de evaluación y materiales listos para usar.</p><div><span><BookOpen size={13}/> Sesión de aprendizaje</span><span><ClipboardList size={13}/> Instrumento de evaluación</span><span><FileText size={13}/> Materiales</span></div></div>
          <button onClick={()=>openCreate("complete")}>Crear clase completa <ArrowRight size={16}/></button>
          <img src="/mascot/kantu-material.png" alt="Kantu"/>
        </article>

        <div className="home-v2-section-title"><h2>Explora lo que puedes crear</h2><span/></div>

        <div className="home-v2-categories">
          <button onClick={()=>openCreate("worksheet-v2")}><span className="cat-illustration"><FileText size={31}/></span><h3>Fichas</h3><p>Crea fichas de trabajo y fichas de lectura para tus estudiantes.</p><b>Crear fichas <ArrowRight size={14}/></b></button>
          <button onClick={()=>openCreate("wordsearch")}><span className="cat-illustration"><Gamepad2 size={31}/></span><h3>Juegos</h3><p>Sopa de letras y crucigramas para aprender jugando.</p><b>Crear juegos <ArrowRight size={14}/></b></button>
          <button onClick={()=>openCreate("rubric")}><span className="cat-illustration"><ClipboardList size={31}/></span><h3>Instrumentos</h3><p>Rúbricas, escalas de valoración y listas de cotejo.</p><b>Crear instrumentos <ArrowRight size={14}/></b></button>
          <button onClick={()=>openCreate("project-v2")}><span className="cat-illustration"><CalendarDays size={31}/></span><h3>Planificación</h3><p>Diseña proyectos STEAM alineados al CNEB paso a paso.</p><b>Crear proyecto STEAM <ArrowRight size={14}/></b></button>
        </div>

        <div className="home-kantu-help"><span><img src="/mascot/kantu-material.png" alt="Kantu"/></span><div><strong>¿Necesitas ideas o ayuda?</strong><p>Kantu está aquí para acompañarte en cada paso de tu planificación.</p></div><button onClick={()=>openCreate(null)}><MessageCircle size={15}/> Pregúntale a Kantu</button></div>
      </section>}

      {activeSection === "actividades"`;

if (!dashboardRegex.test(app)) throw new Error("No encontré el dashboard actual para reemplazar.");
app = app.replace(dashboardRegex, dashboardV2);

// ---------------------------------------------------------------------
// 6) Conectar CreateStudio con la selección del dashboard
// ---------------------------------------------------------------------
app = mustReplace(
  app,
  '<CreateStudio preferredGrade={preferredGrade} profile={profile} />',
  '<CreateStudio preferredGrade={preferredGrade} profile={profile} initialCreation={createEntry} onInitialCreationConsumed={()=>setCreateEntry(null)} />',
  "CreateStudio con entrada inicial"
);

fs.writeFileSync(appPath, app);

// ---------------------------------------------------------------------
// 7) CSS V2
// ---------------------------------------------------------------------
let css=fs.readFileSync(cssPath,"utf8");
const cssMarker="/* SCIVERSE HOME V2 — 2026-08-27 */";
if(!css.includes(cssMarker)){
css += String.raw`

/* SCIVERSE HOME V2 — 2026-08-27 */
.sciverse-home-v2{max-width:1480px;margin:0 auto;padding:38px 34px 52px}
.home-v2-heading small{font:700 11px/1 'Inter',sans-serif;letter-spacing:.16em;color:#6c807e}
.home-v2-heading h1{margin:10px 0 10px;font:700 clamp(30px,3.2vw,48px)/1.08 'Space Grotesk',sans-serif;color:#103c37}
.home-v2-heading h1 span{color:#129b69}
.home-v2-heading>p{display:inline-flex;align-items:center;gap:6px;margin:0;color:#168b63;background:#e8f7f0;border-radius:999px;padding:7px 11px;font-size:12px;font-weight:700}
.complete-class-banner{position:relative;display:grid;grid-template-columns:220px 1fr auto;align-items:center;gap:25px;margin-top:24px;padding:30px 38px;border:1px solid #dcece6;border-radius:22px;background:linear-gradient(115deg,#effaf5 0%,#f8fcfa 65%,#eefaf5 100%);box-shadow:0 18px 42px rgba(20,74,62,.09);overflow:hidden}
.complete-class-banner>img{position:absolute;right:28px;bottom:-22px;width:105px;opacity:.96;pointer-events:none}
.complete-class-visual{display:flex;align-items:center;justify-content:center}
.complete-class-visual span{display:grid;place-items:center;width:76px;height:92px;margin-left:-20px;border-radius:13px;background:#fff;color:#148b63;border:1px solid #dcece6;box-shadow:0 10px 25px rgba(20,74,62,.1);transform:rotate(-5deg)}
.complete-class-visual span:nth-child(2){transform:translateY(-8px);color:#3277d6;z-index:2}
.complete-class-visual span:nth-child(3){transform:rotate(6deg);color:#e99b12}
.complete-class-copy{padding-right:105px}
.complete-class-copy h2{margin:0 0 8px;font:700 28px/1.1 'Space Grotesk',sans-serif;color:#135845}
.complete-class-copy>p{max-width:680px;margin:0 0 15px;color:#5b7470;font-size:14px;line-height:1.6}
.complete-class-copy>div{display:flex;gap:8px;flex-wrap:wrap}
.complete-class-copy>div span{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:6px 9px;background:#fff;color:#27745e;font-size:11px;font-weight:700;border:1px solid #d9ebe4}
.complete-class-banner>button{z-index:2;margin-right:80px;display:inline-flex;align-items:center;gap:9px;border:0;border-radius:999px;background:#07985f;color:#fff;padding:15px 26px;font-weight:800;box-shadow:0 10px 28px rgba(0,142,87,.24);white-space:nowrap}
.home-v2-section-title{display:flex;align-items:center;gap:15px;margin:28px 0 16px}
.home-v2-section-title h2{margin:0;font:700 20px/1 'Space Grotesk',sans-serif;color:#174d42}
.home-v2-section-title span{height:1px;background:#dce8e4;flex:1}
.home-v2-categories{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}
.home-v2-categories>button{display:flex;flex-direction:column;align-items:center;text-align:center;min-height:282px;padding:24px 20px 20px;background:#fff;border:1px solid #e0ebe7;border-radius:18px;box-shadow:0 12px 30px rgba(23,72,62,.08);transition:.2s ease}
.home-v2-categories>button:hover{transform:translateY(-3px);border-color:#b9ddcf;box-shadow:0 16px 34px rgba(23,72,62,.13)}
.cat-illustration{display:grid;place-items:center;width:100px;height:100px;border-radius:50%;margin-bottom:15px;background:linear-gradient(145deg,#eaf8f2,#f9fcfb);color:#118d61}
.home-v2-categories button:nth-child(2) .cat-illustration{background:linear-gradient(145deg,#fff8da,#f9fcfb);color:#e8a113}
.home-v2-categories button:nth-child(3) .cat-illustration{background:linear-gradient(145deg,#e9f0ff,#f9fcfb);color:#2e72c8}
.home-v2-categories button:nth-child(4) .cat-illustration{background:linear-gradient(145deg,#eaf8f2,#fff9df);color:#128c5f}
.home-v2-categories h3{margin:0 0 8px;font:700 18px 'Space Grotesk',sans-serif;color:#123f37}
.home-v2-categories p{margin:0;color:#657975;font-size:13px;line-height:1.55;min-height:61px}
.home-v2-categories b{display:inline-flex;gap:6px;align-items:center;margin-top:auto;color:#078b59;font-size:12px}
.home-kantu-help{display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:center;margin-top:18px;padding:18px 22px;border:1px solid #dfece7;border-radius:18px;background:linear-gradient(90deg,#f4fbf8,#fff)}
.home-kantu-help img{width:52px}.home-kantu-help strong{display:block;color:#15513f}.home-kantu-help p{margin:4px 0 0;color:#617773;font-size:13px}
.home-kantu-help button{display:inline-flex;align-items:center;gap:7px;border:1px solid #8ccdb4;border-radius:13px;background:#fff;color:#087b51;padding:11px 16px;font-weight:700}
.creation-category-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-top:22px}
.creation-category-grid>button{padding:24px;border:1px solid #deebe6;border-radius:18px;background:#fff;text-align:left;box-shadow:0 10px 25px rgba(18,75,61,.06)}
.creation-category-grid>button>span{display:grid;place-items:center;width:50px;height:50px;border-radius:14px;background:#edf8f4;color:#0c8b5d}
.creation-category-grid h3{margin:16px 0 7px;color:#13493d;font:700 19px 'Space Grotesk',sans-serif}
.creation-category-grid p{color:#687d78;font-size:13px;line-height:1.5;min-height:60px}.creation-category-grid b{display:flex;align-items:center;gap:5px;color:#0b8c5c;font-size:12px}
.project-teacher-card{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px;padding:14px 16px;margin-bottom:18px;border-radius:15px;background:#eef9f4;border:1px solid #d4ecdf;color:#126b4b}
.project-avatar{display:grid;place-items:center;width:42px;height:42px;border-radius:50%;background:#0d9160;color:#fff;font-weight:800}
.project-teacher-card small,.project-teacher-card strong,.project-teacher-card p{display:block;margin:0}.project-teacher-card small{font-size:10px;letter-spacing:.1em}.project-teacher-card p{font-size:12px;color:#5a746c;margin-top:3px}
.steam-area-picker{display:grid!important;grid-template-columns:repeat(5,1fr)!important;gap:8px!important;padding:13px!important;border:1px solid #d8e7e2!important;border-radius:13px!important}
.steam-area-picker legend{grid-column:1/-1;font-weight:700;color:#234e45}.steam-area-picker label{display:flex!important;align-items:center!important;justify-content:center!important;gap:7px!important;padding:11px 8px!important;border:1px solid #dce9e4!important;border-radius:10px!important;background:#fff!important}
.steam-area-picker label.selected{border-color:#46b88d!important;background:#eaf8f2!important;color:#087a51!important}
.project-result-v2{margin-top:22px}.project-result-v2>header{display:flex;justify-content:space-between;gap:20px;align-items:center;padding:20px;border-radius:18px;background:#0f5e49;color:#fff}.project-result-v2 header small{font-size:10px;letter-spacing:.12em}.project-result-v2 header h2{margin:5px 0;font:700 24px 'Space Grotesk',sans-serif}.project-result-v2 header p{margin:0;color:#c9eadf}.project-result-v2 header button{display:flex;align-items:center;gap:7px;background:#fff;color:#0f6e50;border:0;border-radius:11px;padding:11px 14px;font-weight:700}
.steam-result-tags{display:flex;gap:7px;flex-wrap:wrap;margin:12px 0}.steam-result-tags span{padding:6px 9px;background:#eaf8f2;border-radius:999px;color:#117652;font-size:11px;font-weight:700}
.project-result-v2 details{margin:9px 0;border:1px solid #dce9e4;border-radius:14px;background:#fff;overflow:hidden}.project-result-v2 summary{cursor:pointer;padding:15px 17px;color:#164e40;font-weight:800}.project-result-v2 details>p,.project-result-v2 details>ul,.project-result-v2 .project-list-row{margin:0;padding:0 17px 16px;color:#5c716c;font-size:13px;line-height:1.55}
.project-list-row strong{color:#15503e}.project-list-row p{margin:4px 0}
.project-week-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;padding:0 15px 15px}.project-week-grid article{padding:15px;border-radius:12px;background:#f4faf7;border:1px solid #dcece5}.project-week-grid small{color:#078759;font-weight:800}.project-week-grid h4{margin:5px 0;color:#173f37}.project-week-grid p,.project-week-grid li{font-size:12px;color:#62736f}
.project-session-list{padding:0 15px 15px}.project-session-list article{display:grid;grid-template-columns:34px 1fr;gap:10px;border-bottom:1px solid #e5ece9;padding:12px 0}.project-session-list article>span{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:#e7f6ef;color:#087a50;font-weight:800}.project-session-list h4{margin:0 0 6px;color:#17493e}.project-session-list p{margin:3px 0;color:#63746f;font-size:12px}
.resource-document-preview{white-space:pre-wrap;max-height:650px;overflow:auto;padding:25px;border:1px solid #dfe8e5;border-radius:12px;background:#fff;color:#2c4540;font:13px/1.65 "Inter",sans-serif}
.complete-class-intro{text-align:center;padding:12px 0 25px}.complete-flow-heading span{display:inline-flex;gap:6px;align-items:center;color:#07885a;font-size:11px;font-weight:800}.complete-flow-heading h2{margin:10px 0 7px;font:700 30px 'Space Grotesk',sans-serif;color:#124a3d}.complete-flow-heading p{margin:0 auto;color:#647a75;max-width:700px}
.complete-flow-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:25px 0}.complete-flow-cards article{position:relative;text-align:left;padding:22px;border-radius:16px;border:1px solid #dceae5;background:#fff}.complete-flow-cards article>span{position:absolute;right:15px;top:13px;color:#b7c8c3;font-size:12px;font-weight:800}.complete-flow-cards svg{color:#0a8b5a}.complete-flow-cards h3{margin:12px 0 6px;color:#164b3f}.complete-flow-cards p{color:#667a76;font-size:12px;line-height:1.5}
.complete-start{display:inline-flex;gap:7px;align-items:center;border:0;border-radius:999px;background:#078c5a;color:#fff;padding:13px 22px;font-weight:800}
@media(max-width:1050px){.home-v2-categories,.creation-category-grid{grid-template-columns:repeat(2,1fr)}.complete-class-banner{grid-template-columns:150px 1fr}.complete-class-banner>button{grid-column:2;margin-right:0;justify-self:start}.complete-class-copy{padding-right:60px}}
@media(max-width:720px){.sciverse-home-v2{padding:24px 16px 95px}.home-v2-categories,.creation-category-grid,.project-week-grid,.complete-flow-cards{grid-template-columns:1fr}.complete-class-banner{grid-template-columns:1fr;padding:22px}.complete-class-visual{display:none}.complete-class-copy{padding-right:0}.complete-class-banner>button{grid-column:1;margin:0}.complete-class-banner>img{display:none}.home-kantu-help{grid-template-columns:auto 1fr}.home-kantu-help button{grid-column:1/-1}.steam-area-picker{grid-template-columns:1fr 1fr!important}}
`;
}
fs.writeFileSync(cssPath,css);

// ---------------------------------------------------------------------
// 8) API de Proyecto STEAM
// ---------------------------------------------------------------------
const projectApi = String.raw`
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
`;
fs.mkdirSync("api",{recursive:true});
fs.writeFileSync(projectApiPath,projectApi);

console.log("✅ SciVerse V2 aplicado correctamente.");
console.log("Archivos modificados:");
console.log(" - App.jsx");
console.log(" - index.css");
console.log(" - api/generate-project-steam.js");
console.log("");
console.log("Ahora ejecuta: npm run build");
