import React, { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient.js";
import AuthGate from "./AuthGate.jsx";
import { GUIDE_ACTIVITIES } from "./steamGuideActivities.js";
import CreditsIndicator from "./components/CreditsIndicator.jsx";
import Landing from "./components/landing/Landing.jsx";
import AppShell from "./components/layout/AppShell.jsx";
import Dashboard from "./components/dashboard/Dashboard.jsx";
import GenerationProgress from "./components/ui/GenerationProgress.jsx";
import ToolGrid from "./components/create/ToolGrid.jsx";
import "./components/create/create.css";
import { TOOLS_BY_ID } from "./config/tools.js";
import Button from "./components/ui/Button.jsx";
import { Badge } from "./components/ui/Feedback.jsx";
import { useUI } from "./components/ui/UIProvider.jsx";
import "./components/dashboard/dashboard.css";
import "./components/layout/appshell.css";
import "./components/landing/landing.css";
import { PLANS, FREE_WEEKLY_AI_LIMIT, whatsappLink } from "./config/plans.js";
import "./library.css";
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
  Search,
  Trash2,
  Eye,
  Star,
  Plus,
  ChevronLeft,
  Quote,
  Gamepad2,
  ListChecks,
  CalendarDays,
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  Lock,
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

async function saveTeacherMaterial({tipo,titulo,form,contenido}) {
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) throw new Error("No se encontró la sesión del docente");
  const {data,error}=await supabase.from("materiales_docente").insert({user_id:user.id,tipo,titulo,nivel:form.nivel,grado:form.grado,area:form.area,tema:form.tema,contenido}).select("id").single();
  if(error) throw error;
  window.dispatchEvent(new CustomEvent("sciverse:material-created",{detail:{id:data.id}}));
  return data;
}

/* ---------------------------------------------------------------------- */
/* GUARDADO DE MATERIALES CON ESTADO VISIBLE                              */
/*                                                                        */
/* Antes, cada generador hacía:                                           */
/*     try { await saveTeacherMaterial(...) } catch(e) { console.error(e) }*/
/* La docente veía el recurso en pantalla y creía que estaba guardado.    */
/* Si el guardado fallaba, el material NO aparecía nunca en su biblioteca */
/* y nadie se lo decía.                                                   */
/* ---------------------------------------------------------------------- */

/** Traduce un error técnico de Supabase/Postgres a algo accionable. */
function describeSaveError(error) {
  const code = error?.code || "";
  const message = String(error?.message || "");

  if (code === "23514" || /violates check constraint/i.test(message)) {
    return "Este tipo de material todavía no está habilitado en la base de datos.";
  }
  if (code === "23505" || /duplicate key/i.test(message)) {
    return "Ya existe un material igual en tu biblioteca.";
  }
  if (code === "42501" || /row-level security/i.test(message)) {
    return "No tienes permiso para guardar este material. Vuelve a iniciar sesión.";
  }
  if (code === "PGRST301" || /jwt|expired/i.test(message)) {
    return "Tu sesión venció. Vuelve a iniciar sesión y reintenta.";
  }
  if (/fetch|network|failed to fetch/i.test(message)) {
    return "No hay conexión con el servidor. Revisa tu internet.";
  }
  return "No pudimos guardar este material.";
}

/**
 * Hook de guardado con estado visible y reintento.
 *
 * Devuelve:
 *   save(payload)  → intenta guardar y recuerda el payload por si hay que reintentar
 *   retry()        → repite el último intento fallido
 *   state          → { status: "idle"|"saving"|"saved"|"error", message }
 */
function useMaterialSave() {
  const [state, setState] = useState({ status: "idle", message: "" });
  const lastPayload = useRef(null);

  const save = useCallback(async (payload) => {
    lastPayload.current = payload;
    setState({ status: "saving", message: "" });
    try {
      await saveTeacherMaterial(payload);
      setState({ status: "saved", message: "" });
      return true;
    } catch (error) {
      // El detalle técnico se queda en consola; a la docente le llega algo útil.
      console.error("[sciverse] fallo al guardar material", error);
      setState({ status: "error", message: describeSaveError(error) });
      return false;
    }
  }, []);

  const retry = useCallback(async () => {
    if (!lastPayload.current) return false;
    return save(lastPayload.current);
  }, [save]);

  return { state, save, retry };
}

/**
 * Indicador de guardado.
 *
 * `onDownload` es la salida de emergencia: si el guardado falla, la docente
 * todavía puede llevarse su trabajo en Word sin gastar otro crédito.
 */
function SaveStatus({ state, onRetry, onDownload }) {
  if (!state || state.status === "idle") return null;

  if (state.status === "saving") {
    return (
      <p className="save-status save-status--saving" role="status">
        <Loader2 size={14} className="animate-spin" /> Guardando en tu biblioteca…
      </p>
    );
  }

  if (state.status === "saved") {
    return (
      <p className="save-status save-status--saved" role="status">
        <CheckCircle2 size={14} /> Guardado en tu biblioteca
      </p>
    );
  }

  return (
    <div className="save-status save-status--error" role="alert">
      <p>
        <AlertTriangle size={14} /> {state.message} <strong>Tu contenido sigue aquí.</strong>
      </p>
      <div className="save-status__actions">
        <button type="button" onClick={onRetry}>
          <RefreshCw size={13} /> Reintentar guardado
        </button>
        {onDownload && (
          <button type="button" onClick={onDownload}>
            <Download size={13} /> Descargar ahora
          </button>
        )}
      </div>
    </div>
  );
}

async function downloadWord(filename, content, title="Documento SciVerse") {
  const paragraphs=String(content||"").split(/\n/).map(line=>line.trim()?wordParagraph(line,{size:20}):wordParagraph("",{after:40}));
  const doc=new Document({ creator:"Teaching TIC Consultorías S.A.C.", title, styles:{ default:{ document:{ run:{font:"Arial",size:20,color:WORD.ink}, paragraph:{spacing:{after:90,line:276}} } } }, sections:[{ properties:{page:{size:{width:11906,height:16838},margin:{top:1050,right:1134,bottom:950,left:1134}}}, headers:{default:new Header({children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:"SciVerse",bold:true,font:"Arial",size:23,color:"168B84"}),new TextRun({text:" · una iniciativa de Teaching TIC",font:"Arial",size:16,color:"6F8885"})]}),new Paragraph({border:{bottom:{style:BorderStyle.SINGLE,size:6,color:"CBE4E1"}},children:[]})]})}, footers:{default:new Footer({children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:"Teaching TIC · Página ",font:"Arial",size:14,color:"6F8885"}),new TextRun({children:[PageNumber.CURRENT],font:"Arial",size:14,color:"6F8885"})]})]})}, children:[wordParagraph(title,{bold:true,size:30,color:"0F625D",alignment:AlignmentType.CENTER,after:220}),...paragraphs] }] });
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

async function downloadActivityWord(activity,grade) {
  const v=activity.versions[grade];
  const detail=activity.detalle;
  const green="0F625D",teal="168B84",pale="E4F6F3",pale2="F4FAF9",yellow="FFF3C4",ink="173E3B",muted="5D7774",white="FFFFFF";
  const heading=(number,title)=>new Table({width:{size:WORD_WIDTH,type:WidthType.DXA},columnWidths:[700,8938],layout:TableLayoutType.FIXED,borders:{top:{style:BorderStyle.NONE},bottom:{style:BorderStyle.NONE},left:{style:BorderStyle.NONE},right:{style:BorderStyle.NONE},insideHorizontal:{style:BorderStyle.NONE},insideVertical:{style:BorderStyle.NONE}},rows:[new TableRow({children:[wordCell(number,700,{fill:green,color:white,bold:true,align:AlignmentType.CENTER}),wordCell(title.toUpperCase(),8938,{fill:pale,color:green,bold:true})]})]});
  const infoTable=new Table({width:{size:WORD_WIDTH,type:WidthType.DXA},columnWidths:[3212,3213,3213],layout:TableLayoutType.FIXED,borders:wordBorders,rows:[new TableRow({children:[wordCell([wordParagraph("NIVEL RECOMENDADO",{bold:true,color:teal,size:16,after:35}),wordParagraph(v.nivel,{bold:true,color:ink,size:18})],3212,{fill:pale2}),wordCell([wordParagraph("TIEMPO SUGERIDO",{bold:true,color:teal,size:16,after:35}),wordParagraph(detail.tiempo,{bold:true,color:ink,size:18})],3213,{fill:pale2}),wordCell([wordParagraph("ORGANIZACIÓN",{bold:true,color:teal,size:16,after:35}),wordParagraph(detail.organizacion,{color:ink,size:17})],3213,{fill:pale2})]})]});
  const successBox=new Table({width:{size:WORD_WIDTH,type:WidthType.DXA},columnWidths:[900,8738],layout:TableLayoutType.FIXED,borders:wordBorders,rows:[new TableRow({children:[wordCell("✓",900,{fill:green,color:white,bold:true,align:AlignmentType.CENTER}),wordCell([wordParagraph("CONDICIÓN DE ÉXITO",{bold:true,color:green,size:17,after:35}),wordParagraph(v.condicion,{color:ink,size:19})],8738,{fill:pale})]})]});
  const evidenceBox=new Table({width:{size:WORD_WIDTH,type:WidthType.DXA},columnWidths:[4819,4819],layout:TableLayoutType.FIXED,borders:wordBorders,rows:[new TableRow({children:[wordCell([wordParagraph("PREGUNTAS PARA ACOMPAÑAR",{bold:true,color:green,size:17,after:55}),...detail.acompanamiento.map(item=>wordParagraph(item,{bullet:true,size:18,after:55}))],4819,{fill:pale2}),wordCell([wordParagraph("EVIDENCIAS QUE DEBE RECOGER",{bold:true,color:green,size:17,after:55}),...detail.evidencias.map(item=>wordParagraph(item,{bullet:true,size:18,after:55}))],4819,{fill:pale2})]})]});
  const children=[
    wordParagraph(`${activity.code} · ${SUBJECTS[activity.subject].label.toUpperCase()}`,{bold:true,color:teal,size:17,after:60}),
    wordParagraph(activity.title,{bold:true,color:green,size:32,after:80}),
    wordParagraph("Guía pedagógica para aplicar una experiencia STEAM en el aula",{color:muted,size:19,after:180}),
    infoTable,
    wordParagraph("",{after:70}),
    heading("01","Competencia CNEB"),wordParagraph(activity.competencia,{bold:true,color:ink,size:20,before:90,after:150}),
    heading("02","El reto"),wordParagraph(v.objetivo,{color:ink,size:20,before:90,after:150}),
    heading("03","Antes de empezar"),...detail.preparacion.map(item=>wordParagraph(item,{bullet:true,size:19,before:25,after:65})),
    heading("04","Materiales"),...v.materiales.map(item=>wordParagraph(item,{bullet:true,size:19,before:25,after:65})),
    heading("05","¿Cómo se juega?"),...v.pasos.map(item=>new Paragraph({numbering:{reference:"activity-steps",level:0},spacing:{before:45,after:85,line:290},children:[wordRun(item,{size:19,color:ink})]})),
    successBox,wordParagraph("",{after:65}),
    heading("06","Acompañamiento y evaluación"),wordParagraph("Durante el reto, observa el razonamiento antes de intervenir. Utiliza estas preguntas y recoge evidencias del proceso, no solo del producto final.",{color:muted,size:18,before:80,after:80}),evidenceBox,
    wordParagraph("VARIACIÓN — MÁS DIFÍCIL",{bold:true,color:"9B6B00",size:17,before:150,after:45}),
    new Table({width:{size:WORD_WIDTH,type:WidthType.DXA},columnWidths:[WORD_WIDTH],layout:TableLayoutType.FIXED,borders:wordBorders,rows:[new TableRow({children:[wordCell(v.variacion,WORD_WIDTH,{fill:yellow})]})]}),
    wordParagraph("PREGUNTA PARA REFLEXIONAR",{bold:true,color:teal,size:17,before:150,after:45}),
    new Table({width:{size:WORD_WIDTH,type:WidthType.DXA},columnWidths:[WORD_WIDTH],layout:TableLayoutType.FIXED,borders:wordBorders,rows:[new TableRow({children:[wordCell(wordParagraph(v.reflexion,{bold:true,italics:true,color:green,size:21,alignment:AlignmentType.CENTER,after:0}),WORD_WIDTH,{fill:pale})]})]}),
  ];
  const doc=new Document({creator:"Teaching TIC Consultorías S.A.C.",title:activity.title,description:"Guía de actividad STEAM de SciVerse",numbering:{config:[{reference:"activity-steps",levels:[{level:0,format:"decimal",text:"%1.",alignment:AlignmentType.LEFT,style:{paragraph:{indent:{left:540,hanging:260}},run:{bold:true,color:green,font:"Arial",size:19}}}]}]},styles:{default:{document:{run:{font:"Arial",size:20,color:ink},paragraph:{spacing:{after:100,line:290}}}}},sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:1050,right:1134,bottom:950,left:1134},pageNumbers:{start:1,formatType:NumberFormat.DECIMAL}}},headers:{default:new Header({children:[new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:40},children:[new TextRun({text:"SciVerse",bold:true,font:"Arial",size:24,color:"A9D6D1"}),new TextRun({text:"  ·  una iniciativa de Teaching TIC",font:"Arial",size:17,color:"B9C9C7"})]}),new Paragraph({spacing:{after:0},border:{bottom:{style:BorderStyle.SINGLE,size:6,color:"CBE4E1"}},children:[]})]})},footers:{default:new Footer({children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:"Teaching TIC · Recursos para docentes · Página ",font:"Arial",size:15,color:muted}),new TextRun({children:[PageNumber.CURRENT],font:"Arial",size:15,color:muted})]})]})},children}]});
  await triggerWordDownload(doc,`${activity.id}-${grade}.docx`);
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
  ciencia: { label: "Ciencia", icon: Microscope, color: "#1F9E98" },
  fisica: { label: "Física", icon: Zap, color: C.teal },
  quimica: { label: "Química", icon: FlaskConical, color: C.violet },
  biologia: { label: "Biología", icon: Dna, color: "#6FE6A8" },
  tecnologia: { label: "Tecnología", icon: Cpu, color: "#4FA8FF" },
  ingenieria: { label: "Ingeniería", icon: Cog, color: "#FF8A5B" },
  arte: { label: "Arte", icon: Palette, color: "#FF6FA8" },
  matematica: { label: "Matemática", icon: Calculator, color: "#FFD166" },
};

