// components/SessionNextFlow.jsx
import React,{useMemo,useState} from "react";
import {
  ArrowLeft,ArrowRight,ClipboardCheck,ListChecks,Eye,Gauge,
  FileText,BookOpen,HelpCircle,Sparkles,Loader2,Download,
  CheckCircle2,X
} from "lucide-react";
import {
  Document,Packer,Paragraph,TextRun,Table,TableRow,TableCell,
  WidthType,BorderStyle,ShadingType,AlignmentType,PageOrientation,
  Header,Footer,PageNumber
} from "docx";
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

const B={teal:"168B84",green:"0F625D",pale:"E6F6F3",white:"FFFFFF",ink:"173331",muted:"617B78",border:"9ECBC6"};
const borders={top:{style:BorderStyle.SINGLE,size:4,color:B.border},bottom:{style:BorderStyle.SINGLE,size:4,color:B.border},left:{style:BorderStyle.SINGLE,size:4,color:B.border},right:{style:BorderStyle.SINGLE,size:4,color:B.border},insideHorizontal:{style:BorderStyle.SINGLE,size:3,color:B.border},insideVertical:{style:BorderStyle.SINGLE,size:3,color:B.border}};
const run=(t,o={})=>new TextRun({text:String(t??""),font:"Arial",size:o.size||18,bold:!!o.bold,italics:!!o.italics,color:o.color||B.ink});
const p=(t="",o={})=>new Paragraph({alignment:o.align,spacing:{before:o.before||0,after:o.after??80,line:o.line||250},children:[run(t,o)]});
const rich=(runs,o={})=>new Paragraph({alignment:o.align,spacing:{after:o.after??70},children:runs});
function cell(content,width,o={}){
  const children=(Array.isArray(content)?content:[content]).map(x=>x instanceof Paragraph?x:p(x,{bold:o.bold,color:o.color,size:o.size||14,align:o.align,after:15}));
  return new TableCell({width:{size:width,type:WidthType.DXA},shading:o.fill?{type:ShadingType.CLEAR,fill:o.fill}:undefined,margins:{top:70,bottom:70,left:80,right:80},children});
}
function table(rows,widths,total=9638){return new Table({width:{size:total,type:WidthType.DXA},columnWidths:widths,borders,rows});}
function header(){return new Header({children:[rich([run("SciVerse",{bold:true,color:B.teal,size:22}),run(" · Teaching TIC",{color:B.muted,size:14})],{align:AlignmentType.CENTER})]});}
function footer(){return new Footer({children:[new Paragraph({alignment:AlignmentType.CENTER,children:[run("Teaching TIC · Página ",{size:12,color:B.muted}),new TextRun({children:[PageNumber.CURRENT],font:"Arial",size:12,color:B.muted})]})]});}
function lines(n=2){return Array.from({length:n},()=>p("____________________________________________________________",{size:14,color:"AFC1BF",after:45}));}

function infoStudent(form){
  return table([
    new TableRow({children:[cell("NOMBRE",1400,{fill:B.pale,bold:true}),cell("",3400),cell("FECHA",1200,{fill:B.pale,bold:true}),cell("",3638)]}),
    new TableRow({children:[cell("GRADO",1400,{fill:B.pale,bold:true}),cell(form.grado||"",3400),cell("ÁREA",1200,{fill:B.pale,bold:true}),cell(form.area||"",3638)]})
  ],[1400,3400,1200,3638]);
}

