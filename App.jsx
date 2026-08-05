import React, { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient.js";
import AuthGate from "./AuthGate.jsx";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, VerticalAlign, TableLayoutType, PageBreak, Header, Footer, PageNumber, NumberFormat, PageOrientation, VerticalMergeType } from "docx";
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
  LayoutDashboard,
  FolderOpen,
  CreditCard,
  Gift,
  Video,
  BadgeCheck,
  Link2,
  Copy,
  HardDrive,
  Pencil,
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

const WORD = { purple: "4F46B8", purpleDark: "24206B", purpleLight: "F0EFFE", yellow: "FFF4C4", border: "CDD3E1", ink: "172033", muted: "586174", white: "FFFFFF" };
const WORD_WIDTH = 9638;
const wordBorders = { top:{style:BorderStyle.SINGLE,size:4,color:WORD.border}, bottom:{style:BorderStyle.SINGLE,size:4,color:WORD.border}, left:{style:BorderStyle.SINGLE,size:4,color:WORD.border}, right:{style:BorderStyle.SINGLE,size:4,color:WORD.border}, insideHorizontal:{style:BorderStyle.SINGLE,size:4,color:WORD.border}, insideVertical:{style:BorderStyle.SINGLE,size:4,color:WORD.border} };

function wordRun(text, { bold=false, italics=false, color=WORD.ink, size=20 } = {}) { return new TextRun({ text:String(text ?? ""), bold, italics, color, size, font:"Arial" }); }
function wordParagraph(text="", options={}) { return new Paragraph({ alignment:options.alignment, heading:options.heading, spacing:{ before:options.before ?? 0, after:options.after ?? 90, line:options.line ?? 276 }, bullet:options.bullet ? { level:0 } : undefined, children:[wordRun(text, options)] }); }
function wordRichParagraph(runs=[], options={}) { return new Paragraph({ alignment:options.alignment, spacing:{before:options.before??0,after:options.after??90,line:options.line??276}, children:runs }); }
function wordCell(children, width, { fill, color, bold=false, align, span }={}) { const normalized=(Array.isArray(children)?children:[children]).map(item=>item instanceof Paragraph?item:wordParagraph(item,{bold,color,alignment:align,size:18})); return new TableCell({ columnSpan:span, width:{size:width,type:WidthType.DXA}, verticalAlign:VerticalAlign.CENTER, shading:fill?{type:ShadingType.CLEAR,fill}:undefined, margins:{top:90,bottom:90,left:110,right:110}, children:normalized }); }
function wordTable(rows, widths) { return new Table({ width:{size:WORD_WIDTH,type:WidthType.DXA}, columnWidths:widths, layout:TableLayoutType.FIXED, borders:wordBorders, rows }); }
function wordSectionHeading(roman, title) { return wordParagraph(`${roman}. ${title.toUpperCase()}`, {bold:true,color:WORD.purple,size:22,before:150,after:90}); }
function wordBulletList(items=[]) { return items.filter(Boolean).map(item=>wordParagraph(item,{bullet:true,size:19,after:45})); }

async function triggerWordDownload(doc, filename) {
  const blob = await Packer.toBlob(doc);
  const safeName=(filename||"documento.docx").replace(/[\\/:*?"<>|]+/g,"-");
  if (window.navigator?.msSaveOrOpenBlob) { window.navigator.msSaveOrOpenBlob(blob,safeName); return; }
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement("a");
  anchor.href=url; anchor.download=safeName; anchor.style.display="none";
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),30000);
}

async function downloadWord(filename, content, title="Documento SciVerse") {
  const paragraphs=String(content||"").split(/\n/).map(line=>line.trim()?wordParagraph(line,{size:20}):wordParagraph("",{after:40}));
  const doc=new Document({ creator:"Teaching TIC Consultorías S.A.C.", title, styles:{ default:{ document:{ run:{font:"Arial",size:20,color:WORD.ink}, paragraph:{spacing:{after:90,line:276}} } } }, sections:[{ properties:{page:{size:{width:11906,height:16838},margin:{top:1134,right:1134,bottom:1134,left:1134}}}, children:[wordParagraph(title,{bold:true,size:30,color:WORD.purpleDark,alignment:AlignmentType.CENTER,after:220}),...paragraphs] }] });
  await triggerWordDownload(doc,filename);
}

const RUBRIC_WORD = { green:"0F625D", pale:"E4F6F3", pale2:"F3FBF9", border:"8DB9B3", ink:"172F2D", muted:"557370", white:"FFFFFF" };
const RUBRIC_WIDTH = 15736;
const rubricBorders = { top:{style:BorderStyle.SINGLE,size:5,color:RUBRIC_WORD.border}, bottom:{style:BorderStyle.SINGLE,size:5,color:RUBRIC_WORD.border}, left:{style:BorderStyle.SINGLE,size:5,color:RUBRIC_WORD.border}, right:{style:BorderStyle.SINGLE,size:5,color:RUBRIC_WORD.border}, insideHorizontal:{style:BorderStyle.SINGLE,size:4,color:RUBRIC_WORD.border}, insideVertical:{style:BorderStyle.SINGLE,size:4,color:RUBRIC_WORD.border} };
function rubricParagraph(text="", {bold=false,color=RUBRIC_WORD.ink,size=15,alignment,after=40,italics=false}={}) { return new Paragraph({alignment,spacing:{after,line:220},children:[new TextRun({text:String(text??""),bold,color,size,italics,font:"Arial"})]}); }
function rubricCell(children,width,{fill,color,bold=false,alignment,verticalMerge}={}) { const normalized=(Array.isArray(children)?children:[children]).map(item=>item instanceof Paragraph?item:rubricParagraph(item,{bold,color,alignment})); return new TableCell({width:{size:width,type:WidthType.DXA},verticalAlign:VerticalAlign.CENTER,verticalMerge,shading:fill?{type:ShadingType.CLEAR,fill}:undefined,margins:{top:70,bottom:70,left:85,right:85},children:normalized}); }
function rubricTable(rows,widths=[]) { return new Table({width:{size:RUBRIC_WIDTH,type:WidthType.DXA},columnWidths:widths,layout:TableLayoutType.FIXED,borders:rubricBorders,rows}); }

async function downloadRubricWord({form,instrument,profile={}}) {
  const widths=[2400,3300,2509,2509,2509,2509];
  const groups=[];
  (instrument.criterios||[]).forEach(item=>{ const capacity=item.capacidad||"Capacidad seleccionada"; let group=groups.find(entry=>entry.capacity===capacity); if(!group){group={capacity,items:[]};groups.push(group);} group.items.push(item); });
  const rubricRows=[new TableRow({tableHeader:true,children:[rubricCell("CAPACIDAD",widths[0],{fill:RUBRIC_WORD.green,color:RUBRIC_WORD.white,bold:true,alignment:AlignmentType.CENTER}),rubricCell("CRITERIO DE EVALUACIÓN",widths[1],{fill:RUBRIC_WORD.green,color:RUBRIC_WORD.white,bold:true,alignment:AlignmentType.CENTER}),rubricCell("LOGRO DESTACADO (AD)",widths[2],{fill:RUBRIC_WORD.green,color:RUBRIC_WORD.white,bold:true,alignment:AlignmentType.CENTER}),rubricCell("LOGRO ESPERADO (A)",widths[3],{fill:RUBRIC_WORD.green,color:RUBRIC_WORD.white,bold:true,alignment:AlignmentType.CENTER}),rubricCell("EN PROCESO (B)",widths[4],{fill:RUBRIC_WORD.green,color:RUBRIC_WORD.white,bold:true,alignment:AlignmentType.CENTER}),rubricCell("EN INICIO (C)",widths[5],{fill:RUBRIC_WORD.green,color:RUBRIC_WORD.white,bold:true,alignment:AlignmentType.CENTER})]})];
  groups.forEach(group=>group.items.forEach((item,index)=>rubricRows.push(new TableRow({children:[rubricCell(index===0?group.capacity:"",widths[0],{fill:RUBRIC_WORD.pale,bold:true,verticalMerge:index===0?VerticalMergeType.RESTART:VerticalMergeType.CONTINUE}),rubricCell(item.criterio,widths[1],{fill:index%2?RUBRIC_WORD.pale2:RUBRIC_WORD.white,bold:true}),rubricCell(item.logroDestacado,widths[2],{fill:index%2?RUBRIC_WORD.pale2:RUBRIC_WORD.white}),rubricCell(item.logroEsperado,widths[3],{fill:index%2?RUBRIC_WORD.pale2:RUBRIC_WORD.white}),rubricCell(item.enProceso,widths[4],{fill:index%2?RUBRIC_WORD.pale2:RUBRIC_WORD.white}),rubricCell(item.inicio,widths[5],{fill:index%2?RUBRIC_WORD.pale2:RUBRIC_WORD.white})]}))));
  const teacher=[profile.nombres,profile.apellidos].filter(Boolean).join(" ")||profile.nombre||form.docente||"";
  const institution=profile.ie||profile.institucion||form.institucion||"";
  const capacities=(instrument.capacidades||form.capacidades||[]).join(" · ");
  const children=[rubricParagraph("RÚBRICA DE EVALUACIÓN",{bold:true,size:25,color:RUBRIC_WORD.green,alignment:AlignmentType.CENTER,after:140}),rubricTable([new TableRow({children:[rubricCell("DOCENTE",1550,{fill:RUBRIC_WORD.pale,bold:true}),rubricCell(teacher,6300),rubricCell("I.E.",1300,{fill:RUBRIC_WORD.pale,bold:true}),rubricCell(institution,6586)]}),new TableRow({children:[rubricCell("ÁREA",1550,{fill:RUBRIC_WORD.pale,bold:true}),rubricCell(form.area,6300),rubricCell("NIVEL Y GRADO",1300,{fill:RUBRIC_WORD.pale,bold:true}),rubricCell(`${form.nivel} · ${form.grado}${form.seccion?` · ${form.seccion}`:""}`,6586)]}),new TableRow({children:[rubricCell("FECHA",1550,{fill:RUBRIC_WORD.pale,bold:true}),rubricCell(form.fecha||"",6300),rubricCell("DURACIÓN",1300,{fill:RUBRIC_WORD.pale,bold:true}),rubricCell(form.duracion?`${form.duracion} minutos`:"",6586)]})],[1550,6300,1300,6586]),rubricParagraph("TÍTULO DE LA SESIÓN",{bold:true,size:17,color:RUBRIC_WORD.green,after:35}),rubricParagraph(form.tema||instrument.titulo,{size:16,after:90}),rubricParagraph("PROPÓSITO DE APRENDIZAJE",{bold:true,size:17,color:RUBRIC_WORD.green,after:35}),rubricParagraph(`Competencia: ${instrument.competencia||form.competencia}`,{bold:true,size:15,after:25}),rubricParagraph(`Capacidades: ${capacities}`,{size:15,after:25}),...(form.proposito?[rubricParagraph(`Propósito: ${form.proposito}`,{size:15,after:25})]:[]),rubricParagraph(`Evidencia: ${instrument.evidencia||form.evidencia}`,{size:15,after:100}),rubricTable(rubricRows,widths)];
  const doc=new Document({creator:"Teaching TIC Consultorías S.A.C.",title:instrument.titulo||"Rúbrica de evaluación",styles:{default:{document:{run:{font:"Arial",size:15,color:RUBRIC_WORD.ink},paragraph:{spacing:{after:40,line:220}}}}},sections:[{properties:{page:{size:{width:16838,height:11906,orientation:PageOrientation.LANDSCAPE},margin:{top:520,right:550,bottom:520,left:550}}},headers:{default:new Header({children:[rubricParagraph("Teaching TIC · Kantu",{size:13,color:RUBRIC_WORD.muted,alignment:AlignmentType.RIGHT,after:0})]})},footers:{default:new Footer({children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:"SciVerse para docentes · Página ",font:"Arial",size:13,color:RUBRIC_WORD.muted}),new TextRun({children:[PageNumber.CURRENT],font:"Arial",size:13,color:RUBRIC_WORD.muted})]})]})},children}]});
  const slug=(form.tema||instrument.titulo||"rubrica-de-evaluacion").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,55);
  await triggerWordDownload(doc,`rubrica-${slug}.docx`);
}

