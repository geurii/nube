// TUS DECISIONES SOBRE LAS IDEAS: en la oficina 3D el dueño responde SÍ o NO a cada idea de los agentes (temas, ganchos, títulos, mejoras, iniciativas...).
// Se guardan en oficina-salida/<canal>/decisiones.json: {decisiones: [{id, texto, categoria, decision: "si"|"no", fecha}]}.
// La fábrica NUNCA se detiene esperando tu respuesta: lo que no respondes sigue como hasta ahora. Pero lo que respondes MANDA:
//  - un tema que dijiste NO no se elige nunca; uno que dijiste SÍ pasa al principio de la lista;
//  - una idea rechazada (gancho, título, mejora...) deja de dárseles a los escritores;
//  - todos los agentes ven un resumen corto de lo que aprobaste y rechazaste, para aprender tu gusto.
import fs from 'node:fs';
import path from 'node:path';

/** Texto en minúsculas, sin tildes ni signos: sirve para reconocer la misma idea aunque cambie un acento o una coma. */
export const norm = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 160);

export const leerDecisiones = (canal = 'lqns') => {
  try {
    const j = JSON.parse(fs.readFileSync(path.join('oficina-salida', canal, 'decisiones.json'), 'utf8'));
    return (Array.isArray(j.decisiones) ? j.decisiones : []).filter((d) => d && (d.decision === 'si' || d.decision === 'no') && d.texto);
  } catch { return []; }
};

const conjunto = (decisiones, valor) => new Set(decisiones.filter((d) => d.decision === valor).map((d) => norm(d.texto)));

/** Quita las ideas que el dueño rechazó (sirve para ganchos, títulos, mejoras, iniciativas...). */
export const sinRechazadas = (lista, canal = 'lqns') => {
  const no = conjunto(leerDecisiones(canal), 'no');
  return (Array.isArray(lista) ? lista : []).filter((x) => !no.has(norm(x)));
};

/** Temas: se quitan los rechazados y los aprobados van primero. */
export const filtrarTemas = (temas, canal = 'lqns') => {
  const d = leerDecisiones(canal);
  const si = conjunto(d, 'si');
  const ok = sinRechazadas(temas, canal);
  return [...ok.filter((t) => si.has(norm(t))), ...ok.filter((t) => !si.has(norm(t)))];
};

/** ¿El dueño rechazó este texto (por ejemplo un tema que la IA vuelve a proponer)? */
export const fueRechazada = (texto, canal = 'lqns') => conjunto(leerDecisiones(canal), 'no').has(norm(texto));

/** Resumen corto para anteponer a las instrucciones de TODOS los agentes ('' si el dueño aún no ha decidido nada). */
export const leerPreferencias = (canal = 'lqns') => {
  const d = leerDecisiones(canal).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  const corto = (t) => String(t).replace(/\s+/g, ' ').trim().slice(0, 90);
  const si = d.filter((x) => x.decision === 'si').slice(0, 5).map((x) => corto(x.texto));
  const no = d.filter((x) => x.decision === 'no').slice(0, 5).map((x) => corto(x.texto));
  if (!si.length && !no.length) return '';
  return `DECISIONES DEL DUEÑO sobre ideas (respétalas, aprende su gusto y no repitas lo rechazado): ${si.length ? 'APROBÓ: ' + si.join(' | ') + '. ' : ''}${no.length ? 'RECHAZÓ: ' + no.join(' | ') + '.' : ''}`.trim();
};