function instrumentWord(type,r,form){
  const kids=[
    p(r.titulo||META[type].label.toUpperCase(),{bold:true,size:25,color:B.teal,align:AlignmentType.CENTER,after:130}),
    p(`Competencia: ${r.competencia||form.competencia||""}`,{bold:true,size:15,after:45}),
    p(`Evidencia: ${r.evidencia||form.evidencia||""}`,{size:15,after:100})
  ];
  let rows,widths;

  if(type==="rubric"){
    widths=[2200,2900,1135,1135,1135,1133];
    rows=[new TableRow({children:["CAPACIDAD","CRITERIO","AD","A","B","C"].map((x,i)=>cell(x,widths[i],{fill:B.green,color:B.white,bold:true,align:AlignmentType.CENTER}))})];
    (r.criterios||[]).forEach(x=>rows.push(new TableRow({children:[
      cell(x.capacidad,widths[0]),cell(x.criterio,widths[1],{bold:true}),cell(x.ad,widths[2]),cell(x.a,widths[3]),cell(x.b,widths[4]),cell(x.c,widths[5])
    ]})));
  }else if(type==="checklist"){
    widths=[2300,4200,700,700,1738];
    rows=[new TableRow({children:["CAPACIDAD","CRITERIO","SÍ","NO","OBSERVACIONES"].map((x,i)=>cell(x,widths[i],{fill:B.green,color:B.white,bold:true,align:AlignmentType.CENTER}))})];
    (r.criterios||[]).forEach(x=>rows.push(new TableRow({children:[
      cell(x.capacidad,widths[0]),cell(x.criterio,widths[1],{bold:true}),cell("☐",widths[2],{align:AlignmentType.CENTER,size:18}),cell("☐",widths[3],{align:AlignmentType.CENTER,size:18}),cell("",widths[4])
    ]})));
  }else if(type==="observation_guide"){
    kids.push(p(`Situación de observación: ${r.situacionObservacion||""}`,{size:15,after:100}));
    widths=[2500,4500,2638];
    rows=[new TableRow({children:["ASPECTO","INDICADOR OBSERVABLE","REGISTRO / OBSERVACIONES"].map((x,i)=>cell(x,widths[i],{fill:B.green,color:B.white,bold:true,align:AlignmentType.CENTER}))})];
    (r.indicadores||[]).forEach(x=>rows.push(new TableRow({children:[cell(x.aspecto,widths[0],{bold:true}),cell(x.indicador,widths[1]),cell("",widths[2])]})));
  }else{
    const levels=r.niveles||["Inicio","En proceso","Logrado","Destacado"];
    const cw=4700,lw=Math.floor((9638-cw)/levels.length); widths=[cw,...levels.map(()=>lw)];
    rows=[new TableRow({children:[cell("CRITERIO",cw,{fill:B.green,color:B.white,bold:true}),...levels.map(x=>cell(x,lw,{fill:B.green,color:B.white,bold:true,align:AlignmentType.CENTER,size:12}))]})];
    (r.criterios||[]).forEach(x=>rows.push(new TableRow({children:[cell(x.criterio,cw,{bold:true}),...levels.map(()=>cell("○",lw,{align:AlignmentType.CENTER,size:20}))]})));
  }
  kids.push(table(rows,widths));
  return {kids,landscape:true};
}

