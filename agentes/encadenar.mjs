// Decide solo si la oficina puede lanzar otro ciclo SIN quedarse sin minutos gratis de GitHub este mes.
// Presupuesto: 1800 min/mes (200 de margen). Cada día puede gastar lo que quede entre los días que faltan.
// Sale con código 0 = "sí, lanzar otro"; 1 = "no, ya se gastó lo de hoy". Si no puede calcular, NO lanza (más seguro).
const repo = process.env.GITHUB_REPOSITORY, token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const PRESUPUESTO = 1800, CICLO = 50; // CICLO = minutos FACTURADOS que cuesta un ciclo completo (guion + panel + voz + render + redes); sube si se añaden pasos
const FACTOR_DEFECTO = 1.55; // GitHub factura por trabajo redondeando cada uno hacia arriba: el reloj de una corrida subestima ~1,5 veces (medido: 581 min por reloj = ~900 facturados)
if (!repo || !token) { console.log('Sin datos para calcular: no se encadena.'); process.exit(1); }
const ahora = new Date();
const mesInicio = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1));
const hoyInicio = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()));
const diasMes = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() + 1, 0)).getUTCDate();
const diasQuedan = diasMes - ahora.getUTCDate() + 1;
let usadoMes = 0, usadoHoy = 0;
const muestra = []; // corridas terminadas recientes para medir el factor real de facturación
try {
  for (let pag = 1; pag <= 10; pag++) {
    const r = await fetch(`https://api.github.com/repos/${repo}/actions/runs?per_page=100&page=${pag}&created=>=${mesInicio.toISOString().slice(0, 10)}`, {headers: {Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json'}});
    if (!r.ok) throw new Error(`API ${r.status}`);
    const runs = (await r.json()).workflow_runs ?? [];
    for (const x of runs) {
      const ini = new Date(x.run_started_at ?? x.created_at), fin = x.status === 'completed' ? new Date(x.updated_at) : ahora;
      const min = Math.max(1, Math.ceil((fin - ini) / 60000));
      usadoMes += min;
      if (x.status === 'completed' && muestra.length < 25) muestra.push({id: x.id, min});
      if (ini >= hoyInicio) usadoHoy += min;
    }
    if (runs.length < 100) break;
  }
} catch (e) { console.log(`No pude calcular los minutos (${e.message}): no se encadena.`); process.exit(1); }
// CALIBRACIÓN: se mide cuánto factura GitHub de verdad (cada trabajo redondeado hacia arriba) en las últimas corridas y se escala el total del reloj.
let factor = FACTOR_DEFECTO;
try {
  let facturado = 0, reloj = 0;
  for (const m of muestra) {
    const t = await fetch(`https://api.github.com/repos/${repo}/actions/runs/${m.id}/timing`, {headers: {Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json'}, signal: AbortSignal.timeout(20000)});
    if (!t.ok) continue;
    const b = (await t.json()).billable ?? {};
    const trabajos = Object.values(b).flatMap((o) => o?.job_runs ?? []);
    const minutos = trabajos.length ? trabajos.reduce((a, j) => a + Math.max(1, Math.ceil((j.duration_ms ?? 0) / 60000)), 0) : 0;
    if (minutos > 0) { facturado += minutos; reloj += m.min; }
  }
  if (reloj >= 15 && facturado > 0) factor = Math.min(2.5, Math.max(1, facturado / reloj));
  console.log(`Factor de facturación: ${factor.toFixed(2)} (${reloj >= 15 ? 'medido en ' + muestra.length + ' corridas' : 'por defecto: no pude medirlo'}).`);
} catch { console.log(`Factor de facturación por defecto: ${FACTOR_DEFECTO}.`); }
usadoMes = Math.round(usadoMes * factor);
usadoHoy = Math.round(usadoHoy * factor);
console.log(`Minutos usados este mes: ${usadoMes}. Hoy: ${usadoHoy}.`); // se imprime siempre (el vigilante lo lee), incluso si luego se descansa por la meta del día
// Meta: hasta 10 videos al día (8 Shorts cada 3 h + 2 largos cada 12 h), día de República Dominicana (UTC-4). El presupuesto mensual de GitHub sigue siendo el límite real.
const META_DIA = 10;
try {
  const fs = await import('node:fs');
  const dia = (d) => new Date(new Date(d).getTime() - 4 * 3600_000).toISOString().slice(0, 10);
  const hoyRD = dia(ahora);
  let aprobadosHoy = 0; // videos realmente subidos hoy a YouTube
  const ids = new Set();
  try {
    for (const c of fs.readdirSync('oficina-salida', {withFileTypes: true}).filter((d) => d.isDirectory())) {
      try { for (const v of JSON.parse(fs.readFileSync(`oficina-salida/${c.name}/subidos.json`, 'utf8')).videos ?? []) if (dia(v.fecha) === hoyRD) ids.add(v.id); } catch { /* canal sin contador */ }
    }
  } catch { /* sin carpeta */ }
  try {
    const n = JSON.parse(fs.readFileSync('oficina-salida/notificaciones.json', 'utf8'));
    for (const x of n) if (/^Video subido/i.test(x.titulo ?? '') && dia(x.fecha) === hoyRD) ids.add(String(x.texto ?? '').match(/youtu\.be\/([\w-]+)/)?.[1] ?? x.id);
  } catch { /* sin notificaciones */ }
  aprobadosHoy = ids.size;
  console.log(`Videos subidos hoy: ${aprobadosHoy} de ${META_DIA}.`);
  if (aprobadosHoy >= META_DIA) { console.log('Meta del día cumplida: se descansa hasta mañana.'); process.exit(1); }
} catch (e) { console.log(`No pude contar los videos de hoy (${e.message}); se sigue con el presupuesto.`); }
const antesDeHoy = usadoMes - usadoHoy;
const presupuestoHoy = Math.max(0, (PRESUPUESTO - antesDeHoy) / diasQuedan);
console.log(`Minutos usados este mes: ${usadoMes}. Hoy: ${usadoHoy} de ${Math.round(presupuestoHoy)} permitidos.`);
if (usadoHoy + CICLO <= presupuestoHoy) { console.log('Hay presupuesto: se lanza otro ciclo.'); process.exit(0); }
console.log('Presupuesto de hoy gastado: se espera al siguiente día para no quedarse sin minutos.'); process.exit(1);
