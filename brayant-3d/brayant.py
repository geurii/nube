# Brayant en 3D de formas angulosas + su cuarto. Todo se construye por código (sin fotos).
# Uso: blender -b -P brayant.py -- <salida.png> <vista: escena|cara>
import bpy, bmesh, math, random, sys
from mathutils import Vector, Matrix

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['brayant.png', 'escena']
SALIDA, VISTA = args[0], (args[1] if len(args) > 1 else 'escena')
ANIM = VISTA == 'anim'
CUADRO_INI = int(args[2]) if len(args) > 2 else 0
CUADRO_FIN = int(args[3]) if len(args) > 3 else 119
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
ROJO = mat('rojo', '#9c3a36', 0.96, '#74302d', 6.5)
ROJO2 = mat('rojo2', '#7f3130', 0.95, '#652725', 8)
MANCHA = mat('mancha', '#6f2f2b', 1.0)
CORDON = mat('cordon', '#b9b0a2', 0.9)
METAL = mat('metal', '#c9ccd2', 0.25, metal=1.0)
PANT = mat('pant', '#34363a', 0.94, '#4b4a44', 6)
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
PANTALLA = mat('pantalla', '#f2c985', 0.9, emite=1.25)
VENTANA = mat('ventana', '#23345c', 0.9, emite=0.9)

def gastar(m, color, escala, desde=0.54, hasta=0.70, fuerza=0.55):
    """segunda capa de manchas suaves sobre la tela"""
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    if not b.inputs['Base Color'].links: return
    base = b.inputs['Base Color'].links[0].from_socket
    tc = nt.nodes.new('ShaderNodeTexCoord'); n = nt.nodes.new('ShaderNodeTexNoise')
    n.inputs['Scale'].default_value = escala; n.inputs['Detail'].default_value = 9; n.inputs['Roughness'].default_value = 0.72
    mr = nt.nodes.new('ShaderNodeMapRange')
    mr.inputs['From Min'].default_value = desde; mr.inputs['From Max'].default_value = hasta; mr.inputs['To Max'].default_value = fuerza
    mx = nt.nodes.new('ShaderNodeMixRGB'); mx.inputs['Color2'].default_value = lin(color)
    nt.links.new(tc.outputs['Object'], n.inputs['Vector']); nt.links.new(n.outputs['Fac'], mr.inputs['Value'])
    nt.links.new(mr.outputs['Result'], mx.inputs['Fac']); nt.links.new(base, mx.inputs['Color1'])
    nt.links.new(mx.outputs['Color'], b.inputs['Base Color'])
gastar(ROJO, '#4a2724', 14)
gastar(ROJO, '#b9655c', 31, 0.57, 0.70, 0.45)   # zonas desteñidas
gastar(PANT, '#5a5044', 11)

def hilos(centro_y_puntos, n, m, largo=0.012):
    """hilachas en los bordes gastados"""
    pts = [Vector(p) for p in centro_y_puntos]
    for _ in range(n):
        i = random.randrange(len(pts) - 1); q = random.random()
        p = pts[i].lerp(pts[i + 1], q)
        fin = p + Vector((random.uniform(-0.004, 0.004), random.uniform(-0.006, 0.001), -random.uniform(0.003, largo)))
        loft('hilo', [(p, 0.0017, 0.0017), (fin, 0.0005, 0.0005)], m, n=3)

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

def fino(anillos, ancho, fondo=None, cx=1.0):
    """adelgaza una lista de anillos"""
    fondo = ancho if fondo is None else fondo
    return [((a[0][0] * cx, a[0][1], a[0][2]), a[1] * ancho, a[2] * fondo) + tuple(a[3:]) for a in anillos]

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
caja('mesa', (0.70, 0.92, 0.42), (0.55, 0.40, 0.84), MADERA, bisel=0.02)
caja('cajon', (0.70, 0.715, 0.66), (0.45, 0.012, 0.17), PISO)
bola('tirador', (0.70, 0.70, 0.66), 0.018, METAL, 2)
loft('pie', [((0.74, 0.9, 0.84), 0.075, 0.075), ((0.74, 0.9, 0.87), 0.05, 0.05), ((0.74, 0.9, 0.98), 0.018, 0.018), ((0.74, 0.9, 1.10), 0.018, 0.018)], MADERA, 8)
loft('pantalla', [((0.74, 0.9, 1.08), 0.17, 0.17), ((0.74, 0.9, 1.30), 0.11, 0.11)], PANTALLA, 10, tapas=False)
caja('panel', (-0.55, 1.14, 0.95), (0.34, 0.05, 0.75), ROSA, bisel=0.03)
caja('mueble', (-0.55, 1.05, 0.38), (0.6, 0.3, 0.76), MADERA)

