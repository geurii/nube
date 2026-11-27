# Brayant en 3D de formas angulosas + su cuarto. Todo se construye por código (sin fotos).
# Uso: blender -b -P brayant.py -- <salida.png> <vista: escena|cara>
import bpy, bmesh, math, random, sys
from mathutils import Vector, Matrix

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['brayant.png', 'escena']
SALIDA, VISTA = args[0], (args[1] if len(args) > 1 else 'escena')
random.seed(7)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

def lin(h):
    h = h.lstrip('#')
    def c(v):
        v = int(v, 16) / 255
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return (c(h[0:2]), c(h[2:4]), c(h[4:6]), 1)

def mat(nombre, color, rug=0.8, color2=None, escala=9.0, metal=0.0, emite=0.0):
    m = bpy.data.materials.new(nombre); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = lin(color)
    b.inputs['Roughness'].default_value = rug
    b.inputs['Metallic'].default_value = metal
    if color2:  # manchas suaves: ropa gastada / pintura
        tc = nt.nodes.new('ShaderNodeTexCoord'); n = nt.nodes.new('ShaderNodeTexNoise')
        n.inputs['Scale'].default_value = escala; n.inputs['Detail'].default_value = 6
        r = nt.nodes.new('ShaderNodeValToRGB')
        r.color_ramp.elements[0].position = 0.42; r.color_ramp.elements[0].color = lin(color)
        r.color_ramp.elements[1].position = 0.66; r.color_ramp.elements[1].color = lin(color2)
        nt.links.new(tc.outputs['Object'], n.inputs['Vector'])
        nt.links.new(n.outputs['Fac'], r.inputs['Fac'])
        nt.links.new(r.outputs['Color'], b.inputs['Base Color'])
    if emite:
        e = nt.nodes.new('ShaderNodeEmission'); e.inputs['Color'].default_value = lin(color)
        e.inputs['Strength'].default_value = emite
        nt.links.new(e.outputs['Emission'], nt.nodes['Material Output'].inputs['Surface'])
    return m

PIEL = mat('piel', '#b9825f', 0.65, '#a9714f', 7)
LABIO = mat('labio', '#9a5a4c', 0.6)
PELO = mat('pelo', '#1d130e', 0.9, '#2e2018', 30)
LADO = mat('lado', '#4a3429', 0.95, '#6b4a38', 60)
BARBA = mat('barba', '#231711', 0.95)
SOMBRA = mat('sombra', '#8a5c44', 0.9, '#6e4936', 55)
BLANCO = mat('blanco', '#d9d2c8', 0.4)
IRIS = mat('iris', '#2a170c', 0.2)
ROJO = mat('rojo', '#a5423c', 0.95, '#7d3330', 5.5)
ROJO2 = mat('rojo2', '#7f3130', 0.95, '#652725', 8)
MANCHA = mat('mancha', '#6f2f2b', 1.0)
CORDON = mat('cordon', '#b9b0a2', 0.9)
METAL = mat('metal', '#c9ccd2', 0.25, metal=1.0)
PANT = mat('pant', '#34373d', 0.92, '#4a4d53', 4)
TINTA = mat('tinta', '#12100f', 0.85)
ZAP = mat('zap', '#26211e', 0.8)
SUELA = mat('suela', '#8d8478', 0.9)
PARED = mat('pared', '#a8955f', 0.95, '#98865a', 2.5)
PUNTO = mat('punto', '#5b4c33', 0.95)
MADERA = mat('madera', '#4a2a19', 0.6, '#5d3822', 6)
PISO = mat('piso', '#3d2619', 0.7, '#4c3020', 3)
COLCHA = mat('colcha', '#1f5560', 0.9, '#27626d', 5)
SABANA = mat('sabana', '#b9b5ad', 0.9)
ROSA = mat('rosa', '#b97c83', 0.9)
PANTALLA = mat('pantalla', '#ffd99a', 0.9, emite=3.2)

