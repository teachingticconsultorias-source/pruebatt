import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Eye, EyeOff, Focus, RotateCcw, ScanSearch, Trophy } from "lucide-react";

const ORGANELLES = {
  nucleo: { name: "Núcleo", color: "#8B5CF6", function: "Protege el ADN y coordina las actividades de la célula.", clue: "Soy el centro de control y guardo la información genética." },
  nucleolo: { name: "Nucléolo", color: "#D8B4FE", function: "Produce las partes que formarán los ribosomas.", clue: "Estoy dentro del núcleo y ayudo a fabricar ribosomas." },
  mitocondria: { name: "Mitocondria", color: "#F97360", function: "Transforma los nutrientes en energía utilizable por la célula.", clue: "Libero energía para que la célula pueda funcionar." },
  golgi: { name: "Aparato de Golgi", color: "#FBBF24", function: "Modifica, empaqueta y distribuye proteínas y lípidos.", clue: "Soy el centro de empaquetado y distribución." },
  rer: { name: "Retículo endoplasmático rugoso", color: "#38BDF8", function: "Fabrica y transporta proteínas; tiene ribosomas adheridos.", clue: "Tengo pequeños puntos y participo en la fabricación de proteínas." },
  rel: { name: "Retículo endoplasmático liso", color: "#2DD4BF", function: "Produce lípidos y ayuda a eliminar sustancias tóxicas.", clue: "No tengo ribosomas y ayudo a producir lípidos." },
  ribosoma: { name: "Ribosomas", color: "#F8FAFC", function: "Construyen proteínas siguiendo las instrucciones del ARN.", clue: "Soy muy pequeño y construyo proteínas." },
  lisosoma: { name: "Lisosoma", color: "#EC4899", function: "Descompone desechos y recicla materiales celulares.", clue: "Limpio y reciclo los residuos de la célula." },
  centriolos: { name: "Centríolos", color: "#FB923C", function: "Organizan microtúbulos y participan en la división celular.", clue: "Trabajo especialmente cuando la célula se divide." },
  membrana: { name: "Membrana plasmática", color: "#67E8F9", function: "Delimita la célula y regula qué sustancias entran y salen.", clue: "Soy la barrera flexible que rodea toda la célula." },
};

function disposeObject(object) {
  object.traverse((node) => {
    node.geometry?.dispose();
    if (Array.isArray(node.material)) node.material.forEach((m) => m.dispose());
    else node.material?.dispose();
  });
}

function makeMaterial(color, options = {}) {
  return new THREE.MeshPhysicalMaterial({ color, roughness: .4, metalness: 0, clearcoat: .35, transparent: !!options.transparent, opacity: options.opacity ?? 1, side: options.side ?? THREE.FrontSide, depthWrite: options.depthWrite ?? true, emissive: options.emissive ?? 0x000000, emissiveIntensity: options.emissiveIntensity ?? 0 });
}

function tag(object, key, targets) {
  object.userData.organelle = key;
  object.traverse((child) => { child.userData.organelle = key; if (child.isMesh) targets.push(child); });
  return object;
}

function createMitochondrion(targets, position, rotation, scale = 1) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(.42, 28, 18), makeMaterial(0xf97360));
  body.scale.set(1.65, .7, .72);
  group.add(body);
  for (let i = -2; i <= 2; i++) {
    const crest = new THREE.Mesh(new THREE.TorusGeometry(.17, .025, 8, 24, Math.PI * 1.55), makeMaterial(0xffd4c7));
    crest.position.x = i * .13;
    crest.rotation.set(Math.PI / 2, 0, Math.PI / 2);
    group.add(crest);
  }
  group.position.set(...position); group.rotation.set(...rotation); group.scale.setScalar(scale);
  return tag(group, "mitocondria", targets);
}

function createGolgi(targets) {
  const group = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const tube = new THREE.Mesh(new THREE.TorusGeometry(.52 - i * .035, .055, 9, 34, Math.PI * 1.22), makeMaterial(0xfbbf24));
    tube.position.set(-.12 * i, (i - 2) * .13, 0);
    tube.rotation.set(1.25, -.15, -.3);
    group.add(tube);
  }
  [-.7, -.55, .55].forEach((x, i) => { const vesicle = new THREE.Mesh(new THREE.SphereGeometry(.09 + i * .015, 14, 10), makeMaterial(0xfde68a)); vesicle.position.set(x, -.35 + i * .12, .2); group.add(vesicle); });
  group.position.set(-1.18, .55, .45);
  return tag(group, "golgi", targets);
}