# ---------------- PIERNAS ----------------
for s in (-1, 1):
    cadera = (s * 0.095, 0.08, 0.64); rodilla = (s * 0.165, -0.40, 0.635)
    loft('muslo', fino([((s * 0.09, 0.15, 0.655), 0.098, 0.10), (cadera, 0.102, 0.092), ((s * 0.135, -0.18, 0.642), 0.082, 0.077),
                   ((s * 0.162, -0.34, 0.640), 0.063, 0.062), ((s * 0.170, -0.43, 0.628), 0.060, 0.060)], 0.94), PANT, 11, 0.003)
    loft('pierna', fino([((s * 0.167, -0.40, 0.655), 0.058, 0.060), ((s * 0.172, -0.452, 0.55), 0.061, 0.062), ((s * 0.178, -0.452, 0.36), 0.052, 0.055),
                    ((s * 0.183, -0.468, 0.18), 0.043, 0.046), ((s * 0.183, -0.47, 0.10), 0.052, 0.055)], 0.96), PANT, 11, 0.003)
    caja('costura', (s * 0.172, -0.245, 0.716), (0.075, 0.13, 0.008), PANT, (0.015, 0, s * -0.2), 0.003)
    loft('zapato', [((s * 0.183, -0.40, 0.065), 0.050, 0.043, (0, -1, 0)), ((s * 0.188, -0.48, 0.072), 0.060, 0.058, (0, -1, 0)),
                    ((s * 0.193, -0.575, 0.058), 0.056, 0.042, (0, -1, 0)), ((s * 0.195, -0.64, 0.047), 0.034, 0.026, (0, -1, 0))], ZAP, 9)
    caja('suela', (s * 0.19, -0.52, 0.015), (0.118, 0.275, 0.03), SUELA, bisel=0.012)
loft('pelvis', fino([((0, 0.09, 0.58), 0.17, 0.12), ((0, 0.09, 0.68), 0.215, 0.145), ((0, 0.08, 0.74), 0.20, 0.13)], 0.78, 0.82), PANT, 13)

# ---------------- SUDADERA ----------------
loft('torso', fino([((0, 0.065, 0.70), 0.232, 0.162), ((0, 0.065, 0.755), 0.222, 0.152), ((0, 0.07, 0.775), 0.245, 0.170),
               ((0, 0.065, 0.88), 0.228, 0.158), ((0, 0.055, 1.00), 0.232, 0.162), ((0, 0.045, 1.11), 0.260, 0.165),
               ((0, 0.045, 1.19), 0.262, 0.148), ((0, 0.05, 1.245), 0.185, 0.118), ((0, 0.05, 1.285), 0.115, 0.095)], 0.78, 0.80), ROJO, 15, 0.0028)
loft('elastico', fino([((0, 0.065, 0.695), 0.228, 0.158), ((0, 0.065, 0.752), 0.226, 0.156)], 0.79, 0.81), ROJO2, 15, 0.001, tapas=False)
# cuello y capucha caída
loft('cuello_rojo', [((0, 0.045, 1.245), 0.135, 0.108), ((0, 0.052, 1.30), 0.10, 0.092)], ROJO2, 11, tapas=False)
loft('capucha', [((-0.105, 0.055, 1.238), 0.026, 0.03, (0.2, 1, 0.1)), ((-0.098, 0.13, 1.262), 0.040, 0.042, (0.6, 1, 0)),
                 ((0.0, 0.165, 1.255), 0.062, 0.052, (1, 0, 0)), ((0.098, 0.13, 1.262), 0.040, 0.042, (0.6, -1, 0)),
                 ((0.105, 0.055, 1.238), 0.026, 0.03, (-0.2, -1, -0.1))], ROJO, 10, 0.003)
