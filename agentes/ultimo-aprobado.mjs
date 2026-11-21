// Sale con código 0 si el último intento de la oficina fue APROBADO (para decidir si hay que probar con otro tema).
import fs from 'node:fs';
import path from 'node:path';
const canal = (process.env.CANAL || 'lqns').trim();
try {
  const e = JSON.parse(fs.readFileSync(path.join('oficina-salida', canal, 'estado.json'), 'utf8'));
  const r = e.historial?.[0]?.resultado;
  console.log('Último resultado de la oficina:', r);
  // aprobado o error de cuota: no seguir gastando intentos en este ciclo
  process.exit(r === 'aprobado' || r === 'error' ? 0 : 1);
} catch { process.exit(1); }
