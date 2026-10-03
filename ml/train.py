"""Ikawa leaf model — train MobileNetV3-Small with crash-safe checkpoints.

Runs unchanged on Kaggle (GPU kernel), on the local RTX 3050 Ti, or on CPU for a smoke test.

Checkpoint / restore design (so a crash, a 12 h Kaggle timeout or a lost session never loses progress)
  * `last.pt`   written atomically (tmp file + rename) after EVERY epoch, and on SIGTERM/SIGINT.
                Holds model, optimizer, scheduler, AMP scaler, epoch, best metric, history, RNG states, config.
  * `best.pt`   best validation macro-F1 so far.
  * `epoch_NNN.pt`  the last 3 epochs are kept as a fallback if `last.pt` is ever corrupt.
  * `--resume auto` (default) continues from `last.pt` in --ckpt-dir; if that is empty it also looks in
    any attached Kaggle dataset such as /kaggle/input/ikawa-ckpt/ckpt/last.pt.
  * `--max-minutes N` stops cleanly (and checkpoints) before a session limit.
  * Sampling order is seeded per epoch, so a resumed run sees the same data order as an uninterrupted one.

Outputs in --out-dir: metrics.json, history.csv, selective_accuracy.csv, confusion_*.csv,
reliability.png, selective_accuracy.png, temperature.json  (all of it is evidence for the video).

Usage
  python ml/train.py --data data/processed/ikawa_data                 # local
  python ml/train.py --smoke                                          # 2 tiny epochs, CPU ok
  Kaggle: see ml/kaggle/train/ (kernel-metadata.json) — runs this file with default paths.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import random
import shutil
import signal
import sys
import time
from collections import Counter
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from PIL import Image
from torch.utils.data import DataLoader, Dataset, WeightedRandomSampler

CLASSES = ["healthy", "leaf_rust", "cercospora", "phoma", "leaf_miner", "not_coffee"]
C2I = {c: i for i, c in enumerate(CLASSES)}
IMAGENET_MEAN, IMAGENET_STD = (0.485, 0.456, 0.406), (0.229, 0.224, 0.225)
ON_KAGGLE = Path("/kaggle/input").exists()


# ----------------------------------------------------------------------------- data

class RandomLowRes:
    """Randomly blur by down/up-scaling. JMuBEN is 128-px crops, the other sources are sharper: without this the
    network can tell sources apart by sharpness alone (a shortcut), which hurts on real phone photos."""
    def __init__(self, p: float = 0.4, lo: int = 48, hi: int = 128):
        self.p, self.lo, self.hi = p, lo, hi

    def __call__(self, im: Image.Image) -> Image.Image:
        if random.random() > self.p:
            return im
        w, h = im.size
        k = random.randint(self.lo, self.hi) / max(w, h)
        small = im.resize((max(8, int(w * k)), max(8, int(h * k))), Image.Resampling.BILINEAR)
        return small.resize((w, h), Image.Resampling.BICUBIC)


class LeafDS(Dataset):
    def __init__(self, root: Path, rows: list[dict], train: bool, size: int):
        import torchvision.transforms as T
        self.root, self.rows = root, rows
        norm = T.Normalize(IMAGENET_MEAN, IMAGENET_STD)
        if train:  # strong photometric + geometric aug: field phones, shade, glare, odd framing
            self.tf = T.Compose([
                RandomLowRes(), T.RandomResizedCrop(size, scale=(0.5, 1.0), ratio=(0.75, 1.33)),
                T.RandomHorizontalFlip(), T.RandomVerticalFlip(), T.RandomRotation(30),
                T.ColorJitter(0.4, 0.4, 0.4, 0.05), T.RandomApply([T.GaussianBlur(5, (0.1, 2.0))], p=0.2),
                T.ToTensor(), norm, T.RandomErasing(p=0.25, scale=(0.02, 0.15))])
        else:
            self.tf = T.Compose([T.Resize((size, size)), T.ToTensor(), norm])

    def __len__(self) -> int:
        return len(self.rows)

    def __getitem__(self, i: int):
        r = self.rows[i]
        with Image.open(self.root / r["file"]) as im:
            x = self.tf(im.convert("RGB"))
        return x, C2I.get(r["label"], -1), i


def resolve_root(root: Path) -> Path:
    """If prepare_data.py packed the images into images.tar (Kaggle), unpack once to a scratch dir."""
    if (root / "images.tar").exists() and not (root / "images").exists():
        import tarfile
        dst = Path("/kaggle/tmp/ikawa_data") if ON_KAGGLE else Path("data/interim/ikawa_data_unpacked")
        if not (dst / "images").exists():
            dst.mkdir(parents=True, exist_ok=True)
            with tarfile.open(root / "images.tar") as tf:
                tf.extractall(dst)
            shutil.copy(root / "manifest.csv", dst / "manifest.csv")
        return dst
    return root


def find_data_root() -> Path:
    """Kaggle mounts a kernel's output under a path that differs between UI versions: search for it."""
    hits = sorted(Path("/kaggle/input").rglob("manifest.csv"))
    if not hits:
        raise FileNotFoundError("no manifest.csv under /kaggle/input — attach the ikawa-data-prep kernel output")
    print("data root:", hits[0].parent)
    return hits[0].parent


