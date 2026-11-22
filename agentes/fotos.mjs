// FOTOS REALES POR CONTEXTO: para cada escena busca en internet (gratis y SIN llave) fotos del objeto, lugar o suceso que la frase menciona, y el motor de pixel art
// las convierte a pixelado a pantalla completa. Fuentes: Wikimedia Commons, Openverse y NASA (espacio). Solo licencias libres: dominio público, CC0 y CC BY
// (con crédito automático en la descripción). Nunca se reutiliza una foto de otro video ni se recicla nada de un video que no funcionó.
// Nunca lanza: si algo falla, devuelve lo que haya y la escena cae a los pintores.
import fs from 'node:fs';
import path from 'node:path';

const UA = 'FabricaDeVideos/1.0 (fotos de referencia para pixel art)';
const LICENCIA_OK = /^(public domain|pd[- ]|cc0|cc[- ]?zero|cc[- ]by[- ]\d|attribution (?:\d|license))/i;
const SA_NC_ND = /\b(sa|nc|nd)\b/i; // CC BY-SA / NC / ND: no se usan (obligan a compartir igual o prohíben uso comercial o cambios)
const TITULO_NO = /portrait|headshot|selfie|\bbust\b|logo|flag|coat of arms|diagram|\bmap\b|signature|stamp|banknote|screenshot|spectrogram|spectrum|waveform|chart|graph|plot|schematic|infographic|poster|cover|icon|sprite|vector|texture|pattern|figure|table|\bscan\b|\.svg|\.gif|\.pdf|\.tif|\.png/i;
const ESPACIO = /earth|moon|mars|planet|galaxy|\bsun\b|solar|nebula|space|astronaut|rocket|satellite|comet|asteroid|orbit|telescope|apollo|\biss\b|jupiter|saturn|venus|mercury|milky way|eclipse|aurora/i;
const POCO_VALOR = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'into', 'over', 'near', 'old', 'new', 'photo', 'photograph', 'image', 'picture', 'view', 'large', 'small', 'big']);
const MAX_BYTES = 800 * 1024;

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const pedir = async (url, tiempo = 20000) => {
  let r;
  for (let i = 1; i <= 3; i++) {
    r = await fetch(url, {headers: {'User-Agent': UA}, signal: AbortSignal.timeout(tiempo)});
    if (![429, 503].includes(r.status) || i === 3) return r;
    const pide = Number(r.headers.get('retry-after'));
    await dormir(Math.min(15000, (Number.isFinite(pide) && pide > 0 ? pide : 4 * i) * 1000));
  }
  return r;
};
const sinEtiquetas = (h) => String(h ?? '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
const palabrasDe = (t) => [...new Set(String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter((p) => p.length >= 3 && !POCO_VALOR.has(p)))];

/** ¿Qué tanto coincide la foto con lo buscado? Fracción de palabras de la búsqueda que aparecen en su título, descripción o categorías. */
export const puntuar = (candidata, consulta) => {
  const q = palabrasDe(consulta);
  if (!q.length) return 0;
  const heno = ` ${palabrasDe(`${candidata.titulo} ${candidata.descripcion ?? ''}`).join(' ')} `;
  return q.filter((p) => heno.includes(` ${p}`)).length / q.length; // " p" admite plural/derivados (shoe -> shoes)
};

const licenciaValida = (lic) => LICENCIA_OK.test(String(lic ?? '').trim()) && !SA_NC_ND.test(String(lic ?? '').replace(/^cc[- ]by/i, 'cc-by'));

/** Candidatas de Wikimedia Commons (solo JPEG: los PNG casi siempre son diagramas). */
export const buscarEnCommons = async (consulta) => {
  const q = new URLSearchParams({
    action: 'query', format: 'json', generator: 'search', gsrnamespace: '6', gsrlimit: '20',
    gsrsearch: `${consulta} filetype:bitmap`, prop: 'imageinfo', iiprop: 'url|extmetadata|size|mime', iiurlwidth: '640',
  });
  const r = await pedir(`https://commons.wikimedia.org/w/api.php?${q}`);
  if (!r.ok) return [];
  const j = await r.json();
  const salida = [];
  for (const p of Object.values(j.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0))) {
    const i = p.imageinfo?.[0];
    if (!i?.thumburl || !/^image\/jpeg$/.test(i.mime ?? '')) continue;
    const lic = String(i.extmetadata?.LicenseShortName?.value ?? '');
    if (!licenciaValida(lic) || TITULO_NO.test(p.title ?? '')) continue;
    if ((i.width ?? 0) < 500 || (i.height ?? 0) < 300) continue;
    salida.push({
      url: i.thumburl, titulo: String(p.title).replace(/^File:/, ''), licencia: lic, autor: sinEtiquetas(i.extmetadata?.Artist?.value).slice(0, 60),
      descripcion: `${sinEtiquetas(i.extmetadata?.ImageDescription?.value)} ${sinEtiquetas(i.extmetadata?.Categories?.value)}`.slice(0, 400),
      pagina: i.descriptionurl, fuente: 'Wikimedia Commons',
    });
  }
  return salida;
};

