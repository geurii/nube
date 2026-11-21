// Decide solo si la oficina puede lanzar otro ciclo SIN quedarse sin minutos gratis de GitHub este mes.
// Presupuesto: 1800 min/mes (200 de margen). Cada día puede gastar lo que quede entre los días que faltan.
// Sale con código 0 = "sí, lanzar otro"; 1 = "no, ya se gastó lo de hoy". Si no puede calcular, NO lanza (más seguro).
const repo = process.env.GITHUB_REPOSITORY, token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const PRESUPUESTO = 1800, CICLO = 35;
if (!repo || !token) { console.log('Sin datos para calcular: no se encadena.'); process.exit(1); }
const ahora = new Date();
const mesInicio = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1));
const hoyInicio = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()));
const diasMes = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() + 1, 0)).getUTCDate();
const diasQuedan = diasMes - ahora.getUTCDate() + 1;
let usadoMes = 0, usadoHoy = 0;
try {
  for (let pag = 1; pag <= 10; pag++) {
    const r = await fetch(`https://api.github.com/repos/${repo}/actions/runs?per_page=100&page=${pag}&created=>=${mesInicio.toISOString().slice(0, 10)}`, {headers: {Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json'}});
    if (!r.ok) throw new Error(`API ${r.status}`);
    const runs = (await r.json()).workflow_runs ?? [];
    for (const x of runs) {
      const ini = new Date(x.run_started_at ?? x.created_at), fin = x.status === 'completed' ? new Date(x.updated_at) : ahora;
      const min = Math.max(1, Math.ceil((fin - ini) / 60000));
      usadoMes += min;
      if (ini >= hoyInicio) usadoHoy += min;
    }
    if (runs.length < 100) break;
  }
} catch (e) { console.log(`No pude calcular los minutos (${e.message}): no se encadena.`); process.exit(1); }
// Meta: 2 videos al día (día de República Dominicana, UTC-4). Con 2 guiones aprobados hoy, se descansa para ahorrar minutos.
const META_DIA = 2;
try {
  const fs = await import('node:fs');
  const dia = (d) => new Date(new Date(d).getTime() - 4 * 3600_000).toISOString().slice(0, 10);
  const hoyRD = dia(ahora);
  let aprobadosHoy = 0; // videos realmente subidos hoy a YouTube
  try {
    const n = JSON.parse(fs.readFileSync('oficina-salida/notificaciones.json', 'utf8'));
    aprobadosHoy = n.filter((x) => /^Video subido/i.test(x.titulo ?? '') && dia(x.fecha) === hoyRD).length;
  } catch { /* sin notificaciones */ }
  console.log(`Videos subidos hoy: ${aprobadosHoy} de ${META_DIA}.`);
  if (aprobadosHoy >= META_DIA) { console.log('Meta del día cumplida: se descansa hasta mañana.'); process.exit(1); }
} catch (e) { console.log(`No pude contar los videos de hoy (${e.message}); se sigue con el presupuesto.`); }
const antesDeHoy = usadoMes - usadoHoy;
const presupuestoHoy = Math.max(0, (PRESUPUESTO - antesDeHoy) / diasQuedan);
console.log(`Minutos usados este mes: ${usadoMes}. Hoy: ${usadoHoy} de ${Math.round(presupuestoHoy)} permitidos.`);
if (usadoHoy + CICLO <= presupuestoHoy) { console.log('Hay presupuesto: se lanza otro ciclo.'); process.exit(0); }
console.log('Presupuesto de hoy gastado: se espera al siguiente día para no quedarse sin minutos.'); process.exit(1);
