import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
import {modelosGemini} from './gemini-modelos.mjs';

const ejecutar = promisify(execFile);

const NVIDIA_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const NVIDIA_MODELO = 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning';
const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const GROQ_MODELO = 'whisper-large-v3';

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const respuestaTexto = (contenido) => {
  if (typeof contenido === 'string') return contenido;
  if (Array.isArray(contenido)) {
    return contenido.map((p) => p?.text ?? '').join('\n');
  }
  return '';
};

const extraerJSON = (texto) => {
  const limpio = texto.replace(/```json|```/gi, '').trim();
  const inicio = limpio.indexOf('{');
  const final = limpio.lastIndexOf('}');
  if (inicio < 0 || final <= inicio) {
    throw new Error('NVIDIA no devolvió un JSON válido');
  }
  return JSON.parse(limpio.slice(inicio, final + 1));
};

const prepararAudio = async (ruta) => {
  const temporal = path.join(os.tmpdir(), `revision-${randomUUID()}.mp3`);

  try {
    const {stdout} = await ejecutar('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-show_entries', 'stream=codec_type',
      '-of', 'json',
      ruta,
    ], {timeout: 30000, maxBuffer: 2 * 1024 * 1024});

    const datos = JSON.parse(stdout);
    const duracion = Number(datos.format?.duration);
    const tieneAudio = (datos.streams ?? []).some((s) => s.codec_type === 'audio');

    if (!Number.isFinite(duracion) || duracion <= 0) {
      throw new Error('No se pudo determinar la duración del video');
    }

    if (duracion > 120) {
      throw new Error('El video supera los 2 minutos. Esta versión no puede revisarlo completo con NVIDIA.');
    }

    if (!tieneAudio) {
      throw new Error('El video no contiene una pista de audio');
    }

    await ejecutar('ffmpeg', [
      '-y', '-i', ruta,
      '-vn', '-ac', '1', '-ar', '16000',
      '-b:a', '64k', '-f', 'mp3',
      temporal,
    ], {timeout: 90000, maxBuffer: 2 * 1024 * 1024});

    const audio = fs.readFileSync(temporal);

    if (!audio.length || audio.length > 25 * 1024 * 1024) {
      throw new Error('El audio extraído está vacío o supera el límite de 25 MB');
    }

    return {audio, temporal, duracion};
  } catch (e) {
    try { fs.rmSync(temporal, {force: true}); } catch {}
    throw e;
  }
};

const transcribirAudio = async (audio, key) => {
  const formulario = new FormData();

  formulario.append(
    'file',
    new Blob([audio], {type: 'audio/mpeg'}),
    'revision.mp3'
  );
  formulario.append('model', GROQ_MODELO);
  formulario.append('language', 'es');
  formulario.append('response_format', 'json');

  let ultimoError = '';

  for (let intento = 1; intento <= 3; intento++) {
    try {
      const r = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {Authorization: `Bearer ${key}`},
        body: formulario,
        signal: AbortSignal.timeout(90000),
      });

      const cuerpo = await r.text();

      if (r.status === 429 || [500, 502, 503, 504].includes(r.status)) {
        ultimoError = `Groq respondió ${r.status}`;
        if (intento < 3) {
          await dormir(intento * 5000);
          continue;
        }
      }

      if (!r.ok) {
        throw new Error(`Groq ${r.status}: ${cuerpo.slice(0, 250)}`);
      }

      const datos = JSON.parse(cuerpo);

      if (typeof datos.text !== 'string') {
        throw new Error('Groq no devolvió la transcripción');
      }

      return datos.text.trim();
    } catch (e) {
      ultimoError = String(e.message).slice(0, 250);
      if (intento < 3) await dormir(intento * 3000);
    }
  }

  throw new Error(`No se pudo transcribir el audio: ${ultimoError}`);
};

