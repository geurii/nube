// Solo devuelve éxito cuando el resultado más reciente está APROBADO.
// Un error de proveedor, cuota, investigación o visuales nunca cuenta como aprobación.
import fs from 'node:fs';
import path from 'node:path';
const canal = (process.env.CANAL || 'lqns').trim();
try {
  const e = JSON.parse(fs.readFileSync(path.join('oficina-salida', canal, 'estado.json'), 'utf8'));
  const r = e.historial?.[0]?.resultado;
  console.log('Último resultado de la oficina:', r);
  process.exit(r === 'aprobado' ? 0 : 1);
} catch (e) {
  console.log('No se pudo leer el estado de aprobación:', String(e.message ?? e));
  process.exit(1);
}