async function downloadChecklistWord({form,instrument,profile={}}) {
  const criteria=(instrument.criterios||[]).slice(0,8);
  const teacher=[profile.nombres,profile.apellidos].filter(Boolean).join(" ")||profile.nombre||form.docente||"";
  const institution=profile.ie||profile.institucion||form.institucion||"";
  const fixedWidth=760;
  const namesWidth=3500;
  const observationsWidth=2100;
  const criterionWidth=Math.floor((RUBRIC_WIDTH-fixedWidth-namesWidth-observationsWidth)/Math.max(criteria.length,1));
  const widths=[fixedWidth,namesWidth,...criteria.map(()=>criterionWidth),observationsWidth];
  const adjustedTotal=widths.reduce((sum,value)=>sum+value,0);
  widths[widths.length-1]+=RUBRIC_WIDTH-adjustedTotal;
  const headerCells=[rubricCell("N.º",widths[0],{fill:RUBRIC_WORD.green,color:RUBRIC_WORD.white,bold:true,alignment:AlignmentType.CENTER}),rubricCell("APELLIDOS Y NOMBRES",widths[1],{fill:RUBRIC_WORD.green,color:RUBRIC_WORD.white,bold:true,alignment:AlignmentType.CENTER}),...criteria.map((item,index)=>rubricCell([rubricParagraph(`CRITERIO ${index+1}`,{bold:true,color:RUBRIC_WORD.white,size:14,alignment:AlignmentType.CENTER,after:30}),rubricParagraph(item.criterio,{color:RUBRIC_WORD.white,size:12,alignment:AlignmentType.CENTER,after:0})],criterionWidth,{fill:RUBRIC_WORD.green,alignment:AlignmentType.CENTER})),rubricCell("OBSERVACIONES",widths.at(-1),{fill:RUBRIC_WORD.green,color:RUBRIC_WORD.white,bold:true,alignment:AlignmentType.CENTER})];
  const scaleRow=new TableRow({children:[rubricCell("",widths[0],{fill:RUBRIC_WORD.pale}),rubricCell("Escala de valoración",widths[1],{fill:RUBRIC_WORD.pale,bold:true,alignment:AlignmentType.RIGHT}),...criteria.map(()=>rubricCell("Sí / No",criterionWidth,{fill:RUBRIC_WORD.pale,bold:true,alignment:AlignmentType.CENTER})),rubricCell("",widths.at(-1),{fill:RUBRIC_WORD.pale})]});
  const studentRows=Array.from({length:30},(_,index)=>new TableRow({children:[rubricCell(String(index+1).padStart(2,"0"),widths[0],{alignment:AlignmentType.CENTER}),rubricCell("",widths[1]),...criteria.map(()=>rubricCell("☐ Sí    ☐ No",criterionWidth,{alignment:AlignmentType.CENTER})),rubricCell("",widths.at(-1))]}));
  const capacities=(instrument.capacidades||form.capacidades||[]).join(" · ");
  const children=[rubricParagraph("LISTA DE COTEJO",{bold:true,size:25,color:RUBRIC_WORD.green,alignment:AlignmentType.CENTER,after:140}),rubricTable([new TableRow({children:[rubricCell("DOCENTE",1550,{fill:RUBRIC_WORD.pale,bold:true}),rubricCell(teacher,6300),rubricCell("I.E.",1300,{fill:RUBRIC_WORD.pale,bold:true}),rubricCell(institution,6586)]}),new TableRow({children:[rubricCell("ÁREA",1550,{fill:RUBRIC_WORD.pale,bold:true}),rubricCell(form.area,6300),rubricCell("NIVEL Y GRADO",1300,{fill:RUBRIC_WORD.pale,bold:true}),rubricCell(`${form.nivel} · ${form.grado}${form.seccion?` · ${form.seccion}`:""}`,6586)]}),new TableRow({children:[rubricCell("FECHA",1550,{fill:RUBRIC_WORD.pale,bold:true}),rubricCell(form.fecha||"",6300),rubricCell("DURACIÓN",1300,{fill:RUBRIC_WORD.pale,bold:true}),rubricCell(form.duracion?`${form.duracion} minutos`:"",6586)]})],[1550,6300,1300,6586]),rubricParagraph("TÍTULO DE LA SESIÓN",{bold:true,size:17,color:RUBRIC_WORD.green,after:35}),rubricParagraph(form.tema||instrument.titulo,{size:16,after:80}),rubricParagraph("PROPÓSITO DE APRENDIZAJE",{bold:true,size:17,color:RUBRIC_WORD.green,after:35}),rubricParagraph(`Competencia: ${instrument.competencia||form.competencia}`,{bold:true,size:15,after:25}),rubricParagraph(`Capacidades: ${capacities}`,{size:15,after:25}),...(form.proposito?[rubricParagraph(`Propósito: ${form.proposito}`,{size:15,after:25})]:[]),rubricParagraph(`Evidencia: ${instrument.evidencia||form.evidencia}`,{size:15,after:80}),rubricParagraph("CRITERIOS DE EVALUACIÓN",{bold:true,size:17,color:RUBRIC_WORD.green,after:35}),...criteria.map((item,index)=>rubricParagraph(`${index+1}. ${item.criterio}`,{size:14,after:25})),rubricParagraph("REGISTRO DE ESTUDIANTES",{bold:true,size:17,color:RUBRIC_WORD.green,after:60}),rubricTable([new TableRow({tableHeader:true,children:headerCells}),scaleRow,...studentRows],widths)];
  const doc=new Document({creator:"Teaching TIC Consultorías S.A.C.",title:instrument.titulo||"Lista de cotejo",styles:{default:{document:{run:{font:"Arial",size:15,color:RUBRIC_WORD.ink},paragraph:{spacing:{after:40,line:220}}}}},sections:[{properties:{page:{size:{width:16838,height:11906,orientation:PageOrientation.LANDSCAPE},margin:{top:520,right:550,bottom:520,left:550}}},headers:{default:new Header({children:[rubricParagraph("Teaching TIC · Kantu",{size:13,color:RUBRIC_WORD.muted,alignment:AlignmentType.RIGHT,after:0})]})},footers:{default:new Footer({children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:"SciVerse para docentes · Página ",font:"Arial",size:13,color:RUBRIC_WORD.muted}),new TextRun({children:[PageNumber.CURRENT],font:"Arial",size:13,color:RUBRIC_WORD.muted})]})]})},children}]});
  const slug=(form.tema||instrument.titulo||"lista-de-cotejo").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,55);
  await triggerWordDownload(doc,`lista-de-cotejo-${slug}.docx`);
}

function wordMomentSubsection(title, item, {development=false}={}) {
  if (!item) return [];
  const paragraphs=[wordParagraph(title,{bold:true,color:development?"2865CC":WORD.purpleDark,size:19,before:80,after:55})];
  const description=item.descripcion||item.actividad||"";
  if(description) paragraphs.push(wordParagraph(description,{size:18,after:55}));
  const questions=item.preguntas||item.preguntasMediacion||[];
  if(questions.length) paragraphs.push(wordParagraph(development?"Preguntas de mediación":"Preguntas orientadoras",{bold:true,color:WORD.purple,size:17,before:40,after:35}),...wordBulletList(questions));
  if(item.criteriosCompartidos?.length) paragraphs.push(wordParagraph("Criterios compartidos",{bold:true,color:WORD.purple,size:17,before:40,after:35}),...wordBulletList(item.criteriosCompartidos));
  if(item.acompanamiento) paragraphs.push(wordRichParagraph([wordRun("Acompañamiento: ",{bold:true,color:"2865CC",size:17}),wordRun(item.acompanamiento,{size:17})]));
  if(item.evaluacionFormativa) paragraphs.push(wordRichParagraph([wordRun("Evaluación formativa: ",{bold:true,color:"2865CC",size:17}),wordRun(item.evaluacionFormativa,{size:17})]));
  if(item.mensajeLogro) paragraphs.push(wordRichParagraph([wordRun("Mensaje de logro: ",{bold:true,color:WORD.purple,size:17}),wordRun(item.mensajeLogro,{italics:true,size:17})]));
  if(item.consigna) paragraphs.push(wordRichParagraph([wordRun("Consigna: ",{bold:true,color:WORD.purple,size:17}),wordRun(item.consigna,{italics:true,size:17})]));
  return paragraphs;
}

function wordMomentContent(momentName, data) {
  if (!data || typeof data === "string") return [wordParagraph(data||"",{size:18})];
  if(momentName==="INICIO") return [
    ...wordMomentSubsection("Motivación",data.motivacion),
    ...wordMomentSubsection("Saberes previos",data.saberesPrevios),
    ...wordMomentSubsection("Problematización",data.problematizacion),
    ...wordMomentSubsection("Propósito y organización",data.propositoOrganizacion),
  ];
  if(momentName==="DESARROLLO") return [
    ...(data.metodologia?[wordRichParagraph([wordRun("Metodología: ",{bold:true,color:"2865CC",size:18}),wordRun(data.metodologia,{italics:true,size:18})])]:[]),
    ...(data.procesos||[]).flatMap(item=>wordMomentSubsection(item.subtitulo,item,{development:true})),
  ];
  return [
    ...wordMomentSubsection("Metacognición",data.metacognicion),
    ...wordMomentSubsection("Evaluación",data.evaluacion),
    ...wordMomentSubsection("Cierre y transferencia",data.transferencia),
  ];
}

