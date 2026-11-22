# Lo Que No Sabías · memoria del proyecto

Lee este archivo y `estado/estado.json` ANTES de hacer nada. Aquí está todo lo que el usuario
ya decidió. Responde siempre en español.

## Quién es el usuario y cómo quiere trabajar
- Canal faceless "Lo Que No Sabías": historias virales con misterio, formato hook → historia →
  revelación (65-75 % del video) → veredicto "¿Estafador o genio?" (últimos 10-15 s).
- Quiere TODO automático y sin errores. Si falta un permiso (descargas, subir a YouTube,
  contraseñas), se lo pides en una sola pregunta clara y espera su "sí". Nada de tecnicismos.
- Prefiere calidad sobre velocidad. Su PC tiene 4 GB de RAM: renderizar con 1 hilo es normal y
  aceptado, pero NO dejes de entregar. Cuando termines, MANDA el MP4 con SendUserFile
  (máximo 30 MB: si pesa más, crea una copia comprimida con ffmpeg).
- Orden de trabajo: un video a la vez. El video largo y los "5 shorts" solo cuando él avise.

## Preferencias de producción (confirmadas)
- **Voz**: masculina, grave, cálida y seductora/narrador de documental. NUNCA robótica ni
  "muerta" (la voz SAPI de Windows "Helena" le desagradó). Usar voz neural masculina en
  español con ritmo lento y pausas (ver `scripts/voz.mjs`).
- **Imagen**: alta calidad, nada borroso ni distorsionado, nada que "salga" mal. Flujo
  constante de fondos reales que cambian cada pocos segundos, siempre con movimiento.
- **Subtítulos**: blancos, grandes, borde negro, palabra actual en amarillo. NUNCA deben quedar
  tapados por ningún fondo, capa ni personaje.
- **Personaje** (referencia del usuario): muñeco 3D estilo Pixar, pelo negro, lentes oscuros,
  traje azul marino, corbata dorada, pañuelo blanco, lupa dorada con "?" al pecho. Pequeño en
  una esquina. Si existe `public/personaje/personaje.png` (transparente) se usa ese.
- **Fondos de Flow**: el usuario genera clips con Google Flow (Omni 1.1 Flash, 720p vertical)
  con el personaje dentro. Si los pone en `public/fondos/` se usan como fondos.
- **Música** a -20 dB. Nunca en Flow. TikTok/Instagram: Kerosene o Transgender (Crystal
  Castles) en `public/musica/tiktok.mp3`. YouTube: libre de derechos en
  `public/musica/youtube.mp3` (Kerosene bloquea). Yo no incluyo esas canciones: las pone él.
- Sin nombres reales de personas en video ni en código.

## Cómo se produce un video
1. Editar `guion/guion.json` (texto, tipo de escena, fondos).
2. `npm run voz` → narración + tiempos por palabra.
3. `npm run render` → `out/<titulo>-<plataforma>.mp4`.
Detalles en `README.md`.

## Pendientes y decisiones abiertas (actualizar en estado/estado.json)
- Subida automática a YouTube: la API de Google deja los videos en PRIVADO hasta una auditoría;
  la vía realista es subir por YouTube Studio en el Chrome del usuario. Pedir permiso antes de
  publicar; por defecto subir como PRIVADO/no listado para que lo revise.
- Ideas de videos: buscar en la web ideas con gancho y revelación y proponerlas.