for s in (-1, 1):
    tubo('solapa', [(s * 0.094, 0.01, 1.258), (s * 0.068, -0.052, 1.236), (s * 0.010, -0.082, 1.195)], 0.017, ROJO)
    tubo('cordon', [(s * 0.036, -0.090, 1.19), (s * 0.045, -0.106, 1.09), (s * 0.043, -0.102, 1.0)], 0.0048, CORDON)
    tubo('punta', [(s * 0.043, -0.102, 1.0), (s * 0.043, -0.102, 0.97)], 0.0065, METAL)
def cang(v): return (v[0] * 0.78, v[1] * 0.80 + 0.004, v[2])
objeto('canguro', [cang(v) for v in [(-0.09, -0.118, 0.955), (0.09, -0.118, 0.955), (0.165, -0.105, 0.85), (0.17, -0.108, 0.785), (-0.17, -0.108, 0.785), (-0.165, -0.105, 0.85),
                   (-0.075, -0.108, 0.94), (0.075, -0.108, 0.94), (0.15, -0.085, 0.845), (0.155, -0.085, 0.795), (-0.155, -0.085, 0.795), (-0.15, -0.085, 0.845)]],
       [(0, 1, 2, 3, 4, 5), (0, 6, 7, 1), (1, 7, 8, 2), (2, 8, 9, 3), (3, 9, 10, 4), (4, 10, 11, 5), (5, 11, 6, 0)], ROJO)

def borde(y_frente, z, ancho, n=14):
    return [(ancho * (-1 + 2 * k / (n - 1)), y_frente + 0.055 * (-1 + 2 * k / (n - 1)) ** 2, z) for k in range(n)]
hilos(borde(-0.064, 0.697, 0.165), 90, ROJO2)
hilos([cang(v) for v in [(-0.165, -0.107, 0.85), (-0.09, -0.121, 0.955), (0.09, -0.121, 0.955), (0.165, -0.107, 0.85)]], 40, ROJO2, 0.008)

# ---------------- BRAZOS, MANOS, TATUAJES ----------------
def mano(s):
    mx = s * 0.287
    c = Vector((mx + s * 0.005, -0.135, 0.585))
    loft('palma', [((mx, -0.085, 0.625), 0.029, 0.019), ((mx + s * 0.005, -0.13, 0.59), 0.041, 0.020), (c + Vector((0, -0.04, -0.012)), 0.040, 0.016)], PIEL, 8)
    for i in range(4):
        x = mx + s * (-0.027 + i * 0.020)
        largo = [0.080, 0.092, 0.087, 0.068][i if s > 0 else 3 - i]
        loft('dedo', [((x, -0.17, 0.575), 0.0100, 0.0100), ((x + s * 0.003 * i, -0.17 - largo * 0.55, 0.552), 0.0092, 0.0092),
                      ((x + s * 0.004 * i, -0.17 - largo, 0.538), 0.0074, 0.0074)], PIEL, 7)
    loft('pulgar', [((mx - s * 0.028, -0.11, 0.595), 0.0140, 0.0140), ((mx - s * 0.058, -0.155, 0.568), 0.0115, 0.0115), ((mx - s * 0.070, -0.19, 0.552), 0.0085, 0.0085)], PIEL, 7)

def textura_tatuaje():
    """diseño tribal: rejilla de arcos en punta con rombos, tinta negra con líneas de piel"""
    W, Hh = 384, 768
    img = bpy.data.images.new('tatuaje', W, Hh, alpha=True)
    piel = (0.725, 0.510, 0.373); tinta = (0.055, 0.045, 0.045)
    px = []
    for j in range(Hh):
        v = j / (Hh - 1)          # 0 = codo, 1 = muñeca
        for i in range(W):
            u = i / W
            a = u * 4.0; b = (v - 0.30) * 9.5
            borde = 0.045 * abs((u * 8.0) % 1.0 - 0.5) * 2
            dentro = 0.31 + borde < v < 0.90 - borde
            color = piel
            if dentro:
                color = tinta
                for des in (0.0, 0.5):
                    x = ((a + des) % 1.0) - 0.5
                    y = ((b + des * 2.0) % 2.0) - 1.0
                    ogiva = abs(abs(x) - 0.47 * math.cos(y * math.pi / 2) ** 2)
                    if ogiva < 0.040: color = piel
                x = ((a % 1.0) - 0.5); y = (b % 2.0) - 1.0
                rombo = abs(x) * 2.2 + abs(y) * 1.25
                if 0.46 < rombo < 0.60: color = piel
                if rombo < 0.16: color = piel
                gancho = math.hypot(x * 1.6, (abs(y) - 0.66) * 0.9)
                if 0.13 < gancho < 0.185 and x * y > -0.02: color = piel
            px.extend((color[0], color[1], color[2], 1.0))
    img.pixels = px
    img.pack()
    return img

