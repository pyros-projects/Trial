import sys
from PIL import Image, ImageDraw
out, cols, width = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
files = sys.argv[4:]
ims = [Image.open(f).convert('RGB') for f in files]
w = width; h = int(ims[0].height * w / ims[0].width)
rows = (len(ims) + cols - 1) // cols
M = Image.new('RGB', (cols * w, rows * h), (30, 30, 30))
for i, im in enumerate(ims):
    t = im.resize((w, h), Image.LANCZOS)
    d = ImageDraw.Draw(t); d.rectangle([0, 0, 180, 16], fill=(0, 0, 0)); d.text((4, 3), files[i].split('/')[-1], fill=(255, 255, 0))
    M.paste(t, ((i % cols) * w, (i // cols) * h))
M.save(out)
print(out, M.size)