async function downloadSessionWord({ form, result, documentName="sesión de aprendizaje", documentType="session", profile={} }) {
  const criteria=(result.criteriosDetallados||result.criteriosEvaluacion?.map(criterio=>({criterio,evidenciaObservable:result.evidencia}))||[]);
  const capacities=result.capacidadesCNEB||form.capacidades||[];
  const performances=result.desempenosPrecisados||[];
  const approaches=result.enfoquesTransversales||[];
  const moments=[
    {name:"INICIO",minutes:result.inicio?.minutos||result.tiempos?.inicio||"",content:wordMomentContent("INICIO",result.inicio),fill:WORD.yellow},
    {name:"DESARROLLO",minutes:result.desarrollo?.minutos||result.tiempos?.desarrollo||"",content:wordMomentContent("DESARROLLO",result.desarrollo),fill:"FFFFFF"},
    {name:"CIERRE",minutes:result.cierre?.minutos||result.tiempos?.cierre||"",content:wordMomentContent("CIERRE",result.cierre),fill:"FFFFFF"},
  ];
  const children=[
    wordParagraph(documentType==="project"?"PROYECTO STEAM":"SESIÓN DE APRENDIZAJE",{bold:true,size:30,color:WORD.ink,alignment:AlignmentType.CENTER,after:220}),
    wordSectionHeading("I","Título de la sesión"), wordParagraph(result.titulo||form.tema,{size:20}),
    wordSectionHeading("II","Datos informativos"),
    wordTable([
      new TableRow({children:[wordCell("DOCENTE",1450,{fill:WORD.purpleLight,bold:true}),wordCell(profile.nombre||form.docente||"",3370),wordCell("I.E.",1200,{fill:WORD.purpleLight,bold:true}),wordCell(profile.ie||form.institucion||"",3618)]}),
      new TableRow({children:[wordCell("ÁREA",1450,{fill:WORD.purpleLight,bold:true}),wordCell(form.area,3370),wordCell("NIVEL Y GRADO",1200,{fill:WORD.purpleLight,bold:true}),wordCell(`${form.nivel} · ${form.grado}${form.seccion?` · ${form.seccion}`:""}`,3618)]}),
      new TableRow({children:[wordCell("FECHA",1450,{fill:WORD.purpleLight,bold:true}),wordCell(form.fecha,3370),wordCell("DURACIÓN",1200,{fill:WORD.purpleLight,bold:true}),wordCell(`${form.duracion} minutos`,3618)]}),
    ],[1450,3370,1200,3618]),
    wordSectionHeading("III","Propósitos de aprendizaje"),
    wordTable([
      new TableRow({tableHeader:true,children:[wordCell("COMPETENCIA / CAPACIDADES",3000,{fill:WORD.purple,color:WORD.white,bold:true}),wordCell("CRITERIOS DE EVALUACIÓN",3738,{fill:WORD.purple,color:WORD.white,bold:true}),wordCell("EVIDENCIA / INSTRUMENTO",2900,{fill:WORD.purple,color:WORD.white,bold:true})]}),
      new TableRow({children:[
        wordCell([wordParagraph(form.competencia,{bold:true,size:18}),...wordBulletList(capacities)],3000),
        wordCell(criteria.length?criteria.map(item=>wordParagraph(item.criterio||item,{bullet:true,size:18})):wordParagraph("Por completar"),3738),
        wordCell([wordRichParagraph([wordRun("Evidencia de aprendizaje",{bold:true,color:WORD.purple,size:18})]),wordParagraph(result.evidencia,{size:18}),wordRichParagraph([wordRun("Instrumento de evaluación",{bold:true,color:WORD.purple,size:18})]),wordParagraph(result.instrumentoSugerido||"Rúbrica o lista de cotejo",{size:18})],2900),
      ]}),
    ],[3000,3738,2900]),
  ];
  if(performances.length){ children.push(wordTable([new TableRow({children:[wordCell("DESEMPEÑOS PRECISADOS",WORD_WIDTH,{fill:WORD.purple,color:WORD.white,bold:true})]}),new TableRow({children:[wordCell(performances.map(item=>wordRichParagraph([wordRun(`${item.capacidad}: `,{bold:true,size:18}),wordRun(item.desempeno,{size:18})])),WORD_WIDTH)]})],[WORD_WIDTH])); }
  if(approaches.length){ children.push(wordSectionHeading("IV","Enfoques transversales"),wordTable([new TableRow({tableHeader:true,children:[wordCell("ENFOQUE",2200,{fill:WORD.purple,color:WORD.white,bold:true}),wordCell("VALOR",1900,{fill:WORD.purple,color:WORD.white,bold:true}),wordCell("ACTITUD OBSERVABLE",5538,{fill:WORD.purple,color:WORD.white,bold:true})]}),...approaches.map(item=>new TableRow({children:[wordCell(item.enfoque,2200),wordCell(item.valor,1900),wordCell(item.actitudObservable,5538)]}))],[2200,1900,5538])); }
  children.push(
    wordSectionHeading("V","Situación significativa"),wordParagraph(form.contexto,{size:20}),
    wordSectionHeading("VI","Momentos de la sesión"),
    wordTable([new TableRow({tableHeader:true,children:[wordCell("MOMENTO",1400,{fill:WORD.purple,color:WORD.white,bold:true}),wordCell("ESTRATEGIAS DIDÁCTICAS",6338,{fill:WORD.purple,color:WORD.white,bold:true}),wordCell("RECURSOS Y MATERIALES",1900,{fill:WORD.purple,color:WORD.white,bold:true})]}),...moments.map(moment=>new TableRow({children:[wordCell([wordParagraph(moment.name,{bold:true,size:19}),wordParagraph(moment.minutes?`${moment.minutes} min`:"",{italics:true,size:17})],1400,{fill:moment.fill}),wordCell(moment.content,6338),wordCell(wordBulletList(result.materiales||[]),1900)]}))],[1400,6338,1900]),
    wordSectionHeading("VII","Evaluación"),
    wordTable([new TableRow({tableHeader:true,children:[wordCell("CAPACIDAD",2300,{fill:WORD.purple,color:WORD.white,bold:true}),wordCell("CRITERIO OBSERVABLE",4438,{fill:WORD.purple,color:WORD.white,bold:true}),wordCell("EVIDENCIA OBSERVABLE",2900,{fill:WORD.purple,color:WORD.white,bold:true})]}),...criteria.map(item=>new TableRow({children:[wordCell(item.capacidad||"Capacidades seleccionadas",2300),wordCell(item.criterio||item,4438),wordCell(item.evidenciaObservable||result.evidencia,2900)]}))],[2300,4438,2900]),
    wordSectionHeading("VIII","Orientaciones DUA"),...wordBulletList(result.orientacionesDUA||[]),
    wordSectionHeading("IX","Reflexiones del docente"),
    wordTable((result.reflexionesDocente||["¿Qué avances tuvieron los estudiantes?","¿Qué dificultades se presentaron?","¿Qué debo reforzar en la próxima sesión?"]).map(question=>new TableRow({children:[wordCell(question,5000,{fill:WORD.purpleLight,bold:true}),wordCell("",4638)]})),[5000,4638]),
  );
  (result.anexos||[]).forEach((annex,index)=>children.push(new Paragraph({children:[new PageBreak()]}),wordSectionHeading(`ANEXO ${index+1}`,annex.titulo),wordRichParagraph([wordRun("Propósito: ",{bold:true,color:WORD.purple,size:20}),wordRun(annex.proposito,{size:20})]),wordParagraph(annex.contenido,{size:20}),wordRichParagraph([wordRun("Indicaciones: ",{bold:true,color:WORD.purple,size:20}),wordRun(annex.instrucciones,{size:20})])));
  const doc=new Document({ creator:"Teaching TIC Consultorías S.A.C.", title:result.titulo, description:`${documentName} generada con Kantu`, styles:{default:{document:{run:{font:"Arial",size:20,color:WORD.ink},paragraph:{spacing:{after:90,line:276}}}}}, sections:[{ properties:{page:{size:{width:11906,height:16838},margin:{top:900,right:1134,bottom:900,left:1134},pageNumbers:{start:1,formatType:NumberFormat.DECIMAL}}}, headers:{default:new Header({children:[wordParagraph("Teaching TIC · Kantu",{size:16,color:WORD.muted,alignment:AlignmentType.RIGHT})]})}, footers:{default:new Footer({children:[wordRichParagraph([wordRun("SciVerse para docentes · Página ",{size:16,color:WORD.muted}),new TextRun({children:[PageNumber.CURRENT],font:"Arial",size:16,color:WORD.muted})],{alignment:AlignmentType.CENTER})]})}, children }] });
  const slug=(result.titulo||form.tema||"sesion-de-aprendizaje").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,55);
  await triggerWordDownload(doc,`sesion-${slug}.docx`);
}

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
          "Comparar, mediante una experiencia práctica, la caída de dos objetos de distinto peso soltados desde la misma altura, registrando si su predicción inicial coincidió o no con el resultado, para reconocer cómo intervienen el peso y la resistencia del aire.",
        duracion: "30–35 min",
        materiales: ["Simulación o experiencia guiada de Física", "Hoja de predicciones (ver plantillas)", "Lápiz"],
        pasos: [
          "Antes de realizar la experiencia, pide a cada estudiante que escriba su predicción: ¿cuál objeto caerá primero, el liviano o el pesado?",
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
          "Verificar, mediante datos proporcionados o una simulación educativa de libre elección con al menos tres alturas distintas, la relación entre altura, gravedad y tiempo de caída, contrastando los resultados con la fórmula t = √(2h/g), para comprender el modelo matemático de la caída libre.",
        duracion: "40–45 min",
        materiales: ["Simulación o experiencia guiada de Física", "Calculadora", "Ficha de registro de datos"],
        pasos: [
          "Presenta la fórmula t = √(2h/g) y pide una hipótesis sobre qué pasa con t si h se duplica.",
          "Usen una simulación educativa disponible o datos proporcionados y registren el tiempo de caída para tres alturas distintas.",
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
        objetivo: "Describir, contando el número de oscilaciones de un péndulo elaborado con hilo y una pequeña masa durante 15 segundos, la diferencia de ritmo entre dos longitudes, para relacionar la longitud con el movimiento.",
        duracion: "25–30 min",
        materiales: ["Simulación o experiencia guiada de Física", "Cronómetro"],
        pasos: [
          "Muestra un péndulo sencillo elaborado con hilo y pregunta: '¿creen que un péndulo largo se mueve más rápido o más lento que uno corto?'",
          "Cuenten en voz alta cuántas veces va y viene el péndulo en 15 segundos con el hilo corto.",
          "Alarguen el hilo con el control deslizante y repitan el conteo.",
          "Anoten ambos resultados en la pizarra y comparen.",
        ],
        cierre: "Cierre con dibujo: cada estudiante dibuja un péndulo 'rápido' y uno 'lento' y explica la diferencia con sus palabras.",
      },
      secundaria: {
        objetivo:
          "Comprobar, mediante la medición del periodo de un péndulo sencillo para cuatro longitudes distintas, la relación entre longitud y periodo, comparando el valor medido con el valor teórico calculado con la fórmula T = 2π√(L/g), para validar el modelo matemático del movimiento pendular.",
        duracion: "40 min",
        materiales: ["Simulación o experiencia guiada de Física", "Ficha de registro de datos"],
        pasos: [
          "Presenta la fórmula T = 2π√(L/g) sin resolverla todavía.",
          "Midan el periodo del péndulo para cuatro longitudes distintas y registren los resultados.",
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
        objetivo: "Describir, a partir de una demostración segura realizada por el docente, los cambios visibles al mezclar sustancias de uso cotidiano, registrando al menos dos observaciones para reconocer que pueden ocurrir reacciones químicas.",
        duracion: "25–30 min",
        materiales: ["Experiencia demostrativa segura de Química", "Hoja de observaciones con dibujos"],
        pasos: [
          "Pregunta qué creen que pasará al mezclar los dos frascos disponibles en el experimento de neutralización.",
          "Observen una demostración segura realizada por el docente y registren juntos los cambios producidos.",
          "Pidan a los estudiantes que dibujen lo que vieron: burbujas, cambio de color, etc.",
          "Conversen sobre otros ejemplos cotidianos parecidos (vinagre y bicarbonato en casa).",
        ],
        cierre: "Cierre: cada estudiante completa la frase 'Cuando junté las dos sustancias, observé que...'",
      },
      secundaria: {
        objetivo: "Identificar, mediante datos, imágenes o una demostración segura de neutralización, el cambio de pH al mezclar un ácido con una base, explicándolo con una ecuación química simplificada.",
        duracion: "40–45 min",
        materiales: ["Simulación o experiencia demostrativa de Química", "Ficha de registro", "Tabla periódica (referencia)"],
        pasos: [
          "Presenta el concepto de pH y pide una hipótesis sobre cómo cambiará al mezclar un ácido con una base.",
          "Analicen una demostración segura, datos o imágenes de una neutralización y registren el cambio observado.",
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
        objetivo: "Comparar, mediante datos o una demostración segura, el tiempo de una misma reacción con y sin catalizador, identificando cuál termina primero para reconocer que algunas sustancias aceleran una reacción.",
        duracion: "25 min",
        materiales: ["Experiencia demostrativa segura de Química"],
        pasos: [
          "Comparen los datos o la demostración de una reacción realizada sin catalizador y otra con catalizador.",
          "Pidan a los estudiantes que comparen con un cronómetro cuál reacción termina primero.",
          "Conversen: '¿qué creen que hizo la sustancia extra?'",
        ],
        cierre: "Cierre con analogía: comparar el catalizador con algo que 'ayuda a apurar' una tarea cotidiana (por ejemplo, un ventilador que seca la ropa más rápido).",
      },
      secundaria: {
        objetivo: "Explicar, a partir de datos del tiempo de reacción con y sin catalizador, su efecto sobre la velocidad, relacionándolo con la energía de activación en un texto breve.",
        duracion: "40 min",
        materiales: ["Simulación o experiencia demostrativa de Química", "Ficha de registro de datos"],
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
        objetivo: "Identificar, observando láminas de la célula vegetal y animal, sus partes principales (núcleo, membrana y citoplasma), etiquetándolas correctamente en una ficha.",
        duracion: "30 min",
        materiales: ["Lámina o recurso visual de Biología", "Ficha para colorear/etiquetar"],
        pasos: [
          "Observen y comparen láminas de la célula vegetal y la célula animal.",
          "Pidan a los estudiantes que identifiquen en la lámina qué parte funciona como el 'centro de control' (núcleo).",
          "Señalen la membrana que envuelve la célula y describan su ubicación.",
          "Completen la ficha uniendo cada parte con su nombre.",
        ],
        cierre: "Cierre: comparar la célula con una 'casa' — el núcleo como el jefe de la casa, la membrana como la pared, etc.",
      },
      secundaria: {
        objetivo: "Relacionar, mediante láminas de la célula animal y vegetal, la estructura de cada organelo con su función, completando una tabla comparativa con al menos cuatro organelos correctamente descritos.",
        duracion: "45 min",
        materiales: ["Láminas de célula animal y vegetal", "Tabla comparativa (plantilla)"],
        pasos: [
          "Observen en las láminas la mitocondria, el cloroplasto y el aparato de Golgi, y consulten la función de cada organelo.",
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
        objetivo: "Describir, a partir de una lámina de la neurona, cómo el cuerpo envía mensajes de una célula a otra, dando al menos un ejemplo de una reacción rápida del cuerpo.",
        duracion: "25–30 min",
        materiales: ["Lámina o recurso visual de Biología"],
        pasos: [
          "Muestren una lámina de la neurona y describan su forma (parece un árbol con raíces largas).",
          "Expliquen con una analogía: la neurona es como un 'cable' que lleva avisos, por ejemplo 'la mano toca algo caliente'.",
          "Pidan ejemplos de situaciones donde el cuerpo reacciona rápido (tocar algo caliente, ver una pelota venir).",
        ],
        cierre: "Cierre con juego: en cadena humana, simular cómo viaja un mensaje de neurona en neurona hasta el cerebro.",
      },
      secundaria: {
        objetivo: "Describir, observando un esquema de la neurona, el proceso de transmisión del impulso nervioso desde las dendritas hasta el axón, relacionándolo con la velocidad de un reflejo humano.",
        duracion: "40 min",
        materiales: ["Lámina o recurso visual de Biología", "Ficha de registro"],
        pasos: [
          "Observen el esquema y señalen dendritas, cuerpo celular (soma) y axón.",
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
    title: "Matemática con datos de experimentos",
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
    desc: "Equipos compiten prediciendo, antes de cada prueba práctica, cuál objeto llegará primero al soltar distintos pares. Gana el equipo con más aciertos.",
    duracion: "20 min",
    icon: Zap,
  },
  {
    id: "debate-acido-base",
    title: "El gran debate ácido-base",
    subject: "quimica",
    grades: ["secundaria"],
    desc: "Cada equipo analiza información sobre una mezcla, determina si es ácida, básica o neutra y argumenta su respuesta frente a la clase.",
    duracion: "30 min",
    icon: FlaskConical,
  },
  {
    id: "arma-celula",
    title: "Arma la célula",
    subject: "biologia",
    grades: ["primaria"],
    desc: "Carrera por equipos: usando una lámina como guía, cada equipo ubica tarjetas con los nombres de las partes de la célula en el lugar correcto.",
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
  "ficha-blanco": `FICHA DE EXPERIENCIA STEAM — SciVerse
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

4. PREPARA LOS RECURSOS VISUALES O MATERIALES
   Selecciona láminas, fichas, materiales concretos o una simulación
   educativa disponible según la actividad que desarrollarás.

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

Por haber completado con entusiasmo las actividades STEAM de
SciVerse, demostrando curiosidad,
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
    title: "Ficha de experiencia STEAM",
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
/* ---------------------------------------------------------------------- */
/* STEAM SESSION GENERATOR                                                  */
/* ---------------------------------------------------------------------- */

const GENERATOR_AREAS = ["Ciencia y Tecnología", "Comunicación", "Matemática", "Personal Social", "Arte y Cultura", "Educación para el Trabajo"];
const GENERATOR_COMPETENCIES = {
  "Ciencia y Tecnología": [CNEB.indaga, CNEB.explica, CNEB.disena],
  Comunicación: ["Se comunica oralmente en su lengua materna", "Lee diversos tipos de textos escritos en su lengua materna", "Escribe diversos tipos de textos en su lengua materna"],
  Matemática: ["Resuelve problemas de cantidad", CNEB.cambio, "Resuelve problemas de forma, movimiento y localización", CNEB.datos],
  "Personal Social": ["Construye su identidad", "Convive y participa democráticamente en la búsqueda del bien común", "Gestiona responsablemente el espacio y el ambiente"],
  "Arte y Cultura": ["Aprecia de manera crítica manifestaciones artístico-culturales", CNEB.crea],
  "Educación para el Trabajo": ["Gestiona proyectos de emprendimiento económico o social"],
};
const GENERATOR_CAPACITIES = {
  [CNEB.indaga]: ["Problematiza situaciones para hacer indagación", "Diseña estrategias para hacer indagación", "Genera y registra datos e información", "Analiza datos e información", "Evalúa y comunica el proceso y resultados de su indagación"],
  [CNEB.explica]: ["Comprende y usa conocimientos sobre los seres vivos, materia y energía, biodiversidad, Tierra y universo", "Evalúa las implicancias del saber y del quehacer científico y tecnológico"],
  [CNEB.disena]: ["Determina una alternativa de solución tecnológica", "Diseña la alternativa de solución tecnológica", "Implementa y valida la alternativa de solución tecnológica", "Evalúa y comunica el funcionamiento y los impactos de su alternativa de solución tecnológica"],
  "Se comunica oralmente en su lengua materna": ["Obtiene información del texto oral", "Infiere e interpreta información del texto oral", "Adecúa, organiza y desarrolla las ideas de forma coherente y cohesionada", "Utiliza recursos no verbales y paraverbales de forma estratégica", "Interactúa estratégicamente con distintos interlocutores", "Reflexiona y evalúa la forma, el contenido y contexto del texto oral"],
  "Lee diversos tipos de textos escritos en su lengua materna": ["Obtiene información del texto escrito", "Infiere e interpreta información del texto", "Reflexiona y evalúa la forma, el contenido y contexto del texto"],
  "Escribe diversos tipos de textos en su lengua materna": ["Adecúa el texto a la situación comunicativa", "Organiza y desarrolla las ideas de forma coherente y cohesionada", "Utiliza convenciones del lenguaje escrito de forma pertinente", "Reflexiona y evalúa la forma, el contenido y contexto del texto escrito"],
  "Resuelve problemas de cantidad": ["Traduce cantidades a expresiones numéricas", "Comunica su comprensión sobre los números y las operaciones", "Usa estrategias y procedimientos de estimación y cálculo", "Argumenta afirmaciones sobre las relaciones numéricas y las operaciones"],
  [CNEB.cambio]: ["Traduce datos y condiciones a expresiones algebraicas y gráficas", "Comunica su comprensión sobre las relaciones algebraicas", "Usa estrategias y procedimientos para encontrar equivalencias y reglas generales", "Argumenta afirmaciones sobre relaciones de cambio y equivalencia"],
  "Resuelve problemas de forma, movimiento y localización": ["Modela objetos con formas geométricas y sus transformaciones", "Comunica su comprensión sobre las formas y relaciones geométricas", "Usa estrategias y procedimientos para orientarse en el espacio", "Argumenta afirmaciones sobre relaciones geométricas"],
  [CNEB.datos]: ["Representa datos con gráficos y medidas estadísticas o probabilísticas", "Comunica su comprensión de los conceptos estadísticos y probabilísticos", "Usa estrategias y procedimientos para recopilar y procesar datos", "Sustenta conclusiones o decisiones con base en la información obtenida"],
  "Construye su identidad": ["Se valora a sí mismo", "Autorregula sus emociones", "Reflexiona y argumenta éticamente", "Vive su sexualidad de manera integral y responsable de acuerdo a su etapa de desarrollo y madurez"],
  "Convive y participa democráticamente en la búsqueda del bien común": ["Interactúa con todas las personas", "Construye normas y asume acuerdos y leyes", "Maneja conflictos de manera constructiva", "Delibera sobre asuntos públicos", "Participa en acciones que promueven el bienestar común"],
  "Gestiona responsablemente el espacio y el ambiente": ["Comprende las relaciones entre los elementos naturales y sociales", "Maneja fuentes de información para comprender el espacio geográfico y el ambiente", "Genera acciones para conservar el ambiente local y global"],
  "Aprecia de manera crítica manifestaciones artístico-culturales": ["Percibe manifestaciones artístico-culturales", "Contextualiza manifestaciones artístico-culturales", "Reflexiona creativa y críticamente sobre manifestaciones artístico-culturales"],
  [CNEB.crea]: ["Explora y experimenta los lenguajes del arte", "Aplica procesos creativos", "Evalúa y comunica sus procesos y proyectos"],
  "Gestiona proyectos de emprendimiento económico o social": ["Crea propuestas de valor", "Aplica habilidades técnicas", "Trabaja cooperativamente para lograr objetivos y metas", "Evalúa los resultados del proyecto de emprendimiento"],
};
const PERU_REGIONS = ["Amazonas","Áncash","Apurímac","Arequipa","Ayacucho","Cajamarca","Callao","Cusco","Huancavelica","Huánuco","Ica","Junín","La Libertad","Lambayeque","Lima","Loreto","Madre de Dios","Moquegua","Pasco","Piura","Puno","San Martín","Tacna","Tumbes","Ucayali"];

function SteamGenerator({ initialGrade = "primaria", documentType = "session", profile = {} }) {
  const documentNames = { session: "sesión de aprendizaje", project: "proyecto STEAM", rubric: "rúbrica de evaluación", checklist: "lista de cotejo" };
  const documentName = documentNames[documentType] || documentNames.session;
  const sectionLabels = documentType === "project" ? ["Inicio y reto", "Fases del proyecto", "Cierre y socialización", "Producto final"] : documentType === "rubric" ? ["Aplicación", "Uso de los descriptores", "Retroalimentación", "Evidencia evaluada"] : documentType === "checklist" ? ["Antes de observar", "Durante la observación", "Después de observar", "Evidencia verificada"] : ["Inicio", "Desarrollo", "Cierre", "Producto STEAM"];
  const initialLevel = initialGrade === "secundaria" ? "Secundaria" : "Primaria";
  const today = new Date().toISOString().slice(0, 10);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ nivel: initialLevel, grado: initialLevel === "Primaria" ? "3.º" : "1.º", area: "Ciencia y Tecnología", region: "", seccion: "", fecha: today, duracion: "90", tema: "", competencia: CNEB.indaga, capacidades: GENERATOR_CAPACITIES[CNEB.indaga], proposito: "", contexto: "", evidencia: "", recursos: "", steam: true, inclusivo: true });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [suggesting, setSuggesting] = useState(null);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [activeModule, setActiveModule] = useState(null);
  const [completedModules, setCompletedModules] = useState([]);
  const [downloading, setDownloading] = useState(false);
  const [evaluationFlow, setEvaluationFlow] = useState(null);
  const moduleLabels = { alignment: "Alineación curricular", sequence: "Secuencia didáctica", assessment: "Evaluación formativa", annexes: "Anexos para la clase" };
  const loadingMessages = activeModule ? [`Kantu está trabajando en: ${moduleLabels[activeModule]}`, activeModule === "alignment" ? "Está relacionando capacidades, desempeños y criterios" : activeModule === "sequence" ? "Está organizando los procesos pedagógicos y didácticos" : activeModule === "assessment" ? "Está verificando criterios y evidencias observables" : "Está preparando recursos listos para usar"] : [`Kantu está analizando la información curricular`, `Está organizando la ${documentName}`];

  useEffect(() => {
    if (!loading) { setLoadingMessageIndex(0); return undefined; }
    const timer = window.setInterval(() => setLoadingMessageIndex((current) => (current + 1) % loadingMessages.length), 2600);
    return () => window.clearInterval(timer);
  }, [loading, documentType]);

  const grades = form.nivel === "Primaria" ? ["1.º", "2.º", "3.º", "4.º", "5.º", "6.º"] : ["1.º", "2.º", "3.º", "4.º", "5.º"];
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  function changeLevel(level) { setForm((current) => ({ ...current, nivel: level, grado: "1.º" })); }
  function changeArea(area) { const competence=GENERATOR_COMPETENCIES[area][0]; setForm((current) => ({ ...current, area, competencia: competence, capacidades: GENERATOR_CAPACITIES[competence] || [] })); }
  function changeCompetence(competencia) { setForm((current)=>({...current,competencia,capacidades:GENERATOR_CAPACITIES[competencia]||[]})); }
  function toggleCapacity(capacity) { setForm((current)=>({...current,capacidades:current.capacidades.includes(capacity)?current.capacidades.filter(c=>c!==capacity):[...current.capacidades,capacity]})); }
  function nextStep() {
    setError(null);
    if (step === 1 && (!form.nivel || !form.grado || !form.area || !form.region || !form.fecha || !form.duracion)) return setError("Completa los datos curriculares y selecciona la región.");
    if (step === 2 && (!form.tema.trim() || !form.competencia || !form.capacidades.length || !form.proposito.trim() || !form.contexto.trim() || !form.evidencia.trim())) return setError("Completa o solicita sugerencias para el propósito, contexto y evidencia.");
    setStep((current) => Math.min(3, current + 1));
  }

  async function suggestField(field) {
    if (!form.tema.trim()) return setError("Escribe primero el tema para que Kantu pueda sugerir.");
    if (!form.region) return setError("Selecciona la región para contextualizar la sugerencia.");
    setSuggesting(field); setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token=sessionData.session?.access_token; if(!token) throw new Error("Tu sesión venció. Vuelve a iniciar sesión.");
      const response=await fetch("/api/generate-session",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({mode:"suggestion",field,form})});
      const data=await response.json(); if(!response.ok) throw new Error(data.error||"No se pudo generar la sugerencia");
      update(field,data.suggestion);
    } catch(e) { setError(e.message); } finally { setSuggesting(null); }
  }

  async function handleGenerate() {
    if (step !== 3) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setEvaluationFlow(null);
    setCompletedModules([]);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Tu sesión venció. Vuelve a iniciar sesión.");
      const generated = {};
      for (const moduleName of ["alignment", "sequence", "assessment", "annexes"]) {
        setActiveModule(moduleName);
        const response = await fetch("/api/generate-session", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ mode: "module", module: moduleName, form, previous: generated }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(`${moduleLabels[moduleName]}: ${data.error || "no pudo completarse"}`);
        if (!data.result) throw new Error(`${moduleLabels[moduleName]} no llegó completo.`);
        generated[moduleName] = data.result;
        setCompletedModules((current) => [...current, moduleName]);
      }
      const alignment = generated.alignment;
      const sequence = generated.sequence;
      const assessment = generated.assessment;
      setResult({
        titulo: alignment.titulo,
        areasSTEAM: form.steam ? [form.area, "Enfoque STEAM"] : [form.area],
        competenciasCNEB: [form.competencia],
        capacidadesCNEB: form.capacidades,
        proposito: alignment.proposito,
        desempenosPrecisados: alignment.desempenosPrecisados,
        criteriosDetallados: assessment.criterios,
        criteriosEvaluacion: assessment.criterios.map((item) => item.criterio),
        evidencia: alignment.evidencia,
        enfoquesTransversales: alignment.enfoquesTransversales,
        preparacionDocente: sequence.preparacionDocente,
        materiales: sequence.materiales,
        inicio: sequence.inicio,
        desarrollo: sequence.desarrollo,
        cierre: sequence.cierre,
        tiempos: { inicio: sequence.inicio.minutos, desarrollo: sequence.desarrollo.minutos, cierre: sequence.cierre.minutos },
        orientacionesDUA: sequence.orientacionesDUA,
        instrumentoSugerido: assessment.instrumentoSugerido,
        reflexionesDocente: assessment.reflexionesDocente,
        anexos: generated.annexes.anexos,
        productoSTEAM: alignment.evidencia,
      });
    } catch (e) {
      setError(e.message || `No se pudo generar la ${documentName}. Intenta de nuevo en unos segundos.`);
    } finally {
      setLoading(false);
      setActiveModule(null);
    }
  }

  async function handleDownloadSession() {
    if (!result || downloading) return;
    setDownloading(true); setError(null);
    try { await downloadSessionWord({form,result,documentName,documentType,profile:{nombre:`${profile.nombres||""} ${profile.apellidos||""}`.trim(),ie:profile.ie||""}}); }
    catch (downloadError) { console.error(downloadError); setError("No se pudo preparar el archivo Word. Actualiza la página e inténtalo nuevamente."); }
    finally { setDownloading(false); }
  }

  return (
    <div className="session-wizard">
      <div className="wizard-progress">
        {[{n:1,t:"Datos básicos"},{n:2,t:"Propósito y contexto"},{n:3,t:"Revisión"}].map((item)=><React.Fragment key={item.n}><button className={step>=item.n?"is-active":""} onClick={()=>item.n<step&&setStep(item.n)}><i>{step>item.n?<CheckCircle2 size={15}/>:item.n}</i><span>{item.t}</span></button>{item.n<3&&<b className={step>item.n?"is-complete":""}/>}</React.Fragment>)}
      </div>
      <div className="wizard-caption">Paso {step} de 3</div>

      {step===1&&<div className="wizard-card">
        <div className="wizard-card__title"><span><School size={18}/></span><div><h4>Diseño curricular CNEB</h4><p>Define el nivel, grado, área y datos de la {documentName}.</p></div></div>
        <div className="wizard-fields">
          <label>Nivel educativo *<select value={form.nivel} onChange={e=>changeLevel(e.target.value)}><option>Primaria</option><option>Secundaria</option></select></label>
          <label>Grado *<select value={form.grado} onChange={e=>update("grado",e.target.value)}>{grades.map(g=><option key={g}>{g}</option>)}</select></label>
          <label className="wide">Área curricular *<select value={form.area} onChange={e=>changeArea(e.target.value)}>{GENERATOR_AREAS.map(a=><option key={a}>{a}</option>)}</select></label>
          <label className="wide">Región del docente *<select value={form.region} onChange={e=>update("region",e.target.value)}><option value="">Selecciona una región</option>{PERU_REGIONS.map(r=><option key={r}>{r}</option>)}</select><small className="field-help">Kantu usará referentes pertinentes de la región, sin inventar datos locales específicos.</small></label>
          <label>Sección<input value={form.seccion} onChange={e=>update("seccion",e.target.value)} placeholder="Ej.: A, B o Única"/></label>
          <label>Fecha de la sesión *<input type="date" value={form.fecha} onChange={e=>update("fecha",e.target.value)}/></label>
          <label className="wide">Duración *<select value={form.duracion} onChange={e=>update("duracion",e.target.value)}><option value="45">45 minutos</option><option value="60">60 minutos</option><option value="90">90 minutos</option><option value="120">120 minutos</option></select></label>
        </div>
      </div>}

      {step===2&&<div className="wizard-card">
        <div className="wizard-card__title"><span><Target size={18}/></span><div><h4>Propósito y contexto</h4><p>Cuéntale a Kantu qué necesitan aprender tus estudiantes.</p></div></div>
        <div className="wizard-fields">
          <label className="wide">Tema o título provisional *<input value={form.tema} onChange={e=>update("tema",e.target.value)} placeholder="Ej.: Cuidamos el agua de nuestra comunidad"/></label>
          <label className="wide">Competencia CNEB *<select value={form.competencia} onChange={e=>changeCompetence(e.target.value)}>{GENERATOR_COMPETENCIES[form.area].map(c=><option key={c}>{c}</option>)}</select></label>
          <fieldset className="wide capacity-picker"><legend>Capacidades que se movilizarán *</legend>{(GENERATOR_CAPACITIES[form.competencia]||[]).map(cap=><label key={cap}><input type="checkbox" checked={form.capacidades.includes(cap)} onChange={()=>toggleCapacity(cap)}/><span>{cap}</span></label>)}</fieldset>
          <label className="wide ai-field"><span>Propósito de aprendizaje *</span><button type="button" onClick={()=>suggestField("proposito")} disabled={suggesting==="proposito"}>{suggesting==="proposito"?<Loader2 size={13} className="animate-spin"/>:<Sparkles size={13}/>} Sugerir con Kantu</button><textarea value={form.proposito} onChange={e=>update("proposito",e.target.value)} placeholder="Qué aprenderán, cómo lo demostrarán y para qué les servirá."/></label>
          <label className="wide ai-field"><span>Situación significativa o contexto regional *</span><button type="button" onClick={()=>suggestField("contexto")} disabled={suggesting==="contexto"}>{suggesting==="contexto"?<Loader2 size={13} className="animate-spin"/>:<Sparkles size={13}/>} Sugerir con Kantu</button><textarea value={form.contexto} onChange={e=>update("contexto",e.target.value)} placeholder="Describe brevemente a tus estudiantes, su región o el problema que abordarán."/></label>
          <label className="wide ai-field"><span>Evidencia o producto esperado *</span><button type="button" onClick={()=>suggestField("evidencia")} disabled={suggesting==="evidencia"}>{suggesting==="evidencia"?<Loader2 size={13} className="animate-spin"/>:<Sparkles size={13}/>} Sugerir con Kantu</button><textarea value={form.evidencia} onChange={e=>update("evidencia",e.target.value)} placeholder="¿Qué elaborarán, explicarán o demostrarán al finalizar?"/></label>
          <label className="wide">Recursos disponibles<input value={form.recursos} onChange={e=>update("recursos",e.target.value)} placeholder="Ej.: botellas, cartulina, tabletas, materiales de la comunidad"/></label>
        </div>
        <div className="wizard-switches"><label><input type="checkbox" checked={form.steam} onChange={e=>update("steam",e.target.checked)}/><span><strong>Integrar enfoque STEAM</strong><small>Conecta dos o más áreas mediante un reto.</small></span></label><label><input type="checkbox" checked={form.inclusivo} onChange={e=>update("inclusivo",e.target.checked)}/><span><strong>Incluir orientaciones DUA</strong><small>Considera distintas formas de participar y demostrar lo aprendido.</small></span></label></div>
      </div>}

      {step===3&&<div className="wizard-card wizard-review">
        <div className="wizard-card__title"><span><ClipboardList size={18}/></span><div><h4>Revisa antes de generar</h4><p>Gemini utilizará exactamente esta información.</p></div></div>
        <div className="review-grid"><div><small>Nivel y grado</small><strong>{form.nivel} · {form.grado} {form.seccion&&`· ${form.seccion}`}</strong></div><div><small>Región y área</small><strong>{form.region} · {form.area}</strong></div><div><small>Fecha y duración</small><strong>{form.fecha} · {form.duracion} min</strong></div><div><small>Competencia</small><strong>{form.competencia}</strong></div><div className="wide"><small>Capacidades</small><p>{form.capacidades.join(" · ")}</p></div><div className="wide"><small>Tema</small><strong>{form.tema}</strong></div><div className="wide"><small>Propósito</small><p>{form.proposito}</p></div><div className="wide"><small>Contexto</small><p>{form.contexto}</p></div><div className="wide"><small>Evidencia</small><p>{form.evidencia}</p></div></div>
      </div>}

      {error&&<p className="wizard-error">{error}</p>}
      <div className="wizard-actions">{step>1&&<button className="wizard-back" onClick={()=>{setError(null);setStep(s=>s-1)}}>Anterior</button>}{step<3?<button className="wizard-next" onClick={nextStep}>Continuar <ArrowRight size={15}/></button>:<button className="wizard-next" onClick={handleGenerate} disabled={loading}>{loading?<Loader2 size={16} className="animate-spin"/>:<Sparkles size={16}/>} {loading?"Kantu está creando...":`Generar ${documentName} con IA`}</button>}</div>

      {loading && <div className="kantu-generation-overlay" role="status" aria-live="polite" aria-label="Kantu está generando la sesión">
        <div className="kantu-working kantu-working--overlay">
          <div className="kantu-working__visual"><span className="kantu-orbit"><Sparkles size={15}/></span><img src={documentType === "session" ? "/mascot/kantu-session.png" : "/mascot/kantu-material.png"} alt="Kantu trabajando en el recurso educativo"/></div>
          <div className="kantu-working__copy"><small>KANTU ESTÁ TRABAJANDO</small><h4>{loadingMessages[loadingMessageIndex]}…</h4><p>La sesión aparecerá cuando Kantu termine de revisar cada módulo. No cierres esta ventana.</p><div className="module-generation-status">{Object.entries(moduleLabels).map(([key,label])=><span key={key} className={completedModules.includes(key)?"done":activeModule===key?"active":""}>{completedModules.includes(key)?<CheckCircle2 size={13}/>:activeModule===key?<Loader2 size={13} className="animate-spin"/>:<i/>}{label}</span>)}</div></div>
        </div>
      </div>}

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
          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: C.muted }}>Capacidades movilizadas</p>
          <ul className="text-sm mb-4 space-y-1" style={{ color: C.text }}>{(result.capacidadesCNEB||[]).map((c,i)=><li key={i} className="flex gap-2"><span style={{color:C.teal}}>·</span>{c}</li>)}</ul>

          {!!result.desempenosPrecisados?.length&&<><p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{color:C.muted}}>Desempeños precisados</p><div className="modular-table">{result.desempenosPrecisados.map((item,i)=><div key={i}><small>{item.capacidad}</small><p>{item.desempeno}</p></div>)}</div></>}

          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: C.muted }}>Propósito de aprendizaje</p>
          <p className="text-sm mb-4 leading-relaxed" style={{ color: C.text }}>{result.proposito}</p>
          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: C.muted }}>Criterios de evaluación</p>
          <ul className="text-sm mb-4 space-y-1" style={{ color: C.text }}>{(result.criteriosEvaluacion||[]).map((c,i)=><li key={i} className="flex gap-2"><span style={{color:C.teal}}>·</span>{c}</li>)}</ul>
          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: C.muted }}>Evidencia</p>
          <p className="text-sm mb-4 leading-relaxed" style={{ color: C.text }}>{result.evidencia}</p>
          {!!result.enfoquesTransversales?.length&&<><p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{color:C.muted}}>Enfoques transversales</p><div className="modular-table">{result.enfoquesTransversales.map((item,i)=><div key={i}><small>{item.enfoque} · {item.valor}</small><p>{item.actitudObservable}</p></div>)}</div></>}
          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: C.muted }}>Materiales</p>
          <ul className="text-sm mb-4 space-y-1" style={{ color: C.text }}>
            {(result.materiales || []).map((m, i) => (
              <li key={i} className="flex gap-2"><span style={{ color: C.teal }}>·</span> {m}</li>
            ))}
          </ul>

          <div className="session-moments">
            <section className="session-moment session-moment--start"><header><strong>INICIO</strong><span>{result.inicio?.minutos||result.tiempos?.inicio} min</span></header>{[
              ["Motivación",result.inicio?.motivacion],
              ["Saberes previos",result.inicio?.saberesPrevios],
              ["Problematización",result.inicio?.problematizacion],
              ["Propósito y organización",result.inicio?.propositoOrganizacion],
            ].map(([title,item])=>item&&<div className="moment-subsection" key={title}><h5>{title}</h5><p>{item.descripcion}</p>{!!item.preguntas?.length&&<ul>{item.preguntas.map((q,i)=><li key={i}>{q}</li>)}</ul>}{!!item.criteriosCompartidos?.length&&<><small>CRITERIOS COMPARTIDOS</small><ul>{item.criteriosCompartidos.map((q,i)=><li key={i}>{q}</li>)}</ul></>}</div>)}</section>
            <section className="session-moment session-moment--development"><header><strong>DESARROLLO</strong><span>{result.desarrollo?.minutos||result.tiempos?.desarrollo} min</span></header>{result.desarrollo?.metodologia&&<div className="moment-method"><strong>Metodología</strong><p>{result.desarrollo.metodologia}</p></div>}{(result.desarrollo?.procesos||[]).map((item,index)=><div className="moment-subsection" key={index}><h5>{item.subtitulo}</h5><p>{item.actividad}</p>{!!item.preguntasMediacion?.length&&<><small>PREGUNTAS DE MEDIACIÓN</small><ul>{item.preguntasMediacion.map((q,i)=><li key={i}>{q}</li>)}</ul></>}<div className="moment-support"><p><strong>Acompañamiento:</strong> {item.acompanamiento}</p><p><strong>Evaluación formativa:</strong> {item.evaluacionFormativa}</p></div></div>)}</section>
            <section className="session-moment session-moment--close"><header><strong>CIERRE</strong><span>{result.cierre?.minutos||result.tiempos?.cierre} min</span></header>{[
              ["Metacognición",result.cierre?.metacognicion],
              ["Evaluación",result.cierre?.evaluacion],
              ["Cierre y transferencia",result.cierre?.transferencia],
            ].map(([title,item])=>item&&<div className="moment-subsection" key={title}><h5>{title}</h5><p>{item.descripcion}</p>{!!item.preguntas?.length&&<ul>{item.preguntas.map((q,i)=><li key={i}>{q}</li>)}</ul>}{item.mensajeLogro&&<blockquote>{item.mensajeLogro}</blockquote>}{item.consigna&&<blockquote>{item.consigna}</blockquote>}</div>)}</section>
          </div>

          {!!result.orientacionesDUA?.length&&<div className="modular-section"><h5>Orientaciones DUA</h5><ul>{result.orientacionesDUA.map((item,i)=><li key={i}>{item}</li>)}</ul></div>}
          {!!result.anexos?.length&&<div className="modular-section"><h5>Anexos generados</h5>{result.anexos.map((item,i)=><details key={i}><summary>Anexo {i+1}: {item.titulo}</summary><small>{item.tipo} · {item.proposito}</small><p>{item.contenido}</p><strong>Indicaciones:</strong><p>{item.instrucciones}</p></details>)}</div>}

          <div className="mt-4 rounded-lg p-4" style={{ background: "rgba(62,198,192,0.06)", borderLeft: `3px solid ${C.teal}` }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: C.teal }}>{sectionLabels[3]}</p>
            <p className="text-sm leading-relaxed" style={{ color: C.text }}>{result.productoSTEAM}</p>
          </div>

          <button
            onClick={handleDownloadSession}
            disabled={downloading}
            className="mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold"
            style={{ background: "rgba(15,61,58,0.08)", color: C.text, border: `1px solid ${C.line}` }}
          >
            {downloading?<Loader2 size={14} className="animate-spin"/>:<Download size={14} />} {downloading?"Preparando Word...":`Descargar ${documentName} en Word`}
          </button>
          {!evaluationFlow&&<button onClick={()=>setEvaluationFlow("choose")} className="session-next-step"><span><ClipboardList size={18}/><i><strong>Siguiente paso</strong><small>Crear el instrumento con los criterios y la evidencia de esta sesión</small></i></span>Continuar con evaluación <ArrowRight size={16}/></button>}
          {evaluationFlow==="choose"&&<div className="evaluation-flow-picker"><div className="evaluation-flow-head"><div><small>PASO 3 DE 4</small><h3>Instrumento de evaluación</h3><p>El contexto de la sesión ya está cargado. Elige el instrumento que utilizarás.</p></div><button onClick={()=>setEvaluationFlow(null)}>Cerrar</button></div><div className="evaluation-type-grid">
            <button className="available" onClick={()=>setEvaluationFlow("rubric")}><span><ClipboardList size={22}/></span><strong>Rúbrica analítica</strong><small>Sugerida para valorar niveles de logro</small><b>Crear rúbrica <ArrowRight size={14}/></b></button>
            <button className="available" onClick={()=>setEvaluationFlow("checklist")}><span><CheckCircle2 size={22}/></span><strong>Lista de cotejo</strong><small>Verificación rápida con Sí, No y observaciones</small><b>Crear lista <ArrowRight size={14}/></b></button>
            <button disabled><span><BookOpen size={22}/></span><strong>Guía de observación</strong><small>Próximamente</small></button>
            <button disabled><span><Target size={22}/></span><strong>Escala de valoración</strong><small>Próximamente</small></button>
          </div></div>}
          {(evaluationFlow==="rubric"||evaluationFlow==="checklist")&&<div className="linked-instrument-flow"><div className="linked-instrument-head"><div><small>INSTRUMENTO VINCULADO A LA SESIÓN</small><h3>{evaluationFlow==="rubric"?"Rúbrica analítica":"Lista de cotejo"}</h3><p>{form.area} · {form.grado} · {result.titulo}</p></div><button onClick={()=>setEvaluationFlow("choose")}>Cambiar instrumento</button></div><EvaluationInstrumentGenerator profile={profile} initialGrade={initialGrade} instrumentType={evaluationFlow} initialContext={{nivel:form.nivel,grado:form.grado,area:form.area,region:form.region,tema:result.titulo||form.tema,competencia:form.competencia,capacidades:form.capacidades,evidencia:result.evidencia,proposito:result.proposito,fecha:form.fecha,duracion:form.duracion,seccion:form.seccion,criteriosBase:result.criteriosDetallados||[],numeroCriterios:String(result.criteriosDetallados?.length||6)}} /></div>}
        </div>
      )}
    </div>
  );
}

function EvaluationInstrumentGenerator({ initialGrade = "primaria", instrumentType = "checklist", initialContext = null, profile = {} }) {
  const isRubric = instrumentType === "rubric";
  const instrumentName = isRubric ? "rúbrica" : "lista de cotejo";
  const initialLevel = initialGrade === "secundaria" ? "Secundaria" : "Primaria";
  const [step, setStep] = useState(initialContext ? 3 : 1);
  const [form, setForm] = useState(initialContext || { nivel: initialLevel, grado: initialLevel === "Primaria" ? "3.º" : "1.º", area: "Ciencia y Tecnología", region: "", tema: "", competencia: CNEB.indaga, capacidades: GENERATOR_CAPACITIES[CNEB.indaga], evidencia: "", numeroCriterios: "6" });
  const [instrument, setInstrument] = useState(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState(null);
  const grades = form.nivel === "Primaria" ? ["1.º", "2.º", "3.º", "4.º", "5.º", "6.º"] : ["1.º", "2.º", "3.º", "4.º", "5.º"];
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const changeLevel = (nivel) => setForm((current) => ({ ...current, nivel, grado: "1.º" }));
  const changeArea = (area) => { const competencia = GENERATOR_COMPETENCIES[area][0]; setForm((current) => ({ ...current, area, competencia, capacidades: GENERATOR_CAPACITIES[competencia] || [] })); };
  const changeCompetence = (competencia) => setForm((current) => ({ ...current, competencia, capacidades: GENERATOR_CAPACITIES[competencia] || [] }));
  const toggleCapacity = (capacity) => setForm((current) => ({ ...current, capacidades: current.capacidades.includes(capacity) ? current.capacidades.filter((item) => item !== capacity) : [...current.capacidades, capacity] }));

  async function getToken() { const { data } = await supabase.auth.getSession(); const token = data.session?.access_token; if (!token) throw new Error("Tu sesión venció. Vuelve a iniciar sesión."); return token; }
  async function suggestEvidence() {
    if (!form.tema.trim() || !form.region || !form.capacidades.length) return setError("Completa el tema, la región y las capacidades para que Kantu pueda sugerir la evidencia.");
    setSuggesting(true); setError(null);
    try { const token = await getToken(); const response = await fetch("/api/generate-session", { method:"POST", headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`}, body:JSON.stringify({mode:"suggestion",field:"evidencia",form}) }); const data=await response.json(); if(!response.ok) throw new Error(data.error||"No se pudo sugerir la evidencia"); update("evidencia",data.suggestion); } catch(e) { setError(e.message); } finally { setSuggesting(false); }
  }
  function continueFlow() {
    setError(null);
    if (step === 1 && (!form.nivel || !form.grado || !form.area || !form.region || !form.tema.trim() || !form.competencia || !form.capacidades.length)) return setError("Completa el contexto curricular y selecciona al menos una capacidad.");
    if (step === 2 && !form.evidencia.trim()) return setError("Escribe la evidencia o solicita una sugerencia a Kantu.");
    setStep((current) => Math.min(3, current + 1));
  }
  async function generateInstrument() {
    setLoading(true); setError(null); setInstrument(null);
    try { const token=await getToken(); const response=await fetch("/api/generate-session",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({mode:"instrument",instrumentType,form})}); const data=await response.json(); if(!response.ok) throw new Error(data.error||`No se pudo generar la ${instrumentName}`); if(!data.instrument) throw new Error("El instrumento no llegó completo. Intenta nuevamente."); setInstrument(data.instrument); setEditing(false); } catch(e){setError(e.message);} finally{setLoading(false);}
  }
  function updateCriterion(index, key, value) { setInstrument((current) => ({ ...current, criterios: current.criterios.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item) })); }
  async function downloadInstrument() {
    setDownloading(true); setError(null);
    try {
      if(isRubric){ await downloadRubricWord({form,instrument,profile}); return; }
      await downloadChecklistWord({form,instrument,profile}); return;
    } catch(e){ setError(`No se pudo preparar el Word: ${e.message}`); } finally { setDownloading(false); }
  }

  return <div className="instrument-builder">
    <div className="instrument-steps">{["Contexto","Evidencia","Revisión"].map((label,index)=><div key={label} className={step>=index+1?"active":""}><b>{step>index+1?<CheckCircle2 size={14}/>:index+1}</b><span>{label}</span></div>)}</div>
    {step===1&&<div className="wizard-card"><div className="wizard-card__title"><span><GraduationCap size={18}/></span><div><h4>Contexto del instrumento</h4><p>Kantu utilizará esta información para alinearlo al CNEB.</p></div></div><div className="wizard-fields instrument-context-grid">
      <label>Nivel *<select value={form.nivel} onChange={e=>changeLevel(e.target.value)}><option>Primaria</option><option>Secundaria</option></select></label><label>Grado *<select value={form.grado} onChange={e=>update("grado",e.target.value)}>{grades.map(g=><option key={g}>{g}</option>)}</select></label><label>Área *<select value={form.area} onChange={e=>changeArea(e.target.value)}>{GENERATOR_AREAS.map(a=><option key={a}>{a}</option>)}</select></label>
      <label>Región *<select value={form.region} onChange={e=>update("region",e.target.value)}><option value="">Selecciona una región</option>{PERU_REGIONS.map(r=><option key={r}>{r}</option>)}</select></label><label className="wide">Tema *<input value={form.tema} onChange={e=>update("tema",e.target.value)} placeholder="Ej.: Cuidamos el agua de la comunidad"/></label>
      <label className="wide">Competencia *<select value={form.competencia} onChange={e=>changeCompetence(e.target.value)}>{GENERATOR_COMPETENCIES[form.area].map(c=><option key={c}>{c}</option>)}</select></label>
      <fieldset className="wide capacity-picker"><legend>Capacidades que serán evaluadas *</legend>{(GENERATOR_CAPACITIES[form.competencia]||[]).map(cap=><label key={cap}><input type="checkbox" checked={form.capacidades.includes(cap)} onChange={()=>toggleCapacity(cap)}/><span>{cap}</span></label>)}</fieldset>
    </div></div>}
    {step===2&&<div className="wizard-card"><div className="wizard-card__title"><span><Target size={18}/></span><div><h4>Evidencia de aprendizaje</h4><p>Indica qué producirá o realizará el estudiante para demostrar lo aprendido.</p></div></div><div className="evidence-editor"><div><strong>{form.competencia}</strong><small>{form.capacidades.length} capacidades seleccionadas</small></div><button onClick={suggestEvidence} disabled={suggesting}>{suggesting?<Loader2 size={15} className="animate-spin"/>:<Sparkles size={15}/>} Sugerir con Kantu</button><textarea value={form.evidencia} onChange={e=>update("evidencia",e.target.value)} placeholder="Describe el producto, actuación o desempeño observable..."/></div><label className="criteria-count">Cantidad de criterios<select value={form.numeroCriterios} onChange={e=>update("numeroCriterios",e.target.value)}>{[4,5,6,7,8,9,10].map(n=><option key={n}>{n}</option>)}</select></label></div>}
    {step===3&&!instrument&&<div className="wizard-card instrument-review"><div className="wizard-card__title"><span><ClipboardList size={18}/></span><div><h4>{initialContext?"Contexto recuperado de la sesión":"Revisa el contexto"}</h4><p>{initialContext?"Kantu utilizará la competencia, capacidades, criterios y evidencia ya generados.":"Puedes volver y editar cualquier dato antes de generar."}</p></div></div><div className="context-summary"><div><small>Contexto</small><strong>{form.area} · {form.grado} · {form.region}</strong><p>{form.tema}</p></div>{!initialContext&&<button onClick={()=>setStep(1)}>Editar contexto</button>}</div><div className="context-summary"><div><small>Evidencia</small><p>{form.evidencia}</p></div>{!initialContext&&<button onClick={()=>setStep(2)}>Editar evidencia</button>}</div></div>}
    {error&&<p className="wizard-error">{error}</p>}
    {!instrument&&<div className="wizard-actions">{step>1&&!initialContext&&<button className="wizard-back" onClick={()=>setStep(s=>s-1)}>Anterior</button>}{step<3?<button className="wizard-next" onClick={continueFlow}>Continuar <ArrowRight size={15}/></button>:<button className="wizard-next" onClick={generateInstrument} disabled={loading}>{loading?<Loader2 size={16} className="animate-spin"/>:<Sparkles size={16}/>} {loading?"Kantu está trabajando...":`Generar ${instrumentName}`}</button>}</div>}
    {loading&&<div className="kantu-working"><div className="kantu-working__visual"><span className="kantu-orbit"><Sparkles size={15}/></span><img src="/mascot/kantu-material.png" alt="Kantu creando el instrumento"/></div><div className="kantu-working__copy"><small>KANTU ESTÁ TRABAJANDO</small><h4>Está construyendo criterios observables y alineados…</h4><p>Está revisando la competencia, las capacidades y la evidencia de aprendizaje.</p><div className="kantu-progress"><i/><i/><i/></div></div></div>}
    {instrument&&<div className="instrument-result"><div className="instrument-result__actions"><div><small>INSTRUMENTO GENERADO</small><h3>{instrument.titulo}</h3></div><div><button onClick={()=>setEditing(!editing)}><Pencil size={14}/>{editing?"Terminar edición":"Editar"}</button><button onClick={generateInstrument}><RotateCw size={14}/>Regenerar</button><button className="primary" onClick={downloadInstrument}><Download size={14}/>Word</button></div></div><div className="instrument-meta"><strong>Competencia evaluada</strong><p>{instrument.competencia}</p><strong>Capacidades</strong><ul>{instrument.capacidades.map((item,index)=><li key={index}>{item}</li>)}</ul><strong>Evidencia de aprendizaje</strong>{editing?<textarea value={instrument.evidencia} onChange={e=>setInstrument(current=>({...current,evidencia:e.target.value}))}/>:<p>{instrument.evidencia}</p>}</div><div className="instrument-table-wrap"><table className={isRubric?"rubric-table":"checklist-table"}><thead><tr><th>N.º</th><th>Criterio de evaluación</th>{isRubric?<><th>Inicio</th><th>En proceso</th><th>Logro esperado</th><th>Logro destacado</th></>:<><th>Sí</th><th>No</th><th>Observaciones</th></>}</tr></thead><tbody>{instrument.criterios.map((item,index)=><tr key={index}><td>{index+1}</td><td>{editing?<textarea value={item.criterio} onChange={e=>updateCriterion(index,"criterio",e.target.value)}/>:<><small>{item.capacidad}</small>{item.criterio}</>}</td>{isRubric?<>{["inicio","enProceso","logroEsperado","logroDestacado"].map(key=><td key={key}>{editing?<textarea value={item[key]} onChange={e=>updateCriterion(index,key,e.target.value)}/>:item[key]}</td>)}</>:<><td><i className="empty-check"/></td><td><i className="empty-check"/></td><td><span className="observation-line"/></td></>}</tr>)}</tbody></table></div></div>}
  </div>;
}

