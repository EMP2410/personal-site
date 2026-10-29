"""Scroll-aware overlap check for verify_g9_scroll.mjs.

A = normal render, B = the same page with the left sidebar hidden (visibility:hidden,
so the layout is untouched). Every pixel that differs was painted by the navigation.
Pixels that differ *inside the article column* are the ones the reader perceives as
the navigation text colliding with the body text.

The article column is taken from the recorded geometry (viewport coordinates), so the
number is independent of the scroll offset.
"""
import json
import os
from PIL import Image, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(HERE, "shots")
META = os.path.join(HERE, "out_g9_meta.json")

with open(META, encoding="utf-8") as fh:
    meta = json.load(fh)

rows = []
bad = 0
for m in meta:
    a_path = os.path.join(SHOTS, "A_%s.png" % m["key"])
    b_path = os.path.join(SHOTS, "B_%s.png" % m["key"])
    if not (os.path.exists(a_path) and os.path.exists(b_path)):
        continue
    a = Image.open(a_path).convert("RGB")
    b = Image.open(b_path).convert("RGB")
    if a.size != b.size:
        b = b.resize(a.size)
    w, h = a.size
    mask = ImageChops.difference(a, b).convert("L").point(lambda v: 255 if v > 12 else 0)
    total = sum(1 for px in mask.getdata() if px)

    # viewport rectangle of the article column
    mx0 = max(0, m["main"]["x"])
    mx1 = min(w, m["main"]["x"] + m["main"]["w"])
    my0 = max(0, m["main"]["y"])
    my1 = min(h, m["main"]["y"] + m["main"]["h"])
    in_article = 0
    if mx1 > mx0 and my1 > my0:
        crop = mask.crop((mx0, my0, mx1, my1))
        in_article = sum(1 for px in crop.getdata() if px)

    # does the navigation column intersect the article column at all?
    sbx1 = m["sb"]["x"] + m["sb"]["w"]
    columns_overlap = m["sb"]["x"] < m["main"]["x"] + m["main"]["w"] and m["main"]["x"] < sbx1

    rows.append((m["key"], m["dir"], total, in_article, columns_overlap))
    if in_article:
        bad += 1

print("key                          dir      diff_px  in_article  columns_overlap")
for key, direction, total, in_article, cols in rows:
    print("%-28s %-7s %8d  %9d  %s" % (key, direction, total, in_article, cols))

print()
print("RESULT: %d/%d clean, %d with navigation pixels inside the article column"
      % (len(rows) - bad, len(rows), bad))