def mat_tatuaje():
    m = bpy.data.materials.new('piel_tatuada'); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes['Principled BSDF']; b.inputs['Roughness'].default_value = 0.65
    tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = textura_tatuaje(); tx.extension = 'REPEAT'
    nt.links.new(tx.outputs['Color'], b.inputs['Base Color'])
    return m

def antebrazo_tatuado(codo, d, m):
    """antebrazo liso con coordenadas para envolver el diseño"""
    perfil_a = [(0.10, 0.040, 0.037), (0.24, 0.043, 0.039), (0.38, 0.041, 0.036), (0.54, 0.035, 0.031), (0.70, 0.029, 0.025), (0.86, 0.025, 0.022), (1.0, 0.022, 0.019)]
    n = 18
    u_ = d.normalized(); lat = Vector((1, 0, 0)) - u_ * u_.x; lat.normalize(); fr = u_.cross(lat).normalized()
    verts = []
    for t_, ra, rb in perfil_a:
        c = codo + d * t_
        for k in range(n):
            ang = 2 * math.pi * k / n
            verts.append(c + lat * math.cos(ang) * ra + fr * math.sin(ang) * rb)
    caras = []; uvs = []
    for i in range(len(perfil_a) - 1):
        for k in range(n):
            a0 = i * n + k; a1 = i * n + (k + 1) % n
            caras.append((a0, a1, a1 + n, a0 + n))
            va = perfil_a[i][0]; vb = perfil_a[i + 1][0]
            uvs.append([(k / n, va), ((k + 1) / n, va), ((k + 1) / n, vb), (k / n, vb)])
    me = bpy.data.meshes.new('antebrazo_t'); me.from_pydata([tuple(v) for v in verts], [], caras); me.update()
    capa = me.uv_layers.new(name='uv')
    for p, uv in zip(me.polygons, uvs):
        for li, co_uv in zip(p.loop_indices, uv): capa.data[li].uv = co_uv
    me.materials.append(m)
    o = bpy.data.objects.new('antebrazo_t', me); sc.collection.objects.link(o)

def brazo(s, hombro, codo, muneca, tatuado):
    hombro = Vector(hombro); codo = Vector(codo); muneca = Vector(muneca)
    a = (codo - hombro)
    loft('manga', [(Vector((s * 0.128, 0.05, 1.19)), 0.060, 0.064), (hombro, 0.068, 0.066), (hombro + a * 0.45, 0.051, 0.052),
                   (hombro + a * 0.86, 0.047, 0.047), (codo + a.normalized() * 0.012, 0.050, 0.049)], ROJO, 11, 0.003)
    d = (muneca - codo)
    loft('puno', [(codo + d * 0.02, 0.053, 0.051), (codo + d * 0.09, 0.045, 0.043), (codo + d * 0.16, 0.047, 0.045)], ROJO2, 12, 0.002)
    hilos([codo + d * 0.165 + Vector((x_, -0.044, 0)) for x_ in (-0.036, -0.012, 0.012, 0.036)], 16, ROJO2)
    if tatuado:
        antebrazo_tatuado(codo, d, mat_tatuaje())
    else:
        loft('antebrazo', [(codo + d * 0.10, 0.040, 0.037), (codo + d * 0.38, 0.040, 0.035), (codo + d * 0.70, 0.029, 0.025), (muneca, 0.022, 0.019)], PIEL, 12)

# brazo izquierdo (el del tatuaje): apoyado en la cama
brazo(1, (0.170, 0.05, 1.178), (0.272, 0.035, 0.915), (0.287, -0.075, 0.63), True)
mano(1)