function CreateStudio({ preferredGrade = "primaria", profile = {} }) {
  const [creation, setCreation] = useState(null);
  const creationOptions = [
    { id: "session", label: "Sesión de aprendizaje", desc: "Planificación completa con propósito, criterios, evidencia y secuencia didáctica.", icon: BookOpen, tone: "teal" },
    { id: "project", label: "Proyecto STEAM", desc: "Reto, producto final, fases, recursos y evaluación para aprender creando.", icon: Cog, tone: "coral" },
    { id: "rubric", label: "Rúbrica", desc: "Criterios observables y niveles de logro alineados a las capacidades.", icon: ClipboardList, tone: "violet" },
    { id: "checklist", label: "Lista de cotejo", desc: "Indicadores claros y verificables para registrar Sí, No o En proceso.", icon: CheckCircle2, tone: "yellow" },
  ];
  const selectedType = creationOptions.find((item) => item.id === creation);

  return (
    <div className="create-studio">
      <div className="create-studio__intro">
        <div>
          <span className="create-studio__eyebrow"><Sparkles size={13} /> KANTU TE ACOMPAÑA</span>
          <h2>¿Qué quieres crear hoy?</h2>
          <p>Empieza un recurso nuevo. Todo lo que generes se guardará próximamente en «Mi biblioteca».</p>
        </div>
        <div className="create-studio__nova"><img src="/mascot/kantu-material.png" alt="Kantu, vicuña científica peruana de SciVerse" /><span><strong>¡Hola! Soy Kantu</strong><small>Crearemos paso a paso</small></span></div>
      </div>

      {!creation && <div className="creation-type-grid">{creationOptions.map(({id,label,desc,icon:Icon,tone})=><button key={id} className={`creation-type-card ${tone}`} onClick={()=>setCreation(id)}><span><Icon size={22}/></span><div><small>CREAR CON IA</small><h3>{label}</h3><p>{desc}</p><b>Comenzar <ArrowRight size={15}/></b></div></button>)}</div>}

      {creation && <div className="create-generator-wrap">
        <div className="create-generator-head"><div><span>CREANDO CON KANTU</span><h3>{selectedType?.label}</h3><p>{selectedType?.desc}</p></div><button onClick={()=>setCreation(null)}>← Elegir otro producto</button></div>
        {(creation === "rubric" || creation === "checklist") ? <EvaluationInstrumentGenerator profile={profile} initialGrade={preferredGrade} instrumentType={creation} /> : <SteamGenerator initialGrade={preferredGrade} documentType={creation} profile={profile} />}
      </div>}
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
    { icon: ClipboardList, title: "Guías para el aula", desc: "Actividades paso a paso, diferenciadas para primaria y secundaria.", color: C.yellow },
    { icon: Award, title: "Plantillas CNEB", desc: "Rúbricas, fichas y recursos editables para acompañar el aprendizaje.", color: "#8B5CF6" },
    { icon: Users, title: "Retos colaborativos", desc: "Propuestas para aprender haciendo, dialogando y creando en equipo.", color: "#FB7185" },
    { icon: BookOpen, title: "Cinco áreas STEAM", desc: "Ciencia, Tecnología, Ingeniería, Arte y Matemática conectadas.", color: "#4FA8FF" },
  ];
  const plans = [
    { name: "Gratuito", price: "0", period: "para conocer SciVerse", saving: "Sin tarjeta", featured: false, benefits: ["Actividades de muestra", "1 generación con IA", "Recursos de demostración"] },
    { name: "Mensual", price: "10", period: "por 1 mes", saving: "Ideal para empezar", featured: false, benefits: ["30 generaciones con IA", "Actividades STEAM", "Fichas y plantillas", "Soporte por WhatsApp"] },
    { name: "Semestral", price: "30", period: "por 6 meses", saving: "Equivale a S/5 al mes", featured: true, benefits: ["60 generaciones mensuales", "Actividades STEAM", "Descargas en Word", "Nuevos recursos", "Soporte prioritario"] },
    { name: "Anual", price: "50", period: "por 12 meses", saving: "Equivale a S/4.17 al mes", featured: false, benefits: ["100 generaciones mensuales", "Acceso completo anual", "Primaria o secundaria", "Descargas en Word", "Nuevos recursos", "Soporte prioritario"] },
  ];
  const faqs = [
    ["¿Qué puedo crear con SciVerse?", "Puedes generar sesiones y actividades STEAM, consultar experiencias guiadas y descargar fichas y plantillas."],
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
          <p>Explora recursos alineados al CNEB, actividades adaptadas para primaria y secundaria y un generador de sesiones con inteligencia artificial.</p>
          <div className="hero-actions">
            <button onClick={onRegister} className="primary-btn">Empezar gratis <ArrowRight size={17} /></button>
            <a href="#demo" className="secondary-btn"><Microscope size={17} /> Ver demostración</a>
          </div>
          <div className="trust-line"><span>✓ Sin costo para docentes</span><span>✓ Acceso en menos de un minuto</span><span>✓ En español</span></div>
        </div>
        <div className="hero-visual" aria-label="Vista previa de las herramientas de SciVerse">
          <div className="visual-orbit orbit-one" /><div className="visual-orbit orbit-two" />
          <div className="hero-dashboard">
            <div className="dashboard-top"><span className="dot coral" /><span className="dot yellow" /><span className="dot teal" /><small>Estudio creativo SciVerse</small></div>
            <div className="dashboard-body">
              <div className="science-core"><Atom size={58} /><span>Explora · Crea · Comparte</span></div>
              <div className="tool-row"><span><Wand2 size={16} /> IA educativa</span><span><ClipboardList size={16} /> Recursos CNEB</span></div>
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
      { icon: ClipboardList, title: "Guías de experiencias", desc: "Fichas paso a paso, listas para llevar directo al aula.", color: C.teal },
      { icon: Target, title: "Evaluación formativa", desc: "Criterios, evidencias y recursos alineados al aprendizaje.", color: C.yellow },
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
            <Sparkles size={13} /> Recursos STEAM · Alineados al CNEB
          </span>
          <h1 className="text-4xl md:text-6xl font-semibold leading-tight mb-6" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Lleva experiencias STEAM a tu aula
          </h1>
          <p className="text-lg max-w-2xl mx-auto mb-9" style={{ color: C.muted }}>
            Accede a experiencias de aprendizaje STEAM en Ciencia, Tecnología, Ingeniería, Arte y Matemática, con fichas para primaria y secundaria y un generador de sesiones con IA.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button onClick={goToForm} className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold" style={{ background: C.teal, color: "#0B2B29" }}>
              Accede a los recursos STEAM <ArrowRight size={16} />
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
              Regístrate una vez y accede a los recursos educativos, sin costo.
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
          Regístrate una vez para acceder a las fichas, los retos y el generador de sesiones STEAM.
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
              downloadWord(
                `${activity.id}-${grade}.docx`,
                `Nivel: ${grade === "primaria" ? "Primaria" : "Secundaria"}\n\nCompetencia CNEB:\n${activity.competencia}\n\nObjetivo:\n${v.objetivo}\n\nDuración:\n${v.duracion}\n\nMateriales:\n${v.materiales.map((m) => "- " + m).join("\n")}\n\nPasos:\n${v.pasos.map((p, i) => `${i + 1}. ${p}`).join("\n")}\n\nCierre:\n${v.cierre}`,
                activity.title
              )
            }
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold"
            style={{ background: accent, color: "#0B2B29" }}
          >
            <Download size={16} /> Descargar en Word
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

function TeacherAccountModal({ profile, onClose }) {
  const [tab, setTab] = useState("perfil");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ nombres: profile.nombres || "", apellidos: profile.apellidos || "", ie: profile.ie || "", celular: profile.celular || "", nivel: profile.nivel || "primaria" });
  const referralUrl = `${window.location.origin}/?ref=${(profile.userId || "docente").slice(0, 8)}`;
  const joined = profile.createdAt ? new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "long", year: "numeric" }).format(new Date(profile.createdAt)) : "Cuenta activa";
  const tabs = [
    ["perfil", User, "Perfil"], ["plan", Sparkles, "Plan"], ["referidos", Gift, "Referidos"], ["capacitacion", GraduationCap, "Capacitación"], ["integraciones", Link2, "Integraciones"],
  ];
  async function saveProfile() {
    setSaving(true); setNotice("");
    const { error } = await supabase.auth.updateUser({ data: { ...form } });
    setSaving(false);
    if (error) return setNotice("No pudimos guardar los cambios.");
    setNotice("Perfil actualizado correctamente. Los cambios se verán completamente al volver a iniciar sesión.");
    setEditing(false);
  }
  async function copyReferral() {
    await navigator.clipboard.writeText(referralUrl);
    setNotice("Enlace copiado.");
  }
  return <div className="account-backdrop" onMouseDown={onClose}>
    <section className="account-modal" role="dialog" aria-modal="true" aria-label="Mi cuenta" onMouseDown={(event) => event.stopPropagation()}>
      <header><div><h2>Mi cuenta</h2><p>Información de tu perfil, plan y beneficios docentes.</p></div><button onClick={onClose} aria-label="Cerrar"><X size={20} /></button></header>
      <div className="account-layout">
        <nav className="account-tabs">{tabs.map(([key, Icon, label]) => <button key={key} className={tab === key ? "active" : ""} onClick={() => { setTab(key); setNotice(""); }}><Icon size={16} />{label}</button>)}</nav>
        <div className="account-content">
          {tab === "perfil" && <div>
            <div className="profile-summary"><span>{(profile.nombres?.[0] || "D").toUpperCase()}{(profile.apellidos?.[0] || "").toUpperCase()}</span><div><h3>{profile.nombres} {profile.apellidos}</h3><p>{profile.correo}</p><small>DOCENTE · CUENTA PERSONAL</small></div></div>
            {editing ? <div className="profile-form"><label>Nombres<input value={form.nombres} onChange={(e) => setForm({...form,nombres:e.target.value})} /></label><label>Apellidos<input value={form.apellidos} onChange={(e) => setForm({...form,apellidos:e.target.value})} /></label><label className="wide">Institución educativa<input value={form.ie} onChange={(e) => setForm({...form,ie:e.target.value})} /></label><label>Celular<input value={form.celular} onChange={(e) => setForm({...form,celular:e.target.value})} /></label><label>Nivel<select value={form.nivel} onChange={(e) => setForm({...form,nivel:e.target.value})}><option value="primaria">Primaria</option><option value="secundaria">Secundaria</option></select></label><div className="wide account-actions"><button className="secondary-btn compact" onClick={() => setEditing(false)}>Cancelar</button><button className="primary-btn compact" onClick={saveProfile} disabled={saving}>{saving ? "Guardando..." : "Guardar cambios"}</button></div></div> : <div className="profile-rows"><div><span>Nombre completo</span><strong>{profile.nombres} {profile.apellidos}</strong><button onClick={() => setEditing(true)}>Cambiar</button></div><div><span>Correo</span><strong>{profile.correo}</strong></div><div><span>Rol</span><strong>Docente</strong></div><div><span>Nivel</span><strong className="capitalize">{profile.nivel}</strong></div><div><span>Institución</span><strong>{profile.ie || "Sin institución asignada"}</strong></div><div><span>Miembro desde</span><strong>{joined}</strong></div></div>}
          </div>}
          {tab === "plan" && <div><div className="account-heading"><span><Sparkles size={19} /></span><div><h3>Plan gratuito</h3><p>Tu uso actual en SciVerse</p></div></div><div className="usage-box"><Usage label="Generaciones con IA" current="0" total="1" /><Usage label="Materiales guardados" current="0" total="5" /><Usage label="Descargas" current="0" total="5" /></div><div className="account-plan-grid"><PlanMini name="Mensual" price="10" text="30 generaciones y descargas" /><PlanMini name="Semestral" price="30" text="60 generaciones mensuales" featured /><PlanMini name="Anual" price="50" text="100 generaciones mensuales" /></div></div>}
          {tab === "referidos" && <div><div className="account-heading"><span><Gift size={19} /></span><div><h3>Invita a otro docente</h3><p>Comparte SciVerse con tu comunidad educativa.</p></div></div><label className="referral-link"><input readOnly value={referralUrl} /><button onClick={copyReferral}><Copy size={15} /> Copiar</button></label><a className="whatsapp-share" href={`https://wa.me/?text=${encodeURIComponent(`Te invito a conocer SciVerse de Teaching TIC: ${referralUrl}`)}`} target="_blank" rel="noreferrer"><MessageCircle size={17} /> Compartir por WhatsApp</a><div className="referral-stats"><div><strong>0</strong><span>Invitaciones registradas</span></div><div><strong>0</strong><span>Docentes que se unieron</span></div></div></div>}
          {tab === "capacitacion" && <div><span className="training-benefit"><Sparkles size={14} /> BENEFICIO TEACHING TIC</span><h3 className="training-title">Capacítate en vivo y fortalece tu portafolio docente</h3><p className="training-lead">Participa en sesiones virtuales desarrolladas por especialistas de Teaching TIC y recibe una constancia digital.</p><div className="training-points"><p><span><Video size={17} /></span><b>Capacitación en vivo.</b> Aprende, practica y resuelve tus dudas.</p><p><span><BadgeCheck size={17} /></span><b>Constancia digital.</b> Lista para tu CV y portafolio docente.</p><p><span><BookOpen size={17} /></span><b>Aplicación educativa.</b> IA, STEAM y recursos alineados al CNEB.</p></div><div className="training-card"><small>PRÓXIMA CAPACITACIÓN</small><h4>Inteligencia artificial para crear experiencias STEAM</h4><p>Fecha y horario por confirmar · Modalidad virtual</p><a href="https://wa.me/51921090875?text=Hola%20Teaching%20TIC%2C%20deseo%20reservar%20un%20cupo%20en%20la%20pr%C3%B3xima%20capacitaci%C3%B3n%20de%20SciVerse." target="_blank" rel="noreferrer">Reservar mi cupo <ArrowRight size={15} /></a></div></div>}
          {tab === "integraciones" && <div><div className="account-heading"><span><Link2 size={19} /></span><div><h3>Integraciones</h3><p>Próximamente podrás enviar tus materiales a otras plataformas.</p></div></div><Integration icon={HardDrive} name="Google Drive" text="Guarda tus sesiones y fichas en Drive" /><Integration icon={Palette} name="Canva" text="Edita tus recursos con diseños visuales" /></div>}
          {notice && <p className="account-notice">{notice}</p>}
        </div>
      </div>
    </section>
  </div>;
}