function createReticulum(targets, rough, position) {
  const group = new THREE.Group();
  const color = rough ? 0x38bdf8 : 0x2dd4bf;
  for (let i = 0; i < 6; i++) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-.7, i * .12, 0), new THREE.Vector3(-.25, i * .12 + .13, .12),
      new THREE.Vector3(.2, i * .12 - .1, -.08), new THREE.Vector3(.65, i * .12 + .05, .05),
    ]);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 30, .035, 7, false), makeMaterial(color));
    group.add(tube);
    if (rough) for (let d = 0; d < 4; d++) { const dot = new THREE.Mesh(new THREE.SphereGeometry(.038, 7, 6), makeMaterial(0xf8fafc)); dot.position.set(-.5 + d * .32, i * .12 + (d % 2 ? .04 : -.02), .07); group.add(dot); }
  }
  group.position.set(...position); group.rotation.set(-.25, .4, -.25);
  return tag(group, rough ? "rer" : "rel", targets);
}

function createCentrioles(targets) {
  const group = new THREE.Group();
  [[0, 0, 0], [.27, .18, .08]].forEach((pos, i) => {
    const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, .62, 12, 1, true), makeMaterial(0xfb923c, { side: THREE.DoubleSide }));
    cylinder.position.set(...pos); cylinder.rotation.set(i ? 0 : Math.PI / 2, 0, i ? Math.PI / 2 : 0); group.add(cylinder);
    for (let j = 0; j < 9; j++) { const a = j / 9 * Math.PI * 2; const rod = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, .58, 6), makeMaterial(0xffd199)); rod.position.copy(cylinder.position); rod.position.x += Math.cos(a) * .095; rod.position.z += Math.sin(a) * .095; rod.rotation.copy(cylinder.rotation); group.add(rod); }
  });
  group.position.set(.65, -1.25, .5);
  return tag(group, "centriolos", targets);
}

function buildAnimalCell(scene, targets) {
  const cell = new THREE.Group();
  const membraneGeometry = new THREE.SphereGeometry(2.45, 64, 48);
  const p = membraneGeometry.attributes.position;
  for (let i = 0; i < p.count; i++) { const x=p.getX(i), y=p.getY(i), z=p.getZ(i); const wobble=1 + .035*Math.sin(x*3.2)*Math.cos(y*2.7) + .022*Math.sin(z*4.1); p.setXYZ(i,x*wobble*1.08,y*wobble*.92,z*wobble); }
  membraneGeometry.computeVertexNormals();
  const membrane = new THREE.Mesh(membraneGeometry, makeMaterial(0x67e8f9, { transparent:true, opacity:.18, side:THREE.DoubleSide, depthWrite:false }));
  cell.add(tag(membrane, "membrana", targets));
  const cytoplasm = new THREE.Mesh(new THREE.SphereGeometry(2.34, 48, 36), makeMaterial(0xbff7f1, { transparent:true, opacity:.1, depthWrite:false })); cytoplasm.scale.set(1.08,.92,1); cell.add(cytoplasm);

  const nucleus = new THREE.Mesh(new THREE.SphereGeometry(.82, 40, 30), makeMaterial(0x8b5cf6, { transparent:true, opacity:.78 })); nucleus.position.set(.28,.2,.08); nucleus.scale.set(1, .93, 1.02); cell.add(tag(nucleus,"nucleo",targets));
  const nucleolus = new THREE.Mesh(new THREE.SphereGeometry(.27, 28, 20), makeMaterial(0xd8b4fe)); nucleolus.position.set(.43,.3,.7); cell.add(tag(nucleolus,"nucleolo",targets));

  cell.add(createMitochondrion(targets,[1.35,.83,.3],[.2,-.45,.55],.9));
  cell.add(createMitochondrion(targets,[-.95,-.9,.75],[-.2,.4,-.35],.82));
  cell.add(createMitochondrion(targets,[1.28,-.85,-.45],[.4,.1,-.7],.7));
  cell.add(createGolgi(targets));
  cell.add(createReticulum(targets,true,[-.62,.05,-.65]));
  cell.add(createReticulum(targets,false,[.65,-.67,-.72]));
  cell.add(createCentrioles(targets));
  [[-1.45,.1,.8],[.05,-1.45,.8],[1.55,.15,-.45]].forEach((pos,i)=>{ const lys=new THREE.Mesh(new THREE.SphereGeometry(.14+i*.012,18,14),makeMaterial(0xec4899)); lys.position.set(...pos); cell.add(tag(lys,"lisosoma",targets)); });
  [[-1.6,.65,-.1],[-1.25,-.3,-.85],[-.25,1.35,.6],[.9,1.25,-.65],[1.7,-.25,.15],[-.35,-1.55,-.35]].forEach(pos=>{ const rib=new THREE.Mesh(new THREE.SphereGeometry(.045,8,6),makeMaterial(0xf8fafc,{emissive:0xffffff,emissiveIntensity:.15})); rib.position.set(...pos); cell.add(tag(rib,"ribosoma",targets)); });
  scene.add(cell);
  return cell;
}

