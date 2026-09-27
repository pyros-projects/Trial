"""Pixel measurements on agent-browser screenshots (run with: uv run --with pillow python pixels.py ...)."""
import colorsys, json, sys
from PIL import Image, ImageChops, ImageDraw, ImageStat

def region_mean(path, box):
    im = Image.open(path).convert('RGB').crop(box)
    r, g, b = [c / 255 for c in ImageStat.Stat(im).mean]
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    return {'rgb': [round(r, 3), round(g, 3), round(b, 3)], 'hue_deg': round(h * 360), 'sat': round(s, 2), 'val': round(v, 3)}

def diff(a, b, box):
    A = Image.open(a).convert('RGB').crop(box); B = Image.open(b).convert('RGB').crop(box)
    d = ImageStat.Stat(ImageChops.difference(A, B)).mean
    return {'mean_abs_diff_0_255': round(sum(d) / 3, 3)}

def lit_fraction(path, box, thresh=40):
    im = Image.open(path).convert('L').crop(box)
    hist = im.histogram(); total = sum(hist)
    return {'lit_fraction': round(sum(hist[thresh:]) / total, 4)}

def montage(out, cols, width, files):
    ims = [Image.open(f).convert('RGB') for f in files]
    w = width; h = int(ims[0].height * w / ims[0].width); rows = (len(ims) + cols - 1) // cols
    M = Image.new('RGB', (cols * w, rows * h), (24, 24, 24))
    for i, im in enumerate(ims):
        t = im.resize((w, int(im.height * w / im.width)), Image.LANCZOS).crop((0, 0, w, h))
        d = ImageDraw.Draw(t); d.rectangle([0, 0, 8 + 6 * len(files[i].split('/')[-1]), 14], fill=(0, 0, 0)); d.text((4, 2), files[i].split('/')[-1], fill=(255, 230, 0))
        M.paste(t, ((i % cols) * w, (i // cols) * h))
    M.save(out); return {'montage': out, 'size': M.size}

if __name__ == '__main__':
    cmd, *a = sys.argv[1:]
    box = lambda xs: tuple(int(v) for v in xs)
    if cmd == 'mean': print(json.dumps(region_mean(a[0], box(a[1:5]))))
    elif cmd == 'diff': print(json.dumps(diff(a[0], a[1], box(a[2:6]))))
    elif cmd == 'lit': print(json.dumps(lit_fraction(a[0], box(a[1:5]))))
    elif cmd == 'montage': print(json.dumps(montage(a[0], int(a[1]), int(a[2]), a[3:])))
