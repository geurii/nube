// Garantiza SIEMPRE 5 hashtags específicos del tema (regla fija del canal: nunca #viral ni #fyp), aunque la Mesa de publicación haya fallado.
// Se completan con el nombre del tema y sus palabras clave, y al final con etiquetas del nicho.
const PROHIBIDOS = /^#(viral|fyp|foryou|foryoupage|parati|trending)$/i;
const NICHO = ['#HistoriaOculta', '#MisteriosSinResolver', '#DatosCuriosos', '#HechosReales', '#LoQueNoSabias'];
const SIN_VALOR = new Set(['the', 'of', 'and', 'in', 'on', 'at', 'for', 'to', 'a', 'an', 'la', 'el', 'los', 'las', 'de', 'del', 'que']);

const aTag = (texto) => '#' + String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean)
  .map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');

export const completarHashtags = (actuales, tema) => {
  const salida = [];
  const clave = (h) => h.toLowerCase();
  const poner = (h) => {
    if (!/^#[\p{L}\p{N}_]{3,40}$/u.test(h) || PROHIBIDOS.test(h)) return;
    if (!salida.some((x) => clave(x) === clave(h))) salida.push(h);
  };
  for (const h of Array.isArray(actuales) ? actuales : []) poner(String(h).replace(/\s+/g, ''));
  const palabras = String(tema ?? '').split(/\s+/).filter((p) => p.length >= 7 && !SIN_VALOR.has(p.toLowerCase())); // solo palabras largas y específicas (#Molasses sí, #Great no)
  const sinArticulo = String(tema ?? '').replace(/^the\s+/i, '');
  poner(aTag(sinArticulo)); // el nombre completo del tema: #MaryCeleste, #GreatMolassesFlood
  for (const p of palabras) poner(aTag(p)); // y cada palabra clave
  for (const h of NICHO) poner(h);
  return salida.slice(0, 5);
};
