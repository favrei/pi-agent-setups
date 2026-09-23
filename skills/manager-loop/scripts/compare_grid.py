#!/usr/bin/env python3
"""Deterministic visual evidence for manager-loop.

Builds a crop grid (rows = crops, columns = inputs), computes full-reference
metrics against a reference image, and records file hashes and timestamps so
the manager can detect stale, duplicated, or unchanged outputs.

Usage:
  python compare_grid.py \
    --inputs lr=lr.png bicubic=bic.png ours=sr.png ref=hr.png \
    --crops "120,80,96,96" "400,300,96,96" \
    --out evidence/03/img001 [--ref ref] [--y-channel] [--border 4] [--cell 256] [--same-threshold 50]

Crop coordinates are in the coordinate space of the LARGEST input (normally
the HR/reference). Smaller inputs (e.g. LR) are nearest-neighbour upscaled to
that size for display only; they are excluded from metrics.
"""
import argparse
import hashlib
import json
import os
import sys
from datetime import datetime, timezone

import numpy as np
from PIL import Image, ImageDraw, ImageFont

try:
    from skimage.metrics import structural_similarity
except ImportError:  # SSIM is optional
    structural_similarity = None


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def load_rgb(path):
    return np.asarray(Image.open(path).convert("RGB"), dtype=np.float64)


def to_y(img):
    # ITU-R BT.601, as commonly used in SR papers (range 16-235)
    r, g, b = img[..., 0], img[..., 1], img[..., 2]
    return 16.0 + (65.481 * r + 128.553 * g + 24.966 * b) / 255.0


def prep(img, y_channel, border):
    x = to_y(img) if y_channel else img
    if border > 0:
        x = x[border:-border, border:-border, ...]
    return x


def psnr(a, b):
    mse = np.mean((a - b) ** 2)
    if mse == 0:
        return float("inf")
    return float(10 * np.log10(255.0 ** 2 / mse))


def ssim(a, b):
    if structural_similarity is None:
        return None
    if a.ndim == 3:
        return float(structural_similarity(a, b, data_range=255.0, channel_axis=2))
    return float(structural_similarity(a, b, data_range=255.0))


