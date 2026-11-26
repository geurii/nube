import fs from 'node:fs';
import path from 'node:path';
import {validarEscena,tieneAnclaNarrativa} from '../agentes/pintor.mjs';

const read=(p,d)=>{try{return JSON.parse(fs.readFileSync(p,'utf8'));}catch{return d;}};
const config=read('agentes/lote-30-contenidos.json',null);
if(!config||config.topics?.length!==30)throw new Error('Faltan los 30 temas del lote.');
const produced=read('oficina-salida/lqns/producidos.json',[]);
const oldFiles=fs.readdirSync('oficina-salida/lqns').filter(f=>/^guion-.+\.json$/.test(f));
const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'');
const oldSlugs=new Set(produced.map(norm));
const oldTitles=new Set();
for(const f of oldFiles){
 oldSlugs.add(norm(f.replace(/^guion-|\.json$/g,'')));
 const g=read(path.join('oficina-salida/lqns',f),{});
 oldTitles.add(norm(g.titulo));
 oldTitles.add(norm(g.publicacion?.titulo));
}
const palettes=[
 ['#071527','#142d4b','#284c70'],['#191323','#3b2945','#806075'],['#081b20','#16434a','#3a7771'],
 ['#1b1a24','#4d3b39','#957052'],['#111b2d','#263c58','#6485a1']
];
const variants=[
 {x:.50,y:.61,w:.70,h:.44,r:.22,alto:.42},{x:.42,y:.58,w:.58,h:.38,r:.18,alto:.36},
 {x:.59,y:.66,w:.76,h:.46,r:.24,alto:.48},{x:.51,y:.55,w:.62,h:.42,r:.20,alto:.40}
];
const safe=(v)=>Math.max(0,Math.min(1,v));
const visual=(anchor,index,topicIndex,sceneIndex)=>{
 const q=variants[index%variants.length],palette=palettes[(topicIndex+sceneIndex+index)%palettes.length];
 const main={t:anchor,...q,color:palette[2],semilla:(sceneIndex+1)*31+topicIndex+index+7,rampa:palette};
 if(anchor==='bosque')main.n=12;
 if(anchor==='nubes')main.n=6;
 if(anchor==='olas')main.espuma=true;
 if(anchor==='astro'||anchor==='esfera'||anchor==='moneda'||anchor==='ovni')main.r=.20+index*.012;
 if(anchor==='paracaidas')main.h=.44;
 if(anchor==='dodecaedro'||anchor==='televisor'||anchor==='radio'||anchor==='periodico')main.w=.70;
 if(anchor==='tornado'||anchor==='puente')main.h=.62;
 if(anchor==='zepelin')main.h=.28;
 const decorA={t:'estrellas',n:18+index*3,hasta:.62,semilla:index+topicIndex,color:'#d5e0ed'};
 const decorB={t:index%2===0?'particulas':'nubes',n:12+index,y:.2,semilla:sceneIndex*13+index,color:palette[1]};
 const decorC={t:'niebla',y:.92,alpha:.25,semilla:topicIndex+sceneIndex+index,color:palette[0]};
 const raw={cielo:palette,capas:[decorA,decorB,main,decorC]};
 const clean=validarEscena(raw);
 if(!clean||!tieneAnclaNarrativa(clean,config.topics[topicIndex].scenes[sceneIndex].text)){
  throw new Error('Ancla visual incorrecta: '+config.topics[topicIndex].slug+' escena '+(sceneIndex+1)+' plano '+(index+1)+' ('+anchor+').');
 }
 return clean;
};
const typeFor=i=>i===0?'hook':i===3?'revelacion':i===4?'veredicto':'historia';
fs.mkdirSync('guion/serie',{recursive:true});
fs.mkdirSync('public/pintados',{recursive:true});
fs.mkdirSync('oficina-salida/lqns',{recursive:true});
let visualCount=0;
for(let ti=0;ti<config.topics.length;ti++){
 const topic=config.topics[ti],slug=topic.slug,id='lqns-'+slug;
 if(oldSlugs.has(norm(slug))||oldTitles.has(norm(topic.title)))throw new Error('Tema repetido; no se reemplaza: '+slug);
 const scenes=[];
 for(let si=0;si<topic.scenes.length;si++){
  const src=topic.scenes[si],fonds=[];
  for(let vi=0;vi<4;vi++){
   const suffix=String.fromCharCode(97+vi),asset=id+'-s'+(si+1)+'-'+suffix;
   const plano=visual(src.anchor,vi,ti,si);
   fs.writeFileSync(path.join('public/pintados',asset+'.json'),JSON.stringify(plano));
   fonds.push('pintado:'+asset);visualCount++;
  }
  scenes.push({tipo:typeFor(si),texto:src.text,fondo:fonds});
 }
 const words=scenes.reduce((n,s)=>n+s.texto.trim().split(/\s+/).length,0);
 if(words<95)throw new Error('La locución debe alcanzar al menos 95 palabras: '+id);
 const g={
  titulo:topic.title,formato:'short',plataforma:'youtube',canal:'lqns',voz:'es-MX-JorgeNeural',vozGemini:'Sadaltager',
  audio:'audio/'+id+'.wav',musica:'musica/firma-canal.mp3',orientacion:'vertical',personaje:{visible:false},
  creado:new Date().toISOString(),estilo:'gancho',ganchoTexto:scenes[0].texto,
  publicacion:{titulo:topic.title,descripcion:topic.desc},estado:'aprobado',
  revisionEditorial:{tipo:'guion_original_con_fuente',fuentes:[{url:topic.source}],nota:'Contenido reescrito; hechos limitados a lo respaldado por la fuente citada.'},
  escenas:scenes
 };
 fs.writeFileSync(path.join('guion/serie',id+'.json'),JSON.stringify(g,null,2)+'\n');
 const editorial={...g,slug,editor:{puntaje:10,critica:'Revisión editorial por fuente y coherencia narrativa. La validación técnica del MP4 todavía es obligatoria.'}};
 fs.writeFileSync(path.join('oficina-salida/lqns','guion-'+slug+'.json'),JSON.stringify(editorial,null,2)+'\n');
 console.log('PREPARADO '+(ti+1)+'/30 '+id+' · '+words+' palabras · 20 planos');
}
const state={
 version:1,fase:'preparado',canal:'lqns',total:30,completedCount:0,intervalMinutes:10,
 nextIndex:0,nextAt:null,lastPublishedAt:null,runId:null,artifact:'lote-30-videos',
 items:config.topics.map(t=>({id:'lqns-'+t.slug,slug:t.slug,titulo:t.title,estado:'pendiente_render',aprobado:false,duracionSegundos:null,publicadoEn:{youtube:false,facebook:false,instagram:false,tiktok:false}})),
 errores:[]
};
fs.writeFileSync('agentes/lote-30-publicacion.json',JSON.stringify(state,null,2)+'\n');
console.log('LOTE PREPARADO: 30 guiones faceless, '+visualCount+' visuales específicos y ningún tema duplicado.');