const LEGACY_ACTIVITIES = [
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

const ACTIVITIES = GUIDE_ACTIVITIES;

const RETOS = [
  {
    id: "detectives-gravedad",
    title: "Detectives de la gravedad",
    subject: "fisica", area: "Ciencia y Tecnología", teamSize: "4 estudiantes",
    grades: ["primaria", "secundaria"],
    desc: "Predigan, experimenten y expliquen qué ocurre cuando se dejan caer objetos diferentes.",
    duracion: "30 min", icon: Zap,
    competencia: CNEB.indaga,
    mision: "Resolver qué características influyen realmente en la caída de los objetos y defender una conclusión basada en evidencias.",
    producto: "Registro de predicciones, resultados y una explicación oral del equipo.",
    roles: ["Coordinador/a", "Responsable de materiales", "Registrador/a", "Portavoz"],
    materiales: ["Objetos seguros de distintos tamaños y masas", "Hojas de registro", "Cinta métrica", "Cronómetro opcional"],
    preparacion: ["Selecciona pares de objetos que puedan soltarse sin riesgo.", "Marca una misma altura de lanzamiento.", "Prepara una tabla con predicción, resultado y explicación."],
    pasos: ["Presenta la misión sin adelantar la respuesta.", "Cada equipo observa dos objetos y registra cuál cree que llegará primero y por qué.", "Realizan tres pruebas desde la misma altura y registran resultados.", "Comparan sus predicciones con la evidencia y reformulan su explicación.", "El portavoz comunica la conclusión y responde preguntas de otro equipo."],
    reglas: ["Todos predicen antes de experimentar.", "Los objetos se sueltan, no se lanzan.", "La conclusión debe mencionar al menos una evidencia."],
    criterios: ["Formula una predicción explicando su razonamiento.", "Registra los resultados de forma ordenada.", "Compara la predicción con la evidencia obtenida.", "Comunica una conclusión sustentada en los resultados."],
    preguntas: ["¿Qué cambió entre una prueba y otra?", "¿Qué evidencia contradijo su primera idea?", "¿Cómo harían la prueba más confiable?"],
  },
  {
    id: "debate-acido-base",
    title: "El gran debate ácido-base",
    subject: "quimica", area: "Ciencia y Tecnología", teamSize: "4 o 5 estudiantes",
    grades: ["secundaria"],
    desc: "Analicen evidencias de sustancias cotidianas y defiendan una clasificación científica.",
    duracion: "35 min", icon: FlaskConical, competencia: CNEB.indaga,
    mision: "Clasificar muestras como ácidas, básicas o neutras y convencer a un jurado usando datos, no suposiciones.", producto: "Panel de clasificación con argumentos y evidencias.",
    roles: ["Coordinador/a", "Analista de datos", "Responsable de seguridad", "Portavoz"], materiales: ["Tarjetas con resultados de pH", "Ficha de análisis", "Papelote", "Plumones"],
    preparacion: ["Prepara tarjetas con sustancias conocidas y datos de pH seguros.", "Organiza una mesa por equipo.", "Define normas de seguridad; no se prueban sustancias."],
    pasos: ["Entrega un caso y tarjetas de evidencia a cada equipo.", "Los equipos interpretan la escala de pH y clasifican las muestras.", "Construyen un argumento con afirmación, evidencia y razonamiento.", "Intercambian una tarjeta con otro equipo para revisar su clasificación.", "Presentan y responden una objeción del jurado."],
    reglas: ["No se manipulan ni prueban sustancias reales.", "Cada conclusión debe citar un dato de pH.", "Las discrepancias se resuelven revisando evidencia."], criterios: ["Interpreta correctamente datos de la escala de pH.", "Clasifica las muestras de manera coherente.", "Sustenta su conclusión con evidencia.", "Participa respetando los roles del equipo."], preguntas: ["¿Qué dato fue decisivo?", "¿Una sustancia puede clasificarse solo por su apariencia?", "¿Cómo mejorarían su argumento?"],
  },
  {
    id: "torre-mas-alta",
    title: "La torre más alta con menos material",
    subject: "ingenieria", area: "Ciencia y Tecnología", teamSize: "4 estudiantes",
    grades: ["primaria", "secundaria"],
    desc: "Diseñen, construyan y mejoren una estructura estable utilizando recursos limitados.",
    duracion: "45 min", icon: Cog, competencia: CNEB.disena,
    mision: "Construir la torre autónoma más alta posible con la misma cantidad de materiales para todos los equipos.", producto: "Prototipo estable, boceto y explicación de una mejora realizada.",
    roles: ["Diseñador/a", "Constructor/a", "Responsable de recursos", "Evaluador/a"], materiales: ["20 hojas de papel por equipo", "50 cm de cinta adhesiva", "Regla", "Ficha de diseño"],
    preparacion: ["Entrega exactamente la misma cantidad de materiales.", "Delimita una zona de construcción.", "Prepara una regla de medición y una superficie plana."],
    pasos: ["Presenta restricciones y condición de éxito.", "Cada equipo dibuja un diseño antes de tocar los materiales.", "Construyen una primera versión y registran su altura.", "Realizan una prueba de estabilidad de 10 segundos.", "Identifican una falla, mejoran el prototipo y vuelven a medir.", "Comparan soluciones explicando qué decisión dio estabilidad."],
    reglas: ["La torre debe sostenerse sin apoyo humano.", "No se entregan materiales adicionales.", "Debe existir un boceto y una mejora documentada."], criterios: ["Propone un diseño acorde con las restricciones.", "Utiliza los materiales de forma eficiente.", "Prueba e identifica fallas del prototipo.", "Justifica la mejora aplicada a la estructura."], preguntas: ["¿Qué parte soporta mayor carga?", "¿Por qué una base más ancha puede ayudar?", "¿Qué cambiarían con una tercera oportunidad?"],
  },
  {
    id:"puente-papel", title:"Un puente que sí resiste", subject:"ingenieria", area:"Ciencia y Tecnología", teamSize:"4 estudiantes", grades:["primaria","secundaria"], desc:"Construyan un puente de papel capaz de soportar la mayor carga posible.", duracion:"45 min", icon:Layers, competencia:CNEB.disena,
    mision:"Crear un puente de papel que cubra 25 cm y soporte al menos diez monedas sin colapsar.", producto:"Prototipo, registro de pruebas y explicación técnica.", roles:["Diseñador/a","Constructor/a","Encargado/a de pruebas","Registrador/a"], materiales:["6 hojas de papel","30 cm de cinta","Dos apoyos","Monedas o fichas iguales","Regla"], preparacion:["Coloca dos apoyos separados 25 cm.","Entrega materiales equivalentes.","Prepara una tabla para registrar cada prueba."], pasos:["Analicen el reto y propongan dos formas de reforzar el papel.","Elijan una alternativa y dibujen el diseño.","Construyan sin superar los materiales asignados.","Añadan carga de una en una y registren el máximo.","Rediseñen una parte y realicen la prueba final.","Expliquen qué forma estructural mejoró la resistencia."], reglas:["El puente solo puede apoyarse en los extremos.","La carga se coloca en el centro.","Toda mejora debe registrarse."], criterios:["Representa una alternativa mediante un boceto.","Construye respetando las restricciones.","Registra datos de las pruebas.","Explica la relación entre forma y resistencia."], preguntas:["¿Dónde comenzó a deformarse?","¿Qué forma distribuyó mejor el peso?","¿Qué dato demuestra que mejoraron?"],
  },
  {
    id:"agua-comunidad", title:"Cada gota cuenta", subject:"tecnologia", area:"Ciencia y Tecnología", teamSize:"5 estudiantes", grades:["primaria","secundaria"], desc:"Diseñen una solución realista para reducir el desperdicio de agua en la escuela.", duracion:"60 min", icon:Target, competencia:CNEB.disena,
    mision:"Detectar una situación de desperdicio de agua y presentar una solución viable para la comunidad educativa.", producto:"Propuesta ilustrada o prototipo sencillo con plan de aplicación.", roles:["Observador/a","Investigador/a","Diseñador/a","Comunicador/a","Evaluador/a"], materiales:["Plano o croquis de la escuela","Papelotes","Plumones","Material reciclado opcional"], preparacion:["Define espacios seguros que puedan observarse.","Prepara preguntas para entrevistar a usuarios.","Aclara que no se manipulan conexiones de agua."], pasos:["Identifiquen dónde y cómo se usa el agua.","Seleccionen un problema observable y describan a quién afecta.","Propongan tres ideas y elijan una con criterios de impacto y viabilidad.","Representen la solución mediante un boceto o prototipo.","Reciban retroalimentación de otro equipo y mejoren.","Presenten la solución y una acción concreta para implementarla."], reglas:["La propuesta debe ser segura y realizable.","Debe responder a una evidencia observada.","Todo integrante aporta en la presentación o producto."], criterios:["Define un problema concreto del entorno.","Propone una solución relacionada con sus causas.","Representa y mejora la propuesta.","Comunica beneficios y condiciones de aplicación."], preguntas:["¿Qué evidencia muestra que existe el problema?","¿Quién utilizará la solución?","¿Qué podría impedir que funcione?"],
  },
  {
    id:"especie-local", title:"Guardianes de una especie local", subject:"biologia", area:"Ciencia y Tecnología", teamSize:"4 estudiantes", grades:["primaria","secundaria"], desc:"Investiguen una especie de su región y creen una acción para promover su cuidado.", duracion:"50 min", icon:Sparkles, competencia:CNEB.explica,
    mision:"Explicar por qué una especie local es importante y diseñar un mensaje de protección basado en información confiable.", producto:"Campaña breve: afiche, audio, exposición o mural informativo.", roles:["Investigador/a","Verificador/a de información","Diseñador/a","Portavoz"], materiales:["Fuentes seleccionadas por el docente","Fichas","Papelotes o dispositivo disponible","Plumones"], preparacion:["Selecciona fuentes breves y confiables.","Evita atribuir amenazas no verificadas a la comunidad.","Ofrece opciones de producto para atender la diversidad."], pasos:["Elijan una especie pertinente al contexto regional.","Identifiquen características, hábitat e importancia.","Distingan datos comprobables de opiniones.","Definan una audiencia y un mensaje de cuidado.","Creen el producto y realicen una revisión cruzada.","Presenten la campaña y acuerden una acción posible."], reglas:["Toda afirmación debe provenir de las fuentes entregadas.","El mensaje evita culpabilizar a personas o comunidades.","La acción propuesta debe ser posible para estudiantes."], criterios:["Selecciona información relevante y confiable.","Explica la importancia de la especie.","Propone una acción coherente de cuidado.","Adapta el mensaje a una audiencia concreta."], preguntas:["¿Qué dato podría sorprender a su audiencia?","¿Cómo saben que la fuente es confiable?","¿Qué acción sí puede realizar su escuela?"],
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
  "sesion-blanco": `PLANTILLA DE SESIÓN DE APRENDIZAJE\n\nI. DATOS INFORMATIVOS\nDocente: ____________________  I.E.: ____________________\nNivel y grado: ______________  Área: ___________________\nFecha: ______________________  Duración: _______________\n\nII. TÍTULO\n________________________________________________________\n\nIII. PROPÓSITOS DE APRENDIZAJE\nCompetencia: ___________________________________________\nCapacidades: ___________________________________________\nPropósito: _____________________________________________\nEvidencia: _____________________________________________\nCriterios observables: _________________________________\n\nIV. SECUENCIA DIDÁCTICA\nInicio: ________________________________________________\nDesarrollo y procesos didácticos: ______________________\nCierre: ________________________________________________\n\nV. MATERIALES Y APOYOS DUA\n________________________________________________________`,
  "roles-equipo": `REGISTRO DE EQUIPOS Y ROLES\n\nActividad o reto: ______________________________________\nGrado y sección: ______________ Fecha: _________________\n\nEQUIPO 1\nIntegrantes: ___________________________________________\nCoordinador/a: _________________________________________\nResponsable de materiales: _____________________________\nRegistrador/a: _________________________________________\nPortavoz: ______________________________________________\nAcuerdos del equipo: ___________________________________\n\nRepite este bloque para cada equipo.`,
  "reflexion-docente": `REFLEXIONES DEL DOCENTE\n\nSesión o actividad: ____________________________________\nFecha: __________________ Grado: ________________________\n\n¿Qué avances observé en mis estudiantes?\n________________________________________________________\n\n¿Qué dificultades se presentaron?\n________________________________________________________\n\n¿Qué estrategias y apoyos funcionaron mejor?\n________________________________________________________\n\n¿Qué debo ajustar en la siguiente experiencia?\n________________________________________________________`,
  "lista-estudiantes": `REGISTRO DE ESTUDIANTES\n\nGrado y sección: ______________ Docente: _______________\n\nN.º | APELLIDOS Y NOMBRES | OBSERVACIONES\n01  |                      |\n02  |                      |\n03  |                      |\n04  |                      |\n05  |                      |\n\nContinúa hasta completar la nómina del aula.`,
  "registro-evidencias": `REGISTRO DE EVIDENCIAS DE APRENDIZAJE\n\nTema: _____________________ Grado: ______________________\nCompetencia: ___________________________________________\nEvidencia esperada: ____________________________________\n\nESTUDIANTE / EQUIPO: ___________________________________\nEvidencia observada: ___________________________________\nCriterio relacionado: __________________________________\nRetroalimentación brindada: _____________________________\nSiguiente acción: _______________________________________`,
};

const TEMPLATES = [
  { id:"sesion-blanco",title:"Plantilla de sesión de aprendizaje",desc:"Formato editable para organizar datos, propósito, criterios y los tres momentos de la sesión.",icon:FileText },
  {
    id: "ficha-blanco",
    title: "Ficha de experiencia STEAM",
    desc: "Plantilla de planificación para preparar cualquier experimento o reto STEAM con tus estudiantes.",
    icon: ClipboardList,
  },
  {id:"roles-equipo",title:"Registro de equipos y roles",desc:"Organiza integrantes, responsabilidades y acuerdos para actividades colaborativas.",icon:Users},
  {id:"reflexion-docente",title:"Reflexiones del docente",desc:"Registra avances, dificultades, apoyos efectivos y decisiones para la siguiente clase.",icon:Pencil},
  {id:"lista-estudiantes",title:"Lista de estudiantes",desc:"Nómina editable para instrumentos, seguimiento y observaciones del aula.",icon:ClipboardList},
  {id:"registro-evidencias",title:"Registro de evidencias",desc:"Relaciona evidencias observadas, criterios, retroalimentación y siguientes acciones.",icon:Target},
  {id:"certificado",title:"Reconocimiento para estudiantes",desc:"Certificado editable para reconocer participación, curiosidad y trabajo colaborativo.",icon:Award},
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

function SteamGenerator({ initialGrade = "primaria", documentType = "session", profile = {}, completeClass = false, onNext = null }) {
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
  const materialSave = useMaterialSave();
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
      const finalResult={
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
      };
      setResult(finalResult);
      await materialSave.save({tipo:documentType,titulo:finalResult.titulo||form.tema,form,contenido:finalResult});
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

      {loading && (
        <div className="kantu-generation-overlay">
          {/* Los pasos son REALES: activeModule y completedModules ya los
              reporta el generador. No se inventan porcentajes ni tiempos. */}
          <GenerationProgress
            steps={["alignment", "sequence", "assessment", "annexes"]}
            labels={moduleLabels}
            active={activeModule}
            completed={completedModules}
            title={`Kantu está creando tu ${documentName}`}
            subtitle="Suele tomar entre uno y dos minutos. Puedes quedarte en esta pantalla."
            tip="los criterios de evaluación deben empezar con un verbo observable para poder verificarse en la evidencia."
          />
        </div>
      )}

      {result && completeClass && <div className="flow-actionbar session-flow-toolbar"><button onClick={()=>setResult(null)}><Pencil size={15}/> Editar</button><button onClick={handleDownloadSession} disabled={downloading}>{downloading?<Loader2 size={15} className="animate-spin"/>:<Download size={15}/>} Descargar Word</button><button onClick={()=>window.print()}><Printer size={15}/> Descargar PDF</button><button className="flow-next-btn" onClick={()=>onNext?.({form:{...form},result})}>Siguiente <ArrowRight size={16}/></button></div>}
      {result && (
        <div className="mt-6 rounded-xl p-5" style={{ background: "rgba(15,61,58,0.03)", border: `1px solid ${C.line}` }}>
          <h4 className="text-lg font-semibold mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {result.titulo}
          </h4>
          <SaveStatus state={materialSave.state} onRetry={materialSave.retry} onDownload={handleDownloadSession} />
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
          {!completeClass&&!evaluationFlow&&<button onClick={()=>setEvaluationFlow("choose")} className="session-next-step"><span><ClipboardList size={18}/><i><strong>Siguiente paso</strong><small>Crear el instrumento con los criterios y la evidencia de esta sesión</small></i></span>Continuar con evaluación <ArrowRight size={16}/></button>}
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

function EvaluationInstrumentGenerator({ initialGrade = "primaria", instrumentType = "checklist", initialContext = null, profile = {}, completeClass = false, onNext = null }) {
  const isRubric = instrumentType === "rubric";
  const instrumentName = isRubric ? "rúbrica" : "lista de cotejo";
  const initialLevel = initialGrade === "secundaria" ? "Secundaria" : "Primaria";
  const [step, setStep] = useState(initialContext ? 3 : 1);
  const [form, setForm] = useState(initialContext || { nivel: initialLevel, grado: initialLevel === "Primaria" ? "3.º" : "1.º", area: "Ciencia y Tecnología", region: "", tema: "", competencia: CNEB.indaga, capacidades: GENERATOR_CAPACITIES[CNEB.indaga], evidencia: "", numeroCriterios: "6" });
  const [instrument, setInstrument] = useState(null);
  const instrumentSave = useMaterialSave();
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
    try {
      const token=await getToken();
      const response=await fetch("/api/generate-session",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({mode:"instrument",instrumentType,form})});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||`No se pudo generar la ${instrumentName}`);
      if(!data.instrument) throw new Error("El instrumento no llegó completo. Intenta nuevamente.");
      setInstrument(data.instrument); setEditing(false);
      try { await instrumentSave.save({tipo:instrumentType,titulo:data.instrument.titulo||form.tema,form,contenido:data.instrument}); }
      catch(saveError) { console.error("No se pudo guardar el instrumento",saveError); }
    } catch(e){setError(e.message);} finally{setLoading(false);}
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
    {loading&&<div className="kantu-working"><div className="kantu-working__visual"><span className="kantu-orbit"><Sparkles size={15}/></span><img loading="lazy" src="/mascot/kantu-material.webp" alt="Kantu creando el instrumento"/></div><div className="kantu-working__copy"><small>KANTU ESTÁ TRABAJANDO</small><h4>Está construyendo criterios observables y alineados…</h4><p>Está revisando la competencia, las capacidades y la evidencia de aprendizaje.</p><div className="kantu-progress"><i/><i/><i/></div></div></div>}
    {instrument&&<div className="instrument-result"><div className="instrument-result__actions"><div><small>INSTRUMENTO GENERADO</small><h3>{instrument.titulo}</h3></div><div><button onClick={()=>setEditing(!editing)}><Pencil size={14}/>{editing?"Terminar edición":"Editar"}</button><button onClick={generateInstrument}><RotateCw size={14}/>Regenerar</button><button className="primary" onClick={downloadInstrument}><Download size={14}/>Word</button>{completeClass&&<><button onClick={()=>window.print()}><Printer size={14}/>PDF</button><button className="flow-next-btn" onClick={()=>onNext?.({form:{...form},instrument})}>Siguiente <ArrowRight size={15}/></button></>}</div></div><SaveStatus state={instrumentSave.state} onRetry={instrumentSave.retry} onDownload={downloadInstrument} /><div className="instrument-meta"><strong>Competencia evaluada</strong><p>{instrument.competencia}</p><strong>Capacidades</strong><ul>{instrument.capacidades.map((item,index)=><li key={index}>{item}</li>)}</ul><strong>Evidencia de aprendizaje</strong>{editing?<textarea value={instrument.evidencia} onChange={e=>setInstrument(current=>({...current,evidencia:e.target.value}))}/>:<p>{instrument.evidencia}</p>}</div><div className="instrument-table-wrap"><table className={isRubric?"rubric-table":"checklist-table"}><thead><tr><th>N.º</th><th>Criterio de evaluación</th>{isRubric?<><th>Inicio</th><th>En proceso</th><th>Logro esperado</th><th>Logro destacado</th></>:<><th>Sí</th><th>No</th><th>Observaciones</th></>}</tr></thead><tbody>{instrument.criterios.map((item,index)=><tr key={index}><td>{index+1}</td><td>{editing?<textarea value={item.criterio} onChange={e=>updateCriterion(index,"criterio",e.target.value)}/>:<><small>{item.capacidad}</small>{item.criterio}</>}</td>{isRubric?<>{["inicio","enProceso","logroEsperado","logroDestacado"].map(key=><td key={key}>{editing?<textarea value={item[key]} onChange={e=>updateCriterion(index,key,e.target.value)}/>:item[key]}</td>)}</>:<><td><i className="empty-check"/></td><td><i className="empty-check"/></td><td><span className="observation-line"/></td></>}</tr>)}</tbody></table></div></div>}
  </div>;
}

function generateWordSearchGrid(words, difficulty = "media") {
  const difficultySettings = {
    facil: { size: 10, directions: ["horizontal", "vertical"] },
    media: { size: 12, directions: ["horizontal", "vertical", "diagonal"] },
    dificil: { size: 14, directions: ["horizontal", "vertical", "diagonal", "backwards"] }
  };

  const settings = difficultySettings[difficulty] || difficultySettings.media;
  const gridSize = settings.size;
  const directions = settings.directions;

  const grid = Array(gridSize).fill().map(() => Array(gridSize).fill(""));
  const placedWords = [];
  const directionVectors = {
    horizontal: [0, 1],
    horizontal_back: [0, -1],
    vertical: [1, 0],
    vertical_back: [-1, 0],
    diagonal: [1, 1],
    diagonal_back: [-1, -1],
    diagonal2: [1, -1],
    diagonal2_back: [-1, 1]
  };

  const cleanedWords = words
    .map(w => w.toUpperCase().trim())
    .filter(w => w.length > 1 && w.length <= gridSize)
    .sort((a, b) => b.length - a.length);

  for (const word of cleanedWords) {
    let placed = false;
    let attempts = 0;

    while (!placed && attempts < 50) {
      attempts++;
      const row = Math.floor(Math.random() * gridSize);
      const col = Math.floor(Math.random() * gridSize);

      let dirKey;
      if (directions.includes("backwards")) {
        const allDirs = ["horizontal", "horizontal_back", "vertical", "vertical_back", "diagonal", "diagonal_back", "diagonal2", "diagonal2_back"];
        dirKey = allDirs[Math.floor(Math.random() * allDirs.length)];
      } else {
        const availableDirs = ["horizontal", "vertical", "diagonal", "diagonal2"];
        dirKey = availableDirs[Math.floor(Math.random() * availableDirs.length)];
      }

      const [dRow, dCol] = directionVectors[dirKey];
      let canPlace = true;

      for (let i = 0; i < word.length; i++) {
        const r = row + i * dRow;
        const c = col + i * dCol;

        if (r < 0 || r >= gridSize || c < 0 || c >= gridSize) {
          canPlace = false;
          break;
        }

        if (grid[r][c] !== "" && grid[r][c] !== word[i]) {
          canPlace = false;
          break;
        }
      }

      if (canPlace) {
        for (let i = 0; i < word.length; i++) {
          const r = row + i * dRow;
          const c = col + i * dCol;
          grid[r][c] = word[i];
        }
        placedWords.push({ word, row, col, direction: dirKey });
        placed = true;
      }
    }
  }

  const letters = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ";
  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      if (grid[i][j] === "") {
        grid[i][j] = letters[Math.floor(Math.random() * letters.length)];
      }
    }
  }

  return { grid, placedWords, gridSize };
}

async function generateWordSearchImage({ titulo, palabras, gridData, dificultad, grado, type = "student" }) {
  try {
    if (!gridData || !gridData.grid) {
      throw new Error("No hay datos de grilla para generar la imagen");
    }

    const { grid, placedWords } = gridData;

    // Validar que grid sea válido
    if (!Array.isArray(grid) || grid.length === 0) {
      throw new Error("La grilla no es válida");
    }

    // Formato A4 a 96 DPI (para pantalla)
    const A4_WIDTH = 794;
    const A4_HEIGHT = 1123;

    // Márgenes A4
    const marginTop = 50;
    const marginBottom = 40;
    const marginSides = 40;

    // Dimensiones útiles
    const usableWidth = A4_WIDTH - marginSides * 2;

    // Calcular tamaño de celda automáticamente
    const maxGridWidth = usableWidth - 30;
    const cellSize = Math.floor(maxGridWidth / grid.length);
    const gridSize = cellSize * grid.length;

    // Colores SciVerse
    const colors = {
      primary: "#1F9E98",      // Teal principal
      primaryDark: "#0F817C",  // Teal oscuro
      secondary: "#FB6542",    // Coral
      accent: "#FFBB00",       // Amarillo
      text: "#0F2E2C",         // Texto oscuro
      textLight: "#607B79",    // Texto claro
      border: "#C7E8E5",       // Borde teal claro
      highlight: "#FFBB00",    // Amarillo para resaltar
      background: "#F5FBFA",   // Fondo teal claro
      white: "#FFFFFF"
    };

    const canvasWidth = A4_WIDTH;
    const canvasHeight = A4_HEIGHT;

    const canvas = document.createElement("canvas");
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("No se pudo obtener el contexto del canvas");
    }

  // Fondo con gradiente SciVerse
  const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
  gradient.addColorStop(0, "#F5FBFA");
  gradient.addColorStop(1, colors.white);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let yPos = marginTop;

  // Título (más pequeño para A4)
  ctx.fillStyle = colors.primaryDark;
  ctx.font = "bold 22px 'Space Grotesk', Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(titulo, canvasWidth / 2, yPos);
  yPos += 28;

  // Dificultad y nivel en badge (más compacto)
  ctx.font = "10px 'Inter', Arial, sans-serif";
  ctx.fillStyle = colors.primary;
  const badgeText = `Dificultad: ${dificultad} | Nivel: ${grado}`;
  const metrics = ctx.measureText(badgeText);
  const badgeWidth = metrics.width + 12;
  const badgeX = (canvasWidth - badgeWidth) / 2;

  // Fondo del badge con estilo SciVerse
  ctx.fillStyle = colors.border + "40";
  ctx.fillRect(badgeX - 6, yPos - 12, badgeWidth, 18);
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 1;
  ctx.strokeRect(badgeX - 6, yPos - 12, badgeWidth, 18);

  ctx.fillStyle = colors.primary;
  ctx.textAlign = "center";
  ctx.fillText(badgeText, canvasWidth / 2, yPos);
  yPos += 24;

  // Sección de palabras a buscar (compacta para A4)
  if (type === "student") {
    ctx.fillStyle = colors.primary;
    ctx.font = "bold 13px 'Space Grotesk', Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("📋 Palabras a buscar:", marginSides, yPos);
    yPos += 16;

    // Palabras en línea simple
    ctx.font = "11px 'Inter', Arial, sans-serif";
    ctx.fillStyle = colors.text;
    const wordsLine = palabras.join(" • ");

    // Ajustar texto a ancho disponible
    let words = [];
    let currentLine = "";
    const wordArray = palabras.split(" • ");

    ctx.font = "11px 'Inter', Arial, sans-serif";
    for (let word of palabras) {
      const testLine = currentLine + (currentLine ? " • " : "") + word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > usableWidth - 20) {
        if (currentLine) words.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) words.push(currentLine);

    ctx.fillStyle = colors.text;
    words.forEach(line => {
      ctx.fillText(line, marginSides, yPos);
      yPos += 14;
    });
    yPos += 8;
  } else {
    ctx.fillStyle = colors.primary;
    ctx.font = "bold 13px 'Space Grotesk', Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("🔑 Solucionario", marginSides, yPos);
    yPos += 16;

    ctx.font = "10px 'Inter', Arial, sans-serif";
    ctx.fillStyle = colors.textLight;
    ctx.fillText("Las palabras están resaltadas en amarillo", marginSides, yPos);
    yPos += 14;
  }

  // Línea separadora
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(marginSides, yPos - 5);
  ctx.lineTo(canvasWidth - marginSides, yPos - 5);
  ctx.stroke();
  yPos += 12;

  // Dibujar grilla centrada
  const gridStartX = (canvasWidth - gridSize) / 2;
  const gridStartY = yPos;

  for (let i = 0; i < grid.length; i++) {
    for (let j = 0; j < grid[i].length; j++) {
      const x = gridStartX + j * cellSize;
      const y = gridStartY + i * cellSize;

      // Verificar si es parte de palabra
      let isPartOfWord = false;
      if (type === "solution") {
        isPartOfWord = placedWords.some(w => {
          const directionVectors = {
            horizontal: [0, 1], horizontal_back: [0, -1], vertical: [1, 0], vertical_back: [-1, 0],
            diagonal: [1, 1], diagonal_back: [-1, -1], diagonal2: [1, -1], diagonal2_back: [-1, 1]
          };
          const [dRow, dCol] = directionVectors[w.direction];
          for (let k = 0; k < w.word.length; k++) {
            if (w.row + k * dRow === i && w.col + k * dCol === j) return true;
          }
          return false;
        });
      }

      // Fondo de celda con sombra sutil
      if (isPartOfWord) {
        ctx.fillStyle = colors.highlight;
        ctx.shadowColor = "rgba(31, 158, 152, 0.2)";
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
      } else {
        ctx.fillStyle = colors.white;
        ctx.shadowColor = "rgba(15, 61, 58, 0.08)";
        ctx.shadowBlur = 2;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 1;
      }
      ctx.fillRect(x, y, cellSize, cellSize);
      ctx.shadowColor = "transparent";

      // Borde de celda
      ctx.strokeStyle = isPartOfWord ? colors.primary : colors.border;
      ctx.lineWidth = isPartOfWord ? 2 : 1.5;
      ctx.strokeRect(x, y, cellSize, cellSize);

      // Letra
      ctx.fillStyle = colors.text;
      ctx.font = "bold 16px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(grid[i][j], x + cellSize / 2, y + cellSize / 2);
    }
  }

  yPos = gridStartY + gridSize + 15;

  // Footer con información (compacto)
  ctx.font = "9px 'Inter', Arial, sans-serif";
  ctx.fillStyle = colors.textLight;
  ctx.textAlign = "center";
  ctx.fillText(`SciVerse - Sopa de Letras Interactiva | ${new Date().toLocaleDateString("es-ES")}`, canvasWidth / 2, yPos);

  // Línea decorativa inferior
  ctx.strokeStyle = colors.primary;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(marginSides, canvasHeight - marginBottom - 5);
  ctx.lineTo(canvasWidth - marginSides, canvasHeight - marginBottom - 5);
  ctx.stroke();

    // Convertir a imagen
    const imageData = canvas.toDataURL("image/png");
    if (!imageData) {
      throw new Error("No se pudo convertir el canvas a imagen");
    }
    return imageData;
  } catch (error) {
    console.error("Error generando imagen de sopa de letras:", error);
    throw new Error(`Error al generar la imagen: ${error.message}`);
  }
}

async function downloadImageFile(dataUrl, filename) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

async function downloadWordSearch({ titulo, palabras, gridData, dificultad, grado }) {
  try {
    const { grid, placedWords, gridSize } = gridData;

    const gridCells = grid.map(row =>
      new TableRow({
        children: row.map(letter =>
          new TableCell({
            width: { size: 800, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: "FFFFFF" },
            margins: { top: 30, bottom: 30, left: 30, right: 30 },
            borders: { top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" }, bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" }, left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" }, right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" } },
            children: [new Paragraph({
              text: letter,
              alignment: AlignmentType.CENTER,
              spacing: { line: 240 }
            })]
          })
        )
      })
    );

    const gridTable = new Table({
      width: { size: 9000, type: WidthType.DXA },
      layout: TableLayoutType.FIXED,
      rows: gridCells
    });

    const solutionCells = grid.map((row, rowIdx) =>
      new TableRow({
        children: row.map((letter, colIdx) => {
          const isPartOfWord = placedWords.some(w => {
            const directionVectors = {
              horizontal: [0, 1], horizontal_back: [0, -1], vertical: [1, 0], vertical_back: [-1, 0],
              diagonal: [1, 1], diagonal_back: [-1, -1], diagonal2: [1, -1], diagonal2_back: [-1, 1]
            };
            const [dRow, dCol] = directionVectors[w.direction];
            for (let i = 0; i < w.word.length; i++) {
              if (w.row + i * dRow === rowIdx && w.col + i * dCol === colIdx) return true;
            }
            return false;
          });

          return new TableCell({
            width: { size: 800, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: isPartOfWord ? "FFFFCC" : "FFFFFF" },
            margins: { top: 30, bottom: 30, left: 30, right: 30 },
            borders: { top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" }, bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" }, left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" }, right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" } },
            children: [new Paragraph({
              text: letter,
              alignment: AlignmentType.CENTER,
              spacing: { line: 240 }
            })]
          });
        })
      })
    );

    const solutionTable = new Table({
      width: { size: 9000, type: WidthType.DXA },
      layout: TableLayoutType.FIXED,
      rows: solutionCells
    });

    const slug = titulo.replace(/\s+/g, "-").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").slice(0, 40);

    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({ text: titulo, heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, spacing: { after: 100 } }),
          new Paragraph({ text: `Dificultad: ${dificultad} | Nivel: ${grado}`, alignment: AlignmentType.CENTER, spacing: { after: 200 }, italics: true }),

          new Paragraph({ text: "PARA EL ESTUDIANTE", heading: HeadingLevel.HEADING_2, spacing: { before: 100, after: 150 } }),
          new Paragraph({ text: "Palabras a buscar:", bold: true, spacing: { after: 80 } }),
          new Paragraph({ text: palabras.join(" • "), spacing: { after: 150 } }),
          new Paragraph({ text: "Encuentra todas las palabras en la sopa de letras. Pueden estar horizontales, verticales o diagonales.", spacing: { after: 150 } }),
          gridTable,

          new PageBreak(),

          new Paragraph({ text: "SOLUCIONARIO (Para el docente)", heading: HeadingLevel.HEADING_2, spacing: { before: 100, after: 150 } }),
          new Paragraph({ text: "Las palabras están resaltadas en amarillo:", italics: true, spacing: { after: 150 } }),
          solutionTable,

          new Paragraph({ text: " " }),
          new Paragraph({ text: "Palabras encontradas:", bold: true, spacing: { before: 150, after: 80 } }),
          ...palabras.map(p => new Paragraph({ text: `✓ ${p}`, bullet: { level: 0 }, spacing: { after: 40 } }))
        ]
      }]
    });

    await triggerWordDownload(doc, `${slug}.docx`);
  } catch (error) {
    console.error("Error descargando Word:", error);
    alert("Error al descargar. Intenta de nuevo.");
  }
}