HOMBRO_D = Vector((-0.170, 0.05, 1.178))
MUNECA_REPOSO = Vector((-0.287, -0.075, 0.63))
MUNECA_CUELLO = Vector((-0.135, -0.165, 1.185))
L1 = (Vector((-0.272, 0.035, 0.915)) - HOMBRO_D).length
L2 = (MUNECA_REPOSO - Vector((-0.272, 0.035, 0.915))).length

def codo_para(muneca, polo):
    """cinemática de dos huesos: dónde queda el codo"""
    v = muneca - HOMBRO_D; dist = min(v.length, (L1 + L2) * 0.999); u = v.normalized()
    x = (L1 * L1 - L2 * L2 + dist * dist) / (2 * dist)
    h = math.sqrt(max(L1 * L1 - x * x, 0.0))
    p = polo - u * polo.dot(u); p.normalize()
    return HOMBRO_D + u * x + p * h

dinamicos = []
def brazo_derecho(k):
    """k: 0 = mano en la cama, 1 = mano en el cuello"""
    antes = set(sc.collection.objects)
    random.seed(311)
    muneca = MUNECA_REPOSO.lerp(MUNECA_CUELLO, k) + Vector((-0.10, -0.12, 0)) * math.sin(math.pi * k)
    polo = Vector((-0.35, 0.9, -0.2)).lerp(Vector((-0.75, -0.25, -0.65)), k)
    codo = codo_para(muneca, polo)
    brazo(-1, HOMBRO_D, codo, muneca, False)
    antes_mano = set(sc.collection.objects)
    mano(-1)
    dir_reposo = Vector((0.0, -0.93, -0.36)).normalized()
    dir_cuello = Vector((0.62, 0.30, 0.72)).normalized()
    giro = dir_reposo.rotation_difference(dir_reposo.lerp(dir_cuello, k).normalized()).to_matrix().to_4x4()
    base = Vector((-0.287, -0.080, 0.628))
    M = Matrix.Translation(muneca + (base - MUNECA_REPOSO)) @ giro @ Matrix.Translation(-base)
    for o in set(sc.collection.objects) - antes_mano:
        o.matrix_world = M
    dinamicos.extend(set(sc.collection.objects) - antes)

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
# aretes: el lóbulo atraviesa el aro, en las dos orejas
for s in (-1, 1):
    en_cabeza(bola('lobulo', P(s * 0.1015, 0.016, -0.025), 0.0125, PIEL, 2, (0.62, 0.85, 1.0)))
    aro = []
    for k in range(25):
        a = 2 * math.pi * k / 24
        r_ = 0.0155
        aro.append(P(s * (0.1075 + 0.55 * r_ * math.sin(a)), 0.010 - 0.62 * r_ * math.sin(a), -0.0455 + r_ * math.cos(a)))
    en_cabeza(tubo('arete', aro, 0.0033, METAL))
# nariz
y0 = frente(0, 0.03)
nv = [P(0, y0 - 0.003, 0.040), P(-0.010, frente(0.010, 0.01) - 0.004, 0.006), P(0.010, frente(0.010, 0.01) - 0.004, 0.006), P(0, frente(0, 0) - 0.020, -0.005),
      P(-0.026, frente(0.026, -0.02) - 0.003, -0.021), P(0.026, frente(0.026, -0.02) - 0.003, -0.021), P(0, frente(0, -0.02) - 0.031, -0.019),
      P(-0.012, frente(0.012, -0.03) - 0.006, -0.031), P(0.012, frente(0.012, -0.03) - 0.006, -0.031)]
en_cabeza(objeto('nariz', nv, [(0, 1, 3), (0, 3, 2), (1, 4, 3), (2, 3, 5), (4, 6, 3), (3, 6, 5), (4, 7, 6), (6, 8, 5), (7, 8, 6),
                               (0, 2, 1), (1, 2, 8), (1, 8, 7), (1, 7, 4), (2, 5, 8)], PIEL))
# labios
boca_z = -0.057
def sobre(x, z, sale): return P(x, frente(x, z) - sale, z)
def ancho_en(z):
    z = min(max(z, perfil[0][0]), perfil[-1][0])
    for (z0p, _, a0, _), (z1p, _, a1, _) in zip(perfil, perfil[1:]):
        if z0p <= z <= z1p: return a0 + (a1 - a0) * (z - z0p) / (z1p - z0p)
    return 0.05
