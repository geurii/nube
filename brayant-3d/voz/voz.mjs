import fs from 'node:fs';
import {MsEdgeTTS, OUTPUT_FORMAT} from 'msedge-tts';
const lineas = [
  'Si Brayant sale positivo, lo echan de su casa. Le quedan treinta días.',
  'Y puede perder algo más: un trabajo en Estados Unidos y su sueño de entrar a la Marina.',
  'Cien veces dijo: mañana lo dejo. Y ese mañana nunca llegaba.',
  'Pero hoy dijo: ya.',
  'Metió todo lo que le quedaba en una bolsa, para botarlo. Sin guardar nada para después.',
  'Se levantó, caminó hacia la puerta... y alguien tocó.',
  'Era su mamá. Y la bolsa seguía en su mano.',
  'Tú decides: ¿le cuenta la verdad, o esconde la bolsa? Comenta verdad, o esconde.',
];
const decir = async (texto, destino) => {
  const tts = new MsEdgeTTS();
  await tts.setMetadata('es-MX-JorgeNeural', OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3, {wordBoundaryEnabled: true});
  const {audioStream, metadataStream} = tts.toStream(texto, {rate: '+0%', pitch: '-6Hz'});
  const audio = []; const palabras = [];
  if (metadataStream) metadataStream.on('data', (c) => { try { for (const m of JSON.parse(c.toString()).Metadata ?? []) if (m.Type === 'WordBoundary') palabras.push({texto: m.Data.text.Text, inicio: m.Data.Offset / 1e7, fin: (m.Data.Offset + m.Data.Duration) / 1e7}); } catch {} });
  await new Promise((res, rej) => { audioStream.on('data', (c) => audio.push(Buffer.from(c))); audioStream.on('error', rej); audioStream.on('close', res); });
  const buf = Buffer.concat(audio);
  if (buf.length < 2000) throw new Error('audio vacio');
  fs.writeFileSync(destino, buf);
  return palabras;
};
const todo = {};
for (let i = 0; i < lineas.length; i++) {
  todo[i + 1] = await decir(lineas[i], `brayant-3d/voz/l${i + 1}.mp3`);
  console.log('linea', i + 1, todo[i + 1].length, 'palabras');
}
fs.writeFileSync('brayant-3d/voz/palabras.json', JSON.stringify(todo));
process.exit(0);