def objeto(nombre, verts, caras, m, plano=True):
    me = bpy.data.meshes.new(nombre); me.from_pydata([tuple(v) for v in verts], [], caras); me.update()
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    me.materials.append(m)
    o = bpy.data.objects.new(nombre, me); sc.collection.objects.link(o)
    if not plano:
        for p in me.polygons: p.use_smooth = True
    return o

def loft(nombre, anillos, m, n=10, ruido=0.0, giro=0.0, tapas=True):
    """anillos: lista de (centro, radio_lado, radio_frente[, eje]) -> malla facetada continua."""
    centros = [Vector(a[0]) for a in anillos]; verts = []
    prev_u = None
    for i, a in enumerate(anillos):
        t = (centros[min(i + 1, len(centros) - 1)] - centros[max(i - 1, 0)]).normalized()
        if len(a) > 3: t = Vector(a[3]).normalized()
        ref = Vector((1, 0, 0)) if prev_u is None else prev_u
        u = (ref - t * ref.dot(t))
        if u.length < 1e-4: u = Vector((0, 1, 0)) - t * t.y
        u.normalize(); prev_u = u; v = t.cross(u).normalized()
        for k in range(n):
            ang = 2 * math.pi * k / n + giro + (math.pi / n if i % 2 else 0) * 0.35
            p = centros[i] + u * math.cos(ang) * a[1] + v * math.sin(ang) * a[2]
            if ruido: p += Vector((random.uniform(-1, 1), random.uniform(-1, 1), random.uniform(-1, 1))) * ruido
            verts.append(p)
    caras = []
    for i in range(len(anillos) - 1):
        for k in range(n):
            a0, a1 = i * n + k, i * n + (k + 1) % n
            b0, b1 = a0 + n, a1 + n
            caras.append((a0, a1, b1)); caras.append((a0, b1, b0))
    if tapas:
        caras.append(tuple(range(n))[::-1]); caras.append(tuple(range((len(anillos) - 1) * n, len(anillos) * n)))
    return objeto(nombre, verts, caras, m)

def bola(nombre, c, r, m, sub=1, esc=(1, 1, 1), rot=(0, 0, 0), ruido=0.0):
    bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=r)
    if ruido:
        for v in bm.verts: v.co *= 1 + random.uniform(-ruido, ruido)
    me = bpy.data.meshes.new(nombre); bm.to_mesh(me); bm.free(); me.materials.append(m)
    o = bpy.data.objects.new(nombre, me); sc.collection.objects.link(o)
    o.location = c; o.scale = esc; o.rotation_euler = rot
    return o

def caja(nombre, c, dim, m, rot=(0, 0, 0), bisel=0.01):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=dim, verts=bm.verts)
    me = bpy.data.meshes.new(nombre); bm.to_mesh(me); bm.free(); me.materials.append(m)
    o = bpy.data.objects.new(nombre, me); sc.collection.objects.link(o); o.location = c; o.rotation_euler = rot
    if bisel:
        md = o.modifiers.new('b', 'BEVEL'); md.width = bisel; md.segments = 1
    return o

def tubo(nombre, puntos, r, m):
    return loft(nombre, [(p, r, r) for p in puntos], m, n=6)

# ---------------- CUARTO ----------------
caja('piso', (0, 0, -0.03), (6, 6, 0.06), PISO, bisel=0)
caja('pared_f', (0, 1.25, 1.5), (6, 0.1, 3), PARED, bisel=0)
caja('pared_i', (-1.75, 0, 1.5), (0.1, 5, 3), PARED, bisel=0)
for fila in range(22):
    z = 0.55 + fila * 0.11
    for col in range(36):
        x = -1.7 + col * 0.115 + (0.057 if fila % 2 else 0)
        bola('p', (x, 1.195, z), 0.011, PUNTO, 1, (1, 0.25, 1.25))
