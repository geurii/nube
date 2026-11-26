import fs from 'node:fs';
import path from 'node:path';
const file='agentes/lote-30-publicacion.json';
const x=JSON.parse(fs.readFileSync(file,'utf8'));
if(x.fase!=='renderizados_30_pendiente_artifacto'||x.completedCount!==30||x.items.length!==30||!x.items.every(i=>i.aprobado&&i.estado==='renderizado_aprobado'))throw new Error('La barrera 30/30 no se cumple.');
for(const item of x.items){
 const f=path.join('out/serie',item.id+'-subida.mp4');
 if(!fs.existsSync(f)||fs.statSync(f).size>10*1024*1024)throw new Error('Falta el artefacto verificado de '+item.id);
}
if(!process.env.GITHUB_RUN_ID)throw new Error('No se recibió el ID de la corrida que contiene el artefacto.');
x.fase='ready_to_publish';
x.runId=String(process.env.GITHUB_RUN_ID);
x.artifact='lote-30-videos';
x.nextIndex=0;
x.nextAt=new Date().toISOString();
x.lastPublishedAt=null;
x.activadoEn=new Date().toISOString();
fs.writeFileSync(file,JSON.stringify(x,null,2)+'\n');
console.log('BARRERA 30/30 CONFIRMADA. Se habilita una publicación por intervalo mínimo de 20 minutos.');
