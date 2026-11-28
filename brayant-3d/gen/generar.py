# LTX-Video 2B (modelo abierto oficial de Lightricks) en una maquina de GitHub sin GPU.
import gc, json, os, shutil, sys, time, torch
from PIL import Image

n = sys.argv[1]
prompt = json.load(open('brayant-3d/gen/escenas.json', encoding='utf-8-sig'))[n]
REPO = 'Lightricks/LTX-Video'
PESOS = 'https://huggingface.co/Lightricks/LTX-Video/blob/main/ltxv-2b-0.9.6-distilled-04-25.safetensors'
W, H, CUADROS = 512, 896, 97
CACHE = os.environ['HF_HOME']
torch.set_num_threads(4)
t0 = time.time()
def log(*a): print(f'[{time.time()-t0:6.0f}s]', *a, flush=True)
def libre(): log('disco libre GB:', round(shutil.disk_usage(CACHE).free / 1e9, 1))

# 1) leer el texto y liberar memoria y disco
from transformers import T5EncoderModel, T5TokenizerFast
libre()
tok = T5TokenizerFast.from_pretrained(REPO, subfolder='tokenizer')
enc = T5EncoderModel.from_pretrained(REPO, subfolder='text_encoder', torch_dtype=torch.bfloat16, low_cpu_mem_usage=True).eval()
log('lector de texto cargado')
x = tok(prompt, padding='max_length', max_length=128, truncation=True, return_tensors='pt')
with torch.no_grad():
    emb = enc(x.input_ids, attention_mask=x.attention_mask)[0].float()
mask = x.attention_mask
del enc; gc.collect()
log('texto listo')
# la cache es una carpeta temporal creada solo para esta ejecucion en la maquina de GitHub
shutil.rmtree(CACHE, ignore_errors=True); os.makedirs(CACHE, exist_ok=True)
libre()

# 2) generador de video
from diffusers import LTXConditionPipeline, LTXVideoTransformer3DModel, AutoencoderKLLTXVideo, FlowMatchEulerDiscreteScheduler
from diffusers.pipelines.ltx.pipeline_ltx_condition import LTXVideoCondition
from diffusers.utils import export_to_video
tr = LTXVideoTransformer3DModel.from_single_file(PESOS, torch_dtype=torch.float32)
vae = AutoencoderKLLTXVideo.from_single_file(PESOS, torch_dtype=torch.float32)
sch = FlowMatchEulerDiscreteScheduler.from_pretrained(REPO, subfolder='scheduler', use_dynamic_shifting=False, shift=1.0, shift_terminal=None)
pipe = LTXConditionPipeline(scheduler=sch, vae=vae, text_encoder=None, tokenizer=None, transformer=tr)
pipe.vae.enable_tiling()
pipe.vae.use_framewise_decoding = True   # arma el video por tandas: menos memoria
log('generador cargado')

img = Image.open('brayant-3d/gen/base.png').convert('RGB').resize((W, H), Image.LANCZOS)
def paso(p, i, t, kw):
    log('paso', i + 1)
    return kw
conds = None if n == '8' else [LTXVideoCondition(image=img, frame_index=0)]   # la puerta se crea solo con texto
out = pipe(conditions=conds,
           prompt_embeds=emb, prompt_attention_mask=mask, width=W, height=H, num_frames=CUADROS, frame_rate=24,
           timesteps=[1000, 993, 987, 981, 975, 909, 725], guidance_scale=1.0,
           decode_timestep=0.05, decode_noise_scale=0.025, image_cond_noise_scale=0.0,
           generator=torch.Generator().manual_seed(42), callback_on_step_end=paso).frames[0]
export_to_video(out, f'escena{n}.mp4', fps=24)
log('LISTO')