function Usage({ label, current, total }) { return <div><p><span>{label}</span><b>{current} / {total}</b></p><span><i style={{width:`${Math.min(100,(Number(current)/Number(total))*100)}%`}} /></span></div>; }
function PlanMini({ name, price, text, featured }) { return <article className={featured ? "featured" : ""}>{featured && <small>RECOMENDADO</small>}<h4>{name}</h4><strong>S/{price}</strong><p>{text}</p><a href={`https://wa.me/51921090875?text=${encodeURIComponent(`Hola Teaching TIC, deseo adquirir el Plan ${name} de SciVerse por S/${price}.`)}`} target="_blank" rel="noreferrer">Elegir plan</a></article>; }
function Integration({ icon: Icon, name, text }) { return <div className="integration-row"><span><Icon size={20} /></span><div><strong>{name}</strong><p>{text}</p></div><button disabled>Próximamente</button></div>; }

function SciVerseApp({ profile, onLogout }) {
  const preferredGrade = profile.nivel === "secundaria" ? "secundaria" : "primaria";
  const [heroGrade, setHeroGrade] = useState(preferredGrade);
  const [gradeFilter, setGradeFilter] = useState(preferredGrade);
  const [subjectFilter, setSubjectFilter] = useState("todos");
  const [selected, setSelected] = useState(null);
  const [modalGrade, setModalGrade] = useState(preferredGrade);
  const [accountOpen, setAccountOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("inicio");

  const filtered = ACTIVITIES.filter((a) => subjectFilter === "todos" || a.subject === subjectFilter);
  const filteredRetos = RETOS.filter((r) => gradeFilter === "todos" || r.grades.includes(gradeFilter));

  const openActivity = (a) => {
    setSelected(a);
    setModalGrade(heroGrade);
  };

  const heroAccent = heroGrade === "primaria" ? C.amber : C.cyan;

  return (
    <div className="teacher-app-shell" style={{ background: C.bg, color: C.text, minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap');
        @media print {
          body * { visibility: hidden; }
          .printable, .printable * { visibility: visible; }
          .printable { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <aside className="teacher-sidebar">
        <button className="sidebar-brand" onClick={()=>setActiveSection("inicio")}><span><Microscope size={22} /></span><div><strong>SciVerse</strong><small>Teaching TIC</small></div></button>
        <nav className="sidebar-menu" aria-label="Panel docente">
          <button className={activeSection==="inicio"?"active":""} onClick={()=>setActiveSection("inicio")}><LayoutDashboard size={18} /> Inicio</button>
          <span>Recursos docentes</span>
          <button className={activeSection==="actividades"?"active":""} onClick={()=>setActiveSection("actividades")}><ClipboardList size={18} /> Actividades</button>
          <button className={activeSection==="crear"?"active":""} onClick={()=>setActiveSection("crear")}><Wand2 size={18} /> Crear con IA</button>
          <button className={activeSection==="retos"?"active":""} onClick={()=>setActiveSection("retos")}><Users size={18} /> Retos grupales</button>
          <button className={activeSection==="biblioteca"?"active":""} onClick={()=>setActiveSection("biblioteca")}><FolderOpen size={18} /> Mi biblioteca</button>
        </nav>
        <div className="sidebar-bottom">
          <a className="sidebar-plan" href="https://wa.me/51921090875?text=Hola%20Teaching%20TIC%2C%20deseo%20mejorar%20mi%20plan%20de%20SciVerse." target="_blank" rel="noreferrer"><Award size={17} /><div><small>Plan actual</small><strong>Gratuito</strong></div><ChevronRight size={15} /></a>
          <button onClick={() => setAccountOpen(true)}><User size={17} /> Mi cuenta</button>
          <button onClick={onLogout}><LogOut size={17} /> Cerrar sesión</button>
        </div>
      </aside>

      <nav className="teacher-topbar flex items-center justify-between px-6 md:px-10 py-5 sticky top-0 z-30" style={{ background: "rgba(255,255,255,0.88)", backdropFilter: "blur(8px)", borderBottom: `1px solid ${C.lineSoft}` }}>
        <div className="flex items-center gap-2">
          <Microscope size={20} color={C.teal} />
          <span className="text-lg font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            SciVerse <span style={{ color: C.muted, fontWeight: 400 }}>para Docentes</span>
          </span>
        </div>
        <span className="hidden md:inline text-xs" style={{ color: C.muted }}>Panel docente · Recursos alineados al CNEB</span>
        <div className="flex items-center gap-3">
          <button onClick={() => setAccountOpen(true)} className="hidden sm:inline text-sm" style={{ color: C.muted }}>
            Hola, <strong style={{ color: C.text }}>{profile.nombres}</strong> · {heroGrade === "primaria" ? "Primaria" : "Secundaria"}
          </button>
          <button onClick={onLogout} className="p-1.5 rounded-lg" style={{ color: C.muted }} title="Cerrar sesión">
            <LogOut size={16} />
          </button>
        </div>
      </nav>

      <nav className="teacher-mobile-nav" aria-label="Navegación móvil del panel">
        <button className={activeSection==="inicio"?"active":""} onClick={()=>setActiveSection("inicio")}><LayoutDashboard size={17}/><span>Inicio</span></button>
        <button className={activeSection==="actividades"?"active":""} onClick={()=>setActiveSection("actividades")}><ClipboardList size={17}/><span>Actividades</span></button>
        <button className={activeSection==="crear"?"active":""} onClick={()=>setActiveSection("crear")}><Wand2 size={18}/><span>Crear</span></button>
        <button className={activeSection==="retos"?"active":""} onClick={()=>setActiveSection("retos")}><Users size={17}/><span>Retos</span></button>
        <button className={activeSection==="biblioteca"?"active":""} onClick={()=>setActiveSection("biblioteca")}><FolderOpen size={17}/><span>Biblioteca</span></button>
      </nav>

      {activeSection === "inicio" && <section id="inicio-docente" className="teacher-dashboard">
        <div className="dashboard-welcome">
          <div>
            <span className="dashboard-kicker"><LayoutDashboard size={14} /> Panel del docente</span>
            <h1>¡Hola, {profile.nombres}! 👋</h1>
            <p>¿Qué deseas preparar hoy para tus estudiantes de {preferredGrade}?</p>
          </div>
          <button className="dashboard-profile" onClick={() => setAccountOpen(true)}>
            <span>{(profile.nombres?.[0] || "D").toUpperCase()}{(profile.apellidos?.[0] || "").toUpperCase()}</span>
            <div><strong>{profile.nombres} {profile.apellidos}</strong><small>{profile.ie || "Docente Teaching TIC"}</small></div>
          </button>
        </div>

        <div className="dashboard-stats">
          <article><span className="stat-icon teal"><Sparkles size={19} /></span><div><small>Generaciones disponibles</small><strong>1</strong><p>Plan gratuito</p></div></article>
          <article><span className="stat-icon coral"><FolderOpen size={19} /></span><div><small>Mis materiales</small><strong>0</strong><p>Empieza creando una sesión</p></div></article>
          <article><span className="stat-icon yellow"><School size={19} /></span><div><small>Nivel seleccionado</small><strong className="stat-word">{preferredGrade}</strong><p>Contenido personalizado</p></div></article>
          <article><span className="stat-icon violet"><CreditCard size={19} /></span><div><small>Mi plan</small><strong className="stat-word">Gratuito</strong><p><a href="#planes-docente">Ver opciones</a></p></div></article>
        </div>

        <div className="dashboard-columns">
          <div className="dashboard-panel">
            <div className="panel-heading"><div><small>Accesos rápidos</small><h2>Crea y explora</h2></div><Zap size={20} /></div>
            <div className="quick-tools">
              <button onClick={()=>setActiveSection("actividades")}><span style={{background:"#FFF0EC",color:C.coral}}><ClipboardList size={21} /></span><div><strong>Ver actividades</strong><small>Experiencias listas para adaptar</small></div><ChevronRight size={17} /></button>
              <button onClick={()=>setActiveSection("crear")}><span style={{background:"#E5F8F5",color:C.tealDeep}}><Wand2 size={21} /></span><div><strong>Crear con IA</strong><small>Sesión, proyecto e instrumentos</small></div><ChevronRight size={17} /></button>
              <button onClick={()=>setActiveSection("retos")}><span style={{background:"#F4EEFF",color:C.violet}}><Users size={21} /></span><div><strong>Retos grupales</strong><small>Aprendizaje colaborativo</small></div><ChevronRight size={17} /></button>
              <button onClick={()=>setActiveSection("biblioteca")}><span style={{background:"#FFF7DC",color:"#B78300"}}><FolderOpen size={21} /></span><div><strong>Mi biblioteca</strong><small>Recursos y descargas Word</small></div><ChevronRight size={17} /></button>
            </div>
          </div>
          <aside className="dashboard-panel recent-panel">
            <div className="panel-heading"><div><small>Tu espacio</small><h2>Materiales recientes</h2></div><Clock size={20} /></div>
            <div className="empty-materials"><span><FolderOpen size={27} /></span><strong>Aún no tienes materiales</strong><p>Las sesiones que generes aparecerán aquí para que puedas retomarlas y descargarlas.</p><button onClick={()=>setActiveSection("crear")}>Crear mi primer recurso <ArrowRight size={14} /></button></div>
          </aside>
        </div>

        <div id="planes-docente" className="dashboard-plan"><div><span><Sparkles size={17} /></span><div><strong>Obtén más generaciones y descargas en Word</strong><p>Actualiza tu plan desde S/10 y activa tu acceso mediante Plin o Yape.</p></div></div><a href="https://wa.me/51921090875?text=Hola%20Teaching%20TIC%2C%20deseo%20mejorar%20mi%20plan%20de%20SciVerse." target="_blank" rel="noreferrer">Ver planes <ArrowRight size={15} /></a></div>
      </section>}

      {activeSection === "actividades" && <><header className="px-6 md:px-10 pt-14 pb-16 max-w-5xl mx-auto text-center">
        <span
          className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-widest uppercase px-3 py-1.5 rounded-full mb-6"
          style={{ color: heroAccent, background: "rgba(15,61,58,0.05)", border: `1px solid ${C.line}`, fontFamily: "'JetBrains Mono', monospace" }}
        >
          <Sparkles size={13} /> Recursos STEAM · Alineados al CNEB
        </span>
        <h1 className="text-4xl md:text-5xl font-semibold leading-tight mb-5" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Recursos STEAM para transformar tu aula
        </h1>
        <p className="text-lg max-w-2xl mx-auto mb-3" style={{ color: C.muted }}>
          Fichas guiadas, retos grupales y un generador de sesiones con IA — en las cinco áreas STEAM: <strong style={{ color: C.text }}>Ciencia, Tecnología, Ingeniería, Arte y Matemática</strong>.
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
      </section></>}

      {/* RETOS GRUPALES */}
      {activeSection === "retos" && <section id="retos" className="px-6 md:px-10 py-14 max-w-6xl mx-auto">
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
      </section>}

      {/* GENERADOR STEAM */}
      {activeSection === "crear" && <section id="generador" className="px-6 md:px-10 py-14 max-w-5xl mx-auto">
        <CreateStudio preferredGrade={preferredGrade} profile={profile} />
      </section>}

      {/* PLANTILLAS */}
      {activeSection === "biblioteca" && <section id="plantillas" className="px-6 md:px-10 py-14 max-w-6xl mx-auto">
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
                <button onClick={() => downloadWord(`${t.id}.docx`, TEMPLATE_CONTENT[t.id], t.title)} className="inline-flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold" style={{ background: "rgba(15,61,58,0.06)", color: C.text, border: `1px solid ${C.line}` }}>
                  <Download size={14} /> Descargar en Word
                </button>
              </div>
            );
          })}
        </div>
      </section>}

      {activeSection === "crear" && <section className="px-6 md:px-10 pb-20 max-w-4xl mx-auto text-center">
        <div className="rounded-2xl p-10" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
          <GraduationCap size={26} color={C.teal} className="mx-auto mb-4" />
          <h3 className="text-xl md:text-2xl font-semibold mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>¿Prefieres que te arme la sesión directamente en el chat?</h3>
          <p className="text-sm mb-6" style={{ color: C.muted }}>Cuéntame el tema y el grado, y armamos juntos una ficha guiada nueva para tu clase.</p>
          <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold" style={{ background: C.teal, color: "#0B2B29" }} onClick={() => window.scrollTo({top:0,behavior:"smooth"})}>
            Volver al creador <ArrowRight size={15} />
          </button>
        </div>
      </section>}

      <footer className="px-6 md:px-10 py-8 text-center text-xs" style={{ color: C.muted, borderTop: `1px solid ${C.lineSoft}` }}>
        SciVerse para Docentes — un espacio de Frida García Rurush, IA educativa.
      </footer>

      {selected && <ActivityModal activity={selected} grade={modalGrade} setGrade={setModalGrade} onClose={() => setSelected(null)} />}
      {accountOpen && <TeacherAccountModal profile={profile} onClose={() => setAccountOpen(false)} />}
    </div>
  );
}