function WordSearchGenerator({ initialGrade = "primaria", profile = {} }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ tema: "", palabras: "", grado: initialGrade, area: "", dificultad: "media" });
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  const suggestPalabras = async () => {
    if (!form.tema) {
      alert("Por favor ingresa un tema primero");
      return;
    }
    setSuggesting(true);
    try {
      // Palabras sugeridas por tema (base de datos simple)
      const temaPalabras = {
        animales: ["jaguar", "anaconda", "loro", "cocodrilo", "tapir", "guacamayo", "caimán", "venado", "armadillo"],
        frutas: ["manzana", "plátano", "naranja", "uva", "fresa", "piña", "papaya", "mango", "sandía"],
        colores: ["rojo", "azul", "verde", "amarillo", "naranja", "morado", "rosa", "negro", "blanco"],
        numeros: ["uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"],
        cuerpo: ["cabeza", "brazo", "pierna", "mano", "pie", "ojo", "nariz", "boca", "oreja"],
        escuela: ["libro", "lápiz", "mesa", "silla", "pizarra", "alumno", "maestro", "cuaderno", "tiza"],
        familia: ["padre", "madre", "hijo", "hija", "abuelo", "hermano", "tía", "tío", "primo"],
        casa: ["puerta", "ventana", "techo", "piso", "pared", "sala", "cocina", "dormitorio", "baño"],
        transporte: ["auto", "bicicleta", "avión", "barco", "tren", "bus", "moto", "bote", "carro"],
        naturaleza: ["árbol", "flor", "hierba", "agua", "montaña", "río", "lago", "mar", "bosque"]
      };

      // Buscar palabras relevantes por tema
      let palabrasSugeridas = [];
      const temaBajo = form.tema.toLowerCase();

      for (const [categoria, palabras] of Object.entries(temaPalabras)) {
        if (temaBajo.includes(categoria)) {
          palabrasSugeridas = palabras;
          break;
        }
      }

      // Si no encuentra coincidencia, usar palabras relacionadas al tema
      if (palabrasSugeridas.length === 0) {
        palabrasSugeridas = temaPalabras.naturaleza;
      }

      // Seleccionar 10 palabras al azar
      const seleccionadas = palabrasSugeridas
        .sort(() => Math.random() - 0.5)
        .slice(0, 10);

      setForm({...form, palabras: seleccionadas.join(", ")});
      alert(`Kantu sugirió ${seleccionadas.length} palabras para: "${form.tema}"`);
    } catch (err) {
      console.error("Error sugerencia:", err);
      alert("No se pudo generar las palabras. Intenta escribirlas manualmente.");
    }
    setSuggesting(false);
  };

  const handleGenerate = () => {
    setLoading(true);
    setTimeout(() => {
      const palabrasList = form.palabras.split(",").map(p => p.trim()).filter(Boolean);
      if (palabrasList.length === 0) {
        alert("Por favor ingresa al menos una palabra");
        setLoading(false);
        return;
      }

      const gridData = generateWordSearchGrid(palabrasList, form.dificultad);

      setPreview({
        titulo: `Sopa de letras: ${form.tema}`,
        palabras: palabrasList,
        grado: form.grado,
        dificultad: form.dificultad.charAt(0).toUpperCase() + form.dificultad.slice(1),
        gridData: gridData
      });
      setStep(2);
      setLoading(false);
    }, 1500);
  };

  const handleDownloadWord = () => {
    downloadWordSearch({
      titulo: preview.titulo,
      palabras: preview.palabras,
      gridData: preview.gridData,
      dificultad: preview.dificultad,
      grado: preview.grado
    });
  };

  const handleDownloadPdf = () => {
    alert("PDF download coming soon. Por ahora descarga en Word y convierte a PDF con tu navegador (Imprimir > Guardar como PDF)");
  };

  const handleDownloadImage = async () => {
    try {
      if (!preview || !preview.gridData) {
        alert("No hay datos para generar la imagen. Intenta generar nuevamente.");
        return;
      }
      const imageUrl = await generateWordSearchImage({
        titulo: preview.titulo,
        palabras: preview.palabras,
        gridData: preview.gridData,
        dificultad: preview.dificultad,
        grado: preview.grado,
        type: "student"
      });

      const slug = preview.titulo.replace(/\s+/g, "-").toLowerCase();
      await downloadImageFile(imageUrl, `${slug}-student.png`);
    } catch (err) {
      console.error("Error descargando imagen estudiante:", err);
      alert(`Error al generar la imagen: ${err.message}`);
    }
  };

  const handleDownloadSolutionImage = async () => {
    try {
      if (!preview || !preview.gridData) {
        alert("No hay datos para generar la imagen. Intenta generar nuevamente.");
        return;
      }
      const imageUrl = await generateWordSearchImage({
        titulo: preview.titulo,
        palabras: preview.palabras,
        gridData: preview.gridData,
        dificultad: preview.dificultad,
        grado: preview.grado,
        type: "solution"
      });

      const slug = preview.titulo.replace(/\s+/g, "-").toLowerCase();
      await downloadImageFile(imageUrl, `${slug}-solution.png`);
    } catch (err) {
      console.error("Error descargando imagen solucionario:", err);
      alert(`Error al generar la imagen: ${err.message}`);
    }
  };

  const renderGrid = (grid) => {
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${grid.length}, 1fr)`,
        gap: '2px',
        padding: '10px',
        backgroundColor: '#f5f5f5',
        borderRadius: '4px',
        maxWidth: '400px'
      }}>
        {grid.map((row, i) =>
          row.map((letter, j) => (
            <div key={`${i}-${j}`} style={{
              width: '20px',
              height: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#fff',
              border: '1px solid #ddd',
              fontSize: '12px',
              fontFamily: 'monospace',
              fontWeight: 'bold'
            }}>
              {letter}
            </div>
          ))
        )}
      </div>
    );
  };

  return (
    <div className="generator-wrapper">
      {step === 1 && (
        <div className="wizard-card">
          <div className="wizard-card__title">
            <span><Search size={18} /></span>
            <div>
              <h4>Sopa de letras</h4>
              <p>Define el tema y las palabras que quieres incluir en el juego.</p>
            </div>
          </div>
          <div className="generator-form">
            <label>
              <span>Tema o título</span>
              <input value={form.tema} onChange={(e) => setForm({...form, tema: e.target.value})} placeholder="Ej: Animales de la selva" />
            </label>
            <label>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Palabras (separadas por comas)</span>
                <button onClick={suggestPalabras} disabled={suggesting || !form.tema} style={{ fontSize: '12px', padding: '4px 12px', marginTop: '0' }}>
                  {suggesting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {suggesting ? "Sugiriendo..." : "Sugerir con Kantu"}
                </button>
              </div>
              <textarea value={form.palabras} onChange={(e) => setForm({...form, palabras: e.target.value})} placeholder="jaguar, anaconda, loro, cocodrilo, tapir" rows="5" />
            </label>
            <label>
              <span>Nivel de dificultad</span>
              <select value={form.dificultad} onChange={(e) => setForm({...form, dificultad: e.target.value})}>
                <option value="facil">Fácil (10x10)</option>
                <option value="media">Medio (12x12)</option>
                <option value="dificil">Difícil (14x14)</option>
              </select>
            </label>
            <label>
              <span>Nivel educativo</span>
              <select value={form.grado} onChange={(e) => setForm({...form, grado: e.target.value})}>
                <option value="primaria">Primaria</option>
                <option value="secundaria">Secundaria</option>
              </select>
            </label>
            <button className="primary" onClick={handleGenerate} disabled={loading || !form.tema || !form.palabras}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {loading ? "Creando..." : "Generar previsualización"}
            </button>
          </div>
        </div>
      )}

      {step === 2 && preview && (
        <div className="preview-result">
          <div className="preview-header">
            <div>
              <button onClick={() => setStep(1)} className="back-btn">← Editar</button>
            </div>
            <div>
              <h3>{preview.titulo}</h3>
              <small>PASO 2 DE 2: PREVISUALIZACIÓN • DIFICULTAD: {preview.dificultad.toUpperCase()}</small>
            </div>
            <div></div>
          </div>

          <div className="preview-section how-to-use">
            <h4>¿Cómo se usa este recurso?</h4>
            <div className="how-to-steps">
              <div className="step">
                <span className="step-number">1</span>
                <p>Lee la lista de palabras a buscar.</p>
              </div>
              <div className="step">
                <span className="step-number">2</span>
                <p>Encuentra cada palabra en la sopa de letras (horizontal, vertical o diagonal).</p>
              </div>
              <div className="step">
                <span className="step-number">3</span>
                <p>Marca la palabra cuando la localices.</p>
              </div>
            </div>
            <div className="tip-box">
              <Sparkles size={16} /> <strong>Tip para el docente:</strong> Pide que escriban una oración con tres de las palabras encontradas.
            </div>
          </div>

          <div className="preview-section preview-box">
            <h4>Vista previa del recurso</h4>
            <div className="preview-pages">
              <div className="preview-page page-1">
                <h5>{preview.titulo}</h5>
                <p className="page-label">Página 1 - Para el estudiante</p>
                <div className="wordsearch-preview">
                  <div className="word-list">
                    <strong>Palabras a buscar:</strong>
                    <div className="words">{preview.palabras.join(" • ")}</div>
                  </div>
                  <div className="grid-preview">
                    {renderGrid(preview.gridData.grid)}
                  </div>
                </div>
              </div>
              <div className="preview-page page-2">
                <h5>{preview.titulo}</h5>
                <p className="page-label">Página 2 - Solucionario (para el docente)</p>
                <div className="worksearch-solution">
                  <p className="solution-note">Palabras encontradas (resaltadas en amarillo):</p>
                  <div className="words-found">{preview.palabras.map((w, i) => <span key={i}>✓ {w}</span>)}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="preview-actions">
            <button onClick={() => setStep(1)} className="secondary">
              Editar parámetros
            </button>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button onClick={handleDownloadImage} className="primary" title="Descargar versión estudiante como imagen PNG">
                <Download size={16} /> Imagen Estudiante
              </button>
              <button onClick={handleDownloadSolutionImage} className="primary" title="Descargar solucionario como imagen PNG">
                <Download size={16} /> Imagen Solucionario
              </button>
              <button onClick={handleDownloadWord} className="primary">
                <Download size={16} /> Word
              </button>
              <button onClick={handleDownloadPdf} className="primary">
                <Download size={16} /> PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CrosswordGenerator({ initialGrade = "primaria", profile = {} }) {
  const [form, setForm] = useState({ tema: "", clues: "", grado: initialGrade, area: "" });
  const [resultado, setResultado] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = () => {
    setLoading(true);
    setTimeout(() => {
      const cluesList = form.clues.split("\n").filter(Boolean);
      setResultado({
        titulo: `Crucigrama: ${form.tema}`,
        clues: cluesList,
        dificultad: form.grado === "primaria" ? "Media" : "Alta",
      });
      setLoading(false);
    }, 1200);
  };

  return (
    <div className="generator-wrapper">
      {!resultado ? (
        <div className="wizard-card">
          <div className="wizard-card__title">
            <span><Layers size={18} /></span>
            <div>
              <h4>Crucigrama</h4>
              <p>Ingresa el tema y las pistas para generar un crucigrama personalizado.</p>
            </div>
          </div>
          <div className="generator-form">
            <label>
              <span>Tema o título</span>
              <input value={form.tema} onChange={(e) => setForm({...form, tema: e.target.value})} placeholder="Ej: Sistema solar" />
            </label>
            <label>
              <span>Pistas (una por línea)</span>
              <textarea value={form.clues} onChange={(e) => setForm({...form, clues: e.target.value})} placeholder="Planeta rojo&#10;Satélite natural de la Tierra&#10;Estrella central del sistema" rows="6" />
            </label>
            <label>
              <span>Grado</span>
              <select value={form.grado} onChange={(e) => setForm({...form, grado: e.target.value})}>
                <option value="primaria">Primaria</option>
                <option value="secundaria">Secundaria</option>
              </select>
            </label>
            <button className="primary" onClick={handleGenerate} disabled={loading || !form.tema || !form.clues}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {loading ? "Creando..." : "Generar crucigrama"}
            </button>
          </div>
        </div>
      ) : (
        <div className="instrument-result">
          <div className="instrument-result__actions">
            <div>
              <small>CRUCIGRAMA LISTO</small>
              <h3>{resultado.titulo}</h3>
            </div>
            <div>
              <button onClick={() => setResultado(null)}>← Crear otro</button>
              <button className="primary" onClick={() => downloadWord(`${resultado.titulo}.docx`, `${resultado.titulo}\n\nPistas:\n${resultado.clues.join("\n")}`, resultado.titulo)}>
                <Download size={14} /> Descargar
              </button>
            </div>
          </div>
          <div className="instrument-meta">
            <strong>Pistas ({resultado.clues.length})</strong>
            <ol>
              {resultado.clues.map((clue, idx) => <li key={idx}>{clue}</li>)}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

function LearningUnitGenerator({ initialGrade = "primaria", profile = {} }) {
  const [form, setForm] = useState({ tema: "", duracion: "4 semanas", grado: initialGrade, area: "" });
  const [resultado, setResultado] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = () => {
    setLoading(true);
    setTimeout(() => {
      setResultado({
        titulo: `Unidad: ${form.tema}`,
        duracion: form.duracion,
        sesiones: 8,
      });
      setLoading(false);
    }, 1200);
  };

  return (
    <div className="generator-wrapper">
      {!resultado ? (
        <div className="wizard-card">
          <div className="wizard-card__title">
            <span><Layers size={18} /></span>
            <div>
              <h4>Unidad de aprendizaje</h4>
              <p>Organiza una secuencia de sesiones articuladas.</p>
            </div>
          </div>
          <div className="generator-form">
            <label>
              <span>Tema de la unidad</span>
              <input value={form.tema} onChange={(e) => setForm({...form, tema: e.target.value})} placeholder="Ej: Los ecosistemas del Perú" />
            </label>
            <label>
              <span>Duración estimada</span>
              <select value={form.duracion} onChange={(e) => setForm({...form, duracion: e.target.value})}>
                <option value="2 semanas">2 semanas</option>
                <option value="3 semanas">3 semanas</option>
                <option value="4 semanas">4 semanas</option>
                <option value="6 semanas">6 semanas</option>
              </select>
            </label>
            <label>
              <span>Grado</span>
              <select value={form.grado} onChange={(e) => setForm({...form, grado: e.target.value})}>
                <option value="primaria">Primaria</option>
                <option value="secundaria">Secundaria</option>
              </select>
            </label>
            <button className="primary" onClick={handleGenerate} disabled={loading || !form.tema}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {loading ? "Creando..." : "Generar unidad"}
            </button>
          </div>
        </div>
      ) : (
        <div className="instrument-result">
          <div className="instrument-result__actions">
            <div>
              <small>UNIDAD GENERADA</small>
              <h3>{resultado.titulo}</h3>
            </div>
            <div>
              <button onClick={() => setResultado(null)}>← Crear otra</button>
              <button className="primary" onClick={() => downloadWord(`${resultado.titulo}.docx`, `${resultado.titulo}\nDuración: ${resultado.duracion}`, resultado.titulo)}>
                <Download size={14} /> Descargar
              </button>
            </div>
          </div>
          <div className="instrument-meta">
            <strong>Estructura estimada</strong>
            <p>Duración: {resultado.duracion}</p>
            <p>Sesiones: {resultado.sesiones}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function WorksheetGenerator({ initialGrade = "primaria", profile = {} }) {
  const [form, setForm] = useState({ tema: "", actividades: "", grado: initialGrade, area: "" });
  const [resultado, setResultado] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = () => {
    setLoading(true);
    setTimeout(() => {
      const acts = form.actividades.split("\n").filter(Boolean);
      setResultado({
        titulo: `Ficha de trabajo: ${form.tema}`,
        actividades: acts,
      });
      setLoading(false);
    }, 1200);
  };

  return (
    <div className="generator-wrapper">
      {!resultado ? (
        <div className="wizard-card">
          <div className="wizard-card__title">
            <span><FileText size={18} /></span>
            <div>
              <h4>Ficha de trabajo</h4>
              <p>Crea actividades prácticas para estudiantes.</p>
            </div>
          </div>
          <div className="generator-form">
            <label>
              <span>Tema</span>
              <input value={form.tema} onChange={(e) => setForm({...form, tema: e.target.value})} placeholder="Ej: Operaciones con fracciones" />
            </label>
            <label>
              <span>Actividades (una por línea)</span>
              <textarea value={form.actividades} onChange={(e) => setForm({...form, actividades: e.target.value})} placeholder="Resuelve los siguientes problemas&#10;Dibuja lo que se indica&#10;Completa la tabla" rows="6" />
            </label>
            <label>
              <span>Grado</span>
              <select value={form.grado} onChange={(e) => setForm({...form, grado: e.target.value})}>
                <option value="primaria">Primaria</option>
                <option value="secundaria">Secundaria</option>
              </select>
            </label>
            <button className="primary" onClick={handleGenerate} disabled={loading || !form.tema || !form.actividades}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {loading ? "Creando..." : "Generar ficha"}
            </button>
          </div>
        </div>
      ) : (
        <div className="instrument-result">
          <div className="instrument-result__actions">
            <div>
              <small>FICHA LISTA</small>
              <h3>{resultado.titulo}</h3>
            </div>
            <div>
              <button onClick={() => setResultado(null)}>← Crear otra</button>
              <button className="primary" onClick={() => downloadWord(`${resultado.titulo}.docx`, `${resultado.titulo}\n\nActividades:\n${resultado.actividades.join("\n")}`, resultado.titulo)}>
                <Download size={14} /> Descargar
              </button>
            </div>
          </div>
          <div className="instrument-meta">
            <strong>Actividades incluidas ({resultado.actividades.length})</strong>
            <ol>
              {resultado.actividades.map((act, idx) => <li key={idx}>{act}</li>)}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

function ReadingGenerator({ initialGrade = "primaria", profile = {} }) {
  const [form, setForm] = useState({ tema: "", contexto: "", grado: initialGrade, area: "" });
  const [resultado, setResultado] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = () => {
    setLoading(true);
    setTimeout(() => {
      setResultado({
        titulo: `Lectura: ${form.tema}`,
        tema: form.tema,
        nivel: form.grado === "primaria" ? "Básico" : "Avanzado",
      });
      setLoading(false);
    }, 1200);
  };

  return (
    <div className="generator-wrapper">
      {!resultado ? (
        <div className="wizard-card">
          <div className="wizard-card__title">
            <span><BookOpen size={18} /></span>
            <div>
              <h4>Generador de lecturas</h4>
              <p>Crea textos educativos personalizados.</p>
            </div>
          </div>
          <div className="generator-form">
            <label>
              <span>Tema de la lectura</span>
              <input value={form.tema} onChange={(e) => setForm({...form, tema: e.target.value})} placeholder="Ej: La fotosíntesis" />
            </label>
            <label>
              <span>Contexto o enfoque</span>
              <textarea value={form.contexto} onChange={(e) => setForm({...form, contexto: e.target.value})} placeholder="Ej: Conectado con la realidad local del estudiante" rows="4" />
            </label>
            <label>
              <span>Grado</span>
              <select value={form.grado} onChange={(e) => setForm({...form, grado: e.target.value})}>
                <option value="primaria">Primaria</option>
                <option value="secundaria">Secundaria</option>
              </select>
            </label>
            <button className="primary" onClick={handleGenerate} disabled={loading || !form.tema}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {loading ? "Creando..." : "Generar lectura"}
            </button>
          </div>
        </div>
      ) : (
        <div className="instrument-result">
          <div className="instrument-result__actions">
            <div>
              <small>LECTURA LISTA</small>
              <h3>{resultado.titulo}</h3>
            </div>
            <div>
              <button onClick={() => setResultado(null)}>← Crear otra</button>
              <button className="primary" onClick={() => downloadWord(`${resultado.titulo}.docx`, `${resultado.titulo}\n\nTema: ${resultado.tema}`, resultado.titulo)}>
                <Download size={14} /> Descargar
              </button>
            </div>
          </div>
          <div className="instrument-meta">
            <strong>Información</strong>
            <p>Tema: {resultado.tema}</p>
            <p>Nivel: {resultado.nivel}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function EvaluationSheetGenerator({ initialGrade = "primaria", profile = {} }) {
  const [form, setForm] = useState({ tema: "", criterios: "", grado: initialGrade, area: "" });
  const [resultado, setResultado] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = () => {
    setLoading(true);
    setTimeout(() => {
      const crits = form.criterios.split("\n").filter(Boolean);
      setResultado({
        titulo: `Ficha de evaluación: ${form.tema}`,
        criterios: crits,
      });
      setLoading(false);
    }, 1200);
  };

  return (
    <div className="generator-wrapper">
      {!resultado ? (
        <div className="wizard-card">
          <div className="wizard-card__title">
            <span><FileText size={18} /></span>
            <div>
              <h4>Ficha de evaluación</h4>
              <p>Registro de observaciones del desempeño estudiantil.</p>
            </div>
          </div>
          <div className="generator-form">
            <label>
              <span>Tema o sesión</span>
              <input value={form.tema} onChange={(e) => setForm({...form, tema: e.target.value})} placeholder="Ej: Resolución de problemas" />
            </label>
            <label>
              <span>Criterios de observación (uno por línea)</span>
              <textarea value={form.criterios} onChange={(e) => setForm({...form, criterios: e.target.value})} placeholder="Identifica datos relevantes&#10;Aplica estrategias correctamente&#10;Comunica resultados" rows="6" />
            </label>
            <label>
              <span>Grado</span>
              <select value={form.grado} onChange={(e) => setForm({...form, grado: e.target.value})}>
                <option value="primaria">Primaria</option>
                <option value="secundaria">Secundaria</option>
              </select>
            </label>
            <button className="primary" onClick={handleGenerate} disabled={loading || !form.tema || !form.criterios}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {loading ? "Creando..." : "Generar ficha"}
            </button>
          </div>
        </div>
      ) : (
        <div className="instrument-result">
          <div className="instrument-result__actions">
            <div>
              <small>FICHA DE EVALUACIÓN LISTA</small>
              <h3>{resultado.titulo}</h3>
            </div>
            <div>
              <button onClick={() => setResultado(null)}>← Crear otra</button>
              <button className="primary" onClick={() => downloadWord(`${resultado.titulo}.docx`, `${resultado.titulo}\n\nCriterios:\n${resultado.criterios.join("\n")}`, resultado.titulo)}>
                <Download size={14} /> Descargar
              </button>
            </div>
          </div>
          <div className="instrument-meta">
            <strong>Criterios de observación ({resultado.criterios.length})</strong>
            <ol>
              {resultado.criterios.map((crit, idx) => <li key={idx}>{crit}</li>)}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}


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

    {loading&&<div className="kantu-working"><div className="kantu-working__visual"><span className="kantu-orbit"><Sparkles size={15}/></span><img loading="lazy" src="/mascot/kantu-material.webp" alt="Kantu creando el proyecto"/></div><div className="kantu-working__copy"><small>KANTU ESTÁ TRABAJANDO</small><h4>Estoy organizando el proyecto por semanas…</h4><p>Relaciono la situación significativa, las áreas STEAM, las competencias y el producto final.</p><div className="kantu-progress"><i/><i/><i/></div></div></div>}

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
  const resourceSave = useMaterialSave();
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
      await resourceSave.save({tipo:type,titulo:data.resource.titulo||form.tema,form:{...form,tema:form.tema},contenido:data.resource});
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
    :<div className="instrument-result"><div className="instrument-result__actions"><div><small>{isReading?"FICHA DE LECTURA":"FICHA DE TRABAJO"}</small><h3>{resource.titulo}</h3></div><div><button onClick={()=>setResource(null)}>← Crear otra</button><button className="primary" onClick={()=>downloadWord(`${isReading?"ficha-lectura":"ficha-trabajo"}.docx`,resourceText(),resource.titulo)}><Download size={14}/> Word</button></div></div><SaveStatus state={resourceSave.state} onRetry={resourceSave.retry} onDownload={()=>downloadWord(`${isReading?"ficha-lectura":"ficha-trabajo"}.docx`,resourceText(),resource.titulo)} /><pre className="resource-document-preview">{resourceText()}</pre></div>}
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
      try{await saveTeacherMaterial({tipo:"rating_scale",titulo:data.resource.titulo||form.tema,form,contenido:data.resource});}catch(e){console.error(e);setError(describeSaveError(e)+" Tu contenido sigue en pantalla y puedes descargarlo.");}
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


function FlowChoiceCard({icon:Icon,title,description,onClick,accent="teal"}){
  return <button type="button" className={`flow-choice-card ${accent}`} onClick={onClick}>
    <span><Icon size={28}/></span><div><h3>{title}</h3><p>{description}</p><b>Continuar <ArrowRight size={15}/></b></div>
  </button>;
}

function LinkedWorksheetGenerator({sessionContext,profile={},onFinish}){
  const [questionTypes,setQuestionTypes]=useState(["opcion_multiple"]);
  const [questionCount,setQuestionCount]=useState(10);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [resource,setResource]=useState(null);
  const form=sessionContext?.form||{};
  const session=sessionContext?.result||{};
  const teacher=getTeacherFullName(profile);
  const toggle=(type)=>setQuestionTypes(current=>current.includes(type)?(current.length===1?current:current.filter(x=>x!==type)):[...current,type]);
  const typeLabels={abierta:"Preguntas abiertas",opcion_multiple:"Opción múltiple",lectura:"Lectura y preguntas",verdadero_falso:"Verdadero o falso"};

  async function generate(){
    setLoading(true);setError("");
    try{
      const {data:{session:authSession}}=await supabase.auth.getSession();
      const response=await fetch("/api/generate-linked-worksheet",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${authSession?.access_token||""}`},body:JSON.stringify({session,form,options:{questionTypes,questionCount}})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"No se pudo generar la ficha de trabajo.");
      setResource(data.resource);
      try{await saveTeacherMaterial({tipo:"worksheet",titulo:data.resource.titulo||session.titulo||form.tema,form:{...form,tema:session.titulo||form.tema},contenido:data.resource});}catch(e){console.error(e);setError(describeSaveError(e)+" Tu contenido sigue en pantalla y puedes descargarlo.");}
    }catch(e){setError(e.message);}finally{setLoading(false);}
  }

  function studentText(){
    if(!resource)return "";
    const questions=(resource.preguntas||[]).map((q,i)=>{
      const opts=(q.opciones||[]).length?"\n"+(q.opciones||[]).map((o,j)=>`${String.fromCharCode(65+j)}. ${o}`).join("\n"):"";
      const reading=q.textoLectura?`\nLECTURA\n${q.textoLectura}\n`:"";
      return `${i+1}. ${q.pregunta}${reading}${opts}\n\n____________________________________________________________\n____________________________________________________________`;
    }).join("\n\n");
    return `FICHA DE TRABAJO · PREGUNTAS Y RESPUESTAS\n\nNombre y apellidos: ______________________________________________\nInstitución educativa: ___________________________________________\nGrado y sección: ${form.grado||""}${form.seccion?` · ${form.seccion}`:""}\nÁrea / tema: ${form.area||""} / ${session.titulo||form.tema||""}\nFecha: ${form.fecha||"____ / ____ / ____"}\n\nInstrucciones: ${resource.instrucciones||"Lee cada pregunta con atención y responde de forma clara y completa."}\n\n${questions}`;
  }

  if(resource)return <div className="linked-resource-result">
    <div className="flow-actionbar">
      <button onClick={()=>setResource(null)}><Pencil size={15}/> Editar</button>
      <button onClick={()=>downloadWord("ficha-de-trabajo.docx",studentText(),resource.titulo)}><Download size={15}/> Descargar Word</button>
      <button onClick={()=>window.print()}><Printer size={15}/> Descargar PDF</button>
      <button className="flow-next-btn" onClick={()=>onFinish?.({form,resource})}>Terminar <CheckCircle2 size={16}/></button>
    </div>
    <div className="worksheet-preview-card">
      <div className="worksheet-preview-head"><small>FICHA DE TRABAJO</small><h2>{resource.titulo}</h2><p>{form.area} · {form.grado}{form.seccion?` · ${form.seccion}`:""}</p></div>
      <div className="worksheet-student-data"><div><b>NOMBRES Y APELLIDOS</b><span/></div><div><b>ÁREA</b><p>{form.area}</p><b>GRADO</b><p>{form.grado}{form.seccion?` · ${form.seccion}`:""}</p></div><div><b>FECHA</b><p>{form.fecha||""}</p><b>DOCENTE</b><p>{teacher}</p></div></div>
      <p className="worksheet-instructions">{resource.instrucciones}</p>
      <div className="worksheet-questions">{(resource.preguntas||[]).map((q,i)=><article key={i}><span>{i+1}</span><div>{q.textoLectura&&<blockquote>{q.textoLectura}</blockquote>}<h4>{q.pregunta}</h4>{!!q.opciones?.length&&<ul>{q.opciones.map((o,j)=><li key={j}>{String.fromCharCode(65+j)}. {o}</li>)}</ul>}<div className="answer-lines"><i/><i/></div></div></article>)}</div>
    </div>
  </div>;

  return <div className="linked-worksheet-builder">
    <div className="flow-page-title"><small>MATERIAL DE LA SESIÓN</small><h2>Ficha de trabajo</h2><p>La ficha utilizará automáticamente el tema, el propósito y los aprendizajes de la sesión.</p></div>
    <div className="worksheet-config-card">
      <h3>Tipos de preguntas</h3>
      <div className="question-type-grid">
        {[
          ["abierta",Pencil,"Preguntas abiertas","Desarrollo libre donde el estudiante redacta su respuesta"],
          ["opcion_multiple",ListChecks,"Opción múltiple","Selección entre alternativas con una respuesta correcta"],
          ["lectura",BookOpen,"Lectura y preguntas","Texto breve seguido de preguntas de comprensión"],
          ["verdadero_falso",CheckCircle2,"Verdadero o falso","Afirmaciones que el estudiante clasifica como verdaderas o falsas"],
        ].map(([type,Icon,title,desc])=><button type="button" key={type} className={questionTypes.includes(type)?"selected":""} onClick={()=>toggle(type)}><i>{questionTypes.includes(type)?<CheckCircle2 size={18}/>:<span/>}</i><Icon size={24}/><div><strong>{title}</strong><p>{desc}</p></div></button>)}
      </div>
      <div className="question-count-control"><div><strong>Cantidad total de preguntas</strong><small>Mínimo 5, máximo 20</small></div><div><button onClick={()=>setQuestionCount(n=>Math.max(5,n-1))}>−</button><b>{questionCount} preguntas</b><button onClick={()=>setQuestionCount(n=>Math.min(20,n+1))}>+</button></div></div>
      {error&&<p className="wizard-error">{error}</p>}
      <div className="worksheet-generate-row"><button className="wizard-next" onClick={generate} disabled={loading}>{loading?<Loader2 size={16} className="animate-spin"/>:<Sparkles size={16}/>} {loading?`Generando preguntas — 0 de ${questionCount}`:"Generar ficha"} <ArrowRight size={15}/></button></div>
    </div>
  </div>;
}