/** Candidatas de Openverse (CC0, dominio público y CC BY). */
export const buscarEnOpenverse = async (consulta) => {
  const q = new URLSearchParams({q: consulta, page_size: '20', license: 'cc0,pdm,by'});
  const r = await pedir(`https://api.openverse.org/v1/images/?${q}`);
  if (!r.ok) return [];
  const salida = [];
  for (const x of (await r.json()).results ?? []) {
    if (!x.thumbnail || TITULO_NO.test(x.title ?? '') || String(x.filetype ?? '').toLowerCase() === 'png') continue;
    if (/portrait|retrato|selfie/i.test((x.tags ?? []).map((t) => t.name).join(' '))) continue;
    if ((x.width ?? 0) < 500 || (x.height ?? 0) < 300) continue;
    const lic = String(x.license ?? '').toLowerCase();
    salida.push({
      url: x.thumbnail, titulo: String(x.title ?? 'sin título').slice(0, 100), licencia: lic === 'pdm' ? 'Public domain' : lic === 'by' ? 'CC BY' : 'CC0',
      autor: String(x.creator ?? '').slice(0, 60), descripcion: (x.tags ?? []).map((t) => t.name).join(' ').slice(0, 300), pagina: x.foreign_landing_url, fuente: x.source ? `Openverse/${x.source}` : 'Openverse',
    });
  }
  return salida;
};

/** Candidatas de la NASA (dominio público): planetas, Tierra, espacio, cohetes. */
export const buscarEnNasa = async (consulta) => {
  const q = new URLSearchParams({q: consulta, media_type: 'image', page_size: '15'});
  const r = await pedir(`https://images-api.nasa.gov/search?${q}`);
  if (!r.ok) return [];
  const salida = [];
  for (const it of (await r.json()).collection?.items ?? []) {
    const d = it.data?.[0];
    const href = it.links?.find((l) => l.render === 'image' || /\.jpg$/i.test(l.href ?? ''))?.href;
    if (!d || !href || TITULO_NO.test(d.title ?? '')) continue;
    salida.push({url: href, titulo: String(d.title).slice(0, 100), licencia: 'Public domain (NASA)', autor: 'NASA', descripcion: `${d.description ?? ''} ${(d.keywords ?? []).join(' ')}`.slice(0, 400), pagina: `https://images.nasa.gov/details/${d.nasa_id}`, fuente: 'NASA'});
  }
  return salida;
};

/** Mejores candidatas para una búsqueda, de varias fuentes, ordenadas por parecido. Excluye las ya usadas (`usadas`: Set de URLs y páginas). */
export const buscarCandidatas = async (consulta, usadas = new Set(), necesarias = 2) => {
  const fuentes = [buscarEnCommons, buscarEnOpenverse, ...(ESPACIO.test(consulta) ? [buscarEnNasa] : [])];
  const buenas = [];
  for (const f of fuentes) {
    try {
      for (const c of await f(consulta)) {
        if (usadas.has(c.url) || usadas.has(c.pagina)) continue;
        const punto = puntuar(c, consulta);
        if (punto >= 0.34) buenas.push({...c, punto});
      }
    } catch { /* una fuente que falla no detiene a las demás */ }
    if (buenas.length >= necesarias * 2) break;
    await dormir(900);
  }
  return buenas.sort((a, b) => b.punto - a.punto);
};

