"""Translate en.json -> sw.json with Meta NLLB-200 (local), back-translate for QA.
Output is machine-drafted: machineDrafted=true, every card reviewed=false."""
import json, re, sys, pathlib, torch
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

ROOT = pathlib.Path(__file__).resolve().parent.parent
PACKS = ROOT / "app/src/content/packs"
MODEL = "facebook/nllb-200-distilled-600M"
dev = "cuda" if torch.cuda.is_available() else "cpu"
tok = AutoTokenizer.from_pretrained(MODEL)
model = AutoModelForSeq2SeqLM.from_pretrained(MODEL).eval()
try:
    model = model.to(dev)
    if dev == "cuda": model.half()
except Exception as e:  # GPU busy / out of memory -> CPU
    print("GPU unavailable, using CPU:", str(e)[:60]); dev = "cpu"
    model = model.float().to("cpu")

def tr(texts, src, tgt, bs=8):
    """Translate sentence by sentence (NLLB drops later sentences of long inputs)."""
    parts, owner = [], []
    for n, t in enumerate(texts):
        for sent in re.split(r"(?<=[.?!])\s+", t.strip()):
            parts.append(sent); owner.append(n)
    flat = _tr(parts, src, tgt, bs)
    res = [[] for _ in texts]
    for o, f in zip(owner, flat): res[o].append(f)
    return [" ".join(r) for r in res]

def _tr(texts, src, tgt, bs=8):
    out = []
    tok.src_lang = src
    for i in range(0, len(texts), bs):
        enc = tok(texts[i:i+bs], return_tensors="pt", padding=True).to(dev)
        with torch.no_grad():
            gen = model.generate(**enc, forced_bos_token_id=tok.convert_tokens_to_ids(tgt),
                                 max_new_tokens=96, num_beams=4)
        out += tok.batch_decode(gen, skip_special_tokens=True)
    return out

def words(s): return set(re.findall(r"[a-z0-9]+", s.lower()))
def score(a, b):  # token-overlap F1
    A, B = words(a), words(b)
    if not A or not B: return 0.0
    i = len(A & B)
    return 0.0 if i == 0 else 2 * i / (len(A) + len(B))

en = json.load(open(PACKS / "en.json"))
items = [(c["id"], c["text"]) for c in en["cards"]] + list(en["strings"].items())
ids = [i for i, _ in items]; src = [t for _, t in items]
sw = tr(src, "eng_Latn", "swh_Latn")
# keep the word SMS intact
sw = [re.sub(r"\b(?:sms|Sms)\b", "SMS", s) for s in sw]
back = tr(sw, "swh_Latn", "eng_Latn")

qa = []
for i, o, s, b in zip(ids, src, sw, back):
    sc = round(score(o, b), 3)
    nums_ok = set(re.findall(r"\d+", o)) <= set(re.findall(r"\d+", s))
    sms_ok = ("SMS" not in o) or ("SMS" in s)
    qa.append(dict(id=i, original=o, swahili=s, back_translation=b, score=sc,
                   flag=bool(sc < 0.5 or not nums_ok or not sms_ok)))
json.dump(qa, open(PACKS / "sw_qa.json", "w"), indent=1, ensure_ascii=False)

m = dict(zip(ids, sw))
out = dict(lang="sw", name="Kiswahili", machineDrafted=True, engine=f"{MODEL} (transformers, NLLB-200 distilled 600M)",
           cards=[dict(c, text=m[c["id"]], reviewed=False) for c in en["cards"]],
           strings={k: m[k] for k in en["strings"]})
json.dump(out, open(PACKS / "sw.json", "w"), indent=1, ensure_ascii=False)
fl = [q for q in qa if q["flag"]]
print(f"{len(qa)} strings, {len(fl)} flagged")
for q in fl: print(q["id"], q["score"], "|", q["original"], "|", q["swahili"], "|", q["back_translation"])
