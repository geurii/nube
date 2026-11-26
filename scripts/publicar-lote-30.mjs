import fs from 'node:fs';
import path from 'node:path';
const file='agentes/lote-30-publicacion.json';
const state=()=>JSON.parse(fs.readFileSync(file,'utf8'));
const save=x=>fs.writeFileSync(file,JSON.stringify(x,null,2)+'\n');
const out=(k,v)=>{if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,k+'='+String(v??'').replace(/[\r\n]/g,' ')+'\n');};
const arg=process.argv[2]??'';
if(arg==='--prepare'){
 const x=state(),ready=x.intervalMinutes===20&&x.fase==='ready_to_publish'&&x.completedCount===30&&x.items.length===30&&x.items.every(i=>i.aprobado&&i.estado!=='requiere_reparacion');
 const index=Number(x.nextIndex??0),due=!x.nextAt||Date.parse(x.nextAt)<=Date.now();
 if(!ready||index>=30||!due){
  out('enabled','false');
  out('reason',!ready?'El lote no ha superado la barrera 30/30.':index>=30?'Los 30 ya se han publicado.':'Aún no vence el intervalo de veinte minutos.');
  process.exit(0);
 }
 const item=x.items[index];
 out('enabled','true');out('run_id',x.runId);out('artifact',x.artifact??'lote-30-videos');
 out('index',index);out('id',item.id);out('slug',item.slug);out('title',item.titulo);
 process.exit(0);
}
if(arg==='--finalize'){
 const x=state(),index=Number(process.env.LOTE_INDEX),item=x.items[index],id=String(process.env.ID??'');
 if(!item||item.id!==id)throw new Error('El video y el índice no coinciden con la cola.');
 const dir=path.join('oficina-salida','lqns');
 const read=p=>{try{return JSON.parse(fs.readFileSync(path.join(dir,p),'utf8'));}catch{return{};}};
 const produced=(()=>{try{return JSON.parse(fs.readFileSync(path.join(dir,'producidos.json'),'utf8'));}catch{return[];}})();
 const list=name=>{const db=read(name);return Array.isArray(db.posts)?db.posts:[];};
 const find=(name)=>list(name).find(p=>String(p.id)===id);
 const fb=Boolean(find('facebook.json')),ig=Boolean(find('instagram.json'));
 const tiktok=find('tiktok.json');
 let tick=false;
 try{const response=JSON.parse(tiktok?.respuesta??'{}');tick=response.programado==='ahora'&&response.status==='sent';}catch{}
 const subidos=read('subidos.json');
 const normalize=v=>String(v??'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'');
 const yt=produced.some(v=>String(v).toLowerCase()===item.slug.toLowerCase())
  || (Array.isArray(subidos.videos)&&subidos.videos.some(v=>normalize(v.titulo)===normalize(item.titulo)));
 item.publicadoEn={youtube:yt,facebook:fb,instagram:ig,tiktok:tick};
 item.publicacionDetalle={youtube:yt?'confirmado':'pendiente',facebook:fb?'confirmado':'pendiente',instagram:ig?'confirmado':'pendiente',tiktok:tick?'confirmado':'pendiente'};
 item.ultimoIntento=new Date().toISOString();
 if(yt&&fb&&ig&&tick){
  item.estado='publicado_en_todas';item.publicado=true;item.publicadoEnHora=item.ultimoIntento;
  x.nextIndex=index+1;x.lastPublishedAt=item.publicadoEnHora;
  if(x.nextIndex===30){x.fase='completed';x.completedAt=item.publicadoEnHora;console.log('30/30 PUBLICADOS Y CONFIRMADOS.');}
  else{x.nextAt=new Date(Date.now()+20*60*1000).toISOString();console.log('Publicación '+(x.nextIndex)+'/30 confirmada. Siguiente no antes de '+x.nextAt+'.');}
 }else{
  item.estado='publicacion_parcial_reintentar';item.publicado=false;
  const missing=Object.entries(item.publicadoEn).filter(([,v])=>!v).map(([k])=>k);
  item.errorPublicacion='Falta confirmación: '+missing.join(', ');
  x.nextAt=new Date(Date.now()+20*60*1000).toISOString();
  console.error('No se avanza la cola. Se reintentará el mismo video; falta: '+missing.join(', '));
 }
 save(x);
 if(!(yt&&fb&&ig&&tick))process.exit(1);
}