def parse_crop(s):
    parts = [int(v) for v in s.split(",")]
    if len(parts) != 4:
        raise ValueError(f"crop must be x,y,w,h: {s}")
    return parts


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--inputs", nargs="+", required=True, help="name=path, in column order")
    ap.add_argument("--crops", nargs="+", required=True, help='"x,y,w,h" in largest-image coordinates')
    ap.add_argument("--out", required=True, help="output directory")
    ap.add_argument("--ref", default=None, help="name of reference input (default: 'ref' or 'hr' if present)")
    ap.add_argument("--y-channel", action="store_true", help="compute metrics on Y channel")
    ap.add_argument("--border", type=int, default=0, help="pixels to crop from each border before metrics")
    ap.add_argument("--cell", type=int, default=256, help="display size of each crop cell (px)")
    ap.add_argument("--same-threshold", type=float, default=50.0,
                    help="pairwise PSNR (dB) above which two outputs are flagged as near-identical")
    args = ap.parse_args()

    names, paths = [], []
    for item in args.inputs:
        if "=" not in item:
            sys.exit(f"--inputs entries must be name=path, got {item}")
        n, p = item.split("=", 1)
        if not os.path.isfile(p):
            sys.exit(f"missing file: {p}")
        names.append(n)
        paths.append(p)
    if len(set(names)) != len(names):
        sys.exit("duplicate input names")

    ref = args.ref or next((n for n in ("ref", "hr", "gt") if n in names), None)
    imgs = {n: load_rgb(p) for n, p in zip(names, paths)}
    H = max(im.shape[0] for im in imgs.values())
    W = max(im.shape[1] for im in imgs.values())
    crops = [parse_crop(c) for c in args.crops]
    for x, y, w, h in crops:
        if x < 0 or y < 0 or x + w > W or y + h > H:
            sys.exit(f"crop {x},{y},{w},{h} outside {W}x{H}")

    os.makedirs(args.out, exist_ok=True)

    # ---- hashes and timestamps ----
    hashes = {}
    for n, p in zip(names, paths):
        st = os.stat(p)
        hashes[n] = {
            "path": os.path.abspath(p),
            "sha256": sha256(p),
            "size_px": [int(imgs[n].shape[1]), int(imgs[n].shape[0])],
            "mtime_utc": datetime.fromtimestamp(st.st_mtime, timezone.utc).isoformat(),
        }
    by_hash = {}
    for n, v in hashes.items():
        by_hash.setdefault(v["sha256"], []).append(n)
    identical = [g for g in by_hash.values() if len(g) > 1]

    # ---- metrics ----
    full = [n for n in names if imgs[n].shape[:2] == (H, W)]
    metrics = {"config": {"y_channel": args.y_channel, "border": args.border, "reference": ref},
               "vs_reference": {}, "pairwise_psnr": {}, "warnings": []}
    if ref and ref in full:
        r = prep(imgs[ref], args.y_channel, args.border)
        for n in full:
            if n == ref:
                continue
            a = prep(imgs[n], args.y_channel, args.border)
            metrics["vs_reference"][n] = {"psnr": psnr(a, r), "ssim": ssim(a, r)}
    elif ref:
        metrics["warnings"].append(f"reference '{ref}' is not full size; no reference metrics")
    else:
        metrics["warnings"].append("no reference given; only pairwise metrics computed")

    others = [n for n in full if n != ref]
    for i in range(len(others)):
        for j in range(i + 1, len(others)):
            a = prep(imgs[others[i]], args.y_channel, args.border)
            b = prep(imgs[others[j]], args.y_channel, args.border)
            v = psnr(a, b)
            key = f"{others[i]}|{others[j]}"
            metrics["pairwise_psnr"][key] = v
            if v == float("inf") or v > args.same_threshold:
                metrics["warnings"].append(
                    f"{others[i]} and {others[j]} are near-identical (PSNR {v:.2f} dB): did the model actually run?")
    for g in identical:
        metrics["warnings"].append(f"byte-identical files: {g}")
    for n in names:
        if n not in full:
            metrics["warnings"].append(f"{n} is {hashes[n]['size_px']}, not {W}x{H}; shown upscaled (nearest), excluded from metrics")
    metrics["identical_pairs"] = identical

    # ---- grid ----
    cell = args.cell
    label_h = 28
    rows, cols = len(crops), len(names)
    grid = Image.new("RGB", (cols * cell, label_h + rows * (cell + label_h)), (255, 255, 255))
    draw = ImageDraw.Draw(grid)
    try:
        font = ImageFont.truetype("DejaVuSans.ttf", 16)
    except OSError:
        font = ImageFont.load_default()

    display = {}
    for n in names:
        im = Image.fromarray(imgs[n].astype(np.uint8))
        if im.size != (W, H):
            im = im.resize((W, H), Image.NEAREST)
        display[n] = im

    for c, n in enumerate(names):
        title = n
        if n in metrics["vs_reference"]:
            title += f"  {metrics['vs_reference'][n]['psnr']:.2f}dB"
        draw.text((c * cell + 6, 5), title, fill=(0, 0, 0), font=font)
    for r_i, (x, y, w, h) in enumerate(crops):
        top = label_h + r_i * (cell + label_h)
        draw.text((6, top + 5), f"crop {r_i}: x={x} y={y} w={w} h={h}", fill=(80, 80, 80), font=font)
        for c, n in enumerate(names):
            patch = display[n].crop((x, y, x + w, y + h)).resize((cell, cell), Image.NEAREST)
            grid.paste(patch, (c * cell, top + label_h))

    grid_path = os.path.join(args.out, "grid.png")
    grid.save(grid_path)
    with open(os.path.join(args.out, "metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2, default=lambda v: None)
    with open(os.path.join(args.out, "hashes.json"), "w") as f:
        json.dump(hashes, f, indent=2)

    print(f"grid: {grid_path}")
    for n, m in metrics["vs_reference"].items():
        s = f"{m['ssim']:.4f}" if m["ssim"] is not None else "n/a"
        print(f"{n}: PSNR {m['psnr']:.3f} dB  SSIM {s}")
    for w in metrics["warnings"]:
        print(f"WARNING: {w}")


if __name__ == "__main__":
    main()