ROCOLE_TRAIN_CLUSTERS, ROCOLE_VAL_CLUSTERS = set(range(1, 8)), {8}   # clusters 9-12 + all mites are held out


def resplit_rocole(rows: list[dict]) -> list[dict]:
    """(see D-031 for the not_coffee = "cannot read" semantics) prepare_data.py puts all RoCoLe into `ext_rocole`. Run 1 showed the model then labelled 100% of these field
    photos `not_coffee` (a shortcut learned from field-background negatives) — a true failure. The fix is to teach
    it coffee leaves in field photos, WITHOUT leaking: RoCoLe filenames are C<cluster>P<plant><side>; we split by
    whole cluster (C1-7 train, C8 val, C9-12 held out) and keep every red-spider-mite image (a class the model does
    not know) held out, to test abstention."""
    import re
    out = []
    for r in rows:
        if r["source"] == "rocole":
            m = re.match(r"C(\d+)P", Path(r["orig_path"]).name)
            c = int(m.group(1)) if m else -1
            r = dict(r)
            if c not in ROCOLE_TRAIN_CLUSTERS | ROCOLE_VAL_CLUSTERS:
                r["split"] = "ext_rocole"                   # unseen field clusters; mites keep label other_pest
            else:
                r["split"] = "train" if c in ROCOLE_TRAIN_CLUSTERS else "val"
                if r["label"] == "other_pest":
                    # Run 2: unseen mite photos were labelled healthy/rust with 95% confidence (0.974 mean) — a
                    # confidence threshold cannot catch that. Teach the existing 6th class to mean "I cannot read this
                    # leaf" (not a coffee leaf, or a condition outside my five): the app already abstains on it.
                    r["label"] = "not_coffee"; r["mite"] = "1"
        out.append(r)
    return out


def load_manifest(root: Path) -> list[dict]:
    with open(root / "manifest.csv") as f:
        return list(csv.DictReader(f))


def make_loader(root, rows, train, size, bs, workers, sampler=None):
    return DataLoader(LeafDS(root, rows, train, size), batch_size=bs, shuffle=False if sampler else train,
                      sampler=sampler, num_workers=workers, pin_memory=torch.cuda.is_available(),
                      drop_last=train, persistent_workers=workers > 0)


# ----------------------------------------------------------------------------- checkpoints