# cama
caja('base', (0.05, 0.18, 0.2), (1.75, 0.95, 0.22), MADERA, bisel=0.02)
caja('colchon', (0.05, 0.18, 0.40), (1.72, 0.92, 0.18), SABANA, bisel=0.045)
caja('colcha', (0.14, 0.18, 0.505), (1.56, 0.935, 0.055), COLCHA, bisel=0.02)
caja('raya1', (0.05, -0.285, 0.405), (1.70, 0.012, 0.022), ROJO2, bisel=0)
caja('raya2', (0.05, -0.285, 0.365), (1.70, 0.012, 0.016), COLCHA, bisel=0)
caja('cabecera', (-0.95, 0.2, 0.55), (0.09, 1.0, 0.9), MADERA, bisel=0.02)
caja('almohada', (-0.68, 0.24, 0.60), (0.34, 0.66, 0.13), SABANA, (0, 0.12, 0), 0.06)
# mesa de noche, lámpara y panel
caja('mesa', (0.62, 0.92, 0.42), (0.55, 0.40, 0.84), MADERA, bisel=0.02)
caja('cajon', (0.62, 0.715, 0.66), (0.45, 0.012, 0.17), PISO)
bola('tirador', (0.62, 0.70, 0.66), 0.018, METAL, 2)
loft('pie', [((0.66, 0.9, 0.84), 0.075, 0.075), ((0.66, 0.9, 0.87), 0.05, 0.05), ((0.66, 0.9, 0.98), 0.018, 0.018), ((0.66, 0.9, 1.10), 0.018, 0.018)], MADERA, 8)
loft('pantalla', [((0.66, 0.9, 1.08), 0.17, 0.17), ((0.66, 0.9, 1.30), 0.11, 0.11)], PANTALLA, 10, tapas=False)
caja('panel', (-0.55, 1.14, 0.95), (0.34, 0.05, 0.75), ROSA, bisel=0.03)
caja('mueble', (-0.55, 1.05, 0.38), (0.6, 0.3, 0.76), MADERA)

# ---------------- PIERNAS ----------------
for s in (-1, 1):
    cadera = (s * 0.115, 0.08, 0.64); rodilla = (s * 0.185, -0.40, 0.635); tobillo = (s * 0.20, -0.47, 0.11)
    loft('muslo', [((s * 0.11, 0.17, 0.66), 0.105, 0.11), (cadera, 0.115, 0.105), ((s * 0.155, -0.18, 0.645), 0.098, 0.09),
                   ((s * 0.18, -0.34, 0.642), 0.078, 0.076), ((s * 0.188, -0.43, 0.63), 0.074, 0.072)], PANT, 9, 0.004)
    loft('pierna', [((s * 0.186, -0.40, 0.66), 0.07, 0.072), ((s * 0.19, -0.455, 0.55), 0.075, 0.075), ((s * 0.195, -0.455, 0.36), 0.064, 0.066),
                    ((s * 0.20, -0.468, 0.18), 0.054, 0.056), ((s * 0.20, -0.47, 0.10), 0.062, 0.064)], PANT, 9, 0.004)
    caja('bolsillo', (s * 0.262, -0.17, 0.645), (0.022, 0.17, 0.11), PANT, (0, 0, s * -0.12), 0.006)
    loft('zapato', [((s * 0.20, -0.40, 0.065), 0.055, 0.045, (0, -1, 0)), ((s * 0.205, -0.48, 0.075), 0.068, 0.062, (0, -1, 0)),
                    ((s * 0.21, -0.58, 0.06), 0.064, 0.045, (0, -1, 0)), ((s * 0.212, -0.65, 0.048), 0.038, 0.028, (0, -1, 0))], ZAP, 8)
    caja('suela', (s * 0.207, -0.525, 0.015), (0.135, 0.29, 0.03), SUELA, bisel=0.012)
loft('pelvis', [((0, 0.09, 0.58), 0.17, 0.12), ((0, 0.09, 0.68), 0.215, 0.145), ((0, 0.08, 0.74), 0.20, 0.13)], PANT, 11)