const descargar = async (url, destino) => {
  const r = await pedir(url, 30000);
  if (!r.ok) throw new Error('descarga ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 3000 || buf.length > MAX_BYTES) throw new Error('tamaño raro: ' + buf.length);
  if (!buf.subarray(0, 4).toString('hex').startsWith('ffd8ff')) throw new Error('no es una foto JPEG');
  fs.writeFileSync(destino, buf);
};

/** Registro de fotos ya usadas en videos anteriores (para no reciclar). */
export const leerUsadas = (canal = 'lqns') => {
  try { return new Set(JSON.parse(fs.readFileSync(path.join('oficina-salida', canal, 'fotos-usadas.json'), 'utf8')).urls ?? []); } catch { return new Set(); }
};
export const guardarUsadas = (canal, usadas) => {
  try {
    fs.mkdirSync(path.join('oficina-salida', canal), {recursive: true});
    fs.writeFileSync(path.join('oficina-salida', canal, 'fotos-usadas.json'), JSON.stringify({urls: [...usadas].slice(-600)}, null, 2));
  } catch { /* sin carpeta */ }
};

/**
 * Para cada escena: el modelo propone hasta 4 CONCEPTOS concretos y fotografiables que la frase menciona (el sujeto principal primero),
 * se buscan fotos reales de cada uno y se bajan hasta 2 por escena. Devuelve {indice: {fotos: [{archivo, titulo, licencia, autor, pagina, fuente, consulta}]}}.
 */
export const reunirFotos = async ({llamar, escenas, indices, slug, tema, canal = 'lqns', limiteMs = 200000, nota = () => {}}) => {
  const salida = {};
  const usadas = leerUsadas(canal);
  const dir = path.resolve('public', 'referencias');
  try {
    fs.mkdirSync(dir, {recursive: true});
    const lista = indices.map((i) => `${i}. ${String(escenas[i].texto).slice(0, 240)}`).join('\n');
    const r = await llamar([
      {role: 'system', content: 'Eres un documentalista gráfico: encuentras la foto exacta de lo que se dice. Responde SOLO con JSON.'},
      {role: 'user', content: `Tema del video: "${tema}".\nPara CADA escena da hasta 4 búsquedas EN INGLÉS (una por cada cosa distinta que se nombra, en el orden en que se nombra) (2 a 4 palabras) de COSAS CONCRETAS Y FOTOGRAFIABLES que la frase menciona o muestra: un objeto (tennis shoe, gallon jug), un lugar (Boston harbor), un animal, un edificio, un fenómeno (volcano eruption), un planeta (planet Earth). La PRIMERA debe ser el sujeto principal de la frase. Nada abstracto ni cifras ni nombres de personas. Si la frase es solo una pregunta u opinión, da la mejor imagen del tema del video.\n\nESCENAS:\n${lista}\n\nDevuelve {"escenas": [{"indice": N, "consultas": ["...", "...", "..."]}]}`},
    ], 1400);
    const tope = Date.now() + limiteMs;
    for (const e of (Array.isArray(r?.escenas) ? r.escenas : []).slice(0, 40)) {
      const i = Number(e.indice);
      if (!indices.includes(i)) continue;
      const consultas = (Array.isArray(e.consultas) ? e.consultas : []).map((c) => String(c ?? '').trim().slice(0, 60)).filter((c) => c.length >= 3).slice(0, 4);
      const fotos = [];
      for (const q of consultas) {
        if (fotos.length >= 4) break;
        if (Date.now() > tope) { nota('(Fotos: se acabó el tiempo asignado; el resto de escenas usa a los pintores.)'); return salida; }
        const candidatas = await buscarCandidatas(q, usadas, 1);
        const meta = fotos.length + (consultas.length === 1 ? 2 : 1); // una foto por cada cosa nombrada (2 si solo hay una)
        for (const c of candidatas) {
          if (fotos.length >= meta) break;
          const archivo = `${slug}-${i}-${fotos.length + 1}.jpg`;
          try {
            await descargar(c.url, path.join(dir, archivo));
            usadas.add(c.url); usadas.add(c.pagina);
            fotos.push({archivo, titulo: c.titulo, licencia: c.licencia, autor: c.autor, pagina: c.pagina, fuente: c.fuente, consulta: q});
          } catch (er) { nota(`(Foto de la escena ${i} "${q}": ${String(er.message ?? er).slice(0, 60)})`); }
        }
      }
      if (fotos.length) salida[i] = {fotos};
    }
  } catch (e) { nota(`(Sin fotos de internet: ${String(e.message ?? e).slice(0, 100)})`); }
  guardarUsadas(canal, usadas);
  return salida;
};

/** Créditos de las fotos con licencia que los pide (CC BY), para la descripción del video. */
export const creditosDe = (porEscena) => {
  const lista = [];
  for (const e of Object.values(porEscena ?? {})) for (const f of e.fotos ?? []) if (/cc[- ]by/i.test(f.licencia ?? '') && f.autor) lista.push(`${f.autor} (${f.licencia}, ${f.fuente})`);
  const unicos = [...new Set(lista)];
  return unicos.length ? `Fotos: ${unicos.slice(0, 6).join(' · ')}` : '';
};
