// Imprime los identificadores de los canales activos (separados por espacio). Si CANAL_PEDIDO está puesto, solo ese.
import fs from 'node:fs';
const config = JSON.parse(fs.readFileSync('agentes/canales-propios.json', 'utf8'));
const activos = (config.canales ?? []).filter((c) => c.activo !== false).map((c) => c.id);
const pedido = (process.env.CANAL_PEDIDO ?? '').trim();
console.log((pedido ? activos.filter((c) => c === pedido) : activos).join(' '));
