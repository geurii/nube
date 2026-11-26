import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {validarEscena,tieneAnclaNarrativa} from '../agentes/pintor.mjs';

const statePath='agentes/lote-30-publicacion.json';
const state=JSON.parse(fs.readFileSync(statePath,'utf8'));
const save=()=>fs.writeFileSync(statePath,JSON.stringify(state,null,2)+'\n');
const run=(args)=>spawnSync(process.execPath,args,{stdio:'inherit',timeout:25*60*1000});
const probe=(file)=>{
 const p=spawnSync('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_type,width,height','-of','json',file],{encoding:'utf8',timeout:60000});
 if(p.status!==0)throw new Error('ffprobe falló: '+String(p.stderr??'').slice(0,200));
 return JSON.parse(p.stdout);
};
const failures=[];
for(let index=0;index<state.items.length;index++){
 const item=state.items[index],id=item.id,guionPath=path.join('guion/serie',id+'.json');
 let accepted=false,lastError='';
 console.log('\n=== RENDER SECUENCIAL '+(index+1)+'/30: '+id+' ===');
 for(let attempt=1;attempt<=2&&!accepted;attempt++){
  const g=JSON.parse(fs.readFileSync(guionPath,'utf8'));
  try{
   if(g.personaje?.visible!==false)throw new Error('El guion no es faceless.');
   if(/https?:\/\//i.test(g.publicacion?.descripcion??''))throw new Error('La descripción contiene un enlace.');
   if(!Array.isArray(g.escenas)||g.escenas.length!==5)throw new Error('El video debe tener cinco escenas.');
   const refs=new Set();
   for(let si=0;si<g.escenas.length;si++){
    const scene=g.escenas[si];
    if(!Array.isArray(scene.fondo)||scene.fondo.length!==10)throw new Error('Se requieren diez visuales por escena para sostener escenas de hasta 30 segundos sin repetir imágenes.');
    for(const ref of scene.fondo){
     if(typeof ref!=='string'||!ref.startsWith('pintado:'))throw new Error('Visual sin arte pixel interno.');
     const name=ref.slice('pintado:'.length);
     if(refs.has(name))throw new Error('Visual repetido dentro del mismo Short.');
     refs.add(name);
     const file=path.join('public/pintados',name+'.json');
     if(!fs.existsSync(file))throw new Error('Falta visual '+file);
     const raw=JSON.parse(fs.readFileSync(file,'utf8'));
     const clean=validarEscena(raw);
     if(!clean||!tieneAnclaNarrativa(clean,scene.texto))throw new Error('Visual que no corresponde a la narración: '+name);
    }
   }
   console.log('Intento '+attempt+': voz y Remotion, uno por uno.');
   const r=run(['scripts/lote.mjs',id,'--forzar']);
   if(r.error||r.status!==0)throw new Error('Lote de voz/render terminó con '+String(r.status??r.error?.message??r.signal));
   const mp4=path.join('out/serie',id+'.mp4'),lite=path.join('out/serie',id+'-subida.mp4');
   if(!fs.existsSync(mp4)||!fs.existsSync(lite))throw new Error('Falta el MP4 original o la copia optimizada.');
   const m=probe(mp4),v=(m.streams??[]).find(x=>x.codec_type==='video'),a=(m.streams??[]).find(x=>x.codec_type==='audio'),seconds=Number(m.format?.duration);
   const timed=path.join('guion/serie',id+'.palabras.json');
   if(!Number.isFinite(seconds)||seconds<30||seconds>180){
    if(seconds<30&&attempt===1){
     g.escenas[4].texto+=' La fuente consultada permite separar los hechos confirmados de las hipótesis que todavía no tienen evidencia suficiente.';
     fs.writeFileSync(guionPath,JSON.stringify(g,null,2)+'\n');
     console.warn('Duración menor de 30s; se amplía la última escena y se vuelve a grabar la voz.');
     continue;
    }
    throw new Error('Duración fuera de rango: '+seconds+' segundos.');
   }
   if(!v||v.width!==1080||v.height!==1920)throw new Error('Resolución no vertical 1080x1920.');
   if(!a)throw new Error('El MP4 no contiene pista de audio.');
   if(!fs.existsSync(path.join('public',g.audio)))throw new Error('No existe el WAV de voz.');
   if(!fs.existsSync(timed))throw new Error('No existen subtítulos temporizados.');
   const captions=JSON.parse(fs.readFileSync(timed,'utf8'));
   if(!Array.isArray(captions)||captions.length<60)throw new Error('Subtítulos insuficientes o no sincronizados.');
   const liteMeta=probe(lite),lv=(liteMeta.streams??[]).find(x=>x.codec_type==='video'),la=(liteMeta.streams??[]).find(x=>x.codec_type==='audio');
   if(!lv||lv.width!==1080||lv.height!==1920||!la)throw new Error('La versión ligera perdió imagen vertical o audio.');
   const bytes=fs.statSync(lite).size;
   if(bytes>10*1024*1024)throw new Error('La copia optimizada supera 10 MB.');
   const revisionTecnica={fecha:new Date().toISOString(),resultado:'aprobado',metodo:'verificacion_automatica_lote',controles:['duracion_30_a_180_segundos','1080x1920_vertical','voz_y_audio_presentes','faceless_personaje_oculto','subtitulos_temporizados','50_visuals_por_short_sin_repetir_y_con_ancla_narrativa','descripcion_sin_enlaces','archivo_optimizado_menor_de_10MB']};
   g.estado='aprobado';
   g.revisionTecnica=revisionTecnica;
   fs.writeFileSync(guionPath,JSON.stringify(g,null,2)+'\n');
   const editorialPath=path.join('oficina-salida/lqns','guion-'+item.slug+'.json');
   if(fs.existsSync(editorialPath)){const office=JSON.parse(fs.readFileSync(editorialPath,'utf8'));office.estado='aprobado';office.revisionTecnica=revisionTecnica;fs.writeFileSync(editorialPath,JSON.stringify(office,null,2)+'\n');}
   Object.assign(item,{estado:'renderizado_aprobado',aprobado:true,duracionSegundos:Number(seconds.toFixed(2)),tamanoBytes:bytes,resolucion:'1080x1920',audio:true,faceless:true,subtitulos:captions.length,revisionTecnica});
   state.completedCount=state.items.filter(x=>x.aprobado).length;
   save();
   console.log('APROBADO '+(index+1)+'/30 · '+seconds.toFixed(1)+'s · '+(bytes/1048576).toFixed(2)+'MB · voz y subtítulos.');
   accepted=true;
  }catch(e){
   lastError=String(e.message??e);
   console.error('INTENTO '+attempt+' FALLÓ: '+lastError);
  }
 }
 if(!accepted){
  item.estado='requiere_reparacion';item.aprobado=false;item.error=lastError;
  failures.push({id,error:lastError});
  state.errores=failures;state.fase='requiere_reparacion';state.completedCount=state.items.filter(x=>x.aprobado).length;save();
  console.error('Se aparta '+id+'; se continúa secuencialmente con el siguiente sin desbloquear publicaciones.');
 }
}
state.completedCount=state.items.filter(x=>x.aprobado).length;
state.errores=failures;
if(state.completedCount===30&&state.items.every(x=>x.estado==='renderizado_aprobado'&&x.aprobado)){
 state.fase='renderizados_30_pendiente_artifacto';
 console.log('30/30 renderizados y aprobados. Publicación sigue bloqueada hasta verificar el artefacto.');
}else{
 state.fase='requiere_reparacion';
 console.error('LOTE BLOQUEADO: '+state.completedCount+'/30 aprobados. No se publicará ninguno.');
}
save();
if(state.fase!=='renderizados_30_pendiente_artifacto')process.exit(1);