# ---------------- SUDADERA ----------------
loft('torso', [((0, 0.065, 0.70), 0.232, 0.162), ((0, 0.065, 0.755), 0.222, 0.152), ((0, 0.07, 0.775), 0.245, 0.170),
               ((0, 0.065, 0.88), 0.228, 0.158), ((0, 0.055, 1.00), 0.232, 0.162), ((0, 0.045, 1.11), 0.260, 0.165),
               ((0, 0.045, 1.19), 0.262, 0.148), ((0, 0.05, 1.245), 0.185, 0.118), ((0, 0.05, 1.285), 0.095, 0.085)], ROJO, 13, 0.0045)
loft('elastico', [((0, 0.065, 0.695), 0.228, 0.158), ((0, 0.065, 0.752), 0.226, 0.156)], ROJO2, 13, 0.002, tapas=False)
# cuello y capucha caída
loft('cuello_rojo', [((0, 0.045, 1.245), 0.135, 0.108), ((0, 0.052, 1.30), 0.10, 0.092)], ROJO2, 11, tapas=False)
loft('capucha', [((-0.155, 0.055, 1.235), 0.036, 0.04, (0.2, 1, 0.1)), ((-0.14, 0.155, 1.27), 0.058, 0.06, (0.6, 1, 0)),
                 ((0.0, 0.205, 1.27), 0.085, 0.08, (1, 0, 0)), ((0.14, 0.155, 1.27), 0.058, 0.06, (0.6, -1, 0)),
                 ((0.155, 0.055, 1.235), 0.036, 0.04, (-0.2, -1, -0.1))], ROJO, 8, 0.006)
for s in (-1, 1):
    tubo('solapa', [(s * 0.135, 0.01, 1.255), (s * 0.095, -0.07, 1.24), (s * 0.015, -0.105, 1.19)], 0.026, ROJO)
    tubo('cordon', [(s * 0.045, -0.115, 1.19), (s * 0.058, -0.138, 1.08), (s * 0.055, -0.128, 0.99)], 0.0065, CORDON)
    tubo('punta', [(s * 0.055, -0.128, 0.99), (s * 0.055, -0.127, 0.955)], 0.0085, METAL)
objeto('canguro', [(-0.09, -0.118, 0.955), (0.09, -0.118, 0.955), (0.165, -0.105, 0.85), (0.17, -0.108, 0.785), (-0.17, -0.108, 0.785), (-0.165, -0.105, 0.85),
                   (-0.075, -0.108, 0.94), (0.075, -0.108, 0.94), (0.15, -0.085, 0.845), (0.155, -0.085, 0.795), (-0.155, -0.085, 0.795), (-0.15, -0.085, 0.845)],
       [(0, 1, 2, 3, 4, 5), (0, 6, 7, 1), (1, 7, 8, 2), (2, 8, 9, 3), (3, 9, 10, 4), (4, 10, 11, 5), (5, 11, 6, 0)], ROJO)
for (x, y, z, r) in [(0.09, -0.108, 1.12, 0.014), (-0.12, -0.100, 1.03, 0.019), (0.05, -0.128, 0.82, 0.011), (-0.07, -0.124, 0.865, 0.008)]:
    bola('mancha', (x, y, z), r, MANCHA, 1, (1.3, 0.12, 0.8), ruido=0.35)

# ---------------- BRAZOS, MANOS, TATUAJES ----------------
def mano(s):
    c = Vector((s * 0.355, -0.135, 0.585))
    loft('palma', [((s * 0.350, -0.085, 0.625), 0.033, 0.021), ((s * 0.355, -0.13, 0.59), 0.047, 0.022), (c + Vector((0, -0.04, -0.012)), 0.046, 0.017)], PIEL, 8)
    for i in range(4):
        x = s * (0.322 + i * 0.023)
        largo = [0.085, 0.098, 0.093, 0.072][i if s > 0 else 3 - i]
        loft('dedo', [((x, -0.17, 0.575), 0.0115, 0.0115), ((x + s * 0.003 * i, -0.17 - largo * 0.55, 0.552), 0.0105, 0.0105),
                      ((x + s * 0.004 * i, -0.17 - largo, 0.538), 0.0085, 0.0085)], PIEL, 6)
    loft('pulgar', [((s * 0.322, -0.11, 0.595), 0.016, 0.016), ((s * 0.288, -0.155, 0.568), 0.013, 0.013), ((s * 0.275, -0.19, 0.552), 0.0095, 0.0095)], PIEL, 6)

