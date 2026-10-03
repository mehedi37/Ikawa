"""Fill ONLY the keys that sw.json is missing (strings and cards) from en.json, using local NLLB-200.

Unlike translate_content.py this NEVER rewrites existing sw.json text, so hand corrections listed in
`manualEdits` survive. New keys are recorded in `machineAddedKeys` (ids), machineDrafted stays true and
no card is marked reviewed. Keys whose {placeholders} do not survive translation are left missing
(the app then shows English) and listed on stdout.
Run:  python ml/translate_missing.py
"""
import json, re, pathlib, torch
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

ROOT = pathlib.Path(__file__).resolve().parent.parent
PACKS = ROOT / "app/src/content/packs"
MODEL = "facebook/nllb-200-distilled-600M"

en = json.load(open(PACKS / "en.json"))
sw = json.load(open(PACKS / "sw.json"))
missing_s = [k for k in en["strings"] if not sw["strings"].get(k)]
have_cards = {c["id"] for c in sw["cards"]}
missing_c = [c for c in en["cards"] if c["id"] not in have_cards]
if not missing_s and not missing_c:
    print("nothing missing"); raise SystemExit

tok = AutoTokenizer.from_pretrained(MODEL)
model = AutoModelForSeq2SeqLM.from_pretrained(MODEL).eval()
dev = "cpu"
try:
    if torch.cuda.is_available():
        model = model.to("cuda").half(); dev = "cuda"
except Exception as e:  # GPU busy / out of memory -> CPU
    print("GPU unavailable, using CPU:", str(e)[:60]); model = model.float().to("cpu"); dev = "cpu"

def tr_one(text, bs=1):
    tok.src_lang = "eng_Latn"
    outs = []
    for sent in re.split(r"(?<=[.?!])\s+", text.strip()):
        enc = tok([sent], return_tensors="pt").to(dev)
        with torch.no_grad():
            gen = model.generate(**enc, forced_bos_token_id=tok.convert_tokens_to_ids("swh_Latn"), max_new_tokens=96, num_beams=4)
        outs.append(tok.batch_decode(gen, skip_special_tokens=True)[0])
    out = " ".join(outs)
    return re.sub(r"\b(?:sms|Sms)\b", "SMS", out)

def ok(src, out):
    return set(re.findall(r"\{\w+\}", src)) == set(re.findall(r"\{\w+\}", out)) and set(re.findall(r"\d+", src)) <= set(re.findall(r"\d+", out))

added, skipped = [], []
for k in missing_s:
    src = en["strings"][k]
    out = tr_one(src)
    if ok(src, out):
        sw["strings"][k] = out; added.append(k)
    else:
        skipped.append((k, out))
for c in missing_c:
    out = tr_one(c["text"])
    sw["cards"].append(dict(c, text=out, reviewed=False)); added.append(c["id"])

sw["machineDrafted"] = True
sw["machineAddedKeys"] = sorted(set(sw.get("machineAddedKeys", [])) | set(added))
json.dump(sw, open(PACKS / "sw.json", "w"), indent=1, ensure_ascii=False)
print(f"added {len(added)} keys on {dev}; skipped (placeholder lost, English fallback): {[k for k, _ in skipped]}")
for k in added[:80]: print(k, "|", en["strings"].get(k, ""), "|", sw["strings"].get(k, ""))
for k, o in skipped: print("SKIPPED", k, "|", o)
