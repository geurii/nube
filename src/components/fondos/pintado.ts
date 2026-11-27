// Motor de "escenas pintadas": convierte una descripción simple (JSON que escribe el Pintor de la oficina) en pixel art con el mismo
// motor de los pingüinos (clase G): degradados con tramado, sombreado por luz y movimiento suave. Coordenadas normalizadas 0..1.
import {G, bay, hex, hs, type RGB} from './pixelG';
import {dibujarPro, type Pro} from './pintadoPro';

export type Elemento = {t: string} & Record<string, unknown>;
export type EscenaPintada = {cielo: string[]; capas: Elemento[]; /** fondo de pixel art ya hecho (public/escenarios/<id>.png) */ escenario?: string};

/** Fotos de referencia ya cargadas (las rellena PixelPintado antes de dibujar): nombre de archivo -> píxeles. */
export const IMAGENES = new Map<string, {w: number; h: number; d: Uint8ClampedArray}>();

const num = (v: unknown, d: number, a = 0, b = 1) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : d;
};
const col = (v: unknown, d = '#808080'): RGB => hex(typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : d);
const rampa = (v: unknown, d: string[]): RGB[] => {
  const l = Array.isArray(v) ? v.filter((x) => typeof x === 'string' && /^#[0-9a-fA-F]{6}$/.test(x)) : [];
  return (l.length >= 2 ? l : d).slice(0, 6).map((x) => hex(x));
};

/** altura de montaña en la columna x (0..1): suma de ondas, determinista por semilla */
const relieve = (x: number, semilla: number, picos: number) => {
  const s = semilla * 1.7;
  const a = Math.abs(Math.sin(x * picos * 3.1 + s));
  const b = Math.abs(Math.sin(x * picos * 7.3 + s * 2.3)) * 0.45;
  const c = Math.abs(Math.sin(x * picos * 15.7 + s * 3.1)) * 0.18;
  return Math.min(1, (a + b + c) / 1.63);
};

export function pintar(g: G, esc: EscenaPintada, t: number, lw: number, lh: number, u: number) {
  g.contorno = null;
  g.grad(0, lh, rampa(esc.cielo, ['#0b1030', '#233a7a', '#e07a5f']));
  if (esc.escenario) {
    // escenario de pixel art libre (CC0): escala entera (píxeles uniformes), cubre todo el cuadro y se desliza despacio de lado a lado
    const im = IMAGENES.get(`escenarios/${esc.escenario}`);
    if (im) {
      const s = Math.max(1, Math.ceil(Math.max(lw / im.w, lh / im.h)));
      const holgura = Math.max(0, im.w - lw / s), vertical = Math.max(0, im.h - lh / s);
      const ox = holgura * (0.5 + 0.5 * Math.sin(t * 0.25)), oy = vertical;
      for (let y = 0; y < lh; y++) {
        const sy = Math.min(im.h - 1, Math.floor(oy + y / s));
        for (let x = 0; x < lw; x++) {
          const sx = Math.min(im.w - 1, Math.floor(ox + x / s));
          const i = (sy * im.w + sx) * 4;
          if (im.d[i + 3] < 128) continue;
          g.set(x, y, [im.d[i], im.d[i + 1], im.d[i + 2]]);
        }
      }
    }
  }
  for (const e of esc.capas.slice(0, 22)) {
    switch (e.t) {
      case 'estrellas': {
        const n = Math.round(num(e.n, 60, 5, 160));
        for (let i = 0; i < n; i++) {
          const x = hs(i, 3) * lw;
          const y = hs(i, 9) * lh * num(e.hasta, 0.6, 0.1, 1);
          const brillo = 0.5 + 0.5 * Math.sin(t * (1 + hs(i, 5) * 3) + i);
          if (brillo > 0.35) g.set(x, y, hs(i, 7) > 0.85 ? [255, 240, 190] : [220, 225, 255]);
          if (hs(i, 11) > 0.93 && brillo > 0.7) { g.set(x + 1, y, [200, 210, 255], 0.6); g.set(x - 1, y, [200, 210, 255], 0.6); g.set(x, y + 1, [200, 210, 255], 0.6); g.set(x, y - 1, [200, 210, 255], 0.6); }
        }
        break;
      }
      case 'astro': {
        const cx = num(e.x, 0.5) * lw, cy = num(e.y, 0.2) * lh, r = num(e.r, 0.08, 0.02, 0.3) * Math.min(lw, lh) * 1.6;
        const col4 = rampa(e.rampa, ['#8d8f9c', '#c9ccd8', '#f1f2f7', '#ffffff']);
        for (let k = 3; k >= 1; k--) g.ellA(cx, cy, r + k * r * 0.35, r + k * r * 0.35, col4[col4.length - 2] ?? [255, 255, 255], 0.05);
        g.ellO(cx, cy, r, r, col4);
        break;
      }
      case 'resplandor': {
        const cx = num(e.x, 0.5) * lw, cy = num(e.y, 0.5) * lh, r = num(e.r, 0.3, 0.05, 0.9) * Math.min(lw, lh);
        const c = col(e.color, '#ffd27a');
        for (let k = 6; k >= 1; k--) g.ellA(cx, cy, (r * k) / 6, (r * k) / 6, c, 0.05 + (0.05 * (7 - k)) / 6 * num(e.fuerza, 1, 0.2, 2));
        break;
      }
      case 'montanas': {
        const base = num(e.y, 0.75) * lh, alto = num(e.alto, 0.3, 0.05, 0.7) * lh;
        const r = rampa(e.rampa, ['#1a1c3a', '#2b2f5e', '#41468a']);
        const semilla = num(e.semilla, 1, 0, 999), picos = num(e.picos, 3, 1, 8);
        for (let x = 0; x < lw; x++) {
          const h = relieve(x / lw, semilla, picos) * alto;
          const y0 = base - h;
          for (let y = Math.floor(y0); y < Math.ceil(base); y++) {
            const q = (y - y0) / Math.max(1, base - y0);
            const luz = x % 9 < 4 ? 0.12 : 0;
            const v = Math.min(r.length - 1.01, (1 - q) * (r.length - 1) * 0.35 + q * (r.length - 1) * 0.65 - luz * 0);
            const i = Math.max(0, Math.floor(v));
            g.set(x, y, v - i > bay(x, y) ? r[i + 1] ?? r[i] : r[i]);
          }
          g.set(x, y0, r[r.length - 1]);
        }
        break;
      }
      case 'suelo': {
        const y = num(e.y, 0.85) * lh;
        const r = rampa(e.rampa, ['#2a2418', '#3b3222', '#4d422c']);
        g.grad(y, lh, r);
        for (let i = 0; i < 40; i++) g.set(hs(i, 21) * lw, y + hs(i, 22) * (lh - y), r[r.length - 1], 0.7);
        break;
      }
      case 'agua': {
        const y = num(e.y, 0.8) * lh;
        const r = rampa(e.rampa, ['#0e2a4d', '#17497a', '#2a74a8']);
        g.grad(y, lh, r);
        for (let i = 0; i < 90; i++) {
          const yy = y + hs(i, 31) * (lh - y);
          const xx = (hs(i, 32) * lw + Math.sin(t * 1.2 + i) * 6 + lw) % lw;
          g.rect(xx, yy, 4 + hs(i, 33) * 10, 1, [210, 230, 255], 0.35 * (0.5 + 0.5 * Math.sin(t * 2 + i)));
        }
        break;
      }
      case 'niebla': {
        const y = num(e.y, 0.7) * lh, alto = num(e.alto, 0.15, 0.03, 0.6) * lh;
        const c = col(e.color, '#cfd8ee');
        const a = num(e.alpha, 0.25, 0.05, 0.7);
        for (let yy = Math.floor(y); yy < y + alto; yy++) {
          const k = 1 - Math.abs((yy - y) / alto - 0.5) * 2;
          for (let x = 0; x < lw; x += 2) {
            const n = 0.5 + 0.5 * Math.sin(x * 0.02 + t * 0.6 + yy * 0.05);
            if (n * k > 0.35 + bay(x, yy) * 0.3) g.rect(x, yy, 2, 1, c, a * k);
          }
        }
        break;
      }
      case 'arbol': {
        const x = num(e.x, 0.5) * lw, y = num(e.y, 0.9) * lh, h = num(e.h, 0.18, 0.04, 0.5) * lh;
        const r = rampa(e.rampa, ['#0e2a1f', '#17402f', '#245c43']);
        g.rect(x - 1.5 * u, y - h * 0.18, 3 * u, h * 0.18, [58, 40, 26]);
        for (let k = 0; k < 4; k++) {
          const yy = y - h * 0.15 - (k * h * 0.8) / 4, w = (h * 0.45) * (1 - k * 0.2);
          for (let j = 0; j < h * 0.28; j++) {
            const ww = w * (1 - j / (h * 0.28));
            g.rect(x - ww / 2, yy - j, ww, 1, r[Math.min(r.length - 1, Math.floor((j / (h * 0.28)) * r.length))] ?? r[0]);
          }
        }
        break;
      }
      case 'edificio': {
        const x = num(e.x, 0.5) * lw, w = num(e.w, 0.14, 0.03, 0.6) * lw, h = num(e.h, 0.25, 0.05, 0.8) * lh, y = num(e.y, 0.85) * lh;
        const c = col(e.color, '#1d2140');
        g.rect(x - w / 2 - 1, y - h - 1, w + 2, h + 1, [6, 8, 18]);
        g.rect(x - w / 2, y - h, w, h, c);
        g.rect(x - w / 2, y - h, w * 0.18, h, [Math.min(255, c[0] + 18), Math.min(255, c[1] + 18), Math.min(255, c[2] + 24)]);
        if (e.ventanas !== false) {
          for (let wy = y - h + 6; wy < y - 8; wy += 9) for (let wx = x - w / 2 + 5; wx < x + w / 2 - 5; wx += 8) {
            const enc = hs(Math.floor(wx), Math.floor(wy)) > 0.55 && 0.6 + 0.4 * Math.sin(t * 0.7 + wx) > 0.1;
            g.rect(wx, wy, 3, 4, enc ? [255, 214, 120] : [24, 28, 52]);
          }
        }
        break;
      }
      case 'circulo': {
        const cx = num(e.x, 0.5) * lw, cy = num(e.y, 0.5) * lh, r = num(e.r, 0.08, 0.01, 0.5) * Math.min(lw, lh) * 1.6;
        g.ellO(cx, cy, r, r * num(e.alto, 1, 0.2, 2), rampa(e.rampa, ['#3a2a1a', '#6b4b2a', '#a8793f', '#d9ab63']));
        break;
      }
      case 'rect': {
        const x = num(e.x, 0.3) * lw, y = num(e.y, 0.5) * lh, w = num(e.w, 0.2, 0.01, 1) * lw, h = num(e.h, 0.1, 0.01, 1) * lh;
        const c = col(e.color, '#5a4a3a');
        g.rect(x - 1, y - 1, w + 2, h + 2, [8, 10, 20]);
        g.rect(x, y, w, h, c);
        g.rect(x, y, w, Math.max(1, h * 0.12), [Math.min(255, c[0] + 30), Math.min(255, c[1] + 30), Math.min(255, c[2] + 30)]);
        break;
      }
      case 'pergamino': {
        const x = num(e.x, 0.15) * lw, y = num(e.y, 0.25) * lh, w = num(e.w, 0.7, 0.1, 1) * lw, h = num(e.h, 0.45, 0.1, 0.9) * lh;
        g.rect(x - 2, y - 2, w + 4, h + 4, [30, 20, 10]);
        g.rect(x, y, w, h, [222, 196, 148]);
        g.rect(x, y, w, h * 0.06, [184, 150, 98]);
        g.rect(x, y + h * 0.94, w, h * 0.06, [184, 150, 98]);
        const filas = Math.round(num(e.lineas, 12, 3, 30));
        for (let i = 0; i < filas; i++) {
          const yy = y + h * 0.1 + (i * h * 0.78) / filas;
          let xx = x + w * 0.08;
          while (xx < x + w * 0.92) { const ww = 3 + hs(i * 31 + Math.floor(xx), 4) * 12; g.rect(xx, yy, ww, 2, [78, 52, 30], 0.85); xx += ww + 3; }
        }
        if (e.simbolos !== false) for (let i = 0; i < 6; i++) g.ring(x + w * (0.2 + hs(i, 51) * 0.6), y + h * (0.2 + hs(i, 52) * 0.6), 4 + hs(i, 53) * 6, 1, [120, 40, 40]);
        break;
      }
      case 'foto': {
        // Foto real de licencia libre leida como pixeles y dibujada en bloques: pixel art del sujeto de verdad.
        // Formato que escribe el Pintor: {t:'foto', archivo, x0, y0, x1, y1, zoom, pan}. Tambien admite x/y/w/h.
        const archivo = String(e.archivo ?? '').replace(/[^a-z0-9._-]/gi, '');
        const im = archivo ? IMAGENES.get(archivo) : undefined;
        if (!im || !im.w || !im.h) break;
        const tieneCaja = e.x0 !== undefined || e.x1 !== undefined;
        const ax = tieneCaja ? num(e.x0, 0) : num(e.x, 0.5) - num(e.w, 1, 0.05, 1) / 2;
        const ay = tieneCaja ? num(e.y0, 0) : num(e.y, 0.5) - num(e.h, 1, 0.05, 1) / 2;
        const bx = tieneCaja ? num(e.x1, 1) : ax + num(e.w, 1, 0.05, 1);
        const by = tieneCaja ? num(e.y1, 1) : ay + num(e.h, 1, 0.05, 1);
        const x0 = Math.round(Math.min(ax, bx) * lw);
        const y0 = Math.round(Math.min(ay, by) * lh);
        const w = Math.max(8, Math.round(Math.abs(bx - ax) * lw));
        const h = Math.max(8, Math.round(Math.abs(by - ay) * lh));
        const paso = Math.max(1, Math.round(num(e.pixel, 3, 1, 8)));
        const zoom = num(e.zoom, 1, 1, 2.5);
        // recorte que cubre la caja (sin deformar la foto), con deriva lenta si el Pintor pidio pan
        const s = Math.max(w / im.w, h / im.h) * zoom;
        const vw = Math.min(im.w, w / s), vh = Math.min(im.h, h / s);
        const vaivén = e.pan === false ? 0.5 : 0.5 + 0.35 * Math.sin(t * 0.22);
        const ox = Math.max(0, Math.min(im.w - vw, (im.w - vw) * vaivén));
        const oy = Math.max(0, Math.min(im.h - vh, (im.h - vh) * 0.4));
        // LA IMAGEN SE MUEVE POR DENTRO, no solo la camara:
        //  - onda: las filas de abajo (agua, lava, multitud) se desplazan con una ola lenta
        //  - cielo: las filas de arriba (nubes, humo) se arrastran de lado
        //  - latido: el brillo sube y baja muy poco, como una lampara o un fuego vivo
        const ondaDesde = num(e.onda, 0.72, 0, 1);      // a partir de que altura empieza el vaiven
        const ondaFuerza = num(e.ondaFuerza, 3, 0, 12); // en pixeles del lienzo
        const cieloHasta = num(e.cielo, 0.42, 0, 1);    // hasta que altura se arrastra el cielo
        const cieloFuerza = num(e.cieloFuerza, 2.2, 0, 10);
        const latido = num(e.latido, 0.05, 0, 0.4);
        const brillo = 1 + latido * Math.sin(t * 1.7);
        for (let y = 0; y < h; y += paso) {
          const py = y / h;
          let desvio = 0;
          if (py >= ondaDesde) {
            const prof = (py - ondaDesde) / Math.max(0.001, 1 - ondaDesde);
            desvio += Math.sin(t * 1.25 + py * 14) * ondaFuerza * prof;
          }
          if (py <= cieloHasta) {
            const prof = 1 - py / Math.max(0.001, cieloHasta);
            desvio += Math.sin(t * 0.28) * cieloFuerza * prof + t * 0.9 * prof;
          }
          const sy = Math.min(im.h - 1, Math.floor(oy + py * vh));
          for (let x = 0; x < w; x += paso) {
            let mx = ox + ((x + desvio) / w) * vw;
            // se envuelve dentro de la ventana para que el borde no quede vacio
            while (mx < ox) mx += vw;
            while (mx >= ox + vw) mx -= vw;
            const sx = Math.min(im.w - 1, Math.floor(mx));
            const k = (sy * im.w + sx) * 4;
            if (im.d[k + 3] < 128) continue;
            const c: RGB = brillo === 1
              ? [im.d[k], im.d[k + 1], im.d[k + 2]]
              : [Math.min(255, im.d[k] * brillo), Math.min(255, im.d[k + 1] * brillo), Math.min(255, im.d[k + 2] * brillo)];
            g.rect(x0 + x, y0 + y, paso, paso, c);
          }
        }
        break;
      }
      case 'texto': {
        const s = String(e.s ?? '').slice(0, 22).toUpperCase().replace(/[^A-Z0-9ÁÉÍÓÚÑ ?!.,:%$¿¡-]/g, '');
        if (s) g.txt(s, num(e.x, 0.5) * lw, num(e.y, 0.5) * lh, Math.round(num(e.tam, 18, 10, 40)), typeof e.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(e.color) ? e.color : '#ffffff', '#000');
        break;
      }
      default:
        try { dibujarPro(g, e as Pro, t, lw, lh, u); } catch { /* una forma mal descrita se omite sin romper el render */ }
        break;
    }
  }
  // viñeta suave: profundidad
  for (let y = 0; y < lh; y += 2) for (let x = 0; x < lw; x += 2) {
    const d = Math.hypot((x / lw - 0.5) * 1.1, (y / lh - 0.5) * 0.9);
    if (d > 0.55 && bay(x, y) < (d - 0.55) * 1.4) g.rect(x, y, 2, 2, [0, 0, 10], 0.45);
  }
}
