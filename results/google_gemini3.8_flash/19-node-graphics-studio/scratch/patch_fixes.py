import re

# Fix gen_glsl.py
with open('scratch/gen_glsl.py', 'r') as f:
    glsl = f.read()

glsl = glsl.replace(
    """float sdfPolygon(vec2 p, vec2 center, float r, int sides) {
    p -= center;
    float an = TWO_PI / float(max(sides, 3));""",
    """float sdfPolygon(vec2 p, vec2 center, float r, int sides) {
    p -= center;
    float s = float(sides);
    if (s < 3.0) s = 3.0;
    float an = TWO_PI / s;"""
)

glsl = glsl.replace(
    """float sdfStar(vec2 p, vec2 center, float rIn, float rOut, int points) {
    p -= center;
    float an = PI / float(max(points, 3));""",
    """float sdfStar(vec2 p, vec2 center, float rIn, float rOut, int points) {
    p -= center;
    float pt = float(points);
    if (pt < 3.0) pt = 3.0;
    float an = PI / pt;"""
)

# Also add derivative extension at top of GLSL if WebGL 1
glsl = glsl.replace(
    "precision highp float;",
    """#ifdef GL_OES_standard_derivatives
#extension GL_OES_standard_derivatives : enable
#endif
precision highp float;"""
)

with open('scratch/gen_glsl.py', 'w') as f:
    f.write(glsl)

# Fix js_state_compiler.py to prefer webgl2
with open('scratch/js_state_compiler.py', 'r') as f:
    sc = f.read()

sc = sc.replace(
    "this.gl = this.canvas.getContext('webgl', { preserveDrawingBuffer: true, antialias: true }) ||\\n              this.canvas.getContext('experimental-webgl', { preserveDrawingBuffer: true });",
    """this.gl = this.canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: true }) ||
              this.canvas.getContext('webgl', { preserveDrawingBuffer: true, antialias: true }) ||
              this.canvas.getContext('experimental-webgl', { preserveDrawingBuffer: true });
    if (this.gl && !this.gl.createVertexArray) {
      this.gl.getExtension('OES_standard_derivatives');
    }"""
)

with open('scratch/js_state_compiler.py', 'w') as f:
    f.write(sc)

# Fix js_ui_export.py offCanvas in exportPNG to prefer webgl2
with open('scratch/js_ui_export.py', 'r') as f:
    ue = f.read()

ue = ue.replace(
    "const gl = offCanvas.getContext('webgl', { preserveDrawingBuffer: true, antialias: true });",
    """const gl = offCanvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: true }) ||
             offCanvas.getContext('webgl', { preserveDrawingBuffer: true, antialias: true });
  if (gl && !gl.createVertexArray) gl.getExtension('OES_standard_derivatives');"""
)

with open('scratch/js_ui_export.py', 'w') as f:
    f.write(ue)

print("Fixes applied.")
