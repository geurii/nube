// Genera muestras de voz con Gemini TTS para elegir la voz a oído. Variable: GEMINI_API_KEY (secreto de GitHub).
// Prueba primero el formato actual de la documentación (Interactions API, modelo gemini-3.8-flash-tts) y, si falla,
// el formato anterior (generateContent, gemini-2.5-flash-preview-tts). Todo error queda escrito en muestras-voz/informe.txt
// (nunca se escribe la clave).
import fs from 'node:fs';
import path from 'node:path';

const KEY = process.env.GEMINI_API_KEY;
const SALIDA = 'muestras-voz';
fs.mkdirSync(SALIDA, {recursive: true});
const informe = [];
const log = (t) => { informe.push(t); console.log(t); };
if (!KEY) { log('Falta el secreto GEMINI_API_KEY.'); fs.writeFileSync(path.join(SALIDA, 'informe.txt'), informe.join('\n')); process.exit(1); }

const TEXTO = 'Sabías que, en 1997, un sonido submarino tan fuerte que se oyó a casi cinco mil kilómetros de distancia... dejó a los científicos sin palabras. Y la explicación, es todavía más extraña.';
const ESTILO = 'narrador de documental en español, voz masculina grave, cálida y misteriosa, ritmo lento con pausas';
const VOCES = ['Charon', 'Algenib', 'Orus', 'Iapetus', 'Alnilam', 'Sadaltager'];
const limpio = (t) => String(t).replaceAll(KEY, '***').slice(0, 400);

const pcmAWav = (pcm, rate = 24000) => {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
};

// Formato actual (según la documentación): Interactions API
const interactions = async (voz) => {
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST', headers: {'x-goog-api-key': KEY, 'Content-Type': 'application/json'},
    body: JSON.stringify({
      model: 'gemini-3.8-flash-tts',
      input: [{type: 'user_input', content: [{type: 'text', text: TEXTO, annotations: [{type: 'speech_metadata', style: ESTILO}]}]}],
      response_format: {type: 'audio'},
      generation_config: {speech_config: [{voice: voz}]},
    }),
    signal: AbortSignal.timeout(120000),
  });
  const cuerpo = await r.text();
  if (!r.ok) throw new Error(`Interactions ${r.status}: ${limpio(cuerpo)}`);
  const j = JSON.parse(cuerpo);
  const audios = (j.steps ?? []).filter((s) => s.type === 'model_output').flatMap((s) => s.content ?? []).filter((c) => c.type === 'audio');
  const dato = audios.at(-1)?.data;
  if (!dato) throw new Error('Interactions: la respuesta no trae audio. ' + limpio(cuerpo));
  return Buffer.from(dato, 'base64');
};

// Formato anterior: generateContent
const generateContent = async (voz) => {
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent', {
    method: 'POST', headers: {'x-goog-api-key': KEY, 'Content-Type': 'application/json'},
    body: JSON.stringify({
      contents: [{parts: [{text: `Lee en tono de ${ESTILO}: ${TEXTO}`}]}],
      generationConfig: {responseModalities: ['AUDIO'], speechConfig: {voiceConfig: {prebuiltVoiceConfig: {voiceName: voz}}}},
    }),
    signal: AbortSignal.timeout(120000),
  });
  const cuerpo = await r.text();
  if (!r.ok) throw new Error(`generateContent ${r.status}: ${limpio(cuerpo)}`);
  const dato = JSON.parse(cuerpo).candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data;
  if (!dato) throw new Error('generateContent: sin audio. ' + limpio(cuerpo));
  return pcmAWav(Buffer.from(dato, 'base64'));
};

let hechas = 0;
for (const voz of VOCES) {
  let wav = null;
  for (const [nombre, f] of [['interactions', interactions], ['generateContent', generateContent]]) {
    try {
      wav = await f(voz);
      if (wav.subarray(0, 4).toString() !== 'RIFF') wav = pcmAWav(wav); // por si llega PCM crudo
      log(`${voz}: OK con ${nombre} (${Math.round(wav.length / 1024)} KB)`);
      break;
    } catch (e) { log(`${voz}: falló ${nombre}: ${e.message}`); }
  }
  if (wav) { fs.writeFileSync(path.join(SALIDA, `gemini-${voz}.wav`), wav); hechas++; }
  await new Promise((r) => setTimeout(r, 4000));
}
log(`Muestras listas: ${hechas} de ${VOCES.length}.`);
fs.writeFileSync(path.join(SALIDA, 'informe.txt'), informe.join('\n'));
process.exit(hechas ? 0 : 1);
