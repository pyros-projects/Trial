import os

with open("src/style.css", "r") as f:
    css = f.read()

with open("src/index_body.html", "r") as f:
    body = f.read()

scripts = ["src/math3d.js", "src/simulation.js", "src/renderer.js", "src/audio.js", "src/ui.js", "src/main.js"]
js_parts = []
for s in scripts:
    with open(s, "r") as f:
        js_parts.append(f"// --- {s} ---\\n" + f.read())

full_js = "\n\n".join(js_parts)

index_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>3D Weather and Storm Laboratory</title>
  <style>
{css}
  </style>
</head>
<body>
{body}

<script>
{full_js}
</script>
</body>
</html>
"""

with open("index.html", "w") as f:
    f.write(index_html)

print(f"index.html successfully built! Size: {len(index_html):,} bytes")
