// Avisos al teléfono por ntfy. Reintenta fallos de red y deja diagnóstico sin revelar el tema privado.
import {spawnSync} from 'node:child_process';

const CONFIG = {
  permiso: {prioridad: 5, tags: ['closed_lock_with_key'], prefijo: 'NECESITO TU PERMISO'},
  alerta: {prioridad: 4, tags: ['warning'], prefijo: 'ALERTA'},
  subido: {prioridad: 3, tags: ['tada'], prefijo: 'VIDEO SUBIDO'},
  info: {prioridad: 3, tags: ['bulb'], prefijo: 'INFO'},
  jules: {prioridad: 3, tags: ['speech_balloon'], prefijo: 'JULES'},
  listo: {prioridad: 4, tags: ['white_check_mark'], prefijo: 'LISTO'},
  reporte: {prioridad: 3, tags: ['memo'], prefijo: 'REPORTE'},
};

export const avisarTelefono = (tipo, titulo, texto) => {
  // Las pruebas simuladas jamás deben enviar mensajes al teléfono real.
  if (process.env.MODO_PRUEBA === '1') { console.log(`[ntfy] Aviso simulado, no enviado: ${tipo} · ${String(titulo).slice(0, 60)}`); return true; }
  const topic = (process.env.NTFY_TOPIC || '').trim();
  const c = CONFIG[tipo];
  if (!topic) { console.error('[ntfy] No se envió el aviso: falta el secreto NTFY_TOPIC en GitHub.'); return false; }
  if (!/^[\w-]{6,64}$/.test(topic)) { console.error('[ntfy] No se envió el aviso: NTFY_TOPIC tiene un formato no válido.'); return false; }
  if (!c) { console.error(`[ntfy] Tipo de aviso desconocido: ${tipo}`); return false; }
  const cuerpo = JSON.stringify({topic, title: `${c.prefijo}: ${String(titulo).slice(0, 80)}`, message: String(texto).slice(0, 900), priority: c.prioridad, tags: c.tags});
  for (let intento = 1; intento <= 3; intento++) {
    const r = spawnSync('curl', ['--silent', '--show-error', '--max-time', '15', '--output', '/dev/null', '--write-out', '%{http_code}', '-H', 'Content-Type: application/json', '-d', cuerpo, 'https://ntfy.sh/'], {encoding: 'utf8', timeout: 17000});
    if (r.status === 0 && r.stdout?.trim() === '200') {
      console.log(`[ntfy] Aviso aceptado por ntfy (intento ${intento}).`);
      return true;
    }
    console.error(`[ntfy] Falló el envío (intento ${intento}/3): HTTP ${r.stdout?.trim() || 'sin respuesta'}; ${String(r.stderr || r.error?.message || 'error de red').slice(0, 140)}`);
    if (intento < 3) spawnSync('sleep', ['2']);
  }
  return false;
};