function LinkedReadingGenerator({sessionContext,profile={},onFinish}){
  const [loading,setLoading]=useState(false);const[error,setError]=useState("");const[resource,setResource]=useState(null);
  const form=sessionContext?.form||{};const session=sessionContext?.result||{};
  async function generate(){setLoading(true);setError("");try{const {data:{session:authSession}}=await supabase.auth.getSession();const response=await fetch("/api/generate-session-resource",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${authSession?.access_token||""}`},body:JSON.stringify({type:"reading",form,session,options:{readingLength:"media"}})});const data=await response.json();if(!response.ok)throw new Error(data.error||"No se pudo generar la ficha de lectura.");setResource(data.resource);try{await saveTeacherMaterial({tipo:"reading",titulo:data.resource.titulo,form:{...form,tema:session.titulo||form.tema},contenido:data.resource});}catch(e){console.error(e);setError(describeSaveError(e)+" Tu contenido sigue en pantalla y puedes descargarlo.");}}catch(e){setError(e.message)}finally{setLoading(false)}}
  function text(){if(!resource)return"";const groups={literal:[],inferencial:[],critico:[]};(resource.preguntas||[]).forEach(q=>(groups[q.nivel]||groups.critico).push(q.pregunta));return `FICHA DE LECTURA\n\nNombre y apellidos: ______________________________________________\nInstitución educativa: ___________________________________________\nGrado y sección: ${form.grado||""}${form.seccion?` · ${form.seccion}`:""}\nÁrea / curso: ${form.area||"Comunicación"}\nFecha: ${form.fecha||""}\nDocente: ${getTeacherFullName(profile)}\n\n${resource.titulo}\n\n${resource.texto}\n\nNIVEL LITERAL\n${groups.literal.map((q,i)=>`${i+1}. ${q}\n______________________________________________`).join("\n")}\n\nNIVEL INFERENCIAL\n${groups.inferencial.map((q,i)=>`${i+1}. ${q}\n______________________________________________`).join("\n")}\n\nNIVEL CRÍTICO\n${groups.critico.map((q,i)=>`${i+1}. ${q}\n______________________________________________`).join("\n")}\n\nNIVEL REFLEXIVO\n1. ¿Cómo relacionas lo leído con una experiencia de tu vida?\n______________________________________________\n2. ¿Qué enseñanza podrías aplicar en tu entorno?\n______________________________________________`;}
  if(!resource)return <div className="flow-centered-card"><BookOpen size={38}/><h2>Ficha de lectura</h2><p>Kantu creará una lectura alineada a la sesión y preguntas de comprensión.</p>{error&&<p className="wizard-error">{error}</p>}<button className="wizard-next" onClick={generate} disabled={loading}>{loading?<Loader2 className="animate-spin" size={16}/>:<Sparkles size={16}/>} {loading?"Generando lectura...":"Generar ficha de lectura"}</button></div>;
  return <div><div className="flow-actionbar"><button onClick={()=>setResource(null)}><Pencil size={15}/> Editar</button><button onClick={()=>downloadWord("ficha-de-lectura.docx",text(),resource.titulo)}><Download size={15}/> Descargar Word</button><button onClick={()=>window.print()}><Printer size={15}/> Descargar PDF</button><button className="flow-next-btn" onClick={()=>onFinish?.({form,resource})}>Terminar <CheckCircle2 size={16}/></button></div><pre className="resource-document-preview">{text()}</pre></div>;
}

function LinkedRatingScaleGenerator({sessionContext,profile={},onNext}){
  const form=sessionContext?.form||{};const session=sessionContext?.result||{};const[loading,setLoading]=useState(false);const[error,setError]=useState("");const[resource,setResource]=useState(null);
  async function generate(){setLoading(true);setError("");try{const {data:{session:authSession}}=await supabase.auth.getSession();const response=await fetch("/api/generate-session-resource",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${authSession?.access_token||""}`},body:JSON.stringify({type:"rating_scale",form,session,options:{numeroCriterios:4,scaleType:"frecuencia"}})});const data=await response.json();if(!response.ok)throw new Error(data.error||"No se pudo generar la escala.");setResource(data.resource);try{await saveTeacherMaterial({tipo:"rating_scale",titulo:data.resource.titulo,form:{...form,tema:session.titulo||form.tema},contenido:data.resource});}catch(e){console.error(e);setError(describeSaveError(e)+" Tu contenido sigue en pantalla y puedes descargarlo.")}}catch(e){setError(e.message)}finally{setLoading(false)}}
  function text(){if(!resource)return"";return `ESCALA DE VALORACIÓN · REGISTRO DE AULA\n\nInstitución educativa / Docente: ${profile.ie||""} / ${getTeacherFullName(profile)}\nGrado y sección: ${form.grado||""}${form.seccion?` · ${form.seccion}`:""}\nÁrea: ${form.area||""}\nCompetencia: ${resource.competencia||form.competencia||""}\n\nEscala: SIEMPRE · A VECES · NO LO HACE · NO OBSERVADO\n\n${(resource.criterios||[]).map((c,i)=>`CRITERIO ${i+1}: ${c.criterio}`).join("\n")}\n\nN.º | APELLIDOS Y NOMBRES | SIEMPRE | A VECES | NO LO HACE | NO OBSERVADO\n${Array.from({length:25},(_,i)=>`${i+1}. | __________________________ | ___ | ___ | ___ | ___`).join("\n")}`;}
  if(!resource)return <div className="flow-centered-card"><ListChecks size={38}/><h2>Escala de valoración</h2><p>Se generará a partir de la competencia, evidencia y criterios de la sesión.</p>{error&&<p className="wizard-error">{error}</p>}<button className="wizard-next" onClick={generate} disabled={loading}>{loading?<Loader2 className="animate-spin" size={16}/>:<Sparkles size={16}/>} Generar escala</button></div>;
  return <div><div className="flow-actionbar"><button onClick={()=>setResource(null)}><Pencil size={15}/> Editar</button><button onClick={()=>downloadWord("escala-de-valoracion.docx",text(),resource.titulo)}><Download size={15}/> Descargar Word</button><button onClick={()=>window.print()}><Printer size={15}/> Descargar PDF</button><button className="flow-next-btn" onClick={()=>onNext?.({form,instrument:resource})}>Siguiente <ArrowRight size={16}/></button></div><pre className="resource-document-preview">{text()}</pre></div>;
}

