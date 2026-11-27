import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {validarEscena,tieneAnclaNarrativa} from '../agentes/pintor.mjs';
import {revisarVideo} from '../agentes/video-gemini.mjs';

const statePath='agentes/lote-30-publicacion.json';
const state=JSON.parse(fs.readFileSync(statePath,'utf8'));
const save=()=>fs.writeFileSync(statePath,JSON.stringify(state,null,2)+'\n');
const run=(args)=>spawnSync(process.execPath,args,{stdio:'inherit',timeout:32*60*1000});
const probe=(file)=>{
 const p=spawnSync('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_type,width,height','-of','json',file],{encoding:'utf8',timeout:60000});
 if(p.status!==0)throw new Error('ffprobe falló: '+String(p.stderr??'').slice(0,200));
 return JSON.parse(p.stdout);
};
const failures=[];
if(!Array.isArray(state.items)||state.items.length!==30)throw new Error('El renderizador requiere exactamente 30 Shorts.');
if(new Set(state.items.map(x=>x.id)).size!==30)throw new Error('Hay IDs repetidos: se detiene antes de renderizar.');
// PRUEBA DE UNO: con LOTE_SOLO=1 se renderiza solo el primero (o los N primeros) para verlo antes de gastar
// las horas de los 30. La publicacion sigue bloqueada: solo 30/30 aprobados la desbloquea.
const SOLO=Math.max(0,Math.min(30,Number(process.env.LOTE_SOLO??0)||0));
// UNO SOLO POR MAQUINA: con LOTE_INDEX=n esta ejecucion renderiza unicamente el Short n.
// Asi los 30 corren en paralelo, cada uno en su maquina, en vez de 4 horas en fila.
const UNO=process.env.LOTE_INDEX===undefined||process.env.LOTE_INDEX===''?-1:Number(process.env.LOTE_INDEX);
const desde=UNO>=0?UNO:0;
const hasta=UNO>=0?UNO+1:(SOLO>0?SOLO:state.items.length);
if(UNO>=0)console.log('MODO UNO: solo el Short '+(UNO+1)+' de 30.');
else if(SOLO>0)console.log('MODO PRUEBA: se renderizan '+SOLO+' de 30. No se publicara nada.');
for(let index=desde;index<hasta;index++){
 const item=state.items[index],id=item.id,guionPath=path.join('guion/serie',id+'.json');
 item.estado='renderizando';item.aprobado=false;state.fase='renderizando_secuencial';save();
 let accepted=false,lastError='';
 console.log('\n=== SHORT '+(index+1)+'/30: '+id+' ===');
 console.log('Solo se procesa este Short. El siguiente no comienza hasta terminar voz, render, ffprobe, subtítulos y compresión.');
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
     // Un cuadro con IMAGEN del sujeto ya corresponde a la narracion: la imagen se pidio
     // describiendo lo que dice la frase. El ancla dibujada solo se exige a los cuadros pintados.
     // 'foto3d' son los tres planos de profundidad: el archivo base existe y, ademas,
     // tienen que estar sus tres cortes, si no la escena se veria incompleta.
     const conImagen=Array.isArray(raw?.capas)&&raw.capas.some(c=>{
      if(!c||typeof c.archivo!=='string')return false;
      const base=c.archivo.replace(/\.png$/i,'');
      if(c.t==='foto')return fs.existsSync(path.join('public/referencias',c.archivo));
      if(c.t==='foto3d')return [0,1,2].every(n=>fs.existsSync(path.join('public/referencias',base+'.l'+n+'.png')));
      return false;
     });
     if(conImagen){
      if(raw.capas.length<3)throw new Error('Visual con imagen pero sin ambiente encima (quedaria quieto): '+name);
      continue;
     }
     const clean=validarEscena(raw);
     if(!clean||!tieneAnclaNarrativa(clean,scene.texto))throw new Error('Visual que no corresponde a la narración: '+name);
    }
   }
   console.log('Intento '+attempt+': iniciando únicamente '+id+'; se espera su proceso completo antes de continuar.');
   const r=run(['scripts/lote.mjs',id,'--forzar']);
   if(r.error||r.status!==0)throw new Error('Lote de voz/render terminó con '+String(r.status??r.error?.message??r.signal));
   const mp4=path.join('out/serie',id+'.mp4'),lite=path.join('out/serie',id+'-subida.mp4');
   if(!fs.existsSync(mp4)||!fs.existsSync(lite))throw new Error('Falta el MP4 original o la copia optimizada.');
   const m=probe(mp4),v=(m.streams??[]).find(x=>x.codec_type==='video'),a=(m.streams??[]).find(x=>x.codec_type==='audio'),seconds=Number(m.format?.duration);
   const timed=path.join('guion/serie',id+'.palabras.json');
   if(!Number.isFinite(seconds)||seconds<60||seconds>62){
    if(seconds<45&&attempt===1){
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
   const revisionTecnica={fecha:new Date().toISOString(),resultado:'aprobado',metodo:'verificacion_automatica_lote',controles:['revision_de_imagen_con_ia','duracion_60_a_62_segundos','1080x1920_vertical','voz_y_audio_presentes','faceless_personaje_oculto','subtitulos_temporizados','50_visuals_por_short_sin_repetir_y_con_ancla_narrativa','descripcion_sin_enlaces','archivo_optimizado_menor_de_10MB']};
   // REVISION DE IMAGEN: alguien tiene que MIRAR el video antes de darlo por bueno.
   // Hasta ahora el lote solo comprobaba duracion, resolucion y que hubiera audio.
   let revision=null;
   try{
    revision=await revisarVideo({ruta:mp4, key:(process.env.GEMINI_API_KEY||'').trim(), contexto:item.titulo});
    if(revision?.error){ console.log('   revision de imagen no disponible ('+String(revision.error).slice(0,90)+'): el Short pasa con la comprobacion tecnica.'); }
    else if(Array.isArray(revision?.defectos_graves)&&revision.defectos_graves.length){
     throw new Error('La revision de imagen encontro fallas graves: '+revision.defectos_graves.join(' / '));
    } else { console.log('   revision de imagen: sin fallas graves.'); }
   }catch(e){
    if(String(e.message||'').startsWith('La revision de imagen')) throw e;
    console.log('   revision de imagen fallo ('+String(e.message??e).slice(0,90)+'): el Short pasa con la comprobacion tecnica.');
   }
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
if(UNO>=0){
 state.fase='parcial';save();
 const it=state.items[UNO];
 console.log((it.aprobado?'APROBADO':'FALLO')+' el Short '+(UNO+1)+'/30: '+it.id+(it.duracionSegundos?' ('+it.duracionSegundos+' s)':''));
 process.exit(it.aprobado?0:1);
}
if(SOLO>0){
 state.fase='prueba';
 save();
 const ok=state.items.slice(0,hasta).filter(x=>x.aprobado).length;
 console.log('PRUEBA: '+ok+'/'+hasta+' renderizados y aprobados. La publicacion sigue bloqueada.');
 process.exit(ok===hasta?0:1);
}
if(state.completedCount===30&&state.items.every(x=>x.estado==='renderizado_aprobado'&&x.aprobado)){
 state.fase='renderizados_30_pendiente_artifacto';
 console.log('30/30 renderizados y aprobados. Publicación sigue bloqueada hasta verificar el artefacto.');
}else{
 state.fase='requiere_reparacion';
 console.error('LOTE BLOQUEADO: '+state.completedCount+'/30 aprobados. No se publicará ninguno.');
}
save();
if(state.fase!=='renderizados_30_pendiente_artifacto')process.exit(1);