def labios(sonrisa):
    sube = 0.0095 * sonrisa; abre = 0.0065 * sonrisa; ancho = 1 + 0.14 * sonrisa
    creados = []
    creados.append(loft('labio_sup', [(sobre(-0.029 * ancho, boca_z + 0.001 + sube, 0.0035), 0.002, 0.002), (sobre(-0.011, boca_z + 0.0062 + sube * 0.25, 0.0075), 0.0052, 0.0046), (sobre(0, boca_z + 0.0045 + sube * 0.2, 0.0075), 0.0046, 0.0046),
                             (sobre(0.011, boca_z + 0.0062 + sube * 0.25, 0.0075), 0.0052, 0.0046), (sobre(0.029 * ancho, boca_z + 0.001 + sube, 0.0035), 0.002, 0.002)], LABIO, 9))
    creados.append(loft('labio_inf', [(sobre(-0.026 * ancho, boca_z - 0.002 + sube, 0.0035), 0.002, 0.002), (sobre(0, boca_z - 0.0085 - abre, 0.009), 0.0066, 0.0058), (sobre(0.026 * ancho, boca_z - 0.002 + sube, 0.0035), 0.002, 0.002)], LABIO, 9))
    if sonrisa > 0.22:
        creados.append(loft('dientes', [(sobre(-0.019 * ancho, boca_z + sube * 0.45, 0.0050), 0.0010, 0.0010), (sobre(0, boca_z - abre * 0.55, 0.0074), max(0.0012, abre * 0.62), 0.0022),
                                        (sobre(0.019 * ancho, boca_z + sube * 0.45, 0.0050), 0.0010, 0.0010)], BLANCO, 8))
    return creados

def pelito(x, z, r, m, sale=0.0016):
    en_cabeza(bola('pelito', sobre(x, z, sale), r, m, 1, (1, 0.55, 1.15), (random.random() * 3, random.random() * 3, random.random() * 3), 0.3))
# sombra de barba en la mandíbula
n_ = 0
while n_ < 900:
    z = random.uniform(-0.114, -0.040); x = random.uniform(-1, 1) * ancho_en(z) * 0.96
    if z > -0.092 + 0.052 * (abs(x) / ancho_en(z)) ** 2: continue
    if abs(x) < 0.033 and -0.072 < z < -0.047: continue
    pelito(x, z, random.uniform(0.0017, 0.0030), BARBA if z < -0.086 else SOMBRA); n_ += 1
# chiva y mosca densas
n_ = 0
while n_ < 420:
    x = random.gauss(0, 0.016); z = random.uniform(-0.1175, -0.088)
    if abs(x) > 0.036: continue
    pelito(x, z, random.uniform(0.0028, 0.0044), BARBA, 0.0030); n_ += 1
for _ in range(50):
    pelito(random.gauss(0, 0.0042), random.uniform(-0.085, -0.071), 0.0027, BARBA, 0.0030)
# bigote y unión suave con la chiva
for s in (-1, 1):
    for k in range(70):
        q = random.random()
        pelito(s * (0.002 + 0.035 * q), -0.0445 - 0.013 * q ** 2 + random.uniform(-0.0032, 0.0030), 0.0034 - 0.0012 * q, BARBA, 0.0066 - 0.0035 * q)
    for k in range(55):
        q = random.random()
        pelito(s * (0.036 - 0.012 * q ** 2 + random.uniform(-0.003, 0.003)), -0.058 - 0.038 * q, 0.0025, BARBA, 0.0022)

