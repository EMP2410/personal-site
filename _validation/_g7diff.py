"""READ-ONLY verification: G7 pixel diff.

Compares G7A_*.png (as rendered) with G7B_*.png (left sidebar hidden) inside the
article's bounding box. Any non-zero difference means the navigation painted over
the article.
"""
import json
import os
import sys

from PIL import Image, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(HERE, "shots")

with open(os.path.join(HERE, "out_g7_meta.json"), encoding="utf-8") as fh:
    meta = json.load(fh)

rows = []
for entry in meta:
    tag = entry["tag"]
    a_path = os.path.join(SHOTS, f"G7A_{tag}.png")
    b_path = os.path.join(SHOTS, f"G7B_{tag}.png")
    if not (os.path.exists(a_path) and os.path.exists(b_path)):
        print(f"  MISSING screenshot for {tag}")
        continue

    a = Image.open(a_path).convert("RGB")
    b = Image.open(b_path).convert("RGB")
    if a.size != b.size:
        print(f"  SIZE MISMATCH for {tag}: {a.size} vs {b.size}")
        continue

    # Clip to the article column and to the viewport.
    x0 = max(0, entry["main"]["x"])
    y0 = max(0, entry["main"]["y"])
    x1 = min(a.size[0], x0 + entry["main"]["w"])
    y1 = min(a.size[1], y0 + entry["main"]["h"])

    if x1 <= x0 or y1 <= y0:
        rows.append((tag, 0, (x0, y0, x1, y1)))
        continue

    diff = ImageChops.difference(a.crop((x0, y0, x1, y1)), b.crop((x0, y0, x1, y1)))
    bbox = diff.getbbox()
    changed = 0 if bbox is None else sum(1 for px in diff.getdata() if px != (0, 0, 0))
    rows.append((tag, changed, (x0, y0, x1, y1)))

print(f"cases={len(rows)}")
bad = 0
for tag, changed, region in rows:
    flag = "OK " if changed == 0 else "OVERLAP"
    if changed:
        bad += 1
    print(f"  {flag} {tag:24s} differing-pixels-in-article={changed:8d}  region={region}")

print()
print(f"RESULT: {len(rows) - bad}/{len(rows)} clean, {bad} with painted-over article")
sys.exit(1 if bad else 0)