for s in (-1, 1):
    hombro = (s * 0.22, 0.05, 1.18); codo = Vector((s * 0.348, 0.035, 0.915)); muneca = Vector((s * 0.35, -0.075, 0.63))
    loft('manga', [((s * 0.17, 0.05, 1.19), 0.085, 0.085), (hombro, 0.092, 0.088), ((s * 0.295, 0.05, 1.065), 0.070, 0.070),
                   ((s * 0.345, 0.04, 0.945), 0.064, 0.064), (tuple(codo + Vector((0, 0, -0.02))), 0.067, 0.065)], ROJO, 9, 0.006)
    d = (muneca - codo)
    remangado = codo + d * 0.16
    loft('puno', [(tuple(codo + d * 0.02), 0.070, 0.068), (tuple(codo + d * 0.09), 0.060, 0.058), (tuple(remangado), 0.062, 0.060)], ROJO2, 10, 0.004)
    loft('antebrazo', [(tuple(codo + d * 0.10), 0.048, 0.044), (tuple(codo + d * 0.38), 0.048, 0.042), (tuple(codo + d * 0.70), 0.036, 0.031), (tuple(muneca), 0.027, 0.023)], PIEL, 9)
    # tatuaje negro: bandas y rombos
    for (a, b) in [(0.30, 0.325), (0.54, 0.555)]:
        ra = 0.0505 - (a - 0.38) * 0.03; rb = ra - 0.001
        loft('banda', [(tuple(codo + d * a), ra, ra * 0.89), (tuple(codo + d * b), rb, rb * 0.89)], TINTA, 9, tapas=False)
    u = d.normalized(); lat = Vector((1, 0, 0)) - u * u.x; lat.normalize(); fr = u.cross(lat).normalized()
    if fr.y > 0: fr = -fr
    for k, t in enumerate((0.37, 0.43, 0.49)):
        radio = 0.049 - (t - 0.38) * 0.06
        for j, desvio in enumerate((-0.42, 0.28)):
            n_ = (fr * math.cos(desvio) + lat * s * math.sin(desvio)).normalized()
            o = codo + d * (t + 0.02 * j) + n_ * (radio * 0.93)
            lado_ = u.cross(n_).normalized()
            objeto('rombo', [o + u * 0.024, o + lado_ * 0.015, o - u * 0.024, o - lado_ * 0.015], [(0, 1, 2, 3)], TINTA)
    mano(s)

# ---------------- CABEZA ----------------
H = Vector((0.0, 0.015, 1.455))
cabeza_obj = []
def en_cabeza(o):
    cabeza_obj.append(o); return o
def P(x, y, z): return (H.x + x, H.y + y, H.z + z)

en_cabeza(loft('cuello', [((0, 0.045, 1.26), 0.064, 0.064), ((0, 0.035, 1.34), 0.056, 0.058), ((0, 0.025, 1.39), 0.060, 0.062)], PIEL, 10))
# perfil de la cabeza: (z, centro_y, ancho, fondo)
perfil = [(-0.118, -0.045, 0.030, 0.028), (-0.100, -0.028, 0.064, 0.062), (-0.070, -0.012, 0.083, 0.086), (-0.030, 0.000, 0.095, 0.100),
          (0.015, 0.006, 0.101, 0.108), (0.055, 0.010, 0.103, 0.112), (0.095, 0.014, 0.099, 0.108), (0.128, 0.018, 0.082, 0.090), (0.148, 0.022, 0.046, 0.052)]
