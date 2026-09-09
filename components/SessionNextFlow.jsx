// components/SessionNextFlow.jsx
import React,{useMemo,useState} from "react";
import {
  ArrowLeft,ArrowRight,ClipboardCheck,ListChecks,Eye,Gauge,
  FileText,BookOpen,HelpCircle,Sparkles,Loader2,Download,
  CheckCircle2,X
} from "lucide-react";
import { downloadResource as downloadWord } from "../lib/docx/exporters.js";
import {supabase} from "../supabaseClient.js";
import "../session-next-flow.css";

const META={
  rubric:{group:"instrument",label:"Rúbrica",desc:"Descriptores progresivos AD, A, B y C.",icon:ClipboardCheck,db:"rubric"},
  checklist:{group:"instrument",label:"Lista de cotejo",desc:"Criterios con Sí, No y Observaciones.",icon:ListChecks,db:"checklist"},
  observation_guide:{group:"instrument",label:"Guía de observación",desc:"Indicadores para observar actuaciones y desempeños.",icon:Eye,db:"observation_guide"},
  rating_scale:{group:"instrument",label:"Escala de valoración",desc:"Nivel de logro o frecuencia.",icon:Gauge,db:"rating_scale"},
  worksheet:{group:"material",label:"Ficha de trabajo",desc:"Anexo listo para que el estudiante desarrolle.",icon:FileText,db:"worksheet"},
  reading:{group:"material",label:"Lectura",desc:"Texto original con comprensión y vocabulario.",icon:BookOpen,db:"reading"},
  questionnaire:{group:"material",label:"Cuestionario",desc:"Preguntas para clase o trabajo autónomo.",icon:HelpCircle,db:"questionnaire"}
};