function CompleteClassFlow({preferredGrade="primaria",profile={}}){
  const[stage,setStage]=useState("intro");
  const[sessionContext,setSessionContext]=useState(null);
  const[instrumentType,setInstrumentType]=useState(null);
  const[materialType,setMaterialType]=useState(null);
  const initialContext=sessionContext?{...sessionContext.form,tema:sessionContext.result?.titulo||sessionContext.form?.tema,proposito:sessionContext.result?.proposito||sessionContext.form?.proposito,evidencia:sessionContext.result?.evidencia||sessionContext.form?.evidencia,criteriosBase:sessionContext.result?.criteriosDetallados||sessionContext.result?.criteriosEvaluacion||[]}:null;
  const finish=()=>setStage("done");

  if(stage==="intro")return <CompleteClassIntro onStart={()=>setStage("session")}/>;
  if(stage==="session")return <div className="complete-flow-stage"><div className="complete-flow-progress"><span className="active">1 Sesión</span><span>2 Instrumento</span><span>3 Material</span></div><SteamGenerator initialGrade={preferredGrade} documentType="session" profile={profile} completeClass onNext={(ctx)=>{setSessionContext(ctx);setStage("choice")}}/></div>;
  if(stage==="choice")return <div className="flow-modal-shell"><div className="flow-modal-card"><div className="flow-modal-head"><div><small>SESIÓN LISTA</small><h2>¿Qué quieres hacer ahora?</h2><p>Continúa construyendo tu clase completa sin volver a ingresar los datos de la sesión.</p></div></div><div className="flow-choice-grid"><FlowChoiceCard icon={ClipboardList} title="Instrumentos de evaluación" description="Rúbrica, lista de cotejo o escala de valoración alineada a la sesión." onClick={()=>setStage("instrument-select")}/><FlowChoiceCard icon={FileText} title="Material" description="Ficha de trabajo, ficha de lectura o juegos para la sesión." onClick={()=>setStage("material-select")} accent="yellow"/></div></div></div>;
  if(stage==="instrument-select")return <div className="complete-flow-stage"><div className="complete-flow-topline"><button onClick={()=>setStage("choice")}>← Atrás</button><div><small>PASO 2 DE 3</small><h2>Instrumento de evaluación</h2></div></div><div className="instrument-select-grid"><FlowChoiceCard icon={ClipboardList} title="Rúbrica" description="Criterios con niveles de logro y descriptores observables." onClick={()=>{setInstrumentType("rubric");setStage("instrument")}}/><FlowChoiceCard icon={CheckCircle2} title="Lista de cotejo" description="Verificación rápida de criterios observables." onClick={()=>{setInstrumentType("checklist");setStage("instrument")}}/><FlowChoiceCard icon={ListChecks} title="Escala de valoración" description="Registro de frecuencia y observación del desempeño." onClick={()=>{setInstrumentType("rating-scale");setStage("instrument")}}/></div></div>;
  if(stage==="instrument")return <div className="complete-flow-stage"><div className="complete-flow-progress"><span className="done">✓ Sesión</span><span className="active">2 Instrumento</span><span>3 Material</span></div>{instrumentType==="rating-scale"?<LinkedRatingScaleGenerator sessionContext={sessionContext} profile={profile} onNext={()=>setStage("material-select")}/>:<EvaluationInstrumentGenerator profile={profile} initialGrade={preferredGrade} instrumentType={instrumentType} initialContext={initialContext} completeClass onNext={()=>setStage("material-select")}/>}</div>;
  if(stage==="material-select")return <div className="complete-flow-stage"><div className="complete-flow-topline"><button onClick={()=>setStage(sessionContext?"choice":"intro")}>← Atrás</button><div><small>PASO 3 DE 3</small><h2>Material de sesión</h2><p>Elige el recurso que quieres crear con los datos de la sesión.</p></div></div><div className="material-select-grid"><FlowChoiceCard icon={FileText} title="Ficha de trabajo" description="Preguntas abiertas, opción múltiple, lectura o verdadero/falso." onClick={()=>{setMaterialType("worksheet");setStage("material")}}/><FlowChoiceCard icon={BookOpen} title="Ficha de lectura" description="Lectura original con preguntas de comprensión." onClick={()=>{setMaterialType("reading");setStage("material")}}/><FlowChoiceCard icon={Gamepad2} title="Juegos" description="Sopa de letras o crucigrama para reforzar la sesión." onClick={()=>setStage("games")} accent="yellow"/></div></div>;
  if(stage==="material")return <div className="complete-flow-stage"><div className="complete-flow-progress"><span className="done">✓ Sesión</span><span className={instrumentType?"done":""}>{instrumentType?"✓ ":""}Instrumento</span><span className="active">3 Material</span></div>{materialType==="reading"?<LinkedReadingGenerator sessionContext={sessionContext} profile={profile} onFinish={finish}/>:<LinkedWorksheetGenerator sessionContext={sessionContext} profile={profile} onFinish={finish}/>}</div>;
  if(stage==="games")return <div className="complete-flow-stage"><div className="complete-flow-topline"><button onClick={()=>setStage("material-select")}>← Atrás</button><div><small>MATERIAL DE SESIÓN</small><h2>Juegos</h2></div></div><div className="flow-choice-grid"><FlowChoiceCard icon={Search} title="Sopa de letras" description="Busca palabras clave relacionadas con la sesión." onClick={()=>setStage("wordsearch")}/>{/* Crucigrama retirado en el Bloque B: el generador era una simulación. */}</div></div>;
  if(stage==="wordsearch")return <div><div className="complete-flow-topline"><button onClick={()=>setStage("games")}>← Atrás</button><div><h2>Sopa de letras</h2></div></div><WordSearchGenerator initialGrade={preferredGrade} profile={profile}/><div className="flow-finish-row"><button className="flow-next-btn" onClick={finish}>Terminar clase <CheckCircle2 size={16}/></button></div></div>;
  return <div className="complete-done-card"><CheckCircle2 size={48}/><small>CLASE COMPLETA</small><h2>¡Todo quedó listo!</h2><p>Tu sesión y los recursos generados se guardaron en Mi biblioteca.</p><button onClick={()=>{setStage("intro");setSessionContext(null);setInstrumentType(null);setMaterialType(null)}}>Crear otra clase <ArrowRight size={15}/></button></div>;
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

function CreateStudio({ preferredGrade = "primaria", profile = {}, initialCreation = null, onInitialCreationConsumed = ()=>{}, onNavigate = ()=>{} }) {
  const [creation,setCreation]=useState(initialCreation);

  useEffect(()=>{
    if(initialCreation){setCreation(initialCreation);onInitialCreationConsumed();}
  },[initialCreation]);

  const selected = TOOLS_BY_ID[creation];

  // Catálogo plano y agrupado por intención. Antes había que entrar en una
  // categoría y luego elegir, y "Sesión de aprendizaje" y "Clase completa"
  // quedaban FUERA del catálogo: solo se alcanzaban desde el dashboard.
  if (!creation) {
    return (
      <div className="studio">
        <header className="studio__intro">
          <div className="studio__introcopy">
            <Badge tone="brand" icon={Sparkles}>Kantu te acompaña</Badge>
            <h1>¿Qué vamos a crear?</h1>
            <p>Elige una herramienta y Kantu te guía paso a paso. Todo lo que generes se guarda en tu biblioteca.</p>
          </div>
          <img className="studio__kantu" loading="lazy" src="/mascot/kantu-material.webp" alt="" width="120" />
        </header>

        <ToolGrid onCreate={setCreation} onNavigate={onNavigate} />
      </div>
    );
  }

  return (
    <div className="studio">
      <header className="studio__head">
        <div className="studio__headcopy">
          <Badge tone="brand" icon={Sparkles}>Creando con Kantu</Badge>
          <h1>{selected?.name || "Nuevo recurso"}</h1>
          <p>{selected?.desc}</p>
        </div>
        <Button variant="ghost" icon={ArrowLeft} onClick={()=>setCreation(null)}>
          Elegir otra herramienta
        </Button>
      </header>

      {creation==="complete"?<CompleteClassFlow preferredGrade={preferredGrade} profile={profile}/>
      :creation==="session"?<SteamGenerator initialGrade={preferredGrade} documentType="session" profile={profile}/>
      :creation==="project-v2"?<ProjectSteamGenerator initialGrade={preferredGrade} profile={profile}/>
      :creation==="worksheet-v2"?<ResourceFromAI kind="worksheet" initialGrade={preferredGrade} profile={profile}/>
      :creation==="reading-v2"?<ResourceFromAI kind="reading" initialGrade={preferredGrade} profile={profile}/>
      :creation==="rating-scale"?<ValuationScaleGenerator initialGrade={preferredGrade} profile={profile}/>
      :(creation==="rubric"||creation==="checklist")?<EvaluationInstrumentGenerator profile={profile} initialGrade={preferredGrade} instrumentType={creation}/>
      :creation==="wordsearch"?<WordSearchGenerator initialGrade={preferredGrade} profile={profile}/>
      :null}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* REGISTRO DE DOCENTES (INTRANET)                                         */
/* ---------------------------------------------------------------------- */

/* Fuente única de verdad para los planes: se usa en el landing (sección
   #planes) y en el perfil del docente (TeacherAccountModal), para que
   ambos siempre muestren los mismos precios y beneficios. */
// PLANS, whatsappLink y FREE_WEEKLY_AI_LIMIT viven ahora en config/plans.js

const TESTIMONIALS = [
  { name: "Patricia Quispe", role: "Docente de Primaria", initials: "PQ", quote: "Al inicio no le tenía fe, pero cuando vi que la sesión salía alineada al CNEB, me pareció que es lo que todo docente necesita." },
  { name: "Jorge Salinas", role: "Docente de Matemática", initials: "JS", quote: "Mis colegas me preguntan cómo hago para entregar todo tan rápido y de dónde saco esas evidencias tan creativas. Es como tener un colega que te ayuda." },
  { name: "Carmen Vargas", role: "Docente de Comunicación", initials: "CV", quote: "Antes me quedaba hasta tarde armando sesiones. Con SciVerse lo hago en el recreo y me queda tiempo para avanzar otras cosas." },
  { name: "Luis Mendoza", role: "Docente de Secundaria", initials: "LM", quote: "Lo que más me gusta es que no tengo que explicarle qué competencia o desempeño necesito: SciVerse ya lo sabe y conoce el contexto del CNEB." },
  { name: "Rosa Fernández", role: "Docente de Ciencia y Tecnología", initials: "RF", quote: "Las rúbricas y listas de cotejo se generan alineadas a lo que ya planifiqué en la sesión. Me ahorra horas cada semana." },
  { name: "Miguel Torres", role: "Docente de Primaria", initials: "MT", quote: "Mis estudiantes notaron el cambio: las actividades STEAM son más dinámicas y fáciles de aplicar en el aula." },
];

function TestimonialsCarousel() {
  const trackRef = useRef(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      const track = trackRef.current;
      if (!track) return;
      const card = track.querySelector(".testimonial-card");
      const step = card ? card.offsetWidth + 20 : track.clientWidth;
      const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
      track.scrollTo({ left: atEnd ? 0 : track.scrollLeft + step, behavior: "smooth" });
    }, 4200);
    return () => clearInterval(id);
  }, [paused]);

  const scrollByCard = (dir) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector(".testimonial-card");
    const step = card ? card.offsetWidth + 20 : track.clientWidth;
    track.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  return (
    <section id="testimonios" className="testimonials-section" aria-label="Testimonios de docentes">
      <div className="section-heading"><span className="eyebrow"><Star size={13} /> Experiencias reales</span><h2>Docentes que ya están usando SciVerse</h2><p>Profesores de primaria y secundaria que ahorran tiempo de planificación cada semana.</p></div>
      <div className="testimonial-carousel" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
        <button type="button" className="testimonial-arrow prev" aria-label="Testimonio anterior" onClick={() => scrollByCard(-1)}><ChevronLeft size={18} /></button>
        <div className="testimonial-track" ref={trackRef}>
          {TESTIMONIALS.map((testimonial) => (
            <article className="testimonial-card" key={testimonial.name}>
              <Quote size={26} className="testimonial-quote-icon" />
              <p>{testimonial.quote}</p>
              <div className="testimonial-author"><span>{testimonial.initials}</span><div><strong>{testimonial.name}</strong><small>{testimonial.role}</small></div></div>
            </article>
          ))}
        </div>
        <button type="button" className="testimonial-arrow next" aria-label="Siguiente testimonio" onClick={() => scrollByCard(1)}><ChevronRight size={18} /></button>
      </div>
    </section>
  );
}