en_cabeza(loft('cara', [(P(0, cy, z), a, f, (0, 0, 1)) for z, cy, a, f in perfil], PIEL, 14))
def frente(x, z):
    """punto sobre la superficie delantera de la cara"""
    for i in range(len(perfil) - 1):
        z0, c0, a0, f0 = perfil[i]; z1, c1, a1, f1 = perfil[i + 1]
        if z0 <= z <= z1:
            t = (z - z0) / (z1 - z0); cy = c0 + (c1 - c0) * t; a = a0 + (a1 - a0) * t; f = f0 + (f1 - f0) * t
            return cy - f * math.sqrt(max(0.05, 1 - (x / a) ** 2))
    return -0.09

for s in (-1, 1):
    ex = s * 0.037; ey = frente(ex, 0.022)
    en_cabeza(bola('ojo', P(ex, ey + 0.004, 0.020), 0.0165, BLANCO, 3, (1.15, 0.55, 0.62)))
    en_cabeza(bola('iris', P(ex * 0.97, ey - 0.0058, 0.019), 0.0076, IRIS, 3, (1, 0.45, 1)))
    en_cabeza(bola('brillo', P(ex * 0.97 + 0.0025, ey - 0.0098, 0.0222), 0.0016, BLANCO, 2))
    en_cabeza(tubo('parpado', [P(ex - 0.021, ey + 0.001, 0.026), P(ex, ey - 0.0085, 0.0318), P(ex + 0.021, ey + 0.001, 0.027)], 0.0036, PIEL))
    en_cabeza(tubo('pestana', [P(ex - 0.0185, ey - 0.001, 0.0255), P(ex, ey - 0.0092, 0.0285), P(ex + 0.0185, ey - 0.001, 0.0262)], 0.0017, BARBA))
    # cejas gruesas; la parte interior sube un poco (preocupado)
    en_cabeza(loft('ceja', [(P(s * 0.013, frente(s * 0.013, 0.050) - 0.005, 0.0505), 0.0075, 0.006), (P(s * 0.040, frente(s * 0.040, 0.050) - 0.006, 0.0525), 0.0085, 0.006),
                            (P(s * 0.068, frente(s * 0.068, 0.046) - 0.003, 0.044), 0.0035, 0.004)], BARBA, 6))
    # orejas
    en_cabeza(bola('oreja', P(s * 0.103, 0.020, 0.005), 0.029, PIEL, 2, (0.48, 0.80, 1.18), (0.1, 0, s * -0.25)))
    en_cabeza(bola('hueco', P(s * 0.115, 0.014, 0.004), 0.0135, SOMBRA, 1, (0.3, 0.8, 1.15)))
# arete de aro
aro = []
for k in range(13):
    a = 2 * math.pi * k / 12
    aro.append(P(-0.113 - 0.004 * math.cos(a), 0.010 + 0.013 * math.sin(a), -0.034 + 0.013 * math.cos(a)))
en_cabeza(tubo('arete', aro, 0.0034, METAL))
# nariz
y0 = frente(0, 0.03)
nv = [P(0, y0 - 0.003, 0.040), P(-0.010, frente(0.010, 0.01) - 0.004, 0.006), P(0.010, frente(0.010, 0.01) - 0.004, 0.006), P(0, frente(0, 0) - 0.020, -0.005),
      P(-0.026, frente(0.026, -0.02) - 0.003, -0.021), P(0.026, frente(0.026, -0.02) - 0.003, -0.021), P(0, frente(0, -0.02) - 0.031, -0.019),
      P(-0.012, frente(0.012, -0.03) - 0.006, -0.031), P(0.012, frente(0.012, -0.03) - 0.006, -0.031)]
