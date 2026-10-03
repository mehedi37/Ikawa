"""Render sw.json card + question + consent texts to speech with Meta MMS-TTS (swh) and
encode mono 16 kHz Opus ~12 kbps to app/public/audio/<id>.opus. Needs ffmpeg.
MMS-TTS is CC-BY-NC: hackathon use only. Audio is machine-generated from machine-drafted text."""
import json, pathlib, subprocess, sys, torch, numpy as np
from transformers import VitsModel, AutoTokenizer

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "app/public/audio"; OUT.mkdir(parents=True, exist_ok=True)
sw = json.load(open(ROOT / "app/src/content/packs/sw.json"))
items = [(c["id"], c["text"]) for c in sw["cards"]] + \
        [(k, v) for k, v in sw["strings"].items() if k[0] in "QC" and k[1:].isdigit()]
only = set(sys.argv[1:])           # optional: re-render just these ids
if only: items = [it for it in items if it[0] in only]
dev = "cpu"
try:
    tok = AutoTokenizer.from_pretrained("facebook/mms-tts-swh")
    model = VitsModel.from_pretrained("facebook/mms-tts-swh").eval()
    try: model = model.to("cuda"); dev = "cuda"
    except Exception: model = model.to("cpu")
except Exception as e: raise SystemExit(e)
sr = model.config.sampling_rate
total = 0
for id_, text in items:
    enc = tok(text.lower(), return_tensors="pt").to(dev)
    with torch.no_grad(): wav = model(**enc).waveform[0].float().cpu().numpy()
    pcm = (np.clip(wav, -1, 1) * 32767).astype("<i2").tobytes()
    dst = OUT / f"{id_}.opus"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "s16le", "-ar", str(sr), "-ac", "1", "-i", "-",
                    "-ar", "16000", "-ac", "1", "-c:a", "libopus", "-b:a", "12k", "-application", "voip", str(dst)],
                   input=pcm, check=True)
    total += dst.stat().st_size
print(f"{len(items)} clips, {total/1024:.0f} KiB total ({dev})")
