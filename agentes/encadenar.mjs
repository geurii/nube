// Decide si la oficina puede encadenar otro ciclo.
// El repositorio es público: no aplicamos presupuesto mensual ni límites internos de minutos de GitHub Actions.
// Se conserva únicamente un tope operativo de 10 publicaciones diarias para evitar bucles o duplicados masivos.
const ahora = new Date();
const META_DIA = 10;
try {
  const fs = await import('node:fs');
  const dia = (d) => {
    const fecha = new Date(d);
    if (Number.isNaN(fecha.getTime())) return '';
    return new Date(fecha.getTime() - 4 * 3600_000).toISOString().slice(0, 10);
  };
  const hoyRD = dia(ahora);
  const ids = new Set();
  try {
    for (const c of fs.readdirSync('oficina-salida', {withFileTypes: true}).filter((d) => d.isDirectory())) {
      try {
        const datos = JSON.parse(fs.readFileSync(`oficina-salida/${c.name}/subidos.json`, 'utf8'));
        for (const v of datos.videos ?? []) if (dia(v.fecha) === hoyRD && v.id) ids.add(String(v.id));
      } catch { /* canal sin contador */ }
    }
  } catch { /* sin carpeta */ }
  try {
    const n = JSON.parse(fs.readFileSync('oficina-salida/notificaciones.json', 'utf8'));
    for (const x of n) {
      if (/^Video subido/i.test(x.titulo ?? '') && dia(x.fecha) === hoyRD) {
        ids.add(String(x.texto ?? '').match(/youtu\\.be\\/([\\w-]+)/)?.[1] ?? x.id);
      }
    }
  } catch { /* sin notificaciones */ }
  console.log(`Videos subidos hoy (hora RD): ${ids.size} de ${META_DIA}.`);
  if (ids.size >= META_DIA) {
    console.log('Meta operativa diaria cumplida; se evita producir en bucle.');
    process.exit(1);
  }
} catch (e) {
  // Si falla el contador, no bloqueamos la producción: el límite mensual ya no existe.
  console.log(`No se pudo leer el contador diario (${e.message}); se permite continuar.`);
}
console.log('Sin límite mensual de minutos ni presupuesto: se permite lanzar otro ciclo.');
process.exit(0);