en_cabeza(objeto('nariz', nv, [(0, 1, 3), (0, 3, 2), (1, 4, 3), (2, 3, 5), (4, 6, 3), (3, 6, 5), (4, 7, 6), (6, 8, 5), (7, 8, 6),
                               (0, 2, 1), (1, 2, 8), (1, 8, 7), (1, 7, 4), (2, 5, 8)], PIEL))
# barba corta (sombra), bigote, labios y chiva
for z0_, z1_ in [(-0.119, -0.098), (-0.098, -0.075), (-0.075, -0.052)]:
    pts_a = []; pts_b = []
    for k in range(17):
        t = -1 + 2 * k / 16
        for lista, z in ((pts_a, z0_), (pts_b, z1_ if z1_ < -0.06 else z1_ + 0.045 * abs(t) ** 2)):
            ancho = next(a0 + (a1 - a0) * (z - z0p) / (z1p - z0p) for (z0p, _, a0, _), (z1p, _, a1, _) in zip(perfil, perfil[1:]) if z0p - 0.002 <= z <= z1p)
            x = t * ancho * 0.97
            lista.append(Vector(P(x, frente(x, max(z, -0.118)) - 0.0028, z)))
    vs = pts_a + pts_b
    en_cabeza(objeto('rastro', vs, [(k, k + 1, 17 + k + 1, 17 + k) for k in range(16)], SOMBRA))
boca_z = -0.057
def sobre(x, z, sale): return P(x, frente(x, z) - sale, z)
en_cabeza(loft('labio_sup', [(sobre(-0.030, boca_z + 0.001, 0.003), 0.002, 0.002), (sobre(-0.011, boca_z + 0.0065, 0.008), 0.0055, 0.005), (sobre(0, boca_z + 0.0045, 0.008), 0.0048, 0.005),
                             (sobre(0.011, boca_z + 0.0065, 0.008), 0.0055, 0.005), (sobre(0.030, boca_z + 0.001, 0.003), 0.002, 0.002)], LABIO, 7))
en_cabeza(loft('labio_inf', [(sobre(-0.026, boca_z - 0.003, 0.003), 0.002, 0.002), (sobre(0, boca_z - 0.0085, 0.0095), 0.0072, 0.0065), (sobre(0.026, boca_z - 0.003, 0.003), 0.002, 0.002)], LABIO, 7))
for s in (-1, 1):
    en_cabeza(loft('bigote', [(sobre(s * 0.001, -0.043, 0.0075), 0.0062, 0.0045), (sobre(s * 0.020, -0.046, 0.0075), 0.0058, 0.0045), (sobre(s * 0.037, -0.059, 0.004), 0.0022, 0.0022)], BARBA, 6))
    en_cabeza(tubo('chiva_lado', [sobre(s * 0.035, -0.061, 0.003), sobre(s * 0.033, -0.082, 0.004), sobre(s * 0.018, -0.099, 0.005)], 0.0044, BARBA))
en_cabeza(bola('mosca', sobre(0, -0.076, 0.004), 0.0075, BARBA, 1, (1.1, 0.5, 1.0), ruido=0.2))
en_cabeza(bola('chiva', P(0, frente(0, -0.100) + 0.003, -0.106), 0.026, BARBA, 2, (1.35, 0.62, 0.78), ruido=0.14))

