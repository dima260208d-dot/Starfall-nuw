import pathlib
from collections import deque
from PIL import Image

def strip_flat_bg(path: pathlib.Path, light_threshold=200, spread=18):
    img = Image.open(path).convert("RGBA")
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if r >= light_threshold and g >= light_threshold and b >= light_threshold:
                if max(r, g, b) - min(r, g, b) <= spread:
                    px[x, y] = (r, g, b, 0)
    img.save(path, "PNG")
    print("stripped light", path)

def strip_dark_bg_flood(path: pathlib.Path, threshold=32):
    img = Image.open(path).convert("RGBA")
    px = img.load()
    w, h = img.size

    def is_bg(r, g, b, a):
        if a == 0:
            return True
        return r <= threshold and g <= threshold and b <= threshold

    q = deque()
    for x in range(w):
        q.append((x, 0))
        q.append((x, h - 1))
    for y in range(h):
        q.append((0, y))
        q.append((w - 1, y))

    seen: set[tuple[int, int]] = set()
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h:
            continue
        if (x, y) in seen:
            continue
        seen.add((x, y))
        r, g, b, a = px[x, y]
        if not is_bg(r, g, b, a):
            continue
        px[x, y] = (0, 0, 0, 0)
        q.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])

    img.save(path, "PNG")
    print("stripped dark", path)

def strip_mode_icon(path: pathlib.Path):
    strip_dark_bg_flood(path)
    strip_flat_bg(path)

root = pathlib.Path(r"c:\Users\Дмитрий\Downloads\zip-repl\public\images")
root.mkdir(parents=True, exist_ok=True)

assets = pathlib.Path(r"C:\Users\Дмитрий\.cursor\projects\c-Users-Downloads-zip-repl\assets")
tab_src = assets / "mode-select-tab-monsters.png"
tab_dst = root / "mode-select-tab-monsters.png"
if tab_src.exists():
    tab_dst.write_bytes(tab_src.read_bytes())
    strip_mode_icon(tab_dst)

for name in ["mode-monsterhide.png", "mode-monster-invasion.png", "mode-team-hunt.png"]:
    p = root / name
    if p.exists():
        strip_mode_icon(p)