export default function AnimalCellLab() {
  const mountRef=useRef(null), runtimeRef=useRef(null);
  const [selectedKey,setSelectedKey]=useState("nucleo");
  const [inside,setInside]=useState(false), [autoRotate,setAutoRotate]=useState(true), [challenge,setChallenge]=useState(false), [targetKey,setTargetKey]=useState("mitocondria"), [message,setMessage]=useState("");
  const selected=ORGANELLES[selectedKey];

  useEffect(()=>{
    const mount=mountRef.current; if(!mount) return;
    const scene=new THREE.Scene(); scene.background=new THREE.Color(0x061f2a); scene.fog=new THREE.FogExp2(0x061f2a,.055);
    const camera=new THREE.PerspectiveCamera(38,mount.clientWidth/520,.1,100); camera.position.set(0,.15,7.3);
    const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false}); renderer.setSize(mount.clientWidth,520); renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.15; mount.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xc8ffff,0x102038,2.4)); const key=new THREE.DirectionalLight(0xffffff,4); key.position.set(4,5,6); scene.add(key); const rim=new THREE.PointLight(0x2dd4bf,18,12); rim.position.set(-4,-2,-3); scene.add(rim); const warm=new THREE.PointLight(0xfb7185,10,10); warm.position.set(4,-2,2); scene.add(warm);
    const targets=[]; const cell=buildAnimalCell(scene,targets); cell.rotation.set(-.1,.25,0);
    const stars=new THREE.Points(new THREE.BufferGeometry(),new THREE.PointsMaterial({color:0x8deee6,size:.018,transparent:true,opacity:.45})); const coords=[]; for(let i=0;i<220;i++) coords.push((Math.random()-.5)*14,(Math.random()-.5)*9,(Math.random()-.5)*7); stars.geometry.setAttribute("position",new THREE.Float32BufferAttribute(coords,3)); scene.add(stars);
    const raycaster=new THREE.Raycaster(), pointer=new THREE.Vector2(); let dragging=false,moved=false,lastX=0,lastY=0,raf;
    const down=e=>{dragging=true;moved=false;lastX=e.clientX;lastY=e.clientY;renderer.domElement.setPointerCapture?.(e.pointerId)};
    const move=e=>{if(!dragging)return;const dx=e.clientX-lastX,dy=e.clientY-lastY;if(Math.abs(dx)+Math.abs(dy)>3)moved=true;cell.rotation.y+=dx*.006;cell.rotation.x=Math.max(-1,Math.min(1,cell.rotation.x+dy*.006));lastX=e.clientX;lastY=e.clientY};
    const up=e=>{dragging=false;if(moved)return;const rect=renderer.domElement.getBoundingClientRect();pointer.set(((e.clientX-rect.left)/rect.width)*2-1,-((e.clientY-rect.top)/rect.height)*2+1);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(targets,false)[0];if(hit){const k=hit.object.userData.organelle;setSelectedKey(k);setMessage(prev=>prev);runtimeRef.current?.onPick?.(k)}};
    const wheel=e=>{e.preventDefault();camera.position.z=Math.max(4.4,Math.min(10,camera.position.z+e.deltaY*.004))};
    renderer.domElement.addEventListener("pointerdown",down); renderer.domElement.addEventListener("pointermove",move); renderer.domElement.addEventListener("pointerup",up); renderer.domElement.addEventListener("wheel",wheel,{passive:false});
    const resize=()=>{const w=mount.clientWidth;camera.aspect=w/520;camera.updateProjectionMatrix();renderer.setSize(w,520)}; window.addEventListener("resize",resize);
    const tick=()=>{if(runtimeRef.current?.autoRotate&&!dragging)cell.rotation.y+=.0023; stars.rotation.y-=.00025; renderer.render(scene,camera);raf=requestAnimationFrame(tick)}; tick();
    runtimeRef.current={scene,camera,renderer,cell,autoRotate:true,onPick:null,reset:()=>{cell.rotation.set(-.1,.25,0);camera.position.set(0,.15,7.3)},setInside:value=>{cell.children.slice(0,2).forEach((m,i)=>{if(m.material)m.material.opacity=value?(i===0?.075:.045):(i===0?.18:.1)})}};
    return()=>{cancelAnimationFrame(raf);window.removeEventListener("resize",resize);renderer.domElement.removeEventListener("pointerdown",down);renderer.domElement.removeEventListener("pointermove",move);renderer.domElement.removeEventListener("pointerup",up);renderer.domElement.removeEventListener("wheel",wheel);disposeObject(scene);renderer.dispose();if(mount.contains(renderer.domElement))mount.removeChild(renderer.domElement)};
  },[]);

  useEffect(()=>{if(runtimeRef.current)runtimeRef.current.autoRotate=autoRotate},[autoRotate]);
  useEffect(()=>{runtimeRef.current?.setInside?.(inside)},[inside]);
  useEffect(()=>{if(!runtimeRef.current)return;runtimeRef.current.onPick=(key)=>{if(!challenge)return;if(key===targetKey){setMessage("¡Correcto! Encontraste el organelo. 🎉");const keys=Object.keys(ORGANELLES).filter(k=>k!==key);setTimeout(()=>{setTargetKey(keys[Math.floor(Math.random()*keys.length)]);setMessage("")},1400)}else setMessage(`Aún no. Seleccionaste ${ORGANELLES[key].name}; vuelve a intentarlo.`)}} ,[challenge,targetKey]);

  function toggleChallenge(){setChallenge(v=>!v);setMessage("");setTargetKey("mitocondria")}

  return <div className="animal-lab">
    <div className="animal-lab__toolbar">
      <div><span className="animal-lab__live"><i/> PROTOTIPO INTERACTIVO</span><h3>Célula animal</h3><p>Representación educativa · Los tamaños relativos están simplificados para facilitar la observación.</p></div>
      <div className="animal-lab__actions">
        <button className={inside?"is-active":""} onClick={()=>setInside(v=>!v)}>{inside?<EyeOff size={16}/>:<Eye size={16}/>} Vista interna</button>
        <button className={autoRotate?"is-active":""} onClick={()=>setAutoRotate(v=>!v)}><Focus size={16}/> Autorrotación</button>
        <button onClick={()=>runtimeRef.current?.reset()}><RotateCcw size={16}/> Reiniciar</button>
      </div>
    </div>
    <div className="animal-lab__body">
      <div className="animal-lab__stage">
        <div ref={mountRef} className="animal-lab__canvas"/>
        <div className="animal-lab__hint"><ScanSearch size={15}/> Arrastra para girar · desplaza para acercar · selecciona un organelo</div>
        {challenge&&<div className="animal-lab__challenge"><span><Trophy size={17}/> RETO DE EXPLORACIÓN</span><strong>{ORGANELLES[targetKey].clue}</strong><p>{message||"Selecciona la estructura correcta en el modelo."}</p></div>}
      </div>
      <aside className="animal-lab__panel">
        <div className="animal-lab__selected" style={{"--organelle":selected.color}}><span/><small>ESTRUCTURA SELECCIONADA</small><h4>{selected.name}</h4><p>{selected.function}</p></div>
        <div className="animal-lab__list"><small>ORGANELOS DISPONIBLES</small>{Object.entries(ORGANELLES).map(([key,item])=><button key={key} className={selectedKey===key?"is-selected":""} onClick={()=>setSelectedKey(key)}><i style={{background:item.color}}/><span>{item.name}</span></button>)}</div>
        <button className={challenge?"animal-lab__challenge-btn is-active":"animal-lab__challenge-btn"} onClick={toggleChallenge}><Trophy size={16}/>{challenge?"Salir del reto":"Iniciar reto pedagógico"}</button>
      </aside>
    </div>
  </div>;
}