function ImprovedLanding({ onRegister, onLogin, onForgotPassword }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [demoGrade, setDemoGrade] = useState("primaria");
  const [legalView, setLegalView] = useState(null);
  const [showPlansModal, setShowPlansModal] = useState(false);
  const demoActivity = ACTIVITIES[0];
  const demoVersion = demoActivity.versions[demoGrade];
  const features = [
    { icon: Wand2, title: "Generador con IA", desc: "Crea proyectos y sesiones STEAM adaptados a tu propósito y nivel.", color: C.coral },
    { icon: ClipboardList, title: "Guías para el aula", desc: "Actividades paso a paso, diferenciadas para primaria y secundaria.", color: C.yellow },
    { icon: Award, title: "Plantillas CNEB", desc: "Rúbricas, fichas y recursos editables para acompañar el aprendizaje.", color: "#8B5CF6" },
    { icon: Users, title: "Retos colaborativos", desc: "Propuestas para aprender haciendo, dialogando y creando en equipo.", color: "#FB7185" },
    { icon: BookOpen, title: "Cinco áreas STEAM", desc: "Ciencia, Tecnología, Ingeniería, Arte y Matemática conectadas.", color: "#4FA8FF" },
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
  // NOTA: duplicado histórico de PlansModal.handleChoosePlan. No se usa.
  // Eliminar en el Bloque C junto con el resto de código muerto.
  // eslint-disable-next-line no-unused-vars
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
          <button onClick={() => { setShowPlansModal(true); setMenuOpen(false); }} style={{ border: 'none', background: 'none', color: 'inherit', cursor: 'pointer', font: 'inherit', padding: 0 }}>Planes</button>
          <a href="#testimonios" onClick={() => setMenuOpen(false)}>Testimonios</a>
          <a href="#preguntas" onClick={() => setMenuOpen(false)}>Preguntas</a>
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

      <section id="demo" className="demo-features-section">
        <div className="demo-features-grid">
          <div className="demo-features-left">
            <div className="section-heading align-left"><span className="eyebrow"><Zap size={13} /> Herramientas listas para usar</span><h2>Prueba, crea y adapta</h2><p>Accede a una demo interactiva y descubre las herramientas que te ahorran tiempo cada semana.</p></div>
            <div className="demo-card compact">
              <div className="demo-toolbar">
                <div><span className="subject-pill"><Zap size={14} /> Física</span><small>{demoActivity.code}</small></div>
                <div className="grade-switch">{["primaria", "secundaria"].map((grade) => <button key={grade} onClick={() => setDemoGrade(grade)} className={demoGrade === grade ? "active" : ""}>{grade}</button>)}</div>
              </div>
              <div className="demo-content">
                <div><h3>{demoActivity.title}</h3><p>{demoVersion.objetivo}</p><span className="duration"><Clock size={15} /> {demoVersion.duracion}</span></div>
                <div className="demo-steps"><small>Ruta de aprendizaje</small>{demoVersion.pasos.slice(0, 3).map((step, index) => <p key={step}><b>{index + 1}</b>{step}</p>)}</div>
              </div>
              <div className="demo-footer"><button onClick={onRegister} className="primary-btn compact">Explorar todos <ArrowRight size={15} /></button></div>
            </div>
          </div>
          <div className="demo-features-right">
            <div className="benefits-list">{features.map((feature) => { const Icon = feature.icon; return <div key={feature.title} className="benefit-item"><span className="benefit-icon" style={{ color: feature.color }}><Icon size={24} /></span><div><h3>{feature.title}</h3><p>{feature.desc}</p></div></div>; })}</div>
          </div>
        </div>
      </section>


      <TestimonialsCarousel />

      <section className="trust-bar">
        <div className="trust-item"><Target size={20} /><div><strong>CNEB alineado</strong><span>Recursos contextualizados al currículo nacional</span></div></div>
        <div className="trust-item"><Users size={20} /><div><strong>Para todos</strong><span>Primaria y secundaria, individual o colaborativo</span></div></div>
        <div className="trust-item"><Cpu size={20} /><div><strong>Accesible</strong><span>Funciona desde el navegador, sin instalaciones</span></div></div>
      </section>

      <section id="preguntas" className="faq-section">
        <div className="section-heading"><span className="eyebrow"><HelpCircle size={13} /> Resolvemos tus dudas</span><h2>Preguntas frecuentes</h2><p>Todo lo que necesitas saber antes de crear tu cuenta o elegir un plan.</p></div>
        <div className="faq-list">{faqs.map(([question, answer]) => <details className="faq-item" key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div>
      </section>

      <section className="final-cta"><div><span className="eyebrow light"><Sparkles size={13} /> Tu próxima experiencia empieza aquí</span><h2>Explora, adapta y crea con SciVerse.</h2><p>Regístrate una vez y accede gratuitamente a todas las herramientas disponibles.</p></div><button onClick={onRegister} className="light-btn">Crear mi acceso gratuito <ArrowRight size={17} /></button></section>

      <footer className="landing-footer expanded-footer">
        <div className="footer-column"><div className="brand-lockup"><span className="brand-mark"><Microscope size={20} /></span><span><strong>SciVerse</strong><small>una iniciativa de Teaching TIC</small></span></div><p>Tecnología educativa para experiencias STEAM accesibles, creativas y contextualizadas.</p><div className="social-row"><a href="https://www.facebook.com/teachingticconsultorias/" target="_blank" rel="noreferrer" aria-label="Facebook"><Facebook size={17} /></a><a href="https://wa.me/51921090875" target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle size={17} /></a></div></div>
        <div className="footer-column"><h4>Explora</h4><a href="#demo">Herramientas</a><button onClick={() => setShowPlansModal(true)} style={{ border: 'none', background: 'none', color: 'inherit', cursor: 'pointer', font: 'inherit', padding: 0, textAlign: 'left' }}>Planes</button><a href="#testimonios">Testimonios</a><a href="#preguntas">Preguntas frecuentes</a><button onClick={onRegister}>Crear cuenta</button></div>
        <div className="footer-column"><h4>Legal y confianza</h4><button onClick={() => setLegalView("terms")}>Términos y condiciones</button><button onClick={() => setLegalView("privacy")}>Política de privacidad</button><button onClick={() => setLegalView("ai")}>Política de uso de IA</button><button onClick={() => setLegalView("complaints")}>Libro de Reclamaciones</button></div>
        <div className="footer-column"><h4>Contacto</h4><p>Teaching TIC Consultorías S.A.C.<br />RUC 20607945331</p><a href="mailto:teachingticconsultorias@gmail.com">teachingticconsultorias@gmail.com</a><a href="https://wa.me/51921090875" target="_blank" rel="noreferrer">+51 921 090 875</a><small>© 2026 Teaching TIC. Todos los derechos reservados.</small></div>
      </footer>
      {legalView && <LegalModal view={legalView} onClose={() => setLegalView(null)} />}
      {/* PlansModal gestiona internamente los planes de pago (abre WhatsApp).
          onChoosePlan solo se invoca para el plan gratuito, con la cadena "gratuito":
          por eso el handler correcto es onRegister. */}
      {showPlansModal && <PlansModal onClose={() => setShowPlansModal(false)} onChoosePlan={onRegister} />}
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

function ResetPasswordPage({ onSubmit, loading, error, token }) {
  const [contrasena, setContrasena] = useState("");
  const [confirmarContrasena, setConfirmarContrasena] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ contrasena, confirmarContrasena });
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F7FCFB", padding: "20px" }}>
      <div style={{ maxWidth: "420px", width: "100%", background: "white", borderRadius: "16px", padding: "40px", boxShadow: "0 4px 12px rgba(15,61,58,0.1)" }}>
        <h2 style={{ fontSize: "24px", fontWeight: "700", marginBottom: "8px", color: "#0F2E2C" }}>Restablecer contraseña</h2>
        <p style={{ color: "#607B79", fontSize: "14px", marginBottom: "24px" }}>Ingresa tu nueva contraseña</p>

        <form onSubmit={handleSubmit}>
          <label style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "16px" }}>
            <span style={{ fontWeight: "600", color: "#0F2E2C", fontSize: "13px" }}>Nueva contraseña</span>
            <input
              type="password"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              style={{
                padding: "12px",
                border: "1px solid rgba(15,61,58,.15)",
                borderRadius: "10px",
                fontSize: "14px",
                fontFamily: "'Inter', sans-serif",
              }}
              required
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "20px" }}>
            <span style={{ fontWeight: "600", color: "#0F2E2C", fontSize: "13px" }}>Confirmar contraseña</span>
            <input
              type="password"
              value={confirmarContrasena}
              onChange={(e) => setConfirmarContrasena(e.target.value)}
              placeholder="Repite tu contraseña"
              style={{
                padding: "12px",
                border: "1px solid rgba(15,61,58,.15)",
                borderRadius: "10px",
                fontSize: "14px",
                fontFamily: "'Inter', sans-serif",
              }}
              required
            />
          </label>

          {error && <p style={{ color: "#FF8A5B", fontSize: "12px", marginBottom: "16px" }}>❌ {error}</p>}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px",
              background: "#1F9E98",
              color: "white",
              border: "none",
              borderRadius: "10px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Actualizando..." : "Guardar nueva contraseña"}
          </button>
        </form>
      </div>
    </div>
  );
}

function LoginModal({ onClose, onSubmit, loading, error }) {
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ correo, contrasena });
  };

  return (
    <div className="legal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="legal-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <button className="legal-close" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
        <h2>Iniciar sesión</h2>

        <form onSubmit={handleSubmit}>
          <label style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
            <span style={{ fontWeight: "600", color: "#0F2E2C" }}>Correo electrónico</span>
            <input
              type="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              placeholder="tu-correo@ejemplo.com"
              style={{
                padding: "12px",
                border: "1px solid rgba(15,61,58,.15)",
                borderRadius: "12px",
                fontSize: "14px",
                fontFamily: "'Inter', sans-serif",
              }}
              required
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" }}>
            <span style={{ fontWeight: "600", color: "#0F2E2C" }}>Contraseña</span>
            <input
              type="password"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              placeholder="Tu contraseña"
              style={{
                padding: "12px",
                border: "1px solid rgba(15,61,58,.15)",
                borderRadius: "12px",
                fontSize: "14px",
                fontFamily: "'Inter', sans-serif",
              }}
              required
            />
          </label>

          {error && <p style={{ color: "#FF8A5B", fontSize: "12px", marginBottom: "16px" }}>❌ {error}</p>}

          <div className="legal-actions">
            <button type="button" onClick={onClose} className="secondary-btn">Cancelar</button>
            <button type="submit" disabled={loading} className="primary-btn">
              {loading ? "Entrando..." : "Iniciar sesión"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function PasswordRecoveryModal({ onClose, onSubmit, loading }) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      alert("Ingresa tu correo electrónico");
      return;
    }
    await onSubmit(email);
    setSubmitted(true);
    setTimeout(() => {
      onClose();
      setSubmitted(false);
      setEmail("");
    }, 2000);
  };

  return (
    <div className="legal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="legal-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <button className="legal-close" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
        <h2>Recuperar contraseña</h2>
        {submitted ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <p style={{ color: "#1F9E98", fontSize: "16px", marginBottom: "10px" }}>✅ Revisa tu correo</p>
            <p style={{ color: "#607B79", fontSize: "13px" }}>Te enviamos un link para restaurar tu contraseña. Abre tu correo y sigue los pasos.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <p style={{ color: "#607B79", marginBottom: "20px" }}>Ingresa tu correo y te enviaremos un link para recuperar tu contraseña.</p>
            <label style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" }}>
              <span style={{ fontWeight: "600", color: "#0F2E2C" }}>Correo electrónico</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu-correo@ejemplo.com"
                style={{
                  padding: "12px",
                  border: "1px solid rgba(15,61,58,.15)",
                  borderRadius: "12px",
                  fontSize: "14px",
                  fontFamily: "'Inter', sans-serif",
                }}
              />
            </label>
            <div className="legal-actions">
              <button type="button" onClick={onClose} className="secondary-btn">Cancelar</button>
              <button type="submit" disabled={loading} className="primary-btn">
                {loading ? "Enviando..." : "Enviar link"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

function PlansModal({ onClose, onChoosePlan }) {
  const handleChoosePlan = (plan) => {
    if (plan.name === "Gratuito") return onChoosePlan("gratuito");
    const message = `Hola Teaching TIC, deseo adquirir el Plan ${plan.name} de SciVerse por S/${plan.price}. ¿Me comparten los datos para pagar por Plin o Yape?`;
    window.open(`https://wa.me/51921090875?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
    onClose();
  };
  return (
    <div className="plans-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="plans-modal" role="dialog" aria-modal="true" aria-labelledby="plans-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="plans-close" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
        <div className="plans-header">
          <span className="eyebrow"><Award size={13} /> Precios claros y en soles</span>
          <h2 id="plans-title">Un plan para cada etapa docente</h2>
          <p>Empieza gratis y elige más capacidad cuando necesites generar y descargar más materiales.</p>
        </div>
        <div className="plans-grid">
          {PLANS.map((plan) => (
            <article key={plan.name} className={`plan-card ${plan.featured ? "featured" : ""}`}>
              {plan.featured && <span className="plan-badge"><Sparkles size={12} /> Más conveniente</span>}
              <div className="plan-header"><span>Plan {plan.name}</span><strong><small>S/</small>{plan.price}</strong><p>{plan.period}</p></div>
              <div className="plan-saving">{plan.saving}</div>
              <ul>{plan.benefits.map((benefit) => <li key={benefit}><span>✓</span>{benefit}</li>)}</ul>
              <button onClick={() => handleChoosePlan(plan)} className={plan.featured ? "primary-btn" : "secondary-btn"}>{plan.name === "Gratuito" ? "Crear cuenta gratis" : `Elegir plan ${plan.name.toLowerCase()}`} <ArrowRight size={15} /></button>
            </article>
          ))}
        </div>
        <p className="plans-note"><span>🔒</span> Pago por Plin o Yape a nombre de Teaching TIC. La activación se confirma por WhatsApp.</p>
      </section>
    </div>
  );
}

function RegistrationGate({ children }) {
  const [checking, setChecking] = useState(true);
  const [profile, setProfile] = useState(null);
  const [view, setView] = useState("landing"); // 'landing' | 'form' | 'login' | 'reset-password'
  const [form, setForm] = useState({ nombres: "", apellidos: "", ie: "", celular: "", correo: "", contrasena: "", confirmarContrasena: "" });
  const [loginForm, setLoginForm] = useState({ correo: "", contrasena: "" });
  const [resetForm, setResetForm] = useState({ contrasena: "", confirmarContrasena: "" });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showPasswordRecovery, setShowPasswordRecovery] = useState(false);
  const [resetToken, setResetToken] = useState(null);

  useEffect(() => {
    // Detectar token de reset en URL
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get("view");
    const typeParam = params.get("type");
    const tokenParam = params.get("token");

    if (viewParam === "reset-password" && typeParam === "recovery") {
      setView("reset-password");
      setResetToken(tokenParam);
      // Limpiar URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Cargar sesión de Supabase
    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          // Cargar perfil del usuario
          supabase.from("docentes").select("*").eq("id", session.user.id).single().then(({ data }) => {
            if (data) setProfile({ ...data, id: session.user.id, correo: session.user.email });
          });
        } else {
          try {
            const raw = localStorage.getItem("sciverse-docente-perfil");
            if (raw) setProfile(JSON.parse(raw));
          } catch (e) {
            // no hay perfil guardado todavía
          }
        }
        setChecking(false);
      });
    } else {
      try {
        const raw = localStorage.getItem("sciverse-docente-perfil");
        if (raw) setProfile(JSON.parse(raw));
      } catch (e) {
        // no hay perfil guardado todavía
      }
      setChecking(false);
    }
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.nombres.trim() || !form.apellidos.trim() || !form.correo.trim() || !form.ie.trim()) {
      setError("Completa nombres, apellidos, institución educativa y correo.");
      return;
    }
    if (!form.contrasena || form.contrasena.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (form.contrasena !== form.confirmarContrasena) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (!supabase) throw new Error("Servicio de autenticación no disponible");

      // Registrar en Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.correo,
        password: form.contrasena,
        options: { data: { nombres: form.nombres, apellidos: form.apellidos } }
      });

      if (authError) throw authError;

      // Guardar perfil en tabla docentes
      const { error: dbError } = await supabase.from("docentes").insert([{
        id: authData.user.id,
        nombres: form.nombres,
        apellidos: form.apellidos,
        correo: form.correo,
        ie: form.ie,
        celular: form.celular
      }]);

      if (dbError) throw dbError;

      setError(null);
      alert("✅ Registro exitoso. Revisa tu correo para confirmar tu cuenta.");
      setView("landing");
    } catch (e) {
      setError(e.message || "No se pudo crear tu cuenta. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    if (!loginForm.correo || !loginForm.contrasena) {
      setError("Ingresa correo y contraseña.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (!supabase) throw new Error("Servicio no disponible");

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: loginForm.correo,
        password: loginForm.contrasena
      });

      if (authError) throw authError;

      // Cargar perfil
      const { data: profileData } = await supabase.from("docentes").select("*").eq("id", data.user.id).single();
      setProfile({ ...profileData, id: data.user.id, correo: data.user.email });
      setView("landing");
    } catch (e) {
      setError(e.message || "Credenciales inválidas.");
    } finally {
      setSaving(false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    if (!resetForm.contrasena || resetForm.contrasena.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (resetForm.contrasena !== resetForm.confirmarContrasena) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (!supabase) throw new Error("Servicio no disponible");

      const { error } = await supabase.auth.updateUser({ password: resetForm.contrasena });
      if (error) throw error;

      alert("✅ Contraseña actualizada correctamente.");
      setView("landing");
      setResetForm({ contrasena: "", confirmarContrasena: "" });
    } catch (e) {
      setError(e.message || "No se pudo actualizar la contraseña.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    if (supabase) {
      await supabase.auth.signOut();
    }
    try {
      localStorage.removeItem("sciverse-docente-perfil");
    } catch (e) {
      // ignorar
    }
    setProfile(null);
    setView("landing");
    setForm({ nombres: "", apellidos: "", ie: "", celular: "", correo: "", contrasena: "", confirmarContrasena: "" });
    setLoginForm({ correo: "", contrasena: "" });
  }

  async function handlePasswordRecovery(email) {
    if (!supabase) {
      setError("El servicio de recuperación no está disponible. Contacta a soporte.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}?view=reset-password`,
      });
      if (resetError) throw resetError;
      setError(null);
      alert("✅ Revisa tu correo para el link de recuperación de contraseña.");
      setShowPasswordRecovery(false);
    } catch (e) {
      setError("No se pudo enviar el email de recuperación. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  if (checking) {
    return (
      <div style={{ background: C.bg, minHeight: "100vh" }} className="flex items-center justify-center">
        <Loader2 size={22} className="animate-spin" color={C.teal} />
      </div>
    );
  }

  // Si hay un token de reset, mostrar página de reset
  if (view === "reset-password" && resetToken) {
    return <ResetPasswordPage onSubmit={handleResetPassword} loading={saving} error={error} token={resetToken} />;
  }

  if (profile) return children(profile, handleLogout);

  const goToForm = () => {
    setView("form");
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  /* ---------- LANDING PÚBLICA ---------- */
  if (view === "landing") {
    return (
      <>
        <ImprovedLanding onRegister={goToForm} onForgotPassword={() => setShowPasswordRecovery(true)} />
        {showPasswordRecovery && <PasswordRecoveryModal onClose={() => setShowPasswordRecovery(false)} onSubmit={handlePasswordRecovery} loading={saving} />}
      </>
    );
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
          <input
            value={form.contrasena}
            onChange={(e) => setForm({ ...form, contrasena: e.target.value })}
            type="password"
            placeholder="Contraseña (mín. 6 caracteres)"
            className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
            style={{ background: "rgba(15,61,58,0.05)", border: `1px solid ${C.line}`, color: C.text }}
          />
          <input
            value={form.confirmarContrasena}
            onChange={(e) => setForm({ ...form, confirmarContrasena: e.target.value })}
            type="password"
            placeholder="Confirmar contraseña"
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

        <div className="text-center mt-4">
          <button
            onClick={onForgotPassword}
            style={{ background: "none", border: "none", color: C.teal, cursor: "pointer", fontSize: "12px", textDecoration: "underline" }}
          >
            ¿Olvidé mi contraseña?
          </button>
        </div>
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
  const v=activity.versions[grade];
  return (
    <button onClick={()=>onOpen(activity)} className="steam-catalog-card" style={{"--activity-color":subj.color}}>
      <div className="steam-card-top"><span><Icon size={19}/></span><small>{activity.code} · {subj.label}</small><ChevronRight size={17}/></div>
      <h3>{activity.title}</h3>
      <p className="steam-card-challenge">{v.objetivo}</p>
      <div className="steam-card-meta"><span><GraduationCap size={13}/>{v.nivel}</span><span><Clock size={13}/>{activity.detalle.tiempo}</span></div>
      <div className="steam-card-success"><small>CONDICIÓN DE ÉXITO</small><p>{v.condicion}</p></div>
      <div className="steam-card-footer"><span>{v.materiales.length} materiales · 5 pasos</span><strong>Ver guía completa <ArrowRight size={14}/></strong></div>
    </button>
  );
}

function ActivityModal({ activity, grade, setGrade, onClose, onSave, isSaved }) {
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
      <div className="printable relative w-full max-w-4xl rounded-2xl my-6" style={{ background: C.surface2, border: `1px solid ${C.line}` }} onClick={(e) => e.stopPropagation()}>
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
          {["primaria", "secundaria"].filter(g=>activity.versions[g]).map((g) => (
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
            <span className="inline-flex items-center gap-1.5"><GraduationCap size={14} /> {v.nivel}</span>
            <span className="inline-flex items-center gap-1.5"><Clock size={14} /> {activity.detalle.tiempo}</span>
            <span className="inline-flex items-center gap-1.5"><Layers size={14} /> {v.materiales.length} materiales</span>
          </div>

          <div className="rounded-lg p-4" style={{ background: "rgba(15,61,58,0.03)", borderLeft: `3px solid ${accent}` }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: accent }}>Competencia CNEB</p>
            <p className="text-sm" style={{ color: C.text }}>{activity.competencia}</p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: C.muted }}>El reto</p>
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

          <div className="rounded-lg p-4" style={{background:"#F5FAF9",border:`1px solid ${C.line}`}}><p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{color:C.tealDeep}}>Antes de empezar</p><p className="text-sm mb-3" style={{color:C.text}}><strong>Organización:</strong> {activity.detalle.organizacion}</p><ul className="text-sm space-y-1.5" style={{color:C.text}}>{activity.detalle.preparacion.map((item,index)=><li key={index} className="flex gap-2"><CheckCircle2 size={14} className="shrink-0 mt-0.5" color={C.tealDeep}/>{item}</li>)}</ul></div>

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
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: C.tealDeep }}>Condición de éxito</p>
            <p className="text-sm leading-relaxed" style={{ color: C.text }}>{v.condicion}</p>
          </div>
          <div className="rounded-lg p-4" style={{ background: "#FFF8E2", borderLeft:`3px solid ${C.amber}` }}><p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{color:"#A87900"}}>Variación — más difícil</p><p className="text-sm leading-relaxed" style={{color:C.text}}>{v.variacion}</p></div>
          <div className="rounded-lg p-4" style={{ background: "#E7F8F5", borderLeft:`3px solid ${C.tealDeep}` }}><p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{color:C.tealDeep}}>Pregunta para reflexionar</p><p className="text-sm leading-relaxed" style={{color:C.text}}>{v.reflexion}</p></div>
          <div className="grid md:grid-cols-2 gap-3"><div className="rounded-lg p-4" style={{background:"#F5FAF9",border:`1px solid ${C.line}`}}><p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{color:C.tealDeep}}>Preguntas para acompañar</p><ul className="text-sm space-y-2" style={{color:C.text}}>{activity.detalle.acompanamiento.map((item,index)=><li key={index}>• {item}</li>)}</ul></div><div className="rounded-lg p-4" style={{background:"#F5FAF9",border:`1px solid ${C.line}`}}><p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{color:C.tealDeep}}>Evidencias que debe recoger</p><ul className="text-sm space-y-2" style={{color:C.text}}>{activity.detalle.evidencias.map((item,index)=><li key={index}>• {item}</li>)}</ul></div></div>
        </div>

        <div className="no-print flex gap-3 px-6 pb-6">
          <button onClick={()=>onSave?.({kind:"activity",id:`${activity.id}-${grade}`,title:activity.title,subtitle:`${grade} · ${SUBJECTS[activity.subject].label}`,payload:{activity,grade}})} className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold" style={{background:isSaved?"#E3F7F4":"#fff",color:C.tealDeep,border:`1px solid ${C.line}`}}><Star size={16}/>{isSaved?"Guardado":"Guardar"}</button>
          <button onClick={handlePrint} className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold" style={{ background: "rgba(15,61,58,0.06)", color: C.text, border: `1px solid ${C.line}` }}>
            <Printer size={16} /> Imprimir / guardar como PDF
          </button>
          <button
            onClick={() => downloadActivityWord(activity,grade)}
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

