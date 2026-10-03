"""Export the trained leaf model for the phone: PyTorch → ONNX → int8, and PROVE the int8 model still works.

    python ml/export.py --run runs/latest --data data/processed/ikawa_data --out app/public/model

What it does
  1. Loads <run>/model_fp32.pt (written by train.py).
  2. Exports ONNX (opset 17, fixed 1x3xSxS input).
  3. Static int8 quantisation with ~300 REAL calibration images (validation split) — no random calibration.
  4. Evaluates fp32-ONNX and int8-ONNX on the val/test/ext_rocole splits with onnxruntime (same preprocessing as the app).
  5. Decision rule: ship int8 only if accuracy drops ≤ --max-drop points (default 2.0) on `test`;
     otherwise ship fp32 and say so in meta.json. The app reads meta.json, so the decision is never hidden.
  6. Writes <out>/leaf_int8.onnx (or leaf_fp32.onnx), <out>/meta.json, and <run>/export_report.json.
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

import numpy as np
import torch
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from train import CLASSES, IMAGENET_MEAN, IMAGENET_STD, load_manifest, resolve_root, resplit_rocole  # noqa: E402


def preprocess(path: Path, size: int) -> np.ndarray:
    with Image.open(path) as im:
        im = im.convert("RGB").resize((size, size), Image.Resampling.BILINEAR)
    x = (np.asarray(im, dtype=np.float32) / 255.0 - np.array(IMAGENET_MEAN, np.float32)) / np.array(IMAGENET_STD, np.float32)
    return x.transpose(2, 0, 1)[None]


class Calib:
    def __init__(self, files: list[Path], size: int, name: str):
        self.it, self.size, self.name = iter(files), size, name

    def get_next(self):
        f = next(self.it, None)
        return None if f is None else {self.name: preprocess(f, self.size)}


def run_onnx(model_path: Path, rows: list[dict], root: Path, size: int) -> tuple[np.ndarray, np.ndarray]:
    import onnxruntime as ort
    so = ort.SessionOptions(); so.intra_op_num_threads = 4
    sess = ort.InferenceSession(str(model_path), so, providers=["CPUExecutionProvider"])
    name = sess.get_inputs()[0].name
    L, Y = [], []
    for r in rows:
        L.append(sess.run(None, {name: preprocess(root / r["file"], size)})[0][0])
        Y.append(CLASSES.index(r["label"]) if r["label"] in CLASSES else -1)
    return np.array(L), np.array(Y)


def acc(lg: np.ndarray, y: np.ndarray) -> float:
    k = y >= 0
    return float((lg.argmax(1)[k] == y[k]).mean()) if k.any() else float("nan")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", default="runs/latest")
    ap.add_argument("--data", default="data/processed/ikawa_data")
    ap.add_argument("--out", default="app/public/model")
    ap.add_argument("--calib", type=int, default=100, help="calibration images; ONNX keeps ALL activations in RAM (~45 MB/image for 224px MobileNetV2): 300 images need ~13 GB")
    ap.add_argument("--eval-max", type=int, default=1500, help="cap images per split for evaluation speed")
    ap.add_argument("--max-drop", type=float, default=2.0, help="max accuracy drop (points) allowed for shipping int8")
    args = ap.parse_args()

    run, out = Path(args.run), Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    root = resolve_root(Path(args.data))
    ck = torch.load(run / "model_fp32.pt", map_location="cpu", weights_only=True)  # tensors + plain values only
    size, T = int(ck["size"]), float(ck["temperature"])

    import timm
    model = timm.create_model(ck["arch"], pretrained=False, num_classes=len(CLASSES))
    model.load_state_dict(ck["model"]); model.eval()
    fp32 = run / "leaf_fp32.onnx"
    torch.onnx.export(model, torch.zeros(1, 3, size, size), str(fp32), input_names=["input"], output_names=["logits"],
                      opset_version=17, dynamo=False)
    print(f"fp32 onnx: {fp32.stat().st_size / 1e6:.2f} MB")

    from onnxruntime.quantization import CalibrationMethod, QuantFormat, QuantType, quantize_static
    from onnxruntime.quantization.shape_inference import quant_pre_process
    rows = resplit_rocole(load_manifest(root))
    val = [r for r in rows if r["split"] == "val"]
    rng = np.random.default_rng(0); rng.shuffle(val)
    cal_files = [root / r["file"] for r in val[: args.calib]]
    pre = run / "leaf_fp32_pre.onnx"
    quant_pre_process(str(fp32), str(pre))
    # MobileNetV3 (hard-swish + squeeze-excite) is notoriously sensitive to int8. Try several recipes,
    # evaluate each on real images, and keep the smallest one that stays accurate.
    recipes = {
        "conv_only_percentile": dict(op_types_to_quantize=["Conv"], calibrate_method=CalibrationMethod.Percentile),
        "conv_only_minmax": dict(op_types_to_quantize=["Conv"], calibrate_method=CalibrationMethod.MinMax),
        "all_ops_percentile": dict(calibrate_method=CalibrationMethod.Percentile),
    }
    eval_rows = [r for r in rows if r["split"] == "val"]
    rng.shuffle(eval_rows); eval_rows = eval_rows[: min(300, len(eval_rows))]
    l32v, yv = run_onnx(fp32, eval_rows, root, size)
    candidates = {}
    for name, kw in recipes.items():
        path = run / f"leaf_int8_{name}.onnx"
        quantize_static(str(pre), str(path), Calib(cal_files, size, "input"), quant_format=QuantFormat.QOperator,
                        activation_type=QuantType.QUInt8, weight_type=QuantType.QInt8, per_channel=True, **kw)
        l8v, _ = run_onnx(path, eval_rows, root, size)
        candidates[name] = {"mb": path.stat().st_size / 1e6, "val_drop_points": (acc(l32v, yv) - acc(l8v, yv)) * 100}
        print(f"recipe {name}: {candidates[name]['mb']:.2f} MB, val accuracy drop {candidates[name]['val_drop_points']:.2f} pts")
    ok = {k: v for k, v in candidates.items() if v["val_drop_points"] <= args.max_drop}
    best = min(ok, key=lambda k: ok[k]["mb"]) if ok else min(candidates, key=lambda k: candidates[k]["val_drop_points"])
    int8 = run / f"leaf_int8_{best}.onnx"
    print(f"chosen recipe: {best}")

    report: dict = {"temperature": T, "size": size, "fp32_mb": fp32.stat().st_size / 1e6,
                    "int8_mb": int8.stat().st_size / 1e6, "calibration_images": len(cal_files), "recipes": candidates,
                    "chosen_recipe": best, "splits": {}}
    for name in ("val", "test", "ext_rocole"):
        rws = [r for r in rows if r["split"] == name]
        if not rws:
            continue
        rng.shuffle(rws); rws = rws[: args.eval_max]
        l32, y = run_onnx(fp32, rws, root, size)
        l8, _ = run_onnx(int8, rws, root, size)
        report["splits"][name] = {"n": len(rws), "acc_fp32": acc(l32, y), "acc_int8": acc(l8, y),
                                  "top1_agreement": float((l32.argmax(1) == l8.argmax(1)).mean())}
        print(name, report["splits"][name])

    ref = report["splits"].get("test") or report["splits"].get("val")
    drop = (ref["acc_fp32"] - ref["acc_int8"]) * 100
    ship_int8 = drop <= args.max_drop
    chosen, chosen_name = (int8, "leaf_int8.onnx") if ship_int8 else (fp32, "leaf_fp32.onnx")
    for old in ("leaf_int8.onnx", "leaf_fp32.onnx"):
        (out / old).unlink(missing_ok=True)
    shutil.copy(chosen, out / chosen_name)
    meta = {"classes": CLASSES, "temperature": T, "input_size": size, "mean": list(IMAGENET_MEAN), "std": list(IMAGENET_STD),
            "file": chosen_name, "quantized": ship_int8, "size_bytes": chosen.stat().st_size,
            "int8_recipe": best, "int8_accuracy_drop_points": round(drop, 2), "max_allowed_drop_points": args.max_drop}
    (out / "meta.json").write_text(json.dumps(meta, indent=1))
    report["shipped"] = chosen_name; report["accuracy_drop_points"] = drop
    (run / "export_report.json").write_text(json.dumps(report, indent=1))
    print(f"SHIPPED {chosen_name} ({chosen.stat().st_size / 1e6:.2f} MB); int8 drop {drop:.2f} pts (limit {args.max_drop})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
