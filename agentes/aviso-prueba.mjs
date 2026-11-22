// AVISO DE PRUEBA: manda un aviso al celular con el tema REAL de los secretos (NTFY_TOPIC) y lo anota en la campana de la oficina.
// Si el aviso no sale, la campana lo dice con el motivo (sin tema guardado, formato inválido o ntfy sin respuesta). Nunca imprime el tema.
import fs from 'node:fs';
import path from 'node:path';
import {avisarTelefono} from './aviso.mjs';

const topic = (process.env.NTFY_TOPIC || '').trim();
let texto;
let titulo = 'Aviso de prueba';
if (!topic) { texto = 'NO salió al celular: falta guardar tu tema de ntfy (NTFY_TOPIC). Pégalo en el Estudio → Avisos al celular → Guardar.'; titulo = 'Aviso de prueba: falta el tema'; }
else if (!/^[\w-]{6,64}$/.test(topic)) { texto = 'NO salió al celular: el tema guardado no tiene un formato válido (6 a 64 letras, números, - o _).'; titulo = 'Aviso de prueba: tema inválido'; }
else {
  const ok = avisarTelefono('info', 'Aviso de prueba', 'Si ves esto en tu celular, los avisos funcionan. ✅');
  texto = ok ? 'Salió al celular con tu tema guardado. Si no lo ves en la app ntfy, revisa que estés suscrito al mismo tema.' : 'ntfy no aceptó el aviso (sin internet o servicio caído). Prueba otra vez en un minuto.';
  if (!ok) titulo = 'Aviso de prueba: ntfy no respondió';
}
console.log(titulo + ': ' + texto);
const ruta = path.join('oficina-salida', 'notificaciones.json');
let lista = [];
try { lista = JSON.parse(fs.readFileSync(ruta, 'utf8')); } catch { /* sin archivo */ }
lista.unshift({id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), fecha: new Date().toISOString(), canal: 'lqns', tipo: topic && /^[\w-]{6,64}$/.test(topic) ? 'reporte' : 'alerta', titulo, texto});
fs.mkdirSync('oficina-salida', {recursive: true});
fs.writeFileSync(ruta, JSON.stringify(lista.slice(0, 80), null, 2));
