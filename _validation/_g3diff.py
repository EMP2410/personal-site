import json, os
from PIL import Image, ImageChops

HERE = r"C:\Users\11293\Desktop\ren web\personal-site\_validation"
SHOTS = os.path.join(HERE, "shots")
meta = json.load(open(os.path.join(HERE, "out_g3_meta.json"), encoding="utf-8"))

print(f"{'page':<8}{'w':<6}{'flex':<9}{'main box':<26}{'diffpx in main':<14}{'overlap bbox'}")
rows = []
for m in meta:
    a = Image.open(os.path.join(SHOTS, f"A_{m['name']}.png")).convert("RGB")
    b = Image.open(os.path.join(SHOTS, f"B_{m['name']}.png")).convert("RGB")
    if a.size != b.size:
        print(f"{m['page']:<8}{m['width']:<6}size mismatch {a.size} vs {b.size}")
        continue
    diff = ImageChops.difference(a, b).convert("L")
    # region = main column bbox (page coordinates == screenshot coords for fullPage)
    x0 = int(m["main"]["x"]); y0 = int(m["main"]["y"])
    x1 = int(m["main"]["x"] + m["main"]["w"]); y1 = int(m["main"]["y"] + m["main"]["h"])
    x0 = max(0, x0); y0 = max(0, y0); x1 = min(a.size[0], x1); y1 = min(a.size[1], y1)
    region = diff.crop((x0, y0, x1, y1))
    bbox = region.getbbox()
    n = 0
    if bbox:
        # count pixels above a small threshold
        import numpy as np
    # fallback: pure python count
    px = region.load()
    w, h = region.size
    cnt = 0
    for yy in range(h):
        for xx in range(w):
            if px[xx, yy] > 12:
                cnt += 1
    overlap = (cnt > 0)
    bb = None
    if bbox:
        bb = (x0 + bbox[0], y0 + bbox[1], x0 + bbox[2], y0 + bbox[3])
    rows.append((m["page"], m["width"], m["flexDir"], (x0, y0, x1, y1), cnt, bb))
    flag = "   <<< SIDEBAR PAINTS OVER MAIN" if cnt > 0 else ""
    bbs = f"{bb}" if bb else "-"
    print(f"{m['page']:<8}{m['width']:<6}{m['flexDir']:<9}{str((x0,y0,x1,y1)):<26}{cnt:<14}{bbs}{flag}")

bad = [r for r in rows if r[4] > 0]
print()
print(f"pages with sidebar-over-main pixels: {len(bad)} / {len(rows)}")
for r in bad:
    print("   ", r[0], r[1], "diffpx=", r[4], "bbox=", r[5])
