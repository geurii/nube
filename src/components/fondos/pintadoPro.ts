// Formas de pixel art "profesional" para las escenas pintadas (se suman a las de pintado.ts, que siguen igual).
// Mecánica de los maestros del pixel art, hecha código:
//  - rampas de 5 tonos con cambio de matiz (sombras hacia azul/violeta, luces hacia amarillo) en vez de solo oscurecer;
//  - una sola fuente de luz (arriba-izquierda) y tramado ordenado SOLO en la transición entre tonos;
//  - contorno selectivo: borde oscuro del color propio (más claro del lado de la luz), no negro puro;
//  - siluetas legibles, capas con perspectiva atmosférica (lo lejano más claro y frío) y movimiento suave.
import {G, bay, hs, type RGB} from './pixelG';

export type Pro = {t: string} & Record<string, unknown>;

const num = (v: unknown, d: number, a = 0, b = 1) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : d;
};
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const hex = (s: string): RGB => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const esHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
const col = (v: unknown, d: string): RGB => hex(esHex(v) ? v : d);

const rgb2hsl = ([r, g, b]: RGB): [number, number, number] => {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
};
const hsl2rgb = (h: number, s: number, l: number): RGB => {
  const f = (p: number, q: number, t: number) => {
    t = ((t % 1) + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  return [f(p, q, h + 1 / 3) * 255, f(p, q, h) * 255, f(p, q, h - 1 / 3) * 255];
};
const mixHue = (a: number, b: number, w: number) => {
  let d = b - a;
  if (d > 0.5) d -= 1;
  if (d < -0.5) d += 1;
  return a + d * w;
};

/** Rampa de n tonos (oscuro → claro) con cambio de matiz: sombras frías, luces cálidas. */
export const rampaDe = (c: RGB, n = 5): RGB[] => {
  const [h0, s0, l0] = rgb2hsl(c);
  const out: RGB[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const l = clamp(l0 + (t - 0.5) * 0.62, 0.07, 0.95);
    let h = h0;
    if (t < 0.5) h = mixHue(h, 0.68, (0.5 - t) * 0.5);
    else h = mixHue(h, 0.12, (t - 0.5) * 0.45);
    const s = clamp(s0 * (0.8 + 0.35 * (1 - Math.abs(t - 0.5) * 2)), 0, 1);
    out.push(hsl2rgb(h, s, l));
  }
  return out;
};
const oscuro = (r: RGB[]): RGB => [Math.round(r[0][0] * 0.55), Math.round(r[0][1] * 0.55), Math.round(r[0][2] * 0.7)];
const rampaDeE = (e: Pro, d: string, n = 5): RGB[] => {
  const l = Array.isArray(e.rampa) ? (e.rampa as unknown[]).filter(esHex) : [];
  if (l.length >= 3) return (l as string[]).slice(0, 6).map(hex);
  return rampaDe(col(e.color, d), n);
};

type Pt = [number, number];
const dentro = (pts: Pt[], x: number, y: number) => {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
const rot = (p: Pt, cx: number, cy: number, a: number): Pt => {
  const dx = p[0] - cx, dy = p[1] - cy, c = Math.cos(a), s = Math.sin(a);
  return [cx + dx * c - dy * s, cy + dx * s + dy * c];
};

/** Relleno de polígono con sombreado por luz, tramado entre tonos y contorno selectivo. */
export const poligono = (g: G, pts: Pt[], r: RGB[], luz = 'izq', borde = true) => {
  if (pts.length < 3) return;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  x0 = Math.max(0, Math.floor(x0) - 1); y0 = Math.max(0, Math.floor(y0) - 1); x1 = Math.min(g.w - 1, Math.ceil(x1) + 1); y1 = Math.min(g.h - 1, Math.ceil(y1) + 1);
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  if (w < 1 || h < 1 || w * h > 700000) return;
  const m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (dentro(pts, x0 + x + 0.5, y0 + y + 0.5)) m[y * w + x] = 1;
  const n = r.length;
  const o = oscuro(r);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!m[y * w + x]) continue;
    const fx = x / w, fy = y / h;
    const lit = luz === 'izq' ? 1 - (fx * 0.55 + fy * 0.45) : luz === 'der' ? 1 - ((1 - fx) * 0.55 + fy * 0.45) : 1 - fy;
    const v = clamp(lit, 0, 0.999) * (n - 1);
    const i = Math.floor(v);
    g.set(x0 + x, y0 + y, v - i > bay(x0 + x, y0 + y) ? r[i + 1] : r[i]);
  }
  if (!borde) return;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!m[y * w + x]) continue;
    const arr = y === 0 || !m[(y - 1) * w + x], izq = x === 0 || !m[y * w + x - 1];
    const abj = y === h - 1 || !m[(y + 1) * w + x], der = x === w - 1 || !m[y * w + x + 1];
    if (arr || izq || abj || der) g.set(x0 + x, y0 + y, (arr || izq) && luz !== 'der' ? r[1] : o);
  }
};