def atomic_save(obj, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    torch.save(obj, tmp)
    os.replace(tmp, path)


# SECURITY NOTE: checkpoints hold optimizer + RNG state, which need pickle (weights_only=False).
# Only ever load checkpoints WE wrote (own ckpt dir or our own private Kaggle dataset) — never a third party's file.
def find_resume(ckpt_dir: Path) -> Path | None:
    cands = [ckpt_dir / "last.pt"]
    cands += sorted(Path("/kaggle/input").glob("*/ckpt/last.pt")) if ON_KAGGLE else []
    cands += sorted(ckpt_dir.glob("epoch_*.pt"), reverse=True)
    for c in cands:
        if c.exists():
            try:
                torch.load(c, map_location="cpu", weights_only=False)
                return c
            except Exception as e:  # noqa: BLE001 - a corrupt file must not block the fallback
                print(f"checkpoint {c} unreadable ({e}); trying the next one")
    return None


def rng_state() -> dict:
    return {"py": random.getstate(), "np": np.random.get_state(), "torch": torch.get_rng_state(),
            "cuda": torch.cuda.get_rng_state_all() if torch.cuda.is_available() else None}


def set_rng_state(s: dict) -> None:
    random.setstate(s["py"]); np.random.set_state(s["np"]); torch.set_rng_state(s["torch"])
    if s.get("cuda") is not None and torch.cuda.is_available():
        torch.cuda.set_rng_state_all(s["cuda"])


# ----------------------------------------------------------------------------- eval + calibration

@torch.no_grad()
def predict_logits(model, loader, device) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    model.eval()
    L, Y, I = [], [], []
    for x, y, i in loader:
        L.append(model(x.to(device, non_blocking=True)).float().cpu())
        Y.append(y); I.append(i)
    return torch.cat(L).numpy(), torch.cat(Y).numpy(), torch.cat(I).numpy()


def softmax(z: np.ndarray, T: float = 1.0) -> np.ndarray:
    z = z / T
    z = z - z.max(1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(1, keepdims=True)


def macro_f1(y: np.ndarray, p: np.ndarray, k: int = len(CLASSES)) -> float:
    f = []
    for c in range(k):
        tp = ((p == c) & (y == c)).sum(); fp = ((p == c) & (y != c)).sum(); fn = ((p != c) & (y == c)).sum()
        f.append(0.0 if tp == 0 else 2 * tp / (2 * tp + fp + fn))
    return float(np.mean(f))


def fit_temperature(logits: np.ndarray, y: np.ndarray) -> float:
    z, t = torch.tensor(logits), torch.tensor(y)
    logT = torch.zeros(1, requires_grad=True)
    opt = torch.optim.LBFGS([logT], lr=0.1, max_iter=100)
    def closure():
        opt.zero_grad(); loss = F.cross_entropy(z / logT.exp(), t); loss.backward(); return loss
    opt.step(closure)
    return float(logT.exp().item())


def ece(probs: np.ndarray, y: np.ndarray, bins: int = 15) -> tuple[float, list]:
    conf, pred = probs.max(1), probs.argmax(1)
    edges = np.linspace(0, 1, bins + 1); tot, rel = 0.0, []
    for lo, hi in zip(edges[:-1], edges[1:]):
        m = (conf > lo) & (conf <= hi)
        if m.any():
            acc, cf = float((pred[m] == y[m]).mean()), float(conf[m].mean())
            tot += m.mean() * abs(acc - cf); rel.append((cf, acc, int(m.sum())))
    return float(tot), rel


def selective_curve(probs: np.ndarray, y: np.ndarray, known_mask: np.ndarray) -> list[dict]:
    """Accuracy on the answered cases vs the share the tool refuses ("not sure — ask a person")."""
    conf, pred = probs.max(1), probs.argmax(1)
    rows = []
    for th in np.round(np.arange(0.0, 0.99, 0.05), 2):
        ans = conf >= th
        cov = float(ans.mean())
        acc = float((pred[ans] == y[ans]).mean()) if ans.any() else float("nan")
        rows.append({"threshold": float(th), "answered_share": round(cov, 4),
                     "abstain_share": round(1 - cov, 4), "accuracy_on_answered": round(acc, 4)})
    return rows


def report_split(name: str, logits, y, rows, T, out: Path) -> dict:
    keep = y >= 0
    probs = softmax(logits, T)
    res: dict = {"n": int(len(y)), "temperature": T}
    if keep.any():
        pred = probs.argmax(1)
        res["accuracy"] = float((pred[keep] == y[keep]).mean())
        res["macro_f1"] = macro_f1(y[keep], pred[keep])
        res["ece"], rel = ece(probs[keep], y[keep])
        res["per_class_recall"] = {CLASSES[c]: float((pred[keep & (y == c)] == c).mean())
                                   for c in range(len(CLASSES)) if (keep & (y == c)).any()}
        cm = np.zeros((len(CLASSES),) * 2, int)
        for a, b in zip(y[keep], pred[keep]):
            cm[a, b] += 1
        with open(out / f"confusion_{name}.csv", "w", newline="") as f:
            w = csv.writer(f); w.writerow(["true\\pred"] + CLASSES)
            for c, row in zip(CLASSES, cm):
                w.writerow([c] + list(row))
        sel = selective_curve(probs[keep], y[keep], keep[keep])
        with open(out / f"selective_{name}.csv", "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=list(sel[0])); w.writeheader(); w.writerows(sel)
        res["selective"] = sel
        res["reliability"] = rel
    # per data source (country / camera shift evidence)
    src = np.array([rows[i]["source"] for i in range(len(rows))])
    res["per_source_accuracy"] = {s: float((probs.argmax(1)[(src == s) & keep] == y[(src == s) & keep]).mean())
                                  for s in sorted(set(src)) if ((src == s) & keep).any()}
    return res


def plot_curves(metrics: dict, out: Path) -> None:
    try:
        import matplotlib; matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except Exception:  # noqa: BLE001 - plots are nice-to-have
        return
    for split in ("val", "test", "ext_rocole"):
        m = metrics.get(split)
        if not m or "reliability" not in m:
            continue
        fig, ax = plt.subplots(1, 2, figsize=(9, 4))
        r = np.array(m["reliability"])
        ax[0].plot([0, 1], [0, 1], "--", c="grey"); ax[0].scatter(r[:, 0], r[:, 1], s=20 + r[:, 2] / r[:, 2].max() * 120)
        ax[0].set(xlabel="confidence", ylabel="accuracy", title=f"{split}: reliability (ECE {m['ece']:.3f})")
        s = m["selective"]
        ax[1].plot([x["abstain_share"] for x in s], [x["accuracy_on_answered"] for x in s], marker="o")
        ax[1].set(xlabel="share sent to a person", ylabel="accuracy on answered", title=f"{split}: selective accuracy")
        fig.tight_layout(); fig.savefig(out / f"curves_{split}.png", dpi=120); plt.close(fig)


# ----------------------------------------------------------------------------- main

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="auto" if ON_KAGGLE else "data/processed/ikawa_data")
    ap.add_argument("--out-dir", default="/kaggle/working/out" if ON_KAGGLE else "runs/latest")
    ap.add_argument("--ckpt-dir", default="/kaggle/working/ckpt" if ON_KAGGLE else "checkpoints")
    ap.add_argument("--arch", default="mobilenetv2_100")  # int8-friendly; MobileNetV3 loses 21-39 pts under int8 (D-027)
    ap.add_argument("--size", type=int, default=224)
    ap.add_argument("--epochs", type=int, default=25)
    ap.add_argument("--batch-size", type=int, default=64)
    ap.add_argument("--lr", type=float, default=2e-3)
    ap.add_argument("--wd", type=float, default=1e-4)
    ap.add_argument("--workers", type=int, default=min(4, os.cpu_count() or 1))
    ap.add_argument("--train-sources", default="jmuben,bracol,plantvillage,cassava,rocole")
    ap.add_argument("--resume", default="auto", help="auto | none | path/to/ckpt.pt")
    ap.add_argument("--max-minutes", type=float, default=0, help="stop cleanly after N minutes (0 = no limit)")
    ap.add_argument("--seed", type=int, default=1337)
    ap.add_argument("--smoke", action="store_true", help="tiny run to verify the pipeline")
    args = ap.parse_args()

    root, out, ckpt_dir = Path(args.data), Path(args.out_dir), Path(args.ckpt_dir)
    root = resolve_root(find_data_root() if args.data == "auto" else root)
    out.mkdir(parents=True, exist_ok=True); ckpt_dir.mkdir(parents=True, exist_ok=True)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    random.seed(args.seed); np.random.seed(args.seed); torch.manual_seed(args.seed)

    rows = resplit_rocole(load_manifest(root))
    srcs = set(args.train_sources.split(","))
    tr = [r for r in rows if r["split"] == "train" and r["source"] in srcs]
    va = [r for r in rows if r["split"] == "val" and r["source"] in srcs]
    if args.smoke:
        rng = random.Random(0); rng.shuffle(tr); rng.shuffle(va)
        tr, va = tr[:256], va[:128]; args.epochs, args.batch_size, args.workers = 2, 32, 0
    evals = {n: [r for r in rows if r["split"] == n] for n in ("val", "test", "ext_rocole")}
    evals["val"] = [r for r in evals["val"] if r["source"] in srcs] if not args.smoke else va
    if args.smoke:
        evals = {k: v[:128] for k, v in evals.items()}
    print(f"device={device} train={len(tr)} val={len(va)} classes={Counter(r['label'] for r in tr)}")

    # class-balanced sampling: every class seen about equally often per epoch
    cnt = Counter(r["label"] for r in tr)
    MITE_BOOST = 8.0   # ~100 mite images vs 2,700 other negatives: without a boost they are almost never drawn
    w = torch.tensor([(MITE_BOOST if r.get("mite") else 1.0) / cnt[r["label"]] for r in tr], dtype=torch.double)

    import timm
    model = timm.create_model(args.arch, pretrained=True, num_classes=len(CLASSES)).to(device)
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=args.wd)
    steps_per_epoch = max(1, len(tr) // args.batch_size)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=args.lr, total_steps=args.epochs * steps_per_epoch, pct_start=0.15)
    use_amp = device.type == "cuda"
    scaler = torch.amp.GradScaler(enabled=use_amp)

    start_epoch, best_f1, history = 0, -1.0, []
    if args.resume != "none":
        path = Path(args.resume) if args.resume != "auto" else find_resume(ckpt_dir)
        if path and path.exists():
            ck = torch.load(path, map_location="cpu", weights_only=False)
            model.load_state_dict(ck["model"]); opt.load_state_dict(ck["opt"]); sched.load_state_dict(ck["sched"])
            scaler.load_state_dict(ck["scaler"]); set_rng_state(ck["rng"])
            start_epoch, best_f1, history = ck["epoch"] + 1, ck["best_f1"], ck["history"]
            print(f"RESUMED from {path} at epoch {start_epoch} (best macro-F1 so far {best_f1:.4f})")
        else:
            print("no checkpoint found — starting fresh")

    stop = {"flag": False}
    def on_signal(signum, _):
        print(f"signal {signum}: finishing the current epoch, then saving and exiting"); stop["flag"] = True
    signal.signal(signal.SIGTERM, on_signal); signal.signal(signal.SIGINT, on_signal)

    def save(epoch: int, tag: str = "last") -> None:
        atomic_save({"model": model.state_dict(), "opt": opt.state_dict(), "sched": sched.state_dict(),
                     "scaler": scaler.state_dict(), "epoch": epoch, "best_f1": best_f1, "history": history,
                     "rng": rng_state(), "config": vars(args), "classes": CLASSES}, ckpt_dir / f"{tag}.pt")

    val_loader = make_loader(root, va, False, args.size, args.batch_size * 2, args.workers)
    t0 = time.time()
    for epoch in range(start_epoch, args.epochs):
        g = torch.Generator(); g.manual_seed(args.seed * 1000 + epoch)  # same order whether resumed or not
        sampler = WeightedRandomSampler(w, num_samples=steps_per_epoch * args.batch_size, replacement=True, generator=g)
        loader = make_loader(root, tr, True, args.size, args.batch_size, args.workers, sampler)
        model.train(); run, n_seen, te = 0.0, 0, time.time()
        for x, y, _ in loader:
            x, y = x.to(device, non_blocking=True), y.to(device, non_blocking=True)
            with torch.autocast(device_type=device.type, enabled=use_amp):
                loss = F.cross_entropy(model(x), y, label_smoothing=0.1)
            opt.zero_grad(set_to_none=True)
            scaler.scale(loss).backward(); scaler.step(opt); scaler.update(); sched.step()
            run += loss.item() * len(y); n_seen += len(y)
        logits, yv, _ = predict_logits(model, val_loader, device)
        f1 = macro_f1(yv, logits.argmax(1)); acc = float((logits.argmax(1) == yv).mean())
        history.append({"epoch": epoch, "train_loss": run / max(1, n_seen), "val_acc": acc, "val_macro_f1": f1,
                        "lr": sched.get_last_lr()[0], "seconds": round(time.time() - te)})
        print(f"epoch {epoch + 1}/{args.epochs}  loss {run / max(1, n_seen):.4f}  val acc {acc:.4f}  macro-F1 {f1:.4f}  ({time.time() - te:.0f}s)")
        if f1 > best_f1:
            best_f1 = f1; save(epoch, "best")
        save(epoch, "last")
        atomic_save(torch.load(ckpt_dir / "last.pt", map_location="cpu", weights_only=False), ckpt_dir / f"epoch_{epoch:03d}.pt")
        for old in sorted(ckpt_dir.glob("epoch_*.pt"))[:-3]:
            old.unlink()
        if stop["flag"] or (args.max_minutes and (time.time() - t0) / 60 > args.max_minutes):
            print("stopping early; resume with the same command"); break
    else:
        pass

    done = len(history) >= args.epochs
    with open(out / "history.csv", "w", newline="") as f:
        w_ = csv.DictWriter(f, fieldnames=list(history[0])); w_.writeheader(); w_.writerows(history)
    if not done:
        print(f"partial run ({len(history)}/{args.epochs} epochs). Re-run to continue.")
        return 0

    # ---- final evaluation with the best checkpoint
    ck = torch.load(ckpt_dir / "best.pt", map_location="cpu", weights_only=False)
    model.load_state_dict(ck["model"])
    vl, vy, _ = predict_logits(model, val_loader, device)
    T = fit_temperature(vl[vy >= 0], vy[vy >= 0])
    (out / "temperature.json").write_text(json.dumps({"temperature": T, "classes": CLASSES}))
    metrics: dict = {"temperature": T, "best_epoch": int(np.argmax([h["val_macro_f1"] for h in history])), "args": vars(args)}
    for name, rws in evals.items():
        if not rws:
            continue
        lg, yy, _ = predict_logits(model, make_loader(root, rws, False, args.size, args.batch_size * 2, args.workers), device)
        metrics[name] = report_split(name, lg, yy, rws, T, out)
        if name == "ext_rocole":  # unknown pest class (other_pest, label -1): the right answer is to abstain
            unk = np.array([r["label"] == "other_pest" for r in rws])
            if unk.any():
                pr = softmax(lg, T)
                conf, pred = pr.max(1), pr.argmax(1)
                metrics[name]["other_pest_n"] = int(unk.sum())
                metrics[name]["other_pest_mean_confidence"] = float(conf[unk].mean())
                metrics[name]["other_pest_share_below_0.6"] = float((conf[unk] < 0.6).mean())
                flagged = (pred[unk] == C2I["not_coffee"]) | (conf[unk] < 0.6)
                metrics[name]["other_pest_flagged_share"] = float(flagged.mean())   # = safely abstained
                metrics[name]["other_pest_predicted_as"] = {CLASSES[c]: int((pred[unk] == c).sum()) for c in range(len(CLASSES))}
    (out / "metrics.json").write_text(json.dumps(metrics, indent=1, default=float))
    plot_curves(metrics, out)
    torch.save({"model": model.state_dict(), "classes": CLASSES, "temperature": T, "arch": args.arch, "size": args.size},
               out / "model_fp32.pt")
    print(json.dumps({k: {kk: v[kk] for kk in ("n", "accuracy", "macro_f1", "ece") if kk in v}
                      for k, v in metrics.items() if isinstance(v, dict) and "n" in v}, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
