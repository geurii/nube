import fs from 'node:fs';
import path from 'node:path';
import {TIPOS,OBJETOS_NARRATIVOS,validarEscena,tieneAnclaNarrativa} from '../agentes/pintor.mjs';

const configPath='agentes/lote-30-contenidos.json';
const config=JSON.parse(fs.readFileSync(configPath,'utf8'));
const normal=(s)=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
assert(config.topics.length===30,'El archivo debe contener exactamente 30 temas.');
assert(config.channel==='lqns'&&config.format==='short'&&config.minimumDurationSeconds>=30&&config.intervalMinutes===10,'Configuración de lote inválida.');
const slugs=new Set(),titles=new Set();
const palette=['#08182b','#203f60','#6d8eaa'];
const current=(()=>{try{return JSON.parse(fs.readFileSync('oficina-salida/lqns/producidos.json','utf8'));}catch{return[];}})();
const existing=fs.readdirSync('oficina-salida/lqns').filter(x=>/^guion-.+\.json$/.test(x));
const previousSlugs=new Set(current.map(normal));
const previousTitles=new Set();
for(const file of existing){
 const slug=file.replace(/^guion-|\.json$/g,'');
 previousSlugs.add(normal(slug));
 try{
  const g=JSON.parse(fs.readFileSync(path.join('oficina-salida/lqns',file),'utf8'));
  previousTitles.add(normal(g.titulo));
  previousTitles.add(normal(g.publicacion?.titulo));
 }catch{}
}
for(const topic of config.topics){
 const slug=normal(topic.slug),title=normal(topic.title);
 assert(/^[a-z0-9-]{4,70}$/.test(topic.slug),'Slug inválido: '+topic.slug);
 assert(!slugs.has(slug),'Slug repetido dentro del lote: '+topic.slug);
 assert(!titles.has(title),'Título repetido dentro del lote: '+topic.title);
 assert(!previousSlugs.has(slug),'Tema ya producido anteriormente: '+topic.slug);
 assert(!previousTitles.has(title),'Título ya existente en LQNS: '+topic.title);
 assert(/^https:\/\//i.test(topic.source),'Fuente principal no HTTPS en '+topic.slug);
 assert(!/https?:\/\//i.test(topic.desc),'La descripción no puede contener enlaces: '+topic.slug);
 assert(Array.isArray(topic.scenes)&&topic.scenes.length===5,'Se esperan cinco escenas: '+topic.slug);
 const words=topic.scenes.reduce((n,s)=>n+String(s.text??'').trim().split(/\s+/).length,0);
 assert(words>=95,'Guion demasiado corto para asegurar 30 segundos: '+topic.slug+' ('+words+' palabras).');
 slugs.add(slug);titles.add(title);
 for(let i=0;i<topic.scenes.length;i++){
  const scene=topic.scenes[i];
  assert(TIPOS.has(scene.anchor)&&OBJETOS_NARRATIVOS.has(scene.anchor),'No existe un objeto visual permitido para '+topic.slug+' escena '+(i+1)+': '+scene.anchor);
  const raw={cielo:palette,capas:[
   {t:'estrellas',n:18,hasta:.58},
   {t:'particulas',n:12,semilla:i+1},
   {t:scene.anchor,x:.5,y:.58,w:.68,h:.46,r:.22,alto:.42,n:10,semilla:i+7,color:'#a9c6d8',rampa:palette}
  ]};
  const clean=validarEscena(raw);
  assert(clean,'La capa visual no pasó la limpieza del Pintor: '+topic.slug+' escena '+(i+1));
  assert(tieneAnclaNarrativa(clean,scene.text),'La imagen no corresponde a la frase: '+topic.slug+' escena '+(i+1)+' ['+scene.anchor+']');
 }
}
console.log('PRUEBA LOTE OK: 30 temas únicos, fuentes, 150 escenas y 150 anclas narrativas verificadas.');
