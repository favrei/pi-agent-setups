# Verifying visual research (image, video, super-resolution)

Visual work is where a cheap worker most often reports things that aren't true. The failures look like this: it says "sharper edges, fewer artifacts" without opening the images, compares the wrong pair of files, reports metrics from an earlier run, or presents a bicubic upscale as model output. Every rule below exists to make those failures impossible to miss.

## Rule 1: the manager fixes the evaluation before the worker runs

Put these in the brief *before* the worker produces anything:
- the exact eval image list (or a seed plus a sampling rule),
- the **crop list**: 4 to 8 fixed regions (x, y, w, h) chosen by you, covering text, edges, fine texture, flat areas, and one known failure case,
- the metric definitions: color space, Y channel or RGB, border crop, and data range.

Why: if the worker picks the crops or the images, it will pick the flattering ones. Nobody has to intend that for it to happen.

## Rule 2: evidence comes from the script, not from the worker's words

The worker runs `scripts/compare_grid.py` (or the project's equivalent) and reports only its output paths. Adjective claims ("looks better", "cleaner") are CLAIMED by default and don't count.

```bash
python scripts/compare_grid.py \
  --inputs lr=path/to/lr.png bicubic=path/to/bic.png ours=path/to/sr.png ref=path/to/hr.png \
  --crops "120,80,96,96" "400,300,96,96" \
  --scale 4 --out .agents/memory/inbox/evidence/03-sr/img001
```

It writes a crop grid PNG, `metrics.json` (PSNR and SSIM against `ref` if given), and `hashes.json`.

## Rule 3: the manager opens the grids

Open at least the first grid and one randomly chosen one yourself. Check:
- **Is the output actually different from bicubic?** Look at the crops. `compare_grid.py` also reports `identical_pairs` and PSNR between every pair. A "model output" that is near-identical to bicubic (flagged above `--same-threshold`, default 50 dB; tune it for your data) usually means the model didn't run or its output wasn't saved.
- **Alignment.** Do the crops show the same content in every column? An off-by-one scale or a missing border crop shifts content, which quietly wrecks the metrics.
- **Color.** Look for RGB/BGR swaps, a green or magenta cast, clipped highlights, or a wrong range (outputs saved as 0–1 floats, or double-normalized).
- **Hallucination.** In SR, invented texture and wrong characters (text, license plates) can raise perceptual scores while being wrong. For text or plates, read the characters in the crop and compare them to the reference.
- **Artifacts** the metrics hide: ringing, checkerboard patterns, tiling seams at patch borders, halo on edges.

## Rule 4: re-run one metric yourself

Pick 3 to 5 images from the list and re-run the metric script on them. Your numbers should match the worker's to about 0.01 dB. A mismatch means the worker's numbers come from a different run, different files, or a different metric config. Treat all of its numbers as CLAIMED until resolved.

## Rule 5: sanity checks on the numbers

- Improvements on every metric and every image are suspicious. Real changes have trade-offs.
- A PSNR gain above about 1 dB from a small change deserves a second look.
- Identical numbers across different checkpoints mean the same outputs were evaluated twice.
- Compare against a baseline measured in the same run, not a number copied from an old report.

## Video

- Check that frame counts and frame indices match across compared videos. Off-by-one frame alignment is common.
- Extract the same 3 to 5 frame indices from each video (fixed by the manager) and run the image rules on them.
- Temporal problems (flicker, shimmer on text, jitter) don't show up in single frames. Build a strip of the same crop across 8 consecutive frames and look at it.

## What goes to the user

Grids you opened, metrics you reproduced, and a plain statement of which images you personally inspected. If an important visual claim was only spot-checked, say so.
