"""Ikawa data preparation — runs as the Kaggle kernel `ikawa-data` (CPU + internet) or locally.

What it does
  1. Collects images from:
       - JMuBEN + JMuBEN2 (Arabica, Kenya)   ← downloaded from Mendeley, SHA-256 verified
       - BRACOL (Arabica, Brazil)            ← our private Kaggle dataset `ikawa-bracol`
       - RoCoLe (Robusta, Ecuador, field)    ← Kaggle dataset
       - PlantVillage (non-coffee, studio)   ← Kaggle dataset, sampled → `not_coffee`
       - Cassava Leaf Disease (field, Uganda)← Kaggle competition, sampled → `not_coffee`
  2. Resizes every image (short side 256 px) into one compact folder.
  3. Finds duplicates and augmented copies with a flip/rotation-invariant perceptual hash,
     groups them (union-find), and splits **by group** so copies never leak across splits.
  4. Writes  ikawa_data/manifest.csv  and  ikawa_data/report.json  (evidence for the video).

Splits
  train / val / test   ← JMuBEN + BRACOL + not_coffee (70/15/15 by group, so no copy crosses a split)
  ext_rocole           ← external test, never trained on: different species (Robusta), country (Ecuador)
                          and camera (smartphone, field). Red spider mite images are kept as
                          `other_pest` = a class the model does not know, so the right answer is to abstain.
  Per-source accuracy is reported by ml/train.py; train with --train-sources to run the
  country-shift ablation (e.g. JMuBEN only → test on BRACOL).

Usage
  Kaggle:  (no args)                          python prepare_data.py
  Local:   uv run python ml/prepare_data.py --input-roots data/raw --out data/processed \
                --skip-mendeley --limit-per-class 150
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import random
import shutil
import sys
import time
import urllib.request
import zipfile
from collections import Counter, defaultdict
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

ON_KAGGLE = Path("/kaggle/input").exists()
IMG_EXT = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
SEED = 1337
SHORT_SIDE = 256
HAMMING_NEAR = 7          # candidate threshold on canonical dHash (64 bits)
CORR_MIN = 0.95           # confirm a near-copy only if thumbnails correlate this much
MAX_BUCKET = 4000         # cap pairwise compare in pathological buckets (exact copies still merged)

# Final label set (closed list — see docs/decisions.md D-004)
CLASSES = ["healthy", "leaf_rust", "cercospora", "phoma", "leaf_miner", "not_coffee"]

MENDELEY = [  # (label, url, sha256)  — JMuBEN (t2r6rszp5c) and JMuBEN2 (tgv3zb82nd), CC BY 4.0
    ("cercospora", "https://data.mendeley.com/public-files/datasets/t2r6rszp5c/files/8657d2a2-c9a1-4733-9dbc-00c83aa3575a/file_downloaded",
     "434e85d292243cc5c5a85d90d50786bf790fcee92e4be8d16c0910f82e907b21"),
    ("leaf_rust", "https://data.mendeley.com/public-files/datasets/t2r6rszp5c/files/8c7c2915-f979-43f6-b3fd-b3bc7407da87/file_downloaded",
     "0fd03c69e0fac77142c594e41b58dabbccba005a414d5f1954913264b4ecc8af"),
    ("phoma", "https://data.mendeley.com/public-files/datasets/t2r6rszp5c/files/82625dd3-e908-4224-93b5-06a3b74f0c8a/file_downloaded",
     "be3b15c6e2010fb7ed5f97e0f03379a18829991915a2abb7eb39db82172d368e"),
    ("healthy", "https://data.mendeley.com/public-files/datasets/tgv3zb82nd/files/d126777d-c495-4b7a-846a-c0228540ea10/file_downloaded",
     "e3d2e315106f143533e8ebb9dde4b06dbca7b8164dfa4e5918fda70165b7fbca"),
    ("leaf_miner", "https://data.mendeley.com/public-files/datasets/tgv3zb82nd/files/f6d37632-6349-4be9-9af0-c3177dbfaa8a/file_downloaded",
     "c55d7a0c0e5b5d3e5a172ab8b1123accc192fa1ed1192c689fcd14956e3cfe54"),
]

# BRACOL dataset.csv `predominant_stress` codes (per the BRACOL paper); 5 is excluded (not in our classes)
BRACOL_MAP = {"0": "healthy", "1": "leaf_miner", "2": "leaf_rust", "3": "phoma", "4": "cercospora"}


# ----------------------------------------------------------------------------- download

def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def fetch_mendeley(work: Path, report: dict) -> list[tuple[str, str, str]]:
    """Download + verify + extract JMuBEN zips. Returns (path, label, source) items."""
    items = []
    dl_dir = work / "mendeley"
    dl_dir.mkdir(parents=True, exist_ok=True)
    for label, url, sha in MENDELEY:
        zpath = dl_dir / f"{label}.zip"
        if not zpath.exists() or sha256_of(zpath) != sha:
            t0 = time.time()
            tmp = zpath.with_suffix(".part")
            req = urllib.request.Request(url, headers={"User-Agent": "ikawa-hackathon/0.1"})
            with urllib.request.urlopen(req, timeout=600) as r, open(tmp, "wb") as f:
                shutil.copyfileobj(r, f, length=1 << 22)
            tmp.rename(zpath)
            print(f"  downloaded {label} in {time.time() - t0:.0f}s")
        got = sha256_of(zpath)
        ok = got == sha
        report["mendeley"][label] = {"sha256_ok": ok, "bytes": zpath.stat().st_size}
        if not ok:
            print(f"!! checksum mismatch for {label}; skipping")
            continue
        ex_dir = dl_dir / label
        if not ex_dir.exists():
            with zipfile.ZipFile(zpath) as z:
                z.extractall(ex_dir)
        n = 0
        for p in ex_dir.rglob("*"):
            if p.suffix.lower() in IMG_EXT:
                items.append((str(p), label, "jmuben"))
                n += 1
        print(f"  jmuben/{label}: {n} files")
        zpath.unlink()  # free disk; extracted copy is enough
    return items


# ----------------------------------------------------------------------------- discovery

def discover(roots: list[Path], limit_not_coffee: int, rng: random.Random) -> list[tuple[str, str, str]]:
    items: list[tuple[str, str, str]] = []
    pv_by_dir: dict[str, list[str]] = defaultdict(list)
    cassava: list[str] = []
    for root in roots:
        if not root.exists():
            continue
        # BRACOL: dataset.csv next to images/
        for csv_path in root.rglob("dataset.csv"):
            img_dir = csv_path.parent / "images"
            if not img_dir.is_dir():
                continue
            with open(csv_path) as f:
                for row in csv.DictReader(f):
                    lab = BRACOL_MAP.get(row["predominant_stress"])
                    p = img_dir / f"{row['id']}.jpg"
                    if lab and p.exists():
                        items.append((str(p), lab, "bracol"))
        for dirpath, _, files in os.walk(root):
            low = dirpath.lower()
            imgs = [f for f in files if Path(f).suffix.lower() in IMG_EXT]
            if not imgs:
                continue
            if "jmuben" in low:  # a local / Kaggle copy of JMuBEN (Mendeley download is handled separately)
                leaf = Path(dirpath).name.lower()
                lab = next((v for k, v in (("rust", "leaf_rust"), ("cerc", "cercospora"), ("phoma", "phoma"),
                                           ("miner", "leaf_miner"), ("healthy", "healthy")) if k in leaf), None)
                if lab:
                    items += [(os.path.join(dirpath, f), lab, "jmuben") for f in imgs]
            elif "rocole" in low:
                leaf = Path(dirpath).name.lower()
                lab = ("healthy" if "healthy" in leaf else
                       "other_pest" if ("spider" in leaf or "mite" in leaf) else
                       "leaf_rust" if "rust" in leaf else None)
                if lab:
                    items += [(os.path.join(dirpath, f), lab, "rocole") for f in imgs]
            elif "plantvillage" in low and f"{os.sep}color{os.sep}" in dirpath + os.sep:
                pv_by_dir[dirpath] += [os.path.join(dirpath, f) for f in imgs]
            elif "cassava" in low and "train_images" in low:
                cassava += [os.path.join(dirpath, f) for f in imgs]
    # sample not_coffee: half PlantVillage (stratified over crop/disease folders), half Cassava field photos
    half = limit_not_coffee // 2
    if pv_by_dir:
        per_dir = max(1, half // len(pv_by_dir))
        for d, fs in sorted(pv_by_dir.items()):
            rng.shuffle(fs)
            items += [(f, "not_coffee", "plantvillage") for f in fs[:per_dir]]
    rng.shuffle(cassava)
    items += [(f, "not_coffee", "cassava") for f in cassava[:half]]
    return items


# ----------------------------------------------------------------------------- hashing / resizing

def dhash64(img: Image.Image) -> int:
    g = img.convert("L").resize((9, 8), Image.Resampling.LANCZOS)
    px = list(g.getdata())
    bits = 0
    for r in range(8):
        for c in range(8):
            bits = (bits << 1) | (px[r * 9 + c] > px[r * 9 + c + 1])
    return bits


def dihedral_variants(img: Image.Image) -> list[Image.Image]:
    T = Image.Transpose
    return [img, img.transpose(T.FLIP_LEFT_RIGHT), img.transpose(T.FLIP_TOP_BOTTOM),
            img.transpose(T.ROTATE_90), img.transpose(T.ROTATE_180), img.transpose(T.ROTATE_270),
            img.transpose(T.TRANSPOSE), img.transpose(T.TRANSVERSE)]


def canonical_hash_and_thumb(img: Image.Image) -> tuple[int, bytes]:
    """Min dHash over the 8 flips/rotations (identical for flipped/rotated copies) and a
    normalised 32x32 grey thumbnail in that same canonical orientation (for verification)."""
    variants = dihedral_variants(img.convert("L").resize((32, 32), Image.Resampling.BILINEAR))
    hashes = [dhash64(v) for v in variants]
    k = min(range(8), key=hashes.__getitem__)
    px = list(variants[k].getdata())
    mean = sum(px) / len(px)
    std = (sum((x - mean) ** 2 for x in px) / len(px)) ** 0.5 + 1e-6
    thumb = bytes(max(0, min(255, int(128 + 40 * (x - mean) / std))) for x in px)  # z-score → uint8
    return hashes[k], thumb


def process_one(args: tuple[int, str, str, str, str]) -> tuple:
    idx, path, label, source, out_dir = args
    try:
        raw = Path(path).read_bytes()
        md5 = hashlib.md5(raw).hexdigest()
        with Image.open(path) as im:
            im = ImageOps.exif_transpose(im).convert("RGB")
            w, h = im.size
            hsh, thumb = canonical_hash_and_thumb(im)
            s = SHORT_SIDE / min(w, h)
            if s < 1:
                im = im.resize((max(1, round(w * s)), max(1, round(h * s))), Image.Resampling.LANCZOS)
            rel = f"images/{source}/{idx:06d}.jpg"
            dst = Path(out_dir) / rel
            dst.parent.mkdir(parents=True, exist_ok=True)
            im.save(dst, quality=90)
        return idx, rel, hsh, w, h, md5, thumb
    except Exception:  # noqa: BLE001 - corrupt images are skipped and counted
        return idx, None, None, 0, 0, None, None


# ----------------------------------------------------------------------------- grouping

class UnionFind:
    def __init__(self, n: int):
        self.p = list(range(n))

    def find(self, x: int) -> int:
        while self.p[x] != x:
            self.p[x] = self.p[self.p[x]]
            x = self.p[x]
        return x

    def union(self, a: int, b: int) -> None:
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.p[max(ra, rb)] = min(ra, rb)


def _popcount64(x: np.ndarray) -> np.ndarray:
    if hasattr(np, "bitwise_count"):
        return np.bitwise_count(x)
    b = x.view(np.uint8).reshape(*x.shape, 8)
    return _POP_LUT[b].sum(-1)


_POP_LUT = np.array([bin(i).count("1") for i in range(256)], dtype=np.uint8)


def group_images(md5s: list[str], hashes: list[int], thumbs: list[bytes]) -> tuple[list[int], dict]:
    """Union-find over (a) byte-identical files and (b) near-copies: candidates share an 8-bit band of
    the canonical dHash (pigeonhole → recall for Hamming ≤ 7), confirmed only if the canonical
    thumbnails correlate ≥ CORR_MIN. The second check removes false matches between different
    leaves photographed on similar plain backgrounds (we measured these on BRACOL)."""
    n = len(md5s)
    uf = UnionFind(n)
    first: dict[str, int] = {}
    for i, m in enumerate(md5s):
        if m in first:
            uf.union(i, first[m])
        else:
            first[m] = i
    reps = np.array(sorted(first.values()), dtype=np.int64)
    H = np.array([hashes[i] for i in reps], dtype=np.uint64)
    X = (np.frombuffer(b"".join(thumbs[i] for i in reps), dtype=np.uint8)
         .reshape(len(reps), -1).astype(np.float32) - 128.0) / 40.0
    X /= np.linalg.norm(X, axis=1, keepdims=True) + 1e-6
    near_pairs, skipped = 0, 0
    for band in range(8):
        keys = ((H >> np.uint64(8 * band)) & np.uint64(0xFF)).astype(np.int64)
        order = np.argsort(keys, kind="stable")
        bounds = np.flatnonzero(np.diff(keys[order])) + 1
        for B in np.split(order, bounds):
            if len(B) < 2:
                continue
            if len(B) > MAX_BUCKET:
                skipped += 1
                B = B[:MAX_BUCKET]
            d = _popcount64(H[B][:, None] ^ H[B][None, :])
            ii, jj = np.nonzero(np.triu(d <= HAMMING_NEAR, 1))
            if len(ii) == 0:
                continue
            corr = np.einsum("ij,ij->i", X[B[ii]], X[B[jj]])
            for a, b in zip(B[ii][corr >= CORR_MIN], B[jj][corr >= CORR_MIN]):
                uf.union(int(reps[a]), int(reps[b]))
                near_pairs += 1
    roots = [uf.find(i) for i in range(n)]
    return roots, {"files": n, "byte_unique": len(first), "near_dup_pairs": near_pairs,
                   "groups": len(set(roots)), "skipped_buckets": skipped}


def split_of(group_root: int, salt: str = "ikawa") -> str:
    v = int(hashlib.md5(f"{salt}:{group_root}".encode()).hexdigest()[:8], 16) / 0xFFFFFFFF
    return "train" if v < 0.70 else "val" if v < 0.85 else "test"


# ----------------------------------------------------------------------------- main

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input-roots", nargs="*", default=["/kaggle/input"] if ON_KAGGLE else ["data/raw"])
    ap.add_argument("--out", default="/kaggle/working" if ON_KAGGLE else "data/processed")
    ap.add_argument("--work", default="/kaggle/tmp" if ON_KAGGLE else "data/interim")
    ap.add_argument("--skip-mendeley", action="store_true")
    ap.add_argument("--not-coffee", type=int, default=4000, help="total not_coffee images (PV + cassava)")
    ap.add_argument("--limit-per-class", type=int, default=0, help="smoke-test cap per (source,label)")
    ap.add_argument("--workers", type=int, default=os.cpu_count() or 2)
    ap.add_argument("--pack", action="store_true", default=ON_KAGGLE,
                    help="pack images/ into one ikawa_data.tar (a single file hands over between Kaggle kernels fast)")
    args = ap.parse_args()

    t_start = time.time()
    rng = random.Random(SEED)
    out = Path(args.out) / "ikawa_data"
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    report: dict = {"mendeley": {}, "classes": CLASSES, "seed": SEED,
                    "hamming_near": HAMMING_NEAR, "corr_min": CORR_MIN, "short_side": SHORT_SIDE}

    items: list[tuple[str, str, str]] = []
    if not args.skip_mendeley:
        items += fetch_mendeley(Path(args.work), report)
    items += discover([Path(r) for r in args.input_roots], args.not_coffee, rng)

    if args.limit_per_class:
        by: dict[tuple[str, str], list] = defaultdict(list)
        for it in items:
            by[(it[2], it[1])].append(it)
        items = []
        for k in sorted(by):
            rng.shuffle(by[k])
            items += by[k][: args.limit_per_class]

    report["raw_counts"] = {f"{s}/{l}": c for (s, l), c in sorted(Counter((s, l) for _, l, s in items).items())}
    print("raw:", json.dumps(report["raw_counts"], indent=1))

    jobs = [(i, p, l, s, str(out)) for i, (p, l, s) in enumerate(items)]
    results: dict[int, tuple] = {}
    with ProcessPoolExecutor(max_workers=args.workers) as ex:
        for k, r in enumerate(ex.map(process_one, jobs, chunksize=64)):
            if r[1]:
                results[r[0]] = r
            if k % 5000 == 0:
                print(f"  processed {k}/{len(jobs)}")
    keep = sorted(results)
    report["unreadable"] = len(items) - len(keep)

    roots, gstats = group_images([results[i][5] for i in keep], [results[i][2] for i in keep],
                                 [results[i][6] for i in keep])
    report["grouping"] = gstats

    # per-group label sets → conflicts (same picture, different labels)
    group_labels: dict[int, set] = defaultdict(set)
    group_sources: dict[int, set] = defaultdict(set)
    for k, i in enumerate(keep):
        group_labels[roots[k]].add(items[i][1])
        group_sources[roots[k]].add(items[i][2])
    conflicts = {g for g, ls in group_labels.items() if len(ls) > 1}
    report["label_conflict_groups"] = len(conflicts)

    train_sources = {"jmuben", "bracol", "plantvillage", "cassava"}
    # groups that touch training sources: external copies of them would leak
    train_groups = {g for g, ss in group_sources.items() if ss & train_sources}

    rows, dup_stats = [], defaultdict(lambda: [0, set()])
    dropped = Counter()
    seen_md5: set[str] = set()
    for k, i in enumerate(keep):
        path, label, source = items[i]
        g = roots[k]
        dup_stats[f"{source}/{label}"][0] += 1
        dup_stats[f"{source}/{label}"][1].add(g)
        if results[i][5] in seen_md5:  # byte-identical copy: keep one file, the group id still records it
            dropped["byte_identical_copy"] += 1
            continue
        seen_md5.add(results[i][5])
        if g in conflicts:
            dropped["label_conflict"] += 1
            continue
        if source in train_sources:
            split = split_of(g)
        else:
            if g in train_groups:
                dropped[f"leak_{source}"] += 1
                continue
            split = f"ext_{source}"
        _, rel, _, w, h, md5, _ = results[i]
        rows.append({"file": rel, "label": label, "source": source, "split": split,
                     "group": g, "md5": md5, "orig_w": w, "orig_h": h, "orig_path": path})

    report["dropped"] = dict(dropped)
    report["files_vs_unique"] = {k: {"files": v[0], "unique_groups": len(v[1]),
                                     "duplicate_ratio": round(1 - len(v[1]) / max(1, v[0]), 3)}
                                 for k, v in sorted(dup_stats.items())}
    report["final_counts"] = {f"{sp}/{lab}": c for (sp, lab), c in
                              sorted(Counter((r["split"], r["label"]) for r in rows).items())}

    with open(out / "manifest.csv", "w", newline="") as f:
        wr = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        wr.writeheader()
        wr.writerows(rows)
    # remove resized files that were dropped, to keep the output small
    kept_files = {r["file"] for r in rows}
    for k, i in enumerate(keep):
        rel = results[i][1]
        if rel not in kept_files:
            (out / rel).unlink(missing_ok=True)

    report["seconds"] = round(time.time() - t_start)
    (out / "report.json").write_text(json.dumps(report, indent=1))
    if args.pack:
        import tarfile
        with tarfile.open(out / "images.tar", "w") as tf:   # jpgs are already compressed → plain tar
            tf.add(out / "images", arcname="images")
        shutil.rmtree(out / "images")
        print("packed images/ → images.tar")
    print(json.dumps({k: report[k] for k in ("grouping", "dropped", "final_counts", "files_vs_unique")}, indent=1))
    print(f"done → {out}  ({len(rows)} images, {report['seconds']}s)")


if __name__ == "__main__":
    sys.exit(main())