const revisarImagen = async (ruta, key, contexto, transcripcion) => {
  const bytes = fs.readFileSync(ruta);

  if (!bytes.length || bytes.length > 50 * 1024 * 1024) {
    throw new Error('El video está vacío o supera el límite de 50 MB para esta revisión');
  }

  const prompt = `
You are a strict technical visual quality inspector for vertical social media videos.

Inspect the complete video visually. Do NOT judge taste, popularity, creativity, storytelling, or factual accuracy.

Context: ${contexto || 'No additional context'}.

The Spanish speech transcription is provided only as context:
${transcripcion.slice(0, 5000)}

Check only serious technical visual failures:
1. Black, frozen, corrupted or missing video frames.
2. Subtitles or essential on-screen text visibly cut off, covered or unreadable.
3. Visuals completely unrelated to the subject described in the context.
4. Major rendering defects that make the video impossible to publish.

Do not reject a video for ordinary stylistic choices, repeated shots, pacing, visual simplicity or personal taste.
If there are no serious technical defects, defectos_graves must be an empty array.
If there are no subtitles, consider subtitles legible and not cut off.

Return ONLY valid JSON, with this exact structure:
{
  "imagen": {
    "nota": 0,
    "defectos": []
  },
  "subtitulos": {
    "legibles": true,
    "tapados_o_cortados": false,
    "comentario": ""
  },
  "defectos_graves": []
}

Use a score from 0 to 10. Do not invent defects.`;

  let ultimoError = '';

  for (let intento = 1; intento <= 3; intento++) {
    try {
      const r = await fetch(NVIDIA_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: NVIDIA_MODELO,
          temperature: 0.1,
          max_tokens: 1200,
          messages: [{
            role: 'user',
            content: [
              {type: 'text', text: prompt},
              {
                type: 'video_url',
                video_url: {
                  url: `data:video/mp4;base64,${bytes.toString('base64')}`,
                },
              },
            ],
          }],
        }),
        signal: AbortSignal.timeout(180000),
      });

      const cuerpo = await r.text();

      if (r.status === 429 || [500, 502, 503, 504].includes(r.status)) {
        ultimoError = `NVIDIA respondió ${r.status}`;
        if (intento < 3) {
          await dormir(intento * 7000);
          continue;
        }
      }

      if (!r.ok) {
        throw new Error(`NVIDIA ${r.status}: ${cuerpo.slice(0, 250)}`);
      }

      const datos = JSON.parse(cuerpo);
      const contenido = respuestaTexto(datos.choices?.[0]?.message?.content);

      if (!contenido) {
        throw new Error('NVIDIA devolvió una respuesta vacía');
      }

      const revision = extraerJSON(contenido);

      if (
        !revision.imagen ||
        !Number.isFinite(Number(revision.imagen.nota)) ||
        !revision.subtitulos ||
        typeof revision.subtitulos.legibles !== 'boolean' ||
        typeof revision.subtitulos.tapados_o_cortados !== 'boolean' ||
        !Array.isArray(revision.defectos_graves)
      ) {
        throw new Error('La revisión visual está incompleta');
      }

      revision.imagen.nota = Math.max(0, Math.min(10, Number(revision.imagen.nota)));
      revision.imagen.defectos = Array.isArray(revision.imagen.defectos)
        ? revision.imagen.defectos
        : [];

      return revision;
    } catch (e) {
      ultimoError = String(e.message).slice(0, 250);
      if (intento < 3) await dormir(intento * 3000);
    }
  }

  throw new Error(`No se pudo revisar la imagen: ${ultimoError}`);
};


/** Respaldo visual: extrae fotogramas repartidos por el video y los revisa con Gemini si NVIDIA falla. */
const revisarImagenGemini = async (ruta, contexto, transcripcion) => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Falta GEMINI_API_KEY para el respaldo visual');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'taos-frames-'));
  try {
    const {stdout} = await ejecutar('ffprobe', ['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',ruta], {timeout:30000});
    const duracion = Number(stdout.trim());
    if (!Number.isFinite(duracion) || duracion <= 0) throw new Error('No se pudo medir el video para extraer fotogramas');
    const tiempos = [...new Set([0, .15, .3, .5, .7, .9].map(p => Math.min(Math.max(0, duracion*p), Math.max(0,duracion-0.2))))];
    const partes = [{text:`Revisa técnicamente estos fotogramas del video completo, tomados en distintos momentos. Contexto: ${contexto}. Transcripción de audio: ${transcripcion.slice(0,3500)}. Evalúa SOLO fallas técnicas graves: fotogramas negros/corruptos, texto/subtítulos cortados o ilegibles, imágenes completamente ajenas al tema, defectos de renderizado que impidan publicar. No rechaces por estilo, sencillez o repetición. Si no se ven fallas graves, defectos_graves debe ser []. Devuelve SOLO JSON: {"imagen":{"nota":0,"defectos":[]},"subtitulos":{"legibles":true,"tapados_o_cortados":false,"comentario":""},"defectos_graves":[]}. Si no puedes determinar algo desde las imágenes, no inventes defectos.`}];
    for (let i=0;i<tiempos.length;i++) {
      const file=path.join(dir,`frame-${i}.jpg`);
      await ejecutar('ffmpeg',['-y','-ss',String(tiempos[i]),'-i',ruta,'-frames:v','1','-vf','scale=960:-2','-q:v','5',file],{timeout:30000,maxBuffer:2*1024*1024});
      const data=fs.readFileSync(file);
      if (!data.length) throw new Error(`Fotograma ${i+1} vacío`);
      partes.push({inline_data:{mime_type:'image/jpeg',data:data.toString('base64')}});
    }
    const modelos=await modelosGemini(key,4);
    let ultimo='';
    for (const modelo of modelos) {
      try {
        const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,{
          method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},
          body:JSON.stringify({contents:[{role:'user',parts}],generationConfig:{temperature:0.1,maxOutputTokens:1200,responseMimeType:'application/json'}}),
          signal:AbortSignal.timeout(120000)
        });
        const cuerpo=await r.text();
        if(!r.ok) { ultimo=`Gemini ${modelo} ${r.status}: ${cuerpo.slice(0,180)}`; continue; }
        const j=JSON.parse(cuerpo);
        const texto=(j.candidates?.[0]?.content?.parts??[]).map(x=>x.text??'').join('\n');
        if(!texto.trim()) {ultimo=`Gemini ${modelo} devolvió respuesta vacía`;continue;}
        const v=extraerJSON(texto);
        if(!v.imagen||!Number.isFinite(Number(v.imagen.nota))||!v.subtitulos||typeof v.subtitulos.legibles!=='boolean'||typeof v.subtitulos.tapados_o_cortados!=='boolean'||!Array.isArray(v.defectos_graves)) {ultimo=`Gemini ${modelo} devolvió una revisión incompleta`;continue;}
        v.imagen.nota=Math.max(0,Math.min(10,Number(v.imagen.nota)));
        v.imagen.defectos=Array.isArray(v.imagen.defectos)?v.imagen.defectos:[];
        return {...v, respaldo:'Gemini revisó fotogramas distribuidos a lo largo del video; no es análisis continuo de cada fotograma.'};
      } catch(e) { ultimo=String(e.message??e).slice(0,200); }
    }
    throw new Error(ultimo||'Ningún modelo Gemini pudo revisar los fotogramas');
  } finally { try {fs.rmSync(dir,{recursive:true,force:true});} catch {} }
};

