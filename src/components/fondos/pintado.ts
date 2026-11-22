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
        // Foto de referencia de internet adaptada al pixelado: recorte tipo "cover", bloques de 2 px, paleta reducida con tramado y marco oscuro.
        const im = IMAGENES.get(String(e.archivo ?? ''));
        if (!im) break;
        const ancho = lw > lh; // horizontal (video largo) o vertical (Short)
        const x0 = Math.round(num(e.x0, ancho ? 0.2 : 0.06) * lw), y0 = Math.round(num(e.y0, ancho ? 0.14 : 0.3) * lh);
        const x1 = Math.round(num(e.x1, ancho ? 0.8 : 0.94) * lw), y1 = Math.round(num(e.y1, ancho ? 0.84 : 0.64) * lh);
        const bw = x1 - x0, bh = y1 - y0;
        if (bw < 8 || bh < 8) break;
        const zoom = num(e.zoom, 1, 1, 3);
        const s = Math.max(bw / im.w, bh / im.h) * zoom;
        const holguraX = Math.max(0, im.w - bw / s) / 2, holguraY = Math.max(0, im.h - bh / s) / 2;
        const mov = e.pan ? Math.sin(t * 0.35) : 0;
        const cx = im.w / 2 + mov * holguraX * 0.8, cy = im.h / 2 - mov * holguraY * 0.4;
        const NIV = 7, B = 2;
        g.rect(x0 - 2, y0 - 2, bw + 4, bh + 4, [8, 10, 20]);
        const muestra = (fx: number, fy: number): [number, number, number] => {
          const sx = Math.min(im.w - 1, Math.max(0, Math.floor(fx))), sy = Math.min(im.h - 1, Math.max(0, Math.floor(fy)));
          const i = (sy * im.w + sx) * 4;
          return [im.d[i], im.d[i + 1], im.d[i + 2]];
        };
        for (let py = 0; py < bh; py += B) {
          for (let px = 0; px < bw; px += B) {
            const fx = cx + (px + B / 2 - bw / 2) / s, fy = cy + (py + B / 2 - bh / 2) / s, k = 0.5 / s;
            const m = [muestra(fx - k, fy - k), muestra(fx + k, fy - k), muestra(fx - k, fy + k), muestra(fx + k, fy + k)]; // promedio de 4 puntos: menos ruido
            let r = (m[0][0] + m[1][0] + m[2][0] + m[3][0]) / 4, gg = (m[0][1] + m[1][1] + m[2][1] + m[3][1]) / 4, bb = (m[0][2] + m[1][2] + m[2][2] + m[3][2]) / 4;
            const lum = 0.3 * r + 0.59 * gg + 0.11 * bb;
            if (Math.max(r, gg, bb) - Math.min(r, gg, bb) < 18) { r = lum * 1.06; gg = lum * 0.97; bb = lum * 0.82; } // foto en blanco y negro: tono sepia de archivo
            const d = bay(px / B, py / B) - 0.5;
            const q = (v: number) => Math.max(0, Math.min(255, Math.round(((v / 255) * (NIV - 1)) + d * 0.55) / (NIV - 1) * 255));
            g.rect(x0 + px, y0 + py, B, B, [q(r), q(gg), q(bb)]);
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