## REGLAS DEFINITIVAS DE LA FÁBRICA (documento del usuario, 14 nov 2026; no se negocian)
Meta: monetizar antes del 13 dic 2026 y llegar a 2.000 USD/mes. Nunca prometer resultados ni inventar cifras.
Producción diaria: 1 largo (8-12 min, 5 secretos, horizontal 1920x1080, 30 fps) + 5 Shorts de 20-35 s
(1 secreto cada uno, vertical 1080x1920, 60 fps) sacados del largo. Largo primero; Shorts 1 cada 2 h.
Distribución: YouTube, TikTok y Facebook. Almacén: Google Drive (unidad G:), Drive GUARDA, Remotion+FFmpeg RENDERIZAN.
Estilo: empezar SIEMPRE con "sabías que"; hook 0-3 s con pregunta imposible + número en 3 capas (visual, texto, voz);
tono misterio, NO miedo; revelación al 65-75 %; veredicto "¿Estafador o genio?" en los últimos 10-15 s;
personaje fijo (traje azul oscuro, lentes negros, lupa con ?); movimiento continuo; mostrar visualmente lo que se dice;
karaoke blanco/borde negro/palabra amarilla; CTA escrito "Mándaselo a un amigo que haría lo mismo, sígueme" y en VOZ
"Comparte este video con un amigo que haría lo mismo, sígueme" (nunca decir "Mándaselo"); insinuar, no rogar;
5 hashtags ESPECÍFICOS del tema (nunca #viral ni #fyp); música solo Kerosene/Transgender a -20 dB en TikTok/IG,
libre de derechos o solo voz en YouTube (Kodak fue bloqueado); no borrar videos antes de 24 h; máx. 1-2 jergas dominicanas
por clip, "gu-eso" en voz; SIN nombres reales de personas en prompts ni código.
Fuentes: SOLO videos virales EN INGLÉS de canal estadounidense con 100 M+ vistas, verificados en vivo (canal, vistas, fecha,
duración, enlace). Si no se puede verificar, no se usa. Hacer versión fresca en español, no copia.
Entrega diaria: tema+fuente, duración, guiones (largo+5 Shorts), prompts de Flow, archivos Remotion, título/descripción/
5 hashtags/miniatura, música, estrategia de seguimiento, archivos en Drive y horarios de publicación.
Análisis diario corto: aprendizaje en 3 líneas y arreglo para mañana. Videos ya hechos: VIP lounge, serpiente vs lotería,
hotel, flor de 7 puntas, Kodak, vestido (el que prueba que el sistema funciona).
Alternativas ya verificadas a lo pedido: la API de YouTube deja los videos en PRIVADO hasta una auditoría de Google, así que
se sube por YouTube Studio en el Chrome del usuario; para Drive se usa la unidad G: (Drive for Desktop corriendo), sin rclone.

## FLUJO FIJO DE ARCHIVOS (decisión del usuario, 14 nov 2026: "SIEMPRE SERÁ ASÍ")
Voces se hacen en la laptop (npm run voz) -> carpeta `nube/` (node scripts/preparar-nube.mjs) -> repositorio PRIVADO
github.com/geurii/nube (publicado con GitHub Desktop) -> Actions "Render videos" renderiza en la nube (los 6 en paralelo, ~13 min)
-> se descargan los artefactos -> se guardan en Drive (G:\Mi unidad\Lo Que No Sabías\Videos Terminados\FECHA\...) ->
se BORRAN de la laptop. Los videos terminados viven en la nube/Drive; la laptop solo guarda copias temporales mientras se suben.
Navegador del usuario para Claude in Chrome: CHROME (la extensión ya está instalada y conecta). Brave no.

## REGLA PERMANENTE del usuario
Nunca ejecutes una acción si sabes que dará error o no estás seguro: busca información primero
y hazlo bien. Verifica los datos con fuentes primarias antes de ponerlos en un video.

## Al terminar cada tarea
Actualiza `estado/estado.json` (videos hechos, rutas, si se subió, qué falta).

## GANCHO Y EDICIÓN ESTILO REEL (decisión del usuario, 22 nov 2026; el pixel del canal NO cambia)
Copiar el nivel de un reel de Instagram que frena el dedo: titular gigante en pregunta los primeros 3 s (pixelado, última línea en rojo),
primera frase de máx. 14 palabras con "Sabías que" + cifra concreta, un cambio de imagen cada 1,5-2 s, un solo sujeto grande por cuadro,
un solo mundo de color por video con foco de luz, glitch rojo/cian en cada corte, líneas de escaneo, palabra clave resaltada.
En el guion: `estilo: "gancho"` y `ganchoTexto` (Remotion: `src/components/Gancho.tsx`, `src/Video.tsx`). La oficina de la nube lo aplica sola
(orden nivel 5 en `oficina-salida/lqns/ordenes.json`, normas del guionista y del editor, manual de los pintores).
Pendiente: etiqueta amarilla de palabra clave (el motor aún no la dibuja). Referencias de imágenes: solo fotos libres (Commons/Openverse, dominio
público o CC0) y escenarios CC0 de `public/escenarios/`; nunca Pinterest ni imágenes con derechos de autor.

## ORDEN DE LOS PASOS: EL PANEL VA ANTES DE PRODUCIR (decisión del usuario, 22 nov 2026)
Paso 1: guion (Guionista, Editor, Verificador). Paso 2: PANEL de 8 espectadores juzga el GUION (`agentes/panel-guion.mjs`, dentro de la Oficina);
si lo rechazan se reescribe con sus críticas y NO se gasta voz ni render. Paso 3: voz y render. Después del render el video SOLO se frena si Gemini
ve fallas graves de IMAGEN o SONIDO (subtítulos tapados, audio ausente o ininteligible, imagen negra/rota, imágenes sin relación con lo que se dice;
`agentes/panel.mjs`). El gusto, el gancho y el estilo ya NO rechazan un video terminado. Si Gemini no responde, el video pasa. La garantía de
publicación (más de 7 h sin publicar) sigue relajando solo el voto del panel de guion, nunca la verdad ni las fallas técnicas.
Publicación automática: YouTube y, vía Windsor (`agentes/facebook.mjs`), Facebook e Instagram con el mismo video, descripción y 5 hashtags.

## NIVEL DE CALIDAD OBLIGATORIO (decisión del usuario, 14 nov 2026 noche)
Todos los clips y videos largos deben verse PROFESIONALES con el nivel de detalle de la serie de los pingüinos:
pixel art realista dibujado pixel a pixel (src/components/fondos/PixelPinguinos.tsx: lienzo canvas, 1 px = 2 px de video,
sombreado por luz, degradados con tramado, contornos oscuros, paletas de 4-5 tonos). Referencias del usuario: animales pixel
art con contorno y sombreado, y paisajes pixel realistas (atardeceres, reflejos, texturas). Nada plano ni de "bloques grandes".
Antes de entregar, revisar fotogramas de todas las escenas (vertical y horizontal) y corregir lo que se vea amateur.

## VOZ ÚNICA (decisión del usuario, 22 nov 2026; no se negocia)
La ÚNICA voz permitida es es-MX-JorgeNeural (Edge, tono -6 Hz): la de los primeros videos (muestras A y B que el usuario eligió). NUNCA Gemini (muestra C, prohibida) ni es-DO-EmilioNeural. scripts/voz.mjs ignora la voz del guion y tiene Gemini desactivado.

## FORMATO FACELESS (decisión del usuario, 22 nov 2026; reemplaza al personaje con lupa)
Los videos NO llevan personaje, cara ni mascota con lupa: solo voz en off y visuales en movimiento (guion.personaje.visible = false; producir.mjs lo fuerza). Orden principal de Jules: reformular y analizar el canal con datos reales y compararlo con grandes canales (agentes/estrategia.mjs → oficina-salida/<canal>/estrategia.json). Cada video de 8/10 o más y sin fondos vacíos. En la oficina 3D solo se dibuja la casa y su montaña (SOLO_CASA_Y_MONTANA en src/oficina/render/casa/Casa.tsx).

## RETENCIÓN MÍNIMA DEL GUION (decisión del usuario, 22 nov 2026; no se negocia)
Un guion con retención estimada menor a 70 % NO pasa: no se gasta voz ni render (agentes/panel-guion.mjs, RETENCION_MINIMA). Aplica incluso con la garantía de publicación. Es una estimación del panel de 8 espectadores, no la retención real de YouTube.
