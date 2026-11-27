// Cola del lote de 30: un video cada 20 minutos.
// Reglas: cada video se intenta UNA sola vez (así nunca se repite) y la cola sigue aunque una red falle.
// Lo que falte queda anotado en el estado para subirlo después.
import fs from 'node:fs';
import path from 'node:path';
const file='agentes/lote-30-publicacion.json';
const RENDER_APROBADO=46042972544;
const INTERVALO=20*60*1000;
const MARGEN=5*60*1000;
const state=()=>JSON.parse(fs.readFileSync(file,'utf8'));
const save=x=>fs.writeFileSync(file,JSON.stringify(x,null,2)+'\n');
const out=(k,v)=>{if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,k+'='+String(v??'').replace(/[\r\n]/g,' ')+'\n');};
const avanzar=(x,index)=>{
 x.nextIndex=index+1;
 if(x.nextIndex>=30){
  x.fase='completed';x.completedAt=new Date().toISOString();x.nextAt=null;
  const pendientes=x.items.filter(i=>!i.publicado).map(i=>i.id);
  console.log('Cola terminada. Con algo pendiente: '+(pendientes.length?pendientes.join(', '):'ninguno'));
 }
};
const arg=process.argv[2]??'';

// Se activa una sola vez, a mano. Si la cola ya empezó, no la reinicia.
if(arg==='--activate'){
 const x=state();
 if(x.fase!=='preparado'){console.log('La cola ya estaba en fase "'+x.fase+'"; no se reinicia.');process.exit(0);}
 if(x.items.length!==30)throw new Error('La cola no tiene 30 videos.');
 Object.assign(x,{fase:'ready_to_publish',completedCount:30,intervalMinutes:20,runId:RENDER_APROBADO,nextIndex:0,nextAt:null,activatedAt:new Date().toISOString()});
 for(const i of x.items){i.aprobado=true;i.estado='aprobado';}
 save(x);console.log('Cola activada: 30 videos, uno cada 20 minutos.');
 process.exit(0);
}

if(arg==='--prepare'){
 const x=state(),ready=x.intervalMinutes===20&&x.fase==='ready_to_publish'&&x.completedCount===30&&x.items.length===30&&x.items.every(i=>i.aprobado);
 let index=Number(x.nextIndex??0);
 // Si una ejecución se cortó a mitad de una subida, no se repite ese video: se marca y se sigue.
 if(ready&&index<30&&x.items[index].estado==='publicando'){
  x.items[index].estado='interrumpido_revisar';x.items[index].publicado=false;
  avanzar(x,index);save(x);index=Number(x.nextIndex);
 }
 const falta=x.nextAt?Date.parse(x.nextAt)-Date.now():0;
 if(!ready||x.fase!=='ready_to_publish'||index>=30||falta>MARGEN){
  out('enabled','false');
  const motivo=index>=30?'Los 30 ya se procesaron.':!ready?'La cola no está activada.':'Todavía no toca el siguiente video.';
  out('reason',motivo);console.log(motivo);
  process.exit(0);
 }
 const item=x.items[index];
 out('enabled','true');out('run_id',x.runId);out('index',index);out('id',item.id);
 console.log('Toca el video '+(index+1)+'/30: '+item.id);
 process.exit(0);
}

const elegido=()=>{
 const x=state(),index=Number(process.env.LOTE_INDEX),item=x.items[index],id=String(process.env.ID??'');
 if(!item||item.id!==id||index!==Number(x.nextIndex))throw new Error('El video y el índice no coinciden con la cola.');
 return {x,index,item,id};
};

// Espera la hora exacta y deja anotado que este video se está subiendo.
if(arg==='--reserve'){
 const {x,item}=elegido();
 const falta=x.nextAt?Date.parse(x.nextAt)-Date.now():0;
 if(falta>0)await new Promise(r=>setTimeout(r,falta));
 item.estado='publicando';item.reservadoEn=new Date().toISOString();
 save(x);
}

if(arg==='--finalize'){
 const {x,index,item,id}=elegido();
 const dir=path.join('oficina-salida','lqns');
 const read=(p,d={})=>{try{return JSON.parse(fs.readFileSync(path.join(dir,p),'utf8'));}catch{return d;}};
 const list=name=>{const db=read(name);return Array.isArray(db.posts)?db.posts:[];};
 const find=name=>list(name).find(p=>String(p.id)===id);
 const fb=Boolean(find('facebook.json')),ig=Boolean(find('instagram.json'));
 let tick=false;
 try{const r=JSON.parse(find('tiktok.json')?.respuesta??'{}');tick=r.programado==='ahora'&&r.status==='sent';}catch{}
 const produced=read('producidos.json',[]),subidos=read('subidos.json');
 const normalize=v=>String(v??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'');
 const yt=(Array.isArray(produced)&&produced.some(v=>String(v).toLowerCase()===item.slug.toLowerCase()))
  || (Array.isArray(subidos.videos)&&subidos.videos.some(v=>normalize(v.titulo)===normalize(item.titulo)));
 item.publicadoEn={youtube:yt,facebook:fb,instagram:ig,tiktok:tick};
 item.publicacionDetalle=Object.fromEntries(Object.entries(item.publicadoEn).map(([k,v])=>[k,v?'confirmado':'pendiente']));
 item.ultimoIntento=new Date().toISOString();
 const missing=Object.entries(item.publicadoEn).filter(([,v])=>!v).map(([k])=>k);
 item.publicado=missing.length===0;
 if(item.publicado){
  item.estado='publicado_en_todas';item.publicadoEnHora=item.ultimoIntento;x.lastPublishedAt=item.ultimoIntento;delete item.errorPublicacion;
  console.log('Video '+(index+1)+'/30 confirmado en las cuatro redes.');
 }else{
  item.estado='publicado_con_pendientes';item.errorPublicacion='Sin confirmación: '+missing.join(', ');
  console.log('::warning::Video '+(index+1)+'/30 ('+id+') sin confirmación en: '+missing.join(', ')+'. La cola sigue; revisar antes de volver a subirlo.');
 }
 x.nextAt=new Date(Date.parse(item.reservadoEn??item.ultimoIntento)+INTERVALO).toISOString();
 avanzar(x,index);
 save(x);
}