# pelo: base corta, lados degradados y rizos arriba
en_cabeza(loft('nuca', [(P(0, 0.030, -0.040), 0.088, 0.088, (0, 0, 1)), (P(0, 0.034, 0.025), 0.1050, 0.098, (0, 0, 1)), (P(0, 0.030, 0.085), 0.1050, 0.108, (0, 0, 1))], LADO, 14, 0.001, tapas=False))
en_cabeza(loft('casquete', [(P(0, 0.027, 0.083), 0.1065, 0.113, (0, 0, 1)), (P(0, 0.024, 0.125), 0.094, 0.103, (0, 0, 1)), (P(0, 0.022, 0.158), 0.056, 0.066, (0, 0, 1)), (P(0, 0.022, 0.170), 0.015, 0.018, (0, 0, 1))], PELO, 14, 0.002))
def rizo(c, radio, grueso):
    eje_a = Vector((random.gauss(0, 1), random.gauss(0, 1), random.gauss(0, 1))).normalized()
    eje_b = eje_a.orthogonal().normalized(); eje_c = eje_a.cross(eje_b)
    vueltas = random.uniform(0.72, 0.92)
    pts = []
    for k in range(9):
        a = 2 * math.pi * vueltas * k / 8
        pts.append(Vector(c) + eje_b * math.cos(a) * radio + eje_c * math.sin(a) * radio + eje_a * (k / 8 - 0.5) * radio * 0.9)
    en_cabeza(loft('rizo', [(p, grueso * (1 - 0.45 * abs(k - 4) / 4), grueso * (1 - 0.45 * abs(k - 4) / 4)) for k, p in enumerate(pts)], PELO, n=5))
rizos = 0
while rizos < 420:
    th = random.uniform(0, 2 * math.pi); fi = math.acos(random.uniform(math.cos(1.38), 1.0))
    x = 0.098 * math.sin(fi) * math.cos(th); y = 0.022 + 0.106 * math.sin(fi) * math.sin(th); z = 0.092 + 0.086 * math.cos(fi)
    delante = y < -0.045
    if (delante and z < 0.109) or z < 0.095 or (abs(x) > 0.086 and z < 0.112 and y < 0.04): continue
    if y > 0.072 and z < 0.116: z = random.uniform(0.060, 0.116)
    rizo(P(x, y, z), random.uniform(0.0090, 0.0135), random.uniform(0.0042, 0.0056))
    rizos += 1
for x, z in [(-0.058, 0.112), (-0.040, 0.106), (-0.020, 0.109), (0.000, 0.103), (0.018, 0.108), (0.036, 0.102), (0.054, 0.110)]:
    rizo(P(x, frente(x, 0.099) - 0.005, z), 0.0100, 0.0046)

# lentes oscuros rectangulares: solo de noche
if VISTA in ('noche', 'anim'):
    LENTE = mat('lente', '#0b0d12', 0.08, metal=0.35)
    MARCO = mat('marco', '#0c0b0c', 0.35)
    yl = frente(0.037, 0.022) - 0.020
    for s in (-1, 1):
        forma = [(0.011, 0.037), (0.075, 0.039), (0.071, 0.008), (0.019, 0.006)]
        cara_l = [Vector(P(s * x_, yl + max(0, x_ - 0.045) * 0.28, z_)) for x_, z_ in forma]
        en_cabeza(objeto('lente', cara_l, [(0, 1, 2, 3)], LENTE))
        en_cabeza(tubo('marco', cara_l + [cara_l[0], cara_l[1]], 0.0034, MARCO))
        en_cabeza(tubo('patilla', [cara_l[1], P(s * 0.101, -0.058, 0.034), P(s * 0.111, 0.006, 0.024), P(s * 0.108, 0.030, 0.004)], 0.0030, MARCO))
    en_cabeza(tubo('puente', [P(-0.011, yl, 0.033), P(0, yl - 0.004, 0.036), P(0.011, yl, 0.033)], 0.0027, MARCO))

eje = Vector((0, 0.035, 1.34))
bpy.context.view_layer.update()
base_cabeza = [(o, o.matrix_world.copy()) for o in cabeza_obj if not o.name.startswith('cuello')]
def pose(bajar, girar, ladear, sonrisa, mano_k, respira):
    for o in list(dinamicos):
        bpy.data.objects.remove(o, do_unlink=True)
    dinamicos.clear()
    brazo_derecho(mano_k)
    R = (Matrix.Translation(eje + Vector((0, 0, respira))) @ Matrix.Rotation(math.radians(girar), 4, 'Z')
         @ Matrix.Rotation(math.radians(ladear), 4, 'Y') @ Matrix.Rotation(math.radians(bajar), 4, 'X') @ Matrix.Translation(-eje))
    for o, m0 in base_cabeza:
        o.matrix_world = R @ m0
    for o in labios(sonrisa):
        o.matrix_world = R
        dinamicos.append(o)