export const revisarVideo = async ({ruta, key, contexto = ''}) => {
  let temporal = null;

  try {
    const nvidiaKey = process.env.NVIDIA_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;

    if (!nvidiaKey) return {error: 'Falta NVIDIA_API_KEY'};
    if (!groqKey) return {error: 'Falta GROQ_API_KEY'};
    if (!ruta || !fs.existsSync(ruta)) {
      return {error: 'No encuentro el archivo de video'};
    }

    const preparado = await prepararAudio(ruta);
    temporal = preparado.temporal;

    const transcripcion = await transcribirAudio(preparado.audio, groqKey);

    if (!transcripcion || transcripcion.length < 3) {
      return {error: 'Groq no detectó voz inteligible en el video. Revisión bloqueada.'};
    }

    let visual;
    let modeloVisual = `NVIDIA ${NVIDIA_MODELO}`;
    try {
      visual = await revisarImagen(ruta, nvidiaKey, contexto, transcripcion);
    } catch (errorNvidia) {
      console.warn('NVIDIA falló; se activa respaldo Gemini:', errorNvidia.message);
      visual = await revisarImagenGemini(ruta, contexto, transcripcion);
      modeloVisual = 'Gemini (fotogramas de respaldo)';
    }

    const defectos = [...visual.defectos_graves];

    if (
      visual.subtitulos.tapados_o_cortados ||
      !visual.subtitulos.legibles
    ) {
      defectos.push('Subtítulos tapados, cortados o ilegibles');
    }

    const revision = {
      gancho_3s: {
        nota: visual.imagen.nota,
        comentario: 'Revisión visual técnica; no es una valoración del gancho.',
      },
      audio: {
        nota: 8,
        comentario: `Groq Whisper transcribió el audio en español. Duración: ${Math.round(preparado.duracion)} segundos. Transcripción: ${transcripcion.slice(0, 1200)}`,
      },
      subtitulos: visual.subtitulos,
      imagen: visual.imagen,
      ritmo: {
        nota: 8,
        comentario: 'No se utiliza el ritmo como motivo de rechazo técnico.',
      },
      defectos_graves: defectos,
      nota_general: visual.imagen.nota,
      recomendacion: defectos.length ? 'no subir' : 'subir',
      por_que: defectos.length
        ? defectos.join(' / ')
        : 'No se detectaron fallas visuales graves y Groq pudo transcribir el audio.',
    };

    return {
      modelo: `${modeloVisual} + Groq ${GROQ_MODELO}`,
      revision,
    };
  } catch (e) {
    return {
      error: String(e.message || e).slice(0, 500),
    };
  } finally {
    if (temporal) {
      try { fs.rmSync(temporal, {force: true}); } catch {}
    }
  }
};