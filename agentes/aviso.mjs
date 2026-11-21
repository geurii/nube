// Aviso al teléfono con ntfy (app gratis, sin cuenta). Se activa si existe el secreto NTFY_TOPIC (el "tema" privado que el dueño
// suscribió en la app). Solo avisa de lo importante: permisos, alertas y videos subidos. Nunca lanza ni detiene al flujo.
import {spawnSync} from 'node:child_process';

const CONFIG = {
  permiso: {prioridad: 5, tags: ['closed_lock_with_key'], prefijo: 'NECESITO TU PERMISO'},
  alerta: {prioridad: 4, tags: ['warning'], prefijo: 'ALERTA'},
  subido: {prioridad: 3, tags: ['tada'], prefijo: 'VIDEO SUBIDO'},
  jules: {prioridad: 3, tags: ['speech_balloon'], prefijo: 'JULES'},
};

export const avisarTelefono = (tipo, titulo, texto) => {
  const topic = (process.env.NTFY_TOPIC || '').trim();
  const c = CONFIG[tipo];
  if (!topic || !c || !/^[\w-]{6,64}$/.test(topic)) return false;
  try {
    const cuerpo = JSON.stringify({topic, title: `${c.prefijo}: ${String(titulo).slice(0, 80)}`, message: String(texto).slice(0, 900), priority: c.prioridad, tags: c.tags});
    const r = spawnSync('curl', ['-s', '-m', '12', '-o', '/dev/null', '-w', '%{http_code}', '-H', 'Content-Type: application/json', '-d', cuerpo, 'https://ntfy.sh/'], {encoding: 'utf8', timeout: 15000});
    return r.stdout?.trim() === '200';
  } catch { return false; }
};