def curva(claves, s):
    """interpola suave entre (segundo, valor)"""
    if s <= claves[0][0]: return claves[0][1]
    for (a, va), (b, vb) in zip(claves, claves[1:]):
        if s <= b:
            q = (s - a) / (b - a); q = q * q * (3 - 2 * q)
            return va + (vb - va) * q
    return claves[-1][1]

def pose_en(s):
    pose(curva([(0, 14), (0.7, 13), (1.7, -9), (3.0, -5), (4.2, -7), (5, -3)], s),
         curva([(0, -4), (1.7, -12), (3.0, -6), (4.2, -14), (5, -10)], s),
         curva([(0, 0), (1.6, 0), (2.6, 13), (3.9, 15), (5, 9)], s),
         curva([(0, 0), (1.5, 0.05), (2.4, 0.85), (3.4, 1.0), (5, 0.8)], s),
         curva([(0, 0), (1.9, 0), (3.25, 1.0), (5, 1.0)], s) + (0.018 * math.sin(2 * math.pi * 2.2 * (s - 3.25)) if s > 3.25 else 0),
         0.0035 * math.sin(2 * math.pi * s / 2.6))

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
if VISTA == 'noche':
    bg.inputs['Color'].default_value = (0.012, 0.018, 0.042, 1)
luz('POINT', (0.74, 0.86, 1.16), 30 if VISTA == 'noche' else 24, (1.0, 0.70, 0.40), 0.09)
luz('AREA', (-1.25, -1.75, 2.15), 13 if VISTA == 'noche' else 34, (0.50, 0.62, 1.0) if VISTA == 'noche' else (1.0, 0.91, 0.82), 0.9)
luz('AREA', (1.7, -1.0, 1.25), 11 if VISTA == 'noche' else 9, (0.35, 0.50, 1.0) if VISTA == 'noche' else (0.62, 0.72, 1.0), 1.2)
luz('AREA', (0.9, 0.55, 2.2), 14, (1.0, 0.76, 0.48), 0.4)
if ANIM:
    bg.inputs['Color'].default_value = (0.022, 0.022, 0.036, 1)
    luz('AREA', (-0.95, -1.55, 1.75), 20, (1.0, 0.74, 0.50), 0.7)
    luz('AREA', (0.2, 0.2, 2.35), 12, (1.0, 0.78, 0.46), 0.5, (0.0, 0.4, 1.1))
cam = bpy.data.cameras.new('c'); co = bpy.data.objects.new('c', cam); sc.collection.objects.link(co); sc.camera = co
if VISTA == 'cara':
    co.location = (-0.30, -1.15, 1.52); mira(co, (0.0, 0.0, 1.43)); cam.lens = 88
    ancho, alto = 720, 900
else:
    co.location = (-0.82, -2.65, 1.42); mira(co, (0.02, 0.0, 0.885)); cam.lens = 58
    ancho, alto = 720, 1280

sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.use_denoising = False
sc.cycles.samples = 56 if ANIM else 96
sc.render.image_settings.file_format = 'PNG'
sc.view_settings.view_transform = 'Filmic'
if ANIM:
    # la lente se acerca muy poco; el movimiento principal es del personaje
    sc.render.resolution_x, sc.render.resolution_y = 540, 960
    sc.render.use_persistent_data = True
    for n_cuadro in range(CUADRO_INI, CUADRO_FIN + 1):
        s = n_cuadro / 24
        pose_en(s)
        co.location = Vector((-0.80, -2.50, 1.40)).lerp(Vector((-0.74, -2.36, 1.38)), s / 5)
        mira(co, (0.0, 0.0, 0.93))
        sc.render.filepath = SALIDA + '/c%04d.png' % n_cuadro
        bpy.ops.render.render(write_still=True)
else:
    sc.render.resolution_x, sc.render.resolution_y = ancho, alto
    pose(5, -9, 0, 0.0, 0.0, 0.0)
    sc.render.filepath = SALIDA
    bpy.ops.render.render(write_still=True)
print('LISTO', SALIDA)