function challengeText(reto){
  const list=(title,items)=>`\n${title.toUpperCase()}\n${(items||[]).map((item,index)=>`${index+1}. ${item}`).join("\n")}`;
  return `MISIÓN\n${reto.mision}\n\nOBJETIVO DE APRENDIZAJE\n${reto.objetivo||reto.competencia}\n\nCOMPETENCIA CNEB\n${reto.competencia}\n\nORGANIZACIÓN\nDuración: ${reto.duracion}\nEquipo: ${reto.equipo||reto.teamSize}${list("Roles",reto.roles)}${list("Materiales",reto.materiales)}${list("Preparación del docente",reto.preparacion)}${list("Desarrollo paso a paso",reto.pasos)}${list("Reglas",reto.reglas)}\n\nPRODUCTO O EVIDENCIA\n${reto.producto}${list("Criterios observables",reto.criterios)}${list("Preguntas de reflexión",reto.preguntas)}${reto.adaptacionesDUA?list("Apoyos DUA",reto.adaptacionesDUA):""}`;
}

function materialContentText(value, depth=0){
  if(value===null||value===undefined) return "";
  if(typeof value==="string"||typeof value==="number"||typeof value==="boolean") return String(value);
  if(Array.isArray(value)) return value.map((item,index)=>`${index+1}. ${materialContentText(item,depth+1)}`).join("\n");
  return Object.entries(value).filter(([,item])=>item!==null&&item!==""&&!(Array.isArray(item)&&!item.length)).map(([key,item])=>{const title=key.replace(/([A-Z])/g," $1").replace(/^./,letter=>letter.toUpperCase());return `${depth?title:title.toUpperCase()}\n${materialContentText(item,depth+1)}`;}).join("\n\n");
}

function RetoCard({ reto, onOpen }) {
  const subj = SUBJECTS[reto.subject];
  const Icon = reto.icon;
  return (
    <article className="challenge-card">
      <div className="challenge-card-top">
        <div>
          <Icon size={17} color={subj.color} />
        </div>
        <span><Clock size={12} /> {reto.duracion}</span>
      </div>
      <small>{reto.area} · {reto.teamSize}</small><h3>{reto.title}</h3><p>{reto.desc}</p>
      <div className="challenge-card-meta"><span><Target size={13}/> {reto.producto}</span></div>
      <footer><div>{reto.grades.map(g=><GradeTag key={g} grade={g}/>)}</div><button onClick={onOpen}>Ver reto <ArrowRight size={14}/></button></footer>
    </article>
  );
}

function RetoModal({reto,onClose,onCreateInstrument,onSave,isSaved}){
  const Icon=reto.icon||Users;
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="challenge-modal">
    <header><button onClick={onClose} aria-label="Cerrar"><X size={19}/></button><span><Icon size={20}/></span><div><small>RETO COLABORATIVO · {reto.area||"Área curricular"}</small><h2>{reto.title||reto.titulo}</h2><p><Clock size={13}/> {reto.duracion} <Users size={13}/> {reto.equipo||reto.teamSize}</p></div></header>
    <main>
      <section className="challenge-mission"><small>LA MISIÓN</small><p>{reto.mision}</p></section>
      <div className="challenge-detail-grid"><section><h3><Target size={16}/> Objetivo y alineación</h3>{reto.objetivo&&<p>{reto.objetivo}</p>}<strong>Competencia CNEB</strong><p>{reto.competencia}</p>{reto.capacidades?.length>0&&<><strong>Capacidades</strong><ul>{reto.capacidades.map((x,i)=><li key={i}>{x}</li>)}</ul></>}</section><section><h3><Users size={16}/> Organización del equipo</h3><strong>Roles sugeridos</strong><ul>{(reto.roles||[]).map((x,i)=><li key={i}>{x}</li>)}</ul><strong>Producto o evidencia</strong><p>{reto.producto}</p></section></div>
      <section className="challenge-detail"><h3>Antes de comenzar</h3><div className="challenge-two-cols"><div><strong>Materiales</strong><ul>{(reto.materiales||[]).map((x,i)=><li key={i}>{x}</li>)}</ul></div><div><strong>Preparación docente</strong><ul>{(reto.preparacion||[]).map((x,i)=><li key={i}>{x}</li>)}</ul></div></div></section>
      <section className="challenge-detail"><h3>Desarrollo paso a paso</h3><ol>{(reto.pasos||[]).map((x,i)=><li key={i}><b>{i+1}</b><span>{x}</span></li>)}</ol></section>
      <div className="challenge-detail-grid"><section><h3>Reglas del reto</h3><ul>{(reto.reglas||[]).map((x,i)=><li key={i}>{x}</li>)}</ul></section><section><h3>Criterios observables</h3><ul>{(reto.criterios||[]).map((x,i)=><li key={i}>{x}</li>)}</ul></section></div>
      <section className="challenge-reflection"><h3>Preguntas para reflexionar</h3>{(reto.preguntas||[]).map((x,i)=><p key={i}>“{x}”</p>)}</section>
      {reto.adaptacionesDUA?.length>0&&<section className="challenge-detail"><h3>Apoyos para la diversidad</h3><ul>{reto.adaptacionesDUA.map((x,i)=><li key={i}>{x}</li>)}</ul></section>}
    </main>
    <footer><button onClick={()=>onSave?.({kind:"challenge",id:reto.id||reto.titulo,title:reto.title||reto.titulo,subtitle:`${reto.area||"Reto grupal"} · ${reto.duracion}`,payload:reto})}><Star size={15}/>{isSaved?"Guardado":"Guardar"}</button><button onClick={()=>downloadWord(`reto-${(reto.id||reto.titulo||"grupal").toString().toLowerCase().replace(/[^a-z0-9]+/g,"-")}.docx`,challengeText(reto),reto.title||reto.titulo)}><Download size={15}/> Descargar en Word</button><button onClick={onCreateInstrument}><ClipboardList size={15}/> Crear instrumento de evaluación</button></footer>
  </div></div>;
}