const poli = (g: G, pts: Pt[], r: RGB[], luz?: string, borde?: boolean) => poligono(g, pts, r, luz, borde);

/** Dibuja una forma "pro". Devuelve true si el tipo existe (aunque no haya dibujado nada). */
export function dibujarPro(g: G, e: Pro, t: number, lw: number, lh: number, u: number): boolean {
  const S = Math.min(lw, lh);
  const X = (v: unknown, d = 0.5) => num(v, d) * lw;
  const Y = (v: unknown, d = 0.5) => num(v, d) * lh;
  const luz = ['izq', 'der', 'arriba'].includes(String(e.luz)) ? String(e.luz) : 'izq';
  switch (e.t) {
    case 'poligono': {
      const pts = (Array.isArray(e.pts) ? e.pts : []).slice(0, 40).map((p) => [num((p as number[])[0], 0.5) * lw, num((p as number[])[1], 0.5) * lh] as Pt);
      poli(g, pts, rampaDeE(e, '#7a6a5a'), luz, e.borde !== false);
      return true;
    }
    case 'linea': {
      const pts = (Array.isArray(e.pts) ? e.pts : []).slice(0, 40).map((p) => [num((p as number[])[0], 0.5) * lw, num((p as number[])[1], 0.5) * lh] as Pt);
      const c = col(e.color, '#2a2a2a'), th = Math.max(1, Math.round(num(e.grosor, 0.006, 0.001, 0.05) * S));
      for (let i = 1; i < pts.length; i++) g.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], c, th);
      return true;
    }
    case 'nubes': {
      const r = rampaDeE(e, '#aab6d8');
      const n = Math.round(num(e.n, 4, 1, 10));
      for (let i = 0; i < n; i++) {
        const cx = ((hs(i, 1) * 1.3 + t * 0.012 * (0.5 + hs(i, 2))) % 1.3 - 0.15) * lw;
        const cy = Y(e.y, 0.18) + (hs(i, 3) - 0.5) * 0.09 * lh;
        const w = (0.1 + hs(i, 4) * 0.14) * lw;
        for (let k = 0; k < 5; k++) g.ell(cx + (k - 2) * w * 0.28, cy - Math.sin(k * 0.9 + i) * w * 0.07, w * (0.28 + 0.1 * Math.sin(k + i)), w * 0.16, r);
      }
      return true;
    }
    case 'olas': {
      const base = Y(e.y, 0.72), alto = num(e.alto, 0.25, 0.05, 0.6) * lh;
      const r = rampaDeE(e, '#1d5a8a', 4);
      g.grad(base, base + alto, r.slice(0, Math.min(r.length, 4)).reverse());
      const filas = 9;
      for (let k = 0; k < filas; k++) {
        const yy = base + (k / filas) * alto, a = 0.8 + k * 0.45;
        for (let x = 0; x < lw; x++) {
          const yw = yy + Math.sin(x * 0.045 * (1 + k * 0.18) + t * (0.7 + k * 0.12) + k * 2) * a;
          const s = Math.sin(x * 0.045 * (1 + k * 0.18) + t * (0.7 + k * 0.12) + k * 2);
          g.set(x, yw, s > 0.78 && e.espuma !== false ? [235, 246, 255] : r[Math.min(r.length - 1, 2)], s > 0.78 ? 0.9 : 0.55);
        }
      }
      return true;
    }
    case 'particulas': {
      const tipo = String(e.tipo ?? 'polvo');
      const n = Math.round(num(e.n, 50, 5, 140));
      const c = col(e.color, tipo === 'brasas' ? '#ff9a3c' : tipo === 'burbujas' ? '#cfeaff' : '#e8ecff');
      for (let i = 0; i < n; i++) {
        const v = 0.02 + hs(i, 5) * 0.05;
        const dir = tipo === 'nieve' ? 1 : tipo === 'polvo' ? 0.15 : -1;
        const x = ((hs(i, 1) * lw + Math.sin(t * 0.8 + i) * 8) % lw + lw) % lw;
        const y = ((hs(i, 2) * lh + dir * t * v * lh) % lh + lh) % lh;
        const tw = 0.5 + 0.5 * Math.sin(t * 2 + i);
        if (tipo === 'burbujas') g.ring(x, y, 1.5 + hs(i, 6) * 3, 1, c);
        else g.set(x, y, c, 0.4 + 0.6 * tw);
      }
      return true;
    }
    case 'rayos': {
      const c = col(e.color, '#fff2c0'), a = num(e.alpha, 0.1, 0.03, 0.3);
      for (let k = 0; k < 5; k++) {
        const x0 = X(e.x, 0.3) + k * 0.1 * lw, ancho = (0.03 + 0.02 * hs(k, 8)) * lw;
        for (let y = 0; y < lh * 0.85; y++) g.rect(x0 + y * 0.32 + Math.sin(t * 0.5 + k) * 3, y, ancho * (0.7 + y / lh), 1, c, a * (1 - y / lh));
      }
      return true;
    }
    case 'barco': {
      const cx = X(e.x, 0.5), cy = Y(e.y, 0.72) + Math.sin(t * 1.3) * 2, w = num(e.w, 0.3, 0.08, 0.7) * lw, a = Math.sin(t * 1.1) * 0.04;
      const casco = rampaDeE({t: 'x', color: e.color}, '#5a3a22'), vela = rampaDe(col(e.vela, '#e8dcc0'));
      const P = (x: number, y: number) => rot([cx + x * w, cy + y * w], cx, cy, a);
      poli(g, [P(-0.5, 0), P(0.5, 0), P(0.38, 0.14), P(-0.4, 0.14)], casco);
      g.line(...rot([cx, cy - 0.02 * w], cx, cy, a), ...rot([cx, cy - 0.78 * w], cx, cy, a), casco[1], Math.max(2, 0.014 * w));
      poli(g, [P(0.02, -0.74), P(0.02, -0.08), P(0.44, -0.1)], vela, 'izq');
      poli(g, [P(-0.02, -0.7), P(-0.02, -0.08), P(-0.34, -0.1)], vela, 'izq');
      poli(g, [P(0.02, -0.78), P(0.16, -0.74), P(0.02, -0.7)], [[120, 20, 24], [170, 34, 36], [210, 60, 50]], 'izq', false);
      return true;
    }
    case 'pez': {
      const tipo = String(e.tipo ?? 'pez');
      const w = num(e.w, 0.25, 0.04, 0.9) * lw, dir = e.flip === true ? -1 : 1;
      const cx = X(e.x, 0.5) + Math.sin(t * 0.6) * 0.012 * lw, cy = Y(e.y, 0.6) + Math.sin(t * 0.9) * 0.006 * lh;
      const P = (x: number, y: number): Pt => [cx + x * w * dir, cy + y * w];
      const mov = Math.sin(t * 2.2) * 0.04;
      if (tipo === 'anguila') {
        const r = rampaDeE(e, '#2f4a3a'), n = 28, izq: Pt[] = [], der: Pt[] = [];
        for (let i = 0; i <= n; i++) {
          const q = i / n, px = cx + (q - 0.5) * w * dir, py = cy + Math.sin(q * 9 - t * 3) * w * 0.07 * (0.4 + q);
          const q2 = Math.min(1, q + 0.04), py2 = cy + Math.sin(q2 * 9 - t * 3) * w * 0.07 * (0.4 + q2);
          const dx = (q2 - q) * w * dir || 1, dy = py2 - py, len = Math.hypot(dx, dy) || 1;
          const anc = w * 0.035 * (q < 0.12 ? 0.6 + q * 3.5 : 1 - (q - 0.12) * 0.85);
          izq.push([px - (dy / len) * anc, py + (dx / len) * anc]);
          der.push([px + (dy / len) * anc, py - (dx / len) * anc]);
        }
        poli(g, [...izq, ...der.reverse()], r, 'arriba');
        const h0 = izq[0];
        g.rect(h0[0] + 1 * dir, h0[1] - 1, 2, 2, [250, 240, 200]);
      } else if (tipo === 'ballena' || tipo === 'tiburon') {
        const r = rampaDeE(e, tipo === 'ballena' ? '#35557a' : '#5c6b7c'), vientre = rampaDe(tipo === 'ballena' ? [150, 170, 195] : [200, 205, 210], 4);
        const lomo: Pt[] = [], panza: Pt[] = [];
        const N = 16;
        for (let i = 0; i <= N; i++) {
          const q = i / N, x = -0.5 + q * 0.92, env = Math.pow(Math.sin(Math.PI * Math.min(1, q * 0.95 + 0.04)), 0.75);
          const h1 = (tipo === 'ballena' ? 0.15 : 0.1) * env * (1 - q * 0.55), h2 = (tipo === 'ballena' ? 0.17 : 0.09) * env * (1 - q * 0.6);
          lomo.push(P(x, -h1 + mov * q)); panza.push(P(x, h2 + mov * q));
        }
        const cola: Pt[] = tipo === 'ballena'
          ? [P(0.4, mov), P(0.5, -0.04 + mov * 2), P(0.6, -0.17 - mov * 3), P(0.56, -0.03 + mov * 2), P(0.62, 0.15 + mov * 3), P(0.48, 0.03 + mov * 2), P(0.4, 0.04 + mov)]
          : [P(0.4, mov), P(0.52, -0.18 - mov * 3), P(0.5, 0 + mov), P(0.56, 0.14 + mov * 3), P(0.4, 0.03 + mov)];
        poli(g, [...lomo, ...panza.reverse()], r, 'arriba');
        poli(g, cola, r, 'izq');
        poli(g, [P(-0.12, 0.08), P(0.02, 0.2 + mov * 2), P(0.1, 0.1)], r, 'izq');
        if (tipo === 'tiburon') poli(g, [P(-0.08, -0.1), P(0.04, -0.3), P(0.12, -0.08)], r, 'izq');
        g.rect(...P(-0.4, -0.04), Math.max(2, 0.025 * w), Math.max(2, 0.025 * w), [8, 10, 20]);
        for (let k = 0; k < 6; k++) g.line(...P(-0.34 + k * 0.025, 0.06), ...P(-0.32 + k * 0.025, 0.11), vientre[1], 1);
      } else if (tipo === 'calamar') {
        const r = rampaDeE(e, '#a84a5a');
        poli(g, [P(-0.1, -0.5), P(0.12, -0.4), P(0.1, -0.1), P(-0.1, -0.1)], r, 'izq');
        for (let k = -2; k <= 2; k++) g.line(...P(k * 0.04, -0.1), ...P(k * 0.06 + Math.sin(t * 2 + k) * 0.05, 0.25), r[2], Math.max(1, 0.012 * w));
        g.ring(...P(-0.03, -0.14), 0.02 * w + 1, 1, [255, 240, 200]);
      } else {
        const r = rampaDeE(e, '#d98a3c');
        poli(g, [P(-0.5, 0), P(-0.2, -0.2), P(0.2, -0.15), P(0.38, 0), P(0.2, 0.15), P(-0.2, 0.2)], r, 'izq');
        poli(g, [P(0.36, 0), P(0.56, -0.18 + mov), P(0.56, 0.18 - mov)], r, 'izq');
        poli(g, [P(-0.1, -0.17), P(0.05, -0.3), P(0.12, -0.15)], r, 'izq');
        g.rect(...P(-0.38, -0.05), Math.max(2, 0.04 * w), Math.max(2, 0.04 * w), [10, 10, 20]);
      }
      return true;
    }
    case 'roca': {
      const cx = X(e.x, 0.5), cy = Y(e.y, 0.9), w = num(e.w, 0.2, 0.03, 0.8) * lw, h = num(e.h, 0.12, 0.02, 0.6) * lh, s = num(e.semilla, 1, 0, 99);
      const pts: Pt[] = [[cx - w / 2, cy]];
      const n = 8;
      for (let i = 0; i <= n; i++) {
        const q = i / n, a = Math.PI * (1 - q);
        pts.push([cx + Math.cos(a) * (w / 2) * (0.85 + 0.2 * hs(i, 3, s)), cy - Math.sin(a) * h * (0.7 + 0.4 * hs(i, 5, s))]);
      }
      pts.push([cx + w / 2, cy]);
      poli(g, pts, rampaDeE(e, '#6b6f7a'), luz);
      return true;
    }
    case 'hielo': {
      const cx = X(e.x, 0.5), cy = Y(e.y, 0.78), w = num(e.w, 0.3, 0.05, 0.9) * lw, h = num(e.h, 0.2, 0.03, 0.7) * lh;
      const r = rampaDeE(e, '#b9e3ff');
      poli(g, [[cx - w / 2, cy], [cx - w * 0.32, cy - h * 0.55], [cx - w * 0.18, cy - h * 0.4], [cx - w * 0.02, cy - h], [cx + w * 0.14, cy - h * 0.5], [cx + w * 0.3, cy - h * 0.7], [cx + w / 2, cy]], r, 'izq');
      g.rect(cx - w / 2, cy + 1, w, h * 0.12, r[0], 0.35);
      return true;
    }
    case 'duna': {
      const base = Y(e.y, 0.8), alto = num(e.alto, 0.12, 0.03, 0.4) * lh, s = num(e.semilla, 1, 0, 99);
      const r = rampaDeE(e, '#c9a063', 4);
      for (let x = 0; x < lw; x++) {
        const f = (xx: number) => base - (Math.sin(xx * 0.012 * (1 + (s % 3) * 0.3) + s) * 0.5 + 0.5) * alto - Math.sin(xx * 0.03 + s * 2) * alto * 0.12;
        const y0 = f(x), pend = f(x + 3) - f(x - 3);
        for (let y = Math.floor(y0); y < lh; y++) {
          const tono = pend > 0.2 ? 0 : pend < -0.2 ? 2 : 1;
          const k = clamp(tono + (y - y0) / (lh - y0 + 1) * 0.6 - 0.2, 0, r.length - 1.01), i = Math.floor(k);
          g.set(x, y, k - i > bay(x, y) ? r[i + 1] : r[i]);
        }
        g.set(x, y0, r[r.length - 1]);
      }
      return true;
    }
    case 'algas': {
      const n = Math.round(num(e.n, 10, 2, 40)), r = rampaDeE(e, '#2f7a4a');
      for (let i = 0; i < n; i++) {
        const bx = hs(i, 1) * lw, by = Y(e.y, 1), hh = (0.12 + hs(i, 2) * 0.22) * lh;
        let px = bx, py = by;
        for (let k = 1; k <= 14; k++) {
          const q = k / 14, nx = bx + Math.sin(t * 1.1 + i + q * 3) * 8 * q + Math.sin(i) * 6 * q, ny = by - q * hh;
          g.line(px, py, nx, ny, r[Math.min(r.length - 1, 1 + (k % 3 === 0 ? 1 : 0))], Math.max(1, 3 * (1 - q) + 1));
          px = nx; py = ny;
        }
      }
      return true;
    }
    case 'sargazo': {
      const base = Y(e.y, 0.74), n = Math.round(num(e.n, 40, 5, 120)), r = rampaDeE(e, '#7a7a2a');
      for (let i = 0; i < n; i++) {
        const x = ((hs(i, 1) * lw + t * 3 * (0.4 + hs(i, 2)) + lw) % lw), y = base + hs(i, 3) * 0.18 * lh + Math.sin(t + i) * 1.2;
        g.ellO(x, y, 3 + hs(i, 4) * 9, 1.6 + hs(i, 5) * 2.4, r);
        if (hs(i, 6) > 0.6) g.set(x + 2, y - 3, r[r.length - 1]);
      }
      return true;
    }
    case 'faro': {
      const cx = X(e.x, 0.3), cy = Y(e.y, 0.82), h = num(e.h, 0.34, 0.1, 0.7) * lh, w = h * 0.2;
      const blanco = rampaDe([230, 230, 235], 4), rojo = rampaDe([200, 50, 50], 4);
      const ang = Math.sin(t * 0.7) * 0.5;
      const topY = cy - h;
      for (let k = 0; k < 8; k++) {
        const a = k % 2 ? rojo : blanco, y0 = cy - (k / 8) * h, y1 = cy - ((k + 1) / 8) * h;
        const w0 = w * (1 - (k / 8) * 0.35), w1 = w * (1 - ((k + 1) / 8) * 0.35);
        poli(g, [[cx - w0 / 2, y0], [cx + w0 / 2, y0], [cx + w1 / 2, y1], [cx - w1 / 2, y1]], a, 'izq', false);
      }
      g.rect(cx - w * 0.5, topY - w * 0.5, w, w * 0.5, [255, 230, 140]);
      for (let k = 1; k <= 3; k++) g.ellA(cx, topY - w * 0.25, w * k * 0.9, w * k * 0.9, [255, 230, 140], 0.07);
      for (let s = -1; s <= 1; s += 2) for (let y = 0; y < lh * 0.3; y++) g.rect(cx + s * (w * 0.4 + y * (1.6 + ang * s)), topY - w * 0.25 + y * 0.12, 2 + y * 0.35, 1, [255, 240, 170], 0.1 * (1 - y / (lh * 0.3)));
      return true;
    }
    case 'silueta': {
      const cx = X(e.x, 0.5), cy = Y(e.y, 0.8), h = num(e.h, 0.22, 0.05, 0.7) * lh, c = col(e.color, '#10121f');
      const r = rampaDe(c, 4);
      poli(g, [[cx - h * 0.2, cy], [cx - h * 0.22, cy - h * 0.55], [cx - h * 0.1, cy - h * 0.7], [cx + h * 0.1, cy - h * 0.7], [cx + h * 0.22, cy - h * 0.55], [cx + h * 0.2, cy]], r, 'izq');
      g.ellO(cx, cy - h * 0.82, h * 0.11, h * 0.12, r);
      return true;
    }
    case 'ovni': {
      const cx = X(e.x, 0.5) + Math.sin(t * 0.7) * 6, cy = Y(e.y, 0.3) + Math.sin(t * 1.3) * 3, r = num(e.r, 0.1, 0.03, 0.4) * lw;
      for (let y = 0; y < lh * 0.5; y++) g.rect(cx - r * 0.3 - y * 0.18, cy + r * 0.2 + y, r * 0.6 + y * 0.36, 1, [255, 240, 160], 0.07 * (1 - y / (lh * 0.5)));
      g.ellO(cx, cy - r * 0.15, r * 0.4, r * 0.32, rampaDe([140, 220, 255], 4));
      g.ellO(cx, cy, r, r * 0.28, rampaDe([150, 155, 175], 5));
      for (let k = -3; k <= 3; k++) g.rect(cx + k * r * 0.26, cy + r * 0.04, 2, 2, (Math.floor(t * 4) + k) % 2 ? [255, 230, 120] : [120, 255, 200]);
      return true;
    }
    case 'explosion': {
      const cx = X(e.x, 0.5), cy = Y(e.y, 0.6), r = num(e.r, 0.2, 0.05, 0.6) * S, p = (t % 4) / 4;
      const R = r * (0.7 + 0.3 * Math.min(1, p * 2));
      const cols: RGB[] = [[60, 14, 14], [150, 30, 20], [235, 90, 30], [255, 170, 50], [255, 235, 150], [255, 255, 235]];
      for (let k = 0; k < cols.length; k++) g.ellO(cx + Math.sin(k + t) * R * 0.04, cy - k * R * 0.04, R * (1 - k * 0.15), R * (0.9 - k * 0.14), [cols[Math.max(0, k - 1)], cols[k], cols[Math.min(5, k + 1)]]);
      g.ring(cx, cy + R * 0.3, R * (1.05 + p * 1.2), 2, [255, 210, 150]);
      for (let k = 0; k < 6; k++) g.ellA(cx + (hs(k, 3) - 0.5) * R, cy - R * (1 + p * 1.6 + k * 0.25), R * 0.35 + k * 3, R * 0.3 + k * 2, [70, 66, 76], 0.5);
      return true;
    }
    case 'ciudad': {
      const base = Y(e.y, 0.85), alto = num(e.alto, 0.3, 0.05, 0.7) * lh, r = rampaDeE(e, '#1f2442', 4);
      let x = 0, i = 0;
      while (x < lw && i < 60) {
        const w = (0.04 + hs(i, 1) * 0.07) * lw, h = alto * (0.35 + hs(i, 2) * 0.65);
        poli(g, [[x, base], [x, base - h], [x + w, base - h], [x + w, base]], r, 'izq');
        for (let wy = base - h + 5; wy < base - 6; wy += 8) for (let wx = x + 4; wx < x + w - 4; wx += 7) if (hs(Math.floor(wx), Math.floor(wy), 7) > 0.55) g.rect(wx, wy, 3, 4, [255, 214, 120]);
        x += w + 1 + hs(i, 3) * 3; i++;
      }
      return true;
    }
    case 'bosque': {
      const base = Y(e.y, 0.88), n = Math.round(num(e.n, 14, 3, 36)), r = rampaDeE(e, '#1c4a38');
      for (let i = 0; i < n; i++) {
        const x = (i / n) * lw + (hs(i, 1) - 0.5) * 20, h = (0.1 + hs(i, 2) * 0.12) * lh, w = h * 0.5, y = base + (hs(i, 3) - 0.5) * 0.04 * lh;
        for (let k = 0; k < 3; k++) {
          const top = y - h * (0.4 + k * 0.3), bot = y - h * (k * 0.3), ww = w * (1 - k * 0.22);
          poli(g, [[x - ww / 2, bot], [x, top - h * 0.18], [x + ww / 2, bot]], r, 'izq');
        }
        g.rect(x - 1, y, 2, h * 0.1, [50, 34, 24]);
      }
      return true;
    }
    default:
      return false;
  }
}

export const TIPOS_PRO = ['poligono', 'linea', 'nubes', 'olas', 'particulas', 'rayos', 'barco', 'pez', 'roca', 'hielo', 'duna', 'algas', 'sargazo', 'faro', 'silueta', 'ovni', 'explosion', 'ciudad', 'bosque'];
