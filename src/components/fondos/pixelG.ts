import {rnd} from '../../lib/util';

export type RGB = [number, number, number];
export const hex = (s: string): RGB => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
export const rampa = (...cs: string[]): RGB[] => cs.map(hex);
export const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const bay = (x: number, y: number) => (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) / 16;
export const hs = (x: number, y: number, s = 0) => rnd((x * 7919 + y * 104729) | 0, 11 + s);

export type Texto = {s: string; x: number; y: number; size: number; fill: string; stroke?: string; align?: CanvasTextAlign};

export class G {
  w: number;
  h: number;
  d: Uint8ClampedArray;
  textos: Texto[] = [];
  contorno: RGB | null = null;
  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.d = new Uint8ClampedArray(w * h * 4);
  }
  set(x: number, y: number, c: RGB, a = 1) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    if (a >= 1 || !this.d[i + 3]) {
      this.d[i] = c[0];
      this.d[i + 1] = c[1];
      this.d[i + 2] = c[2];
    } else {
      this.d[i] = this.d[i] * (1 - a) + c[0] * a;
      this.d[i + 1] = this.d[i + 1] * (1 - a) + c[1] * a;
      this.d[i + 2] = this.d[i + 2] * (1 - a) + c[2] * a;
    }
    this.d[i + 3] = 255;
  }
  rect(x: number, y: number, w: number, h: number, c: RGB, a = 1) {
    for (let j = Math.floor(y); j < Math.floor(y + h); j++) for (let i = Math.floor(x); i < Math.floor(x + w); i++) this.set(i, j, c, a);
  }
  /** degradado vertical con tramado entre los tonos de la rampa */
  grad(y0: number, y1: number, r: RGB[]) {
    const n = r.length;
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(this.h, Math.ceil(y1)); y++) {
      const t = ((y - y0) / Math.max(1, y1 - y0)) * (n - 1);
      const i = Math.max(0, Math.min(n - 2, Math.floor(t)));
      const f = Math.max(0, Math.min(1, t - i));
      for (let x = 0; x < this.w; x++) this.set(x, y, f > bay(x, y) ? r[i + 1] : r[i]);
    }
  }
  /** elipse con sombreado por luz (4-5 tonos y tramado en los bordes de sombra) */
  ell(cx: number, cy: number, rx: number, ry: number, r: RGB[], luz: [number, number, number] = [-0.45, -0.6, 0.66]) {
    const n = r.length;
    if (this.contorno) this.ellA(cx, cy, rx + 1.2, ry + 1.2, this.contorno, 1);
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        const q = nx * nx + ny * ny;
        if (q > 1) continue;
        const z = Math.sqrt(1 - q);
        const l = Math.max(0, Math.min(1, 0.22 + 0.78 * Math.max(0, nx * luz[0] + ny * luz[1] + z * luz[2])));
        const v = l * (n - 1);
        const i = Math.min(n - 2, Math.floor(v));
        this.set(x, y, v - i > bay(x, y) ? r[i + 1] : r[i]);
      }
    }
  }
  /** elipse sombreada con contorno oscuro de 1 px (como el pixel art de referencia) */
  ellO(cx: number, cy: number, rx: number, ry: number, r: RGB[], borde: RGB = [8, 10, 20]) {
    this.ellA(cx, cy, rx + 1.2, ry + 1.2, borde, 1);
    this.ell(cx, cy, rx, ry, r);
  }
  ellA(cx: number, cy: number, rx: number, ry: number, c: RGB, a: number) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny <= 1) this.set(x, y, c, a);
      }
  }
  line(x0: number, y0: number, x1: number, y1: number, c: RGB, th = 1) {
    const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))) || 1;
    for (let i = 0; i <= n; i++) this.rect(x0 + ((x1 - x0) * i) / n - th / 2, y0 + ((y1 - y0) * i) / n - th / 2, th, th, c);
  }
  ring(cx: number, cy: number, r: number, th: number, c: RGB) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d <= r && d >= r - th) this.set(x, y, c);
      }
  }
  txt(s: string, x: number, y: number, size: number, fill: string, stroke = '#000', align: CanvasTextAlign = 'center') {
    this.textos.push({s, x, y, size, fill, stroke, align});
  }
}