function ChallengeCreator({profile,preferredGrade,onCreated}){
  const [form,setForm]=useState({nivel:preferredGrade,grado:preferredGrade==="primaria"?"5.º":"2.º",area:"Ciencia y Tecnología",tema:"",region:"",duracion:"45",estudiantes:"25",integrantes:"4",materiales:"papelotes, plumones y materiales reciclados",competencia:""});
  const [loading,setLoading]=useState(false); const [error,setError]=useState("");
  const update=(key,value)=>setForm(prev=>({...prev,[key]:value}));
  async function generate(){
    if(!form.tema.trim()) return setError("Escribe el tema o problema que deseas trabajar.");
    setLoading(true);setError("");
    try{const {data:{session}}=await supabase.auth.getSession();const response=await fetch("/api/generate-session",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session?.access_token||""}`},body:JSON.stringify({mode:"challenge",form})});const data=await response.json();if(!response.ok)throw new Error(data.error||"No se pudo crear el reto");const reto={...data.challenge,id:`kantu-${Date.now()}`,title:data.challenge.titulo,area:form.area,subject:"tecnologia",grades:[form.nivel],teamSize:data.challenge.equipo,icon:Wand2};try{await saveTeacherMaterial({tipo:"challenge",titulo:reto.title,form:{...form,grado:form.grado},contenido:reto});}catch(saveErr){console.error(saveErr);setError(describeSaveError(saveErr)+" El reto se creó, pero no quedó en tu biblioteca.");}onCreated(reto);}catch(e){setError(e.message);}finally{setLoading(false);}
  }
  return <div className="challenge-creator"><div className="challenge-creator-intro"><img loading="lazy" src="/mascot/kantu-material.webp" alt="Kantu"/><div><small>KANTU TE ACOMPAÑA</small><h2>Construyamos un reto para tu grupo</h2><p>Completa el contexto del aula. Kantu organizará la misión, los roles, las reglas, la secuencia y los criterios observables.</p></div></div><div className="challenge-form">
    <label>Nivel<select value={form.nivel} onChange={e=>update("nivel",e.target.value)}><option value="primaria">Primaria</option><option value="secundaria">Secundaria</option></select></label><label>Grado<input value={form.grado} onChange={e=>update("grado",e.target.value)}/></label><label>Área curricular<select value={form.area} onChange={e=>update("area",e.target.value)}>{["Ciencia y Tecnología","Matemática","Comunicación","Personal Social","Arte y Cultura","Educación para el Trabajo"].map(x=><option key={x}>{x}</option>)}</select></label>
    <label className="wide">Tema, problema o aprendizaje que deseas trabajar *<textarea value={form.tema} onChange={e=>update("tema",e.target.value)} placeholder="Ej.: Reducir el desperdicio de agua en nuestra escuela"/></label><label>Región o contexto<input value={form.region} onChange={e=>update("region",e.target.value)} placeholder="Ej.: Áncash, contexto rural"/></label><label>Duración (minutos)<input type="number" min="20" value={form.duracion} onChange={e=>update("duracion",e.target.value)}/></label><label>N.º de estudiantes<input type="number" min="4" value={form.estudiantes} onChange={e=>update("estudiantes",e.target.value)}/></label><label>Integrantes por equipo<input type="number" min="2" max="8" value={form.integrantes} onChange={e=>update("integrantes",e.target.value)}/></label><label className="wide">Materiales disponibles<textarea value={form.materiales} onChange={e=>update("materiales",e.target.value)}/></label><label className="wide">Competencia CNEB <small>Opcional: Kantu puede sugerirla</small><input value={form.competencia} onChange={e=>update("competencia",e.target.value)} placeholder="Déjalo vacío para recibir una sugerencia"/></label>
    {error&&<p className="challenge-error">{error}</p>}<button className="challenge-generate" onClick={generate} disabled={loading}><Sparkles size={17}/>{loading?"Kantu está construyendo el reto…":"Crear reto con Kantu"}</button>
  </div>{loading&&<div className="kantu-generation-overlay"><div className="kantu-working kantu-working--overlay"><div className="kantu-working__visual"><img loading="lazy" src="/mascot/kantu-material.webp" alt="Kantu trabajando"/><span className="kantu-orbit"><Sparkles size={17}/></span></div><div className="kantu-working__copy"><small>KANTU ESTÁ TRABAJANDO</small><h4>Estoy organizando la misión y los equipos…</h4><p>También estoy alineando el reto al CNEB y redactando criterios que puedas observar durante la actividad.</p><div className="kantu-progress"><i/><i/><i/></div></div></div></div>}</div>;
}

function LibraryEmpty({onCreate,onChallenges,onActivities}){return <div className="library-empty-state library-empty-kantu"><img loading="lazy" src="/mascot/kantu-material.webp" alt="Kantu"/><div><small>KANTU TE ACOMPAÑA</small><h2>Tu biblioteca está lista para empezar</h2><p>Crea una sesión, un reto grupal o un instrumento. Todo lo que prepares con Kantu se guardará automáticamente aquí.</p><div><button onClick={onCreate}>Crear sesión</button><button onClick={onChallenges}>Crear reto grupal</button><button onClick={onActivities}>Explorar actividades</button></div></div></div>}

function MaterialContentView({value,level=0}){
  if(value===null||value===undefined||value==="")return null;
  if(typeof value!=="object")return <p>{String(value)}</p>;
  if(Array.isArray(value))return <ul>{value.map((item,index)=><li key={index}>{typeof item==="object"?<MaterialContentView value={item} level={level+1}/>:String(item)}</li>)}</ul>;
  return <div className={`material-structured level-${level}`}>{Object.entries(value).filter(([,item])=>item!==null&&item!==""&&!(Array.isArray(item)&&!item.length)).map(([key,item])=><section key={key}><h4>{key.replace(/([A-Z])/g," $1").replace(/^./,letter=>letter.toUpperCase())}</h4><MaterialContentView value={item} level={level+1}/></section>)}</div>;
}

function MaterialViewerModal({item,typeLabel,onClose,onDownload,onDuplicate,onDelete}){
  const [editing,setEditing]=useState(false);const [draft,setDraft]=useState(materialContentText(item.contenido));const [saving,setSaving]=useState(false);const [notice,setNotice]=useState("");
  async function save(){setSaving(true);const {error}=await supabase.from("materiales_docente").update({contenido:{textoEditado:draft}}).eq("id",item.id);setSaving(false);if(error)return setNotice("No se pudieron guardar los cambios.");item.contenido={textoEditado:draft};setEditing(false);setNotice("Cambios guardados correctamente.");window.dispatchEvent(new Event("sciverse:material-created"));}
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="material-viewer"><header><div><small>{typeLabel}</small><h2>{item.titulo}</h2><p>{item.grado||item.nivel} · {item.area||"Área curricular"}</p></div><button onClick={onClose}><X size={19}/></button></header><nav><button className={!editing?"active":""} onClick={()=>setEditing(false)}><Eye size={14}/> Vista previa</button><button className={editing?"active":""} onClick={()=>setEditing(true)}><Pencil size={14}/> Editar contenido</button></nav><main>{notice&&<p className="material-notice">{notice}</p>}{editing?<div className="material-editor"><p>Edita el contenido en formato de documento. Al guardar, esta versión reemplazará el contenido anterior.</p><textarea value={draft} onChange={e=>setDraft(e.target.value)}/><button onClick={save} disabled={saving}>{saving?"Guardando…":"Guardar cambios"}</button></div>:<div className="material-preview"><MaterialContentView value={item.contenido}/></div>}</main><footer><button onClick={onDownload}><Download size={14}/> Descargar Word</button><button onClick={onDuplicate}><Copy size={14}/> Duplicar</button><button className="danger" onClick={onDelete}><Trash2 size={14}/> Eliminar</button></footer></div></div>;
}

/* ---------------------------------------------------------------------- */
/* MAIN APP                                                                 */
/* ---------------------------------------------------------------------- */

export default function SciVerseDocentes() {
  return <AuthGate LandingComponent={Landing}>{(profile, onLogout) => <SciVerseApp profile={profile} onLogout={onLogout} />}</AuthGate>;
}

function TeacherAccountModal({ profile, initialTab = "perfil", onClose }) {
  const [tab, setTab] = useState(initialTab);
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
          {tab === "plan" && <div><div className="account-heading"><span><Sparkles size={19} /></span><div><h3>Tu plan</h3><p>Uso actual en SciVerse</p></div></div><CreditsIndicator /><div className="account-plan-grid">{PLANS.filter((plan) => plan.name !== "Gratuito").map((plan) => <PlanMini key={plan.name} name={plan.name} price={plan.price} period={plan.period} benefits={plan.benefits} featured={plan.featured} />)}</div></div>}
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
function PlanMini({ name, price, period, benefits = [], featured }) { return <article className={featured ? "featured" : ""}>{featured && <small>RECOMENDADO</small>}<h4>{name}</h4><strong>S/{price}</strong><p>{period}</p><ul>{benefits.slice(0, 3).map((benefit) => <li key={benefit}>{benefit}</li>)}</ul><a href={`https://wa.me/51921090875?text=${encodeURIComponent(`Hola Teaching TIC, deseo adquirir el Plan ${name} de SciVerse por S/${price}.`)}`} target="_blank" rel="noreferrer">Elegir plan</a></article>; }
function Integration({ icon: Icon, name, text }) { return <div className="integration-row"><span><Icon size={20} /></span><div><strong>{name}</strong><p>{text}</p></div><button disabled>Próximamente</button></div>; }

function SciVerseApp({ profile, onLogout }) {
  const preferredGrade = profile.nivel === "secundaria" ? "secundaria" : "primaria";
  const [heroGrade, setHeroGrade] = useState(preferredGrade);
  const [gradeFilter, setGradeFilter] = useState(preferredGrade);
  const [subjectFilter, setSubjectFilter] = useState("todos");
  const [selected, setSelected] = useState(null);
  const [selectedReto, setSelectedReto] = useState(null);
  const [retoView, setRetoView] = useState("explorar");
  const [modalGrade, setModalGrade] = useState(preferredGrade);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountTab, setAccountTab] = useState("perfil");
  const { toast, confirm } = useUI();
  const [activeSection, setActiveSection] = useState("inicio");
  const [createEntry, setCreateEntry] = useState(null);
  const openCreate = (entry=null) => { setCreateEntry(entry); setActiveSection("crear"); };
  const [teacherMaterials, setTeacherMaterials] = useState([]);
  const [materialsLoading, setMaterialsLoading] = useState(true);
  const [libraryTab,setLibraryTab]=useState("creaciones");
  const [librarySearch,setLibrarySearch]=useState("");
  const [libraryType,setLibraryType]=useState("todos");
  const [libraryLevel,setLibraryLevel]=useState("todos");
  const [librarySort,setLibrarySort]=useState("recientes");
  const [selectedMaterial,setSelectedMaterial]=useState(null);
  const [dbProfile,setDbProfile]=useState(null);
  const [savedResources,setSavedResources]=useState(()=>{try{return JSON.parse(localStorage.getItem("sciverse-saved-resources")||"[]");}catch{return[];}});

  // Plan y estado reales. Antes el sidebar mostraba "Gratuito" fijo aunque
  // la columna `plan` existiera en la base de datos.
  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      if(!supabase) return;
      const {data,error}=await supabase.from("docentes").select("plan,activo,nivel,ie").maybeSingle();
      if(!cancelled && !error && data) setDbProfile(data);
    })();
    return()=>{cancelled=true;};
  },[]);

  const loadTeacherMaterials=useCallback(async()=>{
    setMaterialsLoading(true);
    const {data,error}=await supabase.from("materiales_docente").select("id,tipo,titulo,nivel,grado,area,tema,created_at").order("created_at",{ascending:false}).limit(100);
    if(!error) setTeacherMaterials(data||[]);
    else console.error("No se pudo cargar la biblioteca",error);
    setMaterialsLoading(false);
  },[]);

  useEffect(()=>{
    loadTeacherMaterials();
    const refresh=()=>loadTeacherMaterials();
    window.addEventListener("sciverse:material-created",refresh);
    return()=>window.removeEventListener("sciverse:material-created",refresh);
  },[loadTeacherMaterials]);

  const materialTypeLabel={session:"Sesión de aprendizaje",project:"Proyecto STEAM",rubric:"Rúbrica",checklist:"Lista de cotejo",challenge:"Reto grupal"};
  const formatMaterialDate=value=>new Intl.DateTimeFormat("es-PE",{day:"2-digit",month:"short",hour:"numeric",minute:"2-digit"}).format(new Date(value));
  const visibleMaterials=teacherMaterials.filter(item=>(libraryType==="todos"||item.tipo===libraryType||(libraryType==="instrumentos"&&["rubric","checklist"].includes(item.tipo)))&&(libraryLevel==="todos"||(item.nivel||"").toLowerCase()===libraryLevel)&&`${item.titulo} ${item.tema} ${item.area}`.toLowerCase().includes(librarySearch.toLowerCase())).sort((a,b)=>librarySort==="antiguos"?new Date(a.created_at)-new Date(b.created_at):new Date(b.created_at)-new Date(a.created_at));

  function toggleSaved(resource){setSavedResources(prev=>{const exists=prev.some(item=>item.id===resource.id);const next=exists?prev.filter(item=>item.id!==resource.id):[{...resource,savedAt:new Date().toISOString()},...prev];localStorage.setItem("sciverse-saved-resources",JSON.stringify(next));return next;});}
  async function deleteMaterial(item){const okDelete=await confirm({title:"¿Eliminar este material?",description:`“${item.titulo}” se eliminará de tu biblioteca. Esta acción no se puede deshacer.`,confirmText:"Eliminar",cancelText:"Conservar",tone:"danger"});if(!okDelete)return;const {error}=await supabase.from("materiales_docente").delete().eq("id",item.id);if(error){console.error(error);toast({tone:"error",title:"No pudimos eliminar el material",description:describeSaveError(error)});return;}setSelectedMaterial(null);loadTeacherMaterials();toast({tone:"success",title:"Material eliminado"});}
  // El listado ya no trae `contenido` (pesaba 1-3 MB por carga). Se pide
  // solo del material concreto que la docente abre, descarga o duplica.
  const withContent=useCallback(async(item)=>{
    if(item?.contenido!==undefined) return item;
    const {data,error}=await supabase.from("materiales_docente").select("contenido").eq("id",item.id).maybeSingle();
    if(error||!data) throw error||new Error("No se pudo cargar el material");
    return {...item,contenido:data.contenido};
  },[]);

  async function openMaterial(item){
    try{ setSelectedMaterial(await withContent(item)); }
    catch(e){ console.error(e); toast({tone:"error",title:"No pudimos abrir este material",description:"Inténtalo de nuevo en unos segundos."}); }
  }

  async function downloadMaterial(item){
    try{ const full=await withContent(item); downloadWord(`${full.tipo}-${full.id}.docx`,materialContentText(full.contenido),full.titulo); }
    catch(e){ console.error(e); toast({tone:"error",title:"No pudimos preparar la descarga",description:"Inténtalo de nuevo en unos segundos."}); }
  }

  async function duplicateMaterial(item){const form={nivel:item.nivel,grado:item.grado,area:item.area,tema:item.tema};try{const full=await withContent(item);await saveTeacherMaterial({tipo:full.tipo,titulo:`Copia de ${full.titulo}`,form,contenido:full.contenido});loadTeacherMaterials();}catch(e){console.error(e);toast({tone:"error",title:"No pudimos duplicar el material",description:describeSaveError(e)});}}

  const filtered = ACTIVITIES.filter((a) => a.versions[heroGrade] && (subjectFilter === "todos" || a.subject === subjectFilter));
  const filteredRetos = RETOS.filter((r) => gradeFilter === "todos" || r.grades.includes(gradeFilter));

  const openActivity = (a) => {
    setSelected(a);
    setModalGrade(heroGrade);
  };

  const heroAccent = heroGrade === "primaria" ? C.amber : C.cyan;

  return (
    <>
    <AppShell
      profile={profile}
      plan={dbProfile?.plan}
      activeSection={activeSection}
      onNavigate={setActiveSection}
      onOpenAccount={(tab) => { setAccountTab(tab || "perfil"); setAccountOpen(true); }}
      onLogout={onLogout}
    >

      {activeSection === "inicio" && (
        <Dashboard
          profile={profile}
          materials={teacherMaterials}
          loading={materialsLoading}
          typeLabel={materialTypeLabel}
          formatDate={formatMaterialDate}
          onCreate={openCreate}
          onNavigate={setActiveSection}
          onOpenMaterial={openMaterial}
          onDownloadMaterial={downloadMaterial}
          onOpenAccount={(tab) => { setAccountTab(tab || "perfil"); setAccountOpen(true); }}
        />
      )}

      {activeSection === "actividades" && <section id="actividades" className="steam-catalog-page">
        <header className="steam-catalog-header"><div><span><Sparkles size={14}/> BANCO DE EXPERIENCIAS STEAM</span><h1>Actividades listas para llevar al aula</h1><p>Elige el nivel y encuentra una guía completa con preparación, pasos, preguntas de acompañamiento y evidencias para evaluar.</p></div><div className="steam-level-switch"><small>NIVEL DE TUS ESTUDIANTES</small><div>{["primaria","secundaria"].map(g=><button key={g} className={heroGrade===g?"active":""} onClick={()=>{setHeroGrade(g);setSubjectFilter("todos");}}><School size={15}/>{g==="primaria"?"Primaria":"Secundaria"}</button>)}</div></div></header>
        <div className="steam-catalog-summary"><div><strong>{ACTIVITIES.filter(item=>item.versions[heroGrade]).length}</strong><span>actividades disponibles para {heroGrade}</span></div><p><CheckCircle2 size={15}/> Todas incluyen competencia CNEB, condición de éxito y evidencias observables.</p></div>
        <div className="steam-filter-bar"><div><small>FILTRAR POR ÁREA</small><div><button className={subjectFilter==="todos"?"active":""} onClick={()=>setSubjectFilter("todos")}>Todas</button>{Object.entries(SUBJECTS).filter(([key])=>ACTIVITIES.some(activity=>activity.subject===key&&activity.versions[heroGrade])).map(([key,s])=><button key={key} className={subjectFilter===key?"active":""} onClick={()=>setSubjectFilter(key)}>{s.label}<span>{ACTIVITIES.filter(item=>item.subject===key&&item.versions[heroGrade]).length}</span></button>)}</div></div><span>{filtered.length} {filtered.length===1?"resultado":"resultados"}</span></div>
        <div className="steam-catalog-grid">{filtered.map(a=><ActivityCard key={a.id} activity={a} onOpen={openActivity} grade={heroGrade}/>)}</div>
      </section>}

      {/* RETOS GRUPALES */}
      {activeSection === "retos" && <section id="retos" className="challenge-page">
        <header className="challenge-hero"><div><span><Users size={14}/> APRENDIZAJE COLABORATIVO</span><h1>Retos para pensar, crear y resolver en equipo</h1><p>Dinámicas completas con roles, reglas, producto final y criterios observables para aplicar en el aula.</p></div><div className="challenge-main-tabs"><button className={retoView==="explorar"?"active":""} onClick={()=>setRetoView("explorar")}><Layers size={17}/> Explorar retos</button><button className={retoView==="crear"?"active":""} onClick={()=>setRetoView("crear")}><Wand2 size={17}/> Crear reto con Kantu</button></div></header>
        {retoView==="explorar"?<>
          <div className="challenge-filter"><div><small>NIVEL</small>{["todos","primaria","secundaria"].map(g=><button key={g} className={gradeFilter===g?"active":""} onClick={()=>setGradeFilter(g)}>{g==="todos"?"Todos":g[0].toUpperCase()+g.slice(1)}</button>)}</div><span>{filteredRetos.length} retos disponibles</span></div>
          <div className="challenge-grid">{filteredRetos.map(r=><RetoCard key={r.id} reto={r} onOpen={()=>setSelectedReto(r)}/>)}</div>
        </>:<ChallengeCreator profile={profile} preferredGrade={preferredGrade} onCreated={reto=>{setSelectedReto(reto);loadTeacherMaterials();}}/>}
      </section>}

      {/* GENERADOR STEAM */}
      {activeSection === "crear" && <section id="generador" className="px-6 md:px-10 py-14 max-w-5xl mx-auto">
        <CreateStudio preferredGrade={preferredGrade} profile={profile} initialCreation={createEntry} onInitialCreationConsumed={()=>setCreateEntry(null)} onNavigate={setActiveSection} />
      </section>}

      {/* BIBLIOTECA */}
      {activeSection === "biblioteca" && <section id="biblioteca" className="library-page">
        <header className="library-hero"><div><span><FolderOpen size={14}/> TU ESPACIO DOCENTE</span><h1>Mi biblioteca</h1><p>Encuentra, revisa y descarga todo lo que creaste o guardaste en SciVerse.</p></div><button onClick={()=>setActiveSection("crear")}><Plus size={16}/> Crear nuevo material</button></header>
        <nav className="library-tabs">{[["creaciones",FileText,"Mis creaciones",teacherMaterials.length],["guardados",Star,"Guardados",savedResources.length],["plantillas",Download,"Plantillas",TEMPLATES.length]].map(([key,Icon,label,count])=><button key={key} className={libraryTab===key?"active":""} onClick={()=>setLibraryTab(key)}><Icon size={16}/>{label}<b>{count}</b></button>)}</nav>

        {libraryTab==="creaciones"&&<>
          <div className="library-toolbar"><label><Search size={15}/><input value={librarySearch} onChange={e=>setLibrarySearch(e.target.value)} placeholder="Buscar por título, tema o área"/></label><select value={libraryType} onChange={e=>setLibraryType(e.target.value)}><option value="todos">Todos los tipos</option><option value="session">Sesiones</option><option value="project">Proyectos STEAM</option><option value="instrumentos">Instrumentos</option><option value="challenge">Retos grupales</option></select><select value={libraryLevel} onChange={e=>setLibraryLevel(e.target.value)}><option value="todos">Todos los niveles</option><option value="primaria">Primaria</option><option value="secundaria">Secundaria</option></select><select value={librarySort} onChange={e=>setLibrarySort(e.target.value)}><option value="recientes">Más recientes</option><option value="antiguos">Más antiguos</option></select></div>
          {materialsLoading?<div className="library-loading"><Loader2 className="animate-spin" size={22}/> Cargando tus creaciones…</div>:visibleMaterials.length?<div className="library-material-grid">{visibleMaterials.map(item=><article key={item.id}><header><span className={`library-type ${item.tipo}`}><FileText size={18}/></span><small>{materialTypeLabel[item.tipo]||"Material"}</small></header><h3>{item.titulo}</h3><p>{item.grado||item.nivel} · {item.area||"Área curricular"}</p><time>Creado {formatMaterialDate(item.created_at)}</time><footer><button className="primary" onClick={()=>openMaterial(item)}><Eye size={14}/> Abrir</button><button onClick={()=>downloadMaterial(item)} title="Descargar Word"><Download size={14}/></button><button onClick={()=>duplicateMaterial(item)} title="Duplicar"><Copy size={14}/></button><button className="danger" onClick={()=>deleteMaterial(item)} title="Eliminar"><Trash2 size={14}/></button></footer></article>)}</div>:teacherMaterials.length?<div className="library-no-results"><Search size={23}/><strong>No encontramos materiales con esos filtros</strong><p>Prueba cambiando el tipo, nivel o palabras de búsqueda.</p><button onClick={()=>{setLibrarySearch("");setLibraryType("todos");setLibraryLevel("todos");}}>Limpiar filtros</button></div>:<LibraryEmpty onCreate={()=>setActiveSection("crear")} onChallenges={()=>{setActiveSection("retos");setRetoView("crear");}} onActivities={()=>setActiveSection("actividades")}/>}</>}

        {libraryTab==="guardados"&&(savedResources.length?<div className="library-saved-grid">{savedResources.map(item=><article key={item.id}><span><Star size={18}/></span><div><small>{item.kind==="activity"?"ACTIVIDAD STEAM":"RETO GRUPAL"}</small><h3>{item.title}</h3><p>{item.subtitle}</p></div><button onClick={()=>{if(item.kind==="activity"){setSelected(item.payload.activity);setModalGrade(item.payload.grade);}else setSelectedReto(item.payload);}}><Eye size={14}/> Abrir</button><button onClick={()=>toggleSaved(item)} title="Quitar de guardados"><Trash2 size={14}/></button></article>)}</div>:<div className="library-empty-state"><Star size={27}/><h2>Aún no guardaste recursos</h2><p>En Actividades y Retos encontrarás el botón Guardar para reunir aquí lo que quieras aplicar después.</p><div><button onClick={()=>setActiveSection("actividades")}>Explorar actividades</button><button onClick={()=>setActiveSection("retos")}>Explorar retos</button></div></div>)}

        {libraryTab==="plantillas"&&<><div className="library-template-heading"><div><small>RECURSOS DESCARGABLES</small><h2>Plantillas para organizar tu trabajo docente</h2><p>Formatos editables con la identidad de SciVerse. Los instrumentos de evaluación personalizados se crean desde Kantu.</p></div></div><div className="library-template-grid">{TEMPLATES.map(t=>{const Icon=t.icon;return <article key={t.id}><span><Icon size={19}/></span><small>PLANTILLA WORD</small><h3>{t.title}</h3><p>{t.desc}</p><button onClick={()=>downloadWord(`${t.id}.docx`,TEMPLATE_CONTENT[t.id],t.title)}><Download size={14}/> Descargar Word</button></article>})}</div></>}
      </section>}

    </AppShell>

      <footer className="px-6 md:px-10 py-8 text-center text-xs" style={{ color: C.muted, borderTop: `1px solid ${C.lineSoft}` }}>
        SciVerse para Docentes — un espacio de Frida García Rurush, IA educativa.
      </footer>

      {selected && <ActivityModal activity={selected} grade={modalGrade} setGrade={setModalGrade} onClose={() => setSelected(null)} onSave={toggleSaved} isSaved={savedResources.some(item=>item.id===`${selected.id}-${modalGrade}`)} />}
      {selectedReto && <RetoModal reto={selectedReto} profile={profile} onClose={()=>setSelectedReto(null)} onCreateInstrument={()=>{setSelectedReto(null);setActiveSection("crear");}} onSave={toggleSaved} isSaved={savedResources.some(item=>item.id===(selectedReto.id||selectedReto.titulo))} />}
      {selectedMaterial&&<MaterialViewerModal item={selectedMaterial} typeLabel={materialTypeLabel[selectedMaterial.tipo]||"Material"} onClose={()=>setSelectedMaterial(null)} onDownload={()=>downloadMaterial(selectedMaterial)} onDuplicate={()=>duplicateMaterial(selectedMaterial)} onDelete={()=>deleteMaterial(selectedMaterial)}/>} 
      {accountOpen && <TeacherAccountModal profile={profile} initialTab={accountTab} onClose={() => setAccountOpen(false)} />}
    </>
  );
}