# pelo: base corta, lados degradados y rizos arriba
en_cabeza(loft('nuca', [(P(0, 0.030, -0.040), 0.088, 0.088, (0, 0, 1)), (P(0, 0.034, 0.025), 0.1050, 0.098, (0, 0, 1)), (P(0, 0.030, 0.085), 0.1050, 0.108, (0, 0, 1))], LADO, 14, 0.001, tapas=False))
en_cabeza(loft('casquete', [(P(0, 0.027, 0.083), 0.1065, 0.113, (0, 0, 1)), (P(0, 0.024, 0.125), 0.094, 0.103, (0, 0, 1)), (P(0, 0.022, 0.158), 0.056, 0.066, (0, 0, 1)), (P(0, 0.022, 0.170), 0.015, 0.018, (0, 0, 1))], PELO, 14, 0.002))
rizos = 0
while rizos < 300:
    th = random.uniform(0, 2 * math.pi); fi = random.uniform(0.0, 1.35)
    x = 0.098 * math.sin(fi) * math.cos(th); y = 0.022 + 0.106 * math.sin(fi) * math.sin(th); z = 0.092 + 0.092 * math.cos(fi)
    delante = y < -0.045
    if (delante and z < 0.108) or z < 0.093 or (abs(x) > 0.085 and z < 0.11 and y < 0.04): continue
    if y > 0.075 and z < 0.115: z = random.uniform(0.06, 0.115)
    en_cabeza(bola('rizo', P(x, y, z), random.uniform(0.0135, 0.021), PELO, 1, (1, 1, random.uniform(0.75, 1.1)), (random.random(), random.random(), random.random()), 0.22))
    rizos += 1
for x, z in [(-0.052, 0.112), (-0.030, 0.104), (-0.008, 0.108), (0.016, 0.101), (0.040, 0.109), (0.060, 0.104)]:
    en_cabeza(bola('flequillo', P(x, frente(x, 0.098) - 0.004, z), 0.0165, PELO, 1, (1, 0.8, 0.9), (x * 30, z * 20, 0), 0.25))

# girar la cabeza un poco y bajarla (pensativo)
eje = Vector((0, 0.035, 1.34))
rot = Matrix.Translation(eje) @ Matrix.Rotation(math.radians(-9), 4, 'Z') @ Matrix.Rotation(math.radians(5), 4, 'X') @ Matrix.Translation(-eje)
bpy.context.view_layer.update()
for o in cabeza_obj:
    if o.name.startswith('cuello'): continue
    o.matrix_world = rot @ o.matrix_world

# ---------------- LUCES Y CÁMARA ----------------
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
bg = w.node_tree.nodes['Background']; bg.inputs['Color'].default_value = (0.09, 0.075, 0.08, 1); bg.inputs['Strength'].default_value = 1.0
def mira(o, hacia):
    o.rotation_euler = (Vector(hacia) - o.location).to_track_quat('-Z', 'Y').to_euler()
def luz(tipo, pos, energia, color, tam=0.5, hacia=(0, 0, 1.2)):
    l = bpy.data.lights.new('l', tipo); l.energy = energia; l.color = color
    if tipo == 'AREA': l.size = tam
    else: l.shadow_soft_size = tam
    o = bpy.data.objects.new('l', l); sc.collection.objects.link(o); o.location = pos
    if tipo == 'AREA': mira(o, hacia)
    return o
luz('POINT', (0.66, 0.86, 1.16), 28, (1.0, 0.70, 0.40), 0.09)
luz('AREA', (-1.25, -1.75, 2.15), 34, (1.0, 0.91, 0.82), 0.9)
luz('AREA', (1.7, -1.0, 1.25), 9, (0.62, 0.72, 1.0), 1.2)
luz('AREA', (0.9, 0.55, 2.2), 14, (1.0, 0.76, 0.48), 0.4)
cam = bpy.data.cameras.new('c'); co = bpy.data.objects.new('c', cam); sc.collection.objects.link(co); sc.camera = co
if VISTA == 'cara':
    co.location = (-0.30, -1.15, 1.52); mira(co, (0.0, 0.0, 1.43)); cam.lens = 88
    ancho, alto = 720, 900
else:
    co.location = (-0.82, -2.65, 1.42); mira(co, (0.02, 0.0, 0.885)); cam.lens = 58
    ancho, alto = 720, 1280

sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 96; sc.cycles.use_denoising = False
sc.render.resolution_x, sc.render.resolution_y = ancho, alto
sc.render.image_settings.file_format = 'PNG'
sc.view_settings.view_transform = 'Filmic'
sc.render.filepath = SALIDA
bpy.ops.render.render(write_still=True)
print('LISTO', SALIDA)