export default function SessionNextFlow({session,form={},profile={},onBackToSession,onFinish,onUpgrade}){
  // Clave estable del intento: dos clics comparten la misma.
  const claveOp = useClaveDeOperacion("recurso");
  const [step,setStep]=useState("choice"); // choice | types | configure | result
  const [group,setGroup]=useState("");
  const [type,setType]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [resource,setResource]=useState(null);
  const [criteria,setCriteria]=useState(4);
  const [scaleType,setScaleType]=useState("logro");
  const [questionCount,setQuestionCount]=useState(8);
  const [readingLength,setReadingLength]=useState("media");

  const types=useMemo(()=>Object.entries(META).filter(([,m])=>m.group===group),[group]);

  function pickGroup(g){setGroup(g);setType("");setResource(null);setStep("types");}
  function pickType(t){setType(t);setResource(null);setStep("configure");}

  async function save(res){
    const {data:{user}}=await supabase.auth.getUser(); if(!user) return;
    const {error:e}=await supabase.from("materiales_docente").insert({
      user_id:user.id,tipo:META[type].db,titulo:res.titulo||META[type].label,
      nivel:form.nivel||null,grado:form.grado||null,area:form.area||null,
      tema:form.tema||session?.titulo||null,
      contenido:{resourceType:type,resource:res,sourceSessionTitle:session?.titulo||form.tema||""}
    });
    if(e) throw e;
    window.dispatchEvent(new CustomEvent("sciverse:material-created",{detail:{type}}));
  }

  async function generate(){
    setError("");setLoading(true);
    try{
      const {data:{session:auth}}=await supabase.auth.getSession();
      if(!auth?.access_token) throw new Error("Inicia sesión para continuar.");
      const r=await fetch("/api/generate-session-resource",{method:"POST",headers:cabecerasDeGeneracion(auth.access_token,claveOp.obtener()),body:JSON.stringify({
        type,session,form,profile,
        options:{numeroCriterios:criteria,scaleType,questionCount,readingLength}
      })});
      const d=await r.json();
      if(!r.ok){if(r.status===429&&onUpgrade)onUpgrade();throw new Error(mensajeDeRespuesta(d,"No se pudo generar"));}
      // El intento termino: la proxima generacion sera otra operacion.
      claveOp.renovar();
      setResource(d.resource);await save(d.resource);window.dispatchEvent(new CustomEvent("sciverse:credit-used",{detail:d._credits}));setStep("result");
    }catch(e){setError(e?.message||"No se pudo generar");}finally{setLoading(false);}
  }

  return <section className="snf">
    <div className="snf-top">
      <button className="snf-back" onClick={()=>{
        if(step==="choice"){onBackToSession?.();return;}
        if(step==="types"){setStep("choice");return;}
        if(step==="configure"){setStep("types");return;}
        if(step==="result"){setStep("configure");}
      }}><ArrowLeft size={17}/> Atrás</button>
      <div className="snf-steps"><span className="done">1</span><i/> <span className="active">2</span><b>Recursos de la sesión</b></div>
    </div>

    {step==="choice"&&<div className="snf-choice">
      <div className="snf-title"><span><Sparkles size={15}/> SIGUIENTE PASO</span><h2>¿Qué quieres crear ahora?</h2><p>Usaremos automáticamente la información de la sesión que acabas de preparar.</p></div>
      <div className="snf-choice-grid">
        <button onClick={()=>pickGroup("instrument")}><div className="snf-big-icon"><ClipboardCheck size={34}/></div><h3>Instrumentos de evaluación</h3><p>Rúbrica, lista de cotejo, guía de observación y escala de valoración.</p><strong>Elegir instrumento <ArrowRight size={16}/></strong></button>
        <button onClick={()=>pickGroup("material")}><div className="snf-big-icon material"><FileText size={34}/></div><h3>Material / Anexos</h3><p>Ficha de trabajo, lectura y cuestionario para tus estudiantes.</p><strong>Elegir material <ArrowRight size={16}/></strong></button>
      </div>
      <button className="snf-skip" onClick={()=>onFinish?.()}>Omitir y volver a la sesión</button>
    </div>}

    {step==="types"&&<div>
      <div className="snf-title"><span>{group==="instrument"?"EVALUACIÓN":"MATERIALES"}</span><h2>{group==="instrument"?"Elige el instrumento que deseas crear":"Elige el anexo que necesitas"}</h2><p>Solo se consumirá 1 crédito cuando pulses Generar.</p></div>
      <div className={`snf-type-grid ${group==="instrument"?"four":""}`}>
        {types.map(([k,m],idx)=>{const I=m.icon;return <button key={k} onClick={()=>pickType(k)} className={idx===0?"suggested":""}>
          <div className="snf-type-icon"><I size={26}/></div><h3>{m.label}</h3><p>{m.desc}</p>{idx===0&&<small>Sugerido</small>}<span><ArrowRight size={16}/></span>
        </button>})}
      </div>
    </div>}

    {step==="configure"&&type&&<div className="snf-config">
      <div className="snf-title"><span>CONFIGURAR</span><h2>{META[type].label}</h2><p>La competencia, capacidades, propósito y evidencia se toman de la sesión.</p></div>
      <div className="snf-context">
        <div><small>ÁREA</small><strong>{form.area||"—"}</strong></div><div><small>GRADO</small><strong>{form.grado||"—"}</strong></div><div><small>EVIDENCIA</small><strong>{form.evidencia||session?.evidencia||"—"}</strong></div>
      </div>
      <div className="snf-config-box">
        {META[type].group==="instrument"&&<label>Número de criterios<select value={criteria} onChange={e=>setCriteria(Number(e.target.value))}>{[3,4,5,6,7,8].map(n=><option key={n}>{n}</option>)}</select></label>}
        {type==="rating_scale"&&<label>Tipo de escala<select value={scaleType} onChange={e=>setScaleType(e.target.value)}><option value="logro">Nivel de logro</option><option value="frecuencia">Frecuencia</option></select></label>}
        {type==="questionnaire"&&<label>Número de preguntas<select value={questionCount} onChange={e=>setQuestionCount(Number(e.target.value))}>{[5,6,8,10,12,15].map(n=><option key={n}>{n}</option>)}</select></label>}
        {type==="reading"&&<label>Extensión de lectura<select value={readingLength} onChange={e=>setReadingLength(e.target.value)}><option value="breve">Breve</option><option value="media">Media</option><option value="amplia">Amplia</option></select></label>}
        {type==="worksheet"&&<div className="snf-info">SciVerse elegirá automáticamente la estructura de ficha más pertinente según el área y la competencia.</div>}
        {type==="observation_guide"&&<div className="snf-info">La guía observará actuaciones o desempeños durante la actividad, sin convertirlos en niveles de rúbrica.</div>}
      </div>
      {error&&<div className="snf-error">{error}</div>}
      <button className="snf-generate" disabled={loading} onClick={generate}>{loading?<><Loader2 className="snf-spin" size={18}/> Generando...</>:<><Sparkles size={18}/> Generar {META[type].label.toLowerCase()} · 1 crédito</>}</button>
    </div>}

    {step==="result"&&resource&&<div className="snf-result">
      <div className="snf-result-head"><div><span><CheckCircle2 size={16}/> CREADO</span><h2>{resource.titulo||META[type].label}</h2></div><button onClick={()=>downloadWord(type,resource,form,profile)}><Download size={17}/> Descargar Word</button></div>
      <div className="snf-preview">
        <h3>{META[type].label}</h3>
        {type==="reading"&&<><p className="snf-long-text">{resource.texto}</p><h4>Preguntas</h4>{(resource.preguntas||[]).map((q,i)=><p key={i}><b>{i+1}.</b> {q.pregunta}</p>)}</>}
        {type==="questionnaire"&&(resource.preguntas||[]).map((q,i)=><div className="snf-q" key={i}><b>{q.numero||i+1}. {q.pregunta}</b>{(q.opciones||[]).map((o,j)=><span key={j}>{String.fromCharCode(65+j)}) {o}</span>)}</div>)}
        {type==="worksheet"&&(resource.secciones||[]).map((s,i)=><div className="snf-section" key={i}><h4>{i+1}. {s.titulo}</h4><p>{s.indicacion}</p>{(s.actividades||[]).map((a,j)=><p key={j}>• {a.texto}</p>)}</div>)}
        {META[type].group==="instrument"&&<div className="snf-simple-table">
          {(resource.criterios||resource.indicadores||[]).map((x,i)=><div key={i}><b>{x.criterio||x.indicador}</b><span>{x.capacidad||x.aspecto||""}</span></div>)}
        </div>}
      </div>
      <div className="snf-result-actions"><button onClick={()=>setStep("configure")}>Crear nueva versión</button><button className="primary" onClick={()=>setStep("choice")}>Crear otro recurso</button><button onClick={()=>onFinish?.()}>Volver a la sesión</button></div>
    </div>}
  </section>;
}