function materialWord(type,r,form){
  const kids=[
    p((r.tipoFicha||META[type].label).toUpperCase(),{bold:true,size:16,color:B.teal,align:AlignmentType.CENTER,after:40}),
    p(r.titulo||META[type].label,{bold:true,size:27,align:AlignmentType.CENTER,after:120}),
    infoStudent(form)
  ];

  if(type==="worksheet"){
    kids.push(p("¿QUÉ APRENDEREMOS?",{bold:true,color:B.teal,size:18,before:140,after:40}),p(r.propositoEstudiante||"",{size:17}));
    if(r.instrucciones) kids.push(p(r.instrucciones,{italics:true,color:B.muted,size:15,after:100}));
    (r.secciones||[]).forEach((s,si)=>{
      kids.push(p(`${si+1}. ${s.titulo}`,{bold:true,color:B.teal,size:19,before:130,after:35}),p(s.indicacion||"",{size:15,color:B.muted}));
      (s.actividades||[]).forEach((a,ai)=>{
        if(a.tipo==="texto") kids.push(p(a.texto,{size:17}));
        else if(a.tipo==="lista"||a.tipo==="pasos"){
          kids.push(p(a.texto,{bold:true,size:16}));
          (a.opciones||[]).forEach((op,i)=>kids.push(p(`${a.tipo==="pasos"?`${i+1}.`:"•"} ${op}`,{size:16,after:35})));
        }else if(a.tipo==="tabla"){
          kids.push(p(a.texto,{bold:true,size:16}));
          const cols=(a.columnas||[]); if(cols.length){const w=Math.floor(9638/cols.length);const rows=[new TableRow({children:cols.map(c=>cell(c,w,{fill:B.teal,color:B.white,bold:true,align:AlignmentType.CENTER}))})];for(let i=0;i<3;i++)rows.push(new TableRow({children:cols.map(()=>cell("",w))}));kids.push(table(rows,cols.map(()=>w)));}
        }else{
          kids.push(p(`${ai+1}. ${a.texto}`,{bold:true,size:16,after:35}),...lines(a.tipo==="respuesta_larga"?4:2));
        }
      });
    });
    kids.push(p("REFLEXIONAMOS",{bold:true,color:B.teal,size:18,before:140}));
    (r.metacognicion||[]).forEach((q,i)=>kids.push(p(`${i+1}. ${q}`,{bold:true,size:16,after:30}),...lines(2)));
  }

  if(type==="reading"){
    kids.push(p(`Propósito: ${r.proposito||""}`,{italics:true,color:B.muted,size:15,before:120}));
    kids.push(p(r.texto||"",{size:17,line:285,after:140}));
    if((r.vocabulario||[]).length){
      kids.push(p("VOCABULARIO",{bold:true,color:B.teal,size:18}));
      (r.vocabulario||[]).forEach(x=>kids.push(rich([run(`${x.palabra}: `,{bold:true,size:16}),run(x.significado,{size:16})])));
    }
    kids.push(p("COMPRENDEMOS LA LECTURA",{bold:true,color:B.teal,size:18,before:120}));
    (r.preguntas||[]).forEach((q,i)=>kids.push(p(`${i+1}. ${q.pregunta}`,{bold:true,size:16,after:30}),...lines(q.nivel==="critico"?3:2)));
  }

  if(type==="questionnaire"){
    kids.push(p(r.instrucciones||"",{italics:true,color:B.muted,size:15,before:120,after:100}));
    (r.preguntas||[]).forEach((q,i)=>{
      kids.push(p(`${q.numero||i+1}. ${q.pregunta}`,{bold:true,size:16,after:35}));
      if(q.tipo==="opcion_multiple"){(q.opciones||[]).forEach((op,j)=>kids.push(p(`${String.fromCharCode(65+j)}) ${op}`,{size:16,after:30})));}
      else if(q.tipo==="verdadero_falso") kids.push(p("☐ Verdadero     ☐ Falso",{size:16,after:70}));
      else kids.push(...lines(q.tipo==="respuesta_abierta"?4:2));
    });
  }
  return {kids,landscape:false};
}

async function downloadWord(type,r,form){
  const built=META[type].group==="instrument"?instrumentWord(type,r,form):materialWord(type,r,form);
  const doc=new Document({creator:"Teaching TIC Consultorías S.A.C.",title:r.titulo||META[type].label,styles:{default:{document:{run:{font:"Arial",size:18,color:B.ink},paragraph:{spacing:{after:80,line:250}}}}},sections:[{
    properties:{page:{size:{width:built.landscape?16838:11906,height:built.landscape?11906:16838,orientation:built.landscape?PageOrientation.LANDSCAPE:PageOrientation.PORTRAIT},margin:built.landscape?{top:520,right:520,bottom:520,left:520}:{top:850,right:1000,bottom:850,left:1000}}},
    headers:{default:header()},footers:{default:footer()},children:built.kids
  }]});
  const blob=await Packer.toBlob(doc),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=`${META[type].label} - ${(r.titulo||form.tema||"SciVerse").replace(/[\\/:*?"<>|]+/g,"-")}.docx`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}

export default function SessionNextFlow({session,form={},profile={},onBackToSession,onFinish,onUpgrade}){
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
      const r=await fetch("/api/generate-session-resource",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${auth.access_token}`},body:JSON.stringify({
        type,session,form,profile,
        options:{numeroCriterios:criteria,scaleType,questionCount,readingLength}
      })});
      const d=await r.json();
      if(!r.ok){if(r.status===429&&onUpgrade)onUpgrade();throw new Error(d?.error||"No se pudo generar");}
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
      <div className="snf-result-head"><div><span><CheckCircle2 size={16}/> CREADO</span><h2>{resource.titulo||META[type].label}</h2></div><button onClick={()=>downloadWord(type,resource,form)}><Download size={17}/> Descargar Word</button></div>
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
