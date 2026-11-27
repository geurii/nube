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
/** Objetos que no traian animacion propia: se quedaban clavados como una foto. */
const SIN_VIDA_PROPIA = new Set(['barril','bosque','caballo','calendario','castillo','cerveceria','ciudad','corona',
  'duna','hidrofono','hielo','iglesia','microfono','reloj','roca','tren','libro','moneda','poligono','linea']);
/** Semilla estable por tipo: cada objeto respira a su ritmo y no todos a la vez. */
const fase = (k: string) => { let h = 0; for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) % 997; return h / 997 * Math.PI * 2; };

export function dibujarPro(g: G, e: Pro, t: number, lw: number, lh: number, u: number): boolean {
  const S = Math.min(lw, lh);
  // VIDA MINIMA: lo que no se animaba solo, ahora respira y se mece un poco. Nada en el cuadro queda congelado.
  const vivo = SIN_VIDA_PROPIA.has(String(e.t));
  const f = vivo ? fase(String(e.t)) : 0;
  const flotaY = vivo ? Math.sin(t * 0.85 + f) * 0.0055 : 0;
  const flotaX = vivo ? Math.sin(t * 0.52 + f * 1.7) * 0.0035 : 0;
  const X = (v: unknown, d = 0.5) => (num(v, d) + flotaX) * lw;
  const Y = (v: unknown, d = 0.5) => (num(v, d) + flotaY) * lh;
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
    case 'cartas': {
      // Tres cartas hanafuda físicas: formato vertical, marco oscuro, fondo marfil y motivos florales estacionales.
      const cx=X(e.x,0.5), cy=Y(e.y,0.58), w=num(e.w,0.68,0.35,0.9)*lw/3, h=num(e.h,0.46,0.28,0.7)*lh;
      const base=col(e.color,'#d8c28a'), ink:[number,number,number]=[48,38,31];
      for(let i=0;i<3;i++){
        const sway=Math.sin(t*0.8+i*1.2)*2, x=cx+(i-1)*w*0.72-w*0.42+sway, y=cy-h/2+(i===1?-5:5);
        g.rect(x-3,y-3,w+6,h+6,ink); g.rect(x,y,w,h,base);
        g.rect(x+w*0.08,y+h*0.08,w*0.84,h*0.84,[224,211,166]);
        const fx=x+w*0.5, fy=y+h*0.43, petal: RGB=i===0?[174,66,55]:i===1?[211,153,57]:[76,119,76];
        for(let k=0;k<5;k++){const a=k*Math.PI*2/5;g.ell(fx+Math.cos(a)*w*0.13,fy+Math.sin(a)*h*0.09,w*0.075,h*0.055,[petal]);}
        g.ell(fx,fy,w*0.045,h*0.035,[[238,211,117]]);
        g.line(x+w*0.18,y+h*0.72,x+w*0.78,y+h*0.72,[91,104,62] as RGB,Math.max(2,Math.round(u*2)));
        if(i===0) g.rect(x+w*0.08,y+h*0.12,w*0.84,h*0.12,[155,49,43]);
      }
      break;
    }
    case 'calendario': {
      const cx=X(e.x,0.5), cy=Y(e.y,0.55), w=num(e.w,0.48,0.18,0.8)*lw, h=num(e.h,0.48,0.18,0.75)*lh;
      const x=cx-w/2, y=cy-h/2, r=rampaDeE(e,'#b58a52',5);
      g.rect(x-3,y-3,w+6,h+6,[28,22,20]); g.rect(x,y,w,h,r[2]);
      g.rect(x,y,w,h*0.22,r[0]); g.rect(x+w*0.12,y-h*0.06,w*0.08,h*0.18,[210,190,150]); g.rect(x+w*0.8,y-h*0.06,w*0.08,h*0.18,[210,190,150]);
      for(let row=0;row<4;row++) for(let col=0;col<5;col++){const xx=x+w*(0.12+col*0.17), yy=y+h*(0.34+row*0.14);g.rect(xx,yy,w*0.07,h*0.055,(row===2&&col===3)?[210,55,45]:r[0]);}
      break;
    }
    case 'reloj': {
      const cx=X(e.x,0.5),cy=Y(e.y,0.48),rad=num(e.r,0.18,0.06,0.35)*S*1.8,r=rampaDeE(e,'#d9b66f',5);
      g.ellO(cx,cy,rad,rad,r);g.ellO(cx,cy,rad*0.82,rad*0.82,[r[0],r[1],r[2]]);
      for(let k=0;k<12;k++){const a=k*Math.PI/6-Math.PI/2;g.set(cx+Math.cos(a)*rad*0.68,cy+Math.sin(a)*rad*0.68,r[4]);}
      // las agujas giran: el minutero da una vuelta cada 12 s y la hora avanza 12 veces mas lento
      const aM=t*0.52-Math.PI/2, aH=t*0.52/12-Math.PI/2+0.9;
      g.line(cx,cy,cx+Math.cos(aM)*rad*0.62,cy+Math.sin(aM)*rad*0.62,[45,32,22],Math.max(2,Math.round(u*2)));
      g.line(cx,cy,cx+Math.cos(aH)*rad*0.4,cy+Math.sin(aH)*rad*0.4,[45,32,22],Math.max(2,Math.round(u*2)));
      g.ellA(cx,cy,3,3,[35,25,20],1);
      break;
    }
    case 'castillo': {
      const cx=X(e.x,0.5),base=Y(e.y,0.86),w=num(e.w,0.65,0.3,0.9)*lw,h=num(e.h,0.5,0.25,0.8)*lh,r=rampaDeE(e,'#827b78',5);
      const block=(x: number,y: number,bw: number,bh: number)=>{g.rect(x-2,y-2,bw+4,bh+2,[25,25,34]);g.rect(x,y,bw,bh,r[2]);g.rect(x,y,bw*0.18,bh,r[3]);for(let wy=y+bh*0.28;wy<base-5;wy+=Math.max(10,bh*0.25))g.rect(x+bw*0.42,wy,Math.max(3,bw*0.12),Math.max(5,bh*0.1),[30,30,40]);};
      block(cx-w*0.32,base-h*0.58,w*0.64,h*0.58);block(cx-w*0.48,base-h*0.9,w*0.22,h*0.9);block(cx+w*0.26,base-h*0.9,w*0.22,h*0.9);
      for(const tx of [cx-w*0.48,cx+w*0.26]){for(let k=0;k<4;k++)g.rect(tx+k*w*0.055,base-h*0.96,w*0.035,h*0.08,r[3]);}
      g.rect(cx-w*0.07,base-h*0.28,w*0.14,h*0.28,[34,26,24]);break;
    }
    case 'corona': {
      const cx=X(e.x,0.5),cy=Y(e.y,0.5),w=num(e.w,0.3,0.12,0.6)*lw,h=w*0.55,r=rampaDeE(e,'#d9b33d',5);
      const pts:[[number,number],[number,number],[number,number],[number,number],[number,number],[number,number],[number,number]]=[[cx-w/2,cy+h/2],[cx-w*0.42,cy-h/2],[cx-w*0.12,cy+h*0.02],[cx,cy-h*0.62],[cx+w*0.12,cy+h*0.02],[cx+w*0.42,cy-h/2],[cx+w/2,cy+h/2]];
      poli(g,pts,r);g.rect(cx-w/2,cy+h*0.35,w,h*0.22,r[3]);break;
    }
    case 'libro': {
      const cx=X(e.x,0.5),cy=Y(e.y,0.6),w=num(e.w,0.38,0.18,0.65)*lw,h=num(e.h,0.32,0.16,0.55)*lh,r=rampaDeE(e,'#7a3f32',5);
      g.rect(cx-w/2,cy-h/2,w/2,h,r[1]);g.rect(cx,cy-h/2,w/2,h,r[2]);g.line(cx,cy-h/2,cx,cy+h/2,r[0],2);g.line(cx-w*0.36,cy-h*0.28,cx-w*0.08,cy-h*0.28,r[4],2);g.line(cx+w*0.08,cy-h*0.28,cx+w*0.36,cy-h*0.28,r[4],2);break;
    }
    case 'moneda': {
      const cx=X(e.x,0.5),cy=Y(e.y,0.5),rad=num(e.r,0.1,0.04,0.24)*S*1.7,r=rampaDeE(e,'#d9b33d',5);
      g.ellO(cx,cy,rad,rad,r);g.ellO(cx,cy,rad*0.7,rad*0.7,[r[2],r[3]]);g.ellO(cx,cy,rad*0.28,rad*0.28,[r[1],r[2],r[3]]);break;
    }
    case 'iglesia': {
      const cx=X(e.x,0.5),base=Y(e.y,0.86),w=num(e.w,0.42,0.2,0.7)*lw,h=num(e.h,0.42,0.2,0.7)*lh,r=rampaDeE(e,'#b7a58c',5);
      g.rect(cx-w*0.36,base-h*0.68,w*0.72,h*0.68,r[2]);g.rect(cx-w*0.12,base-h*1.05,w*0.24,h*0.38,r[3]);g.rect(cx-w*0.025,base-h*1.13,w*0.05,h*0.16,r[4]);g.rect(cx-w*0.4,base-h*0.72,w*0.18,h*0.72,r[1]);g.rect(cx+w*0.22,base-h*0.72,w*0.18,h*0.72,r[1]);g.rect(cx-w*0.06,base-h*0.3,w*0.12,h*0.3,[34,27,25]);break;
    }
    case 'caballo': {
      const cx=X(e.x,0.5),cy=Y(e.y,0.65),w=num(e.w,0.38,0.2,0.65)*lw,r=rampaDeE(e,'#79513a',5);
      g.ellO(cx,cy,w*0.34,w*0.17,r);g.ellO(cx+w*0.27,cy-w*0.17,w*0.1,w*0.11,r);g.line(cx+w*0.18,cy-w*0.12,cx+w*0.29,cy-w*0.28,r[0],Math.max(3,Math.round(u*4)));for(const dx of [-0.2,-0.05,0.13,0.27])g.line(cx+w*dx,cy+w*0.1,cx+w*dx*1.02,cy+w*0.42,r[0],Math.max(3,Math.round(u*4)));g.line(cx-w*0.3,cy-w*0.02,cx-w*0.46,cy-w*0.22,r[0],Math.max(2,Math.round(u*3)));break;
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
    case 'microfono': {
      const cx=X(e.x,0.5), cy=Y(e.y,0.56), w=num(e.w,0.2,0.1,0.34)*lw, h=num(e.h,0.44,0.28,0.62)*lh;
      const r=rampaDeE(e,'#8b98a8',5), cabezaY=cy-h*0.3, cabezaW=w*0.42, cabezaH=h*0.29;
      g.ellO(cx,cabezaY,cabezaW,cabezaH,r);
      for(let k=-2;k<=2;k++) g.line(cx-cabezaW*0.65,cabezaY+k*cabezaH*0.22,cx+cabezaW*0.65,cabezaY+k*cabezaH*0.22,r[0],Math.max(1,u*1.2));
      g.rect(cx-w*0.1,cabezaY+cabezaH*0.78,w*0.2,h*0.34,r[2]);
      g.rect(cx-w*0.055,cy+h*0.02,w*0.11,h*0.19,r[1]);
      g.line(cx-w*0.28,cy+h*0.2,cx+w*0.28,cy+h*0.2,r[0],Math.max(2,u*2));
      g.ellO(cx,cy+h*0.22,w*0.3,h*0.035,[r[0],r[1],r[2]]);
      break;
    }
    case 'hidrofono': {
      const cx=X(e.x,0.5), cy=Y(e.y,0.58), w=num(e.w,0.17,0.1,0.28)*lw, h=num(e.h,0.52,0.32,0.68)*lh;
      const r=rampaDeE(e,'#7895a8',5), top=cy-h*0.38, bottom=cy+h*0.36;
      g.line(cx,top-h*0.34,cx,top-h*0.02,[80,91,105],Math.max(2,u*3));
      g.ellO(cx,top,w*0.22,h*0.08,r);
      g.rect(cx-w*0.22,top,w*0.44,bottom-top,r[2]);
      g.rect(cx-w*0.14,top,w*0.08,bottom-top,r[3]);
      g.ellO(cx,bottom,w*0.22,h*0.08,r);
      g.rect(cx-w*0.28,bottom-h*0.02,w*0.56,h*0.1,[45,61,76]);
      for(let k=0;k<4;k++) g.line(cx-w*0.17,top+h*(0.13+k*0.1),cx+w*0.17,top+h*(0.13+k*0.1),r[0],Math.max(1,u));
      g.line(cx,top-h*0.34,cx+w*0.28,top-h*0.52,[65,75,88],Math.max(1,u*2));
      for(let k=0;k<3;k++) g.ring(cx+w*(0.48+k*0.13),cy-h*(0.08+k*0.03),h*(0.055+k*0.018),Math.max(1,u),[135,205,231]);
      break;
    }
    case 'sonar': {
      const cx=X(e.x,0.5), cy=Y(e.y,0.58), w=num(e.w,0.58,0.34,0.82)*lw, h=num(e.h,0.48,0.3,0.7)*lh;
      const x=cx-w/2, y=cy-h/2, r=rampaDeE(e,'#557b8b',5);
      g.rect(x-5,y-5,w+10,h+10,[19,27,39]);
      g.rect(x,y,w,h,[52,67,76]);
      const sx=x+w*0.12, sy=y+h*0.1, sw=w*0.76, sh=h*0.66, mx=sx+sw/2, my=sy+sh/2, rad=Math.min(sw,sh)*0.44;
      g.rect(sx,sy,sw,sh,[8,27,39]);
      g.ellO(mx,my,rad,rad,[r[1],r[2],r[3]]);
      g.ellO(mx,my,rad*0.66,rad*0.66,[r[1],r[2]]);
      g.ellO(mx,my,rad*0.32,rad*0.32,[r[1],r[2]]);
      const ang=t*1.8, ex=mx+Math.cos(ang)*rad, ey=my+Math.sin(ang)*rad;
      g.line(mx,my,ex,ey,[140,255,190],Math.max(2,u*2));
      g.ellA(mx+Math.cos(ang+0.8)*rad*0.62,my+Math.sin(ang+0.8)*rad*0.62,Math.max(2,u*2),Math.max(2,u*2),[255,225,110],0.95);
      for(let k=0;k<4;k++) g.rect(x+w*(0.18+k*0.2),y+h*0.84,w*0.1,h*0.055,k===1?[115,205,155]:r[1]);
      break;
    }
    case 'volcan': {
      const cx=X(e.x,0.5), base=Y(e.y,0.86), w=num(e.w,0.68,0.42,0.9)*lw, h=num(e.h,0.56,0.32,0.75)*lh;
      const r=rampaDeE(e,'#765448',5), craterY=base-h*0.78;
      poli(g,[[cx-w*0.52,base],[cx-w*0.32,base-h*0.42],[cx-w*0.13,base-h*0.76],[cx-w*0.04,craterY],[cx+w*0.08,craterY],[cx+w*0.2,base-h*0.72],[cx+w*0.36,base-h*0.4],[cx+w*0.52,base]],r,'izq');
      g.line(cx-w*0.13,craterY,cx+w*0.13,craterY,[255,174,66],Math.max(3,u*3));
      poli(g,[[cx-w*0.05,craterY],[cx-w*0.18,craterY-h*0.12],[cx-w*0.13,craterY-h*0.25],[cx,craterY-h*0.37],[cx+w*0.14,craterY-h*0.2],[cx+w*0.19,craterY-h*0.1],[cx+w*0.05,craterY]],rampaDe([104,99,99],5),'arriba',false);
      poli(g,[[cx-w*0.1,craterY],[cx-w*0.03,base-h*0.34],[cx+w*0.01,base-h*0.28],[cx+w*0.11,craterY]],rampaDe([245,88,36],4),'der',false);
      for(let k=0;k<8;k++) g.ellA(cx+(hs(k,17)-0.5)*w*0.2,craterY-h*(0.16+hs(k,18)*0.3)-Math.sin(t*1.4+k)*4,w*0.035,h*0.035,[75,70,78],0.45);
      break;
    }
    case 'fuego': {
      const cx=X(e.x,0.5), base=Y(e.y,0.78), w=num(e.w,0.34,0.18,0.62)*lw, h=num(e.h,0.43,0.25,0.65)*lh;
      const r=rampaDeE(e,'#e66a24',5);
      for(let k=0;k<3;k++){
        const shift=(k-1)*w*0.22, flick=Math.sin(t*4+k*1.7)*h*0.035, ww=w*(0.24+k*0.025);
        poli(g,[[cx+shift-ww/2,base],[cx+shift-ww*0.48,base-h*0.34],[cx+shift-ww*0.12,base-h*0.67-flick],[cx+shift+ww*0.04,base-h],[cx+shift+ww*0.28,base-h*0.62-flick],[cx+shift+ww/2,base]],r,'izq');
        poli(g,[[cx+shift-ww*0.24,base],[cx+shift-ww*0.13,base-h*0.3],[cx+shift+ww*0.04,base-h*0.58-flick],[cx+shift+ww*0.24,base]],rampaDe([255,213,101],4),'izq',false);
      }
      break;
    }
    case 'lago': {
      const cx=X(e.x,0.5), cy=Y(e.y,0.7), w=num(e.w,0.76,0.44,0.92)*lw, h=num(e.h,0.3,0.16,0.48)*lh;
      const orilla=rampaDeE(e,'#75664c',4), agua=rampaDe([39,112,145],5);
      g.ellO(cx,cy,w/2,h/2,orilla);
      g.ellO(cx,cy-h*0.04,w*0.43,h*0.34,agua);
      for(let k=0;k<10;k++){
        const xx=cx-w*0.3+(k/9)*w*0.6, yy=cy-h*0.08+Math.sin(t*1.2+k)*h*0.06;
        g.line(xx,yy,xx+w*0.035,yy,[190,230,235],Math.max(1,u));
      }
      break;
    }
    case 'avion': {
      const cx=X(e.x,0.5), cy=Y(e.y,0.5)+Math.sin(t*1.1)*lh*0.008, w=num(e.w,0.62,0.36,0.84)*lw, r=rampaDeE(e,'#aab8c7',5);
      poli(g,[[cx-w*0.52,cy],[cx-w*0.18,cy-w*0.035],[cx-w*0.08,cy-w*0.12],[cx+w*0.25,cy-w*0.1],[cx+w*0.43,cy-w*0.025],[cx+w*0.52,cy],[cx+w*0.4,cy+w*0.03],[cx-w*0.45,cy+w*0.03]],r);
      poli(g,[[cx-w*0.08,cy],[cx-w*0.25,cy+w*0.28],[cx+w*0.05,cy+w*0.18],[cx+w*0.2,cy+w*0.02]],r,'izq');
      poli(g,[[cx-w*0.34,cy],[cx-w*0.48,cy+w*0.15],[cx-w*0.27,cy+w*0.1]],r,'izq');
      g.ellO(cx+w*0.12,cy, w*0.04,w*0.014,[[45,55,70]]);
      break;
    }
    case 'tren': {
      // el tren avanza despacio por el cuadro y se mece sobre las vias
      const avance=Math.sin(t*0.35)*0.05, vaiven=Math.sin(t*2.1)*0.004;
      const cx=(num(e.x,0.5)+avance)*lw, base=(num(e.y,0.78)+vaiven)*lh, w=num(e.w,0.58,0.38,0.82)*lw, h=num(e.h,0.42,0.25,0.65)*lh, r=rampaDeE(e,'#4d5968',5);
      g.rect(cx-w*0.42,base-h*0.68,w*0.62,h*0.58,r[2]);
      g.rect(cx-w*0.28,base-h*0.94,w*0.24,h*0.28,r[3]);
      g.rect(cx+w*0.12,base-h*0.45,w*0.22,h*0.32,r[1]);
      g.rect(cx-w*0.38,base-h*0.16,w*0.67,h*0.1,r[0]);
      for(const dx of [-0.28,-0.08,0.18]){
        g.ellO(cx+w*dx,base,w*0.075,w*0.075,[[30,34,42]]);
        const ar=t*3.2; // radio que gira: se ve que la rueda rueda
        g.line(cx+w*dx-Math.cos(ar)*w*0.05,base-Math.sin(ar)*w*0.05,cx+w*dx+Math.cos(ar)*w*0.05,base+Math.sin(ar)*w*0.05,[165,170,178],Math.max(1,u));
        g.ellA(cx+w*dx,base,w*0.03,w*0.03,[165,170,178],1);
      }
      // humo que sube y se deshace
      for(let k=0;k<4;k++){const p=((t*0.5+k*0.25)%1);
        g.ellA(cx-w*0.16+Math.sin(t*0.8+k)*w*0.03, base-h*0.96-p*h*0.5, w*(0.045+p*0.06), h*(0.035+p*0.05),[95,100,105],0.45*(1-p));}
      break;
    }
    case 'submarino': {
      const cx=X(e.x,0.5),cy=Y(e.y,0.58)+Math.sin(t*1.3)*lh*0.006,w=num(e.w,0.58,0.34,0.82)*lw,h=num(e.h,0.24,0.16,0.42)*lh,r=rampaDeE(e,'#b0a66f',5);
      poli(g,[[cx-w*0.5,cy],[cx-w*0.38,cy-h*0.42],[cx+w*0.34,cy-h*0.42],[cx+w*0.5,cy],[cx+w*0.34,cy+h*0.42],[cx-w*0.38,cy+h*0.42]],r);
      g.rect(cx-w*0.08,cy-h*0.66,w*0.22,h*0.25,r[2]);
      g.rect(cx-w*0.02,cy-h*0.82,w*0.08,h*0.18,r[3]);
      for(let k=0;k<4;k++) g.ellO(cx-w*0.24+k*w*0.14,cy,w*0.025,h*0.09,[[220,225,180]]);
      poli(g,[[cx-w*0.5,cy],[cx-w*0.62,cy-h*0.24],[cx-w*0.62,cy+h*0.24]],r[1]?[r[1],r[2],r[3]]:r);
      break;
    }
    case 'barril': {
      const cx=X(e.x,0.5), base=Y(e.y,0.82), w=num(e.w,0.27,0.12,0.5)*lw, h=num(e.h,0.38,0.2,0.62)*lh;
      const r=rampaDeE(e,'#89522d',5), top=base-h, x0=cx-w*0.36, x1=cx+w*0.36;
      poli(g,[[x0,top+h*0.08],[x1,top+h*0.08],[cx+w*0.43,base-h*0.08],[cx+w*0.34,base],[cx-w*0.34,base],[cx-w*0.43,base-h*0.08]],r,'izq');
      g.ellO(cx,top+h*0.08,w*0.36,h*0.09,[r[1],r[2],r[3]]);
      g.ellO(cx,base-h*0.08,w*0.34,h*0.085,[r[0],r[1],r[2]]);
      for(const q of [0.25,0.7]){
        const yy=top+h*q;
        g.line(cx-w*0.405,yy,cx+w*0.405,yy,[53,62,68],Math.max(3,u*3));
        g.line(cx-w*0.39,yy-2,cx+w*0.39,yy-2,[157,166,171],Math.max(1,u));
      }
      for(const dx of [-0.2,-0.07,0.08,0.21]) g.line(cx+w*dx,top+h*0.14,cx+w*dx*1.1,base-h*0.12,[91,52,29],Math.max(1,u));
      g.ellO(cx+w*0.12,top+h*0.08,w*0.045,h*0.018,[[78,45,27]]);
      break;
    }
    case 'cerveza': {
      const cx=X(e.x,0.5), base=Y(e.y,0.86), w=num(e.w,0.94,0.58,1)*lw, h=num(e.h,0.38,0.18,0.68)*lh;
      const r=rampaDeE(e,'#c58a32',5), x0=cx-w/2, x1=cx+w/2, crest:Pt[]=[];
      for(let i=0;i<=22;i++){
        const q=i/22, x=x0+q*w;
        const wave=Math.sin(q*Math.PI*3+t*1.15)*h*0.1+Math.sin(q*Math.PI*6-t*0.7)*h*0.035;
        const crestY=base-h*(0.7+0.16*Math.sin(q*Math.PI*2+t*0.8))+wave;
        crest.push([x,crestY] as Pt);
      }
      const pts:Pt[]=[...crest,[x1,base],[x0,base]];
      poli(g,pts,r,'izq',true);
      for(let i=0;i<14;i++){
        const q=(i+0.5)/14, x=x0+q*w, y=base-h*(0.7+0.16*Math.sin(q*Math.PI*2+t*0.8))+Math.sin(q*Math.PI*3+t*1.15)*h*0.1;
        g.ellA(x,y-h*0.025,Math.max(2,w*0.018),Math.max(2,h*0.025),[255,239,188],0.8);
        if(i%3===0) g.ellA(x+Math.sin(t+i)*w*0.012,y-h*0.11,Math.max(2,u*2),Math.max(2,u*2),[255,246,218],0.75);
      }
      for(let k=0;k<7;k++) g.ellA(cx+(hs(k,41)-0.5)*w*0.72,base-h*(0.86+hs(k,42)*0.27),w*0.022,h*0.035,[255,240,203],0.65);
      break;
    }
    case 'terremoto': {
      const cx = X(e.x, 0.5), base = Y(e.y, 0.86);
      const w = num(e.w, 0.88, 0.55, 0.98) * lw, h = num(e.h, 0.55, 0.34, 0.78) * lh;
      const stone = rampaDeE(e, '#b18a68', 5), roof: RGB = [116, 54, 43], ink: RGB = [38, 31, 34];
      // Fachadas de piedra y tejados de época; el temblor afecta cada edificio con fase distinta.
      for (let i = 0; i < 3; i++) {
        const bw = w * (0.22 + (i === 1 ? 0.03 : 0)), bh = h * (0.55 + (i === 1 ? 0.16 : i === 0 ? -0.04 : 0.03));
        const bx = cx + (i - 1) * w * 0.29, sway = Math.sin(t * 15 + i * 1.7) * (2.2 + i) * u;
        const lean = Math.sin(t * 13 + i) * 0.018;
        const top = base - bh;
        const wall: Pt[] = [[bx-bw/2+sway,base],[bx-bw/2+sway+lean*bh,top],[bx+bw/2+sway+lean*bh,top],[bx+bw/2+sway,base]];
        poli(g, wall, stone, 'izq', true);
        poli(g, [[bx-bw*0.58+sway+lean*bh,top+2],[bx+sway+lean*bh,top-bh*0.16],[bx+bw*0.58+sway+lean*bh,top+2]], rampaDe(roof,4), 'izq', true);
        for (let row = 0; row < 2; row++) for (let colN = 0; colN < 2; colN++) {
          const wx = bx - bw*0.27 + colN*bw*0.34 + sway, wy = top + bh*(0.25 + row*0.3);
          g.rect(wx, wy, Math.max(3,bw*0.075), Math.max(4,bh*0.075), [40,36,39]);
        }
        g.rect(bx-bw*0.06+sway,base-bh*0.24,bw*0.12,bh*0.24,ink);
        // Grietas visibles que vibran y pequeños escombros que caen.
        g.line(bx-bw*0.08+sway,top+bh*0.25,bx+bw*0.02+sway,top+bh*0.44,[55,42,39],Math.max(1,u*1.4));
        g.line(bx+bw*0.02+sway,top+bh*0.44,bx-bw*0.04+sway,top+bh*0.61,[55,42,39],Math.max(1,u*1.4));
        for (let k=0;k<3;k++) {
          const phase = (t*0.32 + hs(i*9+k,77)) % 1;
          const dx = bx + (hs(i*9+k,78)-0.5)*bw + sway;
          const dy = top + phase*bh*0.9;
          g.rect(dx,dy,Math.max(2,u*3),Math.max(2,u*2),stone[1]);
        }
      }
      // Polvo bajo las fachadas y pequeños golpes de suelo.
      for(let k=0;k<18;k++){
        const x = cx-w*0.48 + hs(k,79)*w*0.96;
        const y = base - (hs(k,80)*h*0.09) - Math.abs(Math.sin(t*5+k))*h*0.025;
        g.set(x,y,[184,157,129],0.55);
      }
      return true;
    }
    case 'tsunami': {
      const cx=X(e.x,0.5), base=Y(e.y,0.86), w=num(e.w,0.96,0.6,1)*lw, h=num(e.h,0.58,0.3,0.78)*lh;
      const r=rampaDeE(e,'#286d98',5), x0=cx-w/2, x1=cx+w/2, crest:Pt[]=[];
      for(let i=0;i<=24;i++){
        const q=i/24, x=x0+q*w;
        const swell=Math.sin(q*Math.PI*2.4+t*0.75)*h*0.07;
        const curl=Math.exp(-Math.pow((q-0.7)*5,2))*h*0.25;
        crest.push([x,base-h*(0.62+0.18*Math.sin(q*Math.PI*2+t*0.4))-swell-curl]);
      }
      poli(g,[...crest,[x1,base],[x0,base]],r,'izq',true);
      const foamY=crest[Math.floor(crest.length*0.7)][1];
      for(let k=0;k<18;k++){
        const q=0.55+hs(k,61)*0.36, x=x0+q*w;
        const y=base-h*(0.62+0.18*Math.sin(q*Math.PI*2+t*0.4))-Math.sin(q*Math.PI*2.4+t*0.75)*h*0.07;
        g.ellA(x,y-h*(0.035+hs(k,62)*0.02),w*(0.012+hs(k,63)*0.012),h*0.025,[226,244,250],0.82);
      }
      for(let k=0;k<9;k++) g.ellA(x0+w*(0.57+hs(k,64)*0.35),foamY-h*(0.07+hs(k,65)*0.16),w*0.018,h*0.025,[218,239,249],0.6);
      break;
    }
    case 'cerveceria': {
      const cx=X(e.x,0.5), base=Y(e.y,0.84), w=num(e.w,0.7,0.42,0.9)*lw, h=num(e.h,0.52,0.32,0.72)*lh;
      const brick=rampaDeE(e,'#8a5944',5), roof=rampaDe([65,49,43],5);
      g.rect(cx-w*0.48,base-h*0.7,w*0.96,h*0.7,brick[2]);
      poli(g,[[cx-w*0.54,base-h*0.7],[cx,base-h],[cx+w*0.54,base-h*0.7]],roof,'izq');
      g.rect(cx-w*0.47,base-h*0.72,w*0.94,h*0.06,brick[4]);
      for(let k=0;k<5;k++) g.rect(cx-w*0.42+k*w*0.19,base-h*0.56,w*0.1,h*0.14,[39,42,52]);
      g.rect(cx-w*0.08,base-h*0.34,w*0.16,h*0.34,[39,31,28]);
      // Tinas de cobre y tubería de la fábrica de cerveza.
      for(let k=0;k<3;k++){
        const x=cx-w*0.33+k*w*0.31, bw=w*0.18, bh=h*0.3, y=base-h*0.68;
        g.rect(x-bw/2,y,bw,bh,[119,87,50]);
        g.ellO(x,y,bw/2,bh*0.12,[[171,126,65],[202,161,83],[224,188,110]]);
        g.ellO(x,y+bh,bw/2,bh*0.12,[[87,56,35],[137,91,49],[176,120,63]]);
      }
      g.rect(cx+w*0.28,base-h*1.22,w*0.11,h*0.54,[95,65,48]);
      g.rect(cx+w*0.26,base-h*1.24,w*0.15,h*0.06,[57,48,43]);
      g.line(cx+w*0.3,base-h*0.4,cx+w*0.47,base-h*0.4,[103,75,48],Math.max(2,u*3));
      break;
    }
    case 'deslizamiento': {
      const cx=X(e.x,0.56), base=Y(e.y,0.9), w=num(e.w,0.72,0.42,0.92)*lw, h=num(e.h,0.56,0.3,0.78)*lh;
      const rock=rampaDeE(e,'#675f58',5);
      poli(g,[[cx-w*0.55,base],[cx-w*0.5,base-h*0.78],[cx-w*0.28,base-h],[cx-w*0.06,base-h*0.72],[cx+w*0.12,base-h*0.58],[cx+w*0.55,base]],rock,'izq');
      for(let k=0;k<8;k++){
        const q=(k+1)/9, x=cx-w*0.32+q*w*0.78+Math.sin(t*1.3+k)*w*0.018;
        const y=base-h*(0.78-q*0.58)+Math.sin(t*1.5+k)*h*0.025;
        const rr=w*(0.026+hs(k,71)*0.032);
        g.ellO(x,y,rr,rr*(0.66+hs(k,72)*0.2),rock);
        g.ellA(x-rr*0.2,y-rr*0.35,rr*0.2,rr*0.18,rock[rock.length-1],0.7);
      }
      for(let k=0;k<5;k++) g.ellA(cx+w*(0.12+hs(k,73)*0.3),base-h*(0.16+hs(k,74)*0.25),w*0.035,h*0.035,[185,177,166],0.25);
      break;
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
    case 'central': {
      // central nuclear / planta industrial: torre de enfriamiento, chimenea con franjas y bloque del reactor (sin ventanas de apartamento) + vapor
      const cx = X(e.x, 0.5), cy = Y(e.y, 0.82), H = num(e.h, 0.5, 0.15, 0.9) * lh, W = num(e.w, 0.55, 0.2, 1) * lw;
      const hormigon = rampaDeE(e, '#aab1b8', 5);
      const franja = rampaDe([200, 60, 55], 4), blanco = rampaDe([232, 232, 236], 4);
      // torre de enfriamiento (hiperboloide: ancha abajo, cintura estrecha, boca un poco más ancha)
      const tx = cx - W * 0.27, TH = H * 0.86, base = W * 0.36, cintura = W * 0.23, boca = W * 0.26, N = 12;
      const ancho = (k: number) => (k <= 9 ? base - (base - cintura) * Math.sin((k / 9) * (Math.PI / 2)) : cintura + (boca - cintura) * ((k - 9) / 3));
      const izq: [number, number][] = [], der: [number, number][] = [];
      for (let k = 0; k <= N; k++) { const y = cy - (TH * k) / N; izq.push([tx - ancho(k) / 2, y]); der.push([tx + ancho(k) / 2, y]); }
      poli(g, [...izq, ...der.reverse()], hormigon, 'izq', true);
      g.ellA(tx, cy - TH, boca / 2, boca * 0.08, [60, 66, 74], 0.9); // boca oscura de la torre
      // chimenea alta con franjas rojas y blancas
      const hx = cx + W * 0.34, CH = H * 0.8, cw = W * 0.075;
      for (let k = 0; k < 8; k++) {
        const a = k % 2 ? franja : blanco, y0 = cy - (k / 8) * CH, y1 = cy - ((k + 1) / 8) * CH;
        const w0 = cw * (1 - (k / 8) * 0.25), w1 = cw * (1 - ((k + 1) / 8) * 0.25);
        poli(g, [[hx - w0 / 2, y0], [hx + w0 / 2, y0], [hx + w1 / 2, y1], [hx - w1 / 2, y1]], a, 'izq', false);
      }
      // bloque del reactor: macizo, techo plano con respiraderos, sin ventanas
      const bx = cx + W * 0.02, bw = W * 0.34, bh = H * 0.34;
      poli(g, [[bx - bw / 2, cy], [bx + bw / 2, cy], [bx + bw / 2, cy - bh], [bx - bw / 2, cy - bh]], hormigon, 'izq', true);
      g.rect(bx - bw / 2, cy - bh * 0.62, bw, Math.max(1, bh * 0.03), [70, 76, 86], 0.8);
      g.rect(bx - bw / 2, cy - bh * 0.3, bw, Math.max(1, bh * 0.03), [70, 76, 86], 0.8);
      for (let k = 0; k < 4; k++) g.rect(bx - bw * 0.42 + k * bw * 0.26, cy - bh - bh * 0.07, bw * 0.12, bh * 0.07, [88, 95, 106]);
      // vapor que sube de la torre
      if (e.vapor !== false) for (let k = 0; k < 5; k++) {
        const fase = (t * 0.25 + k * 0.2) % 1;
        g.ellA(tx + Math.sin(t * 0.6 + k) * boca * 0.15, cy - TH - fase * H * 0.45, boca * (0.25 + fase * 0.35), boca * (0.18 + fase * 0.25), [225, 228, 232], 0.32 * (1 - fase));
      }
      return true;
    }
    case 'silueta': {
      const cx = X(e.x, 0.5), cy = Y(e.y, 0.8), h = num(e.h, 0.22, 0.05, 0.7) * lh, c = col(e.color, '#10121f');
      const r = rampaDe(c, 4), fase = t * 6.2 + cx * 0.012;
      const zancada = Math.sin(fase), brazo = Math.cos(fase);
      const hombroY = cy - h * 0.54, caderaY = cy - h * 0.08;
      const ancho = Math.max(2, h * 0.055);
      // Tronco y cabeza de una persona anónima.
      poli(g, [[cx - h * 0.2, cy], [cx - h * 0.22, cy - h * 0.55], [cx - h * 0.1, cy - h * 0.7], [cx + h * 0.1, cy - h * 0.7], [cx + h * 0.22, cy - h * 0.55], [cx + h * 0.2, cy]], r, 'izq');
      g.ellO(cx, cy - h * 0.82 + Math.abs(zancada) * h * 0.012, h * 0.11, h * 0.12, r);
      // Brazos alternos y piernas que caminan/corren; el ciclo cambia cada frame.
      const codoIzqX = cx - h * 0.3 - brazo * h * 0.075;
      const codoDerX = cx + h * 0.3 + brazo * h * 0.075;
      const manoIzqX = cx - h * 0.34 + brazo * h * 0.13;
      const manoDerX = cx + h * 0.34 - brazo * h * 0.13;
      g.line(cx - h * 0.16, hombroY, codoIzqX, hombroY + zancada * h * 0.12, r[0], ancho);
      g.line(codoIzqX, hombroY + zancada * h * 0.12, manoIzqX, hombroY + h * 0.23 + zancada * h * 0.09, r[0], ancho);
      g.line(cx + h * 0.16, hombroY, codoDerX, hombroY - zancada * h * 0.12, r[0], ancho);
      g.line(codoDerX, hombroY - zancada * h * 0.12, manoDerX, hombroY + h * 0.23 - zancada * h * 0.09, r[0], ancho);
      const pieIzqX = cx - h * 0.12 + zancada * h * 0.22;
      const pieDerX = cx + h * 0.12 - zancada * h * 0.22;
      g.line(cx - h * 0.09, caderaY, pieIzqX, cy - Math.max(0, zancada) * h * 0.12, r[0], ancho);
      g.line(cx + h * 0.09, caderaY, pieDerX, cy - Math.max(0, -zancada) * h * 0.12, r[0], ancho);
      g.line(pieIzqX, cy - Math.max(0, zancada) * h * 0.12, pieIzqX - h * 0.06, cy, r[0], ancho);
      g.line(pieDerX, cy - Math.max(0, -zancada) * h * 0.12, pieDerX + h * 0.06, cy, r[0], ancho);
      return true;
    }
    case 'radar': {
      const cx = X(e.x, 0.5), cy = Y(e.y, 0.54), w = num(e.w, 0.58, 0.28, 0.88) * lw, h = num(e.h, 0.42, 0.2, 0.68) * lh;
      const frame = rampaDeE(e, '#26384b', 5);
      g.rect(cx - w * 0.5, cy - h * 0.5, w, h, frame[0]);
      g.rect(cx - w * 0.46, cy - h * 0.42, w * 0.92, h * 0.84, [8, 19, 31]);
      for (let k = 1; k <= 3; k++) g.line(cx - w * 0.42, cy - h * 0.42 + k * h * 0.21, cx + w * 0.42, cy - h * 0.42 + k * h * 0.21, [31, 76, 84], 1);
      for (let k = 1; k <= 4; k++) g.line(cx - w * 0.42 + k * w * 0.168, cy - h * 0.42, cx - w * 0.42 + k * w * 0.168, cy + h * 0.42, [31, 76, 84], 1);
      g.ring(cx, cy, Math.min(w, h) * 0.25, 1, [67, 150, 145]);
      const ang = t * 1.65;
      g.line(cx, cy, cx + Math.cos(ang) * w * 0.34, cy + Math.sin(ang) * h * 0.34, [108, 255, 211], 2);
      const tx = cx + Math.sin(t * 0.83) * w * 0.2, ty = cy - h * 0.1 + Math.cos(t * 0.63) * h * 0.12;
      g.ellO(tx, ty, Math.max(2, w * 0.018), Math.max(2, h * 0.025), [[255, 230, 151]]);
      g.line(tx - w * 0.06, ty, tx + w * 0.06, ty, [255, 230, 151], 1);
      g.line(tx, ty - h * 0.09, tx, ty + h * 0.09, [255, 230, 151], 1);
      g.rect(cx - w * 0.5, cy + h * 0.47, w, Math.max(2, h * 0.035), frame[1]);
      return true;
    }
    case 'tic_tac': {
      const cx = X(e.x, 0.5) + Math.sin(t * 0.82) * lw * 0.025, cy = Y(e.y, 0.34) + Math.sin(t * 1.35) * lh * 0.012;
      const w = num(e.w, 0.38, 0.18, 0.72) * lw, h = num(e.h, 0.09, 0.045, 0.19) * lh, r = rampaDeE(e, '#dce7ee', 5);
      g.ellO(cx + w * 0.015, cy + h * 0.1, w * 0.5, h * 0.5, [[15, 27, 43], [15, 27, 43], [15, 27, 43]]);
      g.ellO(cx, cy, w * 0.5, h * 0.5, r);
      g.ellO(cx - w * 0.06, cy - h * 0.12, w * 0.31, h * 0.16, [[245, 250, 255]]);
      g.line(cx - w * 0.32, cy + h * 0.22, cx + w * 0.32, cy + h * 0.22, [122, 151, 170], Math.max(1, u));
      for (let k = -2; k <= 2; k++) g.rect(cx + k * w * 0.13 - 1, cy + h * 0.22, 2, 2, Math.floor(t * 3 + k) % 2 ? [143, 229, 245] : [255, 255, 255]);
      return true;
    }


    case 'moneda': {
      const cx=X(e.x,.5),cy=Y(e.y,.56),r=num(e.r,.16,.07,.28)*Math.min(lw,lh),spin=Math.abs(Math.cos(t*2.8)),w=r*(.12+spin*.88),rr=rampaDeE(e,'#c49b43',5);
      g.ellO(cx,cy,w,r,rr);g.ellO(cx-w*.12,cy-r*.12,w*.28,r*.3,[[242,215,139]]);
      g.ring(cx,cy,w,Math.max(1,u),rr[0]);
      return true;
    }
    case 'libro': {
      const cx=X(e.x,.5),cy=Y(e.y,.58),w=num(e.w,.56,.34,.82)*lw,h=num(e.h,.42,.25,.62)*lh,bend=Math.sin(t*1.2)*w*.025,rr=rampaDeE(e,'#7b4535',5);
      poli(g,[[cx-w*.5,cy-h*.42],[cx-bend,cy-h*.5],[cx-bend,cy+h*.42],[cx-w*.5,cy+h*.5]],rr,'izq',true);
      poli(g,[[cx+bend,cy-h*.5],[cx+w*.5,cy-h*.42],[cx+w*.5,cy+h*.5],[cx+bend,cy+h*.42]],rr,'der',true);
      g.line(cx,cy-h*.48,cx,cy+h*.45,[45,36,31],Math.max(1,u));
      for(let k=0;k<6;k++){const yy=cy-h*.3+k*h*.11;g.line(cx-w*.4,yy,cx-w*.08,yy,[216,198,160],Math.max(1,u*.6));g.line(cx+w*.08,yy,cx+w*.4,yy,[216,198,160],Math.max(1,u*.6));}
      return true;
    }

    case 'moneda': {
      const cx=X(e.x,.5),cy=Y(e.y,.56),rad=num(e.r,.16,.07,.28)*Math.min(lw,lh),spin=Math.abs(Math.cos(t*2.8)),w=rad*(.12+spin*.88),rr=rampaDeE(e,'#c49b43',5);
      g.ellO(cx,cy,w,rad,rr);g.ellO(cx-w*.12,cy-rad*.12,w*.28,rad*.3,[[242,215,139]]);g.ring(cx,cy,w,Math.max(1,u),rr[0]);
      return true;
    }
    case 'libro': {
      const cx=X(e.x,.5),cy=Y(e.y,.58),w=num(e.w,.56,.34,.82)*lw,h=num(e.h,.42,.25,.62)*lh,bend=Math.sin(t*1.2)*w*.025,rr=rampaDeE(e,'#7b4535',5);
      poli(g,[[cx-w*.5,cy-h*.42],[cx-bend,cy-h*.5],[cx-bend,cy+h*.42],[cx-w*.5,cy+h*.5]],rr,'izq',true);
      poli(g,[[cx+bend,cy-h*.5],[cx+w*.5,cy-h*.42],[cx+w*.5,cy+h*.5],[cx+bend,cy+h*.42]],rr,'der',true);
      g.line(cx,cy-h*.48,cx,cy+h*.45,[45,36,31],Math.max(1,u));
      for(let k=0;k<6;k++){const yy=cy-h*.3+k*h*.11;g.line(cx-w*.4,yy,cx-w*.08,yy,[216,198,160],Math.max(1,u*.6));g.line(cx+w*.08,yy,cx+w*.4,yy,[216,198,160],Math.max(1,u*.6));}
      return true;
    }
    case 'paracaidas': {
      const cx=X(e.x,0.5)+Math.sin(t*1.1)*lw*0.012,cy=Y(e.y,0.38),w=num(e.w,0.66,0.32,0.9)*lw,h=num(e.h,0.42,0.22,0.66)*lh,rr=rampaDeE(e,'#d5d8df',5);
      g.ellO(cx,cy,w*0.48,h*0.38,rr);
      for(let k=-3;k<=3;k++)g.line(cx+k*w*0.12,cy-h*0.06,cx+k*w*0.06,cy+h*0.46,[48,56,72],Math.max(1,u*0.8));
      g.rect(cx-w*0.075,cy+h*0.42,w*0.15,h*0.19,[74,55,39]);g.rect(cx-w*0.04,cy+h*0.60,w*0.08,h*0.13,[37,39,51]);
      return true;
    }
    case 'televisor': {
      const cx=X(e.x,.5),cy=Y(e.y,.56),w=num(e.w,.72,.4,.9)*lw,h=num(e.h,.5,.3,.7)*lh,rr=rampaDeE(e,'#554b43',5),f=Math.floor(t*8)%3;
      g.rect(cx-w*.5,cy-h*.5,w,h,rr[0]);g.rect(cx-w*.44,cy-h*.42,w*.88,h*.84,[20,26,34]);
      g.rect(cx-w*.4,cy-h*.36,w*.8,h*.72,[9,23,36]);
      for(let k=0;k<13;k++){const yy=cy-h*.33+k*h*.055+Math.sin(t*4+k)*2;g.line(cx-w*.38,yy,cx+w*.38,yy,(k+f)%3===0?[150,214,218]:[49,95,111],Math.max(1,u*.7));}
      g.ellO(cx+w*.45,cy-h*.16,w*.035,w*.035,[[190,180,154]]);g.ellO(cx+w*.45,cy+h*.12,w*.035,w*.035,[[190,180,154]]);
      g.line(cx-w*.25,cy+h*.49,cx-w*.34,cy+h*.58,rr[1],Math.max(2,u*1.5));g.line(cx+w*.25,cy+h*.49,cx+w*.34,cy+h*.58,rr[1],Math.max(2,u*1.5));
      return true;
    }
    case 'esfera': {
      const cx=X(e.x,.5),cy=Y(e.y,.58)+Math.sin(t*.65)*lh*.006,rad=num(e.r,.24,.11,.38)*Math.min(lw,lh),rr=rampaDeE(e,'#8f887b',6);
      g.ellO(cx+rad*.035,cy+rad*.07,rad,rad*.92,rr);g.ellO(cx-rad*.28,cy-rad*.27,rad*.27,rad*.21,[rr[3],rr[4],rr[5]]);
      g.ring(cx,cy,rad*.92,Math.max(1,u*.55),[43,48,52]);for(let k=-2;k<=2;k++)g.line(cx-rad*.48,cy+k*rad*.15,cx+rad*.48,cy+k*rad*.15,[76,81,82],Math.max(1,u*.35));
      return true;
    }
    case 'dodecaedro': {
      const cx=X(e.x,.5),cy=Y(e.y,.57),w=num(e.w,.52,.3,.82)*lw,h=num(e.h,.48,.3,.72)*lh,ang=t*.32,pts:Pt[]=[];
      for(let k=0;k<12;k++){const a=ang+k*Math.PI/6;pts.push([cx+Math.cos(a)*w*.47,cy+Math.sin(a)*h*.47]);}
      const rr=rampaDeE(e,'#a77a42',5);poli(g,pts,rr,'izq',true);
      for(let k=0;k<12;k++){const a=ang+k*Math.PI/6;g.ellO(cx+Math.cos(a)*w*.47,cy+Math.sin(a)*h*.47,w*.04,h*.04,[rr[0],rr[1],rr[2]]);}
      for(let k=0;k<6;k++){const a=ang+k*Math.PI/3;g.ellO(cx+Math.cos(a)*w*.17,cy+Math.sin(a)*h*.17,w*.075,h*.075,[[32,32,34],[57,55,51],[120,93,61]]);}
      return true;
    }
    case 'zepelin': {
      const cx=X(e.x,.5)+Math.sin(t*.7)*lw*.018,cy=Y(e.y,.42)+Math.sin(t*1.2)*lh*.012,w=num(e.w,.78,.48,.95)*lw,h=num(e.h,.28,.16,.48)*lh,rr=rampaDeE(e,'#aab3b7',5);
      g.ellO(cx,cy,w*.49,h*.48,rr);g.line(cx-w*.32,cy-h*.13,cx+w*.32,cy-h*.13,rr[4],Math.max(1,u));
      poli(g,[[cx-w*.39,cy],[cx-w*.55,cy-h*.18],[cx-w*.49,cy],[cx-w*.55,cy+h*.18]],rr,'izq',true);poli(g,[[cx+w*.35,cy],[cx+w*.55,cy-h*.16],[cx+w*.49,cy],[cx+w*.55,cy+h*.16]],rr,'izq',true);
      g.line(cx-w*.08,cy+h*.34,cx-w*.05,cy+h*.63,[42,47,54],Math.max(2,u*1.2));g.rect(cx-w*.18,cy+h*.54,w*.27,h*.16,[60,67,74]);
      for(let k=0;k<7;k++)g.rect(cx-w*.32+k*w*.1,cy-h*.12,2,2,[231,224,189]);
      return true;
    }
    case 'radio': {
      const cx=X(e.x,.5),cy=Y(e.y,.59),w=num(e.w,.68,.38,.88)*lw,h=num(e.h,.44,.25,.62)*lh,rr=rampaDeE(e,'#81563b',5);
      g.rect(cx-w*.5,cy-h*.5,w,h,rr[0]);g.rect(cx-w*.44,cy-h*.4,w*.58,h*.78,[35,42,46]);
      for(let k=0;k<8;k++)g.line(cx-w*.39,cy-h*.3+k*h*.085,cx-w*.02,cy-h*.3+k*h*.085,rr[3],Math.max(1,u*.6));
      g.ellO(cx+w*.27,cy-h*.08,w*.12,h*.18,[[21,29,34],[74,83,82],[173,151,111]]);g.ellO(cx+w*.27,cy-h*.08,w*.045,h*.07,[[204,187,143]]);
      g.line(cx+w*.18,cy+h*.29,cx+w*.38,cy+h*.29,rr[4],Math.max(2,u));g.line(cx+w*.38,cy+h*.29,cx+w*.48,cy-h*.2+Math.sin(t*4)*h*.08,rr[4],Math.max(2,u));
      return true;
    }
    case 'telegrafo': {
      const cx=X(e.x,.5),cy=Y(e.y,.68),w=num(e.w,.7,.4,.9)*lw,h=num(e.h,.36,.2,.6)*lh,rr=rampaDeE(e,'#99673d',5),pulse=Math.sin(t*5);
      g.rect(cx-w*.5,cy+h*.22,w,h*.18,rr[1]);g.rect(cx-w*.36,cy+h*.08,w*.72,h*.12,rr[0]);
      g.line(cx-w*.06,cy+h*.08,cx+w*.08,cy-h*.42+pulse*h*.04,[67,74,79],Math.max(3,u*1.5));g.ellO(cx+w*.1,cy-h*.43+pulse*h*.04,w*.09,h*.07,[[183,187,181],[226,215,169]]);
      g.line(cx-w*.35,cy+h*.08,cx-w*.24,cy-h*.07,[200,175,120],Math.max(2,u));for(let k=0;k<8;k++){const xx=cx-w*.43+k*w*.12;g.rect(xx,cy+h*.31,Math.max(1,u),Math.max(1,u*2),(Math.floor(t*6)+k)%2?[230,208,134]:[52,72,79]);}
      return true;
    }
    case 'aurora': {
      const y0=Y(e.y,.43),amp=num(e.h,.25,.12,.48)*lh;
      for(let band=0;band<5;band++)for(let xx=0;xx<lw;xx+=2){const ph=xx*.018+t*(.8+band*.13)+band*1.3,yy=y0+Math.sin(ph)*amp*.23+Math.sin(ph*.37)*amp*.18+band*amp*.09;g.set(xx,yy,[Math.round(65+band*13),Math.round(180+Math.sin(ph)*45),Math.round(150+band*15)],.8);g.set(xx+1,yy+1,[74,150,183],.6);}
      for(let k=0;k<14;k++){const xx=(k/14)*lw+Math.sin(t+k)*4,yy=y0+Math.sin(t*1.3+k)*amp*.35;g.set(xx,yy,[210,235,218],.8);}
      return true;
    }
    case 'vaca': {
      const cx=X(e.x,.5),base=Y(e.y,.8),w=num(e.w,.62,.4,.84)*lw,h=num(e.h,.35,.23,.56)*lh,rr=rampaDeE(e,'#c8bba0',5),step=Math.sin(t*4)*w*.025;
      poli(g,[[cx-w*.38+step,base-h*.72],[cx-w*.34+step,base-h*.98],[cx+w*.27+step,base-h*.96],[cx+w*.39+step,base-h*.63],[cx+w*.31,base-h*.22],[cx-w*.32,base-h*.2]],rr,'izq',true);
      poli(g,[[cx+w*.27+step,base-h*.8],[cx+w*.43+step,base-h*.9],[cx+w*.5+step,base-h*.6],[cx+w*.38+step,base-h*.48]],rr,'izq',true);
      for(const q of [-.27,-.08,.18,.31])g.line(cx+w*q,base-h*.26,cx+w*q+step*.2,base,[48,45,42],Math.max(2,u*1.6));
      g.ellO(cx-w*.18+step,base-h*.72,w*.12,h*.12,[[48,45,42]]);g.ellO(cx+w*.17+step,base-h*.83,w*.09,h*.10,[[48,45,42]]);
      g.line(cx-w*.36,base-h*.8,cx-w*.48,base-h*.88,[74,67,60],Math.max(2,u));return true;
    }
    case 'puente': {
      const cx=X(e.x,.5),base=Y(e.y,.78),w=num(e.w,.9,.62,.98)*lw,h=num(e.h,.53,.32,.72)*lh,shake=Math.sin(t*2.2)*h*.035,rr=rampaDeE(e,'#7b8793',5),left=cx-w*.34,right=cx+w*.34,top=base-h;
      g.rect(left-w*.025,top,w*.05,h,rr[1]);g.rect(right-w*.025,top,w*.05,h,rr[1]);g.line(cx-w*.5,base-h*.22+shake,cx+w*.5,base-h*.22-shake,rr[2],Math.max(4,u*2));
      for(let k=0;k<=18;k++){const xx=cx-w*.48+(k/18)*w*.96,cableY=top+Math.sin((k/18)*Math.PI)*h*.42;g.line(xx,base-h*.22+shake,cx+(xx-cx)*.94,cableY,[159,174,182],Math.max(1,u*.5));}
      g.line(left,top,right,top,rr[3],Math.max(2,u));for(let k=0;k<6;k++){const xx=cx-w*.46+k*w*.18;g.line(xx,base-h*.22+shake,xx,base-h*.08,[54,62,75],Math.max(1,u));}return true;
    }
    case 'satelite': {
      const cx=X(e.x,.5)+Math.sin(t*.5)*lw*.01,cy=Y(e.y,.47)+Math.cos(t*.8)*lh*.012,w=num(e.w,.55,.34,.8)*lw,h=num(e.h,.34,.2,.52)*lh,rr=rampaDeE(e,'#8797a4',5);
      poli(g,[[cx-w*.16,cy-h*.26],[cx+w*.16,cy-h*.26],[cx+w*.2,cy+h*.25],[cx-w*.2,cy+h*.25]],rr,'izq',true);
      for(const side of [-1,1]){const bx=cx+side*w*.22-(side<0?w*.27:0);g.rect(bx,cy-h*.19,w*.27,h*.38,[27,71,111]);for(let k=1;k<4;k++)g.line(bx+w*.27*k/4,cy-h*.19,bx+w*.27*k/4,cy+h*.19,[182,204,218],1);}
      g.line(cx,cy-h*.25,cx+w*.28,cy-h*.5,[215,219,201],Math.max(1,u));g.ellO(cx+w*.29,cy-h*.51,w*.045,w*.045,[[222,214,159]]);return true;
    }
    case 'bomba': {
      const cx=X(e.x,.5)+Math.sin(t*.6)*lw*.012,cy=Y(e.y,.56)+Math.cos(t*1.1)*lh*.008,w=num(e.w,.52,.3,.8)*lw,h=num(e.h,.25,.14,.4)*lh,rr=rampaDeE(e,'#66727d',5);
      g.ellO(cx,cy,w*.39,h*.45,rr);poli(g,[[cx-w*.37,cy],[cx-w*.55,cy-h*.38],[cx-w*.48,cy],[cx-w*.55,cy+h*.38]],rr,'izq',true);
      poli(g,[[cx+w*.26,cy-h*.18],[cx+w*.48,cy-h*.38],[cx+w*.42,cy],[cx+w*.48,cy+h*.38],[cx+w*.26,cy+h*.18]],rr,'izq',true);
      g.line(cx+w*.22,cy-h*.2,cx+w*.32,cy-h*.58,[185,162,111],Math.max(2,u));return true;
    }
    case 'tornado': {
      const cx=X(e.x,.5),cy=Y(e.y,.35),w=num(e.w,.7,.4,.94)*lw,h=num(e.h,.65,.42,.85)*lh,rotation=t*1.8,rr=rampaDeE(e,'#75808c',4);
      for(let k=0;k<9;k++){const q=k/9,ww=w*(.08+q*.42),yy=cy+q*h,offset=Math.sin(rotation+q*6)*w*.08;poli(g,[[cx-ww*.5+offset,yy],[cx+ww*.5+offset,yy],[cx+offset+Math.sin(rotation+q*4)*ww*.2,yy+h*.12]],rr,'izq',false);}
      for(let k=0;k<13;k++){const q=k/13,xx=cx+Math.sin(rotation+k)*w*(.15+q*.22),yy=cy+q*h;g.set(xx,yy,[193,190,178],.7);}return true;
    }
    case 'fosil': {
      const cx=X(e.x,.5),cy=Y(e.y,.55),w=num(e.w,.64,.36,.88)*lw,h=num(e.h,.46,.27,.65)*lh,rr=rampaDeE(e,'#b7a887',5),jaw=cy+h*.2+Math.sin(t*.4)*2;
      g.ellO(cx,cy-h*.08,w*.38,h*.36,rr);g.ellO(cx-w*.13,cy-h*.1,w*.09,h*.12,[[35,39,40]]);g.ellO(cx+w*.13,cy-h*.1,w*.09,h*.12,[[35,39,40]]);
      poli(g,[[cx-w*.25,jaw],[cx-w*.14,jaw+h*.19],[cx+w*.14,jaw+h*.19],[cx+w*.25,jaw]],rr,'izq',true);for(let k=-4;k<=4;k++)g.line(cx+k*w*.045,jaw+h*.05,cx+k*w*.045,jaw+h*.14,[220,211,180],Math.max(1,u));
      g.line(cx-w*.35,cy+h*.27,cx+w*.35,cy+h*.27,[83,75,62],Math.max(1,u*.7));return true;
    }
    case 'periodico': {
      const cx=X(e.x,.5),cy=Y(e.y,.56),w=num(e.w,.7,.4,.9)*lw,h=num(e.h,.53,.3,.75)*lh,rr=rampaDeE(e,'#d6c99e',5),bend=Math.sin(t*.9)*w*.015;
      poli(g,[[cx-w*.5,cy-h*.5],[cx+bend,cy-h*.46],[cx+bend,cy+h*.46],[cx-w*.5,cy+h*.5]],rr,'izq',true);
      poli(g,[[cx+bend,cy-h*.46],[cx+w*.5,cy-h*.5],[cx+w*.5,cy+h*.5],[cx+bend,cy+h*.46]],rr,'izq',true);
      g.line(cx+bend,cy-h*.45,cx+bend,cy+h*.45,[88,75,57],Math.max(1,u));
      for(let k=0;k<9;k++){const yy=cy-h*.34+k*h*.085;g.line(cx-w*.42,yy,cx-w*.04,yy,[71,70,63],Math.max(1,u*.45));g.line(cx+w*.06,yy,cx+w*.42,yy,[71,70,63],Math.max(1,u*.45));}
      g.rect(cx-w*.34,cy-h*.28,w*.28,h*.17,[69,82,86]);return true;
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
        for (let wy = base - h + 5; wy < base - 6; wy += 8) for (let wx = x + 4; wx < x + w - 4; wx += 7) {
          const sem = hs(Math.floor(wx), Math.floor(wy), 7);
          if (sem <= 0.55) continue;
          // cada ventana parpadea a su ritmo: la ciudad se ve habitada, no un decorado
          const vida = 0.55 + 0.45 * Math.sin(t * (0.5 + sem * 1.6) + sem * 31);
          if (vida > 0.42) g.rect(wx, wy, 3, 4, [255, 214, 120], Math.min(1, vida));
        }
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
  return false;
}

export const TIPOS_PRO = ['poligono', 'linea', 'nubes', 'olas', 'particulas', 'rayos', 'barco', 'pez', 'roca', 'hielo', 'duna', 'algas', 'sargazo', 'faro', 'silueta', 'radar', 'tic_tac', 'ovni', 'explosion', 'ciudad', 'bosque', 'hidrofono', 'sonar', 'microfono', 'volcan', 'fuego', 'lago', 'avion', 'tren', 'submarino', 'barril', 'cerveza', 'cerveceria', 'tsunami', 'deslizamiento', 'terremoto', 'libro', 'moneda', 'libro', 'moneda', 'paracaidas', 'televisor', 'esfera', 'dodecaedro', 'zepelin', 'radio', 'telegrafo', 'aurora', 'vaca', 'puente', 'satelite', 'bomba', 'tornado', 'fosil', 'periodico'];